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
import {
  getProceduralPbrMaps,
  type ProceduralPbrMaps,
  type ProceduralPbrMaterialKind,
} from './proceduralPbrMaps';
import {
  resolveSheetFinishProfile,
  type SheetFinishProfile,
  type SheetMaterialFinish,
} from './materialFinishes';

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
  finish?: SheetMaterialFinish;
  proceduralTexture?: ProceduralPbrMaterialKind | 'none';
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

export interface ResolvedDeformableSheetMaterialConfig {
  profile: SheetFinishProfile | null;
  proceduralKind: ProceduralPbrMaterialKind | undefined;
  frontBumpMap: THREE.Texture | null;
  frontRoughnessMap: THREE.Texture | null;
  backBumpMap: THREE.Texture | null;
  backRoughnessMap: THREE.Texture | null;
  frontRoughness: number;
  backRoughness: number;
  edgeRoughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  bumpScale: number;
  sheen: number;
  sheenRoughness: number;
  sheenColor: string | undefined;
  emissive: string | undefined;
  emissiveIntensity: number;
}

export function resolveDeformableSheetMaterialConfig(
  props: Pick<
    DeformableSheet3DProps,
    | 'finish'
    | 'proceduralTexture'
    | 'frontBumpMap'
    | 'frontRoughnessMap'
    | 'backBumpMap'
    | 'backRoughnessMap'
    | 'roughness'
    | 'metalness'
    | 'clearcoat'
    | 'clearcoatRoughness'
    | 'bumpScale'
  >,
  preloadedProcMaps?: ProceduralPbrMaps | null
): ResolvedDeformableSheetMaterialConfig {
  const profile = props.finish ? resolveSheetFinishProfile(props.finish) : null;
  const proceduralKind =
    props.proceduralTexture === 'none'
      ? undefined
      : (props.proceduralTexture ?? profile?.proceduralTexture);
  const procMaps =
    preloadedProcMaps !== undefined
      ? preloadedProcMaps
      : proceduralKind
        ? getProceduralPbrMaps(proceduralKind, { repeat: [2, 2.8] })
        : null;

  const frontBumpMap = props.frontBumpMap ?? procMaps?.bumpMap ?? null;
  const frontRoughnessMap =
    props.frontRoughnessMap ?? procMaps?.roughnessMap ?? null;
  const backBumpMap = props.backBumpMap ?? procMaps?.bumpMap ?? null;
  const backRoughnessMap =
    props.backRoughnessMap ?? procMaps?.roughnessMap ?? null;

  const frontRoughness =
    props.roughness ??
    (frontRoughnessMap
      ? (profile?.mappedRoughness ?? (props.frontRoughnessMap ? 1.0 : 0.92))
      : (profile?.roughness ?? 0.56));
  const backRoughness =
    props.roughness ??
    (backRoughnessMap
      ? (profile?.mappedRoughness ?? (props.backRoughnessMap ? 1.0 : 0.92))
      : (profile?.roughness ?? 0.56));
  const baseRoughnessForEdge = props.roughness ?? profile?.roughness ?? 0.56;

  return {
    profile,
    proceduralKind,
    frontBumpMap,
    frontRoughnessMap,
    backBumpMap,
    backRoughnessMap,
    frontRoughness,
    backRoughness,
    edgeRoughness: Math.min(1, baseRoughnessForEdge + 0.25),
    metalness: props.metalness ?? profile?.metalness ?? 0.0,
    clearcoat: props.clearcoat ?? profile?.clearcoat ?? 0.14,
    clearcoatRoughness:
      props.clearcoatRoughness ?? profile?.clearcoatRoughness ?? 0.32,
    bumpScale: props.bumpScale ?? profile?.bumpScale ?? 0.006,
    sheen: profile?.sheen ?? 0,
    sheenRoughness: profile?.sheenRoughness ?? 1.0,
    sheenColor: profile?.sheenColor,
    emissive:
      profile && profile.emissiveIntensity > 0 ? profile.emissive : undefined,
    emissiveIntensity: profile?.emissiveIntensity ?? 0,
  };
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
  finish,
  proceduralTexture,
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
  roughness,
  metalness,
  clearcoat,
  clearcoatRoughness,
  bumpScale,
  opacity = 1,
  castShadow = true,
  receiveShadow = true,
  cleanFrameZero = false,
}) => {
  const frame = useCurrentFrame();
  const style = useStudioStyle();

  const finishProfile = finish ? resolveSheetFinishProfile(finish) : null;
  const effectiveProcKind =
    proceduralTexture === 'none'
      ? undefined
      : (proceduralTexture ?? finishProfile?.proceduralTexture);
  const procMaps = useMemo(
    () =>
      effectiveProcKind
        ? getProceduralPbrMaps(effectiveProcKind, { repeat: [2, 2.8] })
        : null,
    [effectiveProcKind]
  );

  const materialConfig = resolveDeformableSheetMaterialConfig(
    {
      finish,
      proceduralTexture,
      frontBumpMap,
      frontRoughnessMap,
      backBumpMap,
      backRoughnessMap,
      roughness,
      metalness,
      clearcoat,
      clearcoatRoughness,
      bumpScale,
    },
    procMaps
  );

  const resolvedFrontColor =
    frontColor ??
    (frontMap
      ? '#FFFFFF'
      : (finishProfile?.baseColor ?? style.palette.bgSurface));
  const resolvedBackColor =
    backColor ??
    (backMap
      ? '#FFFFFF'
      : (finishProfile?.baseColor ?? style.palette.bgElevated));
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

    const sharedFinishOptions: Partial<THREE.MeshPhysicalMaterialParameters> = {
      sheen: materialConfig.sheen,
      sheenRoughness: materialConfig.sheenRoughness,
      ...(materialConfig.sheenColor
        ? { sheenColor: materialConfig.sheenColor }
        : {}),
      ...(materialConfig.emissive && materialConfig.emissiveIntensity > 0
        ? {
            emissive: materialConfig.emissive,
            emissiveIntensity: materialConfig.emissiveIntensity,
          }
        : {}),
    };

    const frontMat = new THREE.MeshPhysicalMaterial({
      color: resolvedFrontColor,
      map: frontMap ?? null,
      roughnessMap: materialConfig.frontRoughnessMap,
      metalnessMap: frontMetalnessMap ?? null,
      bumpMap: materialConfig.frontBumpMap,
      bumpScale: materialConfig.bumpScale,
      roughness: materialConfig.frontRoughness,
      metalness: frontMetalnessMap
        ? (metalness ?? 1.0)
        : materialConfig.metalness,
      clearcoat: materialConfig.clearcoat,
      clearcoatRoughness: materialConfig.clearcoatRoughness,
      transparent,
      opacity,
      ...sharedFinishOptions,
    });

    const backMat = new THREE.MeshPhysicalMaterial({
      color: resolvedBackColor,
      map: backMap ?? null,
      roughnessMap: materialConfig.backRoughnessMap,
      metalnessMap: backMetalnessMap ?? null,
      bumpMap: materialConfig.backBumpMap,
      bumpScale: materialConfig.bumpScale,
      roughness: materialConfig.backRoughness,
      metalness: backMetalnessMap
        ? (metalness ?? 1.0)
        : materialConfig.metalness,
      clearcoat: materialConfig.clearcoat,
      clearcoatRoughness: materialConfig.clearcoatRoughness,
      transparent,
      opacity,
      ...sharedFinishOptions,
    });

    const edgeMat = new THREE.MeshPhysicalMaterial({
      color: resolvedEdgeColor,
      map: edgeMap ?? null,
      roughness: materialConfig.edgeRoughness,
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
    materialConfig.frontRoughnessMap,
    frontMetalnessMap,
    materialConfig.frontBumpMap,
    materialConfig.backRoughnessMap,
    backMetalnessMap,
    materialConfig.backBumpMap,
    edgeMap,
    materialConfig.frontRoughness,
    materialConfig.backRoughness,
    materialConfig.edgeRoughness,
    metalness,
    materialConfig.metalness,
    materialConfig.clearcoat,
    materialConfig.clearcoatRoughness,
    materialConfig.bumpScale,
    materialConfig.sheen,
    materialConfig.sheenRoughness,
    materialConfig.sheenColor,
    materialConfig.emissive,
    materialConfig.emissiveIntensity,
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
