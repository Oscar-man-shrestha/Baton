/** Where the user dragged Baton's button or usage bar on one AI site, as fractions of the window so it survives resizes. */
export type Spot = { x: number; y: number };
export type Spots = Partial<Record<'pass' | 'bar', Spot>>;
export const spotsKey = (site: string) => `dragSpots:${site}`;
/** A press that moves less than this is a click, not a drag. */
export const dragThreshold = 5;
const margin = 8;

const fraction = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
export function readSpots(value: unknown): Spots {
  const spots: Spots = {};
  if (!value || typeof value !== 'object') return spots;
  for (const which of ['pass', 'bar'] as const) {
    const spot = (value as Record<string, unknown>)[which] as Record<string, unknown> | undefined;
    if (spot && fraction(spot.x) && fraction(spot.y)) spots[which] = { x: spot.x as number, y: spot.y as number };
  }
  return spots;
}
/** Keeps the whole element inside the window, 8 px from each edge where it fits. */
export function clampSpot(left: number, top: number, width: number, height: number, viewWidth: number, viewHeight: number): [number, number] {
  const fit = (value: number, size: number, view: number) => Math.round(Math.max(margin, Math.min(value, view - size - margin)));
  return [fit(left, width, viewWidth), fit(top, height, viewHeight)];
}
export function toSpot(left: number, top: number, viewWidth: number, viewHeight: number): Spot {
  return { x: Math.max(0, Math.min(1, left / viewWidth)), y: Math.max(0, Math.min(1, top / viewHeight)) };
}
export function fromSpot(spot: Spot, width: number, height: number, viewWidth: number, viewHeight: number): [number, number] {
  return clampSpot(spot.x * viewWidth, spot.y * viewHeight, width, height, viewWidth, viewHeight);
}
