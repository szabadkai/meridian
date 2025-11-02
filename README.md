# Meridian Demo (Prototype)

A browser-based vertical slice of the Meridian space exploration loop, built with Phaser 3 and Vite. The demo wires together the three core beats from the PRD:

- **Space Map**: explore a 200x200 sector, manage fuel, discover planets, and trigger encounters.
- **Planet Exploration**: move a three-member squad across a handcrafted surface to collect resources and reach the tactical encounter.
- **Tactical Battle**: run a lightweight turn-based skirmish on a 6x8 grid with class abilities and simplified cover rules.

Placeholder art is generated at runtime so the project can run without external asset downloads.

## Getting Started

1. Install dependencies (Node.js 18+ recommended):

   ```bash
   npm install
   ```

2. Launch the dev server:

   ```bash
   npm run dev
   ```

   Vite opens at `http://localhost:5173/`. Press `r` in the browser to restart the demo loop if needed.

3. Build for production (optional):

   ```bash
   npm run build
   npm run preview
   ```

## Controls & Flow

### Global

- `W / ↑` – accelerate forward (space map); `S / ↓` – brake/reverse; `A / D` – turn
- `Shift` – boost / sprint
- `E` – primary interact
- `R` – contextual scan / evade (space map)
- `Space` – end turn (battle)
- `1/2/3` – trigger class abilities (battle)

### Space Map

- Arcade flight with forward thrust and steering; fuel drains while moving (movement halves at 0 fuel).
- `E` near planets to enter orbit and land; `E` on enemy patrols to engage; `R` to spend fuel and evade.
- Derelict salvage grants scrap and fuel; fog-of-war reveals in a 10-tile radius.

### Planet Exploration

- Lead a squad across obstacles, collect the mineral node (`E`), then breach the encounter zone to enter battle.
- `E` at the landing beacon returns to space once objectives are complete.

### Tactical Battle

- IGOUGO loop: move + action per unit.
- Abilities: `Dash` (Scout, adds another move), `Suppress` (Soldier, accuracy debuff), `Repair` (Tech, 2 charges).
- Victory rewards +10 Minerals, +5 Scrap, +1 Hull; defeat resets the loop back to the space map.

## Project Structure

```
src/
  main.js             # Phaser bootstrap
  scenes/             # Space, Planet, Battle, UI, Preload scenes
  systems/            # Shared state, input helpers, combat + pathfinding logic
 index.html            # Vite entry
vite.config.js        # Build configuration
```

## Next Steps

- Replace placeholder textures/audio with art-direction assets (see `specs.md`).
- Flesh out encounter UX (modal prompts, repair screen) and add audio hooks.
- Expand AI and ability targeting, add LOS indicators, and deeper tooltips.
- Integrate save-state persistence or session restore once design solidifies.
