import React, { useMemo } from 'react';
import { FillLayer } from '../FillLayer';
import {
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import { useStudioStyle } from '../style';
import { DIRECTOR_PACING_BUDGET } from './pacing';

export interface ContinuousSceneSpec {
  id: string;
  durationInFrames: number;
  usesThree?: boolean;
  veilColor?: string;
  label?: string;
  render: () => React.ReactNode;
}

export interface ContinuousSceneWindow {
  id: string;
  nominalStart: number;
  nominalEnd: number;
  mountFrom: number;
  mountDuration: number;
  usesThree: boolean;
  useVeilAtStart: boolean;
  useVeilAtEnd: boolean;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const smoothstep = Easing.inOut(Easing.cubic);

/**
 * Computes `<Sequence>` mounting windows across `scenes` such that:
 * 1. Nominal timeline duration equals `sum(s.durationInFrames)`.
 * 2. Adjacent `usesThree && usesThree` boundaries NEVER overlap `<Sequence>` mounts
 *    (`<= 1` active WebGL context on every single frame `0..totalFrames - 1`) and mark
 *    `useVeilAtEnd` / `useVeilAtStart` for an optical luminous veil across the seam.
 * 3. Boundaries where at least one side has `!usesThree` overlap smoothly across
 *    `[B - halfBefore, B + halfAfter]` (clamped safely to `<= floor(sceneDuration / 2)`
 *    so non-adjacent `usesThree` scenes across short 2D bridges can never collide either).
 */
export function computeContinuousSceneWindows(
  scenes: ReadonlyArray<Omit<ContinuousSceneSpec, 'render'>>,
  crossDissolveFrames: number = DIRECTOR_PACING_BUDGET.defaultCrossDissolveFrames
): ContinuousSceneWindow[] {
  if (scenes.length === 0) {
    return [];
  }

  const rawDissolve = Math.max(0, Math.round(crossDissolveFrames));
  const durations = scenes.map((s) =>
    Math.max(1, Math.round(s.durationInFrames))
  );

  const nominalStarts: number[] = [];
  const nominalEnds: number[] = [];
  let cursor = 0;
  for (let i = 0; i < scenes.length; i++) {
    nominalStarts.push(cursor);
    cursor += durations[i]!;
    nominalEnds.push(cursor);
  }

  // Per-boundary extension metadata between scene `b` and `b + 1`
  const extendPrevAfter: number[] = [];
  const extendNextBefore: number[] = [];
  const useVeilBoundary: boolean[] = [];

  for (let b = 0; b < scenes.length - 1; b++) {
    const prevThree = Boolean(scenes[b]!.usesThree);
    const nextThree = Boolean(scenes[b + 1]!.usesThree);

    if (prevThree && nextThree) {
      extendPrevAfter.push(0);
      extendNextBefore.push(0);
      useVeilBoundary.push(rawDissolve > 0);
    } else {
      const maxHalf = Math.min(
        Math.floor(durations[b]! / 2),
        Math.floor(durations[b + 1]! / 2)
      );
      const halfBefore = Math.min(Math.floor(rawDissolve / 2), maxHalf);
      const halfAfter = Math.min(
        rawDissolve - Math.floor(rawDissolve / 2),
        maxHalf
      );
      extendPrevAfter.push(halfAfter);
      extendNextBefore.push(halfBefore);
      useVeilBoundary.push(false);
    }
  }

  return scenes.map((scene, i) => {
    const nominalStart = nominalStarts[i]!;
    const nominalEnd = nominalEnds[i]!;
    const mountFrom =
      i === 0 ? 0 : Math.max(0, nominalStart - extendNextBefore[i - 1]!);
    const mountEnd =
      i === scenes.length - 1 ? nominalEnd : nominalEnd + extendPrevAfter[i]!;

    return {
      id: scene.id,
      nominalStart,
      nominalEnd,
      mountFrom,
      mountDuration: Math.max(1, mountEnd - mountFrom),
      usesThree: Boolean(scene.usesThree),
      useVeilAtStart: i > 0 ? Boolean(useVeilBoundary[i - 1]) : false,
      useVeilAtEnd:
        i < scenes.length - 1 ? Boolean(useVeilBoundary[i]) : false,
    };
  });
}

export interface OpticalCrossDissolveProps {
  /** Normalized entrance dissolve progress in `[0, 1]` (`1` = settled, default `1`) */
  enterProgress?: number;
  /** Normalized exit dissolve progress in `[0, 1]` (`0` = settled, `1` = exited, default `0`) */
  exitProgress?: number;
  /** Optional local frame at which this layer begins dissolving in */
  enterFromFrame?: number;
  /** Optional local frame at which this layer begins dissolving out */
  exitFromFrame?: number;
  /** Dissolve window length in frames when `enterFromFrame` or `exitFromFrame` is set (default `48`) */
  durationInFrames?: number;
  /** Peak optical Circle-of-Confusion defocus radius in px at transition midpoint (default `4`) */
  maxBlurPx?: number;
  /** Initial scale at `enterProgress = 0` (default `0.988`) */
  enterScaleFrom?: number;
  /** Outgoing scale at `exitProgress = 1` (default `1.016`) */
  exitScaleTo?: number;
  /** Preserve Clean Frame 0 when mounted at global frame `0` (default `false`) */
  forceCleanFrameZero?: boolean;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

const OpticalCrossDissolveShell: React.FC<
  Omit<
    OpticalCrossDissolveProps,
    'enterFromFrame' | 'exitFromFrame' | 'durationInFrames'
  >
> = ({
  enterProgress = 1,
  exitProgress = 0,
  maxBlurPx = 4,
  enterScaleFrom = 0.988,
  exitScaleTo = 1.016,
  forceCleanFrameZero = false,
  style,
  className,
  children,
}) => {
  if (forceCleanFrameZero) {
    return (
      <FillLayer
        className={className}
        style={{
          opacity: 1,
          filter: 'none',
          transform: 'scale(1)',
          transformOrigin: '50% 50%',
          ...style,
        }}
      >
        {children}
      </FillLayer>
    );
  }

  const clampedEnter = clamp(enterProgress, 0, 1);
  const clampedExit = clamp(exitProgress, 0, 1);

  const enterAlpha = clampedEnter >= 1 ? 1 : smoothstep(clampedEnter);
  const exitAlpha = clampedExit <= 0 ? 1 : 1 - smoothstep(clampedExit);
  const opacity = Number((enterAlpha * exitAlpha).toFixed(4));

  const enterBell =
    clampedEnter > 0 && clampedEnter < 1
      ? Math.sin(Math.PI * smoothstep(clampedEnter))
      : 0;
  const exitBell =
    clampedExit > 0 && clampedExit < 1
      ? Math.sin(Math.PI * smoothstep(clampedExit))
      : 0;
  const blurPx = Math.max(enterBell, exitBell) * Math.max(0, maxBlurPx);
  const filterCss = blurPx < 0.25 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;

  let scale = 1;
  if (clampedEnter < 1) {
    scale = enterScaleFrom + (1 - enterScaleFrom) * smoothstep(clampedEnter);
  }
  if (clampedExit > 0) {
    scale *= 1 + (exitScaleTo - 1) * smoothstep(clampedExit);
  }
  const transformCss =
    Math.abs(scale - 1) < 0.0002 ? 'scale(1)' : `scale(${scale.toFixed(4)})`;

  return (
    <FillLayer
      className={className}
      data-optical-dissolve="true"
      style={{
        opacity,
        filter: filterCss,
        transform: transformCss,
        transformOrigin: '50% 50%',
        ...style,
      }}
    >
      {children}
    </FillLayer>
  );
};

const TimedOpticalCrossDissolve: React.FC<OpticalCrossDissolveProps> = ({
  enterProgress: enterProgressProp,
  exitProgress: exitProgressProp,
  enterFromFrame,
  exitFromFrame,
  durationInFrames = 48,
  ...rest
}) => {
  const localFrame = useCurrentFrame();
  const safeSpan = Math.max(1, durationInFrames);

  let enterP = enterProgressProp ?? 1;
  if (typeof enterFromFrame === 'number') {
    if (localFrame < enterFromFrame) {
      return null;
    }
    enterP = clamp((localFrame - enterFromFrame) / safeSpan, 0, 1);
  }

  let exitP = exitProgressProp ?? 0;
  if (typeof exitFromFrame === 'number') {
    if (localFrame >= exitFromFrame + safeSpan) {
      return null;
    }
    exitP =
      localFrame <= exitFromFrame
        ? 0
        : clamp((localFrame - exitFromFrame) / safeSpan, 0, 1);
  }

  return (
    <OpticalCrossDissolveShell
      enterProgress={enterP}
      exitProgress={exitP}
      {...rest}
    />
  );
};

/**
 * Optical cross-dissolve wrapper applying cubic smoothstep opacity,
 * gentle `0 -> 4px -> 0` lens focus-pull (`< 0.25px -> filter: 'none'` deadzone),
 * and continuous `0.988 -> 1.0 -> 1.016` scale match-drift.
 */
export const OpticalCrossDissolve: React.FC<OpticalCrossDissolveProps> = (
  props
) => {
  if (
    typeof props.enterFromFrame === 'number' ||
    typeof props.exitFromFrame === 'number'
  ) {
    return <TimedOpticalCrossDissolve {...props} />;
  }
  return <OpticalCrossDissolveShell {...props} />;
};

export interface ContinuousSceneFlowProps {
  scenes: ReadonlyArray<ContinuousSceneSpec>;
  crossDissolveFrames?: number;
  style?: React.CSSProperties;
}

/**
 * Calm, continuous 60 FPS scene composer replacing choppy hard cuts and geometric wipes.
 * Automatically overlaps 2D/hybrid boundaries with `<OpticalCrossDissolve>` while
 * bridging 3D-to-3D (`usesThree && usesThree`) seams via a luminous studio veil so at most
 * 1 `<ThreeCanvas>` WebGL context is ever mounted on any frame.
 */
export const ContinuousSceneFlow: React.FC<ContinuousSceneFlowProps> = ({
  scenes,
  crossDissolveFrames = DIRECTOR_PACING_BUDGET.defaultCrossDissolveFrames,
  style,
}) => {
  const globalFrame = useCurrentFrame();
  const studioStyle = useStudioStyle();

  const windows = useMemo(
    () => computeContinuousSceneWindows(scenes, crossDissolveFrames),
    [scenes, crossDissolveFrames]
  );

  const rawDissolve = Math.max(0, Math.round(crossDissolveFrames));

  return (
    <FillLayer
      data-continuous-scene-flow="true"
      style={{
        backgroundColor: studioStyle.palette.bgCanvas,
        overflow: 'hidden',
        isolation: 'isolate',
        contain: 'layout paint style',
        ...style,
      }}
    >
      {windows.map((win, idx) => {
        const scene = scenes[idx]!;
        const prevWin = idx > 0 ? windows[idx - 1] : undefined;
        const nextWin = idx < windows.length - 1 ? windows[idx + 1] : undefined;

        let enterProgress = 1;
        if (idx > 0 && !win.useVeilAtStart && prevWin) {
          const enterStart = win.mountFrom;
          const enterEnd = prevWin.mountFrom + prevWin.mountDuration;
          if (enterEnd > enterStart) {
            enterProgress = clamp(
              (globalFrame - enterStart) / (enterEnd - enterStart),
              0,
              1
            );
          }
        }

        let exitProgress = 0;
        if (idx < windows.length - 1 && !win.useVeilAtEnd && nextWin) {
          const exitStart = nextWin.mountFrom;
          const exitEnd = win.mountFrom + win.mountDuration;
          if (exitEnd > exitStart) {
            exitProgress = clamp(
              (globalFrame - exitStart) / (exitEnd - exitStart),
              0,
              1
            );
          }
        }

        return (
          <Sequence
            key={scene.id}
            name={scene.label ?? scene.id}
            from={win.mountFrom}
            durationInFrames={win.mountDuration}
          >
            <OpticalCrossDissolve
              enterProgress={enterProgress}
              exitProgress={exitProgress}
              forceCleanFrameZero={idx === 0 && globalFrame <= 0}
              style={{ zIndex: idx + 1 }}
            >
              {scene.render()}
            </OpticalCrossDissolve>
          </Sequence>
        );
      })}

      {/* Optical Luminous Veils for 3D-to-3D boundaries (zero WebGL overlap!) */}
      {globalFrame > 0 &&
        windows.map((win, idx) => {
          if (!win.useVeilAtEnd || idx >= windows.length - 1) {
            return null;
          }
          const nextWin = windows[idx + 1]!;
          const prevScene = scenes[idx]!;
          const nextScene = scenes[idx + 1]!;
          const boundary = win.nominalEnd;
          const prevLen = win.nominalEnd - win.nominalStart;
          const nextLen = nextWin.nominalEnd - nextWin.nominalStart;
          const maxHalf = Math.min(
            Math.floor(prevLen / 2),
            Math.floor(nextLen / 2)
          );
          const halfBefore = Math.min(Math.floor(rawDissolve / 2), maxHalf);
          const halfAfter = Math.min(
            rawDissolve - Math.floor(rawDissolve / 2),
            maxHalf
          );
          const veilStart = Math.max(1, boundary - halfBefore);
          const veilEnd = boundary + halfAfter;

          if (globalFrame < veilStart || globalFrame > veilEnd) {
            return null;
          }

          let veilAlpha = 0;
          if (globalFrame < boundary) {
            const preSpan = Math.max(1, boundary - 1 - veilStart);
            const u = clamp((globalFrame - veilStart) / preSpan, 0, 1);
            veilAlpha = smoothstep(u);
          } else {
            const postSpan = Math.max(1, veilEnd - boundary);
            const u = clamp((globalFrame - boundary) / postSpan, 0, 1);
            veilAlpha = 1 - smoothstep(u);
          }

          if (veilAlpha <= 0.002) {
            return null;
          }

          const baseVeil =
            nextScene.veilColor ??
            prevScene.veilColor ??
            studioStyle.palette.bgCanvas;

          return (
            <FillLayer
              key={`veil-${prevScene.id}-${nextScene.id}`}
              data-optical-veil={`${prevScene.id}->${nextScene.id}`}
              style={{
                zIndex: windows.length + 10,
                opacity: Number(veilAlpha.toFixed(4)),
                backgroundColor: baseVeil,
                backgroundImage: `radial-gradient(circle at 50% 46%, ${studioStyle.palette.bgElevated} 0%, ${baseVeil} 72%)`,
                pointerEvents: 'none',
              }}
            />
          );
        })}
    </FillLayer>
  );
};

export interface SceneSubViewDissolveProps {
  firstView: React.ReactNode;
  secondView: React.ReactNode;
  /** Local scene frame at the midpoint of the A -> B crossfade */
  switchAtFrame: number;
  /** Crossfade window length in frames (default 54, clamped to >= 48) */
  dissolveFrames?: number;
  curve?: 'sin' | 'cubic';
}

export const SceneSubViewDissolve: React.FC<SceneSubViewDissolveProps> = ({
  firstView,
  secondView,
  switchAtFrame,
  dissolveFrames = 54,
  curve = 'sin',
}) => {
  const frame = useCurrentFrame();
  if (frame <= 0) return null;

  const span = Math.max(48, dissolveFrames);
  const half = span / 2;
  const easingFn =
    curve === 'cubic' ? Easing.inOut(Easing.cubic) : Easing.inOut(Easing.sin);

  const t = interpolate(
    frame,
    [switchAtFrame - half, switchAtFrame + half],
    [0, 1],
    {
      easing: easingFn,
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <FillLayer>
      {t < 1 && (
        <FillLayer style={{ opacity: 1 - t }}>{firstView}</FillLayer>
      )}
      {t > 0 && (
        <FillLayer style={{ opacity: t }}>{secondView}</FillLayer>
      )}
    </FillLayer>
  );
};
