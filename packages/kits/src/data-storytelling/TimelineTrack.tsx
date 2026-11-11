import React from 'react';
import { Check } from 'lucide-react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  FONTS,
  SPRING_PRESETS,
  STUDIO_THEME,
  THEME,
  useStudioFontsReady,
} from '../../../core/src/theme';

export interface TimelineMilestone {
  id: string;
  label: string;
  /** Concise era, year, or step tag (e.g. `"2024"`, `"Step 01"`) */
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
 * Interactive 60 FPS Milestone Progression Track highlighting the active era/step
 * at `frame` with smooth spring-interpolated rail progress.
 */
export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  milestones,
  orientation,
  accentColor = STUDIO_THEME.colors.brand[600],
  enterFrame,
  startFrame,
  variant = 'dark',
  safeBox9x16 = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();

  const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2);
  const trackEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  if (trackEnter <= 0.005 || milestones.length === 0) {
    return null;
  }

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
  const isLight = variant === 'light';

  // Compute active index & continuous rail progress across milestones
  let activeIdx = 0;
  let continuousIndex = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (frame >= sorted[i].resolvedFrame) {
      activeIdx = i;
    }
    if (i > 0 && frame >= sorted[i].resolvedFrame) {
      const segProgress = spring({
        frame: frame - sorted[i].resolvedFrame,
        fps,
        config: SPRING_PRESETS.smooth,
      });
      continuousIndex = i - 1 + segProgress;
    }
  }

  const totalSteps = Math.max(1, sorted.length - 1);
  const fillFraction =
    sorted.length <= 1 ? 1 : Math.min(1, Math.max(0, continuousIndex / totalSteps));
  const activeColor = sorted[activeIdx]?.color ?? accentColor;

  const containerWidth =
    isVerticalViewport && safeBox9x16 ? Math.min(830, width - 90) : 1120;

  // Calm breathing halo on active milestone (low angular rate per AGENTS.md)
  const haloScale = 1 + 0.08 * Math.sin(frame * (60 / Math.max(1, fps)) * 0.042);

  if (resolvedOrientation === 'vertical') {
    return (
      <div
        style={{
          width: Math.min(containerWidth, 680),
          padding: '30px 34px',
          borderRadius: 26,
          boxSizing: 'border-box',
          backgroundColor: isLight
            ? STUDIO_THEME.colors.bgSurfaceGlass
            : 'rgba(13, 15, 26, 0.88)',
          border: isLight
            ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
            : '1.5px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isLight
            ? STUDIO_THEME.shadows.cardElevated
            : THEME.shadows.card,
          opacity: trackEnter,
          transform: `translateY(${interpolate(trackEnter, [0, 1], [22, 0]).toFixed(2)}px)`,
          ...style,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          {/* Vertical Rail */}
          <div
            style={{
              position: 'absolute',
              left: 21,
              top: 22,
              bottom: 22,
              width: 4,
              borderRadius: 9999,
              backgroundColor: isLight
                ? 'rgba(15, 23, 42, 0.10)'
                : 'rgba(255, 255, 255, 0.12)',
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${(fillFraction * 100).toFixed(2)}%`,
                borderRadius: 9999,
                backgroundColor: activeColor,
                boxShadow: `0 0 16px ${activeColor}88`,
              }}
            />
          </div>

          {sorted.map((m, idx) => {
            const isCompleted = idx < activeIdx;
            const isActive = idx === activeIdx;
            const nodeColor = m.color ?? accentColor;
            const pop = spring({
              frame: Math.max(0, frame - m.resolvedFrame),
              fps,
              config: SPRING_PRESETS.snappy,
            });

            return (
              <div
                key={m.id}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 9999,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      isActive || isCompleted
                        ? nodeColor
                        : isLight
                          ? '#FFFFFF'
                          : '#1E293B',
                    border: `3px solid ${
                      isActive || isCompleted
                        ? nodeColor
                        : isLight
                          ? '#CBD5E1'
                          : 'rgba(255,255,255,0.2)'
                    }`,
                    boxShadow: isActive
                      ? `0 0 28px ${nodeColor}88`
                      : 'none',
                    transform: `scale(${isActive ? (haloScale * (0.94 + 0.08 * pop)).toFixed(3) : '1'})`,
                  }}
                >
                  {isCompleted ? (
                    <Check size={22} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 15,
                        fontWeight: 800,
                        color:
                          isActive
                            ? '#FFFFFF'
                            : isLight
                              ? '#64748B'
                              : '#94A3B8',
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {m.era && (
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        color: isActive
                          ? nodeColor
                          : isLight
                            ? STUDIO_THEME.colors.text.muted
                            : THEME.colors.textMuted,
                      }}
                    >
                      {m.era}
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 22,
                      fontWeight: 800,
                      color:
                        isActive || isCompleted
                          ? isLight
                            ? STUDIO_THEME.colors.text.slate900
                            : THEME.colors.textPrimary
                          : isLight
                            ? '#94A3B8'
                            : '#64748B',
                    }}
                  >
                    {m.label}
                  </span>
                  {m.detail && (
                    <span
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 16,
                        fontWeight: 500,
                        color: isLight
                          ? STUDIO_THEME.colors.text.secondary
                          : THEME.colors.textSecondary,
                      }}
                    >
                      {m.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Horizontal Progression Track
  return (
    <div
      style={{
        width: containerWidth,
        padding: isVerticalViewport ? '28px 26px' : '32px 42px',
        borderRadius: 26,
        boxSizing: 'border-box',
        backgroundColor: isLight
          ? STUDIO_THEME.colors.bgSurfaceGlass
          : 'rgba(13, 15, 26, 0.88)',
        border: isLight
          ? `1.5px solid ${STUDIO_THEME.colors.border.subtle}`
          : '1.5px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isLight
          ? STUDIO_THEME.shadows.cardElevated
          : THEME.shadows.card,
        opacity: trackEnter,
        transform: `translateY(${interpolate(trackEnter, [0, 1], [22, 0]).toFixed(2)}px)`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        {/* Horizontal Connecting Rail */}
        <div
          style={{
            position: 'absolute',
            left: '8%',
            right: '8%',
            top: 22,
            height: 5,
            borderRadius: 9999,
            backgroundColor: isLight
              ? 'rgba(15, 23, 42, 0.10)'
              : 'rgba(255, 255, 255, 0.12)',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: `${(fillFraction * 100).toFixed(2)}%`,
              height: '100%',
              borderRadius: 9999,
              backgroundColor: activeColor,
              boxShadow: `0 0 18px ${activeColor}88`,
            }}
          />
        </div>

        {sorted.map((m, idx) => {
          const isCompleted = idx < activeIdx;
          const isActive = idx === activeIdx;
          const nodeColor = m.color ?? accentColor;

          return (
            <div
              key={m.id}
              style={{
                position: 'relative',
                zIndex: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 10,
                padding: '0 8px',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    isActive || isCompleted
                      ? nodeColor
                      : isLight
                        ? '#FFFFFF'
                        : '#0F172A',
                  border: `3px solid ${
                    isActive || isCompleted
                      ? nodeColor
                      : isLight
                        ? '#CBD5E1'
                        : 'rgba(255,255,255,0.22)'
                  }`,
                  boxShadow: isActive ? `0 0 28px ${nodeColor}99` : 'none',
                  transform: `scale(${isActive ? haloScale.toFixed(3) : '1'})`,
                }}
              >
                {isCompleted ? (
                  <Check size={22} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 16,
                      fontWeight: 800,
                      color: isActive
                        ? '#FFFFFF'
                        : isLight
                          ? '#64748B'
                          : '#94A3B8',
                    }}
                  >
                    {idx + 1}
                  </span>
                )}
              </div>

              {m.era && (
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    padding: '2px 10px',
                    borderRadius: 9999,
                    color: isActive ? '#FFFFFF' : isLight ? '#64748B' : '#94A3B8',
                    backgroundColor: isActive
                      ? nodeColor
                      : isLight
                        ? 'rgba(15, 23, 42, 0.06)'
                        : 'rgba(255, 255, 255, 0.07)',
                  }}
                >
                  {m.era}
                </span>
              )}

              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: isVerticalViewport ? 19 : 21,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  color:
                    isActive || isCompleted
                      ? isLight
                        ? STUDIO_THEME.colors.text.slate900
                        : THEME.colors.textPrimary
                      : isLight
                        ? '#94A3B8'
                        : '#64748B',
                }}
              >
                {m.label}
              </div>

              {m.detail && (
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 15,
                    fontWeight: 500,
                    color: isLight
                      ? STUDIO_THEME.colors.text.secondary
                      : THEME.colors.textSecondary,
                  }}
                >
                  {m.detail}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
