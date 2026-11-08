import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Series,
  staticFile,
  useVideoConfig,
} from 'remotion';
import scenesManifest from '../../scenes.json';
import {
  ArchitectureDemoScene,
  IntroScene,
  OutroScene,
  UIShowcaseScene,
} from '../scenes';
import { THEME } from '../theme';

const PROMO_SCENE_IDS = ['intro', 'ui-showcase', 'architecture-demo', 'outro'];

const SCENE_COMPONENTS: Record<string, React.FC> = {
  intro: IntroScene,
  'ui-showcase': UIShowcaseScene,
  'architecture-demo': () => <ArchitectureDemoScene includeAudio={false} />,
  outro: OutroScene,
};

export const ProductPromo: React.FC = () => {
  const { width, height } = useVideoConfig();

  // Scale seamlessly from base 1920x1080 stage to 4K (3840x2160) or any 16:9 target
  const scaleX = width / 1920;
  const scaleY = height / 1080;

  const promoScenes = scenesManifest.scenes.filter((s) =>
    PROMO_SCENE_IDS.includes(s.id)
  );

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.bgPrimary }}>
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Series>
          {promoScenes.map((scene) => {
            const SceneComponent =
              SCENE_COMPONENTS[scene.id] ?? ArchitectureDemoScene;

            return (
              <Series.Sequence
                key={scene.id}
                durationInFrames={scene.durationInFrames}
              >
                <Audio src={staticFile(`voiceovers/${scene.id}.mp3`)} />
                <SceneComponent />
              </Series.Sequence>
            );
          })}
        </Series>
      </div>
    </AbsoluteFill>
  );
};
