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
import {
  DeformableSheet3D,
  resolveDeformableSheetMaterialConfig,
} from '../../kits/src/tactile-3d/DeformableSheet3D';
import {
  disposeProceduralPbrMaps,
  getProceduralPbrMaps,
  type ProceduralPbrMaterialKind,
} from '../../kits/src/tactile-3d/proceduralPbrMaps';
import {
  resolveSheetFinishProfile,
  SHEET_MATERIAL_FINISHES,
  type SheetMaterialFinish,
} from '../../kits/src/tactile-3d/materialFinishes';
import {
  DaylightArcRig3D,
  evaluateTimeOfDayLighting,
} from '../../kits/src/tactile-3d/DaylightArcRig3D';
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
  assert.ok(files.length >= 10);
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

function computeRgbaChannelVariance(tex: THREE.Texture): number {
  const data = (tex.image as { data?: Uint8Array } | undefined)?.data;
  assert.ok(data && data.length >= 16, 'Expected RGBA Uint8Array image data');
  let sum = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i]!;
  }
  const mean = sum / pixelCount;
  let sq = 0;
  for (let i = 0; i < data.length; i += 4) {
    const d = data[i]! - mean;
    sq += d * d;
  }
  return sq / pixelCount;
}

test('getProceduralPbrMaps generates deterministic sRGB/linear maps with non-zero variance, caching, and clean disposal', () => {
  disposeProceduralPbrMaps();

  const kinds: ProceduralPbrMaterialKind[] = [
    'linen-weave',
    'wood-grain',
    'cotton-paper',
    'brushed-metal',
  ];

  const snapshots = new Map<ProceduralPbrMaterialKind, Uint8Array>();

  for (const kind of kinds) {
    const maps = getProceduralPbrMaps(kind);
    const cached = getProceduralPbrMaps(kind);
    assert.equal(cached, maps, `Expected cache hit for ${kind}`);

    assert.equal(
      maps.map.colorSpace,
      THREE.SRGBColorSpace,
      `${kind} map must use SRGBColorSpace`
    );
    assert.equal(
      maps.bumpMap.colorSpace,
      THREE.NoColorSpace,
      `${kind} bumpMap must use NoColorSpace`
    );
    assert.equal(
      maps.roughnessMap.colorSpace,
      THREE.NoColorSpace,
      `${kind} roughnessMap must use NoColorSpace`
    );

    for (const [label, tex] of [
      ['map', maps.map],
      ['bumpMap', maps.bumpMap],
      ['roughnessMap', maps.roughnessMap],
    ] as const) {
      assert.equal(tex.wrapS, THREE.RepeatWrapping);
      assert.equal(tex.wrapT, THREE.RepeatWrapping);
      assert.equal(tex.anisotropy, 16);
      assert.equal(tex.minFilter, THREE.LinearMipmapLinearFilter);
      assert.equal(tex.magFilter, THREE.LinearFilter);
      const variance = computeRgbaChannelVariance(tex);
      assert.ok(
        variance > 1,
        `Expected non-zero pixel variance for ${kind}.${label}, got ${variance}`
      );
    }

    const raw = (maps.map.image as { data: Uint8Array }).data;
    snapshots.set(kind, new Uint8Array(raw));
  }

  // Wood-grain defaults to 512x256 and respects custom size
  const woodDefault = getProceduralPbrMaps('wood-grain');
  assert.equal((woodDefault.map.image as { width: number }).width, 512);
  assert.equal((woodDefault.map.image as { height: number }).height, 256);

  const woodSmall = getProceduralPbrMaps('wood-grain', { size: 128, repeat: [1, 1] });
  assert.equal((woodSmall.map.image as { width: number }).width, 128);
  assert.equal((woodSmall.map.image as { height: number }).height, 64);

  const disposedCount = disposeProceduralPbrMaps();
  assert.equal(disposedCount, 5, 'Expected 4 default kinds + 1 custom size entry disposed');
  assert.equal(disposeProceduralPbrMaps(), 0, 'Cache must be empty after disposal');

  // Re-generating with identical seed produces bit-exact identical RGBA pixels
  for (const kind of kinds) {
    const regenerated = getProceduralPbrMaps(kind);
    const raw = (regenerated.map.image as { data: Uint8Array }).data;
    assert.deepEqual(raw, snapshots.get(kind), `Deterministic regeneration failed for ${kind}`);
  }
  disposeProceduralPbrMaps();
});

test('SHEET_MATERIAL_FINISHES defines all 5 finishes and resolveSheetFinishProfile returns complete profiles', () => {
  const finishes: SheetMaterialFinish[] = [
    'parchment-matte',
    'woodblock-cotton',
    'linen-glaze',
    'cyanotype-blueprint',
    'xray-neon',
  ];
  assert.equal(Object.keys(SHEET_MATERIAL_FINISHES).length, 5);

  for (const finish of finishes) {
    const profile = resolveSheetFinishProfile(finish);
    assert.ok(profile, `Missing finish profile for ${finish}`);
    assert.ok(profile.roughness > 0 && profile.roughness <= 1);
    assert.ok(profile.mappedRoughness > 0 && profile.mappedRoughness <= 1);
    assert.ok(profile.metalness >= 0 && profile.metalness <= 1);
    assert.ok(profile.clearcoat >= 0 && profile.clearcoat <= 1);
    assert.ok(profile.clearcoatRoughness >= 0 && profile.clearcoatRoughness <= 1);
    assert.ok(profile.bumpScale > 0);
    assert.ok(profile.sheen >= 0 && profile.sheen <= 1);
    assert.ok(profile.sheenRoughness >= 0 && profile.sheenRoughness <= 1);
    assert.match(profile.sheenColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(profile.emissive, /^#[0-9A-Fa-f]{6}$/);
    assert.ok(profile.emissiveIntensity >= 0);
  }

  assert.equal(resolveSheetFinishProfile('parchment-matte').proceduralTexture, 'cotton-paper');
  assert.equal(resolveSheetFinishProfile('woodblock-cotton').proceduralTexture, 'cotton-paper');
  assert.equal(resolveSheetFinishProfile('linen-glaze').proceduralTexture, 'linen-weave');
  assert.equal(resolveSheetFinishProfile('cyanotype-blueprint').proceduralTexture, 'cotton-paper');
  assert.equal(resolveSheetFinishProfile('xray-neon').proceduralTexture, undefined);
  assert.ok(resolveSheetFinishProfile('cyanotype-blueprint').emissiveIntensity > 0);
  assert.ok(resolveSheetFinishProfile('xray-neon').emissiveIntensity > 0);
});

test('DeformableSheet3D finish presets, explicit-prop precedence, and shared texture non-disposal invariants', () => {
  disposeProceduralPbrMaps();

  // 1. Legacy defaults when neither finish nor proceduralTexture is provided
  const legacy = resolveDeformableSheetMaterialConfig({});
  assert.equal(legacy.proceduralKind, undefined);
  assert.equal(legacy.frontBumpMap, null);
  assert.equal(legacy.frontRoughnessMap, null);
  assert.equal(legacy.frontRoughness, 0.56);
  assert.equal(legacy.metalness, 0);
  assert.equal(legacy.clearcoat, 0.14);
  assert.equal(legacy.clearcoatRoughness, 0.32);
  assert.equal(legacy.bumpScale, 0.006);

  // 2. Finish preset applies linen-glaze profile + linen-weave procedural maps
  const glazed = resolveDeformableSheetMaterialConfig({ finish: 'linen-glaze' });
  const linenMaps = getProceduralPbrMaps('linen-weave', { repeat: [2, 2.8] });
  assert.equal(glazed.proceduralKind, 'linen-weave');
  assert.equal(glazed.frontBumpMap, linenMaps.bumpMap);
  assert.equal(glazed.frontRoughnessMap, linenMaps.roughnessMap);
  assert.equal(glazed.backBumpMap, linenMaps.bumpMap);
  assert.equal(glazed.backRoughnessMap, linenMaps.roughnessMap);
  assert.equal(glazed.frontRoughness, 0.88);
  assert.equal(glazed.clearcoat, 0.16);
  assert.equal(glazed.clearcoatRoughness, 0.28);
  assert.equal(glazed.bumpScale, 0.006);

  // 3. Explicit props ALWAYS take precedence over finish preset and procedural maps
  const customBump = new THREE.DataTexture(new Uint8Array(16), 2, 2, THREE.RGBAFormat);
  const customRough = new THREE.DataTexture(new Uint8Array(16), 2, 2, THREE.RGBAFormat);
  const overridden = resolveDeformableSheetMaterialConfig({
    finish: 'parchment-matte',
    roughness: 0.25,
    metalness: 0.4,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    bumpScale: 0.02,
    frontBumpMap: customBump,
    frontRoughnessMap: customRough,
  });
  assert.equal(overridden.frontBumpMap, customBump);
  assert.equal(overridden.frontRoughnessMap, customRough);
  assert.equal(overridden.frontRoughness, 0.25);
  assert.equal(overridden.metalness, 0.4);
  assert.equal(overridden.clearcoat, 0.9);
  assert.equal(overridden.clearcoatRoughness, 0.1);
  assert.equal(overridden.bumpScale, 0.02);
  customBump.dispose();
  customRough.dispose();

  // 4. proceduralTexture='none' suppresses finish's default procedural texture and uses unmapped roughness
  const suppressed = resolveDeformableSheetMaterialConfig({
    finish: 'linen-glaze',
    proceduralTexture: 'none',
  });
  assert.equal(suppressed.proceduralKind, undefined);
  assert.equal(suppressed.frontBumpMap, null);
  assert.equal(suppressed.frontRoughnessMap, null);
  assert.equal(suppressed.frontRoughness, 0.46);

  // 5. Explicit proceduralTexture overrides finish's default proceduralTexture
  const brushed = resolveDeformableSheetMaterialConfig({
    finish: 'parchment-matte',
    proceduralTexture: 'brushed-metal',
  });
  assert.equal(brushed.proceduralKind, 'brushed-metal');
  assert.ok(brushed.frontBumpMap !== null);

  // Source-level VRAM hygiene: never dispose shared cached procedural textures on sheet unmount
  const sheetSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/tactile-3d/DeformableSheet3D.tsx'),
    'utf8'
  );
  assert.match(sheetSrc, /finish\?:\s*SheetMaterialFinish/);
  assert.match(sheetSrc, /proceduralTexture\?:\s*ProceduralPbrMaterialKind\s*\|\s*'none'/);
  assert.doesNotMatch(sheetSrc, /procMaps\s*\??\.\s*(map|bumpMap|roughnessMap)\.dispose/);
  assert.doesNotMatch(sheetSrc, /disposeProceduralPbrMaps\s*\(/);

  disposeProceduralPbrMaps();
});

test('evaluateTimeOfDayLighting computes deterministic tri-stop progression and lighting multipliers', () => {
  const morning = evaluateTimeOfDayLighting(0);
  const afternoon = evaluateTimeOfDayLighting(0.5);
  const evening = evaluateTimeOfDayLighting(1);

  assert.equal(morning.timeOfDay, 0);
  assert.equal(afternoon.timeOfDay, 0.5);
  assert.equal(evening.timeOfDay, 1);

  assert.ok(morning.environmentIntensity > afternoon.environmentIntensity);
  assert.ok(afternoon.environmentIntensity > evening.environmentIntensity);
  assert.ok(morning.keyIntensity > afternoon.keyIntensity);
  assert.ok(afternoon.keyIntensity > evening.keyIntensity);
  assert.ok(morning.fillIntensity > afternoon.fillIntensity);
  assert.ok(afternoon.fillIntensity > evening.fillIntensity);
  assert.ok(morning.hemiIntensity > afternoon.hemiIntensity);
  assert.ok(afternoon.hemiIntensity > evening.hemiIntensity);
  assert.ok(morning.toneMappingExposure > afternoon.toneMappingExposure);
  assert.ok(afternoon.toneMappingExposure > evening.toneMappingExposure);

  // Clamping out-of-range inputs
  assert.deepEqual(evaluateTimeOfDayLighting(-0.5), morning);
  assert.deepEqual(evaluateTimeOfDayLighting(1.75), evening);

  // Hex validity across stops and midpoints
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const s = evaluateTimeOfDayLighting(t);
    for (const hex of [s.keyColor, s.fillColor, s.hemiSkyColor, s.hemiGroundColor]) {
      assert.match(hex, /^#[0-9A-F]{6}$/, `Invalid hex color ${hex} at t=${t}`);
    }
  }

  // sceneLampMultiplier scales key/fill/hemi proportionally
  const dimmed = evaluateTimeOfDayLighting(0.25, { sceneLampMultiplier: 0.82 });
  const base = evaluateTimeOfDayLighting(0.25);
  assert.ok(Math.abs(dimmed.keyIntensity - base.keyIntensity * 0.82) < 1e-6);
  assert.ok(Math.abs(dimmed.fillIntensity - base.fillIntensity * 0.82) < 1e-6);
  assert.ok(Math.abs(dimmed.hemiIntensity - base.hemiIntensity * 0.82) < 1e-6);
  assert.equal(dimmed.environmentIntensity, base.environmentIntensity);
  assert.equal(dimmed.toneMappingExposure, base.toneMappingExposure);

  // atmosphereBlend smoothly lowers environmentIntensity toward 0.52
  const darkMorning = evaluateTimeOfDayLighting(0, { atmosphereBlend: 1 });
  const halfDarkMorning = evaluateTimeOfDayLighting(0, { atmosphereBlend: 0.5 });
  assert.ok(Math.abs(darkMorning.environmentIntensity - 0.52) < 1e-6);
  assert.ok(
    Math.abs(halfDarkMorning.environmentIntensity - (morning.environmentIntensity + 0.52) * 0.5) <
      1e-6
  );
});

test('DaylightArcRig3D and new tactile-3d exports obey Clean Frame 0, SyncStudioIbl3D composition, and root re-exports', () => {
  assert.equal(typeof DaylightArcRig3D, 'function');
  assert.equal(tactile3d.DaylightArcRig3D, DaylightArcRig3D);
  assert.equal(kitsRoot.DaylightArcRig3D, DaylightArcRig3D);
  assert.equal(tactile3d.evaluateTimeOfDayLighting, evaluateTimeOfDayLighting);
  assert.equal(kitsRoot.evaluateTimeOfDayLighting, evaluateTimeOfDayLighting);
  assert.equal(tactile3d.getProceduralPbrMaps, getProceduralPbrMaps);
  assert.equal(kitsRoot.getProceduralPbrMaps, getProceduralPbrMaps);
  assert.equal(tactile3d.disposeProceduralPbrMaps, disposeProceduralPbrMaps);
  assert.equal(kitsRoot.disposeProceduralPbrMaps, disposeProceduralPbrMaps);
  assert.equal(tactile3d.SHEET_MATERIAL_FINISHES, SHEET_MATERIAL_FINISHES);
  assert.equal(kitsRoot.SHEET_MATERIAL_FINISHES, SHEET_MATERIAL_FINISHES);
  assert.equal(tactile3d.resolveSheetFinishProfile, resolveSheetFinishProfile);
  assert.equal(kitsRoot.resolveSheetFinishProfile, resolveSheetFinishProfile);

  const rigSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/tactile-3d/DaylightArcRig3D.tsx'),
    'utf8'
  );
  assert.match(rigSrc, /<SyncStudioIbl3D\b/);
  assert.match(rigSrc, /cleanFrameZero\s*&&\s*frame\s*<=\s*0/);
  assert.doesNotMatch(rigSrc, /Math\.random\s*\(/);
  assert.doesNotMatch(rigSrc, /https?:\/\/|\.hdr\b|\.exr\b/i);
});
