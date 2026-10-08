// คำนวณ/จัดเก็บข้อมูล — ฟังก์ชันล้วน (เทสด้วย node ได้)
import { TOTAL } from './config.js?v=52';

export function derive(r) {
  const orders = r.orders || 0, uniq = r.uniq || 0, sales = Number(r.sales_sum || 0);
  return {
    list_last: r.list_last ?? null, list_min: r.list_min ?? null, list_max: r.list_max ?? null,
    uniq, calls: r.calls || 0, answered: r.answered || 0, orders, sales_sum: sales, talk: r.talk ?? null,
    aov: orders > 0 ? sales / orders : null,
    con: uniq > 0 ? (orders / uniq) * 100 : null,
  };
}
export const EMPTY = Object.freeze(derive({}));

// rows จาก sup_stats → Map emp → { camp: metrics }
export function indexStats(rows) {
  const m = new Map();
  for (const r of rows || []) {
    if (!m.has(r.emp)) m.set(r.emp, {});
    m.get(r.emp)[r.camp] = derive(r);
  }
  return m;
}
export const get = (idx, emp, camp = TOTAL) => (idx.get(emp) || {})[camp] || EMPTY;

// รวมทั้งทีม · ชื่อที่โทร = ผลรวมต่อคน (เบอร์เดียวกันข้ามพนักงานนับแยก)
export function teamSummary(idx, members) {
  const s = { calls: 0, answered: 0, uniq: 0, orders: 0, sales_sum: 0, list: null, closers: 0 };
  for (const m of members) {
    const t = get(idx, m.emp);
    s.calls += t.calls; s.answered += t.answered; s.uniq += t.uniq; s.orders += t.orders; s.sales_sum += t.sales_sum;
    if (t.orders > 0) s.closers++;
    if (t.list_last !== null) s.list = (s.list || 0) + t.list_last;
  }
  s.aov = s.orders > 0 ? s.sales_sum / s.orders : null;
  s.con = s.uniq > 0 ? (s.orders / s.uniq) * 100 : null;
  return s;
}

// rows จาก sup_attendance → Map emp → Map day → row
export function indexAtt(rows) {
  const m = new Map();
  for (const r of rows || []) {
    if (!m.has(r.emp)) m.set(r.emp, new Map());
    m.get(r.emp).set(r.day, r);
  }
  return m;
}

// แทนข้อมูลของพนักงานคนเดียว (ตอนได้สัญญาณ)
export function mergeEmp(idx, emp, rows) {
  const one = indexStats(rows).get(emp) || {};
  idx.set(emp, one);
  return idx;
}
export function mergeAtt(att, emp, rows) {
  const one = indexAtt(rows).get(emp) || new Map();
  att.set(emp, one);
  return att;
}

const SORTS = {
  code: () => 0,
  orders: (a, b) => b.orders - a.orders || (b.con ?? -1) - (a.con ?? -1),
  con: (a, b) => (b.con ?? -1) - (a.con ?? -1) || b.orders - a.orders,
  calls: (a, b) => b.calls - a.calls,
  sales: (a, b) => b.sales_sum - a.sales_sum || b.orders - a.orders,
};
// liveRank(emp) → 0 = LIVE · 1 = ปิดระบบแล้ว · 2 = ยังไม่เปิด (ใช้เฉพาะเรียงตามรหัสตอนดู Live)
export function sortMembers(members, idx, key = 'code', liveRank = null) {
  const byCode = (a, b) => a.emp.localeCompare(b.emp);
  const f = SORTS[key] || SORTS.code;
  const byLive = key === 'code' && liveRank ? (a, b) => liveRank(a.emp) - liveRank(b.emp) : () => 0;
  return [...members].sort((a, b) => byLive(a, b) || f(get(idx, a.emp), get(idx, b.emp)) || byCode(a, b));
}

// สถานะการทำงานวันนี้: on / off / none
export function workState(att, emp, today) {
  const r = att.get(emp)?.get(today);
  if (!r || (!r.first_on && !r.last_off)) return { s: 'none', r };
  return { s: r.open_now ? 'on' : 'off', r };
}

// ชั่วโมงนี้ vs ชั่วโมงก่อน (sup_hourly) → { cur_hour, prev_hour, map: Map emp → {cur, prev} }
const HKEYS = ['calls', 'answered', 'uniq', 'orders', 'sales', 'talk'];
export function indexHourly(j) {
  // map: emp → { cur, prev (รวม), camp: { ชื่อแคมเปญ: { cur, prev } } }
  const map = new Map();
  for (const r of j?.rows || []) {
    if (!map.has(r.emp)) map.set(r.emp, { cur: {}, prev: {}, camp: {} });
    const o = {}; for (const k of HKEYS) o[k] = r[k] || 0;
    const e = map.get(r.emp);
    if (!r.camp || r.camp === '__total__') e[r.b] = o;
    else (e.camp[r.camp] ||= { cur: {}, prev: {} })[r.b] = o;
  }
  return { cur_hour: j?.cur_hour || null, prev_hour: j?.prev_hour || null, map };
}
export function mergeHourly(hr, emp, j) {
  const one = indexHourly(j);
  hr.map.set(emp, one.map.get(emp) || { cur: {}, prev: {}, camp: {} });
  hr.cur_hour = one.cur_hour || hr.cur_hour; hr.prev_hour = one.prev_hour || hr.prev_hour;
  return hr;
}
export function teamHourly(hr, members) {
  const t = { cur: {}, prev: {} };
  for (const k of HKEYS) { t.cur[k] = 0; t.prev[k] = 0; }
  for (const m of members) {
    const h = hr.map.get(m.emp); if (!h) continue;
    for (const k of HKEYS) { t.cur[k] += h.cur[k] || 0; t.prev[k] += h.prev[k] || 0; }
  }
  return t;
}
