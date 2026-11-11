import { defineProduction } from '@make-pictures/core';
import {
  IsometricDialogueDemo,
  isometricDialogueSchema,
} from './IsometricDialogueDemo';
import isometricDefaults from './IsometricDialogueDemo.props.json';

export * from './IsometricDialogueDemo';

export default defineProduction({
  id: 'isometric-dialogue',
  origin: 'example',
  compositions: [
    {
      id: 'IsometricDialogueDemo',
      title: 'Isometric 3D Dialogue',
      subtitle: 'Isometric Studio • 2-Character 3D Dialogue',
      group: 'Visual Kits (3D & 2.5D)',
      kit: 'isometric-3d',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 910,
      usesThree: true,
      propsFile: 'examples/isometric-dialogue/IsometricDialogueDemo.props.json',
      sceneTimeline: [
        {
          sceneId: 'iso-line-1',
          fromFrame: 36,
          durationInFrames: 246,
          label: 'Alex (Line 1)',
        },
        {
          sceneId: 'iso-line-2',
          fromFrame: 296,
          durationInFrames: 240,
          label: 'Max (Line 2)',
        },
        {
          sceneId: 'iso-line-3',
          fromFrame: 548,
          durationInFrames: 330,
          label: 'Alex (Line 3)',
        },
      ],
      cameraTimeline: [
        { shotLabel: 'OTS Left • Alex', fromFrame: 0, durationInFrames: 281 },
        { shotLabel: 'Reverse Right • Max', fromFrame: 281, durationInFrames: 252 },
        { shotLabel: 'Two-Shot Finale', fromFrame: 533, durationInFrames: 377 },
      ],
      sfxTimeline: [
        { sfxId: 'whoosh', fromFrame: 327, label: '3D Morph Whoosh', volume: 0.32 },
        { sfxId: 'pop', fromFrame: 753, label: '60 FPS Pop', volume: 0.38 },
      ],
      component: IsometricDialogueDemo,
      schema: isometricDialogueSchema,
      defaultProps: { ...isometricDefaults },
    },
  ],
});
