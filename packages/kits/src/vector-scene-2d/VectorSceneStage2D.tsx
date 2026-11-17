import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
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

export interface VectorSceneStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Optional construction plate code on background plane `z = -0.60` (omitted by default) */
  plateCode?: string;
  /** Render 3-ArtWorld `<ScenicBackdropLayers />` behind the optical stage (default `true`) */
  showScenicBackdrop?: boolean;
  /** Optional elevated callout layer rendered on plane `z = +0.42` */
  foregroundCallouts?: React.ReactNode;
  /** Render subtle corner registration bracket on `z = +0.72` outside 9:16 Safe Box (default `true`) */
  foregroundAccents?: boolean;
  /** Render base fill inside StageLightingRig (default `true`) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Graphic Plate & Architectural Stage for `vector-scene-2d`.
 * Layers:
 * - `<StageLightingRig />` + `<ScenicBackdropLayers />` (3 Artistic Worlds)
 * - `z = -0.60`: Subtle modular construction axes & optional `plateCode`
 * - `z =  0.00`: Primary crisp graphic plate (`children`)
 * - `z = +0.42`: Optional `foregroundCallouts` parallax plane
 * - `z = +0.72`: Quiet corner bracket strictly outside `9:16` Golden Safe Box
 */
export const VectorSceneStage2D: React.FC<VectorSceneStage2DProps> = ({
  shots,
  nodes,
  plateCode,
  showScenicBackdrop = true,
  foregroundCallouts,
  foregroundAccents = true,
  renderBaseFill = true,
  seed = 2028,
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
        y: cy + 6,
        zoom: 1.0,
        focalZ: 0.36,
        transition: 'cut',
        label: 'Plate Rack In',
      },
      {
        fromFrame: 6,
        x: cx - 5,
        y: cy,
        zoom: 1.024,
        focalZ: 0,
        transition: 'glide',
        label: 'Plate Hero Focus',
      },
      {
        fromFrame: Math.max(24, Math.round(durationInFrames * 0.56)),
        x: cx + 7,
        y: cy - 4,
        zoom: 1.042,
        focalZ: 0,
        transition: 'glide',
        label: 'Plate Micro Dolly',
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

  const cleanPlateCode = plateCode?.trim() ? plateCode.trim() : undefined;
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const guideColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.16)'
    : `${style.palette.inkBorder}80`;

  const insetLeft = isVertical ? 40 : 72;
  const insetRight = isVertical ? 164 : 72;
  const insetTop = isVertical ? 204 : 56;
  const insetBottom = isVertical ? 510 : 56;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <StageLightingRig
        style={style}
        seed={`vector-plate:${seed}`}
        renderBaseFill={renderBaseFill}
      />

      {showScenicBackdrop ? (
        <ScenicBackdropLayers style={style} seed={`vector-plate:${seed}`} />
      ) : null}

      <OpticalStage2D
        nodes={nodes}
        shots={shots && shots.length > 0 ? shots : defaultShots}
        seed={seed}
        startFrame={1}
      >
        {/* Plane z = -0.60: Subtle Modular Construction Axes */}
        <DepthPlane z={-0.6}>
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: insetLeft,
                right: insetRight,
                top: insetTop,
                bottom: insetBottom,
                border: `1px solid ${guideColor}`,
                opacity: 0.36,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '38.2%',
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: guideColor,
                  opacity: 0.52,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '50%',
                  height: 1,
                  backgroundColor: guideColor,
                  opacity: 0.45,
                }}
              />
            </div>

            {cleanPlateCode ? (
              <div
                style={{
                  position: 'absolute',
                  left: insetLeft + 10,
                  top: Math.max(18, insetTop - 26),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: monoFont,
                  fontSize: 18,
                  letterSpacing: '0.12em',
                  color: style.palette.textSecondary,
                  opacity: 0.62,
                }}
              >
                <span>┼</span>
                <span>{cleanPlateCode}</span>
              </div>
            ) : null}
          </AbsoluteFill>
        </DepthPlane>

        {/* Plane z = 0.0: Primary Crisp Graphic Plate */}
        <DepthPlane z={0}>{children}</DepthPlane>

        {/* Plane z = +0.42: Optional Elevated Callouts Plane */}
        {foregroundCallouts ? (
          <DepthPlane z={0.42}>{foregroundCallouts}</DepthPlane>
        ) : null}

        {/* Plane z = +0.72: Quiet Corner Registration Bracket (Strictly Outside 9:16 Safe Box) */}
        {foregroundAccents ? (
          <DepthPlane z={0.72}>
            <div
              style={{
                position: 'absolute',
                left: isVertical ? 44 : 76,
                bottom: isVertical ? 126 : 24,
                width: 18,
                height: 12,
                borderLeft: `1.5px solid ${style.palette.accentPrimary}`,
                borderBottom: `1.5px solid ${style.palette.accentPrimary}`,
                opacity: 0.36,
              }}
            />
          </DepthPlane>
        ) : null}
      </OpticalStage2D>
    </AbsoluteFill>
  );
};
