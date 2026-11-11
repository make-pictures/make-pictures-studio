import React, { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface PaperCameraRig3DProps {
  cameraPos: [number, number, number];
  lookAt: [number, number, number];
  fov?: number;
}

export const PaperCameraRig3D: React.FC<PaperCameraRig3DProps> = ({
  cameraPos,
  lookAt,
  fov = 34,
}) => {
  const camera = useThree((state) => state.camera);
  const [camX, camY, camZ] = cameraPos;
  const [lookX, lookY, lookZ] = lookAt;

  useLayoutEffect(() => {
    camera.position.set(camX, camY, camZ);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
    }
    camera.lookAt(lookX, lookY, lookZ);
    camera.updateProjectionMatrix();
  }, [camera, camX, camY, camZ, lookX, lookY, lookZ, fov]);

  return null;
};

export interface PaperStageLighting3DProps {
  preset?: 'daylight' | 'golden-hour' | 'indoor-study' | 'spotlight';
  sunPosition?: [number, number, number];
}

export const PaperStageLighting3D: React.FC<PaperStageLighting3DProps> = ({
  preset = 'daylight',
  sunPosition,
}) => {
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.06;
  }, [gl]);

  let sunColor = '#FFF5E4';
  let sunIntensity = 1.95;
  let ambientIntensity = 0.68;
  const sunPos: [number, number, number] = sunPosition ?? [-7.5, 11.5, 8.5];

  if (preset === 'golden-hour') {
    sunColor = '#FDE68A';
    sunIntensity = 1.85;
    ambientIntensity = 0.58;
  } else if (preset === 'indoor-study') {
    sunColor = '#FEF3C7';
    sunIntensity = 1.65;
    ambientIntensity = 0.56;
  } else if (preset === 'spotlight') {
    sunColor = '#F8FAFC';
    sunIntensity = 1.35;
    ambientIntensity = 0.45;
  }

  return (
    <>
      <hemisphereLight args={['#FFFDF9', '#92400E', ambientIntensity]} />

      <directionalLight
        position={sunPos}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={38}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={12}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />

      <directionalLight
        position={[9, 6, -4]}
        intensity={0.55}
        color="#FDE68A"
      />
    </>
  );
};
