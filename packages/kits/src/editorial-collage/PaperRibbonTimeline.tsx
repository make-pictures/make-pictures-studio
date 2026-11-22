import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  formatFontFamilyCss,
  getStyleSpringConfig,
  useStudioFontsReady,
  useStudioStyle,
} from '@make-pictures/core';

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
  for (const m of milestones) {
    if (m.fromFrame !== undefined && frame >= m.fromFrame) {
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
  const { fps } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const effectiveStart = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveStart || milestones.length === 0) {
    return null;
  }

  const enter = spring({
    frame: frame - effectiveStart,
    fps,
    config: getStyleSpringConfig(studioStyle, 'enter'),
  });
  const finalOpacity = Math.max(0, Math.min(1, enter * opacity));
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

  const slideOffset = (1 - enter) * (position === 'bottom' ? 18 : -18);

  return (
    <div
      data-component="paper-ribbon-timeline"
      data-active-id={resolvedActiveId ?? undefined}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(position === 'bottom' ? { bottom: 34 } : { top: 34 }),
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: finalOpacity,
        transform: `translateY(${slideOffset.toFixed(2)}px)`,
        boxSizing: 'border-box',
        paddingLeft: 48,
        paddingRight: 48,
        ...customStyle,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 28,
          padding: '14px 32px',
          backgroundColor: studioStyle.palette.bgSurface,
          border: `1px solid ${studioStyle.palette.inkBorder}`,
          borderRadius: 999,
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
                    fontFamily: monoFontCss,
                    fontSize: 20,
                    fontWeight: isActive ? 700 : 500,
                    fontVariantNumeric: 'tabular-nums',
                    color: isActive
                      ? studioStyle.palette.accentPrimary
                      : studioStyle.palette.textSecondary,
                    lineHeight: 1.2,
                  }}
                >
                  {m.era}
                </span>
                <span
                  style={{
                    fontFamily: bodyFontCss,
                    fontSize: 21,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive
                      ? studioStyle.palette.textPrimary
                      : studioStyle.palette.textSecondary,
                    lineHeight: 1.2,
                  }}
                >
                  {m.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
