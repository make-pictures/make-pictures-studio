import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import { BUILT_IN_STYLES } from '@make-pictures/remotion/style/presets';
import {
  POLISH_LETTERED_ACRONYMS,
  POLISH_WORD_ACRONYMS,
  lintManifestVoiceovers,
  lintPolishVoiceoverText,
  shouldRunPolishPhoneticsLint,
} from '../src/audio/phonetics-lint';
import {
  detectInteriorAlphaHoles,
  extractPdfPageXObjectRgba,
  removeExteriorLightBackground,
  runCutoutCommand,
} from '../src/commands/cutout';
import {
  NO_RASTER_TEXT_GUARD_CLAUSE,
  buildStyledImagePrompt,
  runGenerateImageCommand,
} from '../src/commands/generate-image';
import { runCli } from '../src/index';

function buildMinimalPdfWithSmaskImage(params: {
  width: number;
  height: number;
  rgbBytes: Buffer;
  alphaBytes: Buffer;
}): Buffer {
  const { width, height, rgbBytes, alphaBytes } = params;
  const compressedRgb = zlib.deflateSync(rgbBytes);
  const compressedAlpha = zlib.deflateSync(alphaBytes);

  const chunks: Buffer[] = [];
  const offsets: number[] = [0];
  let length = 0;

  const pushStr = (s: string) => {
    const b = Buffer.from(s, 'latin1');
    chunks.push(b);
    length += b.length;
  };
  const pushBuf = (b: Buffer) => {
    chunks.push(b);
    length += b.length;
  };
  const startObj = (id: number) => {
    offsets[id] = length;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => {
    pushStr('\nendobj\n');
  };

  pushStr('%PDF-1.4\n');

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  startObj(2);
  pushStr('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  endObj();

  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 6 0 R >>`
  );
  endObj();

  startObj(4);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 5 0 R /Length ${compressedRgb.length} >>\nstream\n`
  );
  pushBuf(compressedRgb);
  pushStr('\nendstream');
  endObj();

  startObj(5);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressedAlpha.length} >>\nstream\n`
  );
  pushBuf(compressedAlpha);
  pushStr('\nendstream');
  endObj();

  const contentStream = Buffer.from(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`, 'latin1');
  startObj(6);
  pushStr(`<< /Length ${contentStream.length} >>\nstream\n`);
  pushBuf(contentStream);
  pushStr('\nendstream');
  endObj();

  const xrefOffset = length;
  pushStr('xref\n0 7\n0000000000 65535 f \n');
  for (let i = 1; i <= 6; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(chunks);
}

test('phonetics-lint distinguishes Polish word acronyms (API -> "api") from hyphenated lettered acronyms (USB -> "u-es-be") and flags SKU codes, standard numbers, and fast speed', () => {
  assert.equal(POLISH_WORD_ACRONYMS.API, 'api');
  assert.equal(POLISH_WORD_ACRONYMS.RAM, 'ram');
  assert.equal(POLISH_WORD_ACRONYMS.LAN, 'lan');
  assert.equal(POLISH_WORD_ACRONYMS.LED, 'led');
  assert.equal(POLISH_WORD_ACRONYMS.SaaS, 'sas');
  assert.equal(POLISH_LETTERED_ACRONYMS.USB, 'u-es-be');
  assert.equal(POLISH_LETTERED_ACRONYMS.SQL, 'es-ku-el');
  assert.equal(POLISH_LETTERED_ACRONYMS.CRM, 'ce-er-em');
  assert.equal(POLISH_LETTERED_ACRONYMS.ERP, 'e-er-pe');

  // 1. Forbidden artificial lettering of API ("a-pe-i", "a pe i", "ej-pi-aj")
  for (const badApi of ['a-pe-i', 'a pe i', 'ej-pi-aj']) {
    const w = lintPolishVoiceoverText('s1', `Nasz eksporter ${badApi} zapisuje dane.`);
    assert.ok(
      w.some((msg) => msg.includes('"api"') && msg.includes('głoskowiec')),
      `Expected anti-pattern "${badApi}" to require "api", got ${JSON.stringify(w)}`
    );
  }

  // 2. Spaced lettered acronyms -> require hyphens
  const spacedWarnings = lintPolishVoiceoverText(
    's2',
    'Połączenie u es be oraz baza es ku el w systemie e er p.'
  );
  assert.ok(spacedWarnings.some((m) => m.includes('u-es-be')));
  assert.ok(spacedWarnings.some((m) => m.includes('es-ku-el')));
  assert.ok(spacedWarnings.some((m) => m.includes('e-er-pe')));

  // 3. Raw uppercase word acronyms vs lettered acronyms
  const rawUpperWarnings = lintPolishVoiceoverText(
    's3',
    'Klucz API przesyła zapytanie SQL w sieci LAN przez port USB.'
  );
  assert.ok(rawUpperWarnings.some((m) => m.includes('"API"') && m.includes('"api"')));
  assert.ok(rawUpperWarnings.some((m) => m.includes('"LAN"') && m.includes('"lan"')));
  assert.ok(rawUpperWarnings.some((m) => m.includes('"SQL"') && m.includes('"es-ku-el"')));
  assert.ok(rawUpperWarnings.some((m) => m.includes('"USB"') && m.includes('"u-es-be"')));

  // 4. SKU catalog codes, standard numbers, and speed > 1.03
  const skuAndStdWarnings = lintPolishVoiceoverText(
    's4',
    'Stacja DK-940X-TB4 wysyła znaczniki ISO 8601.',
    { speed: 1.12 }
  );
  assert.ok(skuAndStdWarnings.some((m) => m.includes('DK-940X-TB4')));
  assert.ok(skuAndStdWarnings.some((m) => m.includes('ISO 8601')));
  assert.ok(skuAndStdWarnings.some((m) => m.includes('0.98–1.00') || m.includes('0.98-1.00')));

  // 5. Clean studio script produces zero warnings
  const cleanWarnings = lintPolishVoiceoverText(
    's5',
    'Eksporter api zapisuje znaczniki czasu w formacie izo osiemdziesiąt sześć zero jeden bezpośrednio w bazie es-ku-el w sieci lan.',
    { speed: 0.99 }
  );
  assert.deepEqual(cleanWarnings, []);

  // 6. Uppercase Polish words with diacritics ("ŚLEDŹ", "RAMĄ", "ZŁAPIĘ", "KPINĄ") NEVER trigger false acronym matches
  const diacriticUpperWarnings = lintPolishVoiceoverText(
    's6',
    'ŚLEDŹ uważnie obraz za RAMĄ okna — ZŁAPIĘ każdy detal bez KPINĄ.'
  );
  assert.deepEqual(
    diacriticUpperWarnings,
    [],
    `Expected zero false acronym warnings on Polish diacritics, got ${JSON.stringify(diacriticUpperWarnings)}`
  );

  // 7. Standard number "USB 3.2" emits a single standard-grouping warning (no duplicate raw literowiec warning)
  const usbStdWarnings = lintPolishVoiceoverText('s7', 'Złącze USB 3.2 przesyła obraz.');
  assert.equal(usbStdWarnings.length, 1);
  assert.match(usbStdWarnings[0]!, /u-es-be trzy dwa/);

  // 8. English manifest mentioning "Jest" or "López" without lang='pl' does NOT trigger Polish phonetics lint
  assert.equal(
    shouldRunPolishPhoneticsLint({
      scenes: [{ text: 'Run Jest unit tests for your API and SQL layer with López.' }],
    }),
    false
  );
  assert.deepEqual(
    lintManifestVoiceovers({
      lang: 'en',
      scenes: [
        {
          id: 'en-1',
          durationInSeconds: 3,
          text: 'Connect your API to SQL over LAN and run Jest tests.',
        },
      ],
    }),
    []
  );
});

test('buildStyledImagePrompt injects StylePreset art direction anchor for --style and unconditionally appends the no-text protection clause', async () => {
  const plainPrompt = buildStyledImagePrompt('A sunlit wooden workbench with ceramic tools');
  assert.ok(plainPrompt.endsWith(NO_RASTER_TEXT_GUARD_CLAUSE));
  assert.match(plainPrompt, /Strictly no text, no letters/i);

  const editorialPrompt = buildStyledImagePrompt(
    'Archival printing press in warm light',
    BUILT_IN_STYLES['editorial-press']
  );
  assert.match(editorialPrompt, /Editorial Press/i);
  assert.match(editorialPrompt, /#F6F3EC|#C83E2B/);
  assert.ok(editorialPrompt.endsWith(NO_RASTER_TEXT_GUARD_CLAUSE));

  // Verify runGenerateImageCommand sends the guarded styled prompt over fetch when GEMINI_API_KEY is present
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-gen-image-style-'));
  const prevKey = process.env.GEMINI_API_KEY;
  const origFetch = globalThis.fetch;
  let capturedBody = '';

  try {
    process.env.GEMINI_API_KEY = 'test-live-key-for-mock-fetch';
    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    globalThis.fetch = (async (_url, init) => {
      capturedBody = String(init?.body ?? '');
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'image/png', data: tinyPngBase64 } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const outRel = 'out/styled-test.png';
    const res = await runGenerateImageCommand({
      cwd: tmpDir,
      prompt: 'Clean aluminum audio interface on studio table',
      style: 'minimal-product',
      outPath: outRel,
    });
    assert.equal(res.generated, true);
    assert.ok(fs.existsSync(path.join(tmpDir, outRel)));
    assert.match(capturedBody, /Minimal Product/);
    assert.match(capturedBody, /Strictly no text, no letters/);

    // Unknown --style throws a clear actionable error rather than silently dropping style anchor
    await assert.rejects(
      () =>
        runGenerateImageCommand({
          cwd: tmpDir,
          prompt: 'Test unknown style',
          style: 'editoiral-typo-preset',
          outPath: 'out/nope.png',
        }),
      /Unknown --style "editoiral-typo-preset"/
    );
  } finally {
    globalThis.fetch = origFetch;
    if (prevKey === undefined) {
      delete process.env.ELEVENLABS_DUMMY;
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = prevKey;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('cutout command: Exterior Border Flood-Fill preserves 100% of interior pure-white pixels, detectInteriorAlphaHoles catches global thresholding, and PDF /SMask extracts lossless RGBA + checkerboard QA', async () => {
  // 1. Unit test removeExteriorLightBackground + detectInteriorAlphaHoles on 24x24 synthetic device
  // White exterior [0..23], dark aluminum frame [5..18], pure-white screen interior [8..15]!
  const W = 24;
  const H = 24;
  const srcRgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const inFrame = x >= 5 && x <= 18 && y >= 5 && y <= 18;
      const inWhiteScreen = x >= 8 && x <= 15 && y >= 8 && y <= 15;
      if (inFrame && !inWhiteScreen) {
        // Dark chassis border (#1E293B)
        srcRgba[idx] = 30;
        srcRgba[idx + 1] = 41;
        srcRgba[idx + 2] = 59;
        srcRgba[idx + 3] = 255;
      } else {
        // Pure white (#FFFFFF) — BOTH exterior background AND interior display!
        srcRgba[idx] = 255;
        srcRgba[idx + 1] = 255;
        srcRgba[idx + 2] = 255;
        srcRgba[idx + 3] = 255;
      }
    }
  }

  const cleanCutout = removeExteriorLightBackground(srcRgba, W, H, [255, 255, 255], 18, 10);
  // Exterior corner is transparent (alpha === 0)
  assert.equal(cleanCutout[3], 0);
  // Interior pure-white screen pixel (12, 12) MUST remain 100% opaque (alpha === 255)!
  assert.equal(cleanCutout[(12 * W + 12) * 4 + 3], 255);
  const cleanHoleReport = detectInteriorAlphaHoles(cleanCutout, W, H);
  assert.equal(cleanHoleReport.hasInteriorHoles, false);
  assert.equal(cleanHoleReport.holeCount, 0);

  // Simulate forbidden global brightness threshold (`rgb > 245 => alpha = 0`): punches hole in interior screen!
  const globallyThresholded = new Uint8ClampedArray(srcRgba);
  for (let i = 0; i < globallyThresholded.length; i += 4) {
    if (
      globallyThresholded[i]! > 245 &&
      globallyThresholded[i + 1]! > 245 &&
      globallyThresholded[i + 2]! > 245
    ) {
      globallyThresholded[i + 3] = 0;
    }
  }
  const holeReport = detectInteriorAlphaHoles(globallyThresholded, W, H);
  assert.equal(holeReport.hasInteriorHoles, true);
  assert.equal(holeReport.holeCount, 1);
  assert.equal(holeReport.holePixelCount, 8 * 8);

  // 2. End-to-end CLI `make-pictures cutout` on BOTH bitmap PNG and PDF with native `/SMask`
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-cutout-cli-'));
  try {
    // 2A. Bitmap PNG input via ffmpeg lavfi (white background, dark border, white interior center)
    const studioPhotoPng = path.join(tmpDir, 'studio-photo.png');
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=white:s=80x80:d=1',
        '-vf',
        'drawbox=x=16:y=16:w=48:h=48:color=0x1E293B:t=fill,drawbox=x=26:y=26:w=28:h=28:color=white:t=fill',
        '-frames:v',
        '1',
        studioPhotoPng,
      ],
      { stdio: 'ignore' }
    );

    await runCli([
      'cutout',
      studioPhotoPng,
      '--tolerance=18',
      '--out=assets/device-photo.png',
      `--cwd=${tmpDir}`,
    ]);

    const outPhotoPng = path.join(tmpDir, 'assets', 'device-photo.png');
    const qaPhotoPng = path.join(tmpDir, 'out', 'cutout-qa-device-photo.png');
    assert.ok(fs.existsSync(outPhotoPng), 'Expected cutout PNG to be written');
    assert.ok(fs.existsSync(qaPhotoPng), 'Expected dark checkerboard QA PNG to be written');

    // Verify center white pixel (40, 40) in outPhotoPng has alpha = 255 while corner (0, 0) has alpha = 0
    const decodedPhotoRgba = execFileSync(
      'ffmpeg',
      ['-v', 'error', '-i', outPhotoPng, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
      { maxBuffer: 1024 * 1024 }
    );
    assert.equal(decodedPhotoRgba[3], 0, 'Expected top-left corner alpha === 0');
    assert.equal(
      decodedPhotoRgba[(40 * 80 + 40) * 4 + 3],
      255,
      'Expected interior white display pixel alpha === 255'
    );

    // 2B. Native PDF `/SMask` input with pure white object interior
    const pdfW = 16;
    const pdfH = 16;
    const rgbBuf = Buffer.alloc(pdfW * pdfH * 3, 255); // 100% pure white RGB everywhere!
    const alphaBuf = Buffer.alloc(pdfW * pdfH, 0);
    for (let y = 4; y < 12; y++) {
      for (let x = 4; x < 12; x++) {
        alphaBuf[y * pdfW + x] = 255;
      }
    }
    const pdfPath = path.join(tmpDir, 'datasheet.pdf');
    fs.writeFileSync(
      pdfPath,
      buildMinimalPdfWithSmaskImage({
        width: pdfW,
        height: pdfH,
        rgbBytes: rgbBuf,
        alphaBytes: alphaBuf,
      })
    );

    const extracted = extractPdfPageXObjectRgba(fs.readFileSync(pdfPath), 1);
    assert.equal(extracted.usedNativeSmask, true);
    assert.equal(extracted.width, pdfW);
    assert.equal(extracted.height, pdfH);
    assert.equal(extracted.rgba[3], 0);
    assert.equal(extracted.rgba[(8 * pdfW + 8) * 4 + 3], 255);

    const pdfResult = await runCutoutCommand({
      cwd: tmpDir,
      inputPath: pdfPath,
      page: 1,
      outPath: 'assets/white-chassis.png',
    });
    assert.equal(pdfResult.usedNativeSmask, true);
    assert.equal(pdfResult.holeReport.hasInteriorHoles, false);
    assert.ok(fs.existsSync(pdfResult.outputPath));
    assert.ok(fs.existsSync(pdfResult.qaSheetPath));

    // Invalid non-numeric CLI flag rejects cleanly instead of silently bypassing flood-fill via NaN
    await assert.rejects(
      () =>
        runCli([
          'cutout',
          studioPhotoPng,
          '--tolerance=not-a-number',
          '--out=assets/bad.png',
          `--cwd=${tmpDir}`,
        ]),
      /Invalid --tolerance value/
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
