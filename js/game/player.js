// Игрок: создание, движение с инерцией, боб, взгляд, урон/броня, подборы.
// Контракт: docs/architecture.md §19 (потребители: game.js, weapons.js, hud.js).

import {
  EYE, MAX_PITCH, PLAYER_RADIUS, MOVE_SPEED, RUN_MULT, TURN_SPEED,
  PROJ_DIST, AMMO_MAX, clamp,
} from '../config.js';
import { moveWithCollision } from '../engine/physics.js';

const TAU = Math.PI * 2;

const ACCEL = 36;          // ускорение, клеток/с²
const FRICTION = 9;        // коэффициент экспоненциального трения, 1/с
const BOB_RATE = 9;        // скорость фазы боба при максимальной скорости
const BOB_AMP = 0.02;      // амплитуда вертикального боба, клеток
const MOUSE_BASE = 0.0022; // рад на пиксель мыши при sens=1
const DEATH_EYE = 0.16;    // высота камеры трупа
const DEATH_CAM_K = 5;     // скорость опускания камеры, 1/с
const PITCH_RETURN_K = 8;  // скорость возврата pitch к 0, 1/с

// Слоты оружия и стартовый боезапас при подборе (§25).
const WEAPON_SLOTS = {
  fist: 1, pistol: 2, shotgun: 3, chaingun: 4,
  rocketlauncher: 5, plasmarifle: 6, bfg: 7,
};
const WEAPON_START_AMMO = {
  shotgun: ['shells', 8],
  chaingun: ['bullets', 20],
  rocketlauncher: ['rockets', 2],
  plasmarifle: ['cells', 40],
  bfg: ['cells', 40],
};

export function createPlayer(x, y, angle) {
  return {
    x, y, angle,
    pitch: 0,
    z: EYE,
    hp: 100,
    armor: 0,
    armorClass: 0,                     // 1 = зелёная (1/3), 2 = синяя (1/2)
    ammo: { bullets: 50, shells: 0, rockets: 0, cells: 0 },
    weapons: { 1: true, 2: true },     // ключ — слот 1..7
    keys: { blue: false, yellow: false, red: false },
    alive: true,
    bobPhase: 0,
    vx: 0, vy: 0,
    faceEvent: null,                   // {type:'pain'|'grin', t} для HUD
    lastDamageDir: 0,                  // угол источника урона относительно взгляда
  };
}

export function updatePlayer(p, game, dt) {
  if (!p || !game || !(dt > 0)) return;

  // затухание события лица
  if (p.faceEvent) {
    p.faceEvent.t -= dt;
    if (p.faceEvent.t <= 0) p.faceEvent = null;
  }

  if (!p.alive) {
    updateDead(p, game, dt);
    return;
  }

  const input = game.input;
  const settings = game.settings;

  // ---- поворот ----
  if (input) {
    const turn = (input.turnR ? 1 : 0) - (input.turnL ? 1 : 0);
    if (turn !== 0) p.angle += turn * TURN_SPEED * dt;

    const sens = settings && typeof settings.mouseSens === 'number' ? settings.mouseSens : 0.5;
    if (input.mouseDx) p.angle += input.mouseDx * sens * MOUSE_BASE;

    // pitch — только мышью и только при включённом mouseLook
    if (settings && settings.mouseLook) {
      if (input.mouseDy) {
        p.pitch = clamp(p.pitch - input.mouseDy * sens * MOUSE_BASE * PROJ_DIST, -MAX_PITCH, MAX_PITCH);
      }
    } else if (p.pitch !== 0) {
      p.pitch -= p.pitch * Math.min(1, dt * PITCH_RETURN_K);
      if (Math.abs(p.pitch) < 0.1) p.pitch = 0;
    }
  }
  p.angle %= TAU;
  if (p.angle < 0) p.angle += TAU;

  // ---- движение: трение -> ускорение -> ограничение скорости ----
  const fr = Math.exp(-FRICTION * dt);
  p.vx *= fr;
  p.vy *= fr;

  let fwd = 0, side = 0;
  if (input) {
    if (input.forward) fwd += 1;
    if (input.back) fwd -= 1;
    if (input.strafeR) side += 1;
    if (input.strafeL) side -= 1;
  }
  const runK = input && input.run ? RUN_MULT : 1;
  const maxSpeed = MOVE_SPEED * runK;
  if (fwd !== 0 || side !== 0) {
    const inv = 1 / Math.hypot(fwd, side);
    fwd *= inv;
    side *= inv;
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    // вперёд = (ca, sa); вправо = (-sa, ca) — угол растёт по часовой, ось Y вниз.
    // Ускорение тоже растёт при беге, иначе maxSpeed недостижима из-за трения.
    const acc = ACCEL * runK * dt;
    p.vx += (ca * fwd - sa * side) * acc;
    p.vy += (sa * fwd + ca * side) * acc;
  }

  let speed = Math.hypot(p.vx, p.vy);
  if (speed > maxSpeed) {
    const s = maxSpeed / speed;
    p.vx *= s;
    p.vy *= s;
    speed = maxSpeed;
  }

  // ---- перемещение со скольжением вдоль стен ----
  if (speed > 0.0001 && game.map) {
    const res = moveWithCollision(game.map, p.x, p.y, p.vx * dt, p.vy * dt, PLAYER_RADIUS);
    if (res.collided) {
      // заблокированная компонента скорости гасится, скольжение сохраняется
      p.vx = (res.x - p.x) / dt;
      p.vy = (res.y - p.y) / dt;
      speed = Math.hypot(p.vx, p.vy);
    }
    p.x = res.x;
    p.y = res.y;
  } else {
    p.vx = 0;
    p.vy = 0;
    speed = 0;
  }

  // ---- боб ----
  const rate = speed / MOVE_SPEED;          // при беге фаза идёт быстрее
  if (rate > 0.01) {
    p.bobPhase += dt * BOB_RATE * rate;
    if (p.bobPhase > TAU) p.bobPhase -= TAU;
  }
  p.z = EYE + Math.sin(p.bobPhase) * BOB_AMP * Math.min(1, rate);

  // ---- использование (двери/рубильники), одноразовое нажатие ----
  if (input && input.use && typeof game.useAction === 'function') game.useAction();
}

// Мёртвый игрок: камера плавно опускается к полу, взгляд выравнивается,
// остаточная скорость затухает (труп доскальзывает, не проходя сквозь стены).
function updateDead(p, game, dt) {
  const fr = Math.exp(-FRICTION * dt);
  p.vx *= fr;
  p.vy *= fr;
  if (Math.hypot(p.vx, p.vy) > 0.0001 && game.map) {
    const res = moveWithCollision(game.map, p.x, p.y, p.vx * dt, p.vy * dt, PLAYER_RADIUS);
    p.x = res.x;
    p.y = res.y;
  } else {
    p.vx = 0;
    p.vy = 0;
  }

  const k = Math.min(1, dt * DEATH_CAM_K);
  p.z += (DEATH_EYE - p.z) * k;
  if (Math.abs(p.z - DEATH_EYE) < 0.002) p.z = DEATH_EYE;
  p.pitch -= p.pitch * k;
  if (Math.abs(p.pitch) < 0.1) p.pitch = 0;
}

export function damagePlayer(p, dmg, game, srcX, srcY) {
  if (!p || !p.alive || !(dmg > 0)) return;

  let taken = dmg * (game && game.skillDef ? game.skillDef.dmgTaken : 1);

  // броня: класс 1 поглощает 1/3 урона, класс 2 — 1/2; поглощённое тратит броню
  if (p.armorClass > 0 && p.armor > 0) {
    let saved = taken * (p.armorClass === 2 ? 0.5 : 1 / 3);
    if (saved > p.armor) saved = p.armor;
    p.armor -= saved;
    if (p.armor < 0.5) {
      p.armor = 0;
      p.armorClass = 0;
    }
    taken -= saved;
  }

  p.hp -= taken;

  // направление на источник урона относительно взгляда (для лица в HUD)
  if (typeof srcX === 'number' && typeof srcY === 'number') {
    let rel = (Math.atan2(srcY - p.y, srcX - p.x) - p.angle) % TAU;
    if (rel > Math.PI) rel -= TAU;
    if (rel < -Math.PI) rel += TAU;
    p.lastDamageDir = rel;
  } else {
    p.lastDamageDir = 0;
  }

  if (game && typeof game.flash === 'function') {
    game.flash(255, 24, 8, clamp(0.14 + taken * 0.012, 0.14, 0.55));
  }

  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    p.faceEvent = null;
    if (game && typeof game.playSound === 'function') game.playSound('pl_die');
    return;
  }

  p.faceEvent = { type: 'pain', t: 0.7 };
  if (game && typeof game.playSound === 'function') game.playSound('pl_pain');
}

export function addHealth(p, n, max = 100) {
  if (!(n > 0) || p.hp >= max) return false;
  p.hp = Math.min(max, p.hp + n);
  return true;
}

export function addArmor(p, n, armorClass, max) {
  if (!(n > 0) || p.armor >= max) return false;
  p.armor = Math.min(max, p.armor + n);
  if (armorClass > p.armorClass) p.armorClass = armorClass;
  return true;
}

export function addAmmo(p, type, n) {
  const cap = AMMO_MAX[type];
  if (cap === undefined || !(n > 0)) return false;
  const cur = p.ammo[type] || 0;
  if (cur >= cap) return false;
  p.ammo[type] = Math.min(cap, cur + n);
  return true;
}

export function giveWeapon(p, name) {
  const slot = WEAPON_SLOTS[name];
  if (!slot) return { taken: false, isNew: false };
  const isNew = !p.weapons[slot];
  const bundle = WEAPON_START_AMMO[name];
  const gotAmmo = bundle ? addAmmo(p, bundle[0], bundle[1]) : false;
  if (isNew) p.weapons[slot] = true;
  return { taken: isNew || gotAmmo, isNew };
}
