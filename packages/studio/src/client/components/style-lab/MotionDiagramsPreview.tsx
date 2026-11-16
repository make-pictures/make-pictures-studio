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
  computeCircleOfConfusionPx,
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

export const MotionDiagramsPreview: React.FC = () => {
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
