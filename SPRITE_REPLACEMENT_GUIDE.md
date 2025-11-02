# Sprite Replacement Guide

This guide shows you how to replace the procedurally-generated placeholder sprites with your own image files.

## Quick Start

### Step 1: Prepare Your Image Files

Create your sprite images and save them as PNG or JPG files. Recommended sizes:

- **Player ship**: ~36×20 pixels (or any size, Phaser will scale)
- **Enemy ship**: ~32×18 pixels
- **Planets**: ~64×64 pixels (circular)
- **Other entities**: See sizes in `PLACEHOLDER_DEF` in `PreloadScene.js`

### Step 2: Place Files in `public/` Directory

```
meridian/
├── public/
│   ├── player-ship.png      ← Your player ship
│   ├── enemy-ship.png        ← Your enemy ship
│   ├── planet-lush.png       ← Optional planet sprites
│   └── ...
```

Files in `public/` are served at the root URL (e.g., `/player-ship.png`)

### Step 3: Load Images in PreloadScene

Edit `src/scenes/PreloadScene.js`:

```javascript
preload() {
  this.add.text(640, 360, 'Initializing...', {
    fontSize: '24px',
    color: '#d0f0ff'
  }).setOrigin(0.5, 0.5);

  // Load your real images
  this.load.image('ship-player', '/player-ship.png');
  this.load.image('ship-enemy', '/enemy-ship.png');

  // Optional: Replace planets too
  // this.load.image('planet-lush', '/planet-lush.png');
  // this.load.image('planet-ice', '/planet-ice.png');

  this.generatePlaceholderTextures();
  this.registry.set('assetsReady', true);
}
```

### Step 4: Remove Placeholder Generation (Optional)

Comment out the corresponding entries in `PLACEHOLDER_DEF`:

```javascript
const PLACEHOLDER_DEF = [
    // { key: 'ship-player', width: 36, height: 20, color: 0x4ac8ff }, // ← Commented out
    // { key: 'ship-enemy', width: 32, height: 18, color: 0xff6b6b },  // ← Commented out
    { key: "planet-lush", radius: 32, gradient: [0x44ffaa, 0x146b5d] },
    // ... keep the rest
];
```

This prevents generating the placeholder for sprites you're loading as images.

---

## Advanced: Sprite Sheets (Animated Ships)

If you want animated sprites with multiple frames:

### Create a Sprite Sheet

Create a PNG with multiple frames arranged horizontally or in a grid:

```
[Frame 1][Frame 2][Frame 3][Frame 4]
```

Example: `player-ship-sheet.png` with 4 frames of 36×20 pixels each = 144×20 total

### Load as Sprite Sheet

```javascript
preload() {
  this.load.spritesheet('ship-player', '/player-ship-sheet.png', {
    frameWidth: 36,
    frameHeight: 20
  });
}
```

### Create Animations

In `SpaceScene.js` after creating the sprite:

```javascript
setupPlayer() {
  // ... existing setup code ...

  // Create animation
  this.anims.create({
    key: 'ship-thrust',
    frames: this.anims.generateFrameNumbers('ship-player', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
  });

  // Play animation
  this.ship.play('ship-thrust');
}
```

---

## Complete Example: Replace Both Ships

**1. Add files to `public/`:**

```
public/
├── player-ship.png
└── enemy-ship.png
```

**2. Edit `src/scenes/PreloadScene.js`:**

```javascript
const PLACEHOLDER_DEF = [

  { key: 'planet-lush', radius: 32, gradient: [0x44ffaa, 0x146b5d] },
  { key: 'planet-ice', radius: 32, gradient: [0xa4d8ff, 0x4c7bb8] },
  // ... rest unchanged
];

// ...

preload() {
  this.add.text(640, 360, 'Initializing...', {
    fontSize: '24px',
    color: '#d0f0ff'
  }).setOrigin(0.5, 0.5);

  // Load real ship images
  this.load.image('ship-player', '/player-ship.png');
  this.load.image('ship-enemy', '/enemy-ship.png');

  this.generatePlaceholderTextures();
  this.registry.set('assetsReady', true);
}
```

**3. Reload the game** - Vite will hot-reload automatically!

---

## Texture Keys Reference

All sprites use these texture keys. Replace any of them by loading an image with the same key:

### Space Scene

- `ship-player` - Player's ship
- `ship-enemy` - Enemy patrol ships
- `planet-lush` - Lush biome planets
- `planet-ice` - Ice biome planets
- `orbit-ring` - Planet orbit rings
- `derelict` - Salvageable derelicts
- `starfield-close/mid/far` - Background stars (tiled)

### Planet Scene

- `party-leader` - Squad leader unit
- `party-companion` - Squad follower units
- `resource-node` - Mineral collection nodes
- `landing-zone` - Return to ship beacon

### Battle Scene

- `enemy-raider` - Raider enemy unit
- `enemy-marksman` - Marksman enemy unit
- `tile-ground` - Ground tiles
- `tile-path` - Path tiles
- `tile-cover-low` - Low cover tiles
- `tile-cover-high` - High cover tiles

---

## Adjusting Sprite Sizes

All sprite target sizes are now configured in **ONE** convenient place!

### Single Centralized Configuration

**Edit `src/scenes/SpaceScene.js` lines 36-64 - this controls ALL sprites across ALL scenes:**

```javascript
// Target sprite sizes (pixels) - adjust these to change how big sprites appear in-game
// EXPORTED for use in other scenes (PlanetScene, BattleScene)
export const SPRITE_SIZES = {
    // Space Scene - Ships & Objects
    PLAYER_SHIP_WIDTH: 32,
    PLAYER_SHIP_HEIGHT: 32,
    ENEMY_SHIP_WIDTH: 32,
    ENEMY_SHIP_HEIGHT: 32,
    PLANET_SIZE: 64,           // Diameter
    ORBIT_RING_SIZE: 96,       // Diameter
    DERELICT_SIZE: 32,
    RESOURCE_NODE_SIZE: 24,

    // Planet Scene - Characters
    PARTY_LEADER_WIDTH: 64,
    PARTY_LEADER_HEIGHT: 64,
    PARTY_COMPANION_WIDTH: 64,
    PARTY_COMPANION_HEIGHT: 64,
    LANDING_ZONE_SIZE: 72,

    // Battle Scene - Enemy Units
    ENEMY_RAIDER_WIDTH: 18,
    ENEMY_RAIDER_HEIGHT: 24,
    ENEMY_MARKSMAN_WIDTH: 18,
    ENEMY_MARKSMAN_HEIGHT: 24,

    // Battle Scene - Tiles
    TILE_SIZE: 16,
};
```

**To make sprites bigger or smaller**, just change these numbers in `SpaceScene.js`! For example:

- Want a bigger player ship? Change `PLAYER_SHIP_WIDTH: 32` to `PLAYER_SHIP_WIDTH: 48`
- Want smaller planets? Change `PLANET_SIZE: 64` to `PLANET_SIZE: 48`
- Want larger party characters? Change `PARTY_LEADER_WIDTH: 64` to `PARTY_LEADER_WIDTH: 96`

The game automatically scales your images to match these sizes while maintaining aspect ratio.

---

## Tips

1. **Automatic scaling**: The game now automatically scales all sprites to their target sizes, so you can use images of any size!
    - Just make sure your images maintain good aspect ratios
2. **Transparent backgrounds**: Use PNG with transparency for ships/units
3. **Hot reload**: Vite automatically reloads when you change files in `public/`
4. **Test first**: Replace one sprite at a time to catch issues early
5. **Fallback**: If image fails to load, Phaser shows a missing texture (white square) - check console for errors

---

## Troubleshooting

**Sprite not showing up?**

- Check the file path is correct (`/filename.png` not `filename.png`)
- Look for console errors in browser DevTools
- Verify file is in `public/` directory
- Make sure you commented out the placeholder definition

**Image is stretched or wrong size?**

- The game automatically scales sprites to target sizes
- If your image looks distorted, check its aspect ratio
- Recommended aspect ratios:
    - Player ship: ~1.8:1 (width:height)
    - Enemy ship: ~1.8:1
    - Planets: 1:1 (square)
    - Derelict: 1:1

**Want custom scaling?**
Just edit the `SPRITE_SIZES` constant at the top of `SpaceScene.js` (lines 36-64). This single configuration controls ALL sprites across ALL scenes!

---

## Using Images from `assets/images/`

If you want to use images from `assets/images/` instead of `public/`:

```javascript
// Import at top of PreloadScene.js
import playerShipImg from "../assets/images/your-ship.png";

// Then in preload()
this.load.image("ship-player", playerShipImg);
```

However, putting images in `public/` is simpler and recommended for this project.
