import React from 'react';
import type { ProductionCameraCut } from '../types/scene';

export interface StageAnchor3D {
  position: [number, number, number];
  height?: number;
  radius?: number;
  lookOffset?: [number, number, number];
}

export type ShotType3D =
  | 'establishing-wide'
  | 'medium'
  | 'medium-two-shot'
  | 'close-up'
  | 'over-the-shoulder'
  | 'low-angle-hero'
  | 'high-crane'
  | 'custom';

export type CameraTransitionMode = 'cut' | 'glide' | 'whip' | 'orbit';

export interface CameraImpulse {
  frame: number;
  intensity?: number;
  decayFrames?: number;
}

export interface ShotSpec3D {
  fromFrame: number;
  shot: ShotType3D;
  target?: string;
  secondaryTarget?: string;
  transition?: CameraTransitionMode;
  angleDeg?: number;
  fov?: number;
  dollyZoomDeltaFov?: number;
  orbitSpeedDegPerSec?: number;
  customPos?: [number, number, number];
  customLookAt?: [number, number, number];
  label?: string;
}

export interface StageNode2D {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export type CameraTransitionMode2D = 'cut' | 'glide' | 'whip';

export interface ShotSpec2D {
  fromFrame: number;
  target: string | string[];
  transition?: CameraTransitionMode2D;
  padding?: number;
  zoom?: number;
  rotateZ?: number;
  label?: string;
}

export interface CameraKeyframe2D {
  /** Frame when the camera begins moving toward this target */
  startFrame: number;
  /** World X coordinate to center in the viewport */
  x: number;
  /** World Y coordinate to center in the viewport */
  y: number;
  /** Camera zoom factor (1.0 = 1:1 with 1920x1080) */
  zoom: number;
  /** Subtle 2D camera banking angle in degrees */
  rotateZ?: number;
  /** Optional spring stiffness override */
  stiffness?: number;
  /** Optional mid-flight zoom dip for long camera flights */
  flightZoomDip?: number;
  /** Optional mid-flight banking angle (deg) */
  flightBankDeg?: number;
  /** Optional transition mode override */
  transition?: CameraTransitionMode2D;
  /** Optional shot label for telemetry */
  label?: string;
}

export interface DirectorCameraTelemetry {
  /** Normalized instantaneous camera motion velocity in [0, 1] (peaks during whip-pans) */
  velocity: number;
  /** Distance from camera to current focal target in world units */
  focusDistance: number;
  /** Zero-based index of currently active shot in the sorted shot list */
  activeShotIndex: number;
  /** Optional human-readable shot label */
  activeShotLabel?: string;
}

export const DEFAULT_CAMERA_TELEMETRY: DirectorCameraTelemetry = {
  velocity: 0,
  focusDistance: 8,
  activeShotIndex: 0,
};

export const DirectorCameraTelemetryContext =
  React.createContext<DirectorCameraTelemetry>(DEFAULT_CAMERA_TELEMETRY);

/**
 * Deterministic frame-keyed telemetry bridge so viewport HTML overlays
 * (like `<CinematicLensOverlay />` placed outside `<ThreeCanvas>`) automatically
 * receive live `velocity` and `focusDistance` for the exact current `frame`
 * even across separate React / R3F fiber roots, with zero cross-frame state accumulation.
 */
const FRAME_TELEMETRY_SLOTS = new Map<number, DirectorCameraTelemetry>();
const FRAME_TELEMETRY_LISTENERS = new Set<(frame: number) => void>();

export function publishFrameCameraTelemetry(
  frame: number,
  telemetry: DirectorCameraTelemetry
): void {
  const prev = FRAME_TELEMETRY_SLOTS.get(frame);
  if (
    prev &&
    Math.abs(prev.velocity - telemetry.velocity) < 1e-4 &&
    Math.abs(prev.focusDistance - telemetry.focusDistance) < 1e-3 &&
    prev.activeShotIndex === telemetry.activeShotIndex
  ) {
    return;
  }

  FRAME_TELEMETRY_SLOTS.set(frame, telemetry);
  if (FRAME_TELEMETRY_SLOTS.size > 12) {
    const oldestKey = FRAME_TELEMETRY_SLOTS.keys().next().value;
    if (typeof oldestKey === 'number' && oldestKey !== frame) {
      FRAME_TELEMETRY_SLOTS.delete(oldestKey);
    }
  }

  for (const listener of FRAME_TELEMETRY_LISTENERS) {
    listener(frame);
  }
}

export function readFrameCameraTelemetry(
  frame: number
): DirectorCameraTelemetry | undefined {
  return FRAME_TELEMETRY_SLOTS.get(frame);
}

export function subscribeFrameCameraTelemetry(
  listener: (frame: number) => void
): () => void {
  FRAME_TELEMETRY_LISTENERS.add(listener);
  return () => {
    FRAME_TELEMETRY_LISTENERS.delete(listener);
  };
}

/**
 * Converts a declarative `ShotSpec3D[]` or `ShotSpec2D[]` sequence into
 * `ProductionCameraCut[]` entries for the Studio Web Multi-Track Director Timeline.
 */
export function shotsToCameraTimeline(
  shots: ReadonlyArray<{
    fromFrame: number;
    label?: string;
    shot?: string;
    target?: string | string[];
  }>,
  totalDurationInFrames: number
): ProductionCameraCut[] {
  if (!shots.length) return [];
  const sorted = [...shots].sort((a, b) => a.fromFrame - b.fromFrame);
  return sorted.map((s, idx) => {
    const nextStart =
      idx + 1 < sorted.length
        ? sorted[idx + 1].fromFrame
        : totalDurationInFrames;
    const targetName = Array.isArray(s.target)
      ? s.target.join(' + ')
      : s.target;
    const fallbackLabel = s.shot
      ? targetName
        ? `${s.shot} (${targetName})`
        : s.shot
      : targetName || `Shot ${idx + 1}`;
    return {
      shotLabel: s.label ?? fallbackLabel,
      fromFrame: s.fromFrame,
      durationInFrames: Math.max(1, nextStart - s.fromFrame),
    };
  });
}
