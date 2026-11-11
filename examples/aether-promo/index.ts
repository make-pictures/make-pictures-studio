import React from 'react';
import { defineProduction } from '@make-pictures/core';
import {
  ArchitectureDemoScene,
  architectureDemoSchema,
  type ArchitectureDemoSceneProps,
} from '../../src/scenes/ArchitectureDemoScene';
import architectureDefaults from './ArchitectureDemo.props.json';
import { ProductPromo, productPromoSchema } from './ProductPromo';
import productPromoDefaults from './ProductPromo.props.json';

export * from './ProductPromo';

export const ArchitectureDemoStandalone: React.FC<
  ArchitectureDemoSceneProps
> = (props) =>
  React.createElement(ArchitectureDemoScene, { includeAudio: true, ...props });

export default defineProduction({
  id: 'aether-promo',
  origin: 'example',
  compositions: [
    {
      id: 'ArchitectureDemo',
      title: 'Architecture Telemetry',
      subtitle: 'Bézier Packet Flow & Live Node Telemetry',
      group: 'Systems & Multi-Scene Promo',
      kit: 'motion-diagrams-2d',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 648,
      usesThree: false,
      propsFile: 'examples/aether-promo/ArchitectureDemo.props.json',
      sceneTimeline: [
        {
          sceneId: 'architecture-demo',
          fromFrame: 0,
          durationInFrames: 648,
          label: 'Architecture',
        },
      ],
      cameraTimeline: [
        { shotLabel: 'Ingress • Web Client', fromFrame: 0, durationInFrames: 142 },
        { shotLabel: 'Inference • AI Agent', fromFrame: 142, durationInFrames: 263 },
        { shotLabel: 'Commit • PostgreSQL', fromFrame: 405, durationInFrames: 243 },
      ],
      sfxTimeline: [
        { sfxId: 'whoosh', fromFrame: 46, label: 'Payload Dispatch', volume: 0.35 },
        { sfxId: 'pop', fromFrame: 142, label: 'Agent Arrival', volume: 0.44 },
        { sfxId: 'whoosh', fromFrame: 309, label: 'SQL Stream', volume: 0.35 },
        { sfxId: 'pop', fromFrame: 405, label: 'ACID Commit', volume: 0.44 },
      ],
      component: ArchitectureDemoStandalone,
      schema: architectureDemoSchema,
      defaultProps: architectureDefaults,
    },
    {
      id: 'ProductPromo',
      title: 'Product Promo (Full)',
      subtitle: 'Full 4-Scene Episode (Intro → UI → Arch → Outro)',
      group: 'Systems & Multi-Scene Promo',
      kit: 'motion-diagrams-2d',
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 1728,
      usesThree: false,
      propsFile: 'examples/aether-promo/ProductPromo.props.json',
      sceneTimeline: [
        {
          sceneId: 'intro',
          fromFrame: 0,
          durationInFrames: 372,
          label: '1. Intro',
        },
        {
          sceneId: 'ui-showcase',
          fromFrame: 372,
          durationInFrames: 372,
          label: '2. UI Showcase',
        },
        {
          sceneId: 'architecture-demo',
          fromFrame: 744,
          durationInFrames: 648,
          label: '3. Architecture',
        },
        {
          sceneId: 'outro',
          fromFrame: 1392,
          durationInFrames: 336,
          label: '4. Outro',
        },
      ],
      cameraTimeline: [
        { shotLabel: 'Scene 1 • Hero Reveal', fromFrame: 0, durationInFrames: 372 },
        { shotLabel: 'Scene 2 • UI Telemetry', fromFrame: 372, durationInFrames: 372 },
        { shotLabel: 'Scene 3 • Architecture Flow', fromFrame: 744, durationInFrames: 648 },
        { shotLabel: 'Scene 4 • Closing CTA', fromFrame: 1392, durationInFrames: 336 },
      ],
      sfxTimeline: [
        { sfxId: 'whoosh', fromFrame: 790, label: 'Payload Dispatch', volume: 0.35 },
        { sfxId: 'pop', fromFrame: 886, label: 'Agent Arrival', volume: 0.44 },
        { sfxId: 'whoosh', fromFrame: 1053, label: 'SQL Stream', volume: 0.35 },
        { sfxId: 'pop', fromFrame: 1149, label: 'ACID Commit', volume: 0.44 },
      ],
      component: ProductPromo,
      schema: productPromoSchema,
      defaultProps: productPromoDefaults,
    },
  ],
});
