import { defineProduction, type ProductionManifest } from '@make-pictures/core';
import productionJson from './production.json';
import {
  StarterStory,
  starterStorySchema,
  StarterStoryVertical,
  starterStoryVerticalSchema,
} from './StarterStory';
import starterStoryDefaults from './StarterStory.props.json';
import starterStoryVerticalDefaults from './StarterStoryVertical.props.json';
import {
  DEFAULT_STARTER_STORY_TIMING,
  STARTER_STORY_DURATION_FRAMES,
  STARTER_STORY_FPS,
} from './starterStoryTiming';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

const manifest = productionJson as unknown as ProductionManifest;

export const starterStoryProduction = defineProduction({
  id: 'starter-story',
  title: 'How a Bullet Train Never Spills a Cup',
  origin: 'example',
  manifest,
  voiceoverManifest: VOICEOVER_MANIFEST,
  compositions: [
    {
      id: 'StarterStory',
      title: 'How a Bullet Train Never Spills a Cup',
      subtitle: 'Editorial Story 16:9 • Panorama, Anatomy & Speed Race',
      group: 'Starter Story (16:9 & Shorts 9:16)',
      kit: 'editorial-collage',
      fps: STARTER_STORY_FPS,
      width: 1920,
      height: 1080,
      durationInFrames: STARTER_STORY_DURATION_FRAMES,
      usesThree: false,
      hasMusicScore: true,
      propsFile: 'examples/starter-story/StarterStory.props.json',
      sceneTimeline: [...DEFAULT_STARTER_STORY_TIMING.voTimeline],
      cameraTimeline: [...DEFAULT_STARTER_STORY_TIMING.cameraTimeline],
      sfxTimeline: [...DEFAULT_STARTER_STORY_TIMING.sfxTimeline],
      component: StarterStory,
      schema: starterStorySchema,
      defaultProps: { ...starterStoryDefaults },
    },
    {
      id: 'StarterStoryVertical',
      title: 'How a Bullet Train Never Spills a Cup (Shorts)',
      subtitle: 'Dedicated 9:16 Vertical • Editorial, Anatomy & Speed Race',
      group: 'Starter Story (16:9 & Shorts 9:16)',
      kit: 'editorial-collage',
      fps: STARTER_STORY_FPS,
      width: 1080,
      height: 1920,
      durationInFrames: STARTER_STORY_DURATION_FRAMES,
      usesThree: false,
      hasMusicScore: true,
      propsFile: 'examples/starter-story/StarterStoryVertical.props.json',
      sceneTimeline: [...DEFAULT_STARTER_STORY_TIMING.voTimeline],
      cameraTimeline: [...DEFAULT_STARTER_STORY_TIMING.cameraTimeline],
      sfxTimeline: [...DEFAULT_STARTER_STORY_TIMING.sfxTimeline],
      component: StarterStoryVertical,
      schema: starterStoryVerticalSchema,
      defaultProps: { ...starterStoryVerticalDefaults },
    },
  ],
});

export default starterStoryProduction;
export * from './StarterStory';
