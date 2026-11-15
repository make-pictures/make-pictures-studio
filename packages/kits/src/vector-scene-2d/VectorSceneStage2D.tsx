import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  DepthPlane,
  OpticalStage2D,
  StageLightingRig,
  formatFontFamilyCss,
  useStudioStyle,
  type OpticalShot2D,
  type StageNode2D,
} from '@make-pictures/core';

export interface VectorSceneStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Construction plate code printed on background plane `z = -0.60` */
  plateCode?: string;
  /** Optional elevated callout layer rendered on plane `z = +0.42` */
  foregroundCallouts?: React.ReactNode;
  /** Render subtle calibration corner bracket on `z = +0.72` outside 9:16 Safe Box (default `true`) */
  foregroundAccents?: boolean;
  /** Render base fill inside StageLightingRig (default `true`) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Graphic Plate & Architectural Drafting Stage for `vector-scene-2d`.
 * Layers:
 * - `z = -0.60`: Modular construction axes, registration crosses, and `plateCode`
 * - `z =  0.00`: Primary crisp graphic plate (`children`)
 * - `z = +0.42`: Optional `foregroundCallouts` parallax plane
 * - `z = +0.72`: Edge calibration bracket strictly outside `9:16` Golden Safe Box
 */
export const VectorSceneStage2D: React.FC<VectorSceneStage2DProps> = ({
  shots,
  nodes,
  plateCode = 'TABLICA KONCEPCYJNA • 60 FPS',
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

  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const guideColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.18)'
    : `${style.palette.inkBorder}99`;

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

      <OpticalStage2D
        nodes={nodes}
        shots={shots && shots.length > 0 ? shots : defaultShots}
        seed={seed}
        startFrame={1}
      >
        {/* Plane z = -0.60: Modular Construction Axes & Registration Crosses */}
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
                opacity: 0.5,
              }}
            >
              {/* Golden-ratio vertical & horizontal construction hairlines */}
              <div
                style={{
                  position: 'absolute',
                  left: '38.2%',
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: guideColor,
                  opacity: 0.65,
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
                  opacity: 0.55,
                }}
              />

              {/* Corner registration crosses (+) strictly outside 9:16 Safe Box (y = 204 & y = 1410) */}
              {(
                [
                  { left: -5, top: -8 },
                  { right: -5, top: -8 },
                  { left: -5, bottom: -8 },
                  { right: -5, bottom: -8 },
                ] as const
              ).map((pos, idx) => (
                <span
                  key={idx}
                  style={{
                    position: 'absolute',
                    ...pos,
                    fontFamily: monoFont,
                    fontSize: 12,
                    lineHeight: 1,
                    color: style.palette.textSecondary,
                    opacity: 0.72,
                  }}
                >
                  +
                </span>
              ))}
            </div>

            <div
              style={{
                position: 'absolute',
                left: insetLeft + 10,
                top: Math.max(18, insetTop - 26),
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: monoFont,
                fontSize: 13,
                letterSpacing: '0.15em',
                color: style.palette.textSecondary,
                opacity: 0.64,
              }}
            >
              <span>┼</span>
              <span>{plateCode}</span>
              <span>•</span>
              <span>{style.id.toUpperCase()}</span>
            </div>
          </AbsoluteFill>
        </DepthPlane>

        {/* Plane z = 0.0: Primary Crisp Graphic Plate */}
        <DepthPlane z={0}>{children}</DepthPlane>

        {/* Plane z = +0.42: Optional Elevated Callouts Plane */}
        {foregroundCallouts ? (
          <DepthPlane z={0.42}>{foregroundCallouts}</DepthPlane>
        ) : null}

        {/* Plane z = +0.72: Edge Calibration Bracket (Strictly Outside 9:16 Safe Box) */}
        {foregroundAccents ? (
          <DepthPlane z={0.72}>
            <div
              style={{
                position: 'absolute',
                left: isVertical ? 44 : 76,
                bottom: isVertical ? 126 : 24,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: monoFont,
                fontSize: 12,
                letterSpacing: '0.16em',
                color: style.palette.textSecondary,
                opacity: 0.4,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 12,
                  borderLeft: `2px solid ${style.palette.accentPrimary}`,
                  borderBottom: `2px solid ${style.palette.accentPrimary}`,
                }}
              />
              <span>CAL • 1:1</span>
            </div>
          </DepthPlane>
        ) : null}
      </OpticalStage2D>
    </AbsoluteFill>
  );
};
