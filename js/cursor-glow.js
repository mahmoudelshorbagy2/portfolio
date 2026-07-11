(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // No cursor on touch devices — skip the whole layer: drawing a glow on
  // every touchmove competed with scrolling on phones.
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'cursor-glow-canvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let w = window.innerWidth;
  let h = window.innerHeight;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const radius = 230;

  const state = {
    tx: w / 2, ty: h / 2,
    x: w / 2, y: h / 2,
    targetOpacity: 0, opacity: 0
  };

  function setTarget(x, y) {
    state.tx = x;
    state.ty = y;
    state.targetOpacity = 1;
  }
  function release() {
    state.targetOpacity = 0;
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    setTarget(e.clientX, e.clientY);
  }, { passive: true });

  document.addEventListener('mouseleave', release);

  if (reduced) return;

  let wasVisible = false;

  function tick() {
    requestAnimationFrame(tick);

    state.x += (state.tx - state.x) * 0.14;
    state.y += (state.ty - state.y) * 0.14;
    state.opacity += (state.targetOpacity - state.opacity) * 0.08;

    // Nothing drawn and nothing to draw: skip the fullscreen clear too.
    if (state.opacity < 0.008) {
      if (wasVisible) {
        ctx.clearRect(0, 0, w, h);
        wasVisible = false;
      }
      return;
    }
    wasVisible = true;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createRadialGradient(state.x, state.y, 0, state.x, state.y, radius);
    grad.addColorStop(0, `rgba(155,107,255,${0.16 * state.opacity})`);
    grad.addColorStop(0.5, `rgba(255,46,154,${0.09 * state.opacity})`);
    grad.addColorStop(1, 'rgba(255,46,154,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(state.x - radius, state.y - radius, radius * 2, radius * 2);
  }
  tick();
})();
