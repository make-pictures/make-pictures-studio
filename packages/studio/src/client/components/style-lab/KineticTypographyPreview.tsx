import React, { useMemo } from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  ClippedSurfaceChrome,
  DepthPlane,
  OpticalStage2D,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
  type OpticalShot2D,
} from '@make-pictures/core';
import { getSafeStageBounds } from './styleLabTypes';

export const KineticTypographyPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const grammar = optics.typographyGrammar;
  const bounds = getSafeStageBounds(width, height);

  const shots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      { fromFrame: 2, x: cx, y: cy, zoom: 1.0, focalZ: 0, transition: 'cut' },
      {
        fromFrame: 12,
        x: cx,
        y: cy - 4,
        zoom: 1.032,
        focalZ: 0,
        transition: 'glide',
      },
    ];
  }, [width, height]);

  const words = ['Rytm', 'słowa', 'buduje', 'głębię', 'kadru'];
  const activeWordIdx = Math.min(
    words.length - 1,
    Math.max(0, Math.floor((frame - 4) / 36) % words.length)
  );

  const cardEnter = spring({
    frame: frame - 22,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });
  const counterProgress = spring({
    frame: frame - 12,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const counterVal = (counterProgress * 98.4).toFixed(1).replace('.', ',');
  const litTicks = Math.round(counterProgress * 20);

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
    <OpticalStage2D shots={shots} seed={2027} startFrame={2}>
      {/* Plane z = -0.55: Subtle Typographic Baseline Rule */}
      <DepthPlane z={-0.55}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            right: bounds.left,
            top: Math.max(28, bounds.top - 18),
            height: 1,
            backgroundColor: style.palette.inkBorder,
            opacity: 0.36,
          }}
        />
      </DepthPlane>

      {/* Plane z = 0: Polymorphic Kinetic Stage */}
      <DepthPlane z={0}>
        <div
          data-typography-grammar={grammar}
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: grammar === 'optical-gate' ? 'center' : 'flex-start',
            gap: 32,
          }}
        >
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                grammar === 'optical-gate' ? 'center' : 'flex-start',
              gap: 14,
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: style.palette.accentPrimary,
              }}
            >
              Rytm narracji
            </span>
            {grammar !== 'optical-gate' && (
              <div
                style={{
                  flex: 1,
                  maxWidth: 160,
                  height: 1.5,
                  backgroundColor: style.palette.inkBorder,
                }}
              />
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent:
                grammar === 'optical-gate' ? 'center' : 'flex-start',
              gap: bounds.isVertical ? '12px 18px' : '14px 22px',
              transform:
                grammar === 'risograph-poster' ? 'rotate(-1deg)' : undefined,
            }}
          >
            {words.map((word, idx) => {
              const wSpring = spring({
                frame: frame - (2 + idx * 5),
                fps,
                config: getStyleSpringConfig(style, 'emphasis'),
              });
              const isCurrent = idx === activeWordIdx;

              if (grammar === 'risograph-poster') {
                return (
                  <span
                    key={word}
                    style={{
                      display: 'inline-block',
                      fontFamily: displayFont,
                      fontSize: bounds.isVertical ? 64 : 82,
                      fontWeight: 800,
                      lineHeight: 1.06,
                      letterSpacing: `${style.typography.displayTrackingEm}em`,
                      padding: isCurrent ? '4px 14px' : '4px 4px',
                      color: isCurrent ? '#FFFFFF' : style.palette.textPrimary,
                      backgroundColor: isCurrent
                        ? style.palette.accentPrimary
                        : 'transparent',
                      border: isCurrent
                        ? `2px solid ${style.palette.inkBorder}`
                        : '2px solid transparent',
                      boxShadow: isCurrent
                        ? `4px 3px 0px ${style.palette.accentSecondary}`
                        : 'none',
                      opacity: wSpring,
                    }}
                  >
                    {formatHeadingText(word, style)}
                  </span>
                );
              }

              if (grammar === 'optical-gate') {
                return (
                  <span
                    key={word}
                    style={{
                      display: 'inline-block',
                      fontFamily: displayFont,
                      fontSize: bounds.isVertical ? 64 : 84,
                      fontWeight: 800,
                      lineHeight: 1.08,
                      letterSpacing: `${style.typography.displayTrackingEm}em`,
                      color: isCurrent
                        ? style.palette.accentPrimary
                        : style.palette.textPrimary,
                      opacity: isCurrent ? wSpring : wSpring * 0.72,
                      textShadow:
                        isCurrent && optics.halation > 0.05
                          ? `0 0 ${Math.round(16 + optics.halation * 28)}px ${style.palette.accentPrimary}88`
                          : 'none',
                    }}
                  >
                    {formatHeadingText(word, style)}
                  </span>
                );
              }

              return (
                <span
                  key={word}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    fontFamily: displayFont,
                    fontSize: bounds.isVertical ? 64 : 84,
                    fontWeight: 700,
                    lineHeight: 1.08,
                    letterSpacing: `${style.typography.displayTrackingEm}em`,
                    color: isCurrent
                      ? style.palette.accentPrimary
                      : style.palette.textPrimary,
                    opacity: wSpring,
                    transform: `translateY(${interpolate(wSpring, [0, 1], [24, 0]).toFixed(2)}px)`,
                  }}
                >
                  {formatHeadingText(word, style)}
                  {isCurrent && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: -4,
                        height: 4,
                        backgroundColor: style.palette.accentPrimary,
                      }}
                    />
                  )}
                </span>
              );
            })}
          </div>

          {/* Bottom Row: Vernier / Risograph Metric Counter + Statement Keyword Card */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: bounds.isVertical ? 'column' : 'row',
              gap: 24,
              alignItems: bounds.isVertical ? 'stretch' : 'center',
            }}
          >
            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'resting',
                overrides: {
                  position: 'relative',
                  padding: '22px 30px',
                  borderRadius:
                    grammar === 'risograph-poster'
                      ? 0
                      : Math.max(0, Math.round(10 * style.surface.radiusScale)),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  opacity: counterProgress,
                },
              })}
            >
              <ClippedSurfaceChrome
                topBarHeight={grammar === 'risograph-poster' ? 0 : 3}
                topBarColor={style.palette.accentPrimary}
                specularRim={!style.surface.isDark}
              />
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 16,
                }}
              >
                <span
                  style={{
                    fontFamily: displayFont,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: bounds.isVertical ? 52 : 60,
                    fontWeight: 800,
                    color: style.palette.accentPrimary,
                  }}
                >
                  {counterVal}%
                </span>
                <span
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 20,
                    fontWeight: 500,
                    color: style.palette.textSecondary,
                  }}
                >
                  utrzymania uwagi widza
                </span>
              </div>

              {grammar === 'risograph-poster' ? (
                <div
                  data-risograph-meter="true"
                  style={{ position: 'relative', display: 'flex', gap: 4 }}
                >
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: 8,
                        backgroundColor:
                          idx < Math.round(counterProgress * 12)
                            ? style.palette.accentPrimary
                            : style.palette.bgElevated,
                        border: `1.5px solid ${style.palette.inkBorder}`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <svg
                  data-vernier-scale="true"
                  viewBox="0 0 240 16"
                  style={{ position: 'relative', width: '100%', height: 16 }}
                >
                  {Array.from({ length: 21 }).map((_, idx) => {
                    const x = (idx / 20) * 236 + 2;
                    const isMajor = idx % 5 === 0;
                    const active = idx <= litTicks;
                    return (
                      <line
                        key={idx}
                        x1={x}
                        y1={isMajor ? 1 : 5}
                        x2={x}
                        y2={15}
                        stroke={
                          active
                            ? style.palette.accentPrimary
                            : style.palette.inkBorder
                        }
                        strokeWidth={isMajor ? 2 : 1.2}
                        opacity={active ? 1 : 0.45}
                      />
                    );
                  })}
                </svg>
              )}
            </div>

            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'lifted',
                tiltDeg: grammar === 'risograph-poster' ? -0.7 : 0,
                overrides: {
                  position: 'relative',
                  padding: '22px 30px',
                  borderRadius:
                    grammar === 'risograph-poster'
                      ? 0
                      : Math.max(0, Math.round(10 * style.surface.radiusScale)),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  opacity: cardEnter,
                },
              })}
            >
              <ClippedSurfaceChrome
                topBarHeight={grammar === 'risograph-poster' ? 0 : 3}
                topBarColor={style.palette.accentSecondary}
                specularRim={!style.surface.isDark}
              />
              <span
                style={{
                  position: 'relative',
                  fontFamily: monoFont,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: style.palette.accentPrimary,
                }}
              >
                Płynny kadr
              </span>
              <span
                style={{
                  position: 'relative',
                  fontFamily: displayFont,
                  fontSize: bounds.isVertical ? 30 : 34,
                  fontWeight: 800,
                  color: style.palette.textPrimary,
                }}
              >
                {formatHeadingText('Głębia ostrości i światło', style)}
              </span>
            </div>
          </div>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
