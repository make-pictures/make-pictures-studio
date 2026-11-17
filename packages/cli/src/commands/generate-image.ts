import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  BUILT_IN_STYLES,
  isBuiltInStyleId,
  type StylePreset,
} from '../../../core/src/style/presets';
import { loadWorkspaceCustomStyles } from './styles';
import { resolveWorkspaceContext } from './workspace-paths';

export const NO_RASTER_TEXT_GUARD_CLAUSE =
  'Strictly no text, no letters, no typography, no signage, no numbers, no UI labels, no watermarks, clean blank surfaces.';

export interface GenerateImageCommandOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  prompt: string;
  style?: string;
  outPath: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  model?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
  predictions?: Array<{
    bytesBase64Encoded?: string;
    mimeType?: string;
  }>;
  error?: {
    message?: string;
  };
}

function resolveImageStylePreset(
  studioDir: string,
  styleId?: string
): StylePreset | undefined {
  if (!styleId || !styleId.trim()) return undefined;
  const trimmed = styleId.trim();
  const { styles: customStyles } = loadWorkspaceCustomStyles(studioDir);
  const customHit = customStyles.find((s) => s.id === trimmed);
  if (customHit) return customHit;
  if (isBuiltInStyleId(trimmed)) {
    return BUILT_IN_STYLES[trimmed];
  }
  throw new Error(
    `Unknown --style "${trimmed}". Run \`npx make-pictures styles\` to list available built-in and custom styles.`
  );
}

export function buildStyledImagePrompt(
  prompt: string,
  style?: StylePreset
): string {
  const cleanSubject = prompt.trim().replace(/\s+/g, ' ');
  if (!style) {
    return `${cleanSubject}. ${NO_RASTER_TEXT_GUARD_CLAUSE}`;
  }

  const worldDescriptor =
    style.artWorld === 'editorial-gallery'
      ? `Editorial gallery illustration (${style.name}) on warm textured surface (${style.palette.bgCanvas}) with controlled accents (${style.palette.accentPrimary}, ${style.palette.accentSecondary}) and directional window light`
      : style.artWorld === 'illustrative'
        ? `Tactile illustrative craft (${style.name}) with soft diffused studio lighting, harmonious palette (${style.palette.bgCanvas}, ${style.palette.accentPrimary}, ${style.palette.accentSecondary})`
        : `Clean studio atelier render (${style.name}) with crisp softbox lighting, refined material surfaces (${style.palette.bgCanvas}, ${style.palette.bgSurface}), and subtle accents (${style.palette.accentPrimary})`;

  return `${worldDescriptor}. Subject: ${cleanSubject}. ${NO_RASTER_TEXT_GUARD_CLAUSE}`;
}

/**
 * Optional visual asset generator calling Gemini `gemini-2.5-flash-image` / Imagen REST API
 * when `GEMINI_API_KEY` is configured in `.env.local`.
 */
export async function runGenerateImageCommand(
  options: GenerateImageCommandOptions
): Promise<{ generated: boolean; outputPath?: string; finalPrompt: string }> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  dotenv.config({ path: path.join(rootDir, '.env.local') });
  dotenv.config({ path: path.join(rootDir, '.env') });

  const resolvedStyle = resolveImageStylePreset(studioDir, options.style);
  const finalPrompt = buildStyledImagePrompt(options.prompt, resolvedStyle);

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (
    !apiKey ||
    apiKey === 'your_gemini_api_key_here' ||
    apiKey === 'twoj_klucz_api_gemini'
  ) {
    console.log(
      'ℹ️  GEMINI_API_KEY is not configured in .env.local — skipping remote image generation.'
    );
    console.log(
      '   To generate transparent/cutout illustrations via Gemini 2.5 Flash Image:'
    );
    console.log('   1. Add GEMINI_API_KEY=... to .env.local');
    console.log(
      `   2. Re-run: npx make-pictures image "${options.prompt}" --out=${options.outPath}`
    );
    return { generated: false, finalPrompt };
  }

  const model = options.model || 'gemini-2.5-flash-image';
  const resolvedOut = path.resolve(rootDir, options.outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  console.log(
    `🎨 Generating image with ${model}${
      resolvedStyle ? ` (style: ${resolvedStyle.id})` : ''
    } → ${path.relative(rootDir, resolvedOut)}…`
  );

  const isImagenEndpoint = model.startsWith('imagen-');
  const endpoint = isImagenEndpoint
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:predict`
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent`;

  const requestBody = isImagenEndpoint
    ? {
        instances: [{ prompt: finalPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: options.aspectRatio ?? '1:1',
        },
      }
    : {
        contents: [
          {
            parts: [{ text: finalPrompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          ...(options.aspectRatio
            ? { imageConfig: { aspectRatio: options.aspectRatio } }
            : {}),
        },
      };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  const rawBodyText = await response.text();
  let payload: GeminiGenerateContentResponse = {};
  if (rawBodyText.trim()) {
    try {
      payload = JSON.parse(rawBodyText) as GeminiGenerateContentResponse;
    } catch {
      if (response.ok) {
        throw new Error(
          `Gemini Image API returned invalid JSON (${response.status}): ${rawBodyText.slice(0, 180)}`
        );
      }
    }
  }

  if (!response.ok) {
    throw new Error(
      `Gemini Image API error (${response.status}): ${
        payload.error?.message || rawBodyText.slice(0, 180) || response.statusText
      }`
    );
  }

  const inlineBase64 =
    payload.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
      ?.inlineData?.data ?? payload.predictions?.[0]?.bytesBase64Encoded;

  if (!inlineBase64) {
    throw new Error(
      'Gemini API response did not include an image payload. Try refining the prompt.'
    );
  }

  fs.writeFileSync(resolvedOut, Buffer.from(inlineBase64, 'base64'));
  console.log(`✅ Saved generated image: ${path.relative(rootDir, resolvedOut)}`);

  return {
    generated: true,
    outputPath: resolvedOut,
    finalPrompt,
  };
}
