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
