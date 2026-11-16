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
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveArtWorld,
  resolveStyleOptics,
  useStudioStyle,
  type OpticalShot2D,
} from '@make-pictures/core';
import { getSafeStageBounds } from './styleLabTypes';

export const EditorialCollagePreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const bounds = getSafeStageBounds(width, height);

  const shots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      {
        fromFrame: 2,
        x: cx,
        y: cy + 8,
        zoom: 1.0,
        focalZ: 0.35,
        transition: 'cut',
      },
      {
        fromFrame: 8,
        x: cx - 5,
        y: cy,
        zoom: 1.024,
        focalZ: 0,
        transition: 'glide',
      },
      {
        fromFrame: 150,
        x: cx + 7,
        y: cy - 4,
        zoom: 1.044,
        focalZ: 0,
        transition: 'glide',
      },
    ];
  }, [width, height]);

  const chapterEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const mediaEnter = spring({
    frame: frame - 12,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const quoteSweep = spring({
    frame: frame - 26,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const rawFocusPull = interpolate(
    frame - 2,
    [0, 18],
    [3.4 + optics.aperture * 3.0, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const chapterFocusFilter =
    rawFocusPull < 0.25 ? 'none' : `blur(${rawFocusPull.toFixed(2)}px)`;

  const kenBurnsScale = interpolate(frame, [2, 300], [1.02, 1.11], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const kenBurnsX = interpolate(frame, [2, 300], [0, -16], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const effectiveMount =
    optics.lightingRig === 'darkroom-halation'
      ? 'slide-mount'
      : optics.lightingRig === 'studio-macro'
        ? 'none'
        : style.id === 'archival-chronicle'
          ? 'photo-corners'
          : 'archival-tape';
  const isSlide = effectiveMount === 'slide-mount';
  const seededTilt =
    optics.lightingRig === 'studio-macro'
      ? 0
      : Number(
          ((createSeededRandom(`style-lab-media:${style.id}`)() - 0.5) * 1.6).toFixed(
            2
          )
        );

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const artWorld = resolveArtWorld(style);

  const markColor = style.surface.isDark
    ? 'rgba(248, 250, 252, 0.22)'
    : `${style.palette.inkBorder}AA`;
  const insetX = bounds.isVertical ? 36 : 64;
  const insetTop = bounds.isVertical ? 196 : 48;
  const insetBottom = bounds.isVertical ? 496 : 48;

  return (
    <OpticalStage2D shots={shots} seed={2026} startFrame={2}>
      {/* Plane z = -0.65: Passe-Partout Gallery Frame */}
      <DepthPlane z={-0.65}>
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: insetX,
              right: bounds.isVertical ? 148 : insetX,
              top: insetTop,
              bottom: insetBottom,
              border: `1px solid ${markColor}`,
              opacity: 0.44,
            }}
          />
        </AbsoluteFill>
      </DepthPlane>

      {/* Plane z = 0: Crisp Editorial Hero Surface */}
      <DepthPlane z={0}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            display: 'flex',
            flexDirection: bounds.isVertical ? 'column' : 'row',
            gap: bounds.isVertical ? 28 : 44,
            alignItems: 'stretch',
            justifyContent: 'center',
          }}
        >
          {/* Left / Top: Optical Focus-Pull Chapter + Ink-Brush Press Clipping */}
          <div
            style={{
              flex: bounds.isVertical ? '0 0 auto' : '1.08 1 0%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 20,
              opacity: chapterEnter,
              filter: chapterFocusFilter,
              transform: `translateY(${interpolate(chapterEnter, [0, 1], [22, 0]).toFixed(2)}px)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: style.palette.accentPrimary,
                }}
              >
                Rozdział 01
              </span>
              <div
                style={{
                  height: 1.5,
                  flex: 1,
                  maxWidth: 160,
                  backgroundColor: style.palette.inkBorder,
                  transformOrigin: 'left center',
                  transform: `scaleX(${chapterEnter.toFixed(4)})`,
                }}
              />
            </div>

            <div
              style={{
                fontFamily: displayFont,
                fontSize: bounds.isVertical ? 52 : 66,
                fontWeight: 700,
                lineHeight: 1.07,
                letterSpacing: `${style.typography.displayTrackingEm}em`,
                color: style.palette.textPrimary,
              }}
            >
              {formatHeadingText('Sztuka rzemiosła i żywego światła', style)}
            </div>

            <div
              style={getTactileSurfaceStyle(style, {
                elevation: 'resting',
                overrides: {
                  position: 'relative',
                  padding: bounds.isVertical
                    ? '24px 28px 24px 38px'
                    : '28px 34px 28px 44px',
                  borderRadius: Math.max(0, Math.round(8 * style.surface.radiusScale)),
                  marginTop: 4,
                },
              })}
            >
              <ClippedSurfaceChrome specularRim={!style.surface.isDark} />
              <div
                style={{
                  position: 'absolute',
                  left: 16,
                  top: 20,
                  bottom: 20,
                  width: 2,
                  backgroundColor: style.palette.inkBorder,
                }}
              >
                <div
                  style={{
                    width: 3,
                    height: `${Math.round(chapterEnter * 48)}%`,
                    backgroundColor: style.palette.accentPrimary,
                  }}
                />
              </div>

              <div
                style={{
                  position: 'relative',
                  fontFamily: bodyFont,
                  fontSize: bounds.isVertical ? 24 : 27,
                  lineHeight: 1.42,
                  color: style.palette.textPrimary,
                }}
              >
                „Każda epoka zapisuje pamięć własną{' '}
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    padding: '0 6px',
                    fontWeight: 600,
                  }}
                >
                  <svg
                    data-ink-brush="true"
                    viewBox="0 0 220 38"
                    preserveAspectRatio="none"
                    style={{
                      position: 'absolute',
                      left: -2,
                      right: -2,
                      bottom: 1,
                      width: 'calc(100% + 4px)',
                      height: style.surface.isDark ? '34%' : '56%',
                      transformOrigin: 'left center',
                      transform: `scaleX(${quoteSweep.toFixed(4)})`,
                      mixBlendMode: style.surface.isDark ? 'screen' : 'multiply',
                      pointerEvents: 'none',
                    }}
                  >
                    <path
                      d="M3,20 C44,10 112,14 217,12 C219,21 215,31 211,32 C138,34 58,31 2,33 Z"
                      fill={style.palette.accentPrimary}
                      opacity={style.surface.isDark ? 0.52 : 0.28}
                    />
                  </svg>
                  <span style={{ position: 'relative' }}>
                    kreską, fakturą i barwą
                  </span>
                </span>{' '}
                opowieści.”
              </div>
              <div
                style={{
                  position: 'relative',
                  marginTop: 12,
                  fontFamily: monoFont,
                  fontSize: 15,
                  color: style.palette.textSecondary,
                }}
              >
                — Kronika wzornictwa • Neapol, 1889
              </div>
            </div>
          </div>

          {/* Right / Bottom: Mounted Gallery Print Transforming Across 3 Artistic Worlds */}
          <div
            data-mount-type={effectiveMount}
            data-editorial-artworld={artWorld}
            style={getTactileSurfaceStyle(style, {
              elevation: 'lifted',
              tiltDeg: seededTilt,
              overrides: {
                position: 'relative',
                flex: bounds.isVertical ? '1 1 0%' : '0.92 1 0%',
                padding: isSlide ? '18px 20px 22px 20px' : '16px 16px 22px 16px',
                backgroundColor: isSlide
                  ? style.surface.isDark
                    ? '#0B101C'
                    : '#18181B'
                  : style.palette.bgSurface,
                color: isSlide ? '#F8FAFC' : style.palette.textPrimary,
                borderRadius: Math.max(0, Math.round(8 * style.surface.radiusScale)),
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                opacity: mediaEnter,
                transform: `translateY(${interpolate(mediaEnter, [0, 1], [26, 0]).toFixed(2)}px)`,
              },
            })}
          >
            <ClippedSurfaceChrome specularRim={!style.surface.isDark && !isSlide} />

            {effectiveMount === 'archival-tape' && (
              <div
                style={{
                  position: 'absolute',
                  top: -11,
                  left: '50%',
                  width: 108,
                  height: 22,
                  transform: 'translateX(-50%) rotate(-1.8deg)',
                  backgroundColor: 'rgba(244, 234, 206, 0.78)',
                  border: `1px solid ${style.palette.inkBorder}`,
                  zIndex: 3,
                }}
              />
            )}

            <div
              style={{
                flex: 1,
                minHeight: bounds.isVertical ? 240 : 340,
                borderRadius: Math.max(0, Math.round(4 * style.surface.radiusScale)),
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: style.palette.bgElevated,
                border: `1px solid ${isSlide ? 'rgba(255,255,255,0.16)' : style.palette.inkBorder}`,
              }}
            >
              <svg
                viewBox="0 0 640 400"
                preserveAspectRatio="xMidYMid slice"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  transform: `scale(${kenBurnsScale}) translateX(${kenBurnsX}px)`,
                  transformOrigin: 'center center',
                }}
              >
                <rect width="640" height="400" fill={style.palette.bgElevated} />
                {artWorld === 'atelier' ? (
                  <>
                    <ellipse
                      cx="320"
                      cy="318"
                      rx="260"
                      ry="54"
                      fill={style.palette.bgSurface}
                      opacity={0.72}
                    />
                    <path
                      d="M 0 286 Q 320 318 640 286"
                      fill="none"
                      stroke={style.palette.inkBorder}
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="256"
                      cy="196"
                      r="86"
                      fill={style.palette.accentPrimary}
                      opacity={0.22}
                      stroke={style.palette.accentPrimary}
                      strokeWidth="2"
                    />
                    <circle
                      cx="388"
                      cy="182"
                      r="64"
                      fill={style.palette.accentSecondary}
                      opacity={0.28}
                      stroke={style.palette.accentSecondary}
                      strokeWidth="2"
                    />
                    <polygon
                      points="320,96 404,248 236,248"
                      fill={style.palette.bgSurface}
                      opacity={0.82}
                      stroke={style.palette.inkBorder}
                      strokeWidth="1.6"
                    />
                  </>
                ) : artWorld === 'illustrative' ? (
                  <>
                    <circle
                      cx="468"
                      cy="118"
                      r="68"
                      fill={style.palette.accentPrimary}
                      opacity={0.86}
                    />
                    <g fill={style.palette.bgSurface} opacity={0.88}>
                      <ellipse cx="168" cy="108" rx="54" ry="20" />
                      <ellipse cx="146" cy="98" rx="32" ry="22" />
                      <ellipse cx="192" cy="96" rx="36" ry="24" />
                    </g>
                    <path
                      d="M 0 312 L 154 176 L 284 268 L 418 156 L 568 272 L 640 228 L 640 400 L 0 400 Z"
                      fill={style.palette.accentSecondary}
                      opacity={0.76}
                    />
                    <path
                      d="M 154 176 L 204 218 L 176 224 L 154 198 L 128 228 Z M 418 156 L 468 202 L 434 206 L 418 182 L 392 212 Z"
                      fill="#FFFDF8"
                      opacity={0.88}
                    />
                    <path
                      d="M 0 342 C 180 288, 390 364, 640 302 L 640 400 L 0 400 Z"
                      fill={style.palette.accentPrimary}
                      opacity={0.62}
                    />
                  </>
                ) : (
                  <>
                    <rect
                      x="38"
                      y="32"
                      width="564"
                      height="336"
                      fill={style.palette.bgSurface}
                      stroke={style.palette.inkBorder}
                      strokeWidth="1.5"
                    />
                    <polygon
                      points="38,32 346,32 218,368 38,368"
                      fill={style.palette.bgElevated}
                      opacity={0.72}
                    />
                    <circle
                      cx="434"
                      cy="168"
                      r="84"
                      fill={style.palette.accentPrimary}
                      opacity={0.86}
                    />
                    <path
                      d="M 96 336 L 246 196 L 362 294 L 468 214 L 568 336 Z"
                      fill={style.palette.accentSecondary}
                      opacity={0.78}
                    />
                  </>
                )}
              </svg>

              {effectiveMount === 'photo-corners' && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 24,
                      height: 24,
                      background: `linear-gradient(135deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 24,
                      height: 24,
                      background: `linear-gradient(225deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: 24,
                      height: 24,
                      background: `linear-gradient(45deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 24,
                      height: 24,
                      background: `linear-gradient(315deg, ${style.palette.textPrimary}CC 50%, transparent 50%)`,
                    }}
                  />
                </>
              )}
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                fontFamily: bodyFont,
                fontSize: 16,
                color: isSlide ? '#E2E8F0' : style.palette.textSecondary,
              }}
            >
              <span>Studium światła i kompozycji</span>
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 13,
                  color: style.palette.accentPrimary,
                  fontWeight: 700,
                }}
              >
                {style.name}
              </span>
            </div>
          </div>
        </div>
      </DepthPlane>

      {/* Plane z = +0.75: Out-of-Focus Marginalia Scale (Outside Safe Box) */}
      <DepthPlane z={0.75}>
        <div
          style={{
            position: 'absolute',
            left: bounds.isVertical ? 44 : 72,
            bottom: bounds.isVertical ? 120 : 22,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            opacity: 0.36,
          }}
        >
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: 1.5,
                height: idx % 5 === 0 ? 16 : 9,
                backgroundColor: style.palette.textSecondary,
              }}
            />
          ))}
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};
