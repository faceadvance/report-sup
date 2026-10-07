// Realtime: private channel 'sup:team:<id>' (RLS ตรวจสิทธิ์ทีม) · สัญญาณมีแค่ {emp,t}
// หลุด → ต่อใหม่แบบ backoff · กลับมาเปิดแอป (visibilitychange) → ต่อใหม่ + ให้แอปดึงข้อมูลทั้งหมด
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { SB_URL, SB_KEY } from './config.js';

export function createLive({ getToken, onSignal, onStatus, onResume }) {
  let sb = null, ch = null, team = null, retry = 0, retryT = 0, stopped = true, status = 'idle';
  const setStatus = (s) => { if (s !== status) { status = s; onStatus(s); } };

  function client() {
    const tok = getToken();
    if (!sb) sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 20 } } });
    sb.realtime.setAuth(tok);
    return sb;
  }
  async function join() {
    clearTimeout(retryT);
    if (stopped || team === null) return;
    const c = client();
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
