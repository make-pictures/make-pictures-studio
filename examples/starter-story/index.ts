import { defineProduction, getWordTriggerFrame } from '@make-pictures/core';
import {
  StarterStory,
  starterStorySchema,
  StarterStoryVertical,
  starterStoryVerticalSchema,
} from './StarterStory';
import starterStoryDefaults from './StarterStory.props.json';
import starterStoryVerticalDefaults from './StarterStoryVertical.props.json';

const kitsTrigger = getWordTriggerFrame('starter-story', 'selects', 388);
const renderTrigger = getWordTriggerFrame('starter-story', 'renders', 509);
const overviewTrigger = getWordTriggerFrame('starter-story', 'Create', 704);

const sharedCameraCuts = [
  {
    shotLabel: 'Shot 1 • Prompt & Voice',
    fromFrame: 0,
    durationInFrames: Math.max(60, kitsTrigger - 15),
  },
  {
    shotLabel: 'Shot 2 • Visual Kits',
    fromFrame: Math.max(60, kitsTrigger - 15),
    durationInFrames: Math.max(60, overviewTrigger - 24 - (kitsTrigger - 15)),
  },
  {
    shotLabel: 'Shot 3 • Wide Overview',
    fromFrame: Math.max(120, overviewTrigger - 24),
    durationInFrames: Math.max(60, 870 - (overviewTrigger - 24)),
  },
];

const sharedSfxCues = [
  { sfxId: 'pop', fromFrame: 4, label: 'Card Pop' },
  { sfxId: 'whoosh', fromFrame: Math.max(0, kitsTrigger - 12), label: 'Camera Pan' },
  { sfxId: 'pop', fromFrame: renderTrigger, label: 'Render Ready' },
];

export const starterStoryProduction = defineProduction({
  id: 'starter-story',
  title: 'Starter Story',
  origin: 'example',
  compositions: [
    {
      id: 'StarterStory',
      title: 'Starter Story',
      subtitle: '16:9 Template • One-Shot 2D Camera & Ports',
      group: 'Starter Story (16:9 & Shorts 9:16)',
      kit: 'motion-diagrams-2d',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 870,
      usesThree: false,
      propsFile: 'examples/starter-story/StarterStory.props.json',
      sceneTimeline: [
        {
          sceneId: 'starter-story',
          fromFrame: 0,
          durationInFrames: 870,
          label: 'Narrator',
        },
      ],
      cameraTimeline: sharedCameraCuts,
      sfxTimeline: sharedSfxCues,
      component: StarterStory,
      schema: starterStorySchema,
      defaultProps: starterStoryDefaults,
    },
    {
      id: 'StarterStoryVertical',
      title: 'Starter Story Shorts',
      subtitle: 'Dedicated 9:16 • YouTube Shorts & Reels',
      group: 'Starter Story (16:9 & Shorts 9:16)',
      kit: 'motion-diagrams-2d',
      fps: 60,
      width: 1080,
      height: 1920,
      durationInFrames: 870,
      usesThree: false,
      propsFile: 'examples/starter-story/StarterStoryVertical.props.json',
      sceneTimeline: [
        {
          sceneId: 'starter-story',
          fromFrame: 0,
          durationInFrames: 870,
          label: 'Narrator',
        },
      ],
      cameraTimeline: sharedCameraCuts,
      sfxTimeline: sharedSfxCues,
      component: StarterStoryVertical,
      schema: starterStoryVerticalSchema,
      defaultProps: starterStoryVerticalDefaults,
    },
  ],
});

export default starterStoryProduction;
export * from './StarterStory';
