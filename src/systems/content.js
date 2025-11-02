export const PlayerSquadConfig = [
  {
    id: 'scout',
    name: 'Scout',
    class: 'scout',
    hp: 6,
    moveRange: 5,
    attackRange: 3,
    accuracy: 75,
    damage: [1, 6],
    abilities: ['dash'],
    position: { x: 1, y: 2 }
  },
  {
    id: 'soldier',
    name: 'Soldier',
    class: 'soldier',
    hp: 8,
    moveRange: 4,
    attackRange: 4,
    accuracy: 70,
    damage: [1, 8],
    abilities: ['suppress'],
    position: { x: 1, y: 3 }
  },
  {
    id: 'tech',
    name: 'Tech',
    class: 'tech',
    hp: 7,
    moveRange: 4,
    attackRange: 3,
    accuracy: 65,
    damage: [1, 6],
    abilities: ['repair'],
    position: { x: 1, y: 4 }
  }
];

export const EnemySquadConfig = [
  {
    id: 'raider-1',
    name: 'Raider',
    class: 'raider',
    hp: 6,
    moveRange: 4,
    attackRange: 1,
    accuracy: 70,
    damage: [1, 6],
    abilities: [],
    position: { x: 6, y: 2 }
  },
  {
    id: 'raider-2',
    name: 'Raider',
    class: 'raider',
    hp: 6,
    moveRange: 4,
    attackRange: 1,
    accuracy: 70,
    damage: [1, 6],
    abilities: [],
    position: { x: 6, y: 4 }
  },
  {
    id: 'marksman',
    name: 'Marksman',
    class: 'marksman',
    hp: 5,
    moveRange: 3,
    attackRange: 5,
    accuracy: 75,
    damage: [1, 6],
    abilities: [],
    position: { x: 5, y: 3 }
  }
];

export const BattleBoardConfig = {
  width: 8,
  height: 6,
  obstacles: [
    { x: 3, y: 2, cover: 'low' },
    { x: 3, y: 3, cover: 'high' },
    { x: 4, y: 4, cover: 'low' }
  ]
};

export const PlanetEncounterConfig = {
  mapSize: 64,
  tileSize: 16,
  collisionTiles: [],
  resourceNode: { x: 40, y: 28 },
  encounterTrigger: { x: 50, y: 32, radius: 4 },
  landingZone: { x: 10, y: 30 }
};
