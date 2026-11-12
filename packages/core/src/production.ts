import type React from 'react';
import type { AnyZodObject } from 'zod';
import type {
  ProductionCameraCut,
  ProductionManifest,
  ProductionSfxCue,
  SceneVoiceoverData,
} from './types/scene';
import { registerVoiceoverManifest } from './utils/timestamps';

export type BuiltinVisualKitId =
  | 'editorial-collage'
  | 'vector-scene-2d'
  | 'motion-diagrams-2d'
  | 'paper-diorama-3d'
  | 'isometric-3d'
  | 'kinetic-typography'
  | 'data-storytelling';

export type VisualKitId = BuiltinVisualKitId | (string & {});

export interface CompositionSceneSegment {
  sceneId: string;
  fromFrame: number;
  durationInFrames: number;
  label?: string;
}

export interface StudioCompositionEntry {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  kit: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  usesThree: boolean;
  propsFile: string;
  sceneTimeline: CompositionSceneSegment[];
  productionId?: string;
  origin?: 'example' | 'production';
  sfxTimeline?: ProductionSfxCue[];
  cameraTimeline?: ProductionCameraCut[];
  hasMusicScore?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
  schema?: AnyZodObject;
  defaultProps: Record<string, unknown>;
}

export interface DefineProductionSpec {
  id: string;
  title?: string;
  origin?: 'example' | 'production';
  manifest?: ProductionManifest;
  voiceoverManifest?: Record<string, SceneVoiceoverData>;
  compositions: StudioCompositionEntry[];
}

export interface DefinedProduction {
  id: string;
  title: string;
  origin: 'example' | 'production';
  manifest?: ProductionManifest;
  voiceoverManifest?: Record<string, SceneVoiceoverData>;
  compositions: StudioCompositionEntry[];
}

/**
 * Declares an isolated `make.pictures` production or built-in example showcase,
 * automatically normalizing composition metadata (`productionId`, `origin`, `hasMusicScore`)
 * and registering capsule-scoped voiceover timestamps for Studio Web live inspection.
 */
export function defineProduction(spec: DefineProductionSpec): DefinedProduction {
  const resolvedOrigin = spec.origin ?? 'production';
  const resolvedTitle = spec.title ?? spec.manifest?.title ?? spec.id;

  if (spec.voiceoverManifest) {
    registerVoiceoverManifest(spec.voiceoverManifest);
  }

  const normalizedCompositions = spec.compositions.map((comp) => ({
    ...comp,
    productionId: comp.productionId ?? spec.id,
    origin: comp.origin ?? resolvedOrigin,
    hasMusicScore: comp.hasMusicScore ?? Boolean(spec.manifest?.score),
  }));

  return {
    id: spec.id,
    title: resolvedTitle,
    origin: resolvedOrigin,
    manifest: spec.manifest,
    voiceoverManifest: spec.voiceoverManifest,
    compositions: normalizedCompositions,
  };
}

/**
 * Resolves a capsule-relative asset path (e.g. `voiceovers/intro.mp3`, `music/score.mp3`, `sfx/pop.mp3`)
 * to the public mirror path (`_productions/<productionId>/<relPath>`) so `staticFile(productionAssetPath(...))`
 * works identically in both Vite Studio Web and Remotion CLI renders.
 */
export function productionAssetPath(
  productionId: string,
  relPath: string
): string {
  const cleanId = productionId.replace(/^\/+|\/+$/g, '');
  const cleanRel = relPath.replace(/^\/+/, '');
  return `_productions/${cleanId}/${cleanRel}`;
}

export function isVerticalComposition(comp: {
  width: number;
  height: number;
}): boolean {
  return comp.height > comp.width;
}
