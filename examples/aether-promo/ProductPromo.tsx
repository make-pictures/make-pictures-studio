import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Series,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import { THEME } from '@make-pictures/core';
import scenesManifest from '../../scenes.json';
import {
  ArchitectureDemoScene,
  IntroScene,
  OutroScene,
  UIShowcaseScene,
} from '../../src/scenes';
import productPromoDefaults from './ProductPromo.props.json';

export const productPromoSchema = z.object({
  heroTitle: z.string().describe('Text & Labels :: Intro Hero Title'),
  outroHeadline: z.string().describe('Text & Labels :: Outro Closing Headline'),
  primaryGlowColor: z.string().describe('Colors & Style :: Primary Glow'),
  secondaryGlowColor: z.string().describe('Colors & Style :: Secondary Glow'),
  showCaptions: z.boolean().describe('Captions :: Show Voiceover Subtitles'),
  voiceoverVolume: z
    .number()
    .min(0)
    .max(1.5)
    .describe('Audio :: Voiceover Volume'),
});

export type ProductPromoProps = z.infer<typeof productPromoSchema>;

const PROMO_SCENE_IDS = ['intro', 'ui-showcase', 'architecture-demo', 'outro'];

export const ProductPromo: React.FC<Partial<ProductPromoProps>> = (
  rawProps
) => {
  const props: ProductPromoProps = { ...productPromoDefaults, ...rawProps };
  const { width, height } = useVideoConfig();

  const scaleX = width / 1920;
  const scaleY = height / 1080;

  const promoScenes = scenesManifest.scenes.filter((s) =>
    PROMO_SCENE_IDS.includes(s.id)
  );

  const renderSceneById = (id: string) => {
    if (id === 'intro') {
      return (
        <IntroScene
          heroTitle={props.heroTitle}
          primaryGlowColor={props.primaryGlowColor}
          secondaryGlowColor={props.secondaryGlowColor}
          showCaptions={props.showCaptions}
        />
      );
    }
    if (id === 'ui-showcase') {
      return <UIShowcaseScene showCaptions={props.showCaptions} />;
    }
    if (id === 'architecture-demo') {
      return (
        <ArchitectureDemoScene
          includeAudio={false}
          primaryGlowColor={props.primaryGlowColor}
          secondaryGlowColor={props.secondaryGlowColor}
          showCaptions={props.showCaptions}
        />
      );
    }
    return (
      <OutroScene
        outroHeadline={props.outroHeadline}
        primaryGlowColor={props.primaryGlowColor}
        showCaptions={props.showCaptions}
      />
    );
  };

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
          {promoScenes.map((scene) => (
            <Series.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
            >
              <Audio
                src={staticFile(`voiceovers/${scene.id}.mp3`)}
                volume={props.voiceoverVolume}
              />
              {renderSceneById(scene.id)}
            </Series.Sequence>
          ))}
        </Series>
      </div>
    </AbsoluteFill>
  );
};
