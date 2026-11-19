import type { SceneDefinition, VoiceSettingsConfig } from '@make-pictures/core';
import { getKnownEnglishVoiceName } from '../../../core/src/audio/voices';

/** Głoskowce — akronimy wymawiane po polsku jako jedno spójne słowo (bez literowania!) */
export const POLISH_WORD_ACRONYMS: Record<string, string> = {
  API: 'api',
  LED: 'led',
  RAM: 'ram',
  LAN: 'lan',
  PIN: 'pin',
  SIM: 'sim',
  CAD: 'kad',
  SAAS: 'sas',
  SaaS: 'sas',
  JSON: 'dżejson',
};

/** Literowce — skrótowce literowane po polsku z obowiązkowymi dywizami */
export const POLISH_LETTERED_ACRONYMS: Record<string, string> = {
  USB: 'u-es-be',
  SQL: 'es-ku-el',
  CRM: 'ce-er-em',
  ERP: 'e-er-pe',
  GSM: 'gie-es-em',
  PDF: 'pe-de-ef',
  HTML: 'ha-te-em-el',
  SDK: 'es-de-ka',
  HTTPS: 'ha-te-te-pe-es',
  CPU: 'ce-pe-u',
};

const FORBIDDEN_API_LETTERING_RE =
  /(?<![\p{L}\p{N}])(?:a[-\s]+pe[-\s]+i|ej[-\s]+pi[-\s]+aj)(?![\p{L}\p{N}])/giu;

const SPACED_LETTERING_MAP: ReadonlyArray<{ re: RegExp; canonical: string }> = [
  { re: /(?<![\p{L}\p{N}])u\s+es\s+be(?![\p{L}\p{N}])/giu, canonical: 'u-es-be' },
  { re: /(?<![\p{L}\p{N}])es\s+ku\s+el(?![\p{L}\p{N}])/giu, canonical: 'es-ku-el' },
  { re: /(?<![\p{L}\p{N}])ce\s+er\s+em(?![\p{L}\p{N}])/giu, canonical: 'ce-er-em' },
  { re: /(?<![\p{L}\p{N}])e\s+er\s+pe?(?![\p{L}\p{N}])/giu, canonical: 'e-er-pe' },
  { re: /(?<![\p{L}\p{N}])gie\s+es\s+em(?![\p{L}\p{N}])/giu, canonical: 'gie-es-em' },
  { re: /(?<![\p{L}\p{N}])pe\s+de\s+ef(?![\p{L}\p{N}])/giu, canonical: 'pe-de-ef' },
  { re: /(?<![\p{L}\p{N}])ha\s+te\s+em\s+el(?![\p{L}\p{N}])/giu, canonical: 'ha-te-em-el' },
  { re: /(?<![\p{L}\p{N}])es\s+de\s+ka(?![\p{L}\p{N}])/giu, canonical: 'es-de-ka' },
  { re: /(?<![\p{L}\p{N}])ha\s+te\s+te\s+pe\s+es(?![\p{L}\p{N}])/giu, canonical: 'ha-te-te-pe-es' },
  { re: /(?<![\p{L}\p{N}])ce\s+pe\s+u(?![\p{L}\p{N}])/giu, canonical: 'ce-pe-u' },
];

const SKU_CODE_RE =
  /(?<![\p{L}\p{N}])[A-Z]{1,4}-\d{2,5}[A-Z0-9-]*(?![\p{L}\p{N}])/gu;
const STANDARD_NUMBER_RE =
  /(?<![\p{L}\p{N}])(?:ISO|RFC|IEEE|HTTP|USB)\s*\d+(?:[.-]\d+)*(?![\p{L}\p{N}])/giu;
const UPPERCASE_ACRONYM_TOKEN_RE =
  /(?<![\p{L}\p{N}])(?:[A-Z]{2,6}|SaaS)(?![\p{L}\p{N}])/gu;

export function lintPolishVoiceoverText(
  sceneId: string,
  text: string,
  voiceSettings?: VoiceSettingsConfig
): string[] {
  const warnings: string[] = [];

  for (const match of text.matchAll(FORBIDDEN_API_LETTERING_RE)) {
    warnings.push(
      `[phonetics-lint] (${sceneId}) Wykryto antywzorzec "${match[0]}" — skrótowiec API to po polsku głoskowiec; zapisz go jako "api" (nigdy "a-pe-i", "a pe i" ani "ej-pi-aj").`
    );
  }

  for (const rule of SPACED_LETTERING_MAP) {
    for (const match of text.matchAll(rule.re)) {
      warnings.push(
        `[phonetics-lint] (${sceneId}) Zastąp rozdzielony spacjami literowiec "${match[0]}" zapisem z dywizami ("${rule.canonical}").`
      );
    }
  }

  const skuSpans: Array<[number, number]> = [];
  for (const match of text.matchAll(SKU_CODE_RE)) {
    const start = match.index ?? 0;
    skuSpans.push([start, start + match[0].length]);
    warnings.push(
      `[phonetics-lint] (${sceneId}) Kod katalogowy / SKU "${match[0]}" w tekście mówionym — nazwij funkcję i korzyść słownie, a symbol przenieś na dyskretny badge wizualny.`
    );
  }

  const stdSpans: Array<[number, number]> = [];
  for (const match of text.matchAll(STANDARD_NUMBER_RE)) {
    const start = match.index ?? 0;
    stdSpans.push([start, start + match[0].length]);
    warnings.push(
      `[phonetics-lint] (${sceneId}) Norma lub standard "${match[0]}" zapisany cyframi — pogrupuj cyfry słownie (np. "izo osiemdziesiąt sześć zero jeden", "u-es-be trzy dwa").`
    );
  }

  for (const match of text.matchAll(UPPERCASE_ACRONYM_TOKEN_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const insideSku = skuSpans.some(([s, e]) => start >= s && end <= e);
    if (insideSku) continue;

    const token = match[0];
    if (token in POLISH_WORD_ACRONYMS) {
      warnings.push(
        `[phonetics-lint] (${sceneId}) Surowy głoskowiec "${token}" — zapisz fonetycznie jako jedno słowo: "${POLISH_WORD_ACRONYMS[token]}".`
      );
    } else if (token in POLISH_LETTERED_ACRONYMS) {
      const insideStd = stdSpans.some(([s, e]) => start >= s && end <= e);
      if (!insideStd) {
        warnings.push(
          `[phonetics-lint] (${sceneId}) Surowy literowiec "${token}" — zapisz z dywizami: "${POLISH_LETTERED_ACRONYMS[token]}".`
        );
      }
    }
  }

  if (
    voiceSettings &&
    typeof voiceSettings.speed === 'number' &&
    voiceSettings.speed > 1.03
  ) {
    warnings.push(
      `[phonetics-lint] (${sceneId}) Tempo syntezy voiceSettings.speed=${voiceSettings.speed} (> 1.03) — ustaw naturalne tempo 0.98–1.00.`
    );
  }

  return warnings;
}

const POLISH_SIGNAL_RE =
  /[ąćęłńśźżĄĆĘŁŃŚŹŻ]|(?<![\p{L}\p{N}])(?:oraz|przez|żeby|który|która|które|jako|poniżej|między|dlatego|również|właśnie)(?![\p{L}\p{N}])/iu;

export function shouldRunPolishPhoneticsLint(params: {
  lang?: string;
  scenes?: ReadonlyArray<Pick<SceneDefinition, 'text'>>;
}): boolean {
  if (params.lang === 'en') return false;
  if (params.lang === 'pl') return true;
  const combined = (params.scenes ?? []).map((s) => s.text ?? '').join(' ');
  return POLISH_SIGNAL_RE.test(combined);
}

export function lintPolishVoiceSelection(
  sceneId: string,
  voiceId?: string
): string[] {
  const englishName = getKnownEnglishVoiceName(voiceId);
  if (!englishName) {
    return [];
  }
  return [
    `[phonetics-lint] (${sceneId}) Głos "${englishName}" (${voiceId}) to domyślny głos anglojęzyczny — w języku polskim generuje obcy akcent (szczególnie na liczebnikach). Użyj natywnego głosu PL (np. Luiza C8ZVSJxcymeT86xT429O, Asia Bz1e1clEKwgN71Vx7cxj, Arleta F9eb9uZYeJuHuO7Uvs1R, Rafał CLuTGacrAhcIhaJslbXt) lub sprawdź dostępne głosy przez "npx make-pictures voices --lang=pl".`,
  ];
}

export function lintManifestVoiceovers(
  manifest: {
    lang?: string;
    voiceId?: string;
    scenes?: ReadonlyArray<SceneDefinition>;
  },
  options?: { defaultVoiceId?: string }
): string[] {
  if (!shouldRunPolishPhoneticsLint(manifest)) {
    return [];
  }
  const allWarnings: string[] = [];
  const warnedVoiceIds = new Set<string>();
  for (const scene of manifest.scenes ?? []) {
    const effectiveVoiceId =
      scene.voiceId?.trim() ||
      manifest.voiceId?.trim() ||
      options?.defaultVoiceId?.trim();
    if (effectiveVoiceId && !warnedVoiceIds.has(effectiveVoiceId)) {
      const voiceWarnings = lintPolishVoiceSelection(scene.id, effectiveVoiceId);
      if (voiceWarnings.length > 0) {
        warnedVoiceIds.add(effectiveVoiceId);
        allWarnings.push(...voiceWarnings);
      }
    }
    if (!scene.text) continue;
    allWarnings.push(
      ...lintPolishVoiceoverText(scene.id, scene.text, scene.voiceSettings)
    );
  }
  return allWarnings;
}
