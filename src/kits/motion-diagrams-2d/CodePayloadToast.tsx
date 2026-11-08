import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONTS, SPRING_PRESETS, THEME } from '../../theme';

export interface CodePayloadToastProps {
  /** Center X position */
  x: number;
  /** Center Y position */
  y: number;
  width?: number;
  methodBadge: string;
  endpoint: string;
  latencyText?: string;
  code: string;
  accentColor?: string;
  startFrame: number;
  endFrame: number;
}

/**
 * Lightweight deterministic syntax highlighter for JSON / TS / SQL snippets
 * rendered in JetBrains Mono.
 */
function renderHighlightedLine(line: string, accentColor: string): React.ReactNode {
  // Match `"key": value` patterns in JSON
  const jsonKeyMatch = line.match(/^(\s*)("[^"]+")(\s*:\s*)(.*)$/);
  if (jsonKeyMatch) {
    const [, indent, keyPart, colonPart, valuePart] = jsonKeyMatch;
    return (
      <>
        <span>{indent}</span>
        <span style={{ color: '#93C5FD' }}>{keyPart}</span>
        <span style={{ color: '#64748B' }}>{colonPart}</span>
        {renderJsonValue(valuePart, accentColor)}
      </>
    );
  }

  // SQL / TS keywords
  const sqlKeywords = /\b(INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)\b/g;
  if (sqlKeywords.test(line)) {
    const tokens = line.split(/(\b(?:INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)\b)/g);
    return tokens.map((tok, idx) =>
      /^(INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)$/.test(tok) ? (
        <span key={idx} style={{ color: accentColor, fontWeight: 600 }}>
          {tok}
        </span>
      ) : (
        <span key={idx} style={{ color: '#E2E8F0' }}>
          {tok}
        </span>
      )
    );
  }

  return <span style={{ color: '#94A3B8' }}>{line}</span>;
}

function renderJsonValue(raw: string, accentColor: string): React.ReactNode {
  const trailingComma = raw.endsWith(',') ? ',' : '';
  const clean = raw.endsWith(',') ? raw.slice(0, -1) : raw;

  if (/^".*"$/.test(clean)) {
    return (
      <>
        <span style={{ color: '#6EE7B7' }}>{clean}</span>
        <span style={{ color: '#64748B' }}>{trailingComma}</span>
      </>
    );
  }
  if (/^(true|false|null)$/.test(clean)) {
    return (
      <>
        <span style={{ color: accentColor, fontWeight: 600 }}>{clean}</span>
        <span style={{ color: '#64748B' }}>{trailingComma}</span>
      </>
    );
  }
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return (
      <>
        <span style={{ color: '#FCD34D' }}>{clean}</span>
        <span style={{ color: '#64748B' }}>{trailingComma}</span>
      </>
    );
  }

  return <span style={{ color: '#E2E8F0' }}>{raw}</span>;
}

export const CodePayloadToast: React.FC<CodePayloadToastProps> = ({
  x,
  y,
  width = 410,
  methodBadge,
  endpoint,
  latencyText = '18ms',
  code,
  accentColor = THEME.colors.accents.cyan,
  startFrame,
  endFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame - 2 || frame > endFrame + 24) {
    return null;
  }

  const enterProgress = spring({
    frame: frame - startFrame,
    fps,
    config: SPRING_PRESETS.snappy,
  });

  const exitProgress = interpolate(frame, [endFrame, endFrame + 18], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const combined = enterProgress * exitProgress;
  const translateY = interpolate(enterProgress, [0, 1], [18, 0]);
  const scale = interpolate(combined, [0, 1], [0.92, 1]);

  const lines = code.trim().split('\n');

  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y,
        width,
        opacity: combined,
        transform: `translateY(${translateY}px) scale(${scale})`,
        borderRadius: THEME.radii.md,
        backgroundColor: 'rgba(11, 14, 23, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${accentColor}44`,
        boxShadow: `0 24px 60px rgba(0, 0, 0, 0.8), 0 0 28px ${accentColor}22, 0 1px 0 rgba(255, 255, 255, 0.1) inset`,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: 5,
              backgroundColor: `${accentColor}24`,
              border: `1px solid ${accentColor}66`,
              fontFamily: FONTS.mono,
              fontSize: 10,
              fontWeight: 600,
              color: accentColor,
              letterSpacing: '0.04em',
            }}
          >
            {methodBadge}
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11.5,
              fontWeight: 500,
              color: THEME.colors.textPrimary,
            }}
          >
            {endpoint}
          </span>
        </div>

        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10.5,
            color: THEME.colors.textSecondary,
          }}
        >
          {latencyText}
        </span>
      </div>

      {/* Code Body */}
      <div
        style={{
          padding: '12px 16px',
          fontFamily: FONTS.mono,
          fontSize: 12,
          lineHeight: 1.55,
          whiteSpace: 'pre',
        }}
      >
        {lines.map((line, idx) => {
          const lineOpacity = interpolate(
            frame - startFrame,
            [idx * 2, idx * 2 + 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          return (
            <div
              key={idx}
              style={{
                opacity: lineOpacity,
                display: 'flex',
              }}
            >
              <span
                style={{
                  width: 22,
                  color: 'rgba(100, 116, 139, 0.45)',
                  userSelect: 'none',
                  fontSize: 10.5,
                }}
              >
                {idx + 1}
              </span>
              <span>{renderHighlightedLine(line, accentColor)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
