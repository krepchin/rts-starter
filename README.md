# Tiberium Skirmish — RTS Starter (v9)

Top-down futuristic RTS skirmish (you vs. AI), inspired by Command & Conquer, with a StarCraft-style Carrier.
Plain HTML5 Canvas + ES modules. No build step, no dependencies. Art is a mix of image sprites in `assets/` (buildings, tanks, harvester, air units, soldiers) with procedural canvas drawing as the fallback, plus code-drawn art (terrain, effects, and the v8 Mobile Yard / Base Walker).

**Play:** https://krepchin.github.io/rts-starter/ · **Run locally:** `python3 -m http.server 8000` here, open http://localhost:8000

## What's new in v9 (painted style, infantry, defenses)
- **Painted look** matching Kent's painted preview: sandy desert terrain with dirt texture and ridges, glowing green tiberium clusters, gritty gray/olive
  units and buildings with soft shadows (colour graded at load), thin yellow-green selection ellipses, green-on-black health bars.
- **Base Walker** is drawn from layers cut out of the painted robot (`assets/pw_*.png`): carried towers/arms only show if that building is carried.
  Smoother gait (legs swing and plant), bob and sway tied to steps, eased turning, acceleration/braking, footfall thuds, dust and slight screen shake.
  The code-drawn walker is still there as a fallback.
- **Staged transform (~4 s):** warning lights, buildings lift on hydraulic jacks with steam, then fold one by one (barracks → arm, factory → cannon,
  power towers → back, yard → body) and swing in on arcs with overshoot, sparks and clanks; legs unfold, final stomp and dust ring.
  Deploy plays it in reverse. Pack-alone crawler gets a shorter version.
- **Gunmetal sidebar:** dark top display (credits, power, minimap), four icon tabs (Base / Vehicles / Infantry / Defenses), a 3x3 grid of recessed
  build slots with icons, an info panel with action buttons, and a bottom strip with a radar sweep, Sound / Find / Pause / Cancel buttons and a power dial.
- **Four infantry types** (Barracks): Rifleman (Stim), Sniper (long range, strong vs infantry, Cloak; needs Refinery), Rocket Trooper (anti-vehicle
  and anti-air, Dig in), Engineer (no gun; repairs nearby, Capture or Demo charge on enemy buildings; needs Refinery). The AI builds a mix and uses abilities.
- **Defenses tab:** Walls ($50 per tile; tap or drag a line; auto-connect; damage states; block movement), Gates (placed next to a wall; open for your
  units, closed to enemies, Lock toggle), Tiberium Cannon turret (needs power, twin barrels, green bolts, ground only). The AI builds a short wall
  with a gate plus turrets. The walker's sprayer melts walls fast.
- **Music:** a new sectioned industrial/electronic loop (intro, groove, stabs, breakdown) mixed under the SFX, plus new SFX for every ability,
  weapon, wall and transform step. Still all synthesized with WebAudio (no files); the Sound button and saved setting still control it.
- Tests: `tests/v9_features.py` (infantry, abilities, walls/gates/turret, AI, sidebar UI) on Chromium, Firefox and WebKit, desktop and phone.
- Credits: art is derived from Kent's concept and preview images; all audio is synthesized in code.

## What's new in v8.1
- **Base Walker and Mobile Yard art from the approved sketch.** Pencil-and-ink sprites cut from `mcv-robot-ingame-preview-v2.jpg` (`assets/mw_*.png`, 1x + @2x): the walker is layered (cooling towers, two legs, body) so legs lift alternately, the body bobs and stomps, and the towers only show when a power plant is carried. The crawler is the yard on hand-drawn tracks. Code-drawn art remains as the fallback. Packing slide, unfold, spray, burrow and eruption animations are unchanged.
- **Sound** (all synthesized with WebAudio: no audio files, works in Safari/WebKit): a looping background track plus effects for select, move, attack, queue, build/place, transform, deploy and burrow eruption. Audio starts only after the first tap/click/key (mobile autoplay rules). **Sound** button in the sidebar cycles off / low / med / high and is remembered in `localStorage`.
- Phone: the walker's action buttons use two columns with short labels (no more "Depl…").
- Version label on the start menu; tab title shows v8.1.
- Credits: sound is original synthesized code in `src/engine/audio.js` (no third-party assets). Walker/crawler art is derived from the project's own approved concept images.

## What's new in v8: mobile command centre
Select your **Construction Yard** to get two new move modes (sidebar buttons, mouse or touch):
- **Pack**: the yard folds alone into a slow armored crawler (Mobile Yard). Move it anywhere, then **Deploy**.
- **Transform**: the yard plus the nearest barracks, one power plant and the war factory (within 10 tiles) slide together into the **Base Walker** robot from the concept art (`mcv-robot-concept.jpg`): command-centre torso with crane, barracks arm, war-factory cannon arm, cooling towers on its back. It carries whatever of those exists.
- **Deploy** shows a placement preview of the full footprint (yard, barracks left, factory right, power behind; green/red per tile). Buildings unfold at the new spot with HP kept proportionally to the walker's HP.
- **Weapon toggle** (Base Walker, switchable mid-battle):
  - **Tiberium sprayer**: short-range shoulder cone (3.5 tiles) that melts structures fast (300/s), moderate vs units (45/s).
  - **Drill arms**: close-range drilling, and **Burrow**: dig underground (untargetable, immune to Ion), tunnel to a chosen spot and erupt (220 damage in a 2.6-tile radius). 30 s cooldown.
- **Trade-offs**: while packing, packed or walking there is no building or production, and carried power plants are offline. Carried bases are armored (take 60% damage) but can be destroyed. Pack takes 2.5 s, transform 4 s, deploy 2.5 s / 4 s. The build radius now follows the deployed yard (within 12 tiles of a yard).
- **AI**: when its yard is under siege (below 45% HP with an attacker close), the AI transforms its base, walks away from the attacker, burrows out if the walker gets badly hurt, and redeploys at the nearest valid spot.
- Looks: buildings slide together and glow, the walker assembles and stomps with dust, spray particles and melting fumes, burrow dirt and tunnel mound, eruption burst, reverse unfold.
- Tests: `tests/v8_mobile_base.py` (Chromium, Firefox, WebKit; desktop and phone touch viewports).

## What's new in v7 (bug fix: "units flew off the screen")
- **Root cause:** Interceptors returning to re-dock crowded around their Carrier, and unit separation pushed the Carrier away from them.
  The wing kept chasing it at 160 px/s and kept shoving, so the Carrier was pushed across the map. Its update had no map clamp, so it left the map entirely.
  In a scripted test, a Carrier and its interceptors ended up about 800 tiles outside the 88-tile map.
- **Fixed:** interceptors no longer take part in separation, and every unit class is clamped to the map in `Game.update`. That also catches any non-finite (NaN) positions.
- **Leash:** idle and attack-move units only pursue enemies within 1.5× their sight radius of their guard spot, then walk back to it.
  Previously they chased fleeing enemies indefinitely, for example 19 tiles in the repro (`tests/drift_repro.mjs`); now it's 4 tiles at most.
  Explicit attack orders still pursue. Attack-move waves still advance.
- **Finding your units:**
  - The **◎ Find my units** button under the minimap, Space, or F centres the camera on your selection.
  - With nothing selected, repeated presses cycle between the whole army and each unit.
  - Double-click or double-tap a unit to centre on it.
  - The minimap shows your units as bright outlined dots, and selected units blink white even when the radar is offline.
- **Robustness:** the game loop survives a drawing error (it logs it once) rather than freezing.

## What's new in v6
- **Soldiers look like people:** Rifle Troopers (and the survivors that walk out when you sell a building) use the rifleman artwork at about 24px tall.
  Their feet sit on the ground point, and each has a contact shadow and a team ring. Enemies are red-tinted.
  They flip to face their direction of travel, bob as they walk, and show a muzzle flash when firing. If the image fails to load, a drawn figure is used instead.
- **More stable sidebar:**
  - Fixed sizes for tabs, buttons, the status line, the selection info and the action buttons, so changing text, badges or progress never shifts the layout.
  - The DOM is only updated when a value actually changes, rather than every frame.
  - Long-press to cancel no longer double-fires with the browser context menu.
  - The "Radar offline" static on the minimap refreshes about 6× per second rather than every frame.
  - Hover highlights only apply on devices with a mouse.
  - `tests/sidebar_probe.py` measures DOM churn and layout stability.

## What's new in v5
- **Start menu** with **"No attacks for the first 10 minutes"** (default ON, `?grace=0|1` URL override, `?autostart=1` skips the menu).
  The ceasefire applies equally to both sides: no damage, no auto-targeting or attack orders, the AI sends no waves, nobody can fire the Ion.
  Building, harvesting and production continue. An on-screen countdown shows the time left.
- **Bigger map:** 88×88 (was 64×64). Bases are in opposite corners, and the Tiberium fields are mirrored through the centre so both sides get the same economy.
- **Richer terrain:** procedural dirt, grass and rock with noise, elevation shading, soil patches, rock outcrops, cracks and pebbles, plus crystal-stained ground around Tiberium fields.
  It's pre-rendered lazily into 512px offscreen chunks for phone performance.
- **Grounded units:** ground-unit sprites sit on their ground point with tight contact shadows. Air units hover with an offset shadow, and building slabs sit on their footprint.
- **AI:** it now searches for building spots around its Construction Yard's centre, so the bottom-right corner no longer runs into the map edge.

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
