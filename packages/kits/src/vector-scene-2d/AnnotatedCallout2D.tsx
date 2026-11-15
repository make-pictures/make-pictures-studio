import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export interface AnnotatedCallout2DProps {
  target: [number, number];
  labelPosition: [number, number];
  label: string;
  sublabel?: string;
  code?: string;
  elbowMode?: 'auto' | 'straight';
  startFrame?: number;
  accentColor?: string;
}

export const AnnotatedCallout2D: React.FC<AnnotatedCallout2DProps> = ({
  target,
  labelPosition,
  label,
  sublabel,
  code,
  elbowMode = 'auto',
  startFrame = 8,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const grammar = optics.typographyGrammar;
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const progress = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });
  const accent = accentColor ?? style.palette.accentPrimary;

  const [rawTx, rawTy] = target;
  const [rawLx, rawLy] = labelPosition;

  const scaleX = width / 1080;
  const scaleY = height / 1920;
  const verticalMaxWidth = Math.round(320 * scaleX);

  // Clamp reticle & flag strictly inside 9:16 Golden Safe Box [40, 910] × [220, 1380]
  const tx = isVertical
    ? Math.max(56 * scaleX, Math.min(894 * scaleX, rawTx))
    : rawTx;
  const ty = isVertical
    ? Math.max(236 * scaleY, Math.min(1364 * scaleY, rawTy))
    : rawTy;

  const lx = isVertical
    ? Math.max(204 * scaleX, Math.min(732 * scaleX, rawLx))
    : rawLx;
  const ly = isVertical
    ? Math.max(284 * scaleY, Math.min(1304 * scaleY, rawLy))
    : rawLy;

  const dx = lx - tx;
  const dy = ly - ty;
  const useStraight =
    elbowMode === 'straight' || Math.abs(dx) < 18 || Math.abs(dy) < 18;

  const dirX = dx >= 0 ? 1 : -1;
  const diagSpan = Math.min(Math.abs(dy), Math.abs(dx) * 0.82);
  const elbowX = useStraight ? lx : tx + dirX * diagSpan;
  const elbowY = ly;

  const seg1 = Math.hypot(elbowX - tx, elbowY - ty);
  const seg2 = useStraight ? 0 : Math.abs(lx - elbowX);
  const totalLen = Math.max(1, seg1 + seg2);

  const polylinePoints = useStraight
    ? `${tx},${ty} ${lx},${ly}`
    : `${tx},${ty} ${elbowX.toFixed(1)},${elbowY.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)}`;

  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const reticleR = 11 * progress;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {/* Optical Target Crosshair Reticle at `target` */}
        <g data-callout-reticle="true" opacity={progress}>
          <circle
            cx={tx}
            cy={ty}
            r={Math.max(0.5, reticleR)}
            fill="none"
            stroke={accent}
            strokeWidth={1.6}
          />
          <circle cx={tx} cy={ty} r={2.5} fill={accent} />
          <line
            x1={tx - 16}
            y1={ty}
            x2={tx - 6}
            y2={ty}
            stroke={accent}
            strokeWidth={1.3}
          />
          <line
            x1={tx + 6}
            y1={ty}
            x2={tx + 16}
            y2={ty}
            stroke={accent}
            strokeWidth={1.3}
          />
          <line
            x1={tx}
            y1={ty - 16}
            x2={tx}
            y2={ty - 6}
            stroke={accent}
            strokeWidth={1.3}
          />
          <line
            x1={tx}
            y1={ty + 6}
            x2={tx}
            y2={ty + 16}
            stroke={accent}
            strokeWidth={1.3}
          />
        </g>

        {/* 2-Segment Architectural Elbow Leader */}
        <polyline
          data-callout-elbow={useStraight ? 'straight' : 'auto'}
          points={polylinePoints}
          fill="none"
          stroke={
            grammar === 'risograph-poster'
              ? style.palette.textPrimary
              : accent
          }
          strokeWidth={1.8}
          strokeLinejoin="miter"
          strokeDasharray={totalLen}
          strokeDashoffset={totalLen * (1 - progress)}
        />
      </svg>

      {/* Tactile Flag Plate at `labelPosition` */}
      <div
        style={getTactileSurfaceStyle(style, {
          elevation: 'floating',
          overrides: {
            boxSizing: 'border-box',
            position: 'absolute',
            left: lx,
            top: ly,
            maxWidth: isVertical ? verticalMaxWidth : 440,
            transform: `translate(-50%, -50%) scale(${(0.94 + 0.06 * progress).toFixed(4)})`,
            padding: sublabel || code ? '12px 18px' : '10px 18px',
            borderRadius:
              grammar === 'risograph-poster'
                ? 0
                : Math.max(0, Math.round(5 * style.surface.radiusScale)),
            borderLeft: dirX >= 0 ? `3.5px solid ${accent}` : undefined,
            borderRight: dirX < 0 ? `3.5px solid ${accent}` : undefined,
            opacity: progress,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          },
        })}
      >
        {code ? (
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: accent,
            }}
          >
            {code}
          </span>
        ) : null}

        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 21,
            fontWeight: 700,
            lineHeight: 1.25,
            color: style.palette.textPrimary,
          }}
        >
          {label}
        </span>

        {sublabel ? (
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: 16,
              lineHeight: 1.3,
              color: style.palette.textSecondary,
            }}
          >
            {sublabel}
          </span>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
