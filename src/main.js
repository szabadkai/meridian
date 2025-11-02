import Phaser from 'phaser';
import PreloadScene from './scenes/PreloadScene.js';
import SpaceScene from './scenes/SpaceScene.js';
import PlanetScene from './scenes/PlanetScene.js';
import BattleScene from './scenes/BattleScene.js';
import UIScene from './scenes/UIScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#050915',
  pixelArt: true,
  roundPixels: true,
  dom: {
    createContainer: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [PreloadScene, SpaceScene, PlanetScene, BattleScene, UIScene]
};

const game = new Phaser.Game(config);

export default game;
