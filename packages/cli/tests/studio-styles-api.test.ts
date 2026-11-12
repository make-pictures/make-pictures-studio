import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StylePresetSchema,
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
    'Domyślne Audio',
  ]);
  const colorFields = sections
    .find((s) => s.title === 'Paleta kolorów')
    ?.fields.filter((f) => f.kind === 'color');
  assert.equal(colorFields?.length, 8);
});
