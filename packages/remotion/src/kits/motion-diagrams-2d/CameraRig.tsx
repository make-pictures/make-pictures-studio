import React from 'react';
import { FillLayer } from '../../FillLayer';
import {
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  StageLightingRig,
  useStudioFontsReady,
  useStudioStyle,
} from "../..";

export interface CameraKeyframe {
  /** Frame when the camera begins moving toward this target */
  startFrame: number;
  /** World X coordinate to center in the viewport */
  x: number;
  /** World Y coordinate to center in the viewport */
  y: number;
  /** Camera zoom factor (1.0 = 1:1 with 1920x1080) */
  zoom: number;
  /** Subtle 2D camera banking angle in degrees */
  rotateZ?: number;
  /** Optional spring stiffness override */
  stiffness?: number;
  /** Optional mid-flight zoom dip for long camera flights */
  flightZoomDip?: number;
  /** Optional mid-flight banking angle (deg) */
  flightBankDeg?: number;
}

export interface CameraRigProps {
  keyframes: CameraKeyframe[];
  stageWidth?: number;
  stageHeight?: number;
  variant?: 'light' | 'dark';
  children?: React.ReactNode;
}

export function evaluateCameraState(
  frame: number,
  fps: number,
  keyframes: CameraKeyframe[]
) {
  if (keyframes.length === 0) {
    return {
      x: 960,
      y: 540,
      zoom: 1,
      rotateZ: 0,
      velocity: 0,
    };
  }

  let x = keyframes[0].x;
  let y = keyframes[0].y;
  let zoom = keyframes[0].zoom;
  let rotateZ = keyframes[0].rotateZ ?? 0;
  let velocity = 0;

  for (let i = 1; i < keyframes.length; i++) {
    const prev = keyframes[i - 1];
    const curr = keyframes[i];

    if (frame < curr.startFrame) {
      break;
    }

    const p = spring({
      frame: frame - curr.startFrame,
      fps,
      config: {
        damping: 200,
        stiffness: curr.stiffness ?? 42,
        mass: 1.25,
      },
    });

    const midFlightArc = 0.5 * (1 - Math.cos(2 * Math.PI * p));
    const zoomDip = (curr.flightZoomDip ?? 0) * midFlightArc;
    const bankAdd = (curr.flightBankDeg ?? 0) * midFlightArc;

    x += (curr.x - prev.x) * p;
    y += (curr.y - prev.y) * p;
    zoom += (curr.zoom - prev.zoom) * p + zoomDip;
    rotateZ += ((curr.rotateZ ?? 0) - (prev.rotateZ ?? 0)) * p + bankAdd;
    velocity = Math.max(velocity, midFlightArc);
  }

  const floatX = Math.sin(frame / 45) * 4;
  const floatY = Math.cos(frame / 55) * 3.5;

  return {
    x: x + floatX,
    y: y + floatY,
    zoom,
    rotateZ,
    velocity,
  };
}

export const CameraRig: React.FC<CameraRigProps> = ({
  keyframes,
  stageWidth = 1920,
  stageHeight = 1080,
  variant,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useStudioFontsReady();
  const studioStyle = useStudioStyle();

  const isDark =
    variant === 'dark'
      ? true
      : variant === 'light'
        ? false
        : studioStyle.surface.isDark;

  const resolvedBgCanvas =
    variant === 'dark' && !studioStyle.surface.isDark
      ? '#090A0F'
      : variant === 'light' && studioStyle.surface.isDark
        ? '#F8F9FF'
        : studioStyle.palette.bgCanvas;

  if (frame <= 0) {
    return <FillLayer style={{ backgroundColor: resolvedBgCanvas }} />;
  }

  const cam = evaluateCameraState(frame, fps, keyframes);
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;

  const gridSpacing = Math.max(24, 80 * cam.zoom);
  const dotSpacing = Math.max(16, 40 * cam.zoom);
  const gridOffsetX = centerX - cam.x * cam.zoom;
  const gridOffsetY = centerY - cam.y * cam.zoom;

  const gridLineColor =
    variant !== undefined
      ? isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(15, 23, 42, 0.05)'
      : isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : `${studioStyle.palette.inkBorder}22`;

  const gridDotColor =
    variant !== undefined
      ? isDark
        ? 'rgba(226, 232, 240, 0.16)'
        : 'rgba(51, 65, 85, 0.14)'
      : `${studioStyle.palette.accentPrimary}2E`;

  return (
    <FillLayer
      style={{
        backgroundColor: resolvedBgCanvas,
        overflow: 'hidden',
      }}
    >
      <StageLightingRig renderBaseFill={false} seed="camera-rig-2d" />

      <FillLayer
        style={{
          backgroundImage: `
            linear-gradient(to right, ${gridLineColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)
          `,
          backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
          backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
          pointerEvents: 'none',
        }}
      />
      <FillLayer
        style={{
          backgroundImage: `radial-gradient(${gridDotColor} 1.35px, transparent 1.35px)`,
          backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
          backgroundPosition: `${gridOffsetX + dotSpacing / 2}px ${gridOffsetY + dotSpacing / 2}px`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          transformOrigin: '0 0',
          willChange: 'transform',
          transform: `translate3d(${centerX}px, ${centerY}px, 0) scale(${cam.zoom}) rotate(${cam.rotateZ}deg) translate3d(${-cam.x}px, ${-cam.y}px, 0)`,
        }}
      >
        {children}
      </div>
    </FillLayer>
  );
};
