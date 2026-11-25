import React from 'react';
import { Composition } from 'remotion';
import {
  StarterStory,
  StarterStoryVertical,
  starterStorySchema,
  starterStoryVerticalSchema,
  starterStoryDefaultProps,
  starterStoryVerticalDefaultProps,
  STARTER_STORY_DURATION_FRAMES,
  STARTER_STORY_FPS,
  STARTER_STORY_WIDTH,
  STARTER_STORY_HEIGHT,
  STARTER_STORY_VERTICAL_WIDTH,
  STARTER_STORY_VERTICAL_HEIGHT,
} from '../examples/starter-story';
import {
  ProductPromo,
  productPromoSchema,
  productPromoDefaultProps,
  PRODUCT_PROMO_DURATION_FRAMES,
  PROMO_FPS,
  PRODUCT_PROMO_WIDTH,
  PRODUCT_PROMO_HEIGHT,
} from '../examples/aether-promo';
import {
  PaperDioramaDemo,
  paperDioramaDemoSchema,
  paperDioramaDefaultProps,
  PAPER_DIORAMA_DURATION_FRAMES,
  PAPER_DIORAMA_FPS,
  PAPER_DIORAMA_WIDTH,
  PAPER_DIORAMA_HEIGHT,
} from '../examples/paper-diorama';
import {
  IsometricDialogueDemo,
  isometricDialogueSchema,
  isometricDialogueDefaultProps,
  ISOMETRIC_DIALOGUE_DURATION_FRAMES,
  ISOMETRIC_DIALOGUE_FPS,
  ISOMETRIC_DIALOGUE_WIDTH,
  ISOMETRIC_DIALOGUE_HEIGHT,
} from '../examples/isometric-dialogue';
import {
  Tactile3DShowcase,
  tactile3dShowcaseSchema,
  tactile3dShowcaseDefaultProps,
  TACTILE_3D_SHOWCASE_DURATION_FRAMES,
  TACTILE_3D_SHOWCASE_FPS,
  TACTILE_3D_SHOWCASE_WIDTH,
  TACTILE_3D_SHOWCASE_HEIGHT,
} from '../examples/tactile-3d-showcase';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StarterStory"
        component={StarterStory}
        schema={starterStorySchema}
        defaultProps={starterStoryDefaultProps}
        durationInFrames={STARTER_STORY_DURATION_FRAMES}
        fps={STARTER_STORY_FPS}
        width={STARTER_STORY_WIDTH}
        height={STARTER_STORY_HEIGHT}
      />
      <Composition
        id="StarterStoryVertical"
        component={StarterStoryVertical}
        schema={starterStoryVerticalSchema}
        defaultProps={starterStoryVerticalDefaultProps}
        durationInFrames={STARTER_STORY_DURATION_FRAMES}
        fps={STARTER_STORY_FPS}
        width={STARTER_STORY_VERTICAL_WIDTH}
        height={STARTER_STORY_VERTICAL_HEIGHT}
      />
      <Composition
        id="ProductPromo"
        component={ProductPromo}
        schema={productPromoSchema}
        defaultProps={productPromoDefaultProps}
        durationInFrames={PRODUCT_PROMO_DURATION_FRAMES}
        fps={PROMO_FPS}
        width={PRODUCT_PROMO_WIDTH}
        height={PRODUCT_PROMO_HEIGHT}
      />
      <Composition
        id="PaperDioramaDemo"
        component={PaperDioramaDemo}
        schema={paperDioramaDemoSchema}
        defaultProps={paperDioramaDefaultProps}
        durationInFrames={PAPER_DIORAMA_DURATION_FRAMES}
        fps={PAPER_DIORAMA_FPS}
        width={PAPER_DIORAMA_WIDTH}
        height={PAPER_DIORAMA_HEIGHT}
      />
      <Composition
        id="IsometricDialogueDemo"
        component={IsometricDialogueDemo}
        schema={isometricDialogueSchema}
        defaultProps={isometricDialogueDefaultProps}
        durationInFrames={ISOMETRIC_DIALOGUE_DURATION_FRAMES}
        fps={ISOMETRIC_DIALOGUE_FPS}
        width={ISOMETRIC_DIALOGUE_WIDTH}
        height={ISOMETRIC_DIALOGUE_HEIGHT}
      />
      <Composition
        id="Tactile3DShowcase"
        component={Tactile3DShowcase}
        schema={tactile3dShowcaseSchema}
        defaultProps={tactile3dShowcaseDefaultProps}
        durationInFrames={TACTILE_3D_SHOWCASE_DURATION_FRAMES}
        fps={TACTILE_3D_SHOWCASE_FPS}
        width={TACTILE_3D_SHOWCASE_WIDTH}
        height={TACTILE_3D_SHOWCASE_HEIGHT}
      />
      {/* [WAVE3] register StyleLab from @make-pictures/remotion/style-lab */}
    </>
  );
};
