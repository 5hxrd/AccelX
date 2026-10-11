export type CurvePoint = [number, number];
export interface EngineParams { baseSens: number; yRatio: number }

export const X_MAX = 20;
export const Y_MAX = 4;
export const X_POW = 0.6;
export const MAX_POINTS = 32;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Fritsch–Carlson monotone tangents */
export function monotoneTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const X = (i: number) => xs[i]!, Y = (i: number) => ys[i]!;
  if (n < 2) return new Array<number>(n).fill(0);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((Y(i + 1) - Y(i)) / (X(i + 1) - X(i) || 1e-6));
  const D = (i: number) => d[i]!;
  const m = new Array<number>(n).fill(0);
  m[0] = D(0);
  m[n - 1] = D(n - 2);
  for (let i = 1; i < n - 1; i++) m[i] = D(i - 1) * D(i) <= 0 ? 0 : (D(i - 1) + D(i)) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (D(i) === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i]! / D(i), b = m[i + 1]! / D(i);
    const sq = a * a + b * b;
    if (sq > 9) { const t = 3 / Math.sqrt(sq); m[i] = t * a * D(i); m[i + 1] = t * b * D(i); }
  }
  return m;
}

export function evaluateCurve(points: CurvePoint[], speed: number): number {
  const n = points.length;
  if (n === 0) return 1;
  const first = points[0]!, last = points[n - 1]!;
  if (n === 1 || speed <= first[0]) return first[1];
  if (speed >= last[0]) return last[1];
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const m = monotoneTangents(xs, ys);
  let i = 0;
  while (i < n - 2 && speed > xs[i + 1]!) i++;
  const x0 = xs[i]!, x1 = xs[i + 1]!, y0 = ys[i]!, y1 = ys[i + 1]!, m0 = m[i]!, m1 = m[i + 1]!;
  const h = x1 - x0 || 1e-6;
  const t = (speed - x0) / h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1;
}

export function computeMultiplier(points: CurvePoint[], speed: number, params: EngineParams): number {
  return clamp(evaluateCurve(points, speed), 0, Y_MAX) * params.baseSens;
}

/** power-scaled x position 0..1 */
export const xToT = (x: number) => Math.pow(clamp(x, 0, X_MAX) / X_MAX, X_POW);
export const tToX = (t: number) => X_MAX * Math.pow(clamp(t, 0, 1), 1 / X_POW);

export function sampleCurve(points: CurvePoint[], n = 140): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(clamp(evaluateCurve(points, tToX(i / (n - 1))), 0, Y_MAX));
  return out;
}
