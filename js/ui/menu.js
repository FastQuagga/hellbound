// Меню и экраны HELLBOUND [B7]. Контракт: docs/architecture.md §22.
// Режимы: title / main / skill / options / help / credits / pause /
// intermission / endtext. Вся графика (череп-курсор, панели, слайдеры,
// угольки) рисуется кодом; растровые ассеты — только logo/title_bg/inter_bg.

import { SCREEN_W, SCREEN_H, DIFFICULTY, clamp } from '../config.js';
import { drawText, textWidth, FONT_H } from './font.js';

const W = SCREEN_W;
const H = SCREEN_H;

// ---------------------------------------------------------------------------
// Палитра (см. architecture.md §4)
// ---------------------------------------------------------------------------

const COL = {
  red: '#d23b1e', redHi: '#ff6b3d', redDark: '#a51c1c', redDeep: '#6e1111',
  blood: '#3d0a0a',
  gold: '#ffd24a', orange: '#f08a1d', ember: '#c44d12',
  rust: '#c97f45', rustDark: '#9c5a2e',
  gray: '#99a0ad', grayDim: '#6d7380', steel: '#494e58', steelDark: '#2e3138',
  iron: '#1b1d22', bg: '#141419', black: '#0a0a0d',
  bone: '#cdb692', boneHi: '#e8cfa0', boneLo: '#9b8260',
  green: '#7ade3f',
};

// ---------------------------------------------------------------------------
// Тексты экранов
// ---------------------------------------------------------------------------

const MAIN_ITEMS = ['НОВАЯ ИГРА', 'НАСТРОЙКИ', 'УПРАВЛЕНИЕ', 'ОБ ИГРЕ'];
const PAUSE_ITEMS = ['ПРОДОЛЖИТЬ', 'НАСТРОЙКИ', 'УПРАВЛЕНИЕ', 'В ГЛАВНОЕ МЕНЮ'];
const OPT_LABELS = ['ЗВУК', 'МУЗЫКА', 'ЧУВСТВ. МЫШИ', 'МЫШЬ: ОБЗОР', 'НАЗАД'];

const HELP_ROWS = [
  ['W / S', 'ВПЕРЁД / НАЗАД'],
  ['A / D', 'СТРЕЙФ'],
  ['СТРЕЛКИ', 'ДВИЖЕНИЕ И ПОВОРОТ'],
  ['МЫШЬ', 'ОБЗОР И ПОВОРОТ'],
  ['SHIFT', 'БЕГ'],
  ['CTRL / ЛКМ', 'ОГОНЬ'],
  ['E / SPACE', 'ИСПОЛЬЗОВАТЬ'],
  ['1..7, КОЛЕСО', 'ВЫБОР ОРУЖИЯ'],
  ['TAB', 'КАРТА'],
  ['ESC', 'ПАУЗА'],
];

const CREDIT_LINES = [
  'ОММАЖ КЛАССИКЕ DOOM (1993) ID SOFTWARE',
  '',
  'ВСЯ ГРАФИКА, ЗВУК И МУЗЫКА СИНТЕЗИРУЮТСЯ КОДОМ',
  'ЧИСТЫЙ JAVASCRIPT: ES-МОДУЛИ, CANVAS 2D, WEBAUDIO',
  'БЕЗ ЗАВИСИМОСТЕЙ И ВНЕШНИХ ФАЙЛОВ',
  '',
  '2026',
];

const END_LINES = [
  'СТАНЦИЯ «ГЕФЕСТ-1» ЗАЧИЩЕНА.',
  '',
  'НО СКАНЕРЫ ЛОВЯТ СИГНАЛЫ ИЗ ГЛУБИНЫ:',
  'ПОРТАЛ ВСЁ ЕЩЁ ОТКРЫТ.',
  '',
  'ЭТО БЫЛА ТОЛЬКО РАЗМИНКА...',
];
// +2 на каждую строку — «пауза» печатной машинки на переносе
const END_TOTAL = END_LINES.reduce((s, l) => s + l.length + 2, 0);
const END_CPS = 14;      // знаков в секунду
const END_DELAY = 0.5;   // тишина перед печатью

// Имена сложностей — собираются один раз, не в кадровом цикле
const SKILL_NAMES = [
  DIFFICULTY[1].name, DIFFICULTY[2].name, DIFFICULTY[3].name, DIFFICULTY[4].name,
];

const EMBER_COLS = [COL.ember, COL.orange, COL.gold, COL.redHi];

// ---------------------------------------------------------------------------
// Пиксельные элементы: череп-курсор, панель, слайдер
// ---------------------------------------------------------------------------

const SKULL_HEAD = [
  '...#####...',
  '..#######..',
  '.#########.',
  '.#########.',
  '.#oo###oo#.',
  '.#oo###oo#.',
  '..##nnn##..',
  '..#######..',
];
const SKULL_JAW = [
  '..#.#.#.#..',
  '..#######..',
  '...#####...',
];

function paintSkullRows(ctx, rows, x, y, rowBase, eye) {
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line.charCodeAt(c);
      if (ch === 46) continue;                                  // '.'
      if (ch === 35) {                                          // '#' — кость
        const ar = rowBase + r;
        ctx.fillStyle = ar < 2 ? COL.boneHi : ar >= 8 ? COL.boneLo : COL.bone;
      } else if (ch === 111) {                                  // 'o' — глазница
        ctx.fillStyle = eye;
      } else {                                                  // 'n' — нос
        ctx.fillStyle = COL.blood;
      }
      ctx.fillRect(x + c * 2, y + r * 2, 2, 2);
    }
  }
}

// Пульсирующий череп-курсор (22×22..24 px): глаза тлеют, челюсть клацает.
function drawSkull(ctx, x, y, t) {
  const glow = 0.5 + 0.5 * Math.sin(t * 5.2);
  const eye = glow < 0.33 ? COL.blood : glow < 0.72 ? COL.redDark : COL.redHi;
  const jawDrop = Math.floor(t * 2.6) % 2 === 0 ? 0 : 2;
  paintSkullRows(ctx, SKULL_HEAD, x, y, 0, eye);
  paintSkullRows(ctx, SKULL_JAW, x, y + SKULL_HEAD.length * 2 + jawDrop, 8, eye);
}

// Металлическая панель с фасками и заклёпками.
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = '#0d0d11';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COL.steel;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = COL.iron;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = COL.steelDark;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  ctx.fillRect(x + 2, y + 2, 1, h - 4);
  ctx.fillRect(x + w - 3, y + 2, 1, h - 4);
  ctx.fillStyle = COL.gray;
  ctx.fillRect(x + 4, y + 4, 2, 2);
  ctx.fillRect(x + w - 6, y + 4, 2, 2);
  ctx.fillRect(x + 4, y + h - 6, 2, 2);
  ctx.fillRect(x + w - 6, y + h - 6, 2, 2);
}

// Слайдер-«термометр» в духе DOOM: рамка, насечки, ползунок.
function drawSlider(ctx, x, y, w, h, v, active) {
  ctx.fillStyle = COL.iron;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = active ? COL.grayDim : COL.steel;
  ctx.fillRect(x - 1, y - 1, w + 2, 1);
  ctx.fillRect(x - 1, y + h, w + 2, 1);
  ctx.fillRect(x - 1, y - 1, 1, h + 2);
  ctx.fillRect(x + w, y - 1, 1, h + 2);
  ctx.fillStyle = COL.bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COL.steelDark;
  for (let i = 0; i <= 10; i++) {
    const tx = Math.round(x + 2 + (w - 5) * i / 10);
    ctx.fillRect(tx, y + 2, 1, h - 4);
  }
  const kx = Math.round(x + 1 + (w - 7) * clamp(v, 0, 1));
  ctx.fillStyle = active ? COL.gold : COL.rust;
  ctx.fillRect(kx, y + 1, 5, h - 2);
  ctx.fillStyle = active ? COL.orange : COL.rustDark;
  ctx.fillRect(kx + 4, y + 1, 1, h - 2);
  ctx.fillRect(kx, y + h - 2, 5, 1);
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' + r : String(r));
}

// ---------------------------------------------------------------------------
// Меню
// ---------------------------------------------------------------------------

export class Menu {
  constructor(sprites, sound, settings, callbacks) {
    this.sprites = sprites || new Map();
    this.sound = sound || null;
    this.settings = settings || { sfx: 0.7, music: 0.55, mouseSens: 0.5, mouseLook: true };
    this.callbacks = callbacks || {};
    this.mode = 'title';
    this.selMain = 0;
    this.selSkill = 2;     // по умолчанию — третья сложность
    this.selOpt = 0;
    this.selPause = 0;
    this._from = 'main';   // откуда открыты options/help/credits: 'main' | 'pause'
    this._inter = null;    // состояние анимации intermission
    this._end = null;      // состояние печатной машинки endtext
    this._warned = new Set();
    this._rngA = 0;        // состояние seeded PRNG (mulberry32 без замыканий)
  }

  open(mode) {
    this.mode = mode;
    switch (mode) {
      case 'title':
      case 'main':
        this.selMain = 0;
        this._from = 'main';
        this._inter = null;   // освободить состояния прошлого прохождения
        this._end = null;
        break;
      case 'skill':
        this.selSkill = 2;
        break;
      case 'options':
        this.selOpt = 0;
        break;
      case 'pause':
        this.selPause = 0;
        this._from = 'pause';
        break;
      case 'endtext':
        this._end = { t: 0, chars: 0, done: false };
        break;
      case 'intermission':
        if (!this._inter) this.setIntermission({});
        break;
    }
  }

  setIntermission(stats) {
    const s = stats || {};
    const pct = (v, tot) => (tot > 0 ? Math.max(0, Math.round((v || 0) / tot * 100)) : 100);
    this._inter = {
      levelName: s.levelName || '',
      time: s.time || 0,
      rows: [
        { label: 'УБИЙСТВА', target: pct(s.kills, s.killsTotal) },
        { label: 'ПРЕДМЕТЫ', target: pct(s.items, s.itemsTotal) },
        { label: 'ТАЙНИКИ', target: pct(s.secrets, s.secretsTotal) },
      ],
      disp: [0, 0, 0],
      stage: 0,
      wait: 0.6,     // пауза перед первой строкой и между строками
      tickT: 0,
      timeOn: false,
      done: false,
    };
  }

  // -- ввод -----------------------------------------------------------------

  handleKey(code) {
    const enter = code === 'Enter' || code === 'NumpadEnter';
    switch (this.mode) {
      case 'title':
        if (enter) {
          this._sfx('menu_select');
          this.open('main');
        }
        break;

      case 'main':
        if (code === 'ArrowUp') this.selMain = this._step(this.selMain, -1, MAIN_ITEMS.length);
        else if (code === 'ArrowDown') this.selMain = this._step(this.selMain, 1, MAIN_ITEMS.length);
        else if (enter) {
          this._sfx('menu_select');
          if (this.selMain === 0) this.open('skill');
          else {
            this._from = 'main';
            this.open(this.selMain === 1 ? 'options' : this.selMain === 2 ? 'help' : 'credits');
          }
        } else if (code === 'Escape') {
          this._sfx('menu_back');
          this.open('title');
        }
        break;

      case 'skill':
        if (code === 'ArrowUp') this.selSkill = this._step(this.selSkill, -1, 4);
        else if (code === 'ArrowDown') this.selSkill = this._step(this.selSkill, 1, 4);
        else if (enter) {
          this._sfx('menu_select');
          this._cb('onNewGame', this.selSkill + 1);
        } else if (code === 'Escape') {
          this._sfx('menu_back');
          this.open('main');
        }
        break;

      case 'options':
        if (code === 'ArrowUp') this.selOpt = this._step(this.selOpt, -1, OPT_LABELS.length);
        else if (code === 'ArrowDown') this.selOpt = this._step(this.selOpt, 1, OPT_LABELS.length);
        else if (code === 'ArrowLeft' || code === 'ArrowRight') {
          const dir = code === 'ArrowLeft' ? -1 : 1;
          if (this.selOpt < 3) {
            const v = clamp(Math.round((this._optGet(this.selOpt) + dir * 0.1) * 10) / 10, 0, 1);
            this._optSet(this.selOpt, v);
            this._cb('onApplySettings');     // сразу применить — звук тикнет уже новой громкостью
            this._sfx('menu_move');
          } else if (this.selOpt === 3) {
            this.settings.mouseLook = !this.settings.mouseLook;
            this._cb('onApplySettings');
            this._sfx('menu_move');
          }
        } else if (enter) {
          if (this.selOpt === 3) {
            this.settings.mouseLook = !this.settings.mouseLook;
            this._cb('onApplySettings');
            this._sfx('menu_select');
          } else if (this.selOpt === 4) {
            this._sfx('menu_back');
            this._back();
          }
        } else if (code === 'Escape') {
          this._sfx('menu_back');
          this._back();
        }
        break;

      case 'help':
      case 'credits':
        if (enter || code === 'Escape') {
          this._sfx('menu_back');
          this._back();
        }
        break;

      case 'pause':
        if (code === 'ArrowUp') this.selPause = this._step(this.selPause, -1, PAUSE_ITEMS.length);
        else if (code === 'ArrowDown') this.selPause = this._step(this.selPause, 1, PAUSE_ITEMS.length);
        else if (enter) {
          this._sfx('menu_select');
          if (this.selPause === 0) this._cb('onResume');
          else if (this.selPause === 3) this._cb('onQuitToMenu');
          else {
            this._from = 'pause';
            this.open(this.selPause === 1 ? 'options' : 'help');
          }
        } else if (code === 'Escape') {
          this._sfx('menu_back');
          this._cb('onResume');
        }
        break;

      case 'intermission':
        if (enter) {
          this._sfx('menu_select');
          if (this._inter && !this._inter.done) this._skipInter();   // первый ENTER докручивает счёт
          else this._cb('onIntermissionDone');
        }
        break;

      case 'endtext':
        if (enter) {
          this._sfx('menu_select');
          if (this._end && !this._end.done) {                        // первый ENTER допечатывает текст
            this._end.chars = END_TOTAL;
            this._end.done = true;
          } else {
            this._cb('onQuitToMenu');
          }
        }
        break;
    }
  }

  // -- отрисовка ------------------------------------------------------------

  draw(ctx, dt, t) {
    ctx.imageSmoothingEnabled = false;
    switch (this.mode) {
      case 'main': this._drawMain(ctx, t); break;
      case 'skill': this._drawSkill(ctx, t); break;
      case 'options': this._drawOptions(ctx, t); break;
      case 'help': this._drawHelp(ctx); break;
      case 'credits': this._drawCredits(ctx); break;
      case 'pause': this._drawPause(ctx, t); break;
      case 'intermission': this._drawIntermission(ctx, dt, t); break;
      case 'endtext': this._drawEndtext(ctx, dt, t); break;
      default: this._drawTitle(ctx, t); break;
    }
  }

  _drawTitle(ctx, t) {
    this._drawBg(ctx, 'title_bg', 0);
    const ly = 18 + Math.round(Math.sin(t * 1.3) * 2);
    this._drawEmbers(ctx, t, 48, 432, ly + 80, ly + 120, 30, 911);
    const logo = this._spr('logo');
    if (logo) {
      ctx.drawImage(logo, Math.round((W - logo.width) / 2), ly);
      ctx.save();                                  // пульс огненной подсветки
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.06 + 0.05 * Math.sin(t * 2.7);
      ctx.drawImage(logo, Math.round((W - logo.width) / 2), ly);
      ctx.restore();
    } else {
      drawText(ctx, 'HELLBOUND', W / 2, ly + 34, { scale: 5, color: COL.red, align: 'center' });
    }
    if (Math.floor(t * 1.6) % 2 === 0) {
      drawText(ctx, 'НАЖМИТЕ ENTER', W / 2, 218, { scale: 2, color: COL.gold, align: 'center' });
    }
    // «HELLBOUND v1.0 · КЛОН DOOM» — точку-разделитель рисуем сами (нет глифа)
    const a = 'HELLBOUND V1.0';
    const b = 'КЛОН DOOM';
    const wa = textWidth(a, 1);
    const x0 = Math.round((W - (wa + 9 + textWidth(b, 1))) / 2);
    const vy = H - FONT_H - 6;
    drawText(ctx, a, x0, vy, { color: COL.grayDim });
    ctx.fillStyle = COL.grayDim;
    ctx.fillRect(x0 + wa + 4, vy + 2, 2, 2);
    drawText(ctx, b, x0 + wa + 9, vy, { color: COL.grayDim });
  }

  _drawMain(ctx, t) {
    this._drawBg(ctx, 'title_bg', 0.55);
    this._drawLogoSmall(ctx, t);
    this._drawItems(ctx, MAIN_ITEMS, this.selMain, 132, 30, t);
    this._drawHint(ctx, 'СТРЕЛКИ - ВЫБОР, ENTER - ПОДТВЕРДИТЬ, ESC - НАЗАД');
  }

  _drawSkill(ctx, t) {
    this._drawBg(ctx, 'title_bg', 0.62);
    this._drawLogoSmall(ctx, t);
    this._drawHeader(ctx, 'ВЫБЕРИТЕ СЛОЖНОСТЬ', 102);
    this._drawItems(ctx, SKILL_NAMES, this.selSkill, 140, 28, t);
    drawText(ctx, DIFFICULTY[this.selSkill + 1].desc, W / 2, 256, { color: COL.gray, align: 'center' });
    this._drawHint(ctx, 'ENTER - В БОЙ, ESC - НАЗАД');
  }

  _drawOptions(ctx, t) {
    this._drawScreenBase(ctx);
    panel(ctx, 26, 36, 428, 240);
    this._drawHeader(ctx, 'НАСТРОЙКИ', 52);
    const y0 = 96;
    const rowH = 30;
    const labelX = 70;
    const sliderX = 252;
    const sliderW = 130;
    for (let i = 0; i < OPT_LABELS.length; i++) {
      const y = y0 + i * rowH;
      const active = i === this.selOpt;
      drawText(ctx, OPT_LABELS[i], labelX, y, { scale: 2, color: active ? COL.redHi : COL.red });
      if (active) drawSkull(ctx, labelX - 36, y - 4, t);
      if (i < 3) {
        const v = this._optGet(i);
        drawSlider(ctx, sliderX, y + 2, sliderW, 10, v, active);
        drawText(ctx, String(Math.round(v * 10)), sliderX + sliderW + 30, y, {
          scale: 2, color: active ? COL.gold : COL.orange, align: 'right',
        });
      } else if (i === 3) {
        const on = !!this.settings.mouseLook;
        drawText(ctx, on ? 'ВКЛ' : 'ВЫКЛ', sliderX, y, { scale: 2, color: on ? COL.green : COL.grayDim });
      }
    }
    this._drawHint(ctx, 'СТРЕЛКИ ВЛЕВО/ВПРАВО - ИЗМЕНИТЬ, ESC - НАЗАД');
  }

  _drawHelp(ctx) {
    this._drawScreenBase(ctx);
    panel(ctx, 40, 32, 400, 248);
    this._drawHeader(ctx, 'УПРАВЛЕНИЕ', 46);
    const y0 = 84;
    const rowH = FONT_H + 10;
    for (let i = 0; i < HELP_ROWS.length; i++) {
      const y = y0 + i * rowH;
      drawText(ctx, HELP_ROWS[i][0], 216, y, { color: COL.gold, align: 'right' });
      drawText(ctx, HELP_ROWS[i][1], 240, y, { color: COL.gray });
      ctx.fillStyle = COL.steelDark;
      ctx.fillRect(224, y + 3, 10, 1);
    }
    this._drawHint(ctx, 'ESC - НАЗАД');
  }

  _drawCredits(ctx) {
    this._drawScreenBase(ctx);
    panel(ctx, 40, 36, 400, 240);
    this._drawHeader(ctx, 'ОБ ИГРЕ', 50);
    drawText(ctx, 'HELLBOUND', W / 2, 88, { scale: 3, color: COL.red, align: 'center' });
    let y = 126;
    for (let i = 0; i < CREDIT_LINES.length; i++) {
      const line = CREDIT_LINES[i];
      if (line) drawText(ctx, line, W / 2, y, { color: COL.gray, align: 'center' });
      y += line ? 15 : 8;
    }
    this._drawHint(ctx, 'ESC - НАЗАД');
  }

  _drawPause(ctx, t) {
    // игра просвечивает: только затемнение, без полной заливки
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    this._drawHeader(ctx, 'ПАУЗА', 62);
    this._drawItems(ctx, PAUSE_ITEMS, this.selPause, 112, 30, t);
    this._drawHint(ctx, 'ESC - ПРОДОЛЖИТЬ');
  }

  _drawIntermission(ctx, dt, t) {
    this._updateInter(dt);
    this._drawBg(ctx, 'inter_bg', 0);
    const it = this._inter;
    if (!it) return;
    drawText(ctx, it.levelName, W / 2, 30, { scale: 2, color: COL.gold, align: 'center' });
    drawText(ctx, 'УРОВЕНЬ ПРОЙДЕН', W / 2, 56, { scale: 2, color: COL.red, align: 'center' });
    const lw = textWidth('УРОВЕНЬ ПРОЙДЕН', 2);
    ctx.fillStyle = COL.redDark;
    ctx.fillRect(Math.round((W - lw) / 2), 73, lw, 2);
    const y0 = 108;
    const rowH = 32;
    for (let i = 0; i < 3; i++) {
      const y = y0 + i * rowH;
      drawText(ctx, it.rows[i].label, 124, y, { scale: 2, color: COL.red });
      if (i <= it.stage) {
        drawText(ctx, Math.floor(it.disp[i]) + '%', 356, y, { scale: 2, color: COL.gold, align: 'right' });
      }
    }
    if (it.timeOn) {
      const ty = y0 + 3 * rowH + 6;
      drawText(ctx, 'ВРЕМЯ', 124, ty, { scale: 2, color: COL.red });
      drawText(ctx, fmtTime(it.time), 356, ty, { scale: 2, color: COL.gold, align: 'right' });
    }
    if (it.done && Math.floor(t * 1.6) % 2 === 0) {
      drawText(ctx, 'ENTER - ДАЛЬШЕ', W / 2, 262, { scale: 2, color: COL.gold, align: 'center' });
    }
  }

  _drawEndtext(ctx, dt, t) {
    const e = this._end || (this._end = { t: 0, chars: 0, done: false });
    if (!e.done) {
      e.t += dt;
      const want = Math.max(0, Math.floor((e.t - END_DELAY) * END_CPS));
      if (want > e.chars) {
        e.chars = Math.min(want, END_TOTAL);
        if (e.chars % 4 === 0) this._sfx('menu_move', 0.3);   // стрекот печати
        if (e.chars >= END_TOTAL) e.done = true;
      }
    }
    ctx.fillStyle = COL.black;
    ctx.fillRect(0, 0, W, H);
    let rem = e.chars;
    let y = 64;
    let cursorX = -1;
    let cursorY = 0;
    for (let i = 0; i < END_LINES.length; i++) {
      const line = END_LINES[i];
      const n = Math.min(line.length, Math.max(0, rem));
      // slice только для строки, печатаемой прямо сейчас; готовые — без аллокации
      const shown = n === line.length ? line : line.slice(0, n);
      if (n > 0) drawText(ctx, shown, 24, y, { scale: 2, color: COL.red });
      if (!e.done && cursorX < 0 && rem <= line.length) {
        cursorX = 24 + textWidth(shown, 2);
        cursorY = y;
      }
      rem -= line.length + 2;
      y += line.length ? 24 : 12;
    }
    if (cursorX >= 0 && Math.floor(t * 6) % 2 === 0) {
      ctx.fillStyle = COL.red;
      ctx.fillRect(cursorX + 2, cursorY + FONT_H * 2 - 2, 10, 2);
    }
    if (e.done && Math.floor(t * 1.6) % 2 === 0) {
      drawText(ctx, 'ENTER - В МЕНЮ', W / 2, 258, { scale: 2, color: COL.gold, align: 'center' });
    }
  }

  // -- внутреннее -----------------------------------------------------------

  _updateInter(dt) {
    const it = this._inter;
    if (!it || it.done) return;
    if (it.wait > 0) {
      it.wait -= dt;
      return;
    }
    if (it.stage < 3) {
      const target = it.rows[it.stage].target;
      it.disp[it.stage] = Math.min(target, it.disp[it.stage] + dt * (100 / 1.2));
      it.tickT += dt;
      if (it.tickT >= 0.1) {
        it.tickT -= 0.1;
        this._sfx('menu_move', 0.55);
      }
      if (it.disp[it.stage] >= target) {
        it.stage++;
        it.wait = 0.35;
        it.tickT = 0;
        this._sfx('menu_select', 0.7);
      }
    } else {
      it.timeOn = true;
      it.done = true;
      this._sfx('menu_select', 0.8);
    }
  }

  _skipInter() {
    const it = this._inter;
    if (!it) return;
    for (let i = 0; i < 3; i++) it.disp[i] = it.rows[i].target;
    it.stage = 3;
    it.wait = 0;
    it.timeOn = true;
    it.done = true;
  }

  _back() {
    // возврат из options/help/credits туда, откуда пришли (выбор пункта сохраняем)
    this.mode = this._from === 'pause' ? 'pause' : 'main';
  }

  _step(v, dir, n) {
    this._sfx('menu_move');
    return (v + dir + n) % n;
  }

  _optGet(i) {
    const s = this.settings;
    const v = i === 0 ? s.sfx : i === 1 ? s.music : s.mouseSens;
    return clamp(typeof v === 'number' ? v : 0.5, 0, 1);
  }

  _optSet(i, v) {
    if (i === 0) this.settings.sfx = v;
    else if (i === 1) this.settings.music = v;
    else this.settings.mouseSens = v;
  }

  _cb(name, arg) {
    const f = this.callbacks ? this.callbacks[name] : null;
    if (typeof f === 'function') f(arg);
  }

  _sfx(name, volume) {
    if (this.sound && typeof this.sound.play === 'function') {
      try {
        this.sound.play(name, { volume: volume === undefined ? 1 : volume });
      } catch (e) { /* аудио недоступно — тихо */ }
    }
  }

  _spr(key) {
    const s = this.sprites && typeof this.sprites.get === 'function' ? this.sprites.get(key) : null;
    if (!s && !this._warned.has(key)) {
      this._warned.add(key);
      console.warn('menu: отсутствует спрайт "' + key + '"');
    }
    return s || null;
  }

  _drawBg(ctx, key, dim) {
    ctx.fillStyle = COL.black;
    ctx.fillRect(0, 0, W, H);
    const bg = this._spr(key);
    if (bg) ctx.drawImage(bg, 0, 0);
    if (dim > 0) {
      // затемнение через globalAlpha — без сборки rgba-строки в кадровом цикле
      ctx.globalAlpha = dim;
      ctx.fillStyle = COL.black;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // подложка options/help/credits: из паузы игра просвечивает, из меню — титул
  _drawScreenBase(ctx) {
    if (this._from === 'pause') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
    } else {
      this._drawBg(ctx, 'title_bg', 0.62);
    }
  }

  _drawLogoSmall(ctx, t) {
    const logo = this._spr('logo');
    const y = 14 + Math.round(Math.sin(t * 1.3));
    if (logo) {
      const lw = Math.round(logo.width * 0.62);
      const lh = Math.round(logo.height * 0.62);
      ctx.drawImage(logo, Math.round((W - lw) / 2), y, lw, lh);
    } else {
      drawText(ctx, 'HELLBOUND', W / 2, y + 18, { scale: 4, color: COL.red, align: 'center' });
    }
  }

  _drawHeader(ctx, text, y) {
    drawText(ctx, text, W / 2, y, { scale: 2, color: COL.gold, align: 'center' });
    const w2 = textWidth(text, 2);
    const x = Math.round((W - w2) / 2);
    ctx.fillStyle = COL.redDark;
    ctx.fillRect(x, y + FONT_H * 2 + 3, w2, 2);
    ctx.fillStyle = COL.redDeep;
    ctx.fillRect(x, y + FONT_H * 2 + 5, w2, 1);
  }

  _drawItems(ctx, items, sel, y0, lineH, t) {
    let maxw = 0;
    for (let i = 0; i < items.length; i++) {
      const w2 = textWidth(items[i], 2);
      if (w2 > maxw) maxw = w2;
    }
    const left = Math.round((W - maxw) / 2) + 12;
    for (let i = 0; i < items.length; i++) {
      const y = y0 + i * lineH;
      drawText(ctx, items[i], left, y, { scale: 2, color: i === sel ? COL.redHi : COL.red });
      if (i === sel) drawSkull(ctx, left - 36, y - 4, t);
    }
  }

  _drawHint(ctx, text) {
    drawText(ctx, text, W / 2, H - FONT_H - 6, { color: COL.grayDim, align: 'center' });
  }

  // Seeded PRNG (mulberry32) на состоянии экземпляра — без замыканий в кадре.
  _rnd() {
    const a = (this._rngA + 0x6D2B79F5) | 0;
    this._rngA = a;
    let v = Math.imul(a ^ (a >>> 15), 1 | a);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  }

  _drawEmbers(ctx, t, x0, x1, y0, y1, count, seed) {
    this._rngA = (seed + Math.floor(t * 8) * 7919) >>> 0;
    for (let i = 0; i < count; i++) {
      const x = Math.round(x0 + this._rnd() * (x1 - x0));
      const y = Math.round(y0 + this._rnd() * (y1 - y0));
      ctx.fillStyle = EMBER_COLS[(this._rnd() * EMBER_COLS.length) | 0];
      const s = this._rnd() < 0.3 ? 2 : 1;
      ctx.fillRect(x, y, s, s);
    }
  }
}
