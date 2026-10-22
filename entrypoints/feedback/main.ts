import { browserName, FEEDBACK_EMAIL, feedbackText, sendFeedback, type Feedback } from '../../src/core/feedback';

// In-extension feedback for people who still use Baton. ?kind=bug|idea|confusing|praise preselects the type.
const form = document.querySelector('#feedback') as HTMLFormElement;
const message = document.querySelector('#message') as HTMLTextAreaElement;
const count = document.querySelector('#count') as HTMLElement;
const status = document.querySelector('#status') as HTMLElement;
const preset = new URLSearchParams(location.search).get('kind');
if (preset) (form.querySelector(`input[name="kind"][value="${CSS.escape(preset)}"]`) as HTMLInputElement | null)?.click();
message.addEventListener('input', () => { count.textContent = `${message.value.length} / 1500`; status.textContent = ''; });

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!message.value.trim()) { status.textContent = 'Write a short message first.'; message.focus(); return; }
  const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  button.disabled = true; status.textContent = 'Sending…';
  const include = (document.querySelector('#include-version') as HTMLInputElement).checked;
  const entry: Feedback = {
    kind: (form.querySelector('input[name="kind"]:checked') as HTMLInputElement).value as Feedback['kind'],
    site: (document.querySelector('#site') as HTMLSelectElement).value || undefined,
    message: message.value,
    ...(include ? { version: chrome.runtime.getManifest().version, browser: browserName(navigator.userAgent, 'brave' in navigator) } : {})
  };
  const sent = await sendFeedback(entry);
  form.hidden = true;
  (document.querySelector('#done') as HTMLElement).hidden = false;
  if (sent) return;
  // Not set up yet or offline: hand the person their message to copy or email.
  const text = feedbackText(entry);
  (document.querySelector('#done-text') as HTMLElement).textContent = 'Sending isn\'t available right now. Copy your message or email it to us, and it will still reach the team.';
  (document.querySelector('#fallback') as HTMLElement).hidden = false;
  (document.querySelector('#email') as HTMLAnchorElement).href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Baton feedback')}&body=${encodeURIComponent(text)}`;
  document.querySelector('#copy')?.addEventListener('click', async click => {
    const target = click.currentTarget as HTMLButtonElement;
    try { await navigator.clipboard.writeText(text); target.textContent = 'Copied'; } catch { target.textContent = 'Could not copy'; }
  });
});
