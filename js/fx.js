// toast + ละอองทอง + เส้นชีพจร
import { esc } from './fmt.js?v=46';

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

// ════════ เส้นชีพจร (ECG) แบบจอมอนิเตอร์ ════════
// ปกติ = เส้นตรง · มีเหตุการณ์ → เกิดคลื่นที่ขอบขวาแล้วไหลไปซ้าย (เหตุการณ์ติดกันต่อเป็นขบวน)
// สีเดียวทั้งเส้น (สี accent) · push(amp, kind): amp = px (บวก = ขึ้น · ลบ = ลง) · kind: 'beat' คลื่นหัวใจ | 'hump' นูนเตี้ย
// setCalling(n): มีคนกำลังโทร → แท่งชีพจร ขึ้น-ลง ความถี่คงที่ (1 แท่ง / 1.2 วิ) สูงตามจำนวนคน · วางสายหมด = เส้นตรง
// หยุดวาดเองเมื่อเส้นเรียบและไม่มีคิว (ไม่กิน CPU ตอนเงียบ) · แท็บซ่อน = ไม่วาด
export function createEcg(host) {
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  host.replaceChildren(cv);
  const ctx = cv.getContext('2d');
  const GAP = 5;                              // ช่องว่างระหว่างคลื่น (px)
  // ความเร็ว: เส้นทั้งจอ = 1 นาทีล่าสุด (เจ้านายกำหนด) · คิวยาว (ช่วงคึก) → เร่ง ×3 ไม่ให้คลื่นค้างคิว
  const speed = () => Math.max(4, W / 30) * (q.length > 90 ? 3 : 1);   // ทั้งจอ = 30 วินาทีล่าสุด
  const HUM_SHAPE = [0, .55, 1, .2, -.65, -1, -.4, 0];   // แท่งชีพจร: ขึ้นแล้วลง (ขึ้น/ลงไม่มีความหมายแยก)
  const humEvery = () => Math.max(16, Math.round(Math.max(4, W / 30) * 1.2));   // ความถี่คงที่ 1 แท่ง / 1.2 วิ (จอแคบขั้นต่ำ 16px)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, y = [], tone = [], q = [], raf = 0, last = 0, acc = 0, moved = 0, active = true, col = null, hum = 0, phase = 0;   // phase = ตำแหน่งในรอบแท่งชีพจร

  function colors() {
    const cs = getComputedStyle(host);
    col = [cs.getPropertyValue('--accent').trim() || '#0071e3', cs.getPropertyValue('--up').trim() || '#1a9e4b', cs.getPropertyValue('--down').trim() || '#d70015', document.documentElement.classList.contains('dark') ? '#ff9f0a' : '#f59e0b'];
  }
  function resize() {
    const w = Math.max(1, Math.round(host.clientWidth)), h = Math.max(1, Math.round(host.clientHeight));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w !== W) {   // คงคลื่นที่วิ่งอยู่ (ชิดขวา)
      const ny = new Array(w).fill(0), nt = new Array(w).fill(0);
      for (let k = 1; k <= Math.min(w, W); k++) { ny[w - k] = y[W - k]; nt[w - k] = tone[W - k]; }
      y = ny; tone = nt; W = w;
    }
    H = h; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    colors(); draw();
  }
  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(-acc, 0);   // เลื่อนเศษพิกเซล → วิ่งลื่นแม้ความเร็วต่ำ
    const mid = H / 2, cap = mid - 1.5;
    const Y = (k) => mid - Math.max(-cap, Math.min(cap, y[k]));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // เส้นฐานทั้งเส้น (จาง)
    ctx.globalAlpha = active ? .3 : .12; ctx.strokeStyle = col[0]; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(0, Y(0)); for (let k = 1; k < W; k++) ctx.lineTo(k, Y(k)); ctx.stroke();
    if (!active) return;
    // ช่วงที่เป็นคลื่น (เข้ม · สีตามชนิด)
    ctx.globalAlpha = .95; ctx.lineWidth = 1.8;
    for (let k = 1; k < W; k++) {
      if (!y[k] && !y[k - 1]) continue;
      let e = k; const t = tone[k];
      while (e < W && (y[e] || y[e - 1]) && tone[e] === t) e++;
      ctx.strokeStyle = col[0]; ctx.beginPath();   // สีเดียว ctx.moveTo(k - 1, Y(k - 1));
      for (let m = k; m < e; m++) ctx.lineTo(m, Y(m));
      ctx.stroke(); k = e - 1;
    }
  }
  const idle = () => !hum && !q.length && !y.some((v) => v);
  function frame(t) {
    raf = 0;
    if (document.hidden) { last = 0; return; }
    const dt = last ? Math.min(.1, (t - last) / 1000) : 0; last = t;
    const mv = dt * speed(); acc += mv; moved += mv;
    let n = Math.floor(acc); acc -= n;
    if (n > 0) {
      n = Math.min(n, W);
      const add = q.splice(0, n);
      while (add.length < n) {   // ไม่มีเหตุการณ์ → มีคนกำลังโทร = คลื่นส้มต่อเนื่อง (แรงตามจำนวนคน) · ไม่มี = เส้นตรง
        if (hum) { const v = phase < HUM_SHAPE.length ? hum * HUM_SHAPE[phase] : 0; add.push([v || (phase < HUM_SHAPE.length ? 0.0001 : 0), 0]); phase = (phase + 1) % humEvery(); } else { phase = 0; add.push([0, 0]); }
      }
      y.splice(0, n); tone.splice(0, n);
      for (const [v, c] of add) { y.push(v); tone.push(c); }
    }
    if (moved >= Math.max(.34, speed() / 30)) { moved = 0; draw(); }   // วาดเมื่อขยับพอ (≤ 30 ครั้ง/วิ · ประหยัดเครื่อง · ยังลื่น)
    if (idle()) { last = 0; acc = 0; return; }
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && active && !document.hidden) raf = requestAnimationFrame(frame); };

  function wave(amp, kind) {
    const out = [];
    if (kind === 'hump') {   // นูนเรียบ ๆ
      const w = 22; for (let k = 0; k < w; k++) out.push(amp * Math.sin(Math.PI * k / (w - 1)));
      return out;
    }
    // P · Q · R · S · T แบบคลื่นหัวใจ (amp ลบ = กลับหัว R ชี้ลง)
    const pts = [[0, 0], [3, .12], [6, 0], [9, 0], [11, -.18], [14, 1], [17, -.38], [20, 0], [24, 0], [28, .2], [32, 0]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, v0] = pts[i - 1], [x1, v1] = pts[i];
      for (let x = x0; x < x1; x++) out.push(amp * (v0 + (v1 - v0) * (x - x0) / (x1 - x0)));
    }
    return out;
  }

  new ResizeObserver(resize).observe(host);
  new MutationObserver(colors).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });   // สลับธีม
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  return {
    push(amp, kind = 'beat', t = 0) {
      if (!active || reduce || !amp || document.hidden) return;   // แท็บซ่อน = ไม่สะสมคิว (กลับมาจะไม่เล่นคลื่นเก่าย้อนหลัง)
      if (q.length > W * 1.5) return;          // คิวล้น (สัญญาณถี่ผิดปกติ) → ทิ้ง
      if (q.length) for (let k = 0; k < GAP; k++) q.push([0, 0]);
      for (const v of wave(amp, kind)) q.push([v || 0.0001, t]);   // 0.0001 = ยังนับเป็นช่วงคลื่น (สีเข้มต่อเนื่อง)
      kick();
    },
    setActive(v) { active = v; if (!v) { q = []; hum = 0; y.fill(0); } draw(); },
    // จำนวนคนที่กำลังโทรอยู่ → คลื่นต่อเนื่อง 1 คน ≈ 3px … ยิ่งหลายคนยิ่งแรง (สูงสุด 11px)
    setCalling(n) { const h = active && !reduce && n > 0 ? Math.min(11, 1.8 + n * 1.3) : 0; if (h !== hum) { hum = h; kick(); } },
  };
}
export function beat(el) {
  if (!el) return;
  el.classList.add('beat');
  clearTimeout(el._bt);
  el._bt = setTimeout(() => el.classList.remove('beat'), 160);
}
