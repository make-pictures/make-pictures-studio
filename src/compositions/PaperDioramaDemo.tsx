import { ThreeCanvas } from '@remotion/three';
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { VOICEOVER_MANIFEST } from '../generated/voiceover-data';
import {
  PaperCameraRig3D,
  PaperCloudCutout3D,
  PaperCutout3D,
  PaperMountainBackdrop3D,
  PaperPineTree3D,
  PaperStageLighting3D,
  PopUpBookBase3D,
  PopUpHinge3D,
} from '../kits/paper-diorama-3d';

export const PaperDioramaDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const foldIn = interpolate(frame, [0, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pageTurn = interpolate(frame, [300, 360], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const camX = interpolate(frame, [0, 660], [-1.2, 1.2]);
  const camY = interpolate(frame, [0, 660], [3.6, 3.2]);
  const camZ = interpolate(frame, [0, 660], [9.4, 8.6]);

  const hasAudio = Boolean(VOICEOVER_MANIFEST['starter-story']);

  return (
    <AbsoluteFill style={{ backgroundColor: '#FDF8F0' }}>
      {hasAudio && <Audio src={staticFile('voiceovers/starter-story.mp3')} />}
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ fov: 36, position: [camX, camY, camZ] }}
      >
        <PaperCameraRig3D
          cameraPos={[camX, camY, camZ]}
          lookAt={[0, 1.8, -1.5]}
          fov={36}
        />
        <PaperStageLighting3D preset="daylight" />

        <PopUpBookBase3D
          floorTheme={frame < 360 ? 'mint-plains' : 'checkerboard-tile'}
          nextFloorTheme="checkerboard-tile"
          pageTurnProgress={pageTurn}
        />

        <PaperMountainBackdrop3D position={[0, 0, -5.2]} />

        <PaperCloudCutout3D position={[-4.2, 4.1, -3.8]} scale={0.95} />
        <PaperCloudCutout3D
          position={[4.0, 4.4, -4.1]}
          scale={1.05}
          tint="#E0F2FE"
          idSuffix="blue"
        />

        <PopUpHinge3D foldProgress={foldIn} position={[-4.4, 0, -1.8]}>
          <PaperPineTree3D position={[0, 0, 0]} scale={1.1} />
        </PopUpHinge3D>
        <PopUpHinge3D foldProgress={foldIn} position={[4.4, 0, -1.6]}>
          <PaperPineTree3D position={[0, 0, 0]} scale={1.05} />
        </PopUpHinge3D>

        <PopUpHinge3D foldProgress={foldIn} position={[0, 0, 0.6]}>
          <PaperCutout3D
            cacheKey="demo-banner-sign"
            width={5.6}
            height={2.2}
            pixelWidth={640}
            pixelHeight={260}
            whiteBorderPx={14}
            position={[0, 0, 0]}
            thickness={0.05}
            draw={(ctx) => {
              ctx.fillStyle = '#FFFDF7';
              ctx.strokeStyle = '#78350F';
              ctx.lineWidth = 8;
              ctx.beginPath();
              ctx.roundRect(24, 24, 592, 212, 24);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#0F172A';
              ctx.font = '800 44px Inter, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('2.5D PAPER DIORAMA KIT', 320, 122);

              ctx.fillStyle = '#475569';
              ctx.font = '600 26px Inter, sans-serif';
              ctx.fillText('make-pictures-studio • React + Three.js', 320, 174);
            }}
          />
        </PopUpHinge3D>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
