import { clamp, X_POW } from "./curve";

export interface GraphRange { xMin: number; xMax: number; yMin: number; yMax: number }
export interface GraphView { xMin: number; xMax: number; yMin: number; yMax: number }
export const DEFAULT_RANGE: GraphRange = { xMin: 0, xMax: 20, yMin: 0, yMax: 4 };
export const speedSpace = (x: number, curved: boolean) => curved ? Math.pow(Math.max(0, x), X_POW) : x;
export const spaceSpeed = (x: number, curved: boolean) => curved ? Math.pow(Math.max(0, x), 1 / X_POW) : x;
export const rangeView = (range: GraphRange, curved: boolean): GraphView => ({ ...range, xMin: speedSpace(range.xMin, curved), xMax: speedSpace(range.xMax, curved) });

function boundedAxis(min: number, max: number, lo: number, hi: number): [number, number] {
  const span = clamp(max - min, (hi - lo) / 1000, hi - lo);
  const start = clamp(min, lo, hi - span);
  return [start, start + span];
}
export function zoomView(view: GraphView, bounds: GraphView, factor: number, ax: number, ay: number, x = true, y = true): GraphView {
  const zoom = (lo: number, hi: number, blo: number, bhi: number, anchor: number): [number, number] => {
    const span = clamp((hi - lo) * factor, (bhi - blo) / 1000, bhi - blo);
    const point = lo + anchor * (hi - lo);
    return boundedAxis(point - anchor * span, point + (1 - anchor) * span, blo, bhi);
  };
  const [xMin, xMax] = x ? zoom(view.xMin, view.xMax, bounds.xMin, bounds.xMax, ax) : [view.xMin, view.xMax];
  const [yMin, yMax] = y ? zoom(view.yMin, view.yMax, bounds.yMin, bounds.yMax, ay) : [view.yMin, view.yMax];
  return { xMin, xMax, yMin, yMax };
}
export function panView(view: GraphView, bounds: GraphView, dx: number, dy: number): GraphView {
  const [xMin, xMax] = boundedAxis(view.xMin + dx, view.xMax + dx, bounds.xMin, bounds.xMax);
  const [yMin, yMax] = boundedAxis(view.yMin + dy, view.yMax + dy, bounds.yMin, bounds.yMax);
  return { xMin, xMax, yMin, yMax };
}
export function ticks(min: number, max: number, step?: number): number[] {
  const raw = (max - min) / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 5, 10].find((n) => n * power >= raw) ?? 10;
  // Limit grid density without changing the requested tick spacing.
  const spacing = step && step > 0 ? step : nice * power;
  const count = Math.floor((max - min) / spacing);
  const stride = Math.max(1, Math.ceil(count / 100));
  const start = Math.ceil((min - spacing * 1e-8) / spacing) * spacing;
  const out: number[] = [];
  for (let n = start; n <= max + spacing * 1e-8 && out.length < 102; n += spacing * stride) out.push(Number(n.toPrecision(12)));
  return out;
}
export const tickLabel = (value: number) => Number(value.toPrecision(6)).toString();