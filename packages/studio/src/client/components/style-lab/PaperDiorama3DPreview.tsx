import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  CINEMATIC_SPRINGS,
  ClippedSurfaceChrome,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveArtWorld,
  useStudioStyle,
} from '@make-pictures/core';
import { getSafeStageBounds } from './styleLabTypes';

export const PaperDiorama3DPreview: React.FC = () => {
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
