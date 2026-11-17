import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  DirectorCamera2D,
  ScenicBackdropLayers,
  formatFontFamilyCss,
  formatHeadingText,
  useStudioStyle,
  type ShotSpec2D,
  type StageNode2D,
} from '@make-pictures/core';
import {
  EditorialMediaCard,
  type EditorialMountType,
} from './EditorialMediaCard';
import { SplitStorySlotContext } from './SplitStoryLayout';

export interface EditorialPanoramaItem {
  id: string;
  src?: string;
  title: string;
  sentence?: string;
  sourceTag?: string;
  mountType?: EditorialMountType;
}

export interface EditorialPanoramaTrackProps {
  items: ReadonlyArray<EditorialPanoramaItem>;
  startFrame?: number;
  durationInFrames?: number;
  cardWidth?: number;
  cardHeight?: number;
  gapPx?: number;
  showScenicBackdrop?: boolean;
  renderBaseFill?: boolean;
}

export const EditorialPanoramaTrack: React.FC<EditorialPanoramaTrackProps> = ({
  items,
  startFrame = 2,
  durationInFrames = 360,
  cardWidth = 660,
  cardHeight = 480,
  gapPx = 96,
  showScenicBackdrop = true,
  renderBaseFill = false,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const style = useStudioStyle();
  const isVertical = height > width;

  const effectiveStart = Math.max(2, startFrame);

  const { nodes, shots, resolvedCards } = useMemo(() => {
    const clampedItems = items.slice(0, 6);
    const nodeMap: Record<string, StageNode2D> = {};
    const cards: Array<{
      item: EditorialPanoramaItem;
      node: StageNode2D;
    }> = [];

    const hasAnySentence = clampedItems.some((c) => Boolean(c.sentence));
    const w = isVertical ? Math.min(cardWidth, 660) : cardWidth;
    const h = isVertical
      ? hasAnySentence
        ? 472
        : 408
      : hasAnySentence
        ? Math.max(cardHeight, 548)
        : cardHeight;
    const verticalGap = 56;
    const shotPadding = isVertical ? 56 : 110;

    clampedItems.forEach((item, idx) => {
      const staggerOffset = idx % 2 === 0 ? -20 : 20;
      const node: StageNode2D = isVertical
        ? {
            cx: 470,
            cy: 480 + idx * (h + verticalGap),
            w,
            h,
          }
        : {
            cx: 520 + idx * (w + gapPx),
            cy: 540 + staggerOffset,
            w,
            h,
          };
      nodeMap[item.id] = node;
      cards.push({ item, node });
    });

    const ids = clampedItems.map((c) => c.id);
    const builtShots: ShotSpec2D[] = [];
    if (ids.length <= 2) {
      builtShots.push({
        fromFrame: 0,
        target: ids.length === 1 ? ids[0]! : ids,
        transition: 'cut',
        padding: shotPadding,
      });
    } else {
      const firstGroup = [ids[0]!, ids[1]!];
      const lastGroup = [ids[ids.length - 2]!, ids[ids.length - 1]!];
      builtShots.push({
        fromFrame: 0,
        target: firstGroup,
        transition: 'cut',
        padding: shotPadding,
      });
      if (ids.length >= 5) {
        const midIdx = Math.floor(ids.length / 2);
        builtShots.push({
          fromFrame:
            effectiveStart + Math.max(24, Math.round(durationInFrames * 0.24)),
          target: [ids[midIdx - 1]!, ids[midIdx]!],
          transition: 'glide',
          padding: shotPadding,
        });
        builtShots.push({
          fromFrame:
            effectiveStart + Math.max(60, Math.round(durationInFrames * 0.56)),
          target: lastGroup,
          transition: 'glide',
          padding: shotPadding,
        });
      } else {
        builtShots.push({
          fromFrame:
            effectiveStart + Math.max(30, Math.round(durationInFrames * 0.28)),
          target: lastGroup,
          transition: 'glide',
          padding: shotPadding,
        });
      }
    }

    return {
      nodes: nodeMap,
      shots: builtShots,
      resolvedCards: cards,
    };
  }, [
    items,
    isVertical,
    cardWidth,
    cardHeight,
    gapPx,
    durationInFrames,
    effectiveStart,
  ]);

  if (frame <= 0 || frame < effectiveStart) return null;

  const bodyFont = formatFontFamilyCss(style.typography.bodyFont, 'body');

  return (
    <AbsoluteFill data-editorial-panorama="true">
      {showScenicBackdrop && (
        <ScenicBackdropLayers
          seed={`panorama:${resolvedCards.map((c) => c.item.id).join(':')}`}
        />
      )}
      <DirectorCamera2D
        nodes={nodes}
        shots={shots}
        renderBaseFill={renderBaseFill}
      >
        <SplitStorySlotContext.Provider value={isVertical}>
          {resolvedCards.map(({ item, node }, idx) => (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: node.cx - node.w / 2,
                top: node.cy - node.h / 2,
                width: node.w,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <EditorialMediaCard
                src={item.src}
                caption={formatHeadingText(item.title, style)}
                sourceTag={item.sourceTag}
                mountType={item.mountType}
                startFrame={effectiveStart + idx * 6}
                durationInFrames={durationInFrames}
                zoomFrom={1.02}
                zoomTo={1.08}
                panX={idx % 2 === 0 ? -12 : 12}
                panY={-8}
              />
              {item.sentence ? (
                <div
                  style={{
                    padding: '0 8px',
                    fontFamily: bodyFont,
                    fontSize: 20,
                    lineHeight: 1.4,
                    color: style.palette.textSecondary,
                    boxSizing: 'border-box',
                  }}
                >
                  {item.sentence}
                </div>
              ) : null}
            </div>
          ))}
        </SplitStorySlotContext.Provider>
      </DirectorCamera2D>
    </AbsoluteFill>
  );
};
