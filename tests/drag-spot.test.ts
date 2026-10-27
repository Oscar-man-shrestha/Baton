import { describe, expect, it } from 'vitest';
import { clampSpot, fromSpot, readSpots, toSpot } from '../src/core/drag-spot';

describe('dragged button and bar spots', () => {
  it('keeps a dragged element fully on screen', () => {
    expect(clampSpot(-50, -20, 40, 40, 1000, 800)).toEqual([8, 8]);
    expect(clampSpot(990, 790, 40, 40, 1000, 800)).toEqual([952, 752]);
    expect(clampSpot(300, 200, 40, 40, 1000, 800)).toEqual([300, 200]);
  });
  it('restores the same place after the window is resized', () => {
    const spot = toSpot(500, 400, 1000, 800);
    expect(fromSpot(spot, 40, 40, 1000, 800)).toEqual([500, 400]);
    expect(fromSpot(spot, 40, 40, 500, 400)).toEqual([250, 200]);
    expect(fromSpot(toSpot(960, 760, 1000, 800), 40, 40, 400, 300)).toEqual([352, 252]);
  });
  it('ignores stored values that are not spots', () => {
    expect(readSpots(undefined)).toEqual({});
    expect(readSpots({ pass: { x: 0.5, y: 0.2 }, bar: { x: 2, y: 0 } })).toEqual({ pass: { x: 0.5, y: 0.2 } });
    expect(readSpots({ bar: { x: '0.1', y: 0.1 }, other: { x: 0, y: 0 } })).toEqual({});
  });
});
