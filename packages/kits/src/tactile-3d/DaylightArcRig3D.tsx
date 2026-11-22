import React from 'react';
import { useCurrentFrame } from 'remotion';
import {
  DEFAULT_STUDIO_IBL_PANELS,
  SyncStudioIbl3D,
  type SyncIblPanelSpec,
} from './SyncStudioIbl3D';

export interface DaylightArcOptions {
  sceneLampMultiplier?: number;
  atmosphereBlend?: number;
}

export interface DaylightArcLightingState {
  timeOfDay: number;
  keyPosition: [number, number, number];
  keyColor: string;
  keyIntensity: number;
  fillPosition: [number, number, number];
  fillColor: string;
  fillIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  environmentIntensity: number;
  toneMappingExposure: number;
}

export interface DaylightArcRig3DProps {
  /** `0.0` crisp morning -> `0.5` golden afternoon -> `1.0` focused warm desk lamp (default `0.15`). */
  timeOfDay?: number;
  /** Multiplier from `computeGlassLightingBlend().sceneLampMultiplier` (default `1`). */
  sceneLampMultiplier?: number;
  /** Optional `0..1` blend toward dark/atmospheric scenes lowering IBL intensity (default `0`). */
  atmosphereBlend?: number;
  shadowMapSize?: number;
  shadowBounds?: number;
  panels?: ReadonlyArray<SyncIblPanelSpec>;
  backgroundColor?: string;
  cleanFrameZero?: boolean;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleTriStopNumber(
  t: number,
  morning: number,
  afternoon: number,
  evening: number
): number {
  const c = clamp01(t);
  return c <= 0.5
    ? lerp(morning, afternoon, c * 2)
    : lerp(afternoon, evening, (c - 0.5) * 2);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function sampleTriStopHex(
  t: number,
  morningHex: string,
  afternoonHex: string,
  eveningHex: string
): string {
  const c = clamp01(t);
  const [aHex, bHex, localT] =
    c <= 0.5
      ? [morningHex, afternoonHex, c * 2]
      : [afternoonHex, eveningHex, (c - 0.5) * 2];
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  return rgbToHex(
    lerp(a[0], b[0], localT),
    lerp(a[1], b[1], localT),
    lerp(a[2], b[2], localT)
  );
}

/**
 * Pure deterministic solver for a 3-stop time-of-day studio lighting arc:
 * `0.0` crisp sunlit morning -> `0.5` warm golden afternoon -> `1.0` focused evening desk lamp.
 */
export function evaluateTimeOfDayLighting(
  rawTimeOfDay: number,
  options: DaylightArcOptions = {}
): DaylightArcLightingState {
  const timeOfDay = clamp01(rawTimeOfDay);
  const lampMult = Math.max(0, options.sceneLampMultiplier ?? 1);
  const atmo = clamp01(options.atmosphereBlend ?? 0);

  const keyPosition: [number, number, number] = [
    sampleTriStopNumber(timeOfDay, -4.2, -2.6, -1.1),
    sampleTriStopNumber(timeOfDay, 5.4, 4.4, 4.8),
    sampleTriStopNumber(timeOfDay, 3.6, 4.1, 2.8),
  ];
  const fillPosition: [number, number, number] = [
    sampleTriStopNumber(timeOfDay, 4.6, 4.2, 3.6),
    sampleTriStopNumber(timeOfDay, 3.4, 2.8, 2.4),
    sampleTriStopNumber(timeOfDay, 2.6, 2.2, 1.8),
  ];

  const baseEnv = sampleTriStopNumber(timeOfDay, 1.0, 0.88, 0.68);
  const environmentIntensity = lerp(baseEnv, Math.min(baseEnv, 0.52), atmo);

  return {
    timeOfDay,
    keyPosition,
    keyColor: sampleTriStopHex(timeOfDay, '#FFF9EC', '#FFE8BE', '#FFD8A0'),
    keyIntensity: sampleTriStopNumber(timeOfDay, 1.42, 1.32, 1.18) * lampMult,
    fillPosition,
    fillColor: sampleTriStopHex(timeOfDay, '#DFF0FF', '#E8E3D5', '#9FB6D4'),
    fillIntensity: sampleTriStopNumber(timeOfDay, 0.52, 0.42, 0.28) * lampMult,
    hemiSkyColor: sampleTriStopHex(timeOfDay, '#FFFDF8', '#FFF3DC', '#E6D6BC'),
    hemiGroundColor: sampleTriStopHex(timeOfDay, '#D6C4A4', '#B89A6E', '#7C6245'),
    hemiIntensity: sampleTriStopNumber(timeOfDay, 0.58, 0.48, 0.34) * lampMult,
    environmentIntensity,
    toneMappingExposure: sampleTriStopNumber(timeOfDay, 0.96, 0.94, 0.91),
  };
}

export const DaylightArcRig3D: React.FC<DaylightArcRig3DProps> = ({
  timeOfDay = 0.15,
  sceneLampMultiplier = 1,
  atmosphereBlend = 0,
  shadowMapSize = 2048,
  shadowBounds = 6.5,
  panels = DEFAULT_STUDIO_IBL_PANELS,
  backgroundColor = '#B8AE9D',
  cleanFrameZero = true,
}) => {
  const frame = useCurrentFrame();
  if (cleanFrameZero && frame <= 0) {
    return null;
  }

  const state = evaluateTimeOfDayLighting(timeOfDay, {
    sceneLampMultiplier,
    atmosphereBlend,
  });

  return (
    <group name="daylight-arc-rig-3d">
      <SyncStudioIbl3D
        panels={panels}
        backgroundColor={backgroundColor}
        environmentIntensity={state.environmentIntensity}
      />

      <hemisphereLight
        args={[state.hemiSkyColor, state.hemiGroundColor, state.hemiIntensity]}
      />

      <directionalLight
        position={state.keyPosition}
        intensity={state.keyIntensity}
        color={state.keyColor}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
        shadow-camera-left={-shadowBounds}
        shadow-camera-right={shadowBounds}
        shadow-camera-top={shadowBounds}
        shadow-camera-bottom={-shadowBounds}
      />

      <directionalLight
        position={state.fillPosition}
        intensity={state.fillIntensity}
        color={state.fillColor}
      />
    </group>
  );
};
