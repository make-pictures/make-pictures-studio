import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BUILTIN_EXAMPLE_PRODUCTIONS } from '../../../examples';
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
  parseStaticProductionHintFromDisk,
  resolveQaGridDimensions,
  selectQaSampleFrames,
} from '../src/commands/qa-contact-sheet';
import { runCli } from '../src/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function makeTempCapsule(
  files: Record<string, string>,
  slug = 'test-film'
): { studioDir: string; capsuleDir: string; cleanup: () => void } {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-director-qa-'));
  const capsuleDir = path.join(studioDir, 'productions', slug);
  fs.mkdirSync(path.join(capsuleDir, 'compositions'), { recursive: true });

  for (const [relPath, content] of Object.entries(files)) {
    const absPath = path.join(capsuleDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf8');
  }

  return {
    studioDir,
    capsuleDir,
    cleanup: () => fs.rmSync(studioDir, { recursive: true, force: true }),
  };
}

test('Rule 1 (MIN_SCENE_SPAN): rejects short sceneTimeline spans (< 270f) and short visual <Sequence> tags while ignoring layout="none" audio sequences', () => {
  const { studioDir, cleanup } = makeTempCapsule({
    'compositions/FastCutFilm.props.json': JSON.stringify({
      styleId: 'minimal-product',
    }),
    'compositions/FastCutFilm.tsx': [
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
          propsFile: 'productions/test-film/compositions/FastCutFilm.props.json',
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
        // Must flag both the 174f sceneTimeline visual span and the 174f visual <Sequence>,
        // while NOT flagging the 42f layout="none" audio sequence or the commented sequence
        const minSpanViolations = err.violations.filter(
          (v) => v.code === 'MIN_SCENE_SPAN'
        );
        assert.equal(minSpanViolations.length, 2);
        assert.match(err.message, /ContinuousSceneFlow/);
        return true;
      }
    );

    // With allowFastCuts: true, returns result with violations instead of throwing
    const softResult: DirectorAuditResult = auditCompositionDirection({
      studioDir,
      compositionId: 'FastCutFilm',
      origin: 'production',
      propsFile: 'productions/test-film/compositions/FastCutFilm.props.json',
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
    const { studioDir, cleanup } = makeTempCapsule({
      'compositions/BusyFocal.props.json': '{}',
      'compositions/BusyFocal.tsx': [
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
            propsFile: 'productions/test-film/compositions/BusyFocal.props.json',
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
  const separated = makeTempCapsule({
    'compositions/CalmKinetic.props.json': '{}',
    'compositions/CalmKinetic.tsx': [
      "import React from 'react';",
      "import { ContinuousSceneFlow } from '@make-pictures/core';",
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
      propsFile: 'productions/test-film/compositions/CalmKinetic.props.json',
      durationInFrames: 720,
      fps: 60,
    });
    assert.equal(res.ok, true);
    assert.equal(res.violations.length, 0);
  } finally {
    separated.cleanup();
  }
});

test('Rule 2B (Reading Cadence & Breathing Room): rejects > 2.8 spoken words/s or < 36 frames of breathing room in production.json', () => {
  const { studioDir, cleanup } = makeTempCapsule({
    'production.json': JSON.stringify({
      id: 'test-film',
      title: 'Overstuffed Script',
      fps: 60,
      scenes: [
        {
          id: 's1',
          durationInSeconds: 4.5,
          // 19 words in a 5.0s (300f) visual span = 3.8 words/s (> 2.8)
          text: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen.',
        },
        {
          id: 's2',
          durationInSeconds: 5.8,
          // 8 words in a 6.0s (360f) visual span = 1.33 words/s, BUT spoken frames = 348 -> 360 - 348 = 12f (< 36f breathing room!)
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
    'compositions/Overstuffed.props.json': '{}',
    'compositions/Overstuffed.tsx':
      'export const Overstuffed = () => <div>Calm visual</div>;\n',
  });

  try {
    assert.throws(
      () =>
        auditCompositionDirection({
          studioDir,
          compositionId: 'Overstuffed',
          origin: 'production',
          propsFile: 'productions/test-film/compositions/Overstuffed.props.json',
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
  const { studioDir, cleanup } = makeTempCapsule({
    'compositions/ChoppyTransitions.props.json': '{}',
    'compositions/ChoppyTransitions.tsx': [
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
          propsFile:
            'productions/test-film/compositions/ChoppyTransitions.props.json',
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
  const unclipped = makeTempCapsule({
    'compositions/LeakyNode.props.json': '{}',
    'compositions/LeakyNode.tsx': [
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
          propsFile: 'productions/test-film/compositions/LeakyNode.props.json',
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

  const clipped = makeTempCapsule({
    'compositions/CleanNode.props.json': '{}',
    'compositions/CleanNode.tsx': [
      "import React from 'react';",
      "import { ClippedSurfaceChrome } from '@make-pictures/core';",
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
      propsFile: 'productions/test-film/compositions/CleanNode.props.json',
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

    // A single 1x1 pixel dot on a 1920x1080 canvas MUST be caught by full-resolution variance check
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

test('Well-paced <ContinuousSceneFlow> production passes cleanly, and capsule scoping ignores unrelated sibling capsules', () => {
  const { studioDir, cleanup } = makeTempCapsule(
    {
      'production.json': JSON.stringify({
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
      'compositions/CalmShowreel.props.json': JSON.stringify({
        styleId: 'editorial-press',
      }),
      'compositions/CalmShowreel.tsx': [
        "import React from 'react';",
        "import { ContinuousSceneFlow, StyleProvider } from '@make-pictures/core';",
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
    // Plant a broken sibling capsule in the same studioDir to verify strict capsule scoping
    const brokenSiblingDir = path.join(
      studioDir,
      'productions',
      'broken-sibling',
      'compositions'
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
      propsFile:
        'productions/calm-showreel/compositions/CalmShowreel.props.json',
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

test('All existing built-in examples/* compositions pass auditCompositionDirection cleanly', () => {
  const allExampleEntries = BUILTIN_EXAMPLE_PRODUCTIONS.flatMap((prod) =>
    prod.compositions.map((comp) => ({
      ...comp,
      origin: comp.origin ?? prod.origin ?? 'example',
      voiceoverManifest: prod.voiceoverManifest,
    }))
  );

  assert.ok(
    allExampleEntries.length >= 7,
    `Expected at least 7 built-in example compositions, found ${allExampleEntries.length}`
  );

  for (const entry of allExampleEntries) {
    const res = auditCompositionDirection({
      studioDir: MONOREPO_ROOT,
      rootDir: MONOREPO_ROOT,
      compositionId: entry.id,
      origin: entry.origin,
      propsFile: entry.propsFile,
      durationInFrames: entry.durationInFrames,
      fps: entry.fps,
      sceneTimeline: entry.sceneTimeline,
      voiceoverManifest: entry.voiceoverManifest,
    });
    assert.equal(
      res.ok,
      true,
      `Expected built-in example "${entry.id}" to pass cleanly, got violations: ${JSON.stringify(res.violations)}`
    );
    assert.equal(res.violations.length, 0);
  }
});

test('CLI wires --allow-fast-cuts boolean flag into runQaContactSheetCommand and documents Director Gate in canonical skills', () => {
  const cliIndexSrc = fs.readFileSync(
    path.join(MONOREPO_ROOT, 'packages', 'cli', 'src', 'index.ts'),
    'utf8'
  );
  assert.match(cliIndexSrc, /'allow-fast-cuts'/);
  assert.match(cliIndexSrc, /allowFastCuts/);

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
  assert.match(qaSrc, /allowFastCuts/);

  for (const skillName of [
    'make-pictures-director',
    'style-and-art-direction',
    'cinematography-and-vfx',
  ]) {
    const skillMd = fs.readFileSync(
      path.join(
        MONOREPO_ROOT,
        '.agents',
        'plugins',
        'make-pictures',
        'skills',
        skillName,
        'SKILL.md'
      ),
      'utf8'
    );
    assert.match(
      skillMd,
      /ContinuousSceneFlow|interpolateStylePresets|atelier/,
      `Expected ${skillName}/SKILL.md to document Stage 1 Director DNA & Artistic Worlds`
    );
  }
});

test('End-to-end runCli(["qa", ...]) fast-fails with DirectorAuditError before Remotion bundling when a production violates pacing rules', async () => {
  const { studioDir, cleanup } = makeTempCapsule(
    {
      'production.json': JSON.stringify({
        id: 'rush-cut',
        title: 'Rush Cut',
        fps: 60,
        scenes: [
          { id: 's1', durationInSeconds: 2.9, text: 'Too short opening cut.' },
          { id: 's2', durationInSeconds: 5.0, text: 'Second calm scene.' },
        ],
      }),
      'index.ts': [
        'export default {',
        "  id: 'rush-cut',",
        "  origin: 'production',",
        '  compositions: [',
        '    {',
        "      id: 'RushCut',",
        '      fps: 60,',
        '      width: 1920,',
        '      height: 1080,',
        '      durationInFrames: 600,',
        '      usesThree: false,',
        "      propsFile: 'productions/rush-cut/compositions/RushCut.props.json',",
        '      sceneTimeline: [',
        "        { sceneId: 's1', fromFrame: 0, durationInFrames: 174 },",
        "        { sceneId: 's2', fromFrame: 174, durationInFrames: 300 },",
        '      ],',
        '      component: () => null,',
        '      defaultProps: {},',
        '    },',
        '  ],',
        '};',
      ].join('\n'),
      'compositions/RushCut.props.json': '{}',
      'compositions/RushCut.tsx': [
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

  // Every scene in the 5-scene timeline has a settled frame well past its entrance spring
  for (const seg of nominal5Scenes) {
    assert.ok(
      samples5.some(
        (f) =>
          f >= seg.fromFrame + 54 && f < seg.fromFrame + seg.durationInFrames
      ),
      `Expected settled sample inside scene ${seg.sceneId}`
    );
  }

  // 9-scene film with 2 dual sub-view scenes (A -> B): mandatory points > 12 -> auto-grid expands to 4x4!
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
  // 1 (f=0) + 7 single scenes + 4 sub-views + 1 (end settle) = 13 mandatory frames -> 4x4 (16 tiles)!
  const autoSamples = selectQaSampleFrames(3440, undefined, nineSceneWithSubViews);
  const autoGrid = resolveQaGridDimensions(undefined, autoSamples.length);
  assert.equal(autoGrid.cols, 4);
  assert.equal(autoGrid.rows, 4);
  assert.equal(autoSamples.length, 16);
  assert.equal(autoSamples[0], 0);

  // Verify 100% presence of EVERY scene and EVERY sub-view
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
  // 1. RAW_HTML_IMG_TAG catches lowercase <img> while ignoring <Img> and commented/stringified <img>
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

  // 2. Static FONT_BELOW_1080P_FLOOR catches fontSize: 10..17 while allowing >= 18
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

  // 3. EXCESSIVE_SUBVIEWS catches > 2 subViews on sceneTimeline or multiple SceneSubViewDissolve in one scene
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

  // 4. Expanded INSUFFICIENT_BREATHING_ROOM (pre < 36f, post < 90f, outro < 132f) + EXCESSIVE_SUBVIEWS via auditCompositionDirection
  const tightCapsule = makeTempCapsule({
    'production.json': JSON.stringify({
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
    'compositions/TightFilm.props.json': '{}',
    'compositions/TightFilm.tsx': [
      "import React from 'react';",
      "import { ContinuousSceneFlow } from '@make-pictures/core';",
      'export const TightFilm = () => (',
      '  <ContinuousSceneFlow scenes={[',
      "    { id: 's1', durationInFrames: 300, render: () => <div>A</div> },",
      "    { id: 's2', durationInFrames: 360, render: () => <div>B</div> },",
      '  ]} />',
      ');',
    ].join('\n'),
  }, 'tight-film');

  try {
    const res = auditCompositionDirection({
      studioDir: tightCapsule.studioDir,
      compositionId: 'TightFilm',
      origin: 'production',
      propsFile: 'productions/tight-film/compositions/TightFilm.props.json',
      durationInFrames: 660,
      fps: 60,
      allowFastCuts: true,
      sceneTimeline: [
        // s1 (0..300): pre=18 (< 36!), spoken=180 -> post=102 (>= 90), 3 subViews (> 2!)
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
        // s2 (300..660, final): pre=42 (>= 36), spoken=210 -> outro=660-(342+210)=108 (< 132!)
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

  // 5. Verify DOM evaluator functions are self-contained functions ready for Chromium page.evaluate
  assert.equal(typeof auditRenderedFrameDomInPage, 'function');
  assert.equal(typeof auditFrameZeroDomInPage, 'function');
});

test('JSX scanner preserves 1:1 UTF-16 offsets across emojis & nested templates, ignores JSX text apostrophes, and parseStaticProductionHintFromDisk preserves subViews across multi-composition capsules', () => {
  // 1. Apostrophes in JSX copy ("It's", "User's") + emojis ("🎨🔍") + nested `${...}` template literals
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

  // 2. computeSceneTimingFromVoiceover(...) recognized as >= 270f scene separation in scanTsxForCompetingFocalPoints
  const computedTimingTsx = [
    "import React from 'react';",
    "import { ContinuousSceneFlow, computeSceneTimingFromVoiceover } from '@make-pictures/core';",
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

  // 3. parseStaticProductionHintFromDisk parses nested subViews without truncating sceneTimeline and scopes durationInFrames per compositionId
  const multiCompCapsule = makeTempCapsule(
    {
      'index.ts': [
        "import { defineProduction } from '@make-pictures/core';",
        'export default defineProduction({',
        "  id: 'multi-subview',",
        '  compositions: [',
        '    {',
        "      id: 'TeaserShort',",
        '      fps: 60,',
        '      width: 1080,',
        '      height: 1920,',
        '      durationInFrames: 300,',
        '      usesThree: false,',
        "      propsFile: 'productions/multi-subview/compositions/TeaserShort.props.json',",
        "      sceneTimeline: [{ sceneId: 't1', fromFrame: 42, durationInFrames: 168 }],",
        '    },',
        '    {',
        "      id: 'FullMainFilm',",
        '      fps: 60,',
        '      width: 1920,',
        '      height: 1080,',
        '      durationInFrames: 1140,',
        '      usesThree: true,',
        "      propsFile: 'productions/multi-subview/compositions/FullMainFilm.props.json',",
        '      sceneTimeline: [',
        "        { sceneId: 's1', fromFrame: 42, durationInFrames: 180 },",
        '        {',
        "          sceneId: 's2',",
        '          fromFrame: 402,',
        '          durationInFrames: 240,',
        '          subViews: [',
        "            { id: 'overview', fromOffsetFrames: 0 },",
        "            { id: 'closeup', fromOffsetFrames: 190 },",
        '          ],',
        '        },',
        "        { sceneId: 's3', fromFrame: 822, durationInFrames: 180 },",
        '      ],',
        '    },',
        '  ],',
        '});',
      ].join('\n'),
    },
    'multi-subview'
  );

  try {
    const parsed = parseStaticProductionHintFromDisk(
      multiCompCapsule.studioDir,
      'multi-subview',
      'FullMainFilm'
    );
    assert.ok(parsed);
    assert.equal(parsed.durationInFrames, 1140);
    assert.equal(parsed.usesThree, true);
    assert.equal(parsed.sceneTimeline?.length, 3);
    assert.equal(parsed.sceneTimeline?.[1]?.sceneId, 's2');
    assert.deepEqual(parsed.sceneTimeline?.[1]?.subViews, [
      { id: 'overview', fromOffsetFrames: 0 },
      { id: 'closeup', fromOffsetFrames: 190 },
    ]);
    assert.equal(parsed.sceneTimeline?.[2]?.sceneId, 's3');
  } finally {
    multiCompCapsule.cleanup();
  }
});
