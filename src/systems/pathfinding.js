const directions = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function inBounds(node, width, height) {
  return node.x >= 0 && node.y >= 0 && node.x < width && node.y < height;
}

export function bfsRange(start, range, isBlocked, width, height) {
  const visited = new Set();
  const queue = [{ pos: start, distance: 0 }];
  const reachable = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const key = `${current.pos.x},${current.pos.y}`;
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    if (current.distance > range) {
      continue;
    }

    reachable.push({ ...current.pos, distance: current.distance });

    directions.forEach((dir) => {
      const next = { x: current.pos.x + dir.x, y: current.pos.y + dir.y };
      if (!inBounds(next, width, height)) {
        return;
      }
      if (isBlocked(next)) {
        return;
      }
      queue.push({ pos: next, distance: current.distance + 1 });
    });
  }

  return reachable;
}

export function reconstructPath(cameFrom, current) {
  const path = [current];
  let key = `${current.x},${current.y}`;
  while (cameFrom.has(key)) {
    const previous = cameFrom.get(key);
    path.push(previous);
    key = `${previous.x},${previous.y}`;
  }
  return path.reverse();
}

export function aStar(start, goal, isBlocked, width, height) {
  const openSet = new Set([`${start.x},${start.y}`]);
  const cameFrom = new Map();
  const gScore = new Map([[`${start.x},${start.y}`, 0]]);
  const fScore = new Map([[`${start.x},${start.y}`, heuristic(start, goal)]]);

  while (openSet.size > 0) {
    const currentKey = lowestFScore(openSet, fScore);
    const [x, y] = currentKey.split(',').map(Number);
    const current = { x, y };

    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(currentKey);

    directions.forEach((dir) => {
      const neighbor = { x: current.x + dir.x, y: current.y + dir.y };
      if (!inBounds(neighbor, width, height) || isBlocked(neighbor)) {
        return;
      }

      const tentativeG = gScore.get(currentKey) + 1;
      const neighborKey = `${neighbor.x},${neighbor.y}`;

      if (tentativeG < (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + heuristic(neighbor, goal));
        openSet.add(neighborKey);
      }
    });
  }

  return null;
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function lowestFScore(openSet, fScore) {
  let bestKey = null;
  let bestScore = Number.POSITIVE_INFINITY;
  openSet.forEach((key) => {
    const score = fScore.get(key) ?? Number.POSITIVE_INFINITY;
    if (score < bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });
  return bestKey;
}
