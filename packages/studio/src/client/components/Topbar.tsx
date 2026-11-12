import React from 'react';
import {
  isVerticalComposition,
  type StudioCompositionEntry,
} from '@make-pictures/core';
import { BrandLogo } from './BrandLogo';

export type StudioViewMode = 'films' | 'styles';

export interface TopbarProps {
  compositions?: StudioCompositionEntry[];
  activeComposition?: StudioCompositionEntry | null;
  onSelectComposition?: (id: string) => void;
  measuredFps: number;
  isPlaying: boolean;
  viewMode?: StudioViewMode;
  onChangeViewMode?: (mode: StudioViewMode) => void;
  styleLabTitle?: string;
  styleLabRatioLabel?: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeComposition,
  measuredFps,
  isPlaying,
  viewMode = 'films',
  onChangeViewMode,
  styleLabTitle,
  styleLabRatioLabel,
}) => {
  const isStylesView = viewMode === 'styles';
  const isVertical = activeComposition
    ? isVerticalComposition(activeComposition)
    : false;
  const ratioLabel = activeComposition
    ? `${activeComposition.width}×${activeComposition.height} • ${
        isVertical ? '9:16 Shorts' : '16:9 HD'
      }`
    : null;

  const targetFps = activeComposition?.fps ?? 60;

  return (
    <header className="mp-topbar">
      <div className="mp-topbar-left">
        <a
          href="https://make.pictures"
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: 'none' }}
          aria-label="make.pictures"
        >
          <BrandLogo size="sm" />
        </a>

        {onChangeViewMode && (
          <nav
            className="mp-view-switcher"
            aria-label="Przełącznik widoku Studio"
          >
            <button
              type="button"
              className={`mp-view-tab ${
                viewMode === 'films' ? 'is-active' : ''
              }`}
              aria-pressed={viewMode === 'films'}
              onClick={() => onChangeViewMode('films')}
            >
              <span aria-hidden="true">🎬</span>
              <span>Filmy</span>
            </button>
            <button
              type="button"
              className={`mp-view-tab ${
                viewMode === 'styles' ? 'is-active' : ''
              }`}
              aria-pressed={viewMode === 'styles'}
              onClick={() => onChangeViewMode('styles')}
            >
              <span aria-hidden="true">🎨</span>
              <span>Style Lab</span>
            </button>
          </nav>
        )}
      </div>

      <div className="mp-topbar-meta">
        {isStylesView ? (
          <>
            <span className="mp-topbar-active-title">
              {styleLabTitle ?? 'Style Lab'}
            </span>
            <span className="mp-chip">
              {styleLabRatioLabel ?? '1920×1080 • 16:9 HD'}
            </span>
            <span
              className="mp-chip mp-chip-fps"
              title="Podgląd kierunku plastycznego w 60 FPS"
            >
              <span className={`mp-fps-dot ${isPlaying ? 'is-playing' : ''}`} />
              {isPlaying ? `${measuredFps} FPS` : '60 FPS'}
            </span>
          </>
        ) : activeComposition ? (
          <>
            <span className="mp-topbar-active-title">
              {activeComposition.title}
            </span>

            {ratioLabel && <span className="mp-chip">{ratioLabel}</span>}

            <span
              className="mp-chip mp-chip-fps"
              title="Częstotliwość odświeżania sceny"
            >
              <span className={`mp-fps-dot ${isPlaying ? 'is-playing' : ''}`} />
              {isPlaying ? `${measuredFps} FPS` : `${targetFps} FPS`}
            </span>
          </>
        ) : (
          <span className="mp-chip mp-chip-fps">
            <span className="mp-fps-dot" />
            60 FPS Studio
          </span>
        )}
      </div>
    </header>
  );
};
