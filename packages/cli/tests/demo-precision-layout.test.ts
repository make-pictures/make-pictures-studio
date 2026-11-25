import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCubicBezierPath,
  evaluateCubicBezier,
  type Point2D,
} from '@make-pictures/remotion/kits/motion-diagrams-2d';
import {
  FLOW_EDGES,
  FLOW_WORLD_NODES,
} from '../../../examples/aether-promo/productPromoTiming';
import { isometricDialogueDefaultProps } from '../../../examples/isometric-dialogue/IsometricDialogueDemo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

interface Box2D {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function edgePillBox(params: {
  name: string;
  from: Point2D;
  to: Point2D;
  curveOffsetY: number;
  labelT?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  estimatedTextChars: number;
}): Box2D {
  const curve = buildCubicBezierPath(params.from, params.to, {
    orientation: 'horizontal',
    curveY: params.curveOffsetY,
  });
  const anchor = evaluateCubicBezier(
    curve.p0,
    curve.p1,
    curve.p2,
    curve.p3,
    params.labelT ?? 0.5
  );
  const cx = anchor.x + (params.labelOffsetX ?? 0);
  const cy = anchor.y + (params.labelOffsetY ?? -28);
  const halfW = (params.estimatedTextChars * 9.5 + 36) / 2;
  const halfH = 18;
  return {
    name: params.name,
    left: cx - halfW,
    right: cx + halfW,
    top: cy - halfH,
    bottom: cy + halfH,
  };
}

function assertMinClearance(a: Box2D, b: Box2D, minGapPx: number): void {
  const gapX = Math.max(0, a.left - b.right, b.left - a.right);
  const gapY = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  const euclideanClearance = Math.hypot(gapX, gapY);
  assert.ok(
    euclideanClearance >= minGapPx,
    `Collision or tight crowding between "${a.name}" [${Math.round(a.left)},${Math.round(
      a.top
    )}..${Math.round(a.right)},${Math.round(a.bottom)}] and "${b.name}" [${Math.round(
      b.left
    )},${Math.round(b.top)}..${Math.round(b.right)},${Math.round(
      b.bottom
    )}]: clearance=${euclideanClearance.toFixed(1)}px < ${minGapPx}px`
  );
}

test('ProductPromo motion diagram wraps StyleProvider and maintains >= 28px AABB clearance across all nodes, edge pills, header, and bottom ribbon', () => {
  const promoSrc = fs.readFileSync(
    path.join(repoRoot, 'examples/aether-promo/ProductPromo.tsx'),
    'utf8'
  );
  assert.match(
    promoSrc,
    /<StyleProvider\s+style=/,
    'ProductPromo must wrap its stage in <StyleProvider>'
  );

  const headerBox: Box2D = {
    name: 'Header',
    left: 72,
    top: 48,
    right: 1848,
    bottom: 215,
  };
  const ribbonBox: Box2D = {
    name: 'PaperRibbonTimeline',
    left: 160,
    top: 960,
    right: 1760,
    bottom: 1040,
  };

  const nodeBoxes: Box2D[] = Object.entries(FLOW_WORLD_NODES).map(([id, n]) => ({
    name: `Node:${id}`,
    left: n.cx - n.w / 2,
    right: n.cx + n.w / 2,
    top: n.cy - n.h / 2,
    bottom: n.cy + n.h / 2,
  }));

  const pillBoxes: Box2D[] = FLOW_EDGES.map((edge) =>
    edgePillBox({
      name: `EdgePill:${edge.label}`,
      from: edge.from,
      to: edge.to,
      curveOffsetY: edge.curveOffsetY,
      labelT: edge.labelT,
      labelOffsetX: edge.labelOffsetX,
      labelOffsetY: edge.labelOffsetY,
      estimatedTextChars: edge.label.length,
    })
  );

  const allInteractive = [...nodeBoxes, ...pillBoxes];

  for (let i = 0; i < allInteractive.length; i++) {
    for (let j = i + 1; j < allInteractive.length; j++) {
      assertMinClearance(allInteractive[i]!, allInteractive[j]!, 28);
    }
    assertMinClearance(allInteractive[i]!, headerBox, 28);
    assertMinClearance(allInteractive[i]!, ribbonBox, 28);
  }
});

test('DataFlowEdge exposes optional labelT, labelOffsetX, and zIndex props for precise curve label placement', () => {
  const edgeSrc = fs.readFileSync(
    path.join(
      repoRoot,
      'packages/remotion/src/kits/motion-diagrams-2d/DataFlowEdge.tsx'
    ),
    'utf8'
  );
  assert.match(edgeSrc, /labelT\?:\s*number/);
  assert.match(edgeSrc, /labelOffsetX\?:\s*number/);
  assert.match(edgeSrc, /zIndex\?:\s*number/);
});

test('Built-in 3D showcase demos maintain unclipped framing defaults and native Remotion Root registration', () => {
  assert.ok(
    isometricDialogueDefaultProps.cameraZoom <= 145,
    `Expected IsometricDialogueDemo cameraZoom <= 145 so top/bottom room corners never clip 1920x1080 bounds (got ${isometricDialogueDefaultProps.cameraZoom})`
  );

  const rootSrc = fs.readFileSync(path.join(repoRoot, 'src/Root.tsx'), 'utf8');
  for (const id of [
    'StarterStory',
    'StarterStoryVertical',
    'ProductPromo',
    'PaperDioramaDemo',
    'IsometricDialogueDemo',
    'Tactile3DShowcase',
  ]) {
    assert.match(
      rootSrc,
      new RegExp(`id=["']${id}["']`),
      `src/Root.tsx must directly register <Composition id="${id}" ... />`
    );
  }
  assert.doesNotMatch(rootSrc, /registry|STUDIO_COMPOSITIONS|defineProduction/);
});
