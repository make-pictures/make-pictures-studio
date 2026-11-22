import { defineProduction } from '@make-pictures/core';
import {
  Tactile3DShowcase,
  tactile3dShowcaseSchema,
} from './Tactile3DShowcase';
import tactileDefaults from './Tactile3DShowcase.props.json';

export * from './Tactile3DShowcase';

export default defineProduction({
  id: 'tactile-3d-showcase',
  origin: 'example',
  compositions: [
    {
      id: 'Tactile3DShowcase',
      title: 'Tactile 3D Core Showcase',
      subtitle: 'Disney Kinematics • GPU Sheet Bend • Screen-Glass • Sync HDR',
      group: 'Visual Kits (3D & 2.5D)',
      kit: 'paper-diorama-3d',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 360,
      usesThree: true,
      propsFile: 'examples/tactile-3d-showcase/Tactile3DShowcase.props.json',
      sceneTimeline: [
        {
          sceneId: 'tactile-core-demo',
          fromFrame: 0,
          durationInFrames: 360,
          label: 'Tactile 3D Arc & Glass Impact',
        },
      ],
      component: Tactile3DShowcase,
      schema: tactile3dShowcaseSchema,
      defaultProps: { ...tactileDefaults },
    },
  ],
});
