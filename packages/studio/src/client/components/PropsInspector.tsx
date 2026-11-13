import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Braces,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Cpu,
  ExternalLink,
  FileJson,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sliders,
  X,
} from 'lucide-react';
import {
  listAllStudioStyles,
  type StudioCompositionEntry,
  type StylePreset,
} from '@make-pictures/core';
import {
  formatColorWithAlpha,
  getNestedValue,
  introspectPropsFallback,
  introspectZodObject,
  mergeSchemaWithExtraProps,
  parseRgbaOrHex,
  setNestedValue,
  type InspectorFieldSpec,
} from '../schema-form/zodIntrospect';
import type {
  InspectorTabId,
  SaveStudioScenePayload,
  StudioScenesResponse,
  StudioStatusResponse,
} from '../types';
import { SceneScriptEditor } from './SceneScriptEditor';

export interface PropsInspectorProps {
  composition: StudioCompositionEntry;
  liveProps: Record<string, unknown>;
  isDirty: boolean;
  isSaving: boolean;
  autoSave: boolean;
  saveError: string | null;
  lastSavedAt: string | null;
  onChangeProps: (nextProps: Record<string, unknown>) => void;
  onSave: () => void;
  onToggleAutoSave: () => void;
  onResetToDisk: () => void;
  mode?: 'films' | 'styles';
  availableStyles?: Array<{
    preset: StylePreset;
    origin: 'built-in' | 'custom';
  }>;
  onOpenStyleLab?: (styleId: string) => void;
  scenesResponse?: StudioScenesResponse | null;
  studioStatus?: StudioStatusResponse | null;
  onSaveScene?: (
    payload: SaveStudioScenePayload
  ) => Promise<{ ok: boolean; error?: string }>;
  onRefreshScenesAndStatus?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  styleSaveAsBanner?: React.ReactNode;
}

interface PaperTextureCacheStatsSnapshot {
  size: number;
  activeCount: number;
  maxEntries: number;
}

interface JsonValidationState {
  valid: boolean;
  message: string;
}

const TUPLE_AXES = ['X', 'Y', 'Z', 'W'] as const;

function clonePlainValue<T>(val: T): T {
  if (val === undefined || val === null || typeof val !== 'object') {
    return val;
  }
  return JSON.parse(JSON.stringify(val)) as T;
}

function deleteNestedKey(
  obj: Record<string, unknown>,
  path: string[]
): Record<string, unknown> {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const copy = { ...obj };
    delete copy[head];
    return copy;
  }
  const child = obj[head];
  if (!child || typeof child !== 'object' || Array.isArray(child)) {
    return obj;
  }
  return {
    ...obj,
    [head]: deleteNestedKey(child as Record<string, unknown>, rest),
  };
}

function formatNumberBadge(val: unknown, step?: number): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '0';
  if (step && step < 0.1) return val.toFixed(2);
  if (step && step < 1) return val.toFixed(1);
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

function validateParsedPropsObject(
  parsed: unknown,
  schema: StudioCompositionEntry['schema']
): JsonValidationState {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      message: 'Główny element musi być obiektem JSON { ... }.',
    };
  }
  if (schema) {
    const res = schema.safeParse(parsed);
    if (!res.success) {
      const issue = res.error.issues[0];
      const pathLabel =
        issue && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return {
        valid: false,
        message: `${pathLabel}${issue?.message ?? 'Błąd walidacji schematu Zod'}`,
      };
    }
    return {
      valid: true,
      message: 'Poprawny JSON • zgodny ze schematem Zod',
    };
  }
  return {
    valid: true,
    message: 'Poprawny obiekt JSON',
  };
}

interface InlineJsonFieldControlProps {
  inputId: string;
  value: unknown;
  onCommit: (nextVal: unknown) => void;
}

const InlineJsonFieldControl: React.FC<InlineJsonFieldControlProps> = ({
  inputId,
  value,
  onCommit,
}) => {
  const canonicalJson = useMemo(
    () => JSON.stringify(value ?? null, null, 2),
    [value]
  );
  const [draft, setDraft] = useState<string>(canonicalJson);
  const [parseError, setParseError] = useState<string | null>(null);
  const isFocusedRef = useRef<boolean>(false);
  const lastCommittedJsonRef = useRef<string>(canonicalJson);

  useEffect(() => {
    const incomingCompact = JSON.stringify(value ?? null);
    let lastCommittedCompact = '';
    try {
      lastCommittedCompact = JSON.stringify(
        JSON.parse(lastCommittedJsonRef.current)
      );
    } catch {
      lastCommittedCompact = '';
    }

    if (!isFocusedRef.current || incomingCompact !== lastCommittedCompact) {
      setDraft(canonicalJson);
      lastCommittedJsonRef.current = canonicalJson;
      setParseError(null);
    }
  }, [canonicalJson, value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <textarea
        id={inputId}
        className={`mp-textarea ${parseError ? 'is-invalid' : ''}`}
        rows={4}
        spellCheck={false}
        style={{
          fontFamily: 'var(--mp-font-mono)',
          fontSize: 11.5,
          lineHeight: 1.45,
          borderColor: parseError ? 'var(--mp-rose)' : undefined,
        }}
        value={draft}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          if (!parseError) {
            setDraft(canonicalJson);
          }
        }}
        onChange={(e) => {
          const nextText = e.target.value;
          setDraft(nextText);
          try {
            const parsed = JSON.parse(nextText) as unknown;
            setParseError(null);
            lastCommittedJsonRef.current = JSON.stringify(parsed, null, 2);
            onCommit(parsed);
          } catch (err) {
            setParseError(
              err instanceof Error ? err.message : 'Nieprawidłowa składnia JSON'
            );
          }
        }}
      />
      <div
        className={`mp-json-status ${parseError ? 'is-error' : 'is-valid'}`}
        style={{ padding: '4px 8px', fontSize: 10.5 }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            minWidth: 0,
          }}
        >
          {parseError ? (
            <AlertCircle size={11} style={{ flexShrink: 0 }} />
          ) : (
            <Check size={11} style={{ flexShrink: 0 }} />
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={parseError ?? 'Poprawna wartość JSON'}
          >
            {parseError ? `Błąd JSON: ${parseError}` : 'Poprawny JSON'}
          </span>
        </span>
      </div>
    </div>
  );
};

export const PropsInspector: React.FC<PropsInspectorProps> = ({
  composition,
  liveProps,
  isDirty,
  isSaving,
  autoSave,
  saveError,
  lastSavedAt,
  onChangeProps,
  onSave,
  onToggleAutoSave,
  onResetToDisk,
  mode = 'films',
  availableStyles,
  onOpenStyleLab,
  scenesResponse,
  studioStatus,
  onSaveScene,
  onRefreshScenesAndStatus,
  isMobileOpen = false,
  onCloseMobile,
  styleSaveAsBanner,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTabId>('params');
  const effectiveTab: InspectorTabId =
    mode === 'styles' && activeTab === 'script' ? 'params' : activeTab;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});

  // ==================== SCHEMA + SCHEMA-LESS SECTION DERIVATION ====================
  const baseSchemaSections = useMemo(
    () =>
      composition.schema
        ? introspectZodObject(composition.schema, composition.defaultProps)
        : null,
    [composition.schema, composition.defaultProps]
  );

  const sections = useMemo(() => {
    if (baseSchemaSections) {
      return mergeSchemaWithExtraProps(baseSchemaSections, liveProps);
    }
    const sample =
      Object.keys(liveProps).length > 0 ? liveProps : composition.defaultProps;
    return introspectPropsFallback(sample);
  }, [baseSchemaSections, liveProps, composition.defaultProps]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections
      .map((sec) => ({
        ...sec,
        fields: sec.fields.filter((f) => {
          if (f.label.toLowerCase().includes(normalizedQuery)) return true;
          if (f.key.toLowerCase().includes(normalizedQuery)) return true;
          if (f.section.toLowerCase().includes(normalizedQuery)) return true;
          if (
            f.options &&
            f.options.some((o) => o.toLowerCase().includes(normalizedQuery))
          ) {
            return true;
          }
          return false;
        }),
      }))
      .filter((sec) => sec.fields.length > 0);
  }, [sections, normalizedQuery]);

  const allCollapsed = useMemo(
    () =>
      filteredSections.length > 0 &&
      filteredSections.every((sec) => Boolean(collapsedSections[sec.title])),
    [filteredSections, collapsedSections]
  );

  const handleToggleAllSections = useCallback(() => {
    const nextCollapseState = !allCollapsed;
    const nextMap: Record<string, boolean> = {};
    for (const sec of sections) {
      nextMap[sec.title] = nextCollapseState;
    }
    setCollapsedSections(nextMap);
  }, [allCollapsed, sections]);

  const toggleSection = useCallback((title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  }, []);

  const stylesCatalog = useMemo(
    () => availableStyles ?? listAllStudioStyles(),
    [availableStyles]
  );

  // ==================== FALLBACK SCENES & SAVE HANDLERS ====================
  const [fallbackScenesResponse, setFallbackScenesResponse] =
    useState<StudioScenesResponse | null>(null);
  const [isLoadingFallbackScenes, setIsLoadingFallbackScenes] =
    useState<boolean>(false);

  const fetchFallbackScenes = useCallback(async () => {
    setIsLoadingFallbackScenes(true);
    try {
      const res = await fetch('/api/studio/scenes');
      if (!res.ok) return;
      const data = (await res.json()) as StudioScenesResponse;
      if (data && data.ok && Array.isArray(data.groups)) {
        setFallbackScenesResponse(data);
      }
    } catch {
      // Static / offline mode falls back to registered voiceover manifest
    } finally {
      setIsLoadingFallbackScenes(false);
    }
  }, []);

  useEffect(() => {
    if (
      mode === 'films' &&
      effectiveTab === 'script' &&
      scenesResponse === undefined
    ) {
      void fetchFallbackScenes();
    }
  }, [mode, effectiveTab, scenesResponse, fetchFallbackScenes]);

  const effectiveScenesResponse =
    scenesResponse !== undefined ? scenesResponse : fallbackScenesResponse;

  const handleSaveSceneInternal = useCallback(
    async (
      payload: SaveStudioScenePayload
    ): Promise<{ ok: boolean; error?: string }> => {
      if (onSaveScene) {
        return onSaveScene(payload);
      }
      try {
        const res = await fetch('/api/studio/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error ?? `Błąd zapisu sceny (HTTP ${res.status})`,
          };
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Nie udało się połączyć z serwerem lokalnym.',
        };
      }
    },
    [onSaveScene]
  );

  const handleRefreshScenesAndStatusInternal = useCallback(() => {
    if (onRefreshScenesAndStatus) {
      onRefreshScenesAndStatus();
    }
    if (scenesResponse === undefined) {
      void fetchFallbackScenes();
    }
  }, [onRefreshScenesAndStatus, scenesResponse, fetchFallbackScenes]);

  // ==================== OPTIONAL 3D VRAM TELEMETRY ====================
  const [cacheStats, setCacheStats] =
    useState<PaperTextureCacheStatsSnapshot | null>(null);

  useEffect(() => {
    if (composition.kit !== 'paper-diorama-3d') {
      setCacheStats(null);
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Lazy-import optional 3D kit telemetry so 2D-only consumer installs without `three` never fail
    const kitsDioramaModuleId = '@make-pictures/kits/paper-diorama-3d';
    import(/* @vite-ignore */ kitsDioramaModuleId)
      .then(
        (mod: {
          getPaperTextureCacheStats?: () => PaperTextureCacheStatsSnapshot;
        }) => {
          if (
            cancelled ||
            typeof mod.getPaperTextureCacheStats !== 'function'
          ) {
            return;
          }
          const readStats = mod.getPaperTextureCacheStats;
          setCacheStats(readStats());
          intervalId = setInterval(() => {
            setCacheStats(readStats());
          }, 1500);
        }
      )
      .catch(() => {
        // Optional 3D peer not installed
      });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [composition.id, composition.kit]);

  // ==================== BIDIRECTIONAL RAW JSON TAB STATE ====================
  const formattedLivePropsJson = useMemo(
    () => JSON.stringify(liveProps, null, 2),
    [liveProps]
  );
  const compactLivePropsJson = useMemo(
    () => JSON.stringify(liveProps),
    [liveProps]
  );

  const [jsonDraft, setJsonDraft] = useState<string>(formattedLivePropsJson);
  const [jsonValidation, setJsonValidation] = useState<JsonValidationState>(() =>
    validateParsedPropsObject(liveProps, composition.schema)
  );
  const isJsonEditorFocusedRef = useRef<boolean>(false);
  const lastJsonEmittedCompactRef = useRef<string>(compactLivePropsJson);
  const prevCompIdRef = useRef<string>(composition.id);

  useEffect(() => {
    const compChanged = prevCompIdRef.current !== composition.id;
    if (compChanged) {
      prevCompIdRef.current = composition.id;
      isJsonEditorFocusedRef.current = false;
      lastJsonEmittedCompactRef.current = compactLivePropsJson;
      setJsonDraft(formattedLivePropsJson);
      setJsonValidation(
        validateParsedPropsObject(liveProps, composition.schema)
      );
      return;
    }

    if (
      !isJsonEditorFocusedRef.current ||
      compactLivePropsJson !== lastJsonEmittedCompactRef.current
    ) {
      lastJsonEmittedCompactRef.current = compactLivePropsJson;
      setJsonDraft(formattedLivePropsJson);
      setJsonValidation(
        validateParsedPropsObject(liveProps, composition.schema)
      );
    }
  }, [
    composition.id,
    composition.schema,
    compactLivePropsJson,
    formattedLivePropsJson,
    liveProps,
  ]);

  const handleJsonDraftChange = useCallback(
    (nextText: string) => {
      setJsonDraft(nextText);
      let parsed: unknown;
      try {
        parsed = JSON.parse(nextText);
      } catch (err) {
        setJsonValidation({
          valid: false,
          message: `Błąd składni JSON: ${
            err instanceof Error ? err.message : 'nieprawidłowy format'
          }`,
        });
        return;
      }

      const check = validateParsedPropsObject(parsed, composition.schema);
      setJsonValidation(check);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        check.valid
      ) {
        const nextObj = parsed as Record<string, unknown>;
        lastJsonEmittedCompactRef.current = JSON.stringify(nextObj);
        onChangeProps(nextObj);
      }
    },
    [composition.schema, onChangeProps]
  );

  const handleFormatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft) as unknown;
      const pretty = JSON.stringify(parsed, null, 2);
      setJsonDraft(pretty);
      setJsonValidation(validateParsedPropsObject(parsed, composition.schema));
    } catch {
      // Cannot format while JSON has syntax error; status badge already shows location
    }
  }, [jsonDraft, composition.schema]);

  // ==================== FIELD MUTATION & PER-FIELD RESET ====================
  const updateField = useCallback(
    (path: string[], nextVal: unknown) => {
      onChangeProps(setNestedValue(liveProps, path, nextVal));
    },
    [liveProps, onChangeProps]
  );

  const resetFieldToDefault = useCallback(
    (path: string[]) => {
      const defaultVal = getNestedValue(composition.defaultProps, path);
      if (defaultVal === undefined) {
        onChangeProps(deleteNestedKey(liveProps, path));
      } else {
        onChangeProps(
          setNestedValue(liveProps, path, clonePlainValue(defaultVal))
        );
      }
    },
    [composition.defaultProps, liveProps, onChangeProps]
  );

  const handleInspectorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 's' &&
        effectiveTab !== 'script'
      ) {
        e.preventDefault();
        if (isDirty && !isSaving) {
          onSave();
        }
      }
    },
    [effectiveTab, isDirty, isSaving, onSave]
  );

  // ==================== FIELD CONTROL RENDERERS ====================
  const renderResetButton = (field: InspectorFieldSpec, rawVal: unknown) => {
    const defaultVal = getNestedValue(composition.defaultProps, field.path);
    const isModified = JSON.stringify(rawVal) !== JSON.stringify(defaultVal);
    if (!isModified) return null;

    return (
      <button
        type="button"
        className="mp-field-reset-btn"
        onClick={() => resetFieldToDefault(field.path)}
        title="Przywróć wartość domyślną parametru"
        aria-label={`Przywróć wartość domyślną: ${field.label}`}
      >
        ↺
      </button>
    );
  };

  const renderFieldControl = (field: InspectorFieldSpec) => {
    const rawVal = getNestedValue(liveProps, field.path);
    const inputId = `mp-prop-${composition.id}-${field.key}`;
    const resetBtn = renderResetButton(field, rawVal);

    if (field.kind === 'style-id') {
      const currentStyleId =
        typeof rawVal === 'string' && rawVal.trim().length > 0
          ? rawVal.trim()
          : 'minimal-product';

      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label className="mp-field-label">{field.label}</label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className="mp-field-val-tag">{currentStyleId}</span>
              {resetBtn}
            </div>
          </div>

          <div className="mp-style-picker-grid" role="radiogroup" aria-label={field.label}>
            {stylesCatalog.map(({ preset, origin }) => {
              const isSelected = preset.id === currentStyleId;
              return (
                <button
                  key={`${origin}:${preset.id}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`mp-style-picker-option ${
                    isSelected ? 'is-active' : ''
                  }`}
                  onClick={() => updateField(field.path, preset.id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
                      width: '100%',
                    }}
                  >
                    <div className="mp-style-swatches" aria-hidden="true">
                      <span
                        className="mp-style-swatch"
                        style={{
                          width: 13,
                          height: 13,
                          backgroundColor: preset.palette.bgCanvas,
                        }}
                      />
                      <span
                        className="mp-style-swatch"
                        style={{
                          width: 13,
                          height: 13,
                          backgroundColor: preset.palette.accentPrimary,
                        }}
                      />
                      <span
                        className="mp-style-swatch"
                        style={{
                          width: 13,
                          height: 13,
                          backgroundColor: preset.palette.accentSecondary,
                        }}
                      />
                    </div>

                    <div style={{ display: 'inline-flex', gap: 3 }}>
                      {origin === 'custom' && (
                        <span className="mp-mini-badge is-prod">WŁASNY</span>
                      )}
                      {preset.surface.isDark && (
                        <span className="mp-mini-badge is-dark">DARK</span>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--mp-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                  >
                    {preset.name}
                  </span>

                  <code className="mp-style-slug">{preset.id}</code>
                </button>
              );
            })}
          </div>

          {onOpenStyleLab && (
            <button
              type="button"
              className="mp-icon-btn"
              style={{
                marginTop: 3,
                height: 28,
                fontSize: 11.5,
                justifyContent: 'center',
                width: '100%',
              }}
              onClick={() => onOpenStyleLab(currentStyleId)}
            >
              <Palette size={12} />
              <span>Edytuj styl →</span>
              <ExternalLink size={11} />
            </button>
          )}
        </div>
      );
    }

    if (field.kind === 'boolean') {
      const checked = Boolean(rawVal);
      return (
        <div key={field.key} className="mp-field">
          <div className="mp-bool-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {resetBtn}
              <button
                id={inputId}
                type="button"
                role="switch"
                aria-checked={checked}
                className={`mp-switch ${checked ? 'is-on' : ''}`}
                onClick={() => updateField(field.path, !checked)}
              >
                <span className="mp-switch-thumb" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (field.kind === 'color') {
      const strVal = typeof rawVal === 'string' ? rawVal : '#007AFF';
      const parsedColor = parseRgbaOrHex(strVal);
      const opacityPct = Math.round(parsedColor.alpha * 100);

      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className="mp-field-val-tag">{strVal}</span>
              {resetBtn}
            </div>
          </div>

          <div className="mp-color-row">
            <input
              type="color"
              className="mp-color-swatch"
              aria-label={`${field.label} próbnik koloru`}
              value={parsedColor.hex6}
              onChange={(e) =>
                updateField(
                  field.path,
                  formatColorWithAlpha(
                    e.target.value,
                    parsedColor.alpha,
                    parsedColor.isRgba || parsedColor.alpha < 1
                  )
                )
              }
            />
            <input
              id={inputId}
              type="text"
              className="mp-input-text"
              style={{ fontFamily: 'var(--mp-font-mono)', fontSize: 12 }}
              value={strVal}
              spellCheck={false}
              onChange={(e) => updateField(field.path, e.target.value)}
            />
          </div>

          <div className="mp-alpha-row">
            <span>Krycie</span>
            <input
              type="range"
              aria-label={`${field.label} krycie alpha`}
              min={0}
              max={100}
              step={1}
              value={opacityPct}
              onChange={(e) => {
                const nextAlpha = Number(e.target.value) / 100;
                updateField(
                  field.path,
                  formatColorWithAlpha(
                    parsedColor.hex6,
                    nextAlpha,
                    nextAlpha < 1
                  )
                );
              }}
            />
            <span
              style={{
                width: 34,
                textAlign: 'right',
                fontFamily: 'var(--mp-font-mono)',
              }}
            >
              {opacityPct}%
            </span>
          </div>
        </div>
      );
    }

    if (field.kind === 'textarea') {
      const strVal = typeof rawVal === 'string' ? rawVal : String(rawVal ?? '');
      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {typeof field.max === 'number' && (
                <span className="mp-field-val-tag">
                  {strVal.length}/{field.max}
                </span>
              )}
              {resetBtn}
            </div>
          </div>
          <textarea
            id={inputId}
            className="mp-textarea"
            rows={3}
            maxLength={field.max}
            value={strVal}
            onChange={(e) => updateField(field.path, e.target.value)}
          />
        </div>
      );
    }

    if (field.kind === 'range') {
      const numVal =
        typeof rawVal === 'number' && Number.isFinite(rawVal)
          ? rawVal
          : field.min ?? 0;
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const step = field.step ?? 1;

      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className="mp-field-val-tag">
                {formatNumberBadge(numVal, step)}
              </span>
              {resetBtn}
            </div>
          </div>
          <div className="mp-range-row">
            <input
              id={inputId}
              type="range"
              className="mp-range-slider"
              min={min}
              max={max}
              step={step}
              value={Math.min(max, Math.max(min, numVal))}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (Number.isFinite(parsed)) {
                  updateField(field.path, parsed);
                }
              }}
            />
            <input
              type="number"
              className="mp-range-num"
              aria-label={`${field.label} wartość liczbowa`}
              min={min}
              max={max}
              step={step}
              value={numVal}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (Number.isFinite(parsed)) {
                  const clamped = Math.min(max, Math.max(min, parsed));
                  updateField(field.path, clamped);
                }
              }}
            />
          </div>
        </div>
      );
    }

    if (field.kind === 'number') {
      const numVal =
        typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : 0;
      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            {resetBtn}
          </div>
          <input
            id={inputId}
            type="number"
            className="mp-input-number"
            step={field.step ?? 0.1}
            min={field.min}
            max={field.max}
            value={numVal}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) {
                updateField(field.path, parsed);
              }
            }}
          />
        </div>
      );
    }

    if (field.kind === 'enum') {
      const strVal =
        typeof rawVal === 'string' ? rawVal : field.options?.[0] ?? '';
      const opts = field.options ?? [];
      const effectiveOptions =
        strVal && !opts.includes(strVal) ? [strVal, ...opts] : opts;

      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            {resetBtn}
          </div>
          <select
            id={inputId}
            className="mp-input-select"
            value={strVal}
            onChange={(e) => updateField(field.path, e.target.value)}
          >
            {effectiveOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.kind === 'string-array') {
      const items = Array.isArray(rawVal) ? rawVal.map((v) => String(v)) : [];
      const tagDraft = tagDrafts[field.key] ?? '';
      const datalistId =
        field.options && field.options.length > 0
          ? `${inputId}-datalist`
          : undefined;

      const commitAddTag = () => {
        const trimmed = tagDraft.trim();
        if (!trimmed) return;
        if (!items.includes(trimmed)) {
          updateField(field.path, [...items, trimmed]);
        }
        setTagDrafts((prev) => ({ ...prev, [field.key]: '' }));
      };

      const removeTagAt = (index: number) => {
        const nextItems = items.filter((_, i) => i !== index);
        updateField(field.path, nextItems);
      };

      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className="mp-field-val-tag">{items.length}</span>
              {resetBtn}
            </div>
          </div>

          {items.length > 0 && (
            <div className="mp-tag-list">
              {items.map((tag, idx) => (
                <span key={`${tag}-${idx}`} className="mp-tag-chip">
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTagAt(idx)}
                    aria-label={`Usuń element ${tag}`}
                    title="Usuń element"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mp-tag-add-row">
            <input
              id={inputId}
              type="text"
              list={datalistId}
              className="mp-input-text"
              style={{ flex: 1, height: 30 }}
              placeholder="Nowy element…"
              value={tagDraft}
              onChange={(e) =>
                setTagDrafts((prev) => ({
                  ...prev,
                  [field.key]: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitAddTag();
                }
              }}
            />
            {datalistId && field.options && (
              <datalist id={datalistId}>
                {field.options.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            )}
            <button
              type="button"
              className="mp-icon-btn"
              style={{ height: 30, padding: '0 9px' }}
              disabled={tagDraft.trim().length === 0}
              onClick={commitAddTag}
            >
              <Plus size={12} />
              <span>Dodaj</span>
            </button>
          </div>
        </div>
      );
    }

    if (field.kind === 'tuple-number') {
      const tupleLen =
        field.tupleLength ??
        (Array.isArray(rawVal) && rawVal.length >= 2 && rawVal.length <= 4
          ? rawVal.length
          : 3);
      const currentArr = Array.from({ length: tupleLen }, (_, idx) => {
        const candidate = Array.isArray(rawVal) ? rawVal[idx] : undefined;
        return typeof candidate === 'number' && Number.isFinite(candidate)
          ? candidate
          : 0;
      });

      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <span className="mp-field-label">{field.label}</span>
            {resetBtn}
          </div>
          <div className="mp-tuple-grid">
            {currentArr.map((coordVal, axisIdx) => {
              const axisLabel = TUPLE_AXES[axisIdx] ?? String(axisIdx + 1);
              const coordId = `${inputId}-${axisLabel}`;
              return (
                <div
                  key={axisLabel}
                  style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  <label
                    htmlFor={coordId}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--mp-font-mono)',
                      color: 'var(--mp-text-muted)',
                    }}
                  >
                    {axisLabel}
                  </label>
                  <input
                    id={coordId}
                    type="number"
                    className="mp-input-number"
                    step={field.step ?? 0.1}
                    value={coordVal}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      if (Number.isFinite(parsed)) {
                        const nextTuple = [...currentArr];
                        nextTuple[axisIdx] = parsed;
                        updateField(field.path, nextTuple);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.kind === 'json-value') {
      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            {resetBtn}
          </div>
          <InlineJsonFieldControl
            inputId={inputId}
            value={rawVal}
            onCommit={(nextVal) => updateField(field.path, nextVal)}
          />
        </div>
      );
    }

    // Default: 'text'
    const strVal = typeof rawVal === 'string' ? rawVal : String(rawVal ?? '');
    return (
      <div key={field.key} className="mp-field">
        <div className="mp-field-label-row">
          <label htmlFor={inputId} className="mp-field-label">
            {field.label}
          </label>
          {resetBtn}
        </div>
        <input
          id={inputId}
          type="text"
          className="mp-input-text"
          maxLength={field.max}
          value={strVal}
          onChange={(e) => updateField(field.path, e.target.value)}
        />
      </div>
    );
  };

  return (
    <aside
      className={`mp-sidebar-right ${isMobileOpen ? 'is-mobile-open' : ''}`}
      onKeyDown={handleInspectorKeyDown}
    >
      {/* iOS Bottom Sheet Grabber */}
      <div className="mp-sheet-grabber" aria-hidden="true" />

      {/* ==================== INSPECTOR HEADER ==================== */}
      <div className="mp-inspector-header">
        <span
          className="mp-panel-title"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Sliders size={13} style={{ color: 'var(--mp-accent)' }} />
          <span>{mode === 'styles' ? 'Inspektor stylu' : 'Inspektor sceny'}</span>
        </span>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            className={`mp-status-pill ${isDirty ? 'is-fallback' : 'is-ok'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--mp-font-sans)',
              fontSize: 10.5,
            }}
            title={
              lastSavedAt
                ? `Ostatni zapis: ${new Date(lastSavedAt).toLocaleTimeString()}`
                : 'Stan zgodny z plikiem na dysku'
            }
          >
            {isSaving ? (
              'Zapisywanie…'
            ) : isDirty ? (
              'Niezapisane'
            ) : (
              <>
                <Check size={11} />
                <span>Zapisano</span>
              </>
            )}
          </span>

          {onCloseMobile && (
            <button
              type="button"
              className="mp-icon-btn is-ghost"
              style={{ width: 26, height: 26, padding: 0 }}
              onClick={onCloseMobile}
              aria-label="Zamknij inspektor"
              title="Zamknij panel"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Optional Style Lab Built-In Save-As Slot */}
      {styleSaveAsBanner}

      {/* ==================== iOS SEGMENTED TABS ==================== */}
      <div className="mp-inspector-tabs">
        <div
          className="mp-segmented is-full"
          role="tablist"
          aria-label="Zakładki inspektora"
        >
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'params'}
            className={`mp-segmented-btn ${
              effectiveTab === 'params' ? 'is-active' : ''
            }`}
            onClick={() => setActiveTab('params')}
          >
            Parametry
          </button>

          {mode === 'films' && (
            <button
              type="button"
              role="tab"
              aria-selected={effectiveTab === 'script'}
              className={`mp-segmented-btn ${
                effectiveTab === 'script' ? 'is-active' : ''
              }`}
              onClick={() => setActiveTab('script')}
            >
              Skrypt &amp; Audio
            </button>
          )}

          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'json'}
            className={`mp-segmented-btn ${
              effectiveTab === 'json' ? 'is-active' : ''
            }`}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>
      </div>

      {/* ==================== DISK SYNC ACTION BAR (PARAMETRY & JSON) ==================== */}
      {effectiveTab !== 'script' && (
        <div className="mp-props-SaveBar">
          <div className="mp-props-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="mp-icon-btn is-primary"
                style={{ height: 30, fontSize: 11.5 }}
                disabled={!isDirty || isSaving}
                onClick={onSave}
                title="Zapisz parametry na dysku (⌘S / Ctrl+S)"
              >
                <Save size={13} />
                <span>Zapisz</span>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.82,
                    fontFamily: 'var(--mp-font-mono)',
                  }}
                >
                  ⌘S
                </span>
              </button>

              <button
                type="button"
                className="mp-icon-btn"
                style={{ height: 30, fontSize: 11.5 }}
                disabled={!isDirty || isSaving}
                onClick={onResetToDisk}
                title="Cofnij niezapisane zmiany do wartości z pliku na dysku"
              >
                <RotateCcw size={13} />
                <span>Przywróć</span>
              </button>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Automatyczny zapis (debounce 450 ms) po każdej zmianie"
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--mp-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                Auto-zapis
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoSave}
                aria-label="Auto-zapis"
                className={`mp-switch ${autoSave ? 'is-on' : ''}`}
                onClick={onToggleAutoSave}
              >
                <span className="mp-switch-thumb" />
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--mp-font-mono)',
              fontSize: 10.5,
              color: 'var(--mp-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={`Plik docelowy na dysku: ${composition.propsFile}`}
          >
            <FileJson
              size={12}
              style={{ color: 'var(--mp-accent)', flexShrink: 0 }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {composition.propsFile}
            </span>
          </div>

          {saveError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'var(--mp-rose-text)',
                backgroundColor: 'var(--mp-rose-soft)',
                border: '0.5px solid var(--mp-rose-border)',
                borderRadius: 8,
                padding: '5px 8px',
              }}
            >
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              <span>{saveError}</span>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 1: SEARCH & FILTER ROW ==================== */}
      {effectiveTab === 'params' && sections.length > 0 && (
        <div className="mp-inspector-search-row">
          <Search
            size={13}
            style={{ color: 'var(--mp-text-muted)', flexShrink: 0 }}
          />
          <input
            type="search"
            className="mp-inspector-search"
            placeholder="Szukaj parametru…"
            aria-label="Szukaj parametru"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="mp-icon-btn is-ghost"
              style={{ width: 24, height: 24, padding: 0 }}
              onClick={() => setSearchQuery('')}
              aria-label="Wyczyść filtr wyszukiwania"
              title="Wyczyść filtr"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            className="mp-icon-btn is-ghost"
            style={{ width: 28, height: 28, padding: 0 }}
            onClick={handleToggleAllSections}
            aria-label={allCollapsed ? 'Rozwiń wszystkie sekcje' : 'Zwiń wszystkie sekcje'}
            title={allCollapsed ? 'Rozwiń wszystkie sekcje' : 'Zwiń wszystkie sekcje'}
          >
            {allCollapsed ? (
              <ChevronsUpDown size={14} />
            ) : (
              <ChevronsDownUp size={14} />
            )}
          </button>
        </div>
      )}

      {/* ==================== TAB BODY ==================== */}
      <div className="mp-scroll-area">
        {effectiveTab === 'params' && (
          <>
            {sections.length === 0 ? (
              <div className="mp-inspector-card">
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--mp-text-secondary)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Brak edytowalnych parametrów w obiekcie <code>props</code>.
                  Możesz dodać pola bezpośrednio w zakładce <strong>JSON</strong>.
                </p>
              </div>
            ) : filteredSections.length === 0 ? (
              <div className="mp-inspector-card">
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--mp-text-secondary)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Brak parametrów pasujących do zapytania „{searchQuery}”.
                </p>
              </div>
            ) : (
              filteredSections.map((sec) => {
                const isCollapsed =
                  normalizedQuery.length === 0 &&
                  Boolean(collapsedSections[sec.title]);

                return (
                  <div
                    key={sec.title}
                    className={`mp-section-card ${
                      isCollapsed ? 'is-collapsed' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="mp-section-header-btn"
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleSection(sec.title)}
                    >
                      <span>{sec.title}</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span className="mp-mini-badge">
                          {sec.fields.length}
                        </span>
                        <ChevronDown
                          size={13}
                          style={{
                            transform: isCollapsed
                              ? 'rotate(-90deg)'
                              : 'rotate(0deg)',
                            transition: 'transform 0.16s var(--mp-ease-spring)',
                          }}
                        />
                      </span>
                    </button>

                    {!isCollapsed &&
                      sec.fields.map((field) => renderFieldControl(field))}
                  </div>
                );
              })
            )}

            {/* Compact Composition & VRAM LRU Diagnostics */}
            <div className="mp-inspector-card" style={{ marginTop: 4 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--mp-text-muted)',
                  marginBottom: 6,
                }}
              >
                Metryki kompozycji
              </div>
              <div className="mp-kv-row">
                <span className="mp-kv-key">Format</span>
                <span className="mp-kv-val">
                  {composition.width}×{composition.height} @ {composition.fps} FPS
                </span>
              </div>
              <div className="mp-kv-row">
                <span className="mp-kv-key">Czas trwania</span>
                <span className="mp-kv-val">
                  {composition.durationInFrames} kl. (
                  {(composition.durationInFrames / composition.fps).toFixed(1)}s)
                </span>
              </div>
              <div className="mp-kv-row">
                <span className="mp-kv-key">Zestaw wizualny</span>
                <span className="mp-kv-val">{composition.kit}</span>
              </div>

              {composition.kit === 'paper-diorama-3d' && cacheStats && (
                <div
                  className="mp-kv-row"
                  style={{
                    borderTop: '0.5px solid var(--mp-border-hairline)',
                    marginTop: 4,
                    paddingTop: 6,
                  }}
                >
                  <span
                    className="mp-kv-key"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Cpu size={12} style={{ color: 'var(--mp-emerald)' }} />
                    <span>Cache VRAM LRU</span>
                  </span>
                  <span className="mp-kv-val">
                    {cacheStats.activeCount} akt. • {cacheStats.size}/
                    {cacheStats.maxEntries}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {effectiveTab === 'script' && mode === 'films' && (
          <SceneScriptEditor
            composition={composition}
            scenesResponse={effectiveScenesResponse}
            studioStatus={studioStatus ?? null}
            isLoadingScenes={isLoadingFallbackScenes}
            onSaveScene={handleSaveSceneInternal}
            onRefreshScenesAndStatus={handleRefreshScenesAndStatusInternal}
          />
        )}

        {effectiveTab === 'json' && (
          <div className="mp-json-editor-wrap">
            <div
              className={`mp-json-status ${
                jsonValidation.valid ? 'is-valid' : 'is-error'
              }`}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                }}
              >
                {jsonValidation.valid ? (
                  <Check size={13} style={{ flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                )}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={jsonValidation.message}
                >
                  {jsonValidation.message}
                </span>
              </span>

              <button
                type="button"
                className="mp-icon-btn"
                style={{ height: 24, padding: '0 8px', fontSize: 11, flexShrink: 0 }}
                onClick={handleFormatJson}
                title="Uporządkuj wcięcia JSON (2 spacje)"
              >
                <Braces size={11} />
                <span>Formatuj JSON</span>
              </button>
            </div>

            <textarea
              className={`mp-json-textarea ${
                !jsonValidation.valid ? 'is-invalid' : ''
              }`}
              spellCheck={false}
              aria-label="Edytor surowego JSON parametrów"
              value={jsonDraft}
              onFocus={() => {
                isJsonEditorFocusedRef.current = true;
              }}
              onBlur={() => {
                isJsonEditorFocusedRef.current = false;
              }}
              onChange={(e) => handleJsonDraftChange(e.target.value)}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
