import React from 'react';
import { useStudioStyle } from '../style';

export interface ClippedSurfaceChromeProps {
  /** Height in px of an internal top accent bar clipped cleanly inside rounded corners */
  topBarHeight?: number;
  /** CSS color or gradient for the top accent bar (defaults to `style.palette.accentPrimary`) */
  topBarColor?: string;
  /** Render crisp inner specular rim highlight along the top edge */
  specularRim?: boolean;
  /** Optional internal surface tint gradient CSS string */
  tintGradient?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Rounded-corner interior clipping mask (`position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none'`).
 * Ensures internal header bars, specular highlights, and surface gradients NEVER bleed past rounded card corners,
 * even when the outer card uses `overflow: 'visible'` for external port pins or badges.
 */
export const ClippedSurfaceChrome: React.FC<ClippedSurfaceChromeProps> = ({
  topBarHeight,
  topBarColor,
  specularRim = false,
  tintGradient,
  children,
  style,
}) => {
  const studioStyle = useStudioStyle();
  const resolvedBarColor = topBarColor ?? studioStyle.palette.accentPrimary;
  const hasTopBar = typeof topBarHeight === 'number' && topBarHeight > 0;

  return (
    <div
      data-clipped-surface-chrome="true"
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        overflow: 'hidden',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {tintGradient ? (
        <div
          data-clipped-tint="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: tintGradient,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {hasTopBar ? (
        <div
          data-clipped-top-bar="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: topBarHeight,
            background: resolvedBarColor,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {specularRim ? (
        <div
          data-clipped-specular-rim="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            boxShadow: studioStyle.surface.isDark
              ? 'inset 0 1px 0 rgba(255, 255, 255, 0.22)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {children}
    </div>
  );
};
