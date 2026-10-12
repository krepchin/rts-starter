// v8.1 sound: everything is synthesized with WebAudio (no files to download, works in Safari/WebKit via webkitAudioContext).
// Audio starts only after the first tap/click/key (mobile autoplay rules). Volume (off/low/med/high) is kept in localStorage.
const LEVELS = [0, 0.25, 0.55, 0.9], KEY = 'tiberium.volume';
export class Sound {
  constructor() {
    const v = parseInt(localStorage.getItem(KEY) ?? '2', 10); this.level = Number.isFinite(v) && LEVELS[v] !== undefined ? v : 2;
    this.ctx = null; this.last = {};
    const unlock = () => { this.start(); if (this.ctx?.state === 'running') for (const ev of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(ev, unlock, true); };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, true);
  }
  get volume() { return LEVELS[this.level]; }
  cycle() { this.level = (this.level + 1) % LEVELS.length; try { localStorage.setItem(KEY, String(this.level)); } catch {} this.apply(); return this.level; }
  apply() { if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05); }
  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
      this.step = 0; this.nextT = this.ctx.currentTime + 0.1; this.timer = setInterval(() => { try { this.schedule(); } catch { clearInterval(this.timer); } }, 120);
      window.addEventListener('pagehide', () => clearInterval(this.timer));
    }
    if (this.ctx.state === 'suspended' && !this.resuming) { this.resuming = true; Promise.resolve(this.ctx.resume?.()).catch(() => {}).finally(() => { this.resuming = false; }); }
  }
  tone(t, freq, dur, { type = 'triangle', gain = 0.2, to, bus = this.sfxBus, attack = 0.005, cutoff } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o; if (cutoff) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); n = f; }
    n.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, { gain = 0.3, cutoff = 1200, bus = this.sfxBus } = {}) {
    const c = this.ctx, len = Math.max(1, (c.sampleRate * dur) | 0), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(bus); s.start(t);
  }
  // Background loop: slow minor progression, soft bass + pulsing arpeggio (8 bars, repeats).
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const beat = 0.3, prog = [[45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62], [40, 52, 55, 59]], hz = m => 440 * Math.pow(2, (m - 69) / 12);
    while (this.nextT < c.currentTime + 0.5) {
      const s = this.step, ch = prog[Math.floor(s / 16) % 4], t = this.nextT;
      if (s % 8 === 0) this.tone(t, hz(ch[0]), beat * 7.5, { type: 'sawtooth', gain: 0.12, bus: this.musicBus, attack: 0.08, cutoff: 380 });
      const arp = [1, 2, 3, 2][s % 4] ?? 1; if (s % 2 === 0) this.tone(t, hz(ch[arp] + 12), beat * 1.6, { type: 'triangle', gain: 0.05, bus: this.musicBus, cutoff: 1800 });
      if (s % 4 === 2) this.noise(t, 0.05, { gain: 0.05, cutoff: 6000, bus: this.musicBus });
      this.step++; this.nextT += beat;
    }
  }
  play(name) { try { this._play(name); } catch {} }
  _play(name) {
    const c = this.ctx; if (!c || c.state !== 'running' || !this.level) return;
    const now = c.currentTime; if (now - (this.last[name] || 0) < 0.07) return; this.last[name] = now; const t = now + 0.01;
    switch (name) {
      case 'select': this.tone(t, 880, 0.07, { type: 'square', gain: 0.07, cutoff: 3000 }); this.tone(t + 0.05, 1320, 0.06, { type: 'square', gain: 0.05, cutoff: 3000 }); break;
      case 'move': this.tone(t, 520, 0.09, { type: 'triangle', gain: 0.12, to: 700 }); break;
      case 'attack': this.tone(t, 300, 0.12, { type: 'sawtooth', gain: 0.1, to: 140, cutoff: 1500 }); this.noise(t, 0.08, { gain: 0.12, cutoff: 2500 }); break;
      case 'build': for (let i = 0; i < 3; i++) this.tone(t + i * 0.07, 520 + i * 180, 0.09, { type: 'square', gain: 0.06, cutoff: 2600 }); break;
      case 'queue': this.tone(t, 660, 0.06, { type: 'triangle', gain: 0.08 }); break;
      case 'transform': this.tone(t, 90, 1.6, { type: 'sawtooth', gain: 0.14, to: 260, attack: 0.2, cutoff: 900 }); this.noise(t, 1.2, { gain: 0.08, cutoff: 500 }); break;
      case 'deploy': this.tone(t, 240, 1.2, { type: 'sawtooth', gain: 0.12, to: 80, attack: 0.1, cutoff: 800 }); this.noise(t + 0.3, 0.9, { gain: 0.1, cutoff: 400 }); break;
      case 'boom': this.noise(t, 0.6, { gain: 0.35, cutoff: 700 }); this.tone(t, 70, 0.5, { type: 'sine', gain: 0.25, to: 35 }); break;
    }
  }
}
