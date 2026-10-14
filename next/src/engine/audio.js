// v9.1 sound engine. Layered SFX = CC0 samples from Kenney.nl (assets/sfx, lazy-loaded after the first tap) + WebAudio
// synthesis layers (noise transients, pitch envelopes, sub thumps) + a generated convolution reverb, with per-play variation.
// Buses: music / ambience (desert wind) / sfx / voice -> master -> compressor (limiter). Big events duck music + ambience.
// Voice limiter: max simultaneous voices, per-sound rate limits, distance falloff from the camera. Radio "acknowledgements"
// are vocoded synth syllables (formant-filtered buzz through a radio band-pass), a different voice per unit type.
// Audio starts only after the first tap/click/key; volume level (off/low/med/high) persists in localStorage. Safari: webkitAudioContext,
// callback decodeAudioData fallback.
const LEVELS = [0, 0.25, 0.55, 0.9], KEY = 'tiberium.volume', MAX_VOICES = 22;
const SAMPLES = ['boom_s1', 'boom_s2', 'boom_m1', 'boom_l1', 'boom_l2', 'laser_s1', 'laser_s2', 'laser_l1', 'laser_l2', 'zap1', 'metal1', 'metal2', 'metal3',
  'field1', 'field2', 'door_open', 'door_close', 'thrust1', 'thrust2', 'engine_low', 'engine_circ', 'comp1', 'comp2', 'slime', 'plate_h', 'punch_h', 'mining',
  'step_c', 'metal_h', 'tick_l', 'ui_click', 'ui_select', 'ui_confirm', 'ui_error', 'ui_drop', 'ui_switch', 'ui_glitch', 'ui_up', 'ui_down', 'ui_toggle'];
// per-type radio voice: base pitch, formant shift, grit
const VOICES = { infantry: [150, 1, 0.3], sniper: [118, 0.92, 0.2], rocket: [96, 0.85, 0.45], engineer: [175, 1.1, 0.25], tank: [82, 0.8, 0.7], harvester: [90, 0.8, 0.5],
  carrier: [105, 0.9, 0.3], dropship: [128, 0.95, 0.35], robot: [62, 0.7, 0.85], mcv: [70, 0.75, 0.7], buggy: [140, 1, 0.4], truck: [78, 0.8, 0.8], default: [130, 1, 0.3],
  // reptilians: low growls / hisses (rough, formants shifted down, extra noise)
  raider: [95, 0.7, 0.9, 1], spitter: [120, 0.75, 0.8, 1], brute: [55, 0.6, 1, 1], shaman: [140, 0.8, 0.6, 1], hatchling: [170, 0.8, 0.8, 1], grazer: [70, 0.6, 0.9, 1],
  spark: [300, 1.4, 0.5, 2], lance: [220, 1.2, 0.6, 2], biotank: [70, 0.7, 0.9, 1], hiveorb: [150, 1, 0.6, 2], broodship: [45, 0.55, 1, 1] };
const VOWELS = [[730, 1090], [270, 2290], [530, 1840], [570, 840], [300, 870], [660, 1720], [440, 1020]];
const r = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
export class Sound {
  constructor() {
    const v = parseInt(localStorage.getItem(KEY) ?? '2', 10); this.level = Number.isFinite(v) && LEVELS[v] !== undefined ? v : 2;
    try { this.musicOn = localStorage.getItem('tiberium.music') !== '0'; } catch { this.musicOn = true; }
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {} // iOS 16.4+: respect the silent switch
    this.ctx = null; this.last = {}; this.buf = {}; this.voices = 0; this.stats = { played: 0, dropped: 0, samples: 0, ducks: 0 };
    const unlock = () => { this.start(); if (this.ctx?.state === 'running') for (const ev of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(ev, unlock, true); };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, true);
  }
  get volume() { return LEVELS[this.level]; }
  toggleMusic() { this.musicOn = !this.musicOn; try { localStorage.setItem('tiberium.music', this.musicOn ? '1' : '0'); } catch {} if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.13 : 0, this.ctx.currentTime, 0.3); return this.musicOn; }
  cycle() { this.level = (this.level + 1) % LEVELS.length; try { localStorage.setItem(KEY, String(this.level)); } catch {} this.apply(); return this.level; }
  apply() { if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05); }
  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.knee.value = 8; this.comp.ratio.value = 8; this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
      this.comp.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = this.volume; this.master.connect(this.comp);
      this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(2.2, 2.6); this.revOut = c.createGain(); this.revOut.gain.value = 0.35; this.reverb.connect(this.revOut); this.revOut.connect(this.master);
      const bus = (g, rev) => { const n = c.createGain(); n.gain.value = g; n.connect(this.master); if (rev) { const s = c.createGain(); s.gain.value = rev; n.connect(s); s.connect(this.reverb); } return n; };
      this.musicBus = bus(this.musicOn ? 0.13 : 0, 0.9); this.ambBus = bus(0.1, 0); this.sfxBus = bus(0.85, 0.18); this.voiceBus = bus(0.55, 0.05);
      this.duckers = [this.musicBus, this.ambBus];
      this.step = 0; this.nextT = c.currentTime + 0.1; this.timer = setInterval(() => { try { this.schedule(); } catch { clearInterval(this.timer); } }, 120);
      window.addEventListener('pagehide', () => clearInterval(this.timer));
      this.loadSamples(); this.ambience();
    }
    if (this.ctx.state === 'suspended' && !this.resuming) { this.resuming = true; Promise.resolve(this.ctx.resume?.()).catch(() => {}).finally(() => { this.resuming = false; }); }
  }
  impulse(sec, decay) { const c = this.ctx, n = (c.sampleRate * sec) | 0, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  loadSamples() {
    const base = new URL('../../assets/sfx/', import.meta.url).href;
    for (const n of SAMPLES) fetch(base + n + '.mp3').then(res => res.ok ? res.arrayBuffer() : Promise.reject())
      .then(ab => new Promise((ok, no) => { const p = this.ctx.decodeAudioData(ab, ok, no); if (p?.then) p.then(ok, no); }))
      .then(b => { if (!this.buf[n]) { this.buf[n] = b; this.stats.samples++; } }).catch(() => {});
  }
  // ---- primitives
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  tone(t, freq, dur, { type = 'triangle', gain = 0.2, to, bus = this.sfxBus, attack = 0.005, cutoff, q = 0.7, detune = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    this.env(g, t, attack, gain, dur);
    let n = o; if (cutoff) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = q; o.connect(f); n = f; }
    n.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  noise(t, dur, { gain = 0.3, cutoff = 1200, bus = this.sfxBus, type = 'lowpass', q = 1, to, attack = 0.002 } = {}) {
    const c = this.ctx; if (!this.nbuf) { const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.nbuf = b; }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.nbuf; f.type = type; f.frequency.setValueAtTime(cutoff, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    this.env(g, t, attack, gain, dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  sample(t, name, { gain = 0.5, rate = 1, vary = 0.08, bus = this.sfxBus, offset = 0, dur } = {}) {
    const names = Array.isArray(name) ? name : [name], b = this.buf[pick(names)]; if (!b) return false;
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.playbackRate.value = rate * (1 + r(-vary, vary));
    g.gain.value = gain * (1 + r(-0.12, 0.12)); s.connect(g); g.connect(bus); s.start(t, offset, dur); return true;
  }
  duck(amount = 0.35, hold = 0.6) { const c = this.ctx, t = c.currentTime; this.stats.ducks++;
    for (const b of this.duckers) { const v = b === this.musicBus ? (this.musicOn ? 0.13 : 0) : 0.1; b.gain.cancelScheduledValues(t); b.gain.setTargetAtTime(v * amount, t, 0.03); b.gain.setTargetAtTime(v, t + hold, 0.5); } }
  // ---- desert ambience: two layers of filtered noise with slow gusts
  ambience() {
    const c = this.ctx; this.noise(c.currentTime, 0.01, { gain: 0.0001 }); // ensure noise buffer
    for (const [cut, gain, rate] of [[380, 0.5, 0.07], [1400, 0.12, 0.13]]) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      s.buffer = this.nbuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = cut; f.Q.value = 0.6; g.gain.value = gain;
      lfo.frequency.value = rate; lg.gain.value = gain * 0.8; lfo.connect(lg); lg.connect(g.gain);
      const lf2 = c.createGain(); lf2.gain.value = cut * 0.4; lfo.connect(lf2); lf2.connect(f.frequency);
      s.connect(f); f.connect(g); g.connect(this.ambBus); s.start(); lfo.start();
    }
  }
  // ---- radio acknowledgement: squelch + 2-4 vocoded syllables + squelch tail, per-type voice
  voice(type, kind) {
    const c = this.ctx, t = c.currentTime + 0.02, [p0, fs, grit, alien] = VOICES[type] || VOICES.default, B = this.voiceBus;
    if (this.voiceBusy > c.currentTime) return; // one radio line at a time
    if (alien === 1) { this.noise(t, 0.35, { gain: 0.16, cutoff: 900 * fs, to: 400, type: 'bandpass', q: 3, bus: B, attack: 0.04 }); this.tone(t, p0, 0.4, { type: 'sawtooth', gain: 0.07, to: p0 * 0.7, cutoff: 700, bus: B, attack: 0.03 });
      this.noise(t + 0.25, 0.25, { gain: 0.08, cutoff: 5000, type: 'highpass', bus: B }); this.voiceBusy = t + 0.7; return; } // growl + hiss
    if (alien === 2) { for (let i = 0; i < 3; i++) this.tone(t + i * 0.07, p0 * (1 + i * 0.25), 0.08, { type: 'sine', gain: 0.05, bus: B }); this.noise(t, 0.2, { gain: 0.04, cutoff: 6000, type: 'highpass', bus: B }); this.voiceBusy = t + 0.4; return; } // drone chirps
    const n = kind === 'select' ? 2 : kind === 'ready' ? 3 : 3 + (Math.random() < 0.4 ? 1 : 0), syl = kind === 'attack' ? 0.09 : 0.12;
    this.noise(t, 0.05, { gain: 0.12, cutoff: 2400, type: 'bandpass', q: 3, bus: B });
    const out = c.createGain(); out.gain.value = 1; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2900;
    const ws = c.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * (1 + grit * 6)); } ws.curve = curve;
    out.connect(ws); ws.connect(hp); hp.connect(lp); lp.connect(B);
    let tt = t + 0.06; const pitch = p0 * r(0.95, 1.08) * (kind === 'attack' ? 1.12 : 1);
    for (let i = 0; i < n; i++) {
      const d = syl * r(0.8, 1.5), o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth';
      const pf = pitch * (i === n - 1 ? (kind === 'select' ? 1.15 : 0.88) : r(0.95, 1.1)); o.frequency.setValueAtTime(pf, tt); o.frequency.linearRampToValueAtTime(pf * r(0.9, 1.05), tt + d);
      const [f1, f2] = pick(VOWELS); for (const [f, q, gn] of [[f1 * fs, 6, 0.9], [f2 * fs, 9, 0.5]]) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const gg = c.createGain(); gg.gain.value = gn; o.connect(bp); bp.connect(gg); gg.connect(g); }
      this.env(g, tt, 0.015, 0.5, d); g.connect(out); o.start(tt); o.stop(tt + d + 0.05);
      if (Math.random() < 0.35) this.noise(tt, 0.04, { gain: 0.08, cutoff: 4500, type: 'highpass', bus: B }); // consonant
      tt += d + r(0.015, 0.05);
    }
    this.noise(tt, 0.09, { gain: 0.1, cutoff: 2000, type: 'bandpass', q: 2, bus: B }); this.tone(tt, 1800, 0.04, { type: 'sine', gain: 0.03, bus: B });
    this.voiceBusy = tt + 0.3;
  }
  // ---- v10.0 ambient cinematic score (no square/chip timbres): continuous overlapping pads, low string drone, sparse soft
  // keys, distant felt percussion; slow 72 BPM; four "tracks" (keys/progressions/moods) that crossfade every ~4 minutes, no gaps.
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const st = 60 / 72 / 4, hz = m => 440 * Math.pow(2, (m - 69) / 12), M = this.musicBus;
    const TRACKS = [
      { prog: [38, 34, 41, 36], q: [0, 7, 12, 15, 19], perc: 0.4, keys: 0.25 },   // D minor, wide and dusty
      { prog: [33, 36, 31, 38], q: [0, 7, 14, 15, 22], perc: 0.15, keys: 0.35 },  // A minor add9, sparse and open
      { prog: [36, 39, 34, 41], q: [0, 7, 12, 16, 19], perc: 0.55, keys: 0.2 },   // C, tense low pulse
      { prog: [40, 36, 38, 33], q: [0, 5, 12, 15, 19], perc: 0.25, keys: 0.3 } ]; // E sus, drifting
    while (this.nextT < c.currentTime + 0.8) {
      const s = this.step, t = this.nextT, bar = Math.floor(s / 16), i16 = s % 16, trk = TRACKS[Math.floor(bar / 72) % TRACKS.length], ch = Math.floor(bar / 2);
      const root = trk.prog[ch % trk.prog.length], rnd = (Math.imul(s + 1, 2654435761) >>> 0) / 4294967296;
      if (i16 === 0 && bar % 2 === 0) { const dur = st * 40; // overlapping 2-bar chords, long attack/release -> continuous
        for (const o of trk.q.slice(1, 4)) for (const d of [-6, 5]) this.tone(t, hz(root + 12 + o), dur, { type: 'triangle', gain: 0.012, bus: M, attack: 1.6, cutoff: 900, detune: d });
        this.tone(t, hz(root), dur, { type: 'sawtooth', gain: 0.016, bus: M, attack: 1.8, cutoff: 260 });
        this.tone(t, hz(root - 12), dur, { type: 'sine', gain: 0.05, bus: M, attack: 1.2 }); }
      if (i16 % 4 === 0 && rnd < trk.keys) { const n = root + 24 + trk.q[(rnd * 97 | 0) % trk.q.length];
        this.tone(t, hz(n), 2.6, { type: 'sine', gain: 0.03, bus: M, attack: 0.01 }); this.tone(t, hz(n + 12), 1.4, { type: 'sine', gain: 0.008, bus: M, attack: 0.01 }); }
      if (i16 === 0 && (bar % 2 === 1 || trk.perc > 0.5)) { this.tone(t, 82, 0.9, { type: 'sine', gain: 0.07 * (0.5 + trk.perc), to: 46, bus: M, attack: 0.02 }); this.noise(t, 0.25, { gain: 0.015, cutoff: 280, bus: M }); }
      if (i16 % 4 === 2 && rnd < trk.perc * 0.5) this.noise(t, 0.12, { gain: 0.012, cutoff: 5200, type: 'bandpass', q: 0.7, bus: M });
      if (i16 === 0 && bar % 8 === 6) this.noise(t, st * 32, { gain: 0.02, cutoff: 600, to: 2400, type: 'bandpass', q: 0.6, bus: M, attack: st * 24 });
      this.step++; this.nextT += st;
    }
  }
  // ---- play with limiter + distance falloff. name may be 'voice:<kind>' or 'alert:<kind>'.
  play(name, src, cam) { try { this._play(name, src, cam); } catch {} }
  _play(name, src, cam) {
    const c = this.ctx; if (!c || c.state !== 'running' || !this.level) return;
    const now = c.currentTime, gap = { rifle: 0.06, shot: 0.06, step: 0.12, spray: 0.18, drill: 0.25, mine: 0.9, stage: 0.15, click: 0.04, 'alert:base': 15, 'alert:unit': 25, rocket: 0.08, boom_m: 0.05, die_inf: 0.08 }[name] ?? 0.05;
    if (now - (this.last[name] || 0) < gap) { this.stats.dropped++; return; }
    let vol = 1; if (src && cam && src.x !== undefined) { const cx = cam.x + cam.vw / 2, cy = cam.y + cam.vh / 2, d = Math.hypot(src.x - cx, src.y - cy), R = Math.max(cam.vw, cam.vh) * 0.6;
      vol = d < R ? 1 : Math.max(0, 1 - (d - R) / (R * 1.5)); if (vol <= 0.02 && !name.startsWith('alert') && !name.startsWith('voice')) return; }
    if (this.voices >= MAX_VOICES && !name.startsWith('alert')) { this.stats.dropped++; return; }
    this.last[name] = now; this.voices++; this.stats.played++; setTimeout(() => this.voices--, 350);
    const t = now + 0.01, S = this.sfxBus, g = vol;
    if (name.startsWith('voice:')) { if (src?.type) { this.voice(src.type, name.slice(6)); if (src.type === 'dropship') this.sample(t, 'engine_low', { gain: 0.3, dur: 1.4 }); } return; }
    switch (name) {
      // UI
      case 'select': this.sample(t, 'ui_select', { gain: 0.35 }) || this.tone(t, 880, 0.07, { type: 'sine', gain: 0.05, cutoff: 3000 }); break;
      case 'move': this.sample(t, 'ui_click', { gain: 0.35 }) || this.tone(t, 520, 0.08, { gain: 0.08, to: 700 }); break;
      case 'attack': this.sample(t, 'ui_switch', { gain: 0.4 }); this.tone(t, 260, 0.1, { type: 'sawtooth', gain: 0.05, to: 130, cutoff: 1500 }); break;
      case 'queue': this.sample(t, 'ui_toggle', { gain: 0.35 }) || this.tone(t, 660, 0.06, { gain: 0.08 }); break;
      case 'build': case 'place': this.sample(t, 'plate_h', { gain: 0.6 * g }); this.sample(t + 0.05, 'ui_drop', { gain: 0.3 }); this.tone(t, 70, 0.35, { type: 'sine', gain: 0.2, to: 40 }); this.duck(0.6, 0.3); break;
      case 'constructed': this.sample(t, 'ui_confirm', { gain: 0.4 }); this.voice('engineer', 'ready'); break;
      case 'ready': this.sample(t, 'ui_confirm', { gain: 0.3, rate: 1.1 }); break;
      case 'sell': this.sample(t, 'ui_down', { gain: 0.4 }); this.sample(t + 0.1, 'mining', { gain: 0.3 }); break;
      case 'click': this.sample(t, 'ui_click', { gain: 0.25 }); break;
      case 'mine': { const f = src?.stats?.faction; if (f === 'reptile') { this.sample(t, 'slime', { gain: 0.18 * g, rate: 0.8 }); this.noise(t, 0.15, { gain: 0.05 * g, cutoff: 700 }); }
        else if (f === 'nordic') this.tone(t, 1320, 0.6, { type: 'sine', gain: 0.03 * g, attack: 0.01 });
        else if (f === 'grey') this.tone(t, 220, 0.5, { type: 'sine', gain: 0.04 * g, to: 330 });
        else this.sample(t, 'mining', { gain: 0.25 * g, dur: 0.6 }); break; }
      case 'stage': { const f = src?.stats?.faction; if (f === 'reptile') { this.sample(t, 'slime', { gain: 0.3 * g, rate: 0.6 + Math.random() * 0.2 }); this.tone(t, 60, 0.5, { type: 'sine', gain: 0.1 * g, to: 40 }); }
        else if (f === 'nordic') { this.tone(t, 660, 0.9, { type: 'sine', gain: 0.05 * g, attack: 0.05 }); this.tone(t, 990, 0.9, { type: 'sine', gain: 0.03 * g, attack: 0.08 }); }
        else if (f === 'grey') { this.tone(t, 140, 0.4, { type: 'sine', gain: 0.07 * g, to: 210 }); this.sample(t, 'ui_glitch', { gain: 0.15 * g }); }
        else { this.sample(t, ['metal1', 'metal2', 'metal3'][Math.random() * 3 | 0], { gain: 0.35 * g }); this.sample(t + 0.08, 'plate_h', { gain: 0.25 * g, rate: 1.2 }); } break; }
      case 'powerup': this.sample(t, 'ui_up', { gain: 0.45 }); this.tone(t, 110, 0.9, { type: 'sawtooth', gain: 0.06, to: 330, cutoff: 1200, attack: 0.1 }); break;
      case 'lowpower': this.sample(t, 'ui_down', { gain: 0.5 }); this.tone(t, 330, 1.1, { type: 'sawtooth', gain: 0.07, to: 90, cutoff: 900 }); this.voice('engineer', 'alert'); break;
      case 'alert:base': this.duck(0.3, 1.6); for (let i = 0; i < 2; i++) { this.tone(t + i * 0.42, 620, 0.2, { type: 'triangle', gain: 0.06, cutoff: 2000 }); this.tone(t + i * 0.42 + 0.2, 460, 0.2, { type: 'triangle', gain: 0.06, cutoff: 2000 }); }
        this.sample(t + 0.85, 'comp1', { gain: 0.25 }); setTimeout(() => this.voice('infantry', 'alert'), 900); break;
      case 'alert:unit': this.sample(t, 'comp2', { gain: 0.2 }); break;
      // weapons
      case 'rifle': this.noise(t, 0.05, { gain: 0.22 * g, cutoff: 3500, type: 'bandpass', q: 1 }); this.noise(t, 0.12, { gain: 0.08 * g, cutoff: 900 }); this.tone(t, 900, 0.03, { type: 'square', gain: 0.03 * g, to: 300 }); break;
      case 'shot': this.noise(t, 0.07, { gain: 0.15 * g, cutoff: 2500 }); break;
      case 'snipe': this.noise(t, 0.035, { gain: 0.35 * g, cutoff: 6000, type: 'highpass' }); this.tone(t, 2200, 0.3, { type: 'sine', gain: 0.05 * g, to: 400 }); this.noise(t + 0.02, 0.5, { gain: 0.1 * g, cutoff: 700 }); this.sample(t, 'laser_s2', { gain: 0.15 * g, rate: 0.6 }); break;
      case 'rocket': this.sample(t, ['thrust1', 'thrust2'], { gain: 0.5 * g, rate: 1.3, dur: 0.6 }); this.noise(t, 0.5, { gain: 0.18 * g, cutoff: 600, to: 2600, type: 'bandpass', q: 1.5, attack: 0.03 });
        this.tone(t, 160, 0.4, { type: 'sawtooth', gain: 0.04 * g, to: 700, cutoff: 1500 }); setTimeout(() => this.play('boom_s', src, cam), 260); break;
      case 'cannon': this.tone(t, 110, 0.35, { type: 'sine', gain: 0.4 * g, to: 38 }); this.noise(t, 0.08, { gain: 0.35 * g, cutoff: 2400 }); this.noise(t + 0.02, 0.45, { gain: 0.15 * g, cutoff: 500 }); this.sample(t, 'punch_h', { gain: 0.35 * g, rate: 0.7 }); break;
      case 'bolt': this.sample(t, ['laser_l1', 'laser_l2'], { gain: 0.45 * g, rate: 0.85 }); this.tone(t, 520, 0.25, { type: 'sawtooth', gain: 0.05 * g, to: 90, cutoff: 1800 }); this.noise(t, 0.2, { gain: 0.08 * g, cutoff: 1200, type: 'bandpass', q: 4 }); break;
      case 'spray': this.noise(t, 0.35, { gain: 0.2 * g, cutoff: 4500, type: 'highpass', attack: 0.04 }); this.sample(t, 'slime', { gain: 0.25 * g, rate: r(0.8, 1.1) }); break;
      case 'drill': this.tone(t, 70, 0.3, { type: 'sawtooth', gain: 0.08 * g, to: 90, cutoff: 600 }); this.sample(t, 'mining', { gain: 0.4 * g }); break;
      // explosions by size
      case 'boom_s': this.sample(t, ['boom_s1', 'boom_s2'], { gain: 0.45 * g, rate: 1.2 }) || this.noise(t, 0.3, { gain: 0.3 * g, cutoff: 1200 }); this.tone(t, 90, 0.25, { type: 'sine', gain: 0.18 * g, to: 40 }); break;
      case 'boom_m': this.sample(t, ['boom_m1', 'boom_s2'], { gain: 0.6 * g }); this.tone(t, 70, 0.6, { type: 'sine', gain: 0.35 * g, to: 30 }); this.noise(t, 0.8, { gain: 0.2 * g, cutoff: 600, to: 150 }); if (g > 0.5) this.duck(0.55, 0.4); break;
      case 'boom': case 'boom_l': this.sample(t, ['boom_l1', 'boom_l2'], { gain: 0.8 * g }); this.sample(t + 0.03, 'boom_m1', { gain: 0.4 * g, rate: 0.7 }); this.tone(t, 55, 1.2, { type: 'sine', gain: 0.45 * g, to: 25 });
        this.noise(t, 1.6, { gain: 0.25 * g, cutoff: 900, to: 120 }); this.sample(t + 0.35, ['metal1', 'metal3'], { gain: 0.2 * g, rate: 0.7 }); if (g > 0.4) this.duck(0.3, 1.0); break;
      case 'die_inf': this.noise(t, 0.1, { gain: 0.08 * g, cutoff: 1200, type: 'bandpass', q: 3 }); this.tone(t, 300 * r(0.8, 1.2), 0.18, { type: 'sawtooth', gain: 0.04 * g, to: 120, cutoff: 1400 }); break;
      // abilities
      case 'stim': this.tone(t, 300, 0.3, { type: 'sawtooth', gain: 0.07, to: 1100, cutoff: 2500 }); this.noise(t, 0.2, { gain: 0.08, cutoff: 5000, type: 'highpass' }); this.sample(t, 'zap1', { gain: 0.2 }); break;
      case 'cloak': this.sample(t, ['field1', 'field2'], { gain: 0.5 * g, rate: 1.2 }); this.tone(t, 1400, 0.7, { type: 'sine', gain: 0.05, to: 180 }); this.tone(t + 0.05, 1750, 0.6, { type: 'sine', gain: 0.03, to: 220 }); break;
      case 'decloak': this.sample(t, ['field1', 'field2'], { gain: 0.4 * g, rate: 0.8 }); this.tone(t, 200, 0.5, { type: 'sine', gain: 0.05, to: 1200 }); break;
      case 'digin': this.sample(t, 'mining', { gain: 0.4 }); this.noise(t, 0.35, { gain: 0.2, cutoff: 500 }); break;
      case 'capture': this.sample(t, 'comp2', { gain: 0.35 }); for (let i = 0; i < 4; i++) this.tone(t + i * 0.09, 440 * Math.pow(1.26, i), 0.12, { type: 'square', gain: 0.04, cutoff: 3000 }); break;
      case 'demo': for (let i = 0; i < 3; i++) this.tone(t + i * 0.15, 1800, 0.06, { type: 'triangle', gain: 0.05, cutoff: 4000 }); this.sample(t, 'tick_l', { gain: 0.3 }); break;
      case 'board': this.sample(t, 'door_close', { gain: 0.4 * g }); break;
      case 'drop': this.sample(t, 'door_open', { gain: 0.35 * g, rate: 1.2 }); this.sample(t + 0.1, 'step_c', { gain: 0.3 * g }); break;
      case 'hum': this.sample(t, ['engine_low', 'engine_circ'], { gain: 0.25 * g, dur: 1.2 }); break;
      // structures / walker
      case 'wall': this.sample(t, ['metal_h', 'plate_h'], { gain: 0.5 }); this.tone(t, 90, 0.2, { type: 'sine', gain: 0.18, to: 45 }); break;
      case 'clank': this.sample(t, ['metal1', 'metal2', 'metal3'], { gain: 0.45 * g }); break;
      case 'alarm': for (let i = 0; i < 3; i++) { this.tone(t + i * 0.32, 760, 0.15, { type: 'triangle', gain: 0.05, cutoff: 2400 }); this.tone(t + i * 0.32 + 0.15, 560, 0.15, { type: 'triangle', gain: 0.05, cutoff: 2400 }); } break;
      case 'hiss': this.noise(t, 0.8, { gain: 0.16 * g, cutoff: 5000, type: 'highpass', attack: 0.05 }); this.sample(t, 'thrust2', { gain: 0.15 * g, rate: 1.6, dur: 0.6 }); break;
      case 'servo': this.sample(t, ['door_open', 'door_close'], { gain: 0.35 * g, rate: 0.8 }); this.tone(t, 160, 0.5, { type: 'sawtooth', gain: 0.04, to: 320, cutoff: 900, attack: 0.05 }); break;
      case 'stomp': this.sample(t, 'punch_h', { gain: 0.6, rate: 0.6 }); this.tone(t, 70, 0.7, { type: 'sine', gain: 0.45, to: 25 }); this.noise(t, 0.6, { gain: 0.25, cutoff: 350 }); this.duck(0.5, 0.5); break;
      case 'step': this.sample(t, 'step_c', { gain: 0.35 * g, rate: 0.55 }); this.tone(t, 60, 0.25, { type: 'sine', gain: 0.2 * g, to: 32 }); break;
      case 'transform': this.sample(t, 'engine_circ', { gain: 0.35, rate: 0.7 }); this.tone(t, 80, 1.8, { type: 'sawtooth', gain: 0.08, to: 240, attack: 0.2, cutoff: 800 }); break;
      case 'deploy': this.sample(t, 'engine_circ', { gain: 0.3, rate: 0.6 }); this.tone(t, 240, 1.2, { type: 'sawtooth', gain: 0.07, to: 70, attack: 0.1, cutoff: 700 }); break;
      // v10 sounds
      case 'mg': this.noise(t, 0.04, { gain: 0.2 * g, cutoff: 3000, type: 'bandpass', q: 1.5 }); this.tone(t, 160, 0.05, { type: 'square', gain: 0.05 * g, to: 90, cutoff: 1200 }); break;
      case 'fx_acid': this.sample(t, 'slime', { gain: 0.35 * g, rate: r(1.1, 1.4) }); this.noise(t, 0.18, { gain: 0.08 * g, cutoff: 2500, type: 'highpass' }); break;
      case 'fx_bio': this.tone(t, 90, 0.4, { type: 'sine', gain: 0.3 * g, to: 45 }); this.sample(t, 'slime', { gain: 0.45 * g, rate: 0.7 }); this.noise(t, 0.3, { gain: 0.12 * g, cutoff: 800 }); break;
      case 'fx_lightning': this.sample(t, 'zap1', { gain: 0.25 * g, rate: r(1.2, 1.6) }); this.noise(t, 0.06, { gain: 0.12 * g, cutoff: 6000, type: 'highpass' }); break;
      case 'fx_beam': this.sample(t, ['laser_l1', 'laser_l2'], { gain: 0.45 * g, rate: 0.6 }); this.tone(t, 70, 0.5, { type: 'sawtooth', gain: 0.08 * g, to: 140, cutoff: 900 }); break;
      case 'fx_magic': this.sample(t, ['field1', 'field2'], { gain: 0.25 * g, rate: 1.8, dur: 0.4 }); this.tone(t, 1200, 0.25, { type: 'sine', gain: 0.04 * g, to: 2400 }); break;
      case 'fx_claw': this.noise(t, 0.08, { gain: 0.16 * g, cutoff: 4000, type: 'bandpass', q: 2, to: 1500 }); this.sample(t, 'punch_h', { gain: 0.15 * g, rate: 1.6 }); break;
      case 'leap': this.noise(t, 0.3, { gain: 0.12, cutoff: 1200, to: 3000, type: 'bandpass', q: 1 }); this.voice('raider', 'attack'); break;
      case 'harden': this.sample(t, ['metal1', 'metal2'], { gain: 0.3, rate: 0.6 }); this.tone(t, 120, 0.4, { type: 'sawtooth', gain: 0.06, to: 60, cutoff: 600 }); break;
      case 'acid': this.sample(t, 'slime', { gain: 0.5, rate: 0.8 }); this.noise(t + 0.1, 0.8, { gain: 0.1, cutoff: 3000, type: 'highpass', attack: 0.1 }); break;
      case 'storm': this.sample(t, ['field1', 'field2'], { gain: 0.45, rate: 0.6 }); this.noise(t, 1.6, { gain: 0.15, cutoff: 400, to: 1800, type: 'bandpass', q: 1, attack: 0.3 }); this.sample(t + 0.4, 'zap1', { gain: 0.3, rate: 0.8 }); break;
      case 'ram': this.tone(t, 90, 0.6, { type: 'sawtooth', gain: 0.1, to: 220, cutoff: 900, attack: 0.05 }); this.sample(t, 'thrust1', { gain: 0.3, rate: 0.7, dur: 0.7 }); break;
      case 'ramhit': this.sample(t, ['metal_h', 'plate_h'], { gain: 0.5 * g }); this.tone(t, 80, 0.3, { type: 'sine', gain: 0.3 * g, to: 35 }); break;
      case 'egg': this.sample(t, 'slime', { gain: 0.45 * g, rate: 0.6 }); this.tone(t, 70, 0.3, { type: 'sine', gain: 0.2 * g, to: 40 }); break;
      case 'hatch': this.sample(t, 'slime', { gain: 0.5 * g, rate: 1.2 }); this.noise(t, 0.2, { gain: 0.12 * g, cutoff: 2000, type: 'bandpass', q: 2 }); this.voice('hatchling', 'select'); break;
      case 'spawn': this.sample(t, 'zap1', { gain: 0.25 * g, rate: 1.5 }); break;
      default: this.tone(t, 600, 0.06, { gain: 0.04 });
    }
  }
}
