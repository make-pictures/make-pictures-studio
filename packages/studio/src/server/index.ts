import { execFile, spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import type {
  ProductionManifest,
  SceneDefinition,
  ScenesManifest,
  SceneVoiceoverData,
  VoiceAcousticPreset,
  VoiceSettingsConfig,
} from '../../../core/src/index';
import {
  StylePresetSchema,
  type StylePreset,
} from '../../../core/src/style/schema';
import { isBuiltInStyleId } from '../../../core/src/style/presets';

export interface StartStudioServerOptions {
  rootDir?: string;
  studioDir?: string;
  port?: number;
  host?: string;
}

export interface StudioServerPluginOptions {
  rootDir?: string;
  studioDir?: string;
}

export interface SceneAudioStatusItem {
  sceneId: string;
  title: string;
  speaker?: string;
  mp3Exists: boolean;
  jsonExists: boolean;
  provider: 'elevenlabs' | 'synthetic-fallback' | 'missing';
  isHashCurrent: boolean;
  wordCount: number;
  durationInSeconds: number;
}

export interface StudioCapsuleScenesGroup {
  id: string;
  title: string;
  origin: 'root' | 'production';
  manifestFile: string;
  fps: number;
  scenes: SceneDefinition[];
}

export interface StudioScenesResponse {
  ok: true;
  hasApiKey: boolean;
  groups: StudioCapsuleScenesGroup[];
  audioStatus: Record<string, SceneAudioStatusItem>;
}

const VALID_VOICE_EFFECTS = new Set<VoiceAcousticPreset>([
  'clean',
  'telephone',
  'radio-walkie',
  'cathedral',
  'megaphone',
  'excitement-boost',
]);

const VALID_VOICE_SETTINGS_KEYS = new Set<keyof VoiceSettingsConfig>([
  'stability',
  'similarityBoost',
  'style',
  'speed',
  'useSpeakerBoost',
]);

const SAFE_REL_PROPS_RE = /^[A-Za-z0-9_./-]+\.props\.json$/;
const COMP_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PROD_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const QA_FILE_PATTERN = /^qa-[A-Za-z0-9_-]+\.png$/;
const MAX_JSON_BODY_BYTES = 256 * 1024;
const VIRTUAL_MAIN_ID = 'virtual:make-pictures-studio-main';
const RESOLVED_VIRTUAL_MAIN_ID = `\0${VIRTUAL_MAIN_ID}`;

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_RE = /\x1B\[[0-9;]*[A-Za-z]/g;

function stripAnsi(input: string): string {
  return input.replace(ANSI_ESCAPE_RE, '');
}

function toPosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

function toKebabSlug(compId: string): string {
  return compId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
}

function resolveLocalBin(rootDir: string, binName: string): string {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const candidate = path.join(
    rootDir,
    'node_modules',
    '.bin',
    `${binName}${ext}`
  );
  return fs.existsSync(candidate) ? candidate : binName;
}

interface CliRunnerSpec {
  command: string;
  prefixArgs: string[];
}

/**
 * Resolves the `make-pictures` CLI runner across both the source-first monorepo
 * (`packages/cli/src/index.ts` via `tsx`) and external npm consumer projects
 * (`node_modules/@make-pictures/cli/dist/bin.mjs` or `node_modules/.bin/make-pictures`).
 */
function resolveCliRunner(rootDir: string): CliRunnerSpec {
  const monorepoCliSrc = path.join(rootDir, 'packages', 'cli', 'src', 'index.ts');
  if (fs.existsSync(monorepoCliSrc)) {
    return {
      command: resolveLocalBin(rootDir, 'tsx'),
      prefixArgs: [monorepoCliSrc],
    };
  }

  const installedCliBinMjs = path.join(
    rootDir,
    'node_modules',
    '@make-pictures',
    'cli',
    'dist',
    'bin.mjs'
  );
  if (fs.existsSync(installedCliBinMjs)) {
    return {
      command: process.execPath,
      prefixArgs: [installedCliBinMjs],
    };
  }

  const ext = process.platform === 'win32' ? '.cmd' : '';
  const dotBin = path.join(
    rootDir,
    'node_modules',
    '.bin',
    `make-pictures${ext}`
  );
  if (fs.existsSync(dotBin)) {
    return {
      command: dotBin,
      prefixArgs: [],
    };
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    prefixArgs: ['make-pictures'],
  };
}

function findStudioPackageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    const pkgJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
          name?: string;
        };
        if (parsed.name === '@make-pictures/studio') {
          return dir;
        }
      } catch {
        // continue walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function sendSseEvent(
  res: ServerResponse,
  payload: Record<string, unknown>
): void {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_JSON_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('Expected JSON object body'));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

function computeTextHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

/**
 * Ensures `<studioDir>/public/_productions/<slug>` symlinks to `../../productions/<slug>/assets`
 * for every isolated production capsule on disk so `staticFile(productionAssetPath(...))`
 * works identically in Vite Studio Web and Remotion CLI.
 */
export function syncProductionAssetSymlinks(studioDir: string): void {
  const productionsDir = path.join(studioDir, 'productions');
  if (!fs.existsSync(productionsDir)) return;

  const publicMirrorRoot = path.join(studioDir, 'public', '_productions');
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(productionsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (!PROD_SLUG_PATTERN.test(entry.name)) continue;

    const assetsDir = path.join(productionsDir, entry.name, 'assets');
    if (!fs.existsSync(assetsDir)) continue;

    fs.mkdirSync(publicMirrorRoot, { recursive: true });
    const linkPath = path.join(publicMirrorRoot, entry.name);
    const relTarget = path.relative(publicMirrorRoot, assetsDir);

    try {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        const currentTarget = fs.readlinkSync(linkPath);
        if (path.resolve(publicMirrorRoot, currentTarget) === assetsDir) {
          continue;
        }
        fs.unlinkSync(linkPath);
      } else {
        continue;
      }
    } catch {
      // Link does not exist yet
    }

    try {
      fs.symlinkSync(
        relTarget,
        linkPath,
        process.platform === 'win32' ? 'junction' : 'dir'
      );
    } catch {
      // Ignore concurrent symlink race
    }
  }
}

function checkEnvFileForApiKey(envFilePath: string): boolean {
  if (!fs.existsSync(envFilePath)) return false;
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line
      .slice(eqIdx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (
      key === 'ELEVENLABS_API_KEY' &&
      val.length > 0 &&
      val !== 'your_elevenlabs_api_key_here' &&
      val !== 'twoj_klucz_api_elevenlabs'
    ) {
      return true;
    }
  }
  return false;
}

function hasConfiguredApiKey(rootDir: string, studioDir: string): boolean {
  if (
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_API_KEY.trim().length > 0
  ) {
    return true;
  }
  return (
    checkEnvFileForApiKey(path.join(studioDir, '.env.local')) ||
    checkEnvFileForApiKey(path.join(rootDir, '.env.local'))
  );
}

function populateManifestScenesStatus(
  scenes: ScenesManifest['scenes'],
  voiceoversDir: string,
  scenesMap: Record<string, SceneAudioStatusItem>
): void {
  for (const scene of scenes ?? []) {
    const mp3Path = path.join(voiceoversDir, `${scene.id}.mp3`);
    const jsonPath = path.join(voiceoversDir, `${scene.id}.json`);
    const mp3Exists = fs.existsSync(mp3Path);
    const jsonExists = fs.existsSync(jsonPath);

    const expectedLegacyHash = computeTextHash(
      scene.voiceSettings
        ? `${scene.text}|${JSON.stringify(scene.voiceSettings)}`
        : scene.text
    );

    let provider: SceneAudioStatusItem['provider'] = 'missing';
    let isHashCurrent = false;
    let wordCount = 0;
    let durationInSeconds = scene.durationInSeconds;

    if (jsonExists) {
      try {
        const voData = JSON.parse(
          fs.readFileSync(jsonPath, 'utf8')
        ) as SceneVoiceoverData;
        provider = voData.provider;
        isHashCurrent =
          Boolean(voData.textHash) &&
          (voData.textHash === expectedLegacyHash ||
            voData.text?.trim() === scene.text.trim());
        wordCount = Array.isArray(voData.words) ? voData.words.length : 0;
        durationInSeconds =
          voData.durationInSeconds ?? scene.durationInSeconds;
      } catch {
        provider = 'missing';
      }
    }

    scenesMap[scene.id] = {
      sceneId: scene.id,
      title: scene.title ?? scene.id,
      speaker: scene.speaker,
      mp3Exists,
      jsonExists,
      provider: mp3Exists && jsonExists ? provider : 'missing',
      isHashCurrent: mp3Exists && jsonExists && isHashCurrent,
      wordCount,
      durationInSeconds,
    };
  }
}

function collectAudioStatus(
  rootDir: string,
  studioDir: string
): {
  hasApiKey: boolean;
  scenes: Record<string, SceneAudioStatusItem>;
} {
  syncProductionAssetSymlinks(studioDir);

  const scenesPath = path.join(studioDir, 'scenes.json');
  const voiceoversDir = path.join(studioDir, 'public', 'voiceovers');
  const scenesMap: Record<string, SceneAudioStatusItem> = {};

  if (fs.existsSync(scenesPath)) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(scenesPath, 'utf8')
      ) as ScenesManifest;
      populateManifestScenesStatus(manifest.scenes, voiceoversDir, scenesMap);
    } catch {
      // Ignore malformed scenes.json during active editing
    }
  }

  // Also collect scene status for isolated capsules in `<studioDir>/productions/<slug>/`
  const productionsDir = path.join(studioDir, 'productions');
  if (fs.existsSync(productionsDir)) {
    try {
      const entries = fs.readdirSync(productionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const prodManifestPath = path.join(
          productionsDir,
          entry.name,
          'production.json'
        );
        if (!fs.existsSync(prodManifestPath)) continue;
        try {
          const prodManifest = JSON.parse(
            fs.readFileSync(prodManifestPath, 'utf8')
          ) as ProductionManifest;
          const prodVoDir = path.join(
            productionsDir,
            entry.name,
            'assets',
            'voiceovers'
          );
          populateManifestScenesStatus(
            prodManifest.scenes,
            prodVoDir,
            scenesMap
          );
        } catch {
          // Ignore malformed capsule manifest during editing
        }
      }
    } catch {
      // Ignore
    }
  }

  return {
    hasApiKey: hasConfiguredApiKey(rootDir, studioDir),
    scenes: scenesMap,
  };
}

function isAllowedPropsPath(
  rootDir: string,
  studioDir: string,
  propsFile: string
): string | null {
  if (
    !SAFE_REL_PROPS_RE.test(propsFile) ||
    propsFile.includes('..') ||
    path.isAbsolute(propsFile)
  ) {
    return null;
  }

  const allowedRoots = Array.from(
    new Set([
      path.resolve(studioDir, 'src', 'compositions'),
      path.resolve(studioDir, 'examples'),
      path.resolve(studioDir, 'productions'),
      path.resolve(rootDir, 'src', 'compositions'),
      path.resolve(rootDir, 'examples'),
      path.resolve(rootDir, 'productions'),
    ])
  );

  // Try resolving relative to `studioDir` first (handles `--dir=videos` capsules cleanly),
  // then fall back to `rootDir`.
  const candidates =
    studioDir !== rootDir
      ? [path.resolve(studioDir, propsFile), path.resolve(rootDir, propsFile)]
      : [path.resolve(rootDir, propsFile)];

  for (const candidate of candidates) {
    if (
      allowedRoots.some((allowed) => candidate.startsWith(allowed + path.sep))
    ) {
      return candidate;
    }
  }

  return null;
}

export function readCustomStylesFromDisk(studioDir: string): {
  ok: true;
  styles: StylePreset[];
  warnings: string[];
} {
  const stylesDir = path.resolve(studioDir, 'styles');
  if (!fs.existsSync(stylesDir)) {
    return { ok: true, styles: [], warnings: [] };
  }

  const styles: StylePreset[] = [];
  const warnings: string[] = [];

  let entries: string[] = [];
  try {
    entries = fs
      .readdirSync(stylesDir)
      .filter((name) => name.endsWith('.style.json'))
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    warnings.push(
      `Nie udało się odczytać katalogu styles/: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return { ok: true, styles, warnings };
  }

  for (const fileName of entries) {
    const absPath = path.join(stylesDir, fileName);
    try {
      const rawText = fs.readFileSync(absPath, 'utf8');
      const rawJson = JSON.parse(rawText) as unknown;
      const parsed = StylePresetSchema.safeParse(rawJson);
      if (!parsed.success) {
        warnings.push(
          `Pominięto nieprawidłowy plik styles/${fileName}: ${
            parsed.error.issues[0]?.message ?? 'błąd walidacji schematu'
          }`
        );
        continue;
      }
      if (isBuiltInStyleId(parsed.data.id)) {
        warnings.push(
          `Pominięto styles/${fileName}: identyfikator "${parsed.data.id}" jest zarezerwowany dla stylu wbudowanego.`
        );
        continue;
      }
      styles.push(parsed.data);
    } catch (err) {
      warnings.push(
        `Nie udało się sparsować styles/${fileName}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return { ok: true, styles, warnings };
}

export function saveCustomStyleToDisk(
  studioDir: string,
  payload: { slug?: unknown; style?: unknown }
): { statusCode: number; body: Record<string, unknown> } {
  const rawSlug = typeof payload?.slug === 'string' ? payload.slug.trim() : '';

  if (!PROD_SLUG_PATTERN.test(rawSlug)) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error:
          'Nieprawidłowy identyfikator stylu (slug). Dozwolone są małe litery, cyfry i myślniki (1–63 znaki).',
      },
    };
  }

  if (isBuiltInStyleId(rawSlug)) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: `Identyfikator "${rawSlug}" jest zarezerwowany dla stylu wbudowanego (built-in) i nie może zostać nadpisany.`,
      },
    };
  }

  if (
    !payload?.style ||
    typeof payload.style !== 'object' ||
    Array.isArray(payload.style)
  ) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: 'Pole style musi być poprawnym obiektem JSON.',
      },
    };
  }

  const stylesDir = path.resolve(studioDir, 'styles');
  const resolvedTarget = path.resolve(stylesDir, `${rawSlug}.style.json`);
  if (!resolvedTarget.startsWith(stylesDir + path.sep)) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: 'Niedozwolona ścieżka pliku stylu.',
      },
    };
  }

  const candidate = {
    ...(payload.style as Record<string, unknown>),
    id: rawSlug,
  };
  const parsed = StylePresetSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const issuePath = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: `Błąd walidacji schematu stylu (${issuePath}${
          issue?.message ?? 'nieprawidłowe dane'
        }).`,
      },
    };
  }

  fs.mkdirSync(stylesDir, { recursive: true });
  const formatted = `${JSON.stringify(parsed.data, null, 2)}\n`;
  const tmpPath = `${resolvedTarget}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, formatted, 'utf8');
  fs.renameSync(tmpPath, resolvedTarget);

  return {
    statusCode: 200,
    body: {
      ok: true,
      slug: rawSlug,
      styleFile: `styles/${rawSlug}.style.json`,
      style: parsed.data,
      savedAt: new Date().toISOString(),
    },
  };
}

export function readStudioScenesFromDisk(
  rootDir: string,
  studioDir: string
): StudioScenesResponse {
  const resolvedRootDir = path.resolve(rootDir);
  const resolvedStudioDir = path.resolve(resolvedRootDir, studioDir);
  const groups: StudioCapsuleScenesGroup[] = [];

  const rootScenesPath = path.join(resolvedStudioDir, 'scenes.json');
  if (fs.existsSync(rootScenesPath)) {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(rootScenesPath, 'utf8')
      ) as Partial<ScenesManifest> & { title?: unknown; fps?: unknown };
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Array.isArray(parsed.scenes)
      ) {
        const title =
          typeof parsed.project?.title === 'string' &&
          parsed.project.title.trim().length > 0
            ? parsed.project.title.trim()
            : typeof parsed.title === 'string' && parsed.title.trim().length > 0
              ? parsed.title.trim()
              : 'scenes.json';
        const fps =
          typeof parsed.project?.fps === 'number' &&
          Number.isFinite(parsed.project.fps) &&
          parsed.project.fps > 0
            ? parsed.project.fps
            : typeof parsed.fps === 'number' &&
                Number.isFinite(parsed.fps) &&
                parsed.fps > 0
              ? parsed.fps
              : 60;

        groups.push({
          id: 'root',
          title,
          origin: 'root',
          manifestFile: 'scenes.json',
          fps,
          scenes: parsed.scenes,
        });
      }
    } catch {
      // Ignore malformed scenes.json during active editing
    }
  }

  const productionsDir = path.join(resolvedStudioDir, 'productions');
  if (fs.existsSync(productionsDir)) {
    try {
      const entries = fs
        .readdirSync(productionsDir, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            entry.name !== 'root' &&
            PROD_SLUG_PATTERN.test(entry.name)
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const prodManifestPath = path.join(
          productionsDir,
          entry.name,
          'production.json'
        );
        if (!fs.existsSync(prodManifestPath)) continue;

        try {
          const prodManifest = JSON.parse(
            fs.readFileSync(prodManifestPath, 'utf8')
          ) as Partial<ProductionManifest>;
          if (
            prodManifest &&
            typeof prodManifest === 'object' &&
            !Array.isArray(prodManifest) &&
            Array.isArray(prodManifest.scenes)
          ) {
            const title =
              typeof prodManifest.title === 'string' &&
              prodManifest.title.trim().length > 0
                ? prodManifest.title.trim()
                : entry.name;
            const fps =
              typeof prodManifest.fps === 'number' &&
              Number.isFinite(prodManifest.fps) &&
              prodManifest.fps > 0
                ? prodManifest.fps
                : 60;

            groups.push({
              id: entry.name,
              title,
              origin: 'production',
              manifestFile: `productions/${entry.name}/production.json`,
              fps,
              scenes: prodManifest.scenes,
            });
          }
        } catch {
          // Ignore malformed capsule manifest during active editing
        }
      }
    } catch {
      // Ignore unreadable productions directory
    }
  }

  const audio = collectAudioStatus(resolvedRootDir, resolvedStudioDir);

  return {
    ok: true,
    hasApiKey: audio.hasApiKey,
    groups,
    audioStatus: audio.scenes,
  };
}

export function saveStudioSceneToDisk(
  _rootDir: string,
  studioDir: string,
  payload: { targetId?: unknown; sceneId?: unknown; patch?: unknown }
): { statusCode: number; body: Record<string, unknown> } {
  const resolvedRootDir = path.resolve(_rootDir);
  const resolvedStudioDir = path.resolve(resolvedRootDir, studioDir);
  const rawTargetId =
    typeof payload?.targetId === 'string' ? payload.targetId.trim() : '';

  if (!rawTargetId || rawTargetId.includes('..')) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: 'Nieprawidłowy identyfikator celu (targetId).',
      },
    };
  }

  let resolvedManifestPath: string;
  let manifestFile: string;
  let canonicalTargetId: string;

  if (rawTargetId === '__root__' || rawTargetId === 'root') {
    if (
      rawTargetId === 'root' &&
      fs.existsSync(path.join(resolvedStudioDir, 'productions', 'root'))
    ) {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error:
            'Kolizja identyfikatora "root" z katalogiem productions/root. Użyj "__root__" dla pliku scenes.json.',
        },
      };
    }

    resolvedManifestPath = path.resolve(resolvedStudioDir, 'scenes.json');
    if (path.dirname(resolvedManifestPath) !== resolvedStudioDir) {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: 'Niedozwolona ścieżka pliku scenes.json.',
        },
      };
    }
    manifestFile = 'scenes.json';
    canonicalTargetId = 'root';
  } else {
    if (!PROD_SLUG_PATTERN.test(rawTargetId)) {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error:
            'Nieprawidłowy identyfikator kapsuły (targetId). Dozwolone są małe litery, cyfry i myślniki (1–63 znaki).',
        },
      };
    }

    const productionsDir = path.resolve(resolvedStudioDir, 'productions');
    resolvedManifestPath = path.resolve(
      productionsDir,
      rawTargetId,
      'production.json'
    );
    if (!resolvedManifestPath.startsWith(productionsDir + path.sep)) {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: 'Niedozwolona ścieżka manifestu kapsuły.',
        },
      };
    }
    manifestFile = `productions/${rawTargetId}/production.json`;
    canonicalTargetId = rawTargetId;
  }

  if (!fs.existsSync(resolvedManifestPath)) {
    return {
      statusCode: 404,
      body: {
        ok: false,
        error: `Nie znaleziono pliku manifestu: ${manifestFile}.`,
      },
    };
  }

  const sceneId =
    typeof payload?.sceneId === 'string' ? payload.sceneId.trim() : '';
  if (!sceneId) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: 'Pole sceneId musi być niepustym ciągiem znaków.',
      },
    };
  }

  if (
    !payload?.patch ||
    typeof payload.patch !== 'object' ||
    Array.isArray(payload.patch)
  ) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: 'Pole patch musi być poprawnym obiektem JSON.',
      },
    };
  }

  let manifestObj: Record<string, unknown>;
  try {
    const rawJson = JSON.parse(
      fs.readFileSync(resolvedManifestPath, 'utf8')
    ) as unknown;
    if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: 'Plik manifestu scen nie jest poprawnym obiektem JSON.',
        },
      };
    }
    manifestObj = rawJson as Record<string, unknown>;
  } catch (err) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: `Nie udało się sparsować pliku ${manifestFile}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
  }

  if (!Array.isArray(manifestObj.scenes)) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: `Plik ${manifestFile} nie zawiera tablicy scenes.`,
      },
    };
  }

  const manifestScenes = manifestObj.scenes as Array<
    SceneDefinition & Record<string, unknown>
  >;
  const sceneIndex = manifestScenes.findIndex(
    (item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      item.id === sceneId
  );

  if (sceneIndex === -1) {
    return {
      statusCode: 404,
      body: {
        ok: false,
        error: `Nie znaleziono sceny o identyfikatorze "${sceneId}" w pliku ${manifestFile}.`,
      },
    };
  }

  const patch = payload.patch as Record<string, unknown>;
  const existingScene = manifestScenes[sceneIndex];
  const updatedScene: SceneDefinition & Record<string, unknown> = {
    ...existingScene,
  };

  if ('text' in patch && patch.text !== undefined) {
    if (typeof patch.text !== 'string' || patch.text.trim().length < 1) {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: 'Tekst lektora (text) musi być niepustym ciągiem znaków.',
        },
      };
    }
    updatedScene.text = patch.text;
  }

  if ('title' in patch) {
    if (patch.title === undefined || patch.title === null) {
      delete updatedScene.title;
    } else if (typeof patch.title === 'string') {
      if (patch.title.trim().length === 0) {
        delete updatedScene.title;
      } else {
        updatedScene.title = patch.title.trim();
      }
    } else {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: 'Pole title musi być ciągiem znaków.',
        },
      };
    }
  }

  if ('speaker' in patch) {
    if (patch.speaker === undefined || patch.speaker === null) {
      delete updatedScene.speaker;
    } else if (typeof patch.speaker === 'string') {
      if (patch.speaker.trim().length === 0) {
        delete updatedScene.speaker;
      } else {
        updatedScene.speaker = patch.speaker.trim();
      }
    } else {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: 'Pole speaker musi być ciągiem znaków.',
        },
      };
    }
  }

  if ('voiceId' in patch) {
    if (patch.voiceId === undefined || patch.voiceId === null) {
      delete updatedScene.voiceId;
    } else if (typeof patch.voiceId === 'string') {
      if (patch.voiceId.trim().length === 0) {
        delete updatedScene.voiceId;
      } else {
        updatedScene.voiceId = patch.voiceId.trim();
      }
    } else {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: 'Pole voiceId musi być ciągiem znaków.',
        },
      };
    }
  }

  if ('durationInSeconds' in patch && patch.durationInSeconds !== undefined) {
    if (
      typeof patch.durationInSeconds !== 'number' ||
      !Number.isFinite(patch.durationInSeconds) ||
      patch.durationInSeconds <= 0.2 ||
      patch.durationInSeconds > 600
    ) {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error:
            'Czas trwania (durationInSeconds) musi być skończoną liczbą z przedziału (0.2, 600].',
        },
      };
    }

    updatedScene.durationInSeconds = patch.durationInSeconds;

    const projectObj =
      manifestObj.project &&
      typeof manifestObj.project === 'object' &&
      !Array.isArray(manifestObj.project)
        ? (manifestObj.project as Record<string, unknown>)
        : null;
    const rawManifestFps =
      typeof manifestObj.fps === 'number'
        ? manifestObj.fps
        : typeof projectObj?.fps === 'number'
          ? projectObj.fps
          : undefined;
    const hasValidManifestFps =
      typeof rawManifestFps === 'number' &&
      Number.isFinite(rawManifestFps) &&
      rawManifestFps > 0;

    if (updatedScene.durationInFrames !== undefined || hasValidManifestFps) {
      const effectiveFps = hasValidManifestFps ? rawManifestFps! : 60;
      updatedScene.durationInFrames = Math.round(
        patch.durationInSeconds * effectiveFps
      );
    }
  }

  if ('voiceEffect' in patch) {
    if (
      patch.voiceEffect === undefined ||
      patch.voiceEffect === null ||
      (typeof patch.voiceEffect === 'string' &&
        patch.voiceEffect.trim().length === 0)
    ) {
      delete updatedScene.voiceEffect;
    } else if (
      typeof patch.voiceEffect === 'string' &&
      VALID_VOICE_EFFECTS.has(patch.voiceEffect.trim() as VoiceAcousticPreset)
    ) {
      updatedScene.voiceEffect = patch.voiceEffect.trim() as VoiceAcousticPreset;
    } else {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error:
            'Nieprawidłowy preset efektu głosowego (voiceEffect). Dozwolone: clean, telephone, radio-walkie, cathedral, megaphone, excitement-boost.',
        },
      };
    }
  }

  if ('voiceSettings' in patch) {
    if (patch.voiceSettings === undefined || patch.voiceSettings === null) {
      delete updatedScene.voiceSettings;
    } else if (
      typeof patch.voiceSettings !== 'object' ||
      Array.isArray(patch.voiceSettings)
    ) {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: 'Pole voiceSettings musi być obiektem JSON.',
        },
      };
    } else {
      const rawVs = patch.voiceSettings as Record<string, unknown>;
      const nextVs: VoiceSettingsConfig = {
        ...(updatedScene.voiceSettings ?? {}),
      };

      for (const key of Object.keys(rawVs)) {
        if (!VALID_VOICE_SETTINGS_KEYS.has(key as keyof VoiceSettingsConfig)) {
          return {
            statusCode: 400,
            body: {
              ok: false,
              error: `Nieznane pole w voiceSettings: "${key}".`,
            },
          };
        }
      }

      for (const unitKey of ['stability', 'similarityBoost', 'style'] as const) {
        if (unitKey in rawVs) {
          const val = rawVs[unitKey];
          if (val === undefined || val === null) {
            delete nextVs[unitKey];
          } else if (
            typeof val !== 'number' ||
            !Number.isFinite(val) ||
            val < 0 ||
            val > 1
          ) {
            return {
              statusCode: 400,
              body: {
                ok: false,
                error: `Pole voiceSettings.${unitKey} musi być liczbą z przedziału [0, 1].`,
              },
            };
          } else {
            nextVs[unitKey] = val;
          }
        }
      }

      if ('speed' in rawVs) {
        const val = rawVs.speed;
        if (val === undefined || val === null) {
          delete nextVs.speed;
        } else if (
          typeof val !== 'number' ||
          !Number.isFinite(val) ||
          val < 0.5 ||
          val > 2.0
        ) {
          return {
            statusCode: 400,
            body: {
              ok: false,
              error:
                'Pole voiceSettings.speed musi być liczbą z przedziału [0.5, 2.0].',
            },
          };
        } else {
          nextVs.speed = val;
        }
      }

      if ('useSpeakerBoost' in rawVs) {
        const val = rawVs.useSpeakerBoost;
        if (val === undefined || val === null) {
          delete nextVs.useSpeakerBoost;
        } else if (typeof val !== 'boolean') {
          return {
            statusCode: 400,
            body: {
              ok: false,
              error: 'Pole voiceSettings.useSpeakerBoost musi być wartością logiczną (boolean).',
            },
          };
        } else {
          nextVs.useSpeakerBoost = val;
        }
      }

      if (Object.keys(nextVs).length === 0) {
        delete updatedScene.voiceSettings;
      } else {
        updatedScene.voiceSettings = nextVs;
      }
    }
  }

  const nextScenes = [...manifestScenes];
  nextScenes[sceneIndex] = updatedScene;
  const nextManifest: Record<string, unknown> = {
    ...manifestObj,
    scenes: nextScenes,
  };

  const formatted = `${JSON.stringify(nextManifest, null, 2)}\n`;
  const tmpPath = `${resolvedManifestPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, formatted, 'utf8');
  fs.renameSync(tmpPath, resolvedManifestPath);

  return {
    statusCode: 200,
    body: {
      ok: true,
      targetId: canonicalTargetId,
      manifestFile,
      scene: updatedScene,
      savedAt: new Date().toISOString(),
    },
  };
}

function parseRemotionProgressLine(
  cleanLine: string,
  prevPercent: number
): { percent: number; label: string } | null {
  const trimmed = cleanLine.trim();
  if (!trimmed) return null;

  if (/bundling/i.test(trimmed)) {
    const pctMatch = trimmed.match(/(\d{1,3})%/);
    const rawPct = pctMatch ? Number(pctMatch[1]) : 50;
    const mapped = Math.max(
      prevPercent,
      Math.min(15, Math.round(rawPct * 0.15))
    );
    return {
      percent: mapped,
      label: `Pakowanie modułów sceny (${rawPct}%)…`,
    };
  }

  const fracMatch = trimmed.match(
    /(Rendered|Rendering|Encoded|Encoding|Stitching)[^\d]*(\d+)\s*\/\s*(\d+)/i
  );
  if (fracMatch) {
    const phase = fracMatch[1].toLowerCase();
    const cur = Number(fracMatch[2]);
    const total = Math.max(1, Number(fracMatch[3]));
    const ratio = Math.min(1, cur / total);
    const isEncoding = phase.startsWith('encod') || phase.startsWith('stitch');
    const mapped = isEncoding
      ? Math.round(82 + ratio * 17)
      : Math.round(15 + ratio * 67);
    return {
      percent: Math.max(prevPercent, Math.min(99, mapped)),
      label: isEncoding
        ? `Kodowanie MP4 (${cur}/${total})…`
        : `Renderowanie klatek 60 FPS (${cur}/${total})…`,
    };
  }

  return null;
}

function revealInSystemFileManager(
  outDir: string,
  targetFile: string | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const hasFile = targetFile && fs.existsSync(targetFile);
    let cmd = 'open';
    let args: string[] = [];

    if (process.platform === 'darwin') {
      cmd = 'open';
      args = hasFile ? ['-R', targetFile!] : [outDir];
    } else if (process.platform === 'win32') {
      cmd = 'explorer.exe';
      args = hasFile ? [`/select,${targetFile!}`] : [outDir];
    } else {
      cmd = 'xdg-open';
      args = [outDir];
    }

    execFile(cmd, args, { windowsHide: false }, (err) => {
      if (err && process.platform !== 'win32') {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function makePicturesStudioServerPlugin(
  options?: StudioServerPluginOptions
): Plugin {
  const rootDir = path.resolve(options?.rootDir ?? process.cwd());
  const studioDir = path.resolve(rootDir, options?.studioDir ?? rootDir);
  const studioDirFlag =
    studioDir !== rootDir
      ? [`--dir=${toPosixPath(path.relative(rootDir, studioDir))}`]
      : [];

  let activeVoiceoverProc: ChildProcess | null = null;
  let activeRenderProc: ChildProcess | null = null;
  let activeQaProc: ChildProcess | null = null;

  return {
    name: 'make-pictures-studio-local-api',
    configureServer(server) {
      syncProductionAssetSymlinks(studioDir);

      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? '';
        const [url, queryStr = ''] = rawUrl.split('?');

        // 1. GET /api/studio/status
        if (req.method === 'GET' && url === '/api/studio/status') {
          const payload = collectAudioStatus(rootDir, studioDir);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
          return;
        }

        // 1a. GET /api/studio/styles
        if (req.method === 'GET' && url === '/api/studio/styles') {
          const payload = readCustomStylesFromDisk(studioDir);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
          return;
        }

        // 1a-post. POST /api/studio/styles
        if (req.method === 'POST' && url === '/api/studio/styles') {
          readJsonBody(req)
            .then((body) => {
              const result = saveCustomStyleToDisk(studioDir, {
                slug: body.slug,
                style: body.style,
              });
              res.statusCode = result.statusCode;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(result.body));
            })
            .catch((err) => {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            });
          return;
        }

        // 1a-scenes. GET /api/studio/scenes
        if (req.method === 'GET' && url === '/api/studio/scenes') {
          const payload = readStudioScenesFromDisk(rootDir, studioDir);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
          return;
        }

        // 1a-scenes-post. POST /api/studio/scenes
        if (req.method === 'POST' && url === '/api/studio/scenes') {
          readJsonBody(req)
            .then((body) => {
              const result = saveStudioSceneToDisk(rootDir, studioDir, {
                targetId: body.targetId,
                sceneId: body.sceneId,
                patch: body.patch,
              });
              res.statusCode = result.statusCode;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(result.body));
            })
            .catch((err) => {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            });
          return;
        }

        // 1b. GET /api/studio/qa-sheet?file=qa-<slug>.png
        if (req.method === 'GET' && url === '/api/studio/qa-sheet') {
          const params = new URLSearchParams(queryStr);
          const fileParam = (params.get('file') ?? '').trim();
          if (!QA_FILE_PATTERN.test(fileParam)) {
            res.statusCode = 400;
            res.end('Invalid QA sheet filename');
            return;
          }

          const candidateOutDirs = [
            path.resolve(studioDir, 'out'),
            path.resolve(rootDir, 'out'),
          ];
          const foundSheet = candidateOutDirs
            .map((outDir) => ({
              outDir,
              sheet: path.resolve(outDir, fileParam),
            }))
            .find(
              ({ outDir, sheet }) =>
                sheet.startsWith(outDir + path.sep) && fs.existsSync(sheet)
            );

          if (!foundSheet) {
            res.statusCode = 404;
            res.end('Contact sheet not found');
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          fs.createReadStream(foundSheet.sheet).pipe(res);
          return;
        }

        // 2. POST /api/studio/props
        if (req.method === 'POST' && url === '/api/studio/props') {
          readJsonBody(req)
            .then((body) => {
              const propsFile =
                typeof body.propsFile === 'string' ? body.propsFile.trim() : '';
              const props = body.props;

              const resolvedTarget = isAllowedPropsPath(
                rootDir,
                studioDir,
                propsFile
              );
              if (!resolvedTarget) {
                res.statusCode = 400;
                res.setHeader(
                  'Content-Type',
                  'application/json; charset=utf-8'
                );
                res.end(
                  JSON.stringify({
                    ok: false,
                    error:
                      'Dozwolony jest wyłącznie zapis *.props.json w src/compositions/, examples/ lub productions/',
                  })
                );
                return;
              }

              if (!props || typeof props !== 'object' || Array.isArray(props)) {
                res.statusCode = 400;
                res.setHeader(
                  'Content-Type',
                  'application/json; charset=utf-8'
                );
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: 'Pole props musi być obiektem JSON.',
                  })
                );
                return;
              }

              fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
              const formatted = `${JSON.stringify(props, null, 2)}\n`;
              const tmpPath = `${resolvedTarget}.tmp-${process.pid}`;
              fs.writeFileSync(tmpPath, formatted, 'utf8');
              fs.renameSync(tmpPath, resolvedTarget);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: true,
                  propsFile,
                  savedAt: new Date().toISOString(),
                })
              );
            })
            .catch((err) => {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            });
          return;
        }

        // 3. POST /api/studio/voiceover (SSE stream)
        if (req.method === 'POST' && url === '/api/studio/voiceover') {
          if (activeVoiceoverProc) {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Generowanie lektora już trwa.',
              })
            );
            return;
          }

          readJsonBody(req)
            .then((body) => {
              const force = Boolean(body.force);
              const productionId =
                typeof body.productionId === 'string' &&
                PROD_SLUG_PATTERN.test(body.productionId.trim())
                  ? body.productionId.trim()
                  : null;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-transform');
              res.setHeader('Connection', 'keep-alive');

              const hasCapsuleDir =
                productionId &&
                fs.existsSync(
                  path.join(
                    studioDir,
                    'productions',
                    productionId,
                    'production.json'
                  )
                );

              const cli = resolveCliRunner(rootDir);
              const command = cli.command;
              const args = [
                ...cli.prefixArgs,
                'audio',
                ...(productionId ? [`--production=${productionId}`] : []),
                ...studioDirFlag,
                ...(force ? ['--force'] : []),
              ];

              sendSseEvent(res, {
                type: 'start',
                message: hasCapsuleDir
                  ? `Uruchamianie pipeline'u audio dla productions/${productionId}…`
                  : 'Uruchamianie generatora lektora ElevenLabs…',
              });

              const child = spawn(command, args, {
                cwd: rootDir,
                env: { ...process.env },
                shell: false,
              });
              activeVoiceoverProc = child;

              let finished = false;

              const handleChunk = (buf: Buffer) => {
                const text = stripAnsi(buf.toString('utf8'));
                for (const rawLine of text.split(/[\r\n]+/)) {
                  const line = rawLine.trim();
                  if (!line) continue;
                  sendSseEvent(res, { type: 'log', line });
                }
              };

              child.stdout?.on('data', handleChunk);
              child.stderr?.on('data', handleChunk);

              req.on('close', () => {
                if (!finished && activeVoiceoverProc === child) {
                  child.kill('SIGTERM');
                }
              });

              child.on('error', (err) => {
                finished = true;
                activeVoiceoverProc = null;
                sendSseEvent(res, {
                  type: 'error',
                  error: err.message,
                });
                res.end();
              });

              child.on('close', (code) => {
                finished = true;
                activeVoiceoverProc = null;
                if (code === 0) {
                  sendSseEvent(res, {
                    type: 'done',
                    status: collectAudioStatus(rootDir, studioDir),
                  });
                } else {
                  sendSseEvent(res, {
                    type: 'error',
                    error: `Skrypt zakończył się kodem ${code ?? -1}`,
                  });
                }
                res.end();
              });
            })
            .catch((err) => {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            });
          return;
        }

        // 4. POST /api/studio/qa (12-frame Contact-Sheet QA generator)
        if (req.method === 'POST' && url === '/api/studio/qa') {
          if (activeQaProc) {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Generowanie arkusza Contact-Sheet QA już trwa.',
              })
            );
            return;
          }

          readJsonBody(req)
            .then((body) => {
              const compositionId =
                typeof body.compositionId === 'string'
                  ? body.compositionId.trim()
                  : '';
              if (!COMP_ID_PATTERN.test(compositionId)) {
                res.statusCode = 400;
                res.setHeader(
                  'Content-Type',
                  'application/json; charset=utf-8'
                );
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: 'Nieprawidłowy identyfikator kompozycji.',
                  })
                );
                return;
              }

              syncProductionAssetSymlinks(studioDir);

              const outDir = path.resolve(studioDir, 'out');
              fs.mkdirSync(outDir, { recursive: true });
              const slug = toKebabSlug(compositionId);
              const fileName = `qa-${slug}.png`;
              const outputAbsPath = path.join(outDir, fileName);
              const outputRelPath = toPosixPath(
                path.relative(rootDir, outputAbsPath)
              );

              const cli = resolveCliRunner(rootDir);
              const args = [
                ...cli.prefixArgs,
                'qa',
                compositionId,
                `--out=${outputRelPath}`,
                ...studioDirFlag,
              ];

              const child = spawn(cli.command, args, {
                cwd: rootDir,
                env: { ...process.env },
                shell: false,
              });
              activeQaProc = child;

              let stderrTail = '';
              child.stderr?.on('data', (buf: Buffer) => {
                stderrTail += stripAnsi(buf.toString('utf8'));
                if (stderrTail.length > 4000) {
                  stderrTail = stderrTail.slice(-4000);
                }
              });

              child.on('error', (err) => {
                activeQaProc = null;
                res.statusCode = 500;
                res.setHeader(
                  'Content-Type',
                  'application/json; charset=utf-8'
                );
                res.end(JSON.stringify({ ok: false, error: err.message }));
              });

              child.on('close', (code) => {
                activeQaProc = null;
                if (code === 0 && fs.existsSync(outputAbsPath)) {
                  const contactSheetUrl = `/api/studio/qa-sheet?file=${encodeURIComponent(
                    fileName
                  )}&t=${Date.now()}`;
                  res.statusCode = 200;
                  res.setHeader(
                    'Content-Type',
                    'application/json; charset=utf-8'
                  );
                  res.end(
                    JSON.stringify({
                      ok: true,
                      compositionId,
                      outputFile: outputRelPath,
                      contactSheetUrl,
                    })
                  );
                } else {
                  res.statusCode = 500;
                  res.setHeader(
                    'Content-Type',
                    'application/json; charset=utf-8'
                  );
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error:
                        stderrTail.trim().split('\n').pop() ||
                        `Komenda qa zakończyła się kodem ${code ?? -1}`,
                    })
                  );
                }
              });
            })
            .catch((err) => {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            });
          return;
        }

        // 5. POST /api/studio/render (SSE stream via make.pictures CLI with -14 LUFS mastering)
        if (req.method === 'POST' && url === '/api/studio/render') {
          if (activeRenderProc) {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Inny proces renderowania MP4 jest już uruchomiony.',
              })
            );
            return;
          }

          readJsonBody(req)
            .then((body) => {
              const compositionId =
                typeof body.compositionId === 'string'
                  ? body.compositionId.trim()
                  : '';
              const usesThree = Boolean(body.usesThree);
              const customProps =
                body.props &&
                typeof body.props === 'object' &&
                !Array.isArray(body.props)
                  ? (body.props as Record<string, unknown>)
                  : null;

              if (!COMP_ID_PATTERN.test(compositionId)) {
                res.statusCode = 400;
                res.setHeader(
                  'Content-Type',
                  'application/json; charset=utf-8'
                );
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: 'Nieprawidłowy identyfikator kompozycji.',
                  })
                );
                return;
              }

              syncProductionAssetSymlinks(studioDir);

              const outDir = path.resolve(studioDir, 'out');
              fs.mkdirSync(outDir, { recursive: true });

              const slug = toKebabSlug(compositionId);
              const outputAbsPath = path.join(outDir, `${slug}.mp4`);
              const outRelPath = toPosixPath(
                path.relative(rootDir, outputAbsPath)
              );
              const tempPropsPath = customProps
                ? path.join(outDir, `.studio-props-${slug}-${process.pid}.json`)
                : null;

              if (tempPropsPath && customProps) {
                fs.writeFileSync(
                  tempPropsPath,
                  JSON.stringify(customProps, null, 2),
                  'utf8'
                );
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-transform');
              res.setHeader('Connection', 'keep-alive');

              const cli = resolveCliRunner(rootDir);
              const args = [
                ...cli.prefixArgs,
                'render',
                compositionId,
                outRelPath,
                ...studioDirFlag,
                ...(usesThree ? ['--gl=angle'] : []),
                ...(tempPropsPath ? [`--props=${tempPropsPath}`] : []),
              ];

              let currentPercent = 2;
              sendSseEvent(res, {
                type: 'progress',
                percent: currentPercent,
                label: `Inicjalizacja renderera 60 FPS (${compositionId})…`,
                outputFile: outRelPath,
              });

              const child = spawn(cli.command, args, {
                cwd: rootDir,
                env: { ...process.env },
                shell: false,
              });
              activeRenderProc = child;

              let finished = false;
              let lastErrorLine = '';

              const cleanupTempProps = () => {
                if (tempPropsPath && fs.existsSync(tempPropsPath)) {
                  try {
                    fs.unlinkSync(tempPropsPath);
                  } catch {
                    // ignore
                  }
                }
              };

              const handleChunk = (buf: Buffer) => {
                const text = stripAnsi(buf.toString('utf8'));
                for (const rawLine of text.split(/[\r\n]+/)) {
                  const line = rawLine.trim();
                  if (!line) continue;
                  if (/error|exception|failed/i.test(line)) {
                    lastErrorLine = line;
                  }
                  const parsed = parseRemotionProgressLine(
                    line,
                    currentPercent
                  );
                  if (parsed) {
                    currentPercent = parsed.percent;
                    sendSseEvent(res, {
                      type: 'progress',
                      percent: currentPercent,
                      label: parsed.label,
                      outputFile: outRelPath,
                    });
                  }
                }
              };

              child.stdout?.on('data', handleChunk);
              child.stderr?.on('data', handleChunk);

              req.on('close', () => {
                if (!finished && activeRenderProc === child) {
                  child.kill('SIGTERM');
                  cleanupTempProps();
                }
              });

              child.on('error', (err) => {
                finished = true;
                activeRenderProc = null;
                cleanupTempProps();
                sendSseEvent(res, {
                  type: 'error',
                  error: err.message,
                });
                res.end();
              });

              child.on('close', (code, signal) => {
                finished = true;
                activeRenderProc = null;
                cleanupTempProps();

                if (signal === 'SIGTERM') {
                  sendSseEvent(res, {
                    type: 'cancelled',
                    message: 'Renderowanie zostało anulowane.',
                  });
                } else if (code === 0) {
                  sendSseEvent(res, {
                    type: 'done',
                    percent: 100,
                    outputFile: outRelPath,
                  });
                } else {
                  sendSseEvent(res, {
                    type: 'error',
                    error:
                      lastErrorLine ||
                      `Proces Remotion zakończył się kodem ${code ?? -1}`,
                  });
                }
                res.end();
              });
            })
            .catch((err) => {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            });
          return;
        }

        // 6. POST /api/studio/open-output
        if (req.method === 'POST' && url === '/api/studio/open-output') {
          readJsonBody(req)
            .then(async (body) => {
              const outDir = path.resolve(studioDir, 'out');
              fs.mkdirSync(outDir, { recursive: true });

              let resolvedFile: string | null = null;
              if (
                typeof body.outputFile === 'string' &&
                body.outputFile.trim().length > 0
              ) {
                const candidate = path.resolve(
                  rootDir,
                  body.outputFile.trim()
                );
                const allowedOutDirs = [
                  path.resolve(studioDir, 'out'),
                  path.resolve(rootDir, 'out'),
                ];
                if (
                  !allowedOutDirs.some((allowed) =>
                    candidate.startsWith(allowed + path.sep)
                  )
                ) {
                  res.statusCode = 403;
                  res.setHeader(
                    'Content-Type',
                    'application/json; charset=utf-8'
                  );
                  res.end(
                    JSON.stringify({ ok: false, error: 'Forbidden path' })
                  );
                  return;
                }
                resolvedFile = candidate;
              }

              await revealInSystemFileManager(outDir, resolvedFile);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: true,
                  opened: resolvedFile ?? outDir,
                })
              );
            })
            .catch((err) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            });
          return;
        }

        next();
      });
    },
  };
}

const STUDIO_HTML_SHELL = `<!DOCTYPE html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>make.pictures — Studio Web (60 FPS)</title>
    <meta name="theme-color" content="#FF2A85" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cdefs%3E%3ClinearGradient id='b' x1='30' y1='30' x2='160' y2='160' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%237209B7'/%3E%3Cstop offset='1' stop-color='%233A0CA3'/%3E%3C/linearGradient%3E%3ClinearGradient id='m' x1='50' y1='45' x2='185' y2='180' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%2300F5D4'/%3E%3Cstop offset='1' stop-color='%230096C7'/%3E%3C/linearGradient%3E%3ClinearGradient id='f' x1='65' y1='65' x2='205' y2='205' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%23FF2A85'/%3E%3Cstop offset='.55' stop-color='%23FF5E00'/%3E%3Cstop offset='1' stop-color='%23FFBE0B'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='34' y='34' width='124' height='124' rx='30' transform='rotate%28-10 96 96%29' fill='url%28%23b%29'/%3E%3Crect x='52' y='50' width='128' height='128' rx='32' transform='rotate%28-3 116 114%29' fill='url%28%23m%29'/%3E%3Crect x='70' y='68' width='134' height='134' rx='34' fill='url%28%23f%29'/%3E%3Cpath d='M119 109.5C119 104.8 124.1 101.9 128.2 104.3L166.8 127.2C170.8 129.6 170.8 135.4 166.8 137.8L128.2 160.7C124.1 163.1 119 160.2 119 155.5V109.5Z' fill='%23fff'/%3E%3Ccircle cx='182' cy='90' r='8' fill='%23fff' opacity='.95'/%3E%3C/svg%3E" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/@id/__x00__${VIRTUAL_MAIN_ID}"></script>
  </body>
</html>
`;

function discoverCapsuleIndexFiles(
  rootDir: string,
  studioDir: string
): Array<{ label: string; absPath: string }> {
  const discovered: Array<{ label: string; absPath: string }> = [];

  if (studioDir === rootDir) {
    const monorepoRegistry = path.join(
      rootDir,
      'src',
      'compositions',
      'registry.ts'
    );
    if (fs.existsSync(monorepoRegistry)) {
      discovered.push({
        label: 'src/compositions/registry.ts',
        absPath: monorepoRegistry,
      });
      return discovered;
    }
  }

  for (const folderName of ['examples', 'productions']) {
    const containerDir = path.join(studioDir, folderName);
    if (!fs.existsSync(containerDir)) continue;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs
        .readdirSync(containerDir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      for (const candidateName of [
        'index.ts',
        'index.tsx',
        'index.js',
        'index.jsx',
      ]) {
        const candidateAbs = path.join(containerDir, entry.name, candidateName);
        if (fs.existsSync(candidateAbs)) {
          discovered.push({
            label: `${folderName}/${entry.name}/${candidateName}`,
            absPath: candidateAbs,
          });
          break;
        }
      }
    }
  }

  return discovered;
}

function discoverValidStyleJsonFiles(studioDir: string): string[] {
  const stylesDir = path.join(studioDir, 'styles');
  if (!fs.existsSync(stylesDir)) return [];

  let names: string[] = [];
  try {
    names = fs
      .readdirSync(stylesDir)
      .filter((name) => name.endsWith('.style.json'))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }

  const validPaths: string[] = [];
  for (const name of names) {
    const abs = path.join(stylesDir, name);
    try {
      JSON.parse(fs.readFileSync(abs, 'utf8'));
      validPaths.push(abs);
    } catch {
      // Skip malformed JSON so Vite's JSON loader never crashes the Studio shell
    }
  }
  return validPaths;
}

function buildVirtualStudioEntrySource(
  rootDir: string,
  studioDir: string
): string {
  const modules = discoverCapsuleIndexFiles(rootDir, studioDir);
  const styleFiles = discoverValidStyleJsonFiles(studioDir);

  const styleImportLines = styleFiles.map(
    (absPath, idx) =>
      `import stylePreset_${idx} from ${JSON.stringify(
        `/@fs/${toPosixPath(absPath)}`
      )};`
  );
  const styleArrayEntries = styleFiles.map(
    (_absPath, idx) => `  stylePreset_${idx},`
  );

  const importLines = modules.map(
    (m, idx) =>
      `import * as compMod_${idx} from ${JSON.stringify(
        `/@fs/${toPosixPath(m.absPath)}`
      )};`
  );
  const arrayEntries = modules.map(
    (m, idx) => `  { path: ${JSON.stringify(m.label)}, mod: compMod_${idx} },`
  );

  return [
    `import '@make-pictures/studio/styles.css';`,
    `import React from 'react';`,
    `import { createRoot } from 'react-dom/client';`,
    `import { registerCustomStyles } from '@make-pictures/core';`,
    `import { StudioApp, mergeStudioCompositionModules } from '@make-pictures/studio/client';`,
    ...styleImportLines,
    ...importLines,
    ``,
    `registerCustomStyles([`,
    ...styleArrayEntries,
    `]);`,
    ``,
    `const compositions = mergeStudioCompositionModules([`,
    ...arrayEntries,
    `]);`,
    ``,
    `const container = document.getElementById('root');`,
    `if (!container) {`,
    `  throw new Error('Missing #root container in make.pictures Studio HTML shell');`,
    `}`,
    `createRoot(container).render(React.createElement(StudioApp, { compositions }));`,
    ``,
  ].join('\n');
}

function studioVirtualClientPlugin(
  rootDir: string,
  studioDir: string,
  studioPkgRoot: string
): Plugin {
  const studioRequire = createRequire(path.join(studioPkgRoot, 'package.json'));

  return {
    name: 'make-pictures-studio-virtual-client',
    async resolveId(id, importer, options) {
      if (
        id === VIRTUAL_MAIN_ID ||
        id === `/${VIRTUAL_MAIN_ID}` ||
        id === RESOLVED_VIRTUAL_MAIN_ID
      ) {
        return RESOLVED_VIRTUAL_MAIN_ID;
      }

      // If Vite cannot find a bare dependency in `rootDir/node_modules` (e.g. hoisted workspace or npx),
      // fall back to resolving from `@make-pictures/studio`'s own node_modules hierarchy.
      if (
        importer === RESOLVED_VIRTUAL_MAIN_ID &&
        !id.startsWith('.') &&
        !id.startsWith('/') &&
        !id.startsWith('\0')
      ) {
        const resolvedByVite = await this.resolve(id, path.join(rootDir, '_virtual_importer_.js'), {
          ...options,
          skipSelf: true,
        });
        if (resolvedByVite) return resolvedByVite;
        try {
          return studioRequire.resolve(id);
        } catch {
          return null;
        }
      }

      return null;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_MAIN_ID) {
        return buildVirtualStudioEntrySource(rootDir, studioDir);
      }
      return null;
    },
    configureServer(server: ViteDevServer) {
      const productionsDir = path.join(studioDir, 'productions');
      const stylesDir = path.join(studioDir, 'styles');
      server.watcher.add(productionsDir);
      server.watcher.add(stylesDir);

      const invalidateVirtualEntry = () => {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MAIN_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
      };

      const handleCapsuleAddOrUnlink = (changedPath: string) => {
        if (
          changedPath.startsWith(stylesDir) &&
          changedPath.endsWith('.style.json')
        ) {
          invalidateVirtualEntry();
          server.ws.send({ type: 'full-reload' });
          return;
        }
        if (!changedPath.startsWith(productionsDir)) return;
        syncProductionAssetSymlinks(studioDir);
        if (/index\.(ts|tsx|js|jsx)$/.test(changedPath)) {
          invalidateVirtualEntry();
          server.ws.send({ type: 'full-reload' });
        }
      };

      const handleStyleChange = (changedPath: string) => {
        if (
          changedPath.startsWith(stylesDir) &&
          changedPath.endsWith('.style.json')
        ) {
          invalidateVirtualEntry();
        }
      };

      server.watcher.on('add', handleCapsuleAddOrUnlink);
      server.watcher.on('unlink', handleCapsuleAddOrUnlink);
      server.watcher.on('change', handleStyleChange);

      server.middlewares.use(async (req, res, next) => {
        const cleanUrl = (req.url ?? '').split('?')[0];
        if (
          req.method === 'GET' &&
          (cleanUrl === '/' || cleanUrl === '/index.html')
        ) {
          try {
            const transformed = await server.transformIndexHtml(
              req.url ?? '/',
              STUDIO_HTML_SHELL
            );
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(transformed);
            return;
          } catch (err) {
            next(err);
            return;
          }
        }
        next();
      });
    },
  };
}

/**
 * Programmatically launches the local `make.pictures` Studio Web 2.0 Vite server
 * for both standalone `create-make-pictures` projects and embedded (`--dir=videos`)
 * SaaS repositories — without requiring an `index.html` or `vite.config.ts` in the
 * consumer project.
 */
export async function startStudioServer(
  options?: StartStudioServerOptions
): Promise<{ url: string; close: () => Promise<void> }> {
  const rootDir = path.resolve(options?.rootDir ?? process.cwd());
  const studioDir = path.resolve(rootDir, options?.studioDir ?? rootDir);
  const host = options?.host ?? '127.0.0.1';
  const port = options?.port ?? 3000;

  const publicDir = path.join(studioDir, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  syncProductionAssetSymlinks(studioDir);

  const studioPkgRoot = findStudioPackageRoot();
  const stylesCssPath = fs.existsSync(path.join(studioPkgRoot, 'dist/styles.css'))
    ? path.join(studioPkgRoot, 'dist/styles.css')
    : path.join(studioPkgRoot, 'src/client/styles.css');
  const studioClientEntry = fs.existsSync(
    path.join(studioPkgRoot, 'dist/client/index.mjs')
  )
    ? path.join(studioPkgRoot, 'dist/client/index.mjs')
    : path.join(studioPkgRoot, 'src/client/index.ts');

  const aliases: Array<{ find: RegExp; replacement: string }> = [
    {
      find: /^@make-pictures\/studio\/styles\.css$/,
      replacement: stylesCssPath,
    },
    {
      find: /^@make-pictures\/studio\/client$/,
      replacement: studioClientEntry,
    },
    {
      find: /^@make-pictures\/studio$/,
      replacement: studioClientEntry,
    },
  ];

  // If invoked inside the engine monorepo, keep 0ms source-first resolution
  const monorepoCoreSrc = path.join(rootDir, 'packages', 'core', 'src');
  const monorepoKitsSrc = path.join(rootDir, 'packages', 'kits', 'src');
  if (fs.existsSync(path.join(monorepoCoreSrc, 'index.ts'))) {
    aliases.push(
      {
        find: /^@make-pictures\/core\/(.*)$/,
        replacement: `${monorepoCoreSrc}/$1`,
      },
      {
        find: /^@make-pictures\/core$/,
        replacement: path.join(monorepoCoreSrc, 'index.ts'),
      }
    );
  }
  if (fs.existsSync(path.join(monorepoKitsSrc, 'index.ts'))) {
    aliases.push(
      {
        find: /^@make-pictures\/kits\/(.*)$/,
        replacement: `${monorepoKitsSrc}/$1`,
      },
      {
        find: /^@make-pictures\/kits$/,
        replacement: path.join(monorepoKitsSrc, 'index.ts'),
      }
    );
  }

  const viteServer = await createServer({
    root: rootDir,
    configFile: false,
    appType: 'custom',
    publicDir,
    resolve: {
      alias: aliases,
    },
    plugins: [
      react(),
      makePicturesStudioServerPlugin({ rootDir, studioDir }),
      studioVirtualClientPlugin(rootDir, studioDir, studioPkgRoot),
    ],
    server: {
      host,
      port,
      strictPort: false,
      fs: {
        strict: false,
      },
    },
    optimizeDeps: {
      entries: [],
    },
  });

  await viteServer.listen();

  const addr = viteServer.httpServer?.address() as AddressInfo | string | null;
  const boundPort =
    addr && typeof addr === 'object' && typeof addr.port === 'number'
      ? addr.port
      : port;
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;

  return {
    url: `http://${displayHost}:${boundPort}`,
    close: async () => {
      await viteServer.close();
    },
  };
}
