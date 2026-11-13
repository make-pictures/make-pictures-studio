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
  StyleProvider,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
  type BuiltinVisualKitId,
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
    // Strictly inside 9:16 Golden Safe Box: x in [40, 910], y in [220, 1380]
    return {
      isVertical: true,
      left: 56,
      top: 248,
      width: 832,
      height: 1096,
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
  const bounds = getSafeStageBounds(width, height);

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
    frame: frame - 28,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const kenBurnsScale = interpolate(frame, [2, 300], [1.0, 1.11], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const kenBurnsX = interpolate(frame, [2, 300], [0, -18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
    <div
      style={{
        position: 'absolute',
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        display: 'flex',
        flexDirection: bounds.isVertical ? 'column' : 'row',
        gap: bounds.isVertical ? 32 : 48,
        alignItems: 'stretch',
        justifyContent: 'center',
      }}
    >
      {/* Left / Top: Chapter + Highlight Quote */}
      <div
        style={{
          flex: bounds.isVertical ? '0 0 auto' : '1.08 1 0%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 22,
          opacity: chapterEnter,
          transform: `translateY(${interpolate(chapterEnter, [0, 1], [26, 0])}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: style.palette.accentPrimary,
            }}
          >
            ROZDZIAŁ 01 • ARCHIWUM
          </span>
          <div
            style={{
              height: 2,
              flex: 1,
              maxWidth: 160,
              backgroundColor: style.palette.inkBorder,
              transformOrigin: 'left center',
              transform: `scaleX(${chapterEnter})`,
            }}
          />
        </div>

        <div
          style={{
            fontFamily: displayFont,
            fontSize: bounds.isVertical ? 54 : 68,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: `${style.typography.displayTrackingEm}em`,
            color: style.palette.textPrimary,
          }}
        >
          {formatHeadingText('Sztuka rzemiosła i żywego światła', style)}
        </div>

        <div
          style={getCardChromeStyle(style, {
            padding: bounds.isVertical ? '26px 30px' : '30px 36px',
            marginTop: 6,
          })}
        >
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: bounds.isVertical ? 26 : 29,
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
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 2,
                  height: '42%',
                  backgroundColor: `${style.palette.accentPrimary}38`,
                  transformOrigin: 'left center',
                  transform: `scaleX(${quoteSweep})`,
                  borderRadius: 4,
                }}
              />
              <span style={{ position: 'relative' }}>kreską, fakturą i barwą</span>
            </span>{' '}
            opowieści.”
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: monoFont,
              fontSize: 16,
              color: style.palette.textSecondary,
            }}
          >
            — Kronika wzornictwa • Neapol, 1889
          </div>
        </div>
      </div>

      {/* Right / Bottom: Framed Ken Burns Media Card */}
      <div
        style={getCardChromeStyle(style, {
          flex: bounds.isVertical ? '1 1 0%' : '0.92 1 0%',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          opacity: mediaEnter,
          transform: `translateY(${interpolate(mediaEnter, [0, 1], [32, 0])}px)`,
        })}
      >
        <div
          style={{
            flex: 1,
            minHeight: bounds.isVertical ? 280 : 380,
            borderRadius: Math.max(0, Math.round(14 * style.surface.radiusScale)),
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: style.palette.bgElevated,
            border: `1px solid ${style.palette.inkBorder}`,
          }}
        >
          <svg
            viewBox="0 0 600 420"
            preserveAspectRatio="xMidYMid slice"
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${kenBurnsScale}) translateX(${kenBurnsX}px)`,
              transformOrigin: 'center center',
            }}
          >
            <rect width="600" height="420" fill={style.palette.bgElevated} />
            <circle
              cx="430"
              cy="130"
              r="96"
              fill={style.palette.accentPrimary}
              opacity={0.86}
            />
            <path
              d="M40 360 L195 190 L325 305 L430 215 L570 360 Z"
              fill={style.palette.accentSecondary}
              opacity={0.78}
            />
            <rect
              x="56"
              y="56"
              width="210"
              height="110"
              rx={Math.round(8 * style.surface.radiusScale)}
              fill={style.palette.bgSurface}
              stroke={style.palette.inkBorder}
              strokeWidth="2"
            />
            <line
              x1="80"
              y1="92"
              x2="230"
              y2="92"
              stroke={style.palette.textPrimary}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <line
              x1="80"
              y1="122"
              x2="190"
              y2="122"
              stroke={style.palette.textSecondary}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            fontFamily: monoFont,
            fontSize: 16,
            color: style.palette.textSecondary,
          }}
        >
          <span>Ryc. 04 — Ruch Ken Burns (deterministyczny)</span>
          <span style={{ color: style.palette.accentPrimary, fontWeight: 700 }}>
            latin-ext • PL
          </span>
        </div>
      </div>
    </div>
  );
};

const VectorScene2DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const bounds = getSafeStageBounds(width, height);

  const heroEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const leftEnter = spring({
    frame: frame - 14,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const rightEnter = spring({
    frame: frame - 26,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
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
        gap: 28,
      }}
    >
      <div
        style={getCardChromeStyle(style, {
          padding: bounds.isVertical ? '30px 34px' : '36px 44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          opacity: heroEnter,
          transform: `translateY(${interpolate(heroEnter, [0, 1], [24, 0])}px)`,
        })}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 17,
              fontWeight: 700,
              color: style.palette.accentPrimary,
              letterSpacing: '0.08em',
            }}
          >
            VECTOR SCENE 2D • STORY CARD
          </span>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: bounds.isVertical ? 44 : 54,
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
              fontSize: 24,
              color: style.palette.textSecondary,
            }}
          >
            Zwięzłe karty, wyraźna hierarchia i pełne polskie znaki: zażółć gęślą jaźń.
          </div>
        </div>

        <div
          style={{
            padding: '10px 20px',
            borderRadius: Math.round(999 * Math.max(0.15, style.surface.radiusScale)),
            backgroundColor: `${style.palette.accentPrimary}20`,
            border: `2px solid ${style.palette.accentPrimary}`,
            fontFamily: monoFont,
            fontSize: 20,
            fontWeight: 700,
            color: style.palette.accentPrimary,
            flexShrink: 0,
          }}
        >
          60 FPS
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: bounds.isVertical ? 'column' : 'row',
          gap: 28,
        }}
      >
        <div
          style={getCardChromeStyle(style, {
            flex: 1,
            padding: '30px 34px',
            opacity: leftEnter,
            transform: `translateY(${interpolate(leftEnter, [0, 1], [22, 0])}px)`,
          })}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 17,
              fontWeight: 700,
              color: style.palette.textSecondary,
              marginBottom: 10,
            }}
          >
            PRZED ZMIANĄ
          </div>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 36,
              fontWeight: 700,
              color: style.palette.textPrimary,
              marginBottom: 8,
            }}
          >
            {formatHeadingText('Jeden sztywny szablon', style)}
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 22,
              lineHeight: 1.4,
              color: style.palette.textSecondary,
            }}
          >
            Każdy film dziedziczył tę samą paletę i tekturową scenografię.
          </div>
        </div>

        <div
          style={getCardChromeStyle(style, {
            flex: 1,
            padding: '30px 34px',
            borderColor: style.palette.accentPrimary,
            opacity: rightEnter,
            transform: `translateY(${interpolate(rightEnter, [0, 1], [22, 0])}px)`,
          })}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 17,
              fontWeight: 700,
              color: style.palette.accentPrimary,
              marginBottom: 10,
            }}
          >
            ART DIRECTION 2.1
          </div>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 36,
              fontWeight: 700,
              color: style.palette.textPrimary,
              marginBottom: 8,
            }}
          >
            {formatHeadingText('Styl dopasowany do treści', style)}
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 22,
              lineHeight: 1.4,
              color: style.palette.textSecondary,
            }}
          >
            7 kitów scenicznych + autorskie presety w katalogu styles/.
          </div>
        </div>
      </div>
    </div>
  );
};

const KineticTypographyPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const bounds = getSafeStageBounds(width, height);

  const words = ['Rytm', 'słowa', 'buduje', 'emocję', 'kadru'];
  const badgePop = spring({
    frame: frame - 34,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });
  const counterProgress = spring({
    frame: frame - 18,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const counterVal = (counterProgress * 98.4).toFixed(1).replace('.', ',');

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
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
        gap: 34,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 22px' }}>
        {words.map((word, idx) => {
          const wSpring = spring({
            frame: frame - (2 + idx * 6),
            fps,
            config: getStyleSpringConfig(style, 'emphasis'),
          });
          const isAccent = idx === 1 || idx === 3;
          return (
            <span
              key={word}
              style={{
                fontFamily: displayFont,
                fontSize: bounds.isVertical ? 68 : 88,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: `${style.typography.displayTrackingEm}em`,
                color: isAccent
                  ? style.palette.accentPrimary
                  : style.palette.textPrimary,
                opacity: wSpring,
                transform: `translateY(${interpolate(
                  wSpring,
                  [0, 1],
                  [34, 0]
                )}px) scale(${interpolate(wSpring, [0, 1], [0.9, 1])})`,
                display: 'inline-block',
              }}
            >
              {formatHeadingText(word, style)}
            </span>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: bounds.isVertical ? 'column' : 'row',
          gap: 24,
          alignItems: bounds.isVertical ? 'stretch' : 'center',
        }}
      >
        <div
          style={getCardChromeStyle(style, {
            padding: '26px 36px',
            display: 'flex',
            alignItems: 'baseline',
            gap: 18,
            opacity: counterProgress,
          })}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: bounds.isVertical ? 54 : 64,
              fontWeight: 800,
              color: style.palette.accentPrimary,
            }}
          >
            {counterVal}%
          </span>
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: 24,
              fontWeight: 600,
              color: style.palette.textSecondary,
            }}
          >
            utrzymania uwagi widza
          </span>
        </div>

        <div
          style={{
            padding: '22px 32px',
            backgroundColor: style.palette.accentPrimary,
            color: '#FFFFFF',
            borderRadius: Math.round(16 * style.surface.radiusScale),
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.06em',
            opacity: badgePop,
            transform: `scale(${interpolate(badgePop, [0, 1], [0.85, 1])})`,
            textAlign: 'center',
          }}
        >
          IMPACT KEYWORD • SŁOWO PO SŁOWIE
        </div>
      </div>
    </div>
  );
};

const DataStorytellingPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const bounds = getSafeStageBounds(width, height);

  const cardEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });

  const bars = [
    { label: 'Wideo z kodem (60 FPS)', target: 94, accent: style.palette.accentPrimary },
    { label: 'Dokument redakcyjny', target: 78, accent: style.palette.accentSecondary },
    { label: 'Prezentacja produktowa', target: 63, accent: style.palette.textSecondary },
    { label: 'Statyczne slajdy', target: 29, accent: style.palette.inkBorder },
  ];

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
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
        gap: 26,
      }}
    >
      <div
        style={getCardChromeStyle(style, {
          padding: bounds.isVertical ? '32px 34px' : '40px 46px',
          opacity: cardEnter,
          transform: `translateY(${interpolate(cardEnter, [0, 1], [24, 0])}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        })}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 16,
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: bounds.isVertical ? 40 : 48,
              fontWeight: 700,
              color: style.palette.textPrimary,
              letterSpacing: `${style.typography.displayTrackingEm}em`,
            }}
          >
            {formatHeadingText('Indeks czytelności przekazu', style)}
          </div>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              color: style.palette.accentPrimary,
            }}
          >
            +3,2× WZROST
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {bars.map((bar, idx) => {
            const grow = spring({
              frame: frame - (8 + idx * 7),
              fps,
              config: getStyleSpringConfig(style, 'enter'),
            });
            const pct = Math.round(bar.target * grow);
            return (
              <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: bodyFont,
                    fontSize: 21,
                    fontWeight: 600,
                    color: style.palette.textPrimary,
                  }}
                >
                  <span>{bar.label}</span>
                  <span style={{ fontFamily: monoFont, color: style.palette.textSecondary }}>
                    {pct} pkt
                  </span>
                </div>
                <div
                  style={{
                    height: 20,
                    borderRadius: Math.round(10 * style.surface.radiusScale),
                    backgroundColor: style.palette.bgElevated,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(2, bar.target * grow)}%`,
                      height: '100%',
                      backgroundColor: bar.accent,
                      borderRadius: Math.round(10 * style.surface.radiusScale),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MotionDiagrams2DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const bounds = getSafeStageBounds(width, height);

  const nodeEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const toastEnter = spring({
    frame: frame - 22,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const pulseT = ((frame - 2) % 90) / 90;

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const nodes = [
    { step: '01 • WEJŚCIE', title: 'Scenariusz JSON', sub: 'production.json' },
    { step: '02 • STYL', title: 'StyleProvider', sub: `${style.id}` },
    { step: '03 • MASTER', title: 'Render 60 FPS', sub: '-14 LUFS MP4' },
  ];

  return (
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
        gap: 28,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: bounds.isVertical ? 'column' : 'row',
          alignItems: 'center',
          gap: 22,
          opacity: nodeEnter,
        }}
      >
        {nodes.map((node, idx) => (
          <React.Fragment key={node.step}>
            <div
              style={getCardChromeStyle(style, {
                flex: 1,
                width: bounds.isVertical ? '100%' : undefined,
                padding: '28px 30px',
                borderColor:
                  idx === 1 ? style.palette.accentPrimary : style.palette.inkBorder,
              })}
            >
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 15,
                  fontWeight: 700,
                  color:
                    idx === 1
                      ? style.palette.accentPrimary
                      : style.palette.textSecondary,
                  marginBottom: 8,
                }}
              >
                {node.step}
              </div>
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: 32,
                  fontWeight: 700,
                  color: style.palette.textPrimary,
                  marginBottom: 6,
                }}
              >
                {formatHeadingText(node.title, style)}
              </div>
              <div
                style={{
                  fontFamily: bodyFont,
                  fontSize: 19,
                  color: style.palette.textSecondary,
                }}
              >
                {node.sub}
              </div>
            </div>

            {idx < nodes.length - 1 && (
              <div
                style={{
                  position: 'relative',
                  width: bounds.isVertical ? 4 : 64,
                  height: bounds.isVertical ? 36 : 4,
                  backgroundColor: style.palette.inkBorder,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: style.palette.accentPrimary,
                    left: bounds.isVertical ? -5 : `${pulseT * 82}%`,
                    top: bounds.isVertical ? `${pulseT * 70}%` : -5,
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div
        style={getCardChromeStyle(style, {
          padding: '20px 28px',
          backgroundColor: style.palette.bgElevated,
          fontFamily: monoFont,
          fontSize: 19,
          color: style.palette.textPrimary,
          opacity: toastEnter,
          transform: `translateY(${interpolate(toastEnter, [0, 1], [16, 0])}px)`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        })}
      >
        <span>
          {`{ kit: "motion-diagrams-2d", backdrop: "${style.surface.backdropType}" }`}
        </span>
        <span style={{ color: style.palette.accentSecondary, fontWeight: 700 }}>
          FLOW READY
        </span>
      </div>
    </div>
  );
};

const PaperDiorama3DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const style = useStudioStyle();
  const bounds = getSafeStageBounds(width, height);

  const hingeFold = spring({
    frame: frame - 4,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const frontFold = spring({
    frame: frame - 16,
    fps,
    config: getStyleSpringConfig(style, 'emphasis'),
  });

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  return (
    <div
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
        gap: 26,
        perspective: 1200,
      }}
    >
      {/* Neutral DioramaStage3D Plinth + Layered Cutouts */}
      <div
        style={{
          width: bounds.isVertical ? '100%' : '86%',
          height: bounds.isVertical ? 580 : 520,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Stage Base Plinth */}
        <div
          style={{
            position: 'absolute',
            bottom: 34,
            width: '90%',
            height: 150,
            borderRadius: Math.round(28 * Math.max(0.25, style.surface.radiusScale)),
            backgroundColor: style.palette.bgElevated,
            border: `3px solid ${style.palette.inkBorder}`,
            transform: 'rotateX(62deg)',
            boxShadow: '0 34px 60px rgba(15, 23, 42, 0.22)',
          }}
        />

        {/* Back Cutout Layer (z = -60) */}
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            padding: '26px 40px',
            backgroundColor: style.palette.accentSecondary,
            color: '#FFFFFF',
            border: '6px solid #FFFFFF',
            borderRadius: Math.round(20 * Math.max(0.2, style.surface.radiusScale)),
            boxShadow: '0 18px 34px rgba(15, 23, 42, 0.2)',
            transformOrigin: 'bottom center',
            transform: `translateY(-44px) scale(0.92) rotateX(${interpolate(
              hingeFold,
              [0, 1],
              [-78, 0]
            )}deg)`,
            opacity: hingeFold,
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          DIORAMA STAGE 3D • WARSTWA TŁA (Δz ≥ 0.45)
        </div>

        {/* Front Hero Cutout Layer */}
        <div
          style={{
            position: 'relative',
            padding: bounds.isVertical ? '34px 36px' : '38px 48px',
            backgroundColor: style.palette.bgSurface,
            color: style.palette.textPrimary,
            border: '6px solid #FFFFFF',
            outline: `2px solid ${style.palette.inkBorder}`,
            borderRadius: Math.round(22 * Math.max(0.2, style.surface.radiusScale)),
            boxShadow: '0 24px 44px rgba(15, 23, 42, 0.24)',
            transformOrigin: 'bottom center',
            transform: `translateY(28px) rotateX(${interpolate(
              frontFold,
              [0, 1],
              [-75, 0]
            )}deg)`,
            opacity: frontFold,
            textAlign: 'center',
            maxWidth: 680,
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: bounds.isVertical ? 42 : 50,
              fontWeight: 700,
              lineHeight: 1.12,
              marginBottom: 10,
              letterSpacing: `${style.typography.displayTrackingEm}em`,
            }}
          >
            {formatHeadingText('Neutralna scena wycinankowa 2.5D', style)}
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 22,
              color: style.palette.textSecondary,
            }}
          >
            Czysty postument DioramaStage3D sterowany paletą wybranego stylu.
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
  const bounds = getSafeStageBounds(width, height);

  const stageEnter = spring({
    frame: frame - 2,
    fps,
    config: getStyleSpringConfig(style, 'enter'),
  });
  const speakerAActive = frame % 150 < 75;
  const energyWave = 0.5 + 0.5 * Math.sin(frame * 0.22);

  const displayFont = formatFontFamilyCss(style.typography.displayFont, 'display');
  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');
  const monoFont = formatFontFamilyCss(style.typography.monoFont, 'mono');

  const renderSpeaker = (
    name: string,
    role: string,
    color: string,
    isSpeaking: boolean
  ) => (
    <div
      style={getCardChromeStyle(style, {
        flex: 1,
        padding: '28px 30px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        borderColor: isSpeaking ? color : style.palette.inkBorder,
        transform: `translateY(${isSpeaking ? -6 * energyWave : 0}px)`,
      })}
    >
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: '50%',
          backgroundColor: `${color}24`,
          border: `3px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isSpeaking ? `0 0 0 ${Math.round(8 * energyWave)}px ${color}28` : 'none',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: Math.round(10 * style.surface.radiusScale),
            backgroundColor: color,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: displayFont,
          fontSize: 30,
          fontWeight: 700,
          color: style.palette.textPrimary,
        }}
      >
        {formatHeadingText(name, style)}
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 15,
          fontWeight: 700,
          color: isSpeaking ? color : style.palette.textSecondary,
        }}
      >
        {isSpeaking ? '● AKTYWNA WYPOWIEDŹ' : role}
      </div>
    </div>
  );

  return (
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
        gap: 26,
        opacity: stageEnter,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 17,
            fontWeight: 700,
            color: style.palette.accentPrimary,
            marginBottom: 8,
          }}
        >
          ISOMETRIC STAGE 3D • DIALOG WIELOOSOBOWY
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 24,
            color: style.palette.textSecondary,
          }}
        >
          Domyślny archetyp głosu: <strong>{style.audioDefaults.voiceArchetype}</strong> •
          Muzyka: <strong>{style.audioDefaults.musicMood}</strong>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: bounds.isVertical ? 'column' : 'row',
          gap: 28,
        }}
      >
        {renderSpeaker(
          'Prowadząca',
          'GŁOS GŁÓWNY',
          style.palette.accentPrimary,
          speakerAActive
        )}
        {renderSpeaker(
          'Gość studia',
          'KOMENTARZ',
          style.palette.accentSecondary,
          !speakerAActive
        )}
      </div>
    </div>
  );
};

export const StyleLabPreviewComposition: React.FC<StyleLabCompositionProps> = ({
  style,
  kit,
}) => {
  const frame = useCurrentFrame();

  // Deterministic handheld camera drift preview driven by style.motion.cameraHandheld
  const driftX =
    frame >= 2 ? Math.sin(frame * 0.045) * style.motion.cameraHandheld * 22 : 0;
  const driftY =
    frame >= 2 ? Math.cos(frame * 0.035) * style.motion.cameraHandheld * 14 : 0;

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
