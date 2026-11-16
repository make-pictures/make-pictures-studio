import React, { useMemo } from 'react';
import {
  AbsoluteFill,
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

export const VectorScene2DPreview: React.FC = () => {
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
      { fromFrame: 2, x: cx, y: cy + 6, zoom: 1.0, focalZ: 0.32, transition: 'cut' },
      { fromFrame: 10, x: cx - 5, y: cy, zoom: 1.026, focalZ: 0, transition: 'glide' },
      { fromFrame: 140, x: cx + 6, y: cy - 4, zoom: 1.04, focalZ: 0, transition: 'glide' },
    ];
  }, [width, height]);

  const heroEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const calloutEnter = spring({
    frame: frame - 18,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });
  const splitEnter = spring({
    frame: frame - 14,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const rackShift =
    frame >= 96
      ? spring({
          frame: frame - 96,
          fps,
          config: getStyleSpringConfig(style, 'camera'),
        })
      : 0;

  const maxBlur = Math.max(1.6, optics.aperture * 6.5);
  const leftBlur = interpolate(rackShift, [0, 1], [0, maxBlur]);
  const rightBlur = interpolate(rackShift, [0, 1], [maxBlur, 0]);

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const guideColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.18)'
    : `${style.palette.inkBorder}99`;

  const tx = bounds.left + Math.round(bounds.width * (bounds.isVertical ? 0.58 : 0.62));
  const ty = bounds.isVertical ? 556 : 382;
  const ly = bounds.isVertical ? 472 : 298;
  const elbowX = tx + Math.abs(ty - ly);
  const lx = bounds.left + Math.round(bounds.width * (bounds.isVertical ? 0.69 : 0.68));

  const heroTilt =
    optics.lightingRig === 'studio-macro'
      ? 0
      : grammar === 'risograph-poster'
        ? -0.5
        : 0;

  return (
    <OpticalStage2D shots={shots} seed={2028} startFrame={2}>
      {/* Plane z = -0.6: Subtle Golden-Ratio Composition Axes */}
      <DepthPlane z={-0.6}>
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              height: bounds.height,
              border: `1px solid ${guideColor}`,
              opacity: 0.36,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '38.2%',
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: guideColor,
                opacity: 0.54,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '50%',
                height: 1,
                backgroundColor: guideColor,
                opacity: 0.44,
              }}
            />
          </div>
        </AbsoluteFill>
      </DepthPlane>

      {/* Plane z = 0: Engraved Medallion Plate + Rack-Focus Split */}
      <DepthPlane z={0}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: bounds.isVertical ? 22 : 26,
          }}
        >
          <div
            data-medallion-grammar={grammar}
            style={getTactileSurfaceStyle(style, {
              elevation: 'lifted',
              tiltDeg: heroTilt,
              overrides: {
                position: 'relative',
                padding: bounds.isVertical ? '26px 30px' : '32px 38px',
                borderRadius:
                  grammar === 'risograph-poster'
                    ? 0
                    : Math.max(0, Math.round(10 * style.surface.radiusScale)),
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                opacity: heroEnter,
              },
            })}
          >
            <ClippedSurfaceChrome
              topBarHeight={grammar === 'swiss-spatial' ? 3 : 0}
              topBarColor={style.palette.accentPrimary}
              specularRim={!style.surface.isDark}
            />

            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  flexShrink: 0,
                  boxShadow:
                    grammar === 'optical-gate' && optics.halation > 0.05
                      ? `0 0 ${Math.round(12 + optics.halation * 20)}px ${style.palette.accentPrimary}44`
                      : grammar === 'risograph-poster'
                        ? `3px 3px 0px ${style.palette.inkBorder}`
                        : 'none',
                  backgroundColor:
                    grammar === 'risograph-poster'
                      ? style.palette.bgElevated
                      : 'transparent',
                  border:
                    grammar === 'risograph-poster'
                      ? `1.5px solid ${style.palette.inkBorder}`
                      : 'none',
                }}
              >
                <svg width="56" height="56" viewBox="0 0 60 60">
                  {grammar === 'swiss-spatial' && (
                    <>
                      <circle
                        cx="30"
                        cy="30"
                        r="26"
                        fill="none"
                        stroke={style.palette.inkBorder}
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r="19"
                        fill="none"
                        stroke={style.palette.accentPrimary}
                        strokeWidth="1.6"
                      />
                      <line x1="30" y1="0" x2="30" y2="8" stroke={style.palette.textSecondary} strokeWidth="1.2" />
                      <line x1="30" y1="52" x2="30" y2="60" stroke={style.palette.textSecondary} strokeWidth="1.2" />
                      <line x1="0" y1="30" x2="8" y2="30" stroke={style.palette.textSecondary} strokeWidth="1.2" />
                      <line x1="52" y1="30" x2="60" y2="30" stroke={style.palette.textSecondary} strokeWidth="1.2" />
                    </>
                  )}
                  {grammar === 'optical-gate' && (
                    <>
                      <path
                        d="M4 16 V4 H16 M44 4 H56 V16 M56 44 V56 H44 M16 56 H4 V44"
                        fill="none"
                        stroke={style.palette.accentPrimary}
                        strokeWidth="1.6"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r="18"
                        fill="none"
                        stroke={style.palette.accentPrimary}
                        strokeWidth="1.2"
                        opacity={0.75}
                      />
                    </>
                  )}
                  {grammar === 'risograph-poster' && (
                    <rect
                      x="6"
                      y="6"
                      width="48"
                      height="48"
                      fill="none"
                      stroke={style.palette.accentPrimary}
                      strokeWidth="2"
                    />
                  )}
                  <polygon
                    points="30,18 41,38 19,38"
                    fill="none"
                    stroke={style.palette.accentPrimary}
                    strokeWidth="1.8"
                  />
                </svg>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{
                    fontFamily: displayFont,
                    fontSize: bounds.isVertical ? 38 : 46,
                    fontWeight: 700,
                    lineHeight: 1.12,
                    letterSpacing: `${style.typography.displayTrackingEm}em`,
                    color: style.palette.textPrimary,
                  }}
                >
                  {formatHeadingText('Przejrzysta narracja pojęć', style)}
                </div>
                <div
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 21,
                    color: style.palette.textSecondary,
                  }}
                >
                  Grawerowany medalion, cień kierunkowy i polskie znaki: zażółć gęślą jaźń.
                </div>
              </div>
            </div>
          </div>

          {/* Dual Comparison Plates with Dignified Light-Mode Rack Focus */}
          <div
            style={{
              display: 'flex',
              flexDirection: bounds.isVertical ? 'column' : 'row',
              alignItems: 'stretch',
              gap: 18,
              opacity: splitEnter,
            }}
          >
            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'resting',
                overrides: {
                  position: 'relative',
                  flex: 1,
                  padding: '22px 26px',
                  borderRadius:
                    grammar === 'risograph-poster'
                      ? 0
                      : Math.max(0, Math.round(10 * style.surface.radiusScale)),
                  filter:
                    leftBlur < 0.25
                      ? 'none'
                      : `blur(${Math.min(style.surface.isDark ? leftBlur : 2.0, leftBlur).toFixed(2)}px)`,
                  opacity: interpolate(
                    rackShift,
                    [0, 1],
                    [1, style.surface.isDark ? 0.8 : 0.88]
                  ),
                },
              })}
            >
              <ClippedSurfaceChrome specularRim={!style.surface.isDark} />
              <div
                style={{
                  position: 'relative',
                  fontFamily: monoFont,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: style.palette.textSecondary,
                  marginBottom: 6,
                }}
              >
                Punkt wyjścia
              </div>
              <div
                style={{
                  position: 'relative',
                  fontFamily: displayFont,
                  fontSize: 30,
                  fontWeight: 700,
                  color: style.palette.textPrimary,
                }}
              >
                {formatHeadingText('Sztywny kadr płaski', style)}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: monoFont,
                fontSize: 14,
                color: style.palette.accentPrimary,
              }}
            >
              ┼
            </div>

            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'floating',
                overrides: {
                  position: 'relative',
                  flex: 1,
                  padding: '22px 26px',
                  borderRadius:
                    grammar === 'risograph-poster'
                      ? 0
                      : Math.max(0, Math.round(10 * style.surface.radiusScale)),
                  filter:
                    rightBlur < 0.25
                      ? 'none'
                      : `blur(${Math.min(style.surface.isDark ? rightBlur : 2.0, rightBlur).toFixed(2)}px)`,
                  opacity: interpolate(
                    rackShift,
                    [0, 1],
                    [style.surface.isDark ? 0.82 : 0.88, 1]
                  ),
                },
              })}
            >
              <ClippedSurfaceChrome
                topBarHeight={3}
                topBarColor={style.palette.accentPrimary}
                specularRim={!style.surface.isDark}
              />
              <div
                style={{
                  position: 'relative',
                  fontFamily: monoFont,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: style.palette.accentPrimary,
                  marginBottom: 6,
                }}
              >
                Głębia optyczna
              </div>
              <div
                style={{
                  position: 'relative',
                  fontFamily: displayFont,
                  fontSize: 30,
                  fontWeight: 700,
                  color: style.palette.textPrimary,
                }}
              >
                {formatHeadingText('Ostrość prowadzi wzrok', style)}
              </div>
            </div>
          </div>
        </div>
      </DepthPlane>

      {/* Plane z = +0.42: Architectural Elbow Callout + Reticle */}
      <DepthPlane z={0.42}>
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <g data-callout-reticle="true" opacity={calloutEnter}>
            <circle
              cx={tx}
              cy={ty}
              r={10}
              fill="none"
              stroke={style.palette.accentSecondary}
              strokeWidth={1.5}
            />
            <line
              x1={tx - 15}
              y1={ty}
              x2={tx - 6}
              y2={ty}
              stroke={style.palette.accentSecondary}
              strokeWidth={1.2}
            />
            <line
              x1={tx + 6}
              y1={ty}
              x2={tx + 15}
              y2={ty}
              stroke={style.palette.accentSecondary}
              strokeWidth={1.2}
            />
            <line
              x1={tx}
              y1={ty - 15}
              x2={tx}
              y2={ty - 6}
              stroke={style.palette.accentSecondary}
              strokeWidth={1.2}
            />
            <line
              x1={tx}
              y1={ty + 6}
              x2={tx}
              y2={ty + 15}
              stroke={style.palette.accentSecondary}
              strokeWidth={1.2}
            />
            <circle cx={tx} cy={ty} r={2.5} fill={style.palette.accentSecondary} />
            <polyline
              points={`${tx},${ty} ${elbowX},${ly} ${lx},${ly}`}
              fill="none"
              stroke={style.palette.accentSecondary}
              strokeWidth={1.6}
            />
          </g>
        </svg>
        <div
          style={getTactileSurfaceStyle(style, {
            elevation: 'floating',
            overrides: {
              position: 'absolute',
              left: lx,
              top: ly,
              transform: 'translate(0, -50%)',
              padding: '8px 14px',
              borderLeft: `3px solid ${style.palette.accentSecondary}`,
              borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
              fontFamily: bodyFont,
              fontSize: 14,
              fontWeight: 600,
              color: style.palette.textPrimary,
              opacity: calloutEnter,
            },
          })}
        >
          <ClippedSurfaceChrome specularRim={!style.surface.isDark} />
          <span style={{ position: 'relative' }}>Punkt skupienia</span>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
