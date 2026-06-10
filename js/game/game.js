// Игровое ядро: состояние мира, бой, снаряды, подборы, эффекты, отрисовка сцены.
// Контракт API: docs/architecture.md §23.

import {
  SCREEN_W, VIEW_H, EYE, PLAYER_RADIUS, DIFFICULTY, AMMO_MAX,
  PROJECTILE_DEFS, EFFECT_DEFS, MAX_DIST, clamp, rollDmg,
} from '../config.js';
import { GameMap } from './map.js';
import { moveWithCollision } from '../engine/physics.js';
import {
  createPlayer, updatePlayer, damagePlayer, addHealth, addArmor, addAmmo, giveWeapon,
} from './player.js';
import { WeaponSystem, WEAPON_DEFS } from './weapons.js';
import { ENEMY_DEFS, createEnemy, updateEnemy, damageEnemy } from './enemies.js';
import { drawText } from '../ui/font.js';

const DECOR_DEFS = {
  barrel:  { sprite: 'barrel', h: 0.52, radius: 0.24, solid: true, hp: 20, bright: false },
  lamp:    { frames: ['lamp0', 'lamp1'], fps: 3, h: 0.72, radius: 0.16, solid: true, bright: true },
  torch:   { frames: ['torch0', 'torch1', 'torch2', 'torch3'], fps: 8, h: 0.8, radius: 0.16, solid: true, bright: true },
  pillar:  { sprite: 'pillar', h: 0.55, radius: 0.2, solid: true, bright: false },
  corpse0: { sprite: 'corpse0', h: 0.45, radius: 0.2, solid: false, bright: false },
  corpse1: { sprite: 'corpse1', h: 0.85, radius: 0.2, solid: false, bright: false },
  // — пропсы (эксперимент: пропсы), спрайты из sprites_props.js —
  skull_pile:     { sprite: 'skull_pile', h: 0.34, radius: 0, solid: false, bright: false },
  bones:          { sprite: 'bones', h: 0.2, radius: 0, solid: false, bright: false },
  rubble:         { sprite: 'rubble', h: 0.26, radius: 0, solid: false, bright: false },
  shells_spent:   { sprite: 'shells_spent', h: 0.08, radius: 0, solid: false, bright: false },
  blood_pool:     { sprite: 'blood_pool', h: 0.07, radius: 0, solid: false, bright: false },
  cable_coil:     { sprite: 'cable_coil', h: 0.22, radius: 0, solid: false, bright: false },
  monitor_broken: { sprite: 'monitor_broken', h: 0.42, radius: 0, solid: false, bright: false },
  candle:         { frames: ['candle0', 'candle1'], fps: 6, h: 0.3, radius: 0, solid: false, bright: true },
  lamp_red:       { frames: ['lamp_red0', 'lamp_red1'], fps: 2, h: 0.62, radius: 0.14, solid: true, bright: true },
  hanging_chain:  { sprite: 'hanging_chain', h: 0.95, radius: 0, solid: false, bright: false },
  gore_hang:      { sprite: 'gore_hang', h: 0.95, radius: 0, solid: false, bright: false },
  crate_small:    { sprite: 'crate_small', h: 0.5, radius: 0.3, solid: true, bright: false },
};

const KEY_NAMES = { blue: 'СИНЯЯ', yellow: 'ЖЁЛТАЯ', red: 'КРАСНАЯ' };

// Подбираемые предметы: apply -> true, если предмет потрачен.
const PICKUP_DEFS = {
  stimpack:    { sprite: 'stimpack', h: 0.3, snd: 'pl_pickup', msg: 'ПОДОБРАН СТИМПАК.', apply: (g) => addHealth(g.player, 10, 100) },
  medikit:     { sprite: 'medikit', h: 0.36, snd: 'pl_pickup', msg: 'ПОДОБРАНА АПТЕЧКА.', apply: (g) => addHealth(g.player, 25, 100) },
  healthbonus: { sprite: 'healthbonus', h: 0.26, bob: true, snd: 'pl_pickup', msg: 'БОНУС ЗДОРОВЬЯ +1.', apply: (g) => addHealth(g.player, 1, 200) },
  armorbonus:  { sprite: 'armorbonus', h: 0.26, bob: true, snd: 'pl_pickup', msg: 'БОНУС БРОНИ +1.', apply: (g) => addArmor(g.player, 1, 1, 200) },
  armorgreen:  { sprite: 'armorgreen', h: 0.42, snd: 'pl_pickup', msg: 'ПОДОБРАН БРОНЕЖИЛЕТ.', apply: (g) => setArmor(g.player, 100, 1) },
  armorblue:   { sprite: 'armorblue', h: 0.42, snd: 'pl_power', msg: 'ПОДОБРАНА ТЯЖЁЛАЯ БРОНЯ!', apply: (g) => setArmor(g.player, 200, 2) },
  soulsphere:  { sprite: 'soulsphere', h: 0.5, bob: true, snd: 'pl_power', msg: 'СВЕРХЗАРЯД!', apply: (g) => addHealth(g.player, 100, 200) },
  ammo_clip:      { sprite: 'ammo_clip', h: 0.22, snd: 'pl_pickup', msg: 'ПОДОБРАНА ОБОЙМА.', ammo: ['bullets', 10] },
  ammo_bulletbox: { sprite: 'ammo_bulletbox', h: 0.3, snd: 'pl_pickup', msg: 'ПОДОБРАН ЯЩИК ПАТРОНОВ.', ammo: ['bullets', 50] },
  ammo_shells:    { sprite: 'ammo_shells', h: 0.2, snd: 'pl_pickup', msg: 'ПОДОБРАНЫ ПАТРОНЫ ДЛЯ ДРОБОВИКА.', ammo: ['shells', 4] },
  ammo_shellbox:  { sprite: 'ammo_shellbox', h: 0.28, snd: 'pl_pickup', msg: 'ПОДОБРАН ЯЩИК ДРОБИ.', ammo: ['shells', 20] },
  ammo_rocket:    { sprite: 'ammo_rocket', h: 0.32, snd: 'pl_pickup', msg: 'ПОДОБРАНА РАКЕТА.', ammo: ['rockets', 1] },
  ammo_rocketbox: { sprite: 'ammo_rocketbox', h: 0.32, snd: 'pl_pickup', msg: 'ПОДОБРАН ЯЩИК РАКЕТ.', ammo: ['rockets', 5] },
  ammo_cell:      { sprite: 'ammo_cell', h: 0.26, snd: 'pl_pickup', msg: 'ПОДОБРАНА ЭНЕРГОБАТАРЕЯ.', ammo: ['cells', 20] },
  ammo_cellpack:  { sprite: 'ammo_cellpack', h: 0.36, snd: 'pl_pickup', msg: 'ПОДОБРАН ЭНЕРГОБЛОК.', ammo: ['cells', 100] },
  pickup_shotgun:        { sprite: 'pickup_shotgun', h: 0.3, weapon: 'shotgun', msg: 'ВЫ ПОЛУЧИЛИ ДРОБОВИК!' },
  pickup_chaingun:       { sprite: 'pickup_chaingun', h: 0.3, weapon: 'chaingun', msg: 'ВЫ ПОЛУЧИЛИ ПУЛЕМЁТ!' },
  pickup_rocketlauncher: { sprite: 'pickup_rocketlauncher', h: 0.32, weapon: 'rocketlauncher', msg: 'ВЫ ПОЛУЧИЛИ РАКЕТНИЦУ!' },
  pickup_plasmarifle:    { sprite: 'pickup_plasmarifle', h: 0.32, weapon: 'plasmarifle', msg: 'ВЫ ПОЛУЧИЛИ ПЛАЗМАГАН!' },
  pickup_bfg:            { sprite: 'pickup_bfg', h: 0.4, weapon: 'bfg', msg: 'ВЫ ПОЛУЧИЛИ BFG-9000! О ДА.' },
  key_blue:   { sprite: 'key_blue', h: 0.28, bob: true, key: 'blue' },
  key_yellow: { sprite: 'key_yellow', h: 0.28, bob: true, key: 'yellow' },
  key_red:    { sprite: 'key_red', h: 0.28, bob: true, key: 'red' },
};

function setArmor(p, amount, cls) {
  if (p.armor >= amount) return false;
  p.armor = amount;
  p.armorClass = cls;
  return true;
}

export class Game {
  constructor(level, difficulty, assets, sound, settings, input) {
    this.level = level;
    this.difficulty = difficulty;
    this.skillDef = DIFFICULTY[difficulty];
    this.assets = assets;
    this.sound = sound;
    this.settings = settings;
    this.input = input;

    this.map = new GameMap(level);
    this.player = createPlayer(level.playerStart.x, level.playerStart.y, level.playerStart.angle);

    this.enemies = [];
    this.items = [];
    this.decor = [];
    this.projectiles = [];
    this.effects = [];
    this.messages = [];

    this.time = 0;
    this.automap = false;
    this.visited = new Set();
    this.stats = { kills: 0, killsTotal: 0, items: 0, itemsTotal: 0, secrets: 0, secretsTotal: this.map.secretsTotal };
    this.over = false;
    this.won = false;
    this.levelEnding = 0;
    this.deathTimer = 0;

    this.flashColor = { r: 0, g: 0, b: 0, a: 0 };
    this.shakeT = 0;
    this.shakePow = 0;
    this.lastNoise = null;
    this._floorDmgTimer = 0;
    this._visitTimer = 0;
    this._ents = [];
    this._solid = [];
    this._warned = new Set();

    this._spawnThings();
    this.weaponSys = new WeaponSystem(this);
    this._updateVisited(true);
  }

  _spawnThings() {
    for (const t of this.level.things) {
      const skills = t.skills || [1, 2, 3, 4];
      if (!skills.includes(this.difficulty)) continue;
      if (ENEMY_DEFS[t.type]) {
        const e = createEnemy(t.type, t.x, t.y, t.angle || 0);
        this.enemies.push(e);
        this.stats.killsTotal++;
      } else if (DECOR_DEFS[t.type]) {
        const d = DECOR_DEFS[t.type];
        this.decor.push({
          type: t.type, def: d, x: t.x, y: t.y,
          h: d.h, radius: d.radius, solid: d.solid,
          hp: d.hp || Infinity, fuse: 0, dead: false,
        });
      } else if (PICKUP_DEFS[t.type]) {
        this._addItem(t.type, t.x, t.y, false);
        this.stats.itemsTotal++;
      } else {
        this._warnOnce('Неизвестный тип thing: ' + t.type);
      }
    }
  }

  _addItem(type, x, y, dropped) {
    const def = PICKUP_DEFS[type];
    if (!def) return;
    this.items.push({ type, def, x, y, dropped });
  }

  _warnOnce(msg) {
    if (this._warned.has(msg)) return;
    this._warned.add(msg);
    console.warn(msg);
  }

  // ---------- API для модулей (§23) ----------

  message(text) {
    this.messages.unshift({ text, t: 3.5 });
    if (this.messages.length > 4) this.messages.length = 4;
  }

  playSound(name, x, y) {
    if (!this.sound) return;
    if (x === undefined) { this.sound.play(name); return; }
    const p = this.player;
    const dx = x - p.x, dy = y - p.y;
    const dist = Math.hypot(dx, dy);
    const vol = clamp(1 - dist / 18, 0, 1);
    if (vol <= 0.01) return;
    const rel = Math.atan2(dy, dx) - p.angle;
    this.sound.play(name, { volume: vol * vol * 0.9 + vol * 0.1, pan: clamp(Math.sin(rel) * 0.7, -1, 1) });
  }

  noise(x, y) {
    this.lastNoise = { x, y, t: this.time };
    for (const e of this.enemies) {
      if (e.dead || e.awake) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 6 || (d < 12 && this.map.lineOfSight(x, y, e.x, e.y))) e.alerted = true;
    }
  }

  hitscan(opts) {
    const {
      x, y, z = 0.45, angle, dz = 0, damage = [5, 15], pellets = 1,
      spreadDeg = 0, range = MAX_DIST, owner = 'player',
    } = opts;
    const spread = (spreadDeg * Math.PI) / 180;
    for (let i = 0; i < pellets; i++) {
      const a = angle + (Math.random() - 0.5) * 2 * spread;
      const ca = Math.cos(a), sa = Math.sin(a);
      const wall = this.map.raycastWall(x, y, ca, sa, range);
      const wallDist = wall ? wall.dist : range;
      // ближайшая цель на луче
      let best = null, bestT = wallDist;
      this._eachShootable(owner, (t) => {
        const tx = t.x - x, ty = t.y - y;
        const along = tx * ca + ty * sa;
        if (along < 0.15 || along >= bestT) return;
        const perp = Math.abs(-tx * sa + ty * ca);
        if (perp < (t.radius || 0.3) + 0.05) { best = t; bestT = along; }
      });
      if (best) {
        const dmg = rollDmg(damage);
        const hx = x + ca * bestT, hy = y + sa * bestT;
        this._damageShootable(best, dmg, owner, x, y);
        this.spawnEffect(best.isPlayer ? 'puff' : 'blood', hx, hy, clamp(0.3 + dz * bestT + Math.random() * 0.15, 0.1, 0.8));
      } else if (wall) {
        const hx = x + ca * (wallDist - 0.05), hy = y + sa * (wallDist - 0.05);
        this.spawnEffect('puff', hx, hy, clamp(0.4 + dz * wallDist, 0.1, 0.85));
      }
    }
  }

  // перебор целей для выстрелов/снарядов владельца owner
  _eachShootable(owner, fn) {
    const fromPlayer = owner === 'player';
    if (!fromPlayer && this.player.alive) {
      fn({ isPlayer: true, x: this.player.x, y: this.player.y, radius: PLAYER_RADIUS, h: 0.8, zc: 0.5 });
    }
    for (const e of this.enemies) {
      if (e.dead || e === owner) continue;
      fn(e);
    }
    for (const d of this.decor) {
      if (d.type === 'barrel' && !d.dead) fn(d);
    }
  }

  _damageShootable(t, dmg, owner, sx, sy) {
    if (t.isPlayer) {
      this.damagePlayer(dmg, sx, sy);
    } else if (t.type === 'barrel') {
      this._damageBarrel(t, dmg, owner);
    } else {
      damageEnemy(t, dmg, this, owner);
    }
  }

  _damageBarrel(b, dmg, owner) {
    if (b.dead) return;
    b.hp -= dmg;
    if (b.hp <= 0 && !b.fuse) { b.fuse = 0.08; b.fuseOwner = owner; }
  }

  spawnProjectile(type, x, y, z, angle, dz, owner) {
    const def = PROJECTILE_DEFS[type];
    if (!def) { this._warnOnce('Нет снаряда: ' + type); return; }
    this.projectiles.push({
      type, def, x, y,
      cz: clamp(z, 0.1, 0.95),
      dx: Math.cos(angle) * def.speed,
      dy: Math.sin(angle) * def.speed,
      dz: (dz || 0) * def.speed,
      owner, animT: Math.random(),
    });
  }

  spawnItem(type, x, y) {
    this._addItem(type, x, y, true);
    this.stats.itemsTotal++;
  }

  spawnEffect(type, x, y, z) {
    const def = EFFECT_DEFS[type];
    if (!def) { this._warnOnce('Нет эффекта: ' + type); return; }
    this.effects.push({ def, x, y, z: z || 0, age: 0 });
  }

  explode(x, y, damage, radius, owner) {
    this.spawnEffect('explosion', x, y, 0.12);
    this.playSound('explosion', x, y);
    // игрок
    const p = this.player;
    if (p.alive) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius && this.map.lineOfSight(x, y, p.x, p.y)) {
        this.damagePlayer(damage * (1 - d / radius), x, y);
      }
      this.shake(clamp(2.2 - d * 0.25, 0, 2.2));
    }
    // враги
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.radius && this.map.lineOfSight(x, y, e.x, e.y)) {
        damageEnemy(e, damage * clamp(1 - d / radius, 0.1, 1), this, owner);
      }
    }
    // бочки (цепная реакция с фитилём)
    for (const b of this.decor) {
      if (b.type !== 'barrel' || b.dead || b.fuse) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < radius) { b.fuse = 0.12 + d * 0.06; b.fuseOwner = owner; }
    }
    this.noise(x, y);
  }

  damagePlayer(dmg, srcX, srcY) {
    if (!this.player.alive || dmg <= 0) return;
    damagePlayer(this.player, dmg, this, srcX, srcY);
    if (!this.player.alive) this.over = true;
  }

  flash(r, g, b, a) {
    const f = this.flashColor;
    if (a >= f.a) { f.r = r; f.g = g; f.b = b; f.a = Math.min(a, 0.65); }
  }

  shake(power) {
    if (power > this.shakePow) { this.shakePow = power; this.shakeT = 0.35; }
  }

  useAction() {
    const res = this.map.use(this.player.x, this.player.y, this.player.angle, this);
    if (res === 'wall') this.playSound('pl_oof');
  }

  foundSecret() {
    this.stats.secrets++;
    this.message('ВЫ НАШЛИ ТАЙНИК!');
    if (this.sound) this.sound.play('secret');
  }

  endLevel() {
    if (this.levelEnding) return;
    this.levelEnding = 0.9;
    this.flash(255, 255, 255, 0.3);
  }

  // ---------- обновление ----------

  update(dt) {
    if (this.won) return;
    if (this.levelEnding) {
      this.levelEnding -= dt;
      if (this.levelEnding <= 0) { this.won = true; return; }
    }
    if (!this.over && !this.levelEnding) this.time += dt;

    this.map.update(dt, this);

    const p = this.player;
    if (p.alive) {
      updatePlayer(p, this, dt);
      this._collidePlayerWithThings();
      this.weaponSys.update(dt);
      this._floorDamage(dt);
      this._pickupItems();
      this._visitTick(dt);
    } else {
      this.deathTimer += dt;
      updatePlayer(p, this, dt); // опускание камеры и затухание скорости
    }

    for (const e of this.enemies) updateEnemy(e, this, dt);
    this._updateProjectiles(dt);
    this._updateDecor(dt);

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.age += dt;
      if (fx.age * fx.def.fps >= fx.def.frames.length) this.effects.splice(i, 1);
    }
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].t -= dt;
      if (this.messages[i].t <= 0) this.messages.splice(i, 1);
    }
    if (this.flashColor.a > 0) this.flashColor.a = Math.max(0, this.flashColor.a - dt * 1.6);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakePow = 0; }
  }

  solidThings() {
    const arr = this._solid;
    arr.length = 0;
    if (this.player.alive) arr.push({ x: this.player.x, y: this.player.y, radius: PLAYER_RADIUS, solid: true, isPlayer: true });
    for (const e of this.enemies) if (!e.dead && e.solid) arr.push(e);
    for (const d of this.decor) if (d.solid && !d.dead) arr.push(d);
    return arr;
  }

  _collidePlayerWithThings() {
    const p = this.player;
    for (const t of this.enemies) {
      if (t.dead || !t.solid) continue;
      pushOut(this.map, p, t, PLAYER_RADIUS);
    }
    for (const t of this.decor) {
      if (!t.solid || t.dead) continue;
      pushOut(this.map, p, t, PLAYER_RADIUS);
    }
  }

  _floorDamage(dt) {
    const fl = this.map.getFloor(Math.floor(this.player.x), Math.floor(this.player.y));
    if (fl.damage > 0) {
      this._floorDmgTimer -= dt;
      if (this._floorDmgTimer <= 0) {
        this._floorDmgTimer = 0.9;
        this.damagePlayer(fl.damage, undefined, undefined);
      }
    } else {
      this._floorDmgTimer = Math.min(this._floorDmgTimer, 0.25);
    }
  }

  _pickupItems() {
    const p = this.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const dx = it.x - p.x, dy = it.y - p.y;
      if (dx * dx + dy * dy > 0.45 * 0.45) continue;
      if (this._applyPickup(it)) {
        this.items.splice(i, 1);
        this.stats.items++;
        this.flash(255, 210, 80, 0.12);
      }
    }
  }

  _applyPickup(it) {
    const def = it.def;
    const p = this.player;
    // ключи
    if (def.key) {
      if (p.keys[def.key]) return true;
      p.keys[def.key] = true;
      this.message(`ПОЛУЧЕНА ${KEY_NAMES[def.key]} КЛЮЧ-КАРТА.`);
      this.playSound('pl_keyup');
      return true;
    }
    // оружие
    if (def.weapon) {
      const res = giveWeapon(p, def.weapon) || {};
      if (res.taken || res.isNew) {
        this.message(def.msg);
        this.playSound(res.isNew ? 'pl_wpnup' : 'pl_pickup');
        if (res.isNew) {
          p.faceEvent = { type: 'grin', t: 1.2 };
          const slot = (WEAPON_DEFS[def.weapon] || {}).slot;
          if (slot) this.weaponSys.switchTo(slot);
        }
        return true;
      }
      return false;
    }
    // патроны
    if (def.ammo) {
      let n = Math.round(def.ammo[1] * this.skillDef.ammoMult * (it.dropped ? 0.5 : 1));
      n = Math.max(1, n);
      if (!addAmmo(p, def.ammo[0], n)) return false;
      this.message(def.msg);
      this.playSound(def.snd);
      return true;
    }
    // здоровье/броня/сферы
    if (!def.apply(this)) return false;
    this.message(def.msg);
    this.playSound(def.snd || 'pl_pickup');
    return true;
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.animT += dt;
      const def = pr.def;
      const steps = Math.max(1, Math.ceil((def.speed * dt) / 0.2));
      let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        pr.x += (pr.dx * dt) / steps;
        pr.y += (pr.dy * dt) / steps;
        pr.cz += (pr.dz * dt) / steps;
        if (this.map.isSolidAt(pr.x, pr.y) || pr.cz < def.h / 2 - 0.05 || pr.cz > 1.02 - def.h / 2) {
          pr.x -= (pr.dx * dt) / steps; pr.y -= (pr.dy * dt) / steps;
          hit = true;
          break;
        }
        // цели
        let target = null;
        this._eachShootable(pr.owner, (t) => {
          if (target) return;
          const dx = t.x - pr.x, dy = t.y - pr.y;
          const rr = def.radius + (t.radius || 0.3);
          if (dx * dx + dy * dy > rr * rr) return;
          const tzc = t.isPlayer ? 0.5 : (t.z || 0) + (t.h || 0.8) / 2;
          if (Math.abs(pr.cz - tzc) > def.h / 2 + (t.h || 0.8) / 2) return;
          target = t;
        });
        if (target) {
          this._damageShootable(target, rollDmg(def.dmg), pr.owner, pr.x, pr.y);
          hit = true;
        }
      }
      if (hit) {
        this.spawnEffect(def.hitEffect, pr.x, pr.y, clamp(pr.cz - (EFFECT_DEFS[def.hitEffect] || {}).h * 0.5 || 0.2, 0, 0.8));
        if (def.splash > 0) {
          this.explode(pr.x, pr.y, def.splash, def.splashR, pr.owner);
          if (pr.type === 'bfgball') this.playSound('wp_bfg_hit', pr.x, pr.y);
        } else {
          this.playSound(pr.type === 'plasmaball' ? 'prj_hit' : 'prj_hit', pr.x, pr.y);
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  _updateDecor(dt) {
    for (let i = this.decor.length - 1; i >= 0; i--) {
      const d = this.decor[i];
      if (d.type !== 'barrel' || d.dead) continue;
      if (d.fuse > 0) {
        d.fuse -= dt;
        if (d.fuse <= 0) {
          d.dead = true;
          this.explode(d.x, d.y, 80, 1.5, d.fuseOwner || 'player');
          this.decor.splice(i, 1);
        }
      }
    }
  }

  _visitTick(dt) {
    this._visitTimer -= dt;
    if (this._visitTimer > 0) return;
    this._visitTimer = 0.15;
    this._updateVisited(false);
  }

  _updateVisited(force) {
    const p = this.player;
    const cx = Math.floor(p.x), cy = Math.floor(p.y);
    const R = 5;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        const ix = cx + dx, iy = cy + dy;
        if (ix < 0 || iy < 0 || ix >= this.map.w || iy >= this.map.h) continue;
        const key = ix + ',' + iy;
        if (this.visited.has(key)) continue;
        if (force || this.map.lineOfSight(p.x, p.y, ix + 0.5, iy + 0.5)) this.visited.add(key);
      }
    }
  }

  // ---------- отрисовка ----------

  getShakeOffset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const m = this.shakePow * Math.min(1, this.shakeT * 4);
    return {
      x: Math.round((Math.random() - 0.5) * 2 * m),
      y: Math.round((Math.random() - 0.5) * 2 * m),
    };
  }

  buildEntities() {
    const ents = this._ents;
    ents.length = 0;
    const t = this.time;
    for (const d of this.decor) {
      if (d.dead) continue;
      const def = d.def;
      const sprite = def.frames ? def.frames[Math.floor(t * def.fps) % def.frames.length] : def.sprite;
      ents.push({ x: d.x, y: d.y, z: 0, h: d.h, sprite, bright: def.bright, flip: false });
    }
    for (const it of this.items) {
      const z = it.def.bob ? 0.04 + Math.sin(t * 3 + it.x * 5 + it.y * 3) * 0.035 + 0.035 : 0;
      ents.push({ x: it.x, y: it.y, z, h: it.def.h, sprite: it.def.sprite, bright: false, flip: false });
    }
    for (const e of this.enemies) {
      if (!e.sprite) continue;
      ents.push({ x: e.x, y: e.y, z: e.z || 0, h: e.h, sprite: e.sprite, bright: false, flip: !!e.flip });
    }
    for (const pr of this.projectiles) {
      const def = pr.def;
      const sprite = def.sprites[Math.floor(pr.animT * def.animFps) % def.sprites.length];
      ents.push({ x: pr.x, y: pr.y, z: pr.cz - def.h / 2, h: def.h, sprite, bright: true, flip: false });
    }
    for (const fx of this.effects) {
      const idx = Math.min(fx.def.frames.length - 1, Math.floor(fx.age * fx.def.fps));
      ents.push({ x: fx.x, y: fx.y, z: fx.z, h: fx.def.h, sprite: fx.def.frames[idx], bright: fx.def.bright, flip: false });
    }
    return ents;
  }

  render(raycaster, frame, fcCtx) {
    const p = this.player;
    raycaster.render(frame, {
      map: this.map,
      px: p.x, py: p.y, pz: p.z !== undefined ? p.z : EYE,
      angle: p.angle, pitch: p.pitch || 0,
      entities: this.buildEntities(),
      lightBoost: clamp(this.weaponSys.muzzleLight || 0, 0, 0.6),
      t: this.time,
    });
    fcCtx.putImageData(frame, 0, 0);

    // оружие от первого лица
    if (p.alive) {
      const key = this.weaponSys.spriteKey;
      const spr = key && this.assets.sprites.get(key);
      if (spr) {
        const off = this.weaponSys.offset || { x: 0, y: 0 };
        const scale = 1.5;
        const w = spr.width * scale, h = spr.height * scale;
        fcCtx.drawImage(spr, (SCREEN_W - w) / 2 + off.x, VIEW_H - h + 14 + off.y, w, h);
      }
    }

    // вспышки (урон/подбор)
    const f = this.flashColor;
    if (f.a > 0.01) {
      fcCtx.fillStyle = `rgba(${f.r | 0},${f.g | 0},${f.b | 0},${f.a.toFixed(3)})`;
      fcCtx.fillRect(0, 0, SCREEN_W, VIEW_H);
    }

    // экран смерти
    if (!p.alive) {
      const a = Math.min(0.55, this.deathTimer * 0.5);
      fcCtx.fillStyle = `rgba(120,0,0,${a.toFixed(3)})`;
      fcCtx.fillRect(0, 0, SCREEN_W, VIEW_H);
      if (this.deathTimer > 0.8) {
        drawText(fcCtx, 'ВЫ ПОГИБЛИ', SCREEN_W / 2, 92, { scale: 3, color: '#ff4a3d', align: 'center' });
        if (Math.floor(this.deathTimer * 2) % 2 === 0) {
          drawText(fcCtx, 'ENTER - ПОПРОБОВАТЬ СНОВА', SCREEN_W / 2, 130, { scale: 1, color: '#ffd24a', align: 'center' });
        }
      }
    }
  }
}

// Выталкивание игрока из сущности — через коллизию со стенами, чтобы толчок
// у угла ящика не закидывал круг игрока внутрь солидной клетки.
function pushOut(map, p, t, pr) {
  const rr = pr + (t.radius || 0.3);
  const dx = p.x - t.x, dy = p.y - t.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 < 1e-9) return;
  const d = Math.sqrt(d2);
  const push = (rr - d) + 0.001;
  const res = moveWithCollision(map, p.x, p.y, (dx / d) * push, (dy / d) * push, pr);
  p.x = res.x;
  p.y = res.y;
}
