import { defineProduction, type ProductionManifest } from '@make-pictures/core';
import productionJson from './production.json';
import {
  PaperDioramaDemo,
  paperDioramaDemoSchema,
} from './PaperDioramaDemo';
import paperDioramaDefaults from './PaperDioramaDemo.props.json';
import {
  PAPER_DIORAMA_CAMERA_TIMELINE,
  PAPER_DIORAMA_DURATION_FRAMES,
  PAPER_DIORAMA_FPS,
  PAPER_DIORAMA_SFX_TIMELINE,
  PAPER_DIORAMA_VO_TIMELINE,
} from './paperDioramaKinematics';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

export * from './PaperDioramaDemo';

const manifest = productionJson as ProductionManifest;

export default defineProduction({
  id: 'paper-diorama',
  title: 'Skyward: Paper Rocket Ascent (Paper Diorama 2.5D)',
  origin: 'example',
  manifest,
  voiceoverManifest: VOICEOVER_MANIFEST,
  compositions: [
    {
      id: 'PaperDioramaDemo',
      title: 'Skyward: Paper Rocket Ascent',
      subtitle: 'Paper Diorama 2.5D • Meadow Launch to Outer Space',
      group: 'Visual Kits (3D & 2.5D)',
      kit: 'paper-diorama-3d',
      fps: PAPER_DIORAMA_FPS,
      width: 1920,
      height: 1080,
      durationInFrames: PAPER_DIORAMA_DURATION_FRAMES,
      usesThree: true,
      hasMusicScore: true,
      propsFile: 'examples/paper-diorama/PaperDioramaDemo.props.json',
      sceneTimeline: [...PAPER_DIORAMA_VO_TIMELINE],
      cameraTimeline: [...PAPER_DIORAMA_CAMERA_TIMELINE],
      sfxTimeline: [...PAPER_DIORAMA_SFX_TIMELINE],
      component: PaperDioramaDemo,
      schema: paperDioramaDemoSchema,
      defaultProps: paperDioramaDefaults,
    },
  ],
});
