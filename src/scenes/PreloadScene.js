import Phaser from "phaser";
import { PlanetEncounterConfig } from "../systems/content.js";

// To replace ships with real images:
// 1. Place your image files in public/ folder (e.g., public/player-ship.png)
// 2. Comment out the ship entries below
// 3. Load them in preload() with this.load.image('ship-player', asset('player-ship.png'))

const PLACEHOLDER_DEF = [
    // { key: "ship-player", width: 36, height: 20, color: 0x4ac8ff },
    // { key: "ship-enemy", width: 32, height: 18, color: 0xff6b6b },
    // { key: "planet-lush", radius: 32, gradient: [0x44ffaa, 0x146b5d] },
    // { key: "planet-ice", radius: 32, gradient: [0xa4d8ff, 0x4c7bb8] },
    { key: "orbit-ring", radius: 48, stroke: 0xffffff },
    // { key: "derelict", width: 24, height: 24, color: 0xd8d0ff },
    // { key: "resource-node", width: 18, height: 18, color: 0x94f65c },
    // { key: "landing-zone", width: 36, height: 36, color: 0xfff26d, alpha: 0.4 },
    // { key: "party-leader", width: 18, height: 24, color: 0x52b7ff },
    // { key: "party-companion", width: 18, height: 24, color: 0x5fe1d0 },
    // { key: "enemy-raider", width: 18, height: 24, color: 0xff7a7a },
    // { key: "enemy-marksman", width: 18, height: 24, color: 0xffaf5f },
    // { key: "tile-ground", width: 16, height: 16, color: 0x23304a },
    // { key: "tile-path", width: 16, height: 16, color: 0x2d3f5c },
    // { key: "tile-cover-low", width: 16, height: 16, color: 0x4a735c },
    // { key: "tile-cover-high", width: 16, height: 16, color: 0x315943 },
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

        const asset = (filename) => `${import.meta.env.BASE_URL}${filename}`;

        this.load.image("ship-player", asset("ship-player.png"));
        this.load.image("ship-enemy", asset("ship-enemy.png"));
        this.load.image("planet-lush", asset("planet-lush.png"));
        this.load.image("planet-ice", asset("planet-ice.png"));
        this.load.image("derelict", asset("derelict.png"));
        this.load.image("resource-node", asset("resource.png"));
        this.load.image("party-leader", asset("leader.png"));
        this.load.image("landing-zone", asset("landing-zone.png"));
        this.load.image("party-companion", asset("companion.png"));
        this.load.image("enemy-raider", asset("enemy-raider.png"));
        this.load.image("enemy-marksman", asset("enemy-marksman.png"));
        this.load.spritesheet("planet-tilesheet", asset("basic.png"), {
            frameWidth: PlanetEncounterConfig.tileSize,
            frameHeight: PlanetEncounterConfig.tileSize,
        });

        this.generatePlaceholderTextures();

        this.registry.set("assetsReady", true);
    }

    create() {
        this.createPlanetTileTextures();
        this.scene.start("SpaceScene");
        this.scene.launch("UIScene");
    }

    createPlanetTileTextures() {
        const sheet = this.textures.get("planet-tilesheet");
        if (!sheet) {
            return;
        }

        const mapping = [
            { key: "tile-ground", frame: 4 },
            { key: "tile-path", frame: 108 },
            { key: "tile-cover-low", frame: 1 },
            { key: "tile-cover-high", frame: 29 },
        ];

        mapping.forEach(({ key, frame }) => {
            const tileFrame = sheet.get(`${frame}`);
            const source = tileFrame
                ? sheet.getSourceImage(tileFrame.sourceIndex)
                : null;
            if (!tileFrame || !source) {
                return;
            }
            this.textures.remove(key);
            const canvas = this.textures.createCanvas(
                key,
                tileFrame.width,
                tileFrame.height
            );
            canvas.context.imageSmoothingEnabled = false;
            canvas.context.drawImage(
                source,
                tileFrame.cutX,
                tileFrame.cutY,
                tileFrame.cutWidth,
                tileFrame.cutHeight,
                0,
                0,
                tileFrame.cutWidth,
                tileFrame.cutHeight
            );
            canvas.refresh();
        });
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
        // Lower star counts to make the parallax field feel less busy.
        const layers = [
            { key: "starfield-close", count: 40, size: 3, alpha: 0.9 },
            { key: "starfield-mid", count: 25, size: 2, alpha: 0.6 },
            { key: "starfield-far", count: 10, size: 1, alpha: 0.4 },
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
        const flameHeight = 32;

        // Tight core anchored right at the nozzle
        g.fillStyle(0xffffd4, 1.0);
        g.fillEllipse(
            flameWidth / 2,
            flameHeight * 0.08,
            flameWidth * 0.18,
            flameHeight * 0.18
        );

        g.fillStyle(0xffc342, 0.95);
        g.fillEllipse(
            flameWidth / 2,
            flameHeight * 0.22,
            flameWidth * 0.38,
            flameHeight * 0.32
        );

        g.fillStyle(0xff7f2a, 0.85);
        g.fillEllipse(
            flameWidth / 2,
            flameHeight * 0.42,
            flameWidth * 0.55,
            flameHeight * 0.45
        );

        // Violent plume flaring backward
        g.fillStyle(0xff4712, 0.82);
        g.fillTriangle(
            flameWidth / 2,
            flameHeight,
            flameWidth * 0.1,
            flameHeight * 0.55,
            flameWidth * 0.9,
            flameHeight * 0.55
        );
        g.fillStyle(0xffa34d, 0.65);
        g.fillTriangle(
            flameWidth / 2,
            flameHeight * 0.62,
            flameWidth * 0.25,
            flameHeight * 0.38,
            flameWidth * 0.75,
            flameHeight * 0.38
        );

        // Side flickers suggest instability
        g.fillStyle(0xff9442, 0.5);
        g.fillEllipse(
            flameWidth / 2 - 3,
            flameHeight * 0.48,
            flameWidth * 0.24,
            flameHeight * 0.32
        );
        g.fillEllipse(
            flameWidth / 2 + 3,
            flameHeight * 0.48,
            flameWidth * 0.24,
            flameHeight * 0.32
        );

        g.generateTexture("thrust-flame", flameWidth, flameHeight);
        g.destroy();
    }
}
