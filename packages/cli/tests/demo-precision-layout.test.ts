import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateCubicBezier,
  type Point2D,
} from '../../kits/src/motion-diagrams-2d/DataFlowEdge';
import { ARCHITECTURE_DEMO_LAYOUT } from '../../../src/scenes/ArchitectureDemoScene';

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
  const dx = params.to.x - params.from.x;
  const p0 = params.from;
  const p1 = { x: params.from.x + dx * 0.36, y: params.from.y + params.curveOffsetY };
  const p2 = { x: params.from.x + dx * 0.64, y: params.to.y + params.curveOffsetY };
  const p3 = params.to;
  const anchor = evaluateCubicBezier(p0, p1, p2, p3, params.labelT ?? 0.5);
  const cx = anchor.x + (params.labelOffsetX ?? 0);
  const cy = anchor.y + (params.labelOffsetY ?? -28);
  const halfW = (params.estimatedTextChars * 7.2 + 38) / 2;
  const halfH = 16;
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

test('ArchitectureDemoScene wraps cyber-telemetry dark style and maintains >= 20px AABB clearance across all nodes, edge pills, toasts, header, and captions', () => {
  const sceneSrc = fs.readFileSync(
    path.join(repoRoot, 'src/scenes/ArchitectureDemoScene.tsx'),
    'utf8'
  );
  assert.match(
    sceneSrc,
    /StyleProvider[\s\S]*?style=["']cyber-telemetry["']/,
    'ArchitectureDemoScene must wrap its dark telemetry stage in <StyleProvider style="cyber-telemetry">'
  );

  const L = ARCHITECTURE_DEMO_LAYOUT;
  const halfW = (L.nodeWidth * 1.025) / 2;
  const halfH = (L.nodeHeight * 1.025) / 2;

  const headerBox: Box2D = {
    name: 'Header',
    left: 96,
    top: 56,
    right: 1824,
    bottom: 148,
  };
  const captionBox: Box2D = {
    name: 'VoiceoverCaptionBar',
    left: 370,
    top: 948,
    right: 1550,
    bottom: 1040,
  };

  const nodeBoxes: Box2D[] = [
    {
      name: 'Web Client App',
      left: L.appNodePos.x - halfW,
      right: L.appNodePos.x + halfW,
      top: L.appNodePos.y - halfH,
      bottom: L.appNodePos.y + halfH,
    },
    {
      name: 'AI Agent / API',
      left: L.agentNodePos.x - halfW,
      right: L.agentNodePos.x + halfW,
      top: L.agentNodePos.y - halfH,
      bottom: L.agentNodePos.y + halfH,
    },
    {
      name: 'PostgreSQL',
      left: L.dbNodePos.x - halfW,
      right: L.dbNodePos.x + halfW,
      top: L.dbNodePos.y - halfH,
      bottom: L.dbNodePos.y + halfH,
    },
  ];

  const pill1 = edgePillBox({
    name: 'Edge 1 Pill (POST /v1/agent/analyze • JSON Stream)',
    from: L.edge1.from,
    to: L.edge1.to,
    curveOffsetY: L.edge1.curveOffsetY,
    labelT: L.edge1.labelT,
    labelOffsetX: L.edge1.labelOffsetX,
    labelOffsetY: L.edge1.labelOffsetY,
    estimatedTextChars: 'POST /v1/agent/analyze • JSON Stream'.length,
  });

  const pill2 = edgePillBox({
    name: 'Edge 2 Pill (INSERT INTO insights • pgvector TLS)',
    from: L.edge2.from,
    to: L.edge2.to,
    curveOffsetY: L.edge2.curveOffsetY,
    labelT: L.edge2.labelT,
    labelOffsetX: L.edge2.labelOffsetX,
    labelOffsetY: L.edge2.labelOffsetY,
    estimatedTextChars: 'INSERT INTO insights • pgvector TLS'.length,
  });

  const toast1: Box2D = {
    name: 'CodePayloadToast 1',
    left: L.toast1.x - L.toast1.width / 2,
    right: L.toast1.x + L.toast1.width / 2,
    top: L.toast1.y,
    bottom: L.toast1.y + 176,
  };

  const toast2: Box2D = {
    name: 'CodePayloadToast 2',
    left: L.toast2.x - L.toast2.width / 2,
    right: L.toast2.x + L.toast2.width / 2,
    top: L.toast2.y,
    bottom: L.toast2.y + 176,
  };

  const allInteractive = [...nodeBoxes, pill1, pill2, toast1, toast2];

  // Pairwise clearance between all nodes, pills, and toasts >= 24px
  for (let i = 0; i < allInteractive.length; i++) {
    for (let j = i + 1; j < allInteractive.length; j++) {
      assertMinClearance(allInteractive[i], allInteractive[j], 24);
    }
    assertMinClearance(allInteractive[i], headerBox, 24);
    assertMinClearance(allInteractive[i], captionBox, 24);
  }
});

test('DataFlowEdge exposes optional labelT, labelOffsetX, and zIndex props for precise curve label placement', () => {
  const edgeSrc = fs.readFileSync(
    path.join(repoRoot, 'packages/kits/src/motion-diagrams-2d/DataFlowEdge.tsx'),
    'utf8'
  );
  assert.match(edgeSrc, /labelT\?:\s*number/);
  assert.match(edgeSrc, /labelOffsetX\?:\s*number/);
  assert.match(edgeSrc, /zIndex\?:\s*number/);
});

test('Built-in 3D showcase demos maintain high-contrast HUD icons and unclipped framing defaults', () => {
  const directorSrc = fs.readFileSync(
    path.join(repoRoot, 'examples/director-showcase/DirectorShowcase.tsx'),
    'utf8'
  );
  assert.match(
    directorSrc,
    /<Clapperboard[^>]*color=["']#FFFFFF["']/,
    'DirectorShowcase Clapperboard icon inside accent badge must use crisp #FFFFFF contrast'
  );

  const isoProps = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'examples/isometric-dialogue/IsometricDialogueDemo.props.json'),
      'utf8'
    )
  );
  assert.ok(
    isoProps.cameraZoom <= 145,
    `Expected IsometricDialogueDemo cameraZoom <= 145 so top/bottom room corners never clip 1920x1080 bounds (got ${isoProps.cameraZoom})`
  );
});
