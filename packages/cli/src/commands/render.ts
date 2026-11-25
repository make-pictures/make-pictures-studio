import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { masterMp4Loudness } from '../audio/master-loudness';
import {
  assertFfmpegInstalled,
  assertRemotionInstalled,
  loadMakePicturesConfig,
  resolveRemotionEntryPoint,
  resolveWorkspaceContext,
} from './workspace-paths';

export interface RenderCommandOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  entryPoint?: string;
  compositionId: string;
  outPath?: string;
  noMaster?: boolean;
  propsArg?: string;
  glAngle?: boolean;
  concurrency?: string;
  timeoutMs?: number;
}

function toKebabSlug(compId: string): string {
  return compId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
}

const THREE_USAGE_RE =
  /from\s+['"](?:three|@remotion\/three|@react-three\/(?:fiber|drei)|@make-pictures\/remotion\/kits\/(?:paper-diorama-3d|isometric-3d|tactile-3d))['"]|<ThreeCanvas\b|<DirectorCamera3D\b/;

function resolveTsFileCandidate(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.tsx`,
    `${basePath}.ts`,
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.ts'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Lightweight source/import scan to detect whether a composition uses Three.js / WebGL 3D
 * (so `--gl=angle` is automatically enabled without requiring any legacy registry).
 */
export function detectCompositionUsesThree(
  studioDir: string,
  entryPoint: string,
  compositionId: string
): boolean {
  const entryDir = path.dirname(entryPoint);
  const rootCandidates = [
    path.join(entryDir, 'Root.tsx'),
    path.join(entryDir, 'Root.ts'),
    entryPoint,
  ];
  const rootFile = rootCandidates.find((p) => fs.existsSync(p));
  const filesToScan = new Set<string>();

  if (rootFile) {
    const rootSrc = fs.readFileSync(rootFile, 'utf8');
    const escapedId = compositionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const compTagRe = new RegExp(
      `<Composition\\b[^>]*\\bid\\s*=\\s*["']${escapedId}["'][^>]*>`,
      's'
    );
    const compMatch = compTagRe.exec(rootSrc);
    const identMatch = compMatch?.[0].match(
      /\bcomponent\s*=\s*\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}/
    );
    const componentIdent = identMatch?.[1];

    if (componentIdent) {
      const importRe =
        /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
      let im: RegExpExecArray | null;
      while ((im = importRe.exec(rootSrc)) !== null) {
        const clause = im[1] ?? '';
        const spec = im[2] ?? '';
        if (
          spec.startsWith('.') &&
          new RegExp(`\\b${componentIdent}\\b`).test(clause)
        ) {
          const resolved = resolveTsFileCandidate(
            path.resolve(path.dirname(rootFile), spec)
          );
          if (resolved) {
            filesToScan.add(resolved);
          }
        }
      }
    }
  }

  const config = loadMakePicturesConfig(studioDir);
  const slug = toKebabSlug(compositionId);
  for (const dirCandidate of [
    path.resolve(studioDir, config.videosDir, slug),
    path.join(studioDir, 'examples', slug),
  ]) {
    if (!fs.existsSync(dirCandidate)) continue;
    for (const entry of fs.readdirSync(dirCandidate, { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:tsx|ts)$/.test(entry.name)) {
        filesToScan.add(path.join(dirCandidate, entry.name));
      }
    }
  }

  for (const filePath of filesToScan) {
    try {
      const src = fs.readFileSync(filePath, 'utf8');
      if (THREE_USAGE_RE.test(src)) {
        return true;
      }
    } catch {
      // Ignore unreadable files
    }
  }

  return false;
}

/**
 * Renders a composition at configured FPS (default `60 FPS`, `--concurrency=100%`, automatic
 * `--gl=angle` when Three.js is detected or `--gl-angle` is passed) and normalizes integrated
 * loudness to `-14 LUFS` (`master-loudness.ts`) unless `--no-master` is set.
 */
export async function runRenderCommand(
  options: RenderCommandOptions
): Promise<{ outputPath: string; mastered: boolean }> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  const config = loadMakePicturesConfig(studioDir);
  const { compositionId } = options;

  const remotionBin = assertRemotionInstalled(rootDir, [
    'remotion',
    '@remotion/cli',
  ]);
  if (!options.noMaster) {
    assertFfmpegInstalled('-14 LUFS loudness mastering');
  }

  const resolvedOutPath = options.outPath
    ? path.resolve(rootDir, options.outPath)
    : path.resolve(studioDir, 'out', `${toKebabSlug(compositionId)}.mp4`);
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });

  const entryPoint = resolveRemotionEntryPoint({
    rootDir,
    studioDir,
    explicitEntry: options.entryPoint,
  });

  const publicDir = path.resolve(studioDir, config.publicDir);
  fs.mkdirSync(publicDir, { recursive: true });

  const usesThree =
    options.glAngle ??
    detectCompositionUsesThree(studioDir, entryPoint, compositionId);
  const resolvedConcurrency =
    options.concurrency ??
    (usesThree ? String(Math.max(2, Math.min(6, os.cpus().length))) : '100%');
  const resolvedTimeout = options.timeoutMs ?? 90000;

  const args = [
    'render',
    path.relative(rootDir, entryPoint),
    compositionId,
    resolvedOutPath,
    `--fps=${config.fps}`,
    `--concurrency=${resolvedConcurrency}`,
    `--timeout=${resolvedTimeout}`,
    `--public-dir=${publicDir}`,
    ...(usesThree ? ['--gl=angle'] : []),
    ...(options.propsArg ? [`--props=${options.propsArg}`] : []),
  ];

  console.log('==============================================================');
  console.log(
    ` 🎞️  make.pictures — ${config.fps} FPS Render (${compositionId}${
      usesThree ? ' • GPU ANGLE' : ''
    })`
  );
  console.log('==============================================================');

  execFileSync(remotionBin, args, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (options.noMaster) {
    console.log(
      `\n✅ Render complete (--no-master): ${path.relative(
        rootDir,
        resolvedOutPath
      )}`
    );
    return { outputPath: resolvedOutPath, mastered: false };
  }

  const masterResult = masterMp4Loudness(resolvedOutPath);
  console.log(
    `\n✅ Mastered MP4 ready (${masterResult.targetLufs} LUFS): ${path.relative(
      rootDir,
      resolvedOutPath
    )}`
  );

  return {
    outputPath: resolvedOutPath,
    mastered: masterResult.mastered,
  };
}
