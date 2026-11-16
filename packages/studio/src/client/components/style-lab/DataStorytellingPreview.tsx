import React, { useMemo } from 'react';
import {
  AbsoluteFill,
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

export const DataStorytellingPreview: React.FC = () => {
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
      { fromFrame: 2, x: cx, y: cy + 5, zoom: 1.0, focalZ: 0.3, transition: 'cut' },
      { fromFrame: 10, x: cx - 4, y: cy, zoom: 1.024, focalZ: 0, transition: 'glide' },
    ];
  }, [width, height]);

  const cardEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const bars = [
    {
      label: 'Opowieść wizualna w ruchu',
      target: 94,
      color: style.palette.accentPrimary,
      leader: true,
    },
    {
      label: 'Dokument redakcyjny',
      target: 74,
      color: style.palette.accentSecondary,
      leader: false,
    },
    {
      label: 'Statyczne slajdy',
      target: 31,
      color: style.palette.textSecondary,
      leader: false,
    },
  ];

  const eras = [
    { year: '1998', label: 'Archiwum', active: false },
    { year: '2026', label: 'Światło i ruch', active: true },
    { year: '2030', label: 'Skala', active: false },
  ];
  const offBlur = Math.min(style.surface.isDark ? 6 : 2.0, optics.aperture * 3.4);

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const gridLineColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.16)'
    : `${style.palette.inkBorder}88`;

  return (
    <OpticalStage2D shots={shots} seed={2029} startFrame={2}>
      {/* Plane z = -0.58: Clean Proportional Scale Lines */}
      <DepthPlane z={-0.58}>
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              height: bounds.height,
              border: `1px solid ${gridLineColor}`,
              opacity: 0.36,
            }}
          >
            {[0.25, 0.5, 0.75].map((pct) => (
              <div
                key={pct}
                style={{
                  position: 'absolute',
                  left: `${pct * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: gridLineColor,
                  opacity: 0.48,
                }}
              />
            ))}
          </div>
        </AbsoluteFill>
      </DepthPlane>

      {/* Plane z = 0: Tonal Bar Race + 240° Instrument + Vernier Timeline */}
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
            gap: 22,
          }}
        >
          <div
            data-bar-grammar={grammar}
            style={getTactileSurfaceStyle(style, {
              elevation: 'lifted',
              overrides: {
                position: 'relative',
                padding: bounds.isVertical ? '24px 28px' : '30px 36px',
                borderRadius:
                  grammar === 'risograph-poster'
                    ? 0
                    : Math.max(0, Math.round(10 * style.surface.radiusScale)),
                opacity: cardEnter,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
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
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                paddingBottom: 10,
                borderBottom: `1px solid ${style.palette.inkBorder}`,
              }}
            >
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: bounds.isVertical ? 34 : 40,
                  fontWeight: 700,
                  color: style.palette.textPrimary,
                  letterSpacing: `${style.typography.displayTrackingEm}em`,
                }}
              >
                {formatHeadingText('Indeks czytelności przekazu', style)}
              </div>

              <div
                data-instrument-arc="240"
                style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
              >
                <svg width="46" height="36" viewBox="0 0 46 36">
                  <path
                    d="M 8 30 A 16 16 0 1 1 38 30"
                    fill="none"
                    stroke={style.palette.inkBorder}
                    strokeWidth="2.5"
                    strokeLinecap="butt"
                    strokeDasharray="2 3"
                  />
                  <path
                    d="M 8 30 A 16 16 0 1 1 35 12"
                    fill="none"
                    stroke={style.palette.accentPrimary}
                    strokeWidth="3.2"
                    strokeLinecap="butt"
                  />
                  <line
                    x1="23"
                    y1="20"
                    x2="34"
                    y2="12"
                    stroke={style.palette.textPrimary}
                    strokeWidth="1.6"
                  />
                  <circle cx="23" cy="20" r="2.5" fill={style.palette.textPrimary} />
                </svg>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 15,
                    fontWeight: 800,
                    padding: '4px 10px',
                    border: `1.5px solid ${style.palette.accentPrimary}`,
                    color:
                      grammar === 'risograph-poster'
                        ? '#FFFFFF'
                        : style.palette.accentPrimary,
                    backgroundColor:
                      grammar === 'risograph-poster'
                        ? style.palette.accentPrimary
                        : 'transparent',
                  }}
                >
                  Δ +3,0×
                </span>
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {bars.map((bar, idx) => {
                const grow = spring({
                  frame: frame - (6 + idx * 6),
                  fps,
                  config: getStyleSpringConfig(style, 'enter'),
                });
                const pct = Math.round(bar.target * grow);
                return (
                  <div
                    key={bar.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <span
                      style={{
                        width: 28,
                        fontFamily: monoFont,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 14,
                        fontWeight: 700,
                        textAlign: 'center',
                        color:
                          grammar === 'risograph-poster' && bar.leader
                            ? '#FFFFFF'
                            : bar.leader
                              ? style.palette.accentPrimary
                              : style.palette.textSecondary,
                        backgroundColor:
                          grammar === 'risograph-poster' && bar.leader
                            ? style.palette.accentPrimary
                            : 'transparent',
                      }}
                    >
                      0{idx + 1}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontFamily: bodyFont,
                          fontSize: 18,
                          fontWeight: bar.leader ? 700 : 600,
                          color: style.palette.textPrimary,
                        }}
                      >
                        <span>{bar.label}</span>
                        <span
                          style={{
                            fontFamily: monoFont,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {pct} pkt
                        </span>
                      </div>
                      <div
                        style={{
                          height: bar.leader ? 14 : 11,
                          borderRadius:
                            grammar === 'risograph-poster'
                              ? 0
                              : Math.max(2, Math.round(4 * style.surface.radiusScale)),
                          overflow: 'hidden',
                          backgroundColor: style.palette.bgElevated,
                          border:
                            grammar === 'risograph-poster'
                              ? `1.5px solid ${style.palette.inkBorder}`
                              : undefined,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(3, bar.target * grow)}%`,
                            height: '100%',
                            background:
                              grammar === 'risograph-poster' && !bar.leader
                                ? `repeating-linear-gradient(-45deg, ${bar.color}, ${bar.color} 3px, transparent 3px, transparent 6px)`
                                : bar.color,
                            borderRight: bar.leader
                              ? `2.5px solid ${style.palette.textPrimary}`
                              : undefined,
                            boxShadow:
                              grammar === 'optical-gate' &&
                              bar.leader &&
                              optics.halation > 0.05
                                ? `0 0 ${Math.round(10 + optics.halation * 18)}px ${bar.color}66`
                                : 'none',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vernier Chronicle Rail with Dignified Rack Focus */}
          <div
            data-vernier-rail="true"
            style={getTactileSurfaceStyle(style, {
              elevation: 'resting',
              overrides: {
                position: 'relative',
                padding: '16px 24px',
                borderRadius:
                  grammar === 'risograph-poster'
                    ? 0
                    : Math.max(0, Math.round(10 * style.surface.radiusScale)),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                opacity: cardEnter,
              },
            })}
          >
            <ClippedSurfaceChrome
              topBarHeight={2}
              topBarColor={style.palette.inkBorder}
              specularRim={!style.surface.isDark}
            />
            {eras.map((e) => {
              const markerPrefix = e.active
                ? grammar === 'optical-gate'
                  ? '◆'
                  : '▲'
                : '│';
              return (
                <div
                  key={e.year}
                  style={
                    e.active
                      ? getTactileSurfaceStyle(style, {
                          elevation: 'floating',
                          overrides: {
                            position: 'relative',
                            flex: 1,
                            padding: '8px 12px',
                            borderLeft: `3px solid ${style.palette.accentPrimary}`,
                            borderRadius: 0,
                            filter: 'none',
                            opacity: 1,
                          },
                        })
                      : {
                          position: 'relative',
                          flex: 1,
                          padding: '4px 8px',
                          transform: 'scale(0.96)',
                          filter:
                            offBlur < 0.25 ? 'none' : `blur(${offBlur.toFixed(2)}px)`,
                          opacity: style.surface.isDark ? 0.68 : 0.84,
                        }
                  }
                >
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 13,
                      fontWeight: 700,
                      color: e.active
                        ? style.palette.accentPrimary
                        : style.palette.textSecondary,
                    }}
                  >
                    {markerPrefix} {e.year}
                  </div>
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontSize: 19,
                      fontWeight: 700,
                      color: style.palette.textPrimary,
                    }}
                  >
                    {e.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
