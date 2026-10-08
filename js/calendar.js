// ปฏิทินเลือกช่วง: แตะวันเริ่ม → แตะวันจบ · แตะวันเดิม 2 ครั้ง = วันเดียว · ไม่เกิน maxDays · ไม่ก่อน min/หลัง max
import { TH_MON_FULL, TH_DOW, thDate, addDays, diffDays } from './fmt.js?v=59';
import { LEFT, RIGHT } from './icons.js?v=59';
import { Snd } from './sound.js?v=59';

export function pickRange({ from, to, min, max, maxDays = 31 }) {
  return new Promise((resolve) => {
    let a = from, b = to, pending = false;
    let [vy, vm] = to.split('-').map(Number);
    const ov = document.createElement('div'); ov.className = 'overlay';
    const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'เลือกช่วงวันที่');
    sh.innerHTML = `<div class="grab"></div>
      <div class="cal-head"><h4></h4><div class="cal-nav">
        <button class="icon-btn" data-nav="-1" aria-label="เดือนก่อน">${LEFT}</button>
        <button class="icon-btn" data-nav="1" aria-label="เดือนถัดไป">${RIGHT}</button></div></div>
      <div class="cal-dow">${TH_DOW.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid"></div>
      <div class="cal-hint"></div>
      <div class="cal-actions"><button class="btn-plain" data-act="cancel">ยกเลิก</button><button class="btn-gold" data-act="ok">ดูช่วงนี้</button></div>`;
    document.body.append(ov, sh);
    const grid = sh.querySelector('.cal-grid'), hint = sh.querySelector('.cal-hint'), okBtn = sh.querySelector('[data-act=ok]');

    const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    function render() {
      sh.querySelector('h4').innerHTML = `${TH_MON_FULL[vm - 1]}<span>${vy + 543}</span>`;
      const first = new Date(Date.UTC(vy, vm - 1, 1)).getUTCDay();
      const days = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
      let html = '';
      for (let i = 0; i < first; i++) html += '<span class="cal-blank" aria-hidden="true"></span>';
      const lo = a && b ? a : a, hi = a && b ? b : a;
      for (let d = 1; d <= days; d++) {
        const k = iso(vy, vm, d);
        let dis = k < min || k > max;
        if (pending && a && Math.abs(diffDays(a, k)) > maxDays - 1) dis = true;
        const cls = [];
        if (lo && hi && k >= lo && k <= hi && !pending) cls.push('in');
        if (k === lo) cls.push('s');
        if ((!pending && k === hi) || (pending && k === a)) cls.push('e');
        if (k === max) cls.push('today');
        html += `<button data-d="${k}" class="${cls.join(' ')}" ${dis ? 'disabled' : ''} aria-label="${thDate(k, true)}"><span>${d}</span></button>`;
      }
      grid.innerHTML = html;
      okBtn.disabled = pending || !a || !b;
      if (pending) { hint.className = 'cal-hint'; hint.textContent = 'แตะวันสิ้นสุด · แตะวันเดิมอีกครั้ง = ดูวันเดียว'; }
      else if (a && b) { const n = diffDays(a, b) + 1; hint.className = 'cal-hint'; hint.textContent = a === b ? `ดูวันเดียว · ${thDate(a, true)}` : `${thDate(a)} – ${thDate(b, true)} · ${n} วัน`; }
      const prevOk = iso(vy, vm, 1) > min, nextOk = iso(vy, vm, days) < max;
      sh.querySelector('[data-nav="-1"]').disabled = !prevOk;
      sh.querySelector('[data-nav="1"]').disabled = !nextOk;
    }
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-d]');
      if (!btn || btn.disabled) return;
      const k = btn.dataset.d;
      Snd.tap();
      if (!pending) { a = k; b = null; pending = true; }
      else {
        if (k < a) { b = a; a = k; } else b = k;
        if (diffDays(a, b) + 1 > maxDays) { hint.className = 'cal-hint warn'; hint.textContent = `เลือกได้ไม่เกิน ${maxDays} วัน`; Snd.fail(); grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake'); b = null; return; }
        pending = false;
      }
      render();
    });
    sh.querySelector('.cal-nav').addEventListener('click', (e) => {
      const n = e.target.closest('[data-nav]'); if (!n || n.disabled) return;
      vm += +n.dataset.nav; if (vm < 1) { vm = 12; vy--; } if (vm > 12) { vm = 1; vy++; }
      grid.style.animation = 'none'; void grid.offsetWidth; grid.style.animation = 'fadeUp .3s var(--ease-out)';
      render();
    });
    function close(val) {
      ov.classList.add('out'); sh.classList.add('out');
      setTimeout(() => { ov.remove(); sh.remove(); }, 300);
      document.removeEventListener('keydown', onKey);
      resolve(val);
    }
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', () => close(null));
    sh.querySelector('[data-act=cancel]').addEventListener('click', () => close(null));
    okBtn.addEventListener('click', () => { if (a && b) { Snd.next(); close({ from: a, to: b }); } });
    // ปัดลงเพื่อปิด (มือถือ)
    let y0 = null, dy = 0;
    sh.addEventListener('touchstart', (e) => { if (e.target.closest('.cal-grid button, .cal-actions, .cal-nav')) return; y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
    sh.addEventListener('touchmove', (e) => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
    sh.addEventListener('touchend', () => { if (y0 === null) return; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) close(null); y0 = null; });
    render();
  });
}
