# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meridian is a browser-based space exploration game demo built with Phaser 3 and Vite. It implements a vertical slice of three interconnected gameplay loops:
1. **Space Map** - arcade-style ship navigation with fuel management, fog-of-war, and encounters
2. **Planet Exploration** - top-down squad movement with resource collection
3. **Tactical Battle** - turn-based grid combat with class abilities and cover mechanics

The demo runs session-only (no persistence), uses procedurally-generated placeholder art, and targets desktop browsers at 1280x720.

## Development Commands

### Running the game
```bash
npm run dev          # Start Vite dev server at http://localhost:5173
npm run build        # Production build to dist/
npm run preview      # Preview production build at http://localhost:4173
```

### In-game restart
Press `R` in the browser to restart the demo loop from space.

## Technical Stack

- **Engine**: Phaser 3 (ES modules, vanilla JavaScript - no TypeScript)
- **Build**: Vite 5.x
- **Physics**: Arcade physics for Space/Planet scenes; none for Battle
- **Resolution**: Fixed 1280x720 with FIT scaling and letterbox
- **Browser targets**: Chrome, Firefox, Edge, Safari (desktop only)

## Architecture

### Core State Management (`src/systems/state.js`)

All game state lives in a single global object managed through `state.js`. This is the **single source of truth** for:
- Hero stats (hull, fuel)
- Inventory (minerals, scrap)
- Space entities (planets, patrols, derelicts)
- Battle state (units, turn phase, round number)
- Tutorial flags

**Key functions**:
- `getState()` - read current state
- `patchState(patch)` - merge updates (emits events)
- `resetState()` - restore to defaults
- `changeScene(targetKey, payload)` - trigger scene transitions
- Specialized helpers: `adjustFuel()`, `addResource()`, `markPlanetDiscovered()`, etc.

State changes emit events via Phaser's EventEmitter; scenes subscribe with `onState(eventName, callback)`.

### Scene Flow

1. **PreloadScene** - generates placeholder textures/audio, loads into cache
2. **SpaceScene** - overworld; transitions to PlanetScene on landing or BattleScene on patrol engage
3. **PlanetScene** - squad movement; transitions to BattleScene on encounter trigger
4. **BattleScene** - tactical combat; victory returns to PlanetScene, defeat resets to SpaceScene
5. **UIScene** - persistent HUD overlay (runs parallel to other scenes)

Transitions use `changeScene(targetKey, payload)` which updates `state.session` and emits a `scene` event that the UIScene listens to for HUD updates.

### Systems

- **`state.js`**: Global state + event emitter
- **`input.js`**: `InputManager` class wrapping Phaser keyboard/mouse, exposes `isPressed()`, `isJustDown()`, `getPointer()`
- **`combat.js`**: Battle logic - `createUnit()`, `resolveAttack()`, `resolveAbility()`, cover/accuracy calculations, status effects
- **`pathfinding.js`**: Grid pathfinding - `bfsRange()` for movement tiles, `aStar()` for enemy AI
- **`content.js`**: Static data (squad configs, board layout, obstacles/cover definitions)

### Combat System

Turn-based IGOUGO:
- Player phase: all player units can move + act
- Enemy phase: all enemy units move + act
- Unit actions: attack, abilities (Dash/Suppress/Repair), or pass
- Cover system: tiles have `CoverTypes.NONE/LOW/HIGH` modifiers (-10%/-25% hit chance)
- Status effects: temporary debuffs (e.g., "suppressed" reduces accuracy)
- Hit resolution: `calculateHitChance(attacker, defender, context)` → roll 1-100 vs. threshold

Units are created via `createUnit(config)` and stored in `BattleScene.units[]`. Sprites tracked separately in `unitSprites` Map.

### Space Scene Mechanics

- **Movement**: Arcade physics with thrust/brake; WASD controls + boost (Shift)
- **Fuel**: Drains at `FUEL_DRAIN_PER_SECOND` (4/s) while moving; halves speed at 0 fuel (no death)
- **Fog-of-war**: Canvas-based fog texture; reveals tiles in radius around player (`fogRevealRadius = 5`)
- **Interactions**: Proximity-based (120px) - `E` to land on planets, engage patrols, or salvage derelicts
- **AI Patrols**: Simple seek behavior; aggro at 12 tiles, trigger battle modal on contact

### Planet Scene Mechanics

- **Party system**: 3 units (Scout/Soldier/Tech) with leader + 2 followers in "rope" formation
- **Resource collection**: Single mineral node yields +10 Minerals on interact
- **Encounter trigger**: Designated zone transitions to BattleScene when entered
- **Return to space**: Landing beacon returns to SpaceScene (only after objectives complete)

## Controls Reference

### Global
- `W/↑` - accelerate / move forward
- `S/↓` - brake / move backward
- `A/D` - turn left/right (space) or strafe (planet)
- `Shift` - boost (space) / sprint (planet)
- `E` - interact (land, collect, engage)
- `R` - scan / evade (space)

### Battle-specific
- `Space` - end turn
- `1/2/3` - select unit by index or trigger abilities
- Click tile - move/attack selected unit
- Hover - preview move range, attack hit chance

## Key Constants & Tuning

Located at top of scene files:
- **SpaceScene**: `PLAYER_ACCEL`, `PLAYER_MAX_SPEED`, `FUEL_DRAIN_PER_SECOND`, `AGGRO_RADIUS_UNITS`, `INTERACT_RADIUS_PIXELS`
- **BattleScene**: `CELL_SIZE`, `BOARD_COLS/ROWS` (from `BattleBoardConfig`)
- **Combat**: Base accuracy values, damage dice, ability charges in `combat.js`

## Common Development Patterns

### Adding a new planet
1. Add entry to `state.space.planets[]` in `state.js` (id, name, biome, position, landingAllowed)
2. Add corresponding texture key to `PLANET_TEXTURES` in `SpaceScene.js`
3. Generate texture in `PreloadScene.js` via `makePlanetTexture()`

### Adding a unit ability
1. Define handler in `combat.js` `resolveAbility()` switch
2. Add ability ID to unit's `abilities[]` in `content.js` squad config
3. Wire UI button in `BattleScene.js` `handleAbilityInputs()`

### Debugging state
Enable physics debug in `main.js`:
```js
physics: {
  arcade: { debug: true }
}
```
Or log state: `console.log(getState())`

## Testing & QA Notes

- **Performance target**: 60 FPS desktop; test Safari early (shaders/particles can degrade)
- **Session length**: 8-12 min to complete full loop (space → planet → battle → return)
- **No saves**: State resets on page reload; use browser DevTools to snapshot `getState()` for testing
- **Playtest checklist** (from PRD):
  - Complete loop without guidance (tooltips only)
  - No crashes in 20 playthroughs
  - Window resize/unfocus handling
  - Low-end laptop performance (30+ FPS acceptable)

## Art & Asset Notes

All assets are **procedurally generated** at runtime in `PreloadScene.js` using Phaser Graphics API:
- Textures: ships, planets, tiles, units (placeholder colored rectangles/circles)
- Audio: silent placeholders (sfx/music hooks present but no actual sounds)

Replace by:
1. Adding real assets to `public/` or `src/assets/`
2. Updating `PreloadScene.js` to `this.load.image(key, path)` instead of generating
3. Keeping same texture keys referenced in scenes

See `specs.md` for detailed asset list (16x16 tilesets, sprite animations, UI icons, etc.).

## PRD & Design Docs

- **`prd.md`**: Full product requirements (scope, UX flows, data definitions, schedule)
- **`specs.md`**: Technical implementation specs (Phaser + JS setup, asset checklist, tile sizes, pathfinding notes)
- **`README.md`**: User-facing quick start and controls

These docs define the design intent; consult them before making gameplay changes.

## Known Scope Limits (v0.1)

Non-goals per PRD:
- Story/quests/dialogue
- Multiple star systems, trading, crafting, leveling
- Multiplayer
- Mobile/touch support
- Persistent saves or progression

Keep features within the three-loop vertical slice.
