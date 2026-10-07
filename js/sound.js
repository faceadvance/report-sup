// เสียงประกอบ (ยกจาก stock-live): WebAudio สังเคราะห์ + ไฟล์ Mixkit ใน assets/sfx · เปิด/ปิดได้ จำค่าในเครื่อง
// AudioContext สร้างตอนผู้ใช้แตะครั้งแรกเท่านั้น (กฎ autoplay ของเบราว์เซอร์)
const SFX = Object.fromEntries(['rooster', 'wolf', 'next', 'success', 'fail', 'ping', 'ambient', 'toggle'].map((k) => [k, `assets/sfx/${k}.mp3`]));

export const Snd = {
  ctx: null, master: null, bufs: {}, loading: {},
  on: localStorage.getItem('slSnd') !== '0',
  ac() {
    if (!this.on) return null;
    if (!this.ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      this.ctx = new A();
      this.master = this.ctx.createGain();
      this.master.gain.value = .66;
      this.master.connect(this.ctx.destination);
      Object.keys(SFX).forEach((k) => this.load(k));
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(f, at, dur, { type = 'sine', vol = .18, to = null, att = .004 } = {}) {
    const c = this.ac(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + .02);
  },
  whoosh(up, dur) {
    const c = this.ac(); if (!c) return;
    const t = c.currentTime, n = c.sampleRate * dur, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(up ? 300 : 1800, t); f.frequency.exponentialRampToValueAtTime(up ? 2200 : 250, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + dur * .35); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + dur);
  },
  load(k) {
    if (this.bufs[k]) return Promise.resolve(this.bufs[k]);
    if (this.loading[k]) return this.loading[k];
    const c = this.ctx; if (!c) return Promise.resolve(null);
    return (this.loading[k] = fetch(SFX[k]).then((r) => r.arrayBuffer()).then((ab) => c.decodeAudioData(ab)).then((b) => (this.bufs[k] = b)).catch(() => null));
  },
  sample(k, at = 0, vol = .55) {
    const c = this.ac(); if (!c) return;
    this.load(k).then((b) => {
      if (!b) return;
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = b; g.gain.value = vol; s.connect(g).connect(this.master);
      s.start(Math.max(c.currentTime, c.currentTime + at));
    });
  },
  tap() { this.tone(1500, 0, .045, { type: 'triangle', vol: .10, to: 900 }); },
  select() { this.tone(1100, 0, .05, { type: 'triangle', vol: .1 }); },
  next() { if (this.bufs.next) return this.sample('next', 0, .55); this.tone(740, 0, .12, { vol: .12 }); this.tone(1110, .08, .16, { vol: .12 }); },
  open() { this.whoosh(true, .55); this.tone(520, .05, .4, { vol: .04, to: 880 }); },
  close() { this.whoosh(false, .45); },
  success() { if (this.bufs.success) return this.sample('success', 0, .55); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, i * .075, .5, { vol: .12 })); this.tone(2093, .3, .6, { vol: .04 }); },
  fail() { if (this.bufs.fail) return this.sample('fail', 0, .55); this.tone(220, 0, .16, { type: 'square', vol: .06, to: 180 }); this.tone(196, .2, .22, { type: 'square', vol: .06, to: 150 }); },
  ping() { if (this.bufs.ping) return this.sample('ping', 0, .45); this.tone(1318.5, 0, .35, { vol: .07 }); this.tone(1760, .06, .4, { vol: .05 }); },
  toggle() { if (this.bufs.toggle) return this.sample('toggle', 0, .55); this.tone(600, 0, .05, { type: 'triangle', vol: .1, to: 900 }); this.tone(900, .05, .05, { type: 'triangle', vol: .08 }); },
  crow(at = 0) { this.sample('rooster', at, 1.5); },   // ดังขึ้น (เจ้านายขอ) · 1.5 × master .66 ≈ เต็มสเกล
  howl(at = 0) { this.sample('wolf', at, 1.5); },
  dusk() { this.tone(440, 0, 1.4, { vol: .07, to: 196, att: .08 }); this.tone(660, .05, 1.3, { vol: .04, to: 294, att: .1 }); this.whoosh(false, 1.2); },
  dawn() { this.tone(262, 0, 1.3, { vol: .06, to: 523, att: .1 }); this.tone(392, .12, 1.2, { vol: .045, to: 784, att: .1 }); this.tone(1568, .7, .8, { vol: .025 }); },
  setOn(v) {
    this.on = v;
    localStorage.setItem('slSnd', v ? '1' : '0');
    document.documentElement.classList.toggle('muted', !v);
    if (v) this.toggle();
  },
};
document.documentElement.classList.toggle('muted', !Snd.on);

const S_ON = '<svg class="s-on" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const S_OFF = '<svg class="s-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>';
export function soundButton() {
  const b = document.createElement('button');
  b.className = 'snd'; b.type = 'button'; b.setAttribute('aria-label', 'เปิด/ปิดเสียง');
  b.innerHTML = S_ON + S_OFF;
  b.addEventListener('click', () => Snd.setOn(!Snd.on));
  return b;
}
