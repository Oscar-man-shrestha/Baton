import { gsap } from 'gsap';

// The hero demo shows what Baton really draws on each AI: rings where the service publishes its limits,
// a plain daily count where it doesn't (ChatGPT). Tabs switch sites; it also cycles on its own until touched.
type Segment = { label: string; left?: number; value?: string; note: string };
type Option = { name: string; color: string; why: string };
type Site = { url: string; you: string; ai: string; placeholder: string; topic: 'Code' | 'Research' | 'Writing'; segments: Segment[]; options: Option[]; why: string };
const sites: Record<string, Site> = {
  claude: {
    url: 'claude.ai', you: 'Fix the login bug in my Flask app.', ai: 'Your route reads <code>request.json</code>, but the form sends form data…', placeholder: 'Reply to Claude…', topic: 'Code',
    segments: [{ label: 'Weekly', left: 46, note: '1d 22h' }, { label: 'Session', left: 66, note: '4h 19m' }],
    options: [{ name: 'DeepSeek', color: '#4d6bfe', why: 'strong at code' }, { name: 'ChatGPT', color: '#10a37f', why: 'good all-rounder' }],
    why: 'Claude shows its own session and weekly limits. Baton reads them from there.'
  },
  gemini: {
    url: 'gemini.google.com', you: 'Plan three days in Lisbon in May.', ai: 'Day 1: Alfama and the castle at sunset, then dinner in Bairro Alto…', placeholder: 'Ask Gemini', topic: 'Research',
    segments: [{ label: 'Session', left: 72, note: '3h 05m' }, { label: 'Weekly', left: 18, note: '4d 6h' }],
    options: [{ name: 'Perplexity', color: '#20b8cd', why: 'best for research' }, { name: 'Claude', color: '#d97757', why: 'careful reasoning' }],
    why: 'Gemini lists current and weekly usage on its Usage limits page. Baton reads both.'
  },
  chatgpt: {
    url: 'chatgpt.com', you: 'Write a cover letter for a design job.', ai: 'Dear hiring team, I’m a product designer who loves turning messy problems into…', placeholder: 'Message ChatGPT', topic: 'Writing',
    segments: [{ label: 'Chat', value: 'No cap', note: '4 today' }, { label: 'Work 5h', left: 82, note: '3h 12m' }, { label: 'Work week', left: 64, note: '5d 2h' }],
    options: [{ name: 'Claude', color: '#d97757', why: 'top-rated for writing' }, { name: 'Gemini', color: '#4c8df6', why: 'long, polished drafts' }],
    why: 'Chat has no cap, so Baton counts today’s messages. Work 5h and week are ChatGPT’s Plan limits (Codex, Work, Agents) from its Usage page.'
  }
};
const order = Object.keys(sites);

const el = (tag: string, className?: string, text?: string) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const ringTone = (left: number) => (left >= 50 ? 'ok' : left >= 20 ? 'mid' : 'low');
/** Rings fill from empty to what is left, as they do when Baton reads a page. */
export const fillRings = (rings: ArrayLike<HTMLElement>) => {
  for (const ring of Array.from(rings)) {
    const to = Number(ring.dataset.left ?? ring.style.getPropertyValue('--p')); ring.dataset.left = String(to);
    const value = { p: 0 };
    gsap.to(value, { p: to, duration: 0.9, ease: 'power2.out', onUpdate: () => ring.style.setProperty('--p', value.p.toFixed(1)) });
  }
};

export function startDemo(reduced: boolean) {
  const demo = document.querySelector<HTMLElement>('.demo');
  if (!demo) return;
  const q = <T extends HTMLElement>(selector: string) => demo.querySelector(selector) as T;
  const tabs = Array.from(demo.querySelectorAll<HTMLButtonElement>('.tabs [data-site]'));
  let current = 'claude';

  const render = (id: string) => {
    const site = sites[id];
    q('.url').textContent = site.url;
    q('.bubble.you').textContent = site.you;
    q('.bubble.ai').innerHTML = site.ai;
    q('.ph').textContent = site.placeholder;
    q('.why').textContent = site.why;
    const segs = q('.segs'); segs.replaceChildren();
    for (const segment of site.segments) {
      const seg = el('span', 'seg'); seg.append(el('span', 'k', segment.label));
      if (segment.left !== undefined) {
        const ring = el('span', `ring ${ringTone(segment.left)}`); ring.style.setProperty('--p', String(segment.left));
        seg.append(ring, el('b', '', `${segment.left}%`), el('span', 'u', 'left'));
      } else seg.append(el('b', '', segment.value));
      seg.append(el('span', 'n', segment.note)); segs.append(seg);
    }
    demo.querySelectorAll('.chip').forEach(chip => chip.classList.toggle('on', chip.textContent === site.topic));
    demo.querySelectorAll('.opt').forEach((opt, index) => {
      const option = site.options[index]; if (!option) return;
      (opt.querySelector('i') as HTMLElement).style.setProperty('--c', option.color);
      opt.childNodes[1].textContent = option.name;
      (opt.querySelector('small') as HTMLElement).textContent = option.why;
    });
    for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.site === id));
  };

  // The menu opens over the chat like a real click on the button, so the conversation shows first.
  const pass = q<HTMLButtonElement>('.pass');
  const setOpen = (open: boolean) => { demo.classList.toggle('open', open); pass.setAttribute('aria-expanded', String(open)); };
  pass.addEventListener('click', () => setOpen(!demo.classList.contains('open')));

  const show = (id: string) => {
    if (id === current) return;
    current = id;
    setOpen(false);
    if (reduced) { render(id); return; }
    const parts = demo.querySelectorAll('.url, .convo, .pill, .composer, .why');
    gsap.timeline()
      .to(parts, { opacity: 0, y: 6, duration: 0.2, stagger: 0.02, ease: 'power1.in' }, 0.15)
      .add(() => render(id))
      .to(parts, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' })
      .add(() => fillRings(demo.querySelectorAll<HTMLElement>('.ring')), '-=0.3')
      .to(pass, { scale: 0.88, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '+=1.1')
      .add(() => setOpen(true));
  };

  // Cycles every few seconds until the reader picks a tab, hovers or focuses the card, or the tab is hidden.
  let picked = false, paused = false;
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { picked = true; show(tab.dataset.site!); });
    tab.addEventListener('keydown', event => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!step) return;
      const next = tabs[(index + step + tabs.length) % tabs.length]; next.focus(); next.click();
    });
  });
  demo.addEventListener('pointerenter', () => { paused = true; });
  demo.addEventListener('pointerleave', () => { paused = false; });
  demo.addEventListener('focusin', () => { paused = true; });
  demo.addEventListener('focusout', () => { paused = false; });
  if (!reduced) setInterval(() => { if (!picked && !paused && !document.hidden) show(order[(order.indexOf(current) + 1) % order.length]); }, 7000);
}
