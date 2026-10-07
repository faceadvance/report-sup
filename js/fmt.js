// ตัวจัดรูปแบบ — เวลาแสดงตามเวลาไทยเสมอ
const TZ = 'Asia/Bangkok';
export const int = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US'));
export const money = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US'));
export const pct = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(2) + '%');
export function hm(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
}
export function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return Math.floor(s / 60) + ' นาทีที่แล้ว';
  if (s < 86400) return Math.floor(s / 3600) + ' ชม.ที่แล้ว';
  return Math.floor(s / 86400) + ' วันที่แล้ว';
}
export const dur = (min) => (min > 0 ? `${Math.floor(min / 60)}ชม. ${String(min % 60).padStart(2, '0')}น.` : '—');
// วันที่ (ISO yyyy-mm-dd) ตามเวลาไทย
export function todayISO(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export function diffDays(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_MON_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export function thDate(iso, withYear = false) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MON[m - 1]}${withYear ? ' ' + String(y + 543).slice(2) : ''}`;
}
export function thDow(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return TH_DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
// นาทีนับจากเที่ยงคืน (เวลาไทย) ของ ISO timestamp
export function bkkMinutes(iso) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const h = +p.find((x) => x.type === 'hour').value % 24, mi = +p.find((x) => x.type === 'minute').value;
  return h * 60 + mi;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// talktime นาที:วินาที (นาทีเกิน 60 ได้ เช่น 152:30)
export const mmss = (sec) => { const t = Math.max(0, Math.round(sec || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
