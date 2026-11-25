import type { SheetDeformParams, Vec3 } from './disney';

export type EulerOrder3D = 'XYZ' | 'YXZ' | 'ZYX';

export interface Box3Bounds {
  min: Vec3;
  max: Vec3;
}

export interface OrientedBox3D {
  id?: string;
  position: Vec3;
  /** Full box dimensions `[width, height, depth]` before `scale`. */
  size: Vec3;
  rotation?: Vec3;
  quaternion?: [number, number, number, number];
  scale?: Vec3;
  eulerOrder?: EulerOrder3D;
}

export interface DeformedSheetBoundsInput {
  position: Vec3;
  width: number;
  height: number;
  thickness?: number;
  rotation?: Vec3;
  quaternion?: [number, number, number, number];
  scale?: Vec3;
  eulerOrder?: EulerOrder3D;
  deform?: Partial<SheetDeformParams>;
}

export interface CollisionViolation3D {
  idA: string;
  idB: string;
  clearance: number;
  minRequired: number;
}

export interface SurfaceClearanceViolation3D {
  id: string;
  minY: number;
  surfaceY: number;
  clearance: number;
  minRequired: number;
}

export interface SceneCollisionAuditOptions3D {
  minClearance?: number;
  ignoredPairs?: ReadonlyArray<[string, string]>;
  surfaceY?: number;
  minSurfaceClearance?: number;
}

export interface SceneCollisionAuditReport3D {
  ok: boolean;
  checkedPairs: number;
  minClearance: number;
  violations: CollisionViolation3D[];
  surfaceViolations: SurfaceClearanceViolation3D[];
}

type Basis3 = [Vec3, Vec3, Vec3];

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function basisFromQuaternion(q: readonly [number, number, number, number]): Basis3 {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  const x = q[0] / len;
  const y = q[1] / len;
  const z = q[2] / len;
  const w = q[3] / len;

  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return [
    [1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy)],
    [2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx)],
    [2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy)],
  ];
}

function mulMat3(a: Basis3, b: Basis3): Basis3 {
  // Columns of matrix A * matrix B where Basis3 stores columns [c0, c1, c2]
  const out: Basis3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let col = 0; col < 3; col++) {
    const bCol = b[col]!;
    const bx = bCol[0];
    const by = bCol[1];
    const bz = bCol[2];
    out[col] = [
      a[0][0] * bx + a[1][0] * by + a[2][0] * bz,
      a[0][1] * bx + a[1][1] * by + a[2][1] * bz,
      a[0][2] * bx + a[1][2] * by + a[2][2] * bz,
    ];
  }
  return out;
}

function rotX(a: number): Basis3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [1, 0, 0],
    [0, c, s],
    [0, -s, c],
  ];
}

function rotY(a: number): Basis3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [c, 0, -s],
    [0, 1, 0],
    [s, 0, c],
  ];
}

function rotZ(a: number): Basis3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [c, s, 0],
    [-s, c, 0],
    [0, 0, 1],
  ];
}

function resolveBasis3(
  rotation?: Vec3,
  quaternion?: readonly [number, number, number, number],
  eulerOrder: EulerOrder3D = 'XYZ'
): Basis3 {
  if (quaternion) {
    return basisFromQuaternion(quaternion);
  }
  if (!rotation || (rotation[0] === 0 && rotation[1] === 0 && rotation[2] === 0)) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }
  const rx = rotX(rotation[0]);
  const ry = rotY(rotation[1]);
  const rz = rotZ(rotation[2]);
  if (eulerOrder === 'YXZ') {
    return mulMat3(mulMat3(ry, rx), rz);
  }
  if (eulerOrder === 'ZYX') {
    return mulMat3(mulMat3(rz, ry), rx);
  }
  return mulMat3(mulMat3(rx, ry), rz);
}

/**
 * Signed separating clearance between two 3D AABBs.
 * Positive (`> 0`) = strict separation gap; `<= 0` = touching or penetrating.
 */
export function aabbClearance3D(a: Box3Bounds, b: Box3Bounds): number {
  return Math.max(
    a.min[0] - b.max[0],
    b.min[0] - a.max[0],
    a.min[1] - b.max[1],
    b.min[1] - a.max[1],
    a.min[2] - b.max[2],
    b.min[2] - a.max[2]
  );
}

export function aabbIntersects3D(
  a: Box3Bounds,
  b: Box3Bounds,
  epsilon = 1e-5
): boolean {
  return aabbClearance3D(a, b) <= epsilon;
}

export function computeSurfaceClearanceY(
  bounds: Box3Bounds,
  surfaceY = 0
): number {
  return bounds.min[1] - surfaceY;
}

/**
 * Computes the world-space AABB of a GPU-deformed 3D sheet by sampling a `9 × 9`
 * grid across both `±thickness/2` faces with the exact `applySheetDeform` formula.
 */
export function computeDeformedSheetAabb3D(
  input: DeformedSheetBoundsInput
): Box3Bounds {
  const hw = input.width * 0.5;
  const hh = input.height * 0.5;
  const ht = (input.thickness ?? 0.014) * 0.5;
  const sx = input.scale?.[0] ?? 1;
  const sy = input.scale?.[1] ?? 1;
  const sz = input.scale?.[2] ?? 1;

  const bendX = input.deform?.bendX ?? 0;
  const bendY = input.deform?.bendY ?? 0;
  const twist = input.deform?.twist ?? 0;
  const cornerWhip = input.deform?.cornerWhip ?? 0;
  const velocityStretch = input.deform?.velocityStretch ?? 0;
  const stretch = 1 + velocityStretch;
  const invSqrtStretch = 1 / Math.sqrt(Math.max(stretch, 1e-4));

  const [ax, ay, az] = resolveBasis3(
    input.rotation,
    input.quaternion,
    input.eulerOrder ?? 'XYZ'
  );
  const [px, py, pz] = input.position;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const samples = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
  const zFaces = [-ht, ht];

  for (const ny of samples) {
    const lyBase = ny * hh;
    const ny2 = ny * ny;
    for (const nx of samples) {
      const lxBase = nx * hw;
      const nx2 = nx * nx;
      const zBend =
        bendY * (ny2 - 0.33) * hh * 0.55 +
        bendX * (nx2 - 0.33) * hw * 0.55 +
        twist * (nx * ny) * hw * 0.65 +
        cornerWhip * (nx2 * ny2) * hh * 0.85;

      const lx = lxBase * invSqrtStretch * sx;
      const ly = lyBase * stretch * sy;

      for (const zf of zFaces) {
        const lz = (zf + zBend) * sz;
        const wx = px + ax[0] * lx + ay[0] * ly + az[0] * lz;
        const wy = py + ax[1] * lx + ay[1] * ly + az[1] * lz;
        const wz = pz + ax[2] * lx + ay[2] * ly + az[2] * lz;
        if (wx < minX) minX = wx;
        if (wy < minY) minY = wy;
        if (wz < minZ) minZ = wz;
        if (wx > maxX) maxX = wx;
        if (wy > maxY) maxY = wy;
        if (wz > maxZ) maxZ = wz;
      }
    }
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
}

export function computeOrientedBoxAabb3D(box: OrientedBox3D): Box3Bounds {
  const [ax, ay, az] = resolveBasis3(
    box.rotation,
    box.quaternion,
    box.eulerOrder ?? 'XYZ'
  );
  const hx = Math.abs(box.size[0] * (box.scale?.[0] ?? 1)) * 0.5;
  const hy = Math.abs(box.size[1] * (box.scale?.[1] ?? 1)) * 0.5;
  const hz = Math.abs(box.size[2] * (box.scale?.[2] ?? 1)) * 0.5;

  const ex = Math.abs(ax[0]) * hx + Math.abs(ay[0]) * hy + Math.abs(az[0]) * hz;
  const ey = Math.abs(ax[1]) * hx + Math.abs(ay[1]) * hy + Math.abs(az[1]) * hz;
  const ez = Math.abs(ax[2]) * hx + Math.abs(ay[2]) * hy + Math.abs(az[2]) * hz;

  return {
    min: [box.position[0] - ex, box.position[1] - ey, box.position[2] - ez],
    max: [box.position[0] + ex, box.position[1] + ey, box.position[2] + ez],
  };
}

/**
 * Exact 15-axis 3D Oriented Bounding Box Separating Axis Theorem (SAT) clearance.
 * Returns the maximum separating gap `dist - (rA + rB)` across all 15 axes:
 * positive (`> 0`) proves strict non-intersection with exact clearance gap.
 */
export function obbClearanceSat3D(a: OrientedBox3D, b: OrientedBox3D): number {
  const axesA = resolveBasis3(a.rotation, a.quaternion, a.eulerOrder ?? 'XYZ');
  const axesB = resolveBasis3(b.rotation, b.quaternion, b.eulerOrder ?? 'XYZ');
  const extA: Vec3 = [
    Math.abs(a.size[0] * (a.scale?.[0] ?? 1)) * 0.5,
    Math.abs(a.size[1] * (a.scale?.[1] ?? 1)) * 0.5,
    Math.abs(a.size[2] * (a.scale?.[2] ?? 1)) * 0.5,
  ];
  const extB: Vec3 = [
    Math.abs(b.size[0] * (b.scale?.[0] ?? 1)) * 0.5,
    Math.abs(b.size[1] * (b.scale?.[1] ?? 1)) * 0.5,
    Math.abs(b.size[2] * (b.scale?.[2] ?? 1)) * 0.5,
  ];
  const t: Vec3 = [
    b.position[0] - a.position[0],
    b.position[1] - a.position[1],
    b.position[2] - a.position[2],
  ];

  let maxGap = -Infinity;
  const evalAxis = (rawAxis: Vec3): void => {
    const len = Math.hypot(rawAxis[0], rawAxis[1], rawAxis[2]);
    if (len < 1e-8) return;
    const axis: Vec3 = [rawAxis[0] / len, rawAxis[1] / len, rawAxis[2] / len];
    const dist = Math.abs(dot3(t, axis));
    const rA =
      extA[0] * Math.abs(dot3(axesA[0], axis)) +
      extA[1] * Math.abs(dot3(axesA[1], axis)) +
      extA[2] * Math.abs(dot3(axesA[2], axis));
    const rB =
      extB[0] * Math.abs(dot3(axesB[0], axis)) +
      extB[1] * Math.abs(dot3(axesB[1], axis)) +
      extB[2] * Math.abs(dot3(axesB[2], axis));
    const gap = dist - (rA + rB);
    if (gap > maxGap) maxGap = gap;
  };

  for (const ax of axesA) evalAxis(ax);
  for (const bx of axesB) evalAxis(bx);
  for (const ax of axesA) {
    for (const bx of axesB) {
      evalAxis(cross3(ax, bx));
    }
  }

  return maxGap;
}

export function obbIntersectsSat3D(
  a: OrientedBox3D,
  b: OrientedBox3D,
  epsilon = 1e-5
): boolean {
  return obbClearanceSat3D(a, b) <= epsilon;
}

/**
 * Audits all non-ignored body pairs via 15-axis OBB SAT and optional tabletop/floor
 * clearance against `surfaceY`.
 */
export function auditSceneCollisions3D(
  bodies: ReadonlyArray<OrientedBox3D>,
  options: SceneCollisionAuditOptions3D = {}
): SceneCollisionAuditReport3D {
  const minRequired = options.minClearance ?? 1e-5;
  const ignored = new Set<string>();
  for (const [idA, idB] of options.ignoredPairs ?? []) {
    ignored.add(`${idA}::${idB}`);
    ignored.add(`${idB}::${idA}`);
  }

  const violations: CollisionViolation3D[] = [];
  const surfaceViolations: SurfaceClearanceViolation3D[] = [];
  let checkedPairs = 0;
  let minClearance = Infinity;

  for (let i = 0; i < bodies.length; i++) {
    const bodyA = bodies[i]!;
    const idA = bodyA.id ?? `body-${i}`;

    if (options.surfaceY !== undefined) {
      const aabb = computeOrientedBoxAabb3D(bodyA);
      const surfClearance = computeSurfaceClearanceY(aabb, options.surfaceY);
      const minSurfReq = options.minSurfaceClearance ?? 0;
      if (surfClearance < minSurfReq) {
        surfaceViolations.push({
          id: idA,
          minY: aabb.min[1],
          surfaceY: options.surfaceY,
          clearance: surfClearance,
          minRequired: minSurfReq,
        });
      }
    }

    for (let j = i + 1; j < bodies.length; j++) {
      const bodyB = bodies[j]!;
      const idB = bodyB.id ?? `body-${j}`;
      if (ignored.has(`${idA}::${idB}`)) continue;

      checkedPairs += 1;
      const clearance = obbClearanceSat3D(bodyA, bodyB);
      if (clearance < minClearance) minClearance = clearance;
      if (clearance < minRequired) {
        violations.push({
          idA,
          idB,
          clearance,
          minRequired,
        });
      }
    }
  }

  return {
    ok: violations.length === 0 && surfaceViolations.length === 0,
    checkedPairs,
    minClearance: checkedPairs > 0 ? minClearance : Infinity,
    violations,
    surfaceViolations,
  };
}
