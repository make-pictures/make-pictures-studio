import React from 'react';
import {
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { FONTS, SPRING_PRESETS, THEME } from '../../theme';

export interface ScreenFrameProps {
  /** Relative path under /public, e.g. 'recordings/sample-ui.mp4' */
  videoSrc?: string;
  windowTitle?: string;
  urlBadge?: string;
  width?: number;
  height?: number;
  enterFrame?: number;
  exitFrame?: number;
  accentColor?: string;
  showLiveTelemetryOverlay?: boolean;
}

export const ScreenFrame: React.FC<ScreenFrameProps> = ({
  videoSrc = 'recordings/sample-ui.mp4',
  windowTitle = 'Aether Console — Production Telemetry',
  urlBadge = 'app.aether.dev/clusters/eu-central-1',
  width = 1340,
  height = 760,
  enterFrame = 0,
  exitFrame,
  accentColor = THEME.colors.accents.cyan,
  showLiveTelemetryOverlay = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const resolvedExitFrame = exitFrame ?? durationInFrames - 26;

  const enterProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: SPRING_PRESETS.cinematic,
  });

  const exitProgress = spring({
    frame: frame - resolvedExitFrame,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const visibility = Math.max(0, enterProgress - exitProgress);

  // Subtle 3D perspective camera drift (Screen Studio / Linear hero style)
  const rotateX =
    interpolate(enterProgress, [0, 1], [16, 5]) +
    interpolate(Math.sin(frame / 55), [-1, 1], [-1.2, 1.2]);
  const rotateY =
    interpolate(enterProgress, [0, 1], [-10, -3.5]) +
    interpolate(frame, [0, durationInFrames], [-2, 3.5]);
  const translateY =
    interpolate(enterProgress, [0, 1], [70, 0]) +
    interpolate(exitProgress, [0, 1], [0, -45]);
  const scale =
    interpolate(enterProgress, [0, 1], [0.88, 1]) -
    interpolate(exitProgress, [0, 1], [0, 0.06]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1900px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width,
          height,
          opacity: visibility,
          transform: `translateY(${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
          transformStyle: 'preserve-3d',
          borderRadius: 20,
          backgroundColor: '#0B0E17',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: `${THEME.shadows.window}, 0 0 90px ${accentColor}22`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Specular Edge Glint */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '8%',
            right: '8%',
            height: 1.5,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.38), ${accentColor}88, transparent)`,
            zIndex: 10,
          }}
        />

        {/* macOS Window Chrome Header */}
        <div
          style={{
            height: 48,
            padding: '0 20px',
            backgroundColor: 'rgba(15, 18, 29, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 5,
          }}
        >
          {/* Traffic Lights */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 260 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#FF5F56',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#FFBD2E',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#27C93F',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                marginLeft: 10,
                fontFamily: FONTS.sans,
                fontSize: 12,
                fontWeight: 500,
                color: THEME.colors.textSecondary,
                whiteSpace: 'nowrap',
              }}
            >
              {windowTitle}
            </span>
          </div>

          {/* URL / Command Pill */}
          <div
            style={{
              padding: '5px 18px',
              borderRadius: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              fontFamily: FONTS.mono,
              fontSize: 11.5,
              color: THEME.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: THEME.colors.accents.emerald,
                boxShadow: `0 0 8px ${THEME.colors.accents.emerald}`,
              }}
            />
            <span>{urlBadge}</span>
          </div>

          {/* Right Status Badge */}
          <div
            style={{
              width: 180,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 8,
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: accentColor,
            }}
          >
            <span>60 FPS • REC</span>
          </div>
        </div>

        {/* Screen Studio Video Area */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            backgroundColor: '#090A0F',
            overflow: 'hidden',
          }}
        >
          {videoSrc && (
            <OffthreadVideo
              src={staticFile(videoSrc)}
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}

          {/* Optional Crisp UI Telemetry Overlay (enhances placeholder recordings) */}
          {showLiveTelemetryOverlay && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: 36,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background:
                  'linear-gradient(180deg, rgba(9,10,15,0.2) 0%, rgba(9,10,15,0.55) 100%)',
              }}
            >
              {/* Top Metric Strip */}
              <div style={{ display: 'flex', gap: 18 }}>
                {[
                  {
                    label: 'P99 INFERENCE LATENCY',
                    value: '41.8 ms',
                    delta: '-18.4%',
                    color: THEME.colors.accents.cyan,
                  },
                  {
                    label: 'ACTIVE AGENT STREAMS',
                    value: '12,840 / s',
                    delta: '+99.98% SLA',
                    color: THEME.colors.accents.violet,
                  },
                  {
                    label: 'POSTGRES COMMITS',
                    value: '4,210 tx/s',
                    delta: 'ZERO LOCK',
                    color: THEME.colors.accents.emerald,
                  },
                ].map((metric, idx) => {
                  const cardProgress = spring({
                    frame: frame - enterFrame - 12 - idx * 7,
                    fps,
                    config: SPRING_PRESETS.snappy,
                  });
                  return (
                    <div
                      key={metric.label}
                      style={{
                        flex: 1,
                        padding: '18px 22px',
                        borderRadius: 14,
                        backgroundColor: 'rgba(15, 18, 29, 0.84)',
                        backdropFilter: 'blur(18px)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        opacity: cardProgress,
                        transform: `translateY(${interpolate(
                          cardProgress,
                          [0, 1],
                          [16, 0]
                        )}px)`,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 11,
                          color: THEME.colors.textSecondary,
                          letterSpacing: '0.06em',
                        }}
                      >
                        {metric.label}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 28,
                            fontWeight: 700,
                            color: THEME.colors.textPrimary,
                            letterSpacing: '-0.03em',
                          }}
                        >
                          {metric.value}
                        </span>
                        <span
                          style={{
                            fontFamily: FONTS.mono,
                            fontSize: 12,
                            color: metric.color,
                            padding: '2px 8px',
                            borderRadius: 999,
                            backgroundColor: `${metric.color}1F`,
                          }}
                        >
                          {metric.delta}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Live Event Stream Console */}
              <div
                style={{
                  padding: '20px 24px',
                  borderRadius: 16,
                  backgroundColor: 'rgba(11, 14, 23, 0.88)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  fontFamily: FONTS.mono,
                  fontSize: 13,
                  color: THEME.colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 6,
                      backgroundColor: `${accentColor}22`,
                      color: accentColor,
                      fontWeight: 600,
                    }}
                  >
                    LIVE STREAM
                  </span>
                  <span style={{ color: '#F8FAFC' }}>
                    POST /v1/agent/analyze → 200 OK → PostgreSQL Write Committed
                  </span>
                </div>
                <span style={{ color: THEME.colors.accents.emerald }}>
                  ● Synchronized @ 60 FPS
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
