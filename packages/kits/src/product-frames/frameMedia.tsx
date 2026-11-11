import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo } from 'remotion';

export interface FrameMediaProps {
  /** `.mp4` / `.webm` screen recording (rendered via Remotion `<OffthreadVideo />`) */
  videoSrc?: string;
  /** Static screenshot (rendered via Remotion `<Img />`) */
  imageSrc?: string;
  /** Trim start of `videoSrc` in frames */
  startFrom?: number;
  /** Trim end of `videoSrc` in frames */
  endAt?: number;
  playbackRate?: number;
  /** Mute embedded video audio (default `true` — screencasts rarely carry useful audio) */
  muted?: boolean;
  volume?: number;
  /** CSS `object-fit` for media (default `'cover'`) */
  objectFit?: React.CSSProperties['objectFit'];
  /** Optional overlays (e.g. `<ScreenSpotlightOverlay />`) layered above the media */
  children?: React.ReactNode;
}

/**
 * Shared media viewport for `BrowserFrame` & `PhoneFrame`: video OR image OR children,
 * with `children` always layered on top so callouts can annotate a live `.mp4`.
 */
export const FrameMedia: React.FC<FrameMediaProps> = ({
  videoSrc,
  imageSrc,
  startFrom,
  endAt,
  playbackRate = 1,
  muted = true,
  volume = 1,
  objectFit = 'cover',
  children,
}) => {
  const mediaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    display: 'block',
  };

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {videoSrc ? (
        <OffthreadVideo
          src={videoSrc}
          startFrom={startFrom}
          endAt={endAt}
          playbackRate={playbackRate}
          muted={muted}
          volume={muted ? 0 : volume}
          style={mediaStyle}
        />
      ) : imageSrc ? (
        <Img src={imageSrc} style={mediaStyle} />
      ) : null}
      {children ? (
        <AbsoluteFill style={{ overflow: 'hidden' }}>{children}</AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
