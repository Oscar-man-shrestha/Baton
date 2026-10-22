# Baton Pass landing page

- `page.html`: the page source (also published as a private preview on claude.ai).
- `index.html`: the same page as a full document, for GitHub Pages or any static host. Rebuild it after editing `page.html` with `npm run build:site`.

Libraries load from CDNs, pinned to exact versions: GSAP 3.12.5 (with ScrollTrigger and Flip), Lenis 1.1.13 and three.js 0.149.0. Fonts load from Google Fonts. Everything else is inline. With reduced motion turned on, smooth scrolling and animation are off, and the 3D track is drawn as one still frame.
