import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type {
  MusicMoodPreset,
  MusicScoreSpec,
  SfxFallbackPreset,
} from '@make-pictures/core';
import {
  DimensionalSpaceSchema,
  type DimensionalSpace,
} from '../../core/src/style/presets';
import {
  runAudioCommand,
  runMusicShortcutCommand,
  runSfxShortcutCommand,
} from './commands/audio';
import { runCutoutCommand } from './commands/cutout';
import { runDoctorCommand } from './commands/doctor';
import { runGenerateImageCommand } from './commands/generate-image';
import { runInitCommand } from './commands/init';
import {
  defaultKitAndStyleForSpace,
  runNewProductionCommand,
  type ScaffoldKitId,
} from './commands/new-production';
import { runOnboardCommand } from './commands/onboard';
import { runQaContactSheetCommand } from './commands/qa-contact-sheet';
import { runRenderCommand } from './commands/render';
import { runStudioCommand } from './commands/studio';
import {
  runStyleNewCommand,
  runStylesListCommand,
} from './commands/styles';
import { runVoicesCommand } from './commands/voices';

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const BOOLEAN_FLAGS = new Set([
  'mock',
  'force',
  'loop',
  'no-master',
  'setup',
  'help',
  'wait',
  'json',
  'human',
  'no-browser',
  'replace',
  'allow-fast-cuts',
  'mine',
]);

function parseCliArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') continue;

    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=');
      if (eqIdx !== -1) {
        const key = token.slice(2, eqIdx);
        const val = token.slice(eqIdx + 1);
        flags[key] =
          val === 'true' ? true : val === 'false' ? false : val;
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        if (!BOOLEAN_FLAGS.has(key) && next && !next.startsWith('-')) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else if (token === '-h') {
      flags.help = true;
    } else {
      positionals.push(token);
    }
  }

  return { positionals, flags };
}

function getStringFlag(
  flags: Record<string, string | boolean>,
  key: string
): string | undefined {
  const val = flags[key];
  return typeof val === 'string' && val.trim().length > 0
    ? val.trim()
    : undefined;
}

function parseSpaceFlag(
  flags: Record<string, string | boolean>
): DimensionalSpace | undefined {
  const raw = flags.space;
  if (raw === undefined || raw === false) {
    return undefined;
  }
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const parsed = DimensionalSpaceSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(
      `Invalid --space value "${String(raw)}". Expected one of: 2d, 2.5d, 3d (e.g. --space=3d).`
    );
  }
  return parsed.data;
}

function loadEnvFiles(cwd?: string): void {
  const baseDir = path.resolve(cwd || process.cwd());
  dotenv.config({ path: path.join(baseDir, '.env.local') });
  dotenv.config({ path: path.join(baseDir, '.env') });
}

function printHelp(): void {
  console.log(`
make.pictures Studio CLI (@make-pictures/cli)

Usage:
  make-pictures <command> [options]

Global Workspace Options:
  --cwd=<path>      Project root directory (defaults to current directory)
  --dir=<subdir>    Studio subdirectory inside an existing app (e.g. --dir=videos)
  --entry=<path>    Explicit Remotion registerRoot entry file for qa/render

Commands:
  studio [--port=3000] [--host=127.0.0.1] [--dir=<subdir>]
      Launch the 60 FPS Studio Web workstation (HMR + Props Inspector + Safe Box)

  init [--dir=videos] [--space=2d|2.5d|3d] [--kit=vector-scene-2d] [--style=minimal-product] [--lang=en|pl] [--force]
      Initialize make.pictures capsules + AI agent skills inside an existing repo

  onboard [init|connect|wait|check|status] [--json|--human] [--no-browser]
      Interactive terminal setup (or agent JSON workflow when --json / agent shell)

  doctor [--setup] [--dir=<subdir>]
      Verify Node.js, FFmpeg, ElevenLabs connectivity, capsules, and Remotion

  styles [--space=2d|2.5d|3d] [--json] [--dir=<subdir>]
      List all 10 built-in Art Direction styles, custom styles/*.style.json, and 7 visual kits

  style new <slug> [--from=minimal-product] [--force] [--dir=<subdir>]
      Create a reusable custom Art Direction preset in styles/<slug>.style.json

  new <slug> [--space=2d|2.5d|3d] [--kit=vector-scene-2d|editorial-collage|kinetic-typography|data-storytelling|motion-diagrams-2d|paper-diorama-3d|isometric-3d] [--style=minimal-product] [--voice=<voiceId>] [--lang=en|pl] [--dir=<subdir>]
      Scaffold an isolated production capsule in productions/<slug>/

  audio [--production=<slug>] [--mock] [--force] [--dir=<subdir>]
      Generate ElevenLabs TTS voiceovers + word timestamps + AI Music + AI SFX

  voices [--lang=pl|en|all] [--gender=female|male] [--query="..."] [--mine] [--limit=12] [--json] [--audition="Sample text" --voice=<voiceId> [--model=<modelId>] [--out=<file.mp3>]]
      Discover native ElevenLabs voices (curated, your account, and Voice Library) or audition 1 short sentence

  music [--production=<slug>] [--prompt="..."] [--mood=ambient-tech] [--duration=16] [--mock] [--force]
      Generate or refresh background score track

  sfx [--production=<slug>] [--id=whoosh] [--prompt="..."] [--preset=whoosh] [--loop] [--mock] [--force]
      Generate or refresh Foley / SFX asset

  qa <CompositionId> [--grid=auto|4x3] [--out=out/qa-<id>.png] [--duration=<frames>] [--allow-fast-cuts] [--dir=<subdir>]
      Run Hard Director QA Gate + render auto-sized Contact-Sheet PNG covering 100% of scenes & sub-views

  render <CompositionId> [outPath] [--no-master] [--props=<jsonOrFile>] [--dir=<subdir>]
      Render 60 FPS MP4 (auto --gl=angle for 3D) + master loudness to -14 LUFS

  image "<prompt>" --out=<file.png> [--style=<styleId>] [--aspect=1:1|16:9|9:16] [--model=gemini-2.5-flash-image] [--dir=<subdir>]
      Generate style-anchored illustration asset with strict no-text protection (requires GEMINI_API_KEY)

  cutout <source.pdf|photo.png> --out=<file.png> [--page=1] [--tolerance=18] [--soft-ramp=10] [--qa-out=<qa.png>] [--dir=<subdir>]
      Extract lossless PDF /SMask or Exterior Border Flood-Fill cutout + dark checkerboard QA PNG
`);
}

function parseFiniteFlag(
  flags: Record<string, string | boolean>,
  name: string,
  opts?: { min?: number }
): number | undefined {
  const raw = getStringFlag(flags, name);
  if (raw === undefined) return undefined;
  const num = Number(raw);
  if (
    raw.trim() === '' ||
    !Number.isFinite(num) ||
    (opts?.min !== undefined && num < opts.min)
  ) {
    throw new Error(`Invalid --${name} value: "${raw}"`);
  }
  return num;
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const { positionals, flags } = parseCliArgs(argv);
  const command = positionals[0];

  const cwd = getStringFlag(flags, 'cwd');
  const dir = getStringFlag(flags, 'dir');
  const entry = getStringFlag(flags, 'entry');

  if (command !== 'onboard') {
    loadEnvFiles(cwd);
  }

  if (!command || flags.help || command === 'help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'studio': {
      const portStr = getStringFlag(flags, 'port');
      const port = portStr ? Number(portStr) : 3000;
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`Invalid --port value: "${portStr}"`);
      }
      await runStudioCommand({
        cwd,
        dir,
        port,
        host: getStringFlag(flags, 'host') ?? '127.0.0.1',
      });
      return;
    }

    case 'init': {
      const space = parseSpaceFlag(flags);
      const spaceDefaults = space
        ? defaultKitAndStyleForSpace(space)
        : undefined;
      const kit =
        (getStringFlag(flags, 'kit') as ScaffoldKitId | undefined) ??
        spaceDefaults?.kit;
      const style = getStringFlag(flags, 'style') ?? spaceDefaults?.styleId;
      const voice = getStringFlag(flags, 'voice');
      const langRaw = getStringFlag(flags, 'lang');
      const lang = langRaw === 'pl' ? 'pl' : 'en';
      await runInitCommand({
        cwd,
        dir,
        kit,
        style,
        voice,
        lang,
        force: Boolean(flags.force),
      });
      return;
    }

    case 'onboard': {
      const step = positionals[1] || getStringFlag(flags, 'step');
      const formatFlag = getStringFlag(flags, 'format')?.toLowerCase();
      const langFlag = getStringFlag(flags, 'lang')?.toLowerCase();
      const modeFlag = getStringFlag(flags, 'mode')?.toLowerCase();
      const targetFlag = getStringFlag(flags, 'target');
      const extraArgs: string[] = [];
      if (flags.wait) extraArgs.push('--wait');
      if (flags['no-browser']) extraArgs.push('--no-browser');
      if (flags.replace) extraArgs.push('--replace');
      await runOnboardCommand({
        cwd,
        dir,
        step,
        lang: langFlag === 'pl' ? 'pl' : langFlag === 'en' ? 'en' : undefined,
        mode:
          modeFlag === 'saas'
            ? 'saas'
            : modeFlag === 'standalone'
              ? 'standalone'
              : undefined,
        target: targetFlag,
        extraArgs,
        json: Boolean(flags.json) || formatFlag === 'json',
        human:
          Boolean(flags.human) ||
          formatFlag === 'human' ||
          formatFlag === 'table',
      });
      return;
    }

    case 'doctor': {
      await runDoctorCommand({
        cwd,
        dir,
        setup: Boolean(flags.setup),
      });
      return;
    }

    case 'voices': {
      const limit = parseFiniteFlag(flags, 'limit', { min: 1 });
      await runVoicesCommand({
        cwd,
        dir,
        lang: getStringFlag(flags, 'lang'),
        gender: getStringFlag(flags, 'gender'),
        query: getStringFlag(flags, 'query') ?? getStringFlag(flags, 'q'),
        mine: Boolean(flags.mine),
        limit: limit !== undefined ? Math.round(limit) : undefined,
        json: Boolean(flags.json),
        audition: getStringFlag(flags, 'audition'),
        voice: getStringFlag(flags, 'voice'),
        model: getStringFlag(flags, 'model'),
        out: getStringFlag(flags, 'out'),
      });
      return;
    }

    case 'styles': {
      await runStylesListCommand({
        cwd,
        dir,
        json: Boolean(flags.json),
        space: parseSpaceFlag(flags),
      });
      return;
    }

    case 'style': {
      const subcommand = positionals[1]?.toLowerCase();
      if (!subcommand || subcommand === 'list') {
        await runStylesListCommand({
          cwd,
          dir,
          json: Boolean(flags.json),
          space: parseSpaceFlag(flags),
        });
        return;
      }
      if (subcommand === 'new') {
        const slug = positionals[2] || getStringFlag(flags, 'slug');
        if (!slug) {
          throw new Error(
            'Missing <slug>. Usage: make-pictures style new <slug> [--from=minimal-product]'
          );
        }
        await runStyleNewCommand({
          cwd,
          dir,
          slug,
          from: getStringFlag(flags, 'from'),
          force: Boolean(flags.force),
        });
        return;
      }
      throw new Error(
        `Unknown style subcommand "${positionals[1]}". Usage: make-pictures style new <slug> [--from=minimal-product]`
      );
    }

    case 'new': {
      const slug = positionals[1] || getStringFlag(flags, 'slug');
      if (!slug) {
        throw new Error(
          'Missing <slug>. Usage: make-pictures new <slug> [--space=2d|2.5d|3d] [--kit=vector-scene-2d] [--style=minimal-product] [--lang=pl|en]'
        );
      }
      const space = parseSpaceFlag(flags);
      const kit = getStringFlag(flags, 'kit') as ScaffoldKitId | undefined;
      const style = getStringFlag(flags, 'style');
      const voice = getStringFlag(flags, 'voice');
      const langRaw = getStringFlag(flags, 'lang');
      const lang = langRaw === 'pl' ? 'pl' : 'en';
      await runNewProductionCommand({
        cwd,
        dir,
        slug,
        space,
        kit,
        style,
        voice,
        lang,
        force: Boolean(flags.force),
      });
      return;
    }

    case 'audio':
    case 'voiceover': {
      await runAudioCommand({
        cwd,
        dir,
        productionSlug:
          getStringFlag(flags, 'production') || positionals[1] || undefined,
        mock: Boolean(flags.mock),
        force: Boolean(flags.force),
      });
      return;
    }

    case 'music': {
      const durStr = getStringFlag(flags, 'duration');
      await runMusicShortcutCommand({
        cwd,
        dir,
        productionSlug: getStringFlag(flags, 'production'),
        id: getStringFlag(flags, 'id'),
        prompt: getStringFlag(flags, 'prompt') || positionals[1],
        moodPreset: getStringFlag(flags, 'mood') as MusicMoodPreset | undefined,
        mode: getStringFlag(flags, 'mode') as MusicScoreSpec['mode'] | undefined,
        durationSeconds: durStr ? Number(durStr) : undefined,
        mock: Boolean(flags.mock),
        force: Boolean(flags.force),
      });
      return;
    }

    case 'sfx': {
      const durStr = getStringFlag(flags, 'duration');
      await runSfxShortcutCommand({
        cwd,
        dir,
        productionSlug: getStringFlag(flags, 'production'),
        id: getStringFlag(flags, 'id'),
        prompt: getStringFlag(flags, 'prompt') || positionals[1],
        fallbackPreset: getStringFlag(flags, 'preset') as
          | SfxFallbackPreset
          | undefined,
        durationSeconds: durStr ? Number(durStr) : undefined,
        loop: Boolean(flags.loop),
        mock: Boolean(flags.mock),
        force: Boolean(flags.force),
      });
      return;
    }

    case 'qa': {
      const compositionId =
        positionals[1] || getStringFlag(flags, 'composition');
      if (!compositionId) {
        throw new Error(
          'Missing <CompositionId>. Usage: make-pictures qa <CompositionId> [--grid=4x3] [--out=out/qa-id.png]'
        );
      }
      const durStr = getStringFlag(flags, 'duration');
      await runQaContactSheetCommand({
        cwd,
        dir,
        entryPoint: entry,
        compositionId,
        grid: getStringFlag(flags, 'grid'),
        outPath: getStringFlag(flags, 'out'),
        durationOverride: durStr ? Number(durStr) : undefined,
        glAngle: flags.gl === 'angle' ? true : undefined,
        allowFastCuts: Boolean(flags['allow-fast-cuts']),
      });
      return;
    }

    case 'render': {
      const compositionId =
        positionals[1] || getStringFlag(flags, 'composition');
      if (!compositionId) {
        throw new Error(
          'Missing <CompositionId>. Usage: make-pictures render <CompositionId> [outPath] [--no-master]'
        );
      }
      const outPath = positionals[2] || getStringFlag(flags, 'out');
      const timeoutStr = getStringFlag(flags, 'timeout');
      await runRenderCommand({
        cwd,
        dir,
        entryPoint: entry,
        compositionId,
        outPath,
        noMaster: Boolean(flags['no-master']),
        propsArg: getStringFlag(flags, 'props'),
        glAngle: flags.gl === 'angle' ? true : undefined,
        concurrency: getStringFlag(flags, 'concurrency'),
        timeoutMs: timeoutStr ? Number(timeoutStr) : undefined,
      });
      return;
    }

    case 'image': {
      const prompt = positionals[1] || getStringFlag(flags, 'prompt');
      const outPath = getStringFlag(flags, 'out') || positionals[2];
      if (!prompt || !outPath) {
        throw new Error(
          'Usage: make-pictures image "<prompt>" --out=<path.png> [--style=<styleId>] [--aspect=1:1|16:9|9:16]'
        );
      }
      await runGenerateImageCommand({
        cwd,
        dir,
        prompt,
        style: getStringFlag(flags, 'style'),
        outPath,
        aspectRatio: getStringFlag(flags, 'aspect') as
          | '1:1'
          | '16:9'
          | '9:16'
          | '4:3'
          | '3:4'
          | undefined,
        model: getStringFlag(flags, 'model'),
      });
      return;
    }

    case 'cutout': {
      const inputPath = positionals[1] || getStringFlag(flags, 'in');
      const outPath = getStringFlag(flags, 'out') || positionals[2];
      if (!inputPath || !outPath) {
        throw new Error(
          'Usage: make-pictures cutout <input.pdf|photo.png> --out=<path.png> [--page=1] [--tolerance=18]'
        );
      }
      await runCutoutCommand({
        cwd,
        dir,
        inputPath,
        outPath,
        qaOutPath: getStringFlag(flags, 'qa-out'),
        page: parseFiniteFlag(flags, 'page', { min: 1 }),
        tolerance: parseFiniteFlag(flags, 'tolerance', { min: 0 }),
        softRamp: parseFiniteFlag(flags, 'soft-ramp', { min: 0 }),
      });
      return;
    }

    default:
      throw new Error(
        `Unknown command "${command}". Run \`make-pictures --help\` to see available commands.`
      );
  }
}

export * from './audio/audit-audio-tags';
export * from './audio/generate-music';
export * from './audio/generate-sfx';
export * from './audio/master-loudness';
export * from './audio/phonetics-lint';
export * from './commands/audio';
export * from './commands/cutout';
export * from './commands/doctor';
export * from './commands/generate-image';
export * from './commands/init';
export * from './commands/new-production';
export * from './commands/onboard';
export * from './commands/qa-contact-sheet';
export * from './commands/render';
export * from './commands/studio';
export * from './commands/styles';
export * from './commands/voices';
export * from './commands/workspace-paths';
export * from './director/audit-direction';

function resolveSelfFilename(): string | null {
  if (typeof __filename === 'string') {
    return __filename;
  }
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return fileURLToPath(import.meta.url);
  }
  return null;
}

function safeRealpath(targetPath: string): string {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

const selfFile = resolveSelfFilename();
const selfBasename = selfFile ? path.basename(selfFile) : '';
const isBundledBinWrapper =
  selfBasename === 'bin.mjs' ||
  selfBasename === 'bin.cjs' ||
  selfBasename === 'bin.ts' ||
  selfBasename === 'bin.js';
const isDirectEntry =
  !isBundledBinWrapper &&
  Boolean(process.argv[1]) &&
  Boolean(selfFile) &&
  safeRealpath(process.argv[1]) === safeRealpath(selfFile!);

if (isDirectEntry) {
  runCli().catch((err) => {
    console.error(
      '❌ make-pictures error:',
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  });
}
