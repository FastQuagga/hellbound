// GameMap: разбор данных уровня, двери/секреты/выход, анимация текстур, свет,
// трассировка лучей для LOS и hitscan. Контракт: docs/architecture.md §15.

import { ANIM_FLATS, ANIM_WALLS, ANIM_FPS, clamp } from '../config.js';

const DOOR_TIME = 1.0;        // секунд на открытие
const SECRET_TIME = 1.8;      // секрет ползёт медленнее
const DOOR_STAY = 4.0;        // сколько держится открытой

export class GameMap {
  constructor(level) {
    this.name = level.name;
    this.w = level.w;
    this.h = level.h;
    this.cells = new Array(this.w * this.h).fill(null);
    this.doors = [];
    this.exitOn = false;
    this.secretsTotal = 0;
    this.animT = 0;
    this._animFrame = -1;
    this._animFloorCells = [];
    this._flickerCells = [];
    this._flickerOn = true;
    this._flickerTimer = 0.2;

    // стены и двери
    for (let y = 0; y < this.h; y++) {
      const row = level.walls[y] || '';
      for (let x = 0; x < this.w; x++) {
        const ch = row[x];
        if (ch === undefined || ch === '.' || ch === ' ') continue;
        const def = level.wallLegend[ch];
        if (!def) continue;
        const idx = y * this.w + x;
        if (def.kind === 'door' || def.kind === 'secret') {
          const door = {
            ix: x, iy: y,
            openness: 0,
            state: 'closed',          // closed | opening | open | closing
            tex: def.tex,
            key: def.key || null,
            vertical: false,          // полотно вдоль оси Y (плоскость x = ix+0.5)
            secret: def.kind === 'secret',
            stayOpen: def.kind === 'secret',
            timer: 0,
          };
          this.doors.push(door);
          this.cells[idx] = { kind: 'door', tex: def.tex, door };
          if (door.secret) this.secretsTotal++;
        } else {
          this.cells[idx] = { kind: def.kind, tex: def.tex };
        }
      }
    }
    // ориентация дверей: стены сверху/снизу => полотно вдоль Y
    for (const d of this.doors) {
      const above = this._isStatic(d.ix, d.iy - 1), below = this._isStatic(d.ix, d.iy + 1);
      const left = this._isStatic(d.ix - 1, d.iy), right = this._isStatic(d.ix + 1, d.iy);
      d.vertical = (above && below) ? false : (left && right) ? true : false;
      // полотно вдоль X, если соседи сверху/снизу — стены (проход идёт по X? нет:
      // проход через дверь идёт по Y) — для рейкастера важна только плоскость:
      // vertical=true => плоскость x=ix+0.5 (стены сверху и снизу НЕТ, слева/справа ДА)
    }

    // зоны: пол/потолок/свет на клетку; объекты создаются один раз и мутируются
    this.floorObjs = new Array(this.w * this.h);
    this.ceilObjs = new Array(this.w * this.h);
    this.lights = new Float32Array(this.w * this.h).fill(0.8);
    for (let y = 0; y < this.h; y++) {
      const row = level.zones[y] || '';
      for (let x = 0; x < this.w; x++) {
        const def = level.zoneLegend[row[x]] || { floor: 'FLOOR_TECH', ceil: 'CEIL_TECH', light: 0.8 };
        const idx = y * this.w + x;
        const fl = { tex: def.floor, light: def.light, damage: def.damage || 0, base: def.floor };
        const ce = { tex: def.ceil, light: def.light, base: def.ceil };
        this.floorObjs[idx] = fl;
        this.ceilObjs[idx] = ce;
        this.lights[idx] = def.light;
        if (ANIM_FLATS[def.floor]) this._animFloorCells.push(fl);
        if (ANIM_FLATS[def.ceil]) this._animFloorCells.push(ce);
        if (def.flicker) this._flickerCells.push({ fl, ce, idx, base: def.light });
      }
    }
    // анимированные базы получают нулевой кадр сразу
    for (const o of this._animFloorCells) o.tex = o.base + '0';
  }

  _isStatic(ix, iy) {
    const c = this._cell(ix, iy);
    return !!c && c.kind !== 'door';
  }

  _cell(ix, iy) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return { kind: 'wall', tex: 'TECH1' };
    return this.cells[iy * this.w + ix];
  }

  update(dt, game) {
    // анимация текстур
    this.animT += dt;
    const frame = Math.floor(this.animT * ANIM_FPS);
    if (frame !== this._animFrame) {
      this._animFrame = frame;
      for (const o of this._animFloorCells) {
        o.tex = o.base + (frame % ANIM_FLATS[o.base]);
      }
    }
    // фликер света
    this._flickerTimer -= dt;
    if (this._flickerTimer <= 0) {
      this._flickerOn = !this._flickerOn;
      this._flickerTimer = this._flickerOn ? 0.08 + Math.random() * 0.35 : 0.04 + Math.random() * 0.12;
      for (const f of this._flickerCells) {
        const L = this._flickerOn ? f.base : f.base * 0.4;
        f.fl.light = L; f.ce.light = L; this.lights[f.idx] = L;
      }
    }
    // двери
    for (const d of this.doors) {
      switch (d.state) {
        case 'opening': {
          d.openness += dt / (d.secret ? SECRET_TIME : DOOR_TIME);
          if (d.openness >= 1) {
            d.openness = 1;
            d.state = 'open';
            d.timer = DOOR_STAY;
          }
          break;
        }
        case 'open': {
          if (d.stayOpen) break;
          if (this._doorBlocked(d, game)) { d.timer = DOOR_STAY; break; }
          d.timer -= dt;
          if (d.timer <= 0) {
            d.state = 'closing';
            if (game) game.playSound('door_close', d.ix + 0.5, d.iy + 0.5);
          }
          break;
        }
        case 'closing': {
          if (this._doorBlocked(d, game)) {
            d.state = 'opening';
            break;
          }
          d.openness -= dt / DOOR_TIME;
          if (d.openness <= 0) { d.openness = 0; d.state = 'closed'; }
          break;
        }
      }
    }
  }

  _doorBlocked(d, game) {
    if (!game) return false;
    const p = game.player;
    if (p && Math.floor(p.x) === d.ix && Math.floor(p.y) === d.iy) return true;
    if (game.enemies) {
      for (const e of game.enemies) {
        if (!e.dead && Math.floor(e.x) === d.ix && Math.floor(e.y) === d.iy) return true;
      }
    }
    return false;
  }

  isSolid(ix, iy) {
    const c = this._cell(ix, iy);
    if (!c) return false;
    if (c.kind === 'door') return c.door.openness < 0.85;
    return true;
  }

  isSolidAt(x, y) { return this.isSolid(Math.floor(x), Math.floor(y)); }

  isOpaque(ix, iy) {
    const c = this._cell(ix, iy);
    if (!c) return false;
    if (c.kind === 'door') return c.door.openness < 0.95;
    return true;
  }

  getWallTex(ix, iy) {
    const c = this._cell(ix, iy);
    if (!c || c.kind === 'door') return null;
    if (c.kind === 'exit') return this.exitOn ? 'SWEXIT_ON' : 'SWEXIT_OFF';
    const frames = ANIM_WALLS[c.tex];
    if (frames) return c.tex + (this._animFrame > 0 ? (this._animFrame % frames) : 0);
    return c.tex;
  }

  getDoor(ix, iy) {
    const c = this._cell(ix, iy);
    return (c && c.kind === 'door') ? c.door : null;
  }

  getFloor(ix, iy) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return FALLBACK_FLOOR;
    return this.floorObjs[iy * this.w + ix];
  }

  getCeil(ix, iy) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return FALLBACK_CEIL;
    return this.ceilObjs[iy * this.w + ix];
  }

  getLight(ix, iy) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return 0.6;
    return this.lights[iy * this.w + ix];
  }

  // DDA до первой непрозрачной клетки; true если дошли до цели
  lineOfSight(x0, y0, x1, y1) {
    let ix = Math.floor(x0), iy = Math.floor(y0);
    const tx = Math.floor(x1), ty = Math.floor(y1);
    if (ix === tx && iy === ty) return true;
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return true;
    const rdx = dx / dist, rdy = dy / dist;
    const stepX = rdx > 0 ? 1 : -1, stepY = rdy > 0 ? 1 : -1;
    const tDeltaX = rdx !== 0 ? Math.abs(1 / rdx) : Infinity;
    const tDeltaY = rdy !== 0 ? Math.abs(1 / rdy) : Infinity;
    let tMaxX = rdx !== 0 ? (rdx > 0 ? (ix + 1 - x0) : (x0 - ix)) * tDeltaX : Infinity;
    let tMaxY = rdy !== 0 ? (rdy > 0 ? (iy + 1 - y0) : (y0 - iy)) * tDeltaY : Infinity;
    let t = 0;
    for (let i = 0; i < 256; i++) {
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; ix += stepX; }
      else { t = tMaxY; tMaxY += tDeltaY; iy += stepY; }
      if (t > dist) return true;
      if (ix === tx && iy === ty) return true;
      if (this.isOpaque(ix, iy)) return false;
    }
    return false;
  }

  // первая solid-клетка по лучу
  raycastWall(x, y, dx, dy, maxDist) {
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const rdx = dx / len, rdy = dy / len;
    let ix = Math.floor(x), iy = Math.floor(y);
    const stepX = rdx > 0 ? 1 : -1, stepY = rdy > 0 ? 1 : -1;
    const tDeltaX = rdx !== 0 ? Math.abs(1 / rdx) : Infinity;
    const tDeltaY = rdy !== 0 ? Math.abs(1 / rdy) : Infinity;
    let tMaxX = rdx !== 0 ? (rdx > 0 ? (ix + 1 - x) : (x - ix)) * tDeltaX : Infinity;
    let tMaxY = rdy !== 0 ? (rdy > 0 ? (iy + 1 - y) : (y - iy)) * tDeltaY : Infinity;
    let t = 0;
    for (let i = 0; i < 512; i++) {
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; ix += stepX; }
      else { t = tMaxY; tMaxY += tDeltaY; iy += stepY; }
      if (t > maxDist) return null;
      if (this.isSolid(ix, iy)) return { dist: t, ix, iy };
    }
    return null;
  }

  // E/Space: дверь/секрет/рубильник перед игроком.
  // Возвращает true (обработано), 'wall' (упёрся в стену) или false (пусто).
  use(x, y, angle, game) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    for (let d = 0.4; d <= 1.15; d += 0.25) {
      const ix = Math.floor(x + ca * d), iy = Math.floor(y + sa * d);
      const c = this._cell(ix, iy);
      if (!c) continue;
      if (c.kind === 'door') {
        const door = c.door;
        if (door.secret) {
          if (door.state === 'closed') {
            door.state = 'opening';
            game.playSound('door_open', ix + 0.5, iy + 0.5);
            game.foundSecret();
          }
          return true;
        }
        if (door.key && game.player && !game.player.keys[door.key]) {
          const names = { blue: 'СИНЯЯ', yellow: 'ЖЁЛТАЯ', red: 'КРАСНАЯ' };
          game.message(`НУЖНА ${names[door.key]} КЛЮЧ-КАРТА.`);
          game.playSound('pl_oof');
          return true;
        }
        if (door.state === 'closed' || door.state === 'closing') {
          door.state = 'opening';
          game.playSound('door_open', ix + 0.5, iy + 0.5);
        }
        return true;
      }
      if (c.kind === 'exit') {
        if (!this.exitOn) {
          this.exitOn = true;
          game.playSound('switch', ix + 0.5, iy + 0.5);
          game.endLevel();
        }
        return true;
      }
      // обычная стена — «уф»
      return 'wall';
    }
    return false;
  }

  monsterOpenDoor(ix, iy) {
    const c = this._cell(ix, iy);
    if (!c || c.kind !== 'door') return;
    const d = c.door;
    if (d.key || d.secret) return;
    if (d.state === 'closed' || d.state === 'closing') d.state = 'opening';
  }
}

const FALLBACK_FLOOR = { tex: 'FLOOR_TECH', light: 0.6, damage: 0 };
const FALLBACK_CEIL = { tex: 'CEIL_TECH', light: 0.6 };
