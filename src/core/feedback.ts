import { z } from 'zod';
import config from '../config/cloud.json';

/**
 * Feedback goes to the project's own Supabase table `baton_feedback` (insert-only; see supabase/feedback.sql).
 * Only what the person chose to send: a kind, an optional reason and message, which AI site, Baton's version and
 * browser name. Never chat text.
 */
export const feedbackSchema = z.object({
  kind: z.enum(['uninstall', 'bug', 'idea', 'confusing', 'praise', 'checkin']),
  reason: z.string().max(40).optional(),
  message: z.string().max(1500).optional(),
  site: z.string().max(20).optional(),
  version: z.string().max(20).optional(),
  browser: z.string().max(20).optional()
});
export type Feedback = z.infer<typeof feedbackSchema>;
export const FEEDBACK_EMAIL = 'batonforai@gmail.com';

/** Trim, cap and drop empty fields, then validate. */
export function cleanFeedback(input: Feedback): Feedback {
  const tidy = (value: string | undefined, max: number) => { const text = (value || '').replace(/\s+\n/g, '\n').trim().slice(0, max); return text || undefined; };
  return feedbackSchema.parse({ kind: input.kind, reason: tidy(input.reason, 40), message: tidy(input.message, 1500), site: tidy(input.site, 20), version: tidy(input.version, 20), browser: tidy(input.browser, 20) });
}

export function browserName(userAgent: string, brave = false): string {
  return brave ? 'Brave' : /Edg\//.test(userAgent) ? 'Edge' : /OPR\//.test(userAgent) ? 'Opera' : /Chrome\//.test(userAgent) ? 'Chrome' : 'Other';
}

/** True when the row was stored. False means: not set up yet, offline, or refused; the caller offers copy or email. */
export async function sendFeedback(input: Feedback, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) || !config.publishableKey) return false;
  try {
    const response = await fetcher(`${config.url}/rest/v1/baton_feedback`, {
      method: 'POST',
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(cleanFeedback(input))
    });
    return response.ok;
  } catch { return false; }
}

/** The same answer as plain text, for copying or emailing when sending isn't possible. */
export const feedbackText = (input: Feedback) => [`Baton feedback (${input.kind})`, input.reason && `Reason: ${input.reason}`, input.site && `Site: ${input.site}`, input.version && `Version: ${input.version}`, input.browser && `Browser: ${input.browser}`, input.message].filter(Boolean).join('\n');
