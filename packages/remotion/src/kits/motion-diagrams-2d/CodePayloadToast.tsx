import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ClippedSurfaceChrome,
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  useStudioStyle,
  type StylePreset,
} from "../..";

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

export interface PayloadTokenColors {
  keyColor: string;
  stringColor: string;
  numberColor: string;
  keywordColor: string;
  punctColor: string;
}

export function resolvePayloadTokenColors(
  style: StylePreset,
  explicitAccent?: string
): PayloadTokenColors {
  return {
    keyColor: explicitAccent ?? style.palette.accentPrimary,
    stringColor: style.palette.accentSecondary,
    numberColor: style.palette.textPrimary,
    keywordColor: explicitAccent ?? style.palette.accentPrimary,
    punctColor: style.palette.textSecondary,
  };
}

function renderHighlightedLine(
  line: string,
  tokens: PayloadTokenColors,
  textPrimary: string
): React.ReactNode {
  const jsonKeyMatch = line.match(/^(\s*)("[^"]+")(\s*:\s*)(.*)$/);
  if (jsonKeyMatch) {
    const [, indent, keyPart, colonPart, valuePart] = jsonKeyMatch;
    return (
      <>
        <span>{indent}</span>
        <span style={{ color: tokens.keyColor, fontWeight: 600 }}>{keyPart}</span>
        <span style={{ color: tokens.punctColor }}>{colonPart}</span>
        {renderJsonValue(valuePart, tokens, textPrimary)}
      </>
    );
  }

  const sqlKeywords =
    /\b(INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)\b/g;
  if (sqlKeywords.test(line)) {
    const parts = line.split(
      /(\b(?:INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)\b)/g
    );
    return parts.map((tok, idx) =>
      /^(INSERT|INTO|VALUES|SELECT|FROM|WHERE|RETURNING|await|const|return)$/.test(
        tok
      ) ? (
        <span key={idx} style={{ color: tokens.keywordColor, fontWeight: 700 }}>
          {tok}
        </span>
      ) : (
        <span key={idx} style={{ color: textPrimary }}>
          {tok}
        </span>
      )
    );
  }

  return <span style={{ color: tokens.punctColor }}>{line}</span>;
}

function renderJsonValue(
  raw: string,
  tokens: PayloadTokenColors,
  textPrimary: string
): React.ReactNode {
  const trailingComma = raw.endsWith(',') ? ',' : '';
  const clean = raw.endsWith(',') ? raw.slice(0, -1) : raw;

  if (/^".*"$/.test(clean)) {
    return (
      <>
        <span style={{ color: tokens.stringColor }}>{clean}</span>
        <span style={{ color: tokens.punctColor }}>{trailingComma}</span>
      </>
    );
  }
  if (/^(true|false|null)$/.test(clean)) {
    return (
      <>
        <span style={{ color: tokens.keywordColor, fontWeight: 700 }}>
          {clean}
        </span>
        <span style={{ color: tokens.punctColor }}>{trailingComma}</span>
      </>
    );
  }
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return (
      <>
        <span
          style={{
            color: tokens.numberColor,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clean}
        </span>
        <span style={{ color: tokens.punctColor }}>{trailingComma}</span>
      </>
    );
  }

  return <span style={{ color: textPrimary }}>{raw}</span>;
}

export const CodePayloadToast: React.FC<CodePayloadToastProps> = ({
  x,
  y,
  width = 480,
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

  const effectiveStart = Math.max(2, startFrame);
  if (frame <= 0 || frame < effectiveStart || frame > endFrame + 24) {
    return null;
  }

  const resolvedAccent = accentColor ?? studioStyle.palette.accentPrimary;
  const tokens = resolvePayloadTokenColors(studioStyle, resolvedAccent);
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const enterProgress = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  const exitProgress = interpolate(frame, [endFrame, endFrame + 18], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const combined = Math.max(0, Math.min(1, enterProgress * exitProgress));
  if (combined <= 0.002) {
    return null;
  }
  const snappedOpacity = combined >= 0.998 ? 1 : combined;

  const translateY = interpolate(enterProgress, [0, 1], [16, 0]);
  const scale = interpolate(combined, [0, 1], [0.94, 1]);
  const isToastSettled =
    Math.abs(translateY) < 0.25 && Math.abs(scale - 1) < 0.0005;
  const toastTransform = isToastSettled
    ? 'none'
    : `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  const lines = code.trim().split('\n');

  const plateChrome = getTactileSurfaceStyle(studioStyle, {
    elevation: 'floating',
    overrides: {
      borderRadius: Math.max(0, Math.round(8 * studioStyle.surface.radiusScale)),
    },
  });

  return (
    <div
      data-payload-plate="true"
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y,
        width,
        opacity: snappedOpacity,
        ...(isToastSettled ? {} : { willChange: 'transform, opacity' }),
        transform: toastTransform,
        ...plateChrome,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <ClippedSurfaceChrome
        topBarHeight={2.5}
        topBarColor={resolvedAccent}
        specularRim={!studioStyle.surface.isDark}
        style={{ zIndex: 2 }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px 8px 14px',
          backgroundColor: studioStyle.palette.bgElevated,
          borderBottom: `1px solid ${studioStyle.palette.inkBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: Math.max(
                0,
                Math.round(3 * studioStyle.surface.radiusScale)
              ),
              backgroundColor: studioStyle.palette.bgSurface,
              border: `1px solid ${resolvedAccent}`,
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 700,
              color: resolvedAccent,
              letterSpacing: '0.04em',
            }}
          >
            {methodBadge}
          </span>
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 600,
              color: studioStyle.palette.textPrimary,
            }}
          >
            {endpoint}
          </span>
        </div>

        <span
          style={{
            fontFamily: monoFontCss,
            fontSize: 18,
            fontVariantNumeric: 'tabular-nums',
            color: studioStyle.palette.textSecondary,
          }}
        >
          {latencyText}
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '11px 16px',
          fontFamily: monoFontCss,
          fontSize: 18,
          lineHeight: 1.48,
          whiteSpace: 'pre',
        }}
      >
        {lines.map((line, idx) => {
          const lineOpacity = interpolate(
            frame - effectiveStart,
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
                  width: 30,
                  color: studioStyle.palette.textSecondary,
                  opacity: 0.55,
                  userSelect: 'none',
                  fontSize: 18,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span>
                {renderHighlightedLine(
                  line,
                  tokens,
                  studioStyle.palette.textPrimary
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
