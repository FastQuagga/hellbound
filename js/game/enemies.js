// Враги и ИИ: дефиниции, создание, машина состояний idle/chase/attack/pain/die/dead,
// пробуждение по LOS/шуму, Doom-овский перебор направлений, открытие дверей,
// melee/hitscan/projectile-атаки, painChance, infighting, дропы.
// Контракт: docs/architecture.md §17, баланс §25.

import { clamp, rollDmg } from '../config.js';
import { moveWithCollision, entityBlocked } from '../engine/physics.js';

// ---------- дефиниции (§25) ----------

export const ENEMY_DEFS = {
  zombie: {
    hp: 20, speed: 1.6, radius: 0.3, h: 0.78, fly: false,
    hitscan: { damage: [3, 15], pellets: 1, spreadDeg: 4 },
    projectile: null, melee: null,
    attackTime: 0.7, cooldown: 1.6, painChance: 0.7,
    drops: 'ammo_clip',
  },
  sergeant: {
    hp: 30, speed: 1.7, radius: 0.3, h: 0.78, fly: false,
    hitscan: { damage: [3, 15], pellets: 3, spreadDeg: 6 },
    projectile: null, melee: null,
    attackTime: 0.7, cooldown: 2.1, painChance: 0.65,
    drops: 'pickup_shotgun',
  },
  imp: {
    hp: 60, speed: 1.7, radius: 0.33, h: 0.82, fly: false,
    hitscan: null, projectile: 'fireball', melee: [3, 24],
    attackTime: 0.7, cooldown: 1.9, painChance: 0.5,
    drops: null,
  },
  demon: {
    hp: 150, speed: 2.9, radius: 0.4, h: 0.8, fly: false,
    hitscan: null, projectile: null, melee: [4, 40],
    attackTime: 0.7, cooldown: 1.0, painChance: 0.45,
    drops: null,
  },
  cacodemon: {
    hp: 400, speed: 1.7, radius: 0.45, h: 0.62, fly: true,
    hitscan: null, projectile: 'cacoball', melee: null,
    attackTime: 0.7, cooldown: 1.8, painChance: 0.5,
    drops: null,
  },
  baron: {
    hp: 700, speed: 1.5, radius: 0.45, h: 0.95, fly: false,
    hitscan: null, projectile: 'baronball', melee: [10, 60],
    attackTime: 0.7, cooldown: 1.5, painChance: 0.2,
    drops: null,
  },
};

// ---------- константы ИИ (§17) ----------

const QPI = Math.PI / 4;
const DIR_OFFSETS = [0, 1, -1, 2, -2, 3, -3, 4]; // перебор октантов от желаемого
const WAKE_HALF_FOV = (Math.PI * 100) / 180;     // поле зрения 200°
const WAKE_NEAR = 2;                              // пробуждение вплотную, без LOS
const WAKE_FAR = 24;                              // дальше LOS не проверяем
const MELEE_START = 1.1;                          // дистанция начала melee-атаки
const MELEE_HIT = 1.3;                            // радиус удара в момент события
const RANGED_DIST = 18;
const PAIN_TIME = 0.35;
const WALK_FPS = 6;
const DIE_FPS = 8;
const HOVER_MID = 0.225;                          // какодемон парит: z = 0.15..0.3
const HOVER_AMP = 0.075;
const HOVER_FREQ = 2.1;                           // рад/с фазы парения
const HOVER_PERIOD = (Math.PI * 2) / HOVER_FREQ;
const CORPSE_FALL = 0.9;                          // скорость опускания трупа какодемона

const EMPTY_ARR = [];
const warned = new Set();

// предвычисленные ключи кадров и имена звуков — без конкатенаций строк в кадровом цикле
const SPRITES = {};
for (const type in ENEMY_DEFS) {
  SPRITES[type] = {
    walk: [type + '_walk0', type + '_walk1', type + '_walk2', type + '_walk3'],
    attack: [type + '_attack0', type + '_attack1', type + '_attack2'],
    pain: type + '_pain0',
    die: [type + '_die0', type + '_die1', type + '_die2', type + '_die3', type + '_die4'],
    sndSight: 'en_' + type + '_sight',
    sndPain: 'en_' + type + '_pain',
    sndAttack: 'en_' + type + '_attack',
    sndDie: 'en_' + type + '_die',
  };
}

const WALK_CYCLE = 4 / WALK_FPS; // период walk-анимации, для ограничения animT

// ---------- публичный API ----------

export function createEnemy(type, x, y, angle) {
  let def = ENEMY_DEFS[type];
  if (!def) {
    warnOnce('enemies: неизвестный тип врага "' + type + '", заменён на zombie');
    type = 'zombie';
    def = ENEMY_DEFS.zombie;
  }
  const a = typeof angle === 'number' && isFinite(angle) ? normAngle(angle) : 0;
  return {
    // контрактные поля (§17): читают движок и game
    type,
    x: typeof x === 'number' ? x : 0,
    y: typeof y === 'number' ? y : 0,
    z: def.fly ? HOVER_MID : 0,
    angle: a,
    hp: def.hp,
    state: 'idle',
    sprite: SPRITES[type].walk[0],
    radius: def.radius,
    h: def.h,
    solid: true,
    bright: false,
    awake: false,
    target: 'player',
    dead: false,
    flip: false,
    // внутреннее состояние ИИ
    def,
    spr: SPRITES[type],
    alerted: false,             // выставляет game.noise()
    animT: Math.random(),
    moveDir: Math.round(a / QPI) * QPI,
    moveTimer: 0,
    cooldownT: 0,
    painT: 0,
    attackT: 0,
    attackFired: false,
    attackKind: null,
    lookT: Math.random() * 0.25, // рассинхронизация LOS-проверок в idle
    dieT: 0,
    bobT: Math.random() * HOVER_PERIOD,
  };
}

export function updateEnemy(e, game, dt) {
  if (!e || !game || !game.map || !(dt > 0)) return;
  const def = e.def || ENEMY_DEFS[e.type];
  if (!def) return;
  e.def = def;
  if (!e.spr) e.spr = SPRITES[e.type] || SPRITES.zombie;

  if (e.state === 'dead') {
    if (def.fly && e.z > 0) e.z = Math.max(0, e.z - dt * CORPSE_FALL);
    return;
  }
  if (e.state === 'die') {
    updateDie(e, def, dt);
    return;
  }

  // парение какодемона (обычные коллизии, только z-анимация)
  if (def.fly) {
    e.bobT += dt;
    if (e.bobT >= HOVER_PERIOD) e.bobT -= HOVER_PERIOD; // не копим фазу бесконечно
    e.z = HOVER_MID + Math.sin(e.bobT * HOVER_FREQ) * HOVER_AMP;
  }
  if (e.cooldownT > 0) e.cooldownT -= dt;

  switch (e.state) {
    case 'idle':   updateIdle(e, game, dt); break;
    case 'chase':  updateChase(e, game, def, dt); break;
    case 'attack': updateAttack(e, game, def, dt); break;
    case 'pain':   updatePain(e, dt); break;
    default:       e.state = e.awake ? 'chase' : 'idle';
  }
}

// attacker: 'player' | enemy-объект (для infighting и сплэша от game.explode)
export function damageEnemy(e, dmg, game, attacker) {
  if (!e || e.dead || !(dmg > 0)) return;
  const def = e.def || ENEMY_DEFS[e.type];
  if (!def) return;
  e.def = def;
  if (!e.spr) e.spr = SPRITES[e.type] || SPRITES.zombie;
  e.hp -= dmg;

  // infighting: бьёт враг другого типа — переключаем цель на обидчика
  const byEnemy = !!attacker && attacker !== 'player' && typeof attacker === 'object' && !attacker.isPlayer;
  if (byEnemy) {
    if (attacker.type !== e.type && !attacker.dead) e.target = attacker;
  } else {
    e.target = 'player';
  }

  if (e.hp <= 0) {
    kill(e, game, def);
    return;
  }

  // урон будит в любом случае
  if (!e.awake) {
    e.awake = true;
    e.alerted = false;
    snd(game, e.spr.sndSight, e.x, e.y);
  }
  if (e.state === 'idle') {
    e.state = 'chase';
    e.moveTimer = 0;
  }

  if (Math.random() < def.painChance) {
    e.state = 'pain';
    e.painT = PAIN_TIME;
    e.sprite = e.spr.pain;
    e.attackFired = false;
    snd(game, e.spr.sndPain, e.x, e.y);
  }
}

// ---------- состояния ----------

function updateIdle(e, game, dt) {
  e.sprite = e.spr.walk[0];
  let wake = !!e.alerted;
  if (!wake) {
    e.lookT -= dt;
    if (e.lookT <= 0) {
      e.lookT = 0.18 + Math.random() * 0.14;
      const p = game.player;
      if (p && p.alive) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < WAKE_NEAR) {
          wake = true;
        } else if (dist < WAKE_FAR) {
          const rel = normAngle(Math.atan2(dy, dx) - e.angle);
          if (Math.abs(rel) <= WAKE_HALF_FOV && game.map.lineOfSight(e.x, e.y, p.x, p.y)) wake = true;
        }
      }
    }
  }
  if (wake) {
    e.alerted = false;
    e.awake = true;
    e.state = 'chase';
    e.moveTimer = 0;
    e.animT = Math.random();
    snd(game, e.spr.sndSight, e.x, e.y);
  }
}

function updateChase(e, game, def, dt) {
  e.animT += dt;
  if (e.animT >= WALK_CYCLE) e.animT -= WALK_CYCLE; // не копим фазу бесконечно
  e.sprite = e.spr.walk[Math.floor(e.animT * WALK_FPS) % 4];

  const t = acquireTarget(e, game);
  if (t) {
    const dx = t.x - e.x, dy = t.y - e.y;
    const dist = Math.hypot(dx, dy);
    // melee — без кулдауна, темп задаёт длительность анимации (§17)
    if (def.melee && dist < MELEE_START) {
      startAttack(e, t, 'melee');
      return;
    }
    // ranged: LOS && dist<18 && кулдаун истёк && шанс
    if ((def.hitscan || def.projectile) && dist < RANGED_DIST && e.cooldownT <= 0) {
      const aggro = (game.skillDef && game.skillDef.aggro) || 1;
      const chance = dt * (1.2 * aggro) * clamp(2 - dist / 8, 0.4, 2);
      if (Math.random() < chance && game.map.lineOfSight(e.x, e.y, t.x, t.y)) {
        startAttack(e, t, 'ranged');
        return;
      }
    }
  }

  // движение Doom-стилем: октант ≈ на цель, держим 0.35–0.6с, при блокировке — перебор
  const things = getSolids(game);
  e.moveTimer -= dt;
  if (e.moveTimer <= 0) {
    pickDir(e, game, things, wantAngle(e, t));
  }
  if (!moveStep(e, game, things, def, dt)) {
    if (tryOpenDoor(e, game)) {
      // упёрлись в открывающуюся дверь — ждём, не меняя направления
      e.moveTimer = Math.max(e.moveTimer, 0.25);
    } else {
      pickDir(e, game, things, wantAngle(e, t));
    }
  }
  e.angle = e.moveDir;
}

function updateAttack(e, game, def, dt) {
  e.attackT += dt;
  const frame = Math.min(2, Math.floor((e.attackT / def.attackTime) * 3));
  e.sprite = e.spr.attack[frame];
  if (frame >= 1 && !e.attackFired) {
    e.attackFired = true;
    fireAttack(e, game, def);
  }
  if (e.attackT >= def.attackTime) {
    e.state = 'chase';
    e.cooldownT = def.cooldown;
    e.animT = Math.random();
    e.moveTimer = 0;
  }
}

function updatePain(e, dt) {
  e.sprite = e.spr.pain;
  e.painT -= dt;
  if (e.painT <= 0) {
    e.state = 'chase';
    e.moveTimer = 0;
    e.animT = Math.random();
  }
}

function updateDie(e, def, dt) {
  e.dieT += dt;
  const frame = Math.min(4, Math.floor(e.dieT * DIE_FPS));
  e.sprite = e.spr.die[frame];
  if (def.fly && e.z > 0) e.z = Math.max(0, e.z - dt * CORPSE_FALL);
  if (frame >= 4) {
    e.state = 'dead'; // труп остаётся лежать (die4)
  }
}

// ---------- атаки ----------

function startAttack(e, t, kind) {
  e.state = 'attack';
  e.attackT = 0;
  e.attackFired = false;
  e.attackKind = kind;
  e.sprite = e.spr.attack[0];
  e.angle = Math.atan2(t.y - e.y, t.x - e.x);
}

function fireAttack(e, game, def) {
  snd(game, e.spr.sndAttack, e.x, e.y);
  const t = acquireTarget(e, game);
  if (!t) return;
  const dx = t.x - e.x, dy = t.y - e.y;
  const dist = Math.max(0.001, Math.hypot(dx, dy));
  const aim = Math.atan2(dy, dx);
  e.angle = aim;

  if (e.attackKind === 'melee') {
    if (def.melee && dist <= MELEE_HIT) {
      const dmg = rollDmg(def.melee);
      if (t === game.player) {
        if (typeof game.damagePlayer === 'function') game.damagePlayer(dmg, e.x, e.y);
      } else {
        damageEnemy(t, dmg, game, e);
      }
    }
    return;
  }

  const tz = targetCenterZ(t, game);
  if (def.hitscan) {
    if (typeof game.hitscan !== 'function') return;
    const z = clamp(e.z + e.h * 0.7, 0.1, 0.95);
    game.hitscan({
      x: e.x, y: e.y, z,
      angle: aim,
      dz: clamp((tz - z) / dist, -0.8, 0.8),
      damage: def.hitscan.damage,
      pellets: def.hitscan.pellets,
      spreadDeg: def.hitscan.spreadDeg,
      owner: e,
    });
  } else if (def.projectile) {
    if (typeof game.spawnProjectile !== 'function') return;
    const z = clamp(e.z + e.h * 0.6, 0.15, 0.9);
    game.spawnProjectile(def.projectile, e.x, e.y, z, aim, clamp((tz - z) / dist, -0.6, 0.6), e);
  }
}

// ---------- смерть ----------

function kill(e, game, def) {
  e.dead = true;
  e.solid = false;
  e.state = 'die';
  e.dieT = 0;
  e.hp = 0;
  e.target = null;
  e.sprite = e.spr.die[0];
  snd(game, e.spr.sndDie, e.x, e.y);
  if (game && game.stats) game.stats.kills++;
  if (def.drops && game && typeof game.spawnItem === 'function') {
    game.spawnItem(def.drops, e.x, e.y);
  }
}

// ---------- движение ----------

function wantAngle(e, t) {
  // нет цели (игрок мёртв) — бесцельное блуждание
  if (!t) return normAngle(e.moveDir + (Math.random() - 0.5) * 2.4);
  return Math.atan2(t.y - e.y, t.x - e.x);
}

function pickDir(e, game, things, want) {
  const probe = Math.max(0.12, e.def.speed * 0.07);
  const base = Math.round(want / QPI);
  for (let i = 0; i < DIR_OFFSETS.length; i++) {
    const dir = normAngle((base + DIR_OFFSETS[i]) * QPI);
    if (dirFree(e, game, things, dir, probe)) {
      e.moveDir = dir;
      e.moveTimer = 0.35 + Math.random() * 0.25;
      return;
    }
  }
  // зажат со всех сторон — случайный толчок и скорая пере-попытка
  e.moveDir = normAngle(want + (Math.random() - 0.5) * Math.PI);
  e.moveTimer = 0.2;
}

function dirFree(e, game, things, dir, dist) {
  const r = moveWithCollision(game.map, e.x, e.y, Math.cos(dir) * dist, Math.sin(dir) * dist, e.radius);
  if (r.collided) return false;
  return !entityBlocked(things, e, r.x, r.y);
}

function moveStep(e, game, things, def, dt) {
  const step = def.speed * dt;
  const r = moveWithCollision(game.map, e.x, e.y, Math.cos(e.moveDir) * step, Math.sin(e.moveDir) * step, e.radius);
  if (entityBlocked(things, e, r.x, r.y)) return false;
  const moved = r.x !== e.x || r.y !== e.y;
  e.x = r.x;
  e.y = r.y;
  return moved && !r.collided;
}

// монстр, упёршийся в дверь без ключа, открывает её (§17)
function tryOpenDoor(e, game) {
  const map = game.map;
  if (!map || typeof map.getDoor !== 'function' || typeof map.monsterOpenDoor !== 'function') return false;
  const reach = e.radius + 0.45;
  const ox = Math.cos(e.moveDir) * reach, oy = Math.sin(e.moveDir) * reach;
  const cx = Math.floor(e.x), cy = Math.floor(e.y);
  const fx = Math.floor(e.x + ox), fy = Math.floor(e.y + oy);
  // клетка прямо по курсу и её осевые проекции (для диагонального движения)
  let found = checkDoorCell(game, map, fx, fy);
  if (!found && fx !== cx) found = checkDoorCell(game, map, fx, cy);
  if (!found && fy !== cy) found = checkDoorCell(game, map, cx, fy);
  return found;
}

function checkDoorCell(game, map, ix, iy) {
  const d = map.getDoor(ix, iy);
  if (!d || d.key || d.secret || d.openness >= 0.85) return false;
  // звук — только при реальном запуске открытия, не при каждом толчке в полотно
  if (d.state === 'closed' || d.state === 'closing') {
    snd(game, 'door_open', ix + 0.5, iy + 0.5);
  }
  map.monsterOpenDoor(ix, iy);
  return true;
}

// ---------- цели и утилиты ----------

// 'player' -> объект игрока (null, если мёртв); враг-цель умер -> возврат к игроку
function acquireTarget(e, game) {
  const t = e.target;
  if (t && t !== 'player' && typeof t === 'object') {
    if (!t.dead) return t;
    e.target = 'player';
  }
  const p = game.player;
  return p && p.alive ? p : null;
}

function targetCenterZ(t, game) {
  if (game && t === game.player) return 0.5;
  return (t.z || 0) + (t.h || 0.8) / 2;
}

function getSolids(game) {
  return typeof game.solidThings === 'function' ? game.solidThings() : EMPTY_ARR;
}

function normAngle(a) {
  a %= Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  else if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function snd(game, name, x, y) {
  if (game && typeof game.playSound === 'function') game.playSound(name, x, y);
}

function warnOnce(msg) {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn(msg);
}
