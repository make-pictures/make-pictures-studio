import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  DepthPlane,
  OpticalStage2D,
  ScenicBackdropLayers,
  StageLightingRig,
  formatFontFamilyCss,
  useStudioStyle,
  type OpticalShot2D,
  type StageNode2D,
} from '@make-pictures/core';

export interface EditorialDeskStageProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Optional archival registration code on background sheet (`z = -0.65`); omitted by default */
  sheetCode?: string;
  /** Render 3-ArtWorld `<ScenicBackdropLayers />` behind the optical stage (default `true`) */
  showScenicBackdrop?: boolean;
  /** Render subtle out-of-focus foreground accents on plane `z = +0.75` outside Safe Box (default `true`) */
  foregroundAccents?: boolean;
  /** Render base fill inside StageLightingRig (default `true`) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Analog Editorial Desk / Gallery Stage.
 * Combines `<StageLightingRig />` + `<ScenicBackdropLayers />` with `<OpticalStage2D />` across 3 Z-planes:
 * - `z = -0.65`: Archival passe-partout registration sheet
 * - `z =  0.00`: Primary editorial content (`children`)
 * - `z = +0.75`: Edge-safe optical foreground millimeter ruler bokeh
 */
export const EditorialDeskStage: React.FC<EditorialDeskStageProps> = ({
  shots,
  nodes,
  sheetCode,
  showScenicBackdrop = true,
  foregroundAccents = true,
  renderBaseFill = true,
  seed = 2026,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  const defaultShots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      {
        fromFrame: 0,
        x: cx,
        y: cy + 8,
        zoom: 1.0,
        focalZ: 0.35,
        transition: 'cut',
        label: 'Desk Rack In',
      },
      {
        fromFrame: 6,
        x: cx - 6,
        y: cy,
        zoom: 1.028,
        focalZ: 0,
        transition: 'glide',
        label: 'Desk Hero Focus',
      },
      {
        fromFrame: Math.max(24, Math.round(durationInFrames * 0.55)),
        x: cx + 8,
        y: cy - 4,
        zoom: 1.045,
        focalZ: 0,
        transition: 'glide',
        label: 'Desk Micro Dolly',
      },
    ];
  }, [width, height, durationInFrames]);

  // Clean Frame 0 invariant
  if (frame <= 0) {
    return renderBaseFill ? (
      <AbsoluteFill
        style={{ backgroundColor: style.palette.bgCanvas, pointerEvents: 'none' }}
      />
    ) : null;
  }

  const cleanSheetCode = sheetCode?.trim() ? sheetCode.trim() : undefined;
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const markColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.2)'
    : `${style.palette.inkBorder}88`;

  const insetX = isVertical ? 36 : 64;
  const insetTop = isVertical ? 196 : 48;
  const insetBottom = isVertical ? 496 : 48;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <StageLightingRig
        style={style}
        seed={`editorial-desk:${seed}`}
        renderBaseFill={renderBaseFill}
      />

      {showScenicBackdrop ? (
        <ScenicBackdropLayers
          style={style}
          seed={`editorial-desk:${seed}`}
        />
      ) : null}

      <OpticalStage2D
        nodes={nodes}
        shots={shots && shots.length > 0 ? shots : defaultShots}
        seed={seed}
        startFrame={1}
      >
        {/* Plane z = -0.65: Background Passe-Partout Registration Sheet */}
        <DepthPlane z={-0.65}>
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: insetX,
                right: isVertical ? 148 : insetX,
                top: insetTop,
                bottom: insetBottom,
                border: `1px solid ${markColor}`,
                opacity: 0.42,
              }}
            />
            {cleanSheetCode ? (
              <div
                style={{
                  position: 'absolute',
                  left: insetX + 12,
                  top: Math.max(18, insetTop - 26),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  fontFamily: monoFont,
                  fontSize: 18,
                  letterSpacing: '0.12em',
                  color: style.palette.textSecondary,
                  opacity: 0.62,
                }}
              >
                <span>+</span>
                <span>{cleanSheetCode}</span>
              </div>
            ) : null}
          </AbsoluteFill>
        </DepthPlane>

        {/* Plane z = 0.0: Primary Crisp Editorial Surface */}
        <DepthPlane z={0}>{children}</DepthPlane>

        {/* Plane z = +0.75: Out-of-Focus Edge Scale (Strictly Outside Safe Box) */}
        {foregroundAccents && (
          <DepthPlane z={0.75}>
            <div
              style={{
                position: 'absolute',
                left: isVertical ? 44 : 72,
                bottom: isVertical ? 120 : 22,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                opacity: 0.34,
              }}
            >
              {Array.from({ length: 16 }).map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 1.5,
                    height: idx % 5 === 0 ? 15 : 8,
                    backgroundColor: style.palette.textSecondary,
                  }}
                />
              ))}
            </div>
          </DepthPlane>
        )}
      </OpticalStage2D>
    </AbsoluteFill>
  );
};
