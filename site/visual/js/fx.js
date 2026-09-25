// fx.js — small interaction flourishes: custom cursor, magnetic buttons, holographic tilt cards,
// a confetti burst, and an opt-in WebAudio "blip". Every visual effect here is decoration on top of
// real, already-visible DOM content — nothing in this file is required to read or use a page.
//
// PUBLIC API
//   mountFx({ cursor = true, magnetic = true, tilt = true } = {}) → { destroy() }
//     Single entry point for shell.js. Wraps all three in one motion.js `motionScope`, so Calm mode
//     or reduced-motion tears every listener down together, and turning motion back on remounts them.
//     Each sub-feature additionally no-ops when `(pointer: fine)` doesn't match (touch/coarse
//     pointers get no cursor replacement, no magnetic pull, no tilt — the card/button still works,
//     just as a normal tap target).
//     - cursor:   replaces the system cursor with a ring that follows the pointer (`.cursor-dot`,
//                 `body.cursor-active` — see visual.css). Uses `mix-blend-mode: difference` so it
//                 stays visible on every background without per-theme tuning.
//     - magnetic: any element with `data-magnetic` is pulled a few px toward a nearby pointer and
//                 eases back on pointerleave. Delegated listener, so elements added to the DOM after
//                 mount (e.g. cards rendered later by hub.js) are picked up automatically.
//     - tilt:     any element with `data-tilt` (the `.foil-card` pattern) gets a perspective
//                 rotateX/rotateY tilt toward the pointer, and sets `--mx`/`--my` (0–100%) custom
//                 properties the card's CSS sheen (`.foil-card::after`) can read for a moving
//                 highlight. Also delegated.
//   confettiBurst({ x, y }, { count, colors } = {})
//     Fire-and-forget canvas 2D burst (~1.5s), auto-removes its own canvas. No-op when motion isn't
//     allowed (motion.js `motionAllowed()`). Defaults `colors` to the three world hues read from CSS.
//   getSoundEnabled() / setSoundEnabled(bool)
//     localStorage `sg-visual-sound` (try/catch), default **off**.
//   playBlip({ freq, duration, type, gain } = {})
//     Short WebAudio tone. No-op (and never creates an AudioContext) when getSoundEnabled() is false,
//     when WebAudio is unsupported, or if resuming a suspended context fails.

import { motionScope, motionAllowed } from './motion.js';

const FINE_POINTER = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

function cssVarColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// ---------------------------------------------------------------------------
// Custom cursor
// ---------------------------------------------------------------------------

function mountCursor() {
  if (!FINE_POINTER()) return null;
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  document.body.classList.add('cursor-active');

  function onMove(e) {
    dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
  }
  function onDown() { dot.classList.add('is-pressed'); }
  function onUp() { dot.classList.remove('is-pressed'); }
  function onOver(e) {
    dot.classList.toggle('is-interactive', !!e.target.closest?.('a, button, [data-tilt], [data-magnetic]'));
  }

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointerover', onOver, { passive: true });

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointerover', onOver);
    document.body.classList.remove('cursor-active');
    dot.remove();
  };
}

// ---------------------------------------------------------------------------
// Magnetic buttons — delegated, so late-rendered [data-magnetic] elements work without a remount.
// ---------------------------------------------------------------------------

function mountMagnetic() {
  if (!FINE_POINTER()) return null;
  let active = null;
  function onMove(e) {
    const el = e.target.closest?.('[data-magnetic]') || null;
    if (el !== active) {
      if (active) { active.style.transition = 'transform .25s ease-out'; active.style.transform = ''; }
      active = el;
      if (active) active.style.transition = 'transform .05s linear';
    }
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - (r.left + r.width / 2);
    const my = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${mx * 0.22}px, ${my * 0.22}px)`;
  }
  document.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    document.removeEventListener('pointermove', onMove);
    if (active) { active.style.transition = ''; active.style.transform = ''; }
  };
}

// ---------------------------------------------------------------------------
// Holographic tilt cards — delegated; sets --mx/--my for the CSS sheen in visual.css's .foil-card::after
// ---------------------------------------------------------------------------

function resetTilt(el) {
  el.style.transition = 'transform .4s ease';
  el.style.transform = '';
  setTimeout(() => { el.style.transition = ''; }, 420);
}

function mountTilt() {
  if (!FINE_POINTER()) return null;
  let active = null;
  function onMove(e) {
    const el = e.target.closest?.('[data-tilt]') || null;
    if (el !== active) {
      if (active) resetTilt(active);
      active = el;
      if (active) active.style.transition = '';
    }
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * 10;
    const ry = (px - 0.5) * 12;
    el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.015)`;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  }
  function onLeave(e) {
    if (active && (!e.relatedTarget || !active.contains(e.relatedTarget))) { resetTilt(active); active = null; }
  }
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onLeave, { passive: true });
  return () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onLeave);
    if (active) resetTilt(active);
  };
}

// ---------------------------------------------------------------------------
// mountFx — single motionScope wrapping whichever sub-features are requested.
// ---------------------------------------------------------------------------

export function mountFx({ cursor = true, magnetic = true, tilt = true } = {}) {
  const scope = motionScope(() => {
    const cleanups = [cursor && mountCursor(), magnetic && mountMagnetic(), tilt && mountTilt()].filter(Boolean);
    return () => cleanups.forEach(fn => fn());
  });
  return scope;
}

// ---------------------------------------------------------------------------
// Confetti — short-lived canvas 2D burst
// ---------------------------------------------------------------------------

export function confettiBurst(origin = {}, opts = {}) {
  if (!motionAllowed()) return;
  const x = origin.x ?? window.innerWidth / 2;
  const y = origin.y ?? window.innerHeight / 2;
  const count = opts.count ?? 70;
  const colors = opts.colors || [
    cssVarColor('--world-products', '#0f8b8d'),
    cssVarColor('--world-methods', '#d98a12'),
    cssVarColor('--world-brokers', '#6c4fd1'),
  ];

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  const particles = Array.from({ length: count }, () => ({
    x, y,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 2,
    size: 4 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    life: 1,
  }));

  let raf = null;
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.013;
      if (p.life > 0) alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (alive) raf = requestAnimationFrame(frame);
    else { canvas.remove(); raf = null; }
  }
  raf = requestAnimationFrame(frame);
  // Safety net in case a tab is backgrounded mid-burst and rAF stalls indefinitely.
  setTimeout(() => { if (raf) cancelAnimationFrame(raf); canvas.remove(); }, 2500);
}

// ---------------------------------------------------------------------------
// Sound — opt-in, off by default
// ---------------------------------------------------------------------------

const SOUND_KEY = 'sg-visual-sound';

export function getSoundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}
export function setSoundEnabled(on) {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

let _ctx = null;
function audioCtx() {
  if (_ctx) return _ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { _ctx = new Ctor(); } catch { _ctx = null; }
  return _ctx;
}

export function playBlip({ freq = 660, duration = 0.08, type = 'sine', gain = 0.05 } = {}) {
  if (!getSoundEnabled()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  const start = () => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  };
  if (ctx.state === 'suspended') ctx.resume().then(start).catch(() => {});
  else start();
}
