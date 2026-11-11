import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { SPRING_PRESETS } from '../../../core/src/theme/tokens';
import { createSeededRandom } from '../../../core/src/utils/prng';

export type ParticlePreset =
  | 'dust-motes'
  | 'snow'
  | 'rain'
  | 'sparks'
  | 'confetti'
  | 'speed-lines';

export interface ParticleFieldProps {
  preset?: ParticlePreset;
  count?: number;
  color?: string;
  seed?: number;
  intensity?: number;
  /** Respects Frame 0 clean-board invariant (`opacity = 0` at `frame === 0`, default `true`) */
  cleanFrameZero?: boolean;
  zIndex?: number;
}

interface ParticleDescriptor {
  index: number;
  u0: number;
  v0: number;
  speedU: number;
  speedV: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  size: number;
  baseOpacity: number;
  rot0: number;
  rotSpeed: number;
  color: string;
  depth: number;
}

const CONFETTI_PALETTE = [
  '#2563EB',
  '#FF2A85',
  '#10B981',
  '#F59E0B',
  '#38BDF8',
  '#7209B7',
];

function wrap01(v: number): number {
  const m = v % 1;
  return m < 0 ? m + 1 : m;
}

function defaultCountForPreset(preset: ParticlePreset): number {
  switch (preset) {
    case 'dust-motes':
      return 34;
    case 'snow':
      return 48;
    case 'rain':
      return 64;
    case 'sparks':
      return 38;
    case 'confetti':
      return 52;
    case 'speed-lines':
      return 28;
  }
}

function defaultColorForPreset(preset: ParticlePreset): string {
  switch (preset) {
    case 'dust-motes':
      return '#FDE68A';
    case 'snow':
      return '#FFFFFF';
    case 'rain':
      return '#BAE6FD';
    case 'sparks':
      return '#FB923C';
    case 'confetti':
      return '#FF2A85';
    case 'speed-lines':
      return '#E0E7FF';
  }
}

/**
 * 100% Analytical Deterministic 60 FPS 2D Particle Layer.
 * Every particle's `(x, y, rotation, opacity, scale)` is evaluated as a pure
 * closed-form function `f(frame, index, seed)` — safe under multi-core out-of-order renders.
 */
export const ParticleField: React.FC<ParticleFieldProps> = ({
  preset = 'dust-motes',
  count,
  color,
  seed = 108,
  intensity = 1,
  cleanFrameZero = true,
  zIndex = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const resolvedCount = Math.max(
    0,
    Math.round((count ?? defaultCountForPreset(preset)) * Math.max(0.25, intensity))
  );
  const baseColor = color ?? defaultColorForPreset(preset);

  const descriptors = useMemo<ParticleDescriptor[]>(() => {
    const list: ParticleDescriptor[] = [];
    for (let i = 0; i < resolvedCount; i++) {
      const rand = createSeededRandom(`particle:${preset}:${seed}:${i}`);
      const depth = 0.35 + rand() * 0.65;
      const u0 = rand();
      const v0 = rand();
      const swayPhase = rand() * Math.PI * 2;
      let rot0 = rand() * 360;

      let speedU = 0;
      let speedV = 0;
      let swayAmp = 0;
      let swayFreq = 0.035;
      let size = 4;
      let baseOpacity = 0.5;
      let rotSpeed = 0;
      let itemColor = baseColor;

      if (preset === 'dust-motes') {
        speedU = (rand() - 0.5) * 0.025 * depth;
        speedV = -(0.018 + rand() * 0.028) * depth;
        swayAmp = 14 + rand() * 24;
        swayFreq = 0.031 + rand() * 0.02;
        size = (2.2 + rand() * 5.2) * depth;
        baseOpacity = 0.22 + rand() * 0.45;
      } else if (preset === 'snow') {
        speedU = (rand() - 0.35) * 0.04 * depth;
        speedV = (0.085 + rand() * 0.095) * depth;
        swayAmp = 18 + rand() * 28;
        swayFreq = 0.032 + rand() * 0.02;
        size = (2.8 + rand() * 5.5) * depth;
        baseOpacity = 0.38 + rand() * 0.5;
      } else if (preset === 'rain') {
        speedU = -0.18 * depth;
        speedV = (0.95 + rand() * 0.45) * depth;
        size = (26 + rand() * 36) * depth;
        baseOpacity = 0.2 + rand() * 0.34;
        rot0 = 11;
      } else if (preset === 'sparks') {
        speedU = (rand() - 0.42) * 0.11 * depth;
        speedV = -(0.22 + rand() * 0.28) * depth;
        swayAmp = 16 + rand() * 30;
        swayFreq = 0.042 + rand() * 0.012;
        size = (2.4 + rand() * 4.2) * depth;
        baseOpacity = 0.55 + rand() * 0.42;
        itemColor =
          color ?? (rand() > 0.45 ? '#FB923C' : rand() > 0.5 ? '#FDE047' : '#F43F5E');
      } else if (preset === 'confetti') {
        speedU = (rand() - 0.5) * 0.07;
        speedV = (0.16 + rand() * 0.16) * depth;
        swayAmp = 24 + rand() * 34;
        swayFreq = 0.036 + rand() * 0.018;
        size = (8 + rand() * 8) * (0.65 + depth * 0.35);
        baseOpacity = 0.78 + rand() * 0.22;
        rotSpeed = (rand() > 0.5 ? 1 : -1) * (95 + rand() * 130);
        itemColor =
          color ?? CONFETTI_PALETTE[Math.floor(rand() * CONFETTI_PALETTE.length)];
      } else if (preset === 'speed-lines') {
        speedU = -(1.45 + rand() * 0.95) * depth;
        speedV = 0;
        size = (120 + rand() * 220) * depth;
        baseOpacity = 0.14 + rand() * 0.32;
      }

      list.push({
        index: i,
        u0,
        v0,
        speedU,
        speedV,
        swayAmp,
        swayFreq,
        swayPhase,
        size,
        baseOpacity,
        rot0,
        rotSpeed,
        color: itemColor,
        depth,
      });
    }
    return list;
  }, [preset, resolvedCount, seed, baseColor, color]);

  const enterOpacity = cleanFrameZero
    ? spring({
        frame: frame - 2,
        fps,
        config: SPRING_PRESETS.smooth,
      })
    : 1;

  if (enterOpacity <= 0.005 || resolvedCount === 0 || intensity <= 0) {
    return null;
  }

  const tSec = frame / Math.max(1, fps);
  const f60 = frame * (60 / Math.max(1, fps));
  const margin = 80;
  const spanW = width + margin * 2;
  const spanH = height + margin * 2;
  const ampOpacity = Math.min(1.35, Math.max(0, intensity));

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: enterOpacity,
        zIndex,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        {descriptors.map((p) => {
          const u = wrap01(p.u0 + p.speedU * tSec);
          const v = wrap01(p.v0 + p.speedV * tSec);
          const sway = Math.sin(f60 * p.swayFreq + p.swayPhase) * p.swayAmp;

          const x = -margin + u * spanW + (preset === 'speed-lines' ? 0 : sway);
          const y =
            -margin + v * spanH + (preset === 'dust-motes' ? sway * 0.35 : 0);

          // Soft edge fade near wrap boundaries so particles never pop visibly
          const edgeFadeV =
            v < 0.08 ? v / 0.08 : v > 0.92 ? (1 - v) / 0.08 : 1;
          const twinkle =
            preset === 'dust-motes' || preset === 'sparks'
              ? 0.65 + 0.35 * Math.sin(f60 * 0.045 + p.swayPhase)
              : 1;
          const alpha = Math.min(
            1,
            p.baseOpacity * ampOpacity * edgeFadeV * twinkle
          );

          if (alpha <= 0.01) return null;

          if (preset === 'rain') {
            const rad = (p.rot0 * Math.PI) / 180;
            const dx = -Math.sin(rad) * p.size;
            const dy = Math.cos(rad) * p.size;
            return (
              <line
                key={p.index}
                x1={x}
                y1={y}
                x2={x + dx}
                y2={y + dy}
                stroke={p.color}
                strokeWidth={1.4 * p.depth + 0.5}
                strokeLinecap="round"
                opacity={alpha}
              />
            );
          }

          if (preset === 'speed-lines') {
            const edgeFadeU =
              u < 0.1 ? u / 0.1 : u > 0.9 ? (1 - u) / 0.1 : 1;
            return (
              <line
                key={p.index}
                x1={x}
                y1={y}
                x2={x + p.size}
                y2={y}
                stroke={p.color}
                strokeWidth={1.6 + p.depth * 2.2}
                strokeLinecap="round"
                opacity={alpha * edgeFadeU}
              />
            );
          }

          if (preset === 'confetti') {
            const rot = p.rot0 + p.rotSpeed * tSec;
            const tumbleScaleY = Math.max(
              0.22,
              Math.abs(Math.cos(f60 * 0.052 + p.swayPhase))
            );
            const w = p.size;
            const h = p.size * 0.58;
            return (
              <rect
                key={p.index}
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                rx={1.8}
                fill={p.color}
                opacity={alpha}
                transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(1, ${tumbleScaleY.toFixed(2)})`}
              />
            );
          }

          if (preset === 'sparks') {
            return (
              <g key={p.index} opacity={alpha}>
                <circle cx={x} cy={y} r={p.size * 2.3} fill={p.color} opacity={0.24} />
                <circle cx={x} cy={y} r={p.size} fill="#FFFBEB" />
              </g>
            );
          }

          // 'dust-motes' & 'snow'
          return (
            <g key={p.index} opacity={alpha}>
              {preset === 'dust-motes' && (
                <circle cx={x} cy={y} r={p.size * 2.2} fill={p.color} opacity={0.2} />
              )}
              <circle cx={x} cy={y} r={p.size} fill={p.color} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
