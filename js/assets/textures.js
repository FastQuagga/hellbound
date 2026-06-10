// js/assets/textures.js — генератор текстур стен и полов/потолков [A1].
// Пиксель-арт по сетке (§4): только fillRect 1×1 через px(), без градиентов.
// Бесшовный тайлинг по обеим осям: вся отрисовка идёт через px() с заворачиванием
// координат, а все периодические элементы кратны размеру тайла.
// Случайность — только детерминированный mulberry32 с фиксированными сидами.

const T = 64; // размер тайла

// ---------------------------------------------------------------- PRNG

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- палитры (§4)

const MET = ['#1b1d22', '#2e3138', '#494e58', '#6d7380', '#99a0ad'];
const RUST = ['#3a2417', '#6b3a24', '#9c5a2e', '#c97f45'];
const BLOOD = ['#3d0a0a', '#6e1111', '#a51c1c', '#d23b1e', '#ff6b3d'];
const ACID = ['#15300f', '#2c5e1a', '#3aa32a', '#7ade3f'];
const SKIN = ['#5c4632', '#8a6b48', '#c8a06e', '#e8cfa0'];
const FIRE = ['#7a1f08', '#c44d12', '#f08a1d', '#ffd24a', '#fff6c9'];
const BLUE = ['#101c3a', '#1d3f7a', '#2f6fd0', '#6db2ff'];
const MARB = ['#1d241d', '#39443a', '#4f5b4e', '#6a786a', '#8a988a'];

// ---------------------------------------------------------------- хелперы

function makeTex(w = T, h = T) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d');
}

// Пиксель с заворачиванием координат — гарантия бесшовности.
// Кэш fillStyle (ctx._fs) ускоряет большие заливки (SKY1 — 1024×256).
function px(ctx, x, y, color) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  if (ctx._fs !== color) {
    ctx.fillStyle = color;
    ctx._fs = color;
  }
  ctx.fillRect(((x % w) + w) % w, ((y % h) + h) % h, 1, 1);
}

function fillAll(ctx, color) {
  ctx.fillStyle = color;
  ctx._fs = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function speckle(ctx, rng, color, count) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  for (let i = 0; i < count; i++) px(ctx, (rng() * w) | 0, (rng() * h) | 0, color);
}

function hline(ctx, x0, x1, y, color) {
  for (let x = x0; x <= x1; x++) px(ctx, x, y, color);
}

function vline(ctx, x, y0, y1, color) {
  for (let y = y0; y <= y1; y++) px(ctx, x, y, color);
}

// Шахматный дизеринг двух тонов.
function ditherRect(ctx, x0, y0, w, h, c0, c1) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      px(ctx, x, y, ((x + y) & 1) ? c1 : c0);
}

// Панель с фаской: light — верх/лево, dark — низ/право (поменять местами = углубление).
function bevel(ctx, x, y, w, h, base, light, dark) {
  if (base) for (let yy = y; yy < y + h; yy++) hline(ctx, x, x + w - 1, yy, base);
  hline(ctx, x, x + w - 2, y, light);
  vline(ctx, x, y, y + h - 2, light);
  hline(ctx, x + 1, x + w - 1, y + h - 1, dark);
  vline(ctx, x + w - 1, y + 1, y + h - 1, dark);
}

// Заклёпка 2×2: блик сверху-слева, тень снизу-справа.
function rivet(ctx, x, y, light = MET[4], mid = MET[3], dark = MET[1]) {
  px(ctx, x, y, light);
  px(ctx, x + 1, y, mid);
  px(ctx, x, y + 1, mid);
  px(ctx, x + 1, y + 1, dark);
}

// Кучное пятно из n пикселей вокруг центра.
function splat(ctx, rng, cx, cy, n, spread, color) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = rng() * spread;
    px(ctx, (cx + Math.cos(a) * d) | 0, (cy + Math.sin(a) * d) | 0, color);
  }
}

// Случайное блуждание — список точек (трещины, прожилки, вены).
function walkPath(rng, x, y, steps, turn, dirBias) {
  const pts = [];
  let a = dirBias !== undefined ? dirBias : rng() * Math.PI * 2;
  for (let i = 0; i < steps; i++) {
    pts.push([Math.round(x), Math.round(y)]);
    a += (rng() - 0.5) * turn;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  return pts;
}

function drawPath(ctx, pts, color) {
  for (let i = 0; i < pts.length; i++) px(ctx, pts[i][0], pts[i][1], color);
}

// Вертикальный потёк ржавчины: плотный у истока, редеет к хвосту.
function rustDrip(ctx, rng, x, y, len) {
  for (let i = 0; i < len; i++) {
    const fade = i / len;
    if (rng() < 1 - fade * 0.7) px(ctx, x, y + i, fade < 0.3 ? RUST[1] : RUST[0]);
    if (rng() < 0.3 - fade * 0.25) px(ctx, x + (rng() < 0.5 ? -1 : 1), y + i, RUST[0]);
  }
}

// Битмап-арт: rows — строки, map — символ→цвет ('.' и ' ' — пропуск).
function bitmap(ctx, x0, y0, rows, map) {
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const col = map[rows[r][c]];
      if (col) px(ctx, x0 + c, y0 + r, col);
    }
}

// ---------------------------------------------------------------- стены: техбаза

// TECH1 — серые техпанели 32×32 со сдвигом, заклёпки, царапины.
function texTECH1() {
  const ctx = makeTex();
  const rng = mulberry32(101);
  fillAll(ctx, MET[2]);
  speckle(ctx, rng, MET[1], 320);
  speckle(ctx, rng, MET[3], 230);
  for (let row = 0; row < 2; row++) {
    const y0 = row * 32, off = row * 16;
    hline(ctx, 0, 63, y0, MET[0]);          // горизонтальный шов
    hline(ctx, 0, 63, y0 + 1, MET[3]);      // блик под швом
    hline(ctx, 0, 63, y0 + 31, MET[1]);     // тень над следующим швом
    for (let i = 0; i < 2; i++) {
      const x0 = (i * 32 + off) % 64;
      vline(ctx, x0, y0 + 1, y0 + 31, MET[0]);
      vline(ctx, (x0 + 1) % 64, y0 + 2, y0 + 30, MET[3]);
      vline(ctx, (x0 + 31) % 64, y0 + 2, y0 + 30, MET[1]);
      // заклёпки по углам панели
      rivet(ctx, x0 + 4, y0 + 4);
      rivet(ctx, x0 + 26, y0 + 4);
      rivet(ctx, x0 + 4, y0 + 26);
      rivet(ctx, x0 + 26, y0 + 26);
      // вариация тона панели
      if (rng() < 0.5) splat(ctx, rng, x0 + 16, y0 + 16, 70, 11, rng() < 0.5 ? MET[1] : MET[3]);
    }
  }
  // царапины и мелкие пятна
  for (let i = 0; i < 7; i++) {
    const sx = (rng() * 64) | 0, sy = (rng() * 64) | 0, len = 3 + ((rng() * 6) | 0);
    hline(ctx, sx, sx + len, sy, MET[3]);
    if (rng() < 0.5) hline(ctx, sx + 1, sx + len, sy + 1, MET[1]);
  }
  for (let i = 0; i < 4; i++) splat(ctx, rng, rng() * 64, rng() * 64, 14, 3, MET[1]);
  rustDrip(ctx, rng, 12, 33, 9);
  rustDrip(ctx, rng, 44, 1, 7);
  return ctx.canvas;
}

// TECH2 — панель с вентрешёткой, кабелями и статусными лампами.
function texTECH2() {
  const ctx = makeTex();
  const rng = mulberry32(102);
  fillAll(ctx, MET[2]);
  speckle(ctx, rng, MET[1], 300);
  speckle(ctx, rng, MET[3], 200);
  // рамка панели (стыкуется при тайлинге)
  hline(ctx, 0, 63, 0, MET[0]);
  hline(ctx, 0, 63, 1, MET[3]);
  hline(ctx, 0, 63, 62, MET[1]);
  hline(ctx, 0, 63, 63, MET[0]);
  vline(ctx, 0, 1, 62, MET[0]);
  vline(ctx, 1, 2, 61, MET[3]);
  vline(ctx, 62, 2, 61, MET[1]);
  vline(ctx, 63, 1, 62, MET[0]);
  // кабель-канал слева: два серых кабеля
  for (const cx of [5, 8]) {
    vline(ctx, cx, 0, 63, MET[0]);
    vline(ctx, cx + 1, 0, 63, MET[1]);
    for (let y = 2; y < 64; y += 5) px(ctx, cx, y, MET[3]); // блики оплётки
  }
  // толстый силовой кабель справа (красная оплётка)
  vline(ctx, 55, 0, 63, MET[0]);
  vline(ctx, 56, 0, 63, BLOOD[1]);
  vline(ctx, 57, 0, 63, BLOOD[2]);
  vline(ctx, 58, 0, 63, MET[0]);
  for (let y = 3; y < 64; y += 6) px(ctx, 56, y, BLOOD[3]);
  // хомуты крепления кабелей (каждые 16px — кратно тайлу)
  for (let y = 6; y < 64; y += 16) {
    hline(ctx, 4, 10, y, MET[3]);
    hline(ctx, 4, 10, y + 1, MET[1]);
    hline(ctx, 54, 59, y, MET[3]);
    hline(ctx, 54, 59, y + 1, MET[1]);
  }
  // вентрешётка: утопленная ниша с жалюзи
  bevel(ctx, 16, 10, 32, 24, '#101216', MET[0], MET[3]);
  for (let y = 13; y < 32; y += 3) {
    hline(ctx, 18, 45, y, MET[2]);
    hline(ctx, 18, 45, y + 1, '#15171b');
  }
  rivet(ctx, 17, 11);
  rivet(ctx, 45, 11);
  rivet(ctx, 17, 31);
  rivet(ctx, 45, 31);
  // статусная панель снизу
  bevel(ctx, 22, 42, 20, 12, MET[1], MET[3], MET[0]);
  px(ctx, 26, 46, ACID[3]);
  px(ctx, 27, 46, ACID[3]);
  px(ctx, 26, 47, ACID[2]);
  px(ctx, 27, 47, ACID[1]);
  px(ctx, 33, 46, BLOOD[1]);
  px(ctx, 34, 46, BLOOD[1]);
  px(ctx, 33, 47, BLOOD[0]);
  px(ctx, 34, 47, BLOOD[0]);
  hline(ctx, 25, 38, 50, MET[0]); // шильдик
  hline(ctx, 25, 35, 51, MET[3]);
  // потёки от решётки
  rustDrip(ctx, rng, 19, 34, 12);
  rustDrip(ctx, rng, 41, 34, 8);
  for (let i = 0; i < 5; i++) {
    const sx = 12 + ((rng() * 40) | 0), sy = (rng() * 64) | 0;
    hline(ctx, sx, sx + 2 + ((rng() * 4) | 0), sy, MET[3]);
  }
  return ctx.canvas;
}

// COMP0/COMP1 — компьютерная стена: стойки, лампочки, бобины; 2 кадра (мигают огни).
const LAMP_PALS = [['#15300f', '#7ade3f'], ['#3d0a0a', '#ff6b3d'], ['#3a2417', '#ffd24a']];

function compLight(ctx, rng, x, y, frame) {
  const pal = LAMP_PALS[(rng() * 3) | 0];
  const phase = rng() < 0.5 ? 0 : 1;
  const always = rng() < 0.25;
  const on = always || (phase + frame) % 2 === 0;
  const c = on ? pal[1] : pal[0];
  px(ctx, x, y, c);
  px(ctx, x + 1, y, c);
  px(ctx, x, y + 1, c);
  px(ctx, x + 1, y + 1, on ? pal[0] : '#101216');
}

const REEL = [
  '..oooooo..',
  '.oBBBBBBo.',
  'oBBssssBBo',
  'oBsoooosBo',
  'oBsoBBosBo',
  'oBsoBBosBo',
  'oBsoooosBo',
  'oBBssssBBo',
  '.oBBBBBBo.',
  '..oooooo..',
];
const REEL_MAP = { o: '#101216', B: MET[3], s: MET[1] };

function texCOMP(frame) {
  const ctx = makeTex();
  const rng = mulberry32(103); // одинаковый сид для обоих кадров — мигают только лампы
  fillAll(ctx, MET[0]);
  speckle(ctx, rng, '#23262c', 250);
  for (let u = 0; u < 4; u++) {
    const y0 = u * 16;
    bevel(ctx, 0, y0, 64, 15, MET[1], MET[2], '#101216');
    hline(ctx, 0, 63, y0 + 15, '#0c0e11'); // зазор между юнитами
    rivet(ctx, 2, y0 + 2, MET[3], MET[2], MET[0]);
    rivet(ctx, 60, y0 + 2, MET[3], MET[2], MET[0]);
    rivet(ctx, 2, y0 + 11, MET[3], MET[2], MET[0]);
    rivet(ctx, 60, y0 + 11, MET[3], MET[2], MET[0]);
    if (u === 0 || u === 2) {
      // ряд индикаторов + вентпрорези + осциллограф
      for (let i = 0; i < 7; i++) compLight(ctx, rng, 6 + i * 5, y0 + 3, frame);
      for (let y = y0 + 8; y <= y0 + 12; y += 2) {
        hline(ctx, 6, 36, y, '#101216');
        hline(ctx, 6, 36, y + 1, MET[2]);
      }
      bevel(ctx, 42, y0 + 3, 17, 10, '#0a140a', '#101216', MET[2]);
      let wy = y0 + 8;
      for (let x = 44; x <= 56; x++) {
        px(ctx, x, wy, ACID[3]);
        if (rng() < 0.3) px(ctx, x, wy + (rng() < 0.5 ? -1 : 1), ACID[1]);
        wy += rng() < 0.5 ? -1 : 1;
        if (wy < y0 + 5) wy = y0 + 5;
        if (wy > y0 + 11) wy = y0 + 11;
      }
    } else if (u === 1) {
      // юнит с бобинами магнитной ленты
      bitmap(ctx, 6, y0 + 2, REEL, REEL_MAP);
      bitmap(ctx, 22, y0 + 2, REEL, REEL_MAP);
      px(ctx, 8, y0 + 3, MET[4]); // блик на бобине
      px(ctx, 24, y0 + 3, MET[4]);
      // тумблеры
      for (let i = 0; i < 6; i++) {
        const sx = 38 + i * 4, up = rng() < 0.5;
        px(ctx, sx, y0 + 4, up ? MET[4] : MET[1]);
        px(ctx, sx, y0 + 5, MET[2]);
        px(ctx, sx, y0 + 6, up ? MET[1] : MET[4]);
      }
      for (let i = 0; i < 5; i++) compLight(ctx, rng, 38 + i * 5, y0 + 10, frame);
    } else {
      // юнит: перфорированная решётка + «штрих-код» + крупные лампы
      for (let y = y0 + 3; y <= y0 + 11; y += 2)
        for (let x = 5; x <= 22; x += 2) px(ctx, x, y, '#101216');
      for (let x = 27; x <= 42; x++)
        if (rng() < 0.6) vline(ctx, x, y0 + 4, y0 + 10, rng() < 0.5 ? MET[3] : '#15171b');
      for (let i = 0; i < 3; i++) compLight(ctx, rng, 48 + i * 5, y0 + 6, frame);
    }
  }
  return ctx.canvas;
}

// METAL — тёмный металл, горизонтальные балки, болты, потёки ржавчины.
function texMETAL() {
  const ctx = makeTex();
  const rng = mulberry32(104);
  fillAll(ctx, MET[1]);
  speckle(ctx, rng, MET[0], 380);
  speckle(ctx, rng, MET[2], 260);
  // вертикальные стыки листов
  for (const x of [0, 21, 42]) {
    vline(ctx, x, 0, 63, '#15171b');
    vline(ctx, x + 1, 0, 63, MET[2]);
  }
  // две балки с болтами
  for (const y0 of [6, 38]) {
    for (let y = y0; y < y0 + 8; y++) hline(ctx, 0, 63, y, MET[2]);
    hline(ctx, 0, 63, y0, MET[3]);
    hline(ctx, 0, 63, y0 + 1, MET[4]);
    hline(ctx, 0, 63, y0 + 7, MET[0]);
    hline(ctx, 0, 63, y0 + 8, '#15171b'); // отбрасываемая тень
    for (let x = 4; x < 64; x += 8) {
      rivet(ctx, x, y0 + 3);
      if (rng() < 0.55) rustDrip(ctx, rng, x + 1, y0 + 8, 6 + ((rng() * 14) | 0));
    }
  }
  // пятна ржавчины и царапины
  for (let i = 0; i < 5; i++) splat(ctx, rng, rng() * 64, rng() * 64, 22, 4, RUST[0]);
  for (let i = 0; i < 3; i++) splat(ctx, rng, rng() * 64, rng() * 64, 10, 3, RUST[1]);
  for (let i = 0; i < 6; i++) {
    const sx = (rng() * 64) | 0, sy = (rng() * 64) | 0;
    hline(ctx, sx, sx + 2 + ((rng() * 5) | 0), sy, MET[3]);
  }
  return ctx.canvas;
}

// SUPPORT — опора/рамка двери: вертикальные рёбра, пояса, болты.
function texSUPPORT() {
  const ctx = makeTex();
  const rng = mulberry32(105);
  fillAll(ctx, MET[1]);
  speckle(ctx, rng, MET[0], 300);
  speckle(ctx, rng, MET[2], 180);
  // тёмные каналы между рёбрами
  for (let i = 0; i < 4; i++) {
    vline(ctx, i * 16, 0, 63, '#101216');
    vline(ctx, i * 16 + 1, 0, 63, '#15171b');
    vline(ctx, i * 16 + 15, 0, 63, '#15171b');
  }
  // рёбра
  for (let i = 0; i < 4; i++) {
    const x0 = i * 16 + 2;
    for (let x = x0; x < x0 + 12; x++) vline(ctx, x, 0, 63, MET[2]);
    vline(ctx, x0, 0, 63, MET[3]);
    vline(ctx, x0 + 1, 0, 63, MET[4]);
    vline(ctx, x0 + 10, 0, 63, MET[1]);
    vline(ctx, x0 + 11, 0, 63, MET[0]);
    // болты со сдвигом фазы на каждом ребре
    for (let k = 0; k < 4; k++) rivet(ctx, x0 + 5, (6 + i * 4 + k * 16) % 64);
    if (rng() < 0.6) rustDrip(ctx, rng, x0 + 6, (10 + i * 16) % 64, 7 + ((rng() * 8) | 0));
  }
  // горизонтальные пояса: на стыке тайла и в середине
  for (const y0 of [62, 30]) {
    for (let dy = 0; dy < 4; dy++) hline(ctx, 0, 63, (y0 + dy) % 64, MET[2]);
    hline(ctx, 0, 63, y0 % 64, MET[3]);
    hline(ctx, 0, 63, (y0 + 1) % 64, MET[4]);
    hline(ctx, 0, 63, (y0 + 3) % 64, MET[0]);
    for (let x = 6; x < 64; x += 12) rivet(ctx, x, (y0 + 1) % 64);
  }
  return ctx.canvas;
}

// CRATE — штабель ящиков 2×2 (дерево + металлические уголки).
function drawCrate(ctx, rng, x0, y0) {
  const woods = ['#9c5a2e', '#8a4c27', '#7d4526'];
  // доски
  for (let p = 0; p < 4; p++) {
    const y = y0 + p * 8;
    const base = woods[(rng() * 3) | 0];
    for (let yy = y; yy < y + 8; yy++) hline(ctx, x0, x0 + 31, yy, base);
    hline(ctx, x0, x0 + 31, y, '#b06a36');     // освещённая кромка доски
    hline(ctx, x0, x0 + 31, y + 7, RUST[0]);   // щель
    // волокна
    for (let g = 0; g < 9; g++) {
      const gx = x0 + ((rng() * 28) | 0), gy = y + 1 + ((rng() * 6) | 0);
      hline(ctx, gx, gx + 2 + ((rng() * 4) | 0), gy, rng() < 0.5 ? RUST[1] : RUST[0]);
    }
    // сучок
    if (rng() < 0.3) {
      const kx = x0 + 4 + ((rng() * 24) | 0), ky = y + 3;
      px(ctx, kx, ky, RUST[0]);
      px(ctx, kx + 1, ky, RUST[0]);
      px(ctx, kx, ky + 1, RUST[1]);
    }
  }
  // обвязка-рама
  bevel(ctx, x0, y0, 32, 32, null, RUST[3], RUST[0]);
  bevel(ctx, x0 + 1, y0 + 1, 30, 30, null, '#b06a36', RUST[1]);
  // металлические уголки с заклёпками
  for (const [cx, cy, dx, dy] of [[x0 + 1, y0 + 1, 1, 1], [x0 + 30, y0 + 1, -1, 1], [x0 + 1, y0 + 30, 1, -1], [x0 + 30, y0 + 30, -1, -1]]) {
    for (let i = 0; i < 8; i++) {
      px(ctx, cx + dx * i, cy, MET[2]);
      px(ctx, cx + dx * i, cy + dy, MET[1]);
      px(ctx, cx, cy + dy * i, MET[2]);
      px(ctx, cx + dx, cy + dy * i, MET[1]);
    }
    px(ctx, cx, cy, MET[3]);
    rivet(ctx, cx + dx * 2, cy + dy * 2);
  }
  // трафаретное клеймо
  if (rng() < 0.5) {
    const mx = x0 + 12, my = y0 + 13;
    hline(ctx, mx, mx + 6, my, MET[0]);
    hline(ctx, mx, mx + 6, my + 4, MET[0]);
    vline(ctx, mx, my, my + 4, MET[0]);
    vline(ctx, mx + 6, my, my + 4, MET[0]);
    px(ctx, mx + 3, my + 2, MET[0]);
  }
}

function texCRATE() {
  const ctx = makeTex();
  const rng = mulberry32(106);
  for (let cy = 0; cy < 2; cy++)
    for (let cx = 0; cx < 2; cx++) drawCrate(ctx, rng, cx * 32, cy * 32);
  return ctx.canvas;
}

// STONE — серая грубая каменная кладка, перевязка рядов.
function texSTONE() {
  const ctx = makeTex();
  const rng = mulberry32(107);
  fillAll(ctx, MET[2]);
  speckle(ctx, rng, '#3d424b', 420);
  speckle(ctx, rng, '#5a606b', 320);
  for (let r = 0; r < 4; r++) {
    const y0 = r * 16, off = (r % 2) * 8;
    hline(ctx, 0, 63, y0, '#23262c'); // растворный шов
    for (let x = 0; x < 64; x++) if (rng() < 0.35) px(ctx, x, y0 + 1, '#23262c'); // неровность шва
    for (let i = 0; i < 4; i++) {
      const jx = (i * 16 + off) % 64;
      vline(ctx, jx, y0 + 1, y0 + 15, '#23262c');
      vline(ctx, (jx + 1) % 64, y0 + 2, y0 + 14, '#3d424b');
      // тонировка и фактура блока
      const tone = rng();
      if (tone < 0.33) splat(ctx, rng, jx + 8, y0 + 8, 50, 7, '#3d424b');
      else if (tone < 0.55) splat(ctx, rng, jx + 8, y0 + 8, 45, 7, '#5a606b');
      for (let x = jx + 2; x < jx + 15; x++) if (rng() < 0.55) px(ctx, x, y0 + 2, '#7c828e'); // свет сверху
      hline(ctx, jx + 2, jx + 14, y0 + 15, '#33373e'); // тень снизу
      for (let p = 0; p < 3; p++) px(ctx, jx + 2 + ((rng() * 12) | 0), y0 + 3 + ((rng() * 11) | 0), '#2a2d33'); // каверны
      if (rng() < 0.25) drawPath(ctx, walkPath(rng, jx + 8, y0 + 4, 7, 1.4), '#2a2d33'); // скол
    }
  }
  return ctx.canvas;
}

// BRICKRED — адская тёмно-красная кладка с трещинами и копотью.
function texBRICKRED() {
  const ctx = makeTex();
  const rng = mulberry32(108);
  fillAll(ctx, '#200606'); // раствор
  for (let r = 0; r < 8; r++) {
    const y0 = r * 8, off = (r % 2) * 8;
    for (let i = 0; i < 4; i++) {
      const x0 = (i * 16 + off) % 64;
      const base = ['#561010', '#6e1111', '#7e1414'][(rng() * 3) | 0];
      for (let y = y0 + 1; y < y0 + 8; y++) hline(ctx, x0 + 1, x0 + 15, y, base);
      for (let x = x0 + 1; x <= x0 + 15; x++) if (rng() < 0.5) px(ctx, x, y0 + 1, '#8a2020'); // свет
      hline(ctx, x0 + 1, x0 + 15, y0 + 7, BLOOD[0]); // тень
      for (let p = 0; p < 7; p++) px(ctx, x0 + 1 + ((rng() * 15) | 0), y0 + 2 + ((rng() * 5) | 0), rng() < 0.6 ? '#481010' : BLOOD[2]);
    }
  }
  // сквозные трещины
  for (let i = 0; i < 3; i++) {
    const p = walkPath(rng, rng() * 64, rng() * 64, 20, 1.2);
    drawPath(ctx, p, '#1a0404');
    for (const [x, y] of p) if (rng() < 0.3) px(ctx, x + 1, y, '#1a0404');
  }
  // копоть
  splat(ctx, rng, 14, 50, 40, 6, '#1a0404');
  splat(ctx, rng, 47, 18, 30, 5, '#1a0404');
  return ctx.canvas;
}

// MARBLE — зелёно-серый мрамор с прожилками и барельефом-черепом.
const SKULL = [
  '...o..............o...',
  '..obo............obo..',
  '..obbo..........obbo..',
  '...obbo.oooooo.obbo...',
  '....obboobbbboobbo....',
  '.....obbbBBBBbbbo.....',
  '....obBBBBBBBBBBbo....',
  '...obBBBBBBBBBBBBbo...',
  '...obBBBBBBBBBBBBso...',
  '...obBBBBBBBBBBBBso...',
  '...obbBBBBBBBBBBsso...',
  '...osbeeeoBBoeeebso...',
  '...oseeeeeBBeeeeeso...',
  '...osereeoBBoeereso...',
  '...osbeeebBBbeeebso...',
  '....osbbbbBBbbbbso....',
  '....osbbbonnobbbso....',
  '.....osbbnnnnbbso.....',
  '.....osbbonnobbso.....',
  '.....osbbbbbbbbso.....',
  '.....obtotototbso.....',
  '.....obtotototbso.....',
  '......oooooooooo......',
];
const SKULL_MAP = {
  o: MARB[0], s: MARB[1], b: MARB[3], B: MARB[4],
  e: '#0e130e', n: '#0e130e', r: BLOOD[2], t: MARB[4],
};

function texMARBLE() {
  const ctx = makeTex();
  const rng = mulberry32(109);
  fillAll(ctx, MARB[2]);
  speckle(ctx, rng, MARB[1], 520);
  speckle(ctx, rng, MARB[3], 400);
  speckle(ctx, rng, MARB[4], 90);
  // светлые прожилки с бликом
  for (let i = 0; i < 5; i++) {
    const p = walkPath(rng, rng() * 64, rng() * 64, 40, 0.9);
    drawPath(ctx, p, MARB[3]);
    for (const [x, y] of p) if (rng() < 0.4) px(ctx, x, y + 1, MARB[4]);
  }
  // тёмные прожилки
  for (let i = 0; i < 3; i++) drawPath(ctx, walkPath(rng, rng() * 64, rng() * 64, 30, 1.1), MARB[1]);
  // тень-углубление под барельеф и сам череп
  splat(ctx, rng, 32, 30, 160, 14, MARB[1]);
  bitmap(ctx, 21, 17, SKULL, SKULL_MAP);
  px(ctx, 27, 22, '#a8b6a8'); // блик на лбу
  px(ctx, 28, 22, '#a8b6a8');
  return ctx.canvas;
}

// FLESH — стена из плоти: мясная фактура, вены, нарывы.
function texFLESH() {
  const ctx = makeTex();
  const rng = mulberry32(110);
  fillAll(ctx, BLOOD[1]);
  for (let i = 0; i < 26; i++)
    splat(ctx, rng, rng() * 64, rng() * 64, 26, 5, rng() < 0.5 ? BLOOD[2] : '#5a0e0e');
  speckle(ctx, rng, BLOOD[0], 240);
  speckle(ctx, rng, '#c2422a', 110);
  // вены — тёмные ветвящиеся
  for (let i = 0; i < 7; i++) {
    const p = walkPath(rng, rng() * 64, rng() * 64, 34, 0.8);
    drawPath(ctx, p, BLOOD[0]);
    for (const [x, y] of p) if (rng() < 0.35) px(ctx, x + 1, y, '#2a0606');
    if (rng() < 0.6 && p.length > 12) drawPath(ctx, walkPath(rng, p[12][0], p[12][1], 12, 1.0), '#2a0606'); // ответвление
  }
  // нарывы с гнойной головкой и бликом
  for (let i = 0; i < 8; i++) {
    const bx = 3 + ((rng() * 58) | 0), by = 3 + ((rng() * 58) | 0), r = 2 + ((rng() * 2) | 0);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;
        px(ctx, bx + dx, by + dy, d2 > (r - 1) * (r - 1) ? BLOOD[0] : BLOOD[3]);
      }
    px(ctx, bx - 1, by - 1, BLOOD[4]);
    if (r > 2) px(ctx, bx, by, SKIN[2]);
  }
  return ctx.canvas;
}

// ---------------------------------------------------------------- двери

// Общая основа двери: тёмная стальная плита, шов посередине, утопленные панели.
function doorBase(rng) {
  const ctx = makeTex();
  fillAll(ctx, MET[1]);
  speckle(ctx, rng, MET[0], 280);
  speckle(ctx, rng, MET[2], 200);
  // внешняя рамка полотна
  bevel(ctx, 0, 0, 64, 64, null, MET[3], '#101216');
  bevel(ctx, 1, 1, 62, 62, null, MET[2], MET[0]);
  // центральный шов (две створки)
  vline(ctx, 31, 2, 61, '#0c0e11');
  vline(ctx, 32, 2, 61, '#0c0e11');
  vline(ctx, 30, 2, 61, MET[0]);
  vline(ctx, 33, 2, 61, MET[2]);
  // утопленные панели на каждой створке
  for (const x0 of [6, 38]) {
    bevel(ctx, x0, 8, 20, 22, null, MET[0], MET[3]);
    bevel(ctx, x0, 36, 20, 20, null, MET[0], MET[3]);
    ditherRect(ctx, x0 + 1, 9, 18, 20, MET[1], '#262930');
    ditherRect(ctx, x0 + 1, 37, 18, 18, MET[1], '#262930');
  }
  // заклёпки по рамке
  for (const y of [4, 20, 42, 58]) {
    rivet(ctx, 3, y);
    rivet(ctx, 59, y);
  }
  rivet(ctx, 27, 4);
  rivet(ctx, 35, 4);
  rivet(ctx, 27, 58);
  rivet(ctx, 35, 58);
  // потёртости и потёки
  for (let i = 0; i < 5; i++) {
    const sx = 4 + ((rng() * 56) | 0), sy = 3 + ((rng() * 58) | 0);
    hline(ctx, sx, sx + 2 + ((rng() * 4) | 0), sy, MET[3]);
  }
  rustDrip(ctx, rng, 9 + ((rng() * 14) | 0), 31, 8 + ((rng() * 8) | 0));
  rustDrip(ctx, rng, 41 + ((rng() * 14) | 0), 31, 6 + ((rng() * 8) | 0));
  return ctx;
}

// DOOR1 — техническая дверь: косые жёлто-чёрные полосы «ОПАСНО» поверху и понизу.
function texDOOR1() {
  const rng = mulberry32(111);
  const ctx = doorBase(rng);
  const YEL = '#c8a022', YELD = '#7a5f10';
  for (const y0 of [10, 38]) {
    for (let y = 0; y < 8; y++)
      for (let x = 7; x <= 24; x++) {
        const s = ((x + y) >> 2) & 1;
        px(ctx, x, y0 + y, s ? '#15171b' : ((x + y) & 1 ? YEL : YELD));
        px(ctx, x + 32, y0 + y, s ? '#15171b' : ((x + y) & 1 ? YEL : YELD));
      }
    hline(ctx, 7, 24, y0 - 1, MET[0]);
    hline(ctx, 7, 24, y0 + 8, MET[0]);
    hline(ctx, 39, 56, y0 - 1, MET[0]);
    hline(ctx, 39, 56, y0 + 8, MET[0]);
  }
  // табличка с «надписью»-пиктограммой между полосами
  bevel(ctx, 12, 24, 12, 7, MET[2], MET[3], MET[0]);
  hline(ctx, 14, 21, 26, MET[0]);
  hline(ctx, 14, 19, 28, MET[0]);
  bevel(ctx, 40, 24, 12, 7, MET[2], MET[3], MET[0]);
  hline(ctx, 42, 49, 26, MET[0]);
  hline(ctx, 42, 47, 28, MET[0]);
  return ctx.canvas;
}

// Дверь с цветными сигнальными лампами/полосами (ключевые двери).
// pal: [тёмный, средний, яркий, блик]
function texDOORKEY(seed, pal) {
  const rng = mulberry32(seed);
  const ctx = doorBase(rng);
  // вертикальные сигнальные полосы вдоль шва
  for (const x of [27, 35]) {
    vline(ctx, x, 6, 57, pal[1]);
    vline(ctx, x + (x < 32 ? 1 : -1), 6, 57, pal[0]);
    for (let y = 8; y < 58; y += 6) px(ctx, x, y, pal[2]); // блики
  }
  // лампы 4×4 в углублениях по обеим створкам
  for (const lx of [10, 48]) {
    for (const ly of [12, 26, 44]) {
      bevel(ctx, lx - 1, ly - 1, 6, 6, null, MET[0], MET[3]);
      px(ctx, lx, ly, pal[3]);
      px(ctx, lx + 1, ly, pal[2]);
      px(ctx, lx + 2, ly, pal[2]);
      px(ctx, lx + 3, ly, pal[1]);
      for (let dy = 1; dy < 3; dy++) {
        px(ctx, lx, ly + dy, pal[2]);
        px(ctx, lx + 1, ly + dy, dy === 1 ? pal[3] : pal[2]);
        px(ctx, lx + 2, ly + dy, pal[1]);
        px(ctx, lx + 3, ly + dy, pal[0]);
      }
      px(ctx, lx, ly + 3, pal[1]);
      px(ctx, lx + 1, ly + 3, pal[1]);
      px(ctx, lx + 2, ly + 3, pal[0]);
      px(ctx, lx + 3, ly + 3, pal[0]);
      // ореол свечения дизерингом
      for (let dx = -2; dx <= 5; dx++) {
        if ((dx + ly) & 1) continue;
        px(ctx, lx + dx, ly - 2, pal[0]);
        px(ctx, lx + dx, ly + 5, pal[0]);
      }
    }
  }
  // горизонтальная полоса-кодировка по центру
  for (let x = 6; x <= 25; x++) px(ctx, x, 33, (x & 3) === 0 ? pal[2] : pal[0]);
  for (let x = 38; x <= 57; x++) px(ctx, x, 33, (x & 3) === 0 ? pal[2] : pal[0]);
  return ctx.canvas;
}

// ---------------------------------------------------------------- рубильник выхода

// Пиктограмма EXIT (бегущий человечек к двери) — общая для OFF/ON.
const EXIT_GLYPH = [
  'EEE.X.X.III.TTT',
  'E....X...I...T.',
  'EE..X.X..I...T.',
  'E..X...X.I...T.',
  'EEEX...XIII..T.',
];

// SWEXIT — стена-рубильник: панель METAL, рамка, табло EXIT, рычаг.
function texSWEXIT(on) {
  const ctx = makeTex();
  const rng = mulberry32(115); // одинаковый сид: OFF/ON отличаются только рычагом и лампой
  fillAll(ctx, MET[1]);
  speckle(ctx, rng, MET[0], 300);
  speckle(ctx, rng, MET[2], 190);
  // стеновые листы с болтами (фон)
  for (const y of [0, 63]) hline(ctx, 0, 63, y, '#15171b');
  for (const x of [0, 63]) vline(ctx, x, 0, 63, '#15171b');
  for (const [bx, by] of [[4, 4], [59, 4], [4, 58], [59, 58]]) rivet(ctx, bx, by);
  rustDrip(ctx, rng, 6, 12, 10);
  rustDrip(ctx, rng, 58, 40, 9);
  // табло EXIT сверху: углубление + светящиеся буквы
  bevel(ctx, 14, 5, 36, 12, '#101216', MET[0], MET[3]);
  const lit = on ? FIRE[3] : ACID[2];
  const dim = on ? FIRE[1] : ACID[0];
  bitmap(ctx, 17, 8, EXIT_GLYPH, { E: lit, X: lit, I: lit, T: lit });
  for (let x = 16; x <= 47; x++) if ((x & 1) === 0) px(ctx, x, 15, dim); // подсветка снизу
  // корпус рубильника
  bevel(ctx, 18, 22, 28, 36, MET[2], MET[3], MET[0]);
  bevel(ctx, 20, 24, 24, 32, MET[1], MET[0], MET[3]);
  rivet(ctx, 19, 23);
  rivet(ctx, 43, 23);
  rivet(ctx, 19, 55);
  rivet(ctx, 43, 55);
  // прорезь хода рычага
  vline(ctx, 31, 27, 51, '#0c0e11');
  vline(ctx, 32, 27, 51, '#0c0e11');
  vline(ctx, 30, 27, 51, MET[0]);
  vline(ctx, 33, 27, 51, MET[2]);
  // метки ВВЕРХ/ВНИЗ возле прорези
  hline(ctx, 26, 28, 28, MET[3]);
  hline(ctx, 35, 37, 50, MET[3]);
  // рычаг: ось + штанга + красная рукоять
  const handleY = on ? 48 : 30; // ON — рычаг внизу
  for (let y = Math.min(39, handleY); y <= Math.max(39, handleY); y++) {
    px(ctx, 31, y, MET[3]);
    px(ctx, 32, y, MET[2]);
  }
  px(ctx, 31, 39, MET[4]); // ось
  px(ctx, 32, 39, MET[1]);
  // рукоять 6×4
  for (let dx = -2; dx <= 3; dx++) {
    px(ctx, 31 + dx, handleY - 1, BLOOD[3]);
    px(ctx, 31 + dx, handleY, BLOOD[2]);
    px(ctx, 31 + dx, handleY + 1, BLOOD[1]);
    px(ctx, 31 + dx, handleY + 2, BLOOD[0]);
  }
  px(ctx, 29, handleY - 1, BLOOD[4]); // блик
  px(ctx, 30, handleY - 1, BLOOD[4]);
  // индикаторная лампа под прорезью
  const lampC = on ? ACID[3] : BLOOD[1];
  bevel(ctx, 28, 53, 8, 4, null, MET[0], MET[3]);
  for (let dx = 0; dx < 6; dx++) px(ctx, 29 + dx, 54, dx === 0 ? (on ? ACID[2] : BLOOD[0]) : lampC);
  for (let dx = 0; dx < 6; dx++) px(ctx, 29 + dx, 55, on ? ACID[1] : BLOOD[0]);
  if (on) { // ореол горящей лампы
    for (let dx = -2; dx <= 7; dx += 2) px(ctx, 29 + dx, 52, ACID[1]);
    for (let dx = -1; dx <= 8; dx += 2) px(ctx, 29 + dx, 57, ACID[0]);
  }
  // жёлто-чёрная окантовка опасности по низу панели
  for (let x = 12; x <= 51; x++) {
    const s = ((x + 60) >> 1) & 1;
    px(ctx, x, 60, s ? '#15171b' : '#c8a022');
    px(ctx, x, 61, s ? '#15171b' : '#7a5f10');
  }
  return ctx.canvas;
}

// ---------------------------------------------------------------- небо SKY1

// SKY1 — панорама 1024×256: багровое небо, горы ада, дальние огни.
// Бесшовность по X: все формы периодичны по 1024 (синусы кратных частот, координаты mod 1024).
function texSKY1() {
  const W = 1024, H = 256;
  const ctx = makeTex(W, H);
  const rng = mulberry32(116);
  // небо: ступенчатые полосы с дизерингом на границах (без градиентов)
  const BANDS = ['#0a0a0d', '#140a10', '#1f0c12', '#2c0e13', '#3a1013', '#4b1412', '#5e1a10', '#73230e'];
  const bandH = 22;
  for (let i = 0; i < BANDS.length; i++) {
    const y0 = i * bandH;
    ctx.fillStyle = BANDS[i];
    ctx._fs = BANDS[i];
    ctx.fillRect(0, y0, W, i === BANDS.length - 1 ? H - y0 : bandH);
  }
  for (let i = 1; i < BANDS.length; i++) { // дизер-граница полос
    const y0 = i * bandH;
    for (let x = 0; x < W; x++) {
      if ((x + y0) & 1) px(ctx, x, y0 - 1, BANDS[i]);
      if ((x ^ y0) & 1) px(ctx, x, y0, BANDS[i - 1]);
    }
  }
  // звёзды в тёмной верхней трети
  for (let i = 0; i < 90; i++) {
    const x = (rng() * W) | 0, y = (rng() * 70) | 0;
    px(ctx, x, y, rng() < 0.3 ? '#6d7380' : '#494e58');
  }
  // рваные тучи (тёмные горизонтальные мазки)
  for (let i = 0; i < 40; i++) {
    const cx = rng() * W, cy = 30 + rng() * 90, len = 14 + rng() * 40;
    for (let d = 0; d < len; d++) {
      const x = (cx + d) % W, y = cy + Math.sin(d * 0.3 + i) * 2;
      if (rng() < 0.75) px(ctx, x | 0, y | 0, '#1a0b10');
      if (rng() < 0.3) px(ctx, x | 0, (y + 1) | 0, '#241016');
    }
  }
  // периодические функции хребтов (k — целые гармоники => бесшовно по X)
  const ridge = (x, base, a1, k1, p1, a2, k2, p2) =>
    base + a1 * Math.sin((x / W) * Math.PI * 2 * k1 + p1) + a2 * Math.sin((x / W) * Math.PI * 2 * k2 + p2);
  // дальний хребет
  for (let x = 0; x < W; x++) {
    const top = ridge(x, 168, 14, 3, 0.7, 7, 9, 2.1) + (rng() - 0.5) * 3;
    for (let y = top | 0; y < H; y++) px(ctx, x, y, '#2a0d12');
    px(ctx, x, (top | 0) - 1, '#3a1013');
  }
  // дальние огни на склонах
  for (let i = 0; i < 60; i++) {
    const x = (rng() * W) | 0, y = 185 + ((rng() * 60) | 0);
    px(ctx, x, y, rng() < 0.4 ? FIRE[2] : FIRE[1]);
    if (rng() < 0.25) px(ctx, x + 1, y, FIRE[0]);
  }
  // ближний хребет — чёрные зубцы
  for (let x = 0; x < W; x++) {
    const top = ridge(x, 210, 16, 5, 1.9, 9, 13, 4.4) + (rng() - 0.5) * 4;
    for (let y = top | 0; y < H; y++) px(ctx, x, y, '#0d0508');
    px(ctx, x, (top | 0) - 1, '#1a0b10');
    // огненная кромка лавы за хребтом местами
    if (rng() < 0.12) px(ctx, x, (top | 0), FIRE[0]);
  }
  // жерла вулканов на ближнем хребте (периодические позиции)
  for (let i = 0; i < 6; i++) {
    const vx = ((i * 171 + 60) % W);
    const vy = (ridge(vx, 210, 16, 5, 1.9, 9, 13, 4.4) | 0) + 2;
    for (let d = -2; d <= 2; d++) px(ctx, (vx + d + W) % W, vy, FIRE[1]);
    for (let d = -1; d <= 1; d++) px(ctx, (vx + d + W) % W, vy - 1, FIRE[2]);
    px(ctx, vx, vy - 2, FIRE[3]);
    // столб искр
    for (let s = 0; s < 7; s++) {
      const sx = (vx + ((rng() - 0.5) * 8) + W) % W, sy = vy - 3 - rng() * 14;
      px(ctx, sx | 0, sy | 0, rng() < 0.5 ? FIRE[2] : FIRE[1]);
    }
  }
  return ctx.canvas;
}

// ---------------------------------------------------------------- полы

// FLOOR_TECH — металлические плиты 32×32 с болтами и рифлением.
function texFLOOR_TECH() {
  const ctx = makeTex();
  const rng = mulberry32(201);
  fillAll(ctx, MET[2]);
  speckle(ctx, rng, MET[1], 340);
  speckle(ctx, rng, MET[3], 240);
  for (let py = 0; py < 2; py++)
    for (let pxi = 0; pxi < 2; pxi++) {
      const x0 = pxi * 32, y0 = py * 32;
      hline(ctx, x0, x0 + 31, y0, MET[0]);
      vline(ctx, x0, y0, y0 + 31, MET[0]);
      hline(ctx, x0 + 1, x0 + 31, y0 + 1, MET[3]); // свет вдоль шва
      vline(ctx, x0 + 1, y0 + 1, y0 + 31, MET[3]);
      hline(ctx, x0 + 1, x0 + 31, y0 + 31, MET[1]);
      vline(ctx, x0 + 31, y0 + 1, y0 + 31, MET[1]);
      rivet(ctx, x0 + 4, y0 + 4);
      rivet(ctx, x0 + 26, y0 + 4);
      rivet(ctx, x0 + 4, y0 + 26);
      rivet(ctx, x0 + 26, y0 + 26);
      // диагональное рифление противоскольжения
      for (let d = 8; d < 56; d += 8)
        for (let t = 0; t < 5; t++) {
          const rx = x0 + 6 + ((d + t) % 22), ry = y0 + 8 + t + ((d * 7) % 14);
          if (rx < x0 + 30 && ry < y0 + 30) {
            px(ctx, rx, ry, MET[3]);
            px(ctx, rx + 1, ry + 1, MET[1]);
          }
        }
      if (rng() < 0.5) splat(ctx, rng, x0 + 16, y0 + 16, 40, 10, MET[1]); // потёртость
    }
  for (let i = 0; i < 4; i++) splat(ctx, rng, rng() * 64, rng() * 64, 12, 3, RUST[0]);
  return ctx.canvas;
}

// FLOOR_HEX — шестигранная сетка-настил над тёмной пустотой.
function texFLOOR_HEX() {
  const ctx = makeTex();
  const rng = mulberry32(202);
  fillAll(ctx, '#101216'); // провал под решёткой
  speckle(ctx, rng, '#15171b', 200);
  // шестигранники: период 16×16 (ячейка со сдвигом) — кратно 64
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 4; gx++) {
      const cx = gx * 16 + (gy % 2) * 8, cy = gy * 16;
      // контур шестигранника: прутья 2px, свет сверху-слева
      for (let d = 0; d < 5; d++) {
        px(ctx, cx + 5 + d, cy + 2, MET[4]); // верх — блик
        px(ctx, cx + 5 + d, cy + 3, MET[3]);
        px(ctx, cx + 5 + d, cy + 12, MET[2]); // низ — в тени
        px(ctx, cx + 5 + d, cy + 13, MET[1]);
      }
      for (let d = 0; d < 4; d++) {
        px(ctx, cx + 4 - d, cy + 3 + d, MET[4]); // лев-верх
        px(ctx, cx + 4 - d, cy + 4 + d, MET[3]);
        px(ctx, cx + 10 + d, cy + 3 + d, MET[3]); // прав-верх
        px(ctx, cx + 10 + d, cy + 4 + d, MET[2]);
        px(ctx, cx + 1 + d, cy + 8 + d, MET[3]); // лев-низ
        px(ctx, cx + 2 + d, cy + 8 + d, MET[2]);
        px(ctx, cx + 13 - d, cy + 8 + d, MET[2]); // прав-низ
        px(ctx, cx + 12 - d, cy + 8 + d, MET[1]);
      }
      px(ctx, cx, cy + 7, MET[4]); // левый узел
      px(ctx, cx + 1, cy + 7, MET[3]);
      px(ctx, cx + 14, cy + 7, MET[2]); // правый узел
      px(ctx, cx + 13, cy + 7, MET[2]);
      // поперечная распорка внутри ячейки
      hline(ctx, cx + 5, cx + 9, cy + 7, MET[2]);
      hline(ctx, cx + 5, cx + 9, cy + 8, MET[1]);
      // точка сварки в центре
      if (rng() < 0.6) px(ctx, cx + 7, cy + 7, MET[3]);
      if (rng() < 0.2) splat(ctx, rng, cx + 7, cy + 7, 5, 3, RUST[1]); // ржавая ячейка
    }
  return ctx.canvas;
}

// FLOOR_GRAY — бетон с пятнами, швами деформации и сколами.
function texFLOOR_GRAY() {
  const ctx = makeTex();
  const rng = mulberry32(203);
  fillAll(ctx, '#52565e');
  speckle(ctx, rng, '#43474e', 540);
  speckle(ctx, rng, '#62666f', 420);
  speckle(ctx, rng, '#383b41', 180);
  // деформационные швы крестом
  hline(ctx, 0, 63, 31, '#33363c');
  hline(ctx, 0, 63, 32, '#43474e');
  vline(ctx, 31, 0, 63, '#33363c');
  vline(ctx, 32, 0, 63, '#43474e');
  // масляные пятна и грязь
  for (let i = 0; i < 6; i++)
    splat(ctx, rng, rng() * 64, rng() * 64, 30, 6, rng() < 0.5 ? '#383b41' : '#2e3138');
  for (let i = 0; i < 3; i++) splat(ctx, rng, rng() * 64, rng() * 64, 16, 4, RUST[0]);
  splat(ctx, rng, 47, 13, 18, 4, BLOOD[0]); // старая кровь
  // трещины
  for (let i = 0; i < 4; i++) {
    const p = walkPath(rng, rng() * 64, rng() * 64, 16, 1.3);
    drawPath(ctx, p, '#2c2f34');
    for (const [x, y] of p) if (rng() < 0.3) px(ctx, x, y + 1, '#62666f'); // светлая кромка
  }
  return ctx.canvas;
}

// FLOOR_DIRT — грунт/гравий двора.
function texFLOOR_DIRT() {
  const ctx = makeTex();
  const rng = mulberry32(204);
  fillAll(ctx, '#4a3a28');
  speckle(ctx, rng, '#3a2d1e', 600);
  speckle(ctx, rng, '#5c4632', 520);
  speckle(ctx, rng, '#6b5238', 260);
  // камешки с тенью
  for (let i = 0; i < 46; i++) {
    const x = (rng() * 64) | 0, y = (rng() * 64) | 0;
    const c = rng() < 0.5 ? '#7a6a55' : '#8a6b48';
    px(ctx, x, y, c);
    px(ctx, x + 1, y, rng() < 0.6 ? c : '#5c4632');
    px(ctx, x, y + 1, '#32261a');
    if (rng() < 0.3) px(ctx, x + 1, y + 1, '#32261a');
  }
  // крупные булыжники
  for (let i = 0; i < 7; i++) {
    const x = (rng() * 64) | 0, y = (rng() * 64) | 0;
    splat(ctx, rng, x, y, 7, 2, '#7a6a55');
    px(ctx, x, y, '#99a0ad');
    px(ctx, x - 1, y + 2, '#32261a');
    px(ctx, x, y + 2, '#32261a');
  }
  // сухие борозды
  for (let i = 0; i < 4; i++) drawPath(ctx, walkPath(rng, rng() * 64, rng() * 64, 14, 0.9), '#3a2d1e');
  // пятна выжженной земли
  splat(ctx, rng, 15, 44, 26, 5, '#2c2117');
  splat(ctx, rng, 50, 9, 20, 4, '#2c2117');
  return ctx.canvas;
}

// FLOOR_REDROCK — красный адский камень, спёкшиеся плиты.
function texFLOOR_REDROCK() {
  const ctx = makeTex();
  const rng = mulberry32(205);
  fillAll(ctx, '#5a1812');
  speckle(ctx, rng, '#481010', 520);
  speckle(ctx, rng, '#6e2418', 430);
  speckle(ctx, rng, '#7e3020', 160);
  // сеть тёмных разломов делит камень на «плиты»
  for (let i = 0; i < 7; i++) {
    const vertical = i % 2 === 0;
    const p = walkPath(rng, rng() * 64, rng() * 64, 30, 0.5, vertical ? Math.PI / 2 : 0);
    drawPath(ctx, p, '#2c0a08');
    for (const [x, y] of p) {
      if (rng() < 0.5) px(ctx, x + 1, y, '#2c0a08');
      if (rng() < 0.35) px(ctx, x, y - 1, '#7e3020'); // подсвеченная кромка
    }
  }
  // тлеющие угли в разломах
  for (let i = 0; i < 14; i++) {
    const x = (rng() * 64) | 0, y = (rng() * 64) | 0;
    px(ctx, x, y, rng() < 0.4 ? FIRE[1] : FIRE[0]);
  }
  // обугленные пятна
  for (let i = 0; i < 4; i++) splat(ctx, rng, rng() * 64, rng() * 64, 18, 4, '#380c0a');
  return ctx.canvas;
}

// ---------------------------------------------------------------- жидкости (анимация)

// Пузырь жидкости в фазе 0..2: купол → пик с бликом → лопнувшее кольцо.
function bubble(ctx, x, y, phase, pal) {
  if (phase === 0) {
    px(ctx, x, y, pal[2]);
    px(ctx, x + 1, y, pal[2]);
    px(ctx, x, y + 1, pal[1]);
    px(ctx, x + 1, y + 1, pal[1]);
  } else if (phase === 1) {
    px(ctx, x, y - 1, pal[3]);
    px(ctx, x + 1, y - 1, pal[2]);
    px(ctx, x - 1, y, pal[2]);
    px(ctx, x, y, pal[3]);
    px(ctx, x + 1, y, pal[2]);
    px(ctx, x + 2, y, pal[1]);
    px(ctx, x, y + 1, pal[1]);
    px(ctx, x + 1, y + 1, pal[1]);
  } else {
    px(ctx, x - 1, y, pal[1]);
    px(ctx, x + 2, y, pal[1]);
    px(ctx, x, y - 1, pal[1]);
    px(ctx, x + 1, y - 1, pal[1]);
    px(ctx, x, y + 1, pal[0]);
    px(ctx, x + 1, y + 1, pal[0]);
    px(ctx, x, y, pal[0]);
    px(ctx, x + 1, y, pal[0]);
  }
}

// Основа жидкости: тёмные «волны»-разводы, одинаковые во всех кадрах (сид фиксирован).
function liquidBase(seed, pal) {
  const ctx = makeTex();
  const rng = mulberry32(seed);
  fillAll(ctx, pal[1]);
  speckle(ctx, rng, pal[0], 420);
  speckle(ctx, rng, pal[2], 240);
  // волнистые тёмные прожилки течения (целые гармоники => бесшовно)
  for (let i = 0; i < 6; i++) {
    const yBase = i * 11 + 4, amp = 2 + (i % 2), k = 2 + (i % 3);
    for (let x = 0; x < 64; x++) {
      const y = yBase + Math.sin((x / 64) * Math.PI * 2 * k + i * 1.7) * amp;
      px(ctx, x, y | 0, pal[0]);
      if (rng() < 0.4) px(ctx, x, (y | 0) + 1, pal[0]);
    }
  }
  // светлые блики поверхности
  for (let i = 0; i < 24; i++) {
    const x = (rng() * 64) | 0, y = (rng() * 64) | 0;
    hline(ctx, x, x + 1 + ((rng() * 2) | 0), y, pal[2]);
  }
  return { ctx, rng };
}

// NUKAGE0..2 — кислота: пузыри в трёх фазах по кругу.
function texNUKAGE(frame) {
  const { ctx, rng } = liquidBase(206, ACID);
  for (let i = 0; i < 15; i++) {
    const x = 3 + ((rng() * 58) | 0), y = 3 + ((rng() * 58) | 0);
    bubble(ctx, x, y, (i + frame) % 3, ACID);
  }
  // ядовитая пена у «берегов» течения
  for (let i = 0; i < 12; i++) {
    const x = (rng() * 64) | 0, y = (rng() * 64) | 0;
    if ((x + y + frame) % 3 === 0) px(ctx, x, y, ACID[3]);
  }
  return ctx.canvas;
}

// LAVA0..1 — лава: тёмная корка с пульсирующими огненными трещинами.
function texLAVA(frame) {
  const ctx = makeTex();
  const rng = mulberry32(207); // один сид: трещины на месте, пульсирует яркость
  fillAll(ctx, '#481008');
  speckle(ctx, rng, '#380c06', 420);
  speckle(ctx, rng, FIRE[0], 300);
  // сеть огненных трещин
  for (let i = 0; i < 9; i++) {
    const p = walkPath(rng, rng() * 64, rng() * 64, 26, 0.8);
    for (let j = 0; j < p.length; j++) {
      const [x, y] = p[j];
      const hot = ((j >> 2) + i + frame) % 2 === 0; // пульсация участками
      px(ctx, x, y, hot ? FIRE[2] : FIRE[1]);
      if (rng() < 0.5) px(ctx, x + 1, y, hot ? FIRE[1] : FIRE[0]);
      if (hot && rng() < 0.25) px(ctx, x, y - 1, FIRE[3]); // ярчайшие точки
    }
  }
  // озёрца расплава
  for (let i = 0; i < 5; i++) {
    const x = 4 + ((rng() * 56) | 0), y = 4 + ((rng() * 56) | 0);
    const bright = (i + frame) % 2 === 0;
    splat(ctx, rng, x, y, 12, 3, bright ? FIRE[2] : FIRE[1]);
    px(ctx, x, y, bright ? FIRE[3] : FIRE[2]);
    if (bright) px(ctx, x + 1, y, FIRE[3]);
  }
  // плавающие обломки корки
  for (let i = 0; i < 7; i++) {
    const x = (rng() * 64) | 0, y = (rng() * 64) | 0;
    splat(ctx, rng, x, y, 8, 2, '#2c0a06');
  }
  return ctx.canvas;
}

// ---------------------------------------------------------------- потолки

// CEIL_TECH — потолочные кассеты 16×16 с вентиляционными вставками.
function texCEIL_TECH() {
  const ctx = makeTex();
  const rng = mulberry32(208);
  fillAll(ctx, MET[2]);
  speckle(ctx, rng, MET[1], 300);
  speckle(ctx, rng, MET[3], 180);
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 4; gx++) {
      const x0 = gx * 16, y0 = gy * 16;
      hline(ctx, x0, x0 + 15, y0, MET[0]);
      vline(ctx, x0, y0, y0 + 15, MET[0]);
      hline(ctx, x0 + 1, x0 + 15, y0 + 1, MET[3]);
      vline(ctx, x0 + 1, y0 + 1, y0 + 15, MET[3]);
      hline(ctx, x0 + 1, x0 + 15, y0 + 15, MET[1]);
      vline(ctx, x0 + 15, y0 + 1, y0 + 15, MET[1]);
      if ((gx + gy) % 2 === 0) {
        // кассета с прорезями вентиляции
        for (let y = y0 + 4; y <= y0 + 11; y += 3) {
          hline(ctx, x0 + 4, x0 + 11, y, '#15171b');
          hline(ctx, x0 + 4, x0 + 11, y + 1, MET[3]);
        }
      } else {
        rivet(ctx, x0 + 7, y0 + 7);
        if (rng() < 0.4) splat(ctx, rng, x0 + 8, y0 + 8, 10, 4, MET[1]);
      }
    }
  for (let i = 0; i < 3; i++) splat(ctx, rng, rng() * 64, rng() * 64, 8, 3, RUST[0]); // подтёки с крыши
  return ctx.canvas;
}

// CEIL_LIGHT — панель с яркими лампами (почти белая).
function texCEIL_LIGHT() {
  const ctx = makeTex();
  const rng = mulberry32(209);
  fillAll(ctx, MET[2]);
  speckle(ctx, rng, MET[1], 160);
  speckle(ctx, rng, MET[3], 160);
  // рамка-кессон по краю тайла
  hline(ctx, 0, 63, 0, MET[0]);
  vline(ctx, 0, 0, 63, MET[0]);
  hline(ctx, 0, 63, 63, MET[0]);
  vline(ctx, 63, 0, 63, MET[0]);
  hline(ctx, 1, 62, 1, MET[3]);
  vline(ctx, 1, 1, 62, MET[3]);
  // 2×2 светящихся квадрата 24×24
  for (const x0 of [5, 35])
    for (const y0 of [5, 35]) {
      bevel(ctx, x0 - 2, y0 - 2, 28, 28, null, MET[0], MET[3]); // утопленный короб
      bevel(ctx, x0 - 1, y0 - 1, 26, 26, null, MET[1], MET[2]);
      for (let y = y0; y < y0 + 24; y++)
        for (let x = x0; x < x0 + 24; x++) {
          const edge = x === x0 || y === y0 || x === x0 + 23 || y === y0 + 23;
          px(ctx, x, y, edge ? '#d8e2e8' : '#fff6c9');
        }
      // ядро ламп — чисто белое с дизерингом к краю
      for (let y = y0 + 4; y < y0 + 20; y++)
        for (let x = x0 + 4; x < x0 + 20; x++)
          px(ctx, x, y, (x + y) & 1 ? '#ffffff' : '#fff6c9');
      // рассеиватель — тонкая сетка
      for (let d = 8; d < 24; d += 8) {
        vline(ctx, x0 + d, y0 + 1, y0 + 22, '#e8e2c0');
        hline(ctx, x0 + 1, x0 + 22, y0 + d, '#e8e2c0');
      }
    }
  // крестовина между лампами
  hline(ctx, 2, 61, 31, MET[1]);
  hline(ctx, 2, 61, 32, MET[3]);
  vline(ctx, 31, 2, 61, MET[1]);
  vline(ctx, 32, 2, 61, MET[3]);
  rivet(ctx, 31, 31);
  return ctx.canvas;
}

// CEIL_HELL — красный камень, из трещин светится лава.
function texCEIL_HELL() {
  const ctx = makeTex();
  const rng = mulberry32(210);
  fillAll(ctx, '#421210');
  speckle(ctx, rng, '#330d0c', 520);
  speckle(ctx, rng, '#562018', 400);
  speckle(ctx, rng, '#6e2418', 140);
  // бугристость: тёмные впадины и подсвеченные бугры
  for (let i = 0; i < 10; i++) {
    splat(ctx, rng, rng() * 64, rng() * 64, 22, 5, '#330d0c');
    splat(ctx, rng, rng() * 64, rng() * 64, 10, 3, '#6e2418');
  }
  // светящиеся лавовые трещины
  for (let i = 0; i < 6; i++) {
    const p = walkPath(rng, rng() * 64, rng() * 64, 22, 0.9);
    for (let j = 0; j < p.length; j++) {
      const [x, y] = p[j];
      px(ctx, x, y, (j + i) % 3 === 0 ? FIRE[2] : FIRE[1]);
      if (rng() < 0.4) px(ctx, x + 1, y, FIRE[0]);
      if (rng() < 0.2) px(ctx, x, y + 1, FIRE[0]);
      if ((j + i) % 5 === 0) px(ctx, x, y, FIRE[3]); // самые горячие точки
    }
  }
  // капли застывшей лавы
  for (let i = 0; i < 8; i++) {
    const x = (rng() * 64) | 0, y = (rng() * 64) | 0;
    px(ctx, x, y, FIRE[0]);
    px(ctx, x, y + 1, '#2c0a06');
  }
  return ctx.canvas;
}

// ---------------------------------------------------------------- экспорт

export function generateTextures() {
  const map = new Map();
  // стены
  map.set('TECH1', texTECH1());
  map.set('TECH2', texTECH2());
  map.set('COMP0', texCOMP(0));
  map.set('COMP1', texCOMP(1));
  map.set('METAL', texMETAL());
  map.set('SUPPORT', texSUPPORT());
  map.set('CRATE', texCRATE());
  map.set('STONE', texSTONE());
  map.set('BRICKRED', texBRICKRED());
  map.set('MARBLE', texMARBLE());
  map.set('FLESH', texFLESH());
  map.set('DOOR1', texDOOR1());
  map.set('DOORBLUE', texDOORKEY(112, [BLUE[0], BLUE[1], BLUE[2], BLUE[3]]));
  map.set('DOORYELL', texDOORKEY(113, ['#4a3808', '#8a6a14', '#d2a52a', '#ffd24a']));
  map.set('DOORRED', texDOORKEY(114, [BLOOD[0], BLOOD[1], BLOOD[3], '#ff8a5d']));
  map.set('SWEXIT_OFF', texSWEXIT(false));
  map.set('SWEXIT_ON', texSWEXIT(true));
  map.set('SKY1', texSKY1());
  // полы
  map.set('FLOOR_TECH', texFLOOR_TECH());
  map.set('FLOOR_HEX', texFLOOR_HEX());
  map.set('FLOOR_GRAY', texFLOOR_GRAY());
  map.set('FLOOR_DIRT', texFLOOR_DIRT());
  map.set('FLOOR_REDROCK', texFLOOR_REDROCK());
  map.set('NUKAGE0', texNUKAGE(0));
  map.set('NUKAGE1', texNUKAGE(1));
  map.set('NUKAGE2', texNUKAGE(2));
  map.set('LAVA0', texLAVA(0));
  map.set('LAVA1', texLAVA(1));
  // потолки
  map.set('CEIL_TECH', texCEIL_TECH());
  map.set('CEIL_LIGHT', texCEIL_LIGHT());
  map.set('CEIL_HELL', texCEIL_HELL());
  return map;
}
