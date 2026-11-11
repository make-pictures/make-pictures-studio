import { ThreeCanvas } from '@remotion/three';
import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import { getSceneVoiceover } from '@make-pictures/core';
import {
  PaperCameraRig3D,
  PaperCloudCutout3D,
  PaperCutout3D,
  PaperMountainBackdrop3D,
  PaperPineTree3D,
  PaperStageLighting3D,
  PopUpBookBase3D,
  PopUpHinge3D,
} from '@make-pictures/kits/paper-diorama-3d';
import { VOICEOVER_MANIFEST } from '../../src/generated/voiceover-data';
import paperDioramaDefaults from './PaperDioramaDemo.props.json';

const floorThemeEnum = z.enum([
  'mint-plains',
  'checkerboard-tile',
  'warm-parquet',
  'valley-terrace',
]);

const lightingPresetEnum = z.enum([
  'daylight',
  'golden-hour',
  'indoor-study',
  'spotlight',
]);

export const paperDioramaDemoSchema = z.object({
  bannerTitle: z.string().describe('3D Cutout :: Banner Title'),
  bannerSubtitle: z.string().describe('3D Cutout :: Banner Subtitle'),
  bannerBorderColor: z.string().describe('3D Cutout :: Banner Frame Color'),
  skyBackground: z.string().describe('Stage & Lighting :: Sky Background'),
  leftCloudTint: z.string().describe('Stage & Lighting :: Left Cloud Tint'),
  rightCloudTint: z.string().describe('Stage & Lighting :: Right Cloud Tint'),
  lightingPreset: lightingPresetEnum.describe(
    'Stage & Lighting :: Stage Lighting Preset'
  ),
  initialFloorTheme: floorThemeEnum.describe(
    'Stage & Lighting :: Spread 1 Floor Theme'
  ),
  nextFloorTheme: floorThemeEnum.describe(
    'Stage & Lighting :: Spread 2 Floor Theme'
  ),
  cameraFov: z
    .number()
    .min(24)
    .max(56)
    .describe('3D Camera :: Field of View (FOV)'),
  cameraDistanceZ: z
    .number()
    .min(6)
    .max(14)
    .describe('3D Camera :: Distance Z (m)'),
  cameraHeightY: z
    .number()
    .min(1.8)
    .max(6)
    .describe('3D Camera :: Height Y (m)'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Voiceover Volume'),
});

export type PaperDioramaDemoProps = z.infer<typeof paperDioramaDemoSchema>;

function drawSunburstArchCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  const cx = w / 2;
  const cy = h - 42;

  ctx.fillStyle = '#FEF3C7';
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 240, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#4F46E5';
  ctx.strokeStyle = '#312E81';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 186, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#FCD34D';
  ctx.lineWidth = 7;
  for (let i = 1; i <= 7; i++) {
    const angle = Math.PI + (i / 8) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 74, cy + Math.sin(angle) * 74);
    ctx.lineTo(cx + Math.cos(angle) * 158, cy + Math.sin(angle) * 158);
    ctx.stroke();
  }

  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(cx, cy, 62, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
}

function drawStudioPillarCutout(
  ctx: CanvasRenderingContext2D,
  label: string,
  accent: string
) {
  ctx.fillStyle = '#FFFDF7';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(28, 30, 264, 306, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = `${accent}22`;
  ctx.beginPath();
  ctx.arc(160, 128, 52, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(160, 128, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 30px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 160, 256, 216);
}

export const PaperDioramaDemo: React.FC<Partial<PaperDioramaDemoProps>> = (
  rawProps
) => {
  const props: PaperDioramaDemoProps = {
    ...(paperDioramaDefaults as PaperDioramaDemoProps),
    ...rawProps,
  };
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const stageOpacity = interpolate(frame, [0, 1, 12], [0, 0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const spread1Unfold = interpolate(frame, [2, 46], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const spread1FoldDown = interpolate(frame, [340, 382], [1, 0], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const spread1Progress = Math.min(spread1Unfold, spread1FoldDown);

  const pageTurn = interpolate(frame, [384, 428], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const spread2Progress = interpolate(frame, [430, 474], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const camOrbit = interpolate(frame, [0, durationInFrames], [0, 1], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const camX = interpolate(camOrbit, [0, 1], [-1.15, 1.15]);
  const camY =
    interpolate(
      camOrbit,
      [0, 1],
      [props.cameraHeightY + 0.18, props.cameraHeightY - 0.14]
    ) +
    Math.sin(frame * 0.03) * 0.04;
  const camZ = interpolate(
    camOrbit,
    [0, 0.5, 1],
    [
      props.cameraDistanceZ + 0.35,
      props.cameraDistanceZ - 0.1,
      props.cameraDistanceZ - 0.35,
    ]
  );

  const cloudDrift = Math.sin(frame * 0.032) * 0.22;

  const initialCamera = useMemo(
    () => ({
      fov: 32.5,
      position: [-1.15, 4.03, 10.2] as [number, number, number],
    }),
    []
  );

  const hasAudio = Boolean(
    getSceneVoiceover('starter-story') ?? VOICEOVER_MANIFEST['starter-story']
  );

  return (
    <AbsoluteFill style={{ backgroundColor: props.skyBackground }}>
      {hasAudio && (
        <Audio
          src={staticFile('voiceovers/starter-story.mp3')}
          volume={props.voiceoverVolume}
        />
      )}

      <Sequence from={382} durationInFrames={46}>
        <Audio src={staticFile('sfx/paper-rip-wind.wav')} volume={0.28} />
      </Sequence>
      <Sequence from={430} durationInFrames={50}>
        <Audio src={staticFile('sfx/harp-strings.wav')} volume={0.24} />
      </Sequence>

      <AbsoluteFill style={{ opacity: stageOpacity }}>
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          camera={initialCamera}
        >
          <PaperCameraRig3D
            cameraPos={[camX, camY, camZ]}
            lookAt={[0, 1.75, -1.5]}
            fov={props.cameraFov}
          />
          <PaperStageLighting3D preset={props.lightingPreset} />

          <PopUpBookBase3D
            floorTheme={
              frame < 362 ? props.initialFloorTheme : props.nextFloorTheme
            }
            nextFloorTheme={props.nextFloorTheme}
            pageTurnProgress={pageTurn}
          />

          <PaperCloudCutout3D
            position={[-4.2 + cloudDrift, 4.2, -3.9]}
            scale={0.95}
            tint={props.leftCloudTint}
            idSuffix="left"
          />
          <PaperCloudCutout3D
            position={[4.0 - cloudDrift, 4.45, -4.2]}
            scale={1.05}
            tint={props.rightCloudTint}
            idSuffix="right"
          />

          <PopUpHinge3D
            foldProgress={spread1Progress}
            position={[0, 0, -5.2]}
          >
            <PaperMountainBackdrop3D position={[0, 0, 0]} />
          </PopUpHinge3D>

          <PopUpHinge3D
            foldProgress={spread1Progress}
            position={[-4.4, 0, -1.8]}
          >
            <PaperPineTree3D position={[0, 0, 0]} scale={1.1} />
          </PopUpHinge3D>
          <PopUpHinge3D
            foldProgress={spread1Progress}
            position={[4.4, 0, -1.6]}
          >
            <PaperPineTree3D position={[0, 0, 0]} scale={1.05} />
          </PopUpHinge3D>

          <PopUpHinge3D foldProgress={spread1Progress} position={[0, 0, 0.65]}>
            <PaperCutout3D
              cacheKey="demo-banner-sign-spread1"
              cacheDeps={[
                props.bannerTitle,
                props.bannerSubtitle,
                props.bannerBorderColor,
              ]}
              width={5.8}
              height={2.25}
              pixelWidth={680}
              pixelHeight={268}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.05}
              draw={(ctx) => {
                ctx.fillStyle = '#FFFDF7';
                ctx.strokeStyle = props.bannerBorderColor;
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.roundRect(28, 28, 624, 212, 24);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#0F172A';
                ctx.font = '800 42px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(props.bannerTitle, 340, 122, 576);

                ctx.fillStyle = '#475569';
                ctx.font = '600 25px Inter, sans-serif';
                ctx.fillText(props.bannerSubtitle, 340, 174, 576);
              }}
            />
          </PopUpHinge3D>

          <PopUpHinge3D
            foldProgress={spread2Progress}
            position={[0, 0, -4.4]}
          >
            <PaperCutout3D
              cacheKey="demo-sunburst-arch-spread2"
              width={6.2}
              height={3.6}
              pixelWidth={560}
              pixelHeight={320}
              whiteBorderPx={16}
              position={[0, 0, 0]}
              thickness={0.055}
              draw={drawSunburstArchCutout}
            />
          </PopUpHinge3D>

          <PopUpHinge3D
            foldProgress={spread2Progress}
            position={[-4.8, 0, -1.7]}
          >
            <PaperCutout3D
              cacheKey="demo-pillar-60fps"
              width={2.05}
              height={2.35}
              pixelWidth={320}
              pixelHeight={368}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.045}
              draw={(ctx) => drawStudioPillarCutout(ctx, '60 FPS GPU', '#2563EB')}
            />
          </PopUpHinge3D>

          <PopUpHinge3D
            foldProgress={spread2Progress}
            position={[4.55, 0, -1.5]}
          >
            <PaperCutout3D
              cacheKey="demo-pillar-threejs"
              width={2.05}
              height={2.35}
              pixelWidth={320}
              pixelHeight={368}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.045}
              draw={(ctx) => drawStudioPillarCutout(ctx, 'REAL SHADOWS', '#059669')}
            />
          </PopUpHinge3D>

          <PopUpHinge3D foldProgress={spread2Progress} position={[0, 0, 0.55]}>
            <PaperCutout3D
              cacheKey="demo-banner-sign-spread2"
              cacheDeps={[props.bannerBorderColor]}
              width={5.4}
              height={2.15}
              pixelWidth={680}
              pixelHeight={268}
              whiteBorderPx={14}
              position={[0, 0, 0]}
              thickness={0.05}
              draw={(ctx) => {
                ctx.fillStyle = '#FFFDF7';
                ctx.strokeStyle = '#2563EB';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.roundRect(28, 28, 624, 212, 24);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#0F172A';
                ctx.font = '800 42px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('VIDEO-AS-CODE @ 60 FPS', 340, 122, 576);

                ctx.fillStyle = '#475569';
                ctx.font = '600 25px Inter, sans-serif';
                ctx.fillText('Create with make.pictures', 340, 174, 576);
              }}
            />
          </PopUpHinge3D>
        </ThreeCanvas>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
