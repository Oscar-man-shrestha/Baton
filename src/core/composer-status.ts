import type { Meter } from './limits';

export function composerStatusText(tokens: number, meter?: Meter): string {
  const prompt = `≈${tokens.toLocaleString('en-US')} prompt tokens`;
  if (meter?.tier === 'banner' && meter.remainingPercent !== undefined) return `${prompt} · ${meter.remainingPercent}% remaining (shown by service)`;
  if (meter?.tier === 'banner' && meter.remainingTokens !== undefined) return `${prompt} · ${meter.remainingTokens.toLocaleString('en-US')} quota tokens left (shown by service)`;
  if (meter?.tier === 'banner' && meter.percent === 100) return `${prompt} · Service reports a limit`;
  return `${prompt} · Free balance unknown`;
}

export function statusLinePosition(editor: DOMRect, viewportWidth: number, viewportHeight: number): { left: number; top: number; width: number } | null {
  const top = editor.bottom + 5;
  if (editor.width < 180 || editor.bottom < 0 || top + 24 > viewportHeight || editor.left >= viewportWidth - 180) return null;
  const left = Math.max(8, editor.left);
  return { left, top, width: Math.min(Math.max(editor.width, 220), viewportWidth - left - 8) };
}
