import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ClippedSurfaceChrome,
  formatFontFamilyCss,
  formatHeadingText,
  getStyleSpringConfig,
  getTactileSurfaceStyle,
  useStudioStyle,
} from '@make-pictures/core';
import {
  portBottom,
  portLeft,
  portRight,
  portTop,
  type NodeBox,
} from './NodeBox';

export interface RetroPcHopSpec {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  latencyMs: number;
  icon?: 'browser' | 'directory' | 'server' | 'check';
}

export interface RetroPcWindowStage2DProps {
  windowTitle: string;
  addressLabel: string;
  hops: ReadonlyArray<RetroPcHopSpec>;
  statusBanner: string;
  progress: number;
  isVertical?: boolean;
  enterFrame?: number;
  /** Chrome label language (`'pl'` or `'en'`; auto-inferred when omitted, explicit `lang` takes precedence) */
  lang?: 'pl' | 'en';
  style?: React.CSSProperties;
}

function resolveRetroPcLang(
  explicitLang: 'pl' | 'en' | undefined,
  windowTitle: string,
  addressLabel: string,
  statusBanner: string,
  hops: ReadonlyArray<RetroPcHopSpec>
): 'pl' | 'en' {
  if (explicitLang === 'pl' || explicitLang === 'en') {
    return explicitLang;
  }
  const corpus = [
    windowTitle,
    addressLabel,
    statusBanner,
    ...hops.flatMap((h) => [h.title, h.subtitle, h.badge]),
  ].join(' ');
  if (
    /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(corpus) ||
    /\b(twoja|serwer|strona|gotowa|zapytanie|widok|krok|adres|sieciowego|pakiet)\b/i.test(
      corpus
    )
  ) {
    return 'pl';
  }
  if (
    /\b(the|your|browser|network|packet|inspector|ready|page|request|route|server|origin|live|step|lookup)\b/i.test(
      corpus
    )
  ) {
    return 'en';
  }
  return 'pl';
}

export interface RetroPcWindowLayout {
  isVertical: boolean;
  windowLeft: number;
  windowTop: number;
  windowWidth: number;
  windowHeight: number;
  titlebarHeight: number;
  addressBarHeight: number;
  statusBarHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  hopBoxes: NodeBox[];
}

export function computeRetroPcWindowLayout(options: {
  viewportWidth: number;
  viewportHeight: number;
  isVertical?: boolean;
  hopCount: number;
}): RetroPcWindowLayout {
  const { viewportWidth, viewportHeight, hopCount } = options;
  const resolvedVertical =
    options.isVertical ?? viewportHeight > viewportWidth;
  const safeCount = Math.max(1, hopCount);

  if (resolvedVertical) {
    // Strictly inside 9:16 Golden Safe Box: x in [40, 910], y in [220, 1380]
    const windowLeft = 64;
    const windowWidth = Math.min(816, Math.max(420, 910 - windowLeft - 30));
    const windowTop = 232;
    const windowHeight = 1136;
    const titlebarHeight = 46;
    const addressBarHeight = 56;
    const statusBarHeight = 60;
    const bodyWidth = windowWidth;
    const bodyHeight =
      windowHeight - titlebarHeight - addressBarHeight - statusBarHeight;

    const cardW = Math.min(668, bodyWidth - 112);
    const cx = Math.round(bodyWidth * 0.5);

    if (safeCount === 1) {
      return {
        isVertical: true,
        windowLeft,
        windowTop,
        windowWidth,
        windowHeight,
        titlebarHeight,
        addressBarHeight,
        statusBarHeight,
        bodyWidth,
        bodyHeight,
        hopBoxes: [{ cx, cy: Math.round(bodyHeight * 0.5), w: cardW, h: 212 }],
      };
    }

    const verticalPad = 24;
    const minGapY = 68;
    const maxCardH = 204;
    const rawCardH = Math.floor(
      (bodyHeight - verticalPad * 2 - (safeCount - 1) * minGapY) / safeCount
    );
    const cardH = Math.max(168, Math.min(maxCardH, rawCardH));
    const gapY = Math.floor(
      (bodyHeight - verticalPad * 2 - safeCount * cardH) / (safeCount - 1)
    );
    const totalStackH = safeCount * cardH + (safeCount - 1) * gapY;
    const startTopY = Math.round((bodyHeight - totalStackH) * 0.5);

    const hopBoxes: NodeBox[] = [];
    for (let i = 0; i < safeCount; i++) {
      hopBoxes.push({
        cx,
        cy: Math.round(startTopY + i * (cardH + gapY) + cardH * 0.5),
        w: cardW,
        h: cardH,
      });
    }

    return {
      isVertical: true,
      windowLeft,
      windowTop,
      windowWidth,
      windowHeight,
      titlebarHeight,
      addressBarHeight,
      statusBarHeight,
      bodyWidth,
      bodyHeight,
      hopBoxes,
    };
  }

  // 16:9 horizontal CRT desktop window layout
  const windowWidth = Math.min(1520, Math.max(960, viewportWidth - 160));
  const windowHeight = Math.min(752, Math.max(540, viewportHeight - 220));
  const windowLeft = Math.round((viewportWidth - windowWidth) * 0.5);
  const windowTop = Math.round((viewportHeight - windowHeight) * 0.5) + 16;
  const titlebarHeight = 48;
  const addressBarHeight = 58;
  const statusBarHeight = 60;
  const bodyWidth = windowWidth;
  const bodyHeight =
    windowHeight - titlebarHeight - addressBarHeight - statusBarHeight;
  const cy = Math.round(bodyHeight * 0.5);

  if (safeCount === 1) {
    return {
      isVertical: false,
      windowLeft,
      windowTop,
      windowWidth,
      windowHeight,
      titlebarHeight,
      addressBarHeight,
      statusBarHeight,
      bodyWidth,
      bodyHeight,
      hopBoxes: [{ cx: Math.round(bodyWidth * 0.5), cy, w: 420, h: 256 }],
    };
  }

  const horizMargin = 68;
  const usableW = bodyWidth - horizMargin * 2;
  const minGapX = 148;
  const rawCardW = Math.floor(
    (usableW - (safeCount - 1) * minGapX) / safeCount
  );
  const cardW = Math.max(240, Math.min(368, rawCardW));
  const gapX = Math.floor((usableW - safeCount * cardW) / (safeCount - 1));
  const totalRowW = safeCount * cardW + (safeCount - 1) * gapX;
  const startLeftX = Math.round((bodyWidth - totalRowW) * 0.5);
  const cardH = Math.min(258, bodyHeight - 140);

  const hopBoxes: NodeBox[] = [];
  for (let i = 0; i < safeCount; i++) {
    hopBoxes.push({
      cx: Math.round(startLeftX + i * (cardW + gapX) + cardW * 0.5),
      cy,
      w: cardW,
      h: cardH,
    });
  }

  return {
    isVertical: false,
    windowLeft,
    windowTop,
    windowWidth,
    windowHeight,
    titlebarHeight,
    addressBarHeight,
    statusBarHeight,
    bodyWidth,
    bodyHeight,
    hopBoxes,
  };
}

function resolveDefaultHopIcon(
  index: number,
  total: number
): NonNullable<RetroPcHopSpec['icon']> {
  if (index === 0) return 'browser';
  if (index === total - 1) return 'server';
  return 'directory';
}

const RetroHopPixelGlyph: React.FC<{
  kind: NonNullable<RetroPcHopSpec['icon']>;
  strokeColor: string;
  accentColor: string;
}> = ({ kind, strokeColor, accentColor }) => {
  if (kind === 'browser') {
    return (
      <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x={3}
          y={4}
          width={18}
          height={14}
          rx={1.5}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.8}
        />
        <line
          x1={3}
          y1={8.5}
          x2={21}
          y2={8.5}
          stroke={strokeColor}
          strokeWidth={1.6}
        />
        <rect x={5.5} y={5.6} width={1.8} height={1.8} fill={accentColor} />
        <rect x={8.5} y={5.6} width={1.8} height={1.8} fill={strokeColor} />
        <path
          d="M 8 20 H 16 M 12 18 V 20"
          stroke={strokeColor}
          strokeWidth={1.8}
          strokeLinecap="square"
        />
        <path
          d="M 7.5 12.5 L 10.5 14 L 9 15.8 Z"
          fill={accentColor}
        />
      </svg>
    );
  }

  if (kind === 'directory') {
    return (
      <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M 3.5 6.5 H 9.5 L 11.5 8.5 H 20.5 V 18.5 H 3.5 Z"
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.8}
          strokeLinejoin="miter"
        />
        <line
          x1={7}
          y1={12}
          x2={17}
          y2={12}
          stroke={accentColor}
          strokeWidth={1.8}
        />
        <line
          x1={7}
          y1={15.2}
          x2={14}
          y2={15.2}
          stroke={strokeColor}
          strokeWidth={1.6}
        />
      </svg>
    );
  }

  if (kind === 'check') {
    return (
      <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x={3.5}
          y={3.5}
          width={17}
          height={17}
          rx={2}
          fill="none"
          stroke={accentColor}
          strokeWidth={1.8}
        />
        <path
          d="M 7.5 12.4 L 10.6 15.5 L 16.8 8.8"
          fill="none"
          stroke={accentColor}
          strokeWidth={2.2}
          strokeLinecap="square"
        />
      </svg>
    );
  }

  // 'server'
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x={4}
        y={4}
        width={16}
        height={6.5}
        rx={1.2}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.8}
      />
      <rect
        x={4}
        y={13.5}
        width={16}
        height={6.5}
        rx={1.2}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.8}
      />
      <rect x={6.8} y={6.4} width={2} height={2} fill={accentColor} />
      <rect x={6.8} y={15.8} width={2} height={2} fill={accentColor} />
      <line
        x1={11.5}
        y1={7.4}
        x2={17}
        y2={7.4}
        stroke={strokeColor}
        strokeWidth={1.6}
      />
      <line
        x1={11.5}
        y1={16.8}
        x2={17}
        y2={16.8}
        stroke={strokeColor}
        strokeWidth={1.6}
      />
    </svg>
  );
};

export const RetroPcWindowStage2D: React.FC<RetroPcWindowStage2DProps> = ({
  windowTitle,
  addressLabel,
  hops,
  statusBanner,
  progress,
  isVertical,
  enterFrame = 2,
  lang,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: viewportWidth, height: viewportHeight } =
    useVideoConfig();
  const studioStyle = useStudioStyle();

  if (frame <= 0) {
    return null;
  }

  const effectiveEnter = Math.max(2, enterFrame);
  if (frame < effectiveEnter) {
    return null;
  }

  const enterProgress = spring({
    frame: frame - effectiveEnter,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });

  if (enterProgress <= 0.002) {
    return null;
  }

  const resolvedLang = resolveRetroPcLang(
    lang,
    windowTitle,
    addressLabel,
    statusBanner,
    hops
  );

  const layout = computeRetroPcWindowLayout({
    viewportWidth,
    viewportHeight,
    isVertical,
    hopCount: hops.length,
  });

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const isResponseComplete = clampedProgress >= 0.82;
  const travelProgress = Math.max(0, Math.min(1, clampedProgress / 0.86));

  const { palette, surface, typography } = studioStyle;
  const isDark = surface.isDark;
  const accentPrimary = palette.accentPrimary;
  const phosphorColor = palette.accentSecondary;
  const inkBorder = palette.inkBorder;
  const textPrimary = palette.textPrimary;
  const textSecondary = palette.textSecondary;

  const displayFontCss = formatFontFamilyCss(typography.displayFont, 'display');
  const bodyFontCss = formatFontFamilyCss(typography.bodyFont, 'body');
  const monoFontCss = formatFontFamilyCss(typography.monoFont, 'mono');

  const trimmedAddr = addressLabel.trim();
  const hasLeadingMethod = /^(GET|POST|PUT|HEAD)\s+/i.test(trimmedAddr);
  const methodBadgeText = hasLeadingMethod
    ? trimmedAddr.split(/\s+/)[0]!.toUpperCase()
    : 'GET';
  const symbolicAddressText = hasLeadingMethod
    ? trimmedAddr.replace(/^(GET|POST|PUT|HEAD)\s+/i, '')
    : trimmedAddr;

  const outerRadius = Math.max(
    4,
    Math.min(12, Math.round(8 * surface.radiusScale))
  );
  const cardRadius = Math.max(
    3,
    Math.min(10, Math.round(6 * surface.radiusScale))
  );
  const chipRadius = Math.max(
    2,
    Math.min(5, Math.round(3 * surface.radiusScale))
  );

  const windowScale = interpolate(enterProgress, [0, 1], [0.965, 1]);
  const windowTranslateY = interpolate(enterProgress, [0, 1], [18, 0]);
  const windowOpacity = interpolate(enterProgress, [0, 0.65, 1], [0, 0.96, 1]);

  const outerChrome = getTactileSurfaceStyle(studioStyle, {
    elevation: 'floating',
    overrides: {
      borderRadius: outerRadius,
      border: `2px solid ${inkBorder}`,
      backgroundColor: palette.bgSurface,
    },
  });

  const totalLatencyMs = hops.reduce(
    (sum, hop) => sum + Math.max(0, hop.latencyMs),
    0
  );
  const displayedLatencyMs = Math.round(
    totalLatencyMs * Math.min(1, clampedProgress / 0.86)
  );

  const segCount = Math.max(1, hops.length - 1);
  const segFloat = travelProgress * segCount;
  const activeSegIndex = Math.min(segCount - 1, Math.floor(segFloat));

  // Compute active traveling packet coordinates strictly inside the inter-card rail gap
  const packetOpacity = interpolate(
    clampedProgress,
    [0.01, 0.05, 0.84, 0.93],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  let packetPos: { x: number; y: number } | null = null;
  if (hops.length >= 2 && packetOpacity > 0.01) {
    const segIdx =
      travelProgress >= 1 ? segCount - 1 : Math.max(0, activeSegIndex);
    const localT =
      travelProgress >= 1
        ? 1
        : Math.max(0, Math.min(1, segFloat - segIdx));
    const fromBox = layout.hopBoxes[segIdx]!;
    const toBox = layout.hopBoxes[segIdx + 1]!;
    const pStart = layout.isVertical
      ? portBottom(fromBox)
      : portRight(fromBox);
    const pEnd = layout.isVertical ? portTop(toBox) : portLeft(toBox);
    if (layout.isVertical) {
      const padY = Math.min(18, Math.max(0, (pEnd.y - pStart.y) * 0.25));
      const safeStartY = pStart.y + padY;
      const safeEndY = Math.max(safeStartY, pEnd.y - padY);
      packetPos = {
        x: pStart.x,
        y: safeStartY + (safeEndY - safeStartY) * localT,
      };
    } else {
      const padX = Math.min(50, Math.max(0, (pEnd.x - pStart.x) * 0.34));
      const safeStartX = pStart.x + padX;
      const safeEndX = Math.max(safeStartX, pEnd.x - padX);
      packetPos = {
        x: safeStartX + (safeEndX - safeStartX) * localT,
        y: pStart.y + 26,
      };
    }
  } else if (hops.length === 1 && packetOpacity > 0.01) {
    const onlyBox = layout.hopBoxes[0]!;
    const rightPort = portRight(onlyBox);
    packetPos = { x: rightPort.x + 52, y: rightPort.y };
  }

  const stripeColor = isDark
    ? 'rgba(255, 255, 255, 0.14)'
    : `${inkBorder}38`;
  const scanlineBackground = isDark
    ? 'repeating-linear-gradient(180deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 3px, rgba(0, 0, 0, 0.22) 3px, rgba(0, 0, 0, 0.22) 4px)'
    : 'repeating-linear-gradient(180deg, rgba(15, 23, 42, 0) 0px, rgba(15, 23, 42, 0) 3px, rgba(15, 23, 42, 0.045) 3px, rgba(15, 23, 42, 0.045) 4px)';

  const pixelGridBackground = isDark
    ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(180deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)'
    : 'linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(180deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px)';

  const gaugeSegments = 10;
  const litGaugeCount = Math.round(clampedProgress * gaugeSegments);
  const isWindowSettled =
    Math.abs(windowTranslateY) < 0.25 && Math.abs(windowScale - 1) < 0.0005;
  const windowTransform = isWindowSettled
    ? 'none'
    : `translateY(${windowTranslateY.toFixed(2)}px) scale(${windowScale.toFixed(4)})`;

  return (
    <div
      data-retro-pc-window="true"
      data-retro-layout={layout.isVertical ? 'vertical' : 'horizontal'}
      style={{
        position: 'absolute',
        left: layout.windowLeft,
        top: layout.windowTop,
        width: layout.windowWidth,
        height: layout.windowHeight,
        opacity: windowOpacity,
        transform: windowTransform,
        ...(isWindowSettled ? {} : { willChange: 'transform, opacity' }),
        ...outerChrome,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Clipped CRT Screen Phosphor Vignette, Pixel Grid & Scanlines */}
      <ClippedSurfaceChrome
        topBarHeight={3}
        topBarColor={accentPrimary}
        specularRim={!isDark}
        tintGradient={`radial-gradient(ellipse at 50% 44%, ${accentPrimary}${
          isDark ? '18' : '0E'
        } 0%, transparent 72%)`}
      >
        <div
          data-retro-pixel-grid="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: pixelGridBackground,
            backgroundSize: '24px 24px',
            pointerEvents: 'none',
          }}
        />
        <div
          data-retro-scanlines="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: scanlineBackground,
            pointerEvents: 'none',
          }}
        />
      </ClippedSurfaceChrome>

      {/* Row 1: Classic Striped Late-80s/90s Desktop OS Titlebar */}
      <div
        data-retro-titlebar="true"
        style={{
          position: 'relative',
          zIndex: 2,
          height: layout.titlebarHeight,
          padding: '0 16px',
          backgroundColor: palette.bgElevated,
          borderBottom: `2px solid ${inkBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {/* Classic Square Close Box */}
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 2,
            backgroundColor: palette.bgSurface,
            border: `1.5px solid ${inkBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              border: `1px solid ${textSecondary}`,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Left Classic Pinstripe Wing */}
        <div
          style={{
            flex: 1,
            height: 18,
            backgroundImage: `repeating-linear-gradient(180deg, ${stripeColor} 0px, ${stripeColor} 2px, transparent 2px, transparent 4px)`,
          }}
        />

        {/* Centered Window Title Plaque */}
        <div
          style={{
            padding: '3px 14px',
            backgroundColor: palette.bgElevated,
            border: `1px solid ${inkBorder}`,
            borderRadius: chipRadius,
            fontFamily: displayFontCss,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: textPrimary,
            whiteSpace: 'nowrap',
          }}
        >
          {formatHeadingText(windowTitle, studioStyle)}
        </div>

        {/* Right Classic Pinstripe Wing */}
        <div
          style={{
            flex: 1,
            height: 18,
            backgroundImage: `repeating-linear-gradient(180deg, ${stripeColor} 0px, ${stripeColor} 2px, transparent 2px, transparent 4px)`,
          }}
        />

        {/* Live Tabular Latency Readout + Classic Zoom/Shade Window Boxes */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              padding: '2px 8px',
              borderRadius: chipRadius,
              backgroundColor: palette.bgSurface,
              border: `1px solid ${isResponseComplete ? phosphorColor : inkBorder}`,
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: isResponseComplete ? phosphorColor : accentPrimary,
            }}
          >
            {displayedLatencyMs} ms
          </span>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 2,
              backgroundColor: palette.bgSurface,
              border: `1.5px solid ${inkBorder}`,
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 2,
                top: 2,
                width: 8,
                height: 8,
                borderRight: `1.5px solid ${textSecondary}`,
                borderBottom: `1.5px solid ${textSecondary}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Symbolic GET Address & CRT Progress Bar */}
      <div
        data-retro-address-bar="true"
        style={{
          position: 'relative',
          zIndex: 2,
          height: layout.addressBarHeight,
          padding: '0 20px',
          backgroundColor: palette.bgSurface,
          borderBottom: `1.5px solid ${inkBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
            padding: '6px 12px',
            borderRadius: chipRadius,
            backgroundColor: palette.bgCanvas,
            border: `1.5px solid ${inkBorder}`,
          }}
        >
          <span
            style={{
              padding: '2px 8px',
              borderRadius: chipRadius,
              backgroundColor: `${accentPrimary}22`,
              border: `1px solid ${accentPrimary}`,
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: accentPrimary,
              flexShrink: 0,
            }}
          >
            {methodBadgeText}
          </span>
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 600,
              color: textPrimary,
              letterSpacing: '0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {symbolicAddressText}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 14,
              backgroundColor: isResponseComplete
                ? phosphorColor
                : accentPrimary,
              opacity: isResponseComplete ? 0.9 : 0.72,
              flexShrink: 0,
            }}
          />
        </div>

        {/* Segmented Phosphor Progress Blocks */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: chipRadius,
            backgroundColor: palette.bgCanvas,
            border: `1px solid ${inkBorder}`,
            flexShrink: 0,
          }}
        >
          {Array.from({ length: gaugeSegments }).map((_, idx) => {
            const lit = idx < litGaugeCount;
            return (
              <span
                key={idx}
                style={{
                  width: 7,
                  height: 13,
                  backgroundColor: lit
                    ? isResponseComplete
                      ? phosphorColor
                      : accentPrimary
                    : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : `${inkBorder}40`,
                }}
              />
            );
          })}
          <span
            style={{
              marginLeft: 6,
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: isResponseComplete ? phosphorColor : textSecondary,
              minWidth: 46,
              textAlign: 'right',
            }}
          >
            {Math.round(clampedProgress * 100)}%
          </span>
        </div>
      </div>

      {/* Row 3: CRT Stage Body — Phosphor Packet Rails + Hop Cards */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: layout.bodyWidth,
          height: layout.bodyHeight,
          flexShrink: 0,
        }}
      >
        {/* SVG Glowing Phosphor Packet Rails */}
        <svg
          width={layout.bodyWidth}
          height={layout.bodyHeight}
          viewBox={`0 0 ${layout.bodyWidth} ${layout.bodyHeight}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {hops.slice(0, -1).map((fromHop, segIdx) => {
            const fromBox = layout.hopBoxes[segIdx]!;
            const toBox = layout.hopBoxes[segIdx + 1]!;
            const toHop = hops[segIdx + 1]!;
            const pStart = layout.isVertical
              ? portBottom(fromBox)
              : portRight(fromBox);
            const pEnd = layout.isVertical
              ? portTop(toBox)
              : portLeft(toBox);

            const segFill = Math.max(
              0,
              Math.min(1, travelProgress * segCount - segIdx)
            );
            const litEndX = pStart.x + (pEnd.x - pStart.x) * segFill;
            const litEndY = pStart.y + (pEnd.y - pStart.y) * segFill;
            const midX = (pStart.x + pEnd.x) * 0.5;
            const midY = (pStart.y + pEnd.y) * 0.5;

            return (
              <g
                key={`${fromHop.id}-${toHop.id}`}
                data-retro-rail={segIdx}
              >
                {/* Base Rail Groove */}
                <line
                  x1={pStart.x}
                  y1={pStart.y}
                  x2={pEnd.x}
                  y2={pEnd.y}
                  stroke={isDark ? 'rgba(255, 255, 255, 0.16)' : inkBorder}
                  strokeOpacity={isDark ? 1 : 0.45}
                  strokeWidth={3}
                />
                <line
                  x1={pStart.x}
                  y1={pStart.y}
                  x2={pEnd.x}
                  y2={pEnd.y}
                  stroke={accentPrimary}
                  strokeOpacity={0.28}
                  strokeWidth={1.8}
                  strokeDasharray="6 6"
                />

                {/* Active Glowing Phosphor Beam */}
                {segFill > 0.005 && (
                  <>
                    <line
                      x1={pStart.x}
                      y1={pStart.y}
                      x2={litEndX}
                      y2={litEndY}
                      stroke={phosphorColor}
                      strokeOpacity={isDark ? 0.3 : 0.2}
                      strokeWidth={9}
                      strokeLinecap="square"
                    />
                    <line
                      x1={pStart.x}
                      y1={pStart.y}
                      x2={litEndX}
                      y2={litEndY}
                      stroke={phosphorColor}
                      strokeWidth={3.2}
                      strokeLinecap="square"
                    />
                  </>
                )}

                {/* Square Pixel Port Terminals */}
                <rect
                  x={pStart.x - 4.5}
                  y={pStart.y - 4.5}
                  width={9}
                  height={9}
                  fill={segFill > 0 ? phosphorColor : palette.bgSurface}
                  stroke={segFill > 0 ? phosphorColor : inkBorder}
                  strokeWidth={1.6}
                />
                <rect
                  x={pEnd.x - 4.5}
                  y={pEnd.y - 4.5}
                  width={9}
                  height={9}
                  fill={segFill >= 0.99 ? phosphorColor : palette.bgSurface}
                  stroke={segFill >= 0.99 ? phosphorColor : inkBorder}
                  strokeWidth={1.6}
                />

                {/* Segment Latency Callout (placed >= 28px clear of rail) */}
                <text
                  x={layout.isVertical ? midX + 34 : midX}
                  y={layout.isVertical ? midY + 4 : midY - 26}
                  textAnchor={layout.isVertical ? 'start' : 'middle'}
                  fill={segFill > 0.35 ? phosphorColor : textSecondary}
                  fontFamily={monoFontCss}
                  fontSize={18}
                  fontWeight={700}
                >
                  +{toHop.latencyMs} ms
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hop Cards */}
        {hops.map((hop, idx) => {
          const box = layout.hopBoxes[idx]!;
          const hopThreshold =
            hops.length <= 1 ? 0 : idx / (hops.length - 1);
          const isHopReached =
            idx === 0
              ? clampedProgress >= 0
              : travelProgress >= hopThreshold - 0.04;
          const isHopCurrent =
            hops.length <= 1
              ? true
              : idx === hops.length - 1
                ? travelProgress >= 0.92
                : travelProgress >= hopThreshold - 0.04 &&
                  travelProgress < (idx + 1) / (hops.length - 1);

          const cardHighlightColor = isResponseComplete
            ? phosphorColor
            : isHopCurrent
              ? phosphorColor
              : isHopReached
                ? accentPrimary
                : inkBorder;

          const cardSurface = getTactileSurfaceStyle(studioStyle, {
            elevation: isHopCurrent || isResponseComplete ? 'lifted' : 'resting',
            overrides: {
              borderRadius: cardRadius,
              border: `${isHopReached ? 2 : 1.5}px solid ${cardHighlightColor}`,
              backgroundColor: palette.bgElevated,
            },
          });

          const iconKind =
            hop.icon ?? resolveDefaultHopIcon(idx, hops.length);

          return (
            <div
              key={hop.id}
              data-retro-hop={hop.id}
              data-retro-hop-active={isHopReached ? 'true' : 'false'}
              style={{
                position: 'absolute',
                left: box.cx - box.w * 0.5,
                top: box.cy - box.h * 0.5,
                width: box.w,
                height: box.h,
                ...cardSurface,
                padding: layout.isVertical ? '16px 22px' : '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <ClippedSurfaceChrome
                topBarHeight={3}
                topBarColor={cardHighlightColor}
                specularRim={!isDark}
                tintGradient={
                  isHopReached
                    ? `linear-gradient(180deg, ${cardHighlightColor}${
                        isDark ? '20' : '12'
                      } 0%, transparent 58%)`
                    : undefined
                }
              />

              {/* Card Header: Pixel Glyph Box + Badge */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: chipRadius,
                    backgroundColor: palette.bgSurface,
                    border: `1.5px solid ${cardHighlightColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <RetroHopPixelGlyph
                    kind={iconKind}
                    strokeColor={isHopReached ? textPrimary : textSecondary}
                    accentColor={
                      isHopReached ? cardHighlightColor : accentPrimary
                    }
                  />
                </div>

                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: chipRadius,
                    backgroundColor: palette.bgSurface,
                    border: `1px solid ${cardHighlightColor}`,
                    fontFamily: monoFontCss,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: isHopReached ? cardHighlightColor : textSecondary,
                  }}
                >
                  {hop.badge}
                </span>
              </div>

              {/* Card Title & Subtitle */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontFamily: displayFontCss,
                    fontSize: layout.isVertical ? 24 : 25,
                    fontWeight: 700,
                    letterSpacing: `${typography.displayTrackingEm}em`,
                    color: textPrimary,
                    lineHeight: 1.16,
                  }}
                >
                  {formatHeadingText(hop.title, studioStyle)}
                </div>
                <div
                  style={{
                    fontFamily: bodyFontCss,
                    fontSize: 18,
                    fontWeight: 400,
                    color: textSecondary,
                    marginTop: 5,
                    lineHeight: 1.32,
                  }}
                >
                  {hop.subtitle}
                </div>
              </div>

              {/* Card Bottom Micro-Status & Hop Latency */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  paddingTop: 8,
                  borderTop: `1px solid ${
                    isDark ? 'rgba(255, 255, 255, 0.12)' : `${inkBorder}55`
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      backgroundColor: isHopReached
                        ? cardHighlightColor
                        : 'transparent',
                      border: `1px solid ${cardHighlightColor}`,
                      boxSizing: 'border-box',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: monoFontCss,
                      fontSize: 18,
                      fontWeight: 600,
                      color: isHopReached ? textPrimary : textSecondary,
                    }}
                  >
                    {isResponseComplete
                      ? 'OK'
                      : isHopCurrent
                        ? resolvedLang === 'en'
                          ? 'ACTIVE'
                          : 'AKTYWNY'
                        : isHopReached
                          ? resolvedLang === 'en'
                            ? 'READY'
                            : 'GOTOWY'
                          : resolvedLang === 'en'
                            ? 'WAITING'
                            : 'OCZEKUJE'}
                  </span>
                </div>

                <span
                  style={{
                    fontFamily: monoFontCss,
                    fontSize: 18,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: isHopReached ? cardHighlightColor : textSecondary,
                  }}
                >
                  {hop.latencyMs} ms
                </span>
              </div>
            </div>
          );
        })}

        {/* Active Traveling Phosphor Packet Badge */}
        {packetPos && (
          <div
            data-retro-packet="true"
            style={{
              position: 'absolute',
              left: packetPos.x,
              top: packetPos.y,
              opacity: Number(packetOpacity.toFixed(4)),
              transform: 'translate(-50%, -50%)',
              padding: '4px 10px',
              borderRadius: chipRadius,
              backgroundColor: palette.bgCanvas,
              border: `1.5px solid ${phosphorColor}`,
              boxShadow: isDark
                ? `0 0 16px ${phosphorColor}66, 0 4px 10px rgba(0, 0, 0, 0.5)`
                : `0 0 12px ${phosphorColor}44, 0 3px 8px rgba(15, 23, 42, 0.14)`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'none',
              zIndex: 4,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                backgroundColor: phosphorColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: monoFontCss,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: phosphorColor,
              }}
            >
              {isResponseComplete
                ? '200 OK'
                : layout.isVertical
                  ? resolvedLang === 'en'
                    ? 'PACKET ▼'
                    : 'PAKIET ▼'
                  : resolvedLang === 'en'
                    ? 'PACKET ▶'
                    : 'PAKIET ▶'}
            </span>
          </div>
        )}
      </div>

      {/* Row 4: Bottom CRT Status Bar */}
      <div
        data-retro-status-bar="true"
        data-retro-status-complete={isResponseComplete ? 'true' : 'false'}
        style={{
          position: 'relative',
          zIndex: 2,
          height: layout.statusBarHeight,
          padding: '0 20px',
          backgroundColor: isResponseComplete
            ? `${phosphorColor}${isDark ? '1E' : '16'}`
            : palette.bgElevated,
          borderTop: `2px solid ${
            isResponseComplete ? phosphorColor : inkBorder
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              backgroundColor: isResponseComplete
                ? phosphorColor
                : accentPrimary,
              boxShadow: isResponseComplete
                ? `0 0 10px ${phosphorColor}`
                : 'none',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: monoFontCss,
              fontSize: 18,
              fontWeight: 700,
              color: isResponseComplete ? phosphorColor : textSecondary,
              letterSpacing: '0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {statusBanner}
          </span>
        </div>

        <span
          style={{
            fontFamily: monoFontCss,
            fontSize: 18,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: isResponseComplete ? textPrimary : textSecondary,
            flexShrink: 0,
          }}
        >
          {isResponseComplete
            ? resolvedLang === 'en'
              ? 'DONE'
              : 'GOTOWE'
            : 'TRANSFER'}{' '}
          • {displayedLatencyMs} ms
        </span>
      </div>
    </div>
  );
};
