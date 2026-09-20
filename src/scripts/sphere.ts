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
  // latter puts the first and last point exactly on a pole, where x and z are
  // both 0 — and a point at a pole is unchanged by any Y rotation, so those
  // two logos would sit perfectly still while everything else turns.
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

  // random starting attitude, so two loads never open on the same face
  let rotX = (Math.random() - 0.5) * 0.5;
  let rotY = Math.random() * Math.PI * 2;
  let velX = 0;
  let velY = IDLE_SPIN;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function render() {
    const sinY = Math.sin(rotY);
    const cosY = Math.cos(rotY);
    const sinX = Math.sin(rotX);
    const cosX = Math.cos(rotX);

    for (let i = 0; i < items.length; i++) {
      const p = points[i];

      // rotate around Y, then X
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      // perspective divide — nearer points get bigger and more opaque
      const depth = PERSPECTIVE / (PERSPECTIVE + z2 * radius);
      const screenX = x1 * radius * depth;
      const screenY = y2 * radius * depth;

      const item = items[i];
      item.style.transform =
        `translate3d(calc(-50% + ${screenX.toFixed(1)}px), calc(-50% + ${screenY.toFixed(1)}px), 0)` +
        ` scale(${depth.toFixed(3)})`;
      item.style.opacity = Math.max(0.32, Math.min(1, (depth - 0.52) * 2.0)).toFixed(3);
      item.style.zIndex = String(Math.round(depth * 1000));
    }
  }

  const clampTilt = (v: number) => Math.max(-1.1, Math.min(1.1, v));
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
    // dy counts downwards and so does rotX, so pulling down tips the near face down
    const stepX = dy * DRAG_SPEED;
    rotY += stepY;
    rotX = clampTilt(rotX + stepX);

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
      rotY += velY;
      rotX = clampTilt(rotX + velX);
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
