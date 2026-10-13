import { ME, setMe } from './engine/local.js?v=10.0';
import { net } from './net/lockstep.js?v=10.0';
import { Game, GRACE_SECONDS } from './engine/game.js?v=10.0';
import { BUILDINGS } from './data/stats.js?v=10.0';
import { Camera } from './engine/camera.js?v=10.0';
import { Renderer } from './engine/renderer.js?v=10.0';
import { Input } from './engine/input.js?v=10.0';
import { startLoop } from './engine/loop.js?v=10.0';
import { PlayerUI } from './ui/selection.js?v=10.0';
import { Sidebar } from './ui/sidebar.js?v=10.0';
import { Minimap } from './ui/minimap.js?v=10.0';
import { EnemyAI } from './ai/enemyAI.js?v=10.0';
import { loadSprites } from './engine/sprites.js?v=10.0';
import { Sound } from './engine/audio.js?v=10.0';

loadSprites();

// v10: faction pick (start menu). The page reloads into the chosen faction; ?faction=human|reptile overrides. The AI plays the other side.
const params0 = new URLSearchParams(location.search);
const myFaction = ['human', 'reptile'].includes(params0.get('faction')) ? params0.get('faction') : (localStorage.getItem('tiberium.faction') || 'human');
const game = new Game({ factions: [myFaction, myFaction === 'human' ? 'reptile' : 'human'] });
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
const ai = new EnemyAI(game, 1);
const banner = document.getElementById('banner'), graceEl = document.getElementById('graceTimer');
let started = false;
// Start menu: optional 10-minute ceasefire for both sides (default ON). ?grace=0|1 overrides; ?autostart=1 skips the menu.
const params = new URLSearchParams(location.search), graceOpt = document.getElementById('graceOpt');
if (params.has('grace')) graceOpt.checked = params.get('grace') !== '0';
for (const r of document.querySelectorAll('input[name=faction]')) r.checked = r.value === myFaction;
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
$('mpCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('mpOffer').value); mpStatus.textContent = 'Copied.'; } catch { $('mpOffer').select(); mpStatus.textContent = 'Select the text and copy it.'; } });
$('mpHost').addEventListener('click', async () => { mpStatus.textContent = 'Creating host code…'; sound.start();
  try { const code = await net.host({ faction: pickF(), lowFx: game.lowFx }); $('mpOffer').value = code; show('mpOfferL', 'mpCopy', 'mpAnswerL', 'mpGo');
    mpStatus.textContent = 'Send this code to your opponent, then paste their answer code below and press Connect.'; $('mpGo').onclick = async () => {
      try { await net.accept($('mpAnswer').value); mpStatus.textContent = 'Connecting…'; } catch (e) { mpStatus.textContent = 'Bad answer code: ' + e.message; } };
  } catch (e) { mpStatus.textContent = 'WebRTC unavailable: ' + e.message; } });
$('mpJoin').addEventListener('click', () => { show('mpAnswerL', 'mpGo'); $('mpAnswerL').firstChild.textContent = "Paste the host's code:"; sound.start();
  mpStatus.textContent = "Paste the host's code and press Connect."; $('mpGo').onclick = async () => {
    try { const code = await net.join($('mpAnswer').value, { faction: pickF(), lowFx: game.lowFx }); $('mpOffer').value = code; show('mpOfferL', 'mpCopy');
      $('mpOfferL').firstChild.textContent = 'Send this answer code back to the host:'; mpStatus.textContent = 'Waiting for the host to connect…';
    } catch (e) { mpStatus.textContent = 'Bad host code: ' + e.message; } }; });
net.onOpen = () => { mpStatus.textContent = 'Connected.'; if (!net.isHost) return;
  const seed = (Math.random() * 2 ** 31) | 0, hF = net.helloLocal.faction, gF = net.helloRemote?.faction || 'human';
  const msg = { k: 'start', seed, grace: graceOpt.checked, lowFx: !!(net.helloLocal.lowFx || net.helloRemote?.lowFx), factions: [hF, gF] };
  net.send(msg); beginMP(msg, 0); };
net.onMessage = m => { if (m.k === 'start' && !net.isHost) beginMP(m, 1); };
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
  if (net.active && window.netBadge) { const b = window.netBadge; b.classList.toggle('bad', !!net.desync || net.status === 'disconnected');
    b.textContent = net.desync ? `DESYNC at turn ${net.desync.turn}` : net.status === 'disconnected' ? 'Opponent disconnected' : `P${ME + 1} · turn ${net.turn} · ${Math.round(net.rtt)} ms${net.waiting ? ' · waiting…' : ''}`; }
  if (ui.placing && !BUILDINGS[ui.placing]?.instant && !game.teams[ME].readyBuilding) ui.placing = null;
}, () => {
  const left = game.graceLeft(), after = game.time - game.graceUntil;
  graceEl.hidden = !started || !(left > 0 || (game.graceUntil > 0 && after < 4));
  if (!graceEl.hidden) { graceEl.classList.toggle('over', left <= 0);
    graceEl.textContent = left > 0 ? `Ceasefire: no attacks ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Ceasefire over: combat enabled!'; }
  renderer.render(ui); sidebar.update(); minimap.render(); });

window.game = game; window.sound = sound; window.ui = ui; window.camera = camera; // handy for debugging / scripted tests
