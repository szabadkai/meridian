Great—let’s lock this to Phaser without TypeScript and add an assets list.

Tech choices

- Engine: Phaser 3 (ES modules, JavaScript)
- Build: Vite (ESM) or plain Parcel. I’ll assume Vite.
- Language: JavaScript (no TypeScript)
- Target: Desktop browsers

Minimal project structure

- public/
    - index.html
- src/
    - main.js (boot, global config)
    - scenes/
        - SpaceScene.js
        - PlanetScene.js
        - BattleScene.js
        - UIScene.js
        - PreloadScene.js
    - systems/
        - state.js // shared game state (fuel, scrap, party, etc.)
        - input.js
        - combat.js
        - pathfinding.js // simple grid A\* or BFS
    - assets/ // dev-only placeholder copies (see list below)
- vite.config.js
- package.json
- README.md

Phaser setup notes (JS)

- Use Phaser’s ES module build: import Phaser from 'phaser'
- Enable physics: arcade for space/planet, none for battle
- Mobile support: off for demo; use fixed 1280x720 with scale FIT/letterbox

Scope updates to PRD

- Keep the same gameplay scope as the PRD you approved, but implement in JavaScript.
- Testing stack: Playtest + light unit tests optional via Vitest are not required; focus on manual QA.

Asset list for the demo
Use placeholders now; you can swap with final art later. I grouped by screen and included recommended specs and suggested sources.

Global/UI

- Bitmap font: 1 pixel font (PNG + FNT). Size: 16px base.
- UI icons: 16x16 or 24x24 PNGs for:
    - Hull, Fuel, Minerals, Scrap, End Turn, Ability, Settings
- Buttons/frames: 9-slice panels for tooltips/modals (2 variants: light/dark)
- Cursor: 2 frames (normal, target) 16x16

Space Map

- Background:
    - Starfield parallax layers x3 (PNG 1024x1024 tileable) or generate procedurally
    - Nebula cloud texture x1 (tileable, low alpha)
- Player ship sprite:
    - 32x32 or 48x48 PNG; optional 3–4 frame thrust animation
    - Shield/hit flash overlay (additive)
- Enemy ship sprite x2 variants:
    - 32x32 PNGs + red tint
- Planet sprites:
    - 3 planet thumbnails 64x64 (desert, ice, lush)
    - Orbit marker ring 64–96px transparent PNG
- Points of Interest:
    - Derelict icon 24x24
    - Scan ping sprite 16x16 with 6–8 frame animation
- UI:
    - Mini-map mask and blips (2–3px dots)
- SFX:
    - Engine hum/loop, thrust burst, scan ping, proximity alert
- Music:
    - Ambient space loop (2–3 min)

Planet Exploration

- Tilemap:
    - Tileset PNG 16x16 (terrain: dirt, rock, grass; obstacles: rocks, trees; props)
    - Tilemap JSON (64x64) exported from Tiled
- Party characters:
    - 3 units, 4-direction walk cycles (3–4 frames each) at 16x24 or 24x32
    - Interaction sparkle 8x8 animation
- Resource node:
    - Mineral crystal 16x16 with idle sparkle
- Landing zone:
    - Beacon 24x24 with pulsing ring
- SFX:
    - Footstep, pickup, UI confirm, ambient wind
- Music:
    - Planet surface loop

Tactical Battle

- Grid and environment:
    - Ground tiles 16x16 (sand/rock) + 2 obstacle types (low cover, high cover)
    - Cover decals/icons for low/high
    - Move/attack tile highlights (blue/red) as 16x16 overlays
- Player units (same as planet but battle poses acceptable):
    - Idle frame + shoot/melee frame per class
- Enemies:
    - 2–3 enemy sprites 16x24 (melee, ranged, elite)
- Projectiles/VFX:
    - Bullet 4x4, muzzle flash 8x8, impact spark 8x8, small smoke puff
    - Hit/miss text pop numbers (bitmap font OK)
- UI:
    - Ability icons 24x24 (Dash, Suppress, Repair)
    - End Turn button, Turn order pips
- SFX:
    - Gunshot light, rifle, hit, miss, death pop, UI end-turn
- Music:
    - Battle loop (higher energy)

Common technical assets

- Spritesheets: pack with a single atlas per scene if possible to reduce requests
- Audio format: OGG + fallback MP3 (44.1 kHz)
- Licensing: CC0/CC-BY; keep a LICENSES.md with attributions

Suggested free sources

- Kenney.nl (UI, icons, pixel assets, audio)
- Itch.io asset packs (search for “16x16” “roguelike” “Sci-fi”)
- CraftPix (free section)
- OpenGameArt (filter by license)
- JFXR/BFXR for custom SFX

Concrete asset checklist you can hand off to art

- 3 planet thumbnails (64x64)
- Player ship + thrust (32x32, 4 frames)
- Enemy ship A/B (32x32, 2 frames optional)
- Orbit ring (96px diameter)
- Starfield layers x3 (1024x1024 tileables)
- Space POI icon + scan ping (16x16, 8 frames)
- Tileset 16x16: 64+ tiles (terrain, cliffs, rocks, trees, props)
- Planet map JSON (64x64) with colliders and an encounter trigger
- Party sprites: Scout/Soldier/Tech 4-dir walk (3–4 frames each)
- Mineral node sprite + sparkle (16x16)
- Landing beacon (24x24, pulse)
- Battle tiles: ground, low cover, high cover (16x16)
- Player unit battle poses (idle, fire, hit) for 3 classes
- Enemy sprites x3 (idle, attack)
- Projectiles/VFX: bullet, muzzle, impact, smoke, damage numbers
- UI: bitmap font, icons (HP, Fuel, Minerals, Scrap, End Turn, Abilities), panels, cursor
- Audio: 3 music loops (space, planet, battle), SFX set listed above

Implementation notes (JS)

- Use atlas JSON for each scene to minimize loads.
- Keep logical tile size 16x16; scale by 4–5x to 1280x720.
- Pathfinding: simple grid BFS for movement range; A\* for target path.
- LOS: Bresenham line on grid; cover as tile property.

Next steps

- I can provide a starter Phaser + Vite JavaScript template and stub scenes wired with transitions, plus a CSV asset manifest you can drop files into. Want me to generate that skeleton and a JSON manifest you can hand to art?
