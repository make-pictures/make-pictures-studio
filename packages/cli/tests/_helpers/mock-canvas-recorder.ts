export interface RecordedFillTextCall {
  text: string;
  x: number;
  y: number;
  maxWidth: number | undefined;
}

export interface MockCanvasRecorder {
  ctx: CanvasRenderingContext2D;
  xs: number[];
  ys: number[];
  paintOps: number;
  gradientCount: number;
  fillTextCalls: RecordedFillTextCall[];
  trace: string[];
}

export function createGeometryRecordingContext(): MockCanvasRecorder {
  const xs: number[] = [];
  const ys: number[] = [];
  const fillTextCalls: RecordedFillTextCall[] = [];
  const trace: string[] = [];
  let paintOps = 0;
  let gradientCount = 0;

  let tx = 0;
  let ty = 0;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  const stack: Array<{
    tx: number;
    ty: number;
    rot: number;
    sx: number;
    sy: number;
  }> = [];

  const recordPt = (lx: number, ly: number) => {
    const scaledX = lx * sx;
    const scaledY = ly * sy;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const wx = tx + scaledX * cosR - scaledY * sinR;
    const wy = ty + scaledX * sinR + scaledY * cosR;
    xs.push(wx);
    ys.push(wy);
  };

  const makeGradient = () => {
    gradientCount += 1;
    return {
      addColorStop(offset: number, color: string) {
        trace.push(`stop:${offset.toFixed(2)}:${color}`);
      },
    };
  };

  const rawCtx: Record<string, unknown> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save() {
      stack.push({ tx, ty, rot, sx, sy });
    },
    restore() {
      const prev = stack.pop();
      if (prev) {
        tx = prev.tx;
        ty = prev.ty;
        rot = prev.rot;
        sx = prev.sx;
        sy = prev.sy;
      }
    },
    translate(dx: number, dy: number) {
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      tx += dx * sx * cosR - dy * sy * sinR;
      ty += dx * sx * sinR + dy * sy * cosR;
    },
    rotate(angle: number) {
      rot += angle;
    },
    scale(nsx: number, nsy: number) {
      sx *= nsx;
      sy *= nsy;
    },
    beginPath() {
      trace.push('beginPath');
    },
    closePath() {
      trace.push('closePath');
    },
    clip() {
      trace.push('clip');
    },
    setLineDash(segments: number[]) {
      trace.push(`dash:${segments.join(',')}`);
    },
    moveTo(x: number, y: number) {
      recordPt(x, y);
      trace.push(`M:${x.toFixed(2)},${y.toFixed(2)}`);
    },
    lineTo(x: number, y: number) {
      recordPt(x, y);
      trace.push(`L:${x.toFixed(2)},${y.toFixed(2)}`);
    },
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
      recordPt(cpx, cpy);
      recordPt(x, y);
      trace.push(
        `Q:${cpx.toFixed(2)},${cpy.toFixed(2)},${x.toFixed(2)},${y.toFixed(2)}`
      );
    },
    bezierCurveTo(
      cp1x: number,
      cp1y: number,
      cp2x: number,
      cp2y: number,
      x: number,
      y: number
    ) {
      recordPt(cp1x, cp1y);
      recordPt(cp2x, cp2y);
      recordPt(x, y);
      trace.push(`C:${x.toFixed(2)},${y.toFixed(2)}`);
    },
    arc(x: number, y: number, r: number, startAngle: number, endAngle: number) {
      recordPt(x + Math.cos(startAngle) * r, y + Math.sin(startAngle) * r);
      recordPt(x + Math.cos(endAngle) * r, y + Math.sin(endAngle) * r);
      const steps = 16;
      for (let i = 1; i < steps; i++) {
        const a = startAngle + ((endAngle - startAngle) * i) / steps;
        recordPt(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      trace.push(`arc:${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)}`);
    },
    ellipse(
      x: number,
      y: number,
      rx: number,
      ry: number,
      rotation: number = 0,
      startAngle: number = 0,
      endAngle: number = Math.PI * 2
    ) {
      const steps = 16;
      const cosE = Math.cos(rotation);
      const sinE = Math.sin(rotation);
      for (let i = 0; i <= steps; i++) {
        const a = startAngle + ((endAngle - startAngle) * i) / steps;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        recordPt(x + ex * cosE - ey * sinE, y + ex * sinE + ey * cosE);
      }
      trace.push(
        `ellipse:${x.toFixed(2)},${y.toFixed(2)},${rx.toFixed(2)},${ry.toFixed(2)}`
      );
    },
    rect(x: number, y: number, w: number, h: number) {
      recordPt(x, y);
      recordPt(x + w, y);
      recordPt(x + w, y + h);
      recordPt(x, y + h);
      trace.push(
        `rect:${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`
      );
    },
    roundRect(x: number, y: number, w: number, h: number) {
      recordPt(x, y);
      recordPt(x + w, y);
      recordPt(x + w, y + h);
      recordPt(x, y + h);
      trace.push(
        `roundRect:${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`
      );
    },
    fill() {
      paintOps += 1;
      trace.push(`fill:${String(rawCtx.fillStyle)}`);
    },
    stroke() {
      paintOps += 1;
      trace.push(`stroke:${String(rawCtx.strokeStyle)}`);
    },
    fillRect(x: number, y: number, w: number, h: number) {
      paintOps += 1;
      recordPt(x, y);
      recordPt(x + w, y + h);
      trace.push(
        `fillRect:${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`
      );
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      paintOps += 1;
      recordPt(x, y);
      recordPt(x + w, y + h);
      trace.push(
        `strokeRect:${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`
      );
    },
    clearRect() {},
    drawImage() {},
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      paintOps += 1;
      recordPt(x, y);
      fillTextCalls.push({ text, x, y, maxWidth });
      trace.push(`fillText:${text}:${maxWidth ?? 'NONE'}`);
    },
    createLinearGradient() {
      return makeGradient();
    },
    createRadialGradient() {
      return makeGradient();
    },
  };

  return {
    ctx: rawCtx as unknown as CanvasRenderingContext2D,
    xs,
    ys,
    get paintOps() {
      return paintOps;
    },
    get gradientCount() {
      return gradientCount;
    },
    fillTextCalls,
    trace,
  };
}
