// เลขแบบมิเตอร์: แต่ละหลักเป็นแถบ 0-9 เลื่อนขึ้นลง · เปลี่ยนเฉพาะ node ของตัวเลขนั้น (ไม่ re-render ทั้งก้อน)
// dir > 0 = ค่าขึ้น (โทนเขียว) · dir < 0 = ค่าลง (โทนแดง) · reduced-motion จัดการใน CSS
const isDigit = (c) => c >= '0' && c <= '9';
const pos = (n) => `translateY(calc(var(--odo-h) * -${n}))`;

export class Odo {
  constructor(el) {
    this.el = el;
    el.classList.add('odo');
    this.text = null;
    this.sig = null;
    this.cols = [];
    this.tintT = 0;
  }
  set(text, { dir = 0, animate = true } = {}) {
    text = String(text);
    if (text === this.text) return false;
    const prev = this.text;
    this.text = text;
    const chars = [...text];
    const sig = chars.map((c) => (isDigit(c) ? '#' : c)).join('');
    if (sig !== this.sig) {
      this._build(chars, prev, animate);
      this.sig = sig;
    } else {
      chars.forEach((c, i) => { if (isDigit(c)) this.cols[i].style.transform = pos(c); });
    }
    if (dir) this._tint(dir > 0 ? 'up' : 'down');
    return true;
  }
  _build(chars, prev, animate) {
    const prevChars = prev ? [...prev] : [];
    const frag = document.createDocumentFragment();
    this.cols = [];
    const starts = [];
    chars.forEach((c, i) => {
      if (isDigit(c)) {
        const dc = document.createElement('span');
        dc.className = 'dc';
        const strip = document.createElement('span');
        strip.innerHTML = '<b>0</b><b>1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>6</b><b>7</b><b>8</b><b>9</b>';
        dc.appendChild(strip);
        // เริ่มจากหลักเดิมที่ตำแหน่งเดียวกัน (นับจากขวา) → หมุนต่อเนื่อง · ค่าแรก = หมุนจาก 0
        const pc = prevChars[prevChars.length - (chars.length - i)];
        const start = animate ? (pc && isDigit(pc) ? pc : '0') : c;
        strip.style.transition = 'none';
        strip.style.transform = pos(start);
        if (animate && !(pc && isDigit(pc))) dc.classList.add('enter');
        this.cols[i] = strip;
        starts.push([strip, c]);
        frag.appendChild(dc);
      } else {
        const s = document.createElement('span');
        s.className = c === '%' ? 'sc pc' : 'sc';
        s.textContent = c;
        this.cols[i] = null;
        frag.appendChild(s);
      }
    });
    this.el.replaceChildren(frag);
    if (!animate) return;
    void this.el.offsetHeight;          // บังคับ reflow ให้ตำแหน่งเริ่มถูกวาดก่อน (ไม่พึ่ง rAF ที่อาจถูกพักตอนแท็บไม่ active)
    for (const [strip, c] of starts) { strip.style.transition = ''; strip.style.transform = pos(c); }
  }
  _tint(cls) {
    const el = this.el;
    el.classList.remove('up', 'down');
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(this.tintT);
    this.tintT = setTimeout(() => el.classList.remove('up', 'down'), 1500);
  }
}
