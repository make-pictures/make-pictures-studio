import { defineProduction, shotsToCameraTimeline } from '@make-pictures/core';
import {
  DIRECTOR_SHOWCASE_SHOTS,
  DirectorShowcase,
  directorShowcaseSchema,
} from './DirectorShowcase';
import directorShowcaseDefaults from './DirectorShowcase.props.json';

export * from './DirectorShowcase';

export default defineProduction({
  id: 'director-showcase',
  origin: 'example',
  compositions: [
    {
      id: 'DirectorShowcase',
      title: 'Director Showcase',
      subtitle: 'Shot DSL • Optical VFX • SmartMusicBed & SoundCue',
      group: 'Cinematography & Audio',
      kit: 'paper-diorama-3d',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 870,
      usesThree: true,
      propsFile: 'examples/director-showcase/DirectorShowcase.props.json',
      hasMusicScore: true,
      sceneTimeline: [
        {
          sceneId: 'starter-story',
          fromFrame: 0,
          durationInFrames: 870,
          label: 'Narrator',
        },
      ],
      cameraTimeline: shotsToCameraTimeline(DIRECTOR_SHOWCASE_SHOTS, 870),
      sfxTimeline: [
        { sfxId: 'pop', fromFrame: 260, label: 'Word Cue ("selects")', volume: 0.32 },
        { sfxId: 'whoosh', fromFrame: 430, label: 'Whip-Pan Whoosh', volume: 0.34 },
        { sfxId: 'triumph-chord', fromFrame: 660, label: 'Word Cue ("sixty")', volume: 0.29 },
      ],
      component: DirectorShowcase,
      schema: directorShowcaseSchema,
      defaultProps: directorShowcaseDefaults,
    },
  ],
});
