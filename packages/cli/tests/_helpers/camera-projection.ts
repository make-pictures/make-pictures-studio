export function projectPoint(
  camPos: [number, number, number],
  lookAt: [number, number, number],
  fovDeg: number,
  width: number,
  height: number,
  pt: [number, number, number]
): { px: number; py: number } {
  const fx = lookAt[0] - camPos[0];
  const fy = lookAt[1] - camPos[1];
  const fz = lookAt[2] - camPos[2];
  const fLen = Math.hypot(fx, fy, fz);
  const fwd = [fx / fLen, fy / fLen, fz / fLen];
  const rxRaw = -fwd[2];
  const rzRaw = fwd[0];
  const rLen = Math.hypot(rxRaw, rzRaw);
  const right = [rxRaw / rLen, 0, rzRaw / rLen];
  const up = [
    right[1]! * fwd[2]! - right[2]! * fwd[1]!,
    right[2]! * fwd[0]! - right[0]! * fwd[2]!,
    right[0]! * fwd[1]! - right[1]! * fwd[0]!,
  ];
  const dx = pt[0] - camPos[0];
  const dy = pt[1] - camPos[1];
  const dz = pt[2] - camPos[2];
  const cx = dx * right[0]! + dy * right[1]! + dz * right[2]!;
  const cy = dx * up[0]! + dy * up[1]! + dz * up[2]!;
  const cz = dx * fwd[0]! + dy * fwd[1]! + dz * fwd[2]!;
  const tanHalfY = Math.tan((fovDeg * Math.PI) / 360);
  const tanHalfX = (width / height) * tanHalfY;
  const ndcX = cx / (cz * tanHalfX);
  const ndcY = cy / (cz * tanHalfY);
  return {
    px: (ndcX + 1) * 0.5 * width,
    py: (1 - ndcY) * 0.5 * height,
  };
}
