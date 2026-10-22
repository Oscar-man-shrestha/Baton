import { describe, expect, it } from 'vitest';
import { composerStatusText, statusLinePosition } from '../src/core/composer-status';
import { estimateMeter } from '../src/core/limits';

describe('composer status line', () => {
  it('keeps quota unknown unless the service visibly reports it', () => {
    expect(composerStatusText(37, estimateMeter('claude', '', []))).toContain('Usage left: unknown');
    expect(composerStatusText(37, estimateMeter('claude', 'Usage quota: 42% remaining', []))).toContain('Usage left: 42% (service notice)');
    expect(composerStatusText(0, estimateMeter('claude', '', []))).toBe('Usage left: unknown');
  });
  it('hides when there is no room below the composer', () => {
    const rect = { left: 20, bottom: 490, width: 500 } as DOMRect;
    expect(statusLinePosition(rect, 800, 500)).toBeNull();
    expect(statusLinePosition({ ...rect, bottom: 400 } as DOMRect, 800, 500)?.top).toBe(402);
    expect(statusLinePosition({ ...rect, bottom: 479 } as DOMRect, 800, 500)?.top).toBe(481);
  });
});

import { statusLineAbove } from '../src/core/composer-status';
describe('status line above the composer', () => {
  const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
  it('sits just above the composer when there is room', () => {
    expect(statusLineAbove(rect(300, 700, 600, 90), 1440)).toEqual({ left: 300, top: 679, width: 600 });
  });
  it('gives up when the composer is at the very top, too narrow, or off to the right', () => {
    expect(statusLineAbove(rect(300, 10, 600, 90), 1440)).toBeNull();
    expect(statusLineAbove(rect(300, 700, 120, 90), 1440)).toBeNull();
    expect(statusLineAbove(rect(1300, 700, 600, 90), 1440)).toBeNull();
  });
});
