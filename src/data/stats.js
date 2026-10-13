// All tunable game data lives here. Sizes in tiles; speeds in px/sec; times in seconds.
export const TILE = 32;
export const TEAM_COLORS = { 0: '#3fa9ff', 1: '#ff4a3a' };

// cost of the Construction Yard is only used for sell value (it can't be built from the sidebar).
export const BUILDINGS = {
  cy:       { name: 'Construction Yard', w: 3, h: 3, hp: 1500, cost: 3000, time: 0,  power: 10,  sight: 8, builds: 'building', buildable: false, yard: true },
  power:    { name: 'Power Plant',       w: 2, h: 2, hp: 600,  cost: 300,  time: 6,  power: 100, sight: 5 },
  refinery: { name: 'Refinery',          w: 3, h: 2, hp: 900,  cost: 1200, time: 10, power: -30, sight: 6, freeUnit: 'harvester', req: ['power'] },
  barracks: { name: 'Barracks',          w: 2, h: 2, hp: 700,  cost: 300,  time: 6,  power: -20, sight: 5, builds: 'infantry', req: ['power'] },
  factory:  { name: 'War Factory',       w: 3, h: 3, hp: 1100, cost: 1500, time: 12, power: -30, sight: 5, builds: 'vehicle', req: ['refinery'] },
  radar:    { name: 'Comm Center',       w: 2, h: 2, hp: 800,  cost: 1000, time: 10, power: -40, sight: 10, req: ['refinery'], radar: true },
  airfield: { name: 'Airfield',          w: 3, h: 2, hp: 900,  cost: 1600, time: 12, power: -40, sight: 6, builds: 'aircraft', req: ['factory'], repairs: { rate: 60, reach: 2.5, air: true } },
  // v9.2 Repair Center: vehicles parked on/next to it are repaired (costs credits like building repair)
  repairbay: { name: 'Repair Center',    w: 2, h: 2, hp: 900,  cost: 800,  time: 10, power: -20, sight: 5, req: ['factory'], repairs: { rate: 45, reach: 1.2 } },
  // v9 defenses (Defense tab): Tiberium cannon turret, auto-connecting walls, gates that open for friendlies
  turret:   { name: 'Tiberium Cannon',   w: 1, h: 1, hp: 650,  cost: 600,  time: 6,  power: -15, sight: 7, req: ['barracks'], def: true,
              weapon: { range: 6, damage: 34, cooldown: 1.0, air: false, color: '#9f4', bolt: true } },
  wall:     { name: 'Wall',              w: 1, h: 1, hp: 1800, cost: 50,   time: 0,  power: 0,   sight: 1, def: true, wall: true, instant: true },
  gate:     { name: 'Gate',              w: 1, h: 1, hp: 3200, cost: 150,  time: 0,  power: 0,   sight: 2, def: true, gate: true, instant: true, req: ['barracks'] },
  ion:      { name: 'Ion Uplink',        w: 2, h: 2, hp: 1000, cost: 2800, time: 20, power: -100, sight: 6, req: ['radar', 'factory'],
              superweapon: { chargeTime: 180, radius: 3, damage: 700 } },
  // ---- v10 REPTILIAN structures: organic, slowly regenerate when not under fire (organic), own economy (Digester +15% income)
  hive:      { name: 'Hive Nest',      faction: 'reptile', w: 3, h: 3, hp: 1700, cost: 3000, time: 0,  power: 15,  sight: 8, builds: 'building', buildable: false, yard: true, organic: true },
  heart:     { name: 'Pulse Heart',    faction: 'reptile', w: 2, h: 2, hp: 550,  cost: 300,  time: 6,  power: 100, sight: 5, organic: true },
  digester:  { name: 'Digester',       faction: 'reptile', w: 3, h: 2, hp: 950,  cost: 1200, time: 10, power: -30, sight: 6, freeUnit: 'grazer', req: ['heart'], organic: true, income: 1.15 },
  spawnpool: { name: 'Spawning Pool',  faction: 'reptile', w: 2, h: 2, hp: 750,  cost: 300,  time: 6,  power: -20, sight: 5, builds: 'infantry', req: ['heart'], organic: true },
  dronenest: { name: 'Drone Nest',     faction: 'reptile', w: 3, h: 3, hp: 1050, cost: 1500, time: 12, power: -30, sight: 5, builds: 'vehicle', req: ['digester'], organic: true },
  seer:      { name: 'Seer Stalk',     faction: 'reptile', w: 2, h: 2, hp: 700,  cost: 1000, time: 10, power: -40, sight: 11, req: ['digester'], radar: true, detector: true, organic: true },
  broodspire:{ name: 'Brood Spire',    faction: 'reptile', w: 3, h: 2, hp: 1000, cost: 1800, time: 14, power: -40, sight: 6, builds: 'aircraft', req: ['dronenest', 'seer'], organic: true },
  spine:     { name: 'Spine Crawler',  faction: 'reptile', w: 1, h: 1, hp: 700,  cost: 550,  time: 6,  power: -15, sight: 7, req: ['spawnpool'], def: true, organic: true,
               weapon: { range: 6, damage: 30, cooldown: 1.0, air: true, color: '#8f4', fx: 'acid', vsInf: 1.2 } },
  // ---- v10.1 NORDIC structures: white-and-gold light tech; few, strong. Light Wells overcharge (more power), Resonator +25% income
  sanctum:   { name: 'Crystal Sanctum', faction: 'nordic', w: 3, h: 3, hp: 1800, cost: 3000, time: 0, power: 15, sight: 8, builds: 'building', buildable: false, yard: true, art: 'n_crystal' },
  lightwell: { name: 'Light Well',     faction: 'nordic', w: 2, h: 2, hp: 650,  cost: 350,  time: 6,  power: 110, sight: 5, art: 'n_spire' },
  resonator: { name: 'Resonator',      faction: 'nordic', w: 3, h: 2, hp: 950,  cost: 1300, time: 10, power: -30, sight: 6, freeUnit: 'harmonizer', req: ['lightwell'], art: 'n_skiff' },
  temple:    { name: 'Temple of Light', faction: 'nordic', w: 2, h: 2, hp: 800, cost: 400,  time: 7,  power: -20, sight: 5, builds: 'infantry', req: ['lightwell'], art: 'n_crystal' },
  forge:     { name: 'Star Forge',     faction: 'nordic', w: 3, h: 3, hp: 1200, cost: 1600, time: 12, power: -30, sight: 5, builds: 'vehicle', req: ['resonator'], art: 'n_skiff' },
  oracle:    { name: 'Oracle Spire',   faction: 'nordic', w: 2, h: 2, hp: 800,  cost: 1000, time: 10, power: -40, sight: 11, req: ['resonator'], radar: true, detector: true, art: 'n_spire' },
  skygate:   { name: 'Sky Gate',       faction: 'nordic', w: 3, h: 2, hp: 1000, cost: 1800, time: 13, power: -40, sight: 6, builds: 'aircraft', req: ['forge', 'oracle'], repairs: { rate: 60, reach: 2.5, air: true }, art: 'n_lightcraft' },
  sunlance:  { name: 'Sun Lance',      faction: 'nordic', w: 1, h: 1, hp: 800,  cost: 650,  time: 7,  power: -20, sight: 7, req: ['temple'], def: true, art: 'n_spire',
               weapon: { range: 7, damage: 42, cooldown: 1.3, air: true, color: '#fff6c8', fx: 'beam', vsWall: 0.6 } },
  // ---- v10.1 GREY structures: cheap, dark alloy domes with psionic green/purple light
  nexus:     { name: 'Abduction Nexus', faction: 'grey', w: 3, h: 3, hp: 1600, cost: 3000, time: 0, power: 15, sight: 8, builds: 'building', buildable: false, yard: true, art: 'g_dome' },
  reactor:   { name: 'Zero-Point Reactor', faction: 'grey', w: 2, h: 2, hp: 500, cost: 280, time: 5, power: 100, sight: 5, art: 'g_orb' },
  extractor: { name: 'Extractor',      faction: 'grey', w: 3, h: 2, hp: 850,  cost: 1100, time: 9,  power: -30, sight: 6, freeUnit: 'reaper', req: ['reactor'], art: 'g_dome' },
  vat:       { name: 'Cloning Vats',   faction: 'grey', w: 2, h: 2, hp: 650,  cost: 250,  time: 5,  power: -20, sight: 5, builds: 'infantry', req: ['reactor'], art: 'g_hive' },
  assembly:  { name: 'Drone Assembly', faction: 'grey', w: 3, h: 3, hp: 1000, cost: 1400, time: 11, power: -30, sight: 5, builds: 'vehicle', req: ['extractor'], art: 'g_dome' },
  beacon:    { name: 'Psi Beacon',     faction: 'grey', w: 2, h: 2, hp: 700,  cost: 900,  time: 9,  power: -40, sight: 11, req: ['extractor'], radar: true, detector: true, art: 'g_hive' },
  hangar:    { name: 'Saucer Hangar',  faction: 'grey', w: 3, h: 2, hp: 900,  cost: 1600, time: 12, power: -40, sight: 6, builds: 'aircraft', req: ['assembly', 'beacon'], repairs: { rate: 55, reach: 2.5, air: true }, art: 'g_saucer' },
  psitower:  { name: 'Psi Tower',      faction: 'grey', w: 1, h: 1, hp: 550,  cost: 500,  time: 6,  power: -15, sight: 7, req: ['vat'], def: true, art: 'g_hive',
               weapon: { range: 6, damage: 24, cooldown: 0.9, air: true, color: '#c58cff', fx: 'lightning', vsInf: 1.3, vsWall: 0.3 } },
};


export const UNITS = {
  harvester: { name: 'Harvester', from: 'vehicle', hp: 600, cost: 1400, time: 12, speed: 55, radius: 12, sight: 4, capacity: 700, harvestRate: 100 },
  // v9 infantry: four types, each with a StarCraft-style ability (see Unit.useAbility)
  infantry:  { name: 'Rifleman', from: 'infantry', inf: true, hp: 80, cost: 100, time: 3, speed: 52, radius: 5, sight: 5, ability: 'stim',
               weapon: { range: 4, damage: 8, cooldown: 0.6, air: true, color: '#ff9', vsWall: 0.1 } },
  sniper:    { name: 'Sniper', from: 'infantry', inf: true, hp: 55, cost: 300, time: 6, speed: 38, radius: 5, sight: 9, ability: 'cloak', req: ['refinery'],
               weapon: { range: 8.5, damage: 55, cooldown: 2.6, air: false, color: '#fff', vsInf: 2.2, vsOther: 0.45, vsWall: 0.05 } },
  rocket:    { name: 'Rocket Trooper', from: 'infantry', inf: true, hp: 110, cost: 300, time: 6, speed: 32, radius: 6, sight: 6, ability: 'digin',
               weapon: { range: 5.5, damage: 38, cooldown: 1.8, air: true, color: '#fa6', vsVeh: 1.8, vsInf: 0.4, vsWall: 1.0, rocket: true } },
  engineer:  { name: 'Engineer', from: 'infantry', inf: true, hp: 70, cost: 400, time: 6, speed: 45, radius: 5, sight: 5, ability: 'engineer', repair: 30, req: ['refinery'] },
  medic:     { name: 'Medic', from: 'infantry', inf: true, hp: 75, cost: 250, time: 5, speed: 50, radius: 5, sight: 5, ability: 'medic', heal: 16, healRange: 2.5 },
  tank:      { name: 'Light Tank', from: 'vehicle', hp: 380, cost: 700, time: 8, speed: 70, radius: 11, sight: 6,
               weapon: { range: 5, damage: 35, cooldown: 1.2, air: false, color: '#fd6', vsWall: 0.8 } },
  dropship:  { name: 'Dropship', from: 'aircraft', hp: 900, cost: 1200, time: 14, speed: 80, radius: 17, sight: 7, air: true, req: ['airfield'],
               capacity: 8, energy: 100, cloakDrain: 7, energyRegen: 3, cloakCd: 8, unloadEach: 0.45, ability: 'cloakship' },
  carrier:   { name: 'Carrier', from: 'aircraft', hp: 1400, cost: 2500, time: 20, speed: 30, radius: 22, sight: 9, air: true,
               interceptors: 6, launchRange: 8, rebuildTime: 5, leashRange: 11 },
  // v9.2 air: Fighter Jet (air superiority, hit-and-run strafing) and Stealth Bomber (cloaked flying wing, bomb-line runs)
  jet:       { name: 'Fighter Jet', from: 'aircraft', hp: 260, cost: 1100, time: 10, speed: 200, radius: 10, sight: 8, air: true, req: ['radar'],
               weapon: { range: 6, damage: 48, cooldown: 1.0, air: true, color: '#ffd27a', vsAir: 1.0, vsGround: 0.35, rocket: true }, strafe: { damage: 9, cooldown: 0.12 } },
  bomber:    { name: 'Stealth Bomber', from: 'aircraft', hp: 380, cost: 2000, time: 18, speed: 58, radius: 16, sight: 7, air: true, req: ['radar'],
               stealth: { reveal: 3.2 }, bombs: { count: 7, spacing: 18, damage: 85, radius: 30, reload: 14 } },
  // ---- v10 HUMAN light vehicles (War Factory)
  buggy:     { name: 'Dune Buggy', from: 'vehicle', hp: 220, cost: 450, time: 6, speed: 125, radius: 9, sight: 7, light: true, allTerrain: true, ram: 35, ability: 'ram', req: ['refinery'],
               weapon: { range: 4, damage: 7, cooldown: 0.22, air: false, color: '#ffd', vsInf: 1.4, vsWall: 0.1, sound: 'mg' },
               rear: { range: 5.5, damage: 24, cooldown: 3.6, air: true, vsVeh: 1.4, vsWall: 0.8 } },
  truck:     { name: 'Monster Truck', from: 'vehicle', hp: 560, cost: 900, time: 9, speed: 98, radius: 13, sight: 6, allTerrain: true, ram: 70, ability: 'ram', req: ['refinery'],
               weapon: { range: 4, damage: 6, cooldown: 0.3, air: false, color: '#ffd', vsInf: 1.3, vsWall: 0.15, sound: 'mg' },
               rear: { range: 6.5, damage: 40, cooldown: 3.2, air: true, vsVeh: 1.5, vsWall: 1.0 } },
  // ---- v10 REPTILIAN units
  grazer:    { name: 'Grazer', faction: 'reptile', from: 'vehicle', hp: 520, cost: 1300, time: 11, speed: 62, radius: 12, sight: 4, capacity: 560, harvestRate: 130, dock: 'digester' },
  raider:    { name: 'Raider', faction: 'reptile', from: 'infantry', inf: true, hp: 98, cost: 120, time: 3, speed: 78, radius: 6, sight: 6, ability: 'leap', light: true,
               weapon: { range: 0.9, damage: 15, cooldown: 0.5, air: false, color: '#cfa', fx: 'claw', vsInf: 1.2, vsWall: 0.15 } },
  spitter:   { name: 'Spitter', faction: 'reptile', from: 'infantry', inf: true, hp: 82, cost: 220, time: 5, speed: 46, radius: 6, sight: 7, ability: 'acid', req: ['heart'],
               weapon: { range: 5.5, damage: 16, cooldown: 1.1, air: true, color: '#9f3', fx: 'acid', vsVeh: 1.3, vsWall: 0.6 } },
  brute:     { name: 'Brute', faction: 'reptile', from: 'infantry', inf: true, hp: 349, cost: 450, time: 8, speed: 30, radius: 9, sight: 6, ability: 'harden', req: ['digester'],
               weapon: { range: 5, damage: 47, cooldown: 2.2, air: false, color: '#7f2', fx: 'bio', vsVeh: 1.6, vsInf: 0.6, vsWall: 1.2 } },
  shaman:    { name: 'Shaman', faction: 'reptile', from: 'infantry', inf: true, hp: 77, cost: 400, time: 7, speed: 40, radius: 6, sight: 8, ability: 'storm', heal: 7, req: ['digester'],
               weapon: { range: 6, damage: 10, cooldown: 1.2, air: true, color: '#6fffa0', fx: 'magic', vsWall: 0.2 } },
  spark:     { name: 'Spark Drone', faction: 'reptile', from: 'vehicle', hp: 62, cost: 180, time: 3, speed: 125, radius: 6, sight: 6, hover: true, light: true,
               weapon: { range: 2.5, damage: 9, cooldown: 0.4, air: true, color: '#d8ff9a', fx: 'lightning', chain: 2, vsWall: 0.2 } },
  lance:     { name: 'Lance Drone', faction: 'reptile', from: 'vehicle', hp: 287, cost: 800, time: 9, speed: 55, radius: 11, sight: 8, hover: true, req: ['digester'],
               weapon: { range: 7, damage: 61, cooldown: 2.6, air: true, color: '#b6ff5a', fx: 'beam', vsVeh: 1.4, vsWall: 1.1 } },
  hiveorb:   { name: 'Hive Orb', faction: 'reptile', from: 'aircraft', hp: 1334, cost: 2200, time: 18, speed: 28, radius: 22, sight: 9, hover: true, spawns: 'spark', maxSpawn: 6, spawnEvery: 3.5, launchRange: 7 },
  broodship: { name: 'Brood Ship', faction: 'reptile', from: 'aircraft', hp: 1949, cost: 2600, time: 22, speed: 24, radius: 26, sight: 9, air: true, ability: 'eggs',
               eggCost: 100, eggCd: 9, maxEggs: 4, hatch: 'hatchling', hatchCount: 3 },
  egg:       { name: 'Brood Egg', faction: 'reptile', hp: 140, speed: 0, radius: 8, sight: 3, buildable: false, egg: true, hatchTime: 5 },
  hatchling: { name: 'Hatchling', faction: 'reptile', inf: true, hp: 45, speed: 82, radius: 5, sight: 5, buildable: false, hatchling: true, life: 50, light: true,
               weapon: { range: 0.8, damage: 8, cooldown: 0.5, air: false, color: '#cfa', fx: 'claw', vsWall: 0.1 } },
  // ---- v10.1 NORDICS: fewer, stronger units; light/energy weapons, shields and healing
  harmonizer:{ name: 'Harmonizer', faction: 'nordic', from: 'vehicle', hp: 650, cost: 1500, time: 12, speed: 55, radius: 12, sight: 4, capacity: 700, harvestRate: 100, dock: 'resonator' },
  sentinel:  { name: 'Sentinel', faction: 'nordic', from: 'infantry', inf: true, hp: 172, cost: 180, time: 4, speed: 50, radius: 6, sight: 6, ability: 'stim',
               weapon: { range: 5, damage: 17, cooldown: 0.8, air: true, color: '#fff3b0', fx: 'beam', vsWall: 0.15 } },
  seer:      { name: 'Seer', faction: 'nordic', from: 'infantry', inf: true, hp: 121, cost: 350, time: 6, speed: 46, radius: 6, sight: 8, healer: true, heal: 12, healRange: 3, req: ['lightwell'],
               weapon: { range: 5, damage: 8, cooldown: 1.0, air: true, color: '#fffbe0', fx: 'magic', vsWall: 0.1 } },
  guardian:  { name: 'Guardian', faction: 'nordic', from: 'infantry', inf: true, hp: 292, cost: 400, time: 7, speed: 40, radius: 7, sight: 6, ability: 'shield', req: ['resonator'],
               weapon: { range: 3.5, damage: 16, cooldown: 0.9, air: false, color: '#ffe9a0', fx: 'beam', vsWall: 0.3 } },
  tallwhite: { name: 'Tall White', faction: 'nordic', from: 'infantry', inf: true, hp: 559, cost: 900, time: 12, speed: 46, radius: 8, sight: 8, ability: 'blink', req: ['oracle'],
               weapon: { range: 1.6, damage: 92, cooldown: 1.1, air: false, color: '#fff', fx: 'beam', vsVeh: 1.2, vsWall: 1.0 } },
  skiff:     { name: 'Sun Skiff', faction: 'nordic', from: 'vehicle', hp: 600, cost: 1200, time: 10, speed: 66, radius: 13, sight: 7, hover: true, req: ['resonator'],
               weapon: { range: 5.5, damage: 50, cooldown: 1.8, air: false, color: '#dff6ff', fx: 'beam', vsVeh: 1.3, vsWall: 1.1 } },
  lightcraft:{ name: 'Light-craft', faction: 'nordic', from: 'aircraft', hp: 380, cost: 1250, time: 11, speed: 210, radius: 10, sight: 8, air: true,
               weapon: { range: 6, damage: 63, cooldown: 1.0, air: true, color: '#e8fbff', vsAir: 1.0, rocket: true }, strafe: { damage: 12, cooldown: 0.14 } },
  lightship: { name: 'Lightship', faction: 'nordic', from: 'aircraft', hp: 3304, cost: 3000, time: 26, speed: 26, radius: 26, sight: 9, air: true, req: ['oracle'], healAura: { r: 3, hp: 5 },
               weapon: { range: 7, damage: 88, cooldown: 1.8, air: true, color: '#fffbe8', fx: 'beam', vsWall: 1.0 } },
  // ---- v10.1 GREYS: cheap swarm, psionics, robot drones, abduction saucers
  reaper:    { name: 'Reaper Drone', faction: 'grey', from: 'vehicle', hp: 480, cost: 1100, time: 10, speed: 58, radius: 11, sight: 4, capacity: 620, harvestRate: 100, dock: 'extractor' },
  greydrone: { name: 'Grey Drone', faction: 'grey', from: 'infantry', inf: true, hp: 54, cost: 60, time: 2, speed: 56, radius: 4, sight: 5, light: true,
               weapon: { range: 4, damage: 7, cooldown: 0.6, air: true, color: '#c58cff', fx: 'beam', vsWall: 0.08 } },
  psionic:   { name: 'Psionic', faction: 'grey', from: 'infantry', inf: true, hp: 74, cost: 300, time: 5, speed: 44, radius: 5, sight: 7, ability: 'stun', req: ['reactor'],
               weapon: { range: 5, damage: 9, cooldown: 1.0, air: true, color: '#d9a6ff', fx: 'magic', vsWall: 0.1 } },
  abductor:  { name: 'Abductor', faction: 'grey', from: 'infantry', inf: true, hp: 115, cost: 450, time: 7, speed: 42, radius: 6, sight: 6, ability: 'abduct', req: ['extractor'],
               weapon: { range: 3, damage: 8, cooldown: 0.8, air: false, color: '#ffd27a', fx: 'beam', vsWall: 0.1 } },
  hybrid:    { name: 'Hybrid', faction: 'grey', from: 'infantry', inf: true, hp: 146, cost: 220, time: 4, speed: 50, radius: 5, sight: 6, ability: 'cloak', req: ['reactor'],
               weapon: { range: 5, damage: 15, cooldown: 0.8, air: true, color: '#b48cff', vsVeh: 1.2, vsWall: 0.2 } },
  crawler:   { name: 'Crawler Drone', faction: 'grey', from: 'vehicle', hp: 256, cost: 350, time: 4, speed: 92, radius: 9, sight: 6, light: true,
               weapon: { range: 3, damage: 14, cooldown: 0.5, air: false, color: '#9f6', fx: 'lightning', vsInf: 1.2, vsWall: 0.3 } },
  probe:     { name: 'Probe Orb', faction: 'grey', from: 'vehicle', hp: 150, cost: 450, time: 5, speed: 100, radius: 8, sight: 10, hover: true, req: ['extractor'],
               weapon: { range: 5, damage: 14, cooldown: 0.9, air: true, color: '#9f6', fx: 'lightning', vsWall: 0.2 } },
  saucer:    { name: 'Abduction Saucer', faction: 'grey', from: 'aircraft', hp: 633, cost: 1400, time: 12, speed: 80, radius: 14, sight: 8, air: true, tractor: { maxHp: 300, time: 3.5, reward: 0.4 },
               weapon: { range: 4, damage: 14, cooldown: 0.8, air: true, color: '#9f6', fx: 'lightning', vsWall: 0.2 } },
  mothership:{ name: 'Mothership', faction: 'grey', from: 'aircraft', hp: 3416, cost: 3000, time: 26, speed: 22, radius: 30, sight: 9, air: true, req: ['beacon'], tractor: { maxHp: 600, time: 4.5, reward: 0.4 },
               weapon: { range: 6, damage: 46, cooldown: 1.2, air: true, color: '#c58cff', fx: 'lightning', chain: 2, vsWall: 0.6 } },
  // v8 mobile command centre (not buildable: made by packing / transforming a Construction Yard; hp = carried buildings)
  mcv:       { name: 'Mobile Yard', hp: 1500, speed: 32, radius: 18, sight: 6, buildable: false },
  robot:     { name: 'Base Walker', hp: 3900, speed: 24, radius: 30, sight: 8, buildable: false },
  interceptor: { name: 'Interceptor', hp: 40, speed: 160, radius: 4, sight: 4, air: true, buildable: false,
               weapon: { range: 2.2, damage: 6, cooldown: 0.35, air: true, color: '#aff' } },
};

export const ECONOMY = {
  startCredits: 3000, tiberiumPerTile: 500, regrowPerSec: 4, spreadChance: 0.002,
  queueMax: 5,            // max queued items per unit category (structures: 1 at a time, C&C style)
  factoryBonus: 0.5,      // each extra producer of a category adds +50% production speed
  minPowerSpeed: 0.25,    // production speed floor when power is low (scales with made/used)
  sellRefund: 0.5,        // fraction of cost refunded on sell (scaled by current HP)
  repairRate: 0.05,       // fraction of max HP repaired per second
  repairCost: 0.5,        // repairing the full HP bar costs this fraction of the building cost
};
