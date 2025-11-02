import Phaser from 'phaser';
import InputManager from '../systems/input.js';
import { getState, changeScene, addResource, markTutorialSeen } from '../systems/state.js';
import { PlanetEncounterConfig } from '../systems/content.js';
import { SPRITE_SIZES } from './SpaceScene.js';

const TILE_SIZE = 32;
const MAP_TILES = PlanetEncounterConfig.mapSize;
const MAP_SIZE = MAP_TILES * TILE_SIZE;
const MOVE_SPEED = 180;

export default class PlanetScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PlanetScene' });
    this.transitionData = {};
    this.resourceCollected = false;
    this.encounterTriggered = false;
    this.promptCache = null;
    this.defaultPrompt = 'Explore the landing site. E interacts.';
  }

  init(data) {
    this.transitionData = data ?? {};
    this.state = getState();
    this.resourceCollected = this.state.planet.resourceCollected;
    this.encounterTriggered = this.state.planet.encounterTriggered;
  }

  create() {
    this.promptCache = null;
    this.setupWorld();
    this.createGround();
    this.createObstacles();
    this.createLandingZone();
    this.createResourceNode();
    this.createParty();
    this.createEncounterArea();
    this.setupInput();
    this.bindEvents();
    this.presentTutorial();
    this.refreshUI();

    if (this.transitionData.outcome === 'battle-win') {
      this.game.events.emit('ui:toast', { text: 'Battle won! Minerals +10, Scrap +5.', severity: 'success' });
    } else if (this.transitionData.outcome === 'battle-loss') {
      this.game.events.emit('ui:toast', { text: 'Squad defeated. Returning to orbit.', severity: 'warning' });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    this.handleMovement();
    this.updateFollowers();
    this.checkLandingInteraction();
    this.checkResourceInteraction();
    this.checkEncounterTrigger();
  }

  setupWorld() {
    this.physics.world.setBounds(0, 0, MAP_SIZE, MAP_SIZE);
    this.cameras.main.setBounds(0, 0, MAP_SIZE, MAP_SIZE);
    this.cameras.main.setBackgroundColor('#0b161e');
  }

  createGround() {
    this.groundTiles = this.add.tileSprite(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE, MAP_SIZE, 'tile-ground');
    this.groundTiles.setTileScale(4, 4);
  }

  createObstacles() {
    this.blockers = this.physics.add.staticGroup();
    const obstacleRects = [
      new Phaser.Geom.Rectangle(600, 300, 160, 160),
      new Phaser.Geom.Rectangle(900, 700, 180, 120),
      new Phaser.Geom.Rectangle(1200, 500, 180, 180),
      new Phaser.Geom.Rectangle(400, 960, 220, 120)
    ];

    obstacleRects.forEach((rect) => {
      const blocker = this.add.rectangle(rect.x, rect.y, rect.width, rect.height, 0x1f2c36, 0.8);
      blocker.setOrigin(0, 0);
      this.physics.add.existing(blocker, true);
      this.blockers.add(blocker);
    });
  }

  createLandingZone() {
    const { landingZone } = PlanetEncounterConfig;
    this.landingZone = this.add
      .image(landingZone.x * TILE_SIZE, landingZone.y * TILE_SIZE, 'landing-zone')
      .setDepth(2)
      .setAlpha(0.6);
    this.landingZoneCircle = new Phaser.Geom.Circle(this.landingZone.x, this.landingZone.y, 80);
  }

  createResourceNode() {
    const { resourceNode } = PlanetEncounterConfig;
    this.resourceNode = this.physics.add.staticSprite(
      resourceNode.x * TILE_SIZE,
      resourceNode.y * TILE_SIZE,
      'resource-node'
    );

    // Scale resource node to target size
    const scale = SPRITE_SIZES.RESOURCE_NODE_SIZE / Math.max(this.resourceNode.width, this.resourceNode.height);
    this.resourceNode.setScale(scale);

    this.resourceNode.setDepth(3);
    if (this.resourceCollected) {
      this.resourceNode.setTint(0x666666);
    }
  }

  createParty() {
    this.party = [];
    this.leader = this.physics.add.sprite(this.landingZone.x + 40, this.landingZone.y - 40, 'party-leader');

    // Scale party leader to target size
    const leaderScale = Math.min(
      SPRITE_SIZES.PARTY_LEADER_WIDTH / this.leader.width,
      SPRITE_SIZES.PARTY_LEADER_HEIGHT / this.leader.height
    );
    this.leader.setScale(leaderScale);

    this.leader.setDepth(5);
    this.leader.body.setSize(18, 24);
    this.leader.body.setCollideWorldBounds(true);

    this.companions = [
      this.physics.add.sprite(this.leader.x - 32, this.leader.y + 24, 'party-companion'),
      this.physics.add.sprite(this.leader.x - 64, this.leader.y + 48, 'party-companion')
    ];

    // Scale companions to target size
    this.companions.forEach((companion) => {
      const companionScale = Math.min(
        SPRITE_SIZES.PARTY_COMPANION_WIDTH / companion.width,
        SPRITE_SIZES.PARTY_COMPANION_HEIGHT / companion.height
      );
      companion.setScale(companionScale);
      companion.setDepth(4);
      companion.body.setCollideWorldBounds(true);
    });

    this.party = [this.leader, ...this.companions];

    this.physics.add.collider(this.leader, this.blockers);
    this.companions.forEach((member) => {
      this.physics.add.collider(member, this.blockers);
    });

    this.cameras.main.startFollow(this.leader, true, 0.1, 0.1);
  }

  createEncounterArea() {
    const { encounterTrigger } = PlanetEncounterConfig;
    this.encounterZone = new Phaser.Geom.Circle(
      encounterTrigger.x * TILE_SIZE,
      encounterTrigger.y * TILE_SIZE,
      encounterTrigger.radius * TILE_SIZE
    );
    this.debugEncounter = this.add.graphics();
    this.debugEncounter.lineStyle(2, 0xff7a7a, 0.4);
    this.debugEncounter.strokeCircleShape(this.encounterZone);
  }

  setupInput() {
    this.inputManager = new InputManager(this);
  }

  bindEvents() {
    this.game.events.emit('ui:scene', { id: 'planet' });
  }

  presentTutorial() {
    if (!this.state.tutorials.planetMovement) {
      this.setPrompt('Explore the landing site. Shift to sprint. E to interact.');
      markTutorialSeen('planetMovement');
    } else {
      this.setPrompt('Locate the mineral node and enemy squad.');
    }
    this.defaultPrompt = 'Explore the landing site. E interacts.';
  }

  refreshUI() {
    this.game.events.emit('ui:resources', {
      hero: this.state.hero,
      inventory: this.state.inventory
    });
  }

  handleMovement() {
    const { up, down, left, right } = this.inputManager.directional;
    const velocity = new Phaser.Math.Vector2(
      (right ? 1 : 0) - (left ? 1 : 0),
      (down ? 1 : 0) - (up ? 1 : 0)
    );

    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(MOVE_SPEED * (this.inputManager.isDown('sprint') ? 1.35 : 1));
      this.leader.setVelocity(velocity.x, velocity.y);
    } else {
      this.leader.setVelocity(0, 0);
    }
  }

  updateFollowers() {
    const spacing = 42;
    let leaderPosition = new Phaser.Math.Vector2(this.leader.x, this.leader.y);

    this.companions.forEach((companion) => {
      const toLeader = leaderPosition.clone().subtract(new Phaser.Math.Vector2(companion.x, companion.y));
      const distance = toLeader.length();
      if (distance > spacing) {
        toLeader.normalize();
        companion.setVelocity(toLeader.x * MOVE_SPEED * 0.9, toLeader.y * MOVE_SPEED * 0.9);
      } else {
        companion.setVelocity(0, 0);
      }
      leaderPosition = new Phaser.Math.Vector2(companion.x, companion.y);
    });
  }

  checkLandingInteraction() {
    const inZone = Phaser.Geom.Circle.ContainsPoint(this.landingZoneCircle, this.leader);
    if (inZone) {
      this.setPrompt('E: Return to orbit');
      if (this.inputManager.justPressed('interact')) {
        changeScene('SpaceScene', { entry: 'planet-exit' });
        this.scene.start('SpaceScene', { from: 'planet' });
      }
    } else {
      this.setPrompt(null);
    }
  }

  checkResourceInteraction() {
    if (this.resourceCollected) {
      return;
    }
    const distance = Phaser.Math.Distance.Between(
      this.leader.x,
      this.leader.y,
      this.resourceNode.x,
      this.resourceNode.y
    );
    if (distance < 70) {
      this.setPrompt('E: Harvest minerals');
      if (this.inputManager.justPressed('interact')) {
        this.resourceCollected = true;
        this.state.planet.resourceCollected = true;
        addResource('minerals', 10);
        this.resourceNode.setTint(0x666666);
        this.game.events.emit('ui:toast', { text: 'Minerals +10 collected.', severity: 'success' });
        this.refreshUI();
      }
    } else if (!this.encounterTriggered) {
      this.setPrompt(null);
    }
  }

  checkEncounterTrigger() {
    if (this.encounterTriggered) {
      return;
    }
    const distance = Phaser.Math.Distance.Between(
      this.leader.x,
      this.leader.y,
      this.encounterZone.x,
      this.encounterZone.y
    );
    if (distance < this.encounterZone.radius - 10) {
      this.encounterTriggered = true;
      this.state.planet.encounterTriggered = true;
      this.debugEncounter.clear();
      changeScene('BattleScene', { entry: 'planet', planetId: this.transitionData.planetId });
      this.scene.start('BattleScene', { origin: 'planet' });
    }
  }

  destroy() {
    this.inputManager?.destroy();
  }

  setPrompt(message) {
    if (this.promptCache === message) {
      return;
    }
    this.promptCache = message;
    const display = message ?? this.defaultPrompt ?? '';
    this.game.events.emit('ui:prompt', { text: display });
  }
}
