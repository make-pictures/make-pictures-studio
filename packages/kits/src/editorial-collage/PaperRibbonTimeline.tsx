import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  formatFontFamilyCss,
  getStyleSpringConfig,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';
import {
  buildCrispTranslateYTransform,
  sanitizeEditorialOverlayStyle,
  snapSettledProgress,
} from './overlayStability';

export interface PaperTimelineMilestone {
  id: string;
  era: string;
  label: string;
  fromFrame?: number;
}

export interface PaperRibbonTimelineProps {
  milestones: ReadonlyArray<PaperTimelineMilestone>;
  activeId?: string;
  position?: 'top' | 'bottom';
  enterFrame?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

/**
 * Resolves the currently active milestone ID for a given `frame`.
 */
export function resolveActivePaperMilestoneId(
  milestones: ReadonlyArray<PaperTimelineMilestone>,
  frame: number,
  explicitActiveId?: string
): string | null {
  if (milestones.length === 0) return null;
  if (explicitActiveId) return explicitActiveId;

  let active = milestones[0]!.id;
  let bestFrame = -Infinity;
  for (const m of milestones) {
    if (
      m.fromFrame !== undefined &&
      frame >= m.fromFrame &&
      m.fromFrame >= bestFrame
    ) {
      bestFrame = m.fromFrame;
      active = m.id;
    }
  }
  return active;
}

/**
 * Light editorial paper ribbon timeline (`>= 20px` typography floor, zero dark web boxes).
 */
export const PaperRibbonTimeline: React.FC<PaperRibbonTimelineProps> = ({
  milestones,
  activeId,
  position = 'bottom',
  enterFrame = 2,
  opacity = 1,
  style: customStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const effectiveStart = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveStart || milestones.length === 0) {
    return null;
  }

  const rawEnter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  const enter = snapSettledProgress(rawEnter);
  const rawOpacity = Math.max(0, Math.min(1, enter * opacity));
  const finalOpacity = snapSettledProgress(rawOpacity);
  if (finalOpacity <= 0.005) {
    return null;
  }

  const resolvedActiveId = resolveActivePaperMilestoneId(
    milestones,
    frame,
    activeId
  );
  const bodyFontCss = formatFontFamilyCss(
    studioStyle.typography.bodyFont,
    'body'
  );
  const monoFontCss = formatFontFamilyCss(
    studioStyle.typography.monoFont,
    'mono'
  );

  const isVertical = height > width;
  const scaleX = width / 1080;
  const scaleY = height / 1920;

  // Strictly inside 9:16 Golden Safe Box: x in [40, 910], y in [220, 1380]
  const containerLeft = isVertical ? Math.round(40 * scaleX) : 0;
  const containerRight = isVertical ? Math.round(170 * scaleX) : 0;
  const verticalEdge = isVertical
    ? position === 'bottom'
      ? { bottom: Math.round(540 * scaleY) }
      : { top: Math.round(220 * scaleY) }
    : position === 'bottom'
      ? { bottom: 34 }
      : { top: 34 };

  const slideOffset = (1 - enter) * (position === 'bottom' ? 18 : -18);
  const safeCustomStyle = sanitizeEditorialOverlayStyle(customStyle);

  return (
    <div
      data-component="paper-ribbon-timeline"
      data-active-id={resolvedActiveId ?? undefined}
      style={{
        position: 'absolute',
        left: containerLeft,
        right: containerRight,
        ...verticalEdge,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: finalOpacity,
        transform: buildCrispTranslateYTransform(slideOffset, false),
        WebkitFontSmoothing: 'antialiased',
        boxSizing: 'border-box',
        paddingLeft: isVertical ? 0 : 48,
        paddingRight: isVertical ? 0 : 48,
        ...safeCustomStyle,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: '100%',
          gap: isVertical ? '10px 18px' : '12px 28px',
          padding: isVertical ? '12px 22px' : '14px 32px',
          backgroundColor: studioStyle.palette.bgSurface,
          border: `1px solid ${studioStyle.palette.inkBorder}`,
          borderRadius: isVertical ? 28 : 999,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.09)',
          boxSizing: 'border-box',
        }}
      >
        {milestones.map((m, idx) => {
          const isActive = m.id === resolvedActiveId;
          return (
            <React.Fragment key={m.id}>
              {idx > 0 && (
                <div
                  style={{
                    width: 24,
                    height: 1.5,
                    backgroundColor: studioStyle.palette.inkBorder,
                    boxSizing: 'border-box',
                  }}
                />
              )}
              <div
                data-milestone-id={m.id}
                data-active={isActive ? 'true' : 'false'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: 10,
                  paddingBottom: 3,
                  borderBottom: isActive
                    ? `2.5px solid ${studioStyle.palette.accentPrimary}`
                    : '2.5px solid transparent',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    display: 'inline-grid',
                    fontFamily: monoFontCss,
                    fontSize: 20,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.2,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      gridArea: '1 / 1',
                      fontWeight: 700,
                      visibility: 'hidden',
                      pointerEvents: 'none',
                    }}
                  >
                    {m.era}
                  </span>
                  <span
                    style={{
                      gridArea: '1 / 1',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive
                        ? studioStyle.palette.accentPrimary
                        : studioStyle.palette.textSecondary,
                    }}
                  >
                    {m.era}
                  </span>
                </span>
                <span
                  style={{
                    display: 'inline-grid',
                    fontFamily: bodyFontCss,
                    fontSize: 21,
                    lineHeight: 1.2,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      gridArea: '1 / 1',
                      fontWeight: 700,
                      visibility: 'hidden',
                      pointerEvents: 'none',
                    }}
                  >
                    {m.label}
                  </span>
                  <span
                    style={{
                      gridArea: '1 / 1',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive
                        ? studioStyle.palette.textPrimary
                        : studioStyle.palette.textSecondary,
                    }}
                  >
                    {m.label}
                  </span>
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
