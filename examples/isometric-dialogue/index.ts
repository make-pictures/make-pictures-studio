import { defineProduction, type ProductionManifest } from '@make-pictures/core';
import productionJson from './production.json';
import {
  IsometricDialogueDemo,
  isometricDialogueSchema,
} from './IsometricDialogueDemo';
import isometricDefaults from './IsometricDialogueDemo.props.json';
import {
  DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE,
  ISOMETRIC_DIALOGUE_DURATION_FRAMES,
  ISOMETRIC_DIALOGUE_FPS,
} from './isometricDialogueKinematics';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

export * from './IsometricDialogueDemo';

const manifest = productionJson as unknown as ProductionManifest;

export default defineProduction({
  id: 'isometric-dialogue',
  title: 'Five Seconds to Air (Soft-Clay 3D Studio Dialogue)',
  origin: 'example',
  manifest,
  voiceoverManifest: VOICEOVER_MANIFEST,
  compositions: [
    {
      id: 'IsometricDialogueDemo',
      title: 'Five Seconds to Air',
      subtitle: 'Soft-Clay 3D Studio • Comedic Two-Host Dialogue',
      group: 'Visual Kits (3D & 2.5D)',
      kit: 'isometric-3d',
      fps: ISOMETRIC_DIALOGUE_FPS,
      width: 1920,
      height: 1080,
      durationInFrames: ISOMETRIC_DIALOGUE_DURATION_FRAMES,
      usesThree: true,
      hasMusicScore: true,
      propsFile: 'examples/isometric-dialogue/IsometricDialogueDemo.props.json',
      sceneTimeline: [...DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE.voTimeline],
      cameraTimeline: [...DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE.cameraTimeline],
      sfxTimeline: [...DEFAULT_ISOMETRIC_DIALOGUE_TIMELINE.sfxTimeline],
      component: IsometricDialogueDemo,
      schema: isometricDialogueSchema,
      defaultProps: { ...isometricDefaults },
    },
  ],
});
