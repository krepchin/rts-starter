import { Game, GRACE_SECONDS } from './engine/game.js';
import { BUILDINGS } from './data/stats.js';
import { Camera } from './engine/camera.js';
import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { PlayerUI } from './ui/selection.js';
import { Sidebar } from './ui/sidebar.js';
import { Minimap } from './ui/minimap.js';
import { EnemyAI } from './ai/enemyAI.js';
import { loadSprites } from './engine/sprites.js';
import { Sound } from './engine/audio.js';

loadSprites();

const game = new Game();
const sound = new Sound(); game.sfx = n => sound.play(n);
const volBtn = document.getElementById('volBtn'), VOL_ICON = ['🔇', '🔈', '🔉', '🔊'];
volBtn.textContent = VOL_ICON[sound.level]; volBtn.addEventListener('click', () => { sound.start(); volBtn.textContent = VOL_ICON[sound.cycle()]; sound.play('select'); });
const camera = new Camera(game.map);
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
function start() { game.graceUntil = graceOpt.checked ? GRACE_SECONDS : 0; started = true; document.getElementById('startMenu').hidden = true; }
document.getElementById('startBtn').addEventListener('click', start);
if (params.get('autostart') === '1') start();
window.startGame = start;

// iOS Safari: 100vh includes the URL bar, so size from innerHeight.
function onResize() { document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`); renderer.resize(); }
window.addEventListener('resize', onResize); window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
window.visualViewport?.addEventListener('resize', onResize);
onResize();
camera.centerOn(8 * 32, 8 * 32);

startLoop(dt => {
  input.update(dt); if (!started) return; ai.update(dt); game.update(dt); ui.prune();
  if (game.over && banner.hidden) { banner.hidden = false; banner.textContent = game.over === 'win' ? 'VICTORY' : 'DEFEAT'; }
  if (ui.placing && !BUILDINGS[ui.placing]?.instant && !game.teams[0].readyBuilding) ui.placing = null;
}, () => {
  const left = game.graceLeft(), after = game.time - game.graceUntil;
  graceEl.hidden = !started || !(left > 0 || (game.graceUntil > 0 && after < 4));
  if (!graceEl.hidden) { graceEl.classList.toggle('over', left <= 0);
    graceEl.textContent = left > 0 ? `Ceasefire: no attacks ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Ceasefire over: combat enabled!'; }
  renderer.render(ui); sidebar.update(); minimap.render(); });

window.game = game; window.sound = sound; window.ui = ui; window.camera = camera; // handy for debugging / scripted tests
