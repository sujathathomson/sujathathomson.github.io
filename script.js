// Fade out the page loader once everything has loaded
const loader = document.getElementById('page-loader');
if (loader) {
  const startedAt = Date.now();
  const hideLoader = () => {
    // Keep it visible for a brief minimum so it reads as intentional
    const wait = Math.max(0, 1100 - (Date.now() - startedAt));
    setTimeout(() => {
      loader.classList.add('loaded');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    }, wait);
  };
  window.addEventListener('load', hideLoader);
  // Safety net in case the load event was already missed
  if (document.readyState === 'complete') hideLoader();
}

/* ---------- Theme toggle (initial theme is set inline in <head>) ---------- */
const themeToggle = document.querySelector('.theme-toggle');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (themeMeta) themeMeta.content = dark ? '#0b1220' : '#0b5cad';
  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  document.dispatchEvent(new CustomEvent('themechange'));
}

applyTheme(document.documentElement.dataset.theme || 'light');

themeToggle?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
});

// Follow the OS until the visitor picks a theme of their own
themeQuery.addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (err) { /* private mode */ }
  if (!saved) applyTheme(e.matches ? 'dark' : 'light');
});

const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');

toggle?.addEventListener('click', () => {
  links?.classList.toggle('open');
});

// Close the mobile menu after tapping a link
links?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => links.classList.remove('open'));
});

// Keep the footer year current
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Count-up stats ---------- */
function formatNum(n, useComma) {
  const v = Math.round(n);
  return useComma ? v.toLocaleString('en-US') : String(v);
}
// Tolerates targets written as display strings ("6,000+"); NaN would render literally.
function statTarget(el) {
  const n = parseFloat(String(el.dataset.target).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function setStatFinal(el) {
  const target = statTarget(el);
  if (target === null) return;
  el.textContent = formatNum(target, el.dataset.format === 'comma') + (el.dataset.suffix || '');
}
function animateStat(el) {
  if (el.dataset.counted) return;
  const target = statTarget(el);
  if (target === null) return;
  el.dataset.counted = '1';
  const suffix = el.dataset.suffix || '';
  const comma = el.dataset.format === 'comma';
  const duration = 1500;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    el.textContent = formatNum(target * eased, comma) + suffix;
    if (p < 1) requestAnimationFrame(step);
    else setStatFinal(el);
  };
  requestAnimationFrame(step);
}

/* ---------- Scroll reveal (+ trigger counters) ---------- */
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
    document.querySelectorAll('.stat-num[data-target]').forEach(setStatFinal);
  } else {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const siblings = Array.from(el.parentElement.children)
          .filter((c) => c.classList.contains('reveal'));
        const idx = Math.max(0, siblings.indexOf(el));
        el.style.transitionDelay = Math.min(idx, 6) * 80 + 'ms';
        el.classList.add('is-visible');
        el.querySelectorAll('.stat-num[data-target]').forEach(animateStat);
        obs.unobserve(el);
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => revealObserver.observe(el));
  }
}

/* ---------- Rotating hero title (typewriter) ---------- */
const typeText = document.querySelector('.type-text');
if (typeText) {
  const roles = ['Knowledge Management Specialist', 'Learning Strategist', 'AI Adoption Advocate'];
  if (prefersReduced) {
    typeText.textContent = roles[0];
  } else {
    let roleIdx = 0;
    let charIdx = 0;
    let deleting = false;
    const tick = () => {
      const role = roles[roleIdx];
      charIdx += deleting ? -1 : 1;
      typeText.textContent = role.slice(0, charIdx);
      if (!deleting && charIdx === role.length) {
        deleting = true;
        setTimeout(tick, 1600);
      } else if (deleting && charIdx === 0) {
        deleting = false;
        roleIdx = (roleIdx + 1) % roles.length;
        setTimeout(tick, 350);
      } else {
        setTimeout(tick, deleting ? 40 : 70);
      }
    };
    setTimeout(tick, 700);
  }
}

/* ---------- Animated knowledge-graph hero background ---------- */
const heroCanvas = document.querySelector('.hero-graph');
if (heroCanvas && !prefersReduced) {
  const ctx = heroCanvas.getContext('2d');
  const hero = heroCanvas.parentElement;
  const maxDist = 150;
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let nodes = [];
  let rafId = null;
  let onScreen = true;

  const nodeCount = () => (window.innerWidth < 700 ? 12 : 24);

  // Colours live in CSS custom properties so they follow the active theme
  let palette = readPalette();
  function readPalette() {
    const css = getComputedStyle(document.documentElement);
    const v = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
    return {
      line: v('--graph-line', '11, 92, 173'),
      lineAlpha: parseFloat(v('--graph-line-alpha', '0.18')),
      node: v('--graph-node', '13, 148, 136'),
      nodeAlpha: parseFloat(v('--graph-node-alpha', '0.55')),
    };
  }
  document.addEventListener('themechange', () => { palette = readPalette(); });

  function resize() {
    const rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    heroCanvas.width = width * dpr;
    heroCanvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function initNodes() {
    nodes = Array.from({ length: nodeCount() }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x <= 0 || n.x >= width) n.vx *= -1;
      if (n.y <= 0 || n.y >= height) n.vy *= -1;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < maxDist) {
          ctx.strokeStyle = `rgba(${palette.line}, ${(1 - dist / maxDist) * palette.lineAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = `rgba(${palette.node}, ${palette.nodeAlpha})`;
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    rafId = requestAnimationFrame(draw);
  }
  function start() { if (!rafId && onScreen && !document.hidden) rafId = requestAnimationFrame(draw); }
  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  resize();
  initNodes();
  start();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      resize();
      initNodes();
    }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
      if (onScreen) start(); else stop();
    }, { threshold: 0 }).observe(hero);
  }
}
