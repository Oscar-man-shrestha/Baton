import type { ProviderId } from './selectors';

/**
 * “Same AI, another account”: Baton saves the project, the user switches account in the service's own screens,
 * and the next new chat on that AI offers the project as a draft. Baton never signs anyone in or out.
 */
export type PendingProject = { provider: ProviderId; draft: string; at: number; from: string; title?: string };
export const pendingKey = (provider: ProviderId) => `pendingProject:${provider}`;
/** A waiting project is offered for six hours, then forgotten (it stays saved as a baton). */
export const PENDING_MS = 6 * 3600000;

export function pendingFor(value: unknown, provider: ProviderId, now = Date.now()): PendingProject | undefined {
  const pending = value as PendingProject | undefined;
  if (!pending || pending.provider !== provider || typeof pending.draft !== 'string' || !pending.draft.trim()) return;
  if (!(now - pending.at >= 0 && now - pending.at < PENDING_MS)) return;
  return pending;
}

/** Offer it on a fresh chat only: not on the chat it came from, and not where a conversation has already started. */
export function shouldOffer(pending: PendingProject | undefined, here: { url: string; turnCount: number; hasEditor: boolean }): boolean {
  return !!pending && here.hasEditor && here.turnCount === 0 && here.url !== pending.from;
}

export type SwitchHelp = { chooser?: string; steps: string[] };
const where: Partial<Record<ProviderId, string>> = {
  chatgpt: 'your profile picture (bottom left) → Log out',
  claude: 'your name (bottom left) → Log out',
  deepseek: 'your profile (bottom left) → Log out',
  grok: 'your profile picture → Sign out',
  perplexity: 'your account (bottom left) → Sign out'
};
/** Steps in each service's own screens. Gemini uses Google's account chooser, so several accounts can stay signed in. */
export function switchHelp(provider: ProviderId): SwitchHelp {
  if (provider === 'gemini') return {
    chooser: 'https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fgemini.google.com%2Fapp',
    steps: ['Pick your other Google account in Google’s window (or add one).', 'Gemini opens in that account. Baton offers your project there.']
  };
  return { steps: [`Open ${where[provider] || 'the account menu → Log out'}.`, 'Sign in again and choose your other account (for example “Continue with Google”).', 'Open a new chat. Baton offers your project there.'] };
}
