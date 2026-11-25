import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DirectorAuditError,
  auditCompositionDirection,
  scanTsxForCompetingFocalPoints,
  scanTsxForExcessiveSubViews,
  scanTsxForRawHtmlImgTags,
  scanTsxForSmallFontSizes,
  scanTsxForUnclippedCardBars,
  verifyCleanFrameZeroImage,
  type DirectorAuditResult,
} from '../src/director/audit-direction';
import {
  auditFrameZeroDomInPage,
  auditRenderedFrameDomInPage,
  resolveQaGridDimensions,
  selectQaSampleFrames,
} from '../src/commands/qa-contact-sheet';
import { runCli } from '../src/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function makeTempVideoProject(
  files: Record<string, string>,
  slug = 'test-film'
): { studioDir: string; videoDir: string; cleanup: () => void } {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-director-qa-'));
  const videoDir = path.join(studioDir, 'src', 'videos', slug);
  fs.mkdirSync(videoDir, { recursive: true });

  for (const [relPath, content] of Object.entries(files)) {
    const absPath = path.join(videoDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf8');
  }

  return {
    studioDir,
    videoDir,
    cleanup: () => fs.rmSync(studioDir, { recursive: true, force: true }),
  };
}

test('Rule 1 (MIN_SCENE_SPAN): rejects short sceneTimeline spans (< 270f) and short visual <Sequence> tags while ignoring layout="none" audio sequences', () => {
  const { studioDir, videoDir, cleanup } = makeTempVideoProject({
    'FastCutFilm.tsx': [
      "import React from 'react';",
      "import { AbsoluteFill, Audio, Sequence } from 'remotion';",
      'export const FastCutFilm: React.FC = () => (',
      '  <AbsoluteFill>',
      '    <Sequence from={12} durationInFrames={42} layout="none">',
      '      <Audio src="sfx.mp3" />',
      '    </Sequence>',
      '    {/* <Sequence from={0} durationInFrames={90}><div>commented</div></Sequence> */}',
      '    <Sequence from={0} durationInFrames={174}>',
      '      <div>Too fast visual sub-shot (2.9s)</div>',
      '    </Sequence>',
      '    <Sequence from={174} durationInFrames={426}>',
      '      <div>Second visual block</div>',
      '    </Sequence>',
      '  </AbsoluteFill>',
      ');',
    ].join('\n'),
  });

  try {
    assert.throws(
      () =>
        auditCompositionDirection({
          studioDir,
          compositionId: 'FastCutFilm',
          origin: 'production',
          capsuleDir: videoDir,
          durationInFrames: 600,
          fps: 60,
          sceneTimeline: [
            { sceneId: 's1', fromFrame: 12, durationInFrames: 150 },
            { sceneId: 's2', fromFrame: 174, durationInFrames: 360 },
          ],
        }),
      (err: unknown) => {
        assert.ok(err instanceof DirectorAuditError);
        const codes = err.violations.map((v) => v.code);
        assert.ok(
          codes.includes('MIN_SCENE_SPAN'),
          `Expected MIN_SCENE_SPAN in ${JSON.stringify(codes)}`
        );
        const minSpanViolations = err.violations.filter(
          (v) => v.code === 'MIN_SCENE_SPAN'
        );
        assert.equal(minSpanViolations.length, 2);
        assert.match(err.message, /ContinuousSceneFlow/);
        return true;
      }
    );

    const softResult: DirectorAuditResult = auditCompositionDirection({
      studioDir,
      compositionId: 'FastCutFilm',
      origin: 'production',
      capsuleDir: videoDir,
      durationInFrames: 600,
      fps: 60,
      allowFastCuts: true,
      sceneTimeline: [
        { sceneId: 's1', fromFrame: 12, durationInFrames: 150 },
        { sceneId: 's2', fromFrame: 174, durationInFrames: 360 },
      ],
    });
    assert.equal(softResult.ok, false);
    assert.equal(softResult.violations.length, 2);
  } finally {
    cleanup();
  }
});

test('Rule 2A (COMPETING_FOCAL_POINT): rejects mounting <WordByWordStage> alongside card/node components in the same scene, while allowing separate >= 270f scenes', () => {
  for (const competingCard of [
    'ImpactKeywordCard',
    'StoryCard2D',
    'MetricComparisonCard',
    'SystemNode',
  ] as const) {
    const { studioDir, videoDir, cleanup } = makeTempVideoProject({
      'BusyFocal.tsx': [
        "import React from 'react';",
        "import { AbsoluteFill } from 'remotion';",
        'export const BusyFocal: React.FC = () => (',
        '  <AbsoluteFill>',
        '    <WordByWordStage sceneId="s1" />',
        `    <${competingCard} title="Competing card" />`,
        '  </AbsoluteFill>',
        ');',
      ].join('\n'),
    });

    try {
      assert.throws(
        () =>
          auditCompositionDirection({
            studioDir,
            compositionId: 'BusyFocal',
            origin: 'production',
            capsuleDir: videoDir,
            durationInFrames: 600,
            fps: 60,
          }),
        (err: unknown) => {
          assert.ok(err instanceof DirectorAuditError);
          assert.ok(
            err.violations.some((v) => v.code === 'COMPETING_FOCAL_POINT'),
            `Expected COMPETING_FOCAL_POINT when pairing WordByWordStage with ${competingCard}`
          );
          return true;
        }
      );
    } finally {
      cleanup();
    }
  }

  // Separated into two calm >= 270f scenes via ContinuousSceneFlow -> PASS
  const separated = makeTempVideoProject({
    'CalmKinetic.tsx': [
      "import React from 'react';",
      "import { ContinuousSceneFlow } from '@make-pictures/remotion';",
      'const IntroWords: React.FC = () => <WordByWordStage sceneId="s1" />;',
      'const PayoffCard: React.FC = () => <ImpactKeywordCard keyword="Calm" />;',
      'export const CalmKinetic: React.FC = () => (',
      '  <ContinuousSceneFlow',
      '    crossDissolveFrames={48}',
      '    scenes={[',
      "      { id: 's1', durationInFrames: 360, render: () => <IntroWords /> },",
      "      { id: 's2', durationInFrames: 360, render: () => <PayoffCard /> },",
      '    ]}',
      '  />',
      ');',
    ].join('\n'),
  });

  try {
    const res = auditCompositionDirection({
      studioDir: separated.studioDir,
      compositionId: 'CalmKinetic',
      origin: 'production',
      capsuleDir: separated.videoDir,
      durationInFrames: 720,
      fps: 60,
    });
    assert.equal(res.ok, true);
    assert.equal(res.violations.length, 0);
  } finally {
    separated.cleanup();
  }
});

test('Rule 2B (Reading Cadence & Breathing Room): rejects > 2.8 spoken words/s or < 36 frames of breathing room in audio.json', () => {
  const { studioDir, videoDir, cleanup } = makeTempVideoProject({
    'audio.json': JSON.stringify({
      id: 'test-film',
      title: 'Overstuffed Script',
      fps: 60,
      scenes: [
        {
          id: 's1',
          durationInSeconds: 4.5,
          text: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen.',
        },
        {
          id: 's2',
          durationInSeconds: 5.8,
          text: 'Calm short sentence yet audio runs too long.',
        },
      ],
    }),
    'generated/audio-manifest.ts': `export const VOICEOVER_MANIFEST = ${JSON.stringify(
      {
        s1: { sceneId: 's1', durationInSeconds: 3.8, fps: 60, words: [] },
        s2: { sceneId: 's2', durationInSeconds: 5.8, fps: 60, words: [] },
      },
      null,
      2
    )};\n`,
    'Overstuffed.tsx':
      'export const Overstuffed = () => <div>Calm visual</div>;\n',
  });

  try {
    assert.throws(
      () =>
        auditCompositionDirection({
          studioDir,
          compositionId: 'Overstuffed',
          origin: 'production',
          capsuleDir: videoDir,
          durationInFrames: 660,
          fps: 60,
          sceneTimeline: [
            { sceneId: 's1', fromFrame: 12, durationInFrames: 228 },
            { sceneId: 's2', fromFrame: 300, durationInFrames: 348 },
          ],
        }),
      (err: unknown) => {
        assert.ok(err instanceof DirectorAuditError);
        const codes = err.violations.map((v) => v.code);
        assert.ok(
          codes.includes('READING_CADENCE_OVER_BUDGET'),
          `Expected READING_CADENCE_OVER_BUDGET in ${JSON.stringify(codes)}`
        );
        assert.ok(
          codes.includes('INSUFFICIENT_BREATHING_ROOM'),
          `Expected INSUFFICIENT_BREATHING_ROOM in ${JSON.stringify(codes)}`
        );
        return true;
      }
    );
  } finally {
    cleanup();
  }
});

test('Rule 3 (Anti-Choppy Transition Gate): rejects <SceneTransition> with flash-cut, paper-curtain, iris-wipe, or durationInFrames < 30', () => {
  const { studioDir, videoDir, cleanup } = makeTempVideoProject({
    'ChoppyTransitions.tsx': [
      "import React from 'react';",
      'export const ChoppyTransitions = () => (',
      '  <>',
      '    <SceneTransition atFrame={360} durationInFrames={36} type="flash-cut" />',
      '    <SceneTransition atFrame={720} durationInFrames={36} type="paper-curtain" />',
      '    <SceneTransition atFrame={1080} durationInFrames={36} type="iris-wipe" />',
      '    <SceneTransition atFrame={1440} durationInFrames={18} type="ink-wash" />',
      '  </>',
      ');',
    ].join('\n'),
  });

  try {
    assert.throws(
      () =>
        auditCompositionDirection({
          studioDir,
          compositionId: 'ChoppyTransitions',
          origin: 'production',
          capsuleDir: videoDir,
          durationInFrames: 1800,
          fps: 60,
        }),
      (err: unknown) => {
        assert.ok(err instanceof DirectorAuditError);
        const choppy = err.violations.filter(
          (v) => v.code === 'CHOPPY_SCENE_TRANSITION'
        );
        assert.equal(choppy.length, 4);
        assert.match(err.message, /ContinuousSceneFlow|OpticalCrossDissolve/);
        return true;
      }
    );
  } finally {
    cleanup();
  }
});

test('Rule 4 (Rounded-Card Unclipped Bar Hygiene): rejects overflow: visible + unclipped absolute top: 0 bar (height 2..8) unless ClippedSurfaceChrome is used', () => {
  const unclipped = makeTempVideoProject({
    'LeakyNode.tsx': [
      "import React from 'react';",
      'export const LeakyNode: React.FC = () => (',
      '  <div style={{ position: "relative", borderRadius: 18, overflow: \'visible\' }}>',
      '    <div style={{ position: \'absolute\', top: 0, left: 0, right: 0, height: 3, backgroundColor: "#FF0055" }} />',
      '    <span>Title</span>',
      '  </div>',
      ');',
    ].join('\n'),
  });

  try {
    assert.throws(
      () =>
        auditCompositionDirection({
          studioDir: unclipped.studioDir,
          compositionId: 'LeakyNode',
          origin: 'production',
          capsuleDir: unclipped.videoDir,
          durationInFrames: 360,
          fps: 60,
        }),
      (err: unknown) => {
        assert.ok(err instanceof DirectorAuditError);
        assert.ok(
          err.violations.some((v) => v.code === 'UNCLIPPED_CARD_BAR'),
          `Expected UNCLIPPED_CARD_BAR in ${JSON.stringify(err.violations)}`
        );
        assert.match(err.message, /ClippedSurfaceChrome/);
        return true;
      }
    );
  } finally {
    unclipped.cleanup();
  }

  const clipped = makeTempVideoProject({
    'CleanNode.tsx': [
      "import React from 'react';",
      "import { ClippedSurfaceChrome } from '@make-pictures/remotion';",
      'export const CleanNode: React.FC = () => (',
      '  <div style={{ position: "relative", borderRadius: 18, overflow: \'visible\' }}>',
      '    <ClippedSurfaceChrome topBarHeight={3} topBarColor="#FF0055" specularRim />',
      '    <div style={{ position: "absolute", left: -5, top: "50%", width: 8, height: 8 }} />',
      '    <span>Title</span>',
      '  </div>',
      ');',
    ].join('\n'),
  });

  try {
    const res = auditCompositionDirection({
      studioDir: clipped.studioDir,
      compositionId: 'CleanNode',
      origin: 'production',
      capsuleDir: clipped.videoDir,
      durationInFrames: 360,
      fps: 60,
    });
    assert.equal(res.ok, true);
    assert.equal(res.violations.length, 0);
  } finally {
    clipped.cleanup();
  }
});

test('Rule 5 (verifyCleanFrameZeroImage): accepts pure solid bgCanvas frame 0 PNG and rejects frame 0 with foreground card pixels', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-f0-check-'));
  try {
    const cleanPng = path.join(tmpDir, 'clean-f0.png');
    const dirtyPng = path.join(tmpDir, 'dirty-f0.png');

    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=0xF1F5F9:s=640x360:d=1',
        '-frames:v',
        '1',
        cleanPng,
      ],
      { stdio: 'ignore' }
    );

    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=0xF1F5F9:s=640x360:d=1',
        '-vf',
        'drawbox=x=160:y=90:w=320:h=180:color=0x0F172A:t=fill',
        '-frames:v',
        '1',
        dirtyPng,
      ],
      { stdio: 'ignore' }
    );

    const cleanRes = verifyCleanFrameZeroImage(cleanPng);
    assert.equal(cleanRes.clean, true);
    assert.equal(cleanRes.maxChannelSpread, 0);
    assert.equal(cleanRes.maxChannelVariance, 0);

    const dirtyRes = verifyCleanFrameZeroImage(dirtyPng);
    assert.equal(dirtyRes.clean, false);
    assert.ok(dirtyRes.maxChannelSpread > 0);

    const hairlinePng = path.join(tmpDir, 'hairline-f0.png');
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=0xF1F5F9:s=1920x1080:d=1',
        '-vf',
        'drawbox=x=960:y=540:w=1:h=1:color=0xCBD5E1:t=fill',
        '-frames:v',
        '1',
        hairlinePng,
      ],
      { stdio: 'ignore' }
    );
    const hairlineRes = verifyCleanFrameZeroImage(hairlinePng);
    assert.equal(
      hairlineRes.clean,
      false,
      'Full-resolution Frame 0 check must reject even a 1x1 pixel artifact missed by 32x32 downsampling'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Well-paced <ContinuousSceneFlow> video passes cleanly, and video scoping ignores unrelated sibling videos', () => {
  const { studioDir, videoDir, cleanup } = makeTempVideoProject(
    {
      'audio.json': JSON.stringify({
        id: 'calm-showreel',
        title: 'Calm Showreel v4',
        fps: 60,
        scenes: [
          {
            id: 'scene1-pl',
            durationInSeconds: 4.8,
            text: 'Z jednego opisu rodzi się obraz pełen światła, faktury i spokoju.',
          },
          {
            id: 'scene2-pl',
            durationInSeconds: 5.2,
            text: 'Każdy układ płynnie zmienia swój charakter od jasnego szkła po głęboki obsydian.',
          },
        ],
      }),
      'generated/audio-manifest.ts': `export const VOICEOVER_MANIFEST = ${JSON.stringify(
        {
          'scene1-pl': { sceneId: 'scene1-pl', durationInSeconds: 4.8, fps: 60 },
          'scene2-pl': { sceneId: 'scene2-pl', durationInSeconds: 5.2, fps: 60 },
        },
        null,
        2
      )};\n`,
      'CalmShowreel.tsx': [
        "import React from 'react';",
        "import { ContinuousSceneFlow, StyleProvider } from '@make-pictures/remotion';",
        'export const CalmShowreel: React.FC = () => (',
        '  <StyleProvider style="editorial-press" renderBackdrop>',
        '    <ContinuousSceneFlow',
        '      crossDissolveFrames={54}',
        '      scenes={[',
        "        { id: 's1', durationInFrames: 630, render: () => <div>Scene 1</div> },",
        "        { id: 's2', durationInFrames: 690, render: () => <div>Scene 2</div> },",
        '      ]}',
        '    />',
        '  </StyleProvider>',
        ');',
      ].join('\n'),
    },
    'calm-showreel'
  );

  try {
    const brokenSiblingDir = path.join(
      studioDir,
      'src',
      'videos',
      'broken-sibling'
    );
    fs.mkdirSync(brokenSiblingDir, { recursive: true });
    fs.writeFileSync(
      path.join(brokenSiblingDir, 'BrokenSibling.tsx'),
      '<Sequence from={0} durationInFrames={60}><SceneTransition type="flash-cut" atFrame={30} durationInFrames={12} /></Sequence>',
      'utf8'
    );

    const res = auditCompositionDirection({
      studioDir,
      compositionId: 'CalmShowreel',
      origin: 'production',
      capsuleDir: videoDir,
      durationInFrames: 1320,
      fps: 60,
      sceneTimeline: [
        { sceneId: 'scene1-pl', fromFrame: 42, durationInFrames: 288 },
        { sceneId: 'scene2-pl', fromFrame: 672, durationInFrames: 312 },
      ],
    });
    assert.equal(res.ok, true);
    assert.equal(res.violations.length, 0);
  } finally {
    cleanup();
  }
});

test('CLI wires --allow-fast-cuts and --audio flags into runQaContactSheetCommand', () => {
  const cliIndexSrc = fs.readFileSync(
    path.join(MONOREPO_ROOT, 'packages', 'cli', 'src', 'index.ts'),
    'utf8'
  );
  assert.match(cliIndexSrc, /'allow-fast-cuts'/);
  assert.match(cliIndexSrc, /allowFastCuts/);
  assert.match(cliIndexSrc, /audioManifestPath/);

  const qaSrc = fs.readFileSync(
    path.join(
      MONOREPO_ROOT,
      'packages',
      'cli',
      'src',
      'commands',
      'qa-contact-sheet.ts'
    ),
    'utf8'
  );
  assert.match(qaSrc, /auditCompositionDirection/);
  assert.match(qaSrc, /verifyCleanFrameZeroImage/);
  assert.match(qaSrc, /selectComposition/);
  assert.match(qaSrc, /resolveCompositionSourceFromRoot/);
  assert.doesNotMatch(qaSrc, /lookupRegistryHint/);
});

test('End-to-end runCli(["qa", ...]) fast-fails with DirectorAuditError before Remotion bundling when a video violates pacing rules', async () => {
  const { studioDir, cleanup } = makeTempVideoProject(
    {
      'audio.json': JSON.stringify({
        id: 'rush-cut',
        title: 'Rush Cut',
        fps: 60,
        scenes: [
          { id: 's1', durationInSeconds: 2.9, text: 'Too short opening cut.' },
          { id: 's2', durationInSeconds: 5.0, text: 'Second calm scene.' },
        ],
      }),
      'RushCut.tsx': [
        "import React from 'react';",
        'export const RushCut = () => (',
        '  <Sequence from={0} durationInFrames={174}>',
        '    <SceneTransition atFrame={174} durationInFrames={18} type="iris-wipe" />',
        '  </Sequence>',
        ');',
      ].join('\n'),
    },
    'rush-cut'
  );

  fs.writeFileSync(
    path.join(studioDir, 'src', 'index.ts'),
    "import { registerRoot } from 'remotion';\nimport { RemotionRoot } from './Root';\nregisterRoot(RemotionRoot);\n"
  );
  fs.writeFileSync(
    path.join(studioDir, 'src', 'Root.tsx'),
    [
      "import { Composition } from 'remotion';",
      "import { RushCut } from './videos/rush-cut/RushCut';",
      'export const RemotionRoot = () => (',
      '  <Composition id="RushCut" component={RushCut} durationInFrames={600} fps={60} width={1920} height={1080} />',
      ');',
    ].join('\n')
  );

  try {
    await assert.rejects(
      () => runCli(['qa', 'RushCut', `--cwd=${studioDir}`]),
      (err: unknown) => {
        assert.ok(err instanceof DirectorAuditError);
        const codes = err.violations.map((v) => v.code);
        assert.ok(codes.includes('MIN_SCENE_SPAN'));
        assert.ok(codes.includes('CHOPPY_SCENE_TRANSITION'));
        return true;
      }
    );
  } finally {
    cleanup();
  }
});

test('scanTsxForUnclippedCardBars catches ternary height bars (height: cond ? 6 : 3) at top: 0 while ignoring top: "50%" port pins', () => {
  const ternaryUnclipped = [
    'export const NodeWithPortPins = ({ grammar }: { grammar: string }) => (',
    "  <div style={{ position: 'absolute', borderRadius: 16, overflow: 'visible' }}>",
    "    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: grammar === 'risograph-poster' ? 6 : 3 }} />",
    "    <div style={{ position: 'absolute', left: -5, top: '50%', width: 8, height: 8 }} />",
    '  </div>',
    ');',
  ].join('\n');

  const v1 = scanTsxForUnclippedCardBars(ternaryUnclipped, 'NodeWithPortPins.tsx');
  assert.equal(v1.length, 1);
  assert.equal(v1[0].code, 'UNCLIPPED_CARD_BAR');

  const onlyPortPins = [
    'export const NodeWithOnlyPortPins = () => (',
    "  <div style={{ position: 'absolute', borderRadius: 16, overflow: 'visible' }}>",
    "    <div style={{ position: 'absolute', left: -5, top: '50%', width: 8, height: 8 }} />",
    '  </div>',
    ');',
  ].join('\n');

  const v2 = scanTsxForUnclippedCardBars(onlyPortPins, 'NodeWithOnlyPortPins.tsx');
  assert.equal(v2.length, 0);
});

test('selectQaSampleFrames and resolveQaGridDimensions default to --grid=auto, guaranteeing 100% scene and sub-view coverage on 8+ scene timelines', () => {
  const nominal5Scenes = [
    { sceneId: 's1', fromFrame: 0, durationInFrames: 450 },
    { sceneId: 's2', fromFrame: 450, durationInFrames: 480 },
    { sceneId: 's3', fromFrame: 930, durationInFrames: 540 },
    { sceneId: 's4', fromFrame: 1470, durationInFrames: 540 },
    { sceneId: 's5', fromFrame: 2010, durationInFrames: 330 },
  ];
  const samples5 = selectQaSampleFrames(2340, 12, nominal5Scenes);
  assert.equal(samples5.length, 12);
  assert.equal(samples5[0], 0);
  assert.equal(samples5[11], 2310);

  for (const seg of nominal5Scenes) {
    assert.ok(
      samples5.some(
        (f) =>
          f >= seg.fromFrame + 54 && f < seg.fromFrame + seg.durationInFrames
      ),
      `Expected settled sample inside scene ${seg.sceneId}`
    );
  }

  const nineSceneWithSubViews = [
    { sceneId: 's1', fromFrame: 0, durationInFrames: 360 },
    {
      sceneId: 's2',
      fromFrame: 360,
      durationInFrames: 420,
      subViews: [
        { id: 'view-a', fromOffsetFrames: 0 },
        { id: 'view-b', fromOffsetFrames: 210 },
      ],
    },
    { sceneId: 's3', fromFrame: 780, durationInFrames: 360 },
    { sceneId: 's4', fromFrame: 1140, durationInFrames: 360 },
    {
      sceneId: 's5',
      fromFrame: 1500,
      durationInFrames: 440,
      subViews: [
        { id: 'overview', fromOffsetFrames: 0 },
        { id: 'detail', fromOffsetFrames: 220 },
      ],
    },
    { sceneId: 's6', fromFrame: 1940, durationInFrames: 360 },
    { sceneId: 's7', fromFrame: 2300, durationInFrames: 360 },
    { sceneId: 's8', fromFrame: 2660, durationInFrames: 360 },
    { sceneId: 's9', fromFrame: 3020, durationInFrames: 420 },
  ];
  const autoSamples = selectQaSampleFrames(3440, undefined, nineSceneWithSubViews);
  const autoGrid = resolveQaGridDimensions(undefined, autoSamples.length);
  assert.equal(autoGrid.cols, 4);
  assert.equal(autoGrid.rows, 4);
  assert.equal(autoSamples.length, 16);
  assert.equal(autoSamples[0], 0);

  assert.ok(autoSamples.some((f) => f > 360 && f < 570), 'Missing s2/view-a');
  assert.ok(autoSamples.some((f) => f > 570 && f < 780), 'Missing s2/view-b');
  assert.ok(autoSamples.some((f) => f > 1500 && f < 1720), 'Missing s5/overview');
  assert.ok(autoSamples.some((f) => f > 1720 && f < 1940), 'Missing s5/detail');
  for (const seg of nineSceneWithSubViews) {
    assert.ok(
      autoSamples.some(
        (f) => f > seg.fromFrame && f < seg.fromFrame + seg.durationInFrames
      ),
      `Missing sample in scene ${seg.sceneId}`
    );
  }
});

test('Extended QA rules catch RAW_HTML_IMG_TAG, FONT_BELOW_1080P_FLOOR, EXCESSIVE_SUBVIEWS, expanded INSUFFICIENT_BREATHING_ROOM (pre/post/outro), and DOM CARD_VERTICAL_VOID', () => {
  const imgViolations = scanTsxForRawHtmlImgTags(
    [
      "import { Img } from 'remotion';",
      'const note = "<img src=\'ignored-in-string.png\' />";',
      '// <img src="ignored-in-comment.png" />',
      'export const BadMedia = () => (',
      '  <div>',
      '    <Img src="good.png" />',
      '    <img src="bad.png" alt="raw" />',
      '  </div>',
      ');',
    ].join('\n'),
    'BadMedia.tsx'
  );
  assert.equal(imgViolations.length, 1);
  assert.equal(imgViolations[0]!.code, 'RAW_HTML_IMG_TAG');
  assert.equal(imgViolations[0]!.line, 7);

  const fontViolations = scanTsxForSmallFontSizes(
    [
      'export const MicroType = () => (',
      '  <div style={{ fontSize: 20 }}>',
      '    <span style={{ fontSize: 13 }}>PLATE 03</span>',
      '    <span style={{ fontSize: 18 }}>Badge OK</span>',
      '  </div>',
      ');',
    ].join('\n'),
    'MicroType.tsx'
  );
  assert.equal(fontViolations.length, 1);
  assert.equal(fontViolations[0]!.code, 'FONT_BELOW_1080P_FLOOR');
  assert.equal(fontViolations[0]!.line, 3);

  const subViewTsxViolations = scanTsxForExcessiveSubViews(
    [
      'export const TooManySubViews = () => (',
      '  <div>',
      '    <SceneSubViewDissolve firstView={<div/>} secondView={<div/>} switchAtFrame={120} />',
      '    <SceneSubViewDissolve firstView={<div/>} secondView={<div/>} switchAtFrame={240} />',
      '  </div>',
      ');',
    ].join('\n'),
    'TooManySubViews.tsx'
  );
  assert.equal(subViewTsxViolations.length, 1);
  assert.equal(subViewTsxViolations[0]!.code, 'EXCESSIVE_SUBVIEWS');

  const tightCapsule = makeTempVideoProject(
    {
      'audio.json': JSON.stringify({
        id: 'tight-film',
        title: 'Tight Pacing',
        fps: 60,
        scenes: [
          { id: 's1', durationInSeconds: 3.0, text: 'Krótka pierwsza myśl.' },
          { id: 's2', durationInSeconds: 3.5, text: 'Krótka druga myśl na finał.' },
        ],
      }),
      'generated/audio-manifest.ts': `export const VOICEOVER_MANIFEST = ${JSON.stringify({
        s1: { sceneId: 's1', durationInSeconds: 3.0, fps: 60 },
        s2: { sceneId: 's2', durationInSeconds: 3.5, fps: 60 },
      })};\n`,
      'TightFilm.tsx': [
        "import React from 'react';",
        "import { ContinuousSceneFlow } from '@make-pictures/remotion';",
        'export const TightFilm = () => (',
        '  <ContinuousSceneFlow scenes={[',
        "    { id: 's1', durationInFrames: 300, render: () => <div>A</div> },",
        "    { id: 's2', durationInFrames: 360, render: () => <div>B</div> },",
        '  ]} />',
        ');',
      ].join('\n'),
    },
    'tight-film'
  );

  try {
    const res = auditCompositionDirection({
      studioDir: tightCapsule.studioDir,
      compositionId: 'TightFilm',
      origin: 'production',
      capsuleDir: tightCapsule.videoDir,
      durationInFrames: 660,
      fps: 60,
      allowFastCuts: true,
      sceneTimeline: [
        {
          sceneId: 's1',
          fromFrame: 18,
          durationInFrames: 180,
          subViews: [
            { id: 'a', fromOffsetFrames: 0 },
            { id: 'b', fromOffsetFrames: 100 },
            { id: 'c', fromOffsetFrames: 200 },
          ],
        },
        { sceneId: 's2', fromFrame: 342, durationInFrames: 210 },
      ],
    });
    const codes = res.violations.map((v) => v.code);
    assert.ok(codes.includes('EXCESSIVE_SUBVIEWS'));
    const breathingViolations = res.violations.filter(
      (v) => v.code === 'INSUFFICIENT_BREATHING_ROOM'
    );
    assert.equal(
      breathingViolations.length,
      2,
      `Expected both s1 pre<36f and s2 outro<132f violations, got ${JSON.stringify(breathingViolations)}`
    );
  } finally {
    tightCapsule.cleanup();
  }

  assert.equal(typeof auditRenderedFrameDomInPage, 'function');
  assert.equal(typeof auditFrameZeroDomInPage, 'function');
});

test('JSX scanner preserves 1:1 UTF-16 offsets across emojis & nested templates, ignores JSX text apostrophes, and recognizes computeSceneTimingFromVoiceover', () => {
  const complexTsx = [
    "import React from 'react';",
    'const badge = `🎨 Styl: ${true ? `wewnętrzny ✅` : "brak"}`;',
    'export const ApostropheScene: React.FC<{ title: string }> = () => (',
    '  <div>',
    "    <h1>It's User's Studio — zero fałszywych cudzysłowów</h1>",
    '    {/* <img src="commented-out.png" /> fontSize: 11 */}',
    '    // fontSize: 12 inside JSX text is plain copy, not a style object',
    '    <img src="actual-raw-tag.png" alt={`🔍 ${"ikona"}`} />',
    '  </div>',
    ');',
  ].join('\n');

  const rawImgHits = scanTsxForRawHtmlImgTags(complexTsx, 'ApostropheScene.tsx');
  assert.equal(
    rawImgHits.length,
    1,
    `Expected 1 raw <img> hit despite preceding JSX apostrophe & emojis, got ${JSON.stringify(rawImgHits)}`
  );
  assert.equal(rawImgHits[0]!.line, 8);
  assert.match(rawImgHits[0]!.snippet ?? '', /^<img src="actual-raw-tag\.png"/);
  assert.equal(scanTsxForSmallFontSizes(complexTsx, 'ApostropheScene.tsx').length, 0);

  const computedTimingTsx = [
    "import React from 'react';",
    "import { ContinuousSceneFlow, computeSceneTimingFromVoiceover } from '@make-pictures/remotion';",
    'const t1 = computeSceneTimingFromVoiceover(3.2);',
    'const t2 = computeSceneTimingFromVoiceover(3.6, { isFinalScene: true });',
    'export const CalmTwoScene = () => (',
    '  <ContinuousSceneFlow scenes={[',
    "    { id: 's1', durationInFrames: t1.durationInFrames, render: () => <WordByWordStage words={[]} /> },",
    "    { id: 's2', durationInFrames: t2.durationInFrames, render: () => <StoryCard2D title=\"Tytuł\" /> },",
    '  ]} />',
    ');',
  ].join('\n');
  assert.deepEqual(
    scanTsxForCompetingFocalPoints(computedTimingTsx, 'CalmTwoScene.tsx'),
    []
  );
});
