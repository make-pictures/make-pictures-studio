import React, { useLayoutEffect, useMemo } from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { StageLightingRig } from '../optics/StageLightingRig';
import { useStudioStyle, withStyleColorAlpha } from '../style';
import { STUDIO_THEME, THEME, useStudioFontsReady } from '../theme';
import { evaluateHandheldNoise, evaluateImpactShake } from './cameraNoise';
import { DirectorCameraTelemetryProvider } from './DirectorCamera3D';
import {
  type CameraImpulse,
  type CameraKeyframe2D,
  type DirectorCameraTelemetry,
  publishFrameCameraTelemetry,
  type ShotSpec2D,
  type StageNode2D,
} from './shotTypes';

export interface EvaluateDirectorCamera2DParams {
  frame: number;
  fps: number;
  stageWidth: number;
  stageHeight: number;
  keyframes?: ReadonlyArray<CameraKeyframe2D>;
  nodes?: Record<string, StageNode2D>;
  shots?: ReadonlyArray<ShotSpec2D>;
  safeBox9x16Compensation?: boolean;
  handheldIntensity?: number;
  impulses?: ReadonlyArray<CameraImpulse>;
  seed?: number;
}

export interface ResolvedCameraState2D {
  x: number;
  y: number;
  zoom: number;
  rotateZ: number;
  telemetry: DirectorCameraTelemetry;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Converts declarative `nodes + shots` into exact `CameraKeyframe2D[]`,
 * automatically fitting single or multi-node bounding boxes into either `16:9`
 * or the `9:16 Golden Safe Box` (`x ∈ [40, 910], y ∈ [220, 1380]`).
 */
export function resolveShotsToKeyframes2D(
  nodes: Record<string, StageNode2D>,
  shots: ReadonlyArray<ShotSpec2D>,
  stageWidth: number,
  stageHeight: number,
  safeBox9x16Compensation = true
): CameraKeyframe2D[] {
  if (!shots.length) return [];

  const sorted = [...shots].sort((a, b) => a.fromFrame - b.fromFrame);
  const isVertical = stageHeight > stageWidth && safeBox9x16Compensation;
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;

  // Golden Safe Box scaled proportionally to viewport resolution (reference 1080x1920)
  const safeLeft = isVertical ? 40 * (stageWidth / 1080) : 80;
  const safeRight = isVertical ? 910 * (stageWidth / 1080) : stageWidth - 80;
  const safeTop = isVertical ? 220 * (stageHeight / 1920) : 64;
  const safeBottom = isVertical
    ? 1380 * (stageHeight / 1920)
    : stageHeight - 64;

  const safeW = Math.max(120, safeRight - safeLeft);
  const safeH = Math.max(120, safeBottom - safeTop);
  const safeCenterX = (safeLeft + safeRight) / 2;
  const safeCenterY = (safeTop + safeBottom) / 2;

  const allNodes = Object.values(nodes);

  return sorted.map((shot) => {
    const targetIds = Array.isArray(shot.target) ? shot.target : [shot.target];
    const matched = targetIds
      .map((id) => nodes[id])
      .filter((n): n is StageNode2D => Boolean(n));
    const boxNodes = matched.length > 0 ? matched : allNodes;

    if (boxNodes.length === 0) {
      return {
        startFrame: shot.fromFrame,
        x: centerX,
        y: centerY,
        zoom: shot.zoom ?? 1,
        rotateZ: shot.rotateZ ?? 0,
        transition: shot.transition ?? 'glide',
        label: shot.label,
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of boxNodes) {
      minX = Math.min(minX, n.cx - n.w / 2);
      maxX = Math.max(maxX, n.cx + n.w / 2);
      minY = Math.min(minY, n.cy - n.h / 2);
      maxY = Math.max(maxY, n.cy + n.h / 2);
    }

    const pad = shot.padding ?? (isVertical ? 56 : 88);
    const boxCx = (minX + maxX) / 2;
    const boxCy = (minY + maxY) / 2;
    const boxW = Math.max(1, maxX - minX + pad * 2);
    const boxH = Math.max(1, maxY - minY + pad * 2);

    const autoZoom = clamp(
      Math.min(safeW / boxW, safeH / boxH),
      0.25,
      isVertical ? 1.18 : 1.32
    );
    const zoom = shot.zoom ?? autoZoom;

    // Exact screen-space anchor solve so `(boxCx, boxCy)` projects onto `(safeCenterX, safeCenterY)`
    const camX = boxCx + (centerX - safeCenterX) / Math.max(0.05, zoom);
    const camY = boxCy + (centerY - safeCenterY) / Math.max(0.05, zoom);

    return {
      startFrame: shot.fromFrame,
      x: camX,
      y: camY,
      zoom,
      rotateZ: shot.rotateZ ?? 0,
      transition: shot.transition ?? 'glide',
      label:
        shot.label ??
        (Array.isArray(shot.target) ? shot.target.join(' + ') : shot.target),
    };
  });
}

/**
 * Pure deterministic 2D infinite-canvas camera solver (`f(frame, fps, ...)`).
 */
export function evaluateDirectorCamera2D(
  params: EvaluateDirectorCamera2DParams
): ResolvedCameraState2D {
  const {
    frame,
    fps,
    stageWidth,
    stageHeight,
    keyframes,
    nodes,
    shots,
    safeBox9x16Compensation = true,
    handheldIntensity = 0,
    impulses = [],
    seed = 2026,
  } = params;

  const effectiveKeyframes: ReadonlyArray<CameraKeyframe2D> =
    keyframes && keyframes.length > 0
      ? [...keyframes].sort((a, b) => a.startFrame - b.startFrame)
      : nodes && shots && shots.length > 0
        ? resolveShotsToKeyframes2D(
            nodes,
            shots,
            stageWidth,
            stageHeight,
            safeBox9x16Compensation
          )
        : [];

  if (effectiveKeyframes.length === 0) {
    return {
      x: stageWidth / 2,
      y: stageHeight / 2,
      zoom: 1,
      rotateZ: 0,
      telemetry: {
        velocity: 0,
        focusDistance: 1,
        activeShotIndex: 0,
      },
    };
  }

  let x = effectiveKeyframes[0].x;
  let y = effectiveKeyframes[0].y;
  let zoom = effectiveKeyframes[0].zoom;
  let rotateZ = effectiveKeyframes[0].rotateZ ?? 0;
  let velocity = 0;
  let activeShotIndex = 0;

  for (let i = 1; i < effectiveKeyframes.length; i++) {
    const prev = effectiveKeyframes[i - 1];
    const curr = effectiveKeyframes[i];

    if (frame < curr.startFrame) {
      break;
    }

    activeShotIndex = i;
    const mode = curr.transition ?? 'glide';

    if (mode === 'cut') {
      x = curr.x;
      y = curr.y;
      zoom = curr.zoom;
      rotateZ = curr.rotateZ ?? 0;
      continue;
    }

    if (mode === 'whip') {
      const p = spring({
        frame: frame - curr.startFrame,
        fps,
        config: {
          damping: 200,
          stiffness: curr.stiffness ?? 150,
          mass: 0.78,
        },
      });
      const clampedP = clamp(p, 0, 1);
      const whipArc = Math.sin(Math.PI * clampedP);
      const dirSign = curr.x - prev.x >= 0 ? 1 : -1;
      const zoomDip = (curr.flightZoomDip ?? -0.08 * curr.zoom) * whipArc;
      const bankAdd = (curr.flightBankDeg ?? -2.4 * dirSign) * whipArc;

      x += (curr.x - prev.x) * p;
      y += (curr.y - prev.y) * p;
      zoom = Math.max(0.12, zoom + (curr.zoom - prev.zoom) * p + zoomDip);
      rotateZ += ((curr.rotateZ ?? 0) - (prev.rotateZ ?? 0)) * p + bankAdd;
      velocity = Math.max(velocity, whipArc);
      continue;
    }

    // Smooth 'glide' spring
    const p = spring({
      frame: frame - curr.startFrame,
      fps,
      config: {
        damping: 200,
        stiffness: curr.stiffness ?? 42,
        mass: 1.25,
      },
    });
    const midFlightArc = 0.5 * (1 - Math.cos(2 * Math.PI * clamp(p, 0, 1)));
    const zoomDip = (curr.flightZoomDip ?? 0) * midFlightArc;
    const bankAdd = (curr.flightBankDeg ?? 0) * midFlightArc;

    x += (curr.x - prev.x) * p;
    y += (curr.y - prev.y) * p;
    zoom = Math.max(0.12, zoom + (curr.zoom - prev.zoom) * p + zoomDip);
    rotateZ += ((curr.rotateZ ?? 0) - (prev.rotateZ ?? 0)) * p + bankAdd;
    velocity = Math.max(velocity, midFlightArc * 0.45);
  }

  const handheld = evaluateHandheldNoise(frame, fps, seed, handheldIntensity);
  const shake = evaluateImpactShake(frame, fps, impulses, seed + 31);

  const invZoom = 1 / Math.max(0.2, zoom);
  const finalX = x + (handheld.x2D + shake.x2D) * invZoom;
  const finalY = y + (handheld.y2D + shake.y2D) * invZoom;
  const finalRotateZ = rotateZ + handheld.rollDeg * 0.65 + shake.rollDeg * 0.8;
  const totalVelocity = clamp(Math.max(velocity, shake.trauma * 0.85), 0, 1);

  const activeKf = effectiveKeyframes[activeShotIndex];

  return {
    x: finalX,
    y: finalY,
    zoom,
    rotateZ: finalRotateZ,
    telemetry: {
      velocity: totalVelocity,
      focusDistance: invZoom * 8,
      activeShotIndex,
      activeShotLabel: activeKf?.label,
    },
  };
}

export interface DirectorCamera2DProps {
  /** Raw camera keyframes (compatible with `CameraRig`) */
  keyframes?: CameraKeyframe2D[];
  /** Named 2D `NodeBox` dictionary for declarative Shot-DSL auto-framing */
  nodes?: Record<string, StageNode2D>;
  /** Declarative Shot-DSL target sequence resolved against `nodes` */
  shots?: ShotSpec2D[];
  stageWidth?: number;
  stageHeight?: number;
  /** Optional explicit polarity override; inherits `useStudioStyle().surface.isDark` when omitted */
  variant?: 'light' | 'dark';
  /** Automatically centers bounded targets inside the `9:16 Golden Safe Box` when `stageHeight > stageWidth` */
  safeBox9x16Compensation?: boolean;
  /** Subtle low-frequency handheld float intensity (default `0`; opt-in for organic drift) */
  handheldIntensity?: number;
  /** Damped harmonic camera shake impulses */
  impulses?: CameraImpulse[];
  seed?: number;
  /** Toggle technical drafting grid (default `true`) */
  showGrid?: boolean;
  /** Render solid `bgCanvas` base fill (default `true`; pass `false` over `<StyleProvider renderBackdrop>`) */
  renderBaseFill?: boolean;
  /** Render directional `<StageLightingRig />` layer (default `true`) */
  renderLighting?: boolean;
  /** Optional viewport-pinned HUD / VFX layer (`<CinematicLensOverlay />`, etc.) */
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Shot-DSL Infinite-Canvas 2D Camera Rig with zero-clipping viewport-pinned
 * drafting grid, directional `<StageLightingRig />`, `9:16 Golden Safe Box`
 * auto-framing, deterministic shake, and live `DirectorCameraTelemetryContext`.
 */
export const DirectorCamera2D: React.FC<DirectorCamera2DProps> = ({
  keyframes,
  nodes,
  shots,
  stageWidth,
  stageHeight,
  variant,
  safeBox9x16Compensation = true,
  handheldIntensity = 0,
  impulses,
  seed = 2026,
  showGrid = true,
  renderBaseFill = true,
  renderLighting = true,
  overlay,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const effectiveWidth = stageWidth ?? width;
  const effectiveHeight = stageHeight ?? height;

  const cam = useMemo(
    () =>
      evaluateDirectorCamera2D({
        frame,
        fps,
        stageWidth: effectiveWidth,
        stageHeight: effectiveHeight,
        keyframes,
        nodes,
        shots,
        safeBox9x16Compensation,
        handheldIntensity,
        impulses,
        seed,
      }),
    [
      frame,
      fps,
      effectiveWidth,
      effectiveHeight,
      keyframes,
      nodes,
      shots,
      safeBox9x16Compensation,
      handheldIntensity,
      impulses,
      seed,
    ]
  );

  useLayoutEffect(() => {
    publishFrameCameraTelemetry(frame, cam.telemetry);
  }, [frame, cam.telemetry]);

  const isDark =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

  const resolvedBgCanvas =
    variant === 'dark' && !studioStyle.surface.isDark
      ? THEME.colors.bgPrimary
      : variant === 'light' && studioStyle.surface.isDark
        ? STUDIO_THEME.colors.bgCanvas
        : studioStyle.palette.bgCanvas;

  // Clean Frame 0 invariant
  if (frame <= 0) {
    return (
      <DirectorCameraTelemetryProvider telemetry={cam.telemetry}>
        {renderBaseFill ? (
          <AbsoluteFill style={{ backgroundColor: resolvedBgCanvas }} />
        ) : null}
      </DirectorCameraTelemetryProvider>
    );
  }

  const centerX = effectiveWidth / 2;
  const centerY = effectiveHeight / 2;

  // Viewport-filling infinite grid math — zero GPU texture clipping at any zoom or pan
  const gridSpacing = Math.max(24, 80 * cam.zoom);
  const dotSpacing = Math.max(16, 40 * cam.zoom);
  const gridOffsetX = centerX - cam.x * cam.zoom;
  const gridOffsetY = centerY - cam.y * cam.zoom;

  const gridLineColor =
    variant !== undefined
      ? isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(15, 23, 42, 0.05)'
      : isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : withStyleColorAlpha(studioStyle.palette.inkBorder, 0.13);

  const gridDotColor =
    variant !== undefined
      ? isDark
        ? 'rgba(226, 232, 240, 0.16)'
        : 'rgba(51, 65, 85, 0.14)'
      : withStyleColorAlpha(studioStyle.palette.accentPrimary, 0.18);

  const isIdentityCamera =
    Math.abs(cam.zoom - 1) < 1e-4 &&
    Math.abs(cam.rotateZ) < 1e-3 &&
    Math.abs(cam.x - centerX) < 0.05 &&
    Math.abs(cam.y - centerY) < 0.05;
  const isCameraSettled =
    cam.telemetry.velocity < 1e-4 &&
    handheldIntensity === 0 &&
    (impulses?.length ?? 0) === 0;
  const isUnrotatedCamera = Math.abs(cam.rotateZ) < 1e-3;
  const isUnitZoomCamera = Math.abs(cam.zoom - 1) < 1e-4;
  const cameraTx = centerX - cam.x * cam.zoom;
  const cameraTy = centerY - cam.y * cam.zoom;
  const cameraTransform = isIdentityCamera
    ? 'none'
    : isUnrotatedCamera
      ? isUnitZoomCamera && isCameraSettled
        ? `translate(${Math.round(cameraTx)}px, ${Math.round(cameraTy)}px)`
        : isUnitZoomCamera
          ? `translate(${cameraTx.toFixed(2)}px, ${cameraTy.toFixed(2)}px)`
          : `translate(${cameraTx.toFixed(2)}px, ${cameraTy.toFixed(2)}px) scale(${cam.zoom.toFixed(5)})`
      : `translate(${centerX}px, ${centerY}px) scale(${cam.zoom}) rotate(${cam.rotateZ}deg) translate(${-cam.x}px, ${-cam.y}px)`;

  return (
    <DirectorCameraTelemetryProvider telemetry={cam.telemetry}>
      <AbsoluteFill
        style={{
          backgroundColor: renderBaseFill ? resolvedBgCanvas : 'transparent',
          overflow: 'hidden',
        }}
      >
        {/* 1. Directional Optical Lighting Rig */}
        {renderLighting ? (
          <StageLightingRig renderBaseFill={false} seed={`cam2d-${seed}`} />
        ) : null}

        {/* 2. Viewport-Pinned Infinite Technical Drafting Grid (Zero GPU Clipping) */}
        {showGrid && (
          <>
            <AbsoluteFill
              style={{
                backgroundImage: `
                  linear-gradient(to right, ${gridLineColor} 1px, transparent 1px),
                  linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)
                `,
                backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
                backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
                pointerEvents: 'none',
              }}
            />
            <AbsoluteFill
              style={{
                backgroundImage: `radial-gradient(${gridDotColor} 1.35px, transparent 1.35px)`,
                backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
                backgroundPosition: `${gridOffsetX + dotSpacing / 2}px ${gridOffsetY + dotSpacing / 2}px`,
                pointerEvents: 'none',
              }}
            />
          </>
        )}

        {/* 3. Zero-Clipping Origin-Anchored Camera Plane */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            transformOrigin: '0 0',
            ...(isIdentityCamera || isCameraSettled
              ? {}
              : { willChange: 'transform' }),
            transform: cameraTransform,
          }}
        >
          {children}
        </div>

        {/* 4. Optional Viewport-Pinned Overlay Slot */}
        {overlay}
      </AbsoluteFill>
    </DirectorCameraTelemetryProvider>
  );
};
