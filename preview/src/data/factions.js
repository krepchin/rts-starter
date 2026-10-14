// v10 factions. Team 0 is the player, team 1 the AI (or the remote player in multiplayer). Each faction has its own producers,
// structures and roster; `roles` lets shared code (AI, sidebar) talk about "the yard", "the refinery" etc. regardless of faction.
export const FACTIONS = {
  human: { name: 'Humans', producer: { building: 'cy', infantry: 'barracks', vehicle: 'factory', aircraft: 'airfield' },
    roles: { yard: 'cy', power: 'power', refinery: 'refinery', infantry: 'barracks', vehicle: 'factory', radar: 'radar', air: 'airfield', def: 'turret', harvester: 'harvester' },
    start: { yard: 'cy', units: ['tank', 'infantry', 'infantry'] } },
  reptile: { name: 'Reptilians', producer: { building: 'hive', infantry: 'spawnpool', vehicle: 'dronenest', aircraft: 'broodspire' },
    roles: { yard: 'hive', power: 'heart', refinery: 'digester', infantry: 'spawnpool', vehicle: 'dronenest', radar: 'seer', air: 'broodspire', def: 'spine', harvester: 'grazer' },
    start: { yard: 'hive', units: ['spark', 'raider', 'raider'] } },
  nordic: { name: 'Nordics', producer: { building: 'sanctum', infantry: 'temple', vehicle: 'forge', aircraft: 'skygate' },
    roles: { yard: 'sanctum', power: 'lightwell', refinery: 'resonator', infantry: 'temple', vehicle: 'forge', radar: 'oracle', air: 'skygate', def: 'sunlance', harvester: 'harmonizer' },
    start: { yard: 'sanctum', units: ['skiff', 'sentinel', 'sentinel'] } },
  grey: { name: 'Greys', producer: { building: 'nexus', infantry: 'vat', vehicle: 'assembly', aircraft: 'hangar' },
    roles: { yard: 'nexus', power: 'reactor', refinery: 'extractor', infantry: 'vat', vehicle: 'assembly', radar: 'beacon', air: 'hangar', def: 'psitower', harvester: 'reaper' },
    start: { yard: 'nexus', units: ['crawler', 'greydrone', 'greydrone', 'greydrone', 'greydrone'] } },
};
export const FACTION_KEYS = ['human', 'reptile', 'nordic', 'grey'];
export const factionOf = s => s?.faction || 'human';
