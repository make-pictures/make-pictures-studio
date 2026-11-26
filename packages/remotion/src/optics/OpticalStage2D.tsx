import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { FillLayer } from '../FillLayer';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  publishFrameCameraTelemetry,
  type CameraImpulse,
  type StageNode2D,
} from '../camera/shotTypes';
import { DirectorCameraTelemetryProvider } from '../camera/telemetry';
import { useStudioStyle } from '../style';
import {
  computeCircleOfConfusionPx,
  computeParallaxFactor,
  computePlaneAtmosphericOpacity,
  evaluateOpticalCamera2D,
  type OpticalShot2D,
  type ResolvedOpticalCameraState2D,
} from './math';

export interface OpticalStageContextValue {
  camera: ResolvedOpticalCameraState2D;
  stageWidth: number;
  stageHeight: number;
}

const OpticalStageContext = createContext<OpticalStageContextValue | null>(null);

export function useOpticalStage(): OpticalStageContextValue | null {
  return useContext(OpticalStageContext);
}

export interface OpticalStage2DProps {
  nodes?: Record<string, StageNode2D>;
  shots?: ReadonlyArray<OpticalShot2D>;
  stageWidth?: number;
  stageHeight?: number;
  safeBox9x16Compensation?: boolean;
  handheldIntensity?: number;
  impulses?: ReadonlyArray<CameraImpulse>;
  seed?: number;
  /** Minimum frame before stage contents mount (default `1` so Frame `0` stays pure `bgCanvas`) */
  startFrame?: number;
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Optical Camera Stage (`60 FPS` deterministic).
 * Drives child `<DepthPlane z={...} />` layers with true Z-parallax,
 * `9:16 Golden Safe Box` compensation, and Circle-of-Confusion rack focus.
 */
export const OpticalStage2D: React.FC<OpticalStage2DProps> = ({
  nodes,
  shots,
  stageWidth,
  stageHeight,
  safeBox9x16Compensation = true,
  handheldIntensity,
  impulses,
  seed = 2026,
  startFrame = 1,
  overlay,
  style: styleOverrides,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const studioStyle = useStudioStyle();

  const effectiveWidth = stageWidth ?? width;
  const effectiveHeight = stageHeight ?? height;

  const camera = useMemo(
    () =>
      evaluateOpticalCamera2D({
        frame,
        fps,
        stageWidth: effectiveWidth,
        stageHeight: effectiveHeight,
        style: studioStyle,
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
      studioStyle,
      nodes,
      shots,
      safeBox9x16Compensation,
      handheldIntensity,
      impulses,
      seed,
    ]
  );

  useLayoutEffect(() => {
    publishFrameCameraTelemetry(frame, camera.telemetry);
  }, [frame, camera.telemetry]);

  const contextVal = useMemo<OpticalStageContextValue>(
    () => ({
      camera,
      stageWidth: effectiveWidth,
      stageHeight: effectiveHeight,
    }),
    [camera, effectiveWidth, effectiveHeight]
  );

  // Clean Frame 0 guard
  if (frame <= 0 || frame < startFrame) {
    return null;
  }

  return (
    <DirectorCameraTelemetryProvider telemetry={camera.telemetry}>
      <OpticalStageContext.Provider value={contextVal}>
        <FillLayer
          style={{
            overflow: 'hidden',
            pointerEvents: 'none',
            isolation: 'isolate',
            contain: 'layout paint style',
            ...styleOverrides,
          }}
        >
          {children}
          {overlay}
        </FillLayer>
      </OpticalStageContext.Provider>
    </DirectorCameraTelemetryProvider>
  );
};

export interface DepthPlaneProps {
  /** Depth coordinate in `[-2.0, +1.5]` (`0` = primary hero plane, `< 0` = background, `> 0` = foreground) */
  z?: number;
  /** Disable optical Circle-of-Confusion blur on this plane if needed */
  disableFocusBlur?: boolean;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Physical Z-plane inside `<OpticalStage2D />`.
 * Applies parallax-scaled camera translation/zoom and Circle-of-Confusion blur (`filter: 'none'` inside `< 0.25px` deadzone).
 */
export const DepthPlane: React.FC<DepthPlaneProps> = ({
  z = 0,
  disableFocusBlur = false,
  style,
  className,
  children,
}) => {
  const stage = useOpticalStage();

  if (!stage) {
    return (
      <FillLayer className={className} style={style}>
        {children}
      </FillLayer>
    );
  }

  const { camera, stageWidth, stageHeight } = stage;
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;

  const parallax = computeParallaxFactor(z);
  const dx = (camera.x - centerX) * parallax;
  const dy = (camera.y - centerY) * parallax;
  const planeScale = Math.max(0.15, 1 + (camera.zoom - 1) * parallax);
  const planeRotate = camera.rotateZ * (0.65 + 0.35 * Math.min(1.2, parallax));

  const blurPx = disableFocusBlur
    ? 0
    : computeCircleOfConfusionPx(z, camera.focalZ, camera.aperture);
  const filterCss = blurPx < 0.25 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;
  const planeOpacity = computePlaneAtmosphericOpacity(z, camera.focalZ);
  const hasVisibleRotate = Math.abs(planeRotate) >= 0.02;
  const isIdentityTransform =
    Math.abs(dx) < 0.05 &&
    Math.abs(dy) < 0.05 &&
    Math.abs(planeScale - 1) < 0.0002 &&
    !hasVisibleRotate;
  const transformCss = isIdentityTransform
    ? 'none'
    : hasVisibleRotate
      ? `translate3d(${(-dx).toFixed(2)}px, ${(-dy).toFixed(2)}px, 0) scale(${planeScale.toFixed(4)}) rotate(${planeRotate.toFixed(3)}deg)`
      : `translate3d(${(-dx).toFixed(2)}px, ${(-dy).toFixed(2)}px, 0) scale(${planeScale.toFixed(4)})`;

  return (
    <FillLayer
      className={className}
      data-depth-z={z}
      style={{
        transformOrigin: '50% 50%',
        transform: transformCss,
        backfaceVisibility: 'hidden',
        filter: filterCss,
        opacity: planeOpacity,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {children}
    </FillLayer>
  );
};
