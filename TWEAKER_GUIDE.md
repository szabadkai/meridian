# Ship Controls Tweaker Guide

A real-time control tweaker has been added to the space scene to help you fine-tune the spaceship mechanics.

## How to Use

1. **Start the game** with `npm run dev`
2. **Navigate to the Space scene** (the main gameplay area)
3. **Press `T`** to toggle the tweaker panel on/off

## Available Controls

The tweaker panel appears in the top-right corner and lets you adjust these parameters in real-time:

### Movement Parameters

- **Acceleration** (50-400)
  - Default: 180
  - How quickly the ship speeds up when pressing W

- **Max Speed** (100-400)
  - Default: 220
  - Maximum velocity the ship can reach

- **Turn Speed** (60-300 °/s)
  - Default: 160
  - How fast the ship rotates when pressing A/D

- **Brake Force** (100-800)
  - Default: 420
  - How quickly the ship slows down when pressing S

- **Passive Drag** (0-5)
  - Default: 2.2
  - How much the ship naturally slows down without braking
  - Higher values = ship drifts less

- **Boost Multiplier** (1.0-2.5)
  - Default: 1.25
  - Speed increase when holding Shift
  - 1.25 = 25% faster

### Resource Parameters

- **Fuel Drain/s** (0-10)
  - Default: 4
  - How much fuel is consumed per second while moving
  - Set to 0 for unlimited fuel (great for testing!)

## Features

- **Real-time updates**: Changes apply immediately while playing
- **Reset button**: Restore all values to defaults with one click
- **Persistent across tweaks**: Keep adjusting and testing until it feels right
- **No game restart needed**: Tweak on the fly

## Tips for Finding the Right Feel

1. **Start with turn speed**: Too slow feels sluggish, too fast feels twitchy
2. **Balance acceleration and max speed**: Fast accel + low max speed = responsive but capped; slow accel + high max speed = floaty but powerful
3. **Adjust drag for desired drift**: Low drag = more "space-like" drifting; high drag = more direct control
4. **Brake force vs passive drag**: High brake force with low drag = manual control emphasis; low brake force with high drag = automatic stabilization
5. **Boost multiplier**: 1.5-2.0 feels significant without being overpowered

## Recommended Presets

### Arcade (Default)
- Accel: 180, Max Speed: 220, Turn: 160, Brake: 420, Drag: 2.2, Boost: 1.25

### Realistic Space
- Accel: 120, Max Speed: 300, Turn: 100, Brake: 200, Drag: 0.5, Boost: 1.5
- (More drift, slower turning, higher top speed)

### Responsive Fighter
- Accel: 250, Max Speed: 180, Turn: 240, Brake: 600, Drag: 3.5, Boost: 1.2
- (Quick reactions, tight control, lower top speed)

### Drift Racer
- Accel: 300, Max Speed: 350, Turn: 200, Brake: 150, Drag: 0.3, Boost: 1.8
- (High speed, lots of momentum, drift-heavy)

## Copying Your Settings

Once you've found settings you like, you can permanently apply them by updating the `DEFAULT_PARAMS` object in `src/scenes/SpaceScene.js` (around line 18):

```javascript
const DEFAULT_PARAMS = {
    PLAYER_ACCEL: 180,           // Your value here
    PLAYER_MAX_SPEED: 220,       // Your value here
    PLAYER_TURN_SPEED: 160,      // Your value here
    PLAYER_BRAKE_FORCE: 420,     // Your value here
    PASSIVE_DRAG: 2.2,           // Your value here
    BOOST_MULTIPLIER: 1.25,      // Your value here
    FUEL_DRAIN_PER_SECOND: 4,    // Your value here
};
```

**Note**: The Phaser physics engine also has a hard max velocity limit set at 1.5x the PLAYER_MAX_SPEED. If you change PLAYER_MAX_SPEED to a very high value, you may also want to adjust line 162 in the `setupPlayer()` method.

## Technical Details

- The tweaker uses Phaser's DOM plugin to create an HTML overlay
- All changes update `this.params` in the SpaceScene instance
- The `handleMovement()` and `handleFuel()` methods read from `this.params` each frame
- The panel is scene-specific and only appears in the Space scene
