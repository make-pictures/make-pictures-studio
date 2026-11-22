import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { evaluateCameraKeyframes3D } from '../../core/src/camera';
import * as tactile3d from '../../kits/src/tactile-3d';
import * as kitsRoot from '../../kits/src';
import {
  buildSheetGeometry,
  computeGridAtlasUvRect,
} from '../../kits/src/tactile-3d/sheetGeometry';
import {
  attachSheetBendShader,
  createBentSheetDepthMaterial,
  createSheetBendUniforms,
  updateSheetBendUniforms,
} from '../../kits/src/tactile-3d/sheetBendShader';
import {
  getCachedTexture3D,
  pruneTextureCache3D,
  scheduleCoalescedThreeAdvance,
} from '../../kits/src/tactile-3d/textureLoader3D';
import { DeformableSheet3D } from '../../kits/src/tactile-3d/DeformableSheet3D';
import {
  SCREEN_GLASS_SHADOW_OFFSET_Z,
  computeScreenGlassTransform,
  getGlassContactShadowTexture,
  ScreenGlassLayer3D,
  ScreenGlassSlot,
} from '../../kits/src/tactile-3d/ScreenGlassLayer3D';
import {
  buildSyncIblEnvironmentScene,
  SyncStudioIbl3D,
} from '../../kits/src/tactile-3d/SyncStudioIbl3D';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('buildSheetGeometry builds 3 material groups, valid normals/UVs, non-degenerate triangles, bleed inset, and mirrored back face', () => {
  const geo = buildSheetGeometry({
    width: 1.0,
    height: 1.4,
    thickness: 0.02,
    cornerRadius: 0.08,
    segX: 8,
    segY: 12,
    bleedInsetUv: 0.02,
  });

  assert.equal(
    geo.groups.length,
    3,
    'Expected front (0), back (1), and edge (2) material groups'
  );
  assert.deepEqual(
    geo.groups.map((g) => g.materialIndex),
    [0, 1, 2]
  );

  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const norm = geo.getAttribute('normal');
  const idx = geo.getIndex()!;
  assert.ok(pos.count > 100);

  for (let i = 0; i < pos.count; i++) {
    assert.ok(
      Number.isFinite(pos.getX(i)) &&
        Number.isFinite(pos.getY(i)) &&
        Number.isFinite(pos.getZ(i))
    );
    assert.ok(
      Number.isFinite(norm.getX(i)) &&
        Number.isFinite(norm.getY(i)) &&
        Number.isFinite(norm.getZ(i))
    );
  }

  // Zero degenerate triangles
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    cross.crossVectors(ab, ac);
    assert.ok(
      cross.length() > 1e-8,
      `Degenerate triangle at index ${i}`
    );
  }

  // Front group UVs respect bleedInsetUv [0.02, 0.98]
  const frontEnd = geo.groups[0].start + geo.groups[0].count;
  let minU = Infinity;
  let maxU = -Infinity;
  for (let i = geo.groups[0].start; i < frontEnd; i++) {
    const u = uv.getX(idx.getX(i));
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
  }
  assert.ok(minU >= 0.019 && maxU <= 0.981);

  // Back group has -Z normals and horizontally mirrored UVs (x > 0 => u < 0.5)
  const backEnd = geo.groups[1].start + geo.groups[1].count;
  let checkedBackPosX = false;
  for (let i = geo.groups[1].start; i < backEnd; i++) {
    const vIdx = idx.getX(i);
    assert.equal(norm.getZ(vIdx), -1);
    if (pos.getX(vIdx) > 0.25) {
      assert.ok(uv.getX(vIdx) < 0.5, 'Back face UVs must be horizontally mirrored');
      checkedBackPosX = true;
    }
  }
  assert.equal(checkedBackPosX, true);

  geo.dispose();

  // Sharp-corner mode also builds 3 material groups cleanly
  const sharp = buildSheetGeometry({
    width: 1.0,
    height: 1.0,
    cornerRadius: 0,
    uvCropX: [0.2, 0.8],
    uvCropY: [0.1, 0.9],
  });
  assert.equal(sharp.groups.length, 3);
  sharp.dispose();
});

test('computeGridAtlasUvRect computes flipY-compatible grid slot UVs and rejects out-of-range slots', () => {
  const topLeft = computeGridAtlasUvRect({
    slot: 0,
    cols: 4,
    rows: 2,
    bleedInsetUv: 0,
  });
  assert.ok(Math.abs(topLeft.uMin - 0) < 1e-6);
  assert.ok(Math.abs(topLeft.uMax - 0.25) < 1e-6);
  assert.ok(Math.abs(topLeft.vMin - 0.5) < 1e-6);
  assert.ok(Math.abs(topLeft.vMax - 1.0) < 1e-6);

  const bottomRight = computeGridAtlasUvRect({
    slot: 7,
    cols: 4,
    rows: 2,
    bleedInsetUv: 0,
  });
  assert.ok(Math.abs(bottomRight.uMin - 0.75) < 1e-6);
  assert.ok(Math.abs(bottomRight.uMax - 1.0) < 1e-6);
  assert.ok(Math.abs(bottomRight.vMin - 0.0) < 1e-6);
  assert.ok(Math.abs(bottomRight.vMax - 0.5) < 1e-6);

  assert.throws(
    () => computeGridAtlasUvRect({ slot: 8, cols: 4, rows: 2 }),
    RangeError
  );
  assert.throws(
    () => computeGridAtlasUvRect({ slot: -1, cols: 4, rows: 2 }),
    RangeError
  );
});

test('attachSheetBendShader is idempotent, chains cache key, injects normal+vertex GLSL, and powers depth material', () => {
  const uniforms = createSheetBendUniforms(0.5, 0.7);
  updateSheetBendUniforms(
    uniforms,
    { bendY: 0.35, twist: -0.2, cornerWhip: 0.1 },
    0.6,
    0.8
  );
  assert.equal(uniforms.uBendY.value, 0.35);
  assert.equal(uniforms.uTwist.value, -0.2);
  assert.equal(uniforms.uCornerWhip.value, 0.1);
  assert.equal(uniforms.uSheetHalfSize.value.x, 0.6);
  assert.equal(uniforms.uSheetHalfSize.value.y, 0.8);

  const mat = new THREE.MeshPhysicalMaterial();
  let priorHookCalled = false;
  mat.customProgramCacheKey = () => 'custom-base';
  mat.onBeforeCompile = () => {
    priorHookCalled = true;
  };

  attachSheetBendShader(mat, uniforms);
  attachSheetBendShader(mat, uniforms); // idempotent second call
  assert.equal(mat.customProgramCacheKey(), 'custom-base|sheet-bend-v1');

  const fakeShader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader:
      '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',
    fragmentShader: '',
  };
  mat.onBeforeCompile(fakeShader as never, {} as never);
  assert.equal(priorHookCalled, true);
  assert.equal(fakeShader.uniforms.uBendY, uniforms.uBendY);
  assert.match(fakeShader.vertexShader, /applySheetDeform/);
  assert.match(fakeShader.vertexShader, /cross\(dPdu, dPdv\)/);

  const depthMat = createBentSheetDepthMaterial(uniforms);
  assert.equal(depthMat.depthPacking, THREE.RGBADepthPacking);
  assert.equal(depthMat.customProgramCacheKey(), 'sheet-bend-v1');

  mat.dispose();
  depthMat.dispose();
});

test('textureLoader3D cache lookup, prune, and coalesced advance behave deterministically', async () => {
  assert.equal(getCachedTexture3D('non-existent-texture.png'), null);
  assert.equal(typeof pruneTextureCache3D(128), 'number');

  let calls = 0;
  const bump = () => {
    calls += 1;
  };
  scheduleCoalescedThreeAdvance(bump);
  scheduleCoalescedThreeAdvance(bump);
  scheduleCoalescedThreeAdvance(bump);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(
    calls,
    1,
    'Multiple scheduleCoalescedThreeAdvance calls within one tick must coalesce into 1'
  );
});

test('DeformableSheet3D exports component and obeys disposal & determinism invariants', () => {
  assert.equal(typeof DeformableSheet3D, 'function');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/tactile-3d/DeformableSheet3D.tsx'),
    'utf8'
  );
  assert.doesNotMatch(src, /Math\.random\s*\(/);
  assert.match(src, /customDepthMaterial/);
  assert.match(src, /geometry\.dispose\(\)/);
  assert.match(src, /m\.dispose\(\)/);
  assert.match(src, /depthMat\.dispose\(\)/);
});

test('computeScreenGlassTransform aligns plane quaternion with camera basis and getGlassContactShadowTexture produces valid SDF RGBA data', () => {
  assert.equal(SCREEN_GLASS_SHADOW_OFFSET_Z, -0.075);
  assert.equal(typeof ScreenGlassLayer3D, 'function');
  assert.equal(typeof ScreenGlassSlot, 'function');

  const cam = evaluateCameraKeyframes3D(
    0,
    [{ fromFrame: 0, position: [0, 0, 5], target: [0, 0, 0], fov: 40 }],
    [],
    0
  );
  const tf = computeScreenGlassTransform(cam, 2.2, 16 / 9);
  assert.ok(Math.abs(tf.position[2] - 2.8) < 1e-6);
  const qLen = Math.hypot(...tf.quaternion);
  assert.ok(Math.abs(qLen - 1) < 1e-6);

  const tex = getGlassContactShadowTexture();
  assert.equal(
    getGlassContactShadowTexture(),
    tex,
    'SDF shadow texture must be cached'
  );
  const data = (tex.image as { data?: Uint8Array }).data;
  if (data) {
    // Center pixel has high shadow alpha, corner pixel fades to 0
    const centerAlpha = data[(128 * 256 + 128) * 4 + 3];
    const cornerAlpha = data[3];
    assert.ok(
      centerAlpha > 150,
      `Expected opaque shadow center, got ${centerAlpha}`
    );
    assert.equal(cornerAlpha, 0, 'Expected transparent shadow corners');
  }
});

test('buildSyncIblEnvironmentScene builds offline emissive lightformer meshes and disposes cleanly', () => {
  const { envScene, dispose } = buildSyncIblEnvironmentScene(
    [
      {
        id: 'key',
        form: 'rect',
        color: '#FFF6E3',
        intensity: 3.5,
        position: [-4, 4, 3],
        scale: [6, 4, 1],
        target: [0, 0, 0],
      },
      {
        id: 'rim',
        form: 'ring',
        color: '#DFF0FF',
        intensity: 2.0,
        position: [4, 3, -3],
        scale: [3, 3, 1],
      },
      {
        id: 'overhead',
        form: 'circle',
        color: '#FFFFFF',
        intensity: 1.5,
        position: [0, 6, 0],
        scale: [4, 4, 1],
        rotation: [Math.PI / 2, 0, 0],
      },
    ],
    '#B8AE9D'
  );

  assert.equal(envScene.children.length, 3);
  const firstMesh = envScene.children[0] as THREE.Mesh;
  assert.ok(firstMesh.isMesh);
  const mat = firstMesh.material as THREE.MeshBasicMaterial;
  assert.equal(mat.toneMapped, false);
  assert.equal(mat.side, THREE.DoubleSide);
  dispose();
});

test('SyncStudioIbl3D uses synchronous PMREMGenerator with zero remote HDR URLs and exports from kits root', () => {
  assert.equal(typeof SyncStudioIbl3D, 'function');
  assert.equal(tactile3d.SyncStudioIbl3D, SyncStudioIbl3D);
  assert.equal(kitsRoot.SyncStudioIbl3D, SyncStudioIbl3D);
  assert.equal(kitsRoot.DeformableSheet3D, tactile3d.DeformableSheet3D);
  assert.equal(kitsRoot.ScreenGlassLayer3D, tactile3d.ScreenGlassLayer3D);

  const iblSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/tactile-3d/SyncStudioIbl3D.tsx'),
    'utf8'
  );
  assert.match(iblSrc, /PMREMGenerator/);
  assert.match(iblSrc, /useLayoutEffect/);
  assert.match(iblSrc, /pmrem\.dispose\(\)/);
  assert.match(iblSrc, /renderTarget\.dispose\(\)/);
  assert.doesNotMatch(iblSrc, /https?:\/\/|\.hdr\b|\.exr\b/i);
  assert.doesNotMatch(iblSrc, /Math\.random\s*\(/);
});

test('tactile-3d module maintains domain-agnostic naming and zero Math.random across all source files', () => {
  const dir = path.resolve(__dirname, '../../kits/src/tactile-3d');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  assert.ok(files.length >= 7);
  for (const file of files) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.doesNotMatch(src, /Math\.random\s*\(/, `${file} must not call Math.random()`);
    assert.doesNotMatch(
      src,
      /\b(poker|tarot|blackjack|playingCard|suit|aceOfSpades)\b/i,
      `${file} must remain domain-agnostic`
    );
  }
});
