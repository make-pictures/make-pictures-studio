import fs from 'node:fs';
import path from 'node:path';
import {
  ELEMENT_PAYLOAD_MIME_TYPE,
  createElementPayload,
  serializeElementPayloadForHtml,
  type ElementDependency,
  type StudioElementPayload,
} from '@remotion/studio-protocol';
import {
  REMOTION_ELEMENTS_CATALOG,
  type MakePicturesElementSpec,
} from '@make-pictures/remotion/elements';

export interface ElementsBuildOptions {
  /** Target output directory for `<slug>.json`, `<slug>/index.html`, and `index.json`. */
  outDir: string;
  /** Public base URL where built element files will be hosted (default: `https://make.pictures/elements`). */
  baseUrl?: string;
  /** Site name embedded in `<meta property="og:site_name">` (default: `make.pictures`). */
  siteName?: string;
  /** Optional subset of element slugs to build; defaults to the full flagship catalog. */
  slugs?: ReadonlyArray<string>;
}

export interface ElementsBuildEntry {
  readonly slug: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: MakePicturesElementSpec['category'];
  readonly space: MakePicturesElementSpec['space'];
  readonly dimensions: MakePicturesElementSpec['dimensions'];
  readonly durationInFrames: number;
  readonly jsonFile: string;
  readonly htmlFile: string;
  readonly url: string;
  readonly jsonUrl: string;
}

export interface ElementsBuildResult {
  readonly outDir: string;
  readonly baseUrl: string;
  readonly count: number;
  readonly indexFile: string;
  readonly elements: ElementsBuildEntry[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeBaseUrl(rawUrl?: string): string {
  const trimmed = (rawUrl ?? 'https://make.pictures/elements').trim();
  return trimmed.replace(/\/+$/, '');
}

function renderElementHtmlPage(params: {
  spec: MakePicturesElementSpec;
  payload: StudioElementPayload;
  siteName: string;
  pageUrl: string;
  jsonUrl: string;
}): string {
  const { spec, payload, siteName, pageUrl, jsonUrl } = params;
  const serializedPayload = serializeElementPayloadForHtml(payload);
  const installCommand = `npx remotion elements use ${pageUrl}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(spec.displayName)} — ${escapeHtml(siteName)} Remotion Element</title>
    <meta name="description" content="${escapeHtml(spec.description)}" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:title" content="${escapeHtml(spec.displayName)}" />
    <meta property="og:description" content="${escapeHtml(spec.description)}" />
    <link rel="alternate" type="${ELEMENT_PAYLOAD_MIME_TYPE}" href="${escapeHtml(jsonUrl)}" />
    <script type="${ELEMENT_PAYLOAD_MIME_TYPE}">${serializedPayload}</script>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(spec.displayName)}</h1>
      <p>${escapeHtml(spec.description)}</p>
      <p>Install directly into any Remotion project:</p>
      <pre><code>${escapeHtml(installCommand)}</code></pre>
    </main>
  </body>
</html>
`;
}

export async function runElementsBuildCommand(
  options: ElementsBuildOptions
): Promise<ElementsBuildResult> {
  const outDir = path.resolve(options.outDir);
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const siteName = (options.siteName ?? 'make.pictures').trim() || 'make.pictures';

  const selectedSpecs =
    options.slugs && options.slugs.length > 0
      ? (() => {
          const wanted = new Set(options.slugs);
          const matched = REMOTION_ELEMENTS_CATALOG.filter((item) =>
            wanted.has(item.slug)
          );
          const missing = options.slugs.filter(
            (slug) => !matched.some((item) => item.slug === slug)
          );
          if (missing.length > 0) {
            throw new Error(
              `Unknown Remotion Element slug(s): ${missing.join(', ')}. Available: ${REMOTION_ELEMENTS_CATALOG.map((item) => item.slug).join(', ')}`
            );
          }
          return matched;
        })()
      : REMOTION_ELEMENTS_CATALOG;

  fs.mkdirSync(outDir, { recursive: true });

  const entries: ElementsBuildEntry[] = [];

  for (const spec of selectedSpecs) {
    const payload = createElementPayload({
      displayName: spec.displayName,
      slug: spec.slug,
      sourceCode: spec.sourceCode,
      dependencies: spec.dependencies as readonly ElementDependency[],
      dimensions: spec.dimensions ? { ...spec.dimensions } : null,
      durationInFrames: spec.durationInFrames,
      initialProps: spec.initialProps ?? null,
    });

    const jsonFile = path.join(outDir, `${spec.slug}.json`);
    const htmlDir = path.join(outDir, spec.slug);
    const htmlFile = path.join(htmlDir, 'index.html');
    const pageUrl = `${baseUrl}/${spec.slug}`;
    const jsonUrl = `${baseUrl}/${spec.slug}.json`;

    fs.mkdirSync(htmlDir, { recursive: true });
    fs.writeFileSync(jsonFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
      htmlFile,
      renderElementHtmlPage({
        spec,
        payload,
        siteName,
        pageUrl,
        jsonUrl,
      }),
      'utf8'
    );

    entries.push({
      slug: spec.slug,
      displayName: spec.displayName,
      description: spec.description,
      category: spec.category,
      space: spec.space,
      dimensions: spec.dimensions,
      durationInFrames: spec.durationInFrames,
      jsonFile,
      htmlFile,
      url: pageUrl,
      jsonUrl,
    });
  }

  const indexFile = path.join(outDir, 'index.json');
  const indexDocument = {
    schemaVersion: 1,
    siteName,
    baseUrl,
    mimeType: ELEMENT_PAYLOAD_MIME_TYPE,
    count: entries.length,
    elements: entries.map((entry) => ({
      slug: entry.slug,
      displayName: entry.displayName,
      description: entry.description,
      category: entry.category,
      space: entry.space,
      dimensions: entry.dimensions,
      durationInFrames: entry.durationInFrames,
      url: entry.url,
      jsonUrl: entry.jsonUrl,
    })),
  };

  fs.writeFileSync(
    indexFile,
    `${JSON.stringify(indexDocument, null, 2)}\n`,
    'utf8'
  );

  return {
    outDir,
    baseUrl,
    count: entries.length,
    indexFile,
    elements: entries,
  };
}
