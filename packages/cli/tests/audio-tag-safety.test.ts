import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as remotionAudio from '@make-pictures/remotion/audio';
import {
  auditStudioAudioLifetimes,
  scanTsxForUnboundedAudioSequences,
} from '../src/audio/audit-audio-tags';
import { buildScaffoldCompositionTsx } from '../src/commands/new-production';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');

test('resolveSoundCueDurationInFrames bounds one-shot SFX to a finite window instead of Infinity', () => {
  const resolveFn = (
    remotionAudio as Record<string, unknown>
  ).resolveSoundCueDurationInFrames as
    | ((params: {
        resolvedFrame: number;
        compositionDurationInFrames: number;
        fps: number;
        durationInFrames?: number;
        durationSeconds?: number;
        playbackRate?: number;
        loop?: boolean;
      }) => number)
    | undefined;

  assert.equal(
    typeof resolveFn,
    'function',
    'Expected resolveSoundCueDurationInFrames to be exported from @make-pictures/remotion/audio'
  );

  // 1. Default one-shot fallback (6s * 60fps = 360 frames, NOT Infinity)
  assert.equal(
    resolveFn!({
      resolvedFrame: 100,
      compositionDurationInFrames: 1800,
      fps: 60,
    }),
    360
  );

  // 2. Explicit durationSeconds from SFX_MANIFEST (+ 0.35s tail padding: (0.45 + 0.35) * 60 = 48 frames)
  assert.equal(
    resolveFn!({
      resolvedFrame: 100,
      compositionDurationInFrames: 1800,
      fps: 60,
      durationSeconds: 0.45,
    }),
    48
  );

  // 3. Explicit durationInFrames clamped to remaining composition frames
  assert.equal(
    resolveFn!({
      resolvedFrame: 1750,
      compositionDurationInFrames: 1800,
      fps: 60,
      durationInFrames: 120,
    }),
    50
  );

  // 4. Loop ambient extends to remaining composition duration
  assert.equal(
    resolveFn!({
      resolvedFrame: 60,
      compositionDurationInFrames: 1800,
      fps: 60,
      loop: true,
    }),
    1740
  );

  // 5. Cue beyond composition end returns 0 (does not mount <Audio />)
  assert.equal(
    resolveFn!({
      resolvedFrame: 1800,
      compositionDurationInFrames: 1800,
      fps: 60,
    }),
    0
  );
});

test('resolveVoiceoverDurationInFrames computes finite sequence duration from durationInSeconds + tail padding', () => {
  const resolveVoFn = (
    remotionAudio as Record<string, unknown>
  ).resolveVoiceoverDurationInFrames as
    | ((params: {
        fromFrame: number;
        compositionDurationInFrames: number;
        fps: number;
        durationInFrames?: number;
        durationSeconds?: number;
        durationInSeconds?: number;
        playbackRate?: number;
        tailPaddingSeconds?: number;
      }) => number)
    | undefined;

  assert.equal(
    typeof resolveVoFn,
    'function',
    'Expected resolveVoiceoverDurationInFrames to be exported from @make-pictures/remotion/audio'
  );

  // 4.5s + 0.35s default tail padding at 60fps = ceil(4.85 * 60) = 291 frames
  assert.equal(
    resolveVoFn!({
      fromFrame: 12,
      compositionDurationInFrames: 1800,
      fps: 60,
      durationInSeconds: 4.5,
    }),
    291
  );

  // Clamped to composition end
  assert.equal(
    resolveVoFn!({
      fromFrame: 1700,
      compositionDurationInFrames: 1800,
      fps: 60,
      durationInSeconds: 4.5,
    }),
    100
  );
});

test('scanTsxForUnboundedAudioSequences flags <Sequence> without durationInFrames wrapping <Audio />', () => {
  const brokenTsx = [
    "import { Audio, Sequence } from 'remotion';",
    'export const HistoriaPizzy = () => (',
    '  <>',
    '    <Sequence from={12} durationInFrames={240}>',
    '      <Audio src="s1.mp3" />',
    '    </Sequence>',
    '    {/* <Sequence from={99}><Audio src="commented.mp3" /></Sequence> */}',
    '    <Sequence',
    '      from={320}',
    '      layout="none"',
    '    >',
    '      <Audio src="s2-unbounded.mp3" />',
    '    </Sequence>',
    '    <Sequence from={640}>',
    '      <div>Visual card without audio</div>',
    '    </Sequence>',
    '  </>',
    ');',
  ].join('\n');

  const warnings = scanTsxForUnboundedAudioSequences(
    brokenTsx,
    'src/videos/historia-pizzy/HistoriaPizzy.tsx'
  );
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].line, 8);
  assert.match(warnings[0].message, /durationInFrames|VoiceoverTrack/i);
  assert.match(warnings[0].message, /@make-pictures\/remotion\/audio/);
});

test('auditStudioAudioLifetimes inspects src/videos/**/*.tsx inside studioDir', () => {
  const tmpStudio = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-audio-audit-'));
  try {
    const compDir = path.join(tmpStudio, 'src', 'videos', 'pizza-film');
    fs.mkdirSync(compDir, { recursive: true });
    fs.writeFileSync(
      path.join(compDir, 'PizzaFilm.tsx'),
      `<Sequence from={400}>\n  <Html5Audio src="vo.mp3" />\n</Sequence>\n`,
      'utf8'
    );

    const warnings = auditStudioAudioLifetimes(tmpStudio);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].filePath, /PizzaFilm\.tsx$/);
  } finally {
    fs.rmSync(tmpStudio, { recursive: true, force: true });
  }
});

test('new-production scaffolds use <VoiceoverTrack /> and pass durationSeconds to <SoundCue />', () => {
  for (const kit of ['paper-diorama-3d', 'motion-diagrams-2d'] as const) {
    const tsx = buildScaffoldCompositionTsx({
      slug: 'historia-pizzy',
      pascalName: 'HistoriaPizzy',
      kit,
    });
    assert.match(tsx, /<VoiceoverTrack\b/);
    assert.match(tsx, /durationSeconds=\{whooshSfx\.durationSeconds\}/);
    assert.match(tsx, /durationSeconds=\{popSfx\.durationSeconds\}/);
    assert.equal(
      scanTsxForUnboundedAudioSequences(tsx, `HistoriaPizzy-${kit}.tsx`).length,
      0
    );
  }
});

test('all monorepo showcase examples pass scanTsxForUnboundedAudioSequences with zero unbounded <Audio /> sequences', () => {
  const isoPath = path.join(
    MONOREPO_ROOT,
    'examples',
    'isometric-dialogue',
    'IsometricDialogueDemo.tsx'
  );
  const isoSrc = fs.readFileSync(isoPath, 'utf8');
  const warnings = scanTsxForUnboundedAudioSequences(isoSrc, isoPath);
  assert.equal(
    warnings.length,
    0,
    `Expected zero unbounded <Audio /> sequences in IsometricDialogueDemo.tsx, got: ${JSON.stringify(warnings)}`
  );
});
