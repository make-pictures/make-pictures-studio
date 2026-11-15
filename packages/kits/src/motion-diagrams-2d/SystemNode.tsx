import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SPRING_PRESETS,
  THEME,
  computeCircleOfConfusionPx,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';
import {
  useMotionDiagramFocus,
  type MotionDiagramFocusState,
} from './MotionDiagramStage2D';

export interface SystemNodeProps {
  id: string;
  nodeId?: string;
  focusState?: MotionDiagramFocusState;
  moduleCode?: string;
  title: string;
  subtitle: string;
  badge: string;
  statusText: string;
  activeStatusText?: string;
  icon?: LucideIcon;
  x: number;
  y: number;
  width?: number;
  height?: number;
  accentColor?: string;
  variant?: 'dark' | 'light';
  enterFrame?: number;
  activeRanges?: Array<[number, number]>;
  metricsLabel?: string;
  metricsValue?: string;
}

export const SystemNode: React.FC<SystemNodeProps> = ({
  id,
  nodeId,
  focusState = 'auto',
  moduleCode,
  title,
  subtitle,
  badge,
  statusText,
  activeStatusText,
  icon: Icon,
  x,
  y,
  width = 340,
  height = 188,
  accentColor,
  variant,
  enterFrame = 2,
  activeRanges = [],
  metricsLabel,
  metricsValue,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();
  const focusCtx = useMotionDiagramFocus();

  const effectiveEnter = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveEnter) {
    return null;
  }

  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;
  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;

  const displayFontCss = formatFontFamilyCss(
    studioStyle.typography.displayFont,
    'display'
  );
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const enterProgress = spring({
    frame: frame - effectiveEnter,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  if (enterProgress <= 0.002) {
    return null;
  }

  let activeStrength = 0;
  for (const [start, end] of activeRanges) {
    if (frame >= start - 8 && frame <= end + 24) {
      const rampIn = spring({
        frame: frame - start,
        fps,
        config: SPRING_PRESETS.smooth,
      });
      const rampOut = interpolate(frame, [end, end + 22], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      activeStrength = Math.max(activeStrength, rampIn * rampOut);
    }
  }

  const isCurrentlyActive = activeStrength > 0.35;
  const focusTargetKey = nodeId ?? id;
  const resolvedFocus = focusCtx
    ? focusCtx.resolveNodeFocus(focusTargetKey, focusState)
    : focusState === 'recessed'
      ? (() => {
          const b = computeCircleOfConfusionPx(-0.28, 0, optics.aperture);
          return {
            isRecessed: true,
            blurPx: b,
            filterCss: b === 0 ? 'none' : `blur(${b.toFixed(2)}px)`,
            opacityScale: 0.68,
            scaleFactor: 0.98,
          };
        })()
      : {
          isRecessed: false,
          blurPx: 0,
          filterCss: 'none',
          opacityScale: 1,
          scaleFactor: 1,
        };

  const scale =
    (interpolate(enterProgress, [0, 1], [0.92, 1]) +
      interpolate(activeStrength, [0, 1], [0, 0.018])) *
    resolvedFocus.scaleFactor;
  const translateY = interpolate(enterProgress, [0, 1], [20, 0]);
  const opacity =
    interpolate(enterProgress, [0, 0.65, 1], [0, 0.92, 1]) *
    resolvedFocus.opacityScale;

  const displayedStatus =
    isCurrentlyActive && activeStatusText ? activeStatusText : statusText;

  const isDark =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

  const elevation = isCurrentlyActive ? 'lifted' : 'resting';
  const tactileChrome =
    variant === 'dark' && !studioStyle.surface.isDark
      ? {
          borderRadius: Math.max(
            0,
            Math.round(8 * studioStyle.surface.radiusScale)
          ),
          backgroundColor: 'rgba(15, 18, 29, 0.96)',
          border: `1.5px solid ${
            isCurrentlyActive ? resolvedAccent : 'rgba(255, 255, 255, 0.16)'
          }`,
          boxShadow: THEME.shadows.card,
        }
      : (() => {
          const base = getCardChromeStyle(studioStyle);
          const tac = getTactileSurfaceStyle(studioStyle, { elevation });
          return {
            ...tac,
            borderColor: isCurrentlyActive
              ? resolvedAccent
              : studioStyle.palette.inkBorder,
            ...(studioStyle.surface.cardTreatment === 'brutalist-hard' &&
            elevation === 'resting'
              ? { boxShadow: base.boxShadow }
              : {}),
          };
        })();

  const textPrimary =
    variant === 'dark' && !studioStyle.surface.isDark
      ? THEME.colors.textPrimary
      : studioStyle.palette.textPrimary;
  const textSecondary =
    variant === 'dark' && !studioStyle.surface.isDark
      ? THEME.colors.textSecondary
      : studioStyle.palette.textSecondary;
  const dividerColor = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : `${studioStyle.palette.inkBorder}66`;

  const tagRadius = Math.max(
    0,
    Math.round(4 * studioStyle.surface.radiusScale)
  );

  return (
    <div
      data-node-grammar={grammar}
      data-focus-state={resolvedFocus.isRecessed ? 'recessed' : 'sharp'}
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        opacity,
        filter: resolvedFocus.filterCss,
        willChange: 'transform, opacity',
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
        ...tactileChrome,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* Top Calibrated Header Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: grammar === 'risograph-poster' ? 6 : 3,
          backgroundColor: isCurrentlyActive
            ? resolvedAccent
            : studioStyle.palette.inkBorder,
        }}
      />

      {/* Physical Left & Right Port Pins */}
      <div
        style={{
          position: 'absolute',
          left: -5,
          top: '50%',
          width: 8,
          height: 8,
          transform: 'translateY(-50%)',
          backgroundColor: studioStyle.palette.bgSurface,
          border: `2px solid ${
            isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
          }`,
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -5,
          top: '50%',
          width: 8,
          height: 8,
          transform: 'translateY(-50%)',
          backgroundColor: isCurrentlyActive
            ? resolvedAccent
            : studioStyle.palette.bgSurface,
          border: `2px solid ${
            isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
          }`,
          boxSizing: 'border-box',
        }}
      />

      {/* Row 1: Engraved Glyph Medallion + Rectangular Module Stamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 2,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: tagRadius,
            border: `1.5px solid ${
              isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
            }`,
            backgroundColor: studioStyle.palette.bgElevated,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {Icon ? (
            <Icon
              size={18}
              color={isCurrentlyActive ? resolvedAccent : textPrimary}
              strokeWidth={1.8}
            />
          ) : (
            <svg width={20} height={20} viewBox="0 0 20 20">
              <rect
                x={3}
                y={3}
                width={14}
                height={14}
                fill="none"
                stroke={isCurrentlyActive ? resolvedAccent : textPrimary}
                strokeWidth={1.5}
              />
              <line
                x1={3}
                y1={10}
                x2={17}
                y2={10}
                stroke={resolvedAccent}
                strokeWidth={1.5}
              />
              <circle cx={10} cy={10} r={2.2} fill={resolvedAccent} />
            </svg>
          )}
        </div>

        <div
          style={{
            padding: '3px 9px',
            borderRadius: tagRadius,
            backgroundColor:
              grammar === 'risograph-poster' && isCurrentlyActive
                ? resolvedAccent
                : studioStyle.palette.bgElevated,
            border: `1px solid ${
              isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
            }`,
            fontFamily: monoFontCss,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color:
              grammar === 'risograph-poster' && isCurrentlyActive
                ? '#FFFFFF'
                : isCurrentlyActive
                  ? resolvedAccent
                  : textSecondary,
          }}
        >
          {moduleCode ? `${moduleCode} • ${badge}` : badge}
        </div>
      </div>

      {/* Row 2: Title & Subtitle */}
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            fontFamily: displayFontCss,
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
            color: textPrimary,
            lineHeight: 1.18,
          }}
        >
          {variant === 'dark' ? title : formatHeadingText(title, studioStyle)}
        </div>
        <div
          style={{
            fontFamily: bodyFontCss,
            fontSize: 13.5,
            fontWeight: 400,
            color: textSecondary,
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Row 3: Crisp Calibration Status Bar (zero glowing neon dot) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 9,
          borderTop: `1px solid ${dividerColor}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              backgroundColor: isCurrentlyActive ? resolvedAccent : dividerColor,
              border: `1px solid ${
                isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
              }`,
              boxSizing: 'border-box',
            }}
          />
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 11.5,
              fontWeight: 600,
              color: isCurrentlyActive ? textPrimary : textSecondary,
              letterSpacing: '0.03em',
            }}
          >
            {displayedStatus}
          </span>
        </div>

        {metricsLabel && metricsValue && (
          <div
            style={{
              fontFamily: monoFontCss,
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
              color: textSecondary,
            }}
          >
            <span>{metricsLabel}: </span>
            <span
              style={{
                fontWeight: 700,
                color: isCurrentlyActive ? resolvedAccent : textPrimary,
              }}
            >
              {metricsValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
