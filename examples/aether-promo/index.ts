import React from 'react';
import { defineProduction, type ProductionManifest } from '@make-pictures/core';
import {
  ArchitectureDemoScene,
  architectureDemoSchema,
  type ArchitectureDemoSceneProps,
} from '../../src/scenes/ArchitectureDemoScene';
import architectureDefaults from './ArchitectureDemo.props.json';
import productionJson from './production.json';
import { ProductPromo, productPromoSchema } from './ProductPromo';
import productPromoDefaults from './ProductPromo.props.json';
import {
  DEFAULT_PRODUCT_PROMO_TIMING,
  PRODUCT_PROMO_DURATION_FRAMES,
  PROMO_FPS,
} from './productPromoTiming';
import { VOICEOVER_MANIFEST } from './generated/audio-manifest';

export * from './ProductPromo';

const manifest = productionJson as unknown as ProductionManifest;

export const ArchitectureDemoStandalone: React.FC<
  ArchitectureDemoSceneProps
> = (props) =>
  React.createElement(ArchitectureDemoScene, { includeAudio: true, ...props });

export default defineProduction({
  id: 'aether-promo',
  origin: 'example',
  manifest,
  voiceoverManifest: VOICEOVER_MANIFEST,
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
      title: 'One Tap to Your Door',
      subtitle: '4-Act Product Launch • Phone, Flow Diagram & Live Sync',
      group: 'Systems & Multi-Scene Promo',
      kit: 'motion-diagrams-2d',
      fps: PROMO_FPS,
      width: 1920,
      height: 1080,
      durationInFrames: PRODUCT_PROMO_DURATION_FRAMES,
      usesThree: false,
      hasMusicScore: true,
      propsFile: 'examples/aether-promo/ProductPromo.props.json',
      sceneTimeline: [...DEFAULT_PRODUCT_PROMO_TIMING.voTimeline],
      cameraTimeline: [...DEFAULT_PRODUCT_PROMO_TIMING.cameraTimeline],
      sfxTimeline: [...DEFAULT_PRODUCT_PROMO_TIMING.sfxTimeline],
      component: ProductPromo,
      schema: productPromoSchema,
      defaultProps: { ...productPromoDefaults },
    },
  ],
});
