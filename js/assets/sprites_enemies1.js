// HELLBOUND — спрайты врагов: zombie (зомби-солдат) и sergeant (сержант) [агент A2a].
// Контракт: §4, §6 docs/architecture.md. Ключи: <type>_walk0..3, <type>_attack0..2,
// <type>_pain0, <type>_die0..4 — ровно 13 на врага. Канвас 64×64, анфас,
// ноги на нижней кромке; die4 — лежащий труп с лужей крови.
// Вся случайность — детерминированный mulberry32, сид — из имени ключа кадра.

const SIZE = 64;
const CX = 32;        // ось фигуры
const GROUND = 63;    // нижняя кромка — подошвы

// ===== Палитры (§4, 3–6 тонов на материал) =====
const SKIN  = ['#39413b', '#525c52', '#6e7a6c', '#8c978a', '#a9b2a0'];  // серая мёртвая кожа
const BLOOD = ['#3d0a0a', '#6e1111', '#a51c1c', '#d23b1e'];
const METAL = ['#1b1d22', '#2e3138', '#494e58', '#6d7380', '#99a0ad'];
const WOOD  = ['#3a2417', '#6b3a24', '#9c5a2e'];
const FIRE  = ['#c44d12', '#f08a1d', '#ffd24a', '#fff6c9'];
const BOOT  = ['#100d09', '#221b12', '#39301f'];
const HAIR  = ['#241d12', '#3a2f1c'];
const BORE  = '#0a0a0d';  // чернота ствола, тень

// Конфигурации врагов: зомби — зелёно-бурая форма и винтовка,
// сержант — чёрная форма, лысый, дробовик, заметно шире (W=1 раздаёт корпус).
const ZOMBIE = {
  name: 'zombie', serg: false, bald: false,
  uni: ['#1d2113', '#323a20', '#48522e', '#5e683c', '#79814d'],
  outline: '#12150d',
};
const SERGEANT = {
  name: 'sergeant', serg: true, bald: true,
  uni: ['#0c0d10', '#16181d', '#222630', '#31363f', '#454b57'],
  outline: '#0a0b0e',
};

// ===== Детерминированный PRNG =====
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strSeed(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// ===== Пиксельные хелперы =====
function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); }
function rc(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
function hl(g, x, y, w, c) { rc(g, x, y, w, 1, c); }
function vl(g, x, y, h, c) { rc(g, x, y, 1, h, c); }

// n случайных пикселей в прямоугольнике (шум формы/грязь/брызги).
function speck(g, rng, x, y, w, h, cols, n) {
  for (let i = 0; i < n; i++) {
    px(g, x + ((rng() * w) | 0), y + ((rng() * h) | 0), cols[(rng() * cols.length) | 0]);
  }
}

// Параллелограмм: строки со сдвигом slope — наклонённый корпус в кадрах смерти.
function slab(g, x, y, w, h, slope, c) {
  for (let r = 0; r < h; r++) hl(g, Math.round(x + slope * r), y + r, w, c);
}

// Диагональный ствол толщиной 2: верхний тон — свет, нижний — тень.
function gunLine(g, x0, y0, x1, y1, cTop, cBot) {
  const steps = Math.max(1, Math.abs(x1 - x0));
  const sx = x0 < x1 ? 1 : -1;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + sx * i;
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    px(g, x, y, cTop);
    px(g, x, y + 1, cBot);
  }
}

// Ромбическое кольцо (манхэттенские радиусы r0..r1) — ядро дульной вспышки.
function diamond(g, cx, cy, r0, r1, c) {
  for (let dy = -r1; dy <= r1; dy++) for (let dx = -r1; dx <= r1; dx++) {
    const d = Math.abs(dx) + Math.abs(dy);
    if (d >= r0 && d <= r1) px(g, cx + dx, cy + dy, c);
  }
}

// Тёмный контур: краевые пиксели силуэта затемняются к очень тёмному тону
// материала (не чисто чёрному) — «нарисованный» вид, как у спрайтов Doom.
function outlinePass(cv, hex) {
  const g = cv.getContext('2d');
  const img = g.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  const alpha = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) alpha[i] = d[i * 4 + 3];
  const or_ = parseInt(hex.slice(1, 3), 16);
  const og = parseInt(hex.slice(3, 5), 16);
  const ob = parseInt(hex.slice(5, 7), 16);
  const solid = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && alpha[y * SIZE + x] > 127;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (alpha[y * SIZE + x] <= 127) continue;
    const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) ||
      (y < SIZE - 1 && !solid(x, y + 1));   // нижнюю кромку канваса краем не считаем
    if (!edge) continue;
    const i = (y * SIZE + x) * 4;
    d[i] = (d[i] * 0.22 + or_ * 0.78) | 0;
    d[i + 1] = (d[i + 1] * 0.22 + og * 0.78) | 0;
    d[i + 2] = (d[i + 2] * 0.22 + ob * 0.78) | 0;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// ===== Части фигуры =====

// Нога: штанина 5 px + ботинок 6 px (носок наружу). footY = 63 — стоит на земле,
// меньше — поднята в шаге (виден тёмный срез подошвы).
function drawLeg(g, rng, s, x0, top, footY, side) {
  const U = s.uni;
  const bootTop = footY - 3;
  if (bootTop > top) {
    rc(g, x0, top, 5, bootTop - top, U[2]);
    vl(g, x0, top, bootTop - top, U[3]);          // свет слева
    vl(g, x0 + 4, top, bootTop - top, U[1]);      // тень справа
    const knee = top + 8;
    if (knee < bootTop - 1) {
      hl(g, x0 + 1, knee, 3, U[1]);               // складка на колене
      px(g, x0 + 1, knee + 1, U[3]);
    }
    if (!s.serg && bootTop - top > 4) {
      speck(g, rng, x0 + 1, top + 1, 3, bootTop - top - 2, [U[1], U[3]], 4);  // камуфляжные пятна
    }
  }
  const bx = side < 0 ? x0 - 1 : x0;
  rc(g, bx, bootTop, 6, 4, BOOT[1]);
  hl(g, bx, bootTop, 6, BOOT[2]);
  hl(g, bx, footY, 6, BOOT[0]);                   // подошва
  px(g, side < 0 ? bx : bx + 5, bootTop + 1, BOOT[2]);  // потёртость на носке
}

// Подломившиеся ноги для die1: колени враскоряку, ботинки на земле.
function drawBentLegs(g, s) {
  const U = s.uni, W = s.serg ? 1 : 0;
  rc(g, CX - 7 - W, 46, 14 + 2 * W, 3, U[1]);     // таз, мостик к корпусу
  rc(g, CX - 9 - W, 48, 5, 7, U[2]);              // бёдра наружу
  vl(g, CX - 9 - W, 48, 7, U[3]);
  rc(g, CX + 4 + W, 48, 5, 7, U[2]);
  vl(g, CX + 8 + W, 48, 7, U[1]);
  rc(g, CX - 7 - W, 54, 4, 6, U[1]);              // голени внутрь
  rc(g, CX + 3 + W, 54, 4, 6, U[1]);
  rc(g, CX - 9 - W, 60, 6, 4, BOOT[1]);
  hl(g, CX - 9 - W, 60, 6, BOOT[2]);
  hl(g, CX - 9 - W, 63, 6, BOOT[0]);
  rc(g, CX + 3 + W, 60, 6, 4, BOOT[1]);
  hl(g, CX + 3 + W, 60, 6, BOOT[2]);
  hl(g, CX + 3 + W, 63, 6, BOOT[0]);
}

// Голова анфас: 10×11, свет слева-сверху, тяжёлая бровь, гнилая кожа.
// o: { mouth: 'open'|undefined, eyes: 'shut'|undefined }
function drawHead(g, rng, s, hx, hy, o) {
  o = o || {};
  const widths = [6, 8, 10, 10, 10, 10, 10, 10, 8, 6, 4];
  for (let r = 0; r < widths.length; r++) {
    hl(g, hx - (widths[r] >> 1), hy + r, widths[r], SKIN[2]);
  }
  vl(g, hx - 4, hy + 2, 6, SKIN[3]);              // объём: свет слева
  px(g, hx - 3, hy + 2, SKIN[3]);
  vl(g, hx + 3, hy + 2, 6, SKIN[1]);              // тень справа
  vl(g, hx + 4, hy + 2, 6, SKIN[1]);
  hl(g, hx - 2, hy + 10, 4, SKIN[1]);             // подбородок в тени
  if (s.bald) {
    hl(g, hx - 3, hy, 4, SKIN[3]);                // лысина
    px(g, hx - 2, hy + 1, SKIN[4]);               // блик на черепе
    px(g, hx - 1, hy + 1, SKIN[4]);
    px(g, hx + 1, hy + 1, BLOOD[1]);              // рубец через темя
    px(g, hx + 2, hy + 2, BLOOD[1]);
    px(g, hx + 3, hy + 3, BLOOD[0]);
  } else {
    hl(g, hx - 3, hy, 6, HAIR[0]);                // грязная шевелюра
    hl(g, hx - 4, hy + 1, 8, HAIR[0]);
    hl(g, hx - 5, hy + 2, 10, HAIR[1]);
    for (let x = -5; x <= 4; x += 2) px(g, hx + x, hy + 3, HAIR[0]);  // рваная чёлка
    px(g, hx - 5, hy + 3, HAIR[1]);
    px(g, hx + 4, hy + 3, HAIR[1]);
  }
  hl(g, hx - 4, hy + 4, 3, SKIN[0]);              // тяжёлые брови
  hl(g, hx + 1, hy + 4, 3, SKIN[0]);
  if (o.eyes === 'shut') {
    hl(g, hx - 4, hy + 5, 2, SKIN[0]);
    hl(g, hx + 1, hy + 5, 2, SKIN[0]);
  } else {
    rc(g, hx - 4, hy + 5, 2, 1, '#141419');       // запавшие глазницы
    rc(g, hx + 1, hy + 5, 2, 1, '#141419');
    px(g, hx - 3, hy + 5, BLOOD[2]);              // налитые кровью зрачки
    px(g, hx + 2, hy + 5, BLOOD[2]);
  }
  px(g, hx - 1, hy + 6, SKIN[1]);                 // нос
  px(g, hx - 1, hy + 7, SKIN[0]);
  px(g, hx, hy + 7, SKIN[1]);
  if (s.bald) {
    px(g, hx - 4, hy + 6, BLOOD[1]);              // рассечённая скула
    px(g, hx - 4, hy + 7, BLOOD[0]);
  } else {
    rc(g, hx + 2, hy + 6, 2, 2, BLOOD[1]);        // гниющая рана на щеке
    px(g, hx + 3, hy + 7, BLOOD[0]);
  }
  if (o.mouth === 'open') {
    rc(g, hx - 2, hy + 8, 4, 2, '#1a0808');       // разинутая пасть
    px(g, hx - 2, hy + 8, SKIN[4]);               // обломки зубов
    px(g, hx, hy + 8, SKIN[4]);
    hl(g, hx - 2, hy + 9, 4, BLOOD[0]);
    px(g, hx - 2, hy + 10, BLOOD[1]);
    px(g, hx + 1, hy + 10, BLOOD[1]);
  } else {
    hl(g, hx - 2, hy + 8, 4, SKIN[0]);            // сжатый рот
    px(g, hx + 1, hy + 9, BLOOD[1]);              // кровь из угла рта
    px(g, hx + 1, hy + 10, BLOOD[0]);
  }
}

// Оружие наперевес (поза ходьбы): диагональ от приклада у бедра к стволу у плеча.
function drawHold(g, rng, s, ox, ty, tx0, tx1) {
  const U = s.uni;
  rc(g, tx0 - 2, ty + 2, 3, 5, U[1]);             // плечо левой руки
  rc(g, tx1, ty + 2, 3, 6, U[1]);                 // плечо правой
  if (s.serg) {
    gunLine(g, ox - 11, ty + 3, ox + 5, ty + 11, METAL[3], METAL[1]);   // толстый ствол
    gunLine(g, ox - 11, ty + 4, ox + 5, ty + 12, METAL[1], METAL[0]);
    rc(g, ox - 13, ty + 2, 2, 3, METAL[2]);       // дульный срез
    px(g, ox - 13, ty + 2, METAL[4]);
    rc(g, ox - 5, ty + 6, 5, 3, WOOD[2]);         // цевьё-помпа
    hl(g, ox - 5, ty + 8, 5, WOOD[0]);
    rc(g, ox + 3, ty + 9, 3, 3, WOOD[1]);         // приклад
    rc(g, ox + 6, ty + 10, 3, 4, WOOD[0]);
  } else {
    gunLine(g, ox - 12, ty + 2, ox + 4, ty + 10, METAL[2], METAL[1]);
    px(g, ox - 12, ty + 2, METAL[4]);             // дульный срез
    px(g, ox - 12, ty + 3, METAL[3]);
    px(g, ox - 10, ty + 1, METAL[3]);             // мушка
    rc(g, ox - 2, ty + 8, 3, 4, METAL[1]);        // магазин
    vl(g, ox, ty + 8, 4, METAL[0]);
    rc(g, ox + 4, ty + 9, 2, 3, WOOD[1]);         // скошенный приклад
    rc(g, ox + 6, ty + 10, 2, 3, WOOD[1]);
    rc(g, ox + 8, ty + 11, 2, 3, WOOD[0]);
  }
  rc(g, tx0 - 1, ty + 5, 5, 3, U[2]);             // левое предплечье к цевью
  rc(g, ox - 7, ty + 4, 2, 2, SKIN[2]);           // кисть на стволе
  if (s.serg) rc(g, ox - 4, ty + 6, 2, 2, SKIN[2]);  // кисть на помпе
  rc(g, ox + 3, ty + 7, 5, 3, U[1]);              // правое предплечье к рукояти
  rc(g, ox + 2, ty + 8, 2, 2, SKIN[2]);           // кисть на рукояти
}

// Оружие вскинуто в игрока (кадры атаки): виден дульный срез анфас.
function drawAim(g, rng, s, ox, ty, tx0, tx1, low) {
  const U = s.uni;
  const mx = ox - 2, my = ty + 5 + low;
  rc(g, tx0 - 2, ty + 2, 3, 6, U[1]);             // плечи рук
  rc(g, tx1, ty + 2, 3, 6, U[1]);
  rc(g, tx0 - 1, ty + 6 + low, mx - tx0 - 1, 3, U[2]);   // предплечья к центру
  rc(g, mx + 3, ty + 7 + low, tx1 - mx - 1, 3, U[1]);
  rc(g, mx + 4, my - 2, 4, 3, WOOD[1]);           // приклад прижат к плечу
  px(g, mx + 7, my - 2, WOOD[0]);
  rc(g, mx - 1, my + 2, 4, 2, s.serg ? WOOD[2] : METAL[2]);   // цевьё снизу
  rc(g, mx - 4, my + 3, 3, 2, SKIN[2]);           // кисти на цевье
  rc(g, mx + 2, my + 3, 3, 2, SKIN[2]);
  if (s.serg) {
    rc(g, mx - 2, my - 2, 5, 5, METAL[1]);        // широкий дульный срез дробовика
    rc(g, mx - 1, my - 1, 3, 3, BORE);
    px(g, mx - 2, my - 2, METAL[4]);              // блик слева-сверху
    px(g, mx + 2, my - 2, METAL[2]);
    px(g, mx + 2, my + 2, METAL[0]);
  } else {
    rc(g, mx - 1, my - 1, 4, 4, METAL[1]);        // срез винтовки
    rc(g, mx, my, 2, 2, BORE);
    px(g, mx - 1, my - 1, METAL[3]);
    px(g, mx - 1, my + 2, METAL[2]);
    px(g, mx + 2, my + 2, METAL[0]);
  }
}

// Поза боли: оружие выронено к бедру, свободная рука вскинута к ране.
function drawPainArms(g, rng, s, ty, tx0, tx1) {
  const U = s.uni;
  rc(g, tx1, ty + 2, 3, 7, U[1]);                 // правая рука обвисла
  rc(g, tx1 + 1, ty + 7, 3, 3, s.serg ? WOOD[2] : WOOD[1]);  // рукоять у бедра
  vl(g, tx1 + 2, ty + 10, 8, METAL[1]);           // ствол вниз
  vl(g, tx1 + 3, ty + 10, 8, METAL[2]);
  if (s.serg) vl(g, tx1 + 4, ty + 11, 6, METAL[0]);
  rc(g, tx1 + 1, ty + 9, 2, 2, SKIN[2]);          // кисть
  rc(g, tx0 - 3, ty - 3, 3, 5, U[2]);             // левая рука вскинута
  rc(g, tx0 - 2, ty + 1, 3, 4, U[1]);
  rc(g, tx0 - 3, ty - 5, 3, 2, SKIN[2]);
  for (let i = 0; i < 9; i++) {                   // брызги от попадания
    px(g, CX - 4 - ((rng() * 9) | 0), ty + 1 + ((rng() * 7) | 0),
      BLOOD[2 + ((rng() * 2) | 0)]);
  }
}

// Руки раскинуты вверх (начало смерти): оружие выронено.
function drawThrownArms(g, s, ty, tx0, tx1) {
  const U = s.uni;
  rc(g, tx0 - 2, ty, 3, 4, U[1]);
  rc(g, tx0 - 4, ty - 3, 3, 4, U[2]);
  rc(g, tx0 - 5, ty - 5, 3, 2, SKIN[2]);
  rc(g, tx1, ty, 3, 4, U[1]);
  rc(g, tx1 + 2, ty - 3, 3, 4, U[1]);
  rc(g, tx1 + 3, ty - 5, 3, 2, SKIN[2]);
}

// Фонтан крови из груди (кадры смерти): радиальные струи + сгусток.
function burst(g, rng, bx, by) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + rng() * 0.5;
    const len = 3 + rng() * 3;
    for (let r = 1; r <= len; r++) {
      px(g, Math.round(bx + Math.cos(a) * r), Math.round(by + Math.sin(a) * r),
        BLOOD[r < 2 ? 3 : 2]);
    }
  }
  rc(g, bx - 2, by - 1, 5, 3, BLOOD[1]);
  px(g, bx, by, BLOOD[0]);
  speck(g, rng, bx - 5, by - 4, 11, 9, [BLOOD[2], BLOOD[3]], 8);
}

// Дульная вспышка-звезда (рисуется ПОСЛЕ контура — это свечение).
function drawFlash(g, rng, mx, my, big) {
  const R = big ? 2 : 0;
  hl(g, mx - 7 - R, my, 15 + 2 * R, FIRE[1]);     // горизонтальный луч
  vl(g, mx, my - 6 - R, 13 + 2 * R, FIRE[1]);     // вертикальный
  px(g, mx - 8 - R, my, FIRE[0]);                 // остывающие кончики
  px(g, mx + 8 + R, my, FIRE[0]);
  px(g, mx, my - 7 - R, FIRE[0]);
  px(g, mx, my + 7 + R, FIRE[0]);
  for (let i = 2; i <= (big ? 5 : 4); i++) {      // диагональные лучи
    px(g, mx + i, my + i, FIRE[1]);
    px(g, mx - i, my + i, FIRE[1]);
    px(g, mx + i, my - i, FIRE[1]);
    px(g, mx - i, my - i, FIRE[1]);
  }
  diamond(g, mx, my, 3, big ? 5 : 4, FIRE[2]);
  diamond(g, mx, my, 0, 2, FIRE[3]);
  px(g, mx, my, '#fff6c9');
  speck(g, rng, mx - 6, my - 6, 13, 13, [FIRE[2], FIRE[1]], big ? 8 : 5);
}

// Пороховой дымок над опущенным стволом (кадр attack2).
function drawSmoke(g, rng, mx, my) {
  for (let i = 0; i < 5; i++) {
    const x = mx + ((rng() * 3) | 0) - 1 + (i & 1);
    const y = my - 4 - i * 2 - ((rng() * 2) | 0);
    px(g, x, y, i < 2 ? METAL[3] : METAL[4]);
    if (rng() < 0.5) px(g, x + 1, y + 1, METAL[2]);
  }
}

function eyeGlow(g, x, y, big) {
  const hot = big ? FIRE[3] : BLOOD[3];
  const mid = big ? FIRE[2] : BLOOD[2];
  px(g, x - 1, y, mid);
  px(g, x, y, hot);
  px(g, x + 1, y, mid);
  if (big) {
    px(g, x, y - 1, FIRE[1]);
    px(g, x, y + 1, FIRE[0]);
  }
}

function bloodSpurt(g, rng, cx, cy, n, spreadX, spreadY) {
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + (rng() - 0.5) * spreadX);
    const y = Math.round(cy + (rng() - 0.5) * spreadY);
    px(g, x, y, BLOOD[1 + ((rng() * 3) | 0)]);
    if (rng() < 0.35) px(g, x, y + 1, BLOOD[0]);
  }
}

function muzzleWash(g, rng, s, mx, my) {
  for (let r = 0; r < 4; r++) {
    hl(g, mx - 10 + r, my + 6 + r * 2, 20 - r * 2, r < 2 ? FIRE[2] : FIRE[1]);
  }
  for (let i = 0; i < 12; i++) {
    const x = mx - 15 + ((rng() * 31) | 0);
    const y = my - 8 + ((rng() * 22) | 0);
    if (((x + y) & 1) === 0) px(g, x, y, rng() < 0.45 ? FIRE[3] : FIRE[1]);
  }
  const u = s.uni;
  hl(g, CX - 9, 28, 18, s.serg ? METAL[4] : u[4]);
  px(g, CX - 6, 23, FIRE[2]);
  px(g, CX + 6, 23, FIRE[1]);
}

function polishTrooper(g, rng, s, suffix) {
  const u = s.uni;
  const standing = suffix.startsWith('walk') || suffix.startsWith('attack') || suffix === 'pain0' || suffix === 'die0' || suffix === 'die1';
  if (standing) {
    // Красные точки глаз и рим-лайт по левому плечу/ботинкам читают силуэт издалека.
    eyeGlow(g, CX - 3 + (suffix === 'pain0' ? 1 : 0), 20, suffix.startsWith('attack'));
    eyeGlow(g, CX + 3 + (suffix === 'pain0' ? 1 : 0), 20, suffix.startsWith('attack'));
    vl(g, CX - 11 - (s.serg ? 1 : 0), 27, 11, u[4]);
    px(g, CX - 12 - (s.serg ? 1 : 0), 28, u[4]);
    hl(g, CX - 9 - (s.serg ? 1 : 0), 43, 7, u[3]);
    px(g, CX - 8 - (s.serg ? 1 : 0), 61, BOOT[2]);
    px(g, CX + 4 + (s.serg ? 1 : 0), 61, BOOT[2]);
    speck(g, rng, CX - 10, 28, 20, 16, [u[0], u[1], BLOOD[0]], s.serg ? 8 : 6);
  }
  if (suffix === 'attack1') {
    muzzleWash(g, rng, s, CX - 2, 31);
    drawFlash(g, rng, CX - 2, 31, true);
  }
  if (suffix === 'pain0') {
    bloodSpurt(g, rng, CX - 6, 32, 16, 18, 16);
    vl(g, CX - 2, 33, 10, BLOOD[1]);
    px(g, CX - 2, 44, BLOOD[2]);
  }
  if (suffix === 'die0' || suffix === 'die1') bloodSpurt(g, rng, CX, 32, 26, 28, 22);
  if (suffix === 'die2' || suffix === 'die3') bloodSpurt(g, rng, 24, 51, 20, 30, 14);
  if (suffix === 'die4') {
    for (let i = 0; i < 9; i++) {
      hl(g, 16 + ((rng() * 12) | 0), 58 + (i % 5), 12 + ((rng() * 13) | 0), i & 1 ? BLOOD[0] : BLOOD[2]);
    }
    px(g, 41, 51, METAL[4]); // блик на выроненном оружии
  }
}

// ===== Сборка стоячей фигуры =====
// q: { dy, sway, legL/legR:{dx,lift}, bentLegs, pose:'hold'|'aim'|'pain'|'thrown',
//      gunLow, headDx, headDy, mouth, eyes, burst, drip }
function drawTrooper(g, rng, s, q) {
  const dy = q.dy || 0;
  const sw = q.sway || 0;
  const W = s.serg ? 1 : 0;
  const U = s.uni;
  const ty = 26 + dy;                   // верх корпуса
  const tx0 = CX - 8 - W + sw;          // корпус: zombie 16 px, sergeant 18 px
  const tw = 16 + 2 * W;
  const tx1 = tx0 + tw - 1;
  const ox = CX + sw;                   // ось корпуса (с покачиванием)

  // --- ноги (ступни всегда упираются в землю, корпус качается отдельно) ---
  if (q.bentLegs) {
    drawBentLegs(g, s);
  } else {
    const lL = q.legL || {}, lR = q.legR || {};
    drawLeg(g, rng, s, CX - 6 - W + (lL.dx || 0), 43 + dy, GROUND - (lL.lift || 0), -1);
    drawLeg(g, rng, s, CX + 1 + W + (lR.dx || 0), 43 + dy, GROUND - (lR.lift || 0), 1);
  }

  // --- корпус ---
  rc(g, tx0, ty, tw, 17, U[2]);
  rc(g, tx0, ty + 1, 2, 15, U[3]);                // свет слева
  rc(g, tx1 - 1, ty + 1, 2, 15, U[1]);            // тень справа
  hl(g, tx0 + 1, ty, tw - 2, U[4]);               // световой кант на плечах
  speck(g, rng, tx0 + 2, ty + 3, tw - 4, 10, [U[1], U[0], U[3]], 10);  // складки/грязь
  hl(g, tx0 + 2, ty + 6, 4, U[0]);                // нагрудные карманы
  hl(g, tx1 - 5, ty + 6, 4, U[0]);
  if (s.serg) {
    for (let i = 0; i < 7; i++) {                 // патронташ с красными гильзами
      const x = tx0 + 3 + i * 2, y = ty + 11 - i;
      px(g, x, y, U[0]);
      px(g, x + 1, y, U[0]);
      if ((i & 1) === 0) {
        px(g, x, y - 1, '#c97f45');               // латунный капсюль
        px(g, x, y - 2, BLOOD[2]);                // красная гильза
      }
    }
  } else {
    vl(g, ox, ty + 2, 11, U[1]);                  // планка кителя
    for (let yy = ty + 3; yy <= ty + 12; yy += 3) px(g, ox, yy, U[0]);  // пуговицы
  }
  hl(g, tx0, ty + 15, tw, U[0]);                  // ремень
  hl(g, tx0, ty + 16, tw, U[1]);
  rc(g, ox - 1, ty + 15, 2, 2, METAL[3]);         // пряжка
  px(g, ox - 1, ty + 15, METAL[4]);
  rc(g, tx0 + 2, ty + 14, 3, 3, U[1]);            // подсумки
  rc(g, tx1 - 4, ty + 14, 3, 3, U[1]);
  px(g, tx0 + 3, ty + 14, U[3]);
  if (s.serg) {                                   // бронированные наплечники сержанта
    rc(g, tx0 - 3, ty + 1, 4, 4, METAL[1]);
    rc(g, tx1, ty + 1, 4, 4, METAL[1]);
    px(g, tx0 - 3, ty + 1, METAL[3]);
    px(g, tx1 + 3, ty + 4, METAL[0]);
  } else {
    rc(g, tx0 - 2, ty + 1, 3, 4, U[2]);           // матерчатые плечи
    rc(g, tx1, ty + 1, 3, 4, U[1]);
    px(g, tx0 - 2, ty + 1, U[4]);
    px(g, tx1 + 2, ty + 4, U[0]);
  }
  hl(g, ox - 2, ty, 4, U[0]);                     // ворот

  // --- кровавое пятно на груди с подтёками ---
  const bx = ox - 3 + (s.serg ? 3 : 0), by = ty + 4;
  for (let i = 0; i < 22; i++) {
    const a = rng() * Math.PI * 2, r = rng() * rng() * 4;
    px(g, Math.round(bx + 1 + Math.cos(a) * (r + 1)), Math.round(by + 2 + Math.sin(a) * r),
      BLOOD[1 + ((rng() * 2) | 0)]);
  }
  rc(g, bx, by + 1, 3, 2, BLOOD[1]);
  px(g, bx + 1, by + 2, BLOOD[0]);
  vl(g, bx + 1, by + 3, 3 + ((rng() * 3) | 0), BLOOD[1]);
  vl(g, bx + 3, by + 4, 2 + ((rng() * 2) | 0), BLOOD[0]);

  // --- шея и голова ---
  const hx = ox + (q.headDx || 0);
  const hy = 15 + dy + (q.headDy || 0);
  rc(g, hx - 2, hy + 10, 4, 3, SKIN[1]);
  drawHead(g, rng, s, hx, hy, { mouth: q.mouth, eyes: q.eyes });

  // --- руки и оружие ---
  if (q.pose === 'hold') drawHold(g, rng, s, ox, ty, tx0, tx1);
  else if (q.pose === 'aim') drawAim(g, rng, s, ox, ty, tx0, tx1, q.gunLow ? 2 : 0);
  else if (q.pose === 'pain') drawPainArms(g, rng, s, ty, tx0, tx1);
  else if (q.pose === 'thrown') drawThrownArms(g, s, ty, tx0, tx1);

  // --- кровь смертельных кадров ---
  if (q.burst) burst(g, rng, ox, ty + 5);
  if (q.drip) {
    vl(g, ox - 2, ty + 8, 4, BLOOD[1]);
    vl(g, ox + 2, ty + 9, 5, BLOOD[2]);
    px(g, ox, ty + 14, BLOOD[0]);
  }
}

// ===== Кадры смерти 2–4 (тело валится и ложится) =====

// die2: колени подломились, корпус опрокидывается назад-влево.
function drawDie2(g, rng, s) {
  const U = s.uni, W = s.serg ? 1 : 0;
  rc(g, 38, 53, 7, 4, U[2]);                      // опорное бедро вперёд
  rc(g, 40, 56, 5, 4, U[1]);                      // голень
  vl(g, 40, 53, 4, U[3]);
  rc(g, 39, 60, 7, 4, BOOT[1]);                   // опорный ботинок
  hl(g, 39, 60, 7, BOOT[2]);
  hl(g, 39, 63, 7, BOOT[0]);
  rc(g, 28, 56, 8, 4, U[1]);                      // левая нога сложилась под себя
  rc(g, 24, 59, 7, 3, U[2]);
  rc(g, 22, 61, 7, 3, BOOT[1]);                   // ботинок лёг набок
  hl(g, 22, 63, 7, BOOT[0]);
  rc(g, 33, 52, 8 + W, 5, U[1]);                  // таз
  hl(g, 33, 52, 8 + W, U[0]);                     // ремень
  px(g, 36, 53, METAL[3]);
  slab(g, 22, 44, 12 + 2 * W, 9, 1.2, U[2]);      // корпус заваливается влево
  slab(g, 22, 44, 3, 9, 1.2, U[3]);               // свет по верхней грани
  speck(g, rng, 24, 45, 8 + 2 * W, 6, [BLOOD[1], BLOOD[2]], 14);  // развороченная грудь
  rc(g, 26, 47, 3, 2, BLOOD[1]);
  rc(g, 13, 48, 8, 3, U[1]);                      // левая рука распласталась
  rc(g, 11, 48, 2, 2, SKIN[2]);
  rc(g, 33, 42, 3, 5, U[1]);                      // правая ещё в замахе
  rc(g, 34, 40, 2, 2, SKIN[2]);
  rc(g, 20, 47, 3, 4, SKIN[1]);                   // шея
  drawHead(g, rng, s, 18, 40, { mouth: 'open' }); // голова запрокинута
  speck(g, rng, 20, 36, 14, 5, [BLOOD[2], BLOOD[3]], 6);  // капли в воздухе
}

// die3: рухнул на спину, колени ещё торчат вверх, кровь пошла по полу.
function drawDie3(g, rng, s) {
  const U = s.uni, W = s.serg ? 1 : 0;
  slab(g, 20, 54, 16 + 2 * W, 8, 0.2, U[2]);      // корпус лёг
  hl(g, 20, 54, 16 + 2 * W, U[3]);                // свет по верхней грани
  hl(g, 22, 61, 15 + 2 * W, U[1]);
  drawHead(g, rng, s, 14, 51, { mouth: 'open', eyes: 'shut' });   // голова на полу
  rc(g, 19, 56, 4, 3, U[1]);                      // плечо
  rc(g, 8, 58, 7, 3, U[1]);                       // рука откинута в сторону
  rc(g, 6, 58, 2, 2, SKIN[2]);
  rc(g, 26, 52, 6, 3, U[1]);                      // вторая рука на груди
  rc(g, 31, 52, 2, 2, SKIN[2]);
  rc(g, 36 + W, 55, 6, 7, U[1]);                  // таз
  vl(g, 38 + W, 55, 7, U[0]);                     // ремень (тело лежит — полоса вертикальна)
  px(g, 38 + W, 58, METAL[3]);
  rc(g, 42 + W, 52, 5, 6, U[2]);                  // бедро коленом вверх
  vl(g, 42 + W, 52, 6, U[3]);
  rc(g, 46 + W, 54, 6, 4, U[1]);                  // голень падает дальше
  rc(g, 51 + W, 56, 6, 4, BOOT[1]);               // ботинок ещё в воздухе
  hl(g, 51 + W, 56, 6, BOOT[2]);
  rc(g, 42 + W, 58, 8, 4, U[1]);                  // вторая нога уже легла
  rc(g, 49 + W, 60, 6, 4, BOOT[1]);
  hl(g, 49 + W, 63, 6, BOOT[0]);
  for (let i = 0; i < 3; i++) {                   // кровь растекается из-под тела
    hl(g, 16 + ((rng() * 6) | 0), 61 + i, 14 + ((rng() * 10) | 0), BLOOD[1]);
  }
  speck(g, rng, 14, 60, 28, 4, [BLOOD[0], BLOOD[2]], 10);
  speck(g, rng, 24, 55, 9 + 2 * W, 5, [BLOOD[1], BLOOD[2]], 12);  // грудь
}

// die4: труп навзничь в луже крови — низкий, остаётся лежать в мире.
function drawDie4(g, rng, s) {
  const U = s.uni, W = s.serg ? 1 : 0;
  for (let r = 0; r < 7; r++) {                   // лужа: пиксельный эллипс с рваным краем
    const k = (r - 3) / 3.6;
    const half = Math.round(19 * Math.sqrt(1 - k * k)) + ((rng() * 3) | 0) - 1;
    hl(g, 32 - half, 57 + r, half * 2, BLOOD[1]);
  }
  speck(g, rng, 16, 58, 32, 5, [BLOOD[0]], 14);   // тёмные сгустки
  speck(g, rng, 20, 59, 24, 4, [BLOOD[2]], 10);   // свежие блики
  hl(g, 40, 52, 11, METAL[2]);                    // выроненное оружие рядом
  hl(g, 40, 53, 11, METAL[1]);
  if (s.serg) {
    hl(g, 40, 54, 11, METAL[0]);
    rc(g, 43, 51, 4, 2, WOOD[2]);                 // помпа дробовика
    rc(g, 50, 50, 4, 4, WOOD[0]);                 // приклад
  } else {
    rc(g, 50, 51, 4, 3, WOOD[1]);                 // приклад винтовки
    px(g, 40, 52, METAL[4]);
  }
  rc(g, 14, 56, 8, 6, SKIN[2]);                   // голова виском на полу
  vl(g, 13, 57, 4, SKIN[2]);
  hl(g, 14, 56, 8, SKIN[3]);
  if (s.bald) {
    px(g, 15, 56, SKIN[4]);                       // блик на лысине
    px(g, 16, 56, SKIN[4]);
  } else {
    rc(g, 14, 56, 3, 3, HAIR[0]);                 // волосы
    px(g, 16, 57, HAIR[1]);
  }
  hl(g, 16, 59, 3, SKIN[0]);                      // закрытые глаза
  px(g, 20, 60, SKIN[1]);                         // нос
  hl(g, 17, 61, 4, BLOOD[1]);                     // кровь изо рта
  px(g, 13, 59, BLOOD[2]);                        // рана на виске
  rc(g, 22, 55, 17 + 2 * W, 7 + W, U[2]);         // торс
  hl(g, 22, 55, 17 + 2 * W, U[3]);
  hl(g, 22, 61 + W, 17 + 2 * W, U[1]);
  speck(g, rng, 23, 56, 15 + 2 * W, 5, [U[1], U[0]], 8);
  rc(g, 24, 53, 10, 3, U[1]);                     // рука переброшена через грудь
  rc(g, 33, 53, 2, 2, SKIN[2]);
  vl(g, 36 + W, 55, 7 + W, U[0]);                 // ремень поперёк лежащего тела
  vl(g, 37 + W, 55, 7 + W, U[0]);
  px(g, 36 + W, 58, METAL[3]);
  rc(g, 39 + 2 * W, 56, 8, 5, U[1]);              // таз
  rc(g, 46 + 2 * W, 55, 7, 4, U[2]);              // ноги врозь
  rc(g, 46 + 2 * W, 59, 7, 3, U[1]);
  rc(g, 52 + 2 * W, 54, 6, 4, BOOT[1]);           // ботинок носком вверх
  hl(g, 52 + 2 * W, 54, 6, BOOT[2]);
  rc(g, 53 + 2 * W, 59, 6, 4, BOOT[1]);
  hl(g, 53 + 2 * W, 62, 6, BOOT[0]);
  speck(g, rng, 26, 56, 8 + 2 * W, 4, [BLOOD[1], BLOOD[2]], 10);  // пятно на груди
  speck(g, rng, 10, 52, 44, 4, [BLOOD[2]], 6);    // брызги вокруг
}

// ===== Раскадровка =====
// 13 кадров на врага. pre — рисуется до контура, post — поверх (вспышка/дым).
function buildFrames(s) {
  const P = (q) => (g, rng) => drawTrooper(g, rng, s, q);
  const MX = CX - 2;        // дуло в кадрах атаки (ось ствола drawAim при sway=0)
  const MY = 31;            // ty(26) + 5
  const MYL = 33;           // опущенный ствол (gunLow)
  return {
    // Цикл шага: 0/2 — опорные, 1/3 — широкий шаг с подъёмом задней ноги,
    // корпус приседает (dy) и покачивается (sway).
    walk0: { pre: P({ legL: { dx: -1 }, legR: {}, pose: 'hold' }) },
    walk1: { pre: P({ dy: 1, sway: -1, legL: { dx: -2 }, legR: { dx: 1, lift: 2 }, pose: 'hold' }) },
    walk2: { pre: P({ legL: {}, legR: { dx: 1 }, pose: 'hold' }) },
    walk3: { pre: P({ dy: 1, sway: 1, legL: { dx: -1, lift: 2 }, legR: { dx: 2 }, pose: 'hold' }) },
    // Атака: вскинул ствол → выстрел со вспышкой → ствол опущен, дымок.
    attack0: { pre: P({ legL: { dx: -1 }, legR: { dx: 1 }, pose: 'aim' }) },
    attack1: {
      pre: P({ legL: { dx: -1 }, legR: { dx: 1 }, pose: 'aim' }),
      post: (g, rng) => drawFlash(g, rng, MX, MY, s.serg),
    },
    attack2: {
      pre: P({ legL: { dx: -1 }, legR: { dx: 1 }, pose: 'aim', gunLow: 1 }),
      post: (g, rng) => drawSmoke(g, rng, MX, MYL),
    },
    // Боль: отшатнулся вправо, рука к ране, брызги.
    pain0: { pre: P({ sway: 2, headDx: 1, mouth: 'open', legL: { dx: -1 }, legR: { dx: 1 }, pose: 'pain' }) },
    // Смерть: фонтан из груди → подкосились колени → опрокинулся → лёг → труп в луже.
    die0: { pre: P({ legL: { dx: -2 }, legR: { dx: 2 }, pose: 'thrown', mouth: 'open', headDx: -1, headDy: -1, burst: true }) },
    die1: { pre: P({ dy: 5, bentLegs: true, pose: 'thrown', mouth: 'open', headDx: 1, burst: true, drip: true }) },
    die2: { pre: (g, rng) => drawDie2(g, rng, s) },
    die3: { pre: (g, rng) => drawDie3(g, rng, s) },
    die4: { pre: (g, rng) => drawDie4(g, rng, s) },
  };
}

// ===== Экспорт (§4): единственная функция модуля =====
export function generateSprites() {
  const map = new Map();
  for (const s of [ZOMBIE, SERGEANT]) {
    const frames = buildFrames(s);
    for (const suffix of Object.keys(frames)) {
      const key = s.name + '_' + suffix;
      const cv = document.createElement('canvas');
      cv.width = SIZE;
      cv.height = SIZE;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      const rng = mulberry32(strSeed(key));
      frames[suffix].pre(g, rng);
      outlinePass(cv, s.outline);
      if (frames[suffix].post) frames[suffix].post(g, rng);
      polishTrooper(g, rng, s, suffix);
      map.set(key, cv);
    }
  }
  return map;
}
