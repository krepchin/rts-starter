// v10 multiplayer prototype: deterministic lockstep over a WebRTC data channel.
// - Signaling is copy/paste: the host's "offer code" and the guest's "answer code" carry the full SDP (ICE gathered up front, no server).
// - Both peers run the same simulation. Player actions are not applied locally: they are captured, serialized, scheduled DELAY turns ahead,
//   exchanged, and executed by both peers at the same turn in the same order (host first). Math.random is replaced by a shared seeded PRNG
//   while the simulation runs. Every HASH_EVERY turns both peers exchange a state checksum; a mismatch is reported as a desync.
import { Unit, Harvester } from '../entities/unit.js?v=10.0';
import { Building } from '../entities/building.js?v=10.0';
import { Game } from '../engine/game.js?v=10.0';
import * as Carr from '../entities/carrier.js?v=10.0';
import * as Drop from '../entities/dropship.js?v=10.0';
import * as Mcv from '../entities/mcv.js?v=10.0';
import * as Rep from '../entities/reptile.js?v=10.0';
import * as Air from '../entities/air.js?v=10.0';

export const TICK = 1 / 30, TICKS_PER_TURN = 3, DELAY = 2, HASH_EVERY = 10;
const ENTITY_METHODS = ['command', 'useAbility', 'castAt', 'unloadAt', 'loadNearby', 'toggleMode', 'setCloak', 'layEgg', 'toggleLock'];
const GAME_METHODS = ['enqueue', 'cancel', 'togglePause', 'placeBuilding', 'placeInstant', 'fireSuper', 'toggleRepair', 'sell', 'packYard', 'transformBase'];

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const isEnt = v => v && typeof v === 'object' && typeof v.id === 'number' && v.game && (v.kind === 'unit' || v.kind === 'building');
function ser(v) { if (isEnt(v)) return { $e: v.id }; if (Array.isArray(v)) return v.map(ser);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = ser(v[k]); return o; } return v; }
function de(v, ents) { if (Array.isArray(v)) return v.map(x => de(x, ents)); if (v && typeof v === 'object') { if ('$e' in v) return ents.get(v.$e) || null;
  const o = {}; for (const k of Object.keys(v)) o[k] = de(v[k], ents); return o; } return v; }
const pack = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '');
const unpack = s => JSON.parse(decodeURIComponent(escape(atob(s.trim().replace(/\s+/g, '')))));

// State checksum: positions, hp, credits, counts (rounded so it is robust to print formatting, still catches real divergence)
export function stateHash(g) { let h = 2166136261 >>> 0; const mix = n => { h ^= (n | 0); h = Math.imul(h, 16777619) >>> 0; };
  mix(g.units.length); mix(g.buildings.length); for (const t of g.teams) mix(Math.round(t.credits));
  for (const u of g.units) { mix(u.id); mix(Math.round(u.x * 4)); mix(Math.round(u.y * 4)); mix(Math.round(u.hp * 4)); }
  for (const b of g.buildings) { mix(b.id); mix(Math.round(b.hp * 4)); } return h >>> 0; }

export class Lockstep {
  constructor() { this.pc = null; this.dc = null; this.active = false; this.exec = false; this.local = []; this.remote = new Map(); this.mine = new Map();
    this.turn = 0; this.acc = 0; this.hashes = new Map(); this.desync = null; this.status = 'idle'; this.stalls = 0; this.rtt = 0; this.sfxQ = []; this.onMessage = null; this.installed = false; }
  // ---- signaling (copy/paste codes)
  async _pc() { const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] }); this.pc = pc;
    pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) this.status = 'disconnected'; }; return pc; }
  _gather(pc) { return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 4000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); }
  _wire(dc) { this.dc = dc; dc.onopen = () => { this.status = 'connected'; this._ping(); this.onOpen?.(); }; dc.onclose = () => { this.status = 'disconnected'; };
    dc.onmessage = e => this._recv(JSON.parse(e.data)); }
  async host(hello) { const pc = await this._pc(); this.isHost = true; this.helloLocal = hello; this._wire(pc.createDataChannel('lockstep', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer()); await this._gather(pc); this.status = 'waiting for answer';
    return pack({ v: 10, sdp: pc.localDescription.sdp, hello }); }
  async join(code, hello) { const o = unpack(code); if (o.v !== 10) throw new Error('code from a different game version');
    const pc = await this._pc(); this.isHost = false; this.helloLocal = hello; this.helloRemote = o.hello; pc.ondatachannel = e => this._wire(e.channel);
    await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp }); await pc.setLocalDescription(await pc.createAnswer()); await this._gather(pc); this.status = 'connecting';
    return pack({ v: 10, sdp: pc.localDescription.sdp, hello }); }
  async accept(code) { const o = unpack(code); this.helloRemote = o.hello; await this.pc.setRemoteDescription({ type: 'answer', sdp: o.sdp }); this.status = 'connecting'; }
  send(o) { if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(o)); }
  _ping() { this.send({ k: 'ping', t: performance.now() }); }
  _recv(m) {
    if (m.k === 'ping') return this.send({ k: 'pong', t: m.t }); if (m.k === 'pong') { this.rtt = performance.now() - m.t; return; }
    if (m.k === 'turn') { this.remote.set(m.n, m.c); return; }
    if (m.k === 'hash') { const mine = this.hashes.get(m.n); if (mine !== undefined && mine !== m.h && !this.desync) this.desync = { turn: m.n, mine, theirs: m.h }; else this.remoteHashes = (this.remoteHashes || new Map()).set(m.n, m.h); return; }
    this.onMessage?.(m); }
  // ---- command capture: wrap every UI-reachable state-changing method; while not executing a turn, calls are queued instead of applied
  install(game) { if (this.installed) return; this.installed = true; this.game = game; const self = this;
    const protos = new Set([Unit, Harvester, Building, ...Object.values(Carr), ...Object.values(Drop), ...Object.values(Mcv), ...Object.values(Rep), ...Object.values(Air)].filter(c => typeof c === 'function' && c.prototype).map(c => c.prototype));
    for (const P of protos) for (const m of ENTITY_METHODS) if (Object.prototype.hasOwnProperty.call(P, m)) { const orig = P[m];
      P[m] = function (...a) { if (!self.active || self.exec) return orig.apply(this, a); self.local.push({ e: this.id, m, a: ser(a) }); return true; }; }
    for (const m of GAME_METHODS) { const orig = Game.prototype[m]; if (!orig) continue;
      Game.prototype[m] = function (...a) { if (!self.active || self.exec || this !== self.game) return orig.apply(this, a); self.local.push({ g: 1, m, a: ser(a) }); return true; }; } }
  start(game, seed, me) { this.game = game; this.me = me; this.rng = mulberry32(seed); this.active = true; this.turn = 0; this.acc = 0;
    for (let n = 0; n < DELAY; n++) { this.mine.set(n, []); this.remote.set(n, []); } }
  _apply(team, cmds, ents) { for (const c of cmds) { try {
      if (c.g) { const a = de(c.a, ents); if (typeof a[0] === 'number' && a[0] !== team) continue; Game.prototype[c.m].apply(this.game, a); continue; } // only your own team
      const e = ents.get(c.e); if (!e || e.team !== team) continue; const P = Object.getPrototypeOf(e); P[c.m].apply(e, de(c.a, ents));
    } catch (err) { console.warn('net cmd failed', c, err); } } }
  // advance as many turns as real time allows; stalls (waits) when the other peer's turn has not arrived yet
  update(dt) { if (!this.active || this.desync) return; this.acc = Math.min(this.acc + dt, 1);
    const TURN = TICK * TICKS_PER_TURN;
    while (this.acc >= TURN) {
      const n = this.turn; if (!this.remote.has(n)) { this.stalls++; this.waiting = true; return; } this.waiting = false;
      const sendN = n + DELAY, mineC = this.local.splice(0); this.mine.set(sendN, mineC); this.send({ k: 'turn', n: sendN, c: mineC });
      const g = this.game, ents = new Map(); for (const u of g.units) { ents.set(u.id, u); for (const c of u.cargo || []) ents.set(c.id, c); } for (const b of g.buildings) ents.set(b.id, b);
      const R = Math.random; Math.random = this.rng; this.exec = true; const sfx = g.sfx; g.sfx = (a, b) => this.sfxQ.push([a, b]);
      try {
        if (n % HASH_EVERY === 0) { const h = stateHash(g); this.hashes.set(n, h); this.send({ k: 'hash', n, h }); const rh = this.remoteHashes?.get(n); if (rh !== undefined && rh !== h) this.desync = { turn: n, mine: h, theirs: rh }; }
        const host = this.me === 0 ? this.mine.get(n) : this.remote.get(n), guest = this.me === 0 ? this.remote.get(n) : this.mine.get(n);
        this._apply(0, host || [], ents); this._apply(1, guest || [], ents);
        for (let i = 0; i < TICKS_PER_TURN; i++) g.update(TICK);
      } finally { Math.random = R; this.exec = false; g.sfx = sfx; }
      for (const [a, b] of this.sfxQ.splice(0)) sfx?.(a, b);
      this.mine.delete(n - 5); this.remote.delete(n - 5); this.hashes.delete(n - 200); this.turn++; this.acc -= TURN;
      if (n % 30 === 0) this._ping();
    } }
}
export const net = new Lockstep();
