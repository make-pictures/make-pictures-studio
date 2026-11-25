import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  SPRING_PRESETS,
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioFontsReady,
  useStudioStyle,
} from "../..";

export interface TimelineMilestone {
  id: string;
  label: string;
  /** Concise era, year, or step tag (e.g. `"1998"`, `"2026"`) */
  era?: string;
  /** Frame when this milestone becomes active */
  fromFrame?: number;
  /** Alias for `fromFrame` */
  frame?: number;
  /** Optional concise 2–3 word subtitle */
  detail?: string;
  color?: string;
}

export interface TimelineTrackProps {
  milestones: ReadonlyArray<TimelineMilestone>;
  orientation?: 'horizontal' | 'vertical';
  accentColor?: string;
  enterFrame?: number;
  startFrame?: number;
  variant?: 'dark' | 'light';
  safeBox9x16?: boolean;
  style?: React.CSSProperties;
}

/**
 * Chronicle Vernier Rail & Optical Rack-Focus Timeline (`60 FPS`).
 * Active milestone lifts onto the crisp focal plane (`filter: 'none'`),
 * while past and future milestones recede into gentle lens defocus.
 */
export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  milestones,
  orientation,
  accentColor,
  enterFrame,
  startFrame,
  variant,
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();
  const optics = resolveStyleOptics(studioStyle);
  const grammar = optics.typographyGrammar;

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  if (frame < effectiveStart || milestones.length === 0) {
    return null;
  }

  const trackEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  if (trackEnter <= 0.005) {
    return null;
  }

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

  const normalized = milestones.map((m) => ({
    ...m,
    resolvedFrame: m.fromFrame ?? m.frame ?? 0,
  }));
  const sorted = [...normalized].sort(
    (a, b) => a.resolvedFrame - b.resolvedFrame
  );
  const isVerticalViewport = height > width;
  const resolvedOrientation =
    orientation ??
    (isVerticalViewport && sorted.length >= 4 ? 'vertical' : 'horizontal');

  const isDark =
    variant !== undefined ? variant === 'dark' : studioStyle.surface.isDark;
  const textPrimary =
    variant !== undefined
      ? isDark
        ? '#F8FAFC'
        : '#0F172A'
      : studioStyle.palette.textPrimary;
  const textSecondary =
    variant !== undefined
      ? isDark
        ? '#94A3B8'
        : '#475569'
      : studioStyle.palette.textSecondary;
  const borderColor =
    variant !== undefined
      ? isDark
        ? 'rgba(148, 163, 184, 0.28)'
        : 'rgba(15, 23, 42, 0.2)'
      : studioStyle.palette.inkBorder;

  let activeIdx = 0;
  let continuousIndex = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (frame >= sorted[i]!.resolvedFrame) {
      activeIdx = i;
    }
    if (i > 0 && frame >= sorted[i]!.resolvedFrame) {
      const segProgress = spring({
        frame: frame - sorted[i]!.resolvedFrame,
        fps,
        config: SPRING_PRESETS.smooth,
      });
      continuousIndex = i - 1 + segProgress;
    }
  }

  const totalSteps = Math.max(1, sorted.length - 1);
  const fillFraction =
    sorted.length <= 1
      ? 1
      : Math.min(1, Math.max(0, continuousIndex / totalSteps));
  const activeColor = sorted[activeIdx]?.color ?? resolvedAccent;

  const containerWidth =
    isVerticalViewport && safeBox9x16
      ? Math.min(788, Math.round(width * 0.73))
      : 1120;

  const computeMilestoneOptics = (idx: number) => {
    const dist = Math.min(2, Math.abs(idx - activeIdx));
    if (dist === 0) {
      return { filter: 'none', opacity: 1, scale: 1 };
    }
    const rawBlur = dist * optics.aperture * 3.4;
    if (!isDark) {
      const cappedBlur = Math.min(2.0, rawBlur);
      return {
        filter:
          cappedBlur < 0.25
            ? 'none'
            : `blur(${cappedBlur.toFixed(2)}px) saturate(0.88)`,
        opacity: dist === 1 ? 0.9 : 0.88,
        scale: 0.985,
      };
    }
    return {
      filter: rawBlur < 0.25 ? 'none' : `blur(${rawBlur.toFixed(2)}px)`,
      opacity: dist === 1 ? 0.74 : 0.62,
      scale: 0.96,
    };
  };

  const formatEraMarker = (eraText: string, isActive: boolean) => {
    if (grammar === 'optical-gate') {
      return isActive ? `◆ ${eraText} · LOCK` : `┼ ${eraText}`;
    }
    if (grammar === 'risograph-poster') {
      return isActive ? `${eraText}` : `[${eraText}]`;
    }
    return isActive ? `▲ ${eraText}` : `│ ${eraText}`;
  };

  const outerSurface = getTactileSurfaceStyle(studioStyle, {
    elevation: 'resting',
    overrides: {
      width:
        resolvedOrientation === 'vertical'
          ? Math.min(containerWidth, 680)
          : containerWidth,
      maxWidth: '100%',
      padding: isVerticalViewport ? '24px 26px' : '30px 38px',
      boxSizing: 'border-box',
      borderRadius:
        grammar === 'risograph-poster'
          ? 0
          : Math.max(0, Math.round(6 * studioStyle.surface.radiusScale)),
      ...(variant !== undefined
        ? {
            backgroundColor: isDark ? '#0D1321' : '#FAF8F4',
            borderColor,
          }
        : {}),
      opacity: trackEnter,
      transform: `translateY(${interpolate(trackEnter, [0, 1], [18, 0]).toFixed(2)}px)`,
      ...style,
    },
  });

  if (resolvedOrientation === 'vertical') {
    return (
      <div data-timeline-grammar={grammar} style={outerSurface}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Vertical Vernier Chronicle Rail + Minor Subdivisions */}
          <div
            data-vernier-rail="true"
            style={{
              position: 'absolute',
              left: 14,
              top: 12,
              bottom: 12,
              width: 2,
              backgroundColor: borderColor,
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${(fillFraction * 100).toFixed(2)}%`,
                backgroundColor: activeColor,
                boxShadow:
                  grammar === 'optical-gate' && optics.halation > 0.05
                    ? `0 0 ${Math.round(8 + optics.halation * 16)}px ${activeColor}`
                    : 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 2,
                top: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {Array.from({ length: 17 }).map((_, tickIdx) => {
                const isMajor = tickIdx % 4 === 0;
                const lit = tickIdx / 16 <= fillFraction + 0.01;
                return (
                  <div
                    key={tickIdx}
                    style={{
                      height: isMajor ? 1.5 : 1,
                      width: isMajor ? 8 : 4,
                      backgroundColor: lit ? activeColor : borderColor,
                      opacity: lit ? 0.9 : 0.42,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {sorted.map((m, idx) => {
            const isActive = idx === activeIdx;
            const nodeColor = m.color ?? resolvedAccent;
            const opt = computeMilestoneOptics(idx);
            const eraStr = m.era ?? String(idx + 1).padStart(2, '0');

            return (
              <div
                key={m.id}
                style={{
                  position: 'relative',
                  paddingLeft: 38,
                  filter: opt.filter,
                  opacity: opt.opacity,
                  transform: `scale(${opt.scale})`,
                  transformOrigin: 'left center',
                }}
              >
                {/* Horizontal Pin Tick on Rail */}
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: 16,
                    width: isActive ? 18 : 12,
                    height: isActive ? 2.5 : 1.5,
                    backgroundColor: isActive ? nodeColor : borderColor,
                  }}
                />

                <div
                  style={
                    isActive
                      ? getTactileSurfaceStyle(studioStyle, {
                          elevation: 'floating',
                          overrides: {
                            padding: '12px 16px',
                            borderLeft: `3px solid ${nodeColor}`,
                            borderRadius: 0,
                            ...(variant !== undefined
                              ? {
                                  backgroundColor: isDark ? '#151F33' : '#FFFFFF',
                                  borderColor,
                                }
                              : {}),
                          },
                        })
                      : { padding: '4px 0' }
                  }
                >
                  <div
                    style={{
                      display: 'inline-block',
                      fontFamily: monoFontCss,
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color:
                        isActive && grammar === 'risograph-poster'
                          ? '#FFFFFF'
                          : isActive
                            ? nodeColor
                            : textSecondary,
                      backgroundColor:
                        isActive && grammar === 'risograph-poster'
                          ? nodeColor
                          : 'transparent',
                      padding:
                        isActive && grammar === 'risograph-poster'
                          ? '2px 6px'
                          : 0,
                      border:
                        isActive && grammar === 'risograph-poster'
                          ? `1px solid ${borderColor}`
                          : undefined,
                      boxShadow:
                        isActive && grammar === 'risograph-poster'
                          ? `2px 2px 0px ${borderColor}`
                          : 'none',
                    }}
                  >
                    {formatEraMarker(eraStr, isActive)}
                  </div>
                  <div
                    style={{
                      fontFamily: displayFontCss,
                      fontSize: 21,
                      fontWeight: 700,
                      color: textPrimary,
                      marginTop: 4,
                    }}
                  >
                    {m.label}
                  </div>
                  {m.detail ? (
                    <div
                      style={{
                        fontFamily: bodyFontCss,
                        fontSize: 18,
                        color: textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {m.detail}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Horizontal Vernier Chronicle Rail
  return (
    <div data-timeline-grammar={grammar} style={outerSurface}>
      {/* Precision Top Vernier Scale Rail */}
      <div
        data-vernier-rail="true"
        style={{
          position: 'relative',
          height: 20,
          marginBottom: 14,
          borderTop: `2px solid ${borderColor}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -2,
            height: 2.5,
            width: `${(fillFraction * 100).toFixed(2)}%`,
            backgroundColor: activeColor,
            boxShadow:
              grammar === 'optical-gate' && optics.halation > 0.05
                ? `0 0 ${Math.round(8 + optics.halation * 16)}px ${activeColor}`
                : 'none',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          {Array.from({ length: 25 }).map((_, tickIdx) => {
            const isMajor = tickIdx % 6 === 0;
            const lit = tickIdx / 24 <= fillFraction + 0.01;
            return (
              <div
                key={tickIdx}
                style={{
                  width: isMajor ? 1.5 : 1,
                  height: isMajor ? 11 : 6,
                  backgroundColor: lit ? activeColor : borderColor,
                  opacity: lit ? 0.95 : 0.45,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Milestones Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          gap: isVerticalViewport ? 12 : 18,
        }}
      >
        {sorted.map((m, idx) => {
          const isActive = idx === activeIdx;
          const nodeColor = m.color ?? resolvedAccent;
          const opt = computeMilestoneOptics(idx);
          const eraStr = m.era ?? String(idx + 1).padStart(2, '0');

          return (
            <div
              key={m.id}
              style={{
                flex: 1,
                minWidth: 0,
                filter: opt.filter,
                opacity: opt.opacity,
                transform: `scale(${opt.scale})`,
                transformOrigin: 'top center',
                ...(isActive
                  ? getTactileSurfaceStyle(studioStyle, {
                      elevation: 'floating',
                      overrides: {
                        padding: isVerticalViewport ? '12px 12px' : '14px 18px',
                        borderTop: `2.5px solid ${nodeColor}`,
                        borderRadius:
                          grammar === 'risograph-poster'
                            ? 0
                            : Math.max(
                                0,
                                Math.round(4 * studioStyle.surface.radiusScale)
                              ),
                        ...(variant !== undefined
                          ? {
                              backgroundColor: isDark ? '#151F33' : '#FFFFFF',
                              borderColor,
                            }
                          : {}),
                      },
                    })
                  : {
                      padding: isVerticalViewport ? '8px 6px' : '10px 12px',
                    }),
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  fontFamily: monoFontCss,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color:
                    isActive && grammar === 'risograph-poster'
                      ? '#FFFFFF'
                      : isActive
                        ? nodeColor
                        : textSecondary,
                  backgroundColor:
                    isActive && grammar === 'risograph-poster'
                      ? nodeColor
                      : 'transparent',
                  padding:
                    isActive && grammar === 'risograph-poster'
                      ? '2px 6px'
                      : 0,
                  border:
                    isActive && grammar === 'risograph-poster'
                      ? `1px solid ${borderColor}`
                      : undefined,
                  boxShadow:
                    isActive && grammar === 'risograph-poster'
                      ? `2px 2px 0px ${borderColor}`
                      : 'none',
                  marginBottom: 6,
                }}
              >
                {formatEraMarker(eraStr, isActive)}
              </div>

              <div
                style={{
                  fontFamily: displayFontCss,
                  fontSize: isVerticalViewport ? 18 : 21,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: textPrimary,
                }}
              >
                {m.label}
              </div>

              {m.detail ? (
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: bodyFontCss,
                    fontSize: 18,
                    lineHeight: 1.3,
                    color: textSecondary,
                  }}
                >
                  {m.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
