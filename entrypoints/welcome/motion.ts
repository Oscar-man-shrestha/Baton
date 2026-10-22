import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { fillRings, startDemo } from './demo';

// Entrance and scroll motion for the welcome page. Content is fully visible without it: everything here animates *from*
// a hidden state, and nothing runs when the reader asks for reduced motion.
export function startMotion() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.querySelector<HTMLCanvasElement>('.hero-canvas');
  if (canvas) void startBackdrop(canvas, reduced);
  startDemo(reduced);
  if (reduced) return;
  gsap.registerPlugin(ScrollTrigger);

  // Hero: copy rises in, then the demo plays out like a real chat page.
  const hero = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } });
  hero.from('.hero .eyebrow', { y: 14, opacity: 0, duration: 0.5 })
    .from('.hero h1', { y: 40, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, '-=0.25')
    .from('.hero .lede', { y: 18, opacity: 0 }, '-=0.5')
    .from('.hero .cta > *', { y: 14, opacity: 0, stagger: 0.08, duration: 0.6 }, '-=0.55')
    .from('.demo', { y: 36, opacity: 0, rotateX: 8, transformPerspective: 900, duration: 1 }, 0.15)
    .from('.demo .bubble, .demo .composer', { y: 10, opacity: 0, stagger: 0.18, duration: 0.5 }, 0.6)
    .from('.demo .pass', { scale: 0, opacity: 0, ease: 'back.out(2.2)', duration: 0.6 }, '-=0.1')
    .from('.demo .pill', { x: -12, opacity: 0, duration: 0.45 }, '<0.1')
    .add(() => fillRings(document.querySelectorAll<HTMLElement>('.demo .ring')), '<0.1')
    .to('.demo .pass', { scale: 0.88, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '+=0.6')
    .add(() => (document.querySelector('.demo .pass') as HTMLElement | null)?.click())
    .from('.demo .opt', { x: 10, opacity: 0, stagger: 0.1, duration: 0.4 }, '-=0.2')
    .from('.demo .why', { opacity: 0, duration: 0.5 }, '-=0.1');

  // Sections: heading first, then their cards in a quick cascade as each scrolls in.
  for (const band of gsap.utils.toArray<HTMLElement>('.band')) {
    gsap.timeline({ scrollTrigger: { trigger: band, start: 'top 82%', once: true }, defaults: { ease: 'power3.out' } })
      .from(band.querySelectorAll('.eyebrow, h2'), { y: 24, opacity: 0, stagger: 0.08, duration: 0.6 })
      .from(band.querySelectorAll('.step, .guide article, .rules li'), { y: 28, opacity: 0, stagger: 0.06, duration: 0.6 }, '-=0.3');
  }
  // Lane numbers tick up like a scoreboard.
  for (const num of gsap.utils.toArray<HTMLElement>('.step .num')) {
    gsap.from(num, { scale: 0.4, rotate: -12, opacity: 0, ease: 'back.out(2)', duration: 0.6, scrollTrigger: { trigger: num, start: 'top 85%', once: true } });
  }
  // Coming back to the guide via #guide: make sure what's on screen is already revealed.
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

// The three.js scene loads only when the hero is near the screen and WebGL is there; it stays a still frame for reduced motion.
async function startBackdrop(canvas: HTMLCanvasElement, still: boolean) {
  if (!('WebGL2RenderingContext' in window)) return;
  await new Promise<void>(resolve => {
    const near = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { near.disconnect(); resolve(); } }, { rootMargin: '200px' });
    near.observe(canvas);
  });
  const { startScene } = await import('./scene');
  try { startScene(canvas, still); canvas.classList.add('on'); } catch { /* no WebGL: the CSS gradient stays */ }
}
