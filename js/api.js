import { SB_URL, SB_KEY, AUTH_URL } from './config.js?v=36';

// ── session: token 10 ชม. ต่อเครื่อง (localStorage) ──
const SKEY = 'sl_session';
export const session = {
  get() {
    try {
      const s = JSON.parse(localStorage.getItem(SKEY) || 'null');
      if (!s || !s.token || !s.exp || s.exp * 1000 <= Date.now() + 15000) return null;
      return s;
    } catch { return null; }
  },
  set(s) { localStorage.setItem(SKEY, JSON.stringify(s)); },
  clear() { localStorage.removeItem(SKEY); },
};

export class AuthError extends Error {}
// AbortSignal.timeout ไม่มีใน iOS < 16 → ทำเอง
function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}
const expire = (why) => {
  session.clear();
  window.dispatchEvent(new CustomEvent('sl:auth-expired', { detail: why }));
};

// เรียก Edge sup-auth · เน็ตล่ม → คืน {ok:false} ข้อความไทย (ไม่ throw)
export async function edge(action, body = {}) {
  try {
    const r = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
      signal: timeoutSignal(20000),
    });
    const j = await r.json().catch(() => null);
    return j || { ok: false, error: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' };
  } catch {
    return { ok: false, error: 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' };
  }
}

// เรียก RPC ด้วย token หัวหน้า · SUP_AUTH / JWT หมดอายุ → AuthError + เด้งไป login
export async function rpc(fn, args = {}) {
  const s = session.get();
  if (!s) { expire('no-session'); throw new AuthError('no session'); }
  let r;
  try {
    r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: timeoutSignal(20000),
    });
  } catch (e) {
    throw new Error('network');
  }
  if (r.ok) return r.json();
  const j = await r.json().catch(() => ({}));
  const msg = String(j.message || '');
  if (r.status === 401 || msg.includes('SUP_AUTH') || /jwt/i.test(msg)) { expire(msg || 'auth'); throw new AuthError(msg); }
  const err = new Error(msg || 'HTTP ' + r.status);
  err.code = msg.includes('SUP_FORBIDDEN') ? 'FORBIDDEN' : msg.includes('SUP_RANGE') ? 'RANGE' : 'ERR';
  throw err;
}
