// ฟังสาย (Listen *222) — ฟังก์ชันล้วน ไม่แตะ DOM ยกเว้น openTel · เทส: node supabase/sup-live/tests/listen.test.mjs
// เฉพาะ Windows + เมาส์ + เคยกดปุ่มติดตั้ง (เว็บตรวจไม่ได้ว่าลง YaleCom จริงไหม → ใช้ "เคยกดติดตั้ง" แทน)
// ⚠️ Mac (ต่อ iPhone) / มือถือ: ลิงก์ tel:*222… = โทรออกจริงทางซิม/FaceTime → ห้ามเปิดเด็ดขาด
export const LISTEN_PREFIX = '*222';
export const READY_KEY = 'sl_listen_ready';   // '1' = เคยกดดาวน์โหลดตัวติดตั้งในเครื่องนี้
export const USED_KEY = 'sl_listen_used';     // '1' = เคยสั่งฟังแล้ว (ไม่ต้องโชว์คำแนะนำ Chrome ถามครั้งแรก)
export const GESTURE_MS = 4000;               // Chrome เปิด tel: ได้เฉพาะช่วงสั้น ๆ หลังคลิก (~5 วิ) → เผื่อไว้ 4 วิ
export const LISTEN_ERR = {
  FORBIDDEN: 'ไม่มีสิทธิ์ฟังสายพนักงานคนนี้',
  NOT_CALLING: 'พนักงานวางสายแล้ว',
  NO_YALE_ID: 'พนักงานคนนี้ยังไม่มีเบอร์ภายใน (Yale) ในระบบ แจ้งแอดมินให้เพิ่มก่อน',
  RATE: 'กดฟังถี่เกินไป รอสักครู่แล้วลองใหม่',
  NET: 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  BAD_DIAL: 'เบอร์ภายในในระบบไม่ถูกต้อง แจ้งแอดมิน',
  ERR: 'ระบบขัดข้อง ลองใหม่อีกครั้ง',
  NO_FILE: 'ยังไม่มีไฟล์ตัวติดตั้งในระบบ แจ้งแอดมิน',
  AUTH: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
};

const ua0 = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '');
export const isWindows = (ua = ua0()) => /Windows NT \d/.test(ua || '') && !/Windows Phone/i.test(ua || '');

// 'listen' = คอม Windows + เมาส์ + เครื่องนี้เคยกดดาวน์โหลดตัวติดตั้งแล้ว → คลิกป้าย = popup ฟังสาย
// 'none' = อย่างอื่นทั้งหมด → ทำเหมือนก่อนมีฟังสาย (เมาส์ = เปิดการ์ด · แตะจอ = modal ข้อมูล)
// เจ้านาย 10-16: เครื่องที่ยังไม่ได้โหลดโปรแกรม ห้ามเด้ง popup ติดตั้ง · โหลดได้จากปุ่ม 🎧 ในแถบเครื่องมือเท่านั้น
export function listenMode({ ua = ua0(), pointer, ready }) {
  return pointer === 'mouse' && ready && isWindows(ua) ? 'listen' : 'none';
}

// ตัวเลข 2–6 หลักเท่านั้น (DB check เดียวกัน) · อย่างอื่น = null (ไม่โทร)
export const dialUri = (yale) => (/^[0-9]{2,6}$/.test(String(yale ?? '')) ? `tel:${LISTEN_PREFIX}${yale}` : null);

// เปิดลิงก์ tel: ด้วย anchor ชั่วคราว (ไม่เปลี่ยนหน้า) · ตรวจ Windows ซ้ำอีกชั้นก่อนเปิด
export function openTel(uri) {
  if (!uri || !uri.startsWith('tel:' + LISTEN_PREFIX) || !isWindows()) return false;
  const a = document.createElement('a');
  a.href = uri; a.style.display = 'none';
  document.body.append(a); a.click(); a.remove();
  return true;
}

// กดปุ่มฟัง → RPC (ตรวจสิทธิ์+log+คืนเบอร์) → เปิด tel ถ้ายังอยู่ในช่วงหลังคลิก
// คืน { status: 'dialed' | 'needs_click' | 'error', code?, uri? } · AuthError โยนต่อ
export async function startListen({ emp, rpc, now = () => performance.now(), open = openTel, isAuthError = () => false }) {
  const t0 = now();
  let r;
  try { r = await rpc('sup_listen_start', { p_emp: emp }); }
  catch (e) {
    if (isAuthError(e)) throw e;
    return { status: 'error', code: e?.message === 'network' ? 'NET' : 'ERR' };
  }
  if (!r || typeof r !== 'object') return { status: 'error', code: 'ERR' };
  if (r.ok !== true) return { status: 'error', code: LISTEN_ERR[r.code] ? r.code : 'ERR' };
  const uri = dialUri(r.yale_id);
  if (!uri) return { status: 'error', code: 'BAD_DIAL' };
  if (now() - t0 > GESTURE_MS) return { status: 'needs_click', uri, since: r.since, camp: r.camp };
  open(uri);
  return { status: 'dialed', uri, since: r.since, camp: r.camp };
}

// ขอลิงก์ดาวน์โหลดตัวติดตั้ง (Edge sup-installer · ลิงก์อายุ 5 นาที) → { ok, url } | { ok:false, code }
export async function requestInstaller({ url, token, fetch: f = globalThis.fetch, origin = globalThis.location?.origin }) {
  if (!token) return { ok: false, code: 'AUTH' };
  let r, j;
  try {
    r = await f(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    j = await r.json().catch(() => null);
  } catch { return { ok: false, code: 'NET' }; }
  if (r.status === 401) return { ok: false, code: 'AUTH' };
  if (!j || j.ok !== true) return { ok: false, code: LISTEN_ERR[j?.code] ? j.code : 'ERR' };
  let u;
  try { u = new URL(j.url, origin || undefined); } catch { return { ok: false, code: 'ERR' }; }
  if (u.protocol !== 'https:' && u.origin !== origin) return { ok: false, code: 'ERR' };   // https หรือโดเมนเดียวกัน (dev) เท่านั้น
  return { ok: true, url: u.href };
}

// ขั้นตอนติดตั้ง (โชว์ในกล่องติดตั้ง) · ตามผลเทสจริงของ 028 + HANDOFF
export const INSTALL_STEPS = [
  'กด <b>ดาวน์โหลด</b> แล้วเปิดไฟล์ <b>YaleCom-Supervisor.exe</b>',
  'ถ้าขึ้นจอฟ้า "Windows protected your PC" → กด <b>More info</b> → <b>Run anyway</b>',
  'กด <b>Yes</b> เมื่อ Windows ขออนุญาต แล้วรอจน YaleCom ขึ้น <b>"YaleCom - 100" ● Online</b>',
  'ฟังสายครั้งแรก: Chrome ถาม "เปิด Yale Com?" → ติ๊ก <b>อนุญาตเสมอ</b> แล้วกดเปิด',
  'ถ้า Windows ถามว่าจะเปิดด้วยแอปไหน → เลือก <b>YaleCom</b> + ติ๊ก <b>Always</b> · <b>ห้ามเลือก Phone Link</b> (จะโทรออกทางมือถือจริง)',
];
