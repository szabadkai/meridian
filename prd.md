Product Requirements Document (PRD) — Space Exploration Web Demo (v0.1)

Owner: Levi (Engineering Manager)
Date: 2025-11-02
Goal: Ship a playable web demo showcasing three core loops/screens:

1. Space Map (overworld)
2. Planet Exploration (top-down party movement)
3. Tactical Battle (turn-based encounter)
   Scope is vertical-slice quality: basic systems, core UX, placeholder art, and save-less session.

1) Objectives and Success Criteria

- Prove core gameplay loop feels cohesive end-to-end in browser.
- Session length: 8–12 minutes to complete one loop (space -> planet -> battle -> outcome).
- Performance: 60 FPS target on desktop Chrome/Firefox/Edge; acceptable 30+ on mid-range laptops.
- Input: Keyboard + mouse; optional gamepad deferred.
- Success metrics (playtest):
    - > 70% of new players complete the loop without guidance beyond in-game prompts.
    - Reported comprehension of controls ≥4/5.
    - No crash/soft-locks in 20 playthroughs.

2. Platforms and Tech

- Web: Desktop browsers (Chrome, Firefox, Edge, Safari latest).
- Engine: HTML5 canvas/WebGL via Phaser 3 or Godot Web export or custom TS + PixiJS. Pick one; recommendation: Phaser 3 + TypeScript for speed.
- Language/Build: TypeScript, Vite build, ESLint + Prettier, unit tests via Vitest.
- Resolution: 1280x720 base, responsive letterbox.
- Assets: Placeholder pixel art per mockups; royalty-free SFX/music.

3. Core Loop Overview

- Start at Space Map with one controllable ship.
- Discover a nearby planet and an enemy patrol.
- Player can enter orbit and land. Landing triggers Planet Exploration.
- Explore small map, collect 1 resource, encounter enemy squad.
- Enter Tactical Battle. Win returns to planet summary -> back to space with a reward; loss shows defeat screen with retry to Space Map start.

4. Feature Requirements by Screen

A) Space Map (Overworld)

- Camera and Grid:
    - Infinite-feel starfield with parallax; actual bounded box for demo: 200x200 grid units.
    - Fog-of-war: undiscovered tiles dimmed; reveal in a 10-tile radius around ship.
- Player Ship:
    - Movement: WASD for thrust-like cardinal movement; mouse to set heading optional; simple slide with friction (arcade).
    - HUD: Hull (HP), Fuel, Mini-map, Interaction prompts.
- Entities:
    - Planets: At least 2. One designated “Demo Planet” with landing allowed. Hover tooltip shows name and biome icon.
    - Enemy Ships: 2 patrols with simple seek AI (aggro radius 12 tiles). On contact, trigger battle OR disengage prompt.
    - Points of Interest: 1 derelict with a text pop-up reward (fuel or scrap).
- Interactions:
    - Land on planet: press E within 3 tiles of orbit marker.
    - Encounter enemy: proximity triggers modal: “Engage / Evade (fuel -5)”.
- Resources:
    - Fuel consumed per second while moving; minimum 0 (no death from fuel in demo, but movement halved at 0).
    - Scrap used later for repairs after battle (simple screen).
- UI:
    - Top-left: bars for Hull/Fuel.
    - Top-right: mini-map with discovered areas and icons.
    - Bottom-center: contextual prompt (“E: Land”, “R: Scan”).
- Audio:
    - Ambient space loop, UI bleeps, contact warning ping.

B) Planet Exploration (Top-Down Party)

- Scene and Movement:
    - Tile-based map 64x64 tiles; outdoor biome per mockup.
    - Party leader visible; 2 companions follow with simple “rope” formation.
    - Movement: WASD; Shift to sprint (stamina not required in demo).
- Interactables:
    - Resource node x1: yields “Minerals +10”.
    - Environmental blockers (rocks/trees) to shape path.
    - Landing zone to return to Space Map (prompt).
- Encounters:
    - One guaranteed enemy squad trigger area. On enter: transition to Tactical Battle.
- UI:
    - Small HUD: Party HP pips for 3 members; inventory readout: Minerals, Scrap.
    - Context prompt on interactables (E to collect).
- Audio:
    - Ambient wind/planet music; pickup SFX.

C) Tactical Battle (Turn-Based)

- Structure:
    - 6x8 grid battlefield.
    - Player squad: 3 units (Scout, Soldier, Tech).
    - Enemy squad: 3–5 units (Raiders/Alien melee/ranged).
- Turn System:
    - IGOUGO round order: all player units, then all enemies.
    - Actions per unit: Move up to N tiles, then one action (attack, ability, overwatch, defend). No action points beyond this.
- Stats and Combat:
    - Unit stats: HP, Move range, Attack, Damage roll, Accuracy.
    - Line-of-sight: blocked by obstacles.
    - Cover: Low/High improves hit chance; simplified to flat bonuses: +10% / +25%.
    - Hit formula: base accuracy + cover modifiers; damage is 1d4–1d8 depending on weapon.
- Abilities (one per class):
    - Scout: Dash (double move once per battle).
    - Soldier: Suppress (reduce target accuracy next enemy turn).
    - Tech: Repair (heal 2 HP, 2 uses).
- Victory/Defeat:
    - Win: Reward Minerals + Scrap, small repair screen (spend Scrap to restore hull/party HP), return to planet then space.
    - Lose: Defeat screen with “Retry from Space Map”.
- UI:
    - Hover tiles highlight move range, attack preview numbers (hit% and dmg range).
    - End Turn button; number keys 1–3 select units.
- Audio/FX:
    - Basic shot, hit, miss, death pop; small screen shake on hits.

5. Cross-Cutting Systems

- Save/Load: None in demo; session-only state held in memory.
- State Management: Finite state machine (Space -> Planet -> Battle -> (Win/Lose) -> Space).
- Transitions: 0.5–1.0s fade in/out; loading spinners if asset streaming needed.
- Tutorial Prompts:
    - Contextual first-time tooltips per screen (movement, interact, end turn).
- Accessibility:
    - Remappable keys (JSON config), colorblind-friendly team colors, adjustable SFX/music sliders.
- Error Handling:
    - Graceful fallback if WebGL unavailable: canvas mode with reduced effects.
    - Hard errors show modal with “Report issue” link (sends console blob optional/out-of-scope for demo).

6. Content and Balancing (Demo Defaults)

- Space Map:
    - Player ship: Hull 10, Fuel 100, Speed baseline, Scan radius 10.
    - Enemy patrols: Speed slightly slower than player; if engaged, launch battle vs 3 enemies.
- Planet:
    - Map size medium; one linear path to encounter, one optional resource branch.
- Battle:
    - Player units: HP 6/8/7 for Scout/Soldier/Tech.
    - Weapons: pistol 1d6 75% base, rifle 1d8 70%, SMG 1d4 85% (short range).
    - Enemies: HP 5–6; two melee (high move), one ranged.
    - Target average battle length: 4–6 rounds.

7. Non-Goals (v0.1)

- Story, quests, NPC dialogue, inventory management beyond counters.
- Multiple planets, star systems, trading, crafting, leveling.
- Multiplayer.
- Mobile support.
- Persistent saves.

8. UX Flows

- New Session:
    - Splash -> “Start Demo” -> Space Map with brief overlay tutorial.
- Land on Planet:
    - Approach planet -> E to Land -> short cutscene text -> Planet map.
- Encounter:
    - Trigger zone -> fade -> Tactical Battle.
- Post-Battle:
    - Win -> Rewards + Repair modal -> return to Planet -> E to Launch -> Space Map with updated resources.
    - Lose -> Defeat modal -> Retry (reset to initial Space Map state).

9. Art/Audio Direction (Placeholder)

- Pixel-art 16x16 tiles scaled 4–5x. Consistent palette.
- Distinct silhouettes/colors for player vs enemy units.
- SFX: free CC0 pack; music: one ambient space loop, one planet loop, one battle loop.

10. Engineering Tasks

- Project setup
    - Vite + TypeScript + Phaser 3
    - Lint/test tooling; CI build pipeline (GitHub Actions).
- Core framework
    - Scene manager and global game state service.
    - Input manager (keyboard/mouse), keybinding config.
    - UI system (Phaser DOM or in-canvas).
- Space Map
    - Tilemap + parallax starfield
    - Ship controller + physics
    - Fog-of-war + mini-map
    - Entities: planets, enemy AI, POI interactions
- Planet Exploration
    - Tilemap loader, collision
    - Party follow system
    - Interactables and encounter triggers
- Tactical Battle
    - Grid, pathfinding (A\*)
    - Turn manager and action system
    - Line-of-sight and cover checks
    - Combat calculator and log
    - Unit UI (HP bars, ability buttons, previews)
- Transitions and tutorial overlays
- Audio manager
- Performance passes; QA hooks (debug panel showing FPS, state, seeds)

11. Data Definitions (JSON)

- Entities:
    - Space: planets, patrols {id, pos, sprite, interactType, params}
    - Battle units {id, class, hp, move, weapon, abilities}
    - Weapons {name, dmgDice, baseAcc, range, sfx}
- Maps:
    - Space: seed + placed objects
    - Planet: tilemap + triggers

12. Telemetry (optional for demo)

- Basic events to console: start, land, battle_start, battle_end, win/lose, time_in_scene.

13. Testing Plan

- Unit tests: combat math, pathfinding boundaries, LOS.
- Integration: scene transitions, encounter triggers, resource updates.
- Playtest checklist: complete loop on Chrome/Firefox/Edge; low-end laptop test; window resize; pause/unfocus.

14. Schedule (aggressive, 4 weeks)

- Week 1: Project setup; Space Map MVP (move, planet, landing).
- Week 2: Planet Exploration MVP; encounter trigger; basic UI and audio.
- Week 3: Tactical Battle core (grid, turns, attack); victory/defeat; rewards.
- Week 4: Balancing, polish, bugfix, tooltips, mini-map, build packaging.

15. Risks and Mitigations

- Performance on Safari: test early; reduce particle and shader usage.
- Pathfinding/LOS complexity: constrain map sizes; cache LOS; keep obstacles sparse.
- Scope creep: lock content to one planet, one battle layout.

16. Deliverables

- Playable web build (static bundle) hosted via Netlify/Vercel.
- Short README with controls and known issues.
- Bug list and playtest notes.

17. Controls (Demo)

- Global: WASD move, Mouse for hover/selection, E interact, Esc menu.
- Battle: Left-click select, Right-click confirm move/attack, 1–3 unit select, Space end turn.

This PRD defines the minimum to prove the concept and user flow across all three screens with stable, performant web delivery.
