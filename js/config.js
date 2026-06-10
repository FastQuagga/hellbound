// Глобальные константы и табличные дефиниции. Единый источник истины для всех модулей.

export const SCREEN_W = 480;
export const SCREEN_H = 300;
export const VIEW_H = 252;
export const HUD_H = 48;

export const FOV = Math.PI / 3;
export const PROJ_DIST = (SCREEN_W / 2) / Math.tan(FOV / 2);
export const MAX_DIST = 24;
export const TEX = 64;

export const EYE = 0.5;
export const MAX_PITCH = 60;

export const PLAYER_RADIUS = 0.3;
export const MOVE_SPEED = 3.2;
export const RUN_MULT = 1.55;
export const TURN_SPEED = 2.4;

export const TICK = 1 / 60;

export const MAX_HP = 100;
export const MAX_HP_OVER = 200;
export const MAX_ARMOR = 200;
export const AMMO_MAX = { bullets: 200, shells: 50, rockets: 50, cells: 300 };

export const DIFFICULTY = [
  null,
  { name: 'МНЕ РАНО УМИРАТЬ', desc: 'ДЛЯ НОВОБРАНЦЕВ: МЕНЬШЕ УРОНА, БОЛЬШЕ ПАТРОНОВ', dmgTaken: 0.5, ammoMult: 2, aggro: 0.6 },
  { name: 'ЭЙ, НЕ ТАК ГРУБО', desc: 'РАЗМЕРЕННАЯ ЗАЧИСТКА', dmgTaken: 0.75, ammoMult: 1, aggro: 0.8 },
  { name: 'СДЕЛАЙ МНЕ БОЛЬНО', desc: 'КАК ЗАДУМАНО АДОМ', dmgTaken: 1.0, ammoMult: 1, aggro: 1.0 },
  { name: 'КОШМАР!', desc: 'БЕЗ ШАНСОВ. ПОЧТИ.', dmgTaken: 1.4, ammoMult: 1, aggro: 1.5 },
];

// Снаряды. dmg — прямое попадание [min,max]; splash — урон по площади (0 = нет).
export const PROJECTILE_DEFS = {
  fireball:   { sprites: ['fireball0', 'fireball1'],     animFps: 10, speed: 9,  dmg: [8, 24],     radius: 0.18, h: 0.32, splash: 0,   splashR: 0,   hitEffect: 'fb_hit',     light: true },
  cacoball:   { sprites: ['cacoball0', 'cacoball1'],     animFps: 10, speed: 9,  dmg: [5, 40],     radius: 0.2,  h: 0.34, splash: 0,   splashR: 0,   hitEffect: 'fb_hit',     light: true },
  baronball:  { sprites: ['baronball0', 'baronball1'],   animFps: 10, speed: 11, dmg: [8, 64],     radius: 0.2,  h: 0.34, splash: 0,   splashR: 0,   hitEffect: 'fb_hit',     light: true },
  rocketproj: { sprites: ['rocketproj0'],                animFps: 1,  speed: 16, dmg: [20, 160],   radius: 0.16, h: 0.26, splash: 100, splashR: 1.9, hitEffect: 'explosion',  light: true },
  plasmaball: { sprites: ['plasmaball0', 'plasmaball1'], animFps: 14, speed: 18, dmg: [5, 40],     radius: 0.14, h: 0.26, splash: 0,   splashR: 0,   hitEffect: 'plasma_hit', light: true },
  bfgball:    { sprites: ['bfgball0', 'bfgball1'],       animFps: 7,  speed: 9,  dmg: [100, 500],  radius: 0.3,  h: 0.5,  splash: 350, splashR: 3.0, hitEffect: 'bfg_hit',    light: true },
};

export const EFFECT_DEFS = {
  puff:       { frames: ['puff0', 'puff1', 'puff2', 'puff3'],                 fps: 12, h: 0.22, bright: false },
  blood:      { frames: ['blood0', 'blood1', 'blood2', 'blood3'],             fps: 12, h: 0.22, bright: false },
  explosion:  { frames: ['explosion0', 'explosion1', 'explosion2', 'explosion3', 'explosion4', 'explosion5'], fps: 14, h: 0.9, bright: true },
  fb_hit:     { frames: ['fb_hit0', 'fb_hit1', 'fb_hit2'],                    fps: 14, h: 0.4,  bright: true },
  plasma_hit: { frames: ['plasma_hit0', 'plasma_hit1'],                       fps: 16, h: 0.3,  bright: true },
  bfg_hit:    { frames: ['bfg_hit0', 'bfg_hit1', 'bfg_hit2'],                 fps: 12, h: 0.9,  bright: true },
};

// Анимированные текстуры: базовое имя -> число кадров (ключи <BASE><i>).
export const ANIM_FLATS = { NUKAGE: 3, LAVA: 2 };
export const ANIM_WALLS = { COMP: 2 };
export const ANIM_FPS = 4;

export const rndInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const rollDmg = ([min, max]) => rndInt(min, max);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
