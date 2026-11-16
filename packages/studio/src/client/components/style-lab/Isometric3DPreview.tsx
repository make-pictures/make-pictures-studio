import React, { useMemo } from 'react';
import {
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  ClippedSurfaceChrome,
  DepthPlane,
  OpticalStage2D,
  computeCircleOfConfusionPx,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  resolveArtWorld,
  resolveStyleMaterial3D,
  resolveStyleOptics,
  useStudioStyle,
  type ArtWorld,
  type OpticalShot2D,
} from '@make-pictures/core';
import { getSafeStageBounds } from './styleLabTypes';

export const Isometric3DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const optics = resolveStyleOptics(style);
  const artWorld = resolveArtWorld(style);
  const material3d = resolveStyleMaterial3D(style);
  const bounds = getSafeStageBounds(width, height);

  if (frame <= 0) {
    return null;
  }

  const isPodcastClayPreview =
    material3d.finish === 'soft-clay' ||
    style.id === 'soft-clay' ||
    style.id === 'glass-studio' ||
    style.id === 'retro-pc';

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
    isoMaterial === 'anodized-telemetry'
      ? style.palette.bgElevated
      : style.palette.bgSurface;
  const strokeInk = style.palette.inkBorder;
  const strokeWidth = isoMaterial === 'ink-figurine' ? 3 : 1.8;

  const renderMaquetteFigure = (
    cx: number,
    cy: number,
    primary: string,
    secondary: string,
    isSpeaking: boolean,
    breath: number,
    speakerIdx: 0 | 1 = 0
  ) => {
    const blurPx = isSpeaking
      ? 0
      : computeCircleOfConfusionPx(-0.18, 0, optics.aperture);
    const filterCss = blurPx < 0.25 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;
    const headTiltDeg = (isSpeaking ? 2.2 : -1.2) + breath * 1.4;

    if (isPodcastClayPreview) {
      const blinkCycle = (frame + (speakerIdx === 0 ? 28 : 112)) % 192;
      const blinkClose =
        blinkCycle > 12
          ? 0
          : blinkCycle <= 6
            ? blinkCycle / 6
            : (12 - blinkCycle) / 6;
      const eyeOpenScale = Math.max(0.12, 1 - blinkClose * 0.88);
      const isVoxel = material3d.finish === 'retro-voxel';
      const headRx = isVoxel ? 8 : 26;
      const torsoRx = isVoxel ? 6 : 22;
      const clayHeadFill =
        material3d.finish === 'soft-clay' && !style.surface.isDark
          ? '#FDE8D7'
          : bodyFill;
      const browLift = isSpeaking ? -2.2 - syllableMod * 1.6 : 0;

      return (
        <g
          data-clay-avatar="true"
          data-clay-finish={material3d.finish}
          transform={`translate(${cx}, ${cy})`}
          style={{ filter: filterCss, opacity: isSpeaking ? 1 : 0.84 }}
        >
          {/* Ground Contact Shadow Ellipse */}
          <ellipse
            cx={0}
            cy={76}
            rx={54}
            ry={16}
            fill="#0F172A"
            opacity={style.surface.isDark ? 0.54 : 0.22}
          />
          {/* Calibrated Speaker Plinth Ring */}
          <ellipse
            cx={0}
            cy={76}
            rx={58}
            ry={17}
            fill="none"
            stroke={isSpeaking ? primary : strokeInk}
            strokeWidth={isSpeaking ? 2.6 : 1.4}
            opacity={isSpeaking ? 0.92 : 0.45}
          />

          {/* Rounded Soft-Clay Sweater Torso + Softbox Rim Highlight */}
          <rect
            x={-34}
            y={-18}
            width={68}
            height={86}
            rx={torsoRx}
            fill={primary}
            stroke={strokeInk}
            strokeWidth={strokeWidth}
          />
          <rect
            x={-25}
            y={-11}
            width={16}
            height={46}
            rx={isVoxel ? 2 : 8}
            fill="#FFFFFF"
            opacity={style.surface.isDark ? 0.16 : 0.28}
          />
          {/* Cozy Knit Collar Rim */}
          <rect
            x={-18}
            y={-18}
            width={36}
            height={11}
            rx={isVoxel ? 2 : 5.5}
            fill={clayHeadFill}
            stroke={strokeInk}
            strokeWidth={1.4}
          />

          {/* Sculpted Rounded Clay Head + Headphones + 3D Eyes */}
          <g transform={`translate(0, -54) rotate(${headTiltDeg.toFixed(2)})`}>
            {/* Over-Ear Studio Headphones Band + Cups */}
            <g data-clay-headphones="true">
              <path
                d="M -31,-4 A 31,28 0 0,1 31,-4"
                fill="none"
                stroke={secondary}
                strokeWidth={5.5}
                strokeLinecap="round"
              />
              <rect
                x={-37}
                y={-12}
                width={10}
                height={22}
                rx={isVoxel ? 2 : 5}
                fill={secondary}
                stroke={strokeInk}
                strokeWidth={1.4}
              />
              <rect
                x={27}
                y={-12}
                width={10}
                height={22}
                rx={isVoxel ? 2 : 5}
                fill={secondary}
                stroke={strokeInk}
                strokeWidth={1.4}
              />
            </g>

            {/* Soft-Clay Head */}
            <rect
              x={-30}
              y={-29}
              width={60}
              height={56}
              rx={headRx}
              fill={clayHeadFill}
              stroke={strokeInk}
              strokeWidth={strokeWidth}
            />
            {/* Sculpted Hair Bangs / Crown Cap */}
            <path
              d="M -26,-16 Q 0,-34 26,-16 Q 14,-22 -4,-20 Q -18,-19 -26,-16 Z"
              fill={style.palette.textPrimary}
              opacity={0.86}
            />

            {/* Rosy Clay Cheeks */}
            <circle cx={-18} cy={6} r={5.2} fill={primary} opacity={0.28} />
            <circle cx={18} cy={6} r={5.2} fill={primary} opacity={0.28} />

            {/* Expressive 3D Eyes with Sclera, Iris, Pupil, Catchlight & Blink */}
            {([-11, 11] as const).map((ex) => (
              <g key={ex} transform={`translate(${ex}, -5)`}>
                <rect
                  x={-6}
                  y={-11 + browLift}
                  width={12}
                  height={3}
                  rx={1.5}
                  fill={style.palette.textPrimary}
                  opacity={0.85}
                />
                <g transform={`scale(1, ${eyeOpenScale.toFixed(3)})`}>
                  <circle
                    cx={0}
                    cy={0}
                    r={5.8}
                    fill="#FFFFFF"
                    stroke={strokeInk}
                    strokeWidth={1}
                  />
                  <circle cx={0.4} cy={0.3} r={3.5} fill={secondary} />
                  <circle cx={0.5} cy={0.3} r={1.9} fill="#0F172A" />
                  <circle cx={-1.4} cy={-1.6} r={1.3} fill="#FFFFFF" />
                </g>
              </g>
            ))}

            {/* Sculpted Button Nose */}
            <ellipse
              cx={0}
              cy={2.5}
              rx={3.4}
              ry={2.4}
              fill={primary}
              opacity={0.42}
            />

            {/* Speech-Reactive Rounded Mouth */}
            <rect
              x={-7.5}
              y={9.5}
              width={15}
              height={isSpeaking ? 3.5 + syllableMod * 5.5 : 2.8}
              rx={isVoxel ? 1.5 : 4}
              fill={style.palette.textPrimary}
              opacity={isSpeaking ? 0.9 : 0.55}
            />
          </g>
        </g>
      );
    }

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
              <rect
                x={-12}
                y={-6}
                width={6}
                height={4}
                fill={style.palette.bgSurface}
              />
              <rect
                x={6}
                y={-6}
                width={6}
                height={4}
                fill={style.palette.bgSurface}
              />
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

  const renderPodcastStudioOverlay = () => {
    if (!isPodcastClayPreview) return null;
    const onAirGlow =
      style.id === 'retro-pc' ? style.palette.accentSecondary : '#EF4444';
    return (
      <g data-podcast-studio="true">
        {/* Glowing ON AIR Studio Plaque */}
        <g data-on-air-badge="true" transform="translate(360, 48)">
          <rect
            x={-54}
            y={-18}
            width={108}
            height={34}
            rx={11}
            fill={onAirGlow}
            opacity={0.22}
          />
          <rect
            x={-46}
            y={-13}
            width={92}
            height={24}
            rx={7}
            fill="#18181B"
            stroke={onAirGlow}
            strokeWidth={1.8}
          />
          <circle cx={-31} cy={-1} r={4} fill={onAirGlow} />
          <text
            x={6}
            y={3}
            textAnchor="middle"
            fill="#FFFDF9"
            fontFamily={monoFont}
            fontSize={11}
            fontWeight={800}
            letterSpacing="0.12em"
          >
            ON AIR
          </text>
        </g>

        {/* Articulated Boom-Arm Studio Microphones & Ceramic Mugs */}
        <g data-podcast-mics="true">
          {/* Left Speaker Boom Mic */}
          <polyline
            points="318,156 292,126 272,134"
            fill="none"
            stroke={style.palette.textPrimary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x={263}
            y={128}
            width={11}
            height={16}
            rx={5}
            fill={style.palette.accentPrimary}
            stroke={strokeInk}
            strokeWidth={1.3}
          />
          {/* Right Speaker Boom Mic */}
          <polyline
            points="402,156 428,126 448,134"
            fill="none"
            stroke={style.palette.textPrimary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x={446}
            y={128}
            width={11}
            height={16}
            rx={5}
            fill={style.palette.accentSecondary}
            stroke={strokeInk}
            strokeWidth={1.3}
          />
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
            {renderPodcastStudioOverlay()}

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
                stroke={t.isMajor ? style.palette.accentPrimary : strokeInk}
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
              breathA,
              0
            )}
            {renderMaquetteFigure(
              485,
              152,
              style.palette.accentSecondary,
              style.palette.accentPrimary,
              !speakerASpeaking,
              breathB,
              1
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
