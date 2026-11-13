import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clapperboard,
  CopyPlus,
  Folder,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  isBuiltInStyleId,
  isVerticalComposition,
  type StudioCompositionEntry,
  type StylePreset,
} from '@make-pictures/core';
import type { OriginFilterMode } from './LeftSidebar';

export type ProjectPickerViewMode = 'films' | 'styles';

export interface ProjectPickerPopoverProps {
  isOpen?: boolean;
  onClose: () => void;
  viewMode?: ProjectPickerViewMode;
  compositions?: StudioCompositionEntry[];
  activeComposition?: StudioCompositionEntry | null;
  onSelectComposition?: (id: string) => void;
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
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const EMPTY_COMPOSITIONS: StudioCompositionEntry[] = [];
const EMPTY_STYLES: StylePreset[] = [];
const EMPTY_WARNINGS: string[] = [];

function suggestCustomSlug(baseId: string, existingIds: Set<string>): string {
  const stem =
    baseId.replace(/-custom(-\d+)?$/, '').slice(0, 48) || 'moj-styl';
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

interface FlatFilmItem {
  kind: 'film';
  comp: StudioCompositionEntry;
}

interface FlatStyleItem {
  kind: 'style';
  preset: StylePreset;
  origin: 'custom' | 'built-in';
}

type FlatPopoverItem = FlatFilmItem | FlatStyleItem;

export const ProjectPickerPopover: React.FC<ProjectPickerPopoverProps> = ({
  isOpen = true,
  onClose,
  viewMode = 'films',
  compositions = EMPTY_COMPOSITIONS,
  activeComposition = null,
  onSelectComposition,
  builtInStyles,
  customStyles = EMPTY_STYLES,
  activeStyleId,
  activeStyle,
  styleWarnings = EMPTY_WARNINGS,
  isSavingStyle = false,
  onSelectStyle,
  onDuplicateStyle,
  onRefreshStyles,
}) => {
  const [query, setQuery] = useState<string>('');
  const [originFilter, setOriginFilter] = useState<OriginFilterMode>('all');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);
  const [draftSlug, setDraftSlug] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dupInputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const resolvedBuiltInStyles = useMemo<StylePreset[]>(
    () =>
      builtInStyles ?? BUILT_IN_STYLE_IDS.map((id) => BUILT_IN_STYLES[id]),
    [builtInStyles]
  );

  const resolvedActiveStyle = useMemo<StylePreset>(() => {
    if (activeStyle) return activeStyle;
    if (activeStyleId) {
      const customMatch = customStyles.find((s) => s.id === activeStyleId);
      if (customMatch) return customMatch;
      if (isBuiltInStyleId(activeStyleId)) {
        return BUILT_IN_STYLES[activeStyleId];
      }
    }
    return resolvedBuiltInStyles[0] ?? BUILT_IN_STYLES['minimal-product'];
  }, [activeStyle, activeStyleId, customStyles, resolvedBuiltInStyles]);

  const resolvedActiveStyleId = activeStyleId ?? resolvedActiveStyle.id;

  const counts = useMemo(() => {
    let examples = 0;
    let productions = 0;
    for (const comp of compositions) {
      if ((comp.origin ?? 'example') === 'production') {
        productions += 1;
      } else {
        examples += 1;
      }
    }
    return { all: compositions.length, productions, examples };
  }, [compositions]);

  const effectiveOriginFilter: OriginFilterMode =
    counts.examples === 0 ? 'all' : originFilter;

  const queryTokens = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return trimmed ? trimmed.split(/\s+/) : [];
  }, [query]);

  // ==================== FILMS FILTERING & GROUPING ====================
  const filteredCompositions = useMemo(() => {
    return compositions.filter((comp) => {
      if (
        effectiveOriginFilter !== 'all' &&
        (comp.origin ?? 'example') !== effectiveOriginFilter
      ) {
        return false;
      }
      if (queryTokens.length === 0) return true;
      const haystack = [
        comp.title,
        comp.subtitle,
        comp.id,
        comp.group,
        comp.kit,
      ]
        .join(' ')
        .toLowerCase();
      return queryTokens.every((token) => haystack.includes(token));
    });
  }, [compositions, effectiveOriginFilter, queryTokens]);

  const groupedCompositions = useMemo(() => {
    const map = new Map<string, StudioCompositionEntry[]>();
    for (const comp of filteredCompositions) {
      const list = map.get(comp.group) ?? [];
      list.push(comp);
      map.set(comp.group, list);
    }
    return Array.from(map.entries());
  }, [filteredCompositions]);

  // ==================== STYLES FILTERING & GROUPING ====================
  const matchesStyleQuery = useCallback(
    (preset: StylePreset): boolean => {
      if (queryTokens.length === 0) return true;
      const haystack = [
        preset.name,
        preset.id,
        preset.description,
        preset.typography.displayFont,
        preset.typography.bodyFont,
        preset.typography.monoFont,
        ...preset.recommendedFor,
      ]
        .join(' ')
        .toLowerCase();
      return queryTokens.every((token) => haystack.includes(token));
    },
    [queryTokens]
  );

  const filteredCustomStyles = useMemo(
    () => customStyles.filter(matchesStyleQuery),
    [customStyles, matchesStyleQuery]
  );

  const filteredBuiltInStyles = useMemo(
    () => resolvedBuiltInStyles.filter(matchesStyleQuery),
    [resolvedBuiltInStyles, matchesStyleQuery]
  );

  // ==================== FLAT LIST FOR KEYBOARD NAVIGATION ====================
  const flatItems = useMemo<FlatPopoverItem[]>(() => {
    if (viewMode === 'styles') {
      const list: FlatPopoverItem[] = [];
      for (const preset of filteredCustomStyles) {
        list.push({ kind: 'style', preset, origin: 'custom' });
      }
      for (const preset of filteredBuiltInStyles) {
        list.push({ kind: 'style', preset, origin: 'built-in' });
      }
      return list;
    }

    const list: FlatPopoverItem[] = [];
    for (const [, groupItems] of groupedCompositions) {
      for (const comp of groupItems) {
        list.push({ kind: 'film', comp });
      }
    }
    return list;
  }, [viewMode, filteredCustomStyles, filteredBuiltInStyles, groupedCompositions]);

  const findActiveFlatIndex = useCallback(
    (items: FlatPopoverItem[]): number => {
      if (items.length === 0) return 0;
      const idx = items.findIndex((entry) =>
        entry.kind === 'film'
          ? entry.comp.id === activeComposition?.id
          : entry.preset.id === resolvedActiveStyleId
      );
      return idx >= 0 ? idx : 0;
    },
    [activeComposition?.id, resolvedActiveStyleId]
  );

  // Reset transient state when opened or mode changes
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setIsDuplicating(false);
    setLocalError(null);
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, viewMode]);

  // Keep focusedIndex aligned with active selection / filtered list bounds
  useEffect(() => {
    if (!isOpen) return;
    setFocusedIndex((prev) => {
      if (flatItems.length === 0) return 0;
      if (queryTokens.length > 0) {
        return 0;
      }
      if (prev >= 0 && prev < flatItems.length) {
        return prev;
      }
      return findActiveFlatIndex(flatItems);
    });
  }, [isOpen, flatItems, queryTokens.length, findActiveFlatIndex]);

  useEffect(() => {
    if (!isOpen) return;
    setFocusedIndex(findActiveFlatIndex(flatItems));
    // Intentionally sync initial active index when opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const clampedFocusedIndex =
    flatItems.length === 0
      ? -1
      : Math.min(Math.max(focusedIndex, 0), flatItems.length - 1);

  useEffect(() => {
    if (!isOpen || clampedFocusedIndex < 0) return;
    const node = itemRefs.current[clampedFocusedIndex];
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, clampedFocusedIndex]);

  // Close on Escape globally while open
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [isOpen, onClose]);

  const selectFlatItem = useCallback(
    (entry: FlatPopoverItem | undefined) => {
      if (!entry) return;
      if (entry.kind === 'film') {
        onSelectComposition?.(entry.comp.id);
        onClose();
      } else {
        onSelectStyle?.(entry.preset.id);
        onClose();
      }
    },
    [onSelectComposition, onSelectStyle, onClose]
  );

  const handlePopoverKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    // Do not hijack Enter/Arrow keys when typing inside the duplicate slug input
    if (
      dupInputRef.current &&
      e.target === dupInputRef.current &&
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowUp'
    ) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setFocusedIndex((prev) => (prev + 1) % flatItems.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setFocusedIndex(
          (prev) => (prev - 1 + flatItems.length) % flatItems.length
        );
      }
      return;
    }

    if (e.key === 'Enter' && e.target === searchInputRef.current) {
      if (clampedFocusedIndex >= 0 && flatItems[clampedFocusedIndex]) {
        e.preventDefault();
        selectFlatItem(flatItems[clampedFocusedIndex]);
      }
    }
  };

  const openDuplicateForm = () => {
    const taken = new Set(customStyles.map((s) => s.id));
    setDraftSlug(suggestCustomSlug(resolvedActiveStyle.id, taken));
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
    if (!onDuplicateStyle) return;
    setLocalError(null);
    await onDuplicateStyle(cleaned, resolvedActiveStyle);
    setIsDuplicating(false);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  itemRefs.current = [];
  let runningFlatIdx = 0;

  const renderStylePopoverItem = (
    preset: StylePreset,
    origin: 'custom' | 'built-in'
  ) => {
    const itemIndex = runningFlatIdx++;
    const isActive = preset.id === resolvedActiveStyleId;
    const isFocused = itemIndex === clampedFocusedIndex;

    return (
      <button
        key={`${origin}:${preset.id}`}
        ref={(el) => {
          itemRefs.current[itemIndex] = el;
        }}
        type="button"
        className={`mp-popover-item ${isActive ? 'is-active' : ''} ${
          isFocused ? 'is-focused' : ''
        }`}
        onMouseEnter={() => setFocusedIndex(itemIndex)}
        onClick={() => {
          onSelectStyle?.(preset.id);
          onClose();
        }}
      >
        <span
          style={{
            width: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--mp-accent)',
          }}
          aria-hidden="true"
        >
          {isActive ? <Check size={15} strokeWidth={2.5} /> : null}
        </span>

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

        <div className="mp-popover-item-main">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              minWidth: 0,
            }}
          >
            <span className="mp-popover-item-title">{preset.name}</span>
            <code className="mp-style-slug">{preset.id}</code>
          </div>
          <div className="mp-style-font-pair">
            <Type size={10.5} style={{ flexShrink: 0 }} />
            <span>
              {preset.typography.displayFont} + {preset.typography.bodyFont}
            </span>
          </div>
          <div className="mp-popover-item-sub">{preset.description}</div>
        </div>

        <div className="mp-comp-badges">
          {origin === 'custom' && (
            <span className="mp-mini-badge is-prod">WŁASNY</span>
          )}
          {preset.surface.isDark && (
            <span className="mp-mini-badge is-dark">DARK</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      <div
        className="mp-popover-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="mp-project-popover"
        role="dialog"
        aria-modal="true"
        aria-label={
          viewMode === 'styles'
            ? 'Katalog stylów (Style Lab)'
            : 'Wybór projektu i kompozycji'
        }
        onKeyDown={handlePopoverKeyDown}
      >
        <div className="mp-sheet-grabber" aria-hidden="true" />

        {/* ==================== SEARCH HEADER ==================== */}
        <div className="mp-popover-search-wrap">
          <Search
            size={15}
            style={{ flexShrink: 0, color: 'var(--mp-text-muted)' }}
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="text"
            className="mp-popover-search"
            autoFocus
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              viewMode === 'styles'
                ? 'Szukaj stylu, slugu, fontu lub zastosowania…'
                : 'Szukaj filmu, podtytułu, grupy, kitu lub ID…'
            }
            aria-label={
              viewMode === 'styles' ? 'Szukaj stylu' : 'Szukaj kompozycji'
            }
          />

          {query.length > 0 && (
            <button
              type="button"
              className="mp-icon-btn is-ghost"
              style={{ width: 26, height: 26, padding: 0 }}
              onClick={() => {
                setQuery('');
                searchInputRef.current?.focus();
              }}
              aria-label="Wyczyść wyszukiwanie"
              title="Wyczyść wyszukiwanie"
            >
              <X size={13} />
            </button>
          )}

          {viewMode === 'styles' && onRefreshStyles && (
            <button
              type="button"
              className="mp-icon-btn is-ghost"
              style={{ height: 26, padding: '0 7px' }}
              onClick={onRefreshStyles}
              title="Odśwież pliki styles/*.style.json z dysku"
              aria-label="Odśwież style z dysku"
            >
              <RefreshCw size={13} />
            </button>
          )}

          <kbd className="mp-project-kbd" aria-hidden="true">
            ESC
          </kbd>
        </div>

        {/* ==================== MODE 1: FILMS ==================== */}
        {viewMode === 'films' ? (
          <>
            {counts.examples > 0 && (
              <div className="mp-popover-tabs">
                <div
                  className="mp-segmented is-full"
                  role="tablist"
                  aria-label="Filtr źródła kompozycji"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectiveOriginFilter === 'all'}
                    className={`mp-segmented-btn ${
                      effectiveOriginFilter === 'all' ? 'is-active' : ''
                    }`}
                    onClick={() => setOriginFilter('all')}
                  >
                    <span>Wszystkie</span>
                    <span className="mp-origin-count">{counts.all}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectiveOriginFilter === 'production'}
                    className={`mp-segmented-btn ${
                      effectiveOriginFilter === 'production' ? 'is-active' : ''
                    }`}
                    onClick={() => setOriginFilter('production')}
                  >
                    <span>Produkcje</span>
                    <span className="mp-origin-count">
                      {counts.productions}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectiveOriginFilter === 'example'}
                    className={`mp-segmented-btn ${
                      effectiveOriginFilter === 'example' ? 'is-active' : ''
                    }`}
                    onClick={() => setOriginFilter('example')}
                  >
                    <span>Przykłady</span>
                    <span className="mp-origin-count">{counts.examples}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="mp-popover-list">
              {groupedCompositions.length === 0 ? (
                <div className="mp-empty-capsule-card">
                  <Clapperboard
                    size={20}
                    style={{ color: 'var(--mp-accent)' }}
                    aria-hidden="true"
                  />
                  <div className="mp-empty-capsule-title">
                    {compositions.length === 0
                      ? 'Brak kapsuł w productions/'
                      : `Brak wyników dla „${query.trim() || effectiveOriginFilter}”`}
                  </div>
                  <p className="mp-empty-capsule-desc">
                    {compositions.length === 0
                      ? 'Utwórz odizolowany projekt filmowy z terminala:'
                      : 'Zmień frazę wyszukiwania lub utwórz nowy film:'}
                  </p>
                  <code className="mp-empty-capsule-cmd">
                    npx make-pictures new moj-film
                  </code>
                </div>
              ) : (
                groupedCompositions.map(([groupName, items]) => (
                  <div key={groupName}>
                    <div className="mp-popover-group-label">
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Folder size={12} aria-hidden="true" />
                        <span>{groupName}</span>
                      </span>
                      <span className="mp-tabular">{items.length}</span>
                    </div>

                    {items.map((comp) => {
                      const itemIndex = runningFlatIdx++;
                      const isActive = comp.id === activeComposition?.id;
                      const isFocused = itemIndex === clampedFocusedIndex;
                      const isVertical = isVerticalComposition(comp);
                      const isProd = (comp.origin ?? 'example') === 'production';
                      const seconds = (
                        comp.durationInFrames / (comp.fps || 60)
                      ).toFixed(1);

                      return (
                        <button
                          key={comp.id}
                          ref={(el) => {
                            itemRefs.current[itemIndex] = el;
                          }}
                          type="button"
                          className={`mp-popover-item ${
                            isActive ? 'is-active' : ''
                          } ${isFocused ? 'is-focused' : ''}`}
                          onMouseEnter={() => setFocusedIndex(itemIndex)}
                          onClick={() => {
                            onSelectComposition?.(comp.id);
                            onClose();
                          }}
                        >
                          <span
                            style={{
                              width: 16,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: 'var(--mp-accent)',
                            }}
                            aria-hidden="true"
                          >
                            {isActive ? (
                              <Check size={15} strokeWidth={2.5} />
                            ) : null}
                          </span>

                          <div className="mp-popover-item-main">
                            <span className="mp-popover-item-title">
                              {comp.title}
                            </span>
                            <span className="mp-popover-item-sub mp-tabular">
                              {comp.subtitle} • {seconds}s
                            </span>
                          </div>

                          <div className="mp-comp-badges">
                            {isProd && (
                              <span className="mp-mini-badge is-prod">PROD</span>
                            )}
                            {comp.usesThree && (
                              <span className="mp-mini-badge is-3d">3D</span>
                            )}
                            <span
                              className={`mp-mini-badge ${
                                isVertical ? 'is-vertical' : ''
                              }`}
                            >
                              {isVertical ? '9:16' : '16:9'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="mp-popover-footer">
              <span>↑↓ nawigacja • ↵ wybierz • ESC zamknij</span>
              <span className="mp-tabular">
                {filteredCompositions.length} / {compositions.length} kompozycji
              </span>
            </div>
          </>
        ) : (
          /* ==================== MODE 2: STYLE LAB CATALOG ==================== */
          <>
            <div className="mp-popover-list">
              {/* Custom Workspace Styles */}
              <div>
                <div className="mp-popover-group-label">
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Sparkles
                      size={12}
                      style={{ color: 'var(--mp-emerald)' }}
                      aria-hidden="true"
                    />
                    <span>Twoje style (styles/*.style.json)</span>
                  </span>
                  <span className="mp-tabular">
                    {filteredCustomStyles.length}
                  </span>
                </div>

                {customStyles.length === 0 && queryTokens.length === 0 ? (
                  <div className="mp-style-empty-note" style={{ margin: '4px 6px 8px' }}>
                    Brak własnych plików w <code>styles/*.style.json</code>.
                    Wybierz dowolny styl bazowy i kliknij{' '}
                    <strong>„+ Duplikuj jako własny styl”</strong> poniżej.
                  </div>
                ) : (
                  filteredCustomStyles.map((preset) =>
                    renderStylePopoverItem(preset, 'custom')
                  )
                )}
              </div>

              {/* Built-In Styles */}
              <div>
                <div className="mp-popover-group-label">
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Palette
                      size={12}
                      style={{ color: 'var(--mp-accent)' }}
                      aria-hidden="true"
                    />
                    <span>
                      Style wbudowane ({resolvedBuiltInStyles.length})
                    </span>
                  </span>
                  <span className="mp-tabular">
                    {filteredBuiltInStyles.length}
                  </span>
                </div>

                {filteredBuiltInStyles.map((preset) =>
                  renderStylePopoverItem(preset, 'built-in')
                )}
              </div>

              {queryTokens.length > 0 &&
                filteredCustomStyles.length === 0 &&
                filteredBuiltInStyles.length === 0 && (
                  <div className="mp-empty-capsule-card">
                    <Palette
                      size={20}
                      style={{ color: 'var(--mp-accent)' }}
                      aria-hidden="true"
                    />
                    <div className="mp-empty-capsule-title">
                      Brak stylów pasujących do „{query.trim()}”
                    </div>
                    <p className="mp-empty-capsule-desc">
                      Szukaj po nazwie, slugu, kroju pisma (np. Playfair, Inter)
                      lub tagach zastosowań.
                    </p>
                  </div>
                )}

              {styleWarnings.length > 0 && (
                <div
                  className="mp-style-warning-box"
                  style={{ margin: '6px 6px 2px' }}
                >
                  {styleWarnings.map((warning, idx) => (
                    <div key={idx}>{warning}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="mp-popover-footer">
              {!isDuplicating ? (
                <>
                  <button
                    type="button"
                    className="mp-icon-btn is-primary"
                    disabled={isSavingStyle || !onDuplicateStyle}
                    onClick={openDuplicateForm}
                  >
                    <CopyPlus size={13} />
                    <span>+ Duplikuj jako własny styl</span>
                  </button>
                  <span>
                    Bazowy: <code>{resolvedActiveStyle.id}</code>
                  </span>
                </>
              ) : (
                <form
                  onSubmit={(e) => void handleConfirmDuplicate(e)}
                  className="mp-style-dup-form"
                  style={{ width: '100%' }}
                >
                  <label
                    htmlFor="mp-popover-dup-style-slug"
                    className="mp-field-label"
                    style={{ fontSize: 11.5 }}
                  >
                    Nowy identyfikator (
                    <code>styles/&lt;slug&gt;.style.json</code>):
                  </label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      ref={dupInputRef}
                      id="mp-popover-dup-style-slug"
                      type="text"
                      className="mp-input-text"
                      style={{
                        flex: 1,
                        fontFamily: 'var(--mp-font-mono)',
                        fontSize: 12,
                      }}
                      value={draftSlug}
                      autoFocus
                      spellCheck={false}
                      placeholder="np. kronika-neapolu"
                      onChange={(e) => {
                        setDraftSlug(e.target.value);
                        setLocalError(null);
                      }}
                    />
                    <button
                      type="submit"
                      className="mp-icon-btn is-primary"
                      style={{ height: 32, fontSize: 11.5 }}
                      disabled={isSavingStyle}
                    >
                      Utwórz styl
                    </button>
                    <button
                      type="button"
                      className="mp-icon-btn"
                      style={{ height: 32, fontSize: 11.5 }}
                      onClick={() => {
                        setIsDuplicating(false);
                        setLocalError(null);
                        searchInputRef.current?.focus();
                      }}
                    >
                      Anuluj
                    </button>
                  </div>
                  {localError && (
                    <div className="mp-style-inline-err">{localError}</div>
                  )}
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};
