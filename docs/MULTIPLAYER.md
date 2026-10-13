# Multiplayer: deterministic lockstep over WebRTC (v10 prototype)

## What works today (honest status)
- **1v1 over the internet or LAN, no server:** *Start menu → Multiplayer 1v1 (beta)*. The host taps **Host game** and sends the code
  (about 0.9 KB of text) to the opponent by any chat. The guest taps **Join game**, pastes it, and sends back their answer code. The host
  pastes that and taps **Connect**. Each side picks a faction on the menu first (the host is player 1 / top-left, the guest is player 2 / bottom-right).
- **Lockstep:** both browsers run the same simulation. A badge in the corner shows the player, turn, ping and "waiting…" when a peer lags.
- **Desync checks:** a state checksum is exchanged every 10 turns (1 s). A mismatch shows **DESYNC at turn N** and the game halts.
- **Tested:** automated Playwright tests on one machine (`tests/v10_multiplayer.py`): Chromium↔Chromium, Firefox↔Firefox, WebKit↔WebKit
  and Chromium↔Firefox, each with a desktop host and a phone-sized touch guest (results are in the release notes).

## Known limits
- **NAT:** only public STUN servers are configured (Google, Cloudflare). There is no TURN relay, so roughly 10–20% of real-world network
  pairs (symmetric NAT, some carrier networks) will not connect.
- **Cross-engine floats:** cross-engine games (e.g. Chrome vs Safari) can desync if `Math.sin`/`atan2`/`hypot` return different last-bit
  results. Same-engine games are the safe case. The checksum catches a desync, but the game cannot recover from one.
- **No reconnect, pause, save, rejoin or spectators.** A disconnect ends the match.
- **Commands are captured from the UI-reachable methods:**
  - unit/building: `command`, `useAbility`, `castAt`, `unloadAt`, `loadNearby`, `toggleMode`, `setCloak`, `layEgg`, `toggleLock`;
  - game: `enqueue`, `cancel`, `togglePause`, `placeBuilding`, `placeInstant`, `fireSuper`, `toggleRepair`, `sell`, `packYard`, `transformBase`.
  
  Any future UI code that writes simulation state directly, instead of calling one of these methods, would cause a desync.
  The checksum would catch it.
- **Input delay:** 2 turns = 200 ms (plus half the ping) before an order takes effect. Lockstep needs this; it is noticeable.
- **No lobby server or matchmaking.** Signaling is copy/paste only.

## Architecture
```
 UI (input, sidebar, selection) ──calls──> wrapped sim methods ──(MP: capture, return true)──> local command list
                                                                                   │ every turn n: send {turn n+2, cmds}
 peer A  <──────────────────── RTCDataChannel 'lockstep' (ordered, reliable) ─────────────────────>  peer B
 turn n executes only when both peers' command lists for n are present:
   Math.random := shared mulberry32(seed) ; apply host cmds, then guest cmds ; 3 × game.update(1/30) ; restore Math.random
   sounds raised during the turn are queued and played afterwards (audio never touches the shared RNG)
```
- **Turn:** 3 ticks of 1/30 s = 100 ms. Commands are scheduled `DELAY = 2` turns ahead. Turns 0–1 are pre-filled as empty.
- **Determinism:**
  - `Game.reset()` rebuilds the match in place with the same seed on both sides and resets entity ids.
  - The simulation reads no wall-clock time.
  - View-only state (fog, camera shake, sound gating) uses `game.me`. Simulation logic never does.
  - Particle density (`lowFx`) is agreed at start: if either side is a phone, both use the light mode.
- **Commands** are serialized method calls: `{e: entityId | g: 1, m: method, a: args}`. Entity references in arguments become `{$e: id}`.
  The receiver resolves ids and rejects commands for entities (or team arguments) that don't belong to the sender.
- **Checksum:** FNV-1a over unit/building ids, positions (×4, rounded), HP and credits, every 10 turns.

## Signaling options
1. **Copy/paste (implemented):** non-trickle ICE, so the whole SDP and its candidates sit in one base64 code. Free and serverless, but clunky.
2. **Free hosted signaling (next step):**
   - a Cloudflare Worker + Durable Object or a free Firebase Realtime Database room keyed by a 6-letter code, relaying offer/answer only;
   - game traffic stays peer-to-peer;
   - this enables short "host/join codes" like `KX7Q2M`.
3. **TURN (for reliability):** a Cloudflare Calls or metered.ca TURN credential (paid beyond the free tier) to reach the ~15% of peers that can't connect directly.

## Next steps
- Short room codes via (2). Reconnect by snapshot plus command replay.
- Fixed-point math for unit movement, to make cross-engine games safe.
- An adaptive input delay from the measured RTT. Chat and a "ready" check in the lobby.
