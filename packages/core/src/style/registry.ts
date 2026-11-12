import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  isBuiltInStyleId,
} from './presets';
import { StylePresetSchema, type StylePreset } from './schema';

const customStyleMap = new Map<string, StylePreset>();

export function registerCustomStyles(styles: StylePreset[]): void {
  for (const candidate of styles) {
    const parsed = StylePresetSchema.safeParse(candidate);
    if (!parsed.success) continue;
    if (isBuiltInStyleId(parsed.data.id)) continue;
    customStyleMap.set(parsed.data.id, parsed.data);
  }
}

export function clearCustomStyles(): void {
  customStyleMap.clear();
}

export function listAllStudioStyles(): Array<{
  preset: StylePreset;
  origin: 'built-in' | 'custom';
}> {
  const builtIns = BUILT_IN_STYLE_IDS.map((id) => ({
    preset: BUILT_IN_STYLES[id],
    origin: 'built-in' as const,
  }));
  const customs = Array.from(customStyleMap.values())
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((preset) => ({
      preset,
      origin: 'custom' as const,
    }));
  return [...builtIns, ...customs];
}

export function resolveStudioStyle(
  styleOrId?: string | StylePreset
): StylePreset {
  if (!styleOrId) {
    return BUILT_IN_STYLES['minimal-product'];
  }
  if (typeof styleOrId === 'object') {
    const parsed = StylePresetSchema.safeParse(styleOrId);
    return parsed.success ? parsed.data : BUILT_IN_STYLES['minimal-product'];
  }
  const trimmed = styleOrId.trim();
  const fromCustom = customStyleMap.get(trimmed);
  if (fromCustom) return fromCustom;
  if (isBuiltInStyleId(trimmed)) {
    return BUILT_IN_STYLES[trimmed];
  }
  return BUILT_IN_STYLES['minimal-product'];
}
