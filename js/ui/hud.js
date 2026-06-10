// HUD: нижняя статусная панель в стиле Doom (тёмный металл, фаски, углубления),
// лицо героя, сообщения и автокарта. Контракт: docs/architecture.md §21.

import { SCREEN_W, VIEW_H, HUD_H, AMMO_MAX, clamp } from '../config.js';
import { drawText } from './font.js';

// ---------- палитра и константы оформления ----------

const RED = '#d23b1e';          // крупные цифры
const RED_SHADOW = '#2a0805';
const GOLD = '#ffd24a';         // сообщения, значения боезапаса, ARMS
const LABEL = '#99a0ad';        // подписи на панели
const LABEL_SHADOW = '#0e1014';
const ARMS_OFF = '#4a4f59';     // неполученное оружие

const DOOR_COLORS = { blue: '#4a90ff', yellow: '#ffd24a', red: '#ff4a4a' };
const DOOR_PLAIN = '#b8860b';
const MAP_WALL = '#9aa0ad';
const MAP_SECRET = '#3aa32a';
const MAP_FLOOR = 'rgba(64,70,82,0.35)';
const MAP_ARROW = '#7ade3f';

// тип боезапаса по имени оружия (баланс §25); имя берётся из weaponSys.spriteKey
const WPN_AMMO = {
  fist: null, pistol: 'bullets', shotgun: 'shells', chaingun: 'bullets',
  rocketlauncher: 'rockets', plasmarifle: 'cells', bfg: 'cells',
};
const WPN_KEY_RE = /^wpn_([a-z]+)_/;

const AMMO_ROWS = [
  ['ПУЛИ', 'bullets'], ['ДРОБЬ', 'shells'], ['РАКЕТЫ', 'rockets'], ['ЭНЕРГ', 'cells'],
];
const KEY_ORDER = ['blue', 'yellow', 'red'];

// предвычисленные строки и ключи спрайтов — в кадровом цикле без аллокаций (§26, CLAUDE.md)
const ARMS_DIGITS = ['2', '3', '4', '5', '6', '7'];
const HUDKEY_KEYS = KEY_ORDER.map((k) => 'hudkey_' + k);
const FACE_KEYS = [0, 1, 2, 3, 4].map((t) => ({
  fwd: 'face_' + t + '_fwd', left: 'face_' + t + '_left', right: 'face_' + t + '_right',
  pain: 'face_' + t + '_pain', grin: 'face_' + t + '_grin',
}));
const EMPTY_OBJ = Object.freeze({});

// переиспользуемые opts для drawText (drawText их не мутирует)
const OPTS_BIG_SHADOW = { scale: 2, color: RED_SHADOW, align: 'center' };
const OPTS_BIG = { scale: 2, color: RED, align: 'center' };
const OPTS_GOLD_C = { scale: 1, color: GOLD, align: 'center' };
const OPTS_OFF_C = { scale: 1, color: ARMS_OFF, align: 'center' };
const OPTS_GOLD_R = { scale: 1, color: GOLD, align: 'right' };
const OPTS_MSG = { scale: 1, color: GOLD, alpha: 1 };   // alpha мутируется перед вызовом

// геометрия панели (локальные координаты 480×48); зоны разделены рёбрами
const SEPARATORS = [62, 148, 218, 262, 346, 370];
const GEO = {
  labelY: 5, numY: 19,
  ammoCx: 31, hpCx: 105, armorCx: 304,
  armsCx: 183, armsX0: 151, armsStep: 22, armsRowY: [15, 30], armsCellW: 20, armsCellH: 13,
  faceX: 222, faceY: 4,
  keysX: 351,
  tableLx: 377, tableRx: 474, tableY0: 6, tableStep: 10,
};

// ---------- хелперы рисования статичной панели ----------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// углубление с фаской: тень сверху/слева, светлая кромка снизу/справа
function inset(g, x, y, w, h) {
  g.fillStyle = '#16171c';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#0b0c0f';
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y, 1, h);
  g.fillStyle = '#494e58';
  g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x + w - 1, y, 1, h);
  g.fillStyle = '#101116';
  g.fillRect(x + 1, y + 1, w - 2, 1);
}

function rivet(g, x, y) {
  g.fillStyle = '#6d7380';
  g.fillRect(x, y, 1, 1);
  g.fillStyle = '#494e58';
  g.fillRect(x + 1, y, 1, 1);
  g.fillRect(x, y + 1, 1, 1);
  g.fillStyle = '#101114';
  g.fillRect(x + 1, y + 1, 1, 1);
}

function label(g, text, cx, y) {
  drawText(g, text, cx + 1, y + 1, { scale: 1, color: LABEL_SHADOW, align: 'center' });
  drawText(g, text, cx, y, { scale: 1, color: LABEL, align: 'center' });
}

// статичная часть панели рисуется один раз в офскрин-канвас
function buildPanel() {
  const c = document.createElement('canvas');
  c.width = SCREEN_W;
  c.height = HUD_H;
  const g = c.getContext('2d');
  const rnd = mulberry32(0xb60d);

  // базовый металл с дизеринг-шумом
  g.fillStyle = '#23252b';
  g.fillRect(0, 0, SCREEN_W, HUD_H);
  for (let y = 2; y < HUD_H - 2; y++) {
    for (let x = 0; x < SCREEN_W; x++) {
      const r = rnd();
      if (r < 0.055) { g.fillStyle = '#2e3138'; g.fillRect(x, y, 1, 1); }
      else if (r < 0.085) { g.fillStyle = '#1d1f24'; g.fillRect(x, y, 1, 1); }
    }
  }
  // царапины «шлифовки»
  for (let i = 0; i < 26; i++) {
    const sx = (rnd() * SCREEN_W) | 0;
    const sy = 3 + ((rnd() * (HUD_H - 8)) | 0);
    const len = 5 + ((rnd() * 16) | 0);
    g.fillStyle = rnd() < 0.5 ? '#2a2d34' : '#1a1c21';
    g.fillRect(sx, sy, len, 1);
  }
  // внешние фаски панели
  g.fillStyle = '#5a606c'; g.fillRect(0, 0, SCREEN_W, 1);
  g.fillStyle = '#3a3d45'; g.fillRect(0, 1, SCREEN_W, 1);
  g.fillStyle = '#15161a'; g.fillRect(0, HUD_H - 2, SCREEN_W, 1);
  g.fillStyle = '#0a0a0d'; g.fillRect(0, HUD_H - 1, SCREEN_W, 1);
  g.fillStyle = '#494e58'; g.fillRect(0, 1, 1, HUD_H - 2);
  g.fillStyle = '#15161a'; g.fillRect(SCREEN_W - 1, 1, 1, HUD_H - 2);

  // рёбра-разделители зон
  for (const bx of SEPARATORS) {
    g.fillStyle = '#494e58'; g.fillRect(bx, 1, 1, HUD_H - 3);
    g.fillStyle = '#15161a'; g.fillRect(bx + 1, 1, 1, HUD_H - 3);
  }
  // заклёпки
  for (const rx of [3, 56, 68, 142, 154, 212, 268, 340, 477]) rivet(g, rx, 4);
  for (const rx of [3, 56, 68, 142, 268, 340, 477]) rivet(g, rx, 41);

  // углубления под цифры
  inset(g, 6, 15, 50, 22);     // ПАТР.
  inset(g, 67, 15, 76, 22);    // ЗДОРОВЬЕ
  inset(g, 266, 15, 76, 22);   // БРОНЯ
  // ячейки ARMS
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      inset(g, GEO.armsX0 + col * GEO.armsStep, GEO.armsRowY[row], GEO.armsCellW, GEO.armsCellH);
    }
  }
  // ниша лица
  inset(g, 220, 1, 40, 46);
  // колонна слотов ключей с перегородками
  inset(g, 349, 0, 20, HUD_H);
  for (const sy of [15, 31]) {
    g.fillStyle = '#0b0c0f'; g.fillRect(350, sy, 18, 1);
    g.fillStyle = '#3a3d45'; g.fillRect(350, sy + 1, 18, 1);
  }
  // тёмные «гнёзда» в пустых слотах ключей
  for (let i = 0; i < 3; i++) {
    g.fillStyle = '#0d0e12';
    g.fillRect(355, i * 16 + 4, 8, 9);
  }
  // таблица боезапаса
  inset(g, 373, 3, 104, 42);

  // подписи
  label(g, 'ПАТР.', GEO.ammoCx, GEO.labelY);
  label(g, 'ЗДОРОВЬЕ', GEO.hpCx, GEO.labelY);
  label(g, 'ARMS', GEO.armsCx, GEO.labelY);
  label(g, 'БРОНЯ', GEO.armorCx, GEO.labelY);
  for (let i = 0; i < AMMO_ROWS.length; i++) {
    drawText(g, AMMO_ROWS[i][0], GEO.tableLx, GEO.tableY0 + i * GEO.tableStep, { scale: 1, color: LABEL });
  }
  return c;
}

function relAngle(a) {
  const TAU = Math.PI * 2;
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

// ---------- HUD ----------

export class HUD {
  constructor(sprites) {
    this.sprites = sprites || new Map();
    this.panel = buildPanel();   // статика рисуется один раз
    this._missing = new Set();
    this.t = 0;
    // лицо
    this._dir = 'fwd';
    this._gazeT = 1.5;
    this._evRef = null;
    this._evType = null;
    this._evT = 0;
    // кэш автокарты
    this._visGame = null;
    this._visSize = -1;
    this._visCells = [];
    this._visBounds = null;
    // кэш строк (число → строка пересобирается только при смене значения)
    this._hpVal = -1; this._hpStr = '';
    this._armorVal = -1; this._armorStr = '';
    this._ammoType = ''; this._ammoVal = -1; this._ammoStr = '—';
    this._rowVals = [-1, -1, -1, -1];
    this._rowStrs = ['', '', '', ''];
  }

  draw(ctx, game, dt) {
    if (!game || !game.player) return;
    if (this._visGame && this._visGame !== game) this._dropVisited();   // не держать прошлую игру
    const step = (typeof dt === 'number' && dt > 0) ? Math.min(dt, 0.1) : 0;
    this.t += step;
    const p = game.player;
    const Y = VIEW_H;

    ctx.drawImage(this.panel, 0, Y);

    // ПАТР. — боезапас текущего оружия (для кулака «—», §21)
    this._bigNum(ctx, this._currentAmmoText(game, p), GEO.ammoCx, Y + GEO.numY);

    // ЗДОРОВЬЕ (мигает при hp < 25)
    const hp = Math.max(0, Math.round(p.hp || 0));
    const blinkOff = p.alive && hp < 25 && Math.floor(this.t * 3) % 2 === 1;
    if (!blinkOff) {
      if (hp !== this._hpVal) { this._hpVal = hp; this._hpStr = hp + '%'; }
      this._bigNum(ctx, this._hpStr, GEO.hpCx, Y + GEO.numY);
    }

    // ARMS 2–7 (p.weapons keyed по слоту, §19)
    const w = p.weapons || EMPTY_OBJ;
    for (let i = 0; i < 6; i++) {
      const cx = GEO.armsX0 + (i % 3) * GEO.armsStep + (GEO.armsCellW >> 1);
      const cy = Y + GEO.armsRowY[(i / 3) | 0] + 3;
      drawText(ctx, ARMS_DIGITS[i], cx, cy, w[2 + i] ? OPTS_GOLD_C : OPTS_OFF_C);
    }

    // ЛИЦО
    this._updateFace(p, step);
    const face = this._spr(this._faceKey(p));
    if (face) ctx.drawImage(face, GEO.faceX, Y + GEO.faceY);

    // БРОНЯ
    const armor = Math.max(0, Math.round(p.armor || 0));
    if (armor !== this._armorVal) { this._armorVal = armor; this._armorStr = armor + '%'; }
    this._bigNum(ctx, this._armorStr, GEO.armorCx, Y + GEO.numY);

    // ключи
    const keys = p.keys || EMPTY_OBJ;
    for (let i = 0; i < KEY_ORDER.length; i++) {
      if (!keys[KEY_ORDER[i]]) continue;
      const icon = this._spr(HUDKEY_KEYS[i]);
      if (icon) ctx.drawImage(icon, GEO.keysX, Y + i * 16);
    }

    // таблица боезапаса
    const ammo = p.ammo || EMPTY_OBJ;
    for (let i = 0; i < AMMO_ROWS.length; i++) {
      const type = AMMO_ROWS[i][1];
      const cur = Math.max(0, ammo[type] | 0);
      if (cur !== this._rowVals[i]) {
        this._rowVals[i] = cur;
        this._rowStrs[i] = cur + '/' + AMMO_MAX[type];
      }
      drawText(ctx, this._rowStrs[i], GEO.tableRx, Y + GEO.tableY0 + i * GEO.tableStep, OPTS_GOLD_R);
    }

    this._drawMessages(ctx, game);
  }

  drawAutomap(ctx, game) {
    if (!game || !game.map || !game.player || !game.visited) return;
    const map = game.map;
    const p = game.player;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SCREEN_W, VIEW_H);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, 0, SCREEN_W, VIEW_H);

    this._syncVisited(game);
    const cells = this._visCells;
    const b = this._visBounds;
    const cx = SCREEN_W / 2;
    const cy = VIEW_H / 2;
    let scale = 7;
    if (b) {
      // вписать открытую часть, центр на игроке
      const ex = Math.max(2, b.maxX + 1 - p.x, p.x - b.minX);
      const ey = Math.max(2, b.maxY + 1 - p.y, p.y - b.minY);
      scale = clamp(Math.min((cx - 10) / ex, (cy - 18) / ey), 2, 9);
    }

    for (let i = 0; i < cells.length; i += 2) {
      const ix = cells[i];
      const iy = cells[i + 1];
      const x0 = Math.round(cx + (ix - p.x) * scale);
      const y0 = Math.round(cy + (iy - p.y) * scale);
      const x1 = Math.round(cx + (ix + 1 - p.x) * scale);
      const y1 = Math.round(cy + (iy + 1 - p.y) * scale);
      if (x1 < 0 || y1 < 0 || x0 > SCREEN_W || y0 > VIEW_H) continue;
      const cw = x1 - x0;
      const ch = y1 - y0;
      const door = map.getDoor(ix, iy);
      if (door) {
        const found = door.openness > 0 || door.state !== 'closed';
        if (door.secret) {
          // ненайденный секрет маскируется под стену
          ctx.fillStyle = found ? MAP_SECRET : MAP_WALL;
          ctx.fillRect(x0, y0, cw, ch);
        } else {
          ctx.fillStyle = door.key ? (DOOR_COLORS[door.key] || DOOR_PLAIN) : DOOR_PLAIN;
          if (door.vertical) {
            const t = Math.max(2, Math.round(cw * 0.34));
            ctx.fillRect(x0 + ((cw - t) >> 1), y0, t, ch);
          } else {
            const t = Math.max(2, Math.round(ch * 0.34));
            ctx.fillRect(x0, y0 + ((ch - t) >> 1), cw, t);
          }
        }
      } else if (map.isSolid(ix, iy)) {
        ctx.fillStyle = MAP_WALL;
        ctx.fillRect(x0, y0, cw, ch);
      } else {
        ctx.fillStyle = MAP_FLOOR;
        ctx.fillRect(x0, y0, cw, ch);
      }
    }

    // стрелка игрока
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.angle || 0);
    const L = clamp(scale * 0.8, 5, 10);
    ctx.strokeStyle = MAP_ARROW;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-L, 0); ctx.lineTo(L, 0);
    ctx.moveTo(L, 0); ctx.lineTo(L * 0.4, -L * 0.45);
    ctx.moveTo(L, 0); ctx.lineTo(L * 0.4, L * 0.45);
    ctx.moveTo(-L, 0); ctx.lineTo(-L * 0.6, -L * 0.4);
    ctx.moveTo(-L, 0); ctx.lineTo(-L * 0.6, L * 0.4);
    ctx.stroke();
    ctx.restore();

    drawText(ctx, map.name || '', SCREEN_W / 2, VIEW_H - 12, OPTS_GOLD_C);
    ctx.restore();
  }

  // ---------- внутреннее ----------

  // крупная красная цифра с тенью-вдавленностью
  _bigNum(ctx, text, cx, y) {
    drawText(ctx, text, cx + 1, y + 1, OPTS_BIG_SHADOW);
    drawText(ctx, text, cx, y, OPTS_BIG);
  }

  _currentAmmoText(game, p) {
    let name = null;
    const ws = game.weaponSys;
    if (ws && typeof ws.spriteKey === 'string') {
      const m = WPN_KEY_RE.exec(ws.spriteKey);
      if (m) name = m[1];
    }
    const type = name ? WPN_AMMO[name] : null;
    if (!type) return '—';   // кулак — «—» (§21)
    const ammo = p.ammo || EMPTY_OBJ;
    const cur = Math.max(0, ammo[type] | 0);
    if (type !== this._ammoType || cur !== this._ammoVal) {
      this._ammoType = type;
      this._ammoVal = cur;
      this._ammoStr = '' + cur;
    }
    return this._ammoStr;
  }

  _updateFace(p, dt) {
    const ev = p.faceEvent || null;
    if (ev !== this._evRef) {
      this._evRef = ev;
      if (ev) {
        this._evT = (typeof ev.t === 'number' && ev.t > 0) ? ev.t : 0.7;
        this._evType = ev.type === 'grin' ? 'grin' : 'pain';
        if (this._evType === 'pain') {
          // после гримасы — взгляд в сторону источника урона
          const a = relAngle(typeof p.lastDamageDir === 'number' ? p.lastDamageDir : 0);
          this._dir = a > 0.35 ? 'right' : a < -0.35 ? 'left' : 'fwd';
          this._gazeT = 1.2;
        }
      }
    }
    if (this._evT > 0) this._evT -= dt;
    this._gazeT -= dt;
    if (this._gazeT <= 0) {
      // каждые 1.5–3 с — случайный взгляд
      this._gazeT = 1.5 + Math.random() * 1.5;
      const r = Math.random();
      this._dir = r < 0.4 ? 'fwd' : r < 0.7 ? 'left' : 'right';
    }
  }

  _faceKey(p) {
    if (!p.alive) return 'face_dead';
    const hp = p.hp || 0;
    const tier = hp >= 80 ? 0 : hp >= 60 ? 1 : hp >= 40 ? 2 : hp >= 20 ? 3 : 4;
    const ev = this._evRef;
    if (ev && this._evT > 0 && (typeof ev.t !== 'number' || ev.t > 0)) {
      return FACE_KEYS[tier][this._evType];
    }
    return FACE_KEYS[tier][this._dir];
  }

  _drawMessages(ctx, game) {
    const msgs = game.messages;
    if (!msgs || !msgs.length) return;
    const n = Math.min(3, msgs.length);
    for (let i = 0; i < n; i++) {
      const m = msgs[i];
      if (!m || !m.text) continue;
      OPTS_MSG.alpha = clamp(m.t / 0.5, 0, 1);   // fade в последние 0.5 с
      drawText(ctx, m.text, 4, 4 + i * 10, OPTS_MSG);
    }
  }

  _dropVisited() {
    this._visGame = null;
    this._visSize = -1;
    this._visCells.length = 0;
    this._visBounds = null;
  }

  _syncVisited(game) {
    if (this._visGame === game && this._visSize === game.visited.size) return;
    this._visGame = game;
    this._visSize = game.visited.size;
    const cells = this._visCells;
    cells.length = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const key of game.visited) {
      const c = key.indexOf(',');
      const ix = +key.slice(0, c);
      const iy = +key.slice(c + 1);
      if (!Number.isFinite(ix) || !Number.isFinite(iy)) continue;
      cells.push(ix, iy);
      if (ix < minX) minX = ix;
      if (ix > maxX) maxX = ix;
      if (iy < minY) minY = iy;
      if (iy > maxY) maxY = iy;
    }
    this._visBounds = cells.length ? { minX, minY, maxX, maxY } : null;
  }

  _spr(key) {
    const s = this.sprites.get(key);
    if (s) return s;
    if (!this._missing.has(key)) {
      this._missing.add(key);
      console.warn('HUD: отсутствует спрайт ' + key);
    }
    return null;
  }
}
