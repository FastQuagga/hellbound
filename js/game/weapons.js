// Оружие игрока: дефиниции 7 стволов (§25) и WeaponSystem (§18).
// State-машина idle/raising/lowering/firing; выстрел строго на кадре fire:true.
// Контракт API: docs/architecture.md §18, баланс — §25, ключи спрайтов — §7.

import { EYE, PROJ_DIST, MOVE_SPEED, clamp } from '../config.js';

// ---------------------------------------------------------------------------
// Дефиниции. fireTime = сумма dur всех кадров (полный цикл).
// frames: { key — суффикс ключа спрайта 'wpn_<name>_<key>', dur — сек,
//   fire:true — событие выстрела, snd — звук при входе в кадр,
//   flash — вклад в muzzleLight (0..0.6) }.
// ---------------------------------------------------------------------------

export const WEAPON_DEFS = {
  fist: {
    name: 'fist', slot: 1, ammoType: null, ammoUse: 0,
    damage: [8, 24], pellets: 1, spreadDeg: 0, fireTime: 0.5,
    projectile: null, melee: true, autoFire: false,
    sound: 'wp_punch', soundMiss: 'wp_swing',
    frames: [
      { key: 'fire0', dur: 0.16 },               // замах
      { key: 'fire1', dur: 0.17, fire: true },   // удар вперёд
      { key: 'fire2', dur: 0.17 },               // возврат
    ],
  },
  pistol: {
    name: 'pistol', slot: 2, ammoType: 'bullets', ammoUse: 1,
    damage: [5, 15], pellets: 1, spreadDeg: 2.2, fireTime: 0.45,
    projectile: null, autoFire: true,
    sound: 'wp_pistol',
    frames: [
      { key: 'fire0', dur: 0.12, fire: true, snd: 'wp_pistol', flash: 0.32 },
      { key: 'fire1', dur: 0.16 },
      { key: 'fire2', dur: 0.17 },
    ],
  },
  shotgun: {
    name: 'shotgun', slot: 3, ammoType: 'shells', ammoUse: 1,
    damage: [5, 15], pellets: 7, spreadDeg: 5.5, fireTime: 1.05,
    projectile: null, autoFire: false,
    sound: 'wp_shotgun',
    frames: [
      { key: 'fire0', dur: 0.14, fire: true, snd: 'wp_shotgun', flash: 0.5 },
      { key: 'fire1', dur: 0.16 },                      // отдача
      { key: 'fire2', dur: 0.25, snd: 'wp_pump' },      // помпа вниз
      { key: 'fire3', dur: 0.25 },                      // помпа вверх
      { key: 'fire4', dur: 0.25 },                      // возврат
    ],
  },
  chaingun: {
    name: 'chaingun', slot: 4, ammoType: 'bullets', ammoUse: 1,
    damage: [5, 15], pellets: 1, spreadDeg: 3.5, fireTime: 0.12,
    projectile: null, autoFire: true,
    sound: 'wp_chaingun',
    frames: [
      { key: 'fire0', dur: 0.06, fire: true, snd: 'wp_chaingun', flash: 0.34 },
      { key: 'fire1', dur: 0.06, flash: 0.3 },
    ],
  },
  rocketlauncher: {
    name: 'rocketlauncher', slot: 5, ammoType: 'rockets', ammoUse: 1,
    damage: [20, 160], pellets: 1, spreadDeg: 0, fireTime: 0.9,
    projectile: 'rocketproj', autoFire: true,
    sound: 'wp_rocket',
    frames: [
      { key: 'fire0', dur: 0.2, fire: true, snd: 'wp_rocket', flash: 0.45 },
      { key: 'fire1', dur: 0.3, flash: 0.2 },
      { key: 'fire2', dur: 0.4 },
    ],
  },
  plasmarifle: {
    name: 'plasmarifle', slot: 6, ammoType: 'cells', ammoUse: 1,
    damage: [5, 40], pellets: 1, spreadDeg: 1.5, fireTime: 0.11,
    projectile: 'plasmaball', autoFire: true,
    sound: 'wp_plasma',
    frames: [
      { key: 'fire0', dur: 0.055, fire: true, snd: 'wp_plasma', flash: 0.3 },
      { key: 'fire1', dur: 0.055, flash: 0.24 },
    ],
  },
  bfg: {
    name: 'bfg', slot: 7, ammoType: 'cells', ammoUse: 40,
    damage: [100, 500], pellets: 1, spreadDeg: 0, fireTime: 1.8,
    projectile: 'bfgball', autoFire: false,
    sound: 'wp_bfg',
    frames: [
      { key: 'fire0', dur: 0.3, snd: 'wp_bfg', flash: 0.15 }, // зарядка: малое свечение
      { key: 'fire1', dur: 0.3, flash: 0.3 },                 // зарядка: большое (итого 0.6с)
      { key: 'fire2', dur: 0.6, fire: true, flash: 0.6 },     // выстрел-вспышка
      { key: 'fire3', dur: 0.6 },                             // возврат
    ],
  },
};

// ---------------------------------------------------------------------------
// Внутренние константы и таблицы (вычисляются один раз при загрузке модуля,
// чтобы в кадровом цикле не было аллокаций строк).
// ---------------------------------------------------------------------------

const SWITCH_RATE = 4;          // 1 / 0.25с — скорость подъёма/опускания
const RAISE_PX = 190;           // вертикальный сдвиг полностью убранного оружия, px
const BOB_X = 7;                // амплитуда качания по X, px
const BOB_Y = 5;                // амплитуда качания по Y, px
const BOB_SMOOTH = 8;           // скорость сглаживания амплитуды качания, 1/с
const MUZZLE_DECAY = 2.4;       // затухание вспышки, ед/с
const MELEE_RANGE = 1.2;        // дальность удара кулаком, клетки
const PROJ_FWD = 0.3;           // вынос точки спавна снаряда вперёд, клетки
const DEG2RAD = Math.PI / 180;

// слот -> имя оружия
const SLOT_NAME = {};
for (const name in WEAPON_DEFS) SLOT_NAME[WEAPON_DEFS[name].slot] = name;

// Приоритет автопереключения при нехватке патронов (BFG и ракетницу
// автоматически не подставляем — как в Doom); кулак — гарантированный запасной.
const AUTO_PRIORITY = ['plasmarifle', 'chaingun', 'shotgun', 'pistol', 'fist'];

// Предсобранные ключи спрайтов: имя -> { idle, frames[] }.
const SPRITE_KEYS = {};
for (const name in WEAPON_DEFS) {
  SPRITE_KEYS[name] = {
    idle: 'wpn_' + name + '_idle',
    frames: WEAPON_DEFS[name].frames.map((f) => 'wpn_' + name + '_' + f.key),
  };
}

const NO_INPUT = { fire: false, weaponSelect: null, wheelDelta: 0 };

// ---------------------------------------------------------------------------
// WeaponSystem
// ---------------------------------------------------------------------------

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.current = this._owned('pistol') ? 'pistol' : 'fist';
    this.state = 'raising';     // 'idle' | 'raising' | 'lowering' | 'firing'
    this._raiseK = 0;           // 0 = убрано, 1 = поднято
    this._pending = null;       // имя оружия, ожидающего подъёма
    this._frame = 0;            // индекс кадра в firing
    this._frameT = 0;           // время внутри текущего кадра
    this._muzzle = 0;           // текущий уровень вспышки 0..0.6
    this._bobAmp = 0;           // сглаженная амплитуда качания 0..1
    this._needRelease = false;  // для неавтоматических: ждать отпускания огня
    this._noAmmoLatch = false;  // pl_noammo не чаще раза на нажатие
    this._off = { x: 0, y: 0 }; // кэш offset — без аллокаций в кадре
  }

  // ----- публичный API (§18) -----

  get spriteKey() {
    const keys = SPRITE_KEYS[this.current];
    if (this.state === 'firing' && this._frame < keys.frames.length) {
      return keys.frames[this._frame];
    }
    return keys.idle;
  }

  get offset() {
    return this._off;
  }

  get muzzleLight() {
    return this._muzzle;
  }

  switchTo(slotOrName) {
    let name = null;
    if (typeof slotOrName === 'number') name = SLOT_NAME[slotOrName] || null;
    else if (WEAPON_DEFS[slotOrName]) name = slotOrName;
    if (!name || !this._owned(name)) return;
    // уже в руках и ничего не переключается — нечего делать
    if (name === this.current && !this._pending && this.state !== 'lowering') return;
    this._pending = name;
    if (this.state === 'idle' || this.state === 'raising') this.state = 'lowering';
    // в 'firing' — переключение начнётся по завершении цикла выстрела
  }

  update(dt) {
    const g = this.game;
    const p = g ? g.player : null;
    if (!p) return;
    const input = g.input || NO_INPUT;

    // выбор оружия: клавиши 1..7 и колесо
    const ws = input.weaponSelect;
    if (ws >= 1 && ws <= 7) this.switchTo(ws);
    const wd = input.wheelDelta | 0;
    if (wd) this._cycle(wd > 0 ? 1 : -1);

    if (!input.fire) {
      this._needRelease = false;
      this._noAmmoLatch = false;
    }

    if (this.state === 'lowering') {
      this._raiseK -= dt * SWITCH_RATE;
      if (this._raiseK <= 0) {
        this._raiseK = 0;
        if (this._pending) {
          this.current = this._pending;
          this._pending = null;
        }
        this.state = 'raising';
      }
    } else if (this.state === 'raising') {
      this._raiseK += dt * SWITCH_RATE;
      if (this._raiseK >= 1) {
        this._raiseK = 1;
        this.state = this._pending ? 'lowering' : 'idle';
      }
    } else if (this.state === 'idle') {
      if (this._pending) {
        if (this._pending === this.current) this._pending = null;
        else this.state = 'lowering';
      } else if (p.alive && input.fire && !this._needRelease) {
        this._frameT = 0;
        this._beginFire(WEAPON_DEFS[this.current]);
      }
    } else if (this.state === 'firing') {
      this._advanceFiring(p, input, dt);
    }

    this._muzzle = Math.max(0, this._muzzle - dt * MUZZLE_DECAY);
    this._updateOffset(p, dt);
  }

  // ----- внутреннее -----

  _owned(name) {
    const def = WEAPON_DEFS[name];
    const p = this.game ? this.game.player : null;
    return !!(def && p && p.weapons && p.weapons[def.slot]);
  }

  _hasAmmo(def) {
    if (!def.ammoType) return true;
    const p = this.game.player;
    const have = p && p.ammo ? (p.ammo[def.ammoType] || 0) : 0;
    return have >= def.ammoUse;
  }

  // колесо: следующее/предыдущее имеющееся оружие по слотам, с заворотом
  _cycle(dir) {
    const from = this._pending || this.current;
    const base = WEAPON_DEFS[from].slot;
    for (let i = 1; i <= 7; i++) {
      const slot = ((base - 1 + dir * i) % 7 + 7) % 7 + 1;
      const name = SLOT_NAME[slot];
      if (name && this._owned(name)) {
        if (name !== from) this.switchTo(name);
        return;
      }
    }
  }

  // Старт цикла выстрела. Проверка боезапаса ДО выстрела; расход — здесь же.
  // _frameT не сбрасывается: при автоогне переносится остаток времени кадра.
  _beginFire(def) {
    if (!this._hasAmmo(def)) {
      this._noAmmo();
      return false;
    }
    if (def.ammoType) {
      const ammo = this.game.player.ammo;
      ammo[def.ammoType] = Math.max(0, (ammo[def.ammoType] || 0) - def.ammoUse);
    }
    this.state = 'firing';
    this._frame = 0;
    this._enterFrame(def, 0);
    return true;
  }

  _noAmmo() {
    if (this._noAmmoLatch) return;
    this._noAmmoLatch = true;
    if (typeof this.game.playSound === 'function') this.game.playSound('pl_noammo');
    const best = this._bestAvailable();
    if (best && best !== this.current) this.switchTo(best);
  }

  _bestAvailable() {
    for (let i = 0; i < AUTO_PRIORITY.length; i++) {
      const name = AUTO_PRIORITY[i];
      if (this._owned(name) && this._hasAmmo(WEAPON_DEFS[name])) return name;
    }
    return 'fist';
  }

  _advanceFiring(p, input, dt) {
    this._frameT += dt;
    let guard = 16; // защита от бесконечного цикла при некорректных dur
    while (this.state === 'firing' && guard-- > 0) {
      const def = WEAPON_DEFS[this.current];
      const f = def.frames[this._frame];
      if (!f || this._frameT < f.dur) break;
      this._frameT -= f.dur;
      if (this._frame + 1 < def.frames.length) {
        this._frame++;
        this._enterFrame(def, this._frame);
      } else {
        // цикл завершён
        if (!def.autoFire) this._needRelease = true;
        if (this._pending) {
          this.state = 'lowering';
        } else if (def.autoFire && input.fire && p.alive && this._beginFire(def)) {
          // автоогонь: цикл перезапущен (_beginFire), остаток _frameT сохранён
        } else if (this.state === 'firing') {
          this.state = 'idle';
        }
      }
    }
  }

  _enterFrame(def, i) {
    const f = def.frames[i];
    if (!f) return;
    if (f.snd && typeof this.game.playSound === 'function') this.game.playSound(f.snd);
    if (f.flash) this._muzzle = Math.max(this._muzzle, f.flash);
    if (f.fire) this._fireEvent(def);
  }

  // Событие выстрела — строго на кадре fire:true.
  _fireEvent(def) {
    const g = this.game;
    const p = g.player;
    if (!p || !p.alive) return;
    const z = typeof p.z === 'number' ? p.z : EYE;
    const dz = (p.pitch || 0) / PROJ_DIST; // наклон луча из пикселей горизонта

    if (def.melee) {
      const hit = this._meleeHit(p);
      if (typeof g.playSound === 'function') g.playSound(hit ? def.sound : def.soundMiss);
      if (typeof g.hitscan === 'function') {
        g.hitscan({
          x: p.x, y: p.y, z, angle: p.angle, dz,
          damage: def.damage, pellets: def.pellets, spreadDeg: def.spreadDeg,
          range: MELEE_RANGE, owner: 'player',
        });
      }
      // промах кулаком монстров не будит
      if (hit && typeof g.noise === 'function') g.noise(p.x, p.y);
      return;
    }

    if (def.projectile) {
      const spread = def.spreadDeg * DEG2RAD;
      const a = spread > 0 ? p.angle + (Math.random() - 0.5) * 2 * spread : p.angle;
      let sx = p.x + Math.cos(a) * PROJ_FWD;
      let sy = p.y + Math.sin(a) * PROJ_FWD;
      const map = g.map;
      if (map && typeof map.isSolidAt === 'function' && map.isSolidAt(sx, sy)) {
        sx = p.x;
        sy = p.y;
      }
      if (typeof g.spawnProjectile === 'function') {
        g.spawnProjectile(def.projectile, sx, sy, clamp(z - 0.05, 0.15, 0.9), a, dz, 'player');
      }
    } else if (typeof g.hitscan === 'function') {
      g.hitscan({
        x: p.x, y: p.y, z, angle: p.angle, dz,
        damage: def.damage, pellets: def.pellets, spreadDeg: def.spreadDeg,
        owner: 'player',
      });
    }
    if (typeof g.noise === 'function') g.noise(p.x, p.y);
  }

  // Есть ли цель под ударом кулака (та же геометрия луча, что в game.hitscan):
  // нужна заранее, чтобы выбрать звук wp_punch / wp_swing.
  _meleeHit(p) {
    const g = this.game;
    const ca = Math.cos(p.angle);
    const sa = Math.sin(p.angle);
    let maxT = MELEE_RANGE;
    const map = g.map;
    if (map && typeof map.raycastWall === 'function') {
      const w = map.raycastWall(p.x, p.y, ca, sa, MELEE_RANGE);
      if (w && w.dist < maxT) maxT = w.dist;
    }
    const enemies = g.enemies || [];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.dead && this._onRay(p, ca, sa, maxT, e.x, e.y, e.radius || 0.3)) return true;
    }
    const decor = g.decor || [];
    for (let i = 0; i < decor.length; i++) {
      const d = decor[i];
      if (d.type === 'barrel' && !d.dead &&
          this._onRay(p, ca, sa, maxT, d.x, d.y, d.radius || 0.3)) return true;
    }
    return false;
  }

  _onRay(p, ca, sa, maxT, tx, ty, radius) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const along = dx * ca + dy * sa;
    if (along < 0.15 || along >= maxT) return false;
    return Math.abs(dy * ca - dx * sa) < radius + 0.05;
  }

  // Качание от bobPhase + подъём/опускание. Амплитуда следует за скоростью
  // игрока (сглаженно), при стрельбе оружие почти неподвижно.
  _updateOffset(p, dt) {
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    let target = clamp(spd / MOVE_SPEED, 0, 1);
    if (this.state === 'firing') target *= 0.25;
    this._bobAmp += (target - this._bobAmp) * Math.min(1, dt * BOB_SMOOTH);
    const ph = p.bobPhase || 0;
    this._off.x = Math.sin(ph) * BOB_X * this._bobAmp;
    this._off.y = Math.abs(Math.cos(ph)) * BOB_Y * this._bobAmp +
      (1 - this._raiseK) * RAISE_PX;
  }
}
