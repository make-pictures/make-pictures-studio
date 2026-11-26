import React, { useContext } from 'react';
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  ClippedSurfaceChrome,
  createSeededRandom,
  formatFontFamilyCss,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  hashToHex,
  resolveArtWorld,
  resolveStyleOptics,
  useStudioStyle,
  type ArtWorld,
  type StylePreset,
} from "../..";
import { SplitStorySlotContext } from './SplitStoryLayout';

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

const PainterlyEditorialArtwork: React.FC<{
  artWorld: ArtWorld;
  style: StylePreset;
  scale: number;
  tx: number;
  ty: number;
  uid: string;
}> = ({ artWorld, style, scale, tx, ty, uid }) => {
  const { palette, surface } = style;

  if (artWorld === 'atelier') {
    return (
      <svg
        data-contact-sheet="true"
        data-editorial-artworld="atelier"
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
        <defs>
          <linearGradient id={`${uid}-at-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.bgSurface} />
            <stop offset="100%" stopColor={palette.bgElevated} />
          </linearGradient>
          <radialGradient id={`${uid}-at-orb`} cx="38%" cy="34%" r="62%">
            <stop
              offset="0%"
              stopColor={surface.isDark ? '#FFFFFF' : palette.bgSurface}
              stopOpacity={0.92}
            />
            <stop offset="55%" stopColor={palette.accentPrimary} stopOpacity={0.78} />
            <stop offset="100%" stopColor={palette.accentSecondary} stopOpacity={0.9} />
          </radialGradient>
        </defs>
        <rect width="640" height="400" fill={`url(#${uid}-at-sky)`} />
        <path
          d="M 0 286 Q 320 318 640 286 L 640 400 L 0 400 Z"
          fill={palette.bgCanvas}
          opacity="0.88"
        />
        <ellipse
          cx="320"
          cy="322"
          rx="210"
          ry="28"
          fill={palette.accentPrimary}
          opacity={surface.isDark ? 0.22 : 0.14}
        />
        <path
          d="M 186 286 V 156 A 134 134 0 0 1 454 156 V 286 Z"
          fill={palette.accentSecondary}
          fillOpacity={surface.isDark ? 0.16 : 0.12}
          stroke={palette.inkBorder}
          strokeWidth="1.4"
        />
        <circle cx="320" cy="192" r="78" fill={`url(#${uid}-at-orb)`} />
        <ellipse
          cx="320"
          cy="192"
          rx="118"
          ry="38"
          fill="none"
          stroke={palette.accentPrimary}
          strokeOpacity="0.55"
          strokeWidth="1.6"
          transform="rotate(-16 320 192)"
        />
      </svg>
    );
  }

  if (artWorld === 'illustrative') {
    return (
      <svg
        data-contact-sheet="true"
        data-editorial-artworld="illustrative"
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
        <defs>
          <linearGradient id={`${uid}-il-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.bgCanvas} />
            <stop offset="100%" stopColor={palette.bgElevated} />
          </linearGradient>
        </defs>
        <rect width="640" height="400" fill={`url(#${uid}-il-sky)`} />
        <circle
          cx="458"
          cy="126"
          r="94"
          fill={palette.accentPrimary}
          opacity="0.16"
        />
        <circle
          cx="458"
          cy="126"
          r="58"
          fill={palette.accentPrimary}
          opacity="0.86"
        />
        {/* Fluffy Storybook Clouds */}
        <g fill={surface.isDark ? palette.bgSurface : '#FFFFFF'} opacity="0.88">
          <ellipse cx="164" cy="112" rx="54" ry="18" />
          <ellipse cx="142" cy="102" rx="30" ry="20" />
          <ellipse cx="182" cy="98" rx="34" ry="22" />
        </g>
        {/* Layered Painterly Ridges */}
        <path
          d="M -20 286 L 146 174 L 278 252 L 418 168 L 660 294 L 660 400 L -20 400 Z"
          fill={palette.accentSecondary}
          opacity="0.46"
        />
        <path
          d="M -20 326 Q 168 238 344 292 T 660 264 L 660 400 L -20 400 Z"
          fill={palette.accentPrimary}
          opacity="0.62"
        />
        <path
          d="M -20 356 Q 220 308 420 342 T 660 326 L 660 400 L -20 400 Z"
          fill={palette.textPrimary}
          opacity={surface.isDark ? 0.34 : 0.18}
        />
      </svg>
    );
  }

  // 'editorial-gallery': Passe-partout relief, sunlit travertine arch & warm horizon
  return (
    <svg
      data-contact-sheet="true"
      data-editorial-artworld="editorial-gallery"
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
      <defs>
        <linearGradient id={`${uid}-ed-wash`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.bgSurface} />
          <stop offset="65%" stopColor={palette.bgElevated} />
          <stop offset="100%" stopColor={palette.bgCanvas} />
        </linearGradient>
      </defs>
      <rect width="640" height="400" fill={`url(#${uid}-ed-wash)`} />
      {/* Diagonal sunlit gallery shaft */}
      <polygon
        points="84,0 296,0 448,400 202,400"
        fill={surface.isDark ? palette.bgElevated : '#FFFFFF'}
        opacity={surface.isDark ? 0.24 : 0.56}
      />
      {/* Passe-partout inner frame */}
      <rect
        x="34"
        y="28"
        width="572"
        height="344"
        fill="none"
        stroke={palette.inkBorder}
        strokeWidth="1.25"
      />
      {/* Sculptural Gallery Arch & Sun Disc */}
      <path
        d="M 196 340 V 168 A 124 124 0 0 1 444 168 V 340 Z"
        fill={palette.bgCanvas}
        stroke={palette.inkBorder}
        strokeWidth="1.4"
      />
      <circle
        cx="358"
        cy="168"
        r="56"
        fill={palette.accentPrimary}
        opacity="0.84"
      />
      <path
        d="M 118 340 Q 254 252 384 298 T 522 278 L 522 340 Z"
        fill={palette.accentSecondary}
        opacity="0.68"
      />
      <line
        x1="88"
        y1="340"
        x2="552"
        y2="340"
        stroke={palette.textPrimary}
        strokeOpacity="0.38"
        strokeWidth="1.4"
      />
    </svg>
  );
};

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
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const artWorld = resolveArtWorld(style);
  const inSplitSlot = useContext(SplitStorySlotContext);
  const isVertical = height > width;
  const isCompactVerticalSlot = inSplitSlot && isVertical;

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

  const cleanSourceTag = sourceTag?.trim() ? sourceTag.trim() : undefined;
  const seededUnit = createSeededRandom(
    `editorial-media:${caption}:${cleanSourceTag ?? ''}`
  )();
  const tiltSpan = isVertical ? 1.1 : 1.9;
  const resolvedTilt =
    typeof tiltDeg === 'number'
      ? Math.max(-1.2, Math.min(1.2, tiltDeg))
      : optics.lightingRig === 'studio-macro'
        ? 0
        : Number(((seededUnit - 0.5) * tiltSpan).toFixed(2));

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
      margin: isCompactVerticalSlot ? '0 18px' : undefined,
      padding: isSlide
        ? isCompactVerticalSlot
          ? '14px 16px 16px 16px'
          : '18px 20px 22px 20px'
        : isCompactVerticalSlot
          ? '12px 12px 16px 12px'
          : '14px 14px 24px 14px',
      backgroundColor: isSlide
        ? style.surface.isDark
          ? '#0B101C'
          : '#18181B'
        : style.palette.bgSurface,
      color: isSlide ? '#F8FAFC' : style.palette.textPrimary,
      borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
      display: 'flex',
      flexDirection: 'column',
      gap: isCompactVerticalSlot ? 10 : 14,
      opacity: enter,
      transform: `translateY(${translateY.toFixed(2)}px)`,
      ...styleOverrides,
    },
  });

  const uid = `ed-art-${hashToHex(
    `${style.id}\u001f${caption}\u001f${cleanSourceTag ?? ''}`
  )}`;

  return (
    <div data-mount-type={effectiveMount} style={cardSurface}>
      <ClippedSurfaceChrome
        specularRim={!isSlide && !style.surface.isDark}
        tintGradient={
          !isSlide && !style.surface.isDark
            ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.56) 0%, rgba(255, 255, 255, 0) 46%)'
            : undefined
        }
      />

      {/* Translucent Archival Masking Tape (Bridges top print margin) */}
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

      {/* Optional Slide Source Header (only when sourceTag is explicitly provided) */}
      {isSlide && cleanSourceTag ? (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            fontFamily: monoFont,
            fontSize: 18,
            letterSpacing: '0.08em',
            color: 'rgba(248, 250, 252, 0.72)',
          }}
        >
          <span>{cleanSourceTag}</span>
        </div>
      ) : null}

      {/* Photographic / Painterly Aperture Window */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          borderRadius: Math.max(0, Math.round(4 * style.surface.radiusScale)),
          aspectRatio: isCompactVerticalSlot ? '16 / 8.2' : '16 / 10',
          backgroundColor: style.palette.bgElevated,
          border: `1px solid ${
            isSlide ? 'rgba(255,255,255,0.16)' : style.palette.inkBorder
          }`,
        }}
      >
        {src ? (
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              backfaceVisibility: 'hidden',
              transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
            }}
          />
        ) : (
          <PainterlyEditorialArtwork
            artWorld={artWorld}
            style={style}
            scale={scale}
            tx={tx}
            ty={ty}
            uid={uid}
          />
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

      {/* Print Footer: Caption + Optional Source Tag */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
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
        {cleanSourceTag && !isSlide ? (
          <span
            style={{
              flexShrink: 0,
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: style.palette.accentPrimary,
            }}
          >
            {cleanSourceTag}
          </span>
        ) : null}
      </div>
    </div>
  );
};
