import React from 'react';
import { Composition } from 'remotion';
import { IsometricDialogueDemo } from './compositions/IsometricDialogueDemo';
import { PaperDioramaDemo } from './compositions/PaperDioramaDemo';
import { ProductPromo } from './compositions/ProductPromo';
import { StarterStory, StarterStoryVertical } from './compositions/StarterStory';
import { ArchitectureDemoScene } from './scenes/ArchitectureDemoScene';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ==================== STARTER TEMPLATES (16:9 & 9:16 @ 60 FPS — motion-diagrams-2d) ==================== */}
      <Composition
        id="StarterStory"
        component={StarterStory}
        durationInFrames={660}
        fps={60}
        width={1920}
        height={1080}
      />

      <Composition
        id="StarterStoryVertical"
        component={StarterStoryVertical}
        durationInFrames={660}
        fps={60}
        width={1080}
        height={1920}
      />

      {/* ==================== KIT 1 SHOWCASE: PAPER DIORAMA 3D (2.5D POP-UP BOOK) ==================== */}
      <Composition
        id="PaperDioramaDemo"
        component={PaperDioramaDemo}
        durationInFrames={660}
        fps={60}
        width={1920}
        height={1080}
      />

      {/* ==================== KIT 2 SHOWCASE: ISOMETRIC 3D STUDIO & CHARACTERS ==================== */}
      <Composition
        id="IsometricDialogueDemo"
        component={IsometricDialogueDemo}
        durationInFrames={880}
        fps={60}
        width={1920}
        height={1080}
      />

      {/* ==================== KIT 3 SHOWCASE: 2D MOTION DIAGRAMS & ARCHITECTURE ==================== */}
      <Composition
        id="ArchitectureDemo"
        component={() => <ArchitectureDemoScene includeAudio={true} />}
        durationInFrames={600}
        fps={60}
        width={1920}
        height={1080}
      />

      <Composition
        id="ProductPromo"
        component={ProductPromo}
        durationInFrames={1440}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};
