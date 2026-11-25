import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertFfmpegInstalled } from '../commands/workspace-paths';

export interface MasterLoudnessOptions {
  /** Target integrated loudness in LUFS (default: `-14` for YouTube / Shorts / Reels) */
  targetI?: number;
  /** Maximum true peak in dBTP (default: `-1.5`) */
  truePeak?: number;
  /** Loudness range target in LU (default: `11`) */
  lra?: number;
}

export interface MasterLoudnessResult {
  mastered: boolean;
  outputPath: string;
  targetLufs: number;
}

function hasAudioStream(filePath: string): boolean {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'a',
        '-show_entries',
        'stream=index',
        '-of',
        'csv=p=0',
        filePath,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return out.trim().length > 0;
  } catch {
    // Fallback when `ffprobe` is unavailable: inspect `ffmpeg -i` stream summary via stderr
    try {
      execFileSync('ffmpeg', ['-hide_banner', '-i', filePath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return false;
    } catch (ffmpegErr: unknown) {
      const stderr =
        ffmpegErr &&
        typeof ffmpegErr === 'object' &&
        'stderr' in ffmpegErr &&
        typeof (ffmpegErr as { stderr?: unknown }).stderr === 'string'
          ? (ffmpegErr as { stderr: string }).stderr
          : '';
      return /Stream\s+#\d+:\d+(?:\([^)]*\))?:\s*Audio:/i.test(stderr);
    }
  }
}

/**
 * Post-processes a rendered `.mp4` with EBU R128 loudness normalization
 * (`loudnorm=I=-14:TP=-1.5:LRA=11`) while copying the H.264/H.265 video stream
 * losslessly (`-c:v copy`).
 */
export function masterMp4Loudness(
  mp4Path: string,
  options?: MasterLoudnessOptions
): MasterLoudnessResult {
  const resolvedPath = path.resolve(mp4Path);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Cannot master loudness: file not found at ${resolvedPath}`);
  }
  assertFfmpegInstalled('-14 LUFS loudness mastering');

  const targetI = options?.targetI ?? -14;
  const truePeak = options?.truePeak ?? -1.5;
  const lra = options?.lra ?? 11;

  if (!hasAudioStream(resolvedPath)) {
    console.log(
      `  [MASTERING] No audio stream detected in ${path.basename(
        resolvedPath
      )} — skipping loudnorm.`
    );
    return {
      mastered: false,
      outputPath: resolvedPath,
      targetLufs: targetI,
    };
  }

  const tempPath = `${resolvedPath}.loudnorm-${process.pid}.mp4`;
  const filter = `loudnorm=I=${targetI}:TP=${truePeak}:LRA=${lra}`;

  console.log(
    `  [MASTERING] Normalizing loudness (${filter}) → ${path.basename(resolvedPath)}…`
  );

  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        resolvedPath,
        '-c:v',
        'copy',
        '-af',
        filter,
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-ar',
        '48000',
        '-movflags',
        '+faststart',
        tempPath,
      ],
      { stdio: 'ignore' }
    );
    fs.renameSync(tempPath, resolvedPath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore cleanup error
      }
    }
    throw err;
  }

  return {
    mastered: true,
    outputPath: resolvedPath,
    targetLufs: targetI,
  };
}
