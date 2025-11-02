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
}
