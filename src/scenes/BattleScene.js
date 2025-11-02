import Phaser from 'phaser';
import InputManager from '../systems/input.js';
import {
  getState,
  changeScene,
  addResource,
  adjustHull,
  markTutorialSeen,
  resetState
} from '../systems/state.js';
import {
  createUnit,
  resolveAttack,
  resolveAbility,
  TurnPhases,
  CoverTypes,
  isUnitAlive
} from '../systems/combat.js';
import { bfsRange, aStar } from '../systems/pathfinding.js';
import { PlayerSquadConfig, EnemySquadConfig, BattleBoardConfig } from '../systems/content.js';

const CELL_SIZE = 96;
const BOARD_COLS = BattleBoardConfig.width;
const BOARD_ROWS = BattleBoardConfig.height;
const BOARD_WIDTH = BOARD_COLS * CELL_SIZE;
const BOARD_HEIGHT = BOARD_ROWS * CELL_SIZE;

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
    this.transitionData = {};
    this.state = null;
    this.turnPhase = TurnPhases.PLAYER;
    this.units = [];
    this.unitSprites = new Map();
    this.occupiedTiles = new Map();
    this.selectedUnit = null;
    this.reachableTiles = [];
    this.attackableTargets = [];
    this.highlightGroup = null;
    this.pendingAbility = null;
    this.promptCache = null;
    this.battleOrigin = 'planet';
    this.enemyId = null;
  }

  init(data) {
    this.transitionData = data ?? {};
    this.state = getState();
    this.battleOrigin = this.transitionData.origin ?? 'planet';
    this.enemyId = this.transitionData.enemyId ?? null;
  }

  create() {
    this.add.rectangle(640, 360, 1280, 720, 0x070b16);
    this.boardOrigin = new Phaser.Math.Vector2(
      (this.scale.width - BOARD_WIDTH) / 2,
      (this.scale.height - BOARD_HEIGHT) / 2 + 20
    );

    this.highlightGroup = this.add.group();
    this.createBoard();
    this.spawnUnits();
    this.setupInput();
    this.bindEvents();
    this.presentTutorial();
    this.startPlayerPhase();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    this.handleAbilityInputs();
    this.handleEndTurnInput();
  }

  createBoard() {
    this.tiles = [];
    this.coverMap = [];
    this.obstacleMap = [];

    for (let y = 0; y < BOARD_ROWS; y += 1) {
      this.tiles[y] = [];
      this.coverMap[y] = [];
      this.obstacleMap[y] = [];
      for (let x = 0; x < BOARD_COLS; x += 1) {
        const { px, py } = this.gridToWorld(x, y);
        const baseTile = this.add.rectangle(
          px,
          py,
          CELL_SIZE - 6,
          CELL_SIZE - 6,
          (x + y) % 2 === 0 ? 0x1c293a : 0x223148,
          1
        );
        baseTile.setOrigin(0.5);
        baseTile.setInteractive({ useHandCursor: true });
        baseTile.setData('grid', { x, y });
        baseTile.on('pointerover', () => this.onTileHover(x, y));
        baseTile.on('pointerout', () => this.onTileOut(x, y));
        baseTile.on('pointerdown', () => this.onTileSelect(x, y));
        this.tiles[y][x] = baseTile;
        this.coverMap[y][x] = CoverTypes.NONE;
        this.obstacleMap[y][x] = false;
      }
    }

    BattleBoardConfig.obstacles.forEach((obstacle) => {
      if (!this.isWithinBoard(obstacle.x, obstacle.y)) {
        return;
      }
      this.coverMap[obstacle.y][obstacle.x] =
        obstacle.cover === 'high' ? CoverTypes.HIGH : CoverTypes.LOW;
      this.obstacleMap[obstacle.y][obstacle.x] = obstacle.cover === 'high';
      const { px, py } = this.gridToWorld(obstacle.x, obstacle.y);
      const tint =
        obstacle.cover === 'high' ? 0x4c6d92 : 0x3a556f;
      this.add
        .rectangle(px, py, CELL_SIZE - 10, CELL_SIZE - 10, tint, 0.85)
        .setDepth(2);
    });
  }

  spawnUnits() {
    this.units = [];
    this.unitSprites.clear();
    this.occupiedTiles.clear();

    PlayerSquadConfig.forEach((config) => {
      const unit = createUnit({ ...config, team: 'player' });
      unit.turnState = { moved: false, acted: false, extraMovement: 0 };
      this.units.push(unit);
      this.createUnitSprite(unit, 'party-leader');
      this.occupyTile(unit.position, unit.id);
    });

    EnemySquadConfig.forEach((config, index) => {
      const texture = index === 2 ? 'enemy-marksman' : 'enemy-raider';
      const unit = createUnit({ ...config, team: 'enemy' });
      unit.turnState = { moved: false, acted: false, extraMovement: 0 };
      this.units.push(unit);
      this.createUnitSprite(unit, texture);
      this.occupyTile(unit.position, unit.id);
    });
  }

  setupInput() {
    this.inputManager = new InputManager(this);
  }

  bindEvents() {
    this.game.events.emit('ui:scene', { id: 'battle' });
    this.infoText = this.add.text(40, 24, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#d6efff'
    });
    this.promptText = this.add.text(40, 56, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#b1dcff'
    });
  }

  presentTutorial() {
    if (!this.state.tutorials.battleControls) {
      this.setPrompt('Select a unit (1-3). Left-click to move or attack. Space: End Turn.');
      markTutorialSeen('battleControls');
    } else {
      this.setPrompt('Eliminate the enemy patrol.');
    }
  }

  startPlayerPhase() {
    this.turnPhase = TurnPhases.PLAYER;
    this.resetTurnStates('player');
    this.selectNextAvailablePlayer();
    this.setInfo('Player Phase');
  }

  startEnemyPhase() {
    this.turnPhase = TurnPhases.ENEMY;
    this.resetTurnStates('enemy');
    this.setInfo('Enemy Phase');
    this.setPrompt('Enemies are acting...');
    this.time.delayedCall(500, () => {
      this.processEnemyTurn(0);
    });
  }

  resetTurnStates(team) {
    this.units.forEach((unit) => {
      if (unit.team !== team || !isUnitAlive(unit)) {
        return;
      }
      unit.turnState = { moved: false, acted: false, extraMovement: 0 };
      unit.acted = false;
    });
  }

  selectNextAvailablePlayer() {
    const available = this.units.filter(
      (unit) => unit.team === 'player' && isUnitAlive(unit) && !unit.acted
    );
    if (available.length === 0) {
      this.startEnemyPhase();
      return;
    }
    this.selectUnit(available[0]);
  }

  selectUnit(unit) {
    this.selectedUnit = unit;
    this.highlightSelection();
    this.updateReachableTiles();
    this.updateAttackableTargets();
    this.updateInfoForUnit(unit);
  }

  highlightSelection() {
    this.tiles.flat().forEach((tile) => {
      tile.setStrokeStyle(0);
    });
    if (!this.selectedUnit) {
      return;
    }
    const { x, y } = this.selectedUnit.position;
    const tile = this.tiles[y][x];
    tile.setStrokeStyle(3, 0x54c7ff, 1);
  }

  updateReachableTiles() {
    this.clearHighlights();
    if (!this.selectedUnit || this.turnPhase !== TurnPhases.PLAYER) {
      return;
    }
    const start = this.selectedUnit.position;
    const range = this.selectedUnit.moveRange + (this.selectedUnit.turnState.extraMovement ?? 0);
    const blocked = (pos) => this.isBlocked(pos, this.selectedUnit.id);
    const reachable = bfsRange(
      start,
      this.selectedUnit.turnState.moved ? 0 : range,
      blocked,
      BOARD_COLS,
      BOARD_ROWS
    );
    this.reachableTiles = reachable;
    reachable.forEach((node) => {
      if (node.distance === 0) {
        return;
      }
      const { px, py } = this.gridToWorld(node.x, node.y);
      const highlight = this.add.image(px, py, 'highlight-move').setDepth(1.5);
      highlight.setScale(CELL_SIZE / 64);
      this.highlightGroup.add(highlight);
    });
  }

  updateAttackableTargets() {
    if (!this.selectedUnit) {
      this.attackableTargets = [];
      return;
    }
    const enemies = this.units.filter((unit) => unit.team === 'enemy' && isUnitAlive(unit));
    const attackable = enemies.filter((enemy) => this.distanceBetweenUnits(this.selectedUnit, enemy) <= this.selectedUnit.attackRange);
    this.attackableTargets = attackable;

    attackable.forEach((enemy) => {
      const { px, py } = this.gridToWorld(enemy.position.x, enemy.position.y);
      const highlight = this.add.image(px, py, 'highlight-attack').setDepth(1.6);
      highlight.setScale(CELL_SIZE / 64);
      this.highlightGroup.add(highlight);
    });
  }

  clearHighlights() {
    this.highlightGroup.clear(true, true);
  }

  onTileHover(x, y) {
    if (!this.selectedUnit || this.turnPhase !== TurnPhases.PLAYER) {
      return;
    }
    const tile = this.tiles[y][x];
    const key = this.tileKey({ x, y });
    if (this.occupiedTiles.has(key)) {
      const unit = this.getUnitById(this.occupiedTiles.get(key));
      if (unit && unit.team === 'enemy' && this.distanceBetweenUnits(this.selectedUnit, unit) <= this.selectedUnit.attackRange) {
        tile.setStrokeStyle(3, 0xff8a65, 1);
        this.setPrompt(`${unit.name} | ${unit.hp} HP | Click to attack`);
        return;
      }
    }
    if (this.reachableTiles.some((node) => node.x === x && node.y === y)) {
      tile.setStrokeStyle(3, 0x54ffb1, 1);
      this.setPrompt('Click to move');
    }
  }

  onTileOut(x, y) {
    const tile = this.tiles[y][x];
    tile.setStrokeStyle(0);
    this.highlightSelection();
  }

  onTileSelect(x, y) {
    if (this.turnPhase !== TurnPhases.PLAYER || !this.selectedUnit) {
      return;
    }
    const key = this.tileKey({ x, y });
    const occupantId = this.occupiedTiles.get(key);
    if (occupantId) {
      const target = this.getUnitById(occupantId);
      if (target && target.team === 'enemy') {
        this.playerAttack(target);
      }
      return;
    }
    if (this.selectedUnit.turnState.moved) {
      return;
    }
    if (!this.reachableTiles.some((node) => node.x === x && node.y === y)) {
      return;
    }
    this.playerMoveTo({ x, y });
  }

  playerMoveTo(destination) {
    const unit = this.selectedUnit;
    this.freeTile(unit.position);
    unit.position = { ...destination };
    this.occupyTile(unit.position, unit.id);
    this.selectedUnit.turnState.moved = true;
    this.selectedUnit.turnState.extraMovement = 0;

    const sprite = this.unitSprites.get(unit.id);
    const { px, py } = this.gridToWorld(destination.x, destination.y);
    this.tweens.add({
      targets: sprite,
      x: px,
      y: py,
      duration: 220,
      ease: 'Sine.easeInOut'
    });

    this.updateReachableTiles();
    this.updateAttackableTargets();
    this.checkAutoEndPlayerTurn();
  }

  playerAttack(target) {
    const attacker = this.selectedUnit;
    if (attacker.turnState.acted) {
      return;
    }
    const cover = this.coverMap[target.position.y][target.position.x];
    const result = resolveAttack(attacker, target, { cover });
    this.showAttackResult(attacker, target, result);
    attacker.turnState.acted = true;
    attacker.acted = true;
    this.updateAttackableTargets();
    this.afterAttack(attacker, target);
  }

  playerAbility(abilityId) {
    if (!this.selectedUnit) {
      return;
    }
    const result = resolveAbility(abilityId, this.selectedUnit, this.findAbilityTarget(abilityId));
    if (!result.success) {
      this.game.events.emit('ui:toast', { text: result.message, severity: 'warning' });
      return;
    }
    if (result.type === 'dash') {
      this.selectedUnit.turnState.extraMovement += result.extraMovement ?? this.selectedUnit.moveRange;
      this.selectedUnit.turnState.moved = false;
      this.updateReachableTiles();
      this.game.events.emit('ui:toast', { text: `${this.selectedUnit.name} prepares to dash!`, severity: 'info' });
    }
    if (result.type === 'suppress') {
      this.game.events.emit('ui:toast', { text: result.message, severity: 'success' });
    }
    if (result.type === 'repair') {
      this.game.events.emit('ui:toast', { text: result.message, severity: 'success' });
    }
    this.checkAutoEndPlayerTurn();
    this.updateInfoForUnit(this.selectedUnit);
  }

  findAbilityTarget(abilityId) {
    if (abilityId === 'suppress') {
      return this.attackableTargets[0] ?? null;
    }
    if (abilityId === 'repair') {
      return this.selectedUnit;
    }
    return null;
  }

  showAttackResult(attacker, target, result) {
    const attackerSprite = this.unitSprites.get(attacker.id);
    const targetSprite = this.unitSprites.get(target.id);
    const text = this.add.text(targetSprite.x, targetSprite.y - 40, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff'
    });
    if (result.hit) {
      text.setText(`-${result.damage} HP`);
      text.setColor('#ff8585');
    } else {
      text.setText('MISS');
      text.setColor('#9bb0ff');
    }
    this.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy()
    });

    attackerSprite.setTint(0xffd27f);
    this.time.delayedCall(150, () => attackerSprite.clearTint());

    if (!isUnitAlive(target)) {
      this.onUnitDown(target);
    }
  }

  afterAttack(attacker, target) {
    this.checkBattleResolution();
    if (this.turnPhase !== TurnPhases.PLAYER) {
      return;
    }
    this.checkAutoEndPlayerTurn();
  }

  checkAutoEndPlayerTurn() {
    if (!this.selectedUnit) {
      return;
    }
    const done =
      this.selectedUnit.turnState.moved &&
      this.selectedUnit.turnState.acted;
    if (done) {
      this.selectedUnit.acted = true;
      this.clearHighlights();
      this.selectNextAvailablePlayer();
    }
  }

  handleAbilityInputs() {
    if (!this.selectedUnit || this.turnPhase !== TurnPhases.PLAYER) {
      return;
    }
    if (this.inputManager.justPressed('ability1')) {
      this.playerAbility('dash');
    } else if (this.inputManager.justPressed('ability2')) {
      this.playerAbility('suppress');
    } else if (this.inputManager.justPressed('ability3')) {
      this.playerAbility('repair');
    }
  }

  handleEndTurnInput() {
    if (this.turnPhase !== TurnPhases.PLAYER) {
      return;
    }
    if (this.inputManager.justPressed('endTurn')) {
      if (this.selectedUnit) {
        this.selectedUnit.acted = true;
      }
      this.selectNextAvailablePlayer();
    }
  }

  processEnemyTurn(index) {
    const enemies = this.units.filter((unit) => unit.team === 'enemy' && isUnitAlive(unit));
    if (index >= enemies.length) {
      this.startPlayerPhase();
      return;
    }
    const unit = enemies[index];
    this.takeEnemyAction(unit, () => {
      this.checkBattleResolution();
      if (this.turnPhase !== TurnPhases.ENEMY) {
        return;
      }
      this.time.delayedCall(400, () => this.processEnemyTurn(index + 1));
    });
  }

  takeEnemyAction(unit, done) {
    const target = this.findNearestPlayer(unit);
    if (!target) {
      done();
      return;
    }
    const distance = this.distanceBetweenUnits(unit, target);
    if (distance <= unit.attackRange) {
      this.enemyAttack(unit, target);
      this.time.delayedCall(350, done);
      return;
    }
    const path = this.findPath(unit.position, target.position, unit.id);
    if (!path || path.length <= 1) {
      this.time.delayedCall(200, done);
      return;
    }
    const steps = Math.min(unit.moveRange, path.length - 1);
    const destination = path[steps];
    this.enemyMove(unit, destination, () => {
      const newDistance = this.distanceBetweenUnits(unit, target);
      if (newDistance <= unit.attackRange) {
        this.enemyAttack(unit, target);
      }
      this.time.delayedCall(200, done);
    });
  }

  enemyMove(unit, destination, onComplete) {
    this.freeTile(unit.position);
    unit.position = { ...destination };
    this.occupyTile(unit.position, unit.id);
    const sprite = this.unitSprites.get(unit.id);
    const { px, py } = this.gridToWorld(destination.x, destination.y);
    this.tweens.add({
      targets: sprite,
      x: px,
      y: py,
      duration: 250,
      ease: 'Sine.easeInOut',
      onComplete
    });
  }

  enemyAttack(attacker, target) {
    const cover = this.coverMap[target.position.y][target.position.x];
    const result = resolveAttack(attacker, target, { cover });
    this.showAttackResult(attacker, target, result);
    if (!result.hit) {
      return;
    }
  }

  checkBattleResolution() {
    const playersAlive = this.units.some((unit) => unit.team === 'player' && isUnitAlive(unit));
    const enemiesAlive = this.units.some((unit) => unit.team === 'enemy' && isUnitAlive(unit));

    if (!enemiesAlive) {
      this.onBattleWon();
    } else if (!playersAlive) {
      this.onBattleLost();
    }
  }

  onBattleWon() {
    this.setInfo('Victory!');
    addResource('minerals', 10);
    addResource('scrap', 5);
    adjustHull(1);
    this.game.events.emit('ui:toast', {
      text: 'Victory! Minerals +10, Scrap +5, Hull repaired +1.',
      severity: 'success'
    });
    if (this.battleOrigin === 'planet') {
      this.state.planet.encounterTriggered = true;
      changeScene('PlanetScene', { entry: 'battle', outcome: 'battle-win' });
      this.time.delayedCall(800, () => {
        this.scene.start('PlanetScene', { outcome: 'battle-win' });
      });
    } else {
      const enemy = this.state.space.enemyPatrols.find((p) => p.id === this.enemyId);
      if (enemy) {
        enemy.defeated = true;
      }
      changeScene('SpaceScene', { entry: 'battle', outcome: 'battle-win', enemyId: this.enemyId });
      this.time.delayedCall(800, () => {
        this.scene.start('SpaceScene', { outcome: 'battle-win' });
      });
    }
  }

  onBattleLost() {
    this.setInfo('Defeat...');
    adjustHull(-3);
    this.game.events.emit('ui:toast', {
      text: 'Defeat. Hull integrity compromised.',
      severity: 'warning'
    });
    resetState();
    changeScene('SpaceScene', { entry: 'battle', outcome: 'battle-loss' });
    this.time.delayedCall(800, () => {
      this.scene.start('SpaceScene', { outcome: 'battle-loss' });
    });
  }

  onUnitDown(unit) {
    const sprite = this.unitSprites.get(unit.id);
    sprite.setTint(0x444444);
    sprite.setAlpha(0.6);
    this.freeTile(unit.position);
    this.checkBattleResolution();
  }

  updateInfoForUnit(unit) {
    if (!unit) {
      this.setInfo('');
      return;
    }
    const cover = this.coverMap[unit.position.y][unit.position.x];
    this.setInfo(
      `${unit.name} — HP ${unit.hp}/${unit.maxHp} | Move ${unit.moveRange} | Range ${unit.attackRange} | Cover ${cover}`
    );
  }

  setInfo(text) {
    if (this.infoText?.text === text) {
      return;
    }
    this.infoText?.setText(text);
  }

  setPrompt(text) {
    if (this.promptCache === text) {
      return;
    }
    this.promptCache = text;
    this.promptText?.setText(text ?? '');
    this.game.events.emit('ui:prompt', { text: text ?? '' });
  }

  createUnitSprite(unit, texture) {
    const { px, py } = this.gridToWorld(unit.position.x, unit.position.y);
    const sprite = this.add.sprite(px, py, texture);
    sprite.setDepth(4);
    if (unit.team === 'enemy') {
      sprite.setTint(0xff8585);
    } else {
      sprite.setTint(0x8bd1ff);
    }
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      if (unit.team === 'player' && this.turnPhase === TurnPhases.PLAYER && isUnitAlive(unit)) {
        this.selectUnit(unit);
      } else if (unit.team === 'enemy' && this.turnPhase === TurnPhases.PLAYER && this.selectedUnit) {
        this.playerAttack(unit);
      }
    });
    this.unitSprites.set(unit.id, sprite);
  }

  occupyTile(position, unitId) {
    this.occupiedTiles.set(this.tileKey(position), unitId);
  }

  freeTile(position) {
    this.occupiedTiles.delete(this.tileKey(position));
  }

  tileKey(position) {
    return `${position.x},${position.y}`;
  }

  getUnitById(id) {
    return this.units.find((unit) => unit.id === id);
  }

  isBlocked(position, ignoreUnitId) {
    if (!this.isWithinBoard(position.x, position.y)) {
      return true;
    }
    if (this.obstacleMap[position.y][position.x]) {
      return true;
    }
    const key = this.tileKey(position);
    const occupant = this.occupiedTiles.get(key);
    if (!occupant) {
      return false;
    }
    return occupant !== ignoreUnitId;
  }

  isWithinBoard(x, y) {
    return x >= 0 && y >= 0 && x < BOARD_COLS && y < BOARD_ROWS;
  }

  gridToWorld(x, y) {
    return {
      px: this.boardOrigin.x + x * CELL_SIZE + CELL_SIZE / 2,
      py: this.boardOrigin.y + y * CELL_SIZE + CELL_SIZE / 2
    };
  }

  distanceBetweenUnits(a, b) {
    return Math.abs(a.position.x - b.position.x) + Math.abs(a.position.y - b.position.y);
  }

  findNearestPlayer(enemy) {
    let best = null;
    this.units.forEach((unit) => {
      if (unit.team !== 'player' || !isUnitAlive(unit)) {
        return;
      }
      const distance = this.distanceBetweenUnits(enemy, unit);
      if (!best || distance < best.distance) {
        best = { unit, distance };
      }
    });
    return best?.unit ?? null;
  }

  findPath(start, goal, ignoreUnitId) {
    return aStar(start, goal, (pos) => this.isBlocked(pos, ignoreUnitId), BOARD_COLS, BOARD_ROWS);
  }

  destroy() {
    this.inputManager?.destroy();
  }
}
