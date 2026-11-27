import Phaser from 'phaser';
import { generateTextures, registerAnimations } from '../gfx/textures';
import { bus } from '../../shared/eventBus';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateTextures(this);
    registerAnimations(this);
    this.scene.start('Title');
    bus.emit('game:ready', {});
  }
}
