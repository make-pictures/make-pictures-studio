import React from 'react';

export const FILL_LAYER_BASE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

export type FillLayerProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Zero-overhead full-bleed stage layer matching classic `AbsoluteFill` CSS layout
 * (`position: absolute; inset: 0; display: flex; flex-direction: column`).
 *
 * Unlike Remotion 4.0.545+ `<AbsoluteFill>`, `FillLayer` does NOT wrap decorative
 * sub-layers in `<Freeze>` + `<Sequence showInTimeline>` or trigger Remotion Studio
 * timeline re-layouts and `/api/subscribe-to-sequence-props` churn mid-playback.
 */
export const FillLayer: React.FC<FillLayerProps> = ({ style, ...rest }) => (
  <div
    {...rest}
    style={style ? { ...FILL_LAYER_BASE_STYLE, ...style } : FILL_LAYER_BASE_STYLE}
  />
);
