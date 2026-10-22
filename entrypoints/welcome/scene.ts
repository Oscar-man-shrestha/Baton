import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, PerspectiveCamera, Points, PointsMaterial, Scene, WebGLRenderer } from 'three';

// Hero backdrop: a relay track drawn in violet dots, with a glowing baton running laps and passing between lanes.
// Loaded on demand; runs only while the hero is on screen and the tab is visible. Returns a stop function.
export function startScene(canvas: HTMLCanvasElement, still: boolean): () => void {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 100);
  const world = new Group(); scene.add(world);

  // One soft round sprite for every dot, drawn here so the page needs no image file.
  const dot = document.createElement('canvas'); dot.width = dot.height = 64;
  const g = dot.getContext('2d')!; const fill = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  fill.addColorStop(0, 'rgba(255,255,255,1)'); fill.addColorStop(0.35, 'rgba(255,255,255,.55)'); fill.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fill; g.fillRect(0, 0, 64, 64);
  const sprite = new CanvasTexture(dot);
  const material = (size: number, opacity: number) => new PointsMaterial({ size, map: sprite, vertexColors: true, transparent: true, opacity, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true });
  const cloud = (positions: number[], colors: number[], mat: PointsMaterial) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    const points = new Points(geometry, mat); world.add(points); return points;
  };

  // Six lanes: ellipses on the ground plane, inner lane brightest.
  const violet = new Color('#8b6cff'), soft = new Color('#c4b5ff'), tartan = new Color('#ff6b4a');
  const lanes = 6, laneRadius = (lane: number) => [5.2 + lane * 0.55, 2.6 + lane * 0.55] as const;
  const trackPos: number[] = [], trackCol: number[] = [];
  for (let lane = 0; lane < lanes; lane++) {
    const [rx, rz] = laneRadius(lane), count = 150 + lane * 14, tint = violet.clone().lerp(soft, lane / lanes).multiplyScalar(0.9 - lane * 0.08);
    for (let i = 0; i < count; i++) { const a = (i / count) * Math.PI * 2; trackPos.push(Math.cos(a) * rx, 0, Math.sin(a) * rz); trackCol.push(tint.r, tint.g, tint.b); }
  }
  // Start line across the lanes, in the track's tartan.
  for (let i = 0; i <= 24; i++) { trackPos.push(5.2 + (i / 24) * (lanes - 1) * 0.55, 0, 0); trackCol.push(tartan.r * 0.8, tartan.g * 0.8, tartan.b * 0.8); }
  cloud(trackPos, trackCol, material(0.11, 0.85));

  // Dust drifting above the track.
  const dustPos: number[] = [], dustCol: number[] = [];
  for (let i = 0; i < 420; i++) {
    dustPos.push((Math.random() - 0.5) * 26, Math.random() * 7 - 1.5, (Math.random() - 0.5) * 16);
    const c = violet.clone().lerp(soft, Math.random()).multiplyScalar(0.35 + Math.random() * 0.4); dustCol.push(c.r, c.g, c.b);
  }
  const dust = cloud(dustPos, dustCol, material(0.07, 0.7));

  // The baton: a bright head with a fading trail.
  const trail = 46, runPos = new Float32Array(trail * 3), runCol: number[] = [];
  for (let i = 0; i < trail; i++) { const k = 1 - i / trail, c = soft.clone().lerp(violet, i / trail).multiplyScalar(k * k * 1.6); runCol.push(c.r, c.g, c.b); }
  const runner = cloud(Array.from(runPos), runCol, material(0.34, 1));
  const runAttr = runner.geometry.getAttribute('position') as BufferAttribute;

  world.rotation.x = 0.08;
  let pointerX = 0, pointerY = 0;
  const onPointer = (event: PointerEvent) => { pointerX = event.clientX / innerWidth - 0.5; pointerY = event.clientY / innerHeight - 0.5; };
  addEventListener('pointermove', onPointer, { passive: true });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // Narrow screens see the track from further back so it still fits.
    camera.position.set(0, 5.4, w / h < 1 ? 17 : 12.5); camera.updateProjectionMatrix();
    // Side by side, the track circles the demo card rather than running under the headline.
    world.position.x = w / h > 1.2 ? 4.2 : 0;
  };
  const sizer = new ResizeObserver(resize); sizer.observe(canvas); resize();

  // Lane the runner is in eases toward a target lane that changes every lap or so: the hand-off.
  let lane = 1, targetLane = 1, nextPass = 4;
  const frame = (t: number) => {
    const s = t / 1000;
    if (s > nextPass) { targetLane = (targetLane + 1 + Math.floor(Math.random() * 3)) % lanes; nextPass = s + 3.5 + Math.random() * 2; }
    lane += (targetLane - lane) * 0.02;
    for (let i = 0; i < trail; i++) {
      const a = s * 0.55 - i * 0.022, [rx, rz] = laneRadius(lane);
      runAttr.setXYZ(i, Math.cos(a) * rx, 0.12, Math.sin(a) * rz);
    }
    runAttr.needsUpdate = true;
    dust.rotation.y = s * 0.02;
    world.rotation.y = -0.35 + Math.sin(s * 0.12) * 0.08;
    camera.position.x += (pointerX * 1.6 - camera.position.x) * 0.04;
    camera.position.y += (5.4 - pointerY * 1.2 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };

  let raf = 0, running = false;
  const loop = (t: number) => { frame(t); raf = requestAnimationFrame(loop); };
  const play = () => { if (!running && !still) { running = true; raf = requestAnimationFrame(loop); } };
  const pause = () => { running = false; cancelAnimationFrame(raf); };
  frame(9000);
  // Runs only while visible: off-screen hero or a hidden tab costs nothing.
  let onScreen = true;
  const sync = () => (onScreen && !document.hidden ? play() : pause());
  const seen = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }); seen.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  sync();

  return () => {
    pause(); seen.disconnect(); sizer.disconnect();
    document.removeEventListener('visibilitychange', sync); removeEventListener('pointermove', onPointer);
    renderer.dispose(); sprite.dispose();
  };
}
