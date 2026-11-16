import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ClippedSurfaceChrome,
  SPRING_PRESETS,
  THEME,
  computeCircleOfConfusionPx,
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveArtWorld,
  resolveStyleOptics,
  useStudioStyle,
  type ArtWorld,
} from '@make-pictures/core';
import {
  useMotionDiagramFocus,
  type MotionDiagramFocusState,
} from './MotionDiagramStage2D';

export interface SystemNodeProps {
  id: string;
  nodeId?: string;
  focusState?: MotionDiagramFocusState;
  /** Optional module index stamp (omitted by default — zero developer clutter unless explicitly set) */
  moduleCode?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  statusText?: string;
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

const SculptedNodeMedallion: React.FC<{
  artWorld: ArtWorld;
  accent: string;
  secondaryAccent: string;
  strokeColor: string;
  motifIndex: number;
}> = ({ artWorld, accent, secondaryAccent, strokeColor, motifIndex }) => {
  if (artWorld === 'atelier') {
    return (
      <svg
        data-node-medallion="atelier"
        width={24}
        height={24}
        viewBox="0 0 28 28"
      >
        <circle
          cx={14}
          cy={14}
          r={10.5}
          fill="none"
          stroke={strokeColor}
          strokeOpacity={0.32}
          strokeWidth={1.1}
        />
        <circle
          cx={14}
          cy={14}
          r={6.8}
          fill={accent}
          fillOpacity={0.14}
          stroke={accent}
          strokeWidth={1.4}
        />
        {motifIndex === 0 ? (
          <polygon
            points="14,7.4 20.6,14 14,20.6 7.4,14"
            fill="none"
            stroke={secondaryAccent}
            strokeWidth={1.3}
          />
        ) : motifIndex === 1 ? (
          <path
            d="M 8.5 14 Q 14 7.5 19.5 14 Q 14 20.5 8.5 14 Z"
            fill="none"
            stroke={secondaryAccent}
            strokeWidth={1.3}
          />
        ) : (
          <polygon
            points="14,7.6 19.8,11 19.8,17 14,20.4 8.2,17 8.2,11"
            fill="none"
            stroke={secondaryAccent}
            strokeWidth={1.3}
          />
        )}
        <circle cx={14} cy={14} r={2.1} fill={accent} />
      </svg>
    );
  }

  if (artWorld === 'illustrative') {
    return (
      <svg
        data-node-medallion="illustrative"
        width={24}
        height={24}
        viewBox="0 0 28 28"
      >
        <circle
          cx={15}
          cy={11}
          r={5.8}
          fill={accent}
          fillOpacity={0.28}
          stroke={accent}
          strokeWidth={1.4}
        />
        <path
          d={
            motifIndex === 0
              ? 'M 4.5 21.5 Q 10.5 14.5 15.5 18.5 T 23.5 16.5 L 23.5 22.5 L 4.5 22.5 Z'
              : 'M 4.5 22 L 10.8 14.4 L 15.8 18.6 L 19.6 13.8 L 23.5 22 Z'
          }
          fill={secondaryAccent}
          fillOpacity={0.34}
          stroke={strokeColor}
          strokeWidth={1.35}
          strokeLinejoin="round"
        />
        <circle cx={9} cy={9.5} r={1.6} fill={secondaryAccent} />
      </svg>
    );
  }

  // 'editorial-gallery'
  return (
    <svg
      data-node-medallion="editorial-gallery"
      width={24}
      height={24}
      viewBox="0 0 28 28"
    >
      <path
        d="M 7.5 22 V 13 A 6.5 6.5 0 0 1 20.5 13 V 22 Z"
        fill={accent}
        fillOpacity={0.14}
        stroke={strokeColor}
        strokeWidth={1.35}
      />
      <line
        x1={5.5}
        y1={22}
        x2={22.5}
        y2={22}
        stroke={accent}
        strokeWidth={1.6}
      />
      <circle
        cx={14}
        cy={13}
        r={2.4}
        fill="none"
        stroke={accent}
        strokeWidth={1.4}
      />
    </svg>
  );
};

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
  const artWorld = resolveArtWorld(studioStyle);
  const grammar = optics.typographyGrammar;
  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;

  const isDark =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

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
          const rawB = computeCircleOfConfusionPx(-0.28, 0, optics.aperture);
          if (rawB === 0) {
            return {
              isRecessed: true,
              blurPx: 0,
              filterCss: 'none',
              opacityScale: isDark ? 0.72 : 0.88,
              scaleFactor: isDark ? 0.978 : 0.985,
            };
          }
          const b = isDark ? rawB : Number(Math.min(1.85, rawB).toFixed(2));
          return {
            isRecessed: true,
            blurPx: b,
            filterCss: isDark
              ? `blur(${b.toFixed(2)}px)`
              : `blur(${b.toFixed(2)}px) saturate(0.88)`,
            opacityScale: isDark ? 0.72 : 0.88,
            scaleFactor: isDark ? 0.978 : 0.985,
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
    (interpolate(enterProgress, [0, 1], [0.93, 1]) +
      interpolate(activeStrength, [0, 1], [0, 0.018])) *
    resolvedFocus.scaleFactor;
  const translateY = interpolate(enterProgress, [0, 1], [18, 0]);
  const opacity =
    interpolate(enterProgress, [0, 0.65, 1], [0, 0.94, 1]) *
    resolvedFocus.opacityScale;

  const displayedStatus =
    isCurrentlyActive && activeStatusText ? activeStatusText : statusText;
  const cleanModuleCode = moduleCode?.trim() ? moduleCode.trim() : undefined;
  const cleanBadge = badge?.trim() ? badge.trim() : undefined;
  const stampText =
    cleanModuleCode && cleanBadge
      ? `${cleanModuleCode} • ${cleanBadge}`
      : cleanModuleCode ?? cleanBadge;

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
    : `${studioStyle.palette.inkBorder}7A`;

  const medallionRadius =
    grammar === 'risograph-poster'
      ? 0
      : Math.max(0, Math.round(6 * studioStyle.surface.radiusScale));
  const tagRadius =
    grammar === 'risograph-poster'
      ? 0
      : Math.max(0, Math.round(4 * studioStyle.surface.radiusScale));
  const portRadius =
    grammar === 'risograph-poster'
      ? 0
      : Math.max(2, Math.round(3 * studioStyle.surface.radiusScale));

  const motifIndex = Math.floor(
    createSeededRandom(`sysnode-motif:${id}:${title}`)() * 3
  );

  const topBarColor = isCurrentlyActive
    ? resolvedAccent
    : isDark
      ? 'rgba(255, 255, 255, 0.22)'
      : studioStyle.palette.inkBorder;

  const tintGradient = isCurrentlyActive
    ? `linear-gradient(180deg, ${resolvedAccent}${isDark ? '22' : '14'} 0%, transparent 56%)`
    : isDark
      ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 46%)'
      : 'linear-gradient(180deg, rgba(255, 255, 255, 0.68) 0%, rgba(255, 255, 255, 0) 50%)';

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
      {/* Interior Clipped Chrome: Top Bar, Specular Rim & Subtle Tint (ZERO corner overhang) */}
      <ClippedSurfaceChrome
        topBarHeight={grammar === 'risograph-poster' ? 6 : 3}
        topBarColor={topBarColor}
        specularRim={!isDark}
        tintGradient={tintGradient}
      />

      {/* Refined Architectural Left & Right Port Terminals (Outside ClippedSurfaceChrome) */}
      <div
        data-port-terminal="left"
        style={{
          position: 'absolute',
          left: -5,
          top: '50%',
          width: 10,
          height: 10,
          borderRadius: portRadius,
          transform: 'translateY(-50%)',
          backgroundColor: studioStyle.palette.bgSurface,
          border: `1.5px solid ${
            isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          zIndex: 2,
        }}
      >
        <span
          style={{
            width: 3,
            height: 3,
            backgroundColor: isCurrentlyActive
              ? resolvedAccent
              : studioStyle.palette.inkBorder,
          }}
        />
      </div>
      <div
        data-port-terminal="right"
        style={{
          position: 'absolute',
          right: -5,
          top: '50%',
          width: 10,
          height: 10,
          borderRadius: portRadius,
          transform: 'translateY(-50%)',
          backgroundColor: isCurrentlyActive
            ? resolvedAccent
            : studioStyle.palette.bgSurface,
          border: `1.5px solid ${
            isCurrentlyActive ? resolvedAccent : studioStyle.palette.inkBorder
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          zIndex: 2,
        }}
      >
        <span
          style={{
            width: 3,
            height: 3,
            backgroundColor: isCurrentlyActive
              ? '#FFFFFF'
              : studioStyle.palette.inkBorder,
          }}
        />
      </div>

      {/* Row 1: Sculpted Medallion + Optional Clean Badge */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 2,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: medallionRadius,
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
              size={19}
              color={isCurrentlyActive ? resolvedAccent : textPrimary}
              strokeWidth={1.8}
            />
          ) : (
            <SculptedNodeMedallion
              artWorld={artWorld}
              accent={resolvedAccent}
              secondaryAccent={studioStyle.palette.accentSecondary}
              strokeColor={isCurrentlyActive ? resolvedAccent : textPrimary}
              motifIndex={motifIndex}
            />
          )}
        </div>

        {stampText ? (
          <div
            style={{
              padding: '3px 10px',
              borderRadius: tagRadius,
              backgroundColor:
                grammar === 'risograph-poster' && isCurrentlyActive
                  ? resolvedAccent
                  : studioStyle.palette.bgElevated,
              border: `1px solid ${
                isCurrentlyActive
                  ? resolvedAccent
                  : studioStyle.palette.inkBorder
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
            {stampText}
          </div>
        ) : null}
      </div>

      {/* Row 2: Gallery-Grade Title & Subtitle */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 4 }}>
        <div
          style={{
            fontFamily: displayFontCss,
            fontSize: 23,
            fontWeight: 700,
            letterSpacing: `${studioStyle.typography.displayTrackingEm}em`,
            color: textPrimary,
            lineHeight: 1.15,
          }}
        >
          {variant === 'dark' ? title : formatHeadingText(title, studioStyle)}
        </div>
        {subtitle ? (
          <div
            style={{
              fontFamily: bodyFontCss,
              fontSize: 14,
              fontWeight: 400,
              color: textSecondary,
              marginTop: 4,
              lineHeight: 1.36,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {/* Row 3: Crisp Calibration Status Bar */}
      {(displayedStatus || (metricsLabel && metricsValue)) && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 9,
            borderTop: `1px solid ${dividerColor}`,
          }}
        >
          {displayedStatus ? (
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
                  backgroundColor: isCurrentlyActive
                    ? resolvedAccent
                    : dividerColor,
                  border: `1px solid ${
                    isCurrentlyActive
                      ? resolvedAccent
                      : studioStyle.palette.inkBorder
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
          ) : (
            <span />
          )}

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
      )}
    </div>
  );
};
