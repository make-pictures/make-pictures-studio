import React from 'react';
import {
  isVerticalComposition,
  type StudioCompositionEntry,
} from '@make-pictures/core';
import { BrandLogo } from './BrandLogo';

export interface TopbarProps {
  compositions?: StudioCompositionEntry[];
  activeComposition: StudioCompositionEntry;
  onSelectComposition?: (id: string) => void;
  measuredFps: number;
  isPlaying: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeComposition,
  measuredFps,
  isPlaying,
}) => {
  const isVertical = isVerticalComposition(activeComposition);
  const ratioLabel = isVertical ? '9:16 Shorts' : '16:9 HD';

  return (
    <header className="mp-topbar">
      <a
        href="https://make.pictures"
        target="_blank"
        rel="noreferrer"
        style={{ textDecoration: 'none' }}
        aria-label="make.pictures"
      >
        <BrandLogo size="sm" />
      </a>

      <div className="mp-topbar-meta">
        <span className="mp-topbar-active-title">{activeComposition.title}</span>

        <span className="mp-chip">
          {activeComposition.width}×{activeComposition.height} • {ratioLabel}
        </span>

        <span
          className="mp-chip mp-chip-fps"
          title="Częstotliwość odświeżania sceny"
        >
          <span className={`mp-fps-dot ${isPlaying ? 'is-playing' : ''}`} />
          {isPlaying ? `${measuredFps} FPS` : `${activeComposition.fps} FPS`}
        </span>
      </div>
    </header>
  );
};
