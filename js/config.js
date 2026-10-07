// ค่าสาธารณะเท่านั้น (URL + publishable key) — ข้อมูลทุกอย่างได้หลัง login ผ่าน RPC ที่ตรวจสิทธิ์
export const SB_URL = 'https://swbxecjguiohpwllvues.supabase.co';
export const SB_KEY = 'sb_publishable_oim8cwqX7j-8PTLLtRqftg_EORk-EYE';
export const AUTH_URL = SB_URL + '/functions/v1/sup-auth';
export const NO_CAMPAIGN = 'ระบุแคมเปญไม่ได้';
export const TOTAL = '__total__';
// ลำดับแสดงผล = ลำดับใน crm-main/campaign-config.html + ระบุแคมเปญไม่ได้
export const CAMPAIGNS = [
  { name: 'ลูกค้าใหม่', c: '#34D399' },
  { name: 'ส่วนตัว 1-2 เดือน', c: '#60A5FA' },
  { name: 'โอกาสสุดท้าย 3 เดือน', c: '#F59E0B' },
  { name: 'หาคนดูแลใหม่', c: '#F472B6' },
  { name: 'รอคนมาจีบให้ติด', c: '#A78BFA' },
  { name: 'ถังกลาง 6ด - 1ปี', c: '#2DD4BF' },
  { name: 'ถังกลาง 1-3ปี', c: '#94A3B8' },
  { name: 'ถังโบราณ', c: '#C79A3B' },
  { name: NO_CAMPAIGN, c: '#64748B' },
];
export const MAX_DAYS = 31;
export const SIGNAL_DEBOUNCE_MS = 1500;
