# Tiberium Skirmish — RTS Starter (v4)

Top-down futuristic RTS skirmish (you vs. AI), inspired by Command & Conquer, with a StarCraft-style Carrier.
Plain HTML5 Canvas + ES modules. No build step, no dependencies, no image assets (all art is procedural canvas drawing).

**Play:** https://krepchin.github.io/rts-starter/ · **Run locally:** `python3 -m http.server 8000` here, open http://localhost:8000

## What's new in v4 (visual only)
All structures now use isometric artwork matching the Construction Yard (steel-blue panels, cyan lights, hazard stripes, concrete slabs),
enemy copies red-tinted, sprites dimmed when unpowered, with small animated overlays (radar sweep glint, turret muzzle flash, Ion charge glow,
War Factory busy lights, power core pulse). Procedural art remains as fallback. Gameplay unchanged.

## What's new in v3 (visual only)
Approved isometric artwork for the Construction Yard (both factions, enemy red-tinted) and three cosmetic Light Tank variants
(hover/railgun, heavy twin-cannon, six-wheeled laser; cycled per unit, flipped by heading, team-color ring + tint), plus the Carrier and its Interceptors (strike drone main look, jet + VTOL gunship mixed in) with hover bob and soft ground shadows, and the tracked grinder Harvester (hopper-fill bar).
Sprites live in `assets/` (1x + @2x), preload via `src/engine/sprites.js`, and fall back to procedural art if they fail. Gameplay unchanged.

## What's new in v2
**Buildings look like C&C structures.** They're drawn as chunky 2.5D blocks on the tile grid. Each has its own silhouette and animated details:
- **Construction Yard:** a crane that swings while it's building.
- **Power Plant:** cooling towers with pulsing cores and steam.
- **Refinery:** a harvester dock pad, a spinning centrifuge, and a Tiberium silo whose level gauge animates.
- **Barracks:** a quonset hut or tent, with a waving flag and an antenna.
- **War Factory:** a garage door that opens while it's producing, roof fans, and a smoking stack.
- **Airfield:** a runway with chasing lights and a control tower.
- **Comm Center:** a rotating radar dish.
- **Pulse Turret:** a head that tracks its target, with a muzzle flash.
- **Ion Uplink:** charge rings that light up as it charges.

Buildings rise into place when you put them down. Damaged buildings burn and smoke, and powerless ones dim or show OFFLINE.
Each faction has its own style. You're clean blue/steel tech with soft edges. The enemy is red/rust, angular and chamfered, with roof fins and hazard stripes.

**C&C-style building rules**
- **Construction Yard:** you need one to build structures. Losing it stops construction, and you can't place anything that's waiting.
- **Build queues:** structures, infantry, vehicles and aircraft each have their own queue. Unit queues hold up to 5 items, shown as count badges on the tabs and buttons.
  - **Paying:** credits drain as an item builds, and it goes on hold when you run out.
  - **Pause/Resume and Cancel:** buttons for the current tab. Right-click or long-press an item to cancel one. Cancelling refunds what you've paid so far.
- **Place-when-ready:** a finished structure waits as READY. Click it, then click the map. Only one structure builds at a time.
- **Power:**
  - **Power bar:** shows power made against power used, and blinks red when you're short.
  - **Low power:** production slows down (in proportion to the shortfall), turrets go offline, the Comm Center goes offline, and the Ion Uplink stops charging.
- **Production buildings:** each makes its own unit type. Selecting one and tapping or right-clicking the map sets a rally point. Every extra building of the same type adds +50% speed.
- **Comm Center (radar):** the minimap only works while you have a powered Comm Center. Otherwise it shows static and "RADAR OFFLINE", though you can still tap or drag it to move the camera.
- **Repair and Sell:** these are buttons when a structure is selected. Repair heals over time and drains credits. Sell needs a second tap to confirm. It refunds 50% of the cost scaled by current HP, and a few survivors walk out.
- **Ion Uplink (superweapon):** charges for 180 seconds while powered, then "Fire Ion" lets you tap a target. It hits a 3-tile radius for 700 damage and affects everyone, including your own units.

**AI:** it plays by the same rules: build order, fixing power shortages, repairing, firing the Ion at the densest group of enemy structures, and attack waves that escalate over time.

## Controls
- **Mouse:**
  - Left-click selects, and dragging box-selects (Shift adds to the selection).
  - Right-click moves, attacks, harvests (on Tiberium) or sets a rally point (when a building is selected). It also cancels placement or targeting.
- **Pan:** WASD, the arrow keys, the screen edges, or the minimap. Esc cancels.
- **Touch:**
  - Tap selects, and tapping the ground or an enemy commands your selection.
  - One-finger drag box-selects, and two-finger drag pans.
  - Long-press the map to deselect. Long-press a build button to cancel one item.

## Structure
```
src/main.js              wiring + resize handling
src/engine/game.js       state, production queues, power, repair/sell, superweapon, win/lose
src/engine/buildingArt.js  procedural 2.5D building art + faction palettes
src/engine/renderer.js   map, units, effects, placement ghost, ion targeting
src/engine/              loop.js, camera.js, input.js
src/world/               map.js (tiles, Tiberium + regrowth), fog.js
src/entities/            entity.js, unit.js, building.js, carrier.js
src/data/stats.js        all unit/building/economy numbers (queue size, factory bonus, repair/sell rates, ion)
src/ai/enemyAI.js        AI opponent (also used for AI-vs-AI tests)
src/ui/                  selection.js, sidebar.js, minimap.js
tests/playwright_checks.py  headless checks (desktop + iPhone emulation)
```
**Adding things:**
- **A building:** add a row in `stats.js` and an `ART.<type>` function in `buildingArt.js`.
- **A unit:** add a row in `stats.js` (`from:` is the producer category) and a shape in `renderer.drawUnit`.

## Testing
Serve the folder, then run `python tests/playwright_checks.py http://localhost:8000/`. This needs Python Playwright and Chrome.

It runs a scripted UI flow (queue, place, badge, pause), then checks these rules:
- Construction Yard requirement
- queue, pause and cancel refunds
- production and rally points
- low-power effects
- repair and sell
- production bonus from multiple factories
- construction stopping when the Construction Yard is lost
- Ion firing and cooldown

It finishes with an AI-vs-AI match that runs until there's a winner.

## Known gaps / next steps
- **Movement:** no pathfinding (straight-line moves with simple avoidance) and no projectile travel (shots hit instantly, shown as tracers).
- **Missing features:** no sound, no save, a single fixed map, and no veterancy or upgrades.
- **Buildings:** there's no "primary building" toggle (production rotates between buildings of the same type), and sold buildings always drop the same survivors.
- **Balance and AI:** balance is rough, and AI-vs-AI games usually finish in about 5–6 minutes. The AI has no Ion targeting priorities beyond picking clusters.
