import type { ProviderId } from './selectors';
import { providerNames, type LimitState, type RescueOption } from './rescue';
import { resetCountdown } from './usage-windows';

export type RescueHandlers = { continueIn: (provider: ProviderId) => Promise<string>; switchAccount: () => Promise<string>; remind: () => Promise<string>; dismiss: () => void };

export const rescueCardStyle = ':host{all:initial}.card{box-sizing:border-box;width:100%;padding:11px 12px;border-radius:12px;background:#1b1d2b;color:#f4f5fb;border:1px solid #3a3d55;box-shadow:0 6px 24px #0006;font:12px/1.4 system-ui,-apple-system,sans-serif}.top{display:flex;gap:8px;align-items:flex-start}.top strong{flex:1;font-size:13px}.top small{display:block;font-weight:400;color:#b9bdd4;font-size:11px;margin-top:2px}button{font:inherit;color:inherit;cursor:pointer;border:1px solid #474b68;background:#262940;border-radius:8px;padding:6px 9px}button:hover:not(:disabled){background:#30344f}button:disabled{opacity:.55;cursor:default}button:focus-visible{outline:2px solid #a99aff;outline-offset:1px}.options{display:grid;gap:6px;margin:9px 0 7px}.options button{display:flex;justify-content:space-between;gap:8px;text-align:left}.options button span{color:#b9bdd4}.options .room{border-color:#8c7bff}.row{display:flex;flex-wrap:wrap;gap:6px}.close{border:0;background:transparent;padding:0 4px;font-size:16px;line-height:1;color:#b9bdd4}.status{margin:7px 0 0;color:#cfd2e6;font-size:11px}.status:empty{display:none}@media(prefers-color-scheme:light){.card{background:#fff;color:#1d1f2c;border-color:#d4d6e4}button{background:#f3f3f9;border-color:#cfd1e0}button:hover:not(:disabled){background:#e9e9f3}.top small,.options button span,.close,.status{color:#5a5e75}}@media(prefers-reduced-motion:no-preference){.card{animation:in .18s ease-out}@keyframes in{from{opacity:0;transform:translateY(4px)}}}';

/** The card a limit notice opens: continue elsewhere, switch account in the service's own screens, or a reset reminder. Never sends anything. */
export function buildRescueCard(doc: Document, limit: LimitState, options: RescueOption[], handlers: RescueHandlers, now = Date.now()): HTMLElement {
  const card = doc.createElement('section');
  card.className = 'card';
  card.setAttribute('aria-label', `${providerNames[limit.provider]} limit reached. Continue with Baton.`);
  const top = doc.createElement('div'); top.className = 'top';
  const title = doc.createElement('strong');
  title.textContent = `${providerNames[limit.provider]} limit reached`;
  const sub = doc.createElement('small');
  sub.textContent = `${limit.resetAt ? `Back in ${resetCountdown(limit.resetAt, now)} (${new Date(limit.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'Reset time not shown'} · continue without re-explaining. Drafts are never sent for you.`;
  title.append(sub);
  const close = doc.createElement('button'); close.type = 'button'; close.className = 'close'; close.textContent = '×'; close.setAttribute('aria-label', 'Dismiss until the limit changes');
  close.addEventListener('click', handlers.dismiss);
  top.append(title, close);
  const status = doc.createElement('p'); status.className = 'status'; status.setAttribute('role', 'status');
  const buttons: HTMLButtonElement[] = [];
  const run = (button: HTMLButtonElement, action: () => Promise<string>) => button.addEventListener('click', async () => {
    buttons.forEach(other => { other.disabled = true; });
    status.textContent = 'Working…';
    try { status.textContent = await action(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'That did not work. Try again or open Baton.'; }
    finally { buttons.forEach(other => { other.disabled = other.dataset.locked === 'true'; }); }
  });
  const list = doc.createElement('div'); list.className = 'options';
  for (const option of options.slice(0, 3)) {
    const button = doc.createElement('button'); button.type = 'button'; button.className = option.status;
    const name = doc.createElement('strong'); name.textContent = `Continue in ${providerNames[option.provider]}`;
    const detail = doc.createElement('span'); detail.textContent = option.detail;
    button.append(name, detail);
    if (option.status === 'limited') { button.disabled = true; button.dataset.locked = 'true'; }
    run(button, () => handlers.continueIn(option.provider));
    buttons.push(button); list.append(button);
  }
  const row = doc.createElement('div'); row.className = 'row';
  const switchButton = doc.createElement('button'); switchButton.type = 'button'; switchButton.textContent = `Switch ${providerNames[limit.provider]} account`;
  run(switchButton, handlers.switchAccount); buttons.push(switchButton); row.append(switchButton);
  if (limit.resetAt) {
    const remind = doc.createElement('button'); remind.type = 'button'; remind.textContent = 'Remind me when it resets';
    run(remind, handlers.remind); buttons.push(remind); row.append(remind);
  }
  card.append(top, ...(options.length ? [list] : []), row, status);
  return card;
}
