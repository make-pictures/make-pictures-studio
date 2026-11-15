export * from './CinematicLensOverlay';
export * from './ParticleField';
export * from './StagePostProcessing3D';
export * from './SceneTransition';
export {
  OpticalStage2D,
  DepthPlane,
  StageLightingRig,
  useOpticalStage,
  computeParallaxFactor,
  computeCircleOfConfusionPx,
  computePlaneAtmosphericOpacity,
  evaluateOpticalCamera2D,
  computeDirectionalShadowVector,
  getTactileSurfaceStyle,
  type OpticalShot2D,
  type OpticalStage2DProps,
  type DepthPlaneProps,
  type StageLightingRigProps,
  type TactileElevation,
  type TactileSurfaceOptions,
} from '@make-pictures/core';
