# Assets
Approved isometric artwork, cut out to transparent PNGs (1x + @2x for high-DPI):
- cy.png: Construction Yard (enemy uses a red-tinted copy at runtime)
- tank_hover / tank_heavy / tank_laser: cosmetic Light Tank variants (cycled per unit)
- carrier.png: Carrier; icp_drone (main), icp_jet, icp_vtol: cosmetic Interceptor variants
- harvester.png: tracked grinder Harvester (green bar under it = hopper fill)
Loaded by src/engine/sprites.js; if an image fails the procedural art is used.
- b_power, b_refinery, b_barracks, b_factory, b_airfield, b_radar, b_turret, b_ion: v4 building art (light animated overlays on radar/turret/ion/factory/power; dimmed when unpowered)
