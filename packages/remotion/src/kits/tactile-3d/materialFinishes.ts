import type { ProceduralPbrMaterialKind } from './proceduralPbrMaps';

export type SheetMaterialFinish =
  | 'parchment-matte'
  | 'woodblock-cotton'
  | 'linen-glaze'
  | 'cyanotype-blueprint'
  | 'xray-neon';

export interface SheetFinishProfile {
  roughness: number;
  mappedRoughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  bumpScale: number;
  sheen: number;
  sheenRoughness: number;
  sheenColor: string;
  emissive: string;
  emissiveIntensity: number;
  proceduralTexture?: ProceduralPbrMaterialKind;
  baseColor?: string;
}

export const SHEET_MATERIAL_FINISHES: Readonly<
  Record<SheetMaterialFinish, SheetFinishProfile>
> = {
  'parchment-matte': {
    roughness: 0.88,
    mappedRoughness: 1.0,
    metalness: 0,
    clearcoat: 0.03,
    clearcoatRoughness: 0.86,
    bumpScale: 0.0085,
    sheen: 0.14,
    sheenRoughness: 0.9,
    sheenColor: '#F3ECDC',
    emissive: '#000000',
    emissiveIntensity: 0,
    proceduralTexture: 'cotton-paper',
  },
  'woodblock-cotton': {
    roughness: 0.82,
    mappedRoughness: 1.0,
    metalness: 0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.78,
    bumpScale: 0.0105,
    sheen: 0.12,
    sheenRoughness: 0.85,
    sheenColor: '#F3ECDC',
    emissive: '#000000',
    emissiveIntensity: 0,
    proceduralTexture: 'cotton-paper',
  },
  'linen-glaze': {
    roughness: 0.46,
    mappedRoughness: 0.88,
    metalness: 0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.28,
    bumpScale: 0.006,
    sheen: 0.05,
    sheenRoughness: 0.55,
    sheenColor: '#FFFDF7',
    emissive: '#000000',
    emissiveIntensity: 0,
    proceduralTexture: 'linen-weave',
  },
  'cyanotype-blueprint': {
    roughness: 0.42,
    mappedRoughness: 0.78,
    metalness: 0,
    clearcoat: 0.24,
    clearcoatRoughness: 0.24,
    bumpScale: 0.004,
    sheen: 0.18,
    sheenRoughness: 0.45,
    sheenColor: '#9FD3FF',
    emissive: '#3D78C9',
    emissiveIntensity: 0.36,
    proceduralTexture: 'cotton-paper',
  },
  'xray-neon': {
    roughness: 0.34,
    mappedRoughness: 0.72,
    metalness: 0,
    clearcoat: 0.48,
    clearcoatRoughness: 0.18,
    bumpScale: 0.0025,
    sheen: 0.2,
    sheenRoughness: 0.4,
    sheenColor: '#7DD3FC',
    emissive: '#38BDF8',
    emissiveIntensity: 0.32,
  },
};

export function resolveSheetFinishProfile(
  finish: SheetMaterialFinish
): SheetFinishProfile {
  return SHEET_MATERIAL_FINISHES[finish];
}
