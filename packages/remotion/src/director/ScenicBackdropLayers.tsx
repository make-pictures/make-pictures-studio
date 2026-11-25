import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useOpticalStage } from '../optics';
import {
  resolveArtWorld,
  resolveStyleOptics,
  useStudioStyle,
  type StylePreset,
} from '../style';
import { createSeededRandom } from '../utils';

export interface ScenicBackdropLayersProps {
  style?: StylePreset;
  seed?: string | number;
  intensity?: number;
  className?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Gallery-grade deterministic 60 FPS background scenery adapted to `resolveArtWorld(style)`:
 * - `'atelier'`: studio cyclorama horizon arc, subtle floor reflection pool, soft optical glass caustics.
 * - `'illustrative'`: warm multi-layered parallax hills, soft organic clouds, celestial sun/moon disc, subtle botanical/geometric accents.
 * - `'editorial-gallery'`: architectural passe-partout frame lines, soft diagonal window shadow cast, subtle tonal gallery planes.
 *
 * Strictly returns `null` when `frame <= 0` to preserve the Clean Frame 0 invariant.
 */
export const ScenicBackdropLayers: React.FC<ScenicBackdropLayersProps> = ({
  style: styleProp,
  seed = 'scenic-backdrop-v1',
  intensity = 1,
  className,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const contextStyle = useStudioStyle();
  const opticalStage = useOpticalStage();

  const style = styleProp ?? contextStyle;
  const clampedIntensity = clamp(intensity, 0, 1.5);

  const layoutTokens = useMemo(() => {
    const rng = createSeededRandom(`scenic:${String(seed)}`);
    return {
      sunX: 0.72 + (rng() - 0.5) * 0.14,
      sunY: 0.22 + (rng() - 0.5) * 0.06,
      cloudOffsetA: rng() * 180,
      cloudOffsetB: rng() * 220,
      hillCrestShift: (rng() - 0.5) * 140,
      causticTilt: (rng() - 0.5) * 18,
      stemBias: rng() * 60,
    };
  }, [seed]);

  // Clean Frame 0 invariant
  if (frame <= 0 || clampedIntensity <= 0.001) {
    return null;
  }

  const artWorld = resolveArtWorld(style);
  const optics = resolveStyleOptics(style);
  const { palette, surface } = style;
  const isVertical = height > width;

  // Gentle 60 FPS deterministic breathing & optional optical camera parallax
  const camParallaxX = opticalStage
    ? ((opticalStage.camera.x - opticalStage.stageWidth / 2) /
        Math.max(1, opticalStage.stageWidth)) *
      -36
    : 0;
  const camParallaxY = opticalStage
    ? ((opticalStage.camera.y - opticalStage.stageHeight / 2) /
        Math.max(1, opticalStage.stageHeight)) *
      -20
    : 0;

  const slowBreathX = Math.sin(frame * 0.008) * 14 + camParallaxX;
  const slowBreathY = Math.cos(frame * 0.006) * 7 + camParallaxY;
  const uidPrefix = `scenic-${artWorld}-${String(seed).replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (artWorld === 'atelier') {
    const horizonY = isVertical ? 1420 : 756;
    const dipY = isVertical ? 1472 : 798;
    const causticAngle = optics.lightAngleDeg + layoutTokens.causticTilt;

    return (
      <AbsoluteFill
        className={className}
        data-scenic-backdrop="atelier"
        style={{
          pointerEvents: 'none',
          overflow: 'hidden',
          opacity: clamp(0.92 * clampedIntensity, 0, 1),
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <linearGradient id={`${uidPrefix}-cove`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={palette.bgElevated}
                stopOpacity={surface.isDark ? 0.42 : 0.64}
              />
              <stop
                offset="100%"
                stopColor={palette.bgCanvas}
                stopOpacity={surface.isDark ? 0.14 : 0.22}
              />
            </linearGradient>
            <radialGradient
              id={`${uidPrefix}-pool`}
              cx="50%"
              cy="78%"
              rx="46%"
              ry="20%"
            >
              <stop
                offset="0%"
                stopColor={surface.isDark ? palette.accentPrimary : '#FFFFFF'}
                stopOpacity={surface.isDark ? 0.14 : 0.72}
              />
              <stop
                offset="58%"
                stopColor={palette.accentSecondary}
                stopOpacity={surface.isDark ? 0.06 : 0.08}
              />
              <stop offset="100%" stopColor={palette.bgCanvas} stopOpacity={0} />
            </radialGradient>
            <linearGradient
              id={`${uidPrefix}-caustic`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop
                offset="0%"
                stopColor={palette.accentPrimary}
                stopOpacity={surface.isDark ? 0.16 : 0.11}
              />
              <stop
                offset="52%"
                stopColor={surface.isDark ? palette.accentSecondary : '#FFFFFF'}
                stopOpacity={surface.isDark ? 0.1 : 0.45}
              />
              <stop offset="100%" stopColor={palette.accentSecondary} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Soft optical glass caustics */}
          <g
            data-scenic-layer="glass-caustics"
            transform={`translate(${(slowBreathX * 0.7).toFixed(2)}, ${(slowBreathY * 0.6).toFixed(2)}) rotate(${causticAngle.toFixed(2)} ${width * 0.5} ${height * 0.36})`}
          >
            <ellipse
              cx={width * 0.34}
              cy={height * 0.3}
              rx={width * 0.34}
              ry={height * 0.13}
              fill={`url(#${uidPrefix}-caustic)`}
            />
            <ellipse
              cx={width * 0.68}
              cy={height * 0.38}
              rx={width * 0.26}
              ry={height * 0.09}
              fill="none"
              stroke={surface.isDark ? palette.accentPrimary : '#FFFFFF'}
              strokeOpacity={surface.isDark ? 0.14 : 0.58}
              strokeWidth={1.5}
            />
          </g>

          {/* Studio cyclorama curved floor plane & horizon arc */}
          <path
            data-scenic-layer="cyclorama-floor"
            d={`M 0 ${horizonY} Q ${width * 0.5} ${dipY} ${width} ${horizonY} L ${width} ${height} L 0 ${height} Z`}
            fill={`url(#${uidPrefix}-cove)`}
          />
          <path
            data-scenic-layer="cyclorama-arc"
            d={`M 0 ${horizonY} Q ${width * 0.5} ${dipY} ${width} ${horizonY}`}
            fill="none"
            stroke={palette.inkBorder}
            strokeOpacity={surface.isDark ? 0.48 : 0.62}
            strokeWidth={1.25}
          />

          {/* Subtle floor reflection pool */}
          <ellipse
            data-scenic-layer="reflection-pool"
            cx={width * 0.5 + slowBreathX * 0.35}
            cy={dipY + (height - dipY) * 0.38}
            rx={width * 0.42}
            ry={Math.max(48, (height - horizonY) * 0.46)}
            fill={`url(#${uidPrefix}-pool)`}
          />
        </svg>
      </AbsoluteFill>
    );
  }

  if (artWorld === 'illustrative') {
    const sunCx = width * layoutTokens.sunX + slowBreathX * 0.25;
    const sunCy = height * (isVertical ? 0.17 : layoutTokens.sunY) + slowBreathY * 0.25;
    const sunRadius = isVertical ? 64 : 78;
    const farBaseY = isVertical ? height * 0.77 : height * 0.72;
    const midBaseY = isVertical ? height * 0.83 : height * 0.8;
    const nearBaseY = isVertical ? height * 0.89 : height * 0.87;
    const cloudShiftA = ((frame * 0.22 + layoutTokens.cloudOffsetA) % (width * 0.28)) - width * 0.08;
    const cloudShiftB = Math.sin(frame * 0.007) * 22;

    return (
      <AbsoluteFill
        className={className}
        data-scenic-backdrop="illustrative"
        style={{
          pointerEvents: 'none',
          overflow: 'hidden',
          opacity: clamp(0.95 * clampedIntensity, 0, 1),
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <radialGradient id={`${uidPrefix}-sun-halo`} cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={palette.bgElevated}
                stopOpacity={surface.isDark ? 0.34 : 0.76}
              />
              <stop
                offset="55%"
                stopColor={palette.accentPrimary}
                stopOpacity={surface.isDark ? 0.12 : 0.14}
              />
              <stop offset="100%" stopColor={palette.bgCanvas} stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* Celestial sun/moon halo & disc */}
          <g data-scenic-layer="celestial-disc">
            <circle
              cx={sunCx}
              cy={sunCy}
              r={sunRadius * 2.5}
              fill={`url(#${uidPrefix}-sun-halo)`}
            />
            <circle
              cx={sunCx}
              cy={sunCy}
              r={sunRadius}
              fill={surface.isDark ? palette.bgElevated : palette.bgSurface}
              fillOpacity={surface.isDark ? 0.45 : 0.84}
              stroke={palette.inkBorder}
              strokeOpacity={0.32}
              strokeWidth={1.5}
            />
          </g>

          {/* Soft organic clouds */}
          <g
            data-scenic-layer="organic-clouds"
            fill={surface.isDark ? palette.bgElevated : '#FFFFFF'}
            fillOpacity={surface.isDark ? 0.24 : 0.72}
          >
            <g transform={`translate(${(width * 0.18 + cloudShiftA * 0.35).toFixed(2)}, ${(height * (isVertical ? 0.15 : 0.18)).toFixed(2)})`}>
              <ellipse cx={0} cy={12} rx={68} ry={22} />
              <ellipse cx={-26} cy={4} rx={38} ry={24} />
              <ellipse cx={22} cy={0} rx={44} ry={28} />
            </g>
            <g transform={`translate(${(width * 0.56 + cloudShiftB).toFixed(2)}, ${(height * (isVertical ? 0.2 : 0.25)).toFixed(2)})`}>
              <ellipse cx={0} cy={10} rx={56} ry={18} />
              <ellipse cx={-18} cy={2} rx={32} ry={20} />
              <ellipse cx={20} cy={4} rx={34} ry={21} />
            </g>
          </g>

          {/* Warm multi-layered parallax hills */}
          <path
            data-scenic-layer="hills-far"
            d={`M -40 ${farBaseY} C ${width * 0.22} ${farBaseY - 78}, ${width * 0.48 + layoutTokens.hillCrestShift} ${farBaseY + 34}, ${width * 0.74} ${farBaseY - 64} S ${width * 0.94} ${farBaseY - 18}, ${width + 40} ${farBaseY + 12} L ${width + 40} ${height} L -40 ${height} Z`}
            fill={palette.accentSecondary}
            fillOpacity={surface.isDark ? 0.14 : 0.12}
            transform={`translate(${(slowBreathX * 0.35).toFixed(2)}, 0)`}
          />
          <path
            data-scenic-layer="hills-mid"
            d={`M -40 ${midBaseY} C ${width * 0.28} ${midBaseY + 32}, ${width * 0.52 - layoutTokens.hillCrestShift} ${midBaseY - 72}, ${width * 0.82} ${midBaseY - 26} S ${width * 0.96} ${midBaseY + 16}, ${width + 40} ${midBaseY - 12} L ${width + 40} ${height} L -40 ${height} Z`}
            fill={palette.bgElevated}
            fillOpacity={surface.isDark ? 0.36 : 0.62}
            transform={`translate(${(slowBreathX * 0.6).toFixed(2)}, 0)`}
          />
          <path
            data-scenic-layer="hills-near"
            d={`M -40 ${nearBaseY} Q ${width * 0.32} ${nearBaseY - 54} ${width * 0.66} ${nearBaseY - 14} T ${width + 40} ${nearBaseY - 38} L ${width + 40} ${height} L -40 ${height} Z`}
            fill={palette.accentPrimary}
            fillOpacity={surface.isDark ? 0.14 : 0.13}
            transform={`translate(${(slowBreathX * 0.9).toFixed(2)}, 0)`}
          />

          {/* Subtle botanical & geometric corner accents */}
          <g
            data-scenic-layer="botanical-accents"
            stroke={palette.inkBorder}
            strokeOpacity={0.42}
            strokeWidth={1.6}
            fill="none"
          >
            <path
              d={`M ${56 + layoutTokens.stemBias * 0.4} ${height} Q ${74 + layoutTokens.stemBias * 0.4} ${height - 76} ${96 + layoutTokens.stemBias * 0.4} ${height - 118}`}
            />
            <ellipse
              cx={88 + layoutTokens.stemBias * 0.4}
              cy={height - 96}
              rx={12}
              ry={5}
              transform={`rotate(-28 ${88 + layoutTokens.stemBias * 0.4} ${height - 96})`}
              fill={palette.accentSecondary}
              fillOpacity={0.22}
            />
            <path
              d={`M ${width - 68} ${height} Q ${width - 84} ${height - 68} ${width - 104} ${height - 108}`}
            />
          </g>
        </svg>
      </AbsoluteFill>
    );
  }

  // 'editorial-gallery': architectural passe-partout frame lines, diagonal window shadow cast, tonal gallery planes
  const matInset = isVertical ? 28 : 36;
  const shadowSkew = clamp(optics.lightAngleDeg * 0.45, -26, 26);

  return (
    <AbsoluteFill
      className={className}
      data-scenic-backdrop="editorial-gallery"
      style={{
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: clamp(0.94 * clampedIntensity, 0, 1),
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <linearGradient
            id={`${uidPrefix}-window-light`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor={surface.isDark ? palette.bgElevated : '#FFFFFF'}
              stopOpacity={surface.isDark ? 0.28 : 0.56}
            />
            <stop
              offset="62%"
              stopColor={palette.bgElevated}
              stopOpacity={surface.isDark ? 0.12 : 0.26}
            />
            <stop offset="100%" stopColor={palette.bgCanvas} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Subtle tonal gallery architectural planes */}
        <rect
          data-scenic-layer="gallery-plinth"
          x={0}
          y={height * 0.74}
          width={width}
          height={height * 0.26}
          fill={palette.bgElevated}
          fillOpacity={surface.isDark ? 0.26 : 0.38}
        />
        <line
          x1={matInset}
          y1={height * 0.74}
          x2={width - matInset}
          y2={height * 0.74}
          stroke={palette.inkBorder}
          strokeOpacity={0.34}
          strokeWidth={1}
        />

        {/* Soft diagonal window light & mullion shadow cast */}
        <g
          data-scenic-layer="window-shadow-cast"
          transform={`translate(${(slowBreathX * 0.45).toFixed(2)}, 0) skewX(${shadowSkew.toFixed(2)})`}
        >
          <polygon
            points={`${width * 0.12},0 ${width * 0.46},0 ${width * 0.62},${height * 0.78} ${width * 0.24},${height * 0.78}`}
            fill={`url(#${uidPrefix}-window-light)`}
          />
          <line
            x1={width * 0.29}
            y1={0}
            x2={width * 0.43}
            y2={height * 0.78}
            stroke={palette.inkBorder}
            strokeOpacity={surface.isDark ? 0.18 : 0.24}
            strokeWidth={10}
          />
        </g>

        {/* Architectural passe-partout frame lines */}
        <g data-scenic-layer="passe-partout-frame">
          <rect
            x={matInset}
            y={matInset}
            width={width - matInset * 2}
            height={height - matInset * 2}
            fill="none"
            stroke={palette.inkBorder}
            strokeOpacity={surface.isDark ? 0.36 : 0.48}
            strokeWidth={1}
          />
          <rect
            x={matInset + 8}
            y={matInset + 8}
            width={width - (matInset + 8) * 2}
            height={height - (matInset + 8) * 2}
            fill="none"
            stroke={palette.inkBorder}
            strokeOpacity={surface.isDark ? 0.14 : 0.2}
            strokeWidth={0.75}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
