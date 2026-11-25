import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FolderOpen,
  LayoutGrid,
  Loader2,
  Mic,
  Music2,
  Volume2,
  X,
} from 'lucide-react';
import {
  computeMusicBedVolumeAtFrame,
  getRegisteredVoiceoverManifest,
  type StudioCompositionEntry,
} from '@make-pictures/core';
import type { SubscribeFrame } from '../hooks/useRemotionPlayer';

export interface DirectorTimelinePanelProps {
  composition: StudioCompositionEntry;
  currentFrame?: number;
  getFrame?: () => number;
  subscribeFrame?: SubscribeFrame;
  onSeek: (frame: number) => void;
  onOpenOutputFile?: (outputFile: string | null) => void;
  hideQaActions?: boolean;
}

const ENVELOPE_SAMPLES = 120;

const preventButtonFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

interface ActiveTimelineIndices {
  cameraIdx: number;
  voIdx: number;
  sfxMask: string;
}

function computeActiveIndices(
  frame: number,
  cameraCuts: ReadonlyArray<{ fromFrame: number; durationInFrames: number }>,
  sceneTimeline: ReadonlyArray<{ fromFrame: number; durationInFrames: number }>,
  sfxCues: ReadonlyArray<{ fromFrame: number }>
): ActiveTimelineIndices {
  let cameraIdx = -1;
  for (let i = 0; i < cameraCuts.length; i++) {
    const cut = cameraCuts[i];
    if (frame >= cut.fromFrame && frame < cut.fromFrame + cut.durationInFrames) {
      cameraIdx = i;
      break;
    }
  }

  let voIdx = -1;
  for (let i = 0; i < sceneTimeline.length; i++) {
    const seg = sceneTimeline[i];
    if (frame >= seg.fromFrame && frame < seg.fromFrame + seg.durationInFrames) {
      voIdx = i;
      break;
    }
  }

  let sfxMask = '';
  for (let i = 0; i < sfxCues.length; i++) {
    if (Math.abs(frame - sfxCues[i].fromFrame) <= 8) {
      sfxMask = sfxMask ? `${sfxMask},${i}` : String(i);
    }
  }

  return { cameraIdx, voIdx, sfxMask };
}

function computePlayheadPct(frame: number, totalFrames: number): number {
  return Math.min(
    100,
    Math.max(0, (frame / Math.max(1, totalFrames - 1)) * 100)
  );
}

export const DirectorTimelinePanel: React.FC<DirectorTimelinePanelProps> = ({
  composition,
  currentFrame = 0,
  getFrame,
  subscribeFrame,
  onSeek,
  onOpenOutputFile,
  hideQaActions = false,
}) => {
  const rawGradId = useId();
  const duckingGradId = `mpDuckingGrad-${rawGradId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const lanesRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [qaState, setQaState] = useState<{
    status: 'idle' | 'running' | 'done' | 'error';
    contactSheetUrl: string | null;
    outputFile: string | null;
    error: string | null;
  }>({
    status: 'idle',
    contactSheetUrl: null,
    outputFile: null,
    error: null,
  });
  const [showQaModal, setShowQaModal] = useState<boolean>(false);

  useEffect(() => {
    setQaState({
      status: 'idle',
      contactSheetUrl: null,
      outputFile: null,
      error: null,
    });
    setShowQaModal(false);
  }, [composition.id]);

  useEffect(() => {
    if (!showQaModal || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowQaModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showQaModal]);

  const totalFrames = Math.max(1, composition.durationInFrames);

  const cameraCuts = useMemo(() => {
    if (composition.cameraTimeline && composition.cameraTimeline.length > 0) {
      return composition.cameraTimeline;
    }
    return [
      {
        shotLabel: `${composition.kit} • Primary Stage`,
        fromFrame: 0,
        durationInFrames: totalFrames,
      },
    ];
  }, [composition.cameraTimeline, composition.kit, totalFrames]);

  const sfxCues = useMemo(
    () => composition.sfxTimeline ?? [],
    [composition.sfxTimeline]
  );

  const initialFrame = getFrame ? getFrame() : currentFrame;
  const initialPlayheadPct = computePlayheadPct(initialFrame, totalFrames);

  const [subscribedActive, setSubscribedActive] =
    useState<ActiveTimelineIndices>(() =>
      computeActiveIndices(
        initialFrame,
        cameraCuts,
        composition.sceneTimeline,
        sfxCues
      )
    );

  // Imperative 60 FPS playhead via CSS variable (`transform: translate3d(...)`)
  // and discrete state updates ONLY when the active clip/SFX actually changes.
  useEffect(() => {
    if (!subscribeFrame) return;

    const syncFrame = (frame: number) => {
      const lanes = lanesRef.current;
      if (lanes) {
        lanes.style.setProperty(
          '--mp-playhead-pct',
          computePlayheadPct(frame, totalFrames).toFixed(4)
        );
      }
      const next = computeActiveIndices(
        frame,
        cameraCuts,
        composition.sceneTimeline,
        sfxCues
      );
      setSubscribedActive((prev) =>
        prev.cameraIdx === next.cameraIdx &&
        prev.voIdx === next.voIdx &&
        prev.sfxMask === next.sfxMask
          ? prev
          : next
      );
    };

    syncFrame(getFrame ? getFrame() : currentFrame);
    return subscribeFrame(syncFrame);
  }, [
    subscribeFrame,
    getFrame,
    currentFrame,
    totalFrames,
    cameraCuts,
    composition.sceneTimeline,
    sfxCues,
    collapsed,
  ]);

  const activeIndices = subscribeFrame
    ? subscribedActive
    : computeActiveIndices(
        currentFrame,
        cameraCuts,
        composition.sceneTimeline,
        sfxCues
      );

  const activeSfxSet = useMemo(() => {
    const set = new Set<number>();
    if (!activeIndices.sfxMask) return set;
    for (const part of activeIndices.sfxMask.split(',')) {
      const n = Number(part);
      if (Number.isInteger(n)) set.add(n);
    }
    return set;
  }, [activeIndices.sfxMask]);

  const lanesStyle = useMemo(
    () =>
      ({
        '--mp-playhead-pct': (subscribeFrame
          ? initialPlayheadPct
          : computePlayheadPct(currentFrame, totalFrames)
        ).toFixed(4),
      }) as React.CSSProperties,
    [subscribeFrame, initialPlayheadPct, currentFrame, totalFrames]
  );

  const duckingSvgPaths = useMemo(() => {
    const manifest = getRegisteredVoiceoverManifest();
    const baseVolume = 0.26;
    const duckedVolume = 0.085;
    const pts: Array<{ x: number; y: number }> = [];

    for (let i = 0; i <= ENVELOPE_SAMPLES; i++) {
      const ratio = i / ENVELOPE_SAMPLES;
      const sampleFrame = Math.round(ratio * (totalFrames - 1));
      const vol = computeMusicBedVolumeAtFrame({
        frame: sampleFrame,
        durationInFrames: totalFrames,
        dialogueSegments: composition.sceneTimeline,
        voiceoverManifest: manifest,
        baseVolume,
        duckedVolume,
      });
      const norm = Math.min(1, Math.max(0, vol / baseVolume));
      const x = ratio * 1000;
      const y = 26 - norm * 21;
      pts.push({ x, y });
    }

    const line = pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const area = `${line} L1000,28 L0,28 Z`;
    return { line, area };
  }, [composition.sceneTimeline, totalFrames]);

  const handleTrackBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      onSeek(Math.round(ratio * (totalFrames - 1)));
    },
    [onSeek, totalFrames]
  );

  const handleGenerateQaSheet = useCallback(async () => {
    if (qaState.status === 'running') return;
    setQaState({
      status: 'running',
      contactSheetUrl: null,
      outputFile: null,
      error: null,
    });

    try {
      const res = await fetch('/api/studio/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compositionId: composition.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        contactSheetUrl?: string;
        outputFile?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.contactSheetUrl) {
        throw new Error(
          data.error ?? `Nie udało się wygenerować arkusza QA (HTTP ${res.status})`
        );
      }

      setQaState({
        status: 'done',
        contactSheetUrl: data.contactSheetUrl,
        outputFile: data.outputFile ?? null,
        error: null,
      });
      setShowQaModal(true);
    } catch (err) {
      setQaState({
        status: 'error',
        contactSheetUrl: null,
        outputFile: null,
        error:
          err instanceof Error
            ? err.message
            : 'Błąd podczas generowania arkusza QA',
      });
    }
  }, [composition.id, qaState.status]);

  return (
    <>
      <section
        className="mp-director-timeline"
        aria-label="Multi-Track Director Timeline"
      >
        <div className="mp-dt-header">
          <button
            type="button"
            className="mp-dt-collapse-btn"
            onMouseDown={preventButtonFocus}
            onClick={() => setCollapsed((v) => !v)}
            title={
              collapsed
                ? 'Rozwiń wielościeżkową oś reżyserską'
                : 'Zwiń wielościeżkową oś reżyserską'
            }
          >
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>Oś reżyserska</span>
            <span className="mp-mini-badge">
              {cameraCuts.length} ujęć • {sfxCues.length} SFX
            </span>
          </button>

          {!hideQaActions && (
            <div className="mp-dt-actions">
              {qaState.status === 'error' && qaState.error && (
                <span className="mp-dt-qa-err" title={qaState.error}>
                  {qaState.error}
                </span>
              )}

              {qaState.status === 'done' && qaState.contactSheetUrl && (
                <button
                  type="button"
                  className="mp-toggle-btn is-active"
                  style={{ height: 25, fontSize: 11 }}
                  onMouseDown={preventButtonFocus}
                  onClick={() => setShowQaModal(true)}
                  title="Otwórz wygenerowany arkusz kontrolny 12 klatek"
                >
                  <ExternalLink size={12} />
                  <span>Podgląd arkusza QA</span>
                </button>
              )}

              <button
                type="button"
                className="mp-toggle-btn is-active"
                style={{
                  height: 26,
                  fontSize: 11.5,
                  padding: '0 10px',
                  opacity: qaState.status === 'running' ? 0.7 : 1,
                }}
                disabled={qaState.status === 'running'}
                onMouseDown={preventButtonFocus}
                onClick={() => void handleGenerateQaSheet()}
                title={`Wygeneruj 12-klatkowy arkusz kontrolny QA dla ${composition.id} (out/qa-*.png)`}
              >
                {qaState.status === 'running' ? (
                  <Loader2 size={12} className="mp-spin" />
                ) : (
                  <LayoutGrid size={12} />
                )}
                <span>
                  {qaState.status === 'running'
                    ? 'Renderowanie QA (12 klatek)…'
                    : 'Arkusz QA (12 klatek)'}
                </span>
              </button>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="mp-dt-lanes" ref={lanesRef} style={lanesStyle}>
            {/* Lane 1: Camera Cuts */}
            <div className="mp-dt-row">
              <div className="mp-dt-row-label">
                <Camera
                  size={12}
                  style={{ color: 'var(--mp-brand-violet)', flexShrink: 0 }}
                />
                <span>Ujęcia kamery</span>
              </div>
              <div className="mp-dt-track" onClick={handleTrackBarClick}>
                {cameraCuts.map((cut, idx) => {
                  const leftPct = (cut.fromFrame / totalFrames) * 100;
                  const widthPct = Math.max(
                    1.5,
                    (cut.durationInFrames / totalFrames) * 100
                  );
                  const isCurrent = idx === activeIndices.cameraIdx;

                  return (
                    <button
                      key={`${cut.shotLabel}-${idx}`}
                      type="button"
                      className={`mp-dt-clip is-camera ${
                        isCurrent ? 'is-active' : ''
                      }`}
                      style={{
                        left: `${leftPct}%`,
                        width: `calc(${widthPct}% - 2px)`,
                      }}
                      onMouseDown={preventButtonFocus}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeek(cut.fromFrame);
                      }}
                      title={`${cut.shotLabel} (f:${cut.fromFrame}..${
                        cut.fromFrame + cut.durationInFrames
                      })`}
                    >
                      <span>{cut.shotLabel}</span>
                    </button>
                  );
                })}
                <div className="mp-dt-playhead" />
              </div>
            </div>

            {/* Lane 2: Voiceover Segments */}
            <div className="mp-dt-row">
              <div className="mp-dt-row-label">
                <Mic
                  size={12}
                  style={{ color: 'var(--mp-emerald)', flexShrink: 0 }}
                />
                <span>Lektor</span>
              </div>
              <div className="mp-dt-track" onClick={handleTrackBarClick}>
                {composition.sceneTimeline.map((seg, idx) => {
                  const leftPct = (seg.fromFrame / totalFrames) * 100;
                  const widthPct = Math.max(
                    1.5,
                    (seg.durationInFrames / totalFrames) * 100
                  );
                  const isCurrent = idx === activeIndices.voIdx;

                  return (
                    <button
                      key={`${seg.sceneId}-${idx}`}
                      type="button"
                      className={`mp-dt-clip is-vo ${
                        isCurrent ? 'is-active' : ''
                      }`}
                      style={{
                        left: `${leftPct}%`,
                        width: `calc(${widthPct}% - 2px)`,
                      }}
                      onMouseDown={preventButtonFocus}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeek(seg.fromFrame);
                      }}
                      title={`${seg.label ?? seg.sceneId} (f:${seg.fromFrame})`}
                    >
                      <span>{seg.label ?? seg.sceneId}</span>
                    </button>
                  );
                })}
                <div className="mp-dt-playhead" />
              </div>
            </div>

            {/* Lane 3: SFX Cues */}
            <div className="mp-dt-row">
              <div className="mp-dt-row-label">
                <Volume2
                  size={12}
                  style={{ color: 'var(--mp-amber)', flexShrink: 0 }}
                />
                <span>Efekty SFX</span>
              </div>
              <div className="mp-dt-track" onClick={handleTrackBarClick}>
                {sfxCues.length === 0 ? (
                  <span className="mp-dt-track-hint">
                    Brak znaczników SFX na osi kompozycji
                  </span>
                ) : (
                  sfxCues.map((cue, idx) => {
                    const leftPct = Math.min(
                      98.5,
                      Math.max(0.5, (cue.fromFrame / totalFrames) * 100)
                    );
                    const isNear = activeSfxSet.has(idx);
                    return (
                      <button
                        key={`${cue.sfxId}-${cue.fromFrame}-${idx}`}
                        type="button"
                        className={`mp-dt-sfx-marker ${
                          isNear ? 'is-active' : ''
                        }`}
                        style={{ left: `${leftPct}%` }}
                        onMouseDown={preventButtonFocus}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek(cue.fromFrame);
                        }}
                        title={`${cue.label ?? cue.sfxId} @ f:${cue.fromFrame}`}
                      >
                        <span className="mp-dt-sfx-dot" />
                        <span className="mp-dt-sfx-text">
                          {cue.label ?? cue.sfxId}
                        </span>
                      </button>
                    );
                  })
                )}
                <div className="mp-dt-playhead" />
              </div>
            </div>

            {/* Lane 4: SmartMusicBed Auto-Ducking Envelope */}
            <div className="mp-dt-row">
              <div className="mp-dt-row-label">
                <Music2
                  size={12}
                  style={{ color: 'var(--mp-brand-cyan)', flexShrink: 0 }}
                />
                <span>Muzyka (Ducking)</span>
              </div>
              <div
                className="mp-dt-track is-envelope"
                onClick={handleTrackBarClick}
                title="Obwiednia głośności SmartMusicBed (automatyczne ściszanie muzyki pod lektorem)"
              >
                <svg
                  viewBox="0 0 1000 28"
                  preserveAspectRatio="none"
                  className="mp-dt-envelope-svg"
                >
                  <defs>
                    <linearGradient
                      id={duckingGradId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--mp-brand-cyan)"
                        stopOpacity="0.34"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--mp-brand-cyan)"
                        stopOpacity="0.04"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d={duckingSvgPaths.area}
                    fill={`url(#${duckingGradId})`}
                  />
                  <path
                    d={duckingSvgPaths.line}
                    fill="none"
                    stroke="var(--mp-brand-cyan)"
                    strokeWidth="2"
                  />
                </svg>
                <span className="mp-dt-envelope-badge">
                  {composition.hasMusicScore
                    ? 'SmartMusicBed • Aktywny'
                    : 'Podgląd obwiedni sidechain'}
                </span>
                <div className="mp-dt-playhead" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Standalone Contact-Sheet QA Modal */}
      {!hideQaActions && showQaModal && qaState.contactSheetUrl && (
        <div
          className="mp-qa-modal-backdrop"
          onClick={() => setShowQaModal(false)}
        >
          <div
            className="mp-qa-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mp-qa-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayoutGrid
                  size={16}
                  style={{ color: 'var(--mp-accent)', flexShrink: 0 }}
                />
                <strong>Arkusz QA (12 klatek) — {composition.title}</strong>
                {qaState.outputFile && (
                  <code className="mp-qa-file-pill">{qaState.outputFile}</code>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={qaState.contactSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mp-icon-btn"
                  style={{
                    height: 28,
                    fontSize: 11.5,
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={12} />
                  <span>Otwórz 1:1 w nowej karcie</span>
                </a>

                {onOpenOutputFile && qaState.outputFile && (
                  <button
                    type="button"
                    className="mp-icon-btn"
                    style={{ height: 28, fontSize: 11.5 }}
                    onMouseDown={preventButtonFocus}
                    onClick={() => onOpenOutputFile(qaState.outputFile)}
                  >
                    <FolderOpen size={12} />
                    <span>Pokaż w out/</span>
                  </button>
                )}

                <button
                  type="button"
                  className="mp-icon-btn"
                  style={{ height: 28, padding: '0 8px' }}
                  onMouseDown={preventButtonFocus}
                  onClick={() => setShowQaModal(false)}
                  aria-label="Zamknij"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="mp-qa-modal-body">
              <img
                src={qaState.contactSheetUrl}
                alt={`Arkusz QA dla ${composition.id}`}
                className="mp-qa-modal-img"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
