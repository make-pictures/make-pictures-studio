import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONTS, SPRING_PRESETS, THEME } from '../../theme';

export interface SystemNodeProps {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  statusText: string;
  activeStatusText?: string;
  icon: LucideIcon;
  /** Center X position on the 1920x1080 stage */
  x: number;
  /** Center Y position on the 1920x1080 stage */
  y: number;
  width?: number;
  height?: number;
  accentColor?: string;
  enterFrame?: number;
  /** Array of [startFrame, endFrame] intervals when this node glows actively */
  activeRanges?: Array<[number, number]>;
  metricsLabel?: string;
  metricsValue?: string;
}

export const SystemNode: React.FC<SystemNodeProps> = ({
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
  accentColor = THEME.colors.accents.cyan,
  enterFrame = 0,
  activeRanges = [],
  metricsLabel,
  metricsValue,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring (damped, no rubbery bounce)
  const enterProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  // Compute active glow intensity across all activeRanges
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
  const pulseWave = interpolate(Math.sin((frame - enterFrame) / 8), [-1, 1], [0.75, 1.15]);
  const glowIntensity = activeStrength * pulseWave;

  const scale =
    interpolate(enterProgress, [0, 1], [0.88, 1]) +
    interpolate(activeStrength, [0, 1], [0, 0.028]);
  const translateY = interpolate(enterProgress, [0, 1], [28, 0]);
  const opacity = interpolate(enterProgress, [0, 0.65, 1], [0, 0.9, 1]);

  const displayedStatus =
    isCurrentlyActive && activeStatusText ? activeStatusText : statusText;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        borderRadius: THEME.radii.lg,
        backgroundColor: THEME.colors.bgElevated,
        backgroundImage: `radial-gradient(130% 110% at 50% 0%, ${accentColor}${
          isCurrentlyActive ? '26' : '0E'
        } 0%, rgba(15, 18, 29, 0.4) 68%)`,
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: `1px solid ${
          isCurrentlyActive ? `${accentColor}88` : 'rgba(255, 255, 255, 0.08)'
        }`,
        boxShadow:
          activeStrength > 0.02
            ? THEME.shadows.glow(accentColor, glowIntensity)
            : THEME.shadows.card,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Top Specular Edge Highlight */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '12%',
          right: '12%',
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${
            isCurrentlyActive ? accentColor : 'rgba(255,255,255,0.22)'
          }, transparent)`,
          opacity: interpolate(activeStrength, [0, 1], [0.55, 1]),
        }}
      />

      {/* Header Row: Icon + Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: `${accentColor}${isCurrentlyActive ? '28' : '14'}`,
            border: `1px solid ${accentColor}${isCurrentlyActive ? '77' : '33'}`,
            boxShadow: isCurrentlyActive
              ? `0 0 22px ${accentColor}55`
              : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            size={22}
            color={isCurrentlyActive ? '#FFFFFF' : accentColor}
            strokeWidth={2}
          />
        </div>

        <div
          style={{
            padding: '4px 10px',
            borderRadius: THEME.radii.pill,
            backgroundColor: 'rgba(255, 255, 255, 0.045)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontFamily: FONTS.mono,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: isCurrentlyActive ? accentColor : THEME.colors.textSecondary,
          }}
        >
          {badge}
        </div>
      </div>

      {/* Title & Subtitle */}
      <div style={{ marginTop: 6 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: THEME.colors.textPrimary,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 400,
            color: THEME.colors.textSecondary,
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Footer Status & Telemetry Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
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
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isCurrentlyActive
                ? accentColor
                : 'rgba(148, 163, 184, 0.45)',
              boxShadow: isCurrentlyActive
                ? `0 0 12px ${accentColor}, 0 0 24px ${accentColor}`
                : 'none',
            }}
          />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11.5,
              fontWeight: 500,
              color: isCurrentlyActive
                ? THEME.colors.textPrimary
                : THEME.colors.textMuted,
              letterSpacing: '0.02em',
            }}
          >
            {displayedStatus}
          </span>
        </div>

        {metricsLabel && metricsValue && (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: THEME.colors.textSecondary,
            }}
          >
            <span style={{ color: THEME.colors.textMuted }}>{metricsLabel}: </span>
            <span style={{ color: isCurrentlyActive ? accentColor : '#E2E8F0' }}>
              {metricsValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
