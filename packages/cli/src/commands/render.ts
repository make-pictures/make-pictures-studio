import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { masterMp4Loudness } from '../audio/master-loudness';
import { toKebabSlug } from './qa-contact-sheet';
import {
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
}

function resolveLocalRemotionBin(rootDir: string): string {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const localBin = path.join(rootDir, 'node_modules', '.bin', `remotion${ext}`);
  return fs.existsSync(localBin) ? localBin : 'remotion';
}

async function detectUsesThree(
  studioDir: string,
  compositionId: string
): Promise<boolean> {
  try {
    const registryPath = path.join(
      studioDir,
      'src',
      'compositions',
      'registry.ts'
    );
    if (!fs.existsSync(registryPath)) return true;
    const mod = (await import(pathToFileURL(registryPath).href)) as {
      getCompositionById?: (id: string) => { usesThree?: boolean } | undefined;
    };
    const entry = mod.getCompositionById?.(compositionId);
    return entry?.usesThree ?? true;
  } catch {
    return true;
  }
}

/**
 * Renders a composition at `60 FPS` (`--concurrency=100%`, automatic `--gl=angle` for 3D)
 * and normalizes integrated loudness to `-14 LUFS` (`master-loudness.ts`) unless `--no-master` is set.
 */
export async function runRenderCommand(
  options: RenderCommandOptions
): Promise<{ outputPath: string; mastered: boolean }> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  const { compositionId } = options;

  const resolvedOutPath = options.outPath
    ? path.resolve(rootDir, options.outPath)
    : path.resolve(studioDir, 'out', `${toKebabSlug(compositionId)}.mp4`);
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });

  const entryPoint = resolveRemotionEntryPoint({
    rootDir,
    studioDir,
    explicitEntry: options.entryPoint,
  });

  const publicDir = path.join(studioDir, 'public');
  fs.mkdirSync(publicDir, { recursive: true });

  const usesThree =
    options.glAngle ?? (await detectUsesThree(studioDir, compositionId));
  const remotionBin = resolveLocalRemotionBin(rootDir);

  const args = [
    'render',
    path.relative(rootDir, entryPoint),
    compositionId,
    resolvedOutPath,
    '--fps=60',
    '--concurrency=100%',
    `--public-dir=${publicDir}`,
    ...(usesThree ? ['--gl=angle'] : []),
    ...(options.propsArg ? [`--props=${options.propsArg}`] : []),
  ];

  console.log('==============================================================');
  console.log(
    ` 🎞️  make.pictures — 60 FPS Render (${compositionId}${
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
