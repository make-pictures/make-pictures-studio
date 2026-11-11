import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { STUDIO_THEME } from '../../../core/src/theme/tokens';

export type SceneTransitionType =
  | 'iris-wipe'
  | 'whip-pan'
  | 'paper-curtain'
  | 'flash-cut'
  | 'ink-wash';

export interface SceneTransitionProps {
  /** Frame where the transition reaches 100% coverage (place your underlying scene cut here) */
  atFrame: number;
  /** Total transition duration centered around `atFrame` (default `28` frames @ 60 FPS) */
  durationInFrames?: number;
  /** Visual transition choreography style (default `'iris-wipe'`) */
  type?: SceneTransitionType;
  /** Primary brand / trim color (default `STUDIO_THEME.colors.brand[600]`) */
  accentColor?: string;
  /** Deep backdrop curtain/wipe color (default `'#0F172A'`) */
  backdropColor?: string;
  /** Wipe travel direction for `'whip-pan'` (default `'left'`) */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Deterministic SVG displacement seed for `'ink-wash'` (default `51`) */
  seed?: number;
  zIndex?: number;
}

/**
 * Declarative 60 FPS Scene Transition Overlay centered around `atFrame`.
 * Renders `null` outside its `[atFrame - duration/2, atFrame + duration/2]` window.
 */
export const SceneTransition: React.FC<SceneTransitionProps> = ({
  atFrame,
  durationInFrames = 28,
  type = 'iris-wipe',
  accentColor = STUDIO_THEME.colors.brand[600],
  backdropColor = '#0F172A',
  direction = 'left',
  seed = 51,
  zIndex = 80,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const dur = Math.max(6, durationInFrames);
  const half = dur / 2;
  const startFrame = atFrame - half;
  const endFrame = atFrame + half;

  if (frame <= startFrame || frame >= endFrame) {
    return null;
  }

  // Normalized linear progress u ∈ (0, 1); u = 0.5 is exact peak coverage at `atFrame`
  const u = (frame - startFrame) / dur;
  // Symmetric bell coverage 0 -> 1 -> 0 with smooth cubic easing
  const coverProgress =
    u <= 0.5
      ? interpolate(u, [0, 0.5], [0, 1], {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : interpolate(u, [0.5, 1], [1, 0], {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  const diagRadius = Math.hypot(width, height) * 0.55;

  if (type === 'flash-cut') {
    const flashOpacity =
      u <= 0.5
        ? Math.pow(u * 2, 2.2)
        : Math.pow(Math.max(0, 1 - (u - 0.5) * 2), 1.65);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          zIndex,
          opacity: flashOpacity,
          background: `radial-gradient(circle at 50% 50%, #FFFFFF 0%, #FFFBEB 45%, ${accentColor} 100%)`,
        }}
      />
    );
  }

  if (type === 'whip-pan') {
    const sweep = interpolate(u, [0, 1], [-1.25, 1.25], {
      easing: Easing.inOut(Easing.cubic),
    });
    const isHorizontal = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    const tx = isHorizontal ? sweep * sign * width : 0;
    const ty = !isHorizontal ? sweep * sign * height : 0;

    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -width * 0.35,
            top: -height * 0.35,
            width: width * 1.7,
            height: height * 1.7,
            transform: `translate3d(${tx}px, ${ty}px, 0) skewX(${isHorizontal ? -10 * sign : 0}deg)`,
            background: isHorizontal
              ? `linear-gradient(90deg, transparent 0%, ${accentColor} 16%, ${backdropColor} 32%, ${backdropColor} 68%, ${accentColor} 84%, transparent 100%)`
              : `linear-gradient(180deg, transparent 0%, ${accentColor} 16%, ${backdropColor} 32%, ${backdropColor} 68%, ${accentColor} 84%, transparent 100%)`,
            boxShadow: `0 0 80px ${accentColor}88`,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (type === 'paper-curtain') {
    const slidePct = (1 - coverProgress) * 104;
    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex,
        }}
      >
        {/* Left Deckle-Edged Paper Wing */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '53%',
            height: '100%',
            backgroundColor: '#FFFBEB',
            borderRight: `14px solid ${accentColor}`,
            boxShadow: '18px 0 48px rgba(15, 23, 42, 0.35)',
            transform: `translate3d(${-slidePct}%, 0, 0)`,
          }}
        />
        {/* Right Deckle-Edged Paper Wing */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '53%',
            height: '100%',
            backgroundColor: '#FEF3C7',
            borderLeft: `14px solid ${accentColor}`,
            boxShadow: '-18px 0 48px rgba(15, 23, 42, 0.35)',
            transform: `translate3d(${slidePct}%, 0, 0)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (type === 'ink-wash') {
    const filterId = `mp-ink-wash-${Math.abs(seed)}`;
    const blobRadius = coverProgress * diagRadius * 1.22;
    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex,
        }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012"
                numOctaves={3}
                seed={Math.abs(seed) % 97}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={Math.round(140 * Math.sin(Math.PI * u))}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
          <g filter={`url(#${filterId})`}>
            <circle
              cx={width / 2}
              cy={height / 2}
              r={blobRadius + 18}
              fill={accentColor}
            />
            <circle
              cx={width / 2}
              cy={height / 2}
              r={blobRadius}
              fill={backdropColor}
            />
          </g>
        </svg>
      </AbsoluteFill>
    );
  }

  // Default: 'iris-wipe' (circular aperture closing to r = 0 at atFrame, then opening)
  const holeRadius = Math.max(0, (1 - coverProgress) * diagRadius);
  const maskId = `mp-iris-mask-${Math.abs(seed)}-${atFrame}`;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex,
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <mask id={maskId}>
            <rect x={0} y={0} width={width} height={height} fill="white" />
            <circle
              cx={width / 2}
              cy={height / 2}
              r={holeRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={backdropColor}
          mask={`url(#${maskId})`}
        />
        {holeRadius > 2 && (
          <circle
            cx={width / 2}
            cy={height / 2}
            r={holeRadius}
            fill="none"
            stroke={accentColor}
            strokeWidth={10}
          />
        )}
      </svg>
    </AbsoluteFill>
  );
};
