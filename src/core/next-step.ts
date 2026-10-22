import { redact } from './brief';

/** The user's “What's next?” line, added to the end of a draft (keys and personal data are redacted, length capped). */
export function withNextStep(draft: string, next?: string): string {
  const step = (next || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  return step ? `${draft}\n\nNext task from the user: ${redact(step).text}` : draft;
}
