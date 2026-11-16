import {
  resolveStyleSpaces,
  type BuiltInStyleId,
  type BuiltinVisualKitId,
  type DimensionalSpace,
  type StylePreset,
} from '@make-pictures/core';

export type StyleLabAspectRatio = '16:9' | '9:16';

export const STYLE_LAB_DURATION_IN_FRAMES = 300;
export const STYLE_LAB_FPS = 60;

export interface SafeStageBounds {
  isVertical: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function resolveKitDimensionalSpace(
  kit: BuiltinVisualKitId
): DimensionalSpace {
  if (kit === 'isometric-3d') return '3d';
  if (kit === 'paper-diorama-3d') return '2.5d';
  return '2d';
}

export function defaultPreviewKitForSpace(
  space: DimensionalSpace
): BuiltinVisualKitId {
  if (space === '3d') return 'isometric-3d';
  if (space === '2.5d') return 'paper-diorama-3d';
  return 'motion-diagrams-2d';
}

export function defaultBuiltInStyleForSpace(
  space: DimensionalSpace
): BuiltInStyleId {
  if (space === '3d') return 'soft-clay';
  if (space === '2.5d') return 'tactile-craft';
  return 'minimal-product';
}

export function resolveCompatibleKitForStyle(
  preset: StylePreset,
  currentKit: BuiltinVisualKitId
): BuiltinVisualKitId {
  const { preferredSpace, spaces } = resolveStyleSpaces(preset);
  const currentSpace = resolveKitDimensionalSpace(currentKit);
  return spaces.includes(currentSpace)
    ? currentKit
    : defaultPreviewKitForSpace(preferredSpace);
}

export const STYLE_LAB_SPACES: ReadonlyArray<{
  id: DimensionalSpace;
  label: string;
  title: string;
}> = [
  {
    id: '2d',
    label: '2D',
    title: 'Przestrzeń 2D (Motion Diagrams)',
  },
  {
    id: '2.5d',
    label: '2.5D',
    title: 'Przestrzeń 2.5D (Paper Diorama)',
  },
  {
    id: '3d',
    label: '3D',
    title: 'Przestrzeń 3D (Isometric Studio)',
  },
];

export const STYLE_LAB_KITS: ReadonlyArray<{
  id: BuiltinVisualKitId;
  label: string;
  badge?: string;
}> = [
  { id: 'editorial-collage', label: 'Editorial Collage' },
  { id: 'vector-scene-2d', label: 'Vector Scene 2D' },
  { id: 'kinetic-typography', label: 'Kinetic Typography' },
  { id: 'data-storytelling', label: 'Data Storytelling' },
  { id: 'motion-diagrams-2d', label: 'Motion Diagrams' },
  { id: 'paper-diorama-3d', label: 'Paper Diorama 3D', badge: '2.5D' },
  { id: 'isometric-3d', label: 'Isometric 3D', badge: '3D' },
];

export type StyleLabCompositionProps = {
  style: StylePreset;
  kit: BuiltinVisualKitId;
};

export function formatTimecode(frame: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 60;
  const totalSec = Math.max(0, frame) / safeFps;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((totalSec - Math.floor(totalSec)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(hundredths).padStart(2, '0')}`;
}

export function getSafeStageBounds(
  width: number,
  height: number
): SafeStageBounds {
  const isVertical = height > width;
  if (isVertical) {
    // Strictly inside 9:16 Golden Safe Box: x in [40, 910], y in [220, 1380] even under optical micro-dolly
    return {
      isVertical: true,
      left: 74,
      top: 266,
      width: 790,
      height: 1054,
    };
  }
  return {
    isVertical: false,
    left: 120,
    top: 108,
    width: width - 240,
    height: height - 216,
  };
}
