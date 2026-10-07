// สแกนหน้า/นิ้ว = passkey ของเครื่อง + PRF เป็นกุญแจล็อก {username,password} (แบบ face-advance-reports)
// ไม่มี PRF → ไม่เปิดให้ใช้ (ไม่มีวิธีสำรองที่ไม่ปลอดภัย)
import { FINGER, FACE } from './icons.js?v=50';

const PK = 'sl_bio', NO = 'sl_bio_no';
const te = new TextEncoder(), td = new TextDecoder();
const SALT = te.encode('sup-live/prf/v1');
const sub = crypto.subtle;
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const IS_FACE = /iPhone/.test(navigator.userAgent) && Math.max(screen.width, screen.height) >= 812;
export const BIO = IS_FACE
  ? { icon: FACE, name: 'สแกนหน้า', short: 'Face ID' }
  : { icon: FINGER, name: 'สแกนลายนิ้วมือ', short: 'สแกนนิ้ว' };
export const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ถามความสามารถเครื่อง แต่ไม่รอเกิน ms (Safari บางรุ่นไม่ตอบ/ตอบช้า → ถือว่าไม่รองรับ)
export function capableQuick(ms = 1500) {
  return Promise.race([capable().catch(() => false), new Promise((r) => setTimeout(() => r(false), ms))]);
}
export async function capable() {
  if (!window.PublicKeyCredential || !window.isSecureContext) return false;
  try {
    if (PublicKeyCredential.getClientCapabilities) {
      const c = await PublicKeyCredential.getClientCapabilities();
      if (c && 'extension:prf' in c) return !!c['extension:prf'];
    }
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}
export const enrolled = () => !!localStorage.getItem(PK);
export const declined = () => localStorage.getItem(NO) === '1';
export const decline = () => localStorage.setItem(NO, '1');
export const forget = () => localStorage.removeItem(PK);

async function prfGet(idB64) {
  const a = await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), userVerification: 'required', timeout: 60000,
    allowCredentials: idB64 ? [{ type: 'public-key', id: unb64(idB64) }] : [],
    extensions: { prf: { eval: { first: SALT } } } } });
  const r = a && a.getClientExtensionResults().prf;
  if (!r || !r.results || !r.results.first) throw new Error('noprf');
  return new Uint8Array(r.results.first);
}
const aesKey = (secret) => sub.importKey('raw', secret, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

export async function enroll(username, password) {
  const c = await navigator.credentials.create({ publicKey: {
    rp: { name: 'Sup Live' },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: username, displayName: 'Sup Live · ' + username },
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
    timeout: 60000, extensions: { prf: { eval: { first: SALT } } } } });
  const ext = c.getClientExtensionResults().prf || {};
  const id = b64(c.rawId);
  let secret = ext.results && ext.results.first ? new Uint8Array(ext.results.first) : null;
  if (!secret) {
    if (ext.enabled === false) throw new Error('noprf');
    secret = await prfGet(id);              // บางเบราว์เซอร์ให้ PRF ตอน get เท่านั้น
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await sub.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), te.encode(JSON.stringify({ u: username, p: password })));
  localStorage.setItem(PK, JSON.stringify({ id, iv: b64(iv), ct: b64(ct) }));
  localStorage.removeItem(NO);
}

export async function unlock() {
  const s = JSON.parse(localStorage.getItem(PK));
  const secret = await prfGet(s.id);
  const raw = await sub.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, await aesKey(secret), unb64(s.ct));
  return JSON.parse(td.decode(raw));
}
