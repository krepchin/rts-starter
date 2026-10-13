// v9 sound: sectioned industrial/electronic loop + full SFX set. v8.1 sound: everything is synthesized with WebAudio (no files to download, works in Safari/WebKit via webkitAudioContext).
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
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.2; // music sits well under SFX this.musicBus.connect(this.master);
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
  noise(t, dur, { gain = 0.3, cutoff = 1200, bus = this.sfxBus, type = 'lowpass', q = 1 } = {}) {
    const c = this.ctx; if (!this.nbuf) { const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.nbuf = b; }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.nbuf; f.type = type; f.frequency.value = cutoff; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  // Background loop, 118 BPM in 16th-note steps. Sections of 4 bars: intro (pads + hats) → A (kick/snare/bass) → B (+ stabs, metal
  // percussion) → A → C (breakdown: filtered bass arp + pads) → B → … Minor-key industrial feel; everything synthesized.
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const st = 60 / 118 / 4, hz = m => 440 * Math.pow(2, (m - 69) / 12), M = this.musicBus;
    const prog = [33, 33, 36, 31], ORDER = ['intro', 'A', 'B', 'A', 'C', 'B'];
    while (this.nextT < c.currentTime + 0.5) {
      const s = this.step, t = this.nextT, bar = Math.floor(s / 16), i16 = s % 16, root = prog[bar % 4];
      const sec = s < 64 ? 'intro' : ORDER[1 + (Math.floor(s / 64) - 1) % (ORDER.length - 1)];
      if (i16 === 0) { // pads: two detuned saws on a minor chord, long and dark
        for (const [m, d] of [[root + 24, -7], [root + 27, 6], [root + 31, 0]]) { this.tone(t, hz(m) * (1 + d / 1200), st * 16, { type: 'sawtooth', gain: sec === 'C' ? 0.05 : 0.035, bus: M, attack: 0.6, cutoff: sec === 'C' ? 900 : 600 }); } }
      if (sec !== 'intro' && sec !== 'C') {
        if (i16 % 4 === 0 || (sec === 'B' && i16 === 14)) this.tone(t, 150, 0.22, { type: 'sine', gain: 0.5, to: 42, bus: M, attack: 0.002 });
        if (i16 === 4 || i16 === 12) { this.noise(t, 0.16, { gain: 0.22, cutoff: 1800, type: 'highpass', bus: M }); this.tone(t, 210, 0.08, { type: 'triangle', gain: 0.12, to: 140, bus: M }); }
        const bp = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1][i16]; if (bp) this.tone(t, hz(root + (i16 === 14 ? 7 : i16 === 10 ? 3 : 0)), st * 0.9, { type: 'sawtooth', gain: 0.16, bus: M, cutoff: 420 + (i16 % 4) * 90, attack: 0.004 });
      }
      if (sec === 'C') { const arp = [0, 7, 12, 15, 12, 7, 3, 7][i16 % 8]; if (i16 % 2 === 0) this.tone(t, hz(root + 12 + arp), st * 1.8, { type: 'square', gain: 0.05, bus: M, cutoff: 500 + (s % 64) * 30 }); }
      if (i16 % 2 === 0 || sec === 'B') this.noise(t, i16 % 4 === 2 ? 0.07 : 0.025, { gain: i16 % 4 === 2 ? 0.07 : 0.04, cutoff: 7000, type: 'highpass', bus: M });
      if (sec === 'B') {
        if (i16 === 3 || i16 === 11) for (const m of [root + 24, root + 27, root + 31]) this.tone(t, hz(m), 0.14, { type: 'square', gain: 0.035, bus: M, cutoff: 2200 });
        if (i16 === 7 || i16 === 15) this.noise(t, 0.12, { gain: 0.12, cutoff: 3200, type: 'bandpass', q: 9, bus: M }); // metal hit
      }
      this.step++; this.nextT += st;
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
      case 'shot': this.noise(t, 0.07, { gain: 0.12, cutoff: 3000 }); break;
      case 'snipe': this.noise(t, 0.05, { gain: 0.2, cutoff: 6000, type: 'highpass' }); this.tone(t, 1400, 0.25, { type: 'sine', gain: 0.06, to: 300 }); break;
      case 'rocket': this.noise(t, 0.35, { gain: 0.16, cutoff: 900, type: 'bandpass', q: 2 }); this.tone(t, 220, 0.3, { type: 'sawtooth', gain: 0.05, to: 520, cutoff: 1500 }); break;
      case 'bolt': this.tone(t, 900, 0.2, { type: 'sawtooth', gain: 0.07, to: 160, cutoff: 2500 }); this.tone(t, 460, 0.18, { type: 'square', gain: 0.05, to: 90, cutoff: 1400 }); break;
      case 'stim': this.tone(t, 300, 0.25, { type: 'sawtooth', gain: 0.08, to: 900, cutoff: 2000 }); this.noise(t, 0.12, { gain: 0.06, cutoff: 5000, type: 'highpass' }); break;
      case 'cloak': this.tone(t, 1200, 0.5, { type: 'sine', gain: 0.07, to: 200 }); this.tone(t + 0.04, 1500, 0.45, { type: 'sine', gain: 0.04, to: 250 }); break;
      case 'digin': this.noise(t, 0.3, { gain: 0.2, cutoff: 500 }); this.tone(t, 110, 0.2, { type: 'triangle', gain: 0.1 }); break;
      case 'capture': for (let i = 0; i < 4; i++) this.tone(t + i * 0.09, 440 * Math.pow(1.26, i), 0.12, { type: 'square', gain: 0.06, cutoff: 3000 }); break;
      case 'demo': for (let i = 0; i < 3; i++) this.tone(t + i * 0.15, 1800, 0.06, { type: 'square', gain: 0.07, cutoff: 4000 }); break;
      case 'wall': this.noise(t, 0.12, { gain: 0.22, cutoff: 900 }); this.tone(t, 160, 0.12, { type: 'square', gain: 0.07, cutoff: 700 }); break;
      case 'clank': this.noise(t, 0.18, { gain: 0.25, cutoff: 2600, type: 'bandpass', q: 12 }); this.tone(t, 340, 0.15, { type: 'square', gain: 0.06, to: 250, cutoff: 1800 }); break;
      case 'alarm': for (let i = 0; i < 3; i++) { this.tone(t + i * 0.32, 760, 0.15, { type: 'square', gain: 0.07, cutoff: 2400 }); this.tone(t + i * 0.32 + 0.15, 560, 0.15, { type: 'square', gain: 0.07, cutoff: 2400 }); } break;
      case 'hiss': this.noise(t, 0.7, { gain: 0.14, cutoff: 4500, type: 'highpass' }); break;
      case 'servo': this.tone(t, 180, 0.45, { type: 'sawtooth', gain: 0.06, to: 360, cutoff: 900, attack: 0.05 }); break;
      case 'stomp': this.tone(t, 90, 0.5, { type: 'sine', gain: 0.35, to: 30 }); this.noise(t, 0.4, { gain: 0.25, cutoff: 400 }); break;
      case 'step': this.tone(t, 70, 0.18, { type: 'sine', gain: 0.18, to: 38 }); this.noise(t, 0.12, { gain: 0.08, cutoff: 350 }); break;
      case 'boom': this.noise(t, 0.6, { gain: 0.35, cutoff: 700 }); this.tone(t, 70, 0.5, { type: 'sine', gain: 0.25, to: 35 }); break;
    }
  }
}
