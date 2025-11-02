import Phaser from 'phaser';
import { getState, onState } from '../systems/state.js';

const HUD_MARGIN = 20;
const BAR_WIDTH = 180;
const BAR_HEIGHT = 12;
const SPACE_UNIT_SIZE = 32;

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.state = null;
    this.listeners = [];
    this.stateSubscriptions = [];
    this.activeSceneId = 'space';
    this.onboardingOverlay = null;
    this.onboardingVisible = false;
    this.onboardingSections = {};
    this.onboardingContext = 'space';
  }

  create() {
    this.state = getState();
    this.createHud();
    this.bindEvents();
    this.updateResourceDisplay(this.state.hero, this.state.inventory);
    this.updateMinimap({
      position: { x: this.state.space.player.x, y: this.state.space.player.y },
      planets: this.state.space.planets,
      enemies: this.state.space.enemyPatrols
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  createHud() {
    this.add.text(HUD_MARGIN, HUD_MARGIN, 'MERIDIAN DEMO', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#e5f2ff'
    });

    this.hullLabel = this.add.text(HUD_MARGIN, HUD_MARGIN + 32, 'Hull', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#9bb4c8'
    });
    this.hullBar = this.add.graphics();
    this.fuelLabel = this.add.text(HUD_MARGIN, HUD_MARGIN + 68, 'Fuel', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#9bb4c8'
    });
    this.fuelBar = this.add.graphics();

    this.inventoryText = this.add.text(HUD_MARGIN, HUD_MARGIN + 110, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#d6efff'
    });

    this.promptText = this.add
      .text(this.scale.width / 2, this.scale.height - 30, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f5fbff'
      })
      .setOrigin(0.5, 0.5);

    this.toastGroup = this.add.group();

    this.minimapOrigin = { x: this.scale.width - 220, y: 20 };
    this.minimapSize = 180;
    this.minimapGraphics = this.add.graphics();

    this.createOnboardingOverlay();
  }

  bindEvents() {
    this.addGlobalListener('ui:resources', ({ hero, inventory }) => {
      this.updateResourceDisplay(hero, inventory);
    });
    this.addGlobalListener('ui:prompt', ({ text }) => {
      this.setPrompt(text);
    });
    this.addGlobalListener('ui:toast', (payload) => this.showToast(payload));
    this.addGlobalListener('ui:scene', ({ id }) => {
      this.activeSceneId = id;
      this.setPrompt('');
      this.minimapGraphics.setVisible(id === 'space');
    });
    this.addGlobalListener('ui:space-status', (payload) => this.updateMinimap(payload));
    this.addGlobalListener('ui:hint', ({ text }) => {
      this.showToast({ text, severity: 'info', duration: 1400 });
    });
    this.addGlobalListener('ui:onboarding', (payload = {}) => {
      const { toggle, visible, context } = payload;
      if (typeof context === 'string') {
        this.onboardingContext = context;
        if (this.onboardingVisible) {
          this.highlightOnboardingSection(context);
        }
      }
      if (toggle) {
        this.setOnboardingVisible(!this.onboardingVisible, context ?? this.onboardingContext);
        return;
      }
      if (typeof visible === 'boolean') {
        this.setOnboardingVisible(visible, context ?? this.onboardingContext);
      }
    });

    this.stateSubscriptions.push(
      onState('resource', ({ hull, fuel }) => {
        this.updateResourceDisplay(
          { ...this.state.hero, hull: hull ?? this.state.hero.hull, fuel: fuel ?? this.state.hero.fuel },
          this.state.inventory
        );
      })
    );
    this.stateSubscriptions.push(
      onState('inventory', (inventory) => {
        this.updateResourceDisplay(this.state.hero, { ...this.state.inventory, ...inventory });
      })
    );
    this.stateSubscriptions.push(
      onState('reset', (nextState) => {
        this.state = getState();
        this.updateResourceDisplay(this.state.hero, this.state.inventory);
        this.updateMinimap({
          position: { x: this.state.space.player.x, y: this.state.space.player.y },
          planets: this.state.space.planets,
          enemies: this.state.space.enemyPatrols
        });
      })
    );
  }

  addGlobalListener(event, handler) {
    this.game.events.on(event, handler, this);
    this.listeners.push({ event, handler });
  }

  updateResourceDisplay(hero, inventory) {
    this.state.hero = { ...this.state.hero, ...hero };
    this.state.inventory = { ...this.state.inventory, ...inventory };
    this.drawBar(this.hullBar, hero.hull, hero.maxHull, 0xff7f7f, HUD_MARGIN, HUD_MARGIN + 52);
    this.drawBar(this.fuelBar, hero.fuel, hero.maxFuel, 0x7fe3ff, HUD_MARGIN, HUD_MARGIN + 88);
    this.inventoryText.setText(
      `Minerals: ${inventory.minerals ?? 0}\nScrap: ${inventory.scrap ?? 0}`
    );
  }

  drawBar(graphics, value, max, color, x, y) {
    graphics.clear();
    graphics.fillStyle(0x09121c, 0.85);
    graphics.fillRoundedRect(x, y, BAR_WIDTH, BAR_HEIGHT, 6);
    const pct = Phaser.Math.Clamp(value / max, 0, 1);
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(x + 2, y + 2, (BAR_WIDTH - 4) * pct, BAR_HEIGHT - 4, 5);
    graphics.lineStyle(1, 0xffffff, 0.2);
    graphics.strokeRoundedRect(x, y, BAR_WIDTH, BAR_HEIGHT, 6);
  }

  setPrompt(text) {
    if (!text) {
      this.promptText.setText('');
      return;
    }
    this.promptText.setText(text);
  }

  showToast({ text, severity = 'info', duration = 1800 }) {
    const colorMap = {
      info: '#9bd5ff',
      success: '#b2ffb2',
      warning: '#ffe3a1'
    };
    const toast = this.add
      .text(this.scale.width / 2, 80, text, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: colorMap[severity] ?? '#ffffff',
        backgroundColor: 'rgba(15, 30, 45, 0.7)',
        padding: { x: 12, y: 6 }
      })
      .setOrigin(0.5, 0.5);
    this.toastGroup.add(toast);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 20,
      ease: 'Sine.easeIn',
      duration,
      onComplete: () => toast.destroy()
    });
  }

  updateMinimap({ position, planets, enemies }) {
    if (this.activeSceneId !== 'space') {
      this.minimapGraphics.clear();
      return;
    }
    const bounds = this.state.space.bounds;
    const scaleX = this.minimapSize / bounds.width;
    const scaleY = this.minimapSize / bounds.height;

    this.minimapGraphics.clear();
    this.minimapGraphics.fillStyle(0x0c1521, 0.85);
    this.minimapGraphics.fillRoundedRect(
      this.minimapOrigin.x,
      this.minimapOrigin.y,
      this.minimapSize,
      this.minimapSize,
      12
    );

    this.minimapGraphics.lineStyle(1, 0x1f2f44, 1);
    this.minimapGraphics.strokeRoundedRect(
      this.minimapOrigin.x,
      this.minimapOrigin.y,
      this.minimapSize,
      this.minimapSize,
      12
    );

    planets?.forEach((planet) => {
      const px = this.minimapOrigin.x + planet.position.x * scaleX;
      const py = this.minimapOrigin.y + planet.position.y * scaleY;
      this.minimapGraphics.fillStyle(0x7fffd4, 1);
      this.minimapGraphics.fillCircle(px, py, 4);
    });

    enemies?.forEach((enemy) => {
      const ex = this.minimapOrigin.x + enemy.position.x * scaleX;
      const ey = this.minimapOrigin.y + enemy.position.y * scaleY;
      this.minimapGraphics.fillStyle(enemy.engaged ? 0xff9d6b : 0xff6666, 1);
      this.minimapGraphics.fillCircle(ex, ey, 3);
    });

    if (position) {
      const playerUnitsX =
        position.x > bounds.width ? position.x / SPACE_UNIT_SIZE : position.x;
      const playerUnitsY =
        position.y > bounds.height ? position.y / SPACE_UNIT_SIZE : position.y;
      const sx = this.minimapOrigin.x + playerUnitsX * scaleX;
      const sy = this.minimapOrigin.y + playerUnitsY * scaleY;
      this.minimapGraphics.fillStyle(0x9ad4ff, 1);
      this.minimapGraphics.fillCircle(sx, sy, 4);
    }
  }

  cleanup() {
    this.listeners.forEach(({ event, handler }) => {
      this.game.events.off(event, handler, this);
    });
    this.stateSubscriptions.forEach((unsubscribe) => unsubscribe?.());
    this.listeners = [];
    this.stateSubscriptions = [];
  }

  createOnboardingOverlay() {
    const { width, height } = this.scale;
    const panelWidth = Math.min(780, width - 80);
    const panelHeight = Math.min(460, height - 120);

    const overlay = this.add.container(0, 0).setDepth(50).setVisible(false);
    this.onboardingOverlay = overlay;

    const backdrop = this.add
      .rectangle(0, 0, width, height, 0x060b13, 0.82)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    const panel = this.add
      .rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x0f1c2c, 0.95)
      .setStrokeStyle(2, 0x4aa3ff, 0.6);

    const heading = this.add.text(width / 2, panel.y - panelHeight / 2 + 40, 'MERIDIAN DEMO — BRIEFING', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#e6f4ff'
    }).setOrigin(0.5);

    const sections = [
      {
        id: 'aim',
        title: 'Mission Objective',
        text:
          'Scout the sector, harvest a mineral cache planetside, then repel the enemy squad during the ground skirmish.'
      },
      {
        id: 'space',
        title: 'Flight Controls',
        text:
          'W thrust, S brake, A/D turn. Hold RMB to strafe with A/D. Shift boosts (drains fuel). E interact, R scan points of interest.'
      },
      {
        id: 'planet',
        title: 'Planet Surface',
        text:
          'WASD move, Shift sprint. Followers trail you. E interacts with landing zone or mineral node. Watch for the glowing threat ring.'
      },
      {
        id: 'battle',
        title: 'Ground Combat',
        text:
          'Left click select + move within blue tiles, right click to inspect. Number keys trigger abilities, Space ends turn. Use cover for defense.'
      }
    ];

    const bodyStyle = {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#c7e4ff',
      wordWrap: { width: panelWidth - 80 },
      lineSpacing: 6
    };

    const titleStyle = {
      fontFamily: 'monospace',
      fontSize: '19px',
      color: '#8fcaff'
    };

    const startY = heading.y + 36;
    const sectionSpacing = 88;
    this.onboardingSections = {};

    sections.forEach((section, index) => {
      const y = startY + index * sectionSpacing;
      const title = this.add.text(panel.x - panelWidth / 2 + 40, y, section.title.toUpperCase(), titleStyle);
      const body = this.add.text(title.x, y + 22, section.text, bodyStyle);
      this.onboardingSections[section.id] = { title, body };
    });

    const footer = this.add.text(
      panel.x,
      panel.y + panelHeight / 2 - 36,
      'Press H to toggle this guide at any time',
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9bd5ff'
      }
    ).setOrigin(0.5);

    backdrop.on('pointerdown', () => this.setOnboardingVisible(false));
    panel.setInteractive();
    panel.on('pointerdown', (pointer) => pointer.event.stopPropagation());

    overlay.add([backdrop, panel, heading, ...Object.values(this.onboardingSections).flatMap((entry) => [entry.title, entry.body]), footer]);
  }

  setOnboardingVisible(visible, context = this.onboardingContext) {
    this.onboardingVisible = visible;
    this.onboardingContext = context;
    this.onboardingOverlay?.setVisible(visible);
    if (visible) {
      this.highlightOnboardingSection(context);
    }
  }

  highlightOnboardingSection(context) {
    const highlightColor = '#f3fbff';
    const highlightAccent = '#e1f3ff';
    const dimColor = '#8fb8d6';
    const dimAccent = '#6f8faa';
    Object.entries(this.onboardingSections).forEach(([id, entry]) => {
      const isActive = id === context || (context === 'space' && id === 'aim');
      entry.title.setColor(isActive ? highlightColor : dimAccent);
      entry.body.setColor(isActive ? highlightAccent : dimColor);
    });
    // Ensure mission objective stays bright when context is aim or unspecified
    if (context !== 'aim' && this.onboardingSections.aim) {
      this.onboardingSections.aim.title.setColor('#e6f4ff');
      this.onboardingSections.aim.body.setColor('#c7e4ff');
    }
  }
}
