// หน้าหลัก Sup Live — สร้าง DOM ครั้งเดียว · ข้อมูลเปลี่ยน = patch เฉพาะ node ค่า (odometer) ไม่กระพริบทั้งจอ
import { rpc, session, AuthError } from '../api.js?v=41';
import { CAMPAIGNS, TOTAL, MAX_DAYS, SIGNAL_DEBOUNCE_MS } from '../config.js?v=41';
import { Odo } from '../odometer.js?v=41';
import { indexStats, indexAtt, mergeEmp, mergeAtt, teamSummary, sortMembers, get, workState, EMPTY, indexHourly, mergeHourly, teamHourly } from '../store.js?v=41';
import { int, money, pct, hm, ago, dur, todayISO, addDays, diffDays, thDate, thDow, bkkMinutes, esc, mmss, talkHtml } from '../fmt.js?v=41';
import { createLive } from '../live.js?v=41';
import { pickRange } from '../calendar.js?v=41';
import { toast, toastText, burst, createEcg } from '../fx.js?v=41';
import { CHEV, LOGOUT, CAL, REFRESH } from '../icons.js?v=41';
import { themeToggle, ping } from '../theme.js?v=41';
import { Snd, soundButton } from '../sound.js?v=41';

const METRICS = [
  ['list', 'รายชื่อ'], ['uniq', 'ชื่อที่โทร'], ['calls', 'สาย'], ['ans', 'รับสาย'],
  ['orders', 'ออเดอร์'], ['aov', 'AOV'], ['sales', 'ยอดขาย'], ['con', 'Con%'],
];
const num = (m) => ({
  list: m.list_last, uniq: m.uniq, calls: m.calls, ans: m.answered, orders: m.orders, aov: m.aov, sales: m.sales_sum, con: m.con,
});
const text = {
  list: (v) => (v === null ? '—' : int(v)), uniq: int, calls: int, ans: int, orders: int,
  aov: (v) => (v === null ? '—' : money(v)), sales: (v) => money(v || 0), con: (v) => (v === null ? '—' : pct(v)),
};
// ป้ายกำลังโทร (ไอคอนโทรศัพท์สั่นแบบปุ่ม "กำลังโทร..." ในระบบหลัก)
const CALLING = `<span class="calling" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15 3.5a6 6 0 0 1 5.5 5.5M15 7a2.6 2.6 0 0 1 2 2"/></svg><span>กำลังโทร</span></span>`;
const CALL_LONG_MS = 60 * 60 * 1000;
const NO_CAMP = 'ระบุแคมเปญไม่ได้';
const HK = { calls: 'calls', ans: 'answered', uniq: 'uniq', orders: 'orders' };
const SUM_HK = { ...HK, sales: 'sales' };   // การ์ดรวมมี +฿ ยอดขายชั่วโมงนี้ด้วย (แถวรายคนไม่มี — คอลัมน์แคบ)
// +n = ชั่วโมงนี้เพิ่มขึ้นเท่าไหร่ (ตั้งแต่ HH:00 · Live เท่านั้น)
function paintDelta(el, h, k, full, hourLabel) {
  if (!el) return;
  const base = el.className.split(' ')[0];
  const cur = h && isLiveRef() ? (h.cur[k] || 0) : 0;
  if (!h || !isLiveRef() || (!cur && !full)) { el.textContent = ''; el.dataset.key = ''; el.className = base; return; }
  const key = `${cur}|${hourLabel || ''}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const cls = cur > 0 ? 'up' : 'eq';
  if (full) el.innerHTML = `<b>+${int(cur)}</b><span>ในชั่วโมงนี้${hourLabel ? ` (${hourLabel}–)` : ''}</span>`;
  else el.textContent = `+${int(cur)}`;
  el.className = `${base} ${cls} pop`; setTimeout(() => el.classList.remove('pop'), 500);
  el.title = `ชั่วโมงนี้เพิ่ม ${int(cur)}`;
}
let isLiveRef = () => false;
const sign = (a, b) => (a === null || b === null || a === undefined || b === undefined ? 0 : Math.sign(b - a));

export function mountDashboard(root, me, { onLogout }) {
  const today0 = todayISO();
  const S = {
    me, today: today0, team: me.teams[0]?.id ?? null, mode: 'today', from: today0, to: today0,
    members: [], idx: new Map(), att: new Map(), sort: localStorage.getItem('sl_sort') || 'code',
    rows: new Map(), open: new Set(), tab: new Map(), tl: new Map(), loaded: false, seq: 0,
    hr: indexHourly(null), hour: null,
    calling: new Map(),   // emp → { since: ms, camp } · เฉพาะ Live วันนี้
  };
  const savedTeam = Number(localStorage.getItem('sl_team'));
  if (me.teams.some((t) => t.id === savedTeam)) S.team = savedTeam;
  const minDay = () => S.me.start_date || addDays(S.today, -60);
  const isLive = () => S.to === S.today;
  isLiveRef = isLive;
  const multi = () => S.from !== S.to;

  // ════════ โครงหน้า ════════
  root.innerHTML = `<div class="app">
    <header class="top">
      <div class="top-row">
        <a class="logo" href="./" aria-label="Sup Live"><span class="lm"><img src="assets/fmark.png" alt=""></span><span class="wordmark">Sup <b>Live</b></span></a>
        <span class="top-spacer"></span>
        <span class="toolbar"></span>
        <span class="who-me">${esc(me.display_name || session.get()?.name || '')}</span>
        <button class="icon-btn" data-act="logout" aria-label="ออกจากระบบ">${LOGOUT}</button>
      </div>
      <div class="pulse"></div>
    </header>
    <section class="hero">
      <span class="live-pill" data-s="connecting"><i></i><span>กำลังเชื่อมต่อ…</span></span>
      <h1 class="team-title"></h1>
      <span class="range-label"></span>
    </section>
    <section class="controls">
      <div class="seg team" role="group" aria-label="เลือกทีม"><span class="ind"></span>${me.teams.map((t) => `<button data-team="${t.id}" style="--c:${esc(t.color || '#0071e3')}"><span class="tdot"></span>${esc(t.name)}</button>`).join('')}</div>
      <div class="seg date" role="group" aria-label="เลือกวัน"><span class="ind"></span>
        <button data-mode="today">วันนี้</button><button data-mode="yesterday">เมื่อวาน</button><button data-mode="range">${CAL} <span>เลือกช่วง</span></button></div>
    </section>
    <section class="summary">
      ${[['calls', 'สายโทร', 'k-call'], ['ans', 'รับสาย', ''], ['uniq', 'ชื่อที่โทร', ''], ['orders', 'ออเดอร์', 'k-ord'], ['aov', 'AOV<i class="lx"> (บาท)</i>', ''], ['sales', 'ยอดขาย<i class="lx"> (บาท)</i>', 'k-sales'], ['con', 'Con%', 'k-con']]
        .map(([k, l, c], i) => `<div class="kpi ${c}" style="animation-delay:${i * 60}ms"><label>${l}</label><div class="kv"><span class="v" data-k="${k}"></span>${SUM_HK[k] ? `<span class="kd" data-kd="${k}"></span>` : ''}</div><small data-sub="${k}">&nbsp;</small></div>`).join('')}
    </section>
    <p class="sum-legend" aria-hidden="true"></p>
    <div class="listbar"><h3>ลูกทีม<span class="cnt"></span></h3>
      <div class="sorter" role="group" aria-label="เรียงตาม"><span>เรียง</span>
        ${[['code', 'LIVE·รหัส'], ['orders', 'ออเดอร์'], ['sales', 'ยอดขาย'], ['con', 'Con%'], ['calls', 'สาย']].map(([k, l]) => `<button data-sort="${k}">${l}</button>`).join('')}</div></div>
    <div class="thead" aria-hidden="true"><span class="th-emp">พนักงาน</span><span class="th-tt">Talktime</span>${METRICS.map(([k, l]) => `<span class="${HK[k] ? 'has-dl' : ''}">${l}</span>`).join('')}<span></span></div>
    <div class="list"></div>
  </div>
  <div class="ptr" aria-hidden="true">${REFRESH}</div>
  <div class="syncchip" role="status"><span class="spin"></span><span>อัปเดตไม่สำเร็จ กำลังลองใหม่…</span></div>`;

  const $ = (s) => root.querySelector(s);
  const pill = $('.live-pill'), pulse = $('.pulse'), list = $('.list'), chip = $('.syncchip'), legend = $('.sum-legend');
  const ecg = createEcg(pulse);
  $('.toolbar').append(themeToggle(), soundButton());
  const sumOdo = {}, sumSub = {};
  root.querySelectorAll('.summary [data-k]').forEach((el) => { sumOdo[el.dataset.k] = new Odo(el); });
  root.querySelectorAll('.summary [data-sub]').forEach((el) => { sumSub[el.dataset.sub] = el; });
  const sumKd = {}; root.querySelectorAll('.summary [data-kd]').forEach((el) => { sumKd[el.dataset.kd] = el; });
  let sumPrev = null;

  // ════════ segmented control (indicator เลื่อนแบบสปริง) ════════
  function segSet(seg, btn) {
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const ind = seg.querySelector('.ind');
    if (!btn) { ind.style.width = '0'; return; }
    ind.style.width = btn.offsetWidth + 'px';
    ind.style.transform = `translateX(${btn.offsetLeft}px)`;
  }
  const syncSegs = () => {
    segSet($('.seg.team'), $(`.seg.team [data-team="${S.team}"]`));
    segSet($('.seg.date'), $(`.seg.date [data-mode="${S.mode}"]`));
    root.querySelectorAll('.sorter button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === S.sort)));
    const n = diffDays(S.from, S.to) + 1;
    const team = S.me.teams.find((t) => t.id === S.team);
    $('.team-title').textContent = team ? team.name : 'ยังไม่มีทีม';
    $('.range-label').innerHTML = multi()
      ? `<b>${thDate(S.from)} – ${thDate(S.to, true)}</b> · ${n} วัน`
      : `<b>${thDow(S.from)} ${thDate(S.from, true)}</b>${isLive() ? ' · Live' : ' · ย้อนหลัง'}`;
  };
  addEventListener('resize', () => syncSegs());

  // ════════ แถวพนักงาน ════════
  class Row {
    constructor(m) {
      this.m = m;
      const el = document.createElement('article');
      el.className = 'emp';
      el.dataset.emp = m.emp;
      const initial = esc((m.name || m.emp).trim().charAt(0));
      el.innerHTML = `<button class="emp-head" aria-expanded="false">
          <div class="who"><span class="ava">${m.photo ? `<img src="${esc(m.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : initial}<span class="st" data-s="none"></span></span>
            <div class="who-txt"><b><span class="nm">${esc(m.name || m.emp)}</span>${CALLING}</b><span class="sub"><span class="code">${esc(m.emp)}</span>${CALLING}<span class="stx"></span></span></div>
            <span class="tt" title="Talktime รวม (นาที วินาที)"><span class="tt-l">Talktime</span><span class="tt-row"><span class="tt-v"></span><span class="tt-d"></span></span></span>
            <span class="chev">${CHEV}</span></div>
          ${METRICS.map(([k, l]) => `<div class="m m-${k}"><label>${l}</label><span class="vrow"><span class="v" data-k="${k}"></span>${HK[k] ? `<span class="dl" data-dl="${k}"></span>` : ''}</span>${k === 'list' ? '<span class="rg"></span>' : ''}</div>`).join('')}
          <span class="head-chev chev">${CHEV}</span>
        </button>
        <div class="emp-body" role="region"><div class="emp-inner"></div></div>`;
      this.el = el;
      this.odo = {};
      el.querySelectorAll('.emp-head [data-k]').forEach((v) => { this.odo[v.dataset.k] = new Odo(v); });
      this.rg = el.querySelector('.m-list .rg');
      this.dl = {}; el.querySelectorAll('[data-dl]').forEach((d) => { this.dl[d.dataset.dl] = d; });
      this.st = el.querySelector('.st');
      this.stx = el.querySelector('.stx');
      this.calls = el.querySelectorAll('.calling');
      this.ttV = el.querySelector('.tt-v');
      this.ttD = el.querySelector('.tt-d');
      this.body = el.querySelector('.emp-body');
      this.inner = el.querySelector('.emp-inner');
      this.prev = null;
      this.camp = null;     // ตัวควบคุมตารางแคมเปญ (สร้างตอนกาง)
      if (m.photo) el.querySelector('.ava img').addEventListener('error', (e) => { e.target.replaceWith(document.createTextNode(initial)); });
      el.querySelector('.emp-head').addEventListener('click', () => toggle(this));
    }
    update(animate) {
      const t = get(S.idx, this.m.emp);
      const cur = num(t);
      for (const [k] of METRICS) {
        const v = cur[k];
        const dir = animate && this.prev ? sign(this.prev[k], v) : 0;
        this.odo[k].set(text[k](v), { dir });
        this.odo[k].el.classList.toggle('zero', !v);
      }
      this.rg.textContent = multi() && t.list_min !== null && t.list_min !== t.list_max ? `${int(t.list_min)}~${int(t.list_max)}` : '';
      const tk = t.talk || 0;
      if (this.prevTalk !== tk) {
        this.ttV.innerHTML = talkHtml(tk);
        if (animate && this.prevTalk !== undefined) { this.ttV.classList.remove('pop'); void this.ttV.offsetWidth; this.ttV.classList.add('pop'); }
        this.prevTalk = tk;
      }
      this.updateDelta();
      this.prev = cur;
      this.updateTime();
      if (this.camp) this.camp.update(animate);
      if (S.open.has(this.m.emp) && (S.tab.get(this.m.emp) || 'camp') === 'time') renderTime(this, animate);
    }
    updateDelta() {
      const h = S.hr.map.get(this.m.emp);
      for (const k of Object.keys(HK)) paintDelta(this.dl[k], h, HK[k], false, S.hr.cur_hour);
      const add = h && isLive() ? (h.cur.talk || 0) : 0;   // talktime ที่เพิ่มในชั่วโมงนี้
      const txt = add > 0 ? '+' + mmss(add) : '';   // +mm:ss (หน่วยรู้จากค่าด้านบนแล้ว)
      if (this.ttD.textContent !== txt) { this.ttD.textContent = txt; this.ttD.classList.remove('pop'); void this.ttD.offsetWidth; if (txt) this.ttD.classList.add('pop'); }
    }
    updateTime() {
      // แถวแสดงแค่สถานะ LIVE ของวันนี้ · รายละเอียดเวลาอยู่ในแท็บ "เวลาทำงาน"
      const live = isLive();
      const ws = live ? workState(S.att, this.m.emp, S.today).s : 'none';
      this.st.dataset.s = ws;
      this.st.hidden = !live;
      // LIVE = จุดเขียวที่รูปพอ · ไม่ LIVE → ข้อความเทาเล็กต่อท้ายรหัส (ปิดกี่โมง / ยังไม่เปิด)
      const r = S.att.get(this.m.emp)?.get(S.today);
      this.stx.textContent = !live || ws === 'on' ? '' : ws === 'off' ? `· ปิด ${hm(r?.last_off)}` : '· ยังไม่เปิด';
      this.st.title = ws === 'on' ? 'LIVE · เปิดระบบอยู่' : ws === 'off' ? 'ปิดระบบแล้ว' : 'ยังไม่เปิดระบบ';
      this.updateCall();
    }
    updateCall() {
      // ป้ายกำลังโทร: คอม = หลังรหัส · มือถือ = หลังชื่อ (CSS เลือกโชว์ตัวเดียว) · เกิน 60 นาที → แดง (ไม่ซ่อน)
      const c = isLive() ? S.calling.get(this.m.emp) : undefined, since = c?.since;
      const on = !!c, long = on && Date.now() - since >= CALL_LONG_MS;
      const title = on ? `กำลังโทร${c.camp ? ' · ' + c.camp : ''} · เริ่ม ${hm(new Date(since).toISOString())}${long ? ' (เกิน 60 นาที)' : ''}` : '';
      for (const b of this.calls) { b.hidden = !on; b.classList.toggle('long', long); b.title = title; }
      this.camp?.updateCall();
    }
  }

  // ── ตารางแคมเปญ (ในส่วนกาง) ──
  class CampTable {
    constructor(row) {
      this.row = row;
      const host = document.createElement('div');
      host.className = 'crows panel';
      const all = [...CAMPAIGNS];   // ไม่มีแถวรวม (ค่ารวมอยู่ที่แถวพนักงานแล้ว)
      host.innerHTML = all.map((c, i) => `<div class="crow${c.name === TOTAL ? ' total' : ''}" data-c="${esc(c.name)}" style="--cc:${c.c};animation-delay:${i * 35}ms">
          <div class="c-name"><i></i><span>${esc(c.label || c.name)}</span>${CALLING}</div>
          <div class="c-list"><span class="lbl">รายชื่อ </span><span class="vrow"><span class="num" data-k="list"></span></span><span class="rg"></span></div>
          <div class="c-line">
            ${METRICS.slice(1).map(([k, l]) => `<span class="c-cell ${k}"><span class="lbl">${l} </span><span class="vrow"><span class="num" data-k="${k}"></span>${HK[k] ? `<span class="dl" data-dl="${k}"></span>` : ''}</span></span>`).join('')}
          </div></div>`).join('');
      this.host = host;
      this.items = all.map((c) => {
        const el = host.querySelector(`[data-c="${CSS.escape(c.name)}"]`);
        const odo = {};
        el.querySelectorAll('[data-k]').forEach((v) => { odo[v.dataset.k] = new Odo(v); });
        const dl = {}; el.querySelectorAll('[data-dl]').forEach((d) => { dl[d.dataset.dl] = d; });
        return { name: c.name, el, odo, dl, rg: el.querySelector('.rg'), call: el.querySelector('.calling'), prev: null };
      });
    }
    update(animate) {
      for (const it of this.items) {
        const m = get(S.idx, this.row.m.emp, it.name);
        const cur = num(m);
        for (const [k] of METRICS) {
          const dir = animate && it.prev ? sign(it.prev[k], cur[k]) : 0;
          it.odo[k].set(text[k](cur[k]), { dir });
        }
        it.rg.textContent = multi() && m.list_min !== null && m.list_min !== m.list_max ? `${int(m.list_min)}~${int(m.list_max)}` : '';
        it.el.classList.toggle('is-zero', !cur.calls && !cur.orders && !cur.list);
        const hc = S.hr.map.get(this.row.m.emp)?.camp?.[it.name];   // +n ชั่วโมงนี้ ต่อแคมเปญ
        for (const k of Object.keys(HK)) paintDelta(it.dl[k], hc, HK[k], false, S.hr.cur_hour);
        it.prev = cur;
      }
      this.updateCall();
    }
    updateCall() {   // แคมเปญที่กำลังโทรอยู่ → ป้ายกำลังโทรท้ายชื่อแคมเปญ (ไม่รู้แคมเปญ/ชื่อไม่ตรง → ระบุแคมเปญไม่ได้)
      const c = isLive() ? S.calling.get(this.row.m.emp) : undefined;
      const want = c ? (CAMPAIGNS.some((x) => x.name === c.camp) ? c.camp : NO_CAMP) : null;
      const long = !!c && Date.now() - c.since >= CALL_LONG_MS;
      for (const it of this.items) { it.call.hidden = it.name !== want; it.call.classList.toggle('long', long); }
    }
  }

  // ── เวลาทำงาน ──
  async function renderTime(row, fetchTl = true) {
    const emp = row.m.emp;
    const host = row.inner.querySelector('.tpanel');
    if (!host) return;
    if (multi()) {
      const days = [];
      for (let d = S.from; d <= S.to; d = addDays(d, 1)) days.push(d);
      const at = S.att.get(emp) || new Map();
      host.innerHTML = `<div class="att-scroll"><table class="att-table"><thead><tr><th>วัน</th><th>เปิด</th><th>ปิด</th><th>ชั่วโมง</th><th>สาย</th><th>ออเดอร์</th></tr></thead><tbody>
        ${days.reverse().map((d) => {
          const r = at.get(d);
          if (!r || (!r.first_on && !r.calls && !r.orders)) return `<tr><td>${thDow(d)} ${thDate(d)}</td><td class="none" colspan="5">—</td></tr>`;
          return `<tr><td>${thDow(d)} ${thDate(d)}</td><td class="num">${hm(r.first_on)}</td><td class="num">${r.open_now ? '<span style="color:var(--live);font-weight:600">เปิดอยู่</span>' : r.no_off ? '<span class="nooff">ไม่ได้กดปิด</span>' : hm(r.last_off)}</td>
            <td class="num">${dur(r.minutes)}</td><td class="num">${int(r.calls)}</td><td class="num">${int(r.orders)}</td></tr>`;
        }).join('')}</tbody></table></div>`;
      return;
    }
    if (fetchTl || !S.tl.has(emp)) {
      try { S.tl.set(emp, await rpc('sup_timeline', { p_emp: emp, p_day: S.from })); }
      catch (e) { if (e instanceof AuthError) return; host.innerHTML = '<div class="empty">โหลดแถบเวลาไม่สำเร็จ</div>'; return; }
    }
    const tl = S.tl.get(emp);
    if (!row.inner.querySelector('.tpanel')) return;
    const nowM = bkkMinutes(new Date().toISOString());
    const segs = tl.segments.map(([a, b]) => {
      const s = bkkMinutes(a);
      let e;
      if (b) e = bkkMinutes(b);
      else if (tl.is_today) e = nowM;
      else { const lastCall = tl.calls.length ? bkkMinutes(tl.calls[tl.calls.length - 1][0]) : s; e = Math.max(s + 1, lastCall); }
      return { s, e: Math.max(e, s + 1), open: !b && tl.is_today };
    });
    const calls = tl.calls.map(([t, a]) => ({ m: bkkMinutes(t), a }));
    const pts = [...segs.flatMap((x) => [x.s, x.e]), ...calls.map((c) => c.m)];
    const lo = Math.min(480, ...pts.map((p) => Math.floor(p / 60) * 60)), hi = Math.max(1140, ...pts.map((p) => Math.ceil(p / 60) * 60));
    const X = (m) => ((m - lo) / (hi - lo)) * 100;
    const [bs, be] = (S.me.break || '13:00-14:00').split('-').map((s) => { const [h, mi] = s.split(':').map(Number); return h * 60 + mi; });
    const r = S.att.get(emp)?.get(S.from);
    const ans = calls.filter((c) => c.a).length;
    let axis = '';
    for (let h = lo; h <= hi; h += 120) axis += `<span style="left:${X(h)}%">${String(h / 60).padStart(2, '0')}:00</span>`;
    host.innerHTML = `<div class="tl">
      <div class="tl-track">
        <div class="tl-break" style="left:${X(bs)}%;width:${X(be) - X(bs)}%"><span>พัก</span></div>
        ${segs.map((x, i) => `<div class="tl-seg${x.open ? ' open' : ''}" style="left:${X(x.s)}%;width:${Math.max(.6, X(x.e) - X(x.s))}%;animation-delay:${i * 120}ms"></div>`).join('')}
        <div class="tl-calls">${calls.map((c) => `<i class="${c.a ? 'a' : ''}" style="left:${X(c.m)}%"></i>`).join('')}</div>
      </div>
      <div class="tl-axis">${axis}</div>
      <div class="tl-legend">
        <span><i style="background:var(--accent)"></i>เปิดระบบ <b>${hm(r?.first_on)}</b> – <b>${r?.open_now ? 'ตอนนี้' : r?.no_off ? 'ไม่ได้กดปิด' : hm(r?.last_off)}</b></span>
        <span>ชั่วโมง (หักพัก) <b>${dur(r?.minutes || 0)}</b></span>
        ${tl.is_today && r?.last_call ? `<span>โทรล่าสุด <b>${ago(r.last_call)}</b></span>` : ''}
        <span><i style="background:var(--up)"></i>รับ <b>${ans}</b> <i style="background:#64748B;margin-left:.5rem"></i>ไม่รับ <b>${calls.length - ans}</b></span>
      </div></div>`;
  }

  function buildBody(row) {
    const emp = row.m.emp;
    const tab = S.tab.get(emp) || 'camp';
    row.inner.innerHTML = `<div class="tabs" role="tablist">
        <button role="tab" data-tab="camp" aria-selected="${tab === 'camp'}">แคมเปญ</button>
        <button role="tab" data-tab="time" aria-selected="${tab === 'time'}">เวลาทำงาน</button></div>
      <div class="tab-host"></div>`;
    const hostTab = row.inner.querySelector('.tab-host');
    const show = (t) => {
      S.tab.set(emp, t);
      row.inner.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
      if (t === 'camp') {
        row.camp = new CampTable(row);
        hostTab.replaceChildren(row.camp.host);
        row.camp.update(false);
      } else {
        row.camp = null;
        hostTab.innerHTML = '<div class="tpanel panel"><div class="sk" style="height:4.2rem"></div></div>';
        renderTime(row, true);
      }
      fitBody(row);
    };
    row.inner.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { Snd.select(); show(b.dataset.tab); } });
    show(tab);
  }
  function fitBody(row) {
    if (!S.open.has(row.m.emp)) return;
    requestAnimationFrame(() => { row.body.style.height = row.inner.scrollHeight + 'px'; });
  }
  const ro = new ResizeObserver((ents) => { for (const e of ents) { const row = S.rows.get(e.target.closest('.emp')?.dataset.emp); if (row && S.open.has(row.m.emp)) row.body.style.height = e.target.scrollHeight + 'px'; } });

  function toggle(row) {
    const emp = row.m.emp, head = row.el.querySelector('.emp-head');
    if (S.open.has(emp)) Snd.close(); else Snd.open();
    if (S.open.has(emp)) {
      S.open.delete(emp);
      row.body.style.height = row.inner.scrollHeight + 'px';
      requestAnimationFrame(() => { row.body.style.height = '0px'; });
      row.el.classList.remove('open'); head.setAttribute('aria-expanded', 'false');
      ro.unobserve(row.inner);
      setTimeout(() => { if (!S.open.has(emp)) { row.inner.innerHTML = ''; row.camp = null; } }, 560);
    } else {
      S.open.add(emp);
      row.el.classList.add('open'); head.setAttribute('aria-expanded', 'true');
      buildBody(row);
      row.body.style.height = '0px';
      requestAnimationFrame(() => { row.body.style.height = row.inner.scrollHeight + 'px'; });
      ro.observe(row.inner);
    }
  }

  // ── จัดเรียง + FLIP ──
  function arrange(animate) {
    const rank = isLive() ? (emp) => ({ on: 0, off: 1, none: 2 })[workState(S.att, emp, S.today).s] : null;
    const order = sortMembers(S.members, S.idx, S.sort, rank).map((m) => S.rows.get(m.emp)).filter(Boolean);
    const cur = [...list.children];
    if (order.length === cur.length && order.every((r, i) => r.el === cur[i])) return;
    const first = new Map(order.map((r) => [r, r.el.getBoundingClientRect().top]));
    for (const r of order) list.appendChild(r.el);
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const r of order) {
      const dy = first.get(r) - r.el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1 && first.get(r) !== 0) r.el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  }

  function renderList(animate) {
    const keep = new Set(S.members.map((m) => m.emp));
    for (const [emp, row] of S.rows) if (!keep.has(emp)) { row.el.remove(); S.rows.delete(emp); S.open.delete(emp); }
    let i = 0;
    for (const m of S.members) {
      if (!S.rows.has(m.emp)) {
        const row = new Row(m);
        row.el.style.animationDelay = `${Math.min(i, 12) * 45}ms`;
        S.rows.set(m.emp, row);
        list.appendChild(row.el);
      }
      i++;
    }
    for (const row of S.rows.values()) row.update(animate);
    arrange(S.loaded);
    $('.listbar .cnt').textContent = `${S.members.length} คน`;
    if (!S.members.length) list.innerHTML = '<div class="empty">ยังไม่มีพนักงานในทีมนี้</div>';
    else list.querySelector('.empty')?.remove();
  }

  function renderSummary(animate) {
    const s = teamSummary(S.idx, S.members);
    const cur = { calls: s.calls, ans: s.answered, uniq: s.uniq, orders: s.orders, aov: s.aov, sales: s.sales_sum, con: s.con };
    for (const k of Object.keys(cur)) {
      const dir = animate && sumPrev ? sign(sumPrev[k], cur[k]) : 0;
      const txt = k === 'aov' || k === 'sales' ? (cur[k] === null ? '—' : money(cur[k])) : k === 'con' ? (cur[k] === null ? '—' : pct(cur[k])) : int(cur[k]);
      sumOdo[k].set(txt, { dir });
      sumOdo[k].el?.closest('.kpi')?.classList.toggle('long', txt.length > 6);   // หลักล้าน/100.00% → มือถือย่อตัวเลข
    }
    const onCnt = isLive() ? S.members.filter((m) => workState(S.att, m.emp, S.today).s === 'on').length : null;
    sumSub.calls.textContent = onCnt === null ? `${S.members.length} คนในทีม` : `ทำงาน ${onCnt}/${S.members.length} คน`;
    sumSub.ans.textContent = s.calls ? `อัตรารับ ${pct((s.answered / s.calls) * 100)}` : ' ';
    sumSub.uniq.textContent = s.list !== null ? `ถือครอง ${int(s.list)}` : 'ถือครอง —';
    sumSub.orders.textContent = `ปิดได้ ${s.closers}/${S.members.length} คน`;
    sumSub.sales.textContent = S.members.length ? `เฉลี่ย ${money(s.sales_sum / S.members.length)}/คน` : ' ';
    sumSub.aov.textContent = 'ไม่นับ 0 บาท';
    sumSub.con.textContent = 'ออเดอร์÷ชื่อที่โทร';
    sumPrev = cur;
    renderTeamDelta();
  }
  function renderTeamDelta() {
    const live = isLive() && S.hr.cur_hour;
    const t = live ? teamHourly(S.hr, S.members) : null;
    for (const k of Object.keys(SUM_HK)) paintDelta(sumKd[k], t, SUM_HK[k], false, S.hr.cur_hour);
    legend.innerHTML = live ? `<b>+n</b> = เพิ่มในชั่วโมงนี้ (${S.hr.cur_hour}–)` : '';
  }

  function skeleton() {
    list.innerHTML = Array.from({ length: 4 }, (_, i) => `<div class="sk sk-card" style="animation-delay:${i * 80}ms"></div>`).join('');
  }

  // ════════ โหลดข้อมูล ════════
  async function loadAll() {
    const my = ++S.seq;
    if (S.team === null) { list.innerHTML = '<div class="empty">บัญชีนี้ยังไม่ได้รับสิทธิ์ดูทีมใด · ติดต่อผู้ดูแล</div>'; setLive(); return; }
    const args = { p_team: S.team, p_from: S.from, p_to: S.to };
    if (!S.rows.size) skeleton();
    try {
      const [mem, st, at, hr, cl] = await Promise.all([rpc('sup_team_members', args), rpc('sup_stats', args), rpc('sup_attendance', args),
        isLive() ? rpc('sup_hourly', { p_team: S.team }) : Promise.resolve(null),
        isLive() ? rpc('sup_calling', { p_team: S.team }).catch(() => []) : Promise.resolve([])]);   // ป้ายกำลังโทร พลาด = ไม่มีป้าย ไม่ล้มทั้งหน้า
      if (my !== S.seq) return;
      S.hr = indexHourly(hr); S.hour = hr && hr.clock_hour;
      S.calling = new Map((cl || []).map((r) => [r.emp, { since: Date.parse(r.since) || Date.now(), camp: r.camp || null }]));
      const firstPaint = !S.rows.size;
      if (firstPaint) list.innerHTML = '';
      S.members = mem; S.idx = indexStats(st); S.att = indexAtt(at); S.tl.clear();
      renderList(!firstPaint);
      renderSummary(!firstPaint);
      S.loaded = true;
      hideChip();
    } catch (e) {
      if (e instanceof AuthError || my !== S.seq) return;
      if (e.code === 'RANGE') { toastText('ช่วงวันที่เลือกดูไม่ได้ (เกิน 31 วัน หรือก่อนวันเริ่มเก็บข้อมูล)', { icon: '⚠️', err: true }); setMode('today'); return; }
      showChip(); setTimeout(() => { if (my === S.seq) loadAll(); }, 5000);
    }
    setLive();
  }

  // ── สัญญาณสด: รวบต่อคน 1.5 วิ · พร้อมกันไม่เกิน 3 ──
  const timers = new Map(), queue = [], running = new Set();
  function onSignal(p) {
    if (!isLive() || !S.rows.size) return;
    ping();
    signalWave(p);
    clearTimeout(timers.get(p.emp));
    timers.set(p.emp, setTimeout(() => { timers.delete(p.emp); if (!queue.includes(p.emp)) queue.push(p.emp); pump(); }, SIGNAL_DEBOUNCE_MS));
  }
  // คลื่นเส้นชีพจรตามเหตุการณ์ (สาย = ทันทีจากผลติดต่อในสัญญาณ · ออเดอร์ = หลังดึงข้อมูล รู้ยอด)
  function signalWave(p) {
    if (p.t === 'calls') {
      if (p.d === 'inbound') ecg.push(5);
      else if (p.r === 'รับสาย') ecg.push(8);
      else if (p.r === 'ไม่รับสาย') ecg.push(-6);
      else if (p.r === 'ติดต่อไม่ได้') ecg.push(-11);
      else ecg.push(5);
    } else if (p.t === 'system_log') ecg.push(4, 'hump');
  }
  function pump() {
    while (running.size < 3 && queue.length) {
      const emp = queue.shift();
      if (running.has(emp)) { queue.push(emp); break; }
      running.add(emp);
      refreshEmp(emp).finally(() => { running.delete(emp); pump(); });
    }
  }
  async function refreshEmp(emp) {
    const my = S.seq;
    const args = { p_team: S.team, p_from: S.from, p_to: S.to, p_emp: emp };
    try {
      const [st, at, hr] = await Promise.all([rpc('sup_stats', args), rpc('sup_attendance', args), rpc('sup_hourly', { p_team: S.team, p_emp: emp })]);
      if (my !== S.seq) return;
      if (!S.rows.has(emp)) { loadAll(); return; }      // คนใหม่ในทีม → โหลดทั้งทีม
      if (hr.clock_hour !== S.hour) { loadAll(); return; } // ข้ามชั่วโมง → โหลดทั้งทีมใหม่ (จุดเริ่มนับเปลี่ยน)
      mergeHourly(S.hr, emp, hr);
      const before = get(S.idx, emp);
      mergeEmp(S.idx, emp, st); mergeAtt(S.att, emp, at);
      const after = get(S.idx, emp);
      const row = S.rows.get(emp);
      row.update(true);
      renderSummary(true);
      arrange(true);
      if (after.orders < before.orders || after.sales_sum < before.sales_sum) ecg.push(-12, 'beat', 2);   // ยกเลิก/ลดยอด → ลงแดง
      if (after.orders > before.orders) {
        const amt = after.sales_sum - before.sales_sum;
        ecg.push(10 + 3 * Math.min(1, Math.max(0, amt) / 5000), 'beat', 1);   // ปิดออเดอร์ → ขึ้นเขียว สูงตามยอด (5,000฿+ = สุด)
        toast(`<b>${esc(emp)}</b> ${esc(row.m.name || '')} ปิดออเดอร์${amt > 0 ? ` <b>${money(amt)}฿</b>` : ''}`, { icon: '🎉' });
        burst(row.el); Snd.success();
      }
      hideChip();
    } catch (e) {
      if (e instanceof AuthError) return;
      showChip();
      setTimeout(() => onSignal({ emp }), 5000);
    }
  }
  function showChip() { chip.classList.add('show'); }
  function hideChip() { chip.classList.remove('show'); }

  const live = createLive({
    getToken: () => session.get()?.token,
    onSignal,
    onCall: (p) => {
      if (!isLive()) return;
      if (p.c) { S.calling.set(p.emp, { since: Date.parse(p.since) || Date.now(), camp: p.camp || null }); ecg.push(3); } else S.calling.delete(p.emp);   // เริ่มโทร = กระตุกเล็ก
      S.rows.get(p.emp)?.updateCall();
    },
    onStatus: (s) => {
      pill.dataset.s = s === 'live' ? 'live' : s === 'history' ? 'history' : 'reconnecting';
      pill.querySelector('span').textContent = s === 'history' ? 'ข้อมูลย้อนหลัง' : s === 'live' ? 'Live · อัปเดตทันที' : 'กำลังเชื่อมต่อใหม่…';
    },
    onResume: () => { if (isLive()) loadAll(); },
  });
  function setLive() {
    pulse.classList.toggle('history', !isLive());
    ecg.setActive(isLive());
    if (isLive() && S.team !== null) live.watch(S.team); else live.stop();
  }

  // ════════ เหตุการณ์ ════════
  function setMode(mode, from, to) {
    S.mode = mode;
    if (mode === 'today') S.from = S.to = S.today;
    else if (mode === 'yesterday') S.from = S.to = addDays(S.today, -1);
    else { S.from = from; S.to = to; }
    S.tl.clear();
    syncSegs();
    loadAll();
  }
  $('.seg.team').addEventListener('click', (e) => {
    const b = e.target.closest('[data-team]'); if (!b) return;
    const id = Number(b.dataset.team); if (id === S.team) return;
    Snd.select();
    S.team = id; localStorage.setItem('sl_team', String(id));
    for (const row of S.rows.values()) row.el.remove();
    S.rows.clear(); S.open.clear(); sumPrev = null;
    syncSegs(); loadAll();
  });
  $('.seg.date').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    const mode = b.dataset.mode;
    Snd.select();
    if (mode !== 'range') { if (mode !== S.mode) setMode(mode); return; }
    const r = await pickRange({ from: S.from, to: S.to, min: minDay(), max: S.today, maxDays: MAX_DAYS });
    if (!r) return;
    if (r.from === S.today && r.to === S.today) setMode('today');
    else if (r.from === r.to && r.from === addDays(S.today, -1)) setMode('yesterday');
    else setMode('range', r.from, r.to);
  });
  $('.sorter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]'); if (!b) return;
    Snd.select();
    S.sort = b.dataset.sort; localStorage.setItem('sl_sort', S.sort);
    syncSegs(); arrange(true);
  });
  $('[data-act=logout]').addEventListener('click', () => { live.stop(); onLogout(); });

  // ข้ามเที่ยงคืน + อัปเดตเวลา "โทรล่าสุด"
  const clock = setInterval(() => {
    const t = todayISO();
    if (t !== S.today) {
      S.today = t;
      if (S.mode === 'today' || S.mode === 'yesterday') setMode(S.mode);
      else { syncSegs(); setLive(); }
      return;
    }
    if (isLive() && S.hour) {
      const hh = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }).format(new Date()) + ':00';
      if (hh !== S.hour) { loadAll(); return; }
    }
    if (isLive() && !multi()) for (const row of S.rows.values()) row.updateTime();
  }, 30000);

  // ดึงลงเพื่อรีเฟรช (มือถือ)
  const ptr = root.querySelector('.ptr');
  let py = null, pd = 0;
  addEventListener('touchstart', (e) => { if (scrollY <= 0 && !document.querySelector('.sheet')) { py = e.touches[0].clientY; pd = 0; } }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (py === null) return;
    pd = Math.max(0, Math.min(120, e.touches[0].clientY - py));
    ptr.style.opacity = String(Math.min(1, pd / 70));
    ptr.style.transform = `translateY(${pd / 1.6 - 48}px) rotate(${pd * 3}deg) scale(${.6 + Math.min(.4, pd / 175)})`;
  }, { passive: true });
  addEventListener('touchend', async () => {
    if (py === null) return;
    py = null;
    if (pd > 80) {
      ptr.classList.add('spin');
      await loadAll();
      ptr.classList.remove('spin');
    }
    ptr.style.transition = 'opacity .3s, transform .3s'; ptr.style.opacity = '0'; ptr.style.transform = 'translateY(-48px) scale(.6)';
    setTimeout(() => { ptr.style.transition = ''; }, 320);
  });

  syncSegs();
  requestAnimationFrame(syncSegs);
  document.fonts?.ready.then(syncSegs);
  loadAll();
  return { destroy() { clearInterval(clock); live.stop(); ro.disconnect(); } };
}
