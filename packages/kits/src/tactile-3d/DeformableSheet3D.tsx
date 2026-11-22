import React, { useEffect, useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import {
  ZERO_SHEET_DEFORM,
  type SheetDeformParams,
  type Vec3,
} from '../../../core/src/kinematics';
import { useStudioStyle } from '../../../core/src/style';
import {
  buildSheetGeometry,
  type SheetUvRect,
} from './sheetGeometry';
import {
  attachSheetBendShader,
  createBentSheetDepthMaterial,
  createSheetBendUniforms,
  updateSheetBendUniforms,
} from './sheetBendShader';

export interface DeformableSheet3DProps {
  name?: string;
  position?: Vec3;
  rotation?: Vec3;
  quaternion?: [number, number, number, number];
  scale?: Vec3 | number;
  visible?: boolean;
  renderOrder?: number;
  width?: number;
  height?: number;
  thickness?: number;
  cornerRadius?: number;
  segX?: number;
  segY?: number;
  cornerSegments?: number;
  bleedInsetUv?: number;
  uvRect?: SheetUvRect;
  uvCropX?: [number, number];
  uvCropY?: [number, number];
  deform?: Partial<SheetDeformParams>;
  frontMap?: THREE.Texture | null;
  backMap?: THREE.Texture | null;
  frontRoughnessMap?: THREE.Texture | null;
  frontMetalnessMap?: THREE.Texture | null;
  frontBumpMap?: THREE.Texture | null;
  backRoughnessMap?: THREE.Texture | null;
  backMetalnessMap?: THREE.Texture | null;
  backBumpMap?: THREE.Texture | null;
  edgeMap?: THREE.Texture | null;
  frontColor?: string;
  backColor?: string;
  edgeColor?: string;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  bumpScale?: number;
  opacity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  cleanFrameZero?: boolean;
}

export const DeformableSheet3D: React.FC<DeformableSheet3DProps> = ({
  name,
  position = [0, 0, 0],
  rotation,
  quaternion,
  scale = 1,
  visible = true,
  renderOrder,
  width = 1.0,
  height = 1.4,
  thickness = 0.014,
  cornerRadius = 0.05,
  segX = 12,
  segY = 18,
  cornerSegments = 4,
  bleedInsetUv = 0,
  uvRect,
  uvCropX,
  uvCropY,
  deform = ZERO_SHEET_DEFORM,
  frontMap = null,
  backMap = null,
  frontRoughnessMap = null,
  frontMetalnessMap = null,
  frontBumpMap = null,
  backRoughnessMap = null,
  backMetalnessMap = null,
  backBumpMap = null,
  edgeMap = null,
  frontColor,
  backColor,
  edgeColor,
  roughness = 0.56,
  metalness = 0.0,
  clearcoat = 0.14,
  clearcoatRoughness = 0.32,
  bumpScale = 0.006,
  opacity = 1,
  castShadow = true,
  receiveShadow = true,
  cleanFrameZero = false,
}) => {
  const frame = useCurrentFrame();
  const style = useStudioStyle();

  const resolvedFrontColor =
    frontColor ?? (frontMap ? '#FFFFFF' : style.palette.bgSurface);
  const resolvedBackColor =
    backColor ?? (backMap ? '#FFFFFF' : style.palette.bgElevated);
  const resolvedEdgeColor = edgeColor ?? style.palette.bgElevated;

  const uniforms = useMemo(
    () => createSheetBendUniforms(width * 0.5, height * 0.5),
    []
  );

  // Synchronous per-frame uniform update (deterministic under Remotion frameloop="never")
  updateSheetBendUniforms(uniforms, deform, width * 0.5, height * 0.5);

  const uvRectKey = uvRect
    ? `${uvRect.uMin},${uvRect.uMax},${uvRect.vMin},${uvRect.vMax}`
    : '';
  const uvCropXKey = uvCropX ? `${uvCropX[0]},${uvCropX[1]}` : '';
  const uvCropYKey = uvCropY ? `${uvCropY[0]},${uvCropY[1]}` : '';

  const geometry = useMemo(
    () =>
      buildSheetGeometry({
        width,
        height,
        thickness,
        cornerRadius,
        segX,
        segY,
        cornerSegments,
        bleedInsetUv,
        uvRect,
        uvCropX,
        uvCropY,
      }),
    [
      width,
      height,
      thickness,
      cornerRadius,
      segX,
      segY,
      cornerSegments,
      bleedInsetUv,
      uvRectKey,
      uvCropXKey,
      uvCropYKey,
    ]
  );

  const materialBundle = useMemo(() => {
    const transparent = opacity < 0.999;

    const frontMat = new THREE.MeshPhysicalMaterial({
      color: resolvedFrontColor,
      map: frontMap ?? null,
      roughnessMap: frontRoughnessMap ?? null,
      metalnessMap: frontMetalnessMap ?? null,
      bumpMap: frontBumpMap ?? null,
      bumpScale,
      roughness: frontRoughnessMap ? 1.0 : roughness,
      metalness: frontMetalnessMap ? 1.0 : metalness,
      clearcoat,
      clearcoatRoughness,
      transparent,
      opacity,
    });

    const backMat = new THREE.MeshPhysicalMaterial({
      color: resolvedBackColor,
      map: backMap ?? null,
      roughnessMap: backRoughnessMap ?? null,
      metalnessMap: backMetalnessMap ?? null,
      bumpMap: backBumpMap ?? null,
      bumpScale,
      roughness: backRoughnessMap ? 1.0 : roughness,
      metalness: backMetalnessMap ? 1.0 : metalness,
      clearcoat,
      clearcoatRoughness,
      transparent,
      opacity,
    });

    const edgeMat = new THREE.MeshPhysicalMaterial({
      color: resolvedEdgeColor,
      map: edgeMap ?? null,
      roughness: Math.min(1, roughness + 0.25),
      metalness: 0,
      clearcoat: 0,
      transparent,
      opacity,
    });

    attachSheetBendShader(frontMat, uniforms);
    attachSheetBendShader(backMat, uniforms);
    attachSheetBendShader(edgeMat, uniforms);

    const depthMat = createBentSheetDepthMaterial(uniforms);

    return {
      materials: [frontMat, backMat, edgeMat] as [
        THREE.MeshPhysicalMaterial,
        THREE.MeshPhysicalMaterial,
        THREE.MeshPhysicalMaterial,
      ],
      depthMat,
    };
  }, [
    uniforms,
    resolvedFrontColor,
    resolvedBackColor,
    resolvedEdgeColor,
    frontMap,
    backMap,
    frontRoughnessMap,
    frontMetalnessMap,
    frontBumpMap,
    backRoughnessMap,
    backMetalnessMap,
    backBumpMap,
    edgeMap,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness,
    bumpScale,
    opacity,
  ]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      for (const m of materialBundle.materials) {
        m.dispose();
      }
      materialBundle.depthMat.dispose();
    };
  }, [materialBundle]);

  if (cleanFrameZero && frame <= 0) {
    return null;
  }

  return (
    <mesh
      name={name}
      position={position}
      rotation={quaternion ? undefined : rotation}
      quaternion={quaternion}
      scale={scale}
      visible={visible}
      renderOrder={renderOrder}
      geometry={geometry}
      material={materialBundle.materials}
      customDepthMaterial={materialBundle.depthMat}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
};
