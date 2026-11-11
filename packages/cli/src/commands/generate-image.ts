import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export interface GenerateImageCommandOptions {
  rootDir?: string;
  cwd?: string;
  prompt: string;
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

/**
 * Optional visual asset generator calling Gemini `gemini-2.5-flash-image` / Imagen REST API
 * when `GEMINI_API_KEY` is configured in `.env.local`.
 */
export async function runGenerateImageCommand(
  options: GenerateImageCommandOptions
): Promise<{ generated: boolean; outputPath?: string }> {
  const rootDir = path.resolve(options.cwd ?? options.rootDir ?? process.cwd());
  dotenv.config({ path: path.join(rootDir, '.env.local') });
  dotenv.config({ path: path.join(rootDir, '.env') });

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
    return { generated: false };
  }

  const model = options.model || 'gemini-2.5-flash-image';
  const resolvedOut = path.resolve(rootDir, options.outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  console.log(
    `🎨 Generating image with ${model} → ${path.relative(rootDir, resolvedOut)}…`
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
        instances: [{ prompt: options.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: options.aspectRatio ?? '1:1',
        },
      }
    : {
        contents: [
          {
            parts: [{ text: options.prompt }],
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

  const payload = (await response.json()) as GeminiGenerateContentResponse;

  if (!response.ok) {
    throw new Error(
      `Gemini Image API error (${response.status}): ${
        payload.error?.message || response.statusText
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
  };
}
