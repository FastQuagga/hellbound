// Точка входа: генерация ассетов, машина состояний приложения, игровой цикл,
// melt-переходы, музыка, настройки. Контракт: docs/architecture.md §24.

import { SCREEN_W, SCREEN_H, VIEW_H, TICK } from './config.js';
import { Raycaster } from './engine/raycaster.js';
import { createInput } from './engine/input.js';
import { Game } from './game/game.js';
import { LEVEL1 } from './game/level1.js';
import { HUD } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { drawText } from './ui/font.js';
import { generateTextures } from './assets/textures.js';
import { generateSprites as genEnemies1 } from './assets/sprites_enemies1.js';
import { generateSprites as genEnemies2 } from './assets/sprites_enemies2.js';
import { generateSprites as genEnemies3 } from './assets/sprites_enemies3.js';
import { generateSprites as genWeapons } from './assets/sprites_weapons.js';
import { generateSprites as genItems } from './assets/sprites_items.js';
import { generateSprites as genFx } from './assets/sprites_fx.js';
import { generateSprites as genUi } from './assets/sprites_ui.js';
import { generateSprites as genProps, generatePropTextures } from './assets/sprites_props.js';
import { SoundEngine } from './assets/sounds.js';
import { MusicPlayer } from './assets/music.js';

const SETTINGS_KEY = 'hellbound_settings_v1';
const DEBUG = new URLSearchParams(location.search).has('debug');

const boot = document.getElementById('boot');
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

window.addEventListener('error', (e) => {
  if (boot && boot.isConnected) boot.textContent = 'ОШИБКА: ' + e.message;
});

function loadSettings() {
  const def = { sfx: 0.7, music: 0.55, mouseSens: 0.5, mouseLook: true };
  try {
    return Object.assign(def, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch {
    return def;
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

async function init() {
  // --- ассеты ---
  const sprites = new Map();
  const stages = [
    ['ТЕКСТУРЫ', null],
    ['ЗОМБИ', genEnemies1], ['ДЕМОНЫ', genEnemies2], ['БАРОНЫ', genEnemies3],
    ['ОРУЖИЕ', genWeapons], ['ПРЕДМЕТЫ', genItems], ['ЭФФЕКТЫ', genFx], ['ИНТЕРФЕЙС', genUi],
    ['ПРОПСЫ', genProps],
  ];
  let textures = new Map();
  for (const [label, gen] of stages) {
    boot.textContent = 'СОЗДАНИЕ: ' + label + '…';
    await nextFrame();
    if (!gen) { textures = generateTextures(); continue; }
    for (const [k, v] of gen()) sprites.set(k, v);
  }
  // Стенные текстуры-панно (эксперимент: пропсы) — поверх базового набора текстур.
  boot.textContent = 'СОЗДАНИЕ: ПАННО…';
  await nextFrame();
  for (const [k, v] of generatePropTextures(textures)) textures.set(k, v);
  boot.textContent = 'ЗВУК И МУЗЫКА…';
  await nextFrame();

  const settings = loadSettings();
  const sound = new SoundEngine();
  const music = new MusicPlayer();
  sound.setVolume(settings.sfx);
  music.setVolume(settings.music);

  const input = createInput(canvas);
  const raycaster = new Raycaster();
  raycaster.setAssets({ textures, sprites });
  const hud = new HUD(sprites);

  const frame = ctx.createImageData(SCREEN_W, SCREEN_H);
  frame.data.fill(0);
  for (let i = 3; i < frame.data.length; i += 4) frame.data[i] = 255;
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = SCREEN_W; frameCanvas.height = SCREEN_H;
  const fcCtx = frameCanvas.getContext('2d');

  // --- состояние приложения ---
  let app = 'menu'; // menu | game | pause | intermission | endtext
  let game = null;
  let melt = null;  // {snap, t, delays[]}
  let audioReady = false;
  let fps = 0, fpsFrames = 0, fpsT = 0;

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* приватный режим */ }
  }

  function setMusic(name) {
    try { music.start(name); } catch { /* без аудио */ }
  }

  function startMelt() {
    const snap = document.createElement('canvas');
    snap.width = SCREEN_W; snap.height = SCREEN_H;
    snap.getContext('2d').drawImage(canvas, 0, 0);
    const delays = [];
    for (let i = 0; i < 60; i++) delays.push(Math.random() * 0.35);
    melt = { snap, t: 0, delays };
  }

  function startGame(skill) {
    startMelt();
    game = new Game(LEVEL1, skill, { sprites, textures }, sound, settings, input);
    app = 'game';
    setMusic('level');
    input.requestLock();
  }

  function quitToMenu() {
    app = 'menu';
    game = null;
    menu.open('title');
    setMusic('menu');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function goIntermission() {
    startMelt();
    app = 'intermission';
    menu.setIntermission({
      kills: game.stats.kills, killsTotal: game.stats.killsTotal,
      items: game.stats.items, itemsTotal: game.stats.itemsTotal,
      secrets: game.stats.secrets, secretsTotal: game.stats.secretsTotal,
      time: game.time, levelName: LEVEL1.name,
    });
    menu.open('intermission');
    setMusic('victory');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  const menu = new Menu(sprites, sound, settings, {
    onNewGame: (skill) => startGame(skill),
    onResume: () => { app = 'game'; input.requestLock(); },
    onQuitToMenu: () => quitToMenu(),
    onApplySettings: () => {
      sound.setVolume(settings.sfx);
      music.setVolume(settings.music);
      saveSettings();
    },
    onIntermissionDone: () => { app = 'endtext'; menu.open('endtext'); },
  });
  menu.open('title');

  // аудио можно запускать только после жеста пользователя
  function ensureAudio() {
    if (audioReady) return;
    audioReady = true;
    try {
      sound.resume();
      setMusic(app === 'game' ? 'level' : app === 'intermission' || app === 'endtext' ? 'victory' : 'menu');
    } catch { /* без аудио */ }
  }
  window.addEventListener('keydown', ensureAudio, { once: false });
  window.addEventListener('mousedown', ensureAudio);

  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && app === 'game' && game && !game.over && !game.won) {
      app = 'pause';
      menu.open('pause');
    }
  });
  canvas.addEventListener('mousedown', () => {
    if (app === 'game' && !input.pointerLocked) input.requestLock();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  boot.remove();
  setMusic('menu');

  // --- цикл ---
  let last = performance.now();
  let acc = 0;

  function routeKeys() {
    const keys = input.keysPressed;
    if (!keys || keys.length === 0) return;
    if (app === 'game' && game) {
      for (const code of keys) {
        if (code === 'Tab') game.automap = !game.automap;
        else if (code === 'Enter' && game.over) { startGame(game.difficulty); break; }
        else if (code === 'Escape' && !document.pointerLockElement && !game.over) {
          app = 'pause';
          menu.open('pause');
        }
      }
    } else {
      for (const code of keys) menu.handleKey(code);
    }
    keys.length = 0;
  }

  function drawMelt(dtReal) {
    if (!melt) return;
    melt.t += dtReal;
    let active = false;
    const colW = SCREEN_W / 60;
    for (let i = 0; i < 60; i++) {
      const yOff = Math.max(0, (melt.t - melt.delays[i])) * 720;
      if (yOff < SCREEN_H) {
        active = true;
        ctx.drawImage(melt.snap, i * colW, 0, colW, SCREEN_H, i * colW, yOff, colW, SCREEN_H);
      }
    }
    if (!active) melt = null;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    let dtReal = (now - last) / 1000;
    last = now;
    if (dtReal > 0.1) dtReal = 0.1;

    routeKeys();

    if (app === 'game' && game) {
      acc += dtReal;
      let steps = 0;
      while (acc >= TICK && steps < 4) {
        game.update(TICK);
        input.endFrame();
        acc -= TICK;
        steps++;
      }
      if (steps === 4) acc = 0;
      if (game.won) goIntermission();
    } else {
      input.endFrame();
    }

    // отрисовка
    if (app === 'game' || app === 'pause') {
      if (game) {
        if (app === 'game') game.render(raycaster, frame, fcCtx);
        const sh = app === 'game' ? game.getShakeOffset() : { x: 0, y: 0 };
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
        ctx.drawImage(frameCanvas, sh.x, sh.y);
        hud.draw(ctx, game, dtReal);
        if (game.automap && app === 'game') hud.drawAutomap(ctx, game);
        if (app === 'pause') menu.draw(ctx, dtReal, now / 1000);
      }
    } else {
      menu.draw(ctx, dtReal, now / 1000);
    }

    drawMelt(dtReal);

    if (DEBUG) {
      fpsFrames++;
      fpsT += dtReal;
      if (fpsT >= 0.5) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }
      drawText(ctx, 'FPS ' + fps, SCREEN_W - 4, 4, { scale: 1, color: '#7ade3f', align: 'right' });
    }
  }
  requestAnimationFrame(loop);
}

init().catch((err) => {
  if (boot && boot.isConnected) boot.textContent = 'ОШИБКА ЗАГРУЗКИ: ' + err.message;
  console.error(err);
});
