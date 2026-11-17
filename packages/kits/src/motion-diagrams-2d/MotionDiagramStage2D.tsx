import React, { createContext, useContext, useMemo } from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  DirectorCamera2D,
  STUDIO_THEME,
  ScenicBackdropLayers,
  StageLightingRig,
  THEME,
  computeCircleOfConfusionPx,
  formatFontFamilyCss,
  getStyleSpringConfig,
  resolveStyleOptics,
  useStudioStyle,
  type DirectorCamera2DProps,
  type ShotSpec2D,
} from '@make-pictures/core';

export type MotionDiagramFocusState = 'auto' | 'sharp' | 'recessed';

export interface ResolvedNodeFocusOptics {
  isRecessed: boolean;
  blurPx: number;
  filterCss: string;
  opacityScale: number;
  scaleFactor: number;
}

interface MotionDiagramFocusContextValue {
  resolveNodeFocus: (
    nodeId: string | undefined,
    explicitState?: MotionDiagramFocusState
  ) => ResolvedNodeFocusOptics;
}

const MotionDiagramFocusContext =
  createContext<MotionDiagramFocusContextValue | null>(null);

export function useMotionDiagramFocus(): MotionDiagramFocusContextValue | null {
  return useContext(MotionDiagramFocusContext);
}

function getShotTargetSet(shot: ShotSpec2D): Set<string> {
  const arr = Array.isArray(shot.target) ? shot.target : [shot.target];
  return new Set(arr.filter(Boolean));
}

export interface MotionDiagramStage2DProps
  extends Omit<DirectorCamera2DProps, 'children'> {
  /** Explicit focused node IDs; when omitted, derives focus automatically from `shots` */
  focusedNodeIds?: ReadonlyArray<string>;
  /** Optional viewport-pinned sheet stamp (omitted by default; rendered only when explicitly non-empty) */
  diagramCode?: string;
  /** Render 3-ArtWorld `<ScenicBackdropLayers />` behind the camera grid & nodes (default `true`) */
  showScenicBackdrop?: boolean;
  children?: React.ReactNode;
}

export const MotionDiagramStage2D: React.FC<MotionDiagramStage2DProps> = ({
  focusedNodeIds,
  diagramCode,
  showScenicBackdrop = true,
  shots,
  overlay,
  stageWidth,
  stageHeight,
  variant,
  seed = 2026,
  renderBaseFill = true,
  renderLighting = true,
  children,
  ...cameraProps
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const cameraSpring = getStyleSpringConfig(studioStyle, 'camera');

  const effectiveWidth = stageWidth ?? width;
  const effectiveHeight = stageHeight ?? height;
  const isVertical = effectiveHeight > effectiveWidth;

  const isDarkSurface =
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

  const sortedShots = useMemo(
    () =>
      shots && shots.length > 0
        ? [...shots].sort((a, b) => a.fromFrame - b.fromFrame)
        : [],
    [shots]
  );

  const explicitFocusSet = useMemo(
    () => (focusedNodeIds ? new Set(focusedNodeIds) : null),
    [focusedNodeIds]
  );

  const focusCtx = useMemo<MotionDiagramFocusContextValue>(() => {
    const buildOptics = (recessAmount: number): ResolvedNodeFocusOptics => {
      const clamped = Math.max(0, Math.min(1, recessAmount));
      const isRecessed = clamped > 0.35;
      const rawBlur = computeCircleOfConfusionPx(
        -0.28 * clamped,
        0,
        optics.aperture
      );

      if (rawBlur === 0) {
        return {
          isRecessed,
          blurPx: 0,
          filterCss: 'none',
          opacityScale: isDarkSurface
            ? 1 - 0.28 * clamped
            : 1 - 0.12 * clamped,
          scaleFactor: 1 - (isDarkSurface ? 0.022 : 0.015) * clamped,
        };
      }

      if (!isDarkSurface) {
        const cappedBlur = Number(Math.min(1.85, rawBlur).toFixed(2));
        const sat = Number((1 - 0.12 * clamped).toFixed(2));
        return {
          isRecessed,
          blurPx: cappedBlur,
          filterCss: `blur(${cappedBlur.toFixed(2)}px) saturate(${sat})`,
          opacityScale: 1 - 0.12 * clamped,
          scaleFactor: 1 - 0.015 * clamped,
        };
      }

      return {
        isRecessed,
        blurPx: rawBlur,
        filterCss: `blur(${rawBlur.toFixed(2)}px)`,
        opacityScale: 1 - 0.28 * clamped,
        scaleFactor: 1 - 0.022 * clamped,
      };
    };

    return {
      resolveNodeFocus(nodeId, explicitState = 'auto') {
        if (explicitState === 'sharp') {
          return buildOptics(0);
        }
        if (explicitState === 'recessed') {
          return buildOptics(1);
        }
        if (!nodeId) {
          return buildOptics(0);
        }
        if (explicitFocusSet) {
          return buildOptics(explicitFocusSet.has(nodeId) ? 0 : 1);
        }
        if (sortedShots.length === 0) {
          return buildOptics(0);
        }

        let focusWeight = getShotTargetSet(sortedShots[0]!).has(nodeId) ? 1 : 0;
        for (let i = 1; i < sortedShots.length; i++) {
          const prevShot = sortedShots[i - 1]!;
          const currShot = sortedShots[i]!;
          if (frame < currShot.fromFrame) {
            break;
          }
          const prevW = getShotTargetSet(prevShot).has(nodeId) ? 1 : 0;
          const currW = getShotTargetSet(currShot).has(nodeId) ? 1 : 0;
          if (currShot.transition === 'cut') {
            focusWeight = currW;
            continue;
          }
          const p = spring({
            frame: frame - currShot.fromFrame,
            fps,
            config:
              currShot.transition === 'whip'
                ? { damping: 200, stiffness: 150, mass: 0.78 }
                : cameraSpring,
          });
          focusWeight += (currW - prevW) * p;
        }

        return buildOptics(1 - focusWeight);
      },
    };
  }, [
    cameraSpring,
    explicitFocusSet,
    fps,
    frame,
    isDarkSurface,
    optics.aperture,
    sortedShots,
  ]);

  const cleanDiagramCode = diagramCode?.trim() ? diagramCode.trim() : undefined;

  const headerEnter =
    frame < 2
      ? 0
      : spring({
          frame: frame - 2,
          fps,
          config: getStyleSpringConfig(studioStyle, 'enter'),
        });

  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const composedOverlay = (
    <>
      {cleanDiagramCode && frame >= 2 ? (
        <div
          data-diagram-stamp="true"
          style={{
            position: 'absolute',
            left: isVertical ? 76 : 64,
            top: isVertical ? 236 : 44,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 12px',
            backgroundColor: `${studioStyle.palette.bgSurface}E6`,
            border: `1px solid ${studioStyle.palette.inkBorder}`,
            borderLeft: `3px solid ${studioStyle.palette.accentPrimary}`,
            fontFamily: monoFontCss,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: studioStyle.palette.textSecondary,
            opacity: headerEnter,
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: studioStyle.palette.accentPrimary }}>┼</span>
          <span>{cleanDiagramCode}</span>
        </div>
      ) : null}
      {overlay}
    </>
  );

  // Clean Frame 0 invariant: delegate directly so frame <= 0 renders pure bgCanvas (or null)
  if (frame <= 0) {
    return (
      <MotionDiagramFocusContext.Provider value={focusCtx}>
        <DirectorCamera2D
          shots={shots}
          stageWidth={effectiveWidth}
          stageHeight={effectiveHeight}
          variant={variant}
          seed={seed}
          renderBaseFill={renderBaseFill}
          renderLighting={renderLighting}
          overlay={composedOverlay}
          {...cameraProps}
        >
          {children}
        </DirectorCamera2D>
      </MotionDiagramFocusContext.Provider>
    );
  }

  return (
    <MotionDiagramFocusContext.Provider value={focusCtx}>
      <AbsoluteFill
        style={{
          backgroundColor: renderBaseFill ? resolvedBgCanvas : 'transparent',
          overflow: 'hidden',
        }}
      >
        {renderLighting ? (
          <StageLightingRig renderBaseFill={false} seed={`cam2d-${seed}`} />
        ) : null}

        {showScenicBackdrop ? (
          <ScenicBackdropLayers
            style={studioStyle}
            seed={`motion-diagram:${seed}`}
          />
        ) : null}

        <DirectorCamera2D
          shots={shots}
          stageWidth={effectiveWidth}
          stageHeight={effectiveHeight}
          variant={variant}
          seed={seed}
          renderBaseFill={false}
          renderLighting={false}
          overlay={composedOverlay}
          {...cameraProps}
        >
          {children}
        </DirectorCamera2D>
      </AbsoluteFill>
    </MotionDiagramFocusContext.Provider>
  );
};
