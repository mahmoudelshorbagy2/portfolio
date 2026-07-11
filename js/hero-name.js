(function () {
  const root = document.getElementById('hero-name');
  if (!root) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

  let roleRevealed = false;
  function revealHeroRole() {
    if (roleRevealed) return;
    roleRevealed = true;
    const roleEl = document.querySelector('.hero-role');
    if (roleEl) setTimeout(() => roleEl.classList.add('revealed'), 300);
  }

  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  }

  /* ============================================================
     Name brush-writing engine — one instance per language.

     Letter paths are baked at build time (js/hero-name-paths.js:
     Norican connected script EN, js/hero-name-paths-ar.js:
     Alexandria AR with kashida, glyphs pre-ordered right-to-left).

     Each letter's gradient fill sits behind an SVG mask whose
     content is the same path drawn as a thick round stroke. The
     mask stroke is dash-revealed, so the letter body gets painted
     progressively behind the brush tip — true brush writing, not
     an outline trace. A comet with brand-colored stardust rides
     the tip. The instant the last letter finishes, everything
     resets in the same frame: endless loop, no pause, no white.
     ============================================================ */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PARTICLE_COLORS = ['#C9B4FF', '#B88CFF', '#FF9AD5', '#FF7AC8'];
  const SPARKLE_COLORS = ['#CDB0FF', '#FF9AD5'];

  function el(tag, attrs) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  let heroVisible = true;
  const hero = document.getElementById('hero');
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 }).observe(hero);
  }

  function createEngine(data, opts) {
    const CFG = {
      drawTotal: 8000,      // one full two-line pass — slow, deliberate strokes
      overlap: 0.15,        // next letter starts at 85% of previous
      minLetterDur: 300,
      particleMax: mobile ? 10 : 26,
      particleEvery: mobile ? 70 : 32,
      sparkleLife: 650
    };

    let svg = null;
    let letters = [];
    let cometG = null, particleLayer = null, sparkleLayer = null;
    let particles = [], sparkles = [];
    let raf = null, last = 0, elapsed = 0;
    let particleClock = 0, dtShared = 0;

    function buildSvg() {
      if (svg) return;
      const [vx, vy, vw, vh] = data.viewBox;
      svg = el('svg', {
        class: 'hero-name-svg hn-' + opts.id,
        viewBox: vx + ' ' + vy + ' ' + vw + ' ' + vh,
        'aria-hidden': 'true'
      });

      const gradId = 'hn-grad-' + opts.id;
      const haloId = 'hn-halo-' + opts.id;
      const defs = el('defs', {});
      // One vertical gradient across both lines: violet on top, magenta below.
      const grad = el('linearGradient', {
        id: gradId, gradientUnits: 'userSpaceOnUse',
        x1: 0, y1: data.gradY[0], x2: 0, y2: data.gradY[1]
      });
      // Matches the WATCH MY WORK button gradient, top -> bottom.
      grad.appendChild(el('stop', { offset: '0', 'stop-color': '#7B2FFE' }));
      grad.appendChild(el('stop', { offset: '1', 'stop-color': '#FF2E9A' }));
      defs.appendChild(grad);

      const halo = el('radialGradient', { id: haloId });
      halo.appendChild(el('stop', { offset: '0', 'stop-color': 'rgba(220,196,255,0.95)' }));
      halo.appendChild(el('stop', { offset: '0.35', 'stop-color': 'rgba(200,160,255,0.55)' }));
      halo.appendChild(el('stop', { offset: '1', 'stop-color': 'rgba(160,90,255,0)' }));
      defs.appendChild(halo);
      svg.appendChild(defs);

      letters = [];
      data.lines.forEach((line, li) => {
        const g = el('g', { transform: 'translate(' + line.tx + ',' + line.ty + ')' });
        line.letters.forEach((L, i) => {
          // The brush: same path as the letter, drawn as a thick round
          // stroke inside a mask. Dash-revealing it paints the letter
          // body progressively behind the tip.
          const maskId = 'hn-m-' + opts.id + '-' + li + '-' + i;
          const mask = el('mask', {
            id: maskId, maskUnits: 'userSpaceOnUse',
            x: -10000, y: -10000, width: 20000, height: 20000
          });
          const brushLayer = (widthFactor, color) => el('path', {
            d: L.d, fill: 'none', stroke: color,
            'stroke-width': (opts.brushWidth * widthFactor).toFixed(1),
            'stroke-linecap': 'round', 'stroke-linejoin': 'round'
          });
          // Ink-brush mask: a soft half-tone fringe runs just ahead of the
          // solid body, and a thin tip leads them both — the stroke tapers
          // thin at the tip and thickens behind it, edges settling like ink.
          const layers = opts.inkBrush
            ? [
                { widthFactor: 1.28, lead: 0.035, elRef: brushLayer(1.28, '#7d7d7d') },
                { widthFactor: 1, lead: 0, elRef: brushLayer(1, '#fff') },
                { widthFactor: 0.4, lead: 0.06, elRef: brushLayer(0.4, '#fff') }
              ]
            : [{ widthFactor: 1, lead: 0, elRef: brushLayer(1, '#fff') }];
          layers.forEach((ly) => mask.appendChild(ly.elRef));
          const brush = layers[1] ? layers[1].elRef : layers[0].elRef; // solid body drives measurement
          defs.appendChild(mask);

          const p = el('path', {
            class: 'hn-letter', d: L.d,
            fill: 'url(#' + gradId + ')', mask: 'url(#' + maskId + ')'
          });
          g.appendChild(p);
          letters.push({
            brush, layers, fill: p, maskRef: 'url(#' + maskId + ')',
            tx: line.tx, ty: line.ty,
            lineStart: li > 0 && i === 0,
            len: 0, start: 0, dur: 0, done: false, endPt: null
          });
        });
        svg.appendChild(g);
      });

      particleLayer = el('g', {});
      sparkleLayer = el('g', {});
      cometG = el('g', { opacity: '0' });
      cometG.appendChild(el('circle', { r: 8, fill: 'url(#' + haloId + ')' }));
      cometG.appendChild(el('circle', { r: 1.7, fill: '#DCC5FF' }));
      svg.appendChild(particleLayer);
      svg.appendChild(sparkleLayer);
      svg.appendChild(cometG);

      svg.style.visibility = 'hidden';
      root.appendChild(svg);

      // Measure after insertion, then arm the dashes before first paint.
      letters.forEach((l) => {
        l.len = l.brush.getTotalLength();
        const pt = l.brush.getPointAtLength(l.len);
        l.endPt = { x: pt.x + l.tx, y: pt.y + l.ty };
        l.layers.forEach((ly) => {
          ly.elRef.setAttribute('stroke-dasharray', l.len);
          ly.elRef.setAttribute('stroke-dashoffset', l.len);
        });
      });
      computeTimeline();
      svg.style.visibility = '';
    }

    // Letter duration is proportional to its linework length (long letters
    // draw longer), normalized so the overlapped sequence hits drawTotal.
    // With lineGap, line 2 waits for line 1 to finish completely.
    function computeTimeline() {
      const totalLen = letters.reduce((s, l) => s + l.len, 0);
      let k = CFG.drawTotal / totalLen;
      for (let i = 0; i < 24; i++) {
        let t = 0, end = 0;
        letters.forEach((l) => {
          if (opts.lineGap && l.lineStart) t = end;
          const d = Math.max(CFG.minLetterDur, k * l.len);
          l.start = t;
          l.dur = d;
          end = t + d;
          t += d * (1 - CFG.overlap);
        });
        const scale = CFG.drawTotal / end;
        k *= scale;
        if (Math.abs(scale - 1) < 0.001) break;
      }
    }

    /* ---------- comet, particles, sparkles ---------- */
    function moveComet(pt) {
      cometG.setAttribute('opacity', '1');
      cometG.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1) + ')');
    }

    function hideComet() {
      cometG.setAttribute('opacity', '0');
    }

    function spawnParticles(pt, dt) {
      particleClock += dt;
      while (particleClock >= CFG.particleEvery) {
        particleClock -= CFG.particleEvery;
        if (particles.length >= CFG.particleMax) {
          particles.shift().el.remove();
        }
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 14;
        const c = el('circle', {
          r: (0.6 + Math.random() * 1.1).toFixed(2),
          fill: PARTICLE_COLORS[(Math.random() * PARTICLE_COLORS.length) | 0]
        });
        particleLayer.appendChild(c);
        particles.push({
          el: c, x: pt.x, y: pt.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6,
          life: 0, ttl: 700 + Math.random() * 400
        });
      }
    }

    function updateParticles(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.ttl) {
          p.el.remove();
          particles.splice(i, 1);
          continue;
        }
        const s = dt / 1000;
        p.x += p.vx * s;
        p.y += p.vy * s;
        p.vy += 3 * s; // faint drift back down, like embers
        const t = p.life / p.ttl;
        p.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')');
        p.el.setAttribute('opacity', (1 - t).toFixed(2));
      }
    }

    function spawnSparkle(pt) {
      const s = 6;
      const d = 'M0 ' + -s + ' L' + s * 0.24 + ' ' + -s * 0.24 + ' L' + s + ' 0 L' + s * 0.24 + ' ' + s * 0.24 +
        ' L0 ' + s + ' L' + -s * 0.24 + ' ' + s * 0.24 + ' L' + -s + ' 0 L' + -s * 0.24 + ' ' + -s * 0.24 + ' Z';
      const star = el('path', {
        d, opacity: '0',
        fill: SPARKLE_COLORS[(Math.random() * SPARKLE_COLORS.length) | 0]
      });
      sparkleLayer.appendChild(star);
      sparkles.push({ el: star, x: pt.x, y: pt.y, life: 0, ttl: CFG.sparkleLife });
    }

    function updateSparkles(dt) {
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i];
        sp.life += dt;
        if (sp.life >= sp.ttl) {
          sp.el.remove();
          sparkles.splice(i, 1);
          continue;
        }
        const t = sp.life / sp.ttl;
        const scale = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
        sp.el.setAttribute('transform',
          'translate(' + sp.x + ',' + sp.y + ') scale(' + scale.toFixed(3) + ') rotate(' + (t * 90).toFixed(1) + ')');
        sp.el.setAttribute('opacity', (0.95 * (1 - t * 0.4)).toFixed(2));
      }
    }

    function clearFx() {
      particles.forEach((p) => p.el.remove());
      sparkles.forEach((s) => s.el.remove());
      particles = [];
      sparkles = [];
      particleClock = 0;
      hideComet();
    }

    /* ---------- the seamless loop ---------- */
    function finishLetter(l) {
      l.done = true;
      l.layers.forEach((ly) => ly.elRef.setAttribute('stroke-dashoffset', 0));
      // Drop the mask: guarantees every last pixel (like dotting the
      // letter after the stroke) and lightens rendering afterwards.
      l.fill.removeAttribute('mask');
      spawnSparkle(l.endPt);
    }

    // Instant attribute-only reset: the finished name never sits on
    // screen — the same frame that ends a pass starts the next one.
    function resetPass() {
      letters.forEach((l) => {
        l.done = false;
        l.fill.setAttribute('mask', l.maskRef);
        l.layers.forEach((ly) => ly.elRef.setAttribute('stroke-dashoffset', l.len));
      });
    }

    function progressPass() {
      let tip = null;
      for (const l of letters) {
        if (l.done) continue;
        const p = (elapsed - l.start) / l.dur;
        if (p <= 0) break; // starts are ordered — nothing after has begun
        if (p >= 1) {
          finishLetter(l);
        } else {
          const e = easeInOutQuad(p);
          let tipE = e;
          l.layers.forEach((ly) => {
            const le = Math.min(1, e + ly.lead);
            ly.elRef.setAttribute('stroke-dashoffset', (l.len * (1 - le)).toFixed(1));
            if (le > tipE) tipE = le;
          });
          // The comet rides the thin leading tip of the brush.
          const pt = l.brush.getPointAtLength(l.len * tipE);
          tip = { x: pt.x + l.tx, y: pt.y + l.ty };
        }
      }
      if (tip) {
        moveComet(tip);
        spawnParticles(tip, dtShared);
      }
    }

    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!heroVisible) { last = ts; return; }
      let dt = ts - (last || ts);
      if (dt > 100) dt = 100; // tab switches shouldn't teleport the comet
      last = ts;
      elapsed += dt;
      dtShared = dt;

      updateParticles(dt);
      updateSparkles(dt);

      // Seamless loop: last letter done -> reset -> first letter, same frame.
      if (elapsed >= CFG.drawTotal) {
        resetPass();
        elapsed -= CFG.drawTotal;
      }
      progressPass();
    }

    function start() {
      buildSvg();
      svg.style.display = '';
      revealHeroRole();

      if (reduced) {
        // Static, fully painted — no loop, no comet.
        letters.forEach((l) => {
          l.brush.setAttribute('stroke-dashoffset', 0);
          l.fill.removeAttribute('mask');
        });
        return;
      }
      resetPass();
      elapsed = 0;
      last = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (svg) {
        clearFx();
        svg.style.display = 'none';
      }
    }

    return { start, stop };
  }

  const engines = {
    // Norican script: moderate stems -> brush ~22 units at 100px em.
    en: window.HERO_NAME_PATHS ? createEngine(window.HERO_NAME_PATHS, { id: 'en', brushWidth: 22 }) : null,
    // Alexandria 800 has heavy stems -> wider brush. Ink-brush layering
    // (tapered tip + soft half-tone fringe) for a real brush feel.
    // "محمود" finishes completely before "الشوربجي" begins.
    ar: window.HERO_NAME_PATHS_AR ? createEngine(window.HERO_NAME_PATHS_AR, { id: 'ar', brushWidth: 40, lineGap: true, inkBrush: true }) : null
  };

  function applyLang() {
    const lang = currentLang();
    const other = lang === 'ar' ? 'en' : 'ar';
    if (engines[other]) engines[other].stop();
    if (engines[lang]) engines[lang].start();
  }

  applyLang();
  document.addEventListener('site-lang-change', applyLang);
})();
