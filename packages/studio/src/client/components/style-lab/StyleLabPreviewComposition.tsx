import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import {
  ScenicBackdropLayers,
  StageLightingRig,
  StyleProvider,
} from '@make-pictures/core';
import { DataStorytellingPreview } from './DataStorytellingPreview';
import { EditorialCollagePreview } from './EditorialCollagePreview';
import { Isometric3DPreview } from './Isometric3DPreview';
import { KineticTypographyPreview } from './KineticTypographyPreview';
import { MotionDiagramsPreview } from './MotionDiagramsPreview';
import { PaperDiorama3DPreview } from './PaperDiorama3DPreview';
import { VectorScene2DPreview } from './VectorScene2DPreview';
import type { StyleLabCompositionProps } from './styleLabTypes';

export const StyleLabPreviewComposition: React.FC<StyleLabCompositionProps> = ({
  style,
  kit,
}) => {
  const frame = useCurrentFrame();
  const usesOpticalStage =
    kit === 'editorial-collage' ||
    kit === 'kinetic-typography' ||
    kit === 'vector-scene-2d' ||
    kit === 'data-storytelling' ||
    kit === 'motion-diagrams-2d' ||
    kit === 'isometric-3d';

  // Deterministic handheld camera drift preview for kits not yet on OpticalStage2D
  const driftX =
    !usesOpticalStage && frame >= 2
      ? Math.sin(frame * 0.045) * style.motion.cameraHandheld * 22
      : 0;
  const driftY =
    !usesOpticalStage && frame >= 2
      ? Math.cos(frame * 0.035) * style.motion.cameraHandheld * 14
      : 0;

  return (
    <StyleProvider style={style} renderBackdrop>
      {frame >= 2 ? (
        <AbsoluteFill
          style={{
            transform:
              driftX !== 0 || driftY !== 0
                ? `translate(${driftX.toFixed(2)}px, ${driftY.toFixed(2)}px)`
                : undefined,
          }}
        >
          <ScenicBackdropLayers style={style} seed={`style-lab:${kit}`} />
          <StageLightingRig
            style={style}
            seed={`style-lab:${kit}`}
            renderBaseFill={false}
          />
          {kit === 'editorial-collage' && <EditorialCollagePreview />}
          {kit === 'vector-scene-2d' && <VectorScene2DPreview />}
          {kit === 'kinetic-typography' && <KineticTypographyPreview />}
          {kit === 'data-storytelling' && <DataStorytellingPreview />}
          {kit === 'motion-diagrams-2d' && <MotionDiagramsPreview />}
          {kit === 'paper-diorama-3d' && <PaperDiorama3DPreview />}
          {kit === 'isometric-3d' && <Isometric3DPreview />}
        </AbsoluteFill>
      ) : null}
    </StyleProvider>
  );
};
