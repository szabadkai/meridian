import Phaser from 'phaser';

function createDefaultState() {
  return {
    session: {
      currentScene: 'SpaceScene',
      previousScene: null,
      transitions: []
    },
    hero: {
      hull: 10,
      maxHull: 10,
      fuel: 100,
      maxFuel: 100
    },
    inventory: {
      minerals: 0,
      scrap: 0
    },
    tutorials: {
      onboarding: false,
      spaceMovement: false,
      planetMovement: false,
      battleControls: false
    },
    space: {
      bounds: { width: 200, height: 200 },
      player: {
        x: 100,
        y: 100,
        velocity: { x: 0, y: 0 }
      },
      planets: [
        {
          id: 'demo-planet',
          name: 'Vesta IX',
          biome: 'Lush',
          position: { x: 120, y: 80 },
          landingAllowed: true,
          discovered: false
        },
        {
          id: 'ice-world',
          name: 'Krios',
          biome: 'Ice',
          position: { x: 70, y: 140 },
          landingAllowed: false,
          discovered: false
        }
      ],
      enemyPatrols: [
        {
          id: 'patrol-alpha',
          position: { x: 155, y: 65 },
          state: 'patrolling',
          engaged: false,
          defeated: false
        },
        {
          id: 'patrol-beta',
          position: { x: 85, y: 125 },
          state: 'patrolling',
          engaged: false,
          defeated: false
        }
      ],
      derelicts: [
        {
          id: 'derelict-aurora',
          position: { x: 110, y: 105 },
          claimed: false,
          reward: { fuel: 15, scrap: 5 }
        }
      ],
      discoveredTiles: []
    },
    planet: {
      name: 'Vesta IX — Fringe Basin',
      resourceCollected: false,
      encounterTriggered: false
    },
    battle: {
      phase: 'idle',
      round: 1,
      activeUnitIndex: 0,
      selectedUnitId: null,
      units: []
    }
  };
}

let state = createDefaultState();
const emitter = new Phaser.Events.EventEmitter();

export function getState() {
  return state;
}

export function resetState() {
  state = createDefaultState();
  emitter.emit('reset', cloneState());
  return state;
}

export function patchState(patch) {
  state = mergeDeep(state, patch);
  emitter.emit('update', cloneState());
  return state;
}

export function onState(eventName, callback, context) {
  emitter.on(eventName, callback, context);
  return () => emitter.off(eventName, callback, context);
}

export function changeScene(targetKey, payload = {}) {
  state.session.previousScene = state.session.currentScene;
  state.session.currentScene = targetKey;
  state.session.transitions.push({
    from: state.session.previousScene,
    to: targetKey,
    at: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    payload
  });
  emitter.emit('scene', {
    current: state.session.currentScene,
    previous: state.session.previousScene,
    payload
  });
}

export function adjustHull(amount) {
  const value = clamp(state.hero.hull + amount, 0, state.hero.maxHull);
  state.hero.hull = value;
  emitter.emit('resource', { hull: state.hero.hull });
  return value;
}

export function adjustFuel(amount) {
  const value = clamp(state.hero.fuel + amount, 0, state.hero.maxFuel);
  state.hero.fuel = value;
  emitter.emit('resource', { fuel: state.hero.fuel });
  return value;
}

export function addResource(key, amount) {
  if (!Object.hasOwn(state.inventory, key)) {
    throw new Error(`Unknown resource ${key}`);
  }
  state.inventory[key] = Math.max(0, state.inventory[key] + amount);
  emitter.emit('inventory', { [key]: state.inventory[key] });
  return state.inventory[key];
}

export function markTutorialSeen(key) {
  state.tutorials[key] = true;
  emitter.emit('tutorial', { key });
}

export function updateSpacePlayerPosition(position) {
  state.space.player.x = clamp(position.x, 0, state.space.bounds.width);
  state.space.player.y = clamp(position.y, 0, state.space.bounds.height);
  emitter.emit('space:player', { ...state.space.player });
}

export function markPlanetDiscovered(id) {
  const planet = state.space.planets.find((p) => p.id === id);
  if (planet) {
    planet.discovered = true;
    emitter.emit('space:planet', { id, planet });
  }
}

export function markDerelictClaimed(id) {
  const derelict = state.space.derelicts.find((p) => p.id === id);
  if (derelict && !derelict.claimed) {
    derelict.claimed = true;
    emitter.emit('space:derelict', { id, derelict });
  }
}

export function setBattleState(nextState) {
  state.battle = { ...state.battle, ...nextState };
  emitter.emit('battle', cloneBattleState());
}

export function revealSpaceTile(tile) {
  if (
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x > state.space.bounds.width ||
    tile.y > state.space.bounds.height
  ) {
    return false;
  }
  const key = `${tile.x},${tile.y}`;
  if (!state.space.discoveredTiles.includes(key)) {
    state.space.discoveredTiles.push(key);
    emitter.emit('space:reveal', { tile });
    return true;
  }
  return false;
}

export function cloneState() {
  return JSON.parse(JSON.stringify(state));
}

export function cloneBattleState() {
  return JSON.parse(JSON.stringify(state.battle));
}

function mergeDeep(target, source) {
  if (typeof target !== 'object' || typeof source !== 'object' || target === null || source === null) {
    return source;
  }

  const output = Array.isArray(target) ? [...target] : { ...target };
  Object.keys(source).forEach((key) => {
    if (Array.isArray(source[key])) {
      output[key] = [...source[key]];
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      output[key] = mergeDeep(target[key] ?? {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });
  return output;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
