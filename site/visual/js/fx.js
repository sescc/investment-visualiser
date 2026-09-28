// fx.js — small interaction flourishes: magnetic buttons, holographic tilt cards, a confetti burst, and
// an opt-in WebAudio "blip". Every visual effect here is decoration on top of real, already-visible DOM
// content — nothing in this file is required to read or use a page.
//
// PUBLIC API
//   mountFx({ magnetic = true, tilt = true } = {}) → { destroy() }
//     Single entry point for shell.js. Wraps both in one motion.js `motionScope`, so Calm mode or
//     reduced-motion tears every listener down together, and turning motion back on remounts them.
//     Each sub-feature additionally no-ops when `(pointer: fine)` doesn't match (touch/coarse pointers
//     get no magnetic pull, no tilt — the card/button still works, just as a normal tap target).
//     - magnetic: any element with `data-magnetic` is pulled a few px toward a nearby pointer and
//                 eases back on pointerleave.
//     - tilt:     any element with `data-tilt` (the `.foil-card` pattern) gets a perspective
//                 rotateX/rotateY tilt toward the pointer, and sets `--mx`/`--my` (0–100%) custom
//                 properties the card's CSS sheen (`.foil-card::after`) can read for a moving
//                 highlight.
//     Both are delegated (`pointerover`/`pointerout` on `document`, so elements added to the DOM after
//     mount — e.g. cards rendered later by hub.js — are picked up automatically) and only listen for
//     `pointermove` on the ONE currently-hovered element (added on pointerover, removed on pointerout)
//     rather than a permanent document-wide pointermove listener. Each burst of pointermove events
//     coalesces into a single write per animation frame (one `requestAnimationFrame` per burst, not a
//     continuous loop — it schedules nothing while the pointer is still).
//   confettiBurst({ x, y }, { count, colors } = {})
//     Fire-and-forget canvas 2D burst (~1.5s), auto-removes its own canvas. No-op when motion isn't
//     allowed (motion.js `motionAllowed()`). Defaults `colors` to the three world hues read from CSS.
//     `count` is capped at 40 regardless of what the caller asks for.
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
// Magnetic buttons — delegated pointerover/pointerout find the target; a pointermove listener is added
// only to that one element while it's hovered (removed again on pointerout), and each burst of moves
// coalesces into a single write per animation frame rather than writing on every event.
// ---------------------------------------------------------------------------

function mountMagnetic() {
  if (!FINE_POINTER()) return null;
  let active = null;
  let pendingEvent = null;
  let raf = null;

  function flush() {
    raf = null;
    if (!active || !pendingEvent) return;
    const r = active.getBoundingClientRect();
    const mx = pendingEvent.clientX - (r.left + r.width / 2);
    const my = pendingEvent.clientY - (r.top + r.height / 2);
    active.style.transform = `translate(${mx * 0.22}px, ${my * 0.22}px)`;
  }
  function onMove(e) {
    pendingEvent = e;
    if (raf == null) raf = requestAnimationFrame(flush);
  }
  function onOver(e) {
    const el = e.target.closest?.('[data-magnetic]');
    if (!el || el === active) return;
    active = el;
    active.style.transition = 'transform .05s linear';
    active.addEventListener('pointermove', onMove, { passive: true });
  }
  function onOut(e) {
    if (!active || (e.relatedTarget && active.contains(e.relatedTarget))) return;
    active.removeEventListener('pointermove', onMove);
    active.style.transition = 'transform .25s ease-out';
    active.style.transform = '';
    active = null;
    pendingEvent = null;
    if (raf != null) { cancelAnimationFrame(raf); raf = null; }
  }

  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  return () => {
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerout', onOut);
    if (active) { active.removeEventListener('pointermove', onMove); active.style.transition = ''; active.style.transform = ''; }
    if (raf != null) cancelAnimationFrame(raf);
  };
}

// ---------------------------------------------------------------------------
// Holographic tilt cards — same delegated pointerover/pointerout + per-element pointermove + rAF-
// coalesced writes as magnetic buttons above. Sets --mx/--my for the CSS sheen in
// visual.css's .foil-card::after.
// ---------------------------------------------------------------------------

function resetTilt(el) {
  el.style.transition = 'transform .4s ease';
  el.style.transform = '';
  setTimeout(() => { el.style.transition = ''; }, 420);
}

function mountTilt() {
  if (!FINE_POINTER()) return null;
  let active = null;
  let pendingEvent = null;
  let raf = null;

  function flush() {
    raf = null;
    if (!active || !pendingEvent) return;
    const r = active.getBoundingClientRect();
    const px = (pendingEvent.clientX - r.left) / r.width;
    const py = (pendingEvent.clientY - r.top) / r.height;
    const rx = (0.5 - py) * 10;
    const ry = (px - 0.5) * 12;
    active.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.015)`;
    active.style.setProperty('--mx', `${px * 100}%`);
    active.style.setProperty('--my', `${py * 100}%`);
  }
  function onMove(e) {
    pendingEvent = e;
    if (raf == null) raf = requestAnimationFrame(flush);
  }
  function onOver(e) {
    const el = e.target.closest?.('[data-tilt]');
    if (!el || el === active) return;
    active = el;
    active.style.transition = '';
    active.addEventListener('pointermove', onMove, { passive: true });
  }
  function onOut(e) {
    if (!active || (e.relatedTarget && active.contains(e.relatedTarget))) return;
    active.removeEventListener('pointermove', onMove);
    resetTilt(active);
    active = null;
    pendingEvent = null;
    if (raf != null) { cancelAnimationFrame(raf); raf = null; }
  }

  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  return () => {
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerout', onOut);
    if (active) { active.removeEventListener('pointermove', onMove); resetTilt(active); }
    if (raf != null) cancelAnimationFrame(raf);
  };
}

// ---------------------------------------------------------------------------
// mountFx — single motionScope wrapping whichever sub-features are requested.
// ---------------------------------------------------------------------------

export function mountFx({ magnetic = true, tilt = true } = {}) {
  const scope = motionScope(() => {
    const cleanups = [magnetic && mountMagnetic(), tilt && mountTilt()].filter(Boolean);
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
  const count = Math.min(opts.count ?? 40, 40);
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
