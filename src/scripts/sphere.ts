/**
 * The language sphere — real DOM elements, projected by hand.
 *
 * Each logo sits on a Fibonacci-distributed sphere; every frame we rotate the
 * points and project them with a simple perspective divide, then write a 2D
 * transform. No WebGL and no 3D CSS: the logos stay vector-crisp, inherit
 * `currentColor` (so a theme change costs nothing), and remain real elements
 * for screen readers and text search.
 */
const PERSPECTIVE = 900;
const IDLE_SPIN = 0.0022;
/** Radians per pixel dragged. True 1:1 surface tracking would be 1/radius,
 *  about 0.0045 here; a little above that reads as responsive. */
const DRAG_SPEED = 0.008;
/** Ceiling on the spin a flick can leave behind, in radians per frame. */
const MAX_THROW = 0.08;

export function initSphere(stage: HTMLElement): () => void {
  const items = [...stage.querySelectorAll<HTMLElement>('[data-language]')];
  if (items.length === 0) return () => {};

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Fibonacci sphere. Note `(2i + 1) / n` rather than `i / (n - 1)`: the
  // latter puts the first and last point exactly on a pole, and the idle spin
  // opens turning about an axis close to the pole, so those two logos would
  // barely move while everything else turns.
  const golden = Math.PI * (3 - Math.sqrt(5));

  const points = items.map((_, i) => {
    const y = 1 - (2 * i + 1) / items.length;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
  });

  // Shuffle which logo lands in which slot so the sphere is laid out
  // differently on every load. DOM order stays alphabetical for anyone
  // reading it as a list.
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }

  let radius = 0;
  const measure = () => {
    const box = stage.getBoundingClientRect();
    radius = Math.max(120, Math.min(box.width, box.height) / 2 - 56);
  };
  measure();

  // Attitude as a row-major rotation matrix, turned about the screen's own
  // axes. Euler angles would turn a horizontal drag about the sphere's pole,
  // which lags as the sphere tips, stalls at 90° and runs backwards past it;
  // this way the near face follows the pointer at any attitude. Float64 drift
  // stays under 1e-12 after days of frames, so it is never re-orthonormalised.
  const m = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /** Rotates m in the plane of screen axes a and b. */
  const turn = (a: number, b: number, angle: number) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let j = 0; j < 3; j++) {
      const ra = m[a * 3 + j];
      const rb = m[b * 3 + j];
      m[a * 3 + j] = ra * c - rb * s;
      m[b * 3 + j] = ra * s + rb * c;
    }
  };
  const turnY = (angle: number) => turn(0, 2, angle);
  const turnX = (angle: number) => turn(1, 2, angle);

  // random starting attitude, so two loads never open on the same face
  turnY(Math.random() * Math.PI * 2);
  turnX((Math.random() - 0.5) * 0.5);

  let velX = 0;
  let velY = IDLE_SPIN;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function render() {
    for (let i = 0; i < items.length; i++) {
      const { x, y, z } = points[i];
      const rx = m[0] * x + m[1] * y + m[2] * z;
      const ry = m[3] * x + m[4] * y + m[5] * z;
      const rz = m[6] * x + m[7] * y + m[8] * z;

      // perspective divide — nearer points get bigger and more opaque
      const depth = PERSPECTIVE / (PERSPECTIVE + rz * radius);
      const screenX = rx * radius * depth;
      const screenY = ry * radius * depth;

      const item = items[i];
      item.style.transform =
        `translate3d(calc(-50% + ${screenX.toFixed(1)}px), calc(-50% + ${screenY.toFixed(1)}px), 0)` +
        ` scale(${depth.toFixed(3)})`;
      item.style.opacity = Math.max(0.32, Math.min(1, (depth - 0.52) * 2.0)).toFixed(3);
      item.style.zIndex = String(Math.round(depth * 1000));
    }
  }

  const clampThrow = (v: number) => Math.max(-MAX_THROW, Math.min(MAX_THROW, v));

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    // Rotate here rather than in the loop. pointermove can fire faster than
    // rAF — 120Hz pointers against 60Hz frames are ordinary — and integrating
    // only the newest delta once per frame discarded the rest of the travel,
    // which is what made dragging feel sluggish rather than merely slow.
    const stepY = dx * DRAG_SPEED;
    // dy counts downwards and so does a positive X turn, so pulling down tips
    // the near face down
    const stepX = dy * DRAG_SPEED;
    turnY(stepY);
    turnX(stepX);

    // the last step doubles as the throw velocity once the drag ends
    velY = clampThrow(stepY);
    velX = clampThrow(stepX);
  };

  const onUp = () => {
    dragging = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    // listen on window so the drag survives leaving the stage
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  stage.addEventListener('pointerdown', onDown);

  // ResizeObserver rather than window.resize: the stage can change size
  // without the window doing so — webfonts landing, page zoom, a container
  // reflow — and a stale radius leaves the sphere at the wrong scale.
  const ro = new ResizeObserver(() => {
    measure();
    render();
  });
  ro.observe(stage);

  /* ── loop, only while on screen and the tab is visible ── */
  let raf = 0;
  let intersecting = false;

  // Intersection and page visibility are tracked separately. Folding them into
  // one flag means a tab switch clears it and the IntersectionObserver never
  // fires again (the element never changed), leaving the sphere frozen.
  const active = () => intersecting && !document.hidden && !reduced.matches;

  const start = () => {
    if (active() && !raf) raf = requestAnimationFrame(tick);
  };

  function tick() {
    if (!active()) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);

    // Only coast here; a drag in progress has already applied its own motion.
    if (!dragging) {
      velX *= 0.93;
      velY += (IDLE_SPIN - velY) * 0.03;
      turnY(velY);
      turnX(velX);
    }
    render();
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      intersecting = entry.isIntersecting;
      start();
    },
    { threshold: 0.01 }
  );
  io.observe(stage);

  document.addEventListener('visibilitychange', start);
  reduced.addEventListener('change', start);

  // still arranged as a sphere, just not spinning
  render();
  stage.dataset.ready = 'true';

  return () => {
    intersecting = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    document.removeEventListener('visibilitychange', start);
    reduced.removeEventListener('change', start);
    ro.disconnect();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    stage.removeEventListener('pointerdown', onDown);
  };
}
