import React, { useCallback, useMemo, useState } from 'react';
import { Clapperboard, Folder, Mic, RefreshCw, Sparkles } from 'lucide-react';
import {
  getSceneVoiceover,
  isVerticalComposition,
  type StudioCompositionEntry,
} from '@make-pictures/core';
import { consumePostSseStream } from '../sseClient';
import type { StudioStatusResponse } from '../types';

export type OriginFilterMode = 'all' | 'example' | 'production';

export interface LeftSidebarProps {
  compositions: StudioCompositionEntry[];
  activeComposition: StudioCompositionEntry;
  onSelectComposition: (id: string) => void;
  studioStatus: StudioStatusResponse | null;
  onRefreshStatus: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  compositions,
  activeComposition,
  onSelectComposition,
  studioStatus,
  onRefreshStatus,
}) => {
  const [originFilter, setOriginFilter] = useState<OriginFilterMode>('all');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [forceAudio, setForceAudio] = useState<boolean>(false);
  const [audioLog, setAudioLog] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

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
    return { all: compositions.length, examples, productions };
  }, [compositions]);

  const effectiveFilter = counts.examples === 0 ? 'all' : originFilter;

  const filteredCompositions = useMemo(() => {
    if (effectiveFilter === 'all') return compositions;
    return compositions.filter(
      (comp) => (comp.origin ?? 'example') === effectiveFilter
    );
  }, [compositions, effectiveFilter]);

  const groupedCompositions = useMemo(() => {
    const map = new Map<string, StudioCompositionEntry[]>();
    for (const comp of filteredCompositions) {
      const list = map.get(comp.group) ?? [];
      list.push(comp);
      map.set(comp.group, list);
    }
    return Array.from(map.entries());
  }, [filteredCompositions]);

  const uniqueSceneIds = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const seg of activeComposition.sceneTimeline) {
      if (!seen.has(seg.sceneId)) {
        seen.add(seg.sceneId);
        list.push(seg.sceneId);
      }
    }
    return list;
  }, [activeComposition]);

  const handleRegenerateAudio = useCallback(async () => {
    if (isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    setAudioError(null);
    const prodId =
      activeComposition.origin === 'production'
        ? activeComposition.productionId
        : undefined;
    setAudioLog(
      prodId
        ? `Uruchamianie audio dla productions/${prodId}…`
        : 'Uruchamianie generatora audio…'
    );

    try {
      await consumePostSseStream<{
        type: 'start' | 'log' | 'done' | 'error';
        line?: string;
        message?: string;
        error?: string;
      }>(
        '/api/studio/voiceover',
        { force: forceAudio, productionId: prodId },
        (evt) => {
          if (evt.type === 'start' && evt.message) {
            setAudioLog(evt.message);
          } else if (evt.type === 'log' && evt.line) {
            setAudioLog(evt.line);
          } else if (evt.type === 'done') {
            setAudioLog('Zaktualizowano pliki .mp3 i timestampy słów!');
            onRefreshStatus();
          } else if (evt.type === 'error') {
            setAudioError(evt.error ?? 'Błąd skryptu generowania audio');
          }
        }
      );
    } catch (err) {
      setAudioError(
        err instanceof Error ? err.message : 'Nie udało się przeliczyć audio'
      );
    } finally {
      setIsGeneratingAudio(false);
      onRefreshStatus();
    }
  }, [
    isGeneratingAudio,
    forceAudio,
    activeComposition.origin,
    activeComposition.productionId,
    onRefreshStatus,
  ]);

  const hasApiKey = studioStatus?.hasApiKey ?? false;

  return (
    <aside className="mp-sidebar-left">
      <div className="mp-panel-header">
        <span className="mp-panel-title">Kompozycje & Odcinki</span>
        <span className="mp-mini-badge">{filteredCompositions.length}</span>
      </div>

      {/* Origin Filter Tabs: Wszystkie | Przykłady | Produkcje (only when examples exist) */}
      {counts.examples > 0 && (
        <div
          className="mp-origin-tabs"
          role="tablist"
          aria-label="Filtr źródła kompozycji"
        >
          <button
            type="button"
            role="tab"
            aria-selected={originFilter === 'all'}
            className={`mp-origin-tab ${originFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setOriginFilter('all')}
          >
            <span>Wszystkie</span>
            <span className="mp-origin-count">{counts.all}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={originFilter === 'example'}
            className={`mp-origin-tab ${
              originFilter === 'example' ? 'is-active' : ''
            }`}
            onClick={() => setOriginFilter('example')}
          >
            <span>Przykłady</span>
            <span className="mp-origin-count">{counts.examples}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={originFilter === 'production'}
            className={`mp-origin-tab ${
              originFilter === 'production' ? 'is-active' : ''
            }`}
            onClick={() => setOriginFilter('production')}
          >
            <span>Produkcje</span>
            <span className="mp-origin-count">{counts.productions}</span>
          </button>
        </div>
      )}

      <div className="mp-scroll-area">
        {groupedCompositions.length === 0 ? (
          <div className="mp-empty-capsule-card">
            <Clapperboard size={20} color="#2563EB" />
            <div className="mp-empty-capsule-title">
              Brak kapsuł w <code>productions/</code>
            </div>
            <p className="mp-empty-capsule-desc">
              Utwórz odizolowany projekt filmowy:
            </p>
            <code className="mp-empty-capsule-cmd">
              npx make-pictures new moj-film
            </code>
          </div>
        ) : (
          groupedCompositions.map(([groupName, items]) => (
            <div key={groupName} className="mp-group-block">
              <div className="mp-group-label">
                <Folder size={13} />
                <span>{groupName}</span>
              </div>

              {items.map((comp) => {
                const isActive = comp.id === activeComposition.id;
                const isVertical = isVerticalComposition(comp);
                const isProd = (comp.origin ?? 'example') === 'production';
                const seconds = (comp.durationInFrames / comp.fps).toFixed(1);

                return (
                  <button
                    key={comp.id}
                    type="button"
                    className={`mp-comp-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => onSelectComposition(comp.id)}
                  >
                    <div className="mp-comp-item-top">
                      <span className="mp-comp-item-name">{comp.title}</span>
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
                    </div>
                    <div className="mp-comp-item-sub">
                      {comp.subtitle} • {seconds}s
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="mp-audio-dock">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            className="mp-panel-title"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Mic size={13} color="#2563EB" />
            <span>Ścieżki Audio ({uniqueSceneIds.length})</span>
          </span>

          <button
            type="button"
            className="mp-icon-btn"
            style={{ height: 24, padding: '0 7px', fontSize: 11 }}
            onClick={onRefreshStatus}
            disabled={isGeneratingAudio}
            title="Odśwież status plików lektora i JSON"
          >
            <RefreshCw size={11} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
            fontSize: 11,
            color: 'var(--mp-text-muted)',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: hasApiKey ? '#10B981' : '#F59E0B',
              flexShrink: 0,
            }}
          />
          <span>
            {hasApiKey
              ? 'Klucz ElevenLabs aktywny (.env.local)'
              : 'Brak klucza API — deterministyczny fallback'}
          </span>
        </div>

        <div className="mp-audio-list">
          {uniqueSceneIds.map((sceneId) => {
            const liveItem = studioStatus?.scenes[sceneId];
            const manifestItem = getSceneVoiceover(sceneId);

            const provider =
              liveItem?.provider ?? manifestItem?.provider ?? 'missing';
            const wordCount =
              liveItem?.wordCount ?? manifestItem?.words.length ?? 0;
            const duration =
              liveItem?.durationInSeconds ??
              manifestItem?.durationInSeconds ??
              0;
            const isStale = liveItem ? !liveItem.isHashCurrent : false;

            let badgeLabel = 'Brak pliku';
            let badgeClass = 'is-missing';

            if (provider === 'elevenlabs' && !isStale) {
              badgeLabel = 'ElevenLabs';
              badgeClass = 'is-ok';
            } else if (provider === 'elevenlabs' && isStale) {
              badgeLabel = 'Zmieniony tekst';
              badgeClass = 'is-missing';
            } else if (provider === 'synthetic-fallback') {
              badgeLabel = 'Tryb próbny';
              badgeClass = 'is-fallback';
            }

            return (
              <div key={sceneId} className="mp-audio-row">
                <div style={{ minWidth: 0 }}>
                  <div className="mp-audio-id">{sceneId}</div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--mp-text-muted)',
                      marginTop: 1,
                    }}
                  >
                    {wordCount} słów • {duration.toFixed(1)}s
                  </div>
                </div>
                <span className={`mp-status-pill ${badgeClass}`}>
                  {badgeLabel}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 10,
          }}
        >
          <button
            type="button"
            className="mp-icon-btn"
            style={{
              flex: 1,
              height: 31,
              fontSize: 11.5,
              borderColor: 'var(--mp-brand-100)',
              backgroundColor: 'var(--mp-brand-50)',
              color: 'var(--mp-brand-600)',
              opacity: isGeneratingAudio ? 0.65 : 1,
            }}
            disabled={isGeneratingAudio}
            onClick={() => void handleRegenerateAudio()}
            title="Uruchom lokalnie generator audio (SHA-256 cache)"
          >
            <Sparkles size={13} />
            <span>
              {isGeneratingAudio ? 'Generowanie audio…' : 'Przelicz audio'}
            </span>
          </button>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--mp-text-muted)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            title="Pomiń cache SHA-256 i wygeneruj wszystkie ścieżki od nowa (--force)"
          >
            <input
              type="checkbox"
              checked={forceAudio}
              onChange={(e) => setForceAudio(e.target.checked)}
              disabled={isGeneratingAudio}
              style={{ accentColor: 'var(--mp-brand-600)' }}
            />
            <span>Wymuś</span>
          </label>
        </div>

        {audioError ? (
          <div
            className="mp-audio-gen-log"
            style={{
              color: '#BE123C',
              backgroundColor: '#FFF1F2',
              borderColor: '#FECDD3',
            }}
            title={audioError}
          >
            {audioError}
          </div>
        ) : audioLog ? (
          <div className="mp-audio-gen-log" title={audioLog}>
            {audioLog}
          </div>
        ) : null}
      </div>
    </aside>
  );
};
