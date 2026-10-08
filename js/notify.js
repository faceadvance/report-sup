// ศูนย์แจ้งเตือน (วันนี้): เก็บทุกแจ้งเตือนที่เด้ง (ปิดออเดอร์ · โทรนาน) ไว้เปิดดูย้อนหลัง
// คอม = ปุ่มลอยมุมขวาล่าง → กล่องรายการ · มือถือ = แถบดึงที่ขอบขวา → แถบด้านข้างเลื่อนออกมา
// เก็บในเครื่อง (localStorage) เฉพาะวันนี้ · จุดแดง = มีรายการที่ยังไม่เปิดดู · ออกจากระบบ = ล้าง
import { esc, todayISO } from './fmt.js?v=54';

const KEY = 'sl_nc', MAX = 200;
const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
const LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && d.day === todayISO() && Array.isArray(d.items)) return d;
  } catch { /* ข้อมูลเสีย → เริ่มใหม่ */ }
  return { day: todayISO(), items: [], seen: 0 };
}
const hm = (t) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? 'เมื่อสักครู่' : m < 60 ? `${m} นาทีที่แล้ว` : `${Math.floor(m / 60)} ชม. ${m % 60} นาทีที่แล้ว`;
}

export function createNotifyCenter({ onPick } = {}) {
  let st = load(), open = false;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* เต็ม/ปิด storage */ } };

  const fab = document.createElement('button');
  fab.className = 'nc-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'แจ้งเตือนวันนี้');
  fab.innerHTML = `${BELL}<i class="nc-dot"></i>`;
  const tab = document.createElement('button');
  tab.className = 'nc-tab'; tab.type = 'button'; tab.setAttribute('aria-label', 'แจ้งเตือนวันนี้');
  tab.innerHTML = `${LEFT}<i class="nc-dot"></i>`;
  const ov = document.createElement('div'); ov.className = 'nc-ov';
  const panel = document.createElement('aside');
  panel.className = 'nc-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'แจ้งเตือนวันนี้');
  panel.innerHTML = `<header><span class="nc-ico">${BELL}</span><div><b>แจ้งเตือนวันนี้</b><small class="nc-cnt"></small></div><button class="nc-x" type="button" aria-label="ปิด">${CLOSE}</button></header><ol class="nc-list"></ol>`;
  document.body.append(fab, tab, ov, panel);
  const list = panel.querySelector('.nc-list'), cnt = panel.querySelector('.nc-cnt');

  function render() {
    if (st.day !== todayISO()) st = { day: todayISO(), items: [], seen: 0 };
    cnt.textContent = st.items.length ? `${st.items.length} รายการ` : '';
    list.innerHTML = st.items.length
      ? st.items.map((it) => `<li class="nc-item${it.t > st.seen ? ' new' : ''}" data-emp="${esc(it.emp || '')}"><span class="nc-i">${it.icon || '🔔'}</span><div class="nc-tx"><p>${it.html}</p><time title="${hm(it.t)}">${hm(it.t)} · ${ago(it.t)}</time></div></li>`).join('')
      : '<li class="nc-empty">ยังไม่มีแจ้งเตือนวันนี้<br><small>ปิดออเดอร์ · โทรนาน จะมาอยู่ที่นี่</small></li>';
    const unread = st.items.some((it) => it.t > st.seen);
    fab.classList.toggle('unread', unread); tab.classList.toggle('unread', unread);
  }
  function setOpen(v) {
    open = v;
    document.documentElement.classList.toggle('nc-open', v);
    if (v) { render(); st.seen = Date.now(); save(); setTimeout(() => { fab.classList.remove('unread'); tab.classList.remove('unread'); }, 300); }
    else render();   // ปิดแล้ว → รายการใหม่เลิกไฮไลต์
  }
  fab.addEventListener('click', () => setOpen(!open));
  tab.addEventListener('click', () => setOpen(true));
  ov.addEventListener('click', () => setOpen(false));
  panel.querySelector('.nc-x').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });
  document.addEventListener('click', (e) => { if (open && !panel.contains(e.target) && !fab.contains(e.target) && !tab.contains(e.target) && matchMedia('(min-width: 601px)').matches) setOpen(false); });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.nc-item'); if (!li || !li.dataset.emp) return;
    if (matchMedia('(max-width: 600px)').matches) setOpen(false);
    onPick?.(li.dataset.emp);
  });
  // ปัดไปทางขวาเพื่อปิด (มือถือ)
  let sx = null;
  panel.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  panel.addEventListener('touchend', (e) => { if (sx !== null && e.changedTouches[0].clientX - sx > 70) setOpen(false); sx = null; }, { passive: true });
  setInterval(() => { if (open) render(); }, 60000);   // อัปเดต "x นาทีที่แล้ว"
  render();

  return {
    add({ icon, html, emp, kind }) {
      if (st.day !== todayISO()) st = { day: todayISO(), items: [], seen: 0 };
      st.items.unshift({ t: Date.now(), icon, html, emp, kind });
      if (st.items.length > MAX) st.items.length = MAX;
      if (open) st.seen = Date.now();
      save(); render();
    },
    clear() { st = { day: todayISO(), items: [], seen: 0 }; try { localStorage.removeItem(KEY); } catch { /* ignore */ } render(); },
    destroy() { setOpen(false); fab.remove(); tab.remove(); ov.remove(); panel.remove(); },
  };
}
