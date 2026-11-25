import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import { zColor } from '@remotion/zod-types';
import { ClippedSurfaceChrome } from '../director';
import { AnimatedBarRace } from '../kits/data-storytelling';
import { EditorialMediaCard } from '../kits/editorial-collage';
import { StoryCard2D } from '../kits/vector-scene-2d';
import {
  BUILT_IN_STYLE_IDS,
  DimensionalSpaceSchema,
  StyleProvider,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  resolveArtWorld,
  resolveStyleMaterial3D,
  resolveStyleOptics,
  resolveStudioStyle,
  useStudioStyle,
  withStyleColorAlpha,
  type DimensionalSpace,
  type StylePreset,
} from '../style';

export const StyleLabSchema = z.object({
  space: DimensionalSpaceSchema.describe(
    'Space :: Dimensional Space (2D / 2.5D / 3D)'
  ),
  styleId: z
    .enum(BUILT_IN_STYLE_IDS)
    .describe('Style :: Art Direction Preset'),
  headline: z.string().min(1).describe('Copy :: Specimen Headline'),
  subtitle: z.string().describe('Copy :: Specimen Subtitle'),
  accentOverride: zColor().optional(),
});

export type StyleLabProps = z.infer<typeof StyleLabSchema>;

export const DEFAULT_STYLE_LAB_PROPS: StyleLabProps = {
  space: '2d',
  styleId: 'editorial-press',
  headline: 'Editorial Craft in Motion',
  subtitle:
    'Preview 2D, 2.5D, and 3D art-direction presets live inside Remotion Studio.',
};

const SPACE_LABELS: Record<DimensionalSpace, string> = {
  '2d': '2D VECTOR & EDITORIAL',
  '2.5d': '2.5D PAPER DIORAMA',
  '3d': '3D MATERIAL & STUDIO',
};

const Specimen2D: React.FC<{
  headline: string;
  subtitle: string;
  style: StylePreset;
}> = ({ headline, subtitle, style }) => {
  const barItems = useMemo(
    () => [
      {
        id: 'primary',
        label: 'Primary Focus',
        value: 92,
        keyframes: [
          { frame: 10, value: 64 },
          { frame: 90, value: 92 },
        ],
      },
      {
        id: 'secondary',
        label: 'Secondary Cadence',
        value: 74,
        keyframes: [
          { frame: 10, value: 78 },
          { frame: 90, value: 74 },
        ],
      },
      {
        id: 'baseline',
        label: 'Ambient Floor',
        value: 48,
        keyframes: [
          { frame: 10, value: 42 },
          { frame: 90, value: 48 },
        ],
      },
    ],
    []
  );

  return (
    <div
      data-style-lab-specimen="2d"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.05fr 1fr',
        gap: 36,
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <EditorialMediaCard
        caption={headline}
        sourceTag={style.name}
        startFrame={4}
        durationInFrames={240}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          boxSizing: 'border-box',
        }}
      >
        <StoryCard2D
          title={style.name}
          subtitle={subtitle}
          badge={style.typography.displayFont}
          startFrame={6}
          compact
        />
        <AnimatedBarRace
          title="Motion & Contrast Scale"
          items={barItems}
          valueSuffix="%"
          maxItems={3}
          startFrame={8}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};

const Specimen25D: React.FC<{
  headline: string;
  subtitle: string;
  style: StylePreset;
}> = ({ headline, subtitle, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const optics = resolveStyleOptics(style);
  const enter = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const sway = Math.sin(frame / 42) * 3.5;
  const tiltY = interpolate(enter, [0, 1], [-12, -5]) + sway * 0.45;
  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
    <div
      data-style-lab-specimen="2.5d"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.15fr 0.85fr',
        gap: 36,
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Multi-plane tactile paper diorama preview (CSS 3D perspective — zero Three.js) */}
      <div
        style={{
          position: 'relative',
          height: 540,
          perspective: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Plane Z=-2: Sky & horizon backdrop cutout */}
        <div
          style={{
            position: 'absolute',
            inset: '26px 46px 54px 18px',
            borderRadius: Math.max(8, Math.round(18 * style.surface.radiusScale)),
            background: `linear-gradient(155deg, ${style.palette.bgElevated} 0%, ${style.palette.bgSurface} 100%)`,
            border: `4px solid ${style.surface.isDark ? style.palette.inkBorder : '#FFFDF8'}`,
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
            transform: `rotateY(${tiltY.toFixed(2)}deg) rotateX(4deg) translateZ(-48px) translateX(${(-sway * 1.4).toFixed(2)}px)`,
            opacity: enter,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 640 420"
            preserveAspectRatio="xMidYMid slice"
          >
            <circle
              cx="490"
              cy="120"
              r="72"
              fill={style.palette.accentPrimary}
              opacity="0.22"
            />
            <circle
              cx="490"
              cy="120"
              r="42"
              fill={style.palette.accentPrimary}
              opacity="0.82"
            />
            <path
              d="M 0 300 Q 170 210 340 278 T 640 244 L 640 420 L 0 420 Z"
              fill={style.palette.accentSecondary}
              opacity="0.34"
            />
            <path
              d="M 0 348 Q 210 270 410 322 T 640 302 L 640 420 L 0 420 Z"
              fill={style.palette.accentPrimary}
              opacity="0.48"
            />
          </svg>
        </div>

        {/* Plane Z=0: Mid-ground die-cut foreground card */}
        <div
          style={{
            position: 'relative',
            width: '78%',
            padding: '32px 36px',
            borderRadius: Math.max(6, Math.round(16 * style.surface.radiusScale)),
            backgroundColor: style.palette.bgSurface,
            border: `6px solid ${style.surface.isDark ? style.palette.inkBorder : '#FFFDF8'}`,
            boxShadow: `0 28px 56px rgba(15, 23, 42, 0.24), 0 0 0 1.5px ${style.palette.inkBorder}`,
            transform: `rotateY(${(tiltY * 0.7).toFixed(2)}deg) rotateX(2deg) translateY(${interpolate(enter, [0, 1], [28, 0]).toFixed(2)}px) translateX(${(sway * 1.2).toFixed(2)}px)`,
            opacity: enter,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: style.palette.accentPrimary,
            }}
          >
            Z-PLANE DEPTH · {optics.lightingRig.toUpperCase()}
          </span>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 34,
              fontWeight: 700,
              lineHeight: 1.15,
              color: style.palette.textPrimary,
            }}
          >
            {formatHeadingText(headline, style)}
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 20,
              lineHeight: 1.4,
              color: style.palette.textSecondary,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Plane Z=+1: Foreground accent badge cutout */}
        <div
          style={{
            position: 'absolute',
            right: 28,
            bottom: 34,
            padding: '14px 22px',
            borderRadius: Math.max(6, Math.round(14 * style.surface.radiusScale)),
            backgroundColor: style.palette.accentPrimary,
            color: '#FFFFFF',
            border: '4px solid #FFFDF8',
            boxShadow: '0 18px 34px rgba(15, 23, 42, 0.28)',
            fontFamily: monoFont,
            fontSize: 19,
            fontWeight: 700,
            transform: `rotate(-2.2deg) translateX(${(sway * 2.2).toFixed(2)}px)`,
            opacity: enter,
            boxSizing: 'border-box',
          }}
        >
          DIE-CUT · 3 PLANES
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxSizing: 'border-box',
        }}
      >
        <StoryCard2D
          title="Layered Paper Depth"
          subtitle="Tactile die-cut silhouettes with seeded grain and directional shadows."
          badge="2.5D CRAFT"
          startFrame={6}
        />
        <div
          style={getCardChromeStyle(style, {
            position: 'relative',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          })}
        >
          <ClippedSurfaceChrome
            topBarHeight={3}
            topBarColor={style.palette.accentSecondary}
            specularRim={!style.surface.isDark}
          />
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              color: style.palette.textSecondary,
            }}
          >
            OPTICS & MOTION
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 20,
              color: style.palette.textPrimary,
              lineHeight: 1.45,
            }}
          >
            Profile: <strong>{style.motion.profile}</strong> · Light angle:{' '}
            <strong>{optics.lightAngleDeg}°</strong> · Aperture:{' '}
            <strong>{optics.aperture.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

const Specimen3D: React.FC<{
  headline: string;
  subtitle: string;
  style: StylePreset;
}> = ({ headline, subtitle, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const material3d = resolveStyleMaterial3D(style);
  const enter = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const orbitAngle = (frame / 90) * Math.PI * 2;
  const specX = 36 + Math.cos(orbitAngle) * 10;
  const specY = 30 + Math.sin(orbitAngle) * 6;
  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const isGlass = material3d.finish === 'frosted-glass';
  const isVoxel = material3d.finish === 'retro-voxel';
  const bevelPct = Math.round(material3d.bevelRadius * 100);

  return (
    <div
      data-style-lab-specimen="3d"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: 36,
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Pure SVG/CSS Material & Studio HDR Preview — zero Three.js top-level dependency */}
      <div
        style={getCardChromeStyle(style, {
          position: 'relative',
          height: 540,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [24, 0]).toFixed(2)}px)`,
        })}
      >
        <ClippedSurfaceChrome
          topBarHeight={4}
          topBarColor={style.palette.accentPrimary}
          specularRim={!style.surface.isDark}
        />

        <svg
          width="460"
          height="340"
          viewBox="0 0 460 340"
          style={{ position: 'relative', zIndex: 1, display: 'block' }}
        >
          <defs>
            <radialGradient
              id="style-lab-3d-sphere"
              cx={`${specX.toFixed(1)}%`}
              cy={`${specY.toFixed(1)}%`}
              r="65%"
            >
              <stop
                offset="0%"
                stopColor={isGlass ? '#FFFFFF' : style.palette.bgSurface}
                stopOpacity={isGlass ? 0.96 : 0.85}
              />
              <stop
                offset="48%"
                stopColor={style.palette.accentPrimary}
                stopOpacity={isGlass ? 0.72 : 0.96}
              />
              <stop
                offset="100%"
                stopColor={style.palette.accentSecondary}
                stopOpacity={0.95}
              />
            </radialGradient>
            <linearGradient id="style-lab-3d-plinth" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={style.palette.bgSurface} />
              <stop offset="100%" stopColor={style.palette.bgElevated} />
            </linearGradient>
          </defs>

          {/* Studio softbox halo */}
          <ellipse
            cx="230"
            cy="272"
            rx="168"
            ry="34"
            fill={style.palette.textPrimary}
            opacity={style.surface.isDark ? 0.36 : 0.14}
          />

          {/* Isometric studio plinth */}
          <polygon
            points="230,214 384,258 230,302 76,258"
            fill="url(#style-lab-3d-plinth)"
            stroke={style.palette.inkBorder}
            strokeWidth="2"
          />

          {/* Primary 3D material solid */}
          {isVoxel ? (
            <g>
              <rect
                x="156"
                y="78"
                width="148"
                height="148"
                rx={Math.round(material3d.bevelRadius * 120)}
                fill="url(#style-lab-3d-sphere)"
                stroke={style.palette.inkBorder}
                strokeWidth="3"
              />
              <rect
                x="184"
                y="106"
                width="92"
                height="92"
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity="0.45"
                strokeWidth="2"
              />
            </g>
          ) : (
            <circle
              cx="230"
              cy="148"
              r="92"
              fill="url(#style-lab-3d-sphere)"
              stroke={isGlass ? '#FFFFFF' : style.palette.inkBorder}
              strokeOpacity={isGlass ? 0.75 : 0.35}
              strokeWidth={isGlass ? 2.5 : 1.5}
            />
          )}

          {/* Secondary orbital accent bead */}
          <circle
            cx={230 + Math.cos(orbitAngle) * 128}
            cy={158 + Math.sin(orbitAngle) * 32}
            r="22"
            fill={style.palette.accentSecondary}
            stroke={style.palette.bgSurface}
            strokeWidth="3"
          />
        </svg>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 700,
            color: style.palette.textSecondary,
          }}
        >
          <span>FINISH: {material3d.finish.toUpperCase()}</span>
          <span>·</span>
          <span>HDR: {material3d.studioHdr.toUpperCase()}</span>
          <span>·</span>
          <span>BEVEL: {bevelPct}%</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxSizing: 'border-box',
        }}
      >
        <StoryCard2D
          title={headline}
          subtitle={subtitle}
          badge={material3d.finish.toUpperCase()}
          startFrame={6}
        />
        <div
          style={getCardChromeStyle(style, {
            position: 'relative',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          })}
        >
          <ClippedSurfaceChrome
            topBarHeight={3}
            topBarColor={style.palette.accentPrimary}
            specularRim={!style.surface.isDark}
          />
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 24,
              fontWeight: 700,
              color: style.palette.textPrimary,
            }}
          >
            3D Palette & Material Token
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 19,
              lineHeight: 1.45,
              color: style.palette.textSecondary,
            }}
          >
            Pair with <code style={{ fontFamily: monoFont }}>@make-pictures/remotion/kits/isometric-3d</code> or{' '}
            <code style={{ fontFamily: monoFont }}>tactile-3d</code> for full WebGL lighting.
          </div>
        </div>
      </div>
    </div>
  );
};

const StyleLabInner: React.FC<{
  space: DimensionalSpace;
  headline: string;
  subtitle: string;
}> = ({ space, headline, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();

  // Clean Frame 0 invariant: background canvas only at frame <= 0
  if (frame <= 0) {
    return null;
  }

  const enter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const translateY = interpolate(enter, [0, 1], [18, 0]);
  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');
  const artWorld = resolveArtWorld(style);

  const swatches = [
    { label: 'Canvas', color: style.palette.bgCanvas },
    { label: 'Surface', color: style.palette.bgSurface },
    { label: 'Accent', color: style.palette.accentPrimary },
    { label: 'Secondary', color: style.palette.accentSecondary },
    { label: 'Ink', color: style.palette.textPrimary },
  ];

  return (
    <AbsoluteFill
      style={{
        padding: '54px 76px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 34,
        boxSizing: 'border-box',
        opacity: enter,
        transform: `translateY(${translateY.toFixed(2)}px)`,
      }}
    >
      {/* Top Art-Direction Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 32,
          paddingBottom: 20,
          borderBottom: `1.5px solid ${style.palette.inkBorder}`,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxWidth: 1120,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: style.palette.accentPrimary,
            }}
          >
            <span
              style={{
                padding: '4px 12px',
                backgroundColor: withStyleColorAlpha(style.palette.accentPrimary, 0.14),
                border: `1.5px solid ${style.palette.accentPrimary}`,
                borderRadius: Math.max(0, Math.round(6 * style.surface.radiusScale)),
              }}
            >
              {SPACE_LABELS[space]}
            </span>
            <span style={{ color: style.palette.textSecondary }}>
              {style.id} · {artWorld}
            </span>
          </div>

          <div
            style={{
              fontFamily: displayFont,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: `${style.typography.displayTrackingEm}em`,
              color: style.palette.textPrimary,
            }}
          >
            {formatHeadingText(headline, style)}
          </div>

          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 22,
              lineHeight: 1.38,
              color: style.palette.textSecondary,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Palette Swatches */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {swatches.map((swatch) => (
            <div
              key={swatch.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: Math.max(4, Math.round(10 * style.surface.radiusScale)),
                  backgroundColor: swatch.color,
                  border: `1.5px solid ${style.palette.inkBorder}`,
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
                  boxSizing: 'border-box',
                }}
              />
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 18,
                  color: style.palette.textSecondary,
                }}
              >
                {swatch.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Dimensional Space Specimen */}
      {space === '2d' ? (
        <Specimen2D headline={headline} subtitle={subtitle} style={style} />
      ) : space === '2.5d' ? (
        <Specimen25D headline={headline} subtitle={subtitle} style={style} />
      ) : (
        <Specimen3D headline={headline} subtitle={subtitle} style={style} />
      )}
    </AbsoluteFill>
  );
};

export const StyleLabComposition: React.FC<StyleLabProps> = ({
  space = DEFAULT_STYLE_LAB_PROPS.space,
  styleId = DEFAULT_STYLE_LAB_PROPS.styleId,
  headline = DEFAULT_STYLE_LAB_PROPS.headline,
  subtitle = DEFAULT_STYLE_LAB_PROPS.subtitle,
  accentOverride,
}) => {
  const effectiveStyle = useMemo<StylePreset>(() => {
    const base = resolveStudioStyle(styleId);
    if (!accentOverride || !accentOverride.trim()) {
      return base;
    }
    return {
      ...base,
      palette: {
        ...base.palette,
        accentPrimary: accentOverride.trim(),
      },
    };
  }, [styleId, accentOverride]);

  return (
    <StyleProvider style={effectiveStyle} renderBackdrop>
      <StyleLabInner space={space} headline={headline} subtitle={subtitle} />
    </StyleProvider>
  );
};
