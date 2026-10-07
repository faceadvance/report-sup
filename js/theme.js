// ธีมสว่าง/มืด + สวิตช์ ☀️/🌙 + ฉากพระอาทิตย์ตก/ขึ้นตอนสลับ + เสียง (ยกจาก stock-live)
import { Snd } from './sound.js?v=43';
const KEY = 'slTheme';
const root = document.documentElement;
const isDark = () => root.classList.contains('dark');
const meta = () => document.querySelector('meta[name=theme-color]');

export function initTheme() {
  const saved = localStorage.getItem(KEY);
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.classList.toggle('dark', dark);
  syncMeta();
  ensureScene();
}
function syncMeta() { const m = meta(); if (m) m.content = isDark() ? '#000000' : '#f5f5f7'; }
function save() { localStorage.setItem(KEY, isDark() ? 'dark' : 'light'); syncMeta(); }

// ── ฉากพื้นหลังถาวร: สปอตไลต์ + จุดแสงลอย + คลื่น ping · ฉากฟ้า+ดวงอาทิตย์/จันทร์ (ใช้ตอนสลับ) ──
let scene = null;
function ensureScene() {
  if (scene) return scene;
  scene = document.createElement('div');
  scene.className = 'bgfx';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = '<div class="spot"></div><div class="ping"></div><div class="motes"></div>';
  const motes = scene.querySelector('.motes');
  const n = innerWidth > 900 ? 28 : 18;
  for (let i = 0; i < n; i++) {
    const m = document.createElement('i');
    const z = (Math.random() * 2 + 1).toFixed(1);
    m.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;--z:${z}px;--o:${(Math.random() * .5 + .3).toFixed(2)};--travel:${(70 + Math.random() * 40).toFixed(0)}vh;animation-duration:${(10 + Math.random() * 14).toFixed(1)}s;animation-delay:${(Math.random() * -24).toFixed(1)}s`;
    motes.appendChild(m);
  }
  const sky = document.createElement('div');
  sky.className = 'sky';
  sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = '<div class="skyg"></div><div class="orb sun"></div><div class="orb moon"></div>';
  document.body.prepend(sky);
  document.body.prepend(scene);
  return scene;
}
// คลื่นแผ่จากกลางจอ (เรียกตอนมีสัญญาณข้อมูลใหม่)
export function ping() {
  const s = ensureScene();
  s.classList.remove('pinging'); void s.offsetWidth; s.classList.add('pinging');
}

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>';

// สวิตช์: แตะฝั่งดวงอาทิตย์ = สว่าง · ฝั่งพระจันทร์ = มืด · แตะโหมดเดิม = เด้งบอก
export function themeToggle() {
  const b = document.createElement('button');
  b.className = 'tg';
  b.type = 'button';
  b.setAttribute('aria-label', 'สลับโหมดสว่าง/มืด');
  b.innerHTML = `<span class="knob"></span><span class="ic ic-sun">${SUN}</span><span class="ic ic-moon">${MOON}</span>`;
  b.addEventListener('click', (ev) => {
    const r = b.getBoundingClientRect();
    const side = ev.target.closest('.ic-sun') ? 0 : ev.target.closest('.ic-moon') ? 1 : (ev.clientX > r.left + r.width / 2 ? 1 : 0);
    swap(!!side, b);
  });
  return b;
}

let swapping = false;
const ORB = () => {
  const W = innerWidth, H = innerHeight, desk = W >= 900;
  return { cx: W / 2, cy: H * (desk ? .36 : .5), a: W * (desk ? .46 : .5), b: H * (desk ? .36 : .4), os: desk ? 110 : 78 };
};
const orbAt = (o, deg) => { const t = (deg * Math.PI) / 180; return [o.cx + o.a * Math.cos(t), o.cy + o.b * Math.sin(t)]; };

function nudge(tg) {
  const kn = tg.querySelector('.knob'), x = isDark() ? 38 : 0, d = isDark() ? -5 : 5;
  Snd.tap();
  kn.animate([{ transform: `translateX(${x}px)` }, { transform: `translateX(${x + d}px) scaleX(1.06)` }, { transform: `translateX(${x}px)` }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}

export function swap(wantDark, tg) {
  if (swapping) return;
  if (wantDark === isDark()) { if (tg) nudge(tg); return; }
  const toDark = wantDark;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !document.body.animate) {   // ลดการเคลื่อนไหว: ข้ามฉาก แต่ยังมีเสียง
    toDark ? Snd.dusk() : Snd.dawn(); Snd.toggle(); toDark ? Snd.howl(.3) : Snd.crow(.3);
    root.classList.toggle('dark', toDark); save(); return;
  }
  swapping = true;
  ensureScene();
  toDark ? Snd.dusk() : Snd.dawn(); Snd.toggle(); toDark ? Snd.howl(.7) : Snd.crow(1.3); Snd.sample('ambient', 0, .4);   // หมาป่าหอนตอนอาทิตย์ลับ · ไก่ขันตอนอาทิตย์ขึ้น
  const sky = document.querySelector('.sky'), g = sky.querySelector('.skyg');
  const sun = sky.querySelector('.sun'), moon = sky.querySelector('.moon');
  const o = ORB();
  sky.style.setProperty('--os', o.os + 'px');
  const D = 2400, N = 60, S0 = 225;
  const outgoing = toDark ? sun : moon, incoming = toDark ? moon : sun;
  const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const frames = (start, op, rot) => Array.from({ length: N + 1 }, (_, i) => {
    const u = i / N, deg = start + 180 * ease(u), [x, y] = orbAt(o, deg), rad = (deg * Math.PI) / 180;
    const depth = .86 + .24 * (Math.sin(rad) + 1) / 2;
    return { transform: `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${rot}deg) scale(${depth})`, opacity: op(u), offset: u };
  });
  // สวิตช์ทุกตัวในหน้า เลื่อนตามวงล้อ
  const lin = (a, b, u) => a + (b - a) * u;
  document.querySelectorAll('.tg').forEach((t) => {
    const kn = t.querySelector('.knob'), iS = t.querySelector('.ic-sun'), iM = t.querySelector('.ic-moon');
    kn.animate(Array.from({ length: N + 1 }, (_, i) => {
      const u = i / N, p = toDark ? ease(u) : 1 - ease(u);
      return { transform: `translateX(${38 * p}px) scaleX(${1 + .16 * Math.sin(Math.PI * u)})`, backgroundColor: `rgb(${Math.round(lin(255, 58, p))},${Math.round(lin(255, 58, p))},${Math.round(lin(255, 60, p))})`, offset: u };
    }), { duration: D, easing: 'linear' });
    const ico = (sunSide) => Array.from({ length: N + 1 }, (_, i) => {
      const u = i / N, p = toDark ? ease(u) : 1 - ease(u), on = sunSide ? 1 - p : p;
      return { transform: `rotate(${sunSide ? -90 * p : 30 * (1 - p)}deg) scale(${.85 + .15 * on})`, offset: u };
    });
    iS.animate(ico(true), { duration: D, easing: 'linear' });
    iM.animate(ico(false), { duration: D, easing: 'linear' });
  });
  root.classList.add('swap');
  outgoing.animate(frames(S0, (u) => .9 * clamp(u / .1) * clamp((.6 - u) / .14), toDark ? 0 : -18), { duration: D, easing: 'linear', fill: 'both' });
  const HOLD = 800, FADE = 700, TOT = D + HOLD + FADE, rotIn = toDark ? -18 : 0, R = orbAt(o, S0);
  const kIn = frames(S0 - 180, (u) => .95 * clamp((u - .35) / .25), rotIn).map((f) => ({ ...f, offset: (f.offset * D) / TOT }));
  const at = (dy, sc, op, off) => ({ transform: `translate(${R[0]}px,${R[1] + dy}px) translate(-50%,-50%) rotate(${rotIn}deg) scale(${sc})`, opacity: op, offset: off });
  const dep = .86 + .24 * (Math.sin((S0 * Math.PI) / 180) + 1) / 2;
  kIn.push(at(-4, dep, .95, (D + HOLD * .5) / TOT), at(0, dep, .95, (D + HOLD) / TOT), at(-6, dep * (toDark ? .94 : 1.12), 0, 1));
  incoming.animate(kIn, { duration: TOT, easing: 'linear', fill: 'both' });
  g.style.background = toDark ? 'linear-gradient(180deg,#2b2350 0%,#7a3b6e 40%,#e2656b 72%,#ffb36b 100%)' : 'linear-gradient(180deg,#8ec5ff 0%,#ffd7a8 60%,#ffb070 100%)';
  g.animate([{ opacity: 0 }, { opacity: .55, offset: .2 }, { opacity: .85, offset: .38 }, { opacity: .85, offset: .5 }, { opacity: .4, offset: .72 }, { opacity: 0 }], { duration: D, easing: 'cubic-bezier(.45,.05,.55,.95)' });
  setTimeout(() => { root.classList.toggle('dark', toDark); save(); }, D * .3);
  setTimeout(() => { outgoing.getAnimations().forEach((a) => a.cancel()); root.classList.remove('swap'); }, D + 80);
  setTimeout(() => { incoming.getAnimations().forEach((a) => a.cancel()); swapping = false; }, TOT + 80);
}
