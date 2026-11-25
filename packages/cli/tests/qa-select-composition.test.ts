import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  discoverNeighborAudioManifest,
  resolveCompositionSourceFromRoot,
  runQaContactSheetCommand,
} from '../src/commands/qa-contact-sheet';
import {
  DirectorAuditError,
  auditCompositionDirection,
} from '../src/director/audit-direction';

test('resolveCompositionSourceFromRoot locates component file from standard src/Root.tsx and discovers neighbor audio manifest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-qa-root-'));
  try {
    fs.mkdirSync(path.join(dir, 'src', 'videos', 'demo'), { recursive: true });
    const compFile = path.join(dir, 'src', 'videos', 'demo', 'DemoComp.tsx');
    fs.writeFileSync(compFile, 'export const DemoComp = () => null;\n');
    const rootFile = path.join(dir, 'src', 'Root.tsx');
    fs.writeFileSync(
      rootFile,
      `import { Composition } from 'remotion';
import { DemoComp } from './videos/demo/DemoComp';
export const RemotionRoot = () => (
  <Composition id="DemoVideo" component={DemoComp} durationInFrames={300} fps={60} width={1920} height={1080} />
);
`
    );

    const resolved = resolveCompositionSourceFromRoot(rootFile, 'DemoVideo');
    assert.equal(resolved, compFile);
    assert.equal(discoverNeighborAudioManifest(compFile), null);

    const audioFile = path.join(dir, 'src', 'videos', 'demo', 'audio.json');
    fs.writeFileSync(audioFile, JSON.stringify({ id: 'demo', scenes: [] }));
    assert.equal(discoverNeighborAudioManifest(compFile), audioFile);

    // generated/audio-manifest.ts takes precedence over audio.json when present
    const genDir = path.join(dir, 'src', 'videos', 'demo', 'generated');
    fs.mkdirSync(genDir, { recursive: true });
    const genManifest = path.join(genDir, 'audio-manifest.ts');
    fs.writeFileSync(genManifest, 'export const VOICEOVER_MANIFEST = {};\n');
    assert.equal(discoverNeighborAudioManifest(compFile), genManifest);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveCompositionSourceFromRoot handles default imports, aliased imports, multiline <Composition>, and returns null for unknown IDs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-qa-root-variants-'));
  try {
    fs.mkdirSync(path.join(dir, 'src', 'compositions'), { recursive: true });
    const defaultComp = path.join(dir, 'src', 'compositions', 'DefaultComp.tsx');
    const aliasedComp = path.join(dir, 'src', 'compositions', 'AliasedComp.tsx');
    fs.writeFileSync(defaultComp, 'export default () => null;\n');
    fs.writeFileSync(aliasedComp, 'export const OriginalComp = () => null;\n');

    const rootFile = path.join(dir, 'src', 'Root.tsx');
    fs.writeFileSync(
      rootFile,
      `import React from 'react';
import { Composition } from 'remotion';
import MyDefault from './compositions/DefaultComp';
import { OriginalComp as RenamedComp } from './compositions/AliasedComp';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      component={MyDefault}
      id="DefaultVideo"
      durationInFrames={360}
      fps={60}
      width={1920}
      height={1080}
    />
    <Composition
      id='AliasedVideo'
      component={RenamedComp}
      durationInFrames={360}
      fps={60}
      width={1920}
      height={1080}
    />
  </>
);
`
    );

    assert.equal(
      resolveCompositionSourceFromRoot(rootFile, 'DefaultVideo'),
      defaultComp
    );
    assert.equal(
      resolveCompositionSourceFromRoot(rootFile, 'AliasedVideo'),
      aliasedComp
    );
    assert.equal(
      resolveCompositionSourceFromRoot(rootFile, 'MissingComp'),
      null
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('standard Remotion project without audio manifest runs AST/JSX audit cleanly and fails fast on missing remotion packages', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-qa-std-remotion-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'src', 'index.ts'),
      "import { registerRoot } from 'remotion';\nimport { RemotionRoot } from './Root';\nregisterRoot(RemotionRoot);\n"
    );
    const compFile = path.join(dir, 'src', 'PlainComp.tsx');
    fs.writeFileSync(
      compFile,
      `import React from 'react';
import { AbsoluteFill } from 'remotion';
export const PlainComp: React.FC = () => (
  <AbsoluteFill>
    <img src="raw-bad.png" />
  </AbsoluteFill>
);
`
    );
    fs.writeFileSync(
      path.join(dir, 'src', 'Root.tsx'),
      `import { Composition } from 'remotion';
import { PlainComp } from './PlainComp';
export const RemotionRoot = () => (
  <Composition id="PlainComp" component={PlainComp} durationInFrames={300} fps={60} width={1920} height={1080} />
);
`
    );

    // 1. Direct audit on a plain Remotion project with zero audio.json catches RAW_HTML_IMG_TAG without crashing
    assert.throws(
      () =>
        auditCompositionDirection({
          studioDir: dir,
          rootDir: dir,
          compositionId: 'PlainComp',
          sourceFile: compFile,
          durationInFrames: 300,
          fps: 60,
        }),
      (err: unknown) => {
        assert.ok(err instanceof DirectorAuditError);
        assert.ok(err.violations.some((v) => v.code === 'RAW_HTML_IMG_TAG'));
        return true;
      }
    );

    // 2. End-to-end runQaContactSheetCommand fast-fails with DirectorAuditError BEFORE requiring Remotion bundling
    await assert.rejects(
      () =>
        runQaContactSheetCommand({
          cwd: dir,
          compositionId: 'PlainComp',
        }),
      (err: unknown) => {
        assert.ok(err instanceof DirectorAuditError);
        assert.ok(err.violations.some((v) => v.code === 'RAW_HTML_IMG_TAG'));
        return true;
      }
    );

    // 3. Fix PlainComp to be clean -> now fails fast with actionable missing Remotion package message (since temp dir has no node_modules)
    fs.writeFileSync(
      compFile,
      `import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
export const PlainComp: React.FC = () => (
  <AbsoluteFill>
    <Img src="good.png" />
  </AbsoluteFill>
);
`
    );
    await assert.rejects(
      () =>
        runQaContactSheetCommand({
          cwd: dir,
          compositionId: 'PlainComp',
        }),
      /Missing required Remotion package|npm install/i
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
