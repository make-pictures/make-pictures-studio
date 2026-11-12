import React, { useEffect, useState } from 'react';
import { CopyPlus, Palette, RefreshCw, Sparkles, Type } from 'lucide-react';
import { isBuiltInStyleId, type StylePreset } from '@make-pictures/core';

export interface StudioStyleCatalogItem {
  preset: StylePreset;
  origin: 'built-in' | 'custom';
}

export interface StyleCatalogSidebarProps {
  builtInStyles: StylePreset[];
  customStyles: StylePreset[];
  activeStyleId: string;
  activeStyle: StylePreset;
  isSaving?: boolean;
  warnings?: string[];
  onSelectStyle: (styleId: string) => void;
  onDuplicateAsCustom: (newSlug: string, sourceStyle: StylePreset) => Promise<void> | void;
  onRefreshStyles?: () => void;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

function suggestCustomSlug(baseId: string, existingIds: Set<string>): string {
  const stem = baseId.replace(/-custom(-\d+)?$/, '').slice(0, 48) || 'moj-styl';
  const first = `${stem}-custom`;
  if (!existingIds.has(first) && !isBuiltInStyleId(first)) return first;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${stem}-custom-${i}`;
    if (!existingIds.has(candidate) && !isBuiltInStyleId(candidate)) {
      return candidate;
    }
  }
  return `${stem}-${Date.now().toString(36).slice(-4)}`;
}

export const StyleCatalogSidebar: React.FC<StyleCatalogSidebarProps> = ({
  builtInStyles,
  customStyles,
  activeStyleId,
  activeStyle,
  isSaving = false,
  warnings = [],
  onSelectStyle,
  onDuplicateAsCustom,
  onRefreshStyles,
}) => {
  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);
  const [draftSlug, setDraftSlug] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLocalError(null);
  }, [activeStyleId]);

  const openDuplicateForm = () => {
    const taken = new Set(customStyles.map((s) => s.id));
    setDraftSlug(suggestCustomSlug(activeStyle.id, taken));
    setLocalError(null);
    setIsDuplicating(true);
  };

  const handleConfirmDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftSlug.trim().toLowerCase();
    if (!SLUG_RE.test(cleaned)) {
      setLocalError(
        'Użyj małych liter, cyfr i myślników (np. kronika-neapolu).'
      );
      return;
    }
    if (isBuiltInStyleId(cleaned)) {
      setLocalError(
        `Identyfikator „${cleaned}” jest zarezerwowany dla stylu wbudowanego.`
      );
      return;
    }
    setLocalError(null);
    await onDuplicateAsCustom(cleaned, activeStyle);
    setIsDuplicating(false);
  };

  const renderStyleCard = (preset: StylePreset, origin: 'built-in' | 'custom') => {
    const isActive = preset.id === activeStyleId;
    return (
      <button
        key={`${origin}:${preset.id}`}
        type="button"
        className={`mp-style-card ${isActive ? 'is-active' : ''}`}
        onClick={() => onSelectStyle(preset.id)}
      >
        <div className="mp-style-card-top">
          <div className="mp-style-swatches" aria-hidden="true">
            <span
              className="mp-style-swatch"
              style={{ backgroundColor: preset.palette.bgCanvas }}
              title={`bgCanvas: ${preset.palette.bgCanvas}`}
            />
            <span
              className="mp-style-swatch"
              style={{ backgroundColor: preset.palette.accentPrimary }}
              title={`accentPrimary: ${preset.palette.accentPrimary}`}
            />
            <span
              className="mp-style-swatch"
              style={{ backgroundColor: preset.palette.accentSecondary }}
              title={`accentSecondary: ${preset.palette.accentSecondary}`}
            />
          </div>

          <div className="mp-comp-badges">
            {origin === 'custom' && (
              <span className="mp-mini-badge is-prod">WŁASNY</span>
            )}
            {preset.surface.isDark && (
              <span className="mp-mini-badge is-dark">DARK</span>
            )}
          </div>
        </div>

        <div className="mp-style-card-title-row">
          <span className="mp-comp-item-name">{preset.name}</span>
          <code className="mp-style-slug">{preset.id}</code>
        </div>

        <div className="mp-style-font-pair">
          <Type size={11} style={{ flexShrink: 0 }} />
          <span>
            {preset.typography.displayFont} + {preset.typography.bodyFont}
          </span>
        </div>

        <div className="mp-comp-item-sub">{preset.description}</div>

        {preset.recommendedFor.length > 0 && (
          <div className="mp-style-tags">
            {preset.recommendedFor.slice(0, 4).map((tag) => (
              <span key={tag} className="mp-style-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>
    );
  };

  return (
    <aside className="mp-sidebar-left">
      <div className="mp-panel-header">
        <span
          className="mp-panel-title"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Palette size={13} color="#FF2A85" />
          <span>Katalog stylów</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mp-mini-badge">
            {builtInStyles.length + customStyles.length}
          </span>
          {onRefreshStyles && (
            <button
              type="button"
              className="mp-icon-btn"
              style={{ height: 24, padding: '0 6px' }}
              onClick={onRefreshStyles}
              title="Odśwież pliki styles/*.style.json z dysku"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="mp-scroll-area">
        {/* ==================== CUSTOM WORKSPACE STYLES ==================== */}
        <div className="mp-group-block">
          <div className="mp-group-label">
            <Sparkles size={13} color="#10B981" />
            <span>Twoje style (styles/*.style.json)</span>
            <span className="mp-mini-badge" style={{ marginLeft: 'auto' }}>
              {customStyles.length}
            </span>
          </div>

          {customStyles.length === 0 ? (
            <div className="mp-style-empty-note">
              Brak własnych plików w <code>styles/*.style.json</code>. Wybierz
              dowolny styl bazowy i kliknij{' '}
              <strong>„+ Duplikuj jako własny styl”</strong>, aby zapisać
              własną paletę i typografię.
            </div>
          ) : (
            customStyles.map((preset) => renderStyleCard(preset, 'custom'))
          )}
        </div>

        {/* ==================== 7 BUILT-IN STYLES ==================== */}
        <div className="mp-group-block">
          <div className="mp-group-label">
            <Palette size={13} color="#2563EB" />
            <span>Style wbudowane ({builtInStyles.length})</span>
          </div>
          {builtInStyles.map((preset) => renderStyleCard(preset, 'built-in'))}
        </div>

        {warnings.length > 0 && (
          <div className="mp-style-warning-box">
            {warnings.map((w, idx) => (
              <div key={idx}>{w}</div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== DUPLICATE TO CUSTOM ACTION DOCK ==================== */}
      <div className="mp-audio-dock">
        {!isDuplicating ? (
          <button
            type="button"
            className="mp-icon-btn is-primary"
            style={{ width: '100%', height: 34, fontSize: 12 }}
            disabled={isSaving}
            onClick={openDuplicateForm}
          >
            <CopyPlus size={14} />
            <span>+ Duplikuj jako własny styl</span>
          </button>
        ) : (
          <form onSubmit={(e) => void handleConfirmDuplicate(e)} className="mp-style-dup-form">
            <label
              htmlFor="mp-dup-style-slug"
              className="mp-field-label"
              style={{ fontSize: 11.5 }}
            >
              Nowy identyfikator (<code>styles/&lt;slug&gt;.style.json</code>):
            </label>
            <input
              id="mp-dup-style-slug"
              type="text"
              className="mp-input-text"
              style={{ fontFamily: 'var(--mp-font-mono)', fontSize: 12 }}
              value={draftSlug}
              autoFocus
              spellCheck={false}
              placeholder="np. kronika-neapolu"
              onChange={(e) => {
                setDraftSlug(e.target.value);
                setLocalError(null);
              }}
            />
            {localError && (
              <div className="mp-style-inline-err">{localError}</div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="submit"
                className="mp-icon-btn is-primary"
                style={{ flex: 1, height: 30, fontSize: 11.5 }}
                disabled={isSaving}
              >
                Utwórz styl
              </button>
              <button
                type="button"
                className="mp-icon-btn"
                style={{ height: 30, fontSize: 11.5 }}
                onClick={() => {
                  setIsDuplicating(false);
                  setLocalError(null);
                }}
              >
                Anuluj
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
};
