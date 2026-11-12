import fs from 'node:fs';
import path from 'node:path';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StylePresetSchema,
  isBuiltInStyleId,
  type StylePreset,
} from '../../../core/src/style/presets';
import { SCENES_KIT_IDS, type ScaffoldKitId } from './new-production';
import { resolveWorkspaceContext } from './workspace-paths';

const STYLE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const VISUAL_KIT_CATALOG: Array<{
  id: ScaffoldKitId;
  usesThree: boolean;
  summaryPl: string;
  summaryEn: string;
}> = [
  {
    id: 'editorial-collage',
    usesThree: false,
    summaryPl:
      'Dokument, historia, kultura, nauka i eseje magazynowe (Ken Burns, cytaty, karty rozdziałów)',
    summaryEn:
      'Documentary, history, culture, science & magazine essays (Ken Burns media, quotes, chapters)',
  },
  {
    id: 'vector-scene-2d',
    usesThree: false,
    summaryPl:
      'Uniwersalna narracja 2D, prezentacja pojęć, metafor i porównań bez estetyki tektury',
    summaryEn:
      'Universal 2D visual storytelling, concepts, callouts & side-by-side comparisons',
  },
  {
    id: 'kinetic-typography',
    usesThree: false,
    summaryPl:
      'Dynamiczna typografia słowo-po-słowie, rolki 9:16, manifesty i liczniki KPI',
    summaryEn:
      'High-tempo word-by-word kinetic reels, punchy hooks & KPI counters',
  },
  {
    id: 'data-storytelling',
    usesThree: false,
    summaryPl:
      'Animowane wyścigi słupków (bar race), osie czasu i porównania metryk przed/po',
    summaryEn:
      'Animated bar races, chronological timelines & before/after metric cards',
  },
  {
    id: 'motion-diagrams-2d',
    usesThree: false,
    summaryPl:
      'Architektura systemów, przepływy API, nieskończone płótno 2D i screencasty SaaS',
    summaryEn:
      'System architecture, API flows, infinite 2D canvas & SaaS product frames',
  },
  {
    id: 'paper-diorama-3d',
    usesThree: true,
    summaryPl:
      'Teatrzyk wycinankowy 2.5D na neutralnej scenie DioramaStage3D (opowieści i rękodzieło)',
    summaryEn:
      '2.5D layered cutout stage on neutral DioramaStage3D (crafted stories & fables)',
  },
  {
    id: 'isometric-3d',
    usesThree: true,
    summaryPl:
      'Wieloosobowe dialogi i postacie 3D na scenie izometrycznej IsometricStage3D',
    summaryEn:
      'Multi-character 3D studio dialogues on neutral IsometricStage3D',
  },
];

export const STYLES_README_MD = `# Custom Styles (\`styles/*.style.json\`)

Pliki \`*.style.json\` w tym katalogu definiują wielokrotnego użytku kierunki plastyczne (**Art Direction**) dla Twoich filmów — paletę kolorów, parę fontów Google Fonts (\`latin-ext\`), fakturę tła, geometrię kart, profil sprężyn oraz domyślny nastrój audio.

- Podgląd i edycja na żywo w **60 FPS**: otwórz Studio Web (\`npm run studio\`) i przełącz widok na **🎨 Style Lab**.
- Tworzenie nowego stylu z CLI: \`npx make-pictures style new moj-styl --from=editorial-press\`
- Użycie stylu w nowym filmie: \`npx make-pictures new moj-film --kit=editorial-collage --style=moj-styl\`
`;

export function ensureWorkspaceStylesDir(studioDir: string): string {
  const stylesDir = path.join(studioDir, 'styles');
  fs.mkdirSync(stylesDir, { recursive: true });
  const readmePath = path.join(stylesDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, STYLES_README_MD, 'utf8');
  }
  return stylesDir;
}

export function loadWorkspaceCustomStyles(studioDir: string): {
  styles: StylePreset[];
  warnings: string[];
} {
  const stylesDir = path.join(studioDir, 'styles');
  if (!fs.existsSync(stylesDir)) {
    return { styles: [], warnings: [] };
  }

  const styles: StylePreset[] = [];
  const warnings: string[] = [];

  const files = fs
    .readdirSync(stylesDir)
    .filter((f) => f.endsWith('.style.json'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const abs = path.join(stylesDir, file);
    try {
      const raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as unknown;
      const parsed = StylePresetSchema.safeParse(raw);
      if (!parsed.success) {
        warnings.push(
          `Pominięto nieprawidłowy plik stylu styles/${file}: ${parsed.error.issues[0]?.message ?? 'błąd schematu'}`
        );
        continue;
      }
      if (isBuiltInStyleId(parsed.data.id)) {
        warnings.push(
          `Pominięto styles/${file}: identyfikator "${parsed.data.id}" jest zarezerwowany dla stylu wbudowanego.`
        );
        continue;
      }
      styles.push(parsed.data);
    } catch (err) {
      warnings.push(
        `Nie udało się odczytać styles/${file}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { styles, warnings };
}

export async function runStylesListCommand(options?: {
  cwd?: string;
  dir?: string;
  json?: boolean;
}): Promise<{
  builtInStyles: StylePreset[];
  customStyles: StylePreset[];
  visualKits: typeof VISUAL_KIT_CATALOG;
  warnings: string[];
}> {
  const { studioDir } = resolveWorkspaceContext({
    cwd: options?.cwd,
    dir: options?.dir,
  });
  const builtInStyles = BUILT_IN_STYLE_IDS.map((id) => BUILT_IN_STYLES[id]);
  const { styles: customStyles, warnings } =
    loadWorkspaceCustomStyles(studioDir);

  const payload = {
    builtInStyles,
    customStyles,
    visualKits: VISUAL_KIT_CATALOG,
    warnings,
  };

  if (options?.json) {
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  }

  console.log('\n🎨 Built-in Art Direction Styles (7):');
  for (const s of builtInStyles) {
    console.log(
      `  • ${s.id.padEnd(20)} ${s.typography.displayFont} + ${s.typography.bodyFont} — ${s.description}`
    );
  }

  console.log(
    `\n✨ Custom Workspace Styles (styles/*.style.json): ${customStyles.length}`
  );
  if (customStyles.length === 0) {
    console.log(
      '  (brak — utwórz własny styl przez `npx make-pictures style new moj-styl` lub w zakładce 🎨 Style Lab w Studio Web)'
    );
  } else {
    for (const s of customStyles) {
      console.log(`  • ${s.id.padEnd(20)} ${s.name} — ${s.description}`);
    }
  }

  console.log(`\n🎬 Scene Visual Kits (${SCENES_KIT_IDS.length}):`);
  for (const k of VISUAL_KIT_CATALOG) {
    console.log(`  • ${k.id.padEnd(20)} ${k.summaryPl}`);
  }
  for (const w of warnings) {
    console.warn(`  ⚠ ${w}`);
  }

  return payload;
}

export async function runStyleNewCommand(options: {
  slug: string;
  from?: string;
  cwd?: string;
  dir?: string;
  force?: boolean;
}): Promise<{ filePath: string; preset: StylePreset }> {
  const { studioDir } = resolveWorkspaceContext({
    cwd: options.cwd,
    dir: options.dir,
  });
  const cleanSlug = options.slug.trim().toLowerCase();
  if (!STYLE_SLUG_RE.test(cleanSlug)) {
    throw new Error(
      `Nieprawidłowy slug stylu "${options.slug}". Użyj małych liter, cyfr i myślników (np. "neapolitan-chronicle").`
    );
  }
  if (isBuiltInStyleId(cleanSlug)) {
    throw new Error(
      `Identyfikator "${cleanSlug}" jest zarezerwowany dla stylu wbudowanego (built-in). Wybierz własną nazwę.`
    );
  }

  const stylesDir = ensureWorkspaceStylesDir(studioDir);
  const targetPath = path.resolve(stylesDir, `${cleanSlug}.style.json`);
  if (!targetPath.startsWith(stylesDir + path.sep)) {
    throw new Error('Niedozwolona ścieżka docelowa stylu.');
  }
  if (fs.existsSync(targetPath) && !options.force) {
    throw new Error(
      `Plik styles/${cleanSlug}.style.json już istnieje (dodaj --force, aby nadpisać).`
    );
  }

  const { styles: existingCustom } = loadWorkspaceCustomStyles(studioDir);
  const fromId = (options.from ?? 'minimal-product').trim();
  const basePreset =
    existingCustom.find((s) => s.id === fromId) ??
    (isBuiltInStyleId(fromId)
      ? BUILT_IN_STYLES[fromId]
      : BUILT_IN_STYLES['minimal-product']);

  const humanName = cleanSlug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

  const preset = StylePresetSchema.parse({
    ...basePreset,
    id: cleanSlug,
    name: humanName,
    description: `Autorski kierunek plastyczny na bazie ${basePreset.name}.`,
  });

  fs.writeFileSync(targetPath, `${JSON.stringify(preset, null, 2)}\n`, 'utf8');
  console.log(`✓ Utworzono własny styl: styles/${cleanSlug}.style.json`);
  return { filePath: targetPath, preset };
}
