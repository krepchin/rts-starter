# Online multiplayer (2 players), preview v10.2

## How to play
1. Both players open the game and **pick a faction** on the launch screen.
2. Player 1 taps **Play Online**, then **Create room**. A 5-letter code shows up (e.g. `K7QPM`).
3. Player 2 taps **Play Online**, types the code, and taps **Join**.
4. The match starts on both screens. Player 1 is in the top-left base and player 2 in the bottom-right. The badge in the corner shows the turn and ping.

## Architecture
- **No build step, no game server.** `src/net/lockstep.js` loads PeerJS 1.5.4 from jsDelivr only when you tap Create or Join.
- **Signaling:** the free public PeerJS broker (`0.peerjs.com`) only introduces the two browsers. The host registers the peer id `tibsk-<CODE>`, and the guest connects to that id, sending its faction as connection metadata.
- **Transport:** the game data goes over a WebRTC DataConnection (reliable, ordered, raw JSON strings), straight from one browser to the other. The STUN servers are Google and Cloudflare. There's no TURN server, so two very strict NATs (some mobile carriers or corporate networks) may fail to connect. Try Wi-Fi.
- **Sync: deterministic lockstep.** Every state-changing UI call (`command`, `useAbility`, `castAt`, `unloadAt`, building and production calls on `Game`) is captured instead of applied. It's sent as turn *n + 2* (one turn = 3 ticks at 30 Hz = 100 ms), and both peers run the same commands at the same turn, host first. During a turn, `Math.random` is swapped for a shared seeded mulberry32 PRNG, and the simulation runs on fixed 1/30 s ticks.
- **Desync detection:** every 10 turns each peer sends an FNV hash of the unit and building state. If they differ, the badge shows `DESYNC at turn N`.
- **Start:** when the connection opens, the host sends `{k:'start', seed, factions:[host, guest], grace}`, and both call `game.reset({factions, me, mp:true})`.
- **Disconnects:**
  - In the lobby, the status line says why (room not found, room full, connection lost), and the buttons re-enable.
  - Mid-match, the remaining player keeps playing: lockstep stops, the built-in AI takes over the missing side, and the badge reads "Opponent left · AI took over".
  - A third player trying to join a room gets "That room is already full."

## Files
- `src/net/lockstep.js`: PeerJS rooms (`hostRoom`, `joinRoom`, `leave`), command capture, turns, hashes. The old copy/paste SDP path (`host`, `join`, `accept`) still works.
- `src/main.js`: lobby wiring, `beginMP`, AI takeover.
- `tests/mp_peerjs.py`: two Playwright browsers (desktop host, phone guest) connect through the real broker, each move a unit, and check both see the same positions and no desync. Then the guest closes, and the host must carry on with the AI.

## Known limits
- 1v1 only. Spectators and reconnecting to a running match aren't supported yet.
- Headless Playwright WebKit on Linux never finishes ICE (an environment limit). Real Safari and iOS use the same supported PeerJS path, but that still needs checking on a real device.
