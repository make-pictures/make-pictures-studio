import React from 'react';
import {
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from 'remotion';
import { FONTS, SPRING_PRESETS, THEME } from '../../theme';

export interface ScreenFrameProps {
  /** Optional relative path under /public, e.g. 'recordings/custom-ui.mp4'. When omitted, renders a native 60 FPS GPU telemetry canvas. */
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

const TELEMETRY_BARS = [
  0.42, 0.56, 0.48, 0.68, 0.62, 0.78, 0.72, 0.86, 0.66, 0.91, 0.82, 0.94, 0.76,
  0.88, 0.79, 0.95, 0.84, 0.9,
];

export const ScreenFrame: React.FC<ScreenFrameProps> = ({
  videoSrc,
  windowTitle = 'make.pictures — Production Telemetry',
  urlBadge = 'app.make.pictures/telemetry',
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
  if (visibility <= 0.002) {
    return null;
  }

  // Smooth 3D perspective camera drift (Screen Studio / Linear hero style)
  const rotateX =
    interpolate(enterProgress, [0, 1], [15, 4.8]) +
    interpolate(Math.sin(frame * 0.018), [-1, 1], [-1.1, 1.1]);
  const rotateY =
    interpolate(enterProgress, [0, 1], [-9.5, -3.2]) +
    interpolate(frame, [0, durationInFrames], [-1.8, 3.2]);
  const translateY =
    interpolate(enterProgress, [0, 1], [64, 0]) +
    interpolate(exitProgress, [0, 1], [0, -42]);
  const scale =
    interpolate(enterProgress, [0, 1], [0.89, 1]) -
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
          willChange: 'transform, opacity',
          transform: `translate3d(0, ${translateY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
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
            backgroundColor: '#0F131E',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 5,
          }}
        >
          {/* Traffic Lights */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 260,
            }}
          >
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
            <span>60 FPS • LIVE</span>
          </div>
        </div>

        {/* Screen Studio Surface Area */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            backgroundColor: '#090A0F',
            overflow: 'hidden',
          }}
        >
          {videoSrc ? (
            <Video
              src={staticFile(videoSrc)}
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            /* Native 60 FPS GPU-Composited Console Surface (zero video-decoding stalls in <Player />) */
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                  linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
                  radial-gradient(circle at 72% 45%, ${accentColor}16 0%, transparent 58%)
                `,
                backgroundSize: '56px 56px, 56px 56px, 100% 100%',
              }}
            />
          )}

          {/* Crisp UI Telemetry Overlay */}
          {showLiveTelemetryOverlay && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 20,
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
                    delta: '99.98% SLA',
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
                    frame: frame - enterFrame - 10 - idx * 6,
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
                        backgroundColor: 'rgba(15, 18, 29, 0.94)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        opacity: cardProgress,
                        transform: `translate3d(0, ${interpolate(
                          cardProgress,
                          [0, 1],
                          [16, 0]
                        )}px, 0)`,
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

              {/* Middle Live Throughput Graph & Cluster Panel */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  gap: 18,
                  minHeight: 0,
                }}
              >
                {/* Live Throughput Waveform Card */}
                <div
                  style={{
                    flex: 1.65,
                    padding: '20px 24px',
                    borderRadius: 16,
                    backgroundColor: 'rgba(13, 17, 27, 0.92)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: FONTS.mono,
                      fontSize: 11.5,
                      color: THEME.colors.textSecondary,
                    }}
                  >
                    <span>REAL-TIME AGENT PIPELINE THROUGHPUT</span>
                    <span style={{ color: accentColor }}>SUB-50MS SLA</span>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 10,
                      paddingTop: 18,
                    }}
                  >
                    {TELEMETRY_BARS.map((baseRatio, bIdx) => {
                      const barEnter = spring({
                        frame: frame - enterFrame - 16 - bIdx * 2,
                        fps,
                        config: SPRING_PRESETS.smooth,
                      });
                      const wave =
                        Math.sin(frame * 0.045 + bIdx * 0.48) * 0.085;
                      const heightPct = Math.max(
                        14,
                        Math.min(98, (baseRatio + wave) * 100 * barEnter)
                      );
                      return (
                        <div
                          key={bIdx}
                          style={{
                            flex: 1,
                            height: `${heightPct}%`,
                            borderRadius: '6px 6px 3px 3px',
                            background:
                              bIdx >= TELEMETRY_BARS.length - 4
                                ? `linear-gradient(180deg, ${accentColor} 0%, ${THEME.colors.accents.violet}88 100%)`
                                : 'linear-gradient(180deg, rgba(56, 189, 248, 0.62) 0%, rgba(99, 102, 241, 0.22) 100%)',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Right Active Workers Status Card */}
                <div
                  style={{
                    flex: 1,
                    padding: '20px 24px',
                    borderRadius: 16,
                    backgroundColor: 'rgba(13, 17, 27, 0.92)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11.5,
                      color: THEME.colors.textSecondary,
                      letterSpacing: '0.05em',
                    }}
                  >
                    EDGE WORKER SHARDS
                  </div>

                  {[
                    {
                      region: 'eu-central-1',
                      load: '18.2 ms',
                      color: THEME.colors.accents.emerald,
                    },
                    {
                      region: 'us-east-1',
                      load: '24.6 ms',
                      color: THEME.colors.accents.cyan,
                    },
                    {
                      region: 'ap-northeast-1',
                      load: '31.4 ms',
                      color: THEME.colors.accents.violet,
                    },
                  ].map((shard) => (
                    <div
                      key={shard.region}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 10,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        fontFamily: FONTS.mono,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: '#E2E8F0' }}>{shard.region}</span>
                      <span style={{ color: shard.color, fontWeight: 600 }}>
                        ● {shard.load}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Live Event Stream Console */}
              <div
                style={{
                  padding: '18px 24px',
                  borderRadius: 16,
                  backgroundColor: 'rgba(11, 14, 23, 0.95)',
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
