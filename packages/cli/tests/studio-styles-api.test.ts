import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StylePresetSchema,
  type BuiltinVisualKitId,
  type StylePreset,
} from '../../core/src/index';
import {
  makePicturesStudioServerPlugin,
  readCustomStylesFromDisk,
  saveCustomStyleToDisk,
} from '../../studio/src/server/index';
import {
  STYLE_LAB_DURATION_IN_FRAMES,
  STYLE_LAB_FPS,
  STYLE_LAB_KITS,
  StudioApp,
  StyleCatalogSidebar,
  StyleLabPreviewComposition,
  StyleLabShowcase,
  Topbar,
  introspectZodObject,
} from '../../studio/src/client/index';

test('saveCustomStyleToDisk rejects path traversal, built-in ID overwrite, and invalid Zod payloads', () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-studio-styles-'));
  try {
    for (const badSlug of ['../escape', 'nested/slug', 'UpperSlug', '-leading', '']) {
      const res = saveCustomStyleToDisk(studioDir, {
        slug: badSlug,
        style: { ...BUILT_IN_STYLES['minimal-product'], id: 'escape' },
      });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.ok, false);
    }

    for (const reservedId of BUILT_IN_STYLE_IDS) {
      const reserved = saveCustomStyleToDisk(studioDir, {
        slug: reservedId,
        style: BUILT_IN_STYLES[reservedId],
      });
      assert.equal(reserved.statusCode, 400);
      assert.equal(reserved.body.ok, false);
    }

    const badSchema = saveCustomStyleToDisk(studioDir, {
      slug: 'broken-style',
      style: { id: 'broken-style', name: 'Broken' },
    });
    assert.equal(badSchema.statusCode, 400);
    assert.equal(badSchema.body.ok, false);

    const validPreset = {
      ...BUILT_IN_STYLES['editorial-press'],
      id: 'gazeta-poranna',
      name: 'Gazeta Poranna',
    };
    const saved = saveCustomStyleToDisk(studioDir, {
      slug: 'gazeta-poranna',
      style: validPreset,
    });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.ok, true);
    assert.equal(
      fs.existsSync(path.join(studioDir, 'styles', 'gazeta-poranna.style.json')),
      true
    );

    const onDisk = readCustomStylesFromDisk(studioDir);
    assert.equal(onDisk.ok, true);
    assert.equal(onDisk.warnings.length, 0);
    assert.equal(onDisk.styles.length, 1);
    assert.equal(onDisk.styles[0]?.id, 'gazeta-poranna');
    assert.equal(onDisk.styles[0]?.name, 'Gazeta Poranna');
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});

test('readCustomStylesFromDisk gracefully skips malformed or reserved style files with warnings', () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-studio-styles-warn-'));
  try {
    const emptyRead = readCustomStylesFromDisk(studioDir);
    assert.deepEqual(emptyRead, { ok: true, styles: [], warnings: [] });

    const stylesDir = path.join(studioDir, 'styles');
    fs.mkdirSync(stylesDir, { recursive: true });

    fs.writeFileSync(path.join(stylesDir, 'bad-json.style.json'), '{not-json', 'utf8');
    fs.writeFileSync(
      path.join(stylesDir, 'minimal-product.style.json'),
      JSON.stringify(BUILT_IN_STYLES['minimal-product']),
      'utf8'
    );
    fs.writeFileSync(
      path.join(stylesDir, 'kronika-neapolu.style.json'),
      JSON.stringify({
        ...BUILT_IN_STYLES['archival-chronicle'],
        id: 'kronika-neapolu',
        name: 'Kronika Neapolu',
      }),
      'utf8'
    );

    const result = readCustomStylesFromDisk(studioDir);
    assert.equal(result.ok, true);
    assert.equal(result.styles.length, 1);
    assert.equal(result.styles[0]?.id, 'kronika-neapolu');
    assert.equal(result.warnings.length, 2);
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});

test('makePicturesStudioServerPlugin serves GET and POST /api/studio/styles', async () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-studio-http-'));
  try {
    const plugin = makePicturesStudioServerPlugin({
      rootDir: studioDir,
      studioDir,
    });

    type MiddlewareFn = (
      req: IncomingMessage,
      res: ServerResponse,
      next: (err?: unknown) => void
    ) => void;
    let middleware: MiddlewareFn | null = null;

    const fakeServer = {
      middlewares: {
        use(fn: MiddlewareFn) {
          middleware = fn;
        },
      },
    };
    const hook = plugin.configureServer;
    if (typeof hook === 'function') {
      (hook as (server: unknown) => void)(fakeServer);
    } else if (hook && typeof hook === 'object' && 'handler' in hook) {
      (hook.handler as (server: unknown) => void)(fakeServer);
    }
    assert.ok(middleware, 'Expected server middleware to be registered');

    const invokeHttp = (
      method: string,
      url: string,
      bodyObj?: Record<string, unknown>
    ): Promise<{ statusCode: number; json: Record<string, unknown> }> =>
      new Promise((resolve, reject) => {
        const reqEmitter = new EventEmitter() as IncomingMessage;
        reqEmitter.method = method;
        reqEmitter.url = url;

        let chunks = '';
        const mockRes = {
          statusCode: 200,
          writableEnded: false,
          setHeader() {},
          end(payload?: string) {
            mockRes.writableEnded = true;
            if (payload) chunks += payload;
            try {
              resolve({
                statusCode: mockRes.statusCode,
                json: JSON.parse(chunks) as Record<string, unknown>,
              });
            } catch (err) {
              reject(err);
            }
          },
        };
        const res = mockRes as unknown as ServerResponse;

        middleware!(reqEmitter, res, (err) => {
          reject(err ?? new Error('Unexpected next() call'));
        });

        if (bodyObj !== undefined) {
          reqEmitter.emit('data', Buffer.from(JSON.stringify(bodyObj), 'utf8'));
        }
        reqEmitter.emit('end');
      });

    const initialGet = await invokeHttp('GET', '/api/studio/styles');
    assert.equal(initialGet.statusCode, 200);
    assert.equal(initialGet.json.ok, true);
    assert.deepEqual(initialGet.json.styles, []);

    const blockedPost = await invokeHttp('POST', '/api/studio/styles', {
      slug: 'brutalist-poster',
      style: BUILT_IN_STYLES['brutalist-poster'],
    });
    assert.equal(blockedPost.statusCode, 400);
    assert.equal(blockedPost.json.ok, false);

    const okPost = await invokeHttp('POST', '/api/studio/styles', {
      slug: 'marka-saas',
      style: {
        ...BUILT_IN_STYLES['minimal-product'],
        id: 'marka-saas',
        name: 'Marka SaaS',
      },
    });
    assert.equal(okPost.statusCode, 200);
    assert.equal(okPost.json.ok, true);

    const afterGet = await invokeHttp('GET', '/api/studio/styles');
    assert.equal(afterGet.statusCode, 200);
    assert.equal((afterGet.json.styles as Array<{ id: string }>).length, 1);
    assert.equal((afterGet.json.styles as Array<{ id: string }>)[0]?.id, 'marka-saas');
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});

test('StudioApp empty state and Style Lab UI components export and render neutral copy + view switcher', () => {
  assert.equal(typeof StyleCatalogSidebar, 'function');
  assert.equal(typeof StyleLabShowcase, 'function');
  assert.equal(typeof Topbar, 'function');

  const emptyMarkup = renderToStaticMarkup(
    React.createElement(StudioApp, { compositions: [] })
  );
  assert.match(emptyMarkup, /npx make-pictures new moj-pierwszy-film/);
  assert.doesNotMatch(emptyMarkup, /--kit=paper-diorama-3d/);
  assert.match(emptyMarkup, /Otwórz Style Lab \(podgląd stylów 60 FPS\)/);
  assert.match(emptyMarkup, /Style Lab/);
  assert.match(emptyMarkup, /Filmy/);
});

test('StyleCatalogSidebar, STYLE_LAB_KITS, and PropsInspector Zod introspection cover all 7 styles and 7 kits', () => {
  assert.equal(STYLE_LAB_DURATION_IN_FRAMES, 300);
  assert.equal(STYLE_LAB_FPS, 60);
  assert.deepEqual(
    STYLE_LAB_KITS.map((k) => k.id),
    [
      'editorial-collage',
      'vector-scene-2d',
      'kinetic-typography',
      'data-storytelling',
      'motion-diagrams-2d',
      'paper-diorama-3d',
      'isometric-3d',
    ]
  );

  const builtIns = BUILT_IN_STYLE_IDS.map((id) => BUILT_IN_STYLES[id]);
  const customSample = {
    ...BUILT_IN_STYLES['archival-chronicle'],
    id: 'kronika-pizzy',
    name: 'Kronika Pizzy',
  };

  const sidebarMarkup = renderToStaticMarkup(
    React.createElement(StyleCatalogSidebar, {
      builtInStyles: builtIns,
      customStyles: [customSample],
      activeStyleId: 'kronika-pizzy',
      activeStyle: customSample,
      onSelectStyle: () => {},
      onDuplicateAsCustom: () => {},
    })
  );
  assert.match(sidebarMarkup, /Style wbudowane \(7\)/);
  assert.match(sidebarMarkup, /Twoje style \(styles\/\*\.style\.json\)/);
  assert.match(sidebarMarkup, /Kronika Pizzy/);
  assert.match(sidebarMarkup, /Playfair Display \+ DM Sans/);
  assert.match(sidebarMarkup, /\+ Duplikuj jako własny styl/);

  const sections = introspectZodObject(
    StylePresetSchema,
    BUILT_IN_STYLES['editorial-press'] as unknown as Record<string, unknown>
  );
  const sectionTitles = sections.map((s) => s.title);
  assert.deepEqual(sectionTitles, [
    'Informacje',
    'Paleta kolorów',
    'Typografia',
    'Powierzchnia & Tło',
    'Fizyka ruchu',
    'Optyka & Światło',
    'Domyślne Audio',
  ]);
  const colorFields = sections
    .find((s) => s.title === 'Paleta kolorów')
    ?.fields.filter((f) => f.kind === 'color');
  assert.equal(colorFields?.length, 8);

  const opticsFields = sections.find((s) => s.title === 'Optyka & Światło')?.fields;
  assert.equal(opticsFields?.length, 5);
  assert.deepEqual(
    opticsFields?.map((f) => `${f.key}:${f.kind}`),
    [
      'optics.lightingRig:enum',
      'optics.typographyGrammar:enum',
      'optics.lightAngleDeg:range',
      'optics.aperture:range',
      'optics.halation:range',
    ]
  );
});

test('StyleLabPreviewComposition renders live 60 FPS optical lighting, editorial mounts, and polymorphic kinetic grammars with clean Frame 0', () => {
  const renderStyleLabFrame = (
    style: StylePreset,
    kit: BuiltinVisualKitId,
    frameToDisplay: number,
    compositionWidth = 1080,
    compositionHeight = 1920
  ): string => {
    const BoundPreview: React.FC = () =>
      React.createElement(StyleLabPreviewComposition, { style, kit });
    return renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: BoundPreview,
        compositionWidth,
        compositionHeight,
        durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
        fps: STYLE_LAB_FPS,
        frameToDisplay,
      })
    );
  };

  const cases = [
    {
      styleId: 'editorial-press',
      expectedRig: 'window-gobo',
      expectedMount: 'archival-tape',
      expectedGrammar: 'swiss-spatial',
    },
    {
      styleId: 'archival-chronicle',
      expectedRig: 'window-gobo',
      expectedMount: 'photo-corners',
      expectedGrammar: 'swiss-spatial',
    },
    {
      styleId: 'cyber-telemetry',
      expectedRig: 'darkroom-halation',
      expectedMount: 'slide-mount',
      expectedGrammar: 'optical-gate',
    },
    {
      styleId: 'brutalist-poster',
      expectedRig: 'darkroom-halation',
      expectedMount: 'slide-mount',
      expectedGrammar: 'risograph-poster',
    },
    {
      styleId: 'minimal-product',
      expectedRig: 'studio-macro',
      expectedMount: 'none',
      expectedGrammar: 'swiss-spatial',
    },
  ] as const;

  for (const { styleId, expectedRig, expectedMount, expectedGrammar } of cases) {
    const preset = BUILT_IN_STYLES[styleId];

    // 1. Editorial Collage in Style Lab: Frame 0 must be pure bgCanvas
    const editorialFrame0 = renderStyleLabFrame(preset, 'editorial-collage', 0);
    assert.doesNotMatch(editorialFrame0, /ROZDZIAŁ 01/);
    assert.doesNotMatch(editorialFrame0, /data-lighting-rig=/);

    // Frame 48 (9:16 & 16:9): directional lighting rig, multi-plane Z, mount, and ink-brush active
    for (const [w, h] of [
      [1080, 1920],
      [1920, 1080],
    ] as const) {
      const editorialFrame48 = renderStyleLabFrame(
        preset,
        'editorial-collage',
        48,
        w,
        h
      );
      assert.match(editorialFrame48, new RegExp(`data-lighting-rig="${expectedRig}"`));
      assert.match(editorialFrame48, new RegExp(`data-mount-type="${expectedMount}"`));
      assert.match(editorialFrame48, /data-ink-brush="true"/);
      assert.match(editorialFrame48, /data-depth-z="-0\.65"/);
    }

    // 2. Kinetic Typography in Style Lab: Frame 0 clean + Frame 48 switches live across 3 grammars
    const kineticFrame0 = renderStyleLabFrame(preset, 'kinetic-typography', 0);
    assert.doesNotMatch(kineticFrame0, /Rytm/);
    assert.doesNotMatch(kineticFrame0, /data-lighting-rig=/);

    const kineticFrame48 = renderStyleLabFrame(preset, 'kinetic-typography', 48);
    assert.match(kineticFrame48, new RegExp(`data-lighting-rig="${expectedRig}"`));
    assert.match(
      kineticFrame48,
      new RegExp(`data-typography-grammar="${expectedGrammar}"`)
    );
    if (expectedGrammar === 'risograph-poster') {
      assert.match(kineticFrame48, /data-risograph-meter="true"/);
    } else {
      assert.match(kineticFrame48, /data-vernier-scale="true"/);
    }

    // 3. Vector Scene 2D in Style Lab: Frame 0 clean + Frame 64 multi-plane plate, medallion, elbow callout & rack focus
    const vectorFrame0 = renderStyleLabFrame(preset, 'vector-scene-2d', 0);
    assert.doesNotMatch(vectorFrame0, /Przejrzysta narracja/);
    assert.doesNotMatch(vectorFrame0, /data-lighting-rig=/);

    for (const [w, h] of [
      [1080, 1920],
      [1920, 1080],
    ] as const) {
      const vectorFrame64 = renderStyleLabFrame(
        preset,
        'vector-scene-2d',
        64,
        w,
        h
      );
      assert.match(vectorFrame64, new RegExp(`data-lighting-rig="${expectedRig}"`));
      assert.match(
        vectorFrame64,
        new RegExp(`data-medallion-grammar="${expectedGrammar}"`)
      );
      assert.match(vectorFrame64, /data-callout-reticle="true"/);
      assert.match(vectorFrame64, /data-depth-z="-0\.6"/);
      assert.match(vectorFrame64, /data-depth-z="0\.42"/);
      assert.doesNotMatch(vectorFrame64, /blur\(0(?:\.0+)?px\)/);
    }

    const vectorFrame140 = renderStyleLabFrame(preset, 'vector-scene-2d', 140);
    assert.doesNotMatch(vectorFrame140, /blur\(0(?:\.0+)?px\)/);

    // 4. Data Storytelling in Style Lab: Frame 0 clean + Frame 64 tonal grid, 240° dial & vernier rail
    const dataFrame0 = renderStyleLabFrame(preset, 'data-storytelling', 0);
    assert.doesNotMatch(dataFrame0, /Indeks czytelności/);
    assert.doesNotMatch(dataFrame0, /data-lighting-rig=/);

    for (const [w, h] of [
      [1080, 1920],
      [1920, 1080],
    ] as const) {
      const dataFrame64 = renderStyleLabFrame(
        preset,
        'data-storytelling',
        64,
        w,
        h
      );
      assert.match(dataFrame64, new RegExp(`data-lighting-rig="${expectedRig}"`));
      assert.match(dataFrame64, new RegExp(`data-bar-grammar="${expectedGrammar}"`));
      assert.match(dataFrame64, /data-instrument-arc="240"/);
      assert.match(dataFrame64, /data-vernier-rail="true"/);
      assert.match(dataFrame64, /data-depth-z="-0\.58"/);
      assert.doesNotMatch(dataFrame64, /blur\(0(?:\.0+)?px\)/);
    }

    // 5. Motion Diagrams 2D in Style Lab: Frame 0 clean + Frame 64 schematic bus, rack focus & payload plate
    const diagramsFrame0 = renderStyleLabFrame(preset, 'motion-diagrams-2d', 0);
    assert.doesNotMatch(diagramsFrame0, /Scenariusz JSON|SCHEMAT/);
    assert.doesNotMatch(diagramsFrame0, /data-lighting-rig=/);

    for (const [w, h] of [
      [1080, 1920],
      [1920, 1080],
    ] as const) {
      const diagramsFrame64 = renderStyleLabFrame(
        preset,
        'motion-diagrams-2d',
        64,
        w,
        h
      );
      assert.match(
        diagramsFrame64,
        new RegExp(`data-lighting-rig="${expectedRig}"`)
      );
      assert.match(
        diagramsFrame64,
        new RegExp(`data-flow-grammar="${expectedGrammar}"`)
      );
      assert.match(diagramsFrame64, /data-payload-plate="true"/);
      assert.match(diagramsFrame64, /data-depth-z="-0\.56"/);
      assert.match(diagramsFrame64, /data-depth-z="0\.28"/);
      assert.doesNotMatch(diagramsFrame64, /blur\(0(?:\.0+)?px\)/);
    }

    // 6. Isometric 3D in Style Lab: Frame 0 clean + Frame 64 calibrated 24-tick plinth & sculptural maquette
    const isoFrame0 = renderStyleLabFrame(preset, 'isometric-3d', 0);
    assert.doesNotMatch(isoFrame0, /Prowadząca|MAKIETA/);
    assert.doesNotMatch(isoFrame0, /data-lighting-rig=/);

    const expectedIsoMaterial =
      styleId === 'brutalist-poster'
        ? 'ink-figurine'
        : styleId === 'cyber-telemetry'
          ? 'anodized-telemetry'
          : 'ceramic-maquette';

    for (const [w, h] of [
      [1080, 1920],
      [1920, 1080],
    ] as const) {
      const isoFrame64 = renderStyleLabFrame(preset, 'isometric-3d', 64, w, h);
      assert.match(
        isoFrame64,
        new RegExp(`data-lighting-rig="${expectedRig}"`)
      );
      assert.match(
        isoFrame64,
        new RegExp(`data-iso-material="${expectedIsoMaterial}"`)
      );
      assert.match(isoFrame64, /data-iso-plinth="calibrated-24"/);
      assert.match(isoFrame64, /data-depth-z="-0\.54"/);
      assert.doesNotMatch(isoFrame64, /blur\(0(?:\.0+)?px\)/);
    }
  }

  // Zero-aperture deadzone (< 0.25px -> filter:none) on Wave 3 previews
  const zeroApertureSample: StylePreset = {
    ...BUILT_IN_STYLES['minimal-product'],
    optics: {
      ...BUILT_IN_STYLES['minimal-product'].optics!,
      lightingRig: 'studio-macro',
      aperture: 0,
    },
  };
  for (const w3Kit of ['motion-diagrams-2d', 'isometric-3d'] as const) {
    const flatMarkup = renderStyleLabFrame(zeroApertureSample, w3Kit, 64);
    assert.match(flatMarkup, /data-lighting-rig="studio-macro"/);
    assert.doesNotMatch(flatMarkup, /blur\(0(?:\.0+)?px\)/);
    if (w3Kit === 'motion-diagrams-2d') {
      assert.match(flatMarkup, /data-focus-state="recessed"[^>]*filter:none/);
    } else {
      assert.match(flatMarkup, /style="filter:none;opacity:0\.84"/);
    }
  }

  // Peer boundary & determinism guard on StyleLabShowcase.tsx
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const showcaseSrc = fs.readFileSync(
    path.resolve(testDir, '../../studio/src/client/components/StyleLabShowcase.tsx'),
    'utf8'
  );
  assert.doesNotMatch(showcaseSrc, /@make-pictures\/kits/);
  assert.doesNotMatch(showcaseSrc, /@react-three\/fiber|from\s+['"]three['"]/);
  assert.doesNotMatch(showcaseSrc, /Math\.random\s*\(/);
  assert.doesNotMatch(showcaseSrc, /frame\s*\*\s*0\.22/);
});
