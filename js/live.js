// Realtime: private channel 'sup:team:<id>' (RLS ตรวจสิทธิ์ทีม) · สัญญาณมีแค่ {emp,t}
// หลุด → ต่อใหม่แบบ backoff · กลับมาเปิดแอป (visibilitychange) → ต่อใหม่ + ให้แอปดึงข้อมูลทั้งหมด
import { SB_URL, SB_KEY } from './config.js?v=29';

// โหลดไลบรารี supabase (UMD ในเว็บเราเอง) เฉพาะตอนต้องใช้ realtime — หน้า login ไม่ต้องรอไฟล์นี้
let libP = null;
function loadLib() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
  if (!libP) {
    libP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/supabase.js?v=29';
      s.async = true;
      s.onload = () => (window.supabase && window.supabase.createClient ? res(window.supabase) : rej(new Error('lib')));
      s.onerror = () => { libP = null; rej(new Error('lib')); };
      document.head.appendChild(s);
    });
  }
  return libP;
}

export function createLive({ getToken, onSignal, onStatus, onResume }) {
  let sb = null, ch = null, team = null, retry = 0, retryT = 0, stopped = true, status = 'idle';
  const setStatus = (s) => { if (s !== status) { status = s; onStatus(s); } };

  async function client() {
    const tok = getToken();
    if (!sb) {
      const lib = await loadLib();
      sb = lib.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 20 } } });
    }
    sb.realtime.setAuth(tok);
    return sb;
  }
  async function join() {
    clearTimeout(retryT);
    if (stopped || team === null) return;
    let c;
    try { c = await client(); } catch { schedule(); return; }   // โหลดไลบรารี/ต่อไม่ได้ → ลองใหม่แบบ backoff (ตัวเลขยังดึงผ่าน RPC ได้ปกติ)
    if (stopped) return;
    if (ch) { try { await c.removeChannel(ch); } catch { /* ช่องเก่าปิดไปแล้ว */ } ch = null; }
    setStatus(retry ? 'reconnecting' : 'connecting');
    const my = c.channel('sup:team:' + team, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, (m) => { if (my === ch && m.payload?.emp) onSignal(m.payload); });
    ch = my;
    my.subscribe((s) => {
      if (my !== ch) return;
      if (s === 'SUBSCRIBED') { const wasRetry = retry > 0; retry = 0; setStatus('live'); if (wasRetry) onResume(); }
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') schedule();
    });
  }
  function schedule() {
    if (stopped) return;
    setStatus('reconnecting');
    clearTimeout(retryT);
    const wait = Math.min(30000, 1500 * 2 ** retry++);
    retryT = setTimeout(join, wait);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || stopped) return;
    onResume();
    if (status !== 'live') { retry = Math.max(retry, 1); join(); }
  });
  window.addEventListener('online', () => { if (!stopped) { retry = Math.max(retry, 1); join(); } });

  return {
    watch(teamId) { team = teamId; stopped = false; retry = 0; join(); },
    stop() {
      stopped = true; clearTimeout(retryT);
      if (sb && ch) sb.removeChannel(ch).catch(() => {});
      ch = null; setStatus('history');
    },
    status: () => status,
  };
}
