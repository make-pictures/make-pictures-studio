import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';

export type PlayerLifecycleEventName =
  | 'play'
  | 'pause'
  | 'ended'
  | 'seeked'
  | 'frameupdate';

export interface PlayerLifecycleTarget {
  addEventListener(
    name: 'play',
    callback: (data: { detail: undefined }) => void
  ): void;
  addEventListener(
    name: 'pause',
    callback: (data: { detail: undefined }) => void
  ): void;
  addEventListener(
    name: 'ended',
    callback: (data: { detail: undefined }) => void
  ): void;
  addEventListener(
    name: 'seeked',
    callback: (data: { detail: { frame: number } }) => void
  ): void;
  addEventListener(
    name: 'frameupdate',
    callback: (data: { detail: { frame: number } }) => void
  ): void;
  removeEventListener(
    name: 'play',
    callback: (data: { detail: undefined }) => void
  ): void;
  removeEventListener(
    name: 'pause',
    callback: (data: { detail: undefined }) => void
  ): void;
  removeEventListener(
    name: 'ended',
    callback: (data: { detail: undefined }) => void
  ): void;
  removeEventListener(
    name: 'seeked',
    callback: (data: { detail: { frame: number } }) => void
  ): void;
  removeEventListener(
    name: 'frameupdate',
    callback: (data: { detail: { frame: number } }) => void
  ): void;
  isPlaying?: () => boolean;
  getCurrentFrame?: () => number;
}

export interface PlayerLifecycleCallbacks {
  fps: number;
  now?: () => number;
  onFrameChange?: (frame: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onFpsMeasure?: (fps: number) => void;
}

function defaultNow(): number {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function clampFrameIndex(frame: number, durationInFrames: number): number {
  const maxFrame = Math.max(0, durationInFrames - 1);
  if (!Number.isFinite(frame)) {
    return 0;
  }
  return Math.max(0, Math.min(maxFrame, Math.round(frame)));
}

/**
 * Pure lifecycle binder for `@remotion/player` `PlayerRef` instances.
 * Synchronizes `play`, `pause`, `ended`, `seeked`, and `frameupdate` events,
 * reconciles `isPlaying` on `frameupdate`, handles `loop === false` completion (`ended`),
 * and cleanly resets `isPlaying` to `false` when unmounted or passed `null`.
 */
export function attachPlayerLifecycle(
  player: PlayerLifecycleTarget | null,
  callbacks: PlayerLifecycleCallbacks
): () => void {
  if (!player) {
    callbacks.onPlayingChange(false);
    return () => {};
  }

  const getNow = callbacks.now ?? defaultNow;
  let detached = false;
  let frameSamples = 0;
  let windowStart = getNow();
  let lastKnownPlaying = Boolean(player.isPlaying?.());

  callbacks.onPlayingChange(lastKnownPlaying);

  const handlePlay = () => {
    if (detached) return;
    frameSamples = 0;
    windowStart = getNow();
    lastKnownPlaying = true;
    callbacks.onPlayingChange(true);
  };

  const handlePause = () => {
    if (detached) return;
    lastKnownPlaying = false;
    callbacks.onPlayingChange(false);
    callbacks.onFpsMeasure?.(callbacks.fps);
  };

  const handleEnded = () => {
    if (detached) return;
    lastKnownPlaying = false;
    callbacks.onPlayingChange(false);
    callbacks.onFpsMeasure?.(callbacks.fps);
  };

  const handleSeeked = (e: { detail: { frame: number } }) => {
    if (detached) return;
    const f = e?.detail?.frame;
    if (typeof f === 'number' && Number.isFinite(f)) {
      callbacks.onFrameChange?.(f);
    }
    if (typeof player.isPlaying === 'function') {
      const actualPlaying = Boolean(player.isPlaying());
      if (actualPlaying !== lastKnownPlaying) {
        lastKnownPlaying = actualPlaying;
        callbacks.onPlayingChange(actualPlaying);
        if (!actualPlaying) {
          callbacks.onFpsMeasure?.(callbacks.fps);
        }
      }
    }
  };

  const handleFrameUpdate = (e: { detail: { frame: number } }) => {
    if (detached) return;
    const f = e?.detail?.frame;
    if (typeof f === 'number' && Number.isFinite(f)) {
      callbacks.onFrameChange?.(f);
    }

    if (typeof player.isPlaying === 'function') {
      const actualPlaying = Boolean(player.isPlaying());
      if (actualPlaying !== lastKnownPlaying) {
        lastKnownPlaying = actualPlaying;
        callbacks.onPlayingChange(actualPlaying);
        if (!actualPlaying) {
          callbacks.onFpsMeasure?.(callbacks.fps);
        }
      }
    }

    const now = getNow();
    frameSamples += 1;
    const elapsed = now - windowStart;
    if (elapsed >= 500) {
      const measured = Math.min(
        callbacks.fps,
        Math.round((frameSamples * 1000) / elapsed)
      );
      callbacks.onFpsMeasure?.(measured > 0 ? measured : callbacks.fps);
      frameSamples = 0;
      windowStart = now;
    }
  };

  player.addEventListener('play', handlePlay);
  player.addEventListener('pause', handlePause);
  player.addEventListener('ended', handleEnded);
  player.addEventListener('seeked', handleSeeked);
  player.addEventListener('frameupdate', handleFrameUpdate);

  return () => {
    if (detached) return;
    detached = true;
    player.removeEventListener('play', handlePlay);
    player.removeEventListener('pause', handlePause);
    player.removeEventListener('ended', handleEnded);
    player.removeEventListener('seeked', handleSeeked);
    player.removeEventListener('frameupdate', handleFrameUpdate);
    lastKnownPlaying = false;
    callbacks.onPlayingChange(false);
  };
}

export interface UseRemotionPlayerOptions {
  fps: number;
  durationInFrames: number;
  resetKey: string;
  initialFrame?: number;
  onFrameChange?: (frame: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onFpsMeasure?: (fps: number) => void;
}

export interface UseRemotionPlayerResult {
  playerRef: React.MutableRefObject<PlayerRef | null>;
  playerRefCallback: (instance: PlayerRef | null) => void;
  displayFrame: number;
  currentFrameRef: React.MutableRefObject<number>;
  isPlaying: boolean;
  loop: boolean;
  setLoop: React.Dispatch<React.SetStateAction<boolean>>;
  muted: boolean;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMute: () => void;
  seekToFrame: (target: number) => void;
  togglePlay: () => void;
  pause: () => void;
}

export function useRemotionPlayer(
  options: UseRemotionPlayerOptions
): UseRemotionPlayerResult {
  const {
    fps,
    durationInFrames,
    resetKey,
    initialFrame,
    onFrameChange,
    onPlayingChange,
    onFpsMeasure,
  } = options;

  const playerRef = useRef<PlayerRef | null>(null);
  const [playerInstance, setPlayerInstance] = useState<PlayerRef | null>(null);

  const initialClamped = clampFrameIndex(initialFrame ?? 0, durationInFrames);
  const currentFrameRef = useRef<number>(initialClamped);
  const prevResetKeyRef = useRef<string>(resetKey);
  const effectResetKeyRef = useRef<string>(resetKey);

  const [displayFrame, setDisplayFrame] = useState<number>(initialClamped);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);

  const [loop, setLoop] = useState<boolean>(true);
  const loopRef = useRef<boolean>(true);
  loopRef.current = loop;

  const [muted, setMutedState] = useState<boolean>(false);
  const mutedRef = useRef<boolean>(false);
  mutedRef.current = muted;

  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;

  const onFpsMeasureRef = useRef(onFpsMeasure);
  onFpsMeasureRef.current = onFpsMeasure;

  // Preserve currentFrameRef across HMR when resetKey stays the same;
  // reset synchronously during render when switching resetKey (e.g. composition.id).
  if (prevResetKeyRef.current !== resetKey) {
    prevResetKeyRef.current = resetKey;
    currentFrameRef.current = clampFrameIndex(
      initialFrame ?? 0,
      durationInFrames
    );
  } else if (currentFrameRef.current > Math.max(0, durationInFrames - 1)) {
    currentFrameRef.current = clampFrameIndex(
      currentFrameRef.current,
      durationInFrames
    );
  }

  useEffect(() => {
    if (effectResetKeyRef.current !== resetKey) {
      effectResetKeyRef.current = resetKey;
      const resetTarget = clampFrameIndex(initialFrame ?? 0, durationInFrames);
      currentFrameRef.current = resetTarget;
      setDisplayFrame(resetTarget);
      isPlayingRef.current = false;
      setIsPlaying(false);
      onFrameChangeRef.current?.(resetTarget);
      onPlayingChangeRef.current?.(false);
    } else {
      setDisplayFrame(currentFrameRef.current);
    }
  }, [resetKey, initialFrame, durationInFrames]);

  const playerRefCallback = useCallback((instance: PlayerRef | null) => {
    playerRef.current = instance;
    setPlayerInstance(instance);
    if (!instance) {
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else if (mutedRef.current) {
      instance.mute?.();
    }
  }, []);

  // Re-bind Remotion Player event listeners whenever the underlying Player mounts,
  // unmounts, or remounts (HMR, StageErrorBoundary retry, composition/aspect switch).
  useEffect(() => {
    return attachPlayerLifecycle(playerInstance, {
      fps,
      onFrameChange: (frame) => {
        const clamped = clampFrameIndex(frame, durationInFrames);
        currentFrameRef.current = clamped;
        setDisplayFrame(clamped);
        onFrameChangeRef.current?.(clamped);
      },
      onPlayingChange: (playing) => {
        const changed = isPlayingRef.current !== playing;
        isPlayingRef.current = playing;
        setIsPlaying(playing);
        if (changed) {
          onPlayingChangeRef.current?.(playing);
        }
      },
      onFpsMeasure: (measured) => {
        onFpsMeasureRef.current?.(measured);
      },
    });
  }, [playerInstance, fps, durationInFrames]);

  const seekToFrame = useCallback(
    (target: number) => {
      const clamped = clampFrameIndex(target, durationInFrames);
      currentFrameRef.current = clamped;
      setDisplayFrame(clamped);
      onFrameChangeRef.current?.(clamped);
      playerRef.current?.seekTo(clamped);
    },
    [durationInFrames]
  );

  const pause = useCallback(() => {
    playerRef.current?.pause();
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      onPlayingChangeRef.current?.(false);
    } else {
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    const currentlyPlaying =
      typeof player.isPlaying === 'function'
        ? Boolean(player.isPlaying())
        : isPlayingRef.current;

    if (currentlyPlaying) {
      player.pause();
    } else {
      if (
        !loopRef.current &&
        durationInFrames > 1 &&
        currentFrameRef.current >= durationInFrames - 1
      ) {
        currentFrameRef.current = 0;
        setDisplayFrame(0);
        onFrameChangeRef.current?.(0);
        player.seekTo(0);
      }
      player.play();
    }
  }, [durationInFrames]);

  const setMuted: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (action) => {
      setMutedState((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        mutedRef.current = next;
        if (next) {
          playerRef.current?.mute?.();
        } else {
          playerRef.current?.unmute?.();
        }
        return next;
      });
    },
    []
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, [setMuted]);

  // Capture-phase keyboard shortcuts: prevents focused <button> from firing
  // a duplicate synthetic click event when Space is pressed!
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute?.('contenteditable') === 'true'
        ) {
          return;
        }
      }

      if (e.code === 'Space' || e.code === 'KeyK') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          togglePlay();
        }
      } else if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
        e.preventDefault();
        pause();
        seekToFrame(currentFrameRef.current - (e.shiftKey ? 10 : 1));
      } else if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
        e.preventDefault();
        pause();
        seekToFrame(currentFrameRef.current + (e.shiftKey ? 10 : 1));
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        pause();
        seekToFrame(currentFrameRef.current - 10);
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        pause();
        seekToFrame(currentFrameRef.current + 10);
      } else if (e.key === '0' || e.key === 'Home' || e.code === 'Home') {
        e.preventDefault();
        pause();
        seekToFrame(0);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pause, seekToFrame, togglePlay]);

  return {
    playerRef,
    playerRefCallback,
    displayFrame,
    currentFrameRef,
    isPlaying,
    loop,
    setLoop,
    muted,
    setMuted,
    toggleMute,
    seekToFrame,
    togglePlay,
    pause,
  };
}
