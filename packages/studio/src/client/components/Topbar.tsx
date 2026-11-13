import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  Film,
  Monitor,
  Moon,
  Palette,
  PanelRight,
  Sun,
} from 'lucide-react';
import {
  isVerticalComposition,
  type StudioCompositionEntry,
  type StylePreset,
} from '@make-pictures/core';
import type { StudioThemeMode } from '../hooks/useStudioTheme';
import { BrandLogo } from './BrandLogo';
import { ProjectPickerPopover } from './ProjectPickerPopover';

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
  builtInStyles?: StylePreset[];
  customStyles?: StylePreset[];
  activeStyleId?: string;
  activeStyle?: StylePreset;
  styleWarnings?: string[];
  isSavingStyle?: boolean;
  onSelectStyle?: (styleId: string) => void;
  onDuplicateStyle?: (
    newSlug: string,
    sourceStyle: StylePreset
  ) => Promise<void> | void;
  onRefreshStyles?: () => void;
  isDirty?: boolean;
  themeMode?: StudioThemeMode;
  resolvedTheme?: 'light' | 'dark';
  onCycleTheme?: () => void;
  onChangeThemeMode?: (mode: StudioThemeMode) => void;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

function getThemeTooltip(mode: StudioThemeMode): string {
  switch (mode) {
    case 'light':
      return 'Motyw: Jasny';
    case 'dark':
      return 'Motyw: Ciemny';
    case 'system':
    default:
      return 'Motyw: Systemowy (macOS/iOS)';
  }
}

export const Topbar: React.FC<TopbarProps> = ({
  compositions,
  activeComposition,
  onSelectComposition,
  measuredFps,
  isPlaying,
  viewMode = 'films',
  onChangeViewMode,
  styleLabTitle,
  styleLabRatioLabel,
  builtInStyles,
  customStyles,
  activeStyleId,
  activeStyle,
  styleWarnings,
  isSavingStyle,
  onSelectStyle,
  onDuplicateStyle,
  onRefreshStyles,
  isDirty = false,
  themeMode = 'system',
  resolvedTheme,
  onCycleTheme,
  onChangeThemeMode,
  inspectorOpen,
  onToggleInspector,
}) => {
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  const isStylesView = viewMode === 'styles';
  const isVertical = activeComposition
    ? isVerticalComposition(activeComposition)
    : false;
  const targetFps = isStylesView ? 60 : (activeComposition?.fps ?? 60);

  // Close popover if viewMode switches externally
  useEffect(() => {
    setPopoverOpen(false);
  }, [viewMode]);

  // Global ⌘K / Ctrl+K shortcut to toggle Project / Style Picker Popover
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'k'
      ) {
        if (e.defaultPrevented) return;
        if (
          !popoverOpen &&
          typeof document !== 'undefined' &&
          document.querySelector(
            '.mp-qa-modal-backdrop, [role="dialog"]:not(.mp-project-popover)'
          )
        ) {
          return;
        }
        e.preventDefault();
        setPopoverOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popoverOpen]);

  const showThemeControl = Boolean(onCycleTheme || onChangeThemeMode);
  const themeTooltip = getThemeTooltip(themeMode);

  const handleThemeButtonClick = () => {
    if (onCycleTheme) {
      onCycleTheme();
      return;
    }
    if (onChangeThemeMode) {
      const nextMode: StudioThemeMode =
        themeMode === 'system'
          ? 'light'
          : themeMode === 'light'
            ? 'dark'
            : 'system';
      onChangeThemeMode(nextMode);
    }
  };

  const stylesTriggerTitle =
    activeStyle?.name ?? styleLabTitle ?? 'Style Lab';
  const filmsTriggerTitle = activeComposition?.title ?? 'Wybierz projekt';

  return (
    <>
      <header className="mp-topbar">
        {/* ==================== ZONE 1: LEFT (LOGO + PROJECT / STYLE TRIGGER) ==================== */}
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

          <span className="mp-topbar-divider" aria-hidden="true" />

          <button
            type="button"
            className={`mp-project-trigger ${popoverOpen ? 'is-open' : ''}`}
            aria-expanded={popoverOpen}
            aria-haspopup="dialog"
            onClick={() => setPopoverOpen((prev) => !prev)}
            title={
              isStylesView
                ? `${stylesTriggerTitle}${
                    styleLabRatioLabel ? ` • ${styleLabRatioLabel}` : ''
                  } (⌘K)`
                : `${filmsTriggerTitle} (⌘K)`
            }
          >
            {isStylesView ? (
              <>
                {activeStyle ? (
                  <span
                    className="mp-style-swatches"
                    style={{ gap: 3, flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <span
                      className="mp-style-swatch"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: activeStyle.palette.bgCanvas,
                      }}
                    />
                    <span
                      className="mp-style-swatch"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: activeStyle.palette.accentPrimary,
                      }}
                    />
                    <span
                      className="mp-style-swatch"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: activeStyle.palette.accentSecondary,
                      }}
                    />
                  </span>
                ) : (
                  <Palette
                    size={14}
                    style={{ flexShrink: 0, color: 'var(--mp-accent)' }}
                    aria-hidden="true"
                  />
                )}

                <span className="mp-project-trigger-title">
                  {stylesTriggerTitle}
                </span>

                {isDirty && (
                  <span
                    className="mp-project-trigger-dot"
                    title="Niezapisane zmiany stylu"
                    aria-label="Niezapisane zmiany stylu"
                  />
                )}
              </>
            ) : (
              <>
                <Film
                  size={14}
                  style={{ flexShrink: 0, color: 'var(--mp-accent)' }}
                  aria-hidden="true"
                />

                <span className="mp-project-trigger-title">
                  {filmsTriggerTitle}
                </span>

                {activeComposition && (
                  <span
                    className={`mp-mini-badge ${
                      isVertical ? 'is-vertical' : ''
                    }`}
                  >
                    {isVertical ? '9:16' : '16:9'}
                  </span>
                )}

                {isDirty && (
                  <span
                    className="mp-project-trigger-dot"
                    title="Niezapisane zmiany parametrów"
                    aria-label="Niezapisane zmiany parametrów"
                  />
                )}
              </>
            )}

            <ChevronDown
              size={13}
              style={{
                flexShrink: 0,
                color: 'var(--mp-text-muted)',
                transform: popoverOpen ? 'rotate(180deg)' : undefined,
                transition: 'transform 0.16s ease',
              }}
              aria-hidden="true"
            />

            <kbd className="mp-project-kbd">⌘K</kbd>
          </button>
        </div>

        {/* ==================== ZONE 2: CENTER (APPLE SEGMENTED VIEW SWITCHER) ==================== */}
        <div className="mp-topbar-center">
          <nav
            className="mp-view-switcher mp-segmented"
            aria-label="Przełącznik widoku Studio"
          >
            <button
              type="button"
              className={`mp-view-tab mp-segmented-btn ${
                viewMode === 'films' ? 'is-active' : ''
              }`}
              aria-pressed={viewMode === 'films'}
              onClick={() => onChangeViewMode?.('films')}
            >
              <Film size={13} aria-hidden="true" />
              <span>Filmy</span>
            </button>
            <button
              type="button"
              className={`mp-view-tab mp-segmented-btn ${
                viewMode === 'styles' ? 'is-active' : ''
              }`}
              aria-pressed={viewMode === 'styles'}
              onClick={() => onChangeViewMode?.('styles')}
            >
              <Palette size={13} aria-hidden="true" />
              <span>Style Lab</span>
            </button>
          </nav>
        </div>

        {/* ==================== ZONE 3: RIGHT (FPS TELEMETRY, THEME, INSPECTOR) ==================== */}
        <div className="mp-topbar-right">
          <span
            className="mp-chip mp-chip-fps mp-tabular"
            title={
              isStylesView
                ? 'Podgląd kierunku plastycznego w 60 FPS'
                : 'Częstotliwość odświeżania sceny'
            }
          >
            <span className={`mp-fps-dot ${isPlaying ? 'is-playing' : ''}`} />
            {`${isPlaying ? measuredFps : targetFps} FPS`}
          </span>

          {showThemeControl && (
            <button
              type="button"
              className="mp-icon-btn"
              style={{ width: 30, padding: 0 }}
              onClick={handleThemeButtonClick}
              title={themeTooltip}
              aria-label={themeTooltip}
              data-theme-mode={themeMode}
              data-resolved-theme={resolvedTheme}
            >
              {themeMode === 'light' ? (
                <Sun size={14} aria-hidden="true" />
              ) : themeMode === 'dark' ? (
                <Moon size={14} aria-hidden="true" />
              ) : (
                <Monitor size={14} aria-hidden="true" />
              )}
            </button>
          )}

          {onToggleInspector && (
            <button
              type="button"
              className={`mp-icon-btn ${inspectorOpen ? 'is-active' : ''}`}
              style={{ position: 'relative', width: 30, padding: 0 }}
              aria-pressed={Boolean(inspectorOpen)}
              aria-label="Inspektor parametrów (⌘I)"
              title="Inspektor parametrów (⌘I)"
              onClick={onToggleInspector}
            >
              <PanelRight size={15} aria-hidden="true" />
              {isDirty && !inspectorOpen && (
                <span
                  className="mp-project-trigger-dot"
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    width: 6,
                    height: 6,
                  }}
                  aria-hidden="true"
                />
              )}
            </button>
          )}
        </div>
      </header>

      <ProjectPickerPopover
        isOpen={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        viewMode={viewMode}
        compositions={compositions}
        activeComposition={activeComposition}
        onSelectComposition={onSelectComposition}
        builtInStyles={builtInStyles}
        customStyles={customStyles}
        activeStyleId={activeStyleId}
        activeStyle={activeStyle}
        styleWarnings={styleWarnings}
        isSavingStyle={isSavingStyle}
        onSelectStyle={onSelectStyle}
        onDuplicateStyle={onDuplicateStyle}
        onRefreshStyles={onRefreshStyles}
      />
    </>
  );
};
