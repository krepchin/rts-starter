import { Game } from './engine/game.js';
import { Camera } from './engine/camera.js';
import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { PlayerUI } from './ui/selection.js';
import { Sidebar } from './ui/sidebar.js';
import { Minimap } from './ui/minimap.js';
import { EnemyAI } from './ai/enemyAI.js';

const game = new Game();
const camera = new Camera(game.map);
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas, game, camera);
const ui = new PlayerUI(game);
const input = new Input(canvas, game, camera, ui);
const sidebar = new Sidebar(game, ui);
const minimap = new Minimap(document.getElementById('minimap'), game, camera);
const ai = new EnemyAI(game, 1);
const banner = document.getElementById('banner');

// iOS Safari: 100vh includes the URL bar, so size from innerHeight.
function onResize() { document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`); renderer.resize(); }
window.addEventListener('resize', onResize); window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
window.visualViewport?.addEventListener('resize', onResize);
onResize();
camera.centerOn(8 * 32, 8 * 32);

startLoop(dt => {
  input.update(dt); ai.update(dt); game.update(dt); ui.prune();
  if (game.over && banner.hidden) { banner.hidden = false; banner.textContent = game.over === 'win' ? 'VICTORY' : 'DEFEAT'; }
}, () => { renderer.render(ui); sidebar.update(); minimap.render(); });

window.game = game; // handy for debugging in the console
