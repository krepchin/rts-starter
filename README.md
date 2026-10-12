# Tiberium Skirmish — RTS Starter

Top-down futuristic RTS skirmish (you vs. a simple AI), inspired by Command & Conquer, with a StarCraft-style Carrier.
Plain HTML5 Canvas + ES modules. No build step, no dependencies.

**Run:** `python3 -m http.server 8000` in this folder, then open http://localhost:8000

## Gameplay
Harvest Tiberium → credits, build a base, train units, destroy every enemy building to win (lose if you lose all of yours).
Tiberium fields regrow slowly. Low power (used > produced) halves production speed.

## Controls
- Mouse: left-click select, drag box-select (Shift adds), right-click move / attack / harvest (on Tiberium) / set rally (building selected)
- Pan: WASD / arrows / screen edge / click-drag on minimap. Esc cancels placement.
- Touch: tap to select, tap ground/enemy to command selection, one-finger drag = box select, two-finger drag = pan, long-press = deselect.
- Sidebar: click to build (cost paid up front), right-click to cancel. When a building is finished its button turns green: click it, then click the map to place (must be near your base, not on Tiberium).

## Structure
```
src/main.js            wiring + resize handling
src/engine/            game.js (state, production, win/lose), loop.js, camera.js, input.js, renderer.js
src/world/             map.js (tiles, Tiberium + regrowth), fog.js
src/entities/          entity.js, unit.js (Unit, Harvester), building.js, carrier.js (Carrier, Interceptor)
src/data/stats.js      all unit/building/economy numbers
src/ai/enemyAI.js      build order, harvester upkeep, production, attack waves, base defense
src/ui/                selection.js (player commands), sidebar.js, minimap.js
assets/                placeholder (art comes later)
```
Add a unit: add a row in `src/data/stats.js` (`from:` = producer category) and a shape in `renderer.drawUnit`.

## Known gaps / next steps
No pathfinding (straight-line moves + simple avoidance), no sound, no save, no building sell/repair, single fixed map,
AI can stall if it loses all income, no unit veterancy/upgrades, no projectile travel (hitscan tracers).
