// All tunable game data lives here. Sizes in tiles; speeds in px/sec; times in seconds.
export const TILE = 32;
export const TEAM_COLORS = { 0: '#3fa9ff', 1: '#ff4a3a' };

// cost of the Construction Yard is only used for sell value (it can't be built from the sidebar).
export const BUILDINGS = {
  cy:       { name: 'Construction Yard', w: 3, h: 3, hp: 1500, cost: 3000, time: 0,  power: 10,  sight: 8, builds: 'building', buildable: false },
  power:    { name: 'Power Plant',       w: 2, h: 2, hp: 600,  cost: 300,  time: 6,  power: 100, sight: 5 },
  refinery: { name: 'Refinery',          w: 3, h: 2, hp: 900,  cost: 1200, time: 10, power: -30, sight: 6, freeUnit: 'harvester', req: ['power'] },
  barracks: { name: 'Barracks',          w: 2, h: 2, hp: 700,  cost: 300,  time: 6,  power: -20, sight: 5, builds: 'infantry', req: ['power'] },
  factory:  { name: 'War Factory',       w: 3, h: 3, hp: 1100, cost: 1500, time: 12, power: -30, sight: 5, builds: 'vehicle', req: ['refinery'] },
  radar:    { name: 'Comm Center',       w: 2, h: 2, hp: 800,  cost: 1000, time: 10, power: -40, sight: 10, req: ['refinery'], radar: true },
  airfield: { name: 'Airfield',          w: 3, h: 2, hp: 900,  cost: 1600, time: 12, power: -40, sight: 6, builds: 'aircraft', req: ['factory'] },
  // v9 defenses (Defense tab): Tiberium cannon turret, auto-connecting walls, gates that open for friendlies
  turret:   { name: 'Tiberium Cannon',   w: 1, h: 1, hp: 650,  cost: 600,  time: 6,  power: -15, sight: 7, req: ['barracks'], def: true,
              weapon: { range: 6, damage: 34, cooldown: 1.0, air: false, color: '#9f4', bolt: true } },
  wall:     { name: 'Wall',              w: 1, h: 1, hp: 450,  cost: 50,   time: 0,  power: 0,   sight: 1, def: true, wall: true, instant: true },
  gate:     { name: 'Gate',              w: 1, h: 1, hp: 800,  cost: 150,  time: 0,  power: 0,   sight: 2, def: true, gate: true, instant: true, req: ['barracks'] },
  ion:      { name: 'Ion Uplink',        w: 2, h: 2, hp: 1000, cost: 2800, time: 20, power: -100, sight: 6, req: ['radar', 'factory'],
              superweapon: { chargeTime: 180, radius: 3, damage: 700 } },
};

export const UNITS = {
  harvester: { name: 'Harvester', from: 'vehicle', hp: 600, cost: 1400, time: 12, speed: 55, radius: 12, sight: 4, capacity: 700, harvestRate: 100 },
  // v9 infantry: four types, each with a StarCraft-style ability (see Unit.useAbility)
  infantry:  { name: 'Rifleman', from: 'infantry', inf: true, hp: 80, cost: 100, time: 3, speed: 52, radius: 5, sight: 5, ability: 'stim',
               weapon: { range: 4, damage: 8, cooldown: 0.6, air: true, color: '#ff9' } },
  sniper:    { name: 'Sniper', from: 'infantry', inf: true, hp: 55, cost: 300, time: 6, speed: 38, radius: 5, sight: 9, ability: 'cloak', req: ['refinery'],
               weapon: { range: 8.5, damage: 55, cooldown: 2.6, air: false, color: '#fff', vsInf: 2.2, vsOther: 0.45 } },
  rocket:    { name: 'Rocket Trooper', from: 'infantry', inf: true, hp: 110, cost: 300, time: 6, speed: 32, radius: 6, sight: 6, ability: 'digin',
               weapon: { range: 5.5, damage: 38, cooldown: 1.8, air: true, color: '#fa6', vsVeh: 1.8, vsInf: 0.4, rocket: true } },
  engineer:  { name: 'Engineer', from: 'infantry', inf: true, hp: 70, cost: 400, time: 6, speed: 45, radius: 5, sight: 5, ability: 'engineer', repair: 30, req: ['refinery'] },
  tank:      { name: 'Light Tank', from: 'vehicle', hp: 380, cost: 700, time: 8, speed: 70, radius: 11, sight: 6,
               weapon: { range: 5, damage: 35, cooldown: 1.2, air: false, color: '#fd6' } },
  carrier:   { name: 'Carrier', from: 'aircraft', hp: 1400, cost: 2500, time: 20, speed: 30, radius: 22, sight: 9, air: true,
               interceptors: 6, launchRange: 8, rebuildTime: 5, leashRange: 11 },
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
