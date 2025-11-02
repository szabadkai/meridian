import Phaser from "phaser";

// To replace ships with real images:
// 1. Place your image files in public/ folder (e.g., public/player-ship.png)
// 2. Comment out the ship entries below
// 3. Load them in preload() with this.load.image('ship-player', '/player-ship.png')

const PLACEHOLDER_DEF = [
    // { key: "ship-player", width: 36, height: 20, color: 0x4ac8ff },
    // { key: "ship-enemy", width: 32, height: 18, color: 0xff6b6b },
    // { key: "planet-lush", radius: 32, gradient: [0x44ffaa, 0x146b5d] },
    { key: "planet-ice", radius: 32, gradient: [0xa4d8ff, 0x4c7bb8] },
    { key: "orbit-ring", radius: 48, stroke: 0xffffff },
    // { key: "derelict", width: 24, height: 24, color: 0xd8d0ff },
    // { key: "resource-node", width: 18, height: 18, color: 0x94f65c },
    { key: "landing-zone", width: 36, height: 36, color: 0xfff26d, alpha: 0.4 },
    // { key: "party-leader", width: 18, height: 24, color: 0x52b7ff },
    { key: "party-companion", width: 18, height: 24, color: 0x5fe1d0 },
    { key: "enemy-raider", width: 18, height: 24, color: 0xff7a7a },
    { key: "enemy-marksman", width: 18, height: 24, color: 0xffaf5f },
    { key: "tile-ground", width: 16, height: 16, color: 0x23304a },
    { key: "tile-path", width: 16, height: 16, color: 0x2d3f5c },
    { key: "tile-cover-low", width: 16, height: 16, color: 0x4a735c },
    { key: "tile-cover-high", width: 16, height: 16, color: 0x315943 },
];

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: "PreloadScene" });
    }

    preload() {
        this.add
            .text(640, 360, "Initializing...", {
                fontSize: "24px",
                color: "#d0f0ff",
            })
            .setOrigin(0.5, 0.5);

        this.load.image("ship-player", "/ship-player.png");
        this.load.image("ship-enemy", "/ship-enemy.png");
        this.load.image("planet-lush", "/planet-lush.png");
        this.load.image("derelict", "/derelict.png");
        this.load.image("resource-node", "/resource.png");
        this.load.image("party-leader", "/leader.png");
        this.generatePlaceholderTextures();

        this.registry.set("assetsReady", true);
    }

    create() {
        this.scene.start("SpaceScene");
        this.scene.launch("UIScene");
    }

    generatePlaceholderTextures() {
        PLACEHOLDER_DEF.forEach((asset) => {
            if (asset.radius) {
                this.createCircleTexture(asset);
            } else {
                this.createRectTexture(asset);
            }
        });

        this.createStarfieldTextures();
        this.createBattleHighlights();
        this.createThrustFlame();
    }

    createRectTexture({ key, width, height, color, alpha = 1 }) {
        const g = this.add.graphics();
        g.fillStyle(color, alpha);
        g.fillRoundedRect(0, 0, width, height, Math.min(width, height) * 0.2);
        g.generateTexture(key, width, height);
        g.destroy();
    }

    createCircleTexture({ key, radius, gradient, stroke }) {
        const size = radius * 2;
        const g = this.add.graphics();

        if (gradient) {
            const steps = 6;
            for (let i = steps; i >= 1; i -= 1) {
                const t = i / steps;
                const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                    Phaser.Display.Color.IntegerToColor(gradient[0]),
                    Phaser.Display.Color.IntegerToColor(gradient[1]),
                    steps,
                    steps - i
                );
                const tint = Phaser.Display.Color.GetColor(
                    color.r,
                    color.g,
                    color.b
                );
                g.fillStyle(tint, 1);
                g.fillCircle(radius, radius, radius * t);
            }
        } else {
            g.fillStyle(0xffffff, 0.3);
            g.fillCircle(radius, radius, radius);
        }

        if (stroke) {
            g.lineStyle(2, stroke, 0.8);
            g.strokeCircle(radius, radius, radius - 1);
        }

        g.generateTexture(key, size, size);
        g.destroy();
    }

    createStarfieldTextures() {
        const layers = [
            { key: "starfield-close", count: 120, size: 3, alpha: 0.9 },
            { key: "starfield-mid", count: 80, size: 2, alpha: 0.6 },
            { key: "starfield-far", count: 50, size: 1, alpha: 0.4 },
        ];

        layers.forEach((layer) => {
            const g = this.add.graphics();
            g.clear();
            g.fillStyle(0xffffff, layer.alpha);
            for (let i = 0; i < layer.count; i += 1) {
                const x = Phaser.Math.Between(0, 512);
                const y = Phaser.Math.Between(0, 512);
                g.fillCircle(x, y, layer.size);
            }
            g.generateTexture(layer.key, 512, 512);
            g.destroy();
        });
    }

    createBattleHighlights() {
        const g = this.add.graphics();
        g.fillStyle(0x4aa3ff, 0.2);
        g.fillRect(0, 0, 64, 64);
        g.lineStyle(2, 0x4aa3ff, 0.7);
        g.strokeRect(0, 0, 64, 64);
        g.generateTexture("highlight-move", 64, 64);
        g.clear();
        g.fillStyle(0xff694a, 0.2);
        g.fillRect(0, 0, 64, 64);
        g.lineStyle(2, 0xff694a, 0.7);
        g.strokeRect(0, 0, 64, 64);
        g.generateTexture("highlight-attack", 64, 64);
        g.destroy();
    }

    createThrustFlame() {
        const g = this.add.graphics();

        // Create thrust flame texture
        const flameWidth = 16;
        const flameHeight = 20;

        // Gradient from bright yellow/white to orange/red
        g.fillStyle(0xffff99, 1.0);
        g.fillEllipse(
            flameWidth / 2,
            flameHeight * 0.3,
            flameWidth * 0.6,
            flameHeight * 0.4
        );

        g.fillStyle(0xffaa33, 0.9);
        g.fillEllipse(
            flameWidth / 2,
            flameHeight * 0.5,
            flameWidth * 0.7,
            flameHeight * 0.5
        );

        g.fillStyle(0xff6633, 0.7);
        g.fillEllipse(
            flameWidth / 2,
            flameHeight * 0.75,
            flameWidth * 0.8,
            flameHeight * 0.6
        );

        g.generateTexture("thrust-flame", flameWidth, flameHeight);
        g.destroy();
    }
}
