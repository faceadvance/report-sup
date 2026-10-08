// Realtime: private channel 'sup:team:<id>' (RLS ตรวจสิทธิ์ทีม) · สัญญาณมีแค่ {emp,t}
// หลุด → ต่อใหม่แบบ backoff · กลับมาเปิดแอป (visibilitychange) → ต่อใหม่ + ให้แอปดึงข้อมูลทั้งหมด
import { SB_URL, SB_KEY } from './config.js?v=52';

// โหลดไลบรารี supabase (UMD ในเว็บเราเอง) เฉพาะตอนต้องใช้ realtime — หน้า login ไม่ต้องรอไฟล์นี้
let libP = null;
function loadLib() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
  if (!libP) {
    libP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/supabase.js?v=52';
      s.async = true;
      s.onload = () => (window.supabase && window.supabase.createClient ? res(window.supabase) : rej(new Error('lib')));
      s.onerror = () => { libP = null; rej(new Error('lib')); };
      document.head.appendChild(s);
    });
  }
  return libP;
}

export function createLive({ getToken, onSignal, onCall, onStatus, onResume }) {
  // หลายทีมพร้อมกันได้ (โหมด "ทุกทีม" = 1 ช่องต่อทีม) · gen = ชุดช่องปัจจุบัน — ชุดเก่าที่ถูกแทนแล้วไม่มีผลกับสถานะ
  let sb = null, gen = null, teams = [], retry = 0, retryT = 0, stopped = true, status = 'idle';
  const setStatus = (s) => { if (s !== status) { status = s; onStatus(s); } };
  const key = (ids) => ids.slice().sort((a, b) => a - b).join(',');

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
    if (stopped || !teams.length) return;
    let c;
    try { c = await client(); } catch { schedule(); return; }   // โหลดไลบรารี/ต่อไม่ได้ → ลองใหม่แบบ backoff (ตัวเลขยังดึงผ่าน RPC ได้ปกติ)
    if (stopped) return;
    // ปลดชุดเก่าก่อน await — ไม่งั้น CLOSED ของช่องเก่าถูกนับเป็น "หลุด" → schedule → onResume → loadAll → watch → วนทุก ~1 วิ
    if (gen) { const old = gen; gen = null; for (const ch of old.chs) { try { await c.removeChannel(ch); } catch { /* ปิดไปแล้ว */ } } }
    if (stopped || gen) return;   // ระหว่างรอมี join อื่นแทรกแล้ว
    setStatus(retry ? 'reconnecting' : 'connecting');
    const my = { chs: [], ok: new Set() };
    gen = my;
    for (const t of teams) {
      const ch = c.channel('sup:team:' + t, { config: { private: true } })
        .on('broadcast', { event: 'changed' }, (m) => { if (my === gen && m.payload?.emp) onSignal(m.payload); })
        .on('broadcast', { event: 'call' }, (m) => { if (my === gen && m.payload?.emp) onCall?.(m.payload); });   // กำลังโทร {emp,c,since,camp}
      my.chs.push(ch);
      ch.subscribe((s) => {
        if (my !== gen) return;
        if (s === 'SUBSCRIBED') {
          my.ok.add(t);
          if (my.ok.size === teams.length) { const wasRetry = retry > 0; retry = 0; setStatus('live'); if (wasRetry) onResume(); }
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') schedule();
      });
    }
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
    watch(teamIds) {   // [id] หรือหลาย id (ทุกทีม)
      const ids = [].concat(teamIds);
      if (!stopped && gen && key(ids) === key(teams)) return;   // ชุดทีมเดิม ช่องยังอยู่ → ไม่ต้องต่อใหม่ (loadAll เรียกทุกครั้ง)
      teams = ids; stopped = false; retry = 0; join();
    },
    stop() {
      stopped = true; clearTimeout(retryT);
      if (sb && gen) for (const ch of gen.chs) sb.removeChannel(ch).catch(() => {});
      gen = null; setStatus('history');
    },
    status: () => status,
  };
}
