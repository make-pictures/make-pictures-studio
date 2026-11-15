import React from 'react';
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  createSeededRandom,
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveStyleOptics,
  useStudioStyle,
} from '@make-pictures/core';

export type EditorialMountType =
  | 'auto'
  | 'archival-tape'
  | 'photo-corners'
  | 'slide-mount'
  | 'none';

export interface EditorialMediaCardProps {
  src?: string;
  caption: string;
  sourceTag?: string;
  mountType?: EditorialMountType;
  tiltDeg?: number;
  startFrame?: number;
  durationInFrames?: number;
  zoomFrom?: number;
  zoomTo?: number;
  panX?: number;
  panY?: number;
  styleOverrides?: React.CSSProperties;
}

function resolveEffectiveMount(
  mountType: EditorialMountType,
  styleId: string,
  lightingRig: string
): Exclude<EditorialMountType, 'auto'> {
  if (mountType !== 'auto') return mountType;
  if (lightingRig === 'darkroom-halation') return 'slide-mount';
  if (lightingRig === 'studio-macro') return 'none';
  if (styleId === 'archival-chronicle') return 'photo-corners';
  return 'archival-tape';
}

export const EditorialMediaCard: React.FC<EditorialMediaCardProps> = ({
  src,
  caption,
  sourceTag,
  mountType = 'auto',
  tiltDeg,
  startFrame = 2,
  durationInFrames = 180,
  zoomFrom = 1.02,
  zoomTo = 1.1,
  panX = -14,
  panY = -10,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);

  const effectiveStart = Math.max(2, startFrame);
  if (frame < effectiveStart) return null;

  const localFrame = frame - effectiveStart;
  const enter = spring({
    frame: localFrame,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const kenBurnsProgress = interpolate(
    localFrame,
    [0, Math.max(30, durationInFrames)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const scale = interpolate(kenBurnsProgress, [0, 1], [zoomFrom, zoomTo]);
  const tx = interpolate(kenBurnsProgress, [0, 1], [0, panX]);
  const ty = interpolate(kenBurnsProgress, [0, 1], [0, panY]);

  const effectiveMount = resolveEffectiveMount(
    mountType,
    style.id,
    optics.lightingRig
  );

  const seededUnit = createSeededRandom(`editorial-media:${caption}:${sourceTag ?? ''}`)();
  const resolvedTilt =
    typeof tiltDeg === 'number'
      ? Math.max(-1.2, Math.min(1.2, tiltDeg))
      : optics.lightingRig === 'studio-macro'
        ? 0
        : Number(((seededUnit - 0.5) * 1.9).toFixed(2));

  const isSlide = effectiveMount === 'slide-mount';
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const translateY = interpolate(enter, [0, 1], [22, 0]);
  const cardSurface = getTactileSurfaceStyle(style, {
    elevation: 'lifted',
    tiltDeg: resolvedTilt,
    overrides: {
      position: 'relative',
      boxSizing: 'border-box',
      padding: isSlide ? '18px 20px 22px 20px' : '14px 14px 24px 14px',
      backgroundColor: isSlide
        ? style.surface.isDark
          ? '#0B101C'
          : '#18181B'
        : style.palette.bgSurface,
      color: isSlide ? '#F8FAFC' : style.palette.textPrimary,
      borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      opacity: enter,
      transform: `translateY(${translateY.toFixed(2)}px)`,
      ...styleOverrides,
    },
  });

  return (
    <div data-mount-type={effectiveMount} style={cardSurface}>
      {/* Translucent Archival Masking Tape */}
      {effectiveMount === 'archival-tape' && (
        <div
          style={{
            position: 'absolute',
            top: -11,
            left: '50%',
            width: 112,
            height: 24,
            transform: 'translateX(-50%) rotate(-1.8deg)',
            backgroundColor: 'rgba(244, 234, 206, 0.78)',
            border: `1px solid ${style.palette.inkBorder}`,
            boxShadow: '0 2px 5px rgba(24, 22, 21, 0.1)',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}

      {/* 35mm Slide Sprocket Header */}
      {isSlide && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: monoFont,
            fontSize: 12,
            letterSpacing: '0.14em',
            color: 'rgba(248, 250, 252, 0.64)',
          }}
        >
          <span>▲ 35MM ARCHIVE POSITIVE</span>
          <span>{sourceTag ?? 'KADR 14A'}</span>
        </div>
      )}

      {/* Photographic Aperture Window */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: Math.max(0, Math.round(4 * style.surface.radiusScale)),
          aspectRatio: '16 / 10',
          backgroundColor: style.palette.bgElevated,
          border: `1px solid ${isSlide ? 'rgba(255,255,255,0.16)' : style.palette.inkBorder}`,
        }}
      >
        {src ? (
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
            }}
          />
        ) : (
          <svg
            data-contact-sheet="true"
            viewBox="0 0 640 400"
            preserveAspectRatio="xMidYMid slice"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
              transformOrigin: 'center center',
            }}
          >
            <rect width="640" height="400" fill={style.palette.bgElevated} />
            {/* Fine engraving hatch lines */}
            {Array.from({ length: 14 }).map((_, i) => (
              <line
                key={i}
                x1={0}
                y1={24 + i * 28}
                x2={640}
                y2={24 + i * 28}
                stroke={style.palette.inkBorder}
                strokeWidth="0.8"
                opacity="0.45"
              />
            ))}
            <rect
              x="36"
              y="32"
              width="568"
              height="336"
              fill="none"
              stroke={style.palette.inkBorder}
              strokeWidth="1.5"
            />
            <line
              x1="36"
              y1="368"
              x2="604"
              y2="32"
              stroke={style.palette.accentSecondary}
              strokeWidth="1"
              strokeDasharray="6 6"
              opacity="0.55"
            />
            <circle
              cx="452"
              cy="146"
              r="76"
              fill={style.palette.accentPrimary}
              opacity="0.82"
            />
            <path
              d="M54 352 L212 204 L334 298 L446 218 L586 352 Z"
              fill={style.palette.accentSecondary}
              opacity="0.68"
            />
            <g stroke={style.palette.textPrimary} strokeWidth="1.5" opacity="0.55">
              <line x1="310" y1="200" x2="330" y2="200" />
              <line x1="320" y1="190" x2="320" y2="210" />
            </g>
          </svg>
        )}

        {/* Archival Die-Cut Photo Corners */}
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

      {/* Baryta Print Footer: Caption + Archival Catalog Stamp */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 16,
          paddingTop: 2,
        }}
      >
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.35,
            color: isSlide ? '#F8FAFC' : style.palette.textPrimary,
          }}
        >
          {caption}
        </div>
        {sourceTag && !isSlide ? (
          <span
            style={{
              flexShrink: 0,
              fontFamily: monoFont,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: style.palette.accentPrimary,
            }}
          >
            {sourceTag}
          </span>
        ) : null}
      </div>
    </div>
  );
};
