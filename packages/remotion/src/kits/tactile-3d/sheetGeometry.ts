import * as THREE from 'three';

export interface SheetUvRect {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

export interface GridAtlasUvOptions {
  slot: number;
  cols: number;
  rows: number;
  atlasWidth?: number;
  atlasHeight?: number;
  cellWidth?: number;
  cellHeight?: number;
  padX?: number;
  padY?: number;
  bleedInsetUv?: number;
}

export interface BuildSheetGeometryOptions {
  width?: number;
  height?: number;
  thickness?: number;
  cornerRadius?: number;
  segX?: number;
  segY?: number;
  cornerSegments?: number;
  /** Fractional UV inset per edge (e.g. `0.015` = 1.5% per edge) to hide dark scan borders. */
  bleedInsetUv?: number;
  /** Optional explicit front-face UV rect (e.g. from `computeGridAtlasUvRect`). */
  uvRect?: SheetUvRect;
  /** Optional horizontal UV sub-crop `[leftFrac, rightFrac]` in `[0, 1]` applied to front face. */
  uvCropX?: [number, number];
  /** Optional vertical UV sub-crop `[bottomFrac, topFrac]` in `[0, 1]` applied to front face. */
  uvCropY?: [number, number];
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Computes Three.js (`flipY = true`) UV coordinates for slot `slot` inside a regular
 * `cols × rows` texture atlas, supporting optional cell padding and scan bleed insets.
 */
export function computeGridAtlasUvRect(options: GridAtlasUvOptions): SheetUvRect {
  const {
    slot,
    cols,
    rows,
    atlasWidth = cols,
    atlasHeight = rows,
    cellWidth = atlasWidth / cols,
    cellHeight = atlasHeight / rows,
    padX = 0,
    padY = 0,
    bleedInsetUv = 0,
  } = options;

  const maxSlots = cols * rows;
  if (!Number.isInteger(slot) || slot < 0 || slot >= maxSlots) {
    throw new RangeError(
      `Atlas slot must be an integer in [0, ${maxSlots - 1}], got ${slot}`
    );
  }

  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const slotW = atlasWidth / cols;
  const slotH = atlasHeight / rows;
  const x0 = col * slotW + padX;
  const y0 = row * slotH + padY;
  const inset = clamp(bleedInsetUv, 0, 0.25);

  return {
    uMin: (x0 + inset * cellWidth) / atlasWidth,
    uMax: (x0 + (1 - inset) * cellWidth) / atlasWidth,
    vMax: 1 - (y0 + inset * cellHeight) / atlasHeight,
    vMin: 1 - (y0 + (1 - inset) * cellHeight) / atlasHeight,
  };
}

interface Point2D {
  x: number;
  y: number;
}

interface PerimeterSegment2D {
  p0: Point2D;
  p1: Point2D;
  n0: Point2D;
  n1: Point2D;
}

interface FacePlan2D {
  points: Point2D[];
  tris: [number, number, number][];
  perimeterSegments: PerimeterSegment2D[];
}

function buildFacePlan2D(
  width: number,
  height: number,
  rawCornerRadius: number,
  rawSegX: number,
  rawSegY: number,
  rawCornerSegments: number
): FacePlan2D {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const segX = Math.max(2, Math.floor(rawSegX));
  const segY = Math.max(2, Math.floor(rawSegY));
  const cornerSegments = Math.max(2, Math.floor(rawCornerSegments));
  const r =
    rawCornerRadius > 1e-5
      ? clamp(rawCornerRadius, 0, Math.min(hw, hh) * 0.94)
      : 0;

  const points: Point2D[] = [];
  const tris: [number, number, number][] = [];
  const addPoint = (x: number, y: number): number => {
    const idx = points.length;
    points.push({ x, y });
    return idx;
  };

  if (r === 0) {
    const gridIdx = (i: number, j: number): number => j * (segX + 1) + i;
    for (let j = 0; j <= segY; j++) {
      const y = lerp(-hh, hh, j / segY);
      for (let i = 0; i <= segX; i++) {
        const x = lerp(-hw, hw, i / segX);
        addPoint(x, y);
      }
    }
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segX; i++) {
        const a = gridIdx(i, j);
        const b = gridIdx(i + 1, j);
        const c = gridIdx(i + 1, j + 1);
        const d = gridIdx(i, j + 1);
        tris.push([a, b, c], [a, c, d]);
      }
    }

    const perimeterSegments: PerimeterSegment2D[] = [];
    for (let i = 0; i < segX; i++) {
      perimeterSegments.push({
        p0: { x: lerp(-hw, hw, i / segX), y: -hh },
        p1: { x: lerp(-hw, hw, (i + 1) / segX), y: -hh },
        n0: { x: 0, y: -1 },
        n1: { x: 0, y: -1 },
      });
    }
    for (let j = 0; j < segY; j++) {
      perimeterSegments.push({
        p0: { x: hw, y: lerp(-hh, hh, j / segY) },
        p1: { x: hw, y: lerp(-hh, hh, (j + 1) / segY) },
        n0: { x: 1, y: 0 },
        n1: { x: 1, y: 0 },
      });
    }
    for (let i = segX; i > 0; i--) {
      perimeterSegments.push({
        p0: { x: lerp(-hw, hw, i / segX), y: hh },
        p1: { x: lerp(-hw, hw, (i - 1) / segX), y: hh },
        n0: { x: 0, y: 1 },
        n1: { x: 0, y: 1 },
      });
    }
    for (let j = segY; j > 0; j--) {
      perimeterSegments.push({
        p0: { x: -hw, y: lerp(-hh, hh, j / segY) },
        p1: { x: -hw, y: lerp(-hh, hh, (j - 1) / segY) },
        n0: { x: -1, y: 0 },
        n1: { x: -1, y: 0 },
      });
    }
    return { points, tris, perimeterSegments };
  }

  // Rounded rectangle: 3x3 interior grid + 4 edge strips + 4 corner quarter-fans
  const ix = hw - r;
  const iy = hh - r;
  const innerSegX = Math.max(2, segX - 2);
  const innerSegY = Math.max(2, segY - 2);

  const innerGrid: number[][] = [];
  for (let j = 0; j <= innerSegY; j++) {
    const row: number[] = [];
    const y = lerp(-iy, iy, j / innerSegY);
    for (let i = 0; i <= innerSegX; i++) {
      const x = lerp(-ix, ix, i / innerSegX);
      row.push(addPoint(x, y));
    }
    innerGrid.push(row);
  }
  for (let j = 0; j < innerSegY; j++) {
    for (let i = 0; i < innerSegX; i++) {
      const a = innerGrid[j][i];
      const b = innerGrid[j][i + 1];
      const c = innerGrid[j + 1][i + 1];
      const d = innerGrid[j + 1][i];
      tris.push([a, b, c], [a, c, d]);
    }
  }

  const bottomEdge: number[] = [];
  const topEdge: number[] = [];
  for (let i = 0; i <= innerSegX; i++) {
    const x = lerp(-ix, ix, i / innerSegX);
    bottomEdge.push(addPoint(x, -hh));
    topEdge.push(addPoint(x, hh));
  }
  const rightEdge: number[] = [];
  const leftEdge: number[] = [];
  for (let j = 0; j <= innerSegY; j++) {
    const y = lerp(-iy, iy, j / innerSegY);
    rightEdge.push(addPoint(hw, y));
    leftEdge.push(addPoint(-hw, y));
  }

  for (let i = 0; i < innerSegX; i++) {
    tris.push(
      [bottomEdge[i], bottomEdge[i + 1], innerGrid[0][i + 1]],
      [bottomEdge[i], innerGrid[0][i + 1], innerGrid[0][i]]
    );
    tris.push(
      [innerGrid[innerSegY][i], innerGrid[innerSegY][i + 1], topEdge[i + 1]],
      [innerGrid[innerSegY][i], topEdge[i + 1], topEdge[i]]
    );
  }
  for (let j = 0; j < innerSegY; j++) {
    tris.push(
      [innerGrid[j][innerSegX], rightEdge[j], rightEdge[j + 1]],
      [innerGrid[j][innerSegX], rightEdge[j + 1], innerGrid[j + 1][innerSegX]]
    );
    tris.push(
      [leftEdge[j], innerGrid[j][0], innerGrid[j + 1][0]],
      [leftEdge[j], innerGrid[j + 1][0], leftEdge[j + 1]]
    );
  }

  const addCornerFan = (
    centerIdx: number,
    cx: number,
    cy: number,
    startIdx: number,
    endIdx: number,
    startAngle: number,
    endAngle: number
  ): { pts: Point2D[]; norms: Point2D[] } => {
    const ringIndices: number[] = [startIdx];
    const pts: Point2D[] = [points[startIdx]];
    const norms: Point2D[] = [{ x: Math.cos(startAngle), y: Math.sin(startAngle) }];

    for (let k = 1; k < cornerSegments; k++) {
      const ang = lerp(startAngle, endAngle, k / cornerSegments);
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      const idx = addPoint(cx + nx * r, cy + ny * r);
      ringIndices.push(idx);
      pts.push(points[idx]);
      norms.push({ x: nx, y: ny });
    }
    ringIndices.push(endIdx);
    pts.push(points[endIdx]);
    norms.push({ x: Math.cos(endAngle), y: Math.sin(endAngle) });

    for (let k = 0; k < cornerSegments; k++) {
      tris.push([centerIdx, ringIndices[k], ringIndices[k + 1]]);
    }
    return { pts, norms };
  };

  const brCorner = addCornerFan(
    innerGrid[0][innerSegX],
    ix,
    -iy,
    bottomEdge[innerSegX],
    rightEdge[0],
    -Math.PI * 0.5,
    0
  );
  const trCorner = addCornerFan(
    innerGrid[innerSegY][innerSegX],
    ix,
    iy,
    rightEdge[innerSegY],
    topEdge[innerSegX],
    0,
    Math.PI * 0.5
  );
  const tlCorner = addCornerFan(
    innerGrid[innerSegY][0],
    -ix,
    iy,
    topEdge[0],
    leftEdge[innerSegY],
    Math.PI * 0.5,
    Math.PI
  );
  const blCorner = addCornerFan(
    innerGrid[0][0],
    -ix,
    -iy,
    leftEdge[0],
    bottomEdge[0],
    Math.PI,
    Math.PI * 1.5
  );

  const perimeterSegments: PerimeterSegment2D[] = [];
  for (let i = 0; i < innerSegX; i++) {
    perimeterSegments.push({
      p0: points[bottomEdge[i]],
      p1: points[bottomEdge[i + 1]],
      n0: { x: 0, y: -1 },
      n1: { x: 0, y: -1 },
    });
  }
  for (let k = 0; k < cornerSegments; k++) {
    perimeterSegments.push({
      p0: brCorner.pts[k],
      p1: brCorner.pts[k + 1],
      n0: brCorner.norms[k],
      n1: brCorner.norms[k + 1],
    });
  }
  for (let j = 0; j < innerSegY; j++) {
    perimeterSegments.push({
      p0: points[rightEdge[j]],
      p1: points[rightEdge[j + 1]],
      n0: { x: 1, y: 0 },
      n1: { x: 1, y: 0 },
    });
  }
  for (let k = 0; k < cornerSegments; k++) {
    perimeterSegments.push({
      p0: trCorner.pts[k],
      p1: trCorner.pts[k + 1],
      n0: trCorner.norms[k],
      n1: trCorner.norms[k + 1],
    });
  }
  for (let i = innerSegX; i > 0; i--) {
    perimeterSegments.push({
      p0: points[topEdge[i]],
      p1: points[topEdge[i - 1]],
      n0: { x: 0, y: 1 },
      n1: { x: 0, y: 1 },
    });
  }
  for (let k = 0; k < cornerSegments; k++) {
    perimeterSegments.push({
      p0: tlCorner.pts[k],
      p1: tlCorner.pts[k + 1],
      n0: tlCorner.norms[k],
      n1: tlCorner.norms[k + 1],
    });
  }
  for (let j = innerSegY; j > 0; j--) {
    perimeterSegments.push({
      p0: points[leftEdge[j]],
      p1: points[leftEdge[j - 1]],
      n0: { x: -1, y: 0 },
      n1: { x: -1, y: 0 },
    });
  }
  for (let k = 0; k < cornerSegments; k++) {
    perimeterSegments.push({
      p0: blCorner.pts[k],
      p1: blCorner.pts[k + 1],
      n0: blCorner.norms[k],
      n1: blCorner.norms[k + 1],
    });
  }

  return { points, tris, perimeterSegments };
}

/**
 * Builds a subdivided, rounded-or-sharp thin 3D sheet `BufferGeometry` with
 * 3 explicit material groups:
 * - group 0: front face (`+Z`)
 * - group 1: back face (`-Z`, horizontally mirrored UVs so back graphics read naturally)
 * - group 2: perimeter edge band (`±thickness / 2`)
 */
export function buildSheetGeometry(
  options: BuildSheetGeometryOptions = {}
): THREE.BufferGeometry {
  const width = options.width ?? 1.0;
  const height = options.height ?? 1.4;
  const thickness = options.thickness ?? 0.014;
  const cornerRadius = options.cornerRadius ?? 0.05;
  const segX = options.segX ?? 12;
  const segY = options.segY ?? 18;
  const cornerSegments = options.cornerSegments ?? 4;
  const inset = clamp(options.bleedInsetUv ?? 0, 0, 0.25);

  const halfT = thickness * 0.5;
  const hw = width * 0.5;
  const hh = height * 0.5;

  const baseUvRect: SheetUvRect = options.uvRect ?? {
    uMin: inset,
    uMax: 1 - inset,
    vMin: inset,
    vMax: 1 - inset,
  };
  const frontUvRect: SheetUvRect = {
    uMin: options.uvCropX
      ? lerp(baseUvRect.uMin, baseUvRect.uMax, clamp(options.uvCropX[0], 0, 1))
      : baseUvRect.uMin,
    uMax: options.uvCropX
      ? lerp(baseUvRect.uMin, baseUvRect.uMax, clamp(options.uvCropX[1], 0, 1))
      : baseUvRect.uMax,
    vMin: options.uvCropY
      ? lerp(baseUvRect.vMin, baseUvRect.vMax, clamp(options.uvCropY[0], 0, 1))
      : baseUvRect.vMin,
    vMax: options.uvCropY
      ? lerp(baseUvRect.vMin, baseUvRect.vMax, clamp(options.uvCropY[1], 0, 1))
      : baseUvRect.vMax,
  };

  const plan = buildFacePlan2D(width, height, cornerRadius, segX, segY, cornerSegments);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Group 0: Front face (+Z)
  const frontVertBase = 0;
  for (const pt of plan.points) {
    const nx = (pt.x + hw) / width;
    const ny = (pt.y + hh) / height;
    positions.push(pt.x, pt.y, halfT);
    normals.push(0, 0, 1);
    uvs.push(
      lerp(frontUvRect.uMin, frontUvRect.uMax, nx),
      lerp(frontUvRect.vMin, frontUvRect.vMax, ny)
    );
  }
  const frontIndexStart = indices.length;
  for (const [a, b, c] of plan.tris) {
    indices.push(frontVertBase + a, frontVertBase + b, frontVertBase + c);
  }
  const frontIndexCount = indices.length - frontIndexStart;

  // Group 1: Back face (-Z, mirrored U, reversed winding)
  const backVertBase = positions.length / 3;
  for (const pt of plan.points) {
    const nx = (pt.x + hw) / width;
    const ny = (pt.y + hh) / height;
    positions.push(pt.x, pt.y, -halfT);
    normals.push(0, 0, -1);
    uvs.push(lerp(1 - inset, inset, nx), lerp(inset, 1 - inset, ny));
  }
  const backIndexStart = indices.length;
  for (const [a, b, c] of plan.tris) {
    indices.push(backVertBase + a, backVertBase + c, backVertBase + b);
  }
  const backIndexCount = indices.length - backIndexStart;

  // Group 2: Perimeter edge band
  const edgeIndexStart = indices.length;
  const totalPerimeter = plan.perimeterSegments.reduce(
    (sum, s) => sum + Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y),
    0
  );
  let accumLen = 0;
  for (const seg of plan.perimeterSegments) {
    const segLen = Math.hypot(seg.p1.x - seg.p0.x, seg.p1.y - seg.p0.y);
    const u0 = totalPerimeter > 1e-6 ? accumLen / totalPerimeter : 0;
    accumLen += segLen;
    const u1 = totalPerimeter > 1e-6 ? accumLen / totalPerimeter : 1;

    const base = positions.length / 3;
    positions.push(
      seg.p0.x, seg.p0.y, halfT,
      seg.p1.x, seg.p1.y, halfT,
      seg.p1.x, seg.p1.y, -halfT,
      seg.p0.x, seg.p0.y, -halfT
    );
    normals.push(
      seg.n0.x, seg.n0.y, 0,
      seg.n1.x, seg.n1.y, 0,
      seg.n1.x, seg.n1.y, 0,
      seg.n0.x, seg.n0.y, 0
    );
    uvs.push(u0, 1, u1, 1, u1, 0, u0, 0);
    indices.push(base, base + 3, base + 2, base, base + 2, base + 1);
  }
  const edgeIndexCount = indices.length - edgeIndexStart;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.addGroup(frontIndexStart, frontIndexCount, 0);
  geometry.addGroup(backIndexStart, backIndexCount, 1);
  geometry.addGroup(edgeIndexStart, edgeIndexCount, 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
