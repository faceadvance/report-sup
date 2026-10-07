// toast + ละอองทอง + เส้นชีพจร
import { esc } from './fmt.js?v=10';

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

// ECG 2 ช่วง (กว้าง 200% แล้วเลื่อน -50% วนต่อเนื่อง)
export function pulseSvg() {
  const seg = (x) => `L${x + 60},11 L${x + 70},11 L${x + 76},5 L${x + 82},17 L${x + 90},1 L${x + 98},21 L${x + 104},11 L${x + 150},11`;
  let d = 'M0,11';
  for (let x = 0; x < 1200; x += 150) d += ' ' + seg(x);
  return `<svg viewBox="0 0 1200 22" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}
export function beat(el) {
  if (!el) return;
  el.classList.add('beat');
  clearTimeout(el._bt);
  el._bt = setTimeout(() => el.classList.remove('beat'), 160);
}
