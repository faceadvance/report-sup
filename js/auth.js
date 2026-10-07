// หน้า login 3 ขั้น: รหัสผ่าน (หรือสแกน) → OTP numpad → (ชวนเปิดสแกนครั้งแรก) → resolve
import { edge, session } from './api.js?v=12';
import * as bio from './bio.js?v=12';
import { USER, LOCK, SHIELD, BACKSPACE } from './icons.js?v=12';
import { esc } from './fmt.js?v=12';
import { themeToggle } from './theme.js?v=12';
import { Snd, soundButton } from './sound.js?v=12';

const OTP_LEN = 6;

export function renderAuth(root, { notice } = {}) {
  return new Promise((resolve) => {
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'auth';
    wrap.innerHTML = '<div class="auth-glow blue"></div><div class="auth-glow gold"></div><div class="auth-dots"></div>';
    const dots = wrap.querySelector('.auth-dots');
    for (let i = 0; i < 42; i++) {
      const d = document.createElement('i');
      const s = (Math.random() * 2.4 + 1).toFixed(1), o = (Math.random() * .5 + .2).toFixed(2);
      d.style.cssText = `width:${s}px;height:${s}px;left:${(Math.random() * 100).toFixed(1)}%;--o:${o};opacity:${o};animation-duration:${(9 + Math.random() * 15).toFixed(1)}s;animation-delay:${(Math.random() * -22).toFixed(1)}s`;
      dots.appendChild(d);
    }
    root.appendChild(wrap);
    const tools = document.createElement('div');
    tools.className = 'auth-tools toolbar';
    tools.append(themeToggle(), soundButton());
    wrap.appendChild(tools);

    let creds = null;        // {u,p} ระหว่าง flow เท่านั้น (ไม่เก็บถาวร ยกเว้นเข้ารหัสด้วย passkey)
    let usedPassword = false;
    let ticket = null;

    const brand = (sub) => `<div class="brand"><div class="brand-mark"><img src="assets/fmark.png" alt=""></div>
      <span class="eyebrow"><i class="dot"></i>ทีมของคุณ · Live ทุกวินาที</span>
      <div class="wordmark">Sup <b>Live</b></div><div class="brand-sub">${sub}</div></div>`;
    function card(html, swap = true) {
      wrap.querySelector('.card')?.remove();
      const c = document.createElement('div');
      c.className = 'card' + (swap ? ' swap-in' : '');
      c.innerHTML = html;
      wrap.appendChild(c);
      return c;
    }
    const setMsg = (c, text, ok = false) => { const m = c.querySelector('.msg'); m.textContent = text || ''; m.classList.toggle('ok', ok); };
    const shake = (el) => { Snd.fail(); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

    // ── ขั้น 1: username + password ──
    async function stepLogin(msg) {
      const canBio = bio.enrolled();          // วาดการ์ดทันที · เช็คความสามารถเครื่องเบื้องหลัง (ไม่บล็อกหน้า)
      const c = card(`${brand('ดูการทำงานของทีมแบบ Live')}
        <form novalidate autocomplete="on">
          <div class="field"><label for="u">ชื่อผู้ใช้</label><div class="inp">${USER}<input id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="username" maxlength="40"></div></div>
          <div class="field"><label for="p">รหัสผ่าน</label><div class="inp">${LOCK}<input id="p" name="password" type="password" autocomplete="current-password" placeholder="••••••••" maxlength="100"></div></div>
          <button class="btn-main" type="submit"><span>เข้าสู่ระบบ</span></button>
          ${canBio ? `<button class="btn-bio" type="button">${bio.BIO.icon}<span>${bio.BIO.name}</span></button>` : ''}
        </form>
        <div class="msg"></div>
        <div class="note">${SHIELD}<span>ยืนยันตัวตนด้วย <b>OTP ทาง LINE</b> ทุกครั้ง</span></div>`, !!msg);
      if (msg) setMsg(c, msg);
      const form = c.querySelector('form'), u = c.querySelector('#u'), p = c.querySelector('#p'), btn = c.querySelector('.btn-main');
      for (const ev of ['copy', 'cut']) p.addEventListener(ev, (e) => e.preventDefault());
      const busy = (on) => { btn.disabled = on; btn.innerHTML = on ? '<span class="spin"></span><span>กำลังส่ง OTP…</span>' : '<span>เข้าสู่ระบบ</span>'; };

      async function doLogin(user, pass, viaBio) {
        busy(true); setMsg(c, '');
        const r = await edge('login', { username: user, password: pass });
        busy(false);
        if (!r.ok) {
          if (viaBio && /ไม่ถูกต้อง/.test(r.error || '')) { bio.forget(); return stepLogin('รหัสผ่านถูกเปลี่ยน กรุณาใส่รหัสใหม่ แล้วเปิดใช้สแกนอีกครั้ง'); }
          setMsg(c, r.error); shake(c); p.value = ''; p.focus(); return;
        }
        creds = { u: user, p: pass }; usedPassword = !viaBio; ticket = r.ticket;
        Snd.next();
        stepOtp(r.display_name);
      }
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = u.value.trim(), pass = p.value;
        if (!user || !pass) { setMsg(c, 'กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ'); shake(c); return; }
        doLogin(user, pass, false);
      });
      let bb = c.querySelector('.btn-bio');
      if (bb) { bb.hidden = true; bio.capableQuick().then((ok) => { if (!document.body.contains(c)) return; if (ok) { bb.hidden = false; if (!bio.IS_IOS && !msg) setTimeout(scan, 200); } else bb.remove(); }); }
      async function scan() {
        try { const k = await bio.unlock(); u.value = k.u; p.value = '••••••••'; doLogin(k.u, k.p, true); }
        catch { setMsg(c, `${bio.BIO.name}ไม่สำเร็จ ลองอีกครั้ง หรือใช้รหัสผ่าน`, true); }
      }
      if (bb) bb.addEventListener('click', scan);   // iOS ต้องแตะเอง · เครื่องอื่นสแกนอัตโนมัติเมื่อเช็คแล้วรองรับ (ด้านบน)
      else if (!bio.IS_IOS) setTimeout(() => u.focus(), 300);
    }

    // ── ขั้น 2: OTP numpad ──
    function stepOtp(name) {
      let code = '', sending = false, left = 60, timer = 0;
      const c = card(`<div class="otp-head"><h2>กรอกรหัส OTP</h2><p>ส่งเข้า LINE ของ <b>${esc(name || creds.u)}</b> แล้ว · หมดอายุใน 5 นาที</p></div>
        <div class="otp-dots-wrap"><div class="otp-dots">${'<i><b></b></i>'.repeat(OTP_LEN)}</div>
          <input class="otp-paste" inputmode="none" autocomplete="one-time-code" aria-label="วางรหัส OTP" maxlength="12"></div>
        <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" data-k="${n}">${n}</button>`).join('')}
          <button class="key ghost" data-k="none" tabindex="-1" aria-hidden="true"></button>
          <button class="key" data-k="0">0</button>
          <button class="key ghost" data-k="back" aria-label="ลบ">${BACKSPACE}</button></div>
        <div class="msg ok">กดค้างที่ช่องเพื่อวางรหัสที่คัดลอกจาก LINE</div>
        <div class="otp-foot"><button class="link plain" data-act="back">← เปลี่ยนบัญชี</button><button class="link" data-act="resend" disabled>ส่งใหม่ใน 60 วิ</button></div>`);
      const dotsEl = c.querySelector('.otp-dots'), pad = c.querySelector('.pad'), paste = c.querySelector('.otp-paste'), rs = c.querySelector('[data-act=resend]');
      const isTouch = matchMedia('(pointer: coarse)').matches;
      if (!isTouch) setMsg(c, 'พิมพ์ตัวเลขจากคีย์บอร์ดได้เลย', true);
      const paint = () => dotsEl.querySelectorAll('i').forEach((d, i) => {
        d.classList.toggle('on', i < code.length);
        d.classList.toggle('cur', i === code.length);
        d.firstChild.textContent = code[i] || '';
      });
      function tick() {
        clearInterval(timer);
        left = 60; rs.disabled = true; rs.textContent = `ส่งใหม่ใน ${left} วิ`;
        timer = setInterval(() => { left--; if (left <= 0) { clearInterval(timer); rs.disabled = false; rs.textContent = 'ส่งรหัสใหม่'; } else rs.textContent = `ส่งใหม่ใน ${left} วิ`; }, 1000);
      }
      tick();
      paint();
      async function submit() {
        if (sending) return;
        sending = true; pad.classList.add('busy');
        const r = await edge('verify', { ticket, otp: code });
        sending = false; pad.classList.remove('busy');
        if (r.ok) {
          dotsEl.classList.add('ok'); clearInterval(timer); Snd.success();
          session.set({ token: r.token, exp: r.exp, name: r.display_name });
          setTimeout(() => afterLogin(), 350);
          return;
        }
        dotsEl.classList.add('err'); shake(dotsEl); setMsg(c, r.error);
        setTimeout(() => { dotsEl.classList.remove('err'); code = ''; paint(); }, 450);
        if (r.code === 'EXPIRED' || r.code === 'TOO_MANY') { clearInterval(timer); setTimeout(() => stepLogin(r.error), 1300); }
      }
      function push(d) { if (sending || code.length >= OTP_LEN) return; Snd.tap(); code += d; paint(); if (code.length === OTP_LEN) setTimeout(submit, 120); }
      function back() { if (sending) return; Snd.tap(); code = code.slice(0, -1); paint(); }
      pad.addEventListener('click', (e) => {
        const k = e.target.closest('.key')?.dataset.k;
        if (!k || k === 'none') return;
        if (k === 'back') back(); else push(k);
      });
      // วางรหัส (กดค้างบนมือถือ / Ctrl+V) → เอาเฉพาะตัวเลข 6 หลัก
      const fill = (txt) => { const d = String(txt || '').replace(/\D/g, '').slice(0, OTP_LEN); if (!d) return; code = ''; for (const ch of d) push(ch); paste.value = ''; };
      paste.addEventListener('input', () => fill(paste.value));
      paste.addEventListener('paste', (e) => { e.preventDefault(); fill(e.clipboardData?.getData('text')); });
      const onKey = (e) => {
        if (!document.body.contains(c)) { document.removeEventListener('keydown', onKey); return; }
        if (/^[0-9]$/.test(e.key)) { push(e.key); flash(e.key); }
        else if (e.key === 'Backspace') { back(); flash('back'); }
      };
      const flash = (k) => { const b = pad.querySelector(`[data-k="${k}"]`); if (b) { b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 110); } };
      document.addEventListener('keydown', onKey);
      c.querySelector('[data-act=back]').addEventListener('click', () => { clearInterval(timer); document.removeEventListener('keydown', onKey); stepLogin(); });
      rs.addEventListener('click', async () => {
        rs.disabled = true; rs.textContent = 'กำลังส่ง…';
        const r = await edge('resend', { ticket });
        if (r.ok) { setMsg(c, 'ส่งรหัสใหม่เข้า LINE แล้ว', true); code = ''; paint(); tick(); }
        else if (r.code === 'WAIT') { setMsg(c, r.error, true); rs.disabled = false; rs.textContent = 'ส่งรหัสใหม่'; }
        else { setMsg(c, r.error); if (r.code === 'EXPIRED' || r.code === 'LIMIT') setTimeout(() => stepLogin(r.error), 1300); else { rs.disabled = false; rs.textContent = 'ส่งรหัสใหม่'; } }
      });
    }

    // ── ขั้น 3: ชวนเปิดสแกน (ครั้งแรกที่ใช้รหัสผ่าน · เครื่องรองรับ · ยังไม่เคยปฏิเสธ) ──
    async function afterLogin() {
      if (usedPassword && !bio.enrolled() && !bio.declined() && await bio.capableQuick()) {
        const c = card(`<div class="offer"><div class="bio-ico">${bio.BIO.icon}</div>
          <p>เปิดใช้<b>${bio.BIO.name}</b>บนเครื่องนี้ไหมคะ<br>ครั้งหน้าสแกนแล้วระบบกรอกรหัสและขอ OTP ให้ทันที</p>
          <button class="btn-gold" data-k="yes">เปิดใช้ ${bio.BIO.short}</button><button class="btn-plain" data-k="no">ไม่ตอนนี้</button>
          <div class="msg"></div></div>`);
        c.querySelector('[data-k=no]').addEventListener('click', () => { bio.decline(); finish(); });
        c.querySelector('[data-k=yes]').addEventListener('click', async () => {
          try { await bio.enroll(creds.u, creds.p); finish(); }
          catch (e) { setMsg(c, e.message === 'noprf' ? 'เครื่องนี้ยังไม่รองรับการสแกนแบบปลอดภัย ใช้รหัสผ่านต่อได้ตามปกติ' : 'เปิดใช้ไม่สำเร็จ ลองใหม่ หรือกด "ไม่ตอนนี้"'); if (e.message === 'noprf') setTimeout(finish, 1800); }
        });
        return;
      }
      finish();
    }
    function finish() {
      creds = null;
      wrap.style.transition = 'opacity .4s'; wrap.style.opacity = '0';
      setTimeout(() => resolve(session.get()), 380);
    }

    stepLogin(notice);
  });
}
