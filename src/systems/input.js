import Phaser from 'phaser';

const defaultKeys = {
  up: Phaser.Input.Keyboard.KeyCodes.W,
  down: Phaser.Input.Keyboard.KeyCodes.S,
  left: Phaser.Input.Keyboard.KeyCodes.A,
  right: Phaser.Input.Keyboard.KeyCodes.D,
  sprint: Phaser.Input.Keyboard.KeyCodes.SHIFT,
  interact: Phaser.Input.Keyboard.KeyCodes.E,
  scan: Phaser.Input.Keyboard.KeyCodes.R,
  help: Phaser.Input.Keyboard.KeyCodes.H,
  confirm: Phaser.Input.Keyboard.KeyCodes.ENTER,
  cancel: Phaser.Input.Keyboard.KeyCodes.ESC,
  endTurn: Phaser.Input.Keyboard.KeyCodes.SPACE,
  ability1: Phaser.Input.Keyboard.KeyCodes.ONE,
  ability2: Phaser.Input.Keyboard.KeyCodes.TWO,
  ability3: Phaser.Input.Keyboard.KeyCodes.THREE,
  tweaker: Phaser.Input.Keyboard.KeyCodes.T
};

export default class InputManager {
  constructor(scene, mapping = defaultKeys) {
    this.scene = scene;
    this.pointer = scene.input.activePointer;

    this.cursors = scene.input.keyboard.createCursorKeys();

    this.keys = Object.entries(mapping).reduce((acc, [name, code]) => {
      acc[name] = scene.input.keyboard.addKey(code);
      return acc;
    }, {});

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get directional() {
    const up = this.cursors.up?.isDown || this.keys.up.isDown;
    const down = this.cursors.down?.isDown || this.keys.down.isDown;
    const left = this.cursors.left?.isDown || this.keys.left.isDown;
    const right = this.cursors.right?.isDown || this.keys.right.isDown;
    return { up, down, left, right };
  }

  justPressed(name) {
    return Phaser.Input.Keyboard.JustDown(this.keys[name]);
  }

  isDown(name) {
    return this.keys[name]?.isDown ?? false;
  }

  destroy() {
    Object.values(this.keys).forEach((key) => {
      key?.destroy();
    });
  }
}
