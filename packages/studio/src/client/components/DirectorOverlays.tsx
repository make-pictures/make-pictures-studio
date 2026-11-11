import React from 'react';
import type { OverlaySettings } from '../types';

export interface DirectorOverlaysProps {
  width: number;
  height: number;
  overlays: OverlaySettings;
}

/**
 * Pixel-exact SVG composition overlays mapped to the video's native coordinate system:
 * - `Golden Safe Box (9:16)` (`1080×1920` per AGENTS.md:
 *   Top Dead Zone y=0..220, Bottom Dead Zone y=1440..1920, Right Rail x=910..1080 for y>900,
 *   Safe Box x ∈ [40, 910], y ∈ [220, 1380])
 * - `Rule of Thirds` (3×3 optical grid + center reticle)
 * - `Safe Margins` (90% Action Safe & 80% Title Safe)
 */
export const DirectorOverlays: React.FC<DirectorOverlaysProps> = ({
  width,
  height,
  overlays,
}) => {
  const { goldenSafeBox, ruleOfThirds, safeMargins } = overlays;
  if (!goldenSafeBox && !ruleOfThirds && !safeMargins) {
    return null;
  }

  const isVertical = height > width;
  const strokeUnit = Math.max(1.5, Math.min(width, height) / 540);
  const labelFontSize = Math.round(Math.max(18, Math.min(width, height) * 0.02));

  // Scale Shorts dead zones proportionally if another vertical resolution is used (1:1 at 1080x1920)
  const sx = width / 1080;
  const sy = height / 1920;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 12,
      }}
    >
      {/* ==================== 1. RULE OF THIRDS ==================== */}
      {ruleOfThirds && (
        <g>
          <line
            x1={width / 3}
            y1={0}
            x2={width / 3}
            y2={height}
            stroke="rgba(37, 99, 235, 0.45)"
            strokeWidth={strokeUnit}
          />
          <line
            x1={(width * 2) / 3}
            y1={0}
            x2={(width * 2) / 3}
            y2={height}
            stroke="rgba(37, 99, 235, 0.45)"
            strokeWidth={strokeUnit}
          />
          <line
            x1={0}
            y1={height / 3}
            x2={width}
            y2={height / 3}
            stroke="rgba(37, 99, 235, 0.45)"
            strokeWidth={strokeUnit}
          />
          <line
            x1={0}
            y1={(height * 2) / 3}
            x2={width}
            y2={(height * 2) / 3}
            stroke="rgba(37, 99, 235, 0.45)"
            strokeWidth={strokeUnit}
          />
          {/* Center Reticle */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={strokeUnit * 6}
            fill="none"
            stroke="rgba(37, 99, 235, 0.65)"
            strokeWidth={strokeUnit}
          />
          <line
            x1={width / 2 - strokeUnit * 12}
            y1={height / 2}
            x2={width / 2 + strokeUnit * 12}
            y2={height / 2}
            stroke="rgba(37, 99, 235, 0.65)"
            strokeWidth={strokeUnit}
          />
          <line
            x1={width / 2}
            y1={height / 2 - strokeUnit * 12}
            x2={width / 2}
            y2={height / 2 + strokeUnit * 12}
            stroke="rgba(37, 99, 235, 0.65)"
            strokeWidth={strokeUnit}
          />
        </g>
      )}

      {/* ==================== 2. 16:9 ACTION / TITLE SAFE MARGINS ==================== */}
      {safeMargins && (
        <g>
          {/* 90% Action Safe */}
          <rect
            x={width * 0.05}
            y={height * 0.05}
            width={width * 0.9}
            height={height * 0.9}
            fill="none"
            stroke="rgba(14, 165, 233, 0.65)"
            strokeWidth={strokeUnit * 1.2}
            strokeDasharray={`${strokeUnit * 8} ${strokeUnit * 6}`}
          />
          {/* 80% Title Safe */}
          <rect
            x={width * 0.1}
            y={height * 0.1}
            width={width * 0.8}
            height={height * 0.8}
            fill="none"
            stroke="rgba(99, 102, 241, 0.65)"
            strokeWidth={strokeUnit * 1.2}
            strokeDasharray={`${strokeUnit * 4} ${strokeUnit * 5}`}
          />
          <rect
            x={width * 0.1 + 10}
            y={height * 0.1 + 10}
            width={labelFontSize * 9.5}
            height={labelFontSize * 1.7}
            rx={6}
            fill="rgba(15, 23, 42, 0.75)"
          />
          <text
            x={width * 0.1 + 20}
            y={height * 0.1 + 10 + labelFontSize * 1.2}
            fill="#E0E7FF"
            fontFamily="JetBrains Mono, monospace"
            fontSize={labelFontSize * 0.85}
            fontWeight={700}
          >
            TITLE SAFE 80%
          </text>
        </g>
      )}

      {/* ==================== 3. GOLDEN SAFE BOX (9:16 SHORTS / REELS) ==================== */}
      {goldenSafeBox && isVertical && (
        <g>
          {/* Top Dead Zone: y = 0..220 (Status bar, Dynamic Island, Shorts top controls) */}
          <rect
            x={0}
            y={0}
            width={width}
            height={220 * sy}
            fill="rgba(244, 63, 94, 0.18)"
          />
          <line
            x1={0}
            y1={220 * sy}
            x2={width}
            y2={220 * sy}
            stroke="rgba(244, 63, 94, 0.8)"
            strokeWidth={strokeUnit * 1.4}
          />
          {/* iOS Dynamic Island Silhouette */}
          <rect
            x={390 * sx}
            y={38 * sy}
            width={300 * sx}
            height={56 * sy}
            rx={28 * sy}
            fill="rgba(15, 23, 42, 0.62)"
          />
          <text
            x={44 * sx}
            y={188 * sy}
            fill="#FFF1F2"
            fontFamily="JetBrains Mono, monospace"
            fontSize={22 * sx}
            fontWeight={700}
          >
            MARTWA STREFA GÓRA (0..220px • Dynamic Island & UI)
          </text>

          {/* Bottom Dead Zone: y = 1440..1920 (bottom 480px — Channel, Title, Captions) */}
          <rect
            x={0}
            y={1440 * sy}
            width={width}
            height={480 * sy}
            fill="rgba(244, 63, 94, 0.22)"
          />
          <line
            x1={0}
            y1={1440 * sy}
            x2={width}
            y2={1440 * sy}
            stroke="rgba(244, 63, 94, 0.85)"
            strokeWidth={strokeUnit * 1.5}
          />
          {/* Simulated Shorts Channel & Description Bars */}
          <circle
            cx={88 * sx}
            cy={1545 * sy}
            r={34 * sx}
            fill="rgba(15, 23, 42, 0.42)"
          />
          <rect
            x={140 * sx}
            y={1524 * sy}
            width={360 * sx}
            height={28 * sy}
            rx={8 * sy}
            fill="rgba(15, 23, 42, 0.42)"
          />
          <rect
            x={54 * sx}
            y={1610 * sy}
            width={720 * sx}
            height={24 * sy}
            rx={8 * sy}
            fill="rgba(15, 23, 42, 0.34)"
          />
          <rect
            x={54 * sx}
            y={1652 * sy}
            width={560 * sx}
            height={24 * sy}
            rx={8 * sy}
            fill="rgba(15, 23, 42, 0.34)"
          />
          <text
            x={48 * sx}
            y={1490 * sy}
            fill="#FFF1F2"
            fontFamily="JetBrains Mono, monospace"
            fontSize={22 * sx}
            fontWeight={700}
          >
            MARTWA STREFA DÓŁ (bottom 480px • Opis & Kanał Shorts)
          </text>

          {/* Right Action Rail: x = 910..1080, y = 900..1440 (Like, Comments, Share, Remix) */}
          <rect
            x={910 * sx}
            y={900 * sy}
            width={170 * sx}
            height={540 * sy}
            fill="rgba(245, 158, 11, 0.2)"
          />
          {[980, 1105, 1230, 1355].map((cyVal, idx) => (
            <circle
              key={idx}
              cx={995 * sx}
              cy={cyVal * sy}
              r={34 * sx}
              fill="rgba(15, 23, 42, 0.42)"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth={2 * sx}
            />
          ))}

          {/* GOLDEN SAFE BOX: x ∈ [40, 910], y ∈ [220, 1380] */}
          <rect
            x={40 * sx}
            y={220 * sy}
            width={870 * sx}
            height={1160 * sy}
            rx={16 * sx}
            fill="none"
            stroke="#10B981"
            strokeWidth={strokeUnit * 2.2}
            strokeDasharray={`${14 * sx} ${9 * sx}`}
          />
          <rect
            x={56 * sx}
            y={238 * sy}
            width={500 * sx}
            height={42 * sy}
            rx={10 * sx}
            fill="rgba(6, 95, 70, 0.9)"
          />
          <text
            x={74 * sx}
            y={266 * sy}
            fill="#ECFDF5"
            fontFamily="JetBrains Mono, monospace"
            fontSize={21 * sx}
            fontWeight={700}
          >
            GOLDEN SAFE BOX • x:[40..910] y:[220..1380]
          </text>
        </g>
      )}

      {/* Info badge when Golden Safe Box is toggled on a horizontal 16:9 composition */}
      {goldenSafeBox && !isVertical && (
        <g>
          <rect
            x={40}
            y={36}
            width={width - 80}
            height={height - 132}
            rx={14}
            fill="none"
            stroke="#10B981"
            strokeWidth={strokeUnit * 1.8}
            strokeDasharray={`${strokeUnit * 10} ${strokeUnit * 7}`}
          />
          {/* Bottom YouTube scrub bar caution strip */}
          <rect
            x={0}
            y={height - 96}
            width={width}
            height={96}
            fill="rgba(245, 158, 11, 0.16)"
          />
          <rect
            x={56}
            y={52}
            width={labelFontSize * 24}
            height={labelFontSize * 1.8}
            rx={8}
            fill="rgba(6, 95, 70, 0.9)"
          />
          <text
            x={72}
            y={52 + labelFontSize * 1.25}
            fill="#ECFDF5"
            fontFamily="JetBrains Mono, monospace"
            fontSize={labelFontSize * 0.85}
            fontWeight={700}
          >
            SAFE BOX (16:9 Podgląd • Przełącz na 9:16 dla siatki Shorts)
          </text>
        </g>
      )}
    </svg>
  );
};
