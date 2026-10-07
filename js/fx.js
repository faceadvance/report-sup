// toast + ละอองทอง + เส้นชีพจร
import { esc } from './fmt.js?v=50';

export function toast(html, { icon = '✨', err = false, ms = 3800 } = {}) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.innerHTML = `<span class="t-ico">${icon}</span><div>${html}</div>`;
  box.prepend(t);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 360); }, ms);
}
export const toastText = (text, opts) => toast(esc(text), opts);

export function burst(host, n = 16) {
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const b = document.createElement('div');
  b.className = 'burst';
  const r = host.getBoundingClientRect();
  b.style.left = Math.min(r.width - 40, 70) + 'px';
  b.style.top = '1.5rem';
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * .4;
    const d = 30 + Math.random() * 55;
    const s = document.createElement('i');
    s.style.setProperty('--dx', Math.cos(a) * d + 'px');
    s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    s.style.animationDelay = Math.random() * 80 + 'ms';
    b.appendChild(s);
  }
  host.appendChild(b);
  host.classList.remove('flash'); void host.offsetWidth; host.classList.add('flash');
  setTimeout(() => b.remove(), 1200);
  if (navigator.vibrate) try { navigator.vibrate(30); } catch { /* บางเครื่องไม่ให้ */ }
}

// ════════ เส้นชีพจร (ECG) แบบจอมอนิเตอร์ (sweep) ════════
// หัวเขียน (จุดเรือง) วิ่งซ้าย→ขวาด้วยความเร็วแนวนอนคงที่ (ทั้งจอ = 30 วิ) เขียนเส้นทับรอบเก่า · หน้าหัวเขียนมีช่องลบ · ถึงขวาสุดวนกลับซ้าย
// เส้นใหม่เข้ม เก่าจางลงตามอายุ · ช่วงยักขึ้นลงหัวเขียนจะดูพุ่งเร็ว (ระยะทางเส้นยาวในเวลาเท่ากัน) เหมือนเครื่องจริง
// สีเดียว · push(amp, kind): amp = px (บวก = ขึ้น · ลบ = ลง) · kind: 'beat' คลื่นหัวใจ | 'hump' นูนเตี้ย
// setCalling(n): มีคนกำลังโทร → คลื่นหัวใจต่อเนื่องจังหวะคงที่ สูงตามจำนวนคน · วางสายหมด = เส้นตรง
// แท็บซ่อน = หยุดวาด · โหมดย้อนหลัง/ลดการเคลื่อนไหว = เส้นตรงนิ่ง
export function createEcg(host) {
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  host.replaceChildren(cv);
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ERASE = 18, FADE_BUCKETS = 8;
  const ECG_PTS = [[0, 0], [.06, 0], [.12, .1], [.18, 0], [.3, 0], [.34, -.15], [.4, 1], [.46, -.42], [.5, 0], [.62, 0], [.72, .22], [.82, 0], [1, 0]];
  const ecgAt = (t) => { for (let k = 1; k < ECG_PTS.length; k++) { const [x0, v0] = ECG_PTS[k - 1], [x1, v1] = ECG_PTS[k]; if (t <= x1) return v0 + (v1 - v0) * (t - x0) / (x1 - x0); } return 0; };
  let W = 0, H = 0, dpr = 1, y = [], q = [], raf = 0, last = 0, head = 0, active = true, col = '#0071e3', hum = 0, phase = 0;
  const speed = () => Math.max(36, W / 30);                                    // px/วินาที: คอม = ทั้งจอ 30 วิ · จอแคบ (มือถือ) ไม่ช้ากว่า 36 px/วิ (ไม่อืด · ทั้งจอ ≈ 11 วิ)
  const humPeriod = () => Math.max(26, Math.round(speed() * .8));              // ~75 ครั้ง/นาที

  function colors() { col = getComputedStyle(host).getPropertyValue('--accent').trim() || '#0071e3'; }
  function resize() {
    const w = Math.max(1, Math.round(host.clientWidth)), h = Math.max(1, Math.round(host.clientHeight));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w !== W) { y = new Array(w).fill(0); head = Math.min(head, w - 1); W = w; }
    H = h; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    colors(); draw();
  }
  function nextSample() {
    if (q.length) { const v = q.shift(); if (!(hum && !v)) return v; }   // ช่องว่างระหว่างคลื่นตอนมีคนโทร → คลื่นหัวใจเดินต่อ
    if (hum) { const P = humPeriod(), v = hum * ecgAt(phase / P); phase = (phase + 1) % P; return v; }
    phase = 0; return 0;
  }
  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2, cap = mid - 2;
    const Y = (k) => mid - Math.max(-cap, Math.min(cap, y[k] || 0));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col;
    if (!active) { ctx.globalAlpha = .12; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke(); return; }
    const hx = Math.floor(head);
    // วาดเป็นช่วงตามอายุ (ใหม่ = เข้ม · เก่า = จาง) · เว้นช่องลบหน้าหัวเขียน
    for (let b = FADE_BUCKETS - 1; b >= 0; b--) {
      const a0 = Math.round((W * b) / FADE_BUCKETS), a1 = Math.round((W * (b + 1)) / FADE_BUCKETS);   // อายุ a0..a1 px หลังหัวเขียน
      ctx.globalAlpha = .18 + .8 * Math.pow(1 - b / FADE_BUCKETS, 1.6);
      ctx.lineWidth = b === 0 ? 1.8 : 1.4;
      ctx.beginPath(); let pen = false, pk = -1;
      for (let a = a1; a >= a0; a--) {
        if (a > W - ERASE) { pen = false; continue; }   // ช่องลบหน้าหัวเขียน
        const k = (((hx - a) % W) + W) % W;
        if (pen && k < pk) pen = false;                 // วนจากขอบขวากลับซ้าย → ไม่ลากเส้นข้ามจอ
        if (!pen) { ctx.moveTo(k, Y(k)); pen = true; } else ctx.lineTo(k, Y(k));
        pk = k;
      }
      ctx.stroke();
    }
    // หัวเขียน: จุดเรือง
    ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(hx, Y(hx), 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  function frame(t) {
    raf = 0;
    if (document.hidden || !active || reduce) { last = 0; return; }
    const dt = last ? Math.min(.1, (t - last) / 1000) : 0; last = t;
    const prev = Math.floor(head);
    head += dt * speed();
    let cur = Math.floor(head);
    for (let x = prev + 1; x <= cur; x++) { const k = x % W; y[k] = nextSample(); }
    if (head >= W) head -= W;
    draw();
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && active && !reduce && !document.hidden) raf = requestAnimationFrame(frame); };
  function wave(amp, kind) {
    const out = [];
    if (kind === 'hump') { const w = 22; for (let k = 0; k < w; k++) out.push(amp * Math.sin(Math.PI * k / (w - 1))); return out; }
    const pts = [[0, 0], [3, .12], [6, 0], [9, 0], [11, -.18], [14, 1], [17, -.38], [20, 0], [24, 0], [28, .2], [32, 0]];
    for (let k = 1; k < pts.length; k++) { const [x0, v0] = pts[k - 1], [x1, v1] = pts[k]; for (let x = x0; x < x1; x++) out.push(amp * (v0 + (v1 - v0) * (x - x0) / (x1 - x0))); }
    return out;
  }
  new ResizeObserver(resize).observe(host);
  new MutationObserver(() => { colors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  kick();
  return {
    push(amp, kind = 'beat') {
      if (!active || reduce || !amp || document.hidden) return;   // แท็บซ่อน = ไม่สะสมคิว
      if (q.length > W) return;                                    // คิวล้น (สัญญาณถี่ผิดปกติ) → ทิ้ง
      if (q.length) for (let k = 0; k < 5; k++) q.push(0);
      for (const v of wave(amp, kind)) q.push(v);
    },
    setActive(v) { active = v; if (!v) { q = []; hum = 0; y.fill(0); head = 0; } draw(); kick(); },
    setCalling(n) { hum = active && !reduce && n > 0 ? Math.min(12, 4 + n * 1.2) : 0; },   // 1 คน ≈ 5px … 7 คนขึ้นไป = สุด
  };
}
export function beat(el) {
  if (!el) return;
  el.classList.add('beat');
  clearTimeout(el._bt);
  el._bt = setTimeout(() => el.classList.remove('beat'), 160);
}
