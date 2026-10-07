// จุดเริ่ม: มี session → sup_me → dashboard · ไม่มี/หมดอายุ → หน้า login
import { session, rpc, AuthError } from './api.js?v=15';
import { renderAuth } from './auth.js?v=15';
import { mountDashboard } from './views/dashboard.js?v=15';
import { initTheme } from './theme.js?v=15';

initTheme();

window.SL_BUILD = '15';
const root = document.getElementById('app');
let dash = null, booting = false;

async function boot(notice) {
  if (booting) return;
  booting = true;
  try {
    if (dash) { dash.destroy(); dash = null; }
    if (!session.get()) await renderAuth(root, { notice });
    let me;
    try { me = await rpc('sup_me'); }
    catch (e) {
      booting = false;
      if (e instanceof AuthError) return boot('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      root.innerHTML = `<div class="auth"><div class="card"><div class="brand"><div class="brand-mark"><img src="assets/fmark.png" alt=""></div><div class="wordmark">Sup <b>Live</b></div></div>
        <p class="msg">เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต</p><button class="btn-main" onclick="location.reload()">ลองใหม่</button></div></div>`;
      return;
    }
    dash = mountDashboard(root, me, { onLogout: () => { session.clear(); location.reload(); } });
  } finally { booting = false; }
}
addEventListener('sl:auth-expired', () => { if (dash) boot('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); });
boot();
