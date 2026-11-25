export type MakePicturesElementDependency =
  | {
      readonly name: `@remotion/${string}`;
      readonly version: null;
    }
  | {
      readonly name: string;
      readonly version: string;
    };

export interface MakePicturesElementDimensions {
  readonly width: number;
  readonly height: number;
}

export interface MakePicturesElementSpec {
  readonly slug: string;
  readonly displayName: string;
  readonly description: string;
  readonly category:
    | 'editorial'
    | 'data'
    | 'product'
    | 'diagrams'
    | '3d'
    | 'audio';
  readonly space: '2d' | '2.5d' | '3d' | 'audio';
  readonly dimensions: MakePicturesElementDimensions | null;
  readonly durationInFrames: number;
  readonly dependencies: ReadonlyArray<MakePicturesElementDependency>;
  readonly sourceCode: string;
  readonly initialProps?: Readonly<
    Record<string, string | number | boolean | null>
  > | null;
}

export const REMOTION_ELEMENTS_CATALOG: ReadonlyArray<MakePicturesElementSpec> =
  [
    {
      slug: 'editorial-media-card',
      displayName: 'Editorial Media Card',
      description:
        'Archival editorial media plate with Ken Burns motion, die-cut mounts, and painterly fallback artwork.',
      category: 'editorial',
      space: '2d',
      dimensions: { width: 1920, height: 1080 },
      durationInFrames: 300,
      dependencies: [
        { name: '@make-pictures/remotion', version: '3.0.0' },
        { name: '@remotion/google-fonts', version: null },
      ],
      initialProps: {
        styleId: 'editorial-press',
        caption: 'First telemetry lock from lunar orbit',
        sourceTag: 'ARCHIVE 1970',
      },
      sourceCode: `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { StyleProvider } from '@make-pictures/remotion/style';
import { EditorialMediaCard } from '@make-pictures/remotion/kits/editorial-collage';

export interface EditorialMediaCardElementProps {
  styleId?: string;
  src?: string;
  caption?: string;
  sourceTag?: string;
}

export const EditorialMediaCardElement: React.FC<EditorialMediaCardElementProps> = ({
  styleId = 'editorial-press',
  src,
  caption = 'First telemetry lock from lunar orbit',
  sourceTag = 'ARCHIVE 1970',
}) => {
  return (
    <StyleProvider style={styleId} renderBackdrop>
      <AbsoluteFill
        style={{
          padding: 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: 980, boxSizing: 'border-box' }}>
          <EditorialMediaCard
            src={src}
            caption={caption}
            sourceTag={sourceTag}
            startFrame={2}
            durationInFrames={280}
          />
        </div>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`,
    },
    {
      slug: 'floating-editorial-display',
      displayName: 'Floating Editorial Display',
      description:
        'Frameless editorial typography overlay with Clean Frame 0 spring motion and 9:16 Golden Safe Box support.',
      category: 'editorial',
      space: '2d',
      dimensions: { width: 1920, height: 1080 },
      durationInFrames: 270,
      dependencies: [
        { name: '@make-pictures/remotion', version: '3.0.0' },
        { name: '@remotion/google-fonts', version: null },
      ],
      initialProps: {
        styleId: 'archival-chronicle',
        eyebrow: 'CHAPTER I',
        headline: 'Every frame obeys deterministic physics',
        subline: 'Frameless typography with zero dark web chrome over live motion stages.',
      },
      sourceCode: `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { StyleProvider } from '@make-pictures/remotion/style';
import { FloatingEditorialDisplay } from '@make-pictures/remotion/kits/editorial-collage';

export interface FloatingEditorialDisplayElementProps {
  styleId?: string;
  eyebrow?: string;
  headline?: string;
  subline?: string;
  align?: 'left' | 'center' | 'right';
}

export const FloatingEditorialDisplayElement: React.FC<FloatingEditorialDisplayElementProps> = ({
  styleId = 'archival-chronicle',
  eyebrow = 'CHAPTER I',
  headline = 'Every frame obeys deterministic physics',
  subline = 'Frameless typography with zero dark web chrome over live motion stages.',
  align = 'left',
}) => {
  return (
    <StyleProvider style={styleId} renderBackdrop>
      <AbsoluteFill>
        <FloatingEditorialDisplay
          eyebrow={eyebrow}
          headline={headline}
          subline={subline}
          align={align}
          position="center"
          enterFrame={2}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`,
    },
    {
      slug: 'animated-bar-race',
      displayName: 'Animated Bar Race',
      description:
        'Deterministic 60 FPS ranked bar chart with smooth cosine-kernel rank overtaking and editorial scale gridlines.',
      category: 'data',
      space: '2d',
      dimensions: { width: 1920, height: 1080 },
      durationInFrames: 300,
      dependencies: [
        { name: '@make-pictures/remotion', version: '3.0.0' },
        { name: '@remotion/google-fonts', version: null },
      ],
      initialProps: {
        styleId: 'minimal-product',
        title: 'Quarterly Adoption Momentum',
        subtitle: 'Normalized engagement score across creative workflows',
      },
      sourceCode: `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { StyleProvider } from '@make-pictures/remotion/style';
import { AnimatedBarRace } from '@make-pictures/remotion/kits/data-storytelling';

export interface AnimatedBarRaceElementProps {
  styleId?: string;
  title?: string;
  subtitle?: string;
}

const sampleItems = [
  {
    id: 'editorial',
    label: 'Editorial Essays',
    value: 94,
    keyframes: [
      { frame: 10, value: 52 },
      { frame: 140, value: 84 },
      { frame: 240, value: 94 },
    ],
  },
  {
    id: 'product',
    label: 'Product Launches',
    value: 86,
    keyframes: [
      { frame: 10, value: 68 },
      { frame: 140, value: 78 },
      { frame: 240, value: 86 },
    ],
  },
  {
    id: 'diagrams',
    label: 'System Diagrams',
    value: 79,
    keyframes: [
      { frame: 10, value: 44 },
      { frame: 140, value: 69 },
      { frame: 240, value: 79 },
    ],
  },
  {
    id: 'diorama',
    label: 'Paper Dioramas',
    value: 64,
    keyframes: [
      { frame: 10, value: 38 },
      { frame: 140, value: 55 },
      { frame: 240, value: 64 },
    ],
  },
];

export const AnimatedBarRaceElement: React.FC<AnimatedBarRaceElementProps> = ({
  styleId = 'minimal-product',
  title = 'Quarterly Adoption Momentum',
  subtitle = 'Normalized engagement score across creative workflows',
}) => {
  return (
    <StyleProvider style={styleId} renderBackdrop>
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 72,
          boxSizing: 'border-box',
        }}
      >
        <AnimatedBarRace
          title={title}
          subtitle={subtitle}
          items={sampleItems}
          valueSuffix="%"
          startFrame={2}
        />
      </AbsoluteFill>
    </StyleProvider>
  );
};
`,
    },
    {
      slug: 'product-browser-frame',
      displayName: 'Product Browser Frame',
      description:
        'Desktop browser chrome for SaaS screencasts and product walkthroughs with deterministic spring entrance.',
      category: 'product',
      space: '2d',
      dimensions: { width: 1920, height: 1080 },
      durationInFrames: 300,
      dependencies: [
        { name: '@make-pictures/remotion', version: '3.0.0' },
        { name: '@remotion/google-fonts', version: null },
      ],
      initialProps: {
        styleId: 'glass-studio',
        url: 'app.make.pictures/studio',
        title: 'Workspace Preview',
      },
      sourceCode: `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { StyleProvider } from '@make-pictures/remotion/style';
import { BrowserFrame } from '@make-pictures/remotion/kits/product-frames';

export interface ProductBrowserFrameElementProps {
  styleId?: string;
  url?: string;
  title?: string;
  videoSrc?: string;
  imageSrc?: string;
}

export const ProductBrowserFrameElement: React.FC<ProductBrowserFrameElementProps> = ({
  styleId = 'glass-studio',
  url = 'app.make.pictures/studio',
  title = 'Workspace Preview',
  videoSrc,
  imageSrc,
}) => {
  return (
    <StyleProvider style={styleId} renderBackdrop>
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 64,
          boxSizing: 'border-box',
        }}
      >
        <BrowserFrame
          url={url}
          title={title}
          videoSrc={videoSrc}
          imageSrc={imageSrc}
          variant="macos"
          width={1420}
          enterFrame={2}
        >
          {!videoSrc && !imageSrc ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                padding: 48,
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 700 }}>
                Drop your product screencast here
              </div>
              <div style={{ fontSize: 22, opacity: 0.72 }}>
                Pass videoSrc or imageSrc to render inside the animated browser stage.
              </div>
            </div>
          ) : null}
        </BrowserFrame>
      </AbsoluteFill>
    </StyleProvider>
  );
};
`,
    },
    {
      slug: 'motion-diagram-stage',
      displayName: 'Motion Diagram Stage',
      description:
        '2D camera-directed architecture stage with tactile system nodes and single-source cubic Bezier flow edges.',
      category: 'diagrams',
      space: '2d',
      dimensions: { width: 1920, height: 1080 },
      durationInFrames: 300,
      dependencies: [
        { name: '@make-pictures/remotion', version: '3.0.0' },
        { name: '@remotion/google-fonts', version: null },
      ],
      initialProps: {
        styleId: 'cyber-telemetry',
        sourceTitle: 'Script & Voiceover',
        targetTitle: 'Mastered Video',
      },
      sourceCode: `import React from 'react';
import { StyleProvider } from '@make-pictures/remotion/style';
import {
  DataFlowEdge,
  MotionDiagramStage2D,
  SystemNode,
} from '@make-pictures/remotion/kits/motion-diagrams-2d';

export interface MotionDiagramStageElementProps {
  styleId?: string;
  sourceTitle?: string;
  targetTitle?: string;
}

const nodeGeometry = {
  source: { cx: 580, cy: 540, w: 380, h: 210 },
  target: { cx: 1340, cy: 540, w: 380, h: 210 },
};

export const MotionDiagramStageElement: React.FC<MotionDiagramStageElementProps> = ({
  styleId = 'cyber-telemetry',
  sourceTitle = 'Script & Voiceover',
  targetTitle = 'Mastered Video',
}) => {
  return (
    <StyleProvider style={styleId} renderBackdrop>
      <MotionDiagramStage2D
        nodes={nodeGeometry}
        shots={[
          { fromFrame: 0, target: ['source', 'target'], padding: 180 },
          { fromFrame: 90, target: 'source', padding: 240 },
          { fromFrame: 180, target: 'target', padding: 240 },
        ]}
      >
        <DataFlowEdge
          id="pipeline-edge"
          from={{ x: 770, y: 540 }}
          to={{ x: 1150, y: 540 }}
          curveOffsetY={-64}
          drawStartFrame={12}
          flowStartFrame={36}
          flowEndFrame={280}
          packetCount={1}
          label="Sync & Mix"
        />
        <SystemNode
          id="source"
          title={sourceTitle}
          subtitle="Structured timing and natural narration cues"
          statusText="Aligned"
          x={580}
          y={540}
          width={380}
          height={210}
          enterFrame={4}
          activeRanges={[[80, 175]]}
        />
        <SystemNode
          id="target"
          title={targetTitle}
          subtitle="Broadcast-ready frames and balanced sound"
          statusText="Ready"
          x={1340}
          y={540}
          width={380}
          height={210}
          enterFrame={10}
          activeRanges={[[175, 290]]}
        />
      </MotionDiagramStage2D>
    </StyleProvider>
  );
};
`,
    },
    {
      slug: 'paper-cutout-3d',
      displayName: 'Paper Cutout 3D Stage',
      description:
        '2.5D layered paper-cutout diorama stage with procedural die-cut borders, paper fiber grain, and soft shadows.',
      category: '3d',
      space: '2.5d',
      dimensions: { width: 1920, height: 1080 },
      durationInFrames: 300,
      dependencies: [
        { name: '@make-pictures/remotion', version: '3.0.0' },
        { name: '@remotion/three', version: null },
        { name: '@react-three/fiber', version: '9.8.2' },
        { name: 'three', version: '0.187.0' },
      ],
      initialProps: {
        styleId: 'tactile-craft',
        headline: 'Tactile Paper World',
      },
      sourceCode: `import React, { useCallback } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { StyleProvider } from '@make-pictures/remotion/style';
import {
  DioramaStage3D,
  PaperCameraRig3D,
  PaperCutout3D,
  PaperStageLighting3D,
  PopUpHinge3D,
} from '@make-pictures/remotion/kits/paper-diorama-3d';

export interface PaperCutout3DElementProps {
  styleId?: string;
  headline?: string;
}

export const PaperCutout3DElement: React.FC<PaperCutout3DElementProps> = ({
  styleId = 'tactile-craft',
  headline = 'Tactile Paper World',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const foldProgress =
    frame <= 0
      ? 0
      : spring({
          frame: frame - 2,
          fps,
          config: { damping: 200, stiffness: 120, mass: 1 },
        });

  const drawArch = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.roundRect(w * 0.16, h * 0.18, w * 0.68, h * 0.72, 36);
    ctx.fill();
    ctx.fillStyle = '#FFFDF7';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.44, w * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1F2937';
    ctx.font = '700 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(headline, w * 0.5, h * 0.76);
  }, [headline]);

  return (
    <StyleProvider style={styleId} renderBackdrop>
      <ThreeCanvas width={width} height={height} shadows>
        <PaperCameraRig3D cameraPos={[0, 3.6, 8.8]} lookAt={[0, 1.3, 0]} fov={34} />
        <PaperStageLighting3D preset="daylight" />
        <DioramaStage3D variant="minimal-plinth" surfacePattern="spotlight">
          <PopUpHinge3D foldProgress={foldProgress} position={[0, 0.02, 0]}>
            <PaperCutout3D
              cacheKey="flagship-paper-arch"
              cacheDeps={[headline]}
              width={4.6}
              height={3.6}
              draw={drawArch}
            />
          </PopUpHinge3D>
        </DioramaStage3D>
      </ThreeCanvas>
    </StyleProvider>
  );
};
`,
    },
    {
      slug: 'smart-music-bed',
      displayName: 'Smart Music Bed',
      description:
        'Broadcast-grade background music bed with lookahead sidechain auto-ducking under voiceover segments.',
      category: 'audio',
      space: 'audio',
      dimensions: null,
      durationInFrames: 360,
      dependencies: [
        { name: '@make-pictures/remotion', version: '3.0.0' },
        { name: '@remotion/media-utils', version: null },
      ],
      initialProps: {
        src: 'audio/score.mp3',
        baseVolume: 0.26,
        duckedVolume: 0.085,
        fadeInFrames: 30,
        fadeOutFrames: 90,
      },
      sourceCode: `import React from 'react';
import { staticFile } from 'remotion';
import { SmartMusicBed } from '@make-pictures/remotion/audio';

export interface SmartMusicBedElementProps {
  src?: string;
  baseVolume?: number;
  duckedVolume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

const defaultDialogueSegments = [
  { sceneId: 'scene-1', fromFrame: 42, durationInFrames: 210 },
];

export const SmartMusicBedElement: React.FC<SmartMusicBedElementProps> = ({
  src = 'audio/score.mp3',
  baseVolume = 0.26,
  duckedVolume = 0.085,
  fadeInFrames = 30,
  fadeOutFrames = 90,
}) => {
  const resolvedSrc =
    src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')
      ? src
      : staticFile(src);

  return (
    <SmartMusicBed
      src={resolvedSrc}
      dialogueSegments={defaultDialogueSegments}
      baseVolume={baseVolume}
      duckedVolume={duckedVolume}
      fadeInFrames={fadeInFrames}
      fadeOutFrames={fadeOutFrames}
    />
  );
};
`,
    },
  ];
