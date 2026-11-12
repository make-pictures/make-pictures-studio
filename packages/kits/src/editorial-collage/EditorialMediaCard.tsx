import React from 'react';
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  formatFontFamilyCss,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export interface EditorialMediaCardProps {
  src?: string;
  caption: string;
  sourceTag?: string;
  startFrame?: number;
  durationInFrames?: number;
  zoomFrom?: number;
  zoomTo?: number;
  panX?: number;
  panY?: number;
  styleOverrides?: React.CSSProperties;
}

export const EditorialMediaCard: React.FC<EditorialMediaCardProps> = ({
  src,
  caption,
  sourceTag,
  startFrame = 2,
  durationInFrames = 180,
  zoomFrom = 1.02,
  zoomTo = 1.1,
  panX = -14,
  panY = -10,
  styleOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();

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

  return (
    <div
      style={getCardChromeStyle(style, {
        boxSizing: 'border-box',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
        ...styleOverrides,
      })}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: Math.max(0, Math.round(14 * style.surface.radiusScale)),
          aspectRatio: '16 / 10',
          backgroundColor: style.palette.bgElevated,
        }}
      >
        {src ? (
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: `linear-gradient(135deg, ${style.palette.accentPrimary}28, ${style.palette.accentSecondary}32)`,
              transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
            }}
          />
        )}
        {sourceTag ? (
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              padding: '6px 12px',
              backgroundColor: style.palette.bgSurface,
              color: style.palette.textPrimary,
              border: `1px solid ${style.palette.inkBorder}`,
              fontFamily: formatFontFamilyCss(style.typography.monoFont, 'mono'),
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {sourceTag}
          </div>
        ) : null}
      </div>
      <div
        style={{
          fontFamily: formatFontFamilyCss(style.typography.bodyFont, 'body'),
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.35,
          color: style.palette.textPrimary,
        }}
      >
        {caption}
      </div>
    </div>
  );
};
