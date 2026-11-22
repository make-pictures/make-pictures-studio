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
  type ShotSpec3D,
  type StageAnchor3D,
  type Vec3,
} from '@make-pictures/core';
import {
  DEFAULT_STUDIO_IBL_PANELS,
  DeformableSheet3D,
  ScreenGlassLayer3D,
  SyncStudioIbl3D,
  computeScreenGlassTransform,
} from '@make-pictures/kits/tactile-3d';

export const tactile3dShowcaseSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  title: z.string().describe('Teksty & Napisy :: Tytuł arkusza'),
  subtitle: z.string().describe('Teksty & Napisy :: Podpis arkusza'),
});

export type Tactile3DShowcaseProps = z.infer<typeof tactile3dShowcaseSchema>;

const ANCHORS: Record<string, StageAnchor3D> = {
  stack: { position: [0, 0.15, 0], height: 0.7, radius: 0.65 },
};

const SHOTS: ShotSpec3D[] = [
  { fromFrame: 0, shot: 'medium', target: 'stack', angleDeg: 14, fov: 34, label: 'Tabletop Establish' },
  { fromFrame: 32, shot: 'macro', target: 'stack', angleDeg: 8, fov: 26, transition: 'glide', label: 'Macro Stack' },
  { fromFrame: 152, shot: 'close-up', target: 'stack', angleDeg: 4, fov: 30, transition: 'glide', label: 'Glass Impact' },
];

const IMPACT_FRAME = 156;
const IMPULSES: CameraImpulse[] = [
  { frame: IMPACT_FRAME, intensity: 0.14, decayFrames: 14 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
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
    [style.palette.bgSurface, style.palette.accentPrimary, style.palette.textPrimary, title, subtitle]
  );

  React.useEffect(() => {
    return () => {
      frontTexture?.dispose();
    };
  }, [frontTexture]);

  if (frame <= 0) {
    return null;
  }

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

  // Phase timings: Anticipation [56..90], Flight [91..156], Glass Hold [156..270], Return [271..345]
  const anticProg = interpolate(frame, [56, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const antic = evaluateAnticipation(anticProg, 1.0);

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

  const glassDistance = 2.35;
  const glassPose = projectScreenGlassPose(cameraBasis, 0, 0.02, glassDistance, width / height);
  const glassTransform = computeScreenGlassTransform(cameraBasis, glassDistance, width / height);

  const restPos: Vec3 = [0, 0.06, 0];
  let heroPos: Vec3 = [restPos[0], restPos[1] + antic.offsetY, restPos[2] + antic.offsetZ];
  let heroRot: Vec3 = [-Math.PI / 2 + antic.tiltX, 0, 0];
  let heroQuat: [number, number, number, number] | undefined;
  let heroScale: Vec3 = [1, 1, 1];
  let bendX = 0;
  let bendY = antic.bendY;
  let twist = 0;
  let cornerWhip = 0;
  let velocityStretch = 0;
  let glassProgress = 0;
  let contactShadowOpacity = 0;

  if (frame >= 91 && frame < IMPACT_FRAME) {
    const arc = evaluateArc3D(
      restPos,
      [-0.7, 1.45, 0.6],
      [0.45, 1.85, 1.9],
      glassPose.position,
      flightT
    );
    heroPos = arc.position;
    heroRot = [
      lerp(-Math.PI / 2, 0, flightT),
      lerp(0, Math.PI * 2, flightT),
      arc.bankRoll,
    ];
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
    heroPos = glassPose.position;
    heroQuat = glassTransform.quaternion;
    heroScale = [impact.scaleX * 0.62, impact.scaleY * 0.62, 1];
    cornerWhip = impact.cornerWhip;
    bendX = Math.sin((frame - IMPACT_FRAME) * 0.045) * 0.05;
  } else if (frame >= 271) {
    const arcBack = evaluateArc3D(
      glassPose.position,
      [0.5, 1.5, 1.6],
      [-0.35, 1.1, 0.45],
      restPos,
      returnT
    );
    heroPos = arcBack.position;
    heroRot = [lerp(0, -Math.PI / 2, returnT), 0, arcBack.bankRoll * 0.5];
    heroScale = lerpVec3([0.62, 0.62, 1], [1, 1, 1], returnT);
    bendY = Math.sin(returnT * Math.PI) * 0.22;
    glassProgress = 1 - Math.min(1, returnT * 3);
  }

  const lighting = computeGlassLightingBlend(glassProgress, 0.18);

  return (
    <>
      <DirectorCamera3D
        anchors={ANCHORS}
        shots={SHOTS}
        handheldIntensity={0.01}
        impulses={IMPULSES}
        seed={7}
      />
      <SyncStudioIbl3D
        panels={DEFAULT_STUDIO_IBL_PANELS}
        environmentIntensity={0.95}
      />

      <hemisphereLight args={['#FFFDF8', '#C8B99D', 0.55 * lighting.sceneLampMultiplier]} />
      <directionalLight
        position={[-3.2, 5.2, 3.6]}
        intensity={1.35 * lighting.sceneLampMultiplier}
        color="#FFF6E5"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      {/* Matte studio tabletop receiving curved GPU shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color={style.palette.bgElevated} roughness={0.86} />
      </mesh>

      {/* Two underlying resting sheets demonstrating secondary cascade */}
      {[1, 2].map((depthIdx) => {
        const cascade = evaluateSecondaryCascade(frame - 91, depthIdx - 1, 3);
        return (
          <DeformableSheet3D
            key={`base-sheet-${depthIdx}`}
            position={[
              depthIdx * 0.04,
              0.018 * (3 - depthIdx) + cascade.offsetY,
              depthIdx * 0.03,
            ]}
            rotation={[-Math.PI / 2, 0, depthIdx * 0.05 + cascade.rotZ]}
            width={1.0}
            height={1.4}
            thickness={0.014}
            cornerRadius={0.06}
            deform={{ bendY: cascade.bendY }}
            frontColor={style.palette.bgSurface}
            backColor={style.palette.bgElevated}
            edgeColor={style.palette.accentSecondary}
          />
        );
      })}

      {/* Hero deformable sheet */}
      <DeformableSheet3D
        name="hero-sheet"
        position={heroPos}
        rotation={heroRot}
        quaternion={heroQuat}
        scale={heroScale}
        width={1.0}
        height={1.4}
        thickness={0.016}
        cornerRadius={0.06}
        frontMap={frontTexture}
        backColor={style.palette.accentSecondary}
        edgeColor={style.palette.bgSurface}
        deform={{ bendX, bendY, twist, cornerWhip, velocityStretch }}
        castShadow={lighting.castSceneShadow}
        receiveShadow
        renderOrder={glassProgress > 0.5 ? 2 : 0}
      />

      <ScreenGlassLayer3D
        camera={cameraBasis}
        glassDistance={glassDistance}
        aspect={width / height}
        items={[
          {
            id: 'hero-sheet',
            ndcX: 0,
            ndcY: 0.02,
            glassProgress,
            contactShadowOpacity,
            width: 0.62,
            height: 0.87,
            scale: [heroScale[0] / 0.62, heroScale[1] / 0.62],
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
          toneMappingExposure: 0.96,
        }}
      >
        <Tactile3DShowcaseScene {...props} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const Tactile3DShowcase: React.FC<Tactile3DShowcaseProps> = (props) => (
  <StyleProvider style={props.styleId} renderBackdrop={false}>
    <Tactile3DShowcaseInner {...props} />
  </StyleProvider>
);
