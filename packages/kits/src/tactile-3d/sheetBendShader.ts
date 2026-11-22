import * as THREE from 'three';
import type { SheetDeformParams } from '../../../core/src/kinematics';

export interface SheetBendUniforms {
  uBendX: { value: number };
  uBendY: { value: number };
  uTwist: { value: number };
  uCornerWhip: { value: number };
  uVelocityStretch: { value: number };
  uSheetHalfSize: { value: THREE.Vector2 };
}

export const SHEET_BEND_GLSL_DECLARATIONS = /* glsl */ `
uniform float uBendX;
uniform float uBendY;
uniform float uTwist;
uniform float uCornerWhip;
uniform float uVelocityStretch;
uniform vec2 uSheetHalfSize;

vec3 applySheetDeform(vec3 p, vec2 halfSize) {
  vec2 n = p.xy / max(halfSize, vec2(0.0001));
  float stretch = 1.0 + uVelocityStretch;
  vec3 outP = p;
  outP.y *= stretch;
  outP.x /= sqrt(max(stretch, 0.0001));
  float zBend =
    uBendY * (n.y * n.y - 0.33) * halfSize.y * 0.55 +
    uBendX * (n.x * n.x - 0.33) * halfSize.x * 0.55 +
    uTwist * (n.x * n.y) * halfSize.x * 0.65 +
    uCornerWhip * (n.x * n.x * n.y * n.y) * halfSize.y * 0.85;
  outP.z += zBend;
  return outP;
}
`;

const SHEET_BEND_NORMAL_GLSL = /* glsl */ `
#include <beginnormal_vertex>
{
  vec3 helperAxis = abs(objectNormal.z) > 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 tangentU = normalize(cross(helperAxis, objectNormal));
  vec3 tangentV = cross(objectNormal, tangentU);
  float deformEps = 0.005;
  vec3 dPdu = applySheetDeform(position + tangentU * deformEps, uSheetHalfSize)
            - applySheetDeform(position - tangentU * deformEps, uSheetHalfSize);
  vec3 dPdv = applySheetDeform(position + tangentV * deformEps, uSheetHalfSize)
            - applySheetDeform(position - tangentV * deformEps, uSheetHalfSize);
  vec3 deformedNormal = cross(dPdu, dPdv);
  float normLen = length(deformedNormal);
  if (normLen > 1e-6) {
    objectNormal = deformedNormal / normLen;
  }
}
`;

const SHEET_BEND_VERTEX_GLSL = /* glsl */ `
#include <begin_vertex>
transformed = applySheetDeform(transformed, uSheetHalfSize);
`;

export function createSheetBendUniforms(
  halfWidth = 0.5,
  halfHeight = 0.7
): SheetBendUniforms {
  return {
    uBendX: { value: 0 },
    uBendY: { value: 0 },
    uTwist: { value: 0 },
    uCornerWhip: { value: 0 },
    uVelocityStretch: { value: 0 },
    uSheetHalfSize: { value: new THREE.Vector2(halfWidth, halfHeight) },
  };
}

export function updateSheetBendUniforms(
  uniforms: SheetBendUniforms,
  deform: Partial<SheetDeformParams>,
  halfWidth?: number,
  halfHeight?: number
): void {
  uniforms.uBendX.value = deform.bendX ?? 0;
  uniforms.uBendY.value = deform.bendY ?? 0;
  uniforms.uTwist.value = deform.twist ?? 0;
  uniforms.uCornerWhip.value = deform.cornerWhip ?? 0;
  uniforms.uVelocityStretch.value = deform.velocityStretch ?? 0;
  if (halfWidth !== undefined && halfHeight !== undefined) {
    uniforms.uSheetHalfSize.value.set(halfWidth, halfHeight);
  }
}

/**
 * Injects GPU sheet-bend vertex deformation + finite-difference normal recalculation
 * into any Three.js material (`MeshPhysicalMaterial`, `MeshStandardMaterial`, `MeshDepthMaterial`),
 * chaining any prior `onBeforeCompile` and isolating `customProgramCacheKey`.
 */
export function attachSheetBendShader(
  material: THREE.Material,
  uniforms: SheetBendUniforms
): void {
  if (material.userData.__sheetBendAttached) {
    return;
  }
  material.userData.__sheetBendAttached = true;

  const prevOnBeforeCompile =
    typeof material.onBeforeCompile === 'function' &&
    material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
      ? material.onBeforeCompile
      : null;
  const prevCacheKey =
    typeof material.customProgramCacheKey === 'function' &&
    material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey
      ? material.customProgramCacheKey
      : null;

  material.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(material) : '';
    return base ? `${base}|sheet-bend-v1` : 'sheet-bend-v1';
  };

  material.onBeforeCompile = (
    parameters: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
  ) => {
    if (prevOnBeforeCompile) {
      prevOnBeforeCompile.call(material, parameters, renderer);
    }

    parameters.uniforms.uBendX = uniforms.uBendX;
    parameters.uniforms.uBendY = uniforms.uBendY;
    parameters.uniforms.uTwist = uniforms.uTwist;
    parameters.uniforms.uCornerWhip = uniforms.uCornerWhip;
    parameters.uniforms.uVelocityStretch = uniforms.uVelocityStretch;
    parameters.uniforms.uSheetHalfSize = uniforms.uSheetHalfSize;

    parameters.vertexShader = parameters.vertexShader
      .replace('#include <common>', `#include <common>\n${SHEET_BEND_GLSL_DECLARATIONS}`)
      .replace('#include <beginnormal_vertex>', SHEET_BEND_NORMAL_GLSL)
      .replace('#include <begin_vertex>', SHEET_BEND_VERTEX_GLSL);
  };

  material.needsUpdate = true;
}

/**
 * Creates a `MeshDepthMaterial` sharing the exact GPU deformation uniforms so
 * bent sheets cast true curved shadows onto receiving surfaces.
 */
export function createBentSheetDepthMaterial(
  uniforms: SheetBendUniforms
): THREE.MeshDepthMaterial {
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  });
  attachSheetBendShader(depthMaterial, uniforms);
  return depthMaterial;
}
