import { ME, setMe } from './engine/local.js?v=10.1';
import { net } from './net/lockstep.js?v=10.1';
import { Game, GRACE_SECONDS } from './engine/game.js?v=10.1';
import { BUILDINGS } from './data/stats.js?v=10.1';
import { Camera } from './engine/camera.js?v=10.1';
import { Renderer } from './engine/renderer.js?v=10.1';
import { Input } from './engine/input.js?v=10.1';
import { startLoop } from './engine/loop.js?v=10.1';
import { PlayerUI } from './ui/selection.js?v=10.1';
import { Sidebar } from './ui/sidebar.js?v=10.1';
import { Minimap } from './ui/minimap.js?v=10.1';
import { EnemyAI } from './ai/enemyAI.js?v=10.1';
import { loadSprites } from './engine/sprites.js?v=10.1';
import { Sound } from './engine/audio.js?v=10.1';

loadSprites();

// v10: faction pick (start menu). The page reloads into the chosen faction; ?faction=human|reptile overrides. The AI plays the other side.
const params0 = new URLSearchParams(location.search);
const FK = ['human', 'reptile', 'nordic', 'grey'];
let saved = null; try { saved = localStorage.getItem('tiberium.faction'); } catch {}
const myFaction = FK.includes(params0.get('faction')) ? params0.get('faction') : FK.includes(saved) ? saved : 'human';
const others = FK.filter(f => f !== myFaction), aiFaction = others.includes(params0.get('ai')) ? params0.get('ai') : others[Math.floor(Math.random() * others.length)]; // AI: a different faction
const game = new Game({ factions: [myFaction, aiFaction] }); window.aiFaction = aiFaction;
const sound = new Sound(); game.sfx = (n, src) => sound.play(n, src, camera);
const volBtn = document.getElementById('volBtn'), VOL_ICON = ['🔇', '🔈', '🔉', '🔊'];
volBtn.textContent = VOL_ICON[sound.level]; volBtn.addEventListener('click', () => { sound.start(); volBtn.textContent = VOL_ICON[sound.cycle()]; sound.play('select'); });
const camera = new Camera(game.map);
game.lowFx = matchMedia('(max-width: 700px), (pointer: coarse)').matches; // lighter particles on phones
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas, game, camera);
const ui = new PlayerUI(game);
const input = new Input(canvas, game, camera, ui);
const sidebar = new Sidebar(game, ui);
const minimap = new Minimap(document.getElementById('minimap'), game, camera); minimap.sel = ui.selection;
document.getElementById('findBtn').addEventListener('click', () => ui.find(camera));
let ai = new EnemyAI(game, 1);
const banner = document.getElementById('banner'), graceEl = document.getElementById('graceTimer');
let started = false;
// Start menu: optional 10-minute ceasefire for both sides (default ON). ?grace=0|1 overrides; ?autostart=1 skips the menu.
const params = new URLSearchParams(location.search), graceOpt = document.getElementById('graceOpt');
if (params.has('grace')) graceOpt.checked = params.get('grace') !== '0';
for (const r of document.querySelectorAll('input[name=faction]')) { r.checked = r.value === myFaction;
  r.addEventListener('change', () => { try { localStorage.setItem('tiberium.faction', r.value); } catch {} markFac(); }); }
function markFac() { for (const l of document.querySelectorAll('#factionPick .fac')) l.classList.toggle('on', !!l.querySelector('input')?.checked); }
markFac();
function start() {
  const pick = document.querySelector('input[name=faction]:checked')?.value || myFaction;
  if (pick !== myFaction) { try { localStorage.setItem('tiberium.faction', pick); } catch {} const q = new URLSearchParams(location.search); q.set('faction', pick); q.set('autostart', '1'); q.set('grace', graceOpt.checked ? '1' : '0'); location.search = q.toString(); return; }
  try { localStorage.setItem('tiberium.faction', pick); } catch {}
  game.graceUntil = graceOpt.checked ? GRACE_SECONDS : 0; started = true; document.getElementById('startMenu').hidden = true; }
document.getElementById('startBtn').addEventListener('click', start);

// ---- v10 multiplayer lobby (copy/paste signaling). See docs/MULTIPLAYER.md.
const $ = id => document.getElementById(id), mpStatus = $('mpStatus');
const pickF = () => document.querySelector('input[name=faction]:checked')?.value || myFaction;
const show = (...ids) => { for (const id of ids) $(id).hidden = false; };
$('mpBtn').addEventListener('click', () => { $('mpPanel').hidden = !$('mpPanel').hidden; });
$('mpHost').addEventListener('click', async () => { mpStatus.textContent = 'Creating room…'; sound.start(); $('mpHost').disabled = true;
  try { const code = await net.hostRoom({ faction: pickF(), lowFx: game.lowFx }); $('mpCode').textContent = code; $('mpCodeBox').hidden = false;
    mpStatus.textContent = 'Waiting for your opponent to join with this code…'; } catch (e) { $('mpHost').disabled = false; mpStatus.textContent = 'Could not create a room: ' + (e.message || e.type); } });
$('mpJoin').addEventListener('click', async () => { const code = $('mpJoinCode').value.trim(); if (code.length < 5) { mpStatus.textContent = 'Enter the 5-letter room code.'; return; }
  sound.start(); mpStatus.textContent = 'Joining room ' + code.toUpperCase() + '…'; $('mpJoin').disabled = true;
  try { await net.joinRoom(code, { faction: pickF(), lowFx: game.lowFx }); mpStatus.textContent = 'Connected, starting…'; } catch (e) { $('mpJoin').disabled = false; net.leave(); mpStatus.textContent = 'Could not join: ' + e.message; } });
net.onClose = () => { if (!net.active) { mpStatus.textContent = 'Connection lost. Try again.'; $('mpHost').disabled = $('mpJoin').disabled = false; return; }
  // mid-match: the AI takes over the missing player's side so the game carries on
  net.active = false; if (net.restoreRandom) net.restoreRandom(); ai = new EnemyAI(game, 1 - ME); window.__aiTakeover = true; };
net.onOpen = () => { mpStatus.textContent = 'Connected.'; if (!net.isHost) return;
  const seed = (Math.random() * 2 ** 31) | 0, hF = net.helloLocal.faction, gF = net.helloRemote?.faction || 'human';
  const msg = { k: 'start', seed, grace: graceOpt.checked, lowFx: !!(net.helloLocal.lowFx || net.helloRemote?.lowFx), factions: [hF, gF] };
  msg.hostHello = net.helloLocal; net.send(msg); beginMP(msg, 0); };
net.onMessage = m => { if (m.k === 'start' && !net.isHost) beginMP(m, 1); if (m.k === 'full') mpStatus.textContent = 'That room is already full.'; };
function beginMP(m, me) {
  net.install(game); setMe(me); game.reset({ factions: m.factions, me, mp: true }); game.graceUntil = m.grace ? GRACE_SECONDS : 0; game.lowFx = m.lowFx;
  game.sfx = (n, src) => sound.play(n, src, camera); ui.selection.clear(); ui.cancel();
  net.start(game, m.seed, me); started = true; $('startMenu').hidden = true; camera.centerOn((me ? 79 : 8) * 32, (me ? 79 : 8) * 32);
  const badge = document.createElement('div'); badge.id = 'netBadge'; document.getElementById('app').appendChild(badge); window.netBadge = badge; }
window.net = net;
if (params.get('autostart') === '1') start();
window.startGame = start;
if (window.__wantStart) { document.getElementById('startBtn').textContent = 'Start Skirmish'; start(); } // tapped while modules were still loading

// iOS Safari: 100vh includes the URL bar, so size from innerHeight.
function onResize() { document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`); renderer.resize(); }
window.addEventListener('resize', onResize); window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
window.visualViewport?.addEventListener('resize', onResize);
onResize();

startLoop(dt => {
  input.update(dt); if (!started) return;
  if (net.active) net.update(dt); else { ai.update(dt); game.update(dt); }
  ui.prune();
  if (game.over && banner.hidden) { banner.hidden = false; banner.textContent = (game.over === 'win') === (ME === 0) ? 'VICTORY' : 'DEFEAT'; }
  if ((net.active || window.__aiTakeover) && window.netBadge) { const b = window.netBadge; b.classList.toggle('bad', !!net.desync || net.status === 'disconnected');
    b.textContent = net.desync ? `DESYNC at turn ${net.desync.turn}` : net.status === 'disconnected' ? (window.__aiTakeover ? 'Opponent left · AI took over' : 'Opponent disconnected') : `P${ME + 1} · turn ${net.turn} · ${Math.round(net.rtt)} ms${net.waiting ? ' · waiting…' : ''}`; }
  if (ui.placing && !BUILDINGS[ui.placing]?.instant && !game.teams[ME].readyBuilding) ui.placing = null;
}, () => {
  const left = game.graceLeft(), after = game.time - game.graceUntil;
  graceEl.hidden = !started || !(left > 0 || (game.graceUntil > 0 && after < 4));
  if (!graceEl.hidden) { graceEl.classList.toggle('over', left <= 0);
    graceEl.textContent = left > 0 ? `Ceasefire: no attacks ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Ceasefire over: combat enabled!'; }
  renderer.render(ui); sidebar.update(); minimap.render(); });

window.game = game; window.sound = sound; window.ui = ui; window.camera = camera; // handy for debugging / scripted tests
window.__B = BUILDINGS;
