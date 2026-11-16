import React from 'react';
import { RoundedBox } from '@react-three/drei';
import {
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  CINEMATIC_SPRINGS,
  createSeededRandom,
  resolveStyleMaterial3D,
  useStudioStyle,
} from '@make-pictures/core';
import {
  resolvePhysicalFinishProps,
  type PhysicalFinishProps,
} from './ClayCharacter3D';

export interface PodcastStudioLayout {
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;
  backWallZ: number;
  leftWallX: number;
  tableWidth: number;
  tableDepth: number;
  tableHeight: number;
  tableZ: number;
  leftHostPosition: [number, number, number];
  rightHostPosition: [number, number, number];
  leftHostRotationY: number;
  rightHostRotationY: number;
}

export interface PodcastStudioSet3DProps {
  width?: number;
  depth?: number;
  wallHeight?: number;
  accentColor?: string;
  onAirActive?: boolean;
  compactVertical?: boolean;
  seed?: string | number;
  children?: React.ReactNode;
  /** Optional entrance frame (default 2; frame <= 0 always returns null) */
  enterFrame?: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function safeBevel(w: number, h: number, d: number, desired: number): number {
  return Math.max(0.004, Math.min(desired, Math.min(w, h, d) * 0.44));
}

function safeBlendColor(t: number, colorA: string, colorB: string): string {
  try {
    return interpolateColors(clamp(t, 0, 1), [0, 1], [colorA, colorB]);
  } catch {
    return t < 0.5 ? colorA : colorB;
  }
}

export function computePodcastStudioLayout(options?: {
  width?: number;
  depth?: number;
  wallHeight?: number;
  compactVertical?: boolean;
}): PodcastStudioLayout {
  const rawWidth = options?.width ?? 6.2;
  const roomDepth = options?.depth ?? 4.8;
  const wallHeight = options?.wallHeight ?? 3.25;
  const compactVertical = options?.compactVertical ?? false;

  const roomWidth = compactVertical ? Math.min(rawWidth, 4.6) : rawWidth;
  const backWallZ = -roomDepth / 2 + 0.14;
  const leftWallX = -roomWidth / 2 + 0.14;
  const tableWidth = compactVertical ? 1.12 : 1.62;
  const tableDepth = compactVertical ? 0.72 : 0.8;
  const tableHeight = 0.68;
  const tableZ = 0.18;

  const hostX = compactVertical ? 0.92 : 1.3;
  const hostRotY = compactVertical ? 0.56 : 0.62;

  return {
    roomWidth,
    roomDepth,
    wallHeight,
    backWallZ,
    leftWallX,
    tableWidth,
    tableDepth,
    tableHeight,
    tableZ,
    leftHostPosition: [-hostX, 0, 0.14],
    rightHostPosition: [hostX, 0, 0.14],
    leftHostRotationY: hostRotY,
    rightHostRotationY: -hostRotY,
  };
}

const StudioClayMaterial: React.FC<{
  color: string;
  finishProps: PhysicalFinishProps;
  roughnessOffset?: number;
  metalnessOverride?: number;
}> = ({
  color,
  finishProps,
  roughnessOffset = 0,
  metalnessOverride,
}) => (
  <meshPhysicalMaterial
    color={color}
    roughness={clamp(finishProps.roughness + roughnessOffset, 0.06, 0.95)}
    metalness={metalnessOverride ?? finishProps.metalness}
    clearcoat={finishProps.clearcoat}
    clearcoatRoughness={finishProps.clearcoatRoughness}
    sheen={finishProps.sheen}
    sheenColor="#FFF4E6"
    sheenRoughness={0.65}
    transmission={0}
    ior={finishProps.ior}
  />
);

interface LetterStroke {
  x: number;
  y: number;
  w: number;
  h: number;
  rotZ?: number;
}

const ON_AIR_LETTER_STROKES: ReadonlyArray<LetterStroke> = [
  // O (center x = -0.35)
  { x: -0.39, y: 0, w: 0.024, h: 0.13 },
  { x: -0.31, y: 0, w: 0.024, h: 0.13 },
  { x: -0.35, y: 0.055, w: 0.095, h: 0.024 },
  { x: -0.35, y: -0.055, w: 0.095, h: 0.024 },
  // N (center x = -0.19)
  { x: -0.23, y: 0, w: 0.024, h: 0.135 },
  { x: -0.15, y: 0, w: 0.024, h: 0.135 },
  { x: -0.19, y: 0, w: 0.024, h: 0.145, rotZ: 0.52 },
  // A (center x = 0.06)
  { x: 0.028, y: -0.004, w: 0.024, h: 0.138, rotZ: -0.22 },
  { x: 0.092, y: -0.004, w: 0.024, h: 0.138, rotZ: 0.22 },
  { x: 0.06, y: -0.015, w: 0.068, h: 0.022 },
  // I (center x = 0.20)
  { x: 0.2, y: 0, w: 0.026, h: 0.135 },
  // R (center x = 0.34)
  { x: 0.3, y: 0, w: 0.024, h: 0.135 },
  { x: 0.34, y: 0.055, w: 0.085, h: 0.022 },
  { x: 0.34, y: 0.005, w: 0.082, h: 0.022 },
  { x: 0.375, y: 0.03, w: 0.022, h: 0.065 },
  { x: 0.356, y: -0.034, w: 0.024, h: 0.075, rotZ: 0.52 },
];

const ClayPlantPot: React.FC<{
  scale?: number;
  potColor: string;
  leafColorA: string;
  leafColorB: string;
  finishProps: PhysicalFinishProps;
  gentleSway: number;
}> = ({
  scale = 1,
  potColor,
  leafColorA,
  leafColorB,
  finishProps,
  gentleSway,
}) => (
  <group scale={[scale, scale, scale]}>
    {/* Terracotta Pot + Rim */}
    <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.145, 0.105, 0.28, 24]} />
      <StudioClayMaterial
        color={potColor}
        finishProps={finishProps}
        roughnessOffset={0.12}
      />
    </mesh>
    <mesh
      position={[0, 0.275, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
    >
      <torusGeometry args={[0.142, 0.024, 14, 28]} />
      <StudioClayMaterial
        color={safeBlendColor(0.2, potColor, '#FFF7ED')}
        finishProps={finishProps}
        roughnessOffset={0.1}
      />
    </mesh>
    {/* Dark Potting Soil */}
    <mesh position={[0, 0.265, 0]}>
      <cylinderGeometry args={[0.132, 0.132, 0.02, 20]} />
      <meshPhysicalMaterial color="#3B2316" roughness={0.9} />
    </mesh>
    {/* Lush Sculpted Green Clay Leaves */}
    {(
      [
        { rotY: 0.1, tiltZ: 0.36, h: 0.34, primary: true },
        { rotY: 1.15, tiltZ: 0.48, h: 0.3, primary: false },
        { rotY: 2.2, tiltZ: 0.38, h: 0.36, primary: true },
        { rotY: 3.3, tiltZ: 0.5, h: 0.29, primary: false },
        { rotY: 4.35, tiltZ: 0.35, h: 0.35, primary: true },
        { rotY: 5.4, tiltZ: 0.44, h: 0.31, primary: false },
      ] as const
    ).map((lf, idx) => (
      <group
        key={`clay-leaf-${idx}`}
        position={[0, 0.28, 0]}
        rotation={[0, lf.rotY + gentleSway * 0.4, lf.tiltZ]}
      >
        <mesh
          position={[0, lf.h * 0.52, 0]}
          scale={[1.08, 1, 0.36]}
          castShadow
        >
          <capsuleGeometry args={[0.068, lf.h * 0.52, 10, 16]} />
          <StudioClayMaterial
            color={lf.primary ? leafColorA : leafColorB}
            finishProps={finishProps}
          />
        </mesh>
      </group>
    ))}
  </group>
);

const StudioBoomMicrophone: React.FC<{
  side: -1 | 1;
  mountX: number;
  tableTopY: number;
  accentColor: string;
  finishProps: PhysicalFinishProps;
}> = ({ side, mountX, tableTopY, accentColor, finishProps }) => {
  // Mount sits near rear-outer edge of oak table and aims boom capsule toward left/right host
  const darkMetal = '#232730';
  const warmBrass = '#D97706';
  const silverMesh = '#E2E8F0';

  return (
    <group
      name={`studio-boom-mic-${side < 0 ? 'left' : 'right'}`}
      position={[mountX, tableTopY, -0.14]}
      rotation={[0, -side * 0.38, 0]}
    >
      {/* Weighted Beveled Desk Mount Base */}
      <RoundedBox
        args={[0.145, 0.048, 0.145]}
        radius={safeBevel(0.145, 0.048, 0.145, 0.02)}
        smoothness={4}
        position={[0, 0.024, 0]}
        castShadow
        receiveShadow
      >
        <StudioClayMaterial
          color={darkMetal}
          finishProps={finishProps}
          metalnessOverride={0.35}
          roughnessOffset={-0.12}
        />
      </RoundedBox>
      <mesh position={[0, 0.062, 0]} castShadow>
        <cylinderGeometry args={[0.034, 0.042, 0.045, 20]} />
        <StudioClayMaterial
          color={warmBrass}
          finishProps={finishProps}
          metalnessOverride={0.45}
          roughnessOffset={-0.15}
        />
      </mesh>

      {/* Lower Angled Boom Segment */}
      <group position={[0, 0.08, 0]} rotation={[-0.22, 0, -side * 0.28]}>
        <RoundedBox
          args={[0.036, 0.38, 0.036]}
          radius={0.014}
          smoothness={4}
          position={[0, 0.19, 0]}
          castShadow
        >
          <StudioClayMaterial
            color={darkMetal}
            finishProps={finishProps}
            metalnessOverride={0.32}
            roughnessOffset={-0.1}
          />
        </RoundedBox>

        {/* Elbow Tension Knob */}
        <group position={[0, 0.38, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.032, 0.032, 0.056, 20]} />
            <StudioClayMaterial
              color={accentColor}
              finishProps={finishProps}
            />
          </mesh>

          {/* Upper Boom Segment reaching forward & outward toward host */}
          <group rotation={[0.74, 0, side * 0.72]}>
            <RoundedBox
              args={[0.032, 0.34, 0.032]}
              radius={0.012}
              smoothness={4}
              position={[0, 0.17, 0]}
              castShadow
            >
              <StudioClayMaterial
                color={darkMetal}
                finishProps={finishProps}
                metalnessOverride={0.32}
                roughnessOffset={-0.1}
              />
            </RoundedBox>

            {/* Shock-Mount Ring + Broadcast Condenser Capsule */}
            <group
              position={[0, 0.355, 0]}
              rotation={[0.45, 0, -side * 0.42]}
              scale={[1.15, 1.15, 1.15]}
            >
              {/* Outer Shock-Mount Ring */}
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <torusGeometry args={[0.072, 0.012, 14, 28]} />
                <StudioClayMaterial
                  color={darkMetal}
                  finishProps={finishProps}
                  metalnessOverride={0.38}
                />
              </mesh>
              {/* Condenser Body */}
              <mesh position={[0, -0.02, 0]} castShadow>
                <cylinderGeometry args={[0.042, 0.039, 0.115, 24]} />
                <StudioClayMaterial
                  color={darkMetal}
                  finishProps={finishProps}
                  metalnessOverride={0.35}
                />
              </mesh>
              {/* Accent Tally Ring */}
              <mesh
                position={[0, 0.034, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <torusGeometry args={[0.043, 0.009, 12, 24]} />
                <StudioClayMaterial
                  color={accentColor}
                  finishProps={finishProps}
                />
              </mesh>
              {/* Metallic Mesh Grille Capsule aimed at host */}
              <mesh position={[0, 0.086, 0]} castShadow>
                <capsuleGeometry args={[0.043, 0.058, 14, 24]} />
                <StudioClayMaterial
                  color={silverMesh}
                  finishProps={finishProps}
                  metalnessOverride={0.62}
                  roughnessOffset={-0.2}
                />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

/**
 * Cozy cutaway 3D podcast studio diorama built entirely from beveled
 * `<RoundedBox smoothness={4}>` architectural elements (zero sharp `90°` boxes),
 * featuring acoustic oak wood slats, a glowing 3D `ON AIR` plaque, a floating
 * vinyl/plant shelf, a woven circular rug, and a beveled oak podcast table with
 * ceramic coffee mugs and two articulated boom-arm studio condenser microphones.
 */
export const PodcastStudioSet3D: React.FC<PodcastStudioSet3DProps> = ({
  width = 6.2,
  depth = 4.8,
  wallHeight = 3.25,
  accentColor,
  onAirActive = true,
  compactVertical = false,
  seed = 'podcast-studio',
  children,
  enterFrame = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();

  const effectiveEnter = Math.max(2, enterFrame);
  if (frame <= 0 || frame < effectiveEnter) {
    return null;
  }

  const layout = computePodcastStudioLayout({
    width,
    depth,
    wallHeight,
    compactVertical,
  });

  const styleMat3D = resolveStyleMaterial3D(style);
  const finishProps = resolvePhysicalFinishProps(styleMat3D.finish);
  const isDark = style.surface.isDark;

  const primaryAccent = accentColor ?? style.palette.accentPrimary;
  const secondaryAccent = style.palette.accentSecondary;

  // Warm cozy architectural studio palette (adapts gracefully to dark/retro styles too)
  const floorPlinthColor = isDark
    ? safeBlendColor(0.45, style.palette.bgElevated, '#1E293B')
    : '#8B5A2B';
  const floorTopColor = isDark
    ? safeBlendColor(0.35, style.palette.bgSurface, '#1E293B')
    : safeBlendColor(0.32, style.palette.bgSurface, '#EBD5BE');
  const wallPlasterColor = isDark
    ? safeBlendColor(0.42, style.palette.bgSurface, style.palette.bgElevated)
    : safeBlendColor(0.28, style.palette.bgSurface, '#F7E8D8');
  const oakWoodLight = isDark
    ? safeBlendColor(0.48, '#B87A44', style.palette.bgElevated)
    : '#C88951';
  const oakWoodRich = isDark
    ? safeBlendColor(0.48, '#9A5F2E', style.palette.bgSurface)
    : '#A66834';
  const acousticFeltColor = isDark ? '#0B111A' : '#2C201A';
  const rugWeaveColor = isDark
    ? safeBlendColor(0.5, style.palette.bgElevated, '#1E293B')
    : '#F3E5D5';

  const rng = createSeededRandom(`podcast-set:${String(seed)}`);
  const sleeveTilts = [
    -0.02,
    0.0,
    -0.01,
    -0.14 - rng() * 0.04,
    0.02,
  ];

  const enterProgress = spring({
    frame: frame - effectiveEnter,
    fps,
    config: CINEMATIC_SPRINGS.entrance,
  });
  const scaleXZ = interpolate(enterProgress, [0, 1], [0.94, 1]);
  const scaleY = interpolate(enterProgress, [0, 1], [0.001, 1]);

  // Gentle foliage & ON AIR glow breathing (strictly <= 0.045 rad/frame)
  const gentleSway = Math.sin(frame * 0.034) * 0.06;
  const onAirPulse = onAirActive
    ? 1.08 + Math.sin(frame * 0.04) * 0.1
    : 0.05;

  const backSlatCount = compactVertical ? 11 : 15;
  const backPanelWidth = layout.roomWidth - 0.72;
  const backSlatSpacing = backPanelWidth / (backSlatCount + 1);

  const leftWallLen = layout.roomDepth * 0.84;
  const leftWallCenterZ = -layout.roomDepth / 2 + leftWallLen / 2;
  const leftSlatCount = 9;
  const leftPanelDepth = leftWallLen - 0.72;
  const leftSlatSpacing = leftPanelDepth / (leftSlatCount + 1);

  const rugRadius = compactVertical ? 1.56 : 1.98;
  const shelfX = compactVertical ? 1.08 : 1.62;
  const onAirX = compactVertical ? -0.22 : -0.32;

  return (
    <group
      name="podcast-studio-set-3d"
      scale={[scaleXZ, scaleY, scaleXZ]}
    >
      {/* ================================================================= */}
      {/* 1. Thick Beveled Studio Floor Slab + Warm Woven Circular Rug      */}
      {/* ================================================================= */}
      <RoundedBox
        args={[layout.roomWidth + 0.16, 0.11, layout.roomDepth + 0.16]}
        radius={safeBevel(
          layout.roomWidth + 0.16,
          0.11,
          layout.roomDepth + 0.16,
          0.044
        )}
        smoothness={4}
        position={[0, -0.225, 0]}
        receiveShadow
      >
        <StudioClayMaterial color={floorPlinthColor} finishProps={finishProps} />
      </RoundedBox>

      <RoundedBox
        args={[layout.roomWidth, 0.2, layout.roomDepth]}
        radius={safeBevel(layout.roomWidth, 0.2, layout.roomDepth, 0.072)}
        smoothness={4}
        position={[0, -0.1, 0]}
        receiveShadow
      >
        <StudioClayMaterial color={floorTopColor} finishProps={finishProps} />
      </RoundedBox>

      {/* Warm Woven Circular Studio Rug */}
      <group position={[0, 0, 0.1]}>
        <mesh position={[0, 0.004, 0]} receiveShadow>
          <cylinderGeometry args={[rugRadius + 0.08, rugRadius + 0.1, 0.008, 64]} />
          <StudioClayMaterial
            color={primaryAccent}
            finishProps={finishProps}
            roughnessOffset={0.18}
          />
        </mesh>
        <mesh position={[0, 0.008, 0]} receiveShadow>
          <cylinderGeometry args={[rugRadius, rugRadius + 0.015, 0.01, 64]} />
          <StudioClayMaterial
            color={rugWeaveColor}
            finishProps={finishProps}
            roughnessOffset={0.22}
          />
        </mesh>
        <mesh
          position={[0, 0.014, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[rugRadius * 0.78, rugRadius * 0.815, 64]} />
          <StudioClayMaterial
            color={secondaryAccent}
            finishProps={finishProps}
            roughnessOffset={0.16}
          />
        </mesh>
      </group>

      {/* ================================================================= */}
      {/* 2. Cutaway Back Wall + Vertical Warm Oak Acoustic Wood Slats      */}
      {/* ================================================================= */}
      <group position={[0, 0, layout.backWallZ]}>
        {/* Main Beveled Cutaway Back Wall */}
        <RoundedBox
          args={[layout.roomWidth, layout.wallHeight, 0.26]}
          radius={safeBevel(layout.roomWidth, layout.wallHeight, 0.26, 0.072)}
          smoothness={4}
          position={[0, layout.wallHeight / 2 - 0.04, 0]}
          castShadow
          receiveShadow
        >
          <StudioClayMaterial
            color={wallPlasterColor}
            finishProps={finishProps}
            roughnessOffset={0.08}
          />
        </RoundedBox>

        {/* Beveled Oak Top Cornice & Baseboard */}
        <RoundedBox
          args={[layout.roomWidth + 0.06, 0.11, 0.31]}
          radius={safeBevel(layout.roomWidth + 0.06, 0.11, 0.31, 0.04)}
          smoothness={4}
          position={[0, layout.wallHeight - 0.03, 0.02]}
          castShadow
        >
          <StudioClayMaterial color={oakWoodRich} finishProps={finishProps} />
        </RoundedBox>
        <RoundedBox
          args={[layout.roomWidth - 0.04, 0.16, 0.08]}
          radius={safeBevel(layout.roomWidth - 0.04, 0.16, 0.08, 0.028)}
          smoothness={4}
          position={[0, 0.08, 0.14]}
          receiveShadow
        >
          <StudioClayMaterial color={oakWoodRich} finishProps={finishProps} />
        </RoundedBox>

        {/* Dark Acoustic Felt Backing + Vertical Oak Wood Slats */}
        <RoundedBox
          args={[backPanelWidth, layout.wallHeight * 0.76, 0.042]}
          radius={safeBevel(backPanelWidth, layout.wallHeight * 0.76, 0.042, 0.016)}
          smoothness={4}
          position={[0, layout.wallHeight * 0.49, 0.132]}
          receiveShadow
        >
          <StudioClayMaterial
            color={acousticFeltColor}
            finishProps={finishProps}
            roughnessOffset={0.24}
          />
        </RoundedBox>

        {Array.from({ length: backSlatCount }, (_, idx) => {
          const sx =
            -backPanelWidth / 2 + backSlatSpacing * (idx + 1);
          const slatShade = idx % 2 === 0 ? oakWoodLight : oakWoodRich;
          return (
            <RoundedBox
              key={`back-slat-${idx}`}
              args={[0.084, layout.wallHeight * 0.74, 0.068]}
              radius={safeBevel(0.084, layout.wallHeight * 0.74, 0.068, 0.024)}
              smoothness={4}
              position={[sx, layout.wallHeight * 0.49, 0.168]}
              castShadow
              receiveShadow
            >
              <StudioClayMaterial
                color={slatShade}
                finishProps={finishProps}
              />
            </RoundedBox>
          );
        })}

        {/* =============================================================== */}
        {/* 3. Glowing "ON AIR" Studio Lightbox + Soft Local PointLight     */}
        {/* =============================================================== */}
        <group
          name="podcast-on-air-lightbox"
          position={[onAirX, 2.26, 0.23]}
        >
          {/* Beveled Dark Studio Casing */}
          <RoundedBox
            args={[1.16, 0.42, 0.12]}
            radius={safeBevel(1.16, 0.42, 0.12, 0.044)}
            smoothness={4}
            castShadow
          >
            <StudioClayMaterial
              color="#1E1B18"
              finishProps={finishProps}
              metalnessOverride={0.22}
            />
          </RoundedBox>

          {/* Warm Glowing Coral-Amber Satin Diffuser Face (zero specular glare hotspot) */}
          <RoundedBox
            args={[1.02, 0.29, 0.06]}
            radius={safeBevel(1.02, 0.29, 0.06, 0.024)}
            smoothness={4}
            position={[0, 0, 0.045]}
          >
            <meshPhysicalMaterial
              color={onAirActive ? '#E84D33' : '#57433A'}
              emissive="#DC3E26"
              emissiveIntensity={onAirPulse * 0.78}
              roughness={0.62}
              clearcoat={0}
            />
          </RoundedBox>

          {/* Sculpted 3D "ON AIR" Beveled Lettering */}
          {ON_AIR_LETTER_STROKES.map((st, sIdx) => (
            <RoundedBox
              key={`on-air-stroke-${sIdx}`}
              args={[st.w, st.h, 0.024]}
              radius={safeBevel(st.w, st.h, 0.024, 0.006)}
              smoothness={4}
              position={[st.x, st.y, 0.078]}
              rotation={[0, 0, st.rotZ ?? 0]}
            >
              <meshPhysicalMaterial
                color="#FFFDF9"
                emissive="#FFFBEB"
                emissiveIntensity={onAirActive ? 0.65 : 0.02}
                roughness={0.38}
              />
            </RoundedBox>
          ))}

          {/* Warm Local Studio Halo Light */}
          <pointLight
            position={[0, -0.06, 0.44]}
            color="#FF7A52"
            intensity={onAirActive ? 1.15 : 0}
            distance={3.6}
            decay={2}
          />
        </group>

        {/* =============================================================== */}
        {/* 4. Floating Wooden Shelf + Vinyl Sleeves/Books + Clay Plant     */}
        {/* =============================================================== */}
        <group
          name="podcast-wall-shelf"
          position={[shelfX, 1.88, 0.31]}
        >
          {/* Shelf Plank */}
          <RoundedBox
            args={[1.24, 0.075, 0.34]}
            radius={safeBevel(1.24, 0.075, 0.34, 0.028)}
            smoothness={4}
            castShadow
            receiveShadow
          >
            <StudioClayMaterial color={oakWoodLight} finishProps={finishProps} />
          </RoundedBox>

          {/* Rounded Corbel Brackets */}
          {([-0.44, 0.44] as const).map((bx, bIdx) => (
            <RoundedBox
              key={`shelf-bracket-${bIdx}`}
              args={[0.075, 0.14, 0.24]}
              radius={safeBevel(0.075, 0.14, 0.24, 0.026)}
              smoothness={4}
              position={[bx, -0.09, -0.03]}
              castShadow
            >
              <StudioClayMaterial color={oakWoodRich} finishProps={finishProps} />
            </RoundedBox>
          ))}

          {/* Colorful Vinyl Record Sleeves & Art Books */}
          {(
            [
              { x: -0.46, w: 0.055, h: 0.38, d: 0.28, c: primaryAccent },
              { x: -0.38, w: 0.05, h: 0.36, d: 0.27, c: secondaryAccent },
              { x: -0.3, w: 0.055, h: 0.39, d: 0.28, c: '#F59E0B' },
              { x: -0.18, w: 0.052, h: 0.35, d: 0.26, c: '#FFF7ED' },
              { x: -0.06, w: 0.048, h: 0.33, d: 0.26, c: '#4F46E5' },
            ] as const
          ).map((item, vIdx) => (
            <RoundedBox
              key={`vinyl-book-${vIdx}`}
              args={[item.w, item.h, item.d]}
              radius={safeBevel(item.w, item.h, item.d, 0.016)}
              smoothness={4}
              position={[item.x, item.h / 2 + 0.036, 0]}
              rotation={[0, 0, sleeveTilts[vIdx] ?? 0]}
              castShadow
            >
              <StudioClayMaterial color={item.c} finishProps={finishProps} />
            </RoundedBox>
          ))}

          {/* Front-Facing Featured Vinyl Jacket + Peeking Black Vinyl Disc */}
          <group position={[0.14, 0.19, -0.03]} rotation={[-0.12, -0.18, 0]}>
            <RoundedBox
              args={[0.28, 0.28, 0.036]}
              radius={0.014}
              smoothness={4}
              castShadow
            >
              <StudioClayMaterial
                color={primaryAccent}
                finishProps={finishProps}
              />
            </RoundedBox>
            <mesh
              position={[0.07, 0.01, -0.004]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.125, 0.125, 0.014, 28]} />
              <meshPhysicalMaterial
                color="#141416"
                roughness={0.22}
                clearcoat={0.8}
              />
            </mesh>
          </group>

          {/* Terracotta Pot with Lush Green Clay Leaves on Shelf */}
          <group position={[0.43, 0.038, 0.01]}>
            <ClayPlantPot
              scale={0.78}
              potColor="#C85A3B"
              leafColorA="#16A34A"
              leafColorB="#15803D"
              finishProps={finishProps}
              gentleSway={gentleSway}
            />
          </group>
        </group>
      </group>

      {/* ================================================================= */}
      {/* 5. Cutaway Left Corner Wall + Acoustic Oak Slats + Corner Planter */}
      {/* ================================================================= */}
      <group position={[layout.leftWallX, 0, leftWallCenterZ]}>
        <RoundedBox
          args={[0.26, layout.wallHeight, leftWallLen]}
          radius={safeBevel(0.26, layout.wallHeight, leftWallLen, 0.072)}
          smoothness={4}
          position={[0, layout.wallHeight / 2 - 0.04, 0]}
          castShadow
          receiveShadow
        >
          <StudioClayMaterial
            color={wallPlasterColor}
            finishProps={finishProps}
            roughnessOffset={0.08}
          />
        </RoundedBox>

        <RoundedBox
          args={[0.31, 0.11, leftWallLen + 0.04]}
          radius={safeBevel(0.31, 0.11, leftWallLen + 0.04, 0.04)}
          smoothness={4}
          position={[0.02, layout.wallHeight - 0.03, 0]}
          castShadow
        >
          <StudioClayMaterial color={oakWoodRich} finishProps={finishProps} />
        </RoundedBox>

        <RoundedBox
          args={[0.08, 0.16, leftWallLen - 0.06]}
          radius={safeBevel(0.08, 0.16, leftWallLen - 0.06, 0.028)}
          smoothness={4}
          position={[0.14, 0.08, 0]}
          receiveShadow
        >
          <StudioClayMaterial color={oakWoodRich} finishProps={finishProps} />
        </RoundedBox>

        {/* Left Wall Acoustic Felt + Vertical Oak Wood Slats */}
        <RoundedBox
          args={[0.042, layout.wallHeight * 0.76, leftPanelDepth]}
          radius={safeBevel(0.042, layout.wallHeight * 0.76, leftPanelDepth, 0.016)}
          smoothness={4}
          position={[0.132, layout.wallHeight * 0.49, 0]}
          receiveShadow
        >
          <StudioClayMaterial
            color={acousticFeltColor}
            finishProps={finishProps}
            roughnessOffset={0.24}
          />
        </RoundedBox>

        {Array.from({ length: leftSlatCount }, (_, idx) => {
          const sz =
            -leftPanelDepth / 2 + leftSlatSpacing * (idx + 1);
          const slatShade = idx % 2 === 0 ? oakWoodLight : oakWoodRich;
          return (
            <RoundedBox
              key={`left-slat-${idx}`}
              args={[0.068, layout.wallHeight * 0.74, 0.084]}
              radius={safeBevel(0.068, layout.wallHeight * 0.74, 0.084, 0.024)}
              smoothness={4}
              position={[0.168, layout.wallHeight * 0.49, sz]}
              castShadow
              receiveShadow
            >
              <StudioClayMaterial
                color={slatShade}
                finishProps={finishProps}
              />
            </RoundedBox>
          );
        })}
      </group>

      {/* Beveled Corner Column Sealing Back & Left Cutaway Walls */}
      <RoundedBox
        args={[0.3, layout.wallHeight + 0.04, 0.3]}
        radius={safeBevel(0.3, layout.wallHeight + 0.04, 0.3, 0.085)}
        smoothness={4}
        position={[layout.leftWallX + 0.01, layout.wallHeight / 2 - 0.02, layout.backWallZ + 0.01]}
        castShadow
      >
        <StudioClayMaterial color={oakWoodRich} finishProps={finishProps} />
      </RoundedBox>

      {/* Cozy Floor Terracotta Plant in Back-Left Studio Corner */}
      <group
        position={[
          layout.leftWallX + 0.56,
          0,
          layout.backWallZ + 0.58,
        ]}
      >
        <ClayPlantPot
          scale={1.35}
          potColor="#C85A3B"
          leafColorA="#16A34A"
          leafColorB="#0D9488"
          finishProps={finishProps}
          gentleSway={gentleSway}
        />
      </group>

      {/* ================================================================= */}
      {/* 6. Warm Beveled Oak Podcast Table + Mugs + Soundpad + 2 Boom Mics */}
      {/* ================================================================= */}
      <group
        name="podcast-oak-table"
        position={[0, 0, layout.tableZ]}
      >
        {/* Thick Beveled Oak Tabletop */}
        <RoundedBox
          args={[layout.tableWidth, 0.095, layout.tableDepth]}
          radius={safeBevel(
            layout.tableWidth,
            0.095,
            layout.tableDepth,
            0.04
          )}
          smoothness={4}
          position={[0, layout.tableHeight - 0.048, 0]}
          castShadow
          receiveShadow
        >
          <StudioClayMaterial color={oakWoodLight} finishProps={finishProps} />
        </RoundedBox>

        {/* Under-Table Beveled Apron */}
        <RoundedBox
          args={[layout.tableWidth - 0.2, 0.068, layout.tableDepth - 0.18]}
          radius={safeBevel(
            layout.tableWidth - 0.2,
            0.068,
            layout.tableDepth - 0.18,
            0.026
          )}
          smoothness={4}
          position={[0, layout.tableHeight - 0.115, 0]}
          castShadow
        >
          <StudioClayMaterial color={oakWoodRich} finishProps={finishProps} />
        </RoundedBox>

        {/* 4 Rounded Splayed Oak Table Legs */}
        {(
          [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ] as const
        ).map(([sx, sz], idx) => (
          <RoundedBox
            key={`table-leg-${idx}`}
            args={[0.092, layout.tableHeight - 0.08, 0.092]}
            radius={safeBevel(0.092, layout.tableHeight - 0.08, 0.092, 0.036)}
            smoothness={4}
            position={[
              sx * (layout.tableWidth * 0.4 - 0.04),
              (layout.tableHeight - 0.08) / 2,
              sz * (layout.tableDepth * 0.36 - 0.02),
            ]}
            rotation={[sz * 0.04, 0, -sx * 0.04]}
            castShadow
            receiveShadow
          >
            <StudioClayMaterial color={oakWoodRich} finishProps={finishProps} />
          </RoundedBox>
        ))}

        {/* Tactile Podcast Audio Soundpad / Mixer in Table Center */}
        <group position={[0, layout.tableHeight + 0.022, -0.02]}>
          <RoundedBox
            args={[0.34, 0.044, 0.22]}
            radius={safeBevel(0.34, 0.044, 0.22, 0.018)}
            smoothness={4}
            castShadow
          >
            <StudioClayMaterial
              color="#232730"
              finishProps={finishProps}
              metalnessOverride={0.28}
            />
          </RoundedBox>
          {(
            [
              [-0.1, 0.035, primaryAccent],
              [-0.035, 0.035, secondaryAccent],
              [0.035, 0.035, '#F59E0B'],
              [0.1, 0.035, '#4ADE80'],
            ] as const
          ).map(([px, pz, padColor], pIdx) => (
            <RoundedBox
              key={`mixer-pad-${pIdx}`}
              args={[0.048, 0.02, 0.048]}
              radius={0.008}
              smoothness={4}
              position={[px, 0.024, pz]}
            >
              <StudioClayMaterial
                color={padColor}
                finishProps={finishProps}
              />
            </RoundedBox>
          ))}
        </group>

        {/* Two Cozy Ceramic Coffee Mugs */}
        {(
          [
            {
              x: compactVertical ? -0.26 : -0.34,
              z: 0.14,
              rotY: 0.45,
              color: '#FFF7ED',
            },
            {
              x: compactVertical ? 0.26 : 0.34,
              z: 0.12,
              rotY: -2.4,
              color: secondaryAccent,
            },
          ] as const
        ).map((mug, mIdx) => (
          <group
            key={`coffee-mug-${mIdx}`}
            position={[mug.x, layout.tableHeight, mug.z]}
            rotation={[0, mug.rotY, 0]}
          >
            {/* Cork Coaster */}
            <mesh position={[0, 0.006, 0]} receiveShadow>
              <cylinderGeometry args={[0.072, 0.075, 0.012, 24]} />
              <StudioClayMaterial color="#B9804E" finishProps={finishProps} />
            </mesh>
            {/* Ceramic Mug Body */}
            <mesh position={[0, 0.068, 0]} castShadow>
              <cylinderGeometry args={[0.056, 0.05, 0.115, 24]} />
              <StudioClayMaterial
                color={mug.color}
                finishProps={finishProps}
                roughnessOffset={-0.18}
              />
            </mesh>
            {/* Mug C-Handle */}
            <mesh position={[0.058, 0.068, 0]} castShadow>
              <torusGeometry args={[0.03, 0.011, 12, 20, Math.PI]} />
              <StudioClayMaterial
                color={mug.color}
                finishProps={finishProps}
                roughnessOffset={-0.18}
              />
            </mesh>
            {/* Rich Espresso Coffee Surface */}
            <mesh position={[0, 0.122, 0]}>
              <cylinderGeometry args={[0.046, 0.046, 0.008, 20]} />
              <meshPhysicalMaterial
                color="#3A1D12"
                roughness={0.14}
                clearcoat={0.85}
              />
            </mesh>
          </group>
        ))}

        {/* Two Articulated Boom-Arm Studio Condenser Microphones (Left & Right) */}
        <StudioBoomMicrophone
          side={-1}
          mountX={-layout.tableWidth * 0.38}
          tableTopY={layout.tableHeight}
          accentColor={primaryAccent}
          finishProps={finishProps}
        />
        <StudioBoomMicrophone
          side={1}
          mountX={layout.tableWidth * 0.38}
          tableTopY={layout.tableHeight}
          accentColor={secondaryAccent}
          finishProps={finishProps}
        />
      </group>

      {children}
    </group>
  );
};
