import type { Meter } from './limits';

export function composerStatusText(tokens: number, meter?: Meter): string {
  const prompt = tokens > 0 ? `≈${tokens.toLocaleString('en-US')} prompt tokens · ` : '';
  const source = meter?.at && Date.now() - meter.at > 300000 ? 'last seen' : 'service notice';
  if (meter?.tier === 'banner' && meter.remainingPercent !== undefined) return `${prompt}Usage left: ${meter.remainingPercent}% (${source})`;
  if (meter?.tier === 'banner' && meter.remainingTokens !== undefined) return `${prompt}Usage left: ${meter.remainingTokens.toLocaleString('en-US')} tokens (${source})`;
  if (meter?.tier === 'banner' && meter.remainingCount !== undefined && meter.percent !== 100) return `${prompt}${meter.remainingCount} ${meter.feature === 'Pro searches' ? 'Pro searches' : meter.remainingCount === 1 ? 'message' : 'messages'} left (${source})`;
  if (meter?.tier === 'banner' && meter.percent === 100) return `${prompt}Usage limit reached (service notice)`;
  if (meter?.tier === 'banner' && meter.nearLimit) return `${prompt}Near usage limit (service notice)`;
  return `${prompt}Usage left: unknown`;
}

export function statusLinePosition(editor: DOMRect, viewportWidth: number, viewportHeight: number): { left: number; top: number; width: number } | null {
  const top = editor.bottom + 2;
  if (editor.width < 180 || editor.bottom < 0 || top + 19 > viewportHeight || editor.left >= viewportWidth - 180) return null;
  const left = Math.max(8, editor.left);
  return { left, top, width: Math.min(Math.max(editor.width, 220), viewportWidth - left - 8) };
}
