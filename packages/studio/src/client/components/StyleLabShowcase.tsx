import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Grid3x3,
  Monitor,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Smartphone,
} from 'lucide-react';
import {
  CINEMATIC_SPRINGS,
  ClippedSurfaceChrome,
  DepthPlane,
  OpticalStage2D,
  ScenicBackdropLayers,
  StageLightingRig,
  StyleProvider,
  computeCircleOfConfusionPx,
  createSeededRandom,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveArtWorld,
  resolveStyleOptics,
  useStudioStyle,
  type ArtWorld,
  type BuiltinVisualKitId,
  type OpticalShot2D,
  type StylePreset,
} from '@make-pictures/core';
import { useRemotionPlayer } from '../hooks/useRemotionPlayer';
import type { OverlaySettings } from '../types';
import { DirectorOverlays } from './DirectorOverlays';

export type StyleLabAspectRatio = '16:9' | '9:16';

export const STYLE_LAB_DURATION_IN_FRAMES = 300;
export const STYLE_LAB_FPS = 60;

export const STYLE_LAB_KITS: ReadonlyArray<{
  id: BuiltinVisualKitId;
  label: string;
  badge?: string;
}> = [
  { id: 'editorial-collage', label: 'Editorial Collage' },
  { id: 'vector-scene-2d', label: 'Vector Scene 2D' },
  { id: 'kinetic-typography', label: 'Kinetic Typography' },
  { id: 'data-storytelling', label: 'Data Storytelling' },
  { id: 'motion-diagrams-2d', label: 'Motion Diagrams' },
  { id: 'paper-diorama-3d', label: 'Paper Diorama 3D', badge: '2.5D' },
  { id: 'isometric-3d', label: 'Isometric 3D', badge: '3D' },
];

export type StyleLabCompositionProps = {
  style: StylePreset;
  kit: BuiltinVisualKitId;
};

function formatTimecode(frame: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 60;
  const totalSec = Math.max(0, frame) / safeFps;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((totalSec - Math.floor(totalSec)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(hundredths).padStart(2, '0')}`;
}

const preventButtonFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

function getSafeStageBounds(width: number, height: number) {
  const isVertical = height > width;
  if (isVertical) {
    // Strictly inside 9:16 Golden Safe Box: x in [40, 910], y in [220, 1380] even under optical micro-dolly
    return {
      isVertical: true,
      left: 74,
      top: 266,
      width: 790,
      height: 1054,
    };
  }
  return {
    isVertical: false,
    left: 120,
    top: 108,
    width: width - 240,
    height: height - 216,
  };
}

const EditorialCollagePreview: React.FC = () => {
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
          ((createSeededRandom(`style-lab-media:${style.id}`)() - 0.5) * 1.6).toFixed(2)
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

const VectorScene2DPreview: React.FC = () => {
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

const KineticTypographyPreview: React.FC = () => {
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

const DataStorytellingPreview: React.FC = () => {
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
    { label: 'Opowieść wizualna w ruchu', target: 94, color: style.palette.accentPrimary, leader: true },
    { label: 'Dokument redakcyjny', target: 74, color: style.palette.accentSecondary, leader: false },
    { label: 'Statyczne slajdy', target: 31, color: style.palette.textSecondary, leader: false },
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

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bars.map((bar, idx) => {
                const grow = spring({
                  frame: frame - (6 + idx * 6),
                  fps,
                  config: getStyleSpringConfig(style, 'enter'),
                });
                const pct = Math.round(bar.target * grow);
                return (
                  <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
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
                        <span style={{ fontFamily: monoFont, fontVariantNumeric: 'tabular-nums' }}>
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
                              grammar === 'optical-gate' && bar.leader && optics.halation > 0.05
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
                          filter: offBlur < 0.25 ? 'none' : `blur(${offBlur.toFixed(2)}px)`,
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
                      color: e.active ? style.palette.accentPrimary : style.palette.textSecondary,
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

const MotionDiagrams2DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const artWorld = resolveArtWorld(style);
  const grammar = optics.typographyGrammar;
  const bounds = getSafeStageBounds(width, height);

  const shots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      {
        fromFrame: 2,
        x: cx,
        y: cy,
        zoom: 1,
        focalZ: 0,
        aperture: optics.aperture,
        transition: 'cut',
      },
      {
        fromFrame: 120,
        x: cx + (bounds.isVertical ? 0 : 28),
        y: cy + (bounds.isVertical ? 26 : 12),
        zoom: 1.03,
        focalZ: 0.22,
        aperture: optics.aperture,
        transition: 'glide',
      },
    ];
  }, [bounds.isVertical, height, optics.aperture, width]);

  const nodeEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const payloadEnter = spring({
    frame: frame - 18,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const activeModuleIdx = frame < 100 ? 0 : frame < 200 ? 1 : 2;
  const packetT = Math.max(0, ((frame - 6) % 96) / 96);

  const displayFont = formatFontFamilyCss(
    style.typography.displayFont,
    'display'
  );
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const cardRadius =
    grammar === 'risograph-poster'
      ? 0
      : Math.max(8, Math.round(12 * style.surface.radiusScale));

  const modules = [
    {
      id: 'source',
      badge: 'Wejście',
      title: 'Scenariusz',
      sub: 'Rytm opowieści i scen',
    },
    {
      id: 'craft',
      badge: 'Kierunek',
      title: 'Świat sztuki',
      sub: style.name,
    },
    {
      id: 'master',
      badge: 'Finał',
      title: 'Gotowy film',
      sub: 'Płynny obraz i dźwięk',
    },
  ];

  const renderNodeMedallion = (idx: number, isFocused: boolean) => {
    const stroke = isFocused
      ? style.palette.accentPrimary
      : style.palette.textSecondary;
    if (artWorld === 'atelier') {
      return (
        <svg
          data-node-medallion="atelier"
          width={24}
          height={24}
          viewBox="0 0 28 28"
        >
          <circle
            cx={14}
            cy={14}
            r={10}
            fill={style.palette.accentPrimary}
            fillOpacity={0.14}
            stroke={stroke}
            strokeWidth={1.4}
          />
          {idx === 0 ? (
            <polygon
              points="14,7.5 20.5,14 14,20.5 7.5,14"
              fill="none"
              stroke={style.palette.accentSecondary}
              strokeWidth={1.3}
            />
          ) : idx === 1 ? (
            <circle
              cx={14}
              cy={14}
              r={5.2}
              fill="none"
              stroke={style.palette.accentSecondary}
              strokeWidth={1.4}
            />
          ) : (
            <polygon
              points="14,8 19.6,11.2 19.6,16.8 14,20 8.4,16.8 8.4,11.2"
              fill="none"
              stroke={style.palette.accentSecondary}
              strokeWidth={1.3}
            />
          )}
          <circle cx={14} cy={14} r={2} fill={style.palette.accentPrimary} />
        </svg>
      );
    }
    if (artWorld === 'illustrative') {
      return (
        <svg
          data-node-medallion="illustrative"
          width={24}
          height={24}
          viewBox="0 0 28 28"
        >
          <circle
            cx={16}
            cy={10}
            r={5.2}
            fill={style.palette.accentPrimary}
            fillOpacity={0.82}
          />
          <path
            d="M 5 21 L 11.5 13 L 16.5 18 L 20.5 14 L 24 21 Z"
            fill={style.palette.accentSecondary}
            fillOpacity={0.85}
          />
        </svg>
      );
    }
    return (
      <svg
        data-node-medallion="editorial-gallery"
        width={24}
        height={24}
        viewBox="0 0 28 28"
      >
        <rect
          x={5}
          y={5}
          width={18}
          height={18}
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
        />
        <circle
          cx={15.5}
          cy={12.5}
          r={4.5}
          fill={style.palette.accentPrimary}
          fillOpacity={0.85}
        />
        <line
          x1={8}
          y1={19}
          x2={20}
          y2={19}
          stroke={style.palette.accentSecondary}
          strokeWidth={1.6}
        />
      </svg>
    );
  };

  const renderCoupler = (idx: number) => {
    const isVert = bounds.isVertical;
    const svgW = isVert ? 36 : 58;
    const svgH = isVert ? 34 : 28;
    const x1 = isVert ? svgW / 2 : 2;
    const y1 = isVert ? 2 : svgH / 2;
    const x2 = isVert ? svgW / 2 : svgW - 2;
    const y2 = isVert ? svgH - 2 : svgH / 2;
    const px = x1 + (x2 - x1) * packetT;
    const py = y1 + (y2 - y1) * packetT;
    const deg = isVert ? 90 : 0;

    return (
      <svg
        key={`coupler-${idx}`}
        data-flow-grammar={grammar}
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ flexShrink: 0, overflow: 'visible' }}
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={style.palette.inkBorder}
          strokeWidth={1.2}
          strokeOpacity={0.42}
        />
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={style.palette.accentPrimary}
          strokeWidth={grammar === 'risograph-poster' ? 3 : 2.2}
        />
        <circle
          cx={x1}
          cy={y1}
          r={3.5}
          fill={style.palette.bgSurface}
          stroke={style.palette.accentPrimary}
          strokeWidth={1.6}
        />
        <circle
          cx={x2}
          cy={y2}
          r={3.5}
          fill={style.palette.bgSurface}
          stroke={style.palette.accentPrimary}
          strokeWidth={1.6}
        />
        <g transform={`translate(${px.toFixed(1)}, ${py.toFixed(1)}) rotate(${deg})`}>
          {grammar === 'risograph-poster' ? (
            <polygon
              points="7,0 -6,-5.5 -6,5.5"
              fill={style.palette.accentPrimary}
              stroke={style.palette.inkBorder}
              strokeWidth={1.4}
            />
          ) : grammar === 'optical-gate' ? (
            <>
              <rect
                x={-7}
                y={-3}
                width={14}
                height={6}
                fill={style.palette.accentPrimary}
              />
              <rect x={-3} y={-1.2} width={8} height={2.4} fill="#FFFFFF" />
            </>
          ) : (
            <polygon
              points="7,0 -5,-4.5 -2.5,0 -5,4.5"
              fill={style.palette.accentPrimary}
            />
          )}
        </g>
      </svg>
    );
  };

  return (
    <OpticalStage2D
      shots={shots}
      handheldIntensity={style.motion.cameraHandheld}
      seed={410}
    >
      {/* Background Subtle Architectural Grid Plane */}
      <DepthPlane z={-0.56}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            border: `1px solid ${style.palette.inkBorder}34`,
            backgroundImage: `linear-gradient(to right, ${style.palette.inkBorder}18 1px, transparent 1px), linear-gradient(to bottom, ${style.palette.inkBorder}18 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      </DepthPlane>

      {/* Primary Schematic Topology Plane */}
      <DepthPlane z={0} disableFocusBlur>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top + (bounds.isVertical ? 44 : 42),
            width: bounds.width,
            height: bounds.height - (bounds.isVertical ? 220 : 196),
            display: 'flex',
            flexDirection: bounds.isVertical ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: nodeEnter,
          }}
        >
          {modules.map((mod, idx) => {
            const isFocused = idx === activeModuleIdx;
            const rawBlur = isFocused
              ? 0
              : computeCircleOfConfusionPx(-0.24, 0, optics.aperture);
            const blurPx = style.surface.isDark
              ? rawBlur
              : Math.min(2.0, rawBlur);
            const filterCss =
              blurPx < 0.25 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;

            return (
              <React.Fragment key={mod.id}>
                <div
                  data-focus-state={isFocused ? 'sharp' : 'recessed'}
                  style={getTactileSurfaceStyle(style, {
                    elevation: isFocused ? 'lifted' : 'resting',
                    overrides: {
                      flex: bounds.isVertical ? undefined : 1,
                      width: bounds.isVertical ? '100%' : undefined,
                      padding: bounds.isVertical ? '20px 24px' : '24px 26px',
                      borderRadius: cardRadius,
                      borderColor: isFocused
                        ? style.palette.accentPrimary
                        : style.palette.inkBorder,
                      position: 'relative',
                      overflow: 'visible',
                      boxSizing: 'border-box',
                      filter: filterCss,
                      opacity: isFocused
                        ? 1
                        : style.surface.isDark
                          ? 0.78
                          : 0.88,
                      transform: `scale(${isFocused ? 1.015 : 0.988})`,
                    },
                  })}
                >
                  {/* Clipped interior top accent bar & specular rim (never overhangs rounded corners!) */}
                  <ClippedSurfaceChrome
                    topBarHeight={grammar === 'risograph-poster' ? 5 : 3}
                    topBarColor={
                      isFocused
                        ? style.palette.accentPrimary
                        : style.palette.inkBorder
                    }
                    specularRim={!style.surface.isDark}
                  />

                  {/* Refined architectural port terminals outside ClippedSurfaceChrome */}
                  {!bounds.isVertical && idx > 0 && (
                    <div
                      data-port-terminal="left"
                      style={{
                        position: 'absolute',
                        left: -4,
                        top: '50%',
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        transform: 'translateY(-50%)',
                        backgroundColor: style.palette.bgSurface,
                        border: `1.5px solid ${style.palette.accentPrimary}`,
                      }}
                    />
                  )}
                  {!bounds.isVertical && idx < modules.length - 1 && (
                    <div
                      data-port-terminal="right"
                      style={{
                        position: 'absolute',
                        right: -4,
                        top: '50%',
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        transform: 'translateY(-50%)',
                        backgroundColor: style.palette.bgSurface,
                        border: `1.5px solid ${style.palette.accentPrimary}`,
                      }}
                    />
                  )}

                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: monoFont,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: isFocused
                          ? style.palette.accentPrimary
                          : style.palette.textSecondary,
                      }}
                    >
                      {mod.badge}
                    </span>
                    {renderNodeMedallion(idx, isFocused)}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      fontFamily: displayFont,
                      fontSize: bounds.isVertical ? 26 : 30,
                      fontWeight: 700,
                      color: style.palette.textPrimary,
                      lineHeight: 1.16,
                      marginBottom: 4,
                    }}
                  >
                    {formatHeadingText(mod.title, style)}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      fontFamily: bodyFont,
                      fontSize: 16,
                      color: style.palette.textSecondary,
                    }}
                  >
                    {mod.sub}
                  </div>
                </div>
                {idx < modules.length - 1 && renderCoupler(idx)}
              </React.Fragment>
            );
          })}
        </div>
      </DepthPlane>

      {/* Foreground Tactile Studio Note Plate */}
      <DepthPlane z={0.28}>
        <div
          data-payload-plate="true"
          style={getTactileSurfaceStyle(style, {
            elevation: 'floating',
            overrides: {
              position: 'absolute',
              left: bounds.left,
              top: bounds.top + bounds.height - (bounds.isVertical ? 136 : 126),
              width: bounds.width,
              borderRadius: cardRadius,
              boxSizing: 'border-box',
              overflow: 'hidden',
              opacity: payloadEnter,
              transform: `translateY(${interpolate(
                payloadEnter,
                [0, 1],
                [14, 0]
              ).toFixed(1)}px)`,
            },
          })}
        >
          <ClippedSurfaceChrome
            topBarHeight={2}
            topBarColor={style.palette.accentPrimary}
            specularRim={!style.surface.isDark}
          />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 18px',
              backgroundColor: style.palette.bgElevated,
              borderBottom: `1px solid ${style.palette.inkBorder}`,
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span style={{ color: style.palette.textPrimary }}>
              Ciągłość światła i ruchu
            </span>
            <span style={{ color: style.palette.accentPrimary }}>
              {style.name}
            </span>
          </div>
          <div
            style={{
              position: 'relative',
              padding: '12px 18px',
              fontFamily: bodyFont,
              fontSize: 16,
              color: style.palette.textSecondary,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <span>
              Karty z maską wewnętrzną i wyraźną separacją od tła w każdym ze stylów.
            </span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                color: style.palette.accentSecondary,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              60 FPS
            </span>
          </div>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};

const PaperDiorama3DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const artWorld = resolveArtWorld(style);
  const bounds = getSafeStageBounds(width, height);

  const archFold = spring({
    frame: frame - 3,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });
  const mountainFold = spring({
    frame: frame - 9,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });
  const groveFold = spring({
    frame: frame - 15,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const deskFold = spring({
    frame: frame - 22,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const cloudDrift = Math.sin(frame * 0.036) * 14;
  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');

  const dieCutStroke = '#FFFDF8';
  const foliageA =
    artWorld === 'atelier'
      ? style.palette.accentSecondary
      : artWorld === 'illustrative'
        ? '#0F766E'
        : style.palette.textPrimary;
  const ridgeShadow = style.surface.isDark
    ? style.palette.bgElevated
    : style.palette.accentSecondary;

  return (
    <div
      data-diorama-world={artWorld}
      style={{
        position: 'absolute',
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        perspective: 1280,
      }}
    >
      {/* Multi-Plane 2.5D Painterly Pop-Up Stage */}
      <div
        style={{
          width: bounds.isVertical ? '100%' : '90%',
          height: bounds.isVertical ? 640 : 540,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Sculpted DioramaStage3D Plinth */}
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            width: '92%',
            height: 164,
            borderRadius: Math.round(32 * Math.max(0.25, style.surface.radiusScale)),
            backgroundColor: style.palette.bgElevated,
            border: `3px solid ${style.palette.inkBorder}`,
            transform: 'rotateX(64deg)',
            boxShadow: style.surface.isDark
              ? '0 38px 72px rgba(0, 0, 0, 0.62)'
              : '0 34px 64px rgba(15, 23, 42, 0.22)',
          }}
        />

        {/* Layer 1 (z = -90): Celestial Sunburst Arch Cutout */}
        <svg
          data-cutout-motif="sunburst-arch"
          viewBox="0 0 540 310"
          style={{
            position: 'absolute',
            bottom: bounds.isVertical ? 196 : 168,
            width: bounds.isVertical ? 480 : 540,
            height: bounds.isVertical ? 276 : 310,
            transformOrigin: 'bottom center',
            transform: `translateZ(-90px) rotateX(${interpolate(
              archFold,
              [0, 1],
              [-76, 0]
            ).toFixed(2)}deg)`,
            opacity: archFold,
            filter: 'drop-shadow(0 14px 24px rgba(15, 23, 42, 0.18))',
            overflow: 'visible',
          }}
        >
          <path
            d="M 56 290 A 214 214 0 0 1 484 290 Z"
            fill={style.palette.bgSurface}
            stroke={dieCutStroke}
            strokeWidth={14}
            strokeLinejoin="round"
          />
          <path
            d="M 74 282 A 196 196 0 0 1 466 282 Z"
            fill={style.palette.accentPrimary}
            fillOpacity={style.surface.isDark ? 0.32 : 0.2}
            stroke={style.palette.inkBorder}
            strokeWidth={2}
          />
          {[-60, -30, 0, 30, 60].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={270 + Math.cos(rad) * 78}
                y1={258 + Math.sin(rad) * 78}
                x2={270 + Math.cos(rad) * 182}
                y2={258 + Math.sin(rad) * 182}
                stroke={style.palette.accentPrimary}
                strokeWidth={3}
                strokeOpacity={0.55}
              />
            );
          })}
          <circle
            cx={270}
            cy={226}
            r={62}
            fill={style.palette.accentPrimary}
            opacity={0.88}
          />
        </svg>

        {/* Layer 2 (z = -45): Painterly Mountain Range Cutout */}
        <svg
          data-cutout-motif="mountain-range"
          viewBox="0 0 620 270"
          style={{
            position: 'absolute',
            bottom: bounds.isVertical ? 148 : 124,
            width: bounds.isVertical ? 560 : 640,
            height: bounds.isVertical ? 244 : 276,
            transformOrigin: 'bottom center',
            transform: `translateZ(-45px) rotateX(${interpolate(
              mountainFold,
              [0, 1],
              [-74, 0]
            ).toFixed(2)}deg)`,
            opacity: mountainFold,
            filter: 'drop-shadow(0 18px 28px rgba(15, 23, 42, 0.22))',
            overflow: 'visible',
          }}
        >
          <path
            d="M 28 248 L 156 96 L 268 184 L 392 64 L 516 178 L 592 128 L 592 248 Z"
            fill={ridgeShadow}
            stroke={dieCutStroke}
            strokeWidth={14}
            strokeLinejoin="round"
          />
          {/* Sunlit ridge facets */}
          <polygon
            points="156,96 222,184 156,248 28,248"
            fill={style.palette.accentPrimary}
            opacity={0.78}
          />
          <polygon
            points="392,64 468,178 392,248 268,184"
            fill={style.palette.accentSecondary}
            opacity={0.86}
          />
          {/* Die-cut snow / alabaster caps */}
          <polygon
            points="156,96 190,136 164,142 156,126 136,144"
            fill="#FFFDF8"
            opacity={0.92}
          />
          <polygon
            points="392,64 434,114 404,120 392,98 364,122"
            fill="#FFFDF8"
            opacity={0.94}
          />
        </svg>

        {/* Layer 3 (z = -15): Drifting Cloud Canopies */}
        <svg
          data-cutout-motif="cloud-canopy"
          viewBox="0 0 240 100"
          style={{
            position: 'absolute',
            top: bounds.isVertical ? 64 : 36,
            left: bounds.isVertical ? '8%' : '12%',
            width: 210,
            height: 88,
            transform: `translate3d(${cloudDrift.toFixed(1)}px, 0, -15px)`,
            opacity: mountainFold,
            filter: 'drop-shadow(0 10px 18px rgba(15, 23, 42, 0.15))',
          }}
        >
          <g
            fill={style.surface.isDark ? style.palette.bgSurface : '#FFFFFF'}
            stroke={dieCutStroke}
            strokeWidth={8}
          >
            <ellipse cx={120} cy={62} rx={76} ry={22} />
            <ellipse cx={88} cy={48} rx={42} ry={26} />
            <ellipse cx={146} cy={44} rx={46} ry={28} />
          </g>
        </svg>

        {/* Layer 4 (z = +20): Flanking Pine Grove Cutouts */}
        {[-1, 1].map((side) => (
          <svg
            key={side}
            data-cutout-motif="pine-grove"
            viewBox="0 0 160 200"
            style={{
              position: 'absolute',
              bottom: bounds.isVertical ? 104 : 88,
              left: side < 0 ? (bounds.isVertical ? '4%' : '8%') : undefined,
              right: side > 0 ? (bounds.isVertical ? '4%' : '8%') : undefined,
              width: bounds.isVertical ? 128 : 148,
              height: bounds.isVertical ? 160 : 184,
              transformOrigin: 'bottom center',
              transform: `translateZ(20px) rotateX(${interpolate(
                groveFold,
                [0, 1],
                [-72, 0]
              ).toFixed(2)}deg)`,
              opacity: groveFold,
              filter: 'drop-shadow(0 14px 22px rgba(15, 23, 42, 0.22))',
            }}
          >
            <g stroke={dieCutStroke} strokeWidth={10} strokeLinejoin="round">
              <polygon points="62,28 112,108 12,108" fill={foliageA} />
              <polygon points="62,72 122,156 6,156" fill={foliageA} />
              <polygon
                points="108,58 148,132 68,132"
                fill={style.palette.accentPrimary}
              />
            </g>
            <polygon points="62,28 112,108 12,108" fill={foliageA} />
            <polygon points="62,72 122,156 6,156" fill={foliageA} />
            <polygon
              points="108,58 148,132 68,132"
              fill={style.palette.accentPrimary}
              opacity={0.86}
            />
          </svg>
        ))}

        {/* Layer 5 (z = +55): Foreground Atelier Desk & Clipped Plaque */}
        <div
          data-cutout-motif="atelier-desk"
          style={getTactileSurfaceStyle(style, {
            elevation: 'floating',
            overrides: {
              position: 'relative',
              marginTop: bounds.isVertical ? 176 : 152,
              padding: bounds.isVertical ? '24px 30px' : '26px 38px',
              backgroundColor: style.palette.bgSurface,
              color: style.palette.textPrimary,
              border: `5px solid ${dieCutStroke}`,
              outline: `2px solid ${style.palette.inkBorder}`,
              borderRadius: Math.max(
                10,
                Math.round(18 * Math.max(0.3, style.surface.radiusScale))
              ),
              transformOrigin: 'bottom center',
              transform: `translateZ(55px) rotateX(${interpolate(
                deskFold,
                [0, 1],
                [-72, 0]
              ).toFixed(2)}deg)`,
              opacity: deskFold,
              textAlign: 'center',
              maxWidth: 580,
            },
          })}
        >
          <ClippedSurfaceChrome
            topBarHeight={4}
            topBarColor={style.palette.accentPrimary}
            specularRim={!style.surface.isDark}
          />
          <svg
            viewBox="0 0 220 54"
            style={{
              width: 184,
              height: 46,
              margin: '0 auto 8px auto',
              display: 'block',
            }}
          >
            {/* Poised brass desk lamp + open sketchbook */}
            <path
              d="M 46 46 L 38 18 L 68 12"
              fill="none"
              stroke={style.palette.accentPrimary}
              strokeWidth={3.5}
              strokeLinecap="round"
            />
            <polygon
              points="64,6 84,14 64,20"
              fill={style.palette.accentSecondary}
            />
            <rect
              x={86}
              y={22}
              width={64}
              height={24}
              rx={3}
              fill={style.palette.bgElevated}
              stroke={style.palette.inkBorder}
              strokeWidth={2}
            />
            <line
              x1={118}
              y1={23}
              x2={118}
              y2={45}
              stroke={style.palette.inkBorder}
              strokeWidth={1.6}
            />
            <line
              x1={22}
              y1={48}
              x2={198}
              y2={48}
              stroke={style.palette.inkBorder}
              strokeWidth={3.5}
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              position: 'relative',
              fontFamily: displayFont,
              fontSize: bounds.isVertical ? 34 : 40,
              fontWeight: 700,
              lineHeight: 1.12,
              marginBottom: 6,
              letterSpacing: `${style.typography.displayTrackingEm}em`,
            }}
          >
            {formatHeadingText('Wielowarstwowa wycinanka 2.5D', style)}
          </div>
          <div
            style={{
              position: 'relative',
              fontFamily: bodyFont,
              fontSize: 19,
              color: style.palette.textSecondary,
            }}
          >
            Malarskie pasma gór, obłoki i stół pracowni w barwach wybranego stylu.
          </div>
        </div>
      </div>
    </div>
  );
};

const Isometric3DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const artWorld = resolveArtWorld(style);
  const bounds = getSafeStageBounds(width, height);

  const isoMaterial: 'ceramic-maquette' | 'anodized-telemetry' | 'ink-figurine' =
    style.surface.cardTreatment === 'brutalist-hard' ||
    style.id === 'tactile-craft' ||
    style.id === 'sketch-notebook'
      ? 'ink-figurine'
      : style.surface.isDark || optics.lightingRig === 'darkroom-halation'
        ? 'anodized-telemetry'
        : 'ceramic-maquette';

  const shots = useMemo<ReadonlyArray<OpticalShot2D>>(() => {
    const cx = width / 2;
    const cy = height / 2;
    return [
      {
        fromFrame: 2,
        x: cx,
        y: cy,
        zoom: 1,
        focalZ: 0,
        aperture: optics.aperture,
        transition: 'cut',
      },
      {
        fromFrame: 150,
        x: cx + (bounds.isVertical ? 0 : 20),
        y: cy - 8,
        zoom: 1.035,
        focalZ: 0,
        aperture: optics.aperture,
        transition: 'glide',
      },
    ];
  }, [bounds.isVertical, height, optics.aperture, width]);

  const stageEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const speakerASpeaking = frame < 150;
  // Strictly inside 0.03..0.055 rad/frame calm studio cadence (zero vertical bounce)
  const breathA = Math.sin(frame * 0.042);
  const breathB = Math.sin(frame * 0.039 + 1.4);
  const syllableMod =
    0.42 + 0.32 * Math.sin(frame * 0.052) + 0.18 * Math.cos(frame * 0.036);

  const displayFont = formatFontFamilyCss(
    style.typography.displayFont,
    'display'
  );
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const bodyFill =
    isoMaterial === 'anodized-telemetry' ? style.palette.bgElevated : style.palette.bgSurface;
  const strokeInk = style.palette.inkBorder;
  const strokeWidth = isoMaterial === 'ink-figurine' ? 3 : 1.8;

  const renderMaquetteFigure = (
    cx: number,
    cy: number,
    primary: string,
    secondary: string,
    isSpeaking: boolean,
    breath: number
  ) => {
    const blurPx = isSpeaking
      ? 0
      : computeCircleOfConfusionPx(-0.18, 0, optics.aperture);
    const filterCss = blurPx < 0.25 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;
    const headTiltDeg = (isSpeaking ? 2.2 : -1.2) + breath * 1.4;

    return (
      <g
        transform={`translate(${cx}, ${cy})`}
        style={{ filter: filterCss, opacity: isSpeaking ? 1 : 0.84 }}
      >
        {/* Ground Contact Shadow Ellipse */}
        <ellipse
          cx={0}
          cy={76}
          rx={52}
          ry={15}
          fill="#0F172A"
          opacity={style.surface.isDark ? 0.52 : 0.2}
        />
        {/* Calibrated Speaker Plinth Ring */}
        <ellipse
          cx={0}
          cy={76}
          rx={56}
          ry={17}
          fill="none"
          stroke={isSpeaking ? primary : strokeInk}
          strokeWidth={isSpeaking ? 2.6 : 1.4}
          opacity={isSpeaking ? 0.92 : 0.45}
        />

        {/* Chamfered Architectural Torso Column */}
        <path
          d="M -32,68 L -26,-6 Q -24,-18 -12,-18 L 12,-18 Q 24,-18 26,-6 L 32,68 Z"
          fill={primary}
          stroke={strokeInk}
          strokeWidth={strokeWidth}
        />
        {/* Lapel / Chest Plate */}
        <rect
          x={-16}
          y={-6}
          width={32}
          height={22}
          rx={isoMaterial === 'ink-figurine' ? 0 : 4}
          fill={bodyFill}
          stroke={strokeInk}
          strokeWidth={1.4}
        />
        <rect x={-11} y={1} width={22} height={4} fill={secondary} />

        {/* Sculpted Head Maquette (zero spherical ear muffs) */}
        <g transform={`translate(0, -54) rotate(${headTiltDeg.toFixed(2)})`}>
          <rect
            x={-28}
            y={-28}
            width={56}
            height={52}
            rx={isoMaterial === 'ink-figurine' ? 4 : 18}
            fill={bodyFill}
            stroke={strokeInk}
            strokeWidth={strokeWidth}
          />
          {isoMaterial === 'ceramic-maquette' ? (
            <>
              <rect x={-18} y={-8} width={36} height={4.5} fill={secondary} />
              <rect
                x={-9}
                y={6}
                width={18}
                height={isSpeaking ? 3 + syllableMod * 4 : 2.2}
                fill={style.palette.textPrimary}
                opacity={isSpeaking ? 0.9 : 0.45}
              />
            </>
          ) : isoMaterial === 'anodized-telemetry' ? (
            <>
              <rect
                x={-21}
                y={-11}
                width={42}
                height={18}
                rx={5}
                fill="#070B12"
                stroke={secondary}
                strokeWidth={1.2}
              />
              {[-8, 0, 8].map((bx, bIdx) => {
                const bh = isSpeaking
                  ? 4 + syllableMod * (bIdx === 1 ? 8 : 5)
                  : 2.5;
                return (
                  <rect
                    key={bIdx}
                    x={bx - 2}
                    y={-2 - bh / 2}
                    width={4}
                    height={bh}
                    fill={isSpeaking ? secondary : primary}
                  />
                );
              })}
            </>
          ) : (
            <>
              <rect x={-20} y={-11} width={40} height={14} fill="#111111" />
              <rect x={-12} y={-6} width={6} height={4} fill={style.palette.bgSurface} />
              <rect x={6} y={-6} width={6} height={4} fill={style.palette.bgSurface} />
              <rect
                x={-8}
                y={8}
                width={16}
                height={isSpeaking ? 3 + syllableMod * 4 : 2.5}
                fill={secondary}
              />
            </>
          )}
        </g>
      </g>
    );
  };

  const renderScenicRoomBackdrop = (world: ArtWorld) => {
    const shaftShift = (optics.lightAngleDeg / 45) * 28;
    if (world === 'atelier') {
      return (
        <g data-iso-room="atelier">
          {/* Isometric Corner Anodized / Frosted-Glass Studio Walls */}
          <polygon
            points="92,188 360,98 360,12 92,98"
            fill={style.palette.bgElevated}
            fillOpacity={0.9}
            stroke={strokeInk}
            strokeWidth={1.6}
          />
          <polygon
            points="360,98 628,188 628,98 360,12"
            fill={style.palette.bgSurface}
            fillOpacity={0.92}
            stroke={strokeInk}
            strokeWidth={1.6}
          />
          {/* Linear Ceiling Light Cove */}
          <line
            x1={116}
            y1={96}
            x2={356}
            y2={20}
            stroke={style.palette.accentPrimary}
            strokeWidth={4}
            strokeOpacity={0.85}
          />
          <line
            x1={364}
            y1={20}
            x2={604}
            y2={96}
            stroke={style.palette.accentSecondary}
            strokeWidth={4}
            strokeOpacity={0.75}
          />
          {/* Acoustic Fin Slats on Right Wing */}
          {[0, 1, 2, 3, 4].map((fin) => {
            const fx = 424 + fin * 36;
            const fyTop = 36 + fin * 12;
            return (
              <line
                key={fin}
                x1={fx}
                y1={fyTop}
                x2={fx}
                y2={fyTop + 72}
                stroke={strokeInk}
                strokeWidth={2}
                strokeOpacity={0.55}
              />
            );
          })}
          {/* Centerpiece Console + Floating Geometric Prism */}
          <rect
            x={318}
            y={140}
            width={84}
            height={28}
            rx={6}
            fill={style.palette.bgElevated}
            stroke={strokeInk}
            strokeWidth={1.8}
          />
          <polygon
            points={`360,${(106 + breathA * 3).toFixed(1)} 378,128 342,128`}
            fill={style.palette.accentPrimary}
            fillOpacity={0.82}
            stroke={strokeInk}
            strokeWidth={1.4}
          />
        </g>
      );
    }

    if (world === 'illustrative') {
      return (
        <g data-iso-room="illustrative">
          {/* Warm Workshop Corner Walls */}
          <polygon
            points="92,188 360,98 360,8 92,94"
            fill={style.palette.bgElevated}
            stroke={strokeInk}
            strokeWidth={2}
          />
          <polygon
            points="360,98 628,188 628,94 360,8"
            fill={style.palette.bgSurface}
            stroke={strokeInk}
            strokeWidth={2}
          />
          {/* Arched Mullioned Workshop Window + Sunbeam */}
          <path
            d="M 188 124 L 188 76 A 32 28 0 0 1 252 76 L 252 104 Z"
            fill={style.palette.accentPrimary}
            fillOpacity={0.32}
            stroke={strokeInk}
            strokeWidth={2}
          />
          <polygon
            points={`188,124 252,104 ${336 + shaftShift},196 ${248 + shaftShift},208`}
            fill={style.palette.accentPrimary}
            opacity={0.16}
          />
          {/* Recessed Timber Bookshelf with Colorful Volumes */}
          <rect
            x={426}
            y={54}
            width={106}
            height={66}
            rx={4}
            fill={style.palette.bgElevated}
            stroke={strokeInk}
            strokeWidth={1.8}
          />
          {[0, 1, 2, 3, 4].map((bk) => (
            <rect
              key={bk}
              x={436 + bk * 18}
              y={68 + (bk % 2) * 6}
              width={12}
              height={42 - (bk % 2) * 6}
              fill={
                bk % 2 === 0
                  ? style.palette.accentPrimary
                  : style.palette.accentSecondary
              }
            />
          ))}
          {/* Centerpiece Craft Table with Open Sketchbook */}
          <rect
            x={314}
            y={142}
            width={92}
            height={26}
            rx={4}
            fill={style.palette.accentSecondary}
            fillOpacity={0.35}
            stroke={strokeInk}
            strokeWidth={2}
          />
          <rect
            x={338}
            y={132}
            width={44}
            height={12}
            rx={2}
            fill="#FFFDF8"
            stroke={strokeInk}
            strokeWidth={1.5}
          />
        </g>
      );
    }

    return (
      <g data-iso-room="editorial-gallery">
        {/* Travertine / Cotton-Plaster Museum Alcove Walls */}
        <polygon
          points="92,188 360,98 360,8 92,94"
          fill={style.palette.bgElevated}
          stroke={strokeInk}
          strokeWidth={1.8}
        />
        <polygon
          points="360,98 628,188 628,94 360,8"
          fill={style.palette.bgSurface}
          stroke={strokeInk}
          strokeWidth={1.8}
        />
        {/* Tall Architectural Window Slit + Key-Light Shaft */}
        <polygon
          points="204,48 232,39 232,114 204,123"
          fill={style.palette.accentPrimary}
          fillOpacity={0.28}
          stroke={strokeInk}
          strokeWidth={1.6}
        />
        <polygon
          points={`204,123 232,114 ${342 + shaftShift},198 ${278 + shaftShift},208`}
          fill={style.palette.accentPrimary}
          opacity={0.15}
        />
        {/* Framed Bas-Relief Artwork in Passe-Partout */}
        <rect
          x={434}
          y={52}
          width={92}
          height={68}
          fill={style.palette.bgElevated}
          stroke={strokeInk}
          strokeWidth={1.8}
        />
        <circle
          cx={480}
          cy={86}
          r={18}
          fill={style.palette.accentPrimary}
          opacity={0.82}
        />
        {/* Fluted Stone Plinth Table with Archival Folio */}
        <rect
          x={322}
          y={138}
          width={76}
          height={32}
          fill={style.palette.bgElevated}
          stroke={strokeInk}
          strokeWidth={1.8}
        />
        <rect
          x={338}
          y={130}
          width={44}
          height={9}
          fill={style.palette.accentSecondary}
          opacity={0.85}
        />
      </g>
    );
  };

  const ticks = Array.from({ length: 24 }, (_, idx) => {
    const rad = (idx / 24) * Math.PI * 2;
    const isMajor = idx % 6 === 0;
    const rOuterX = 290;
    const rOuterY = 78;
    const rInnerX = isMajor ? 268 : 278;
    const rInnerY = isMajor ? 71 : 74;
    return {
      idx,
      isMajor,
      x1: 360 + Math.cos(rad) * rInnerX,
      y1: 236 + Math.sin(rad) * rInnerY,
      x2: 360 + Math.cos(rad) * rOuterX,
      y2: 236 + Math.sin(rad) * rOuterY,
    };
  });

  return (
    <OpticalStage2D
      shots={shots}
      handheldIntensity={style.motion.cameraHandheld}
      seed={520}
    >
      {/* Background Studio Key-Beam */}
      <DepthPlane z={-0.54}>
        <div
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            opacity: stageEnter,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(${
                optics.lightAngleDeg + 90
              }deg, ${style.palette.accentPrimary}16 0%, transparent 62%)`,
              border: `1px solid ${style.palette.inkBorder}30`,
            }}
          />
        </div>
      </DepthPlane>

      {/* Primary Architectural Room, Calibrated 3D Turntable Plinth & Maquette Figures */}
      <DepthPlane z={0} disableFocusBlur>
        <div
          data-iso-material={isoMaterial}
          data-iso-plinth="calibrated-24"
          data-iso-scenic-world={artWorld}
          style={{
            position: 'absolute',
            left: bounds.left,
            top: bounds.top + (bounds.isVertical ? 48 : 34),
            width: bounds.width,
            height: bounds.height - (bounds.isVertical ? 64 : 48),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: stageEnter,
          }}
        >
          <svg
            viewBox="0 0 720 350"
            style={{
              width: '100%',
              maxWidth: bounds.isVertical ? 760 : 900,
              height: bounds.isVertical ? 470 : 420,
              overflow: 'visible',
            }}
          >
            {/* 3-ArtWorld Isometric Architectural Room Set */}
            {renderScenicRoomBackdrop(artWorld)}

            {/* Outer Base Bevel */}
            <ellipse
              cx={360}
              cy={250}
              rx={308}
              ry={84}
              fill={style.palette.bgElevated}
              stroke={strokeInk}
              strokeWidth={2}
            />
            {/* Upper Calibrated Turntable Deck */}
            <ellipse
              cx={360}
              cy={236}
              rx={294}
              ry={80}
              fill={style.palette.bgSurface}
              stroke={strokeInk}
              strokeWidth={2}
            />
            {/* Inner Acoustic Ring */}
            <ellipse
              cx={360}
              cy={236}
              rx={208}
              ry={55}
              fill="none"
              stroke={style.palette.accentPrimary}
              strokeWidth={1.4}
              strokeOpacity={0.55}
            />
            {/* 24 Engraved Degree Ticks */}
            {ticks.map((t) => (
              <line
                key={t.idx}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={
                  t.isMajor ? style.palette.accentPrimary : strokeInk
                }
                strokeWidth={t.isMajor ? 2.2 : 1.2}
                strokeOpacity={t.isMajor ? 0.85 : 0.45}
              />
            ))}

            {renderMaquetteFigure(
              235,
              152,
              style.palette.accentPrimary,
              style.palette.accentSecondary,
              speakerASpeaking,
              breathA
            )}
            {renderMaquetteFigure(
              485,
              152,
              style.palette.accentSecondary,
              style.palette.accentPrimary,
              !speakerASpeaking,
              breathB
            )}
          </svg>

          {/* Speaker Nameplates with ClippedSurfaceChrome */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: bounds.isVertical ? 'column' : 'row',
              gap: 18,
            }}
          >
            {[
              {
                name: 'Prowadząca',
                role: 'Narracja główna',
                color: style.palette.accentPrimary,
                active: speakerASpeaking,
              },
              {
                name: 'Gość studia',
                role: 'Rozmowa w pracowni',
                color: style.palette.accentSecondary,
                active: !speakerASpeaking,
              },
            ].map((sp) => (
              <div
                key={sp.name}
                style={getTactileSurfaceStyle(style, {
                  elevation: sp.active ? 'lifted' : 'resting',
                  overrides: {
                    position: 'relative',
                    flex: 1,
                    padding: '16px 22px',
                    borderRadius: Math.max(
                      0,
                      Math.round(10 * style.surface.radiusScale)
                    ),
                    borderColor: sp.active ? sp.color : style.palette.inkBorder,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                  },
                })}
              >
                <ClippedSurfaceChrome
                  topBarHeight={3}
                  topBarColor={sp.active ? sp.color : style.palette.inkBorder}
                  specularRim={!style.surface.isDark}
                />
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontSize: 24,
                      fontWeight: 700,
                      color: style.palette.textPrimary,
                    }}
                  >
                    {formatHeadingText(sp.name, style)}
                  </div>
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: sp.active ? sp.color : style.palette.textSecondary,
                    }}
                  >
                    {sp.active ? '▪ Aktywna wypowiedź' : sp.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DepthPlane>
    </OpticalStage2D>
  );
};

export const StyleLabPreviewComposition: React.FC<StyleLabCompositionProps> = ({
  style,
  kit,
}) => {
  const frame = useCurrentFrame();
  const usesOpticalStage =
    kit === 'editorial-collage' ||
    kit === 'kinetic-typography' ||
    kit === 'vector-scene-2d' ||
    kit === 'data-storytelling' ||
    kit === 'motion-diagrams-2d' ||
    kit === 'isometric-3d';

  // Deterministic handheld camera drift preview for kits not yet on OpticalStage2D
  const driftX =
    !usesOpticalStage && frame >= 2
      ? Math.sin(frame * 0.045) * style.motion.cameraHandheld * 22
      : 0;
  const driftY =
    !usesOpticalStage && frame >= 2
      ? Math.cos(frame * 0.035) * style.motion.cameraHandheld * 14
      : 0;

  return (
    <StyleProvider style={style} renderBackdrop>
      {frame >= 2 ? (
        <AbsoluteFill
          style={{
            transform:
              driftX !== 0 || driftY !== 0
                ? `translate(${driftX.toFixed(2)}px, ${driftY.toFixed(2)}px)`
                : undefined,
          }}
        >
          <ScenicBackdropLayers style={style} seed={`style-lab:${kit}`} />
          <StageLightingRig
            style={style}
            seed={`style-lab:${kit}`}
            renderBaseFill={false}
          />
          {kit === 'editorial-collage' && <EditorialCollagePreview />}
          {kit === 'vector-scene-2d' && <VectorScene2DPreview />}
          {kit === 'kinetic-typography' && <KineticTypographyPreview />}
          {kit === 'data-storytelling' && <DataStorytellingPreview />}
          {kit === 'motion-diagrams-2d' && <MotionDiagrams2DPreview />}
          {kit === 'paper-diorama-3d' && <PaperDiorama3DPreview />}
          {kit === 'isometric-3d' && <Isometric3DPreview />}
        </AbsoluteFill>
      ) : null}
    </StyleProvider>
  );
};

export interface StyleLabShowcaseProps {
  activeStyle: StylePreset;
  activeKit: BuiltinVisualKitId;
  onSelectKit: (kit: BuiltinVisualKitId) => void;
  aspectRatio: StyleLabAspectRatio;
  onChangeAspectRatio: (ratio: StyleLabAspectRatio) => void;
  overlays: OverlaySettings;
  onToggleOverlay: (key: keyof OverlaySettings) => void;
  onPlayingChange?: (playing: boolean) => void;
  onFpsMeasure?: (fps: number) => void;
}

export const StyleLabShowcase: React.FC<StyleLabShowcaseProps> = ({
  activeStyle,
  activeKit,
  onSelectKit,
  aspectRatio,
  onChangeAspectRatio,
  overlays,
  onToggleOverlay,
  onPlayingChange,
  onFpsMeasure,
}) => {
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const {
    playerRefCallback,
    displayFrame,
    currentFrameRef,
    isPlaying,
    loop,
    setLoop,
    seekToFrame,
    togglePlay,
    pause,
  } = useRemotionPlayer({
    fps: STYLE_LAB_FPS,
    durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
    resetKey: 'stylelab',
    initialFrame: 48,
    onPlayingChange,
    onFpsMeasure,
  });

  const [stageBox, setStageBox] = useState<{ w: number; h: number }>({
    w: 960,
    h: 540,
  });

  const compWidth = aspectRatio === '9:16' ? 1080 : 1920;
  const compHeight = aspectRatio === '9:16' ? 1920 : 1080;
  const maxFrameIndex = STYLE_LAB_DURATION_IN_FRAMES - 1;
  const cliCommand = `npx make-pictures new moj-film --kit=${activeKit} --style=${activeStyle.id}`;

  const inputProps = useMemo<StyleLabCompositionProps>(
    () => ({
      style: activeStyle,
      kit: activeKit,
    }),
    [activeStyle, activeKit]
  );

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyCli = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cliCommand);
      }
      setCopiedCli(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedCli(false);
      }, 1800);
    } catch {
      // ignore clipboard restrictions
    }
  }, [cliCommand]);

  // Fit 16:9 or 9:16 preview stage cleanly into center viewport with generous breathing room
  useEffect(() => {
    const el = stageAreaRef.current;
    if (!el) return;

    const computeFit = () => {
      const rect = el.getBoundingClientRect();
      const padX = rect.width < 640 ? 20 : 52;
      const padY = rect.height < 480 ? 20 : 36;
      const availW = Math.max(200, rect.width - padX);
      const availH = Math.max(150, rect.height - padY);
      const aspect = compWidth / compHeight;

      let fitW = availW;
      let fitH = fitW / aspect;
      if (fitH > availH) {
        fitH = availH;
        fitW = fitH * aspect;
      }

      setStageBox({
        w: Math.round(fitW),
        h: Math.round(fitH),
      });
    };

    computeFit();
    const ro = new ResizeObserver(computeFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compWidth, compHeight]);

  return (
    <main className="mp-center-col">
      {/* ==================== 7 VISUAL KITS + ASPECT RATIO + COPYABLE CLI TOP BAR ==================== */}
      <div className="mp-stage-top-bar">
        <div
          className="mp-stylelab-kit-strip"
          role="tablist"
          aria-label="Testowany zestaw sceniczny (Visual Kit)"
        >
          {STYLE_LAB_KITS.map((item) => {
            const active = item.id === activeKit;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`mp-kit-pill ${active ? 'is-active' : ''}`}
                onMouseDown={preventButtonFocus}
                onClick={() => onSelectKit(item.id)}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="mp-kit-pill-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mp-toolbar-group" style={{ flexShrink: 0 }}>
          <div className="mp-aspect-toggle" role="group" aria-label="Format kadru">
            <button
              type="button"
              className={`mp-aspect-btn ${
                aspectRatio === '16:9' ? 'is-active' : ''
              }`}
              onMouseDown={preventButtonFocus}
              onClick={() => onChangeAspectRatio('16:9')}
              title="Format poziomy 1920×1080 (16:9 HD)"
            >
              <Monitor size={13} />
              <span>16:9</span>
            </button>
            <button
              type="button"
              className={`mp-aspect-btn ${
                aspectRatio === '9:16' ? 'is-active' : ''
              }`}
              onMouseDown={preventButtonFocus}
              onClick={() => onChangeAspectRatio('9:16')}
              title="Format pionowy 1080×1920 (9:16 Shorts / Reels)"
            >
              <Smartphone size={13} />
              <span>9:16</span>
            </button>
          </div>

          <button
            type="button"
            className="mp-stylelab-cli-hint"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              cursor: 'pointer',
              maxWidth: 340,
              borderColor: copiedCli
                ? 'var(--mp-emerald-border)'
                : 'var(--mp-border-hairline)',
              backgroundColor: copiedCli
                ? 'var(--mp-emerald-soft)'
                : 'var(--mp-bg-subtle)',
              color: copiedCli
                ? 'var(--mp-emerald-text)'
                : 'var(--mp-text-secondary)',
            }}
            onMouseDown={preventButtonFocus}
            onClick={() => void handleCopyCli()}
            title={`Kliknij, aby skopiować: ${cliCommand}`}
            aria-label={`Skopiuj komendę CLI: ${cliCommand}`}
          >
            {copiedCli ? (
              <Check size={12} style={{ flexShrink: 0 }} />
            ) : (
              <Copy size={12} style={{ flexShrink: 0 }} />
            )}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {cliCommand}
            </span>
          </button>
        </div>
      </div>

      {/* ==================== 60 FPS STYLE LAB STAGE ==================== */}
      <div className="mp-stage-canvas-area" ref={stageAreaRef}>
        <div
          className="mp-player-frame"
          style={{ width: stageBox.w, height: stageBox.h }}
        >
          <Player
            key={`stylelab:${aspectRatio}`}
            ref={playerRefCallback}
            component={StyleLabPreviewComposition}
            inputProps={inputProps}
            durationInFrames={STYLE_LAB_DURATION_IN_FRAMES}
            compositionWidth={compWidth}
            compositionHeight={compHeight}
            fps={STYLE_LAB_FPS}
            initialFrame={Math.min(currentFrameRef.current, maxFrameIndex)}
            loop={loop}
            controls={false}
            clickToPlay={true}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense={true}
            style={{
              width: '100%',
              height: '100%',
            }}
          />

          <DirectorOverlays
            width={compWidth}
            height={compHeight}
            overlays={overlays}
          />
        </div>
      </div>

      {/* ==================== FLOATING LIQUID GLASS TRANSPORT CAPSULE ==================== */}
      <div className="mp-floating-dock-wrap">
        <div
          className="mp-floating-transport"
          style={{ width: 'min(940px, 100%)' }}
          role="region"
          aria-label="Sterowanie podglądem Style Lab"
        >
          {/* Primary Play/Pause FAB */}
          <button
            type="button"
            className="mp-play-fab"
            aria-pressed={isPlaying}
            aria-label={isPlaying ? 'Pauza' : 'Odtwarzaj'}
            title={isPlaying ? 'Pauza (Spacja / K)' : 'Odtwarzaj (Spacja / K)'}
            onMouseDown={preventButtonFocus}
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" style={{ marginLeft: 1.5 }} />
            )}
          </button>

          {/* Compact Frame Steppers (-10, -1, +1, +10, Klatka 0) */}
          <div className="mp-transport-step-group" role="group" aria-label="Nawigacja klatkowa">
            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(displayFrame - 10);
              }}
              title="-10 klatek (J / Shift + ←)"
              aria-label="Cofnij o 10 klatek"
            >
              <ChevronsLeft size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(displayFrame - 1);
              }}
              title="-1 klatka (←)"
              aria-label="Poprzednia klatka"
            >
              <ChevronLeft size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(displayFrame + 1);
              }}
              title="+1 klatka (→)"
              aria-label="Następna klatka"
            >
              <ChevronRight size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(displayFrame + 10);
              }}
              title="+10 klatek (L / Shift + →)"
              aria-label="Przeskocz o 10 klatek"
            >
              <ChevronsRight size={14} />
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(0);
              }}
              title="Skocz do klatki 0 (weryfikacja czystego tła startowego)"
              aria-label="Skocz do klatki 0"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Smooth Scrubber + Tabular Timecode Pill */}
          <div className="mp-scrubber-wrap">
            <input
              type="range"
              className="mp-timeline-slider"
              min={0}
              max={maxFrameIndex}
              value={Math.min(displayFrame, maxFrameIndex)}
              aria-label="Oś czasu podglądu stylu"
              onChange={(e) => {
                pause();
                seekToFrame(Number(e.target.value));
              }}
            />
            <span className="mp-timecode-pill mp-tabular">
              {formatTimecode(displayFrame, STYLE_LAB_FPS)} • f:{displayFrame}/
              {maxFrameIndex}
            </span>
          </div>

          {/* Loop, Safe Box, Grid 3×3 & Frame 0 */}
          <div className="mp-toolbar-group" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className={`mp-icon-btn ${loop ? 'is-active' : 'is-ghost'}`}
              style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}
              aria-pressed={loop}
              aria-label="Zapętlanie podglądu"
              title={loop ? 'Pętla włączona' : 'Pętla wyłączona'}
              onMouseDown={preventButtonFocus}
              onClick={() => setLoop((v) => !v)}
            >
              <Repeat size={14} />
            </button>

            <button
              type="button"
              className={`mp-drawer-toggle-btn ${
                overlays.goldenSafeBox ? 'is-active' : ''
              }`}
              aria-pressed={overlays.goldenSafeBox}
              onMouseDown={preventButtonFocus}
              onClick={() => onToggleOverlay('goldenSafeBox')}
              title="Bezpieczny kadr (Golden Safe Box)"
            >
              <Smartphone size={13} />
              <span>Safe Box</span>
            </button>

            <button
              type="button"
              className={`mp-drawer-toggle-btn ${
                overlays.ruleOfThirds ? 'is-active' : ''
              }`}
              aria-pressed={overlays.ruleOfThirds}
              onMouseDown={preventButtonFocus}
              onClick={() => onToggleOverlay('ruleOfThirds')}
              title="Siatka kompozycyjna 3×3"
            >
              <Grid3x3 size={13} />
              <span className="mp-hide-mobile">3×3</span>
            </button>

            <button
              type="button"
              className="mp-drawer-toggle-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                pause();
                seekToFrame(0);
              }}
              title="Skocz do klatki 0 (weryfikacja czystego tła startowego)"
            >
              <RotateCcw size={13} />
              <span className="mp-hide-mobile">Klatka 0</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
