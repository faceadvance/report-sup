// ศูนย์แจ้งเตือน (วันนี้) · รายการมาจากฐานข้อมูล (sup_notifications) → ทุกเครื่องของบัญชีเห็นชุดเดียวกัน ไม่ซ้ำ
// คอม = ปุ่มลอยมุมขวาล่าง → กล่องรายการ · มือถือ = แถบดึงที่ขอบขวา → แถบด้านข้างเลื่อนออกมา
// จุดแดง = มีรายการใหม่กว่า seen_at ของบัญชี · เปิดดูจากเครื่องไหนก็ได้ → จุดหายทุกเครื่อง (เครื่องอื่นเช็คทุก 1 นาที/ตอนกลับมาที่แอป)
import { esc, money } from './fmt.js?v=60';

const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
const LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON = { order: '🎉', longcall: '⏰' };

// ข้อความแจ้งเตือน (ใช้ทั้ง popup และรายการ)
export function noteHtml(n) {
  const who = `<b>${esc(n.emp)}</b> ${esc(n.name || '')}`;
  if (n.kind === 'order') { const a = Number(n.data?.amount) || 0; return `${who} ปิดออเดอร์${a > 0 ? ` <b>${money(a)}฿</b>` : ''}`; }
  if (n.kind === 'longcall') return `${who} กำลังโทรนาน <b>${Number(n.data?.minutes) || 0} นาที</b>`;
  return who;
}
export const noteIcon = (n) => ICON[n.kind] || '🔔';

const ts = (t) => Date.parse(t) || 0;
const hm = (t) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? 'เมื่อสักครู่' : m < 60 ? `${m} นาทีที่แล้ว` : `${Math.floor(m / 60)} ชม. ${m % 60} นาทีที่แล้ว`;
}

export function createNotifyCenter({ fetchNotes, markSeen, onPick } = {}) {
  let items = [], seen = 0, open = false, alive = true;
  try { localStorage.removeItem('sl_nc'); } catch { /* รุ่นเก่าเก็บในเครื่อง → เลิกใช้ */ }

  const fab = document.createElement('button');
  fab.className = 'nc-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'แจ้งเตือนวันนี้');
  fab.innerHTML = `${BELL}<i class="nc-dot"></i>`;
  const tab = document.createElement('button');
  tab.className = 'nc-tab'; tab.type = 'button'; tab.setAttribute('aria-label', 'แจ้งเตือนวันนี้');
  tab.innerHTML = `${LEFT}<i class="nc-dot"></i>`;
  const ov = document.createElement('div'); ov.className = 'nc-ov';
  const panel = document.createElement('aside');
  panel.className = 'nc-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'แจ้งเตือนวันนี้');
  panel.innerHTML = `<header><span class="nc-ico">${BELL}</span><div><b>แจ้งเตือนวันนี้</b><small class="nc-cnt"></small></div><button class="nc-x" type="button" aria-label="ปิด">${CLOSE}</button></header><ol class="nc-list"></ol><button class="nc-xb" type="button" aria-label="ปิด">${CLOSE}</button>`;
  document.body.append(fab, tab, ov, panel);
  const list = panel.querySelector('.nc-list'), cnt = panel.querySelector('.nc-cnt');

  function render() {
    cnt.textContent = items.length ? `${items.length} รายการ` : '';
    list.innerHTML = items.length
      ? items.map((n) => `<li class="nc-item${ts(n.t) > seen ? ' new' : ''}" data-emp="${esc(n.emp || '')}"><span class="nc-i">${noteIcon(n)}</span><div class="nc-tx"><p>${noteHtml(n)}</p><time>${hm(n.t)} · ${ago(ts(n.t))}</time></div></li>`).join('')
      : '<li class="nc-empty">ยังไม่มีแจ้งเตือนวันนี้<br><small>ปิดออเดอร์ · โทรนาน จะมาอยู่ที่นี่</small></li>';
    const unread = !open && items.some((n) => ts(n.t) > seen);
    fab.classList.toggle('unread', unread); tab.classList.toggle('unread', unread);
  }
  async function refresh() {
    if (!alive || document.hidden || !fetchNotes) return;
    try {
      const r = await fetchNotes();
      if (!alive) return;
      items = Array.isArray(r?.items) ? r.items : [];
      seen = Math.max(seen, ts(r?.seen_at));
      render();
    } catch { /* เครือข่ายสะดุด → รอบหน้า */ }
  }
  async function setOpen(v) {
    open = v;
    document.documentElement.classList.toggle('nc-open', v);
    render();
    if (v) {
      const local = Date.now();
      try { const t = await markSeen?.(); seen = Math.max(seen, ts(t) || local); } catch { seen = Math.max(seen, local); }
      fab.classList.remove('unread'); tab.classList.remove('unread');
    } else render();   // ปิดแล้ว → รายการใหม่เลิกไฮไลต์
  }
  fab.addEventListener('click', () => setOpen(!open));
  tab.addEventListener('click', () => setOpen(true));
  ov.addEventListener('click', () => setOpen(false));
  panel.querySelector('.nc-x').addEventListener('click', () => setOpen(false));
  panel.querySelector('.nc-xb').addEventListener('click', () => setOpen(false));   // มือถือ: ปุ่มปิดมุมขวาล่าง (นิ้วโป้งถึง)
  const onKey = (e) => { if (e.key === 'Escape' && open) setOpen(false); };
  const onDoc = (e) => { if (open && !panel.contains(e.target) && !fab.contains(e.target) && !tab.contains(e.target) && matchMedia('(min-width: 601px)').matches) setOpen(false); };
  const onVis = () => { if (!document.hidden) refresh(); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onDoc);
  document.addEventListener('visibilitychange', onVis);
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.nc-item'); if (!li || !li.dataset.emp) return;
    if (matchMedia('(max-width: 600px)').matches) setOpen(false);
    onPick?.(li.dataset.emp);
  });
  let sx = null;   // ปัดไปทางขวาเพื่อปิด (มือถือ)
  panel.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  panel.addEventListener('touchend', (e) => { if (sx !== null && e.changedTouches[0].clientX - sx > 70) setOpen(false); sx = null; }, { passive: true });
  const poll = setInterval(refresh, 60000);   // ซิงก์รายการ + สถานะอ่านแล้วจากเครื่องอื่น (และอัปเดต "x นาทีที่แล้ว")
  render(); refresh();

  return {
    // สัญญาณ realtime 'note' (ทีมที่กำลังดู) → เพิ่มทันที · id ซ้ำ = ข้าม
    push(n) {
      if (!n || items.some((x) => x.id === n.id)) return false;
      items.unshift(n); if (items.length > 200) items.length = 200;
      if (open) { seen = Math.max(seen, ts(n.t)); markSeen?.().catch?.(() => {}); }
      render(); return true;
    },
    refresh,
    destroy() { alive = false; clearInterval(poll); document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDoc); document.removeEventListener('visibilitychange', onVis); document.documentElement.classList.remove('nc-open'); fab.remove(); tab.remove(); ov.remove(); panel.remove(); },
  };
}
