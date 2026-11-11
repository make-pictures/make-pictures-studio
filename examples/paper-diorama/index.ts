import { defineProduction } from '@make-pictures/core';
import {
  PaperDioramaDemo,
  paperDioramaDemoSchema,
} from './PaperDioramaDemo';
import paperDioramaDefaults from './PaperDioramaDemo.props.json';

export * from './PaperDioramaDemo';

export default defineProduction({
  id: 'paper-diorama',
  origin: 'example',
  compositions: [
    {
      id: 'PaperDioramaDemo',
      title: 'Paper Diorama 3D',
      subtitle: '2.5D Pop-Up Book • Cutouts & WebGL Shadows',
      group: 'Visual Kits (3D & 2.5D)',
      kit: 'paper-diorama-3d',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 870,
      usesThree: true,
      propsFile: 'examples/paper-diorama/PaperDioramaDemo.props.json',
      sceneTimeline: [
        {
          sceneId: 'starter-story',
          fromFrame: 0,
          durationInFrames: 870,
          label: 'Narrator',
        },
      ],
      cameraTimeline: [
        { shotLabel: 'Spread 1 • Mountain Valley', fromFrame: 0, durationInFrames: 382 },
        { shotLabel: 'Pop-Up Page Turn', fromFrame: 382, durationInFrames: 48 },
        { shotLabel: 'Spread 2 • Sunburst Arch', fromFrame: 430, durationInFrames: 440 },
      ],
      sfxTimeline: [
        { sfxId: 'paper-rip-wind', fromFrame: 382, label: 'Page Turn Wind', volume: 0.28 },
        { sfxId: 'harp-strings', fromFrame: 430, label: 'Spread Unfold Harp', volume: 0.24 },
      ],
      component: PaperDioramaDemo,
      schema: paperDioramaDemoSchema,
      defaultProps: paperDioramaDefaults,
    },
  ],
});
