import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  formatFontFamilyCss,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export interface CodePayloadToastProps {
  x: number;
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

function renderHighlightedLine(
  line: string,
  accentColor: string,
  isDark: boolean,
  textPrimary: string,
  textSecondary: string
): React.ReactNode {
  const keyColor = isDark ? '#93C5FD' : '#1D4ED8';
  const punctColor = textSecondary;

  const jsonKeyMatch = line.match(/^(\s*)("[^"]+")(\s*:\s*)(.*)$/);
  if (jsonKeyMatch) {
    const [, indent, keyPart, colonPart, valuePart] = jsonKeyMatch;
    return (
      <>
        <span>{indent}</span>
        <span style={{ color: keyColor }}>{keyPart}</span>
        <span style={{ color: punctColor }}>{colonPart}</span>
        {renderJsonValue(valuePart, accentColor, isDark, textPrimary, punctColor)}
      </>
    );
  }

  const sqlKeywords = /\b(INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)\b/g;
  if (sqlKeywords.test(line)) {
    const tokens = line.split(/(\b(?:INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)\b)/g);
    return tokens.map((tok, idx) =>
      /^(INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)$/.test(tok) ? (
        <span key={idx} style={{ color: accentColor, fontWeight: 600 }}>
          {tok}
        </span>
      ) : (
        <span key={idx} style={{ color: textPrimary }}>
          {tok}
        </span>
      )
    );
  }

  return <span style={{ color: textSecondary }}>{line}</span>;
}

function renderJsonValue(
  raw: string,
  accentColor: string,
  isDark: boolean,
  textPrimary: string,
  punctColor: string
): React.ReactNode {
  const trailingComma = raw.endsWith(',') ? ',' : '';
  const clean = raw.endsWith(',') ? raw.slice(0, -1) : raw;

  if (/^".*"$/.test(clean)) {
    return (
      <>
        <span style={{ color: isDark ? '#6EE7B7' : '#059669' }}>{clean}</span>
        <span style={{ color: punctColor }}>{trailingComma}</span>
      </>
    );
  }
  if (/^(true|false|null)$/.test(clean)) {
    return (
      <>
        <span style={{ color: accentColor, fontWeight: 600 }}>{clean}</span>
        <span style={{ color: punctColor }}>{trailingComma}</span>
      </>
    );
  }
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return (
      <>
        <span style={{ color: isDark ? '#FCD34D' : '#B45309' }}>{clean}</span>
        <span style={{ color: punctColor }}>{trailingComma}</span>
      </>
    );
  }

  return <span style={{ color: textPrimary }}>{raw}</span>;
}

export const CodePayloadToast: React.FC<CodePayloadToastProps> = ({
  x,
  y,
  width = 410,
  methodBadge,
  endpoint,
  latencyText = '18ms',
  code,
  accentColor,
  startFrame,
  endFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const studioStyle = useStudioStyle();

  if (frame < startFrame - 2 || frame > endFrame + 24) {
    return null;
  }

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );
  const isDark = studioStyle.surface.isDark;

  const enterProgress = spring({
    frame: frame - startFrame,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  const exitProgress = interpolate(frame, [endFrame, endFrame + 18], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const combined = enterProgress * exitProgress;
  const translateY = interpolate(enterProgress, [0, 1], [18, 0]);
  const scale = interpolate(combined, [0, 1], [0.92, 1]);

  const lines = code.trim().split('\n');

  const chromeStyle = getCardChromeStyle(studioStyle, {
    borderRadius: Math.max(0, Math.round(14 * studioStyle.surface.radiusScale)),
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y,
        width,
        opacity: combined,
        willChange: 'transform, opacity',
        transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
        ...chromeStyle,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.03)'
            : studioStyle.palette.bgElevated,
          borderBottom: `1px solid ${studioStyle.palette.inkBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: Math.max(
                0,
                Math.round(5 * studioStyle.surface.radiusScale)
              ),
              backgroundColor: `${resolvedAccent}24`,
              border: `1px solid ${resolvedAccent}66`,
              fontFamily: monoFontCss,
              fontSize: 10,
              fontWeight: 600,
              color: resolvedAccent,
              letterSpacing: '0.04em',
            }}
          >
            {methodBadge}
          </span>
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 11.5,
              fontWeight: 500,
              color: studioStyle.palette.textPrimary,
            }}
          >
            {endpoint}
          </span>
        </div>

        <span
          style={{
            fontFamily: monoFontCss,
            fontSize: 10.5,
            color: studioStyle.palette.textSecondary,
          }}
        >
          {latencyText}
        </span>
      </div>

      <div
        style={{
          padding: '12px 16px',
          fontFamily: monoFontCss,
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
                  color: `${studioStyle.palette.textSecondary}88`,
                  userSelect: 'none',
                  fontSize: 10.5,
                }}
              >
                {idx + 1}
              </span>
              <span>
                {renderHighlightedLine(
                  line,
                  resolvedAccent,
                  isDark,
                  studioStyle.palette.textPrimary,
                  studioStyle.palette.textSecondary
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
