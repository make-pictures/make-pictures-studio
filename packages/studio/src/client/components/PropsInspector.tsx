import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Cpu,
  FileJson,
  RotateCcw,
  Save,
  Sliders,
  Zap,
} from 'lucide-react';
import type { StudioCompositionEntry } from '@make-pictures/core';
import {
  getNestedValue,
  introspectZodObject,
  setNestedValue,
  type InspectorFieldSpec,
} from '../schema-form/zodIntrospect';

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
}

interface PaperTextureCacheStatsSnapshot {
  size: number;
  activeCount: number;
  maxEntries: number;
}

const VALID_PICKER_HEX_RE = /^#[0-9a-fA-F]{6}$/;

function toPickerSafeHex(val: unknown): string {
  if (typeof val !== 'string') return '#2563eb';
  const trimmed = val.trim();
  if (VALID_PICKER_HEX_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return trimmed.slice(0, 7).toLowerCase();
  }
  return '#2563eb';
}

function formatNumberBadge(val: unknown, step?: number): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '0';
  if (step && step < 0.1) return val.toFixed(2);
  if (step && step < 1) return val.toFixed(1);
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

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
}) => {
  // Introspect against schema + stable defaultProps so field kinds (e.g. color vs text)
  // never flicker while the user is typing a partial hex value.
  const sections = useMemo(
    () => introspectZodObject(composition.schema, composition.defaultProps),
    [composition.schema, composition.defaultProps]
  );

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
      .then((mod: { getPaperTextureCacheStats?: () => PaperTextureCacheStatsSnapshot }) => {
        if (cancelled || typeof mod.getPaperTextureCacheStats !== 'function') {
          return;
        }
        const readStats = mod.getPaperTextureCacheStats;
        setCacheStats(readStats());
        intervalId = setInterval(() => {
          setCacheStats(readStats());
        }, 1500);
      })
      .catch(() => {
        // Optional 3D peer not installed
      });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [composition.id, composition.kit]);

  const updateField = (path: string[], nextVal: unknown) => {
    onChangeProps(setNestedValue(liveProps, path, nextVal));
  };

  const renderFieldControl = (field: InspectorFieldSpec) => {
    const rawVal = getNestedValue(liveProps, field.path);
    const inputId = `mp-prop-${composition.id}-${field.key}`;

    if (field.kind === 'boolean') {
      const checked = Boolean(rawVal);
      return (
        <div key={field.key} className="mp-field">
          <div className="mp-bool-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
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
      );
    }

    if (field.kind === 'color') {
      const strVal = typeof rawVal === 'string' ? rawVal : '#2563EB';
      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
            <span className="mp-field-val-tag">{strVal}</span>
          </div>
          <div className="mp-color-row">
            <input
              type="color"
              className="mp-color-swatch"
              aria-label={`${field.label} próbnik koloru`}
              value={toPickerSafeHex(strVal)}
              onChange={(e) =>
                updateField(field.path, e.target.value.toUpperCase())
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
            <span className="mp-field-val-tag">
              {formatNumberBadge(numVal, step)}
            </span>
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
      const strVal = typeof rawVal === 'string' ? rawVal : field.options?.[0] ?? '';
      return (
        <div key={field.key} className="mp-field">
          <div className="mp-field-label-row">
            <label htmlFor={inputId} className="mp-field-label">
              {field.label}
            </label>
          </div>
          <select
            id={inputId}
            className="mp-input-select"
            value={strVal}
            onChange={(e) => updateField(field.path, e.target.value)}
          >
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
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
        </div>
        <input
          id={inputId}
          type="text"
          className="mp-input-text"
          value={strVal}
          onChange={(e) => updateField(field.path, e.target.value)}
        />
      </div>
    );
  };

  return (
    <aside className="mp-sidebar-right">
      {/* ==================== HEADER ==================== */}
      <div className="mp-panel-header">
        <span
          className="mp-panel-title"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Sliders size={13} color="#2563EB" />
          <span>Parametry sceny</span>
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10.5,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 999,
            backgroundColor: isDirty ? '#FEF3C7' : '#ECFDF5',
            color: isDirty ? '#B45309' : '#047857',
            border: `1px solid ${isDirty ? '#FDE68A' : '#A7F3D0'}`,
          }}
          title={
            lastSavedAt
              ? `Ostatni zapis: ${new Date(lastSavedAt).toLocaleTimeString()}`
              : 'Stan zgodny z plikiem *.props.json na dysku'
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
      </div>

      {/* ==================== DISK SYNC ACTION BAR ==================== */}
      <div className="mp-props-SaveBar">
        <div className="mp-props-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="mp-icon-btn is-primary"
              style={{
                height: 30,
                fontSize: 11.5,
                opacity: !isDirty || isSaving ? 0.52 : 1,
                cursor: !isDirty || isSaving ? 'default' : 'pointer',
              }}
              disabled={!isDirty || isSaving}
              onClick={onSave}
              title="Zapisz parametry do pliku *.props.json na dysku (Cmd/Ctrl + S)"
            >
              <Save size={13} />
              <span>Zapisz</span>
            </button>

            <button
              type="button"
              className="mp-icon-btn"
              style={{
                height: 30,
                fontSize: 11.5,
                opacity: !isDirty || isSaving ? 0.48 : 1,
                cursor: !isDirty || isSaving ? 'default' : 'pointer',
              }}
              disabled={!isDirty || isSaving}
              onClick={onResetToDisk}
              title="Cofnij niezapisane zmiany do wartości z pliku na dysku"
            >
              <RotateCcw size={13} />
              <span>Przywróć</span>
            </button>
          </div>

          <button
            type="button"
            className={`mp-toggle-btn ${autoSave ? 'is-active' : ''}`}
            style={{ height: 30, fontSize: 11 }}
            onClick={onToggleAutoSave}
            title="Automatyczny zapis do *.props.json (debounce 450 ms) po każdej zmianie"
          >
            <Zap size={12} />
            <span>Auto-zapis</span>
          </button>
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
          title={`Plik docelowy widoczny w git diff i dla agenta AI: ${composition.propsFile}`}
        >
          <FileJson size={12} color="#2563EB" style={{ flexShrink: 0 }} />
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
              color: '#BE123C',
              backgroundColor: '#FFF1F2',
              border: '1px solid #FECDD3',
              borderRadius: 7,
              padding: '5px 8px',
            }}
          >
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>{saveError}</span>
          </div>
        )}
      </div>

      {/* ==================== ZOD AUTO-GENERATED SECTIONS ==================== */}
      <div className="mp-scroll-area">
        {sections.length === 0 ? (
          <div className="mp-inspector-card">
            <p
              style={{
                fontSize: 12,
                color: 'var(--mp-text-muted)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Ta kompozycja nie eksportuje jeszcze schematu <code>zod</code>.
            </p>
          </div>
        ) : (
          sections.map((sec) => (
            <div key={sec.title} className="mp-section-card">
              <div className="mp-section-heading">{sec.title}</div>
              {sec.fields.map((field) => renderFieldControl(field))}
            </div>
          ))
        )}

        {/* ==================== COMPACT SCENE & VRAM DIAGNOSTICS ==================== */}
        <div className="mp-inspector-card" style={{ marginTop: 4 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
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
                borderTop: '1px solid var(--mp-border-subtle)',
                marginTop: 4,
                paddingTop: 6,
              }}
            >
              <span
                className="mp-kv-key"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Cpu size={12} color="#10B981" />
                <span>Cache VRAM LRU</span>
              </span>
              <span className="mp-kv-val">
                {cacheStats.activeCount} akt. • {cacheStats.size}/
                {cacheStats.maxEntries}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
