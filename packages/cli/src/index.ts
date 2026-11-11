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
  runAudioCommand,
  runMusicShortcutCommand,
  runSfxShortcutCommand,
} from './commands/audio';
import { runDoctorCommand } from './commands/doctor';
import { runGenerateImageCommand } from './commands/generate-image';
import { runInitCommand } from './commands/init';
import {
  runNewProductionCommand,
  type ScaffoldKitId,
} from './commands/new-production';
import { runOnboardCommand } from './commands/onboard';
import { runQaContactSheetCommand } from './commands/qa-contact-sheet';
import { runRenderCommand } from './commands/render';
import { runStudioCommand } from './commands/studio';

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

  init [--dir=videos] [--kit=paper-diorama-3d] [--lang=en|pl] [--force]
      Initialize make.pictures capsules + AI agent skills inside an existing repo

  onboard [init|connect|wait|check|status]
      Agent-friendly JSON onboarding workflow (Node, FFmpeg, ElevenLabs OAuth)

  doctor [--setup] [--dir=<subdir>]
      Verify Node.js, FFmpeg, ElevenLabs connectivity, capsules, and Remotion

  new <slug> [--kit=motion-diagrams-2d|paper-diorama-3d|isometric-3d|kinetic-typography|data-storytelling] [--lang=en|pl] [--dir=<subdir>]
      Scaffold an isolated production capsule in productions/<slug>/

  audio [--production=<slug>] [--mock] [--force] [--dir=<subdir>]
      Generate ElevenLabs TTS voiceovers + word timestamps + AI Music + AI SFX

  music [--production=<slug>] [--prompt="..."] [--mood=ambient-tech] [--duration=16] [--mock] [--force]
      Generate or refresh background score track

  sfx [--production=<slug>] [--id=whoosh] [--prompt="..."] [--preset=whoosh] [--loop] [--mock] [--force]
      Generate or refresh Foley / SFX asset

  qa <CompositionId> [--grid=4x3] [--out=out/qa-<id>.png] [--duration=<frames>] [--dir=<subdir>]
      Render a 12-frame Contact-Sheet PNG (with 9:16 Golden Safe Box inspection)

  render <CompositionId> [outPath] [--no-master] [--props=<jsonOrFile>] [--dir=<subdir>]
      Render 60 FPS MP4 (auto --gl=angle for 3D) + master loudness to -14 LUFS

  image "<prompt>" --out=<file.png> [--aspect=1:1|16:9|9:16] [--model=gemini-2.5-flash-image]
      Generate illustration asset via Gemini Image API (requires GEMINI_API_KEY)
`);
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
      const kit = getStringFlag(flags, 'kit') as ScaffoldKitId | undefined;
      const langRaw = getStringFlag(flags, 'lang');
      const lang = langRaw === 'pl' ? 'pl' : 'en';
      await runInitCommand({
        cwd,
        dir,
        kit,
        lang,
        force: Boolean(flags.force),
      });
      return;
    }

    case 'onboard': {
      const step = positionals[1] || getStringFlag(flags, 'step') || 'init';
      const extraArgs = flags.wait ? ['--wait'] : [];
      await runOnboardCommand({
        cwd,
        step,
        extraArgs,
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

    case 'new': {
      const slug = positionals[1] || getStringFlag(flags, 'slug');
      if (!slug) {
        throw new Error(
          'Missing <slug>. Usage: make-pictures new <slug> [--kit=paper-diorama-3d] [--lang=pl|en]'
        );
      }
      const kit = getStringFlag(flags, 'kit') as ScaffoldKitId | undefined;
      const langRaw = getStringFlag(flags, 'lang');
      const lang = langRaw === 'pl' ? 'pl' : 'en';
      await runNewProductionCommand({
        cwd,
        dir,
        slug,
        kit,
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
      await runRenderCommand({
        cwd,
        dir,
        entryPoint: entry,
        compositionId,
        outPath,
        noMaster: Boolean(flags['no-master']),
        propsArg: getStringFlag(flags, 'props'),
        glAngle: flags.gl === 'angle' ? true : undefined,
      });
      return;
    }

    case 'image': {
      const prompt = positionals[1] || getStringFlag(flags, 'prompt');
      const outPath = getStringFlag(flags, 'out') || positionals[2];
      if (!prompt || !outPath) {
        throw new Error(
          'Usage: make-pictures image "<prompt>" --out=<path.png> [--aspect=1:1|16:9|9:16]'
        );
      }
      await runGenerateImageCommand({
        cwd,
        prompt,
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

    default:
      throw new Error(
        `Unknown command "${command}". Run \`make-pictures --help\` to see available commands.`
      );
  }
}

export * from './audio/generate-music';
export * from './audio/generate-sfx';
export * from './audio/master-loudness';
export * from './commands/audio';
export * from './commands/doctor';
export * from './commands/generate-image';
export * from './commands/init';
export * from './commands/new-production';
export * from './commands/onboard';
export * from './commands/qa-contact-sheet';
export * from './commands/render';
export * from './commands/studio';
export * from './commands/workspace-paths';

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
