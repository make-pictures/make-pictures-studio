import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  CINEMATIC_SPRINGS,
  resolveArtWorld,
  resolveStyleOptics,
  useStudioStyle,
  type ArtWorld,
  type StylePreset,
} from '@make-pictures/core';
import { ContactShadowDisc3D } from '../vfx/StagePostProcessing3D';

export interface ScenicRoomTokens {
  artWorld: ArtWorld;
  wallColor: string;
  wingWallColor: string;
  baseboardColor: string;
  corniceColor: string;
  floorInlayColor: string;
  floorBorderColor: string;
  windowGlowColor: string;
  lightShaftColor: string;
  lightShaftOpacity: number;
  lightAngleDeg: number;
  lightShaftTiltRad: number;
  consoleColor: string;
  consoleTopColor: string;
  centerpiecePrimaryColor: string;
  centerpieceSecondaryColor: string;
  frameOuterColor: string;
  passePartoutColor: string;
  shelfWoodColor: string;
  foliageColor: string;
  wallRoughness: number;
  wallMetalness: number;
  consoleRoughness: number;
  consoleMetalness: number;
  hasWindowSlit: boolean;
  hasArchedWindow: boolean;
  hasBookshelfNiche: boolean;
  hasGalleryFrame: boolean;
  hasLightCove: boolean;
  centerpieceKind:
    | 'atelier-torus-prism'
    | 'workshop-sketch-lamp'
    | 'gallery-stone-folio';
  backWallZ: number;
  centerpieceZ: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

let cachedSoftShaftTexture: THREE.CanvasTexture | null = null;

function getSoftWindowShaftTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedSoftShaftTexture) return cachedSoftShaftTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx && typeof ctx.getImageData === 'function') {
    const img = ctx.createImageData(128, 256);
    const data = img.data;
    for (let y = 0; y < 256; y++) {
      const v = y / 255;
      const vFade = Math.pow(Math.sin(v * Math.PI), 1.35) * (1 - v * 0.28);
      for (let x = 0; x < 128; x++) {
        const u = x / 127;
        const uFade = Math.pow(Math.sin(u * Math.PI), 1.5);
        const idx = (y * 128 + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = Math.round(Math.max(0, Math.min(1, uFade * vFade)) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  } else if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.28, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedSoftShaftTexture = tex;
  return tex;
}

function blendColor(t: number, colorA: string, colorB: string): string {
  try {
    return interpolateColors(t, [0, 1], [colorA, colorB]);
  } catch {
    return t < 0.5 ? colorA : colorB;
  }
}

/**
 * Pure deterministic resolver mapping any `StylePreset` to a sculpted 3D architectural
 * miniature room specification across the 3 Artistic Worlds (`atelier`, `illustrative`, `editorial-gallery`).
 */
export function computeScenicRoomTokens(
  style: StylePreset,
  variant: 'auto' | ArtWorld = 'auto'
): ScenicRoomTokens {
  const artWorld: ArtWorld =
    variant === 'auto' ? resolveArtWorld(style) : variant;
  const optics = resolveStyleOptics(style);
  const { palette, surface } = style;
  const isDark = surface.isDark;

  const rawAngle = optics.lightAngleDeg;
  const effectiveAngle = Math.abs(rawAngle) < 0.5 ? -24 : rawAngle;
  const lightShaftTiltRad = Number(
    (((effectiveAngle * Math.PI) / 180) * 0.58).toFixed(4)
  );

  if (artWorld === 'atelier') {
    return {
      artWorld,
      wallColor: isDark
        ? blendColor(0.42, palette.bgSurface, palette.bgElevated)
        : blendColor(0.32, palette.bgSurface, palette.bgElevated),
      wingWallColor: blendColor(0.55, palette.bgElevated, palette.bgSurface),
      baseboardColor: palette.inkBorder,
      corniceColor: blendColor(0.35, palette.inkBorder, palette.accentSecondary),
      floorInlayColor: isDark
        ? blendColor(0.35, palette.bgSurface, '#020617')
        : blendColor(0.42, palette.bgSurface, palette.bgElevated),
      floorBorderColor: palette.accentPrimary,
      windowGlowColor: isDark ? palette.accentPrimary : '#F8FAFC',
      lightShaftColor: isDark ? palette.accentPrimary : '#FFFFFF',
      lightShaftOpacity: isDark ? 0.085 : 0.055,
      lightAngleDeg: effectiveAngle,
      lightShaftTiltRad,
      consoleColor: palette.bgElevated,
      consoleTopColor: palette.bgSurface,
      centerpiecePrimaryColor: palette.accentPrimary,
      centerpieceSecondaryColor: palette.accentSecondary,
      frameOuterColor: palette.inkBorder,
      passePartoutColor: palette.bgSurface,
      shelfWoodColor: palette.bgElevated,
      foliageColor: palette.accentSecondary,
      wallRoughness: isDark ? 0.36 : 0.52,
      wallMetalness: isDark ? 0.28 : 0.1,
      consoleRoughness: 0.28,
      consoleMetalness: isDark ? 0.36 : 0.18,
      hasWindowSlit: false,
      hasArchedWindow: false,
      hasBookshelfNiche: false,
      hasGalleryFrame: false,
      hasLightCove: true,
      centerpieceKind: 'atelier-torus-prism',
      backWallZ: -3.1,
      centerpieceZ: -1.36,
    };
  }

  if (artWorld === 'illustrative') {
    const warmTimber = blendColor(0.34, '#92400E', palette.inkBorder);
    return {
      artWorld,
      wallColor: blendColor(0.28, palette.bgSurface, palette.bgElevated),
      wingWallColor: blendColor(0.52, palette.bgElevated, palette.bgCanvas),
      baseboardColor: warmTimber,
      corniceColor: blendColor(0.32, '#B45309', palette.accentPrimary),
      floorInlayColor: isDark
        ? blendColor(0.4, palette.bgSurface, palette.bgElevated)
        : blendColor(0.36, palette.bgElevated, '#FEF3C7'),
      floorBorderColor: palette.accentPrimary,
      windowGlowColor: '#FEF3C7',
      lightShaftColor: '#FFFBEB',
      lightShaftOpacity: isDark ? 0.08 : 0.075,
      lightAngleDeg: effectiveAngle,
      lightShaftTiltRad,
      consoleColor: blendColor(0.35, '#B45309', palette.bgElevated),
      consoleTopColor: blendColor(0.26, '#F59E0B', palette.bgSurface),
      centerpiecePrimaryColor: palette.accentPrimary,
      centerpieceSecondaryColor: palette.accentSecondary,
      frameOuterColor: warmTimber,
      passePartoutColor: palette.bgSurface,
      shelfWoodColor: warmTimber,
      foliageColor: blendColor(0.38, '#059669', palette.accentSecondary),
      wallRoughness: 0.88,
      wallMetalness: 0.02,
      consoleRoughness: 0.82,
      consoleMetalness: 0.04,
      hasWindowSlit: false,
      hasArchedWindow: true,
      hasBookshelfNiche: true,
      hasGalleryFrame: false,
      hasLightCove: false,
      centerpieceKind: 'workshop-sketch-lamp',
      backWallZ: -3.1,
      centerpieceZ: -1.36,
    };
  }

  // 'editorial-gallery'
  return {
    artWorld,
    wallColor: blendColor(0.34, palette.bgSurface, palette.bgElevated),
    wingWallColor: blendColor(0.56, palette.bgElevated, palette.bgCanvas),
    baseboardColor: blendColor(0.45, palette.inkBorder, palette.textSecondary),
    corniceColor: palette.inkBorder,
    floorInlayColor: blendColor(0.44, palette.bgElevated, palette.bgSurface),
    floorBorderColor: palette.inkBorder,
    windowGlowColor: '#FFF7ED',
    lightShaftColor: '#FFF7ED',
    lightShaftOpacity: isDark ? 0.09 : 0.072,
    lightAngleDeg: effectiveAngle,
    lightShaftTiltRad,
    consoleColor: palette.bgElevated,
    consoleTopColor: palette.bgSurface,
    centerpiecePrimaryColor: palette.accentPrimary,
    centerpieceSecondaryColor: palette.accentSecondary,
    frameOuterColor: blendColor(0.62, palette.textPrimary, palette.inkBorder),
    passePartoutColor: palette.bgSurface,
    shelfWoodColor: palette.bgElevated,
    foliageColor: palette.accentSecondary,
    wallRoughness: 0.84,
    wallMetalness: 0.03,
    consoleRoughness: 0.78,
    consoleMetalness: 0.04,
    hasWindowSlit: true,
    hasArchedWindow: false,
    hasBookshelfNiche: false,
    hasGalleryFrame: true,
    hasLightCove: false,
    centerpieceKind: 'gallery-stone-folio',
    backWallZ: -3.1,
    centerpieceZ: -1.35,
  };
}

export interface IsometricScenicSet3DProps {
  /** Turntable plinth radius in world units (default 5.4) */
  radius?: number;
  /** Artistic world room architecture override (default 'auto' via `resolveArtWorld(style)`) */
  variant?: 'auto' | ArtWorld;
  /** Optional primary accent override */
  accentColor?: string;
  /** Optional surface tint override */
  surfaceColor?: string;
  /** Frame when the architectural room set rises in (default 2, preserving Clean Frame 0) */
  enterFrame?: number;
}

/**
 * Sculptural miniature 3D studio room set surrounding speakers on `<IsometricStage3D>`.
 * Scales cleanly inside `radius` so both `16:9` widescreen and `9:16` Golden Safe Box
 * dialogue shots are framed against rich architecture rather than an empty void.
 */
export const IsometricScenicSet3D: React.FC<IsometricScenicSet3DProps> = ({
  radius = 5.4,
  variant = 'auto',
  accentColor,
  surfaceColor,
  enterFrame = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();
  const shaftTex = useMemo(() => getSoftWindowShaftTexture(), []);

  const effectiveEnter = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveEnter) {
    return null;
  }

  const tokens = computeScenicRoomTokens(style, variant);
  const primaryAccent = accentColor ?? tokens.centerpiecePrimaryColor;
  const resolvedWall = surfaceColor
    ? blendColor(0.35, surfaceColor, tokens.wallColor)
    : tokens.wallColor;

  const enterProgress = spring({
    frame: frame - effectiveEnter,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });

  const scaleXZ = interpolate(enterProgress, [0, 1], [0.9, 1]);
  const scaleY = interpolate(enterProgress, [0, 1], [0.001, 1]);

  // Strictly within [0.03, 0.055] rad/frame studio motion limits
  const gentleFloatY = Math.sin(frame * 0.036) * 0.026;
  const gentleTurnY = Math.cos(frame * 0.032) * 0.22;
  const shaftBreath = 0.88 + 0.12 * Math.sin(frame * 0.038);

  const u = clamp(radius / 5.4, 0.72, 1.35);
  const backZ = tokens.backWallZ * u;
  const wingX = 2.94 * u;
  const wingZ = -2.06 * u;
  const wingRotY = 0.52;
  const lightSide = tokens.lightAngleDeg <= 0 ? -1 : 1;

  return (
    <group
      name={`isometric-scenic-set-3d-${tokens.artWorld}`}
      userData={{ artWorld: tokens.artWorld }}
      scale={[scaleXZ, scaleY, scaleXZ]}
    >
      {/* Warm Inlay Architectural Studio Medallion (y = 0.005 — zero Z-fighting with plinth rings) */}
      <mesh position={[0, 0.005, -0.28 * u]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius * 0.68, 64]} />
        <meshStandardMaterial
          color={tokens.floorInlayColor}
          roughness={tokens.wallRoughness}
          metalness={tokens.wallMetalness * 0.5}
        />
      </mesh>
      <mesh position={[0, 0.0055, -0.28 * u]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.676, radius * 0.692, 64]} />
        <meshBasicMaterial
          color={tokens.floorBorderColor}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Rear Architectural Alcove Back Wall + Baseboard Plinth + Bevelled Cornice */}
      <group position={[0, 0, backZ]}>
        <mesh position={[0, 1.54, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.76 * u, 3.08, 0.22]} />
          <meshStandardMaterial
            color={resolvedWall}
            roughness={tokens.wallRoughness}
            metalness={tokens.wallMetalness}
          />
        </mesh>
        <mesh position={[0, 0.09, 0.13]} castShadow receiveShadow>
          <boxGeometry args={[4.84 * u, 0.18, 0.07]} />
          <meshStandardMaterial
            color={tokens.baseboardColor}
            roughness={tokens.wallRoughness}
            metalness={tokens.wallMetalness}
          />
        </mesh>
        <mesh position={[0, 3.11, 0.04]} castShadow receiveShadow>
          <boxGeometry args={[4.94 * u, 0.1, 0.32]} />
          <meshStandardMaterial
            color={tokens.corniceColor}
            roughness={tokens.wallRoughness * 0.9}
            metalness={tokens.wallMetalness}
          />
        </mesh>
      </group>

      {/* Chamfered Corner Pilasters sealing Back Wall <-> Side Wings */}
      {([-1, 1] as const).map((sgn) => (
        <group key={`pilaster-${sgn}`} position={[sgn * 2.38 * u, 0, backZ + 0.06]}>
          <mesh position={[0, 1.54, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.15, 0.165, 3.08, 8]} />
            <meshStandardMaterial
              color={tokens.wingWallColor}
              roughness={tokens.wallRoughness}
              metalness={tokens.wallMetalness}
            />
          </mesh>
          <mesh position={[0, 3.11, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.18, 0.1, 8]} />
            <meshStandardMaterial
              color={tokens.corniceColor}
              roughness={tokens.wallRoughness * 0.9}
              metalness={tokens.wallMetalness}
            />
          </mesh>
        </group>
      ))}

      {/* Left & Right Angled Architectural Corner Wings (seamless 3.08m height inside radius) */}
      {([-1, 1] as const).map((sgn) => (
        <group
          key={`wing-${sgn}`}
          position={[sgn * wingX, 0, wingZ]}
          rotation={[0, -sgn * wingRotY, 0]}
        >
          <mesh position={[0, 1.54, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.16 * u, 3.08, 0.2]} />
            <meshStandardMaterial
              color={tokens.wingWallColor}
              roughness={tokens.wallRoughness}
              metalness={tokens.wallMetalness}
            />
          </mesh>
          <mesh position={[0, 0.09, 0.12]} receiveShadow>
            <boxGeometry args={[2.2 * u, 0.18, 0.06]} />
            <meshStandardMaterial
              color={tokens.baseboardColor}
              roughness={tokens.wallRoughness}
              metalness={tokens.wallMetalness}
            />
          </mesh>
          <mesh position={[0, 3.11, 0.04]} castShadow>
            <boxGeometry args={[2.26 * u, 0.1, 0.3]} />
            <meshStandardMaterial
              color={tokens.corniceColor}
              roughness={tokens.wallRoughness * 0.9}
              metalness={tokens.wallMetalness}
            />
          </mesh>
        </group>
      ))}

      {/* ================================================================= */}
      {/* WORLD 1: 'atelier' — Luminous Frosted Glass, Light Cove & Torus   */}
      {/* ================================================================= */}
      {tokens.artWorld === 'atelier' ? (
        <group name="scenic-world-atelier">
          {/* Horizontal Linear Light Cove along Upper Wall */}
          <mesh position={[0, 2.72, backZ + 0.13]}>
            <boxGeometry args={[4.1 * u, 0.048, 0.04]} />
            <meshBasicMaterial color={tokens.windowGlowColor} />
          </mesh>
          <mesh position={[0, 2.8, backZ + 0.16]} castShadow>
            <boxGeometry args={[4.24 * u, 0.07, 0.1]} />
            <meshStandardMaterial
              color={tokens.consoleColor}
              roughness={0.32}
              metalness={0.28}
            />
          </mesh>

          {/* Paired Frosted-Glass & Anodized Architectural Studio Panels */}
          {([-1.28, 1.28] as const).map((xPos, idx) => (
            <group key={`frosted-${idx}`} position={[xPos * u, 1.56, backZ + 0.12]}>
              <mesh>
                <boxGeometry args={[1.42 * u, 1.72, 0.04]} />
                <meshStandardMaterial
                  color={tokens.baseboardColor}
                  roughness={0.3}
                  metalness={0.35}
                />
              </mesh>
              <mesh position={[0, 0, 0.026]}>
                <planeGeometry args={[1.28 * u, 1.58]} />
                <meshStandardMaterial
                  color={tokens.windowGlowColor}
                  emissive={primaryAccent}
                  emissiveIntensity={style.surface.isDark ? 0.22 : 0.06}
                  roughness={0.16}
                  metalness={0.12}
                  transparent
                  opacity={0.86}
                />
              </mesh>
            </group>
          ))}

          {/* Acoustic Anodized Fin Array on Right Wing */}
          <group
            position={[wingX - 0.08, 1.52, wingZ + 0.08]}
            rotation={[0, -wingRotY, 0]}
          >
            {[-0.6, -0.3, 0, 0.3, 0.6].map((lx, idx) => (
              <mesh key={`louver-${idx}`} position={[lx * u, 0, 0.06]} castShadow>
                <boxGeometry args={[0.055, 2.08, 0.09]} />
                <meshStandardMaterial
                  color={idx === 2 ? primaryAccent : tokens.corniceColor}
                  roughness={0.32}
                  metalness={0.3}
                />
              </mesh>
            ))}
          </group>

          {/* Low Studio Console + Floating Sculptural Torus & Prism Centerpiece */}
          <group position={[0, 0, tokens.centerpieceZ * u]}>
            <ContactShadowDisc3D
              position={[0, 0.013, 0]}
              radius={0.88}
              opacity={0.28}
              color={style.palette.textPrimary}
            />
            <mesh position={[0, 0.31, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.92, 0.58, 0.42]} />
              <meshStandardMaterial
                color={tokens.consoleColor}
                roughness={tokens.consoleRoughness}
                metalness={tokens.consoleMetalness}
              />
            </mesh>
            <mesh position={[0, 0.63, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.52, 0.075, 0.58]} />
              <meshStandardMaterial
                color={tokens.consoleTopColor}
                roughness={0.22}
                metalness={0.18}
              />
            </mesh>
            <mesh position={[0, 0.672, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.24, 0.3, 48]} />
              <meshBasicMaterial color={primaryAccent} transparent opacity={0.72} />
            </mesh>

            <group
              position={[0, 1.08 + gentleFloatY, 0]}
              rotation={[0.24, gentleTurnY, 0.14]}
            >
              <mesh castShadow>
                <torusGeometry args={[0.25, 0.032, 16, 48]} />
                <meshStandardMaterial
                  color={primaryAccent}
                  roughness={0.22}
                  metalness={0.42}
                />
              </mesh>
              <mesh rotation={[0.4, -gentleTurnY, 0.3]} castShadow>
                <octahedronGeometry args={[0.135, 0]} />
                <meshStandardMaterial
                  color={tokens.centerpieceSecondaryColor}
                  roughness={0.2}
                  metalness={0.35}
                />
              </mesh>
            </group>
          </group>
        </group>
      ) : null}

      {/* ================================================================= */}
      {/* WORLD 2: 'illustrative' — Arched Window, Bookshelf, Plant & Desk  */}
      {/* ================================================================= */}
      {tokens.artWorld === 'illustrative' ? (
        <group name="scenic-world-illustrative">
          {/* Left Wing Arched Workshop Window + Mullions + Sunbeam */}
          <group
            position={[-wingX + 0.06, 1.46, wingZ + 0.08]}
            rotation={[0, wingRotY, 0]}
          >
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.16 * u, 1.24, 0.08]} />
              <meshStandardMaterial color={tokens.shelfWoodColor} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.01, 0.044]}>
              <planeGeometry args={[1.02 * u, 1.18]} />
              <meshBasicMaterial color={tokens.windowGlowColor} />
            </mesh>
            {/* True XY Semicircular Arched Fanlight Crown + Timber Arch Molding */}
            <mesh position={[0, 0.6, 0.044]}>
              <circleGeometry args={[0.51 * u, 32, 0, Math.PI]} />
              <meshBasicMaterial color={tokens.windowGlowColor} />
            </mesh>
            <mesh position={[0, 0.6, 0.048]}>
              <ringGeometry args={[0.495 * u, 0.58 * u, 32, 1, 0, Math.PI]} />
              <meshStandardMaterial color={tokens.shelfWoodColor} roughness={0.85} />
            </mesh>
            {/* Window Cross Mullions + Sill */}
            <mesh position={[0, 0.24, 0.054]}>
              <boxGeometry args={[0.045, 1.66, 0.026]} />
              <meshStandardMaterial color={tokens.shelfWoodColor} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.6, 0.054]}>
              <boxGeometry args={[1.14 * u, 0.045, 0.026]} />
              <meshStandardMaterial color={tokens.shelfWoodColor} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.02, 0.054]}>
              <boxGeometry args={[1.04 * u, 0.045, 0.026]} />
              <meshStandardMaterial color={tokens.shelfWoodColor} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.64, 0.09]} castShadow>
              <boxGeometry args={[1.3 * u, 0.075, 0.18]} />
              <meshStandardMaterial color={tokens.consoleTopColor} roughness={0.82} />
            </mesh>
          </group>

          {/* Soft Feathered Volumetric Sunlit Window Shaft */}
          <mesh
            position={[-1.48 * u, 1.44, -1.56 * u]}
            rotation={[0.18, 0.36, tokens.lightShaftTiltRad]}
            renderOrder={9}
          >
            <planeGeometry args={[1.55 * u, 2.85]} />
            <meshBasicMaterial
              map={shaftTex ?? undefined}
              color={tokens.lightShaftColor}
              transparent
              opacity={tokens.lightShaftOpacity * 1.45 * shaftBreath}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Recessed Wooden Bookshelf Niche with Colorful Storybook Volumes */}
          <group position={[0.38 * u, 1.62, backZ + 0.16]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[2.08 * u, 1.92, 0.22]} />
              <meshStandardMaterial color={tokens.shelfWoodColor} roughness={0.86} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <boxGeometry args={[1.9 * u, 1.74, 0.18]} />
              <meshStandardMaterial color={tokens.wingWallColor} roughness={0.9} />
            </mesh>
            {[-0.46, 0.08, 0.6].map((sy, sIdx) => (
              <mesh key={`shelf-${sIdx}`} position={[0, sy, 0.06]} castShadow>
                <boxGeometry args={[1.92 * u, 0.055, 0.2]} />
                <meshStandardMaterial color={tokens.shelfWoodColor} roughness={0.84} />
              </mesh>
            ))}

            {/* Sculpted Colorful Storybook Volumes */}
            {[
              { x: -0.68, y: -0.25, h: 0.36, c: primaryAccent, tilt: 0 },
              { x: -0.55, y: -0.27, h: 0.32, c: tokens.centerpieceSecondaryColor, tilt: 0 },
              { x: -0.4, y: -0.26, h: 0.34, c: tokens.consoleTopColor, tilt: -0.14 },
              { x: 0.22, y: 0.28, h: 0.34, c: tokens.centerpieceSecondaryColor, tilt: 0 },
              { x: 0.36, y: 0.26, h: 0.3, c: primaryAccent, tilt: 0 },
              { x: 0.5, y: 0.27, h: 0.32, c: style.palette.bgSurface, tilt: 0.12 },
            ].map((bk, bIdx) => (
              <mesh
                key={`book-${bIdx}`}
                position={[bk.x * u, bk.y, 0.08]}
                rotation={[0, 0, bk.tilt]}
                castShadow
              >
                <boxGeometry args={[0.1, bk.h, 0.15]} />
                <meshStandardMaterial color={bk.c} roughness={0.86} />
              </mesh>
            ))}

            {/* Small Ceramic Studio Vessel on Top Shelf */}
            <mesh position={[-0.32 * u, 0.78, 0.08]} castShadow>
              <cylinderGeometry args={[0.09, 0.12, 0.28, 16]} />
              <meshStandardMaterial color={primaryAccent} roughness={0.78} />
            </mesh>
          </group>

          {/* Potted Botanical Sculptural Studio Plant (framed cleanly beside right wing) */}
          <group position={[2.68 * u, 0, -1.12 * u]}>
            <ContactShadowDisc3D
              position={[0, 0.013, 0]}
              radius={0.48}
              opacity={0.28}
              color={style.palette.textPrimary}
            />
            <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.27, 0.19, 0.48, 20]} />
              <meshStandardMaterial color={primaryAccent} roughness={0.84} />
            </mesh>
            <mesh position={[0, 0.48, 0]} castShadow>
              <cylinderGeometry args={[0.295, 0.275, 0.065, 20]} />
              <meshStandardMaterial color={tokens.consoleTopColor} roughness={0.82} />
            </mesh>
            {[
              { rotY: 0, tiltZ: 0.36, h: 0.58 },
              { rotY: 1.25, tiltZ: 0.44, h: 0.52 },
              { rotY: 2.5, tiltZ: 0.38, h: 0.6 },
              { rotY: 3.8, tiltZ: 0.45, h: 0.5 },
              { rotY: 5.1, tiltZ: 0.32, h: 0.62 },
            ].map((lf, lIdx) => (
              <group
                key={`leaf-${lIdx}`}
                position={[0, 0.5, 0]}
                rotation={[0, lf.rotY + gentleFloatY * 0.6, lf.tiltZ]}
              >
                <mesh position={[0, lf.h * 0.5, 0]} scale={[1, 1, 0.38]} castShadow>
                  <capsuleGeometry args={[0.095, lf.h * 0.55, 8, 14]} />
                  <meshStandardMaterial color={tokens.foliageColor} roughness={0.82} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Warm Timber Craft Table with Open Sketchbook & Brass Lamp */}
          <group position={[0, 0, tokens.centerpieceZ * u]}>
            <ContactShadowDisc3D
              position={[0, 0.013, 0]}
              radius={0.9}
              opacity={0.28}
              color={style.palette.textPrimary}
            />
            {[
              [-0.62, -0.22],
              [0.62, -0.22],
              [-0.62, 0.22],
              [0.62, 0.22],
            ].map(([lx, lz], idx) => (
              <mesh key={`tleg-${idx}`} position={[lx, 0.32, lz]} castShadow>
                <cylinderGeometry args={[0.042, 0.032, 0.64, 12]} />
                <meshStandardMaterial color={tokens.shelfWoodColor} roughness={0.86} />
              </mesh>
            ))}
            <mesh position={[0, 0.66, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.54, 0.075, 0.62]} />
              <meshStandardMaterial color={tokens.consoleTopColor} roughness={0.8} />
            </mesh>
            {/* Open Double-Page Sketchbook */}
            <mesh position={[-0.16, 0.715, 0.02]} rotation={[0.06, 0.08, 0]} castShadow>
              <boxGeometry args={[0.56, 0.032, 0.36]} />
              <meshStandardMaterial color={style.palette.bgSurface} roughness={0.9} />
            </mesh>
            {/* Miniature Poised Studio Lamp */}
            <group position={[0.42, 0.7, -0.08]}>
              <mesh position={[0, 0.02, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.11, 0.035, 16]} />
                <meshStandardMaterial color={tokens.corniceColor} roughness={0.42} metalness={0.35} />
              </mesh>
              <mesh position={[0.02, 0.2, 0]} rotation={[0, 0, 0.22]} castShadow>
                <cylinderGeometry args={[0.016, 0.018, 0.36, 12]} />
                <meshStandardMaterial color={tokens.corniceColor} roughness={0.42} metalness={0.35} />
              </mesh>
              <mesh position={[-0.06, 0.36, 0.02]} rotation={[0.2, 0, -0.58]} castShadow>
                <cylinderGeometry args={[0.04, 0.11, 0.14, 16]} />
                <meshStandardMaterial color={primaryAccent} roughness={0.55} metalness={0.2} />
              </mesh>
            </group>
          </group>
        </group>
      ) : null}

      {/* ================================================================= */}
      {/* WORLD 3: 'editorial-gallery' — Window Slit, Passe-Partout & Stone */}
      {/* ================================================================= */}
      {tokens.artWorld === 'editorial-gallery' ? (
        <group name="scenic-world-editorial-gallery">
          {/* Tall Architectural Window Slit aligned with optics.lightAngleDeg */}
          <group
            position={[lightSide * (wingX - 0.06), 1.62, wingZ + 0.08]}
            rotation={[0, -lightSide * wingRotY, 0]}
          >
            <mesh>
              <boxGeometry args={[0.74 * u, 2.28, 0.1]} />
              <meshStandardMaterial color={tokens.corniceColor} roughness={0.82} />
            </mesh>
            <mesh position={[0, 0, 0.055]}>
              <planeGeometry args={[0.52 * u, 2.08]} />
              <meshBasicMaterial color={tokens.windowGlowColor} />
            </mesh>
          </group>

          {/* Soft Feathered Volumetric Key-Light Shaft aligned with lightShaftTiltRad */}
          <mesh
            position={[lightSide * 1.38 * u, 1.48, -1.52 * u]}
            rotation={[0.16, -lightSide * 0.34, tokens.lightShaftTiltRad]}
            renderOrder={9}
          >
            <planeGeometry args={[1.45 * u, 2.95]} />
            <meshBasicMaterial
              map={shaftTex ?? undefined}
              color={tokens.lightShaftColor}
              transparent
              opacity={tokens.lightShaftOpacity * 1.5 * shaftBreath}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Monumental Framed Relief Artwork in Cotton Passe-Partout on Back Wall */}
          <group position={[0, 1.72, backZ + 0.13]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[2.32 * u, 1.52, 0.07]} />
              <meshStandardMaterial color={tokens.frameOuterColor} roughness={0.76} />
            </mesh>
            <mesh position={[0, 0, 0.038]}>
              <planeGeometry args={[2.12 * u, 1.32]} />
              <meshStandardMaterial color={tokens.passePartoutColor} roughness={0.92} />
            </mesh>
            <mesh position={[0, 0, 0.046]}>
              <planeGeometry args={[1.56 * u, 0.88]} />
              <meshStandardMaterial color={tokens.wingWallColor} roughness={0.88} />
            </mesh>
            {/* Sculpted Geometric Bas-Relief Inside Passe-Partout */}
            <mesh position={[-0.26 * u, -0.06, 0.062]} castShadow>
              <boxGeometry args={[0.54 * u, 0.56, 0.024]} />
              <meshStandardMaterial color={primaryAccent} roughness={0.82} />
            </mesh>
            <mesh position={[0.3 * u, 0.1, 0.066]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.2, 0.026, 32]} />
              <meshStandardMaterial
                color={tokens.centerpieceSecondaryColor}
                roughness={0.78}
              />
            </mesh>
            <mesh position={[0.28 * u, -0.22, 0.064]}>
              <boxGeometry args={[0.56 * u, 0.045, 0.022]} />
              <meshStandardMaterial color={tokens.frameOuterColor} roughness={0.8} />
            </mesh>
          </group>

          {/* Opposite Wing Stone Corbel & Sculpted Ceramic Gallery Vessel */}
          <group
            position={[-lightSide * (wingX - 0.08), 1.38, wingZ + 0.1]}
            rotation={[0, lightSide * wingRotY, 0]}
          >
            <mesh position={[0, -0.18, 0.08]} castShadow>
              <boxGeometry args={[0.62 * u, 0.08, 0.24]} />
              <meshStandardMaterial color={tokens.corniceColor} roughness={0.84} />
            </mesh>
            <mesh position={[0, 0.06, 0.08]} castShadow>
              <cylinderGeometry args={[0.11, 0.16, 0.4, 20]} />
              <meshStandardMaterial color={tokens.passePartoutColor} roughness={0.78} />
            </mesh>
          </group>

          {/* Ceramic / Travertine Plinth Table at z = -1.35 (never blocking speakers!) */}
          <group position={[0, 0, tokens.centerpieceZ * u]}>
            <ContactShadowDisc3D
              position={[0, 0.013, 0]}
              radius={0.84}
              opacity={0.28}
              color={style.palette.textPrimary}
            />
            <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.42, 0.48, 0.64, 16]} />
              <meshStandardMaterial
                color={tokens.consoleColor}
                roughness={tokens.consoleRoughness}
                metalness={tokens.consoleMetalness}
              />
            </mesh>
            <mesh position={[0, 0.66, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.68, 0.64, 0.075, 32]} />
              <meshStandardMaterial
                color={tokens.consoleTopColor}
                roughness={0.74}
                metalness={0.04}
              />
            </mesh>
            {/* Archival Hardcover Folio + Sculpted Maquette Weight */}
            <mesh position={[-0.08, 0.72, 0.02]} rotation={[0, 0.18, 0]} castShadow>
              <boxGeometry args={[0.48, 0.045, 0.34]} />
              <meshStandardMaterial color={primaryAccent} roughness={0.82} />
            </mesh>
            <mesh
              position={[0.22, 0.8 + gentleFloatY * 0.5, -0.06]}
              rotation={[0.2, gentleTurnY, 0]}
              castShadow
            >
              <octahedronGeometry args={[0.095, 0]} />
              <meshStandardMaterial
                color={tokens.frameOuterColor}
                roughness={0.68}
                metalness={0.08}
              />
            </mesh>
          </group>
        </group>
      ) : null}
    </group>
  );
};
