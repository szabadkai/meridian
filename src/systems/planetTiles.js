import Phaser from 'phaser';
import { PlanetEncounterConfig } from './content.js';

export const TILESET_KEY = 'planet-tileset';
export const TILESET_NAME = 'planet-tiles';

export const TILE_INDEX = Object.freeze({
  GROUND: 0,
  PATH: 1,
  COVER_LOW: 2,
  COVER_HIGH: 3
});

const TILE_TEXTURE_KEYS = ['tile-ground', 'tile-path', 'tile-cover-low', 'tile-cover-high'];

export function ensurePlanetTileset(scene) {
  let tileWidth = PlanetEncounterConfig.tileSize;
  let tileHeight = PlanetEncounterConfig.tileSize;

  if (!scene.textures.exists(TILESET_KEY)) {
    const tileTexture = scene.textures.get(TILE_TEXTURE_KEYS[0]);
    const baseFrame = tileTexture?.get();
    tileWidth = baseFrame?.width ?? tileWidth;
    tileHeight = baseFrame?.height ?? tileHeight;

    const canvas = scene.textures.createCanvas(
      TILESET_KEY,
      tileWidth * TILE_TEXTURE_KEYS.length,
      tileHeight
    );
    canvas.context.imageSmoothingEnabled = false;

    TILE_TEXTURE_KEYS.forEach((key, index) => {
      const texture = scene.textures.get(key);
      const source = texture?.getSourceImage();
      if (source) {
        canvas.context.drawImage(source, index * tileWidth, 0, tileWidth, tileHeight);
      } else {
        canvas.context.fillStyle = '#1f2933';
        canvas.context.fillRect(index * tileWidth, 0, tileWidth, tileHeight);
      }
    });
    canvas.refresh();
  }

  const tilesetTexture = scene.textures.get(TILESET_KEY);
  const baseFrame = tilesetTexture?.get();
  if (baseFrame) {
    tileWidth = baseFrame.width / TILE_TEXTURE_KEYS.length;
    tileHeight = baseFrame.height;
  }

  return {
    key: TILESET_KEY,
    width: tileWidth,
    height: tileHeight
  };
}

export function generatePlanetTilemapData({ seed } = {}) {
  const width = PlanetEncounterConfig.mapSize;
  const height = PlanetEncounterConfig.mapSize;
  const landing = PlanetEncounterConfig.landingZone;
  const resource = PlanetEncounterConfig.resourceNode;
  const encounter = PlanetEncounterConfig.encounterTrigger;
  const rng = new Phaser.Math.RandomDataGenerator([String(seed ?? 'planet-default')]);

  const data = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TILE_INDEX.GROUND)
  );

  carveCircle(data, landing.x, landing.y, 3, TILE_INDEX.PATH);
  carveLine(data, landing, resource, 2, TILE_INDEX.PATH);
  carveCircle(data, resource.x, resource.y, 2, TILE_INDEX.PATH);

  carveCircle(data, encounter.x, encounter.y, encounter.radius + 1, TILE_INDEX.PATH);

  scatterCover(data, rng, 0.02, TILE_INDEX.COVER_LOW);
  scatterCover(data, rng, 0.005, TILE_INDEX.COVER_HIGH);

  return { data, width, height };
}

function carveLine(data, start, end, radius, tileIndex) {
  let x0 = Math.floor(start.x);
  let y0 = Math.floor(start.y);
  const x1 = Math.floor(end.x);
  const y1 = Math.floor(end.y);

  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    carveCircle(data, x0, y0, radius, tileIndex);
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function carveCircle(data, cx, cy, radius, tileIndex) {
  const width = data[0].length;
  const height = data.length;
  const rSquared = radius * radius;

  for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y += 1) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rSquared) {
        data[y][x] = tileIndex;
      }
    }
  }
}

function scatterCover(data, rng, frequency, tileIndex) {
  const width = data[0].length;
  const height = data.length;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[y][x] !== TILE_INDEX.GROUND) {
        continue;
      }
      if (rng.frac() < frequency) {
        data[y][x] = tileIndex;
      }
    }
  }
}
