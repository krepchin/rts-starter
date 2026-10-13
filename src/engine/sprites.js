// Preloaded raster sprites (assets/*.png, @2x for high-DPI screens). Each sprite gets a per-team canvas:
// team 0 = original steel-blue art, team 1 = red/rust tinted copy so factions stay distinct.
// get() returns null until loaded or if loading failed, so callers fall back to procedural drawing.
import { paintGrade } from './paint.js?v=9.2.2';
const PW_TINT = { 1: 'rgba(160,40,20,0.28)' };
const NAMES = ['cy', 'tank_hover', 'tank_heavy', 'tank_laser', 'carrier', 'icp_drone', 'icp_jet', 'icp_vtol', 'harvester', 'soldier',
  'b_power', 'b_refinery', 'b_barracks', 'b_factory', 'b_airfield', 'b_radar', 'b_turret', 'b_ion',
  'pw_body', 'pw_towers', 'pw_armL', 'pw_armR', 'pw_legL', 'pw_legR', 'carrier_td']; // v9 painted Base Walker layers (cut from the approved preview)
const cache = {};

function tinted(img, team, name = '') {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  if (name.startsWith('pw_') || name === 'carrier_td') { // painted walker layers cut from the approved preview: only a light team wash
    if (PW_TINT[team]) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = PW_TINT[team]; x.fillRect(0, 0, c.width, c.height); } return c; }
  return paintGrade(c, team); // v9: grade steel-blue art to gritty gray/olive (team 1 rust)
}
export function loadSprites() {
  const hi = (window.devicePixelRatio || 1) > 1;
  for (const n of NAMES) {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => { cache[n] = { 0: tinted(img, 0, n), 1: tinted(img, 1, n), aspect: img.naturalHeight / img.naturalWidth }; };
    img.onerror = () => { if (hi && !img.dataset.retry) { img.dataset.retry = 1; img.src = `assets/${n}.png?v=9.2.2`; } else console.warn('sprite failed, using fallback:', n); };
    img.src = `assets/${n}${hi ? "@2x" : ""}.png?v=9.2.2`;
  }
}
export function getSprite(name, team) { const s = cache[name]; return s ? { img: s[team] || s[0], aspect: s.aspect } : null; }
export const TANK_VARIANTS = ['tank_hover', 'tank_heavy', 'tank_laser'];
// Strike drone is the main interceptor look; jet + VTOL gunship mixed in cosmetically.
export const INTERCEPTOR_VARIANTS = ['icp_drone', 'icp_drone', 'icp_jet', 'icp_drone', 'icp_vtol'];
// Which way each isometric artwork faces natively (we flip horizontally by heading).
export const NATIVE_RIGHT = { icp_jet: true };
