// All tunable game data lives here. Sizes in tiles; speeds in px/sec; times in seconds.
export const TILE = 32;
export const TEAM_COLORS = { 0: '#3fa9ff', 1: '#ff4a3a' };

export const BUILDINGS = {
  cy:       { name: 'Construction Yard', w: 3, h: 3, hp: 1500, cost: 0,    time: 0,  power: 10,  sight: 8, builds: 'building' },
  power:    { name: 'Power Plant',       w: 2, h: 2, hp: 600,  cost: 300,  time: 6,  power: 100, sight: 5 },
  refinery: { name: 'Refinery',          w: 3, h: 2, hp: 900,  cost: 1200, time: 10, power: -30, sight: 6, freeUnit: 'harvester', req: ['power'] },
  barracks: { name: 'Barracks',          w: 2, h: 2, hp: 700,  cost: 300,  time: 6,  power: -20, sight: 5, builds: 'infantry', req: ['power'] },
  factory:  { name: 'War Factory',       w: 3, h: 3, hp: 1100, cost: 1500, time: 12, power: -30, sight: 5, builds: 'vehicle', req: ['refinery'] },
  airfield: { name: 'Airfield',          w: 3, h: 2, hp: 900,  cost: 1600, time: 12, power: -40, sight: 6, builds: 'aircraft', req: ['factory'] },
  turret:   { name: 'Pulse Turret',      w: 1, h: 1, hp: 500,  cost: 600,  time: 6,  power: -15, sight: 7, req: ['barracks'],
              weapon: { range: 6, damage: 30, cooldown: 0.9, air: true, color: '#9ff' } },
};

export const UNITS = {
  harvester: { name: 'Harvester', from: 'vehicle', hp: 600, cost: 1400, time: 12, speed: 55, radius: 12, sight: 4, capacity: 700, harvestRate: 100 },
  infantry:  { name: 'Rifle Trooper', from: 'infantry', hp: 80, cost: 100, time: 3, speed: 45, radius: 5, sight: 5,
               weapon: { range: 4, damage: 8, cooldown: 0.6, air: true, color: '#ff9' } },
  tank:      { name: 'Light Tank', from: 'vehicle', hp: 380, cost: 700, time: 8, speed: 70, radius: 11, sight: 6,
               weapon: { range: 5, damage: 35, cooldown: 1.2, air: false, color: '#fd6' } },
  carrier:   { name: 'Carrier', from: 'aircraft', hp: 1400, cost: 2500, time: 20, speed: 30, radius: 22, sight: 9, air: true,
               interceptors: 6, launchRange: 8, rebuildTime: 5, leashRange: 11 },
  interceptor: { name: 'Interceptor', hp: 40, speed: 160, radius: 4, sight: 4, air: true, buildable: false,
               weapon: { range: 2.2, damage: 6, cooldown: 0.35, air: true, color: '#aff' } },
};

export const ECONOMY = { startCredits: 3000, tiberiumPerTile: 500, regrowPerSec: 4, spreadChance: 0.002 };
