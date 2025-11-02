import Phaser from "phaser";
import InputManager from "../systems/input.js";
import {
    getState,
    changeScene,
    adjustFuel,
    addResource,
    markPlanetDiscovered,
    markDerelictClaimed,
    updateSpacePlayerPosition,
    revealSpaceTile,
    markTutorialSeen,
} from "../systems/state.js";

const UNIT_SIZE = 32;

// Tweakable spaceship parameters
const DEFAULT_PARAMS = {
    PLAYER_ACCEL: 250, // Increased for faster traversal
    PLAYER_MAX_SPEED: 280, // Increased max speed
    PLAYER_TURN_SPEED: 180, // Angular acceleration in degrees/s² (for inertial rotation)
    PLAYER_MAX_TURN_RATE: 200, // Max angular velocity in degrees/s
    ANGULAR_DRAG: 0.92, // Damping for angular velocity (lower = more resistance)
    PLAYER_BRAKE_FORCE: 1200, // Stronger brake impulse
    PASSIVE_DRAG: 0.08, // Reduced passive drag for better glide
    BOOST_MULTIPLIER: 1.4, // Increased boost effectiveness
    FUEL_DRAIN_PER_SECOND: 4,
    SHIP_DRAG: 80, // Reduced for less resistance
    SHIP_MASS: 1.0,
    STRAFE_ACCEL: 200, // Acceleration for strafe thrusters (when mouse aiming)
};

const AGGRO_RADIUS_UNITS = 12;
const INTERACT_RADIUS_PIXELS = 120;

// Target sprite sizes (pixels) - adjust these to change how big sprites appear in-game
// EXPORTED for use in other scenes (PlanetScene, BattleScene)
export const SPRITE_SIZES = {
    // Space Scene - Ships & Objects
    PLAYER_SHIP_WIDTH: 32,
    PLAYER_SHIP_HEIGHT: 32,
    ENEMY_SHIP_WIDTH: 32,
    ENEMY_SHIP_HEIGHT: 32,
    PLANET_SIZE: 64, // Diameter (includes both Lush and Ice)
    ORBIT_RING_SIZE: 96, // Diameter (shows around planets)
    DERELICT_SIZE: 32,
    RESOURCE_NODE_SIZE: 24,

    // Planet Scene - Characters
    PARTY_LEADER_WIDTH: 28,
    PARTY_LEADER_HEIGHT: 36,
    PARTY_COMPANION_WIDTH: 28,
    PARTY_COMPANION_HEIGHT: 36,
    LANDING_ZONE_SIZE: 48,

    // Battle Scene - Enemy Units
    ENEMY_RAIDER_WIDTH: 28,
    ENEMY_RAIDER_HEIGHT: 36,
    ENEMY_MARKSMAN_WIDTH: 28,
    ENEMY_MARKSMAN_HEIGHT: 36,

    // Battle Scene - Tiles (16x16 grid-based)
    TILE_SIZE: 16, // Used for all tile types
};

const PLANET_TEXTURES = {
    Lush: "planet-lush",
    Ice: "planet-ice",
};

export default class SpaceScene extends Phaser.Scene {
    constructor() {
        super({ key: "SpaceScene" });
        this.fuelAccumulator = 0;
        this.promptCache = null;
        this.fogRevealQueue = [];
        this.lastFogTile = null;
        this.broadcastAccumulator = 0;
        this.thrustVector = new Phaser.Math.Vector2();
        this.brakeVector = new Phaser.Math.Vector2();
        this.fogTexture = null;
        this.fogContext = null;
        this.fogImage = null;
        this.fogDirty = false;
        this.fogRevealRadius = 5;

        // Angular velocity for rotation inertia
        this.angularVelocity = 0;

        // Mouse aiming state
        this.mouseAiming = false;

        // Logical rotation for physics (0 = right, π/2 = down, etc.)
        this.shipRotation = 0;

        // Tweaker state
        this.params = { ...DEFAULT_PARAMS };
        this.tweakerVisible = true;
        this.tweakerUI = null;
    }

    init(data) {
        this.transitionData = data ?? {};
        this.state = getState();
    }

    create() {
        this.setupWorld();
        this.setupStarfield();
        this.setupFog();
        this.setupPlayer();
        this.setupEntities();
        this.setupInput();
        this.setupEvents();
        this.setupTweaker();

        this.refreshUI();
        this.presentTutorial();

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    update(time, delta) {
        const dt = delta / 1000;
        this.starfieldFar.tilePositionX = this.cameras.main.scrollX * 0.2;
        this.starfieldFar.tilePositionY = this.cameras.main.scrollY * 0.2;
        this.starfieldMid.tilePositionX = this.cameras.main.scrollX * 0.4;
        this.starfieldMid.tilePositionY = this.cameras.main.scrollY * 0.4;
        this.starfieldClose.tilePositionX = this.cameras.main.scrollX * 0.6;
        this.starfieldClose.tilePositionY = this.cameras.main.scrollY * 0.6;
        this.handleMovement(dt);
        this.handleFuel(dt);
        this.updateEnemies(dt);
        this.handleInteractions();
        this.updateFog();
        this.updateBroadcast(delta);
        this.handleTweakerInput();
    }

    setupWorld() {
        this.worldWidth = this.state.space.bounds.width * UNIT_SIZE;
        this.worldHeight = this.state.space.bounds.height * UNIT_SIZE;
        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setBackgroundColor("#050915");
    }

    setupStarfield() {
        const { width, height } = this.cameras.main;
        this.starfieldFar = this.add
            .tileSprite(0, 0, width, height, "starfield-far")
            .setOrigin(0, 0)
            .setScrollFactor(0);
        this.starfieldMid = this.add
            .tileSprite(0, 0, width, height, "starfield-mid")
            .setOrigin(0, 0)
            .setScrollFactor(0);
        this.starfieldClose = this.add
            .tileSprite(0, 0, width, height, "starfield-close")
            .setOrigin(0, 0)
            .setScrollFactor(0);

        this.scale.on("resize", this.handleResize, this);
    }

    setupFog() {
        const tileWidth = this.state.space.bounds.width;
        const tileHeight = this.state.space.bounds.height;

        if (this.textures.exists("space-fog")) {
            this.textures.remove("space-fog");
        }

        this.fogTexture = this.textures.createCanvas(
            "space-fog",
            tileWidth,
            tileHeight
        );
        this.fogContext = this.fogTexture.getContext();
        this.fogContext.fillStyle = "rgba(5, 9, 21, 0.94)";
        this.fogContext.fillRect(0, 0, tileWidth, tileHeight);
        this.fogTexture.refresh();

        this.fogImage = this.add
            .image(0, 0, "space-fog")
            .setOrigin(0, 0)
            .setDisplaySize(this.worldWidth, this.worldHeight)
            .setScrollFactor(1)
            .setDepth(100)
            .setBlendMode(Phaser.BlendModes.MULTIPLY);

        this.state.space.discoveredTiles.forEach((key) => {
            const [tileX, tileY] = key.split(",").map(Number);
            this.queueFogReveal(tileX, tileY);
        });
        this.flushFogQueue(true);
    }

    setupPlayer() {
        const startX = this.state.space.player.x * UNIT_SIZE;
        const startY = this.state.space.player.y * UNIT_SIZE;
        this.ship = this.physics.add.sprite(startX, startY, "ship-player");
        // Disable Phaser's drag/damping - we handle velocity manually
        this.ship.setDamping(false);
        this.ship.setDrag(0, 0);
        this.ship.setMass(this.params.SHIP_MASS);
        // No max velocity - we handle capping manually
        this.ship.setMaxVelocity(10000, 10000);
        this.ship.setCollideWorldBounds(true);
        this.ship.setDepth(10);

        // Scale player ship to target size (maintaining aspect ratio)
        const shipScale = Math.min(
            SPRITE_SIZES.PLAYER_SHIP_WIDTH / this.ship.width,
            SPRITE_SIZES.PLAYER_SHIP_HEIGHT / this.ship.height
        );
        this.ship.setScale(shipScale);

        // Rotate ship sprite 90 degrees clockwise so it faces right (0 radians)
        // This is a visual offset - the sprite art points up by default
        this.shipRotationOffset = Math.PI / 2; // 90 degrees in radians

        // Create thrust flame sprite
        this.thrustFlame = this.add.sprite(startX, startY, "thrust-flame");
        this.thrustFlame.setDepth(9); // Behind ship
        this.thrustFlame.setOrigin(0.5, 0); // Origin at top center, so it extends backward
        this.thrustFlame.setVisible(false);
        this.thrustFlame.setAlpha(0.9);

        this.cameras.main.startFollow(this.ship, true, 0.08, 0.08);
    }

    setupEntities() {
        this.planets = [];
        this.enemyPatrols = [];
        this.derelicts = [];

        this.state.space.planets.forEach((planet) => {
            const texture = PLANET_TEXTURES[planet.biome] ?? "planet-lush";
            const planetSprite = this.add.image(
                planet.position.x * UNIT_SIZE,
                planet.position.y * UNIT_SIZE,
                texture
            );
            planetSprite.setDepth(5);
            planetSprite.setData("data", planet);

            // Scale planet to target size
            const planetScale =
                SPRITE_SIZES.PLANET_SIZE /
                Math.max(planetSprite.width, planetSprite.height);
            planetSprite.setScale(planetScale);

            const orbit = this.add.image(
                planetSprite.x,
                planetSprite.y,
                "orbit-ring"
            );
            orbit.setDepth(4);
            orbit.setAlpha(planet.landingAllowed ? 0.4 : 0.2);

            const label = this.add
                .text(planetSprite.x, planetSprite.y + 52, planet.name, {
                    fontFamily: "monospace",
                    fontSize: "14px",
                    color: "#cfe9ff",
                })
                .setOrigin(0.5, 0);
            label.setDepth(6);

            this.planets.push({
                planet,
                sprite: planetSprite,
                orbit,
                label,
            });
        });

        this.enemyGroup = this.physics.add.group();
        this.state.space.enemyPatrols.forEach((enemy) => {
            if (enemy.defeated) {
                enemy.engaged = true;
                return;
            }
            const sprite = this.physics.add.sprite(
                enemy.position.x * UNIT_SIZE,
                enemy.position.y * UNIT_SIZE,
                "ship-enemy"
            );

            // Scale enemy ship to target size (maintaining aspect ratio)
            const enemyScale = Math.min(
                SPRITE_SIZES.ENEMY_SHIP_WIDTH / sprite.width,
                SPRITE_SIZES.ENEMY_SHIP_HEIGHT / sprite.height
            );
            sprite.setScale(enemyScale);

            sprite.setData("info", enemy);
            sprite.setDepth(7);
            sprite.setDamping(true);
            sprite.setDrag(60);
            sprite.setMaxVelocity(140);
            this.enemyGroup.add(sprite);
            this.enemyPatrols.push({ enemy, sprite });
        });

        this.physics.add.overlap(
            this.ship,
            this.enemyGroup,
            this.handleEnemyOverlap,
            null,
            this
        );

        this.derelictGroup = this.physics.add.staticGroup();
        this.state.space.derelicts.forEach((poi) => {
            const sprite = this.derelictGroup
                .create(
                    poi.position.x * UNIT_SIZE,
                    poi.position.y * UNIT_SIZE,
                    "derelict"
                )
                .setDepth(6);

            // Scale derelict to target size
            const scale =
                SPRITE_SIZES.DERELICT_SIZE /
                Math.max(sprite.width, sprite.height);
            sprite.setScale(scale);

            sprite.setData("info", poi);
            this.derelicts.push({ poi, sprite });
        });
    }

    setupInput() {
        this.inputManager = new InputManager(this);
    }

    setupEvents() {
        this.game.events.emit("ui:scene", { id: "space" });

        this.time.delayedCall(2600, () => {
            this.game.events.emit("ui:hint", {
                text: "Explore, collect intel, and prepare for the demo battle.",
            });
        });
    }

    refreshUI() {
        this.game.events.emit("ui:resources", {
            hero: this.state.hero,
            inventory: this.state.inventory,
        });
    }

    presentTutorial() {
        if (!this.state.tutorials.spaceMovement) {
            this.setPrompt(
                "W thrust, S brake, A/D turn. Hold RMB + A/D to strafe. Shift boost. E interact, R scan."
            );
            markTutorialSeen("spaceMovement");
        } else {
            this.setPrompt(
                "W thrust, S brake, A/D turn. RMB to aim. E interact."
            );
        }
    }

    handleMovement(dt) {
        const turnLeft = this.inputManager.isDown("left");
        const turnRight = this.inputManager.isDown("right");
        const accelerating = this.inputManager.isDown("up");
        const braking = this.inputManager.isDown("down");
        const boosting = this.inputManager.isDown("sprint");
        const velocity = this.ship.body.velocity;

        // Reset current thrust for display
        this.currentThrustX = 0;
        this.currentThrustY = 0;

        // Check if right mouse button is down for mouse aiming
        this.mouseAiming = this.inputManager.pointer.rightButtonDown();

        // Handle rotation with angular inertia
        if (this.mouseAiming) {
            // Point ship toward mouse cursor
            const worldPoint = this.cameras.main.getWorldPoint(
                this.inputManager.pointer.x,
                this.inputManager.pointer.y
            );
            const targetAngle = Phaser.Math.Angle.Between(
                this.ship.x,
                this.ship.y,
                worldPoint.x,
                worldPoint.y
            );

            // Smoothly rotate toward target
            const angleDiff = Phaser.Math.Angle.Wrap(
                targetAngle - this.shipRotation
            );
            const turnRate = Phaser.Math.DegToRad(
                this.params.PLAYER_MAX_TURN_RATE
            );
            const maxRotation = turnRate * dt;

            if (Math.abs(angleDiff) < maxRotation) {
                this.shipRotation = targetAngle;
                this.angularVelocity = 0;
            } else {
                const rotationDelta = Math.sign(angleDiff) * maxRotation;
                this.shipRotation += rotationDelta;
                this.angularVelocity = rotationDelta / dt;
            }
        } else {
            // Angular acceleration from A/D keys
            const turnAccel = Phaser.Math.DegToRad(
                this.params.PLAYER_TURN_SPEED
            );
            const maxTurnRate = Phaser.Math.DegToRad(
                this.params.PLAYER_MAX_TURN_RATE
            );

            if (turnLeft) {
                this.angularVelocity -= turnAccel * dt;
            }
            if (turnRight) {
                this.angularVelocity += turnAccel * dt;
            }

            // Apply angular drag for smooth recentering
            if (!turnLeft && !turnRight) {
                this.angularVelocity *= this.params.ANGULAR_DRAG;
                if (Math.abs(this.angularVelocity) < 0.01) {
                    this.angularVelocity = 0;
                }
            }

            // Clamp angular velocity
            this.angularVelocity = Phaser.Math.Clamp(
                this.angularVelocity,
                -maxTurnRate,
                maxTurnRate
            );

            // Apply rotation
            this.shipRotation += this.angularVelocity * dt;
        }

        // Update visual rotation with 90-degree offset
        this.ship.rotation = this.shipRotation + this.shipRotationOffset;

        // Handle thrust
        const accelMagnitude =
            this.params.PLAYER_ACCEL *
            (boosting ? this.params.BOOST_MULTIPLIER : 1);

        if (this.mouseAiming) {
            // Strafe mode when mouse aiming
            const strafeAccel =
                this.params.STRAFE_ACCEL *
                (boosting ? this.params.BOOST_MULTIPLIER : 1);

            if (accelerating && this.state.hero.fuel > 0) {
                // Forward thrust in facing direction
                this.physics.velocityFromRotation(
                    this.shipRotation,
                    accelMagnitude,
                    this.thrustVector
                );
                velocity.x += this.thrustVector.x * dt;
                velocity.y += this.thrustVector.y * dt;
                this.currentThrustX = this.thrustVector.x;
                this.currentThrustY = this.thrustVector.y;
            }

            if (turnLeft && this.state.hero.fuel > 0) {
                // Strafe left (perpendicular to facing)
                this.physics.velocityFromRotation(
                    this.shipRotation - Math.PI / 2,
                    strafeAccel,
                    this.thrustVector
                );
                velocity.x += this.thrustVector.x * dt;
                velocity.y += this.thrustVector.y * dt;
                this.currentThrustX += this.thrustVector.x;
                this.currentThrustY += this.thrustVector.y;
            }

            if (turnRight && this.state.hero.fuel > 0) {
                // Strafe right (perpendicular to facing)
                this.physics.velocityFromRotation(
                    this.shipRotation + Math.PI / 2,
                    strafeAccel,
                    this.thrustVector
                );
                velocity.x += this.thrustVector.x * dt;
                velocity.y += this.thrustVector.y * dt;
                this.currentThrustX += this.thrustVector.x;
                this.currentThrustY += this.thrustVector.y;
            }
        } else {
            // Normal mode - forward thrust only
            if (accelerating && this.state.hero.fuel > 0) {
                this.physics.velocityFromRotation(
                    this.shipRotation,
                    accelMagnitude,
                    this.thrustVector
                );
                velocity.x += this.thrustVector.x * dt;
                velocity.y += this.thrustVector.y * dt;
                this.currentThrustX = this.thrustVector.x;
                this.currentThrustY = this.thrustVector.y;
            }
        }

        // Retro-thrust braking (stronger impulse)
        if (braking && this.state.hero.fuel > 0) {
            const speed = velocity.length();

            if (speed < 5) {
                // Complete stop for very low speeds
                velocity.x = 0;
                velocity.y = 0;
                this.currentThrustX = 0;
                this.currentThrustY = 0;
            } else {
                // Apply retro-thrust opposite to velocity direction
                const brakeForce =
                    this.params.PLAYER_BRAKE_FORCE *
                    (boosting ? this.params.BOOST_MULTIPLIER : 1);

                // Get normalized direction opposite to velocity
                const dirX = -velocity.x / speed;
                const dirY = -velocity.y / speed;

                // Calculate brake acceleration
                const brakeX = dirX * brakeForce;
                const brakeY = dirY * brakeForce;

                // Apply brake force as acceleration (same as thrust)
                const oldVx = velocity.x;
                const oldVy = velocity.y;

                velocity.x += brakeX * dt;
                velocity.y += brakeY * dt;

                // Check if we overshot (velocity changed direction)
                const dot = oldVx * velocity.x + oldVy * velocity.y;
                if (dot < 0) {
                    // We reversed direction, just stop
                    velocity.x = 0;
                    velocity.y = 0;
                }

                this.currentThrustX = brakeX;
                this.currentThrustY = brakeY;
            }
        }

        // Passive drag
        let currentSpeed = velocity.length();
        if (!accelerating && !braking && currentSpeed > 0) {
            const damping = Math.max(0, 1 - this.params.PASSIVE_DRAG * dt);
            velocity.x *= damping;
            velocity.y *= damping;
            currentSpeed = velocity.length();
        }

        // Speed limit
        const speedLimit = boosting
            ? this.params.PLAYER_MAX_SPEED * this.params.BOOST_MULTIPLIER
            : this.params.PLAYER_MAX_SPEED;
        if (currentSpeed > speedLimit) {
            const scale = speedLimit / currentSpeed;
            velocity.x *= scale;
            velocity.y *= scale;
        }

        updateSpacePlayerPosition({
            x: this.ship.x / UNIT_SIZE,
            y: this.ship.y / UNIT_SIZE,
        });

        // Update thrust flame
        this.updateThrustFlame(
            accelerating && this.state.hero.fuel > 0,
            boosting
        );
    }

    updateThrustFlame(isThrusting, isBoosting) {
        if (!this.thrustFlame) return;

        if (isThrusting) {
            this.thrustFlame.setVisible(true);

            // Position at rear of ship (opposite to facing direction)
            const shipRearDistance = 20; // Distance behind ship center
            const rearX =
                this.ship.x - Math.cos(this.shipRotation) * shipRearDistance;
            const rearY =
                this.ship.y - Math.sin(this.shipRotation) * shipRearDistance;

            this.thrustFlame.setPosition(rearX, rearY);

            // Rotate flame to point backward from ship direction
            this.thrustFlame.setRotation(
                this.shipRotation + Math.PI + this.shipRotationOffset
            );

            // Add flicker effect
            const flicker = 0.85 + Math.random() * 0.15;
            this.thrustFlame.setAlpha(flicker);

            // Scale based on boost
            const scale = isBoosting
                ? 1.3 + Math.random() * 0.2
                : 1.0 + Math.random() * 0.1;
            this.thrustFlame.setScale(scale);
        } else {
            this.thrustFlame.setVisible(false);
        }
    }

    handleFuel(dt) {
        const accelerating = this.inputManager.isDown("up");
        const braking = this.inputManager.isDown("down");
        const turnLeft = this.inputManager.isDown("left");
        const turnRight = this.inputManager.isDown("right");
        const boosting = this.inputManager.isDown("sprint");

        // Fuel drains from thrust or braking, and strafe thrusters when mouse aiming
        const isUsingThrusters =
            accelerating ||
            braking ||
            (this.mouseAiming && (turnLeft || turnRight));

        if (!isUsingThrusters) {
            return;
        }

        const drainMultiplier = boosting ? this.params.BOOST_MULTIPLIER : 1.0;
        const drain = this.params.FUEL_DRAIN_PER_SECOND * drainMultiplier * dt;
        this.fuelAccumulator += drain;

        if (this.fuelAccumulator >= 1) {
            const spent = Math.floor(this.fuelAccumulator);
            const remaining = adjustFuel(-spent);
            this.fuelAccumulator -= spent;
            if (remaining <= 0) {
                // Out of fuel - disable thrusters
                return;
            }
        }
    }

    updateEnemies(dt) {
        const aggroRadiusPx = AGGRO_RADIUS_UNITS * UNIT_SIZE;
        this.enemyPatrols.forEach(({ enemy, sprite }) => {
            if (enemy.engaged) {
                sprite.setVelocity(0, 0);
                return;
            }
            const distance = Phaser.Math.Distance.Between(
                sprite.x,
                sprite.y,
                this.ship.x,
                this.ship.y
            );
            if (distance < aggroRadiusPx) {
                this.physics.moveToObject(sprite, this.ship, 90);
            } else {
                sprite.body.velocity.scale(0.92);
                if (sprite.body.velocity.length() < 12) {
                    sprite.body.setVelocity(0, 0);
                }
            }
            enemy.position.x = sprite.x / UNIT_SIZE;
            enemy.position.y = sprite.y / UNIT_SIZE;
        });
    }

    handleInteractions() {
        const interactPressed = this.inputManager.justPressed("interact");
        const scanPressed = this.inputManager.justPressed("scan");

        const planetTarget = this.findClosestPlanet();
        if (planetTarget && planetTarget.distance < INTERACT_RADIUS_PIXELS) {
            const prompt = planetTarget.planet.landingAllowed
                ? `E: Land on ${planetTarget.planet.name}`
                : `${planetTarget.planet.name} - Landing unavailable`;
            this.setPrompt(prompt);
            if (interactPressed && planetTarget.planet.landingAllowed) {
                markPlanetDiscovered(planetTarget.planet.id);
                this.transitionToPlanet(planetTarget.planet);
                return;
            }
        }

        const derelictTarget = this.findClosestDerelict();
        if (
            derelictTarget &&
            derelictTarget.distance < INTERACT_RADIUS_PIXELS
        ) {
            if (!derelictTarget.poi.claimed) {
                this.setPrompt("E: Salvage derelict");
                if (interactPressed) {
                    this.salvageDerelict(derelictTarget);
                    return;
                }
            }
        }

        const enemyTarget = this.findClosestEnemy();
        if (enemyTarget && enemyTarget.distance < INTERACT_RADIUS_PIXELS) {
            this.setPrompt("E: Engage patrol  |  R: Evade (Fuel -5)");
            if (interactPressed) {
                this.startBattleFromSpace(enemyTarget.enemy.id);
                return;
            }
            if (scanPressed) {
                this.evadeEnemy(enemyTarget);
                return;
            }
        }

        if (scanPressed) {
            this.performScan();
            return;
        }

        if (!planetTarget && !enemyTarget && !derelictTarget) {
            this.setPrompt(
                "W thrust, S brake, A/D turn. RMB aim. E interact. R scan."
            );
        }
    }

    updateFog() {
        const revealRadiusTiles = 10;
        const revealRadiusSq = revealRadiusTiles * revealRadiusTiles;
        const playerTileX = Math.floor(this.ship.x / UNIT_SIZE);
        const playerTileY = Math.floor(this.ship.y / UNIT_SIZE);

        if (
            !this.lastFogTile ||
            this.lastFogTile.x !== playerTileX ||
            this.lastFogTile.y !== playerTileY
        ) {
            this.lastFogTile = { x: playerTileX, y: playerTileY };
            for (
                let dx = -revealRadiusTiles;
                dx <= revealRadiusTiles;
                dx += 1
            ) {
                for (
                    let dy = -revealRadiusTiles;
                    dy <= revealRadiusTiles;
                    dy += 1
                ) {
                    const tileX = playerTileX + dx;
                    const tileY = playerTileY + dy;
                    if (dx * dx + dy * dy > revealRadiusSq) {
                        continue;
                    }
                    if (revealSpaceTile({ x: tileX, y: tileY })) {
                        this.queueFogReveal(tileX, tileY);
                    }
                }
            }
        }

        this.flushFogQueue();
    }

    broadcastSpaceStatus() {
        const activeEnemies = this.state.space.enemyPatrols.filter(
            (enemy) => !enemy.defeated
        );
        this.game.events.emit("ui:space-status", {
            position: { x: this.ship.x, y: this.ship.y },
            fuel: this.state.hero.fuel,
            hull: this.state.hero.hull,
            planets: this.state.space.planets,
            enemies: activeEnemies,
        });
    }

    updateBroadcast(deltaMs) {
        this.broadcastAccumulator += deltaMs;
        if (this.broadcastAccumulator < 200) {
            return;
        }
        this.broadcastAccumulator = 0;
        this.broadcastSpaceStatus();
    }

    // updateHeadingIndicator removed - heading indicator no longer used

    handleEnemyOverlap(_ship, enemySprite) {
        const enemy = enemySprite.getData("info");
        if (enemy.engaged) {
            return;
        }
        this.setPrompt("Collision! E: Engage patrol");
    }

    findClosestPlanet() {
        let best = null;
        this.planets.forEach(({ planet, sprite }) => {
            const distance = Phaser.Math.Distance.Between(
                this.ship.x,
                this.ship.y,
                sprite.x,
                sprite.y
            );
            if (!best || distance < best.distance) {
                best = { planet, sprite, distance };
            }
        });
        return best;
    }

    findClosestEnemy() {
        let best = null;
        this.enemyPatrols.forEach(({ enemy, sprite }) => {
            if (enemy.engaged) {
                return;
            }
            const distance = Phaser.Math.Distance.Between(
                this.ship.x,
                this.ship.y,
                sprite.x,
                sprite.y
            );
            if (!best || distance < best.distance) {
                best = { enemy, sprite, distance };
            }
        });
        return best;
    }

    findClosestDerelict() {
        let best = null;
        this.derelicts.forEach(({ poi, sprite }) => {
            if (poi.claimed) {
                return;
            }
            const distance = Phaser.Math.Distance.Between(
                this.ship.x,
                this.ship.y,
                sprite.x,
                sprite.y
            );
            if (!best || distance < best.distance) {
                best = { poi, sprite, distance };
            }
        });
        return best;
    }

    transitionToPlanet(planet) {
        changeScene("PlanetScene", { entry: "landing", planetId: planet.id });
        this.scene.start("PlanetScene", { planetId: planet.id });
    }

    startBattleFromSpace(enemyId) {
        const enemy = this.state.space.enemyPatrols.find(
            (e) => e.id === enemyId
        );
        if (enemy) {
            enemy.engaged = true;
        }
        changeScene("BattleScene", { entry: "space", enemyId });
        this.scene.start("BattleScene", { origin: "space", enemyId });
    }

    evadeEnemy(target) {
        if (this.state.hero.fuel <= 0) {
            this.game.events.emit("ui:toast", {
                text: "Not enough fuel to evade.",
                severity: "warning",
            });
            return;
        }
        adjustFuel(-5);
        const direction = new Phaser.Math.Vector2(
            target.sprite.x - this.ship.x,
            target.sprite.y - this.ship.y
        )
            .normalize()
            .scale(220);
        target.sprite.body.velocity.add(direction);
        this.game.events.emit("ui:toast", {
            text: "Evaded patrol. Fuel -5.",
            severity: "info",
        });
    }

    salvageDerelict(target) {
        const { reward } = target.poi;
        markDerelictClaimed(target.poi.id);
        if (reward.fuel) {
            adjustFuel(reward.fuel);
        }
        if (reward.scrap) {
            addResource("scrap", reward.scrap);
        }
        target.sprite.setTint(0x888888);
        this.game.events.emit("ui:toast", {
            text: `Recovered +${reward.scrap ?? 0} Scrap, +${reward.fuel ?? 0} Fuel.`,
            severity: "success",
        });
        this.refreshUI();
    }

    performScan() {
        this.game.events.emit("ui:toast", { text: "Scan pulse deployed." });
        const scanRadius = 15;
        for (let i = 0; i < 12; i += 1) {
            const angle = (Math.PI * 2 * i) / 12;
            const tileX = Math.floor(
                this.ship.x / UNIT_SIZE + Math.cos(angle) * scanRadius
            );
            const tileY = Math.floor(
                this.ship.y / UNIT_SIZE + Math.sin(angle) * scanRadius
            );
            if (revealSpaceTile({ x: tileX, y: tileY })) {
                this.queueFogReveal(tileX, tileY);
            }
        }
        this.flushFogQueue();
    }

    setPrompt(message) {
        if (this.promptCache === message) {
            return;
        }
        this.promptCache = message;
        this.game.events.emit("ui:prompt", { text: message });
    }

    destroy() {
        this.inputManager?.destroy();
        this.thrustFlame?.destroy();
        this.thrustFlame = null;
        this.scale.off("resize", this.handleResize, this);
    }

    queueFogReveal(tileX, tileY) {
        this.fogRevealQueue.push({ x: tileX, y: tileY });
    }

    flushFogQueue(forceRefresh = false) {
        if (!this.fogContext) {
            this.fogRevealQueue.length = 0;
            return;
        }

        const radius = this.fogRevealRadius;
        if (this.fogRevealQueue.length > 0) {
            this.fogContext.save();
            this.fogContext.globalCompositeOperation = "destination-out";
            while (this.fogRevealQueue.length > 0) {
                const { x, y } = this.fogRevealQueue.pop();
                const cx = Phaser.Math.Clamp(x + 0.5, 0, this.fogTexture.width);
                const cy = Phaser.Math.Clamp(
                    y + 0.5,
                    0,
                    this.fogTexture.height
                );
                this.fogContext.fillStyle = "#000000";
                this.fogContext.beginPath();
                this.fogContext.arc(cx, cy, radius, 0, Math.PI * 2);
                this.fogContext.fill();
                this.fogDirty = true;
            }
            this.fogContext.restore();
        }

        if ((this.fogDirty || forceRefresh) && this.fogTexture) {
            this.fogTexture.refresh();
            this.fogDirty = false;
        }
    }

    handleResize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        if (this.starfieldFar) {
            this.starfieldFar.setSize(width, height);
            this.starfieldFar.setDisplaySize(width, height);
        }
        if (this.starfieldMid) {
            this.starfieldMid.setSize(width, height);
            this.starfieldMid.setDisplaySize(width, height);
        }
        if (this.starfieldClose) {
            this.starfieldClose.setSize(width, height);
            this.starfieldClose.setDisplaySize(width, height);
        }
    }

    setupTweaker() {
        this.tweakerUI = this.add.dom(0, 0).createFromHTML(`
            <div id="tweaker-panel" style="
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.9);
                color: #fff;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 11px;
                width: 280px;
                display: block;
                z-index: 10000;
                border: 1px solid #4a90e2;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                transform: scale(0.8);
                transform-origin: top right;
            ">
                <h3 style="margin: 0 0 15px 0; color: #4a90e2;">Ship Controls Tweaker</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Acceleration: <span id="accel-val">250</span></label>
                    <input type="range" id="accel" min="50" max="400" value="250" step="10" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Max Speed: <span id="speed-val">280</span></label>
                    <input type="range" id="speed" min="100" max="500" value="280" step="10" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Angular Accel (°/s²): <span id="turn-val">180</span></label>
                    <input type="range" id="turn" min="60" max="400" value="180" step="10" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Max Turn Rate (°/s): <span id="max-turn-val">200</span></label>
                    <input type="range" id="max-turn" min="60" max="360" value="200" step="10" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Angular Drag: <span id="angular-drag-val">0.92</span></label>
                    <input type="range" id="angular-drag" min="0.7" max="0.99" value="0.92" step="0.01" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Brake Force: <span id="brake-val">1200</span></label>
                    <input type="range" id="brake" min="100" max="2000" value="1200" step="50" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Strafe Accel: <span id="strafe-val">200</span></label>
                    <input type="range" id="strafe" min="50" max="400" value="200" step="10" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Passive Drag: <span id="drag-val">0.08</span></label>
                    <input type="range" id="drag" min="0" max="0.5" value="0.08" step="0.01" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Boost Multiplier: <span id="boost-val">1.4</span></label>
                    <input type="range" id="boost" min="1" max="2.5" value="1.4" step="0.05" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Fuel Drain/s: <span id="fuel-val">4</span></label>
                    <input type="range" id="fuel" min="0" max="10" value="4" step="0.5" style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Ship Drag (Inertia): <span id="ship-drag-val">80</span></label>
                    <input type="range" id="ship-drag" min="0" max="300" value="80" step="10" style="width: 100%;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Ship Mass: <span id="ship-mass-val">1.0</span></label>
                    <input type="range" id="ship-mass" min="0.1" max="3" value="1.0" step="0.1" style="width: 100%;">
                </div>
                <button id="reset-btn" style="
                    width: 100%;
                    padding: 8px;
                    background: #4a90e2;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: monospace;
                    font-size: 13px;
                ">Reset to Defaults</button>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #444;">
                    <div style="font-size: 12px; color: #4a90e2; margin-bottom: 8px; font-weight: bold;">Thrust Direction</div>
                    <div style="display: flex; justify-content: center; margin-bottom: 8px;">
                        <div style="position: relative; width: 80px; height: 80px; background: #1a1a2e; border-radius: 50%; border: 2px solid #333;">
                            <div id="thrust-forward" style="position: absolute; top: 5px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 12px solid #555; transition: border-bottom-color 0.1s;"></div>
                            <div id="thrust-left" style="position: absolute; left: 5px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-right: 12px solid #555; transition: border-right-color 0.1s;"></div>
                            <div id="thrust-right" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 12px solid #555; transition: border-left-color 0.1s;"></div>
                            <div id="thrust-brake" style="position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 12px solid #555; transition: border-top-color 0.1s;"></div>
                            <div id="thrust-boost" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #555; border-radius: 50%; transition: background 0.1s;"></div>
                        </div>
                    </div>
                    <div style="text-align: center; font-size: 10px; color: #888; margin-bottom: 5px;">
                        <span id="thrust-label">No thrust</span>
                    </div>
                    <div style="font-family: 'Courier New', monospace; font-size: 10px; text-align: center;">
                        <div>Thrust X: <span id="thrust-x" style="color: #f95;">0.0</span></div>
                        <div>Thrust Y: <span id="thrust-y" style="color: #f95;">0.0</span></div>
                    </div>
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #444;">
                    <div style="font-size: 12px; color: #4a90e2; margin-bottom: 8px; font-weight: bold;">Velocity Vector</div>
                    <div style="font-family: 'Courier New', monospace; font-size: 12px;">
                        <div>X: <span id="velocity-x" style="color: #5fc;">0.0</span></div>
                        <div>Y: <span id="velocity-y" style="color: #5fc;">0.0</span></div>
                        <div>Speed: <span id="velocity-mag" style="color: #ff5;">0.0</span></div>
                    </div>
                </div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #444; font-size: 11px; color: #888;">
                    Press T to toggle this panel
                </div>
            </div>
        `);
        this.tweakerUI.setOrigin(0, 0);
        this.tweakerUI.setScrollFactor(0);
        this.tweakerUI.setDepth(10000);

        const bindSlider = (id, paramKey, displayId, updatePhysics = false) => {
            const slider = document.getElementById(id);
            const display = document.getElementById(displayId);
            slider.addEventListener("input", (e) => {
                const value = parseFloat(e.target.value);
                this.params[paramKey] = value;
                display.textContent = value.toFixed(2);
                if (updatePhysics && this.ship) {
                    this.updateShipPhysics();
                }
            });
        };

        bindSlider("accel", "PLAYER_ACCEL", "accel-val");
        bindSlider("speed", "PLAYER_MAX_SPEED", "speed-val", true);
        bindSlider("turn", "PLAYER_TURN_SPEED", "turn-val");
        bindSlider("max-turn", "PLAYER_MAX_TURN_RATE", "max-turn-val");
        bindSlider("angular-drag", "ANGULAR_DRAG", "angular-drag-val");
        bindSlider("brake", "PLAYER_BRAKE_FORCE", "brake-val");
        bindSlider("strafe", "STRAFE_ACCEL", "strafe-val");
        bindSlider("drag", "PASSIVE_DRAG", "drag-val");
        bindSlider("boost", "BOOST_MULTIPLIER", "boost-val");
        bindSlider("fuel", "FUEL_DRAIN_PER_SECOND", "fuel-val");
        bindSlider("ship-drag", "SHIP_DRAG", "ship-drag-val", true);
        bindSlider("ship-mass", "SHIP_MASS", "ship-mass-val", true);

        document.getElementById("reset-btn").addEventListener("click", () => {
            this.params = { ...DEFAULT_PARAMS };
            document.getElementById("accel").value =
                DEFAULT_PARAMS.PLAYER_ACCEL;
            document.getElementById("accel-val").textContent =
                DEFAULT_PARAMS.PLAYER_ACCEL;
            document.getElementById("speed").value =
                DEFAULT_PARAMS.PLAYER_MAX_SPEED;
            document.getElementById("speed-val").textContent =
                DEFAULT_PARAMS.PLAYER_MAX_SPEED;
            document.getElementById("turn").value =
                DEFAULT_PARAMS.PLAYER_TURN_SPEED;
            document.getElementById("turn-val").textContent =
                DEFAULT_PARAMS.PLAYER_TURN_SPEED;
            document.getElementById("max-turn").value =
                DEFAULT_PARAMS.PLAYER_MAX_TURN_RATE;
            document.getElementById("max-turn-val").textContent =
                DEFAULT_PARAMS.PLAYER_MAX_TURN_RATE;
            document.getElementById("angular-drag").value =
                DEFAULT_PARAMS.ANGULAR_DRAG;
            document.getElementById("angular-drag-val").textContent =
                DEFAULT_PARAMS.ANGULAR_DRAG.toFixed(2);
            document.getElementById("brake").value =
                DEFAULT_PARAMS.PLAYER_BRAKE_FORCE;
            document.getElementById("brake-val").textContent =
                DEFAULT_PARAMS.PLAYER_BRAKE_FORCE;
            document.getElementById("strafe").value =
                DEFAULT_PARAMS.STRAFE_ACCEL;
            document.getElementById("strafe-val").textContent =
                DEFAULT_PARAMS.STRAFE_ACCEL;
            document.getElementById("drag").value = DEFAULT_PARAMS.PASSIVE_DRAG;
            document.getElementById("drag-val").textContent =
                DEFAULT_PARAMS.PASSIVE_DRAG.toFixed(2);
            document.getElementById("boost").value =
                DEFAULT_PARAMS.BOOST_MULTIPLIER;
            document.getElementById("boost-val").textContent =
                DEFAULT_PARAMS.BOOST_MULTIPLIER.toFixed(2);
            document.getElementById("fuel").value =
                DEFAULT_PARAMS.FUEL_DRAIN_PER_SECOND;
            document.getElementById("fuel-val").textContent =
                DEFAULT_PARAMS.FUEL_DRAIN_PER_SECOND;
            document.getElementById("ship-drag").value =
                DEFAULT_PARAMS.SHIP_DRAG;
            document.getElementById("ship-drag-val").textContent =
                DEFAULT_PARAMS.SHIP_DRAG;
            document.getElementById("ship-mass").value =
                DEFAULT_PARAMS.SHIP_MASS;
            document.getElementById("ship-mass-val").textContent =
                DEFAULT_PARAMS.SHIP_MASS.toFixed(1);
            if (this.ship) {
                this.updateShipPhysics();
            }
        });
    }

    updateShipPhysics() {
        if (!this.ship || !this.ship.body) return;
        // We no longer use Phaser's built-in drag/damping
        // All physics is handled manually in handleMovement()
        this.ship.setMass(this.params.SHIP_MASS);
    }

    handleTweakerInput() {
        if (this.inputManager.justPressed("tweaker")) {
            this.tweakerVisible = !this.tweakerVisible;
            const panel = document.getElementById("tweaker-panel");
            console.log("Toggling tweaker panel:", this.tweakerVisible, panel);
            if (panel) {
                panel.style.display = this.tweakerVisible ? "block" : "none";
            }
        }

        // Update thrust indicators and velocity display
        if (this.tweakerVisible && this.ship) {
            const accelerating = this.inputManager.isDown("up");
            const braking = this.inputManager.isDown("down");
            const turningLeft = this.inputManager.isDown("left");
            const turningRight = this.inputManager.isDown("right");
            const boosting = this.inputManager.isDown("sprint");

            // Update thrust direction indicators
            const thrustForward = document.getElementById("thrust-forward");
            const thrustBrake = document.getElementById("thrust-brake");
            const thrustLeft = document.getElementById("thrust-left");
            const thrustRight = document.getElementById("thrust-right");
            const thrustBoost = document.getElementById("thrust-boost");
            const thrustLabel = document.getElementById("thrust-label");

            const activeColor = boosting ? "#ff5" : "#5fc";
            const inactiveColor = "#555";

            if (thrustForward) {
                thrustForward.style.borderBottomColor = accelerating
                    ? activeColor
                    : inactiveColor;
            }
            if (thrustBrake) {
                thrustBrake.style.borderTopColor = braking
                    ? activeColor
                    : inactiveColor;
            }
            if (thrustLeft) {
                thrustLeft.style.borderRightColor = turningLeft
                    ? "#5fc"
                    : inactiveColor;
            }
            if (thrustRight) {
                thrustRight.style.borderLeftColor = turningRight
                    ? "#5fc"
                    : inactiveColor;
            }
            if (thrustBoost) {
                thrustBoost.style.background = boosting
                    ? "#ff5"
                    : inactiveColor;
            }

            // Update label
            if (thrustLabel) {
                const labels = [];
                if (accelerating) labels.push("Forward");
                if (braking) labels.push("Brake");
                if (turningLeft) labels.push("Left");
                if (turningRight) labels.push("Right");
                if (boosting) labels.push("BOOST");
                thrustLabel.textContent =
                    labels.length > 0 ? labels.join(" + ") : "No thrust";
            }

            // Update thrust vector display
            const thrustX = document.getElementById("thrust-x");
            const thrustY = document.getElementById("thrust-y");
            if (thrustX)
                thrustX.textContent = (this.currentThrustX || 0).toFixed(1);
            if (thrustY)
                thrustY.textContent = (this.currentThrustY || 0).toFixed(1);

            // Update velocity display
            const vx = this.ship.body.velocity.x;
            const vy = this.ship.body.velocity.y;
            const speed = Math.sqrt(vx * vx + vy * vy);

            const velX = document.getElementById("velocity-x");
            const velY = document.getElementById("velocity-y");
            const velMag = document.getElementById("velocity-mag");

            if (velX) velX.textContent = vx.toFixed(1);
            if (velY) velY.textContent = vy.toFixed(1);
            if (velMag) velMag.textContent = speed.toFixed(1);
        }
    }
}
