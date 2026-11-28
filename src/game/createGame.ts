import Phaser from 'phaser';
import { TUNING, VIEW_H, VIEW_W } from '../shared/tuning';
import { BootScene } from './scenes/BootScene';
import { GameScene, GameSceneData } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { bus } from '../shared/eventBus';
import { session } from './session';
import { audio } from './systems/Audio';

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#05060d',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: TUNING.gravity }, debug: false } },
    input: { gamepad: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: true },
    scene: [BootScene, TitleScene, IntroScene, GameScene],
  });

  const offs = [
    bus.on('cmd:start', ({ continueSave, intro }) => {
      audio.init();
      if (!(continueSave && session.loadSave())) session.newGame();
      const cp = session.state.checkpoint;
      const data: GameSceneData = { room: cp.room, x: cp.x, y: cp.y, mode: 'start' };
      game.scene.stop('Title');
      game.scene.stop('Game');
      game.scene.stop('Intro');
      game.scene.start(intro ? 'Intro' : 'Game', data);
    }),
    bus.on('cmd:resume', () => {
      if (game.scene.isPaused('Game')) game.scene.resume('Game');
      bus.emit('ui:paused', { paused: false });
    }),
    bus.on('cmd:quitToTitle', () => {
      game.scene.stop('Game');
      game.scene.stop('Intro');
      game.scene.start('Title');
      bus.emit('ui:paused', { paused: false });
    }),
  ];
  // Debug/test hook (used by the automated smoke test and for playtest support).
  (window as unknown as { __MM__: unknown }).__MM__ = { game, session, bus };
  game.events.once(Phaser.Core.Events.DESTROY, () => offs.forEach((off) => off()));
  return game;
}
