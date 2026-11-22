import React, { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface SyncIblPanelSpec {
  id: string;
  form?: 'rect' | 'ring' | 'circle';
  color: string;
  intensity: number;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  target?: [number, number, number];
}

export interface SyncStudioIbl3DProps {
  panels: ReadonlyArray<SyncIblPanelSpec>;
  backgroundColor?: string;
  environmentIntensity?: number;
  blurSigma?: number;
}

export const DEFAULT_STUDIO_IBL_PANELS: ReadonlyArray<SyncIblPanelSpec> = [
  {
    id: 'warm-window-key',
    form: 'rect',
    color: '#FFF6E3',
    intensity: 4.0,
    position: [-4.2, 4.2, 2.8],
    scale: [7.5, 5.5, 1],
    target: [0, 0, 0],
  },
  {
    id: 'sky-cool-fill',
    form: 'rect',
    color: '#DFF0FF',
    intensity: 2.1,
    position: [5.2, 3.0, 2.2],
    scale: [8.5, 5.5, 1],
    target: [0, 0, 0],
  },
  {
    id: 'warm-rim',
    form: 'rect',
    color: '#FFE9C2',
    intensity: 2.5,
    position: [0.5, 3.6, -5.0],
    scale: [8.0, 4.0, 1],
    target: [0, 0, 0],
  },
  {
    id: 'bounce-floor',
    form: 'rect',
    color: '#EADBC0',
    intensity: 1.0,
    position: [0, -4.5, 0],
    scale: [16.0, 16.0, 1],
    target: [0, 0, 0],
  },
];

/**
 * Builds an offline HDR-emissive virtual studio scene for `THREE.PMREMGenerator.fromScene`.
 */
export function buildSyncIblEnvironmentScene(
  panels: ReadonlyArray<SyncIblPanelSpec>,
  backgroundColor = '#B8AE9D'
): { envScene: THREE.Scene; dispose: () => void } {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(backgroundColor);

  const disposables: Array<{ dispose: () => void }> = [];

  for (const panel of panels) {
    let geo: THREE.BufferGeometry;
    if (panel.form === 'circle') {
      geo = new THREE.CircleGeometry(0.5, 32);
    } else if (panel.form === 'ring') {
      geo = new THREE.RingGeometry(0.25, 0.5, 32);
    } else {
      geo = new THREE.PlaneGeometry(1, 1);
    }

    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(panel.color).multiplyScalar(
        Math.max(0, panel.intensity)
      ),
      toneMapped: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `sync-ibl-panel-${panel.id}`;
    mesh.position.set(panel.position[0], panel.position[1], panel.position[2]);
    mesh.scale.set(panel.scale[0], panel.scale[1], panel.scale[2]);
    if (panel.target) {
      mesh.lookAt(panel.target[0], panel.target[1], panel.target[2]);
    } else if (panel.rotation) {
      mesh.rotation.set(panel.rotation[0], panel.rotation[1], panel.rotation[2]);
    } else {
      mesh.lookAt(0, 0, 0);
    }

    envScene.add(mesh);
    disposables.push(geo, mat);
  }

  return {
    envScene,
    dispose: () => {
      for (const res of disposables) {
        res.dispose();
      }
    },
  };
}

/**
 * Generates an offline studio softbox IBL synchronously via `THREE.PMREMGenerator`
 * in `useLayoutEffect`, guaranteeing rich HDR specular highlights on Frame 1 under
 * `@remotion/three`'s `frameloop="never"` with zero network requests.
 */
export const SyncStudioIbl3D: React.FC<SyncStudioIbl3DProps> = ({
  panels,
  backgroundColor = '#B8AE9D',
  environmentIntensity = 1.0,
  blurSigma = 0.04,
}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);

  const panelsSignature = useMemo(
    () =>
      JSON.stringify({
        backgroundColor,
        blurSigma,
        panels,
      }),
    [panels, backgroundColor, blurSigma]
  );

  useLayoutEffect(() => {
    const { envScene, dispose } = buildSyncIblEnvironmentScene(
      panels,
      backgroundColor
    );
    const pmrem = new THREE.PMREMGenerator(gl);
    let renderTarget: THREE.WebGLRenderTarget;
    try {
      renderTarget = pmrem.fromScene(envScene, blurSigma);
    } catch (err) {
      pmrem.dispose();
      throw err;
    } finally {
      dispose();
    }

    const previousEnvironment = scene.environment;
    scene.environment = renderTarget.texture;
    invalidate();

    return () => {
      if (scene.environment === renderTarget.texture) {
        scene.environment = previousEnvironment;
      }
      renderTarget.dispose();
      pmrem.dispose();
      invalidate();
    };
  }, [gl, scene, invalidate, panelsSignature]);

  useLayoutEffect(() => {
    const targetScene = scene as THREE.Scene & { environmentIntensity?: number };
    targetScene.environmentIntensity = Math.max(0, environmentIntensity);
    invalidate();
  }, [scene, environmentIntensity, invalidate]);

  return null;
};
