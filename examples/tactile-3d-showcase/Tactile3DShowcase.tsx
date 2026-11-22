import React, { useMemo } from 'react';
import { z } from 'zod';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import * as THREE from 'three';
import {
  DirectorCamera3D,
  StyleProvider,
  computeGlassLightingBlend,
  disneyEase,
  evaluateAnticipation,
  evaluateArc3D,
  evaluateDirectorCamera3D,
  evaluateSecondaryCascade,
  evaluateSurfaceImpact,
  evaluateVelocityStretch,
  projectScreenGlassPose,
  useStudioStyle,
  type CameraImpulse,
  type DeformedSheetBoundsInput,
  type OrientedBox3D,
  type SheetDeformParams,
  type ShotSpec3D,
  type StageAnchor3D,
  type Vec3,
} from '@make-pictures/core';
import {
  DaylightArcRig3D,
  DeformableSheet3D,
  ScreenGlassLayer3D,
  computeScreenGlassTransform,
  evaluateTimeOfDayLighting,
  getProceduralPbrMaps,
} from '@make-pictures/kits/tactile-3d';
import {
  FloatingEditorialDisplay,
  PaperRibbonTimeline,
  type PaperTimelineMilestone,
} from '@make-pictures/kits/editorial-collage';

export const tactile3dShowcaseSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  title: z.string().describe('Teksty & Napisy :: Tytuł arkusza'),
  subtitle: z.string().describe('Teksty & Napisy :: Podpis arkusza'),
});

export type Tactile3DShowcaseProps = z.infer<typeof tactile3dShowcaseSchema>;

const ANCHORS: Record<string, StageAnchor3D> = {
  stack: { position: [0, -0.02, 0.22], height: 0.72, radius: 0.72 },
};

const SHOTS: ShotSpec3D[] = [
  { fromFrame: 0, shot: 'medium', target: 'stack', angleDeg: 14, fov: 35, label: 'Tabletop Establish' },
  { fromFrame: 32, shot: 'macro', target: 'stack', angleDeg: 8, fov: 28, transition: 'glide', label: 'Macro Stack' },
  { fromFrame: 152, shot: 'close-up', target: 'stack', angleDeg: 4, fov: 31, transition: 'glide', label: 'Glass Impact' },
];

const IMPACT_FRAME = 156;
const IMPULSES: CameraImpulse[] = [
  { frame: IMPACT_FRAME, intensity: 0.14, decayFrames: 14 },
];

const TIMELINE_MILESTONES: ReadonlyArray<PaperTimelineMilestone> = [
  { id: 'stack', era: '01', label: 'Macro Stack', fromFrame: 2 },
  { id: 'arc', era: '02', label: 'Disney Arc', fromFrame: 91 },
  { id: 'glass', era: '03', label: 'Screen Glass', fromFrame: 156 },
  { id: 'settle', era: '04', label: 'Settle', fromFrame: 271 },
];

export interface TactileShowcaseSheetState {
  id: string;
  position: Vec3;
  rotation?: Vec3;
  quaternion?: [number, number, number, number];
  scale: Vec3;
  width: number;
  height: number;
  thickness: number;
  deform: SheetDeformParams;
  obb: OrientedBox3D;
  deformedBounds: DeformedSheetBoundsInput;
}

export interface TactileShowcaseFrameState {
  frame: number;
  cameraPose: ReturnType<typeof evaluateDirectorCamera3D>;
  cameraBasis: {
    position: Vec3;
    target: Vec3;
    roll: number;
    forward: Vec3;
    right: Vec3;
    up: Vec3;
    fov: number;
  };
  timeOfDay: number;
  daylightState: ReturnType<typeof evaluateTimeOfDayLighting>;
  lighting: ReturnType<typeof computeGlassLightingBlend>;
  glassDistance: number;
  glassProgress: number;
  contactShadowOpacity: number;
  impactRotZ: number;
  hero: TactileShowcaseSheetState;
  restingSheets: [TactileShowcaseSheetState, TactileShowcaseSheetState];
  collisionBodies: OrientedBox3D[];
}

const Y_AXIS_3D = new THREE.Vector3(0, 1, 0);
const Z_AXIS_3D = new THREE.Vector3(0, 0, 1);
const HERO_REST_QUAT = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ')
);

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function buildSheetState(params: {
  id: string;
  position: Vec3;
  rotation?: Vec3;
  quaternion?: [number, number, number, number];
  scale: Vec3;
  width: number;
  height: number;
  thickness: number;
  deform: SheetDeformParams;
}): TactileShowcaseSheetState {
  const obb: OrientedBox3D = {
    id: params.id,
    position: params.position,
    size: [params.width, params.height, params.thickness],
    rotation: params.quaternion ? undefined : params.rotation,
    quaternion: params.quaternion,
    scale: params.scale,
  };
  const deformedBounds: DeformedSheetBoundsInput = {
    position: params.position,
    width: params.width,
    height: params.height,
    thickness: params.thickness,
    rotation: params.quaternion ? undefined : params.rotation,
    quaternion: params.quaternion,
    scale: params.scale,
    deform: params.deform,
  };
  return {
    ...params,
    obb,
    deformedBounds,
  };
}

/**
 * Pure deterministic per-frame solver for `Tactile3DShowcase`.
 * Exported for exhaustive 360-frame OBB SAT & deformed tabletop clearance tests.
 */
export function evaluateTactileShowcaseFrame(
  frame: number,
  fps = 60,
  width = 1920,
  height = 1080,
  durationInFrames = 360
): TactileShowcaseFrameState {
  const cameraPose = evaluateDirectorCamera3D({
    frame,
    fps,
    width,
    height,
    durationInFrames,
    anchors: ANCHORS,
    shots: SHOTS,
    handheldIntensity: 0.01,
    impulses: IMPULSES,
    seed: 7,
  });

  const cameraBasis = {
    position: cameraPose.position,
    target: cameraPose.lookAt,
    roll: (cameraPose.rollDeg * Math.PI) / 180,
    forward: cameraPose.forward,
    right: cameraPose.right,
    up: cameraPose.up,
    fov: cameraPose.fov,
  };

  // Daylight arc progression: crisp morning (0.05) -> warm golden afternoon (0.55)
  const timeOfDay = interpolate(
    frame,
    [0, Math.max(1, durationInFrames - 1)],
    [0.05, 0.55],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Phase timings: Anticipation [56..90], Flight [91..155], Glass Hold [156..270], Return [271..345]
  const anticProg = interpolate(frame, [56, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const antic = evaluateAnticipation(anticProg, 0.44);

  const flightRaw = interpolate(frame, [91, IMPACT_FRAME], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const flightT = disneyEase(flightRaw, 'slap');

  const returnRaw = interpolate(frame, [271, 345], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const returnT = disneyEase(returnRaw, 'settle');

  const glassDistance = 1.35;
  const glassSheetScale = 0.3;
  const glassPose = projectScreenGlassPose(
    cameraBasis,
    0.08,
    0.07,
    glassDistance,
    width / height
  );
  const glassTransform = computeScreenGlassTransform(
    cameraBasis,
    glassDistance,
    width / height
  );
  const glassQuatObj = new THREE.Quaternion(
    glassTransform.quaternion[0],
    glassTransform.quaternion[1],
    glassTransform.quaternion[2],
    glassTransform.quaternion[3]
  );

  // Hero rests cleanly above the two resting sheets (y = 0.022 and y = 0.056)
  // while keeping strict tabletop & GPU-deformed inter-sheet clearance (>= 0.005)
  // across peak anticipation dip and secondary cascade.
  const restPos: Vec3 = [0, 0.135, 0];
  let heroPos: Vec3 = [
    restPos[0],
    restPos[1] + antic.offsetY,
    restPos[2] + antic.offsetZ,
  ];
  const heroQuatObj = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2 + antic.tiltX * 0.3, 0, 0, 'XYZ')
  );
  let heroScale: Vec3 = [1, 1, 1];
  let bendX = 0;
  let bendY = antic.bendY * 0.6;
  let twist = 0;
  let cornerWhip = 0;
  let velocityStretch = 0;
  let glassProgress = 0;
  let contactShadowOpacity = 0;
  let impactRotZ = 0;

  if (frame >= 91 && frame < IMPACT_FRAME) {
    const arc = evaluateArc3D(
      restPos,
      [-0.55, 1.45, 0.55],
      [0.35, 1.45, 1.35],
      glassPose.position,
      flightT
    );
    const bankEnv = Math.sin(flightT * Math.PI);
    heroPos = arc.position;
    // Continuous quaternion slerp from tabletop rest into camera-aligned glass pose
    // with aerodynamic bank roll and subtle mid-flight yaw flourish that vanish at endpoints.
    const qYawFlourish = new THREE.Quaternion().setFromAxisAngle(
      Y_AXIS_3D,
      bankEnv * 0.24
    );
    const qBank = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS_3D,
      arc.bankRoll * bankEnv
    );
    heroQuatObj
      .copy(HERO_REST_QUAT)
      .slerp(glassQuatObj, flightT)
      .multiply(qYawFlourish)
      .multiply(qBank);
    heroScale = lerpVec3(
      [1, 1, 1],
      [glassSheetScale, glassSheetScale, glassSheetScale],
      flightT
    );
    bendY = Math.sin(flightT * Math.PI) * 0.42;
    twist = Math.sin(flightT * Math.PI) * 0.24;
    velocityStretch = evaluateVelocityStretch(arc.velocity, 1.2, 0.085);
    glassProgress = interpolate(flightT, [0.75, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (frame >= IMPACT_FRAME && frame < 271) {
    const impact = evaluateSurfaceImpact(frame - IMPACT_FRAME, 1.0);
    glassProgress = 1;
    contactShadowOpacity = impact.contactShadowOpacity;
    impactRotZ = impact.rotZ;
    heroPos = glassPose.position;
    const qImpactZ = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS_3D,
      impact.rotZ
    );
    heroQuatObj.copy(glassQuatObj).multiply(qImpactZ);
    heroScale = [
      impact.scaleX * glassSheetScale,
      impact.scaleY * glassSheetScale,
      glassSheetScale,
    ];
    cornerWhip = impact.cornerWhip;
    const bendHoldFadeIn = interpolate(
      frame,
      [IMPACT_FRAME, IMPACT_FRAME + 12],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    const bendHoldFadeOut = interpolate(frame, [246, 270], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    bendX =
      Math.sin((frame - IMPACT_FRAME) * 0.045) *
      0.05 *
      bendHoldFadeIn *
      bendHoldFadeOut;
  } else if (frame >= 271) {
    const arcBack = evaluateArc3D(
      glassPose.position,
      [0.4, 1.35, 1.15],
      [-0.3, 1.15, 0.42],
      restPos,
      returnT
    );
    const bankEnv = Math.sin(returnT * Math.PI);
    heroPos = arcBack.position;
    const qBank = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS_3D,
      arcBack.bankRoll * 0.5 * bankEnv
    );
    heroQuatObj
      .copy(glassQuatObj)
      .slerp(HERO_REST_QUAT, returnT)
      .multiply(qBank);
    heroScale = lerpVec3(
      [glassSheetScale, glassSheetScale, glassSheetScale],
      [1, 1, 1],
      returnT
    );
    bendY = Math.sin(returnT * Math.PI) * 0.22;
    glassProgress = 1 - Math.min(1, returnT * 3);
    contactShadowOpacity = 0.36 * glassProgress;
  }

  const heroQuat: [number, number, number, number] = [
    heroQuatObj.x,
    heroQuatObj.y,
    heroQuatObj.z,
    heroQuatObj.w,
  ];

  const lighting = computeGlassLightingBlend(glassProgress, 0.18);
  const daylightState = evaluateTimeOfDayLighting(timeOfDay, {
    sceneLampMultiplier: lighting.sceneLampMultiplier,
  });

  // Two underlying resting sheets demonstrating secondary cascade with clean inter-sheet clearance.
  const cascadeUpper = evaluateSecondaryCascade(frame - 91, 0, 3);
  const cascadeLower = evaluateSecondaryCascade(frame - 91, 1, 3);

  const restingUpper = buildSheetState({
    id: 'resting-sheet-upper',
    position: [0.04, 0.056 + cascadeUpper.offsetY, 0.03],
    rotation: [-Math.PI / 2, 0, 0.05 + cascadeUpper.rotZ],
    scale: [1, 1, 1],
    width: 1.0,
    height: 1.4,
    thickness: 0.014,
    deform: {
      bendX: 0,
      bendY: cascadeUpper.bendY,
      twist: 0,
      cornerWhip: 0,
      velocityStretch: 0,
    },
  });

  const restingLower = buildSheetState({
    id: 'resting-sheet-lower',
    position: [0.08, 0.022 + cascadeLower.offsetY, 0.06],
    rotation: [-Math.PI / 2, 0, 0.1 + cascadeLower.rotZ],
    scale: [1, 1, 1],
    width: 1.0,
    height: 1.4,
    thickness: 0.014,
    deform: {
      bendX: 0,
      bendY: cascadeLower.bendY,
      twist: 0,
      cornerWhip: 0,
      velocityStretch: 0,
    },
  });

  const hero = buildSheetState({
    id: 'hero-sheet',
    position: heroPos,
    quaternion: heroQuat,
    scale: heroScale,
    width: 1.0,
    height: 1.4,
    thickness: 0.016,
    deform: {
      bendX,
      bendY,
      twist,
      cornerWhip,
      velocityStretch,
    },
  });

  return {
    frame,
    cameraPose,
    cameraBasis,
    timeOfDay,
    daylightState,
    lighting,
    glassDistance,
    glassProgress,
    contactShadowOpacity,
    impactRotZ,
    hero,
    restingSheets: [restingUpper, restingLower],
    collisionBodies: [restingLower.obb, restingUpper.obb, hero.obb],
  };
}

function createSheetGraphicTexture(
  bg: string,
  accent: string,
  ink: string,
  title: string,
  subtitle: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1408;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle geometric editorial frame (universal studio specimen sheet)
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(54, 54, canvas.width - 108, canvas.height - 108);

  // Center architectural emblem
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(512, 540, 195, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(512, 540, 118, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ink;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(220, 860);
  ctx.lineTo(804, 860);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.font = '700 68px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.slice(0, 22), 512, 990);

  ctx.font = '500 38px sans-serif';
  ctx.fillText(subtitle.slice(0, 38), 512, 1065);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

const Tactile3DShowcaseScene: React.FC<Tactile3DShowcaseProps> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const style = useStudioStyle();

  const frontTexture = useMemo(
    () =>
      createSheetGraphicTexture(
        style.palette.bgSurface,
        style.palette.accentPrimary,
        style.palette.textPrimary,
        title,
        subtitle
      ),
    [
      style.palette.bgSurface,
      style.palette.accentPrimary,
      style.palette.textPrimary,
      title,
      subtitle,
    ]
  );

  // Shared cached procedural PBR textures — never disposed by individual scenes.
  const linenMaps = useMemo(
    () =>
      getProceduralPbrMaps('linen-weave', {
        seed: 'tactile-showcase-mat',
        repeat: [8, 6],
      }),
    []
  );
  const woodMapsHorizontal = useMemo(
    () =>
      getProceduralPbrMaps('wood-grain', {
        seed: 'tactile-showcase-frame-h',
        repeat: [2.4, 1],
      }),
    []
  );
  const woodMapsVertical = useMemo(
    () =>
      getProceduralPbrMaps('wood-grain', {
        seed: 'tactile-showcase-frame-v',
        repeat: [1, 2.2],
      }),
    []
  );

  React.useEffect(() => {
    return () => {
      frontTexture?.dispose();
    };
  }, [frontTexture]);

  if (frame <= 0) {
    return null;
  }

  const state = evaluateTactileShowcaseFrame(
    frame,
    fps,
    width,
    height,
    durationInFrames
  );

  // Outer beveled wood frame spans x in ±4.2, z in ±2.8 (well outside sheet collision zone).
  const matHalfW = 4.2;
  const matHalfD = 2.8;
  const railThickness = 1.8;
  const railHeight = 0.085;
  const woodTint = '#A47B56';

  return (
    <>
      <DirectorCamera3D
        anchors={ANCHORS}
        shots={SHOTS}
        handheldIntensity={0.01}
        impulses={IMPULSES}
        seed={7}
      />

      <DaylightArcRig3D
        timeOfDay={state.timeOfDay}
        sceneLampMultiplier={state.lighting.sceneLampMultiplier}
      />

      {/* Recessed woven PBR linen-weave studio mat at exact y = 0 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[matHalfW * 2, matHalfD * 2]} />
        <meshStandardMaterial
          color={style.palette.bgElevated}
          map={linenMaps.map}
          bumpMap={linenMaps.bumpMap}
          bumpScale={0.011}
          roughnessMap={linenMaps.roughnessMap}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      {/* Outer beveled wood-grain tabletop frame (outside sheet collision zone) */}
      <group name="pbr-wood-tabletop-frame">
        {/* Back & front long rails (z = ±(matHalfD + railThickness/2)) */}
        {[-1, 1].map((side) => (
          <group key={`rail-z-${side}`}>
            <mesh
              position={[0, railHeight * 0.5 - 0.02, side * (matHalfD + railThickness * 0.5)]}
              receiveShadow
              castShadow
            >
              <boxGeometry
                args={[matHalfW * 2 + railThickness * 2, railHeight, railThickness]}
              />
              <meshStandardMaterial
                color={woodTint}
                map={woodMapsHorizontal.map}
                bumpMap={woodMapsHorizontal.bumpMap}
                bumpScale={0.014}
                roughnessMap={woodMapsHorizontal.roughnessMap}
                roughness={0.68}
                metalness={0.04}
              />
            </mesh>
            {/* Subtle chamfered inner bevel lip */}
            <mesh
              position={[0, 0.024, side * (matHalfD + 0.035)]}
              rotation={[side * 0.42, 0, 0]}
              receiveShadow
            >
              <boxGeometry args={[matHalfW * 2 + 0.09, 0.04, 0.09]} />
              <meshStandardMaterial
                color="#8A6443"
                map={woodMapsHorizontal.map}
                bumpMap={woodMapsHorizontal.bumpMap}
                bumpScale={0.01}
                roughnessMap={woodMapsHorizontal.roughnessMap}
                roughness={0.62}
                metalness={0.05}
              />
            </mesh>
          </group>
        ))}

        {/* Left & right side rails (x = ±(matHalfW + railThickness/2)) */}
        {[-1, 1].map((side) => (
          <group key={`rail-x-${side}`}>
            <mesh
              position={[side * (matHalfW + railThickness * 0.5), railHeight * 0.5 - 0.02, 0]}
              receiveShadow
              castShadow
            >
              <boxGeometry args={[railThickness, railHeight, matHalfD * 2]} />
              <meshStandardMaterial
                color={woodTint}
                map={woodMapsVertical.map}
                bumpMap={woodMapsVertical.bumpMap}
                bumpScale={0.014}
                roughnessMap={woodMapsVertical.roughnessMap}
                roughness={0.68}
                metalness={0.04}
              />
            </mesh>
            <mesh
              position={[side * (matHalfW + 0.035), 0.024, 0]}
              rotation={[0, 0, -side * 0.42]}
              receiveShadow
            >
              <boxGeometry args={[0.09, 0.04, matHalfD * 2 + 0.09]} />
              <meshStandardMaterial
                color="#8A6443"
                map={woodMapsVertical.map}
                bumpMap={woodMapsVertical.bumpMap}
                bumpScale={0.01}
                roughnessMap={woodMapsVertical.roughnessMap}
                roughness={0.62}
                metalness={0.05}
              />
            </mesh>
          </group>
        ))}

        {/* Extended studio floor apron beneath the framed desk */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
          <planeGeometry args={[28, 20]} />
          <meshStandardMaterial
            color="#9B7553"
            map={woodMapsHorizontal.map}
            roughnessMap={woodMapsHorizontal.roughnessMap}
            roughness={0.78}
            metalness={0.03}
          />
        </mesh>
      </group>

      {/* Two underlying resting sheets with matte parchment PBR finish */}
      {state.restingSheets.map((sheet) => (
        <DeformableSheet3D
          key={sheet.id}
          name={sheet.id}
          position={sheet.position}
          rotation={sheet.rotation}
          scale={sheet.scale}
          width={sheet.width}
          height={sheet.height}
          thickness={sheet.thickness}
          cornerRadius={0.06}
          finish="parchment-matte"
          deform={sheet.deform}
          frontColor={style.palette.bgSurface}
          backColor={style.palette.bgElevated}
          edgeColor={style.palette.accentSecondary}
        />
      ))}

      {/* Hero deformable sheet with satin linen-glaze PBR finish (quaternion-only orientation) */}
      <DeformableSheet3D
        name={state.hero.id}
        position={state.hero.position}
        quaternion={state.hero.quaternion}
        scale={state.hero.scale}
        width={state.hero.width}
        height={state.hero.height}
        thickness={state.hero.thickness}
        cornerRadius={0.06}
        finish="linen-glaze"
        frontMap={frontTexture}
        backColor={style.palette.accentSecondary}
        edgeColor={style.palette.bgSurface}
        deform={state.hero.deform}
        castShadow={state.lighting.castSceneShadow}
        receiveShadow
        renderOrder={state.glassProgress > 0.5 ? 2 : 0}
      />

      <ScreenGlassLayer3D
        camera={state.cameraBasis}
        glassDistance={state.glassDistance}
        aspect={width / height}
        items={[
          {
            id: state.hero.id,
            ndcX: 0.08,
            ndcY: 0.07,
            glassProgress: state.glassProgress,
            contactShadowOpacity: state.contactShadowOpacity,
            width: 0.3,
            height: 0.42,
            scale: [state.hero.scale[0] / 0.3, state.hero.scale[1] / 0.3],
            rotZ: state.impactRotZ,
          },
        ]}
      />
    </>
  );
};

const Tactile3DShowcaseInner: React.FC<Tactile3DShowcaseProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const style = useStudioStyle();

  if (frame <= 0) {
    return <AbsoluteFill style={{ backgroundColor: style.palette.bgCanvas }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: style.palette.bgCanvas }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows="percentage"
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.95,
        }}
      >
        <Tactile3DShowcaseScene {...props} />
      </ThreeCanvas>

      {/* Frameless editorial display (top-left) — zero dark box chrome */}
      <FloatingEditorialDisplay
        eyebrow="TACTILE 3D ENGINE"
        headline={props.title}
        subline={props.subtitle}
        position="top"
        align="left"
        headlinePx={52}
        sublinePx={21}
        monoSubline
        style={{ top: 108, maxWidth: 620 }}
      />

      {/* Frameless light paper ribbon timeline (bottom) */}
      <PaperRibbonTimeline
        position="bottom"
        milestones={TIMELINE_MILESTONES}
      />
    </AbsoluteFill>
  );
};

export const Tactile3DShowcase: React.FC<Tactile3DShowcaseProps> = (props) => (
  <StyleProvider style={props.styleId} renderBackdrop={false}>
    <Tactile3DShowcaseInner {...props} />
  </StyleProvider>
);
