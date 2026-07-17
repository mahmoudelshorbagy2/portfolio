/* ==========================================================================
   Navbar
   ========================================================================== */

const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 30);
}, { passive: true });

/* In-page links scroll smoothly without ever putting a hash in the URL */
const smoothBehavior = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: smoothBehavior() });
  });
});

// If the page was opened with a hash, honor it once, then clean the URL.
if (window.location.hash) {
  const opened = document.querySelector(window.location.hash);
  history.replaceState(null, '', window.location.pathname + window.location.search);
  if (opened) requestAnimationFrame(() => opened.scrollIntoView({ behavior: 'auto' }));
}

const navToggle = document.querySelector('.nav-toggle');
const mobileMenu = document.querySelector('.mobile-menu');

// Brand-colored star burst from the menu button when the menu opens.
const BURST_COLORS = ['#8B5CFF', '#B44CFF', '#FF2E9A', '#FF9AD5', '#FFFFFF'];
function burstStars(fromEl) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = fromEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const layer = document.createElement('div');
  layer.className = 'star-burst';
  const N = 14;
  for (let i = 0; i < N; i++) {
    const s = document.createElement('span');
    s.textContent = '✦';
    const size = 8 + Math.random() * 10;
    s.style.left = cx + 'px';
    s.style.top = cy + 'px';
    s.style.fontSize = size + 'px';
    s.style.color = BURST_COLORS[(Math.random() * BURST_COLORS.length) | 0];
    layer.appendChild(s);
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 36 + Math.random() * 54;
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist;
    const dur = 550 + Math.random() * 350;
    s.animate([
      { transform: 'translate(-50%,-50%) scale(0) rotate(0deg)', opacity: 1 },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(1) rotate(' + (90 + Math.random() * 90) + 'deg)', opacity: 0 }
    ], { duration: dur, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' });
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1000);
}

if (navToggle && mobileMenu) {
  navToggle.addEventListener('click', () => {
    const opening = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open');
    mobileMenu.classList.toggle('open');
    if (opening) burstStars(navToggle);
  });
  mobileMenu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      mobileMenu.classList.remove('open');
    });
  });
}

/* ==========================================================================
   Tools Marquee
   ========================================================================== */

const TOOLS = [
  { name: 'Kling', mono: 'K' },
  { name: 'Claude', mono: 'Cl' },
  { name: 'Seedance', mono: 'Sd' },
  { name: 'Higgsfield', mono: 'Hf' },
  { name: 'Nano Banana Pro', mono: 'Nb' },
  { name: 'ChatGPT', mono: 'Gpt' },
  { name: 'Google Flow', mono: 'Fl' },
  { name: 'Suno', mono: 'Su' }
];

function renderMarquee() {
  const track = document.getElementById('marquee-track');
  if (!track) return;
  const badge = (t) => `
    <div class="tool-badge">
      <span class="tool-icon">${t.mono}</span>
      <span class="tool-name">${t.name}</span>
    </div>`;
  const html = TOOLS.map(badge).join('');
  track.innerHTML = html + html; // duplicate for seamless loop
}
renderMarquee();

/* ==========================================================================
   Work grid + Lightbox
   ========================================================================== */

function cardMarkup(v, i) {
  return `
    <div class="work-card" data-index="${i}" tabindex="0" role="button" aria-label="${v.titleEn}">
      <img src="assets/images/posters/${v.file}.jpg" alt="${v.titleEn}" loading="lazy">
      <div class="work-card-play">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </div>
      <div class="work-card-info">
        <span class="work-card-tag">
          <span data-i18n="en">${v.categoryEn}</span><span data-i18n="ar">${v.categoryAr}</span>
        </span>
        <div class="work-card-title">
          <span data-i18n="en">${v.titleEn}</span><span data-i18n="ar">${v.titleAr}</span>
        </div>
      </div>
    </div>
  `;
}

function getColumnCount() {
  var w = window.innerWidth;
  if (w <= 560) return 1;
  if (w <= 860) return 2;
  return 3;
}

function getColumnDurations(count) {
  if (count === 1) return [60];
  if (count === 2) return [32, 32];
  return [18, 24, 21];
}

/* ==========================================================================
   Work marquee JS rAF loop
   ========================================================================== */

var workTracks = [];
var workRafId = null;
var workLastTime = 0;

function initWorkMarquee() {
  if (workRafId) { cancelAnimationFrame(workRafId); workRafId = null; }
  workTracks = [];

  document.querySelectorAll('.work-marquee-col').forEach(function (col) {
    var el = col.querySelector('.work-marquee-track');
    if (!el) return;

    var duration = parseFloat(el.style.animationDuration) || 18;
    var trackHeight = el.scrollHeight || 1;
    var loopDist = trackHeight / 2;
    var speed = loopDist / duration;
    var data = {
      el: el, position: 0, speed: speed, loopDist: loopDist,
      dragging: false, hoverPaused: false,
      dragStartY: 0, dragStartPos: 0
    };
    el._trackData = data;

    // Touch drag — pause auto-scroll, follow finger, wrap modulo, resume on release
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      data.dragging = true;
      data.dragStartY = e.touches[0].clientY;
      data.dragStartPos = data.position;
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!data.dragging || e.touches.length !== 1) return;
      e.preventDefault();
      var deltaY = e.touches[0].clientY - data.dragStartY;
      var newPos = data.dragStartPos + deltaY;
      while (newPos > 0) newPos -= data.loopDist;
      while (newPos < -data.loopDist) newPos += data.loopDist;
      data.position = newPos;
      el.style.transform = 'translateY(' + data.position + 'px)';
    }, { passive: false });

    el.addEventListener('touchend', function () { data.dragging = false; }, { passive: true });
    el.addEventListener('touchcancel', function () { data.dragging = false; }, { passive: true });

    // Hover pause — matches old CSS .work-marquee-col:hover behaviour
    col.addEventListener('mouseenter', function () { data.hoverPaused = true; });
    col.addEventListener('mouseleave', function () { data.hoverPaused = false; });

    workTracks.push(data);
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  workLastTime = performance.now();
  workRafId = requestAnimationFrame(workLoop);
}

function workLoop(now) {
  var dt = (now - workLastTime) / 1000;
  workLastTime = now;

  for (var i = 0; i < workTracks.length; i++) {
    var t = workTracks[i];
    if (t.dragging || t.el.classList.contains('fx-paused') || t.hoverPaused) continue;

    t.position -= t.speed * dt;
    if (t.position <= -t.loopDist) t.position += t.loopDist;

    t.el.style.transform = 'translateY(' + t.position + 'px)';
  }

  workRafId = requestAnimationFrame(workLoop);
}

function renderWork() {
  var wrap = document.getElementById('work-grid');
  if (!wrap || typeof SHOWREEL === 'undefined') return;

  var colCount = getColumnCount();
  var durations = getColumnDurations(colCount);

  var columns = Array.from({ length: colCount }, function () { return []; });
  SHOWREEL.forEach(function (v, i) {
    columns[i % colCount].push({ v: v, index: i });
  });

  wrap.innerHTML = columns.map(function (col, colIndex) {
    var duration = durations[colIndex % durations.length];
    var track = col.concat(col).map(function (c) { return cardMarkup(c.v, c.index); }).join('');
    return [
      '<div class="work-marquee-col">',
      '<div class="work-marquee-track" style="animation-duration:' + duration + 's;">' + track + '</div>',
      '</div>'
    ].join('');
  }).join('');

  wrap.querySelectorAll('.work-card').forEach(function (card) {
    var open = function () { return openLightbox(parseInt(card.dataset.index, 10)); };
    card.addEventListener('click', open);
    card.addEventListener('keypress', function (e) { if (e.key === 'Enter') open(); });
  });

  initWorkMarquee();
}
renderWork();

/* Responsive re-render: listen at both breakpoints */
(function () {
  var currentCount = getColumnCount();
  var mq560 = window.matchMedia('(max-width: 560px)');
  var mq860 = window.matchMedia('(max-width: 860px)');
  function handler() {
    var next = getColumnCount();
    if (next !== currentCount) {
      currentCount = next;
      renderWork();
    }
  }
  mq560.addEventListener('change', handler);
  mq860.addEventListener('change', handler);
})();

const lightbox = document.getElementById('lightbox');
const lightboxVideo = document.getElementById('lightbox-video');
const lightboxTitleEn = document.querySelector('#lightbox-caption [data-i18n="en"]');
const lightboxTitleAr = document.querySelector('#lightbox-caption [data-i18n="ar"]');
const lightboxClose = document.querySelector('.lightbox-close');

function openLightbox(index) {
  const v = SHOWREEL[index];
  if (!v) return;
  lightboxVideo.setAttribute('poster', `assets/images/posters/${v.file}.jpg`);
  lightboxVideo.src = `assets/videos/${v.file}.mp4`;
  lightboxTitleEn.textContent = v.titleEn;
  lightboxTitleAr.textContent = v.titleAr;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  lightboxVideo.play().catch(() => {});
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  lightboxVideo.pause();
  lightboxVideo.removeAttribute('src');
  lightboxVideo.load();
}

if (lightbox) {
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
  });
}

/* ==========================================================================
   Pause marquee animations while their section is offscreen
   ========================================================================== */

if ('IntersectionObserver' in window) {
  const marqueeIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target
        .querySelectorAll('.marquee-track, .work-marquee-track')
        .forEach((t) => t.classList.toggle('fx-paused', !entry.isIntersecting));
    });
  }, { threshold: 0.02 });
  document.querySelectorAll('.marquee-section, #work').forEach((s) => marqueeIO.observe(s));
}

/* ==========================================================================
   Video download / right-click protection
   ========================================================================== */

document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('video')) e.preventDefault();
});

document.addEventListener('dragstart', (e) => {
  if (e.target.closest('video')) e.preventDefault();
});

/* ==========================================================================
   Footer year
   ========================================================================== */

const yearEl = document.getElementById('footer-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ==========================================================================
   GSAP Scroll Reveal
   ========================================================================== */

window.addEventListener('load', () => {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    gsap.set('.reveal', { opacity: 1 });
    return;
  }

  document.querySelectorAll('.reveal-group').forEach((group) => {
    const items = group.querySelectorAll('.reveal');
    gsap.fromTo(items,
      { opacity: 0, y: 36 },
      {
        opacity: 1, y: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: group, start: 'top 82%' }
      }
    );
  });

  document.querySelectorAll('.reveal:not(.reveal-group .reveal)').forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 30 },
      {
        opacity: 1, y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      }
    );
  });
});
