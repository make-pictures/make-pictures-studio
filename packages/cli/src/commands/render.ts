import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { masterMp4Loudness } from '../audio/master-loudness';
import { toKebabSlug } from '../utils/cli-helpers';
import {
  collectRelativeImportedFiles,
  resolveCompositionSourceFromRoot,
} from '../utils/composition-resolver';
import { blankCommentsPreservingNewlines } from '../utils/jsx-source-scan';
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

const THREE_USAGE_RE =
  /from\s+['"](?:three|@remotion\/three|@react-three\/(?:fiber|drei)|@make-pictures\/remotion\/kits\/(?:paper-diorama-3d|isometric-3d|tactile-3d))['"]|<ThreeCanvas\b|<DirectorCamera3D\b/;

/**
 * Lightweight source/import scan to detect whether a composition uses Three.js / WebGL 3D
 * (so `--gl=angle` is automatically enabled without requiring any legacy registry).
 * Chases `export * from` / `export { X } from` barrels, local relative imports, and
 * sibling `.tsx`/`.ts` files inside the resolved composition directory.
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

  let resolvedSourceFile: string | null = null;
  if (rootFile) {
    resolvedSourceFile = resolveCompositionSourceFromRoot(
      rootFile,
      compositionId
    );
    if (resolvedSourceFile) {
      for (const importedFile of collectRelativeImportedFiles(
        resolvedSourceFile,
        2
      )) {
        filesToScan.add(importedFile);
      }

      const compDir = path.dirname(resolvedSourceFile);
      const rootDirOfRootFile = path.dirname(path.resolve(rootFile));
      // Scan sibling `.tsx`/`.ts` files when the composition lives in its own subdirectory
      if (compDir !== rootDirOfRootFile && fs.existsSync(compDir)) {
        for (const entry of fs.readdirSync(compDir, { withFileTypes: true })) {
          if (entry.isFile() && /\.(?:tsx|ts)$/.test(entry.name)) {
            filesToScan.add(path.join(compDir, entry.name));
          }
        }
      }
    }
  }

  if (!resolvedSourceFile) {
    const config = loadMakePicturesConfig(studioDir);
    const slug = toKebabSlug(compositionId);
    for (const dirCandidate of [
      path.resolve(studioDir, config.videosDir, slug),
      path.join(studioDir, 'examples', slug),
    ]) {
      if (!fs.existsSync(dirCandidate)) continue;
      for (const entry of fs.readdirSync(dirCandidate, {
        withFileTypes: true,
      })) {
        if (entry.isFile() && /\.(?:tsx|ts)$/.test(entry.name)) {
          filesToScan.add(path.join(dirCandidate, entry.name));
        }
      }
    }
  }

  for (const filePath of filesToScan) {
    try {
      const src = blankCommentsPreservingNewlines(
        fs.readFileSync(filePath, 'utf8')
      );
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
  const config = loadMakePicturesConfig(studioDir, rootDir);
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
