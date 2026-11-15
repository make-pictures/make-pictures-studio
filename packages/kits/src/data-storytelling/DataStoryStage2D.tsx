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

export interface DataStoryStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Dataset / scale code printed on the `z = -0.58` cartography sheet */
  datasetCode?: string;
  /** Render subtle vernier edge ticks on `z = +0.68` outside 9:16 Safe Box (default `true`) */
  foregroundAccents?: boolean;
  /** Render base fill inside StageLightingRig (default `true`) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}

/**
 * Multi-plane 2.5D Editorial Data Cartography & Instrument Stage for `data-storytelling`.
 * Layers:
 * - `z = -0.58`: Scale grid sheet (`0 · 25 · 50 · 75 · 100`), corner registration marks, and `datasetCode`
 * - `z =  0.00`: Primary crisp data card / timeline (`children`)
 * - `z = +0.68`: Edge vernier scale strictly outside `9:16` Golden Safe Box
 */
export const DataStoryStage2D: React.FC<DataStoryStage2DProps> = ({
  shots,
  nodes,
  datasetCode = 'ARKUSZ POMIAROWY • 60 FPS',
  foregroundAccents = true,
  renderBaseFill = true,
  seed = 2029,
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
        focalZ: 0.34,
        transition: 'cut',
        label: 'Data Sheet Rack In',
      },
      {
        fromFrame: 6,
        x: cx - 4,
        y: cy,
        zoom: 1.022,
        focalZ: 0,
        transition: 'glide',
        label: 'Data Sheet Hero Focus',
      },
      {
        fromFrame: Math.max(24, Math.round(durationInFrames * 0.58)),
        x: cx + 6,
        y: cy - 3,
        zoom: 1.038,
        focalZ: 0,
        transition: 'glide',
        label: 'Data Sheet Micro Dolly',
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
  const ruleColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.16)'
    : `${style.palette.inkBorder}99`;

  const insetLeft = isVertical ? 40 : 80;
  const insetRight = isVertical ? 168 : 80;
  const insetTop = isVertical ? 206 : 54;
  const insetBottom = isVertical ? 512 : 54;

  const cornerMarks: ReadonlyArray<React.CSSProperties> = [
    { left: insetLeft - 5, top: insetTop - 8 },
    { right: insetRight - 5, top: insetTop - 8 },
    { left: insetLeft - 5, bottom: insetBottom - 8 },
    { right: insetRight - 5, bottom: insetBottom - 8 },
  ];

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <StageLightingRig
        style={style}
        seed={`data-stage:${seed}`}
        renderBaseFill={renderBaseFill}
      />

      <OpticalStage2D
        nodes={nodes}
        shots={shots && shots.length > 0 ? shots : defaultShots}
        seed={seed}
        startFrame={1}
      >
        {/* Plane z = -0.58: Data Cartography Scale Sheet */}
        <DepthPlane z={-0.58}>
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: insetLeft,
                right: insetRight,
                top: insetTop,
                bottom: insetBottom,
                borderTop: `1px solid ${ruleColor}`,
                borderBottom: `1px solid ${ruleColor}`,
                opacity: 0.52,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              {[0, 25, 50, 75, 100].map((pct) => (
                <div
                  key={pct}
                  style={{
                    width: 1,
                    height: '100%',
                    backgroundColor: ruleColor,
                    opacity: pct === 0 || pct === 100 ? 0.85 : 0.45,
                  }}
                />
              ))}
            </div>

            {cornerMarks.map((pos, idx) => (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  ...pos,
                  fontFamily: monoFont,
                  fontSize: 12,
                  lineHeight: 1,
                  color: style.palette.textSecondary,
                  opacity: 0.5,
                }}
              >
                +
              </span>
            ))}

            <div
              style={{
                position: 'absolute',
                left: insetLeft + 8,
                top: Math.max(18, insetTop - 26),
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: monoFont,
                fontSize: 13,
                letterSpacing: '0.15em',
                color: style.palette.textSecondary,
                opacity: 0.62,
              }}
            >
              <span>∑</span>
              <span>{datasetCode}</span>
              <span>•</span>
              <span>0 · 25 · 50 · 75 · 100</span>
            </div>
          </AbsoluteFill>
        </DepthPlane>

        {/* Plane z = 0.0: Primary Crisp Data Plane */}
        <DepthPlane z={0}>{children}</DepthPlane>

        {/* Plane z = +0.68: Edge Vernier Calibration Ticks (Outside 9:16 Safe Box) */}
        {foregroundAccents ? (
          <DepthPlane z={0.68}>
            <div
              style={{
                position: 'absolute',
                left: isVertical ? 44 : 84,
                bottom: isVertical ? 124 : 22,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 7,
                opacity: 0.38,
              }}
            >
              {Array.from({ length: 13 }).map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 1.5,
                    height: idx % 4 === 0 ? 15 : 8,
                    backgroundColor:
                      idx === 0
                        ? style.palette.accentPrimary
                        : style.palette.textSecondary,
                  }}
                />
              ))}
            </div>
          </DepthPlane>
        ) : null}
      </OpticalStage2D>
    </AbsoluteFill>
  );
};
