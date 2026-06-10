// HELLBOUND — js/assets/sprites_weapons.js [агент A3]
// Спрайты оружия от первого лица (контракт §7): 7 стволов, idle + fire-серии.
// Канвас 240×160, контент прижат к нижнему краю и центрирован по горизонтали.
// Пиксель-арт по сетке (§4): свет сверху-слева, 3–6 тонов на материал, без
// градиентов; вся случайность — детерминированный mulberry32 (стабильно между
// запусками). Вспышки выстрелов нарисованы в fire-кадрах, отдача — смещением
// и поворотом (сдвиг колонн) ствола между кадрами.

const W = 240;
const H = 160;
const CX = 120;

// ------------------------------------------------------------------ PRNG

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ палитры (§4)

const MTL = ['#101216', '#1b1d22', '#2e3138', '#494e58', '#6d7380', '#99a0ad', '#c2c9d6'];
const GLV = ['#1a0f06', '#33200f', '#54351a', '#7a5226', '#a4763c', '#caa05f'];
const SLV = ['#0d1709', '#1e3318', '#2c5e1a', '#3f7d2a'];
const WOOD = ['#1f1208', '#3a2417', '#6b3a24', '#9c5a2e', '#c97f45'];
const FIRE = ['#7a1f08', '#c44d12', '#f08a1d', '#ffd24a', '#fff6c9'];
const PLAS = ['#123a5e', '#1f6fae', '#46c8ff', '#9ce6ff', '#eafaff'];
const GRN = ['#0e360e', '#2cab2c', '#3fd23f', '#7ade3f', '#d6ff9e'];
const RUST = ['#3a2417', '#6b3a24', '#9c5a2e', '#c97f45'];
const DARK = '#0a0a0d';
const DARK2 = '#141419';
const HAZ = '#caa21d';

// срез палитры металла под «цилиндрический» профиль (тёмный → светлый)
const MS = [MTL[1], MTL[2], MTL[3], MTL[4], MTL[5]];
const MS_DK = [MTL[0], MTL[1], MTL[2], MTL[3], MTL[4]];
const MS_LT = [MTL[1], MTL[3], MTL[4], MTL[5], MTL[6]];

// ------------------------------------------------------------------ базовые хелперы

function mk() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function P(ctx, x, y, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, 1, 1);
}

function R(ctx, x, y, w, h, c) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function HL(ctx, x, y, w, c) { R(ctx, x, y, w, 1, c); }
function VL(ctx, x, y, h, c) { R(ctx, x, y, 1, h, c); }

function LINE(ctx, x0, y0, x1, y1, c) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    P(ctx, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function DISC(ctx, cx, cy, r, c) {
  cx |= 0; cy |= 0; r |= 0;
  for (let yy = -r; yy <= r; yy++) {
    const ww = Math.floor(Math.sqrt(r * r - yy * yy + 0.25));
    HL(ctx, cx - ww, cy + yy, ww * 2 + 1, c);
  }
}

function RING(ctx, cx, cy, r0, r1, c) {
  cx |= 0; cy |= 0;
  for (let yy = -r1; yy <= r1; yy++) {
    const wo = Math.floor(Math.sqrt(r1 * r1 - yy * yy + 0.25));
    const wi2 = r0 * r0 - yy * yy;
    if (wi2 < 0) { HL(ctx, cx - wo, cy + yy, wo * 2 + 1, c); continue; }
    const wi = Math.floor(Math.sqrt(wi2 + 0.25));
    HL(ctx, cx - wo, cy + yy, wo - wi, c);
    HL(ctx, cx + wi + 1, cy + yy, wo - wi, c);
  }
}

// «сфера»: диск с квантованным объёмом, свет сверху-слева, тёмный контур
function ORB(ctx, cx, cy, r, pal) {
  cx |= 0; cy |= 0;
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      const d2 = xx * xx + yy * yy;
      if (d2 > r * r) continue;
      const d = Math.sqrt(d2);
      if (d > r - 1.3) { P(ctx, cx + xx, cy + yy, pal[0]); continue; }
      const lt = (-xx - yy) / (r * 1.6) - d / (r * 2.4);
      const c = lt > 0.34 ? pal[4] : lt > 0.08 ? pal[3] : lt > -0.2 ? pal[2] : pal[1];
      P(ctx, cx + xx, cy + yy, c);
    }
  }
}

// вертикальный «цилиндр» (ось вверх): блик ближе к левому краю, тёмные кромки
function colTone(t, pal) {
  if (t < 0.06 || t > 0.94) return pal[0];
  if (t < 0.16) return pal[3];
  if (t < 0.34) return pal[4];
  if (t < 0.62) return pal[3];
  if (t < 0.85) return pal[2];
  return pal[1];
}

function CYLV(ctx, x, y, w, h, pal) {
  for (let i = 0; i < w; i++) {
    VL(ctx, x + i, y, h, colTone(w <= 1 ? 0.5 : i / (w - 1), pal));
  }
}

// вертикальная трапеция с цилиндрическим профилем (перспектива «вдаль — уже»)
function TRAPV(ctx, cx, y0, y1, w0, w1, pal) {
  const hh = Math.max(1, y1 - y0);
  for (let yy = y0; yy <= y1; yy++) {
    const k = (yy - y0) / hh;
    const w = Math.round(w0 + (w1 - w0) * k);
    const x = Math.round(cx - w / 2);
    for (let i = 0; i < w; i++) {
      P(ctx, x + i, yy, colTone(w <= 1 ? 0.5 : i / (w - 1), pal));
    }
  }
}

// скруглённый блок: заливка, свет сверху-слева, тень снизу-справа, контур
function BLOB(ctx, x, y, w, h, pal) {
  R(ctx, x + 1, y, w - 2, h, pal[2]);
  R(ctx, x, y + 1, w, h - 2, pal[2]);
  HL(ctx, x + 1, y, w - 2, pal[3]);
  HL(ctx, x + 2, y + 1, w - 4, pal[4]);
  VL(ctx, x, y + 1, h - 2, pal[3]);
  HL(ctx, x + 1, y + h - 1, w - 2, pal[0]);
  VL(ctx, x + w - 1, y + 1, h - 2, pal[1]);
  P(ctx, x + w - 2, y + h - 2, pal[0]);
}

// винт 2×2: блик сверху-слева, тень снизу-справа
function SCREW(ctx, x, y) {
  P(ctx, x, y, MTL[5]);
  P(ctx, x + 1, y, MTL[2]);
  P(ctx, x, y + 1, MTL[2]);
  P(ctx, x + 1, y + 1, MTL[0]);
}

// предупредительные полосы «ОПАСНО» (жёлтый/чёрный, диагональ)
function HAZARD(ctx, x, y, w, h) {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      P(ctx, x + xx, y + yy, (((xx + yy) >> 2) & 1) ? DARK2 : HAZ);
    }
  }
}

// потёртости металла: редкие светлые/тёмные пиксели
function WEAR(ctx, rng, x, y, w, h, n) {
  for (let i = 0; i < n; i++) {
    const xx = x + (rng() * w) | 0;
    const yy = y + (rng() * h) | 0;
    P(ctx, xx, yy, rng() < 0.5 ? MTL[5] : MTL[1]);
  }
}

// дульная вспышка: рваная звезда из лучей + ядро кольцами (палитра тёмный→светлый)
function BURST(ctx, rng, cx, cy, r, pal, spikes) {
  cx |= 0; cy |= 0;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    const len = r * (0.8 + rng() * 0.6);
    LINE(ctx, cx, cy, Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len * 0.9), pal[1]);
  }
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + 0.35 + (rng() - 0.5) * 0.6;
    const len = r * (0.55 + rng() * 0.4);
    LINE(ctx, cx, cy, Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len * 0.9), pal[2]);
  }
  DISC(ctx, cx, cy, Math.round(r * 0.58), pal[2]);
  const edge = (r * 2.2) | 0;
  for (let i = 0; i < edge; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.5 + rng() * 0.28);
    P(ctx, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), pal[3]);
  }
  DISC(ctx, cx, cy, Math.round(r * 0.4), pal[3]);
  DISC(ctx, cx, cy, Math.max(1, Math.round(r * 0.22)), pal[4]);
}

// пороховой дым: полупрозрачные серые клубы (полупрозрачность допустима у дыма)
function SMOKE(ctx, rng, cx, cy, n, spread, rise) {
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + (rng() - 0.5) * spread);
    const y = Math.round(cy - rng() * rise);
    DISC(ctx, x, y, 1 + ((rng() * 2.4) | 0), (i & 1) ? MTL[3] : MTL[4]);
  }
  ctx.globalAlpha = 1;
}

// Дизеренный отсвет от вспышки/плазмы: только пиксельная сетка, alpha >= 0.52.
function DITHER_GLOW(ctx, cx, cy, rx, ry, color, phase = 0, alpha = 0.56) {
  ctx.globalAlpha = alpha;
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && ((x + y + phase) & 1) === 0) P(ctx, x, y, color);
    }
  }
  ctx.globalAlpha = 1;
}

function SCRATCHES(ctx, rng, x, y, w, h, n, light = MTL[5], dark = MTL[1]) {
  for (let i = 0; i < n; i++) {
    const sx = x + ((rng() * w) | 0);
    const sy = y + ((rng() * h) | 0);
    const len = 2 + ((rng() * 6) | 0);
    const c = rng() < 0.55 ? light : dark;
    HL(ctx, sx, sy, len, c);
    if (rng() < 0.35) P(ctx, sx + len, sy + 1, dark);
  }
}

function SOOT(ctx, rng, cx, cy, rx, ry, n) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng());
    const x = Math.round(cx + Math.cos(a) * rx * d);
    const y = Math.round(cy + Math.sin(a) * ry * d);
    P(ctx, x, y, rng() < 0.65 ? DARK2 : DARK);
  }
}

function SERIAL(ctx, x, y, w, color) {
  for (let i = 0; i < w; i += 3) {
    P(ctx, x + i, y, color);
    if ((i & 1) === 0) P(ctx, x + i, y + 1, color);
  }
}

function FIRE_REFLECT(ctx, cx, cy, phase) {
  DITHER_GLOW(ctx, cx, cy, 44, 38, FIRE[2], phase, 0.56);
  DITHER_GLOW(ctx, cx, cy + 16, 58, 30, FIRE[1], phase + 1, 0.54);
}

function PLASMA_REFLECT(ctx, cx, cy, phase) {
  DITHER_GLOW(ctx, cx, cy, 52, 40, PLAS[2], phase, 0.57);
  DITHER_GLOW(ctx, cx, cy + 20, 66, 34, PLAS[1], phase + 1, 0.54);
}

function GREEN_REFLECT(ctx, cx, cy, phase) {
  DITHER_GLOW(ctx, cx, cy, 62, 44, GRN[3], phase, 0.57);
  DITHER_GLOW(ctx, cx, cy + 22, 76, 36, GRN[2], phase + 1, 0.54);
}

// рукав брони: вертикальная зелёная трапеция до нижней кромки, со складками
function ARM_DOWN(ctx, cx, y0, w0, w1) {
  const span = Math.max(1, H - y0 + 8);
  for (let y = Math.max(0, y0); y < H; y++) {
    const t = (y - y0) / span;
    const w = Math.round(w0 + (w1 - w0) * t);
    const x = Math.round(cx - w / 2);
    HL(ctx, x + 1, y, w - 2, SLV[2]);
    P(ctx, x, y, SLV[0]);
    P(ctx, x + 1, y, SLV[3]);
    P(ctx, x + w - 2, y, SLV[1]);
    P(ctx, x + w - 1, y, SLV[0]);
  }
  for (let y = y0 + 5; y < H; y += 7) {
    const t = (y - y0) / span;
    const w = Math.round(w0 + (w1 - w0) * t);
    HL(ctx, Math.round(cx - w / 2) + 2, y, w - 4, SLV[1]);
  }
}

// диагональный рукав-«капсула»: сегмент (x0,y0)→(x1,y1) с линейно меняющимся
// радиусом, квантованное цилиндрическое освещение (свет сверху-слева), тёмная
// кромка и поперечные складки ткани через каждые ~9px вдоль оси
function LIMB(ctx, x0, y0, x1, y1, r0, r1, pal) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  const len = Math.sqrt(len2);
  const rm = Math.max(r0, r1);
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - rm));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + rm));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - rm));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + rm));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      const ax = x0 + dx * t, ay = y0 + dy * t;
      const ox = x - ax, oy = y - ay;
      const r = r0 + (r1 - r0) * t;
      const d = Math.sqrt(ox * ox + oy * oy);
      if (d > r) continue;
      let ti;
      if (d > r - 1.4) ti = 0;
      else {
        const q = (-ox * 0.55 - oy * 0.83) / r - d / (r * 4);
        ti = q > 0.4 ? 3 : q > -0.05 ? 2 : q > -0.5 ? 1 : 0;
      }
      if (ti > 0 && t > 0.08 && t < 0.97 && ((t * len) | 0) % 9 < 1) ti--;
      P(ctx, x, y, pal[ti]);
    }
  }
}

// согнутый палец перчатки, горизонтальная фаланга (обхват цевья/рукояти)
function FING_H(ctx, x, y, w, h) {
  BLOB(ctx, x, y, w, h, GLV);
  P(ctx, x + 2, y + 1, GLV[5]); // костяшка
}

// вертикальный палец (кулак анфас): скруглённая верхушка, сгибы фаланг
function FING_V(ctx, x, y, w, h) {
  R(ctx, x, y + 2, w, h - 2, GLV[2]);
  R(ctx, x + 1, y + 1, w - 2, h - 1, GLV[2]);
  R(ctx, x + 2, y, w - 4, h, GLV[2]);
  VL(ctx, x, y + 2, h - 3, GLV[3]);
  P(ctx, x + 1, y + 1, GLV[4]);
  HL(ctx, x + 2, y, w - 4, GLV[4]);
  VL(ctx, x + w - 1, y + 2, h - 3, GLV[0]);
  P(ctx, x + w - 2, y + 1, GLV[1]);
  HL(ctx, x + 1, y + h - 1, w - 2, GLV[1]);
  P(ctx, x + 2, y + 1, GLV[5]); // костяшка
  HL(ctx, x + 1, y + h - 7, w - 2, GLV[1]); // сгиб фаланги
  HL(ctx, x + 2, y + h - 6, w - 4, GLV[3]);
}

// кисть на вертикальной рукояти: тыльная сторона + пальцы + манжета
function GRIP_HAND(ctx, hx, hy, sgn) {
  const bx = sgn < 0 ? hx - 17 : hx - 1;
  BLOB(ctx, bx, hy - 1, 18, 20, GLV);
  P(ctx, bx + 4, hy + 3, GLV[4]);
  P(ctx, bx + 10, hy + 4, GLV[4]);
  LINE(ctx, bx + 5, hy + 6, bx + 7, hy + 14, GLV[1]);
  LINE(ctx, bx + 11, hy + 6, bx + 13, hy + 14, GLV[1]);
  FING_H(ctx, hx - 11, hy + 1, 22, 7);
  FING_H(ctx, hx - 11, hy + 8, 22, 7);
  CUFF(ctx, bx - 1, hy + 17, 20, 7);
}

// манжета перчатки (кожаный ремешок с пряжкой)
function CUFF(ctx, x, y, w, h) {
  BLOB(ctx, x, y, w, h, [RUST[0], RUST[0], RUST[1], RUST[2], RUST[3]]);
  const bx = x + (w >> 1) - 1;
  P(ctx, bx, y + (h >> 1), MTL[5]);
  P(ctx, bx + 1, y + (h >> 1), MTL[3]);
}

// «поворот ствола»: сдвиг колонн готового кадра (наклон вокруг центра)
function TILT(src, tilt) {
  const [c, ctx] = mk();
  for (let x = 0; x < W; x++) {
    const dy = Math.round((x - CX) * tilt);
    ctx.drawImage(src, x, 0, 1, H, x, dy, 1, H);
  }
  return c;
}

// ================================================================== КУЛАК

function drawFist(ctx, bx, by, armX, armY) {
  // рукав от запястья к нижнему краю
  LIMB(ctx, bx + 4, by + 18, armX, armY, 17, 25, SLV);
  // манжета
  CUFF(ctx, bx - 18, by + 11, 40, 10);
  // кисть (тыльная сторона)
  BLOB(ctx, bx - 24, by - 6, 49, 20, GLV);
  // четыре согнутых пальца сверху
  FING_V(ctx, bx - 23, by - 20, 11, 19);
  FING_V(ctx, bx - 11, by - 23, 11, 22);
  FING_V(ctx, bx + 1, by - 23, 11, 22);
  FING_V(ctx, bx + 13, by - 19, 10, 18);
  // металлические клёпки на костяшках
  P(ctx, bx - 19, by - 17, MTL[5]); P(ctx, bx - 18, by - 17, MTL[3]);
  P(ctx, bx - 7, by - 20, MTL[5]); P(ctx, bx - 6, by - 20, MTL[3]);
  P(ctx, bx + 5, by - 20, MTL[5]); P(ctx, bx + 6, by - 20, MTL[3]);
  P(ctx, bx + 16, by - 16, MTL[5]); P(ctx, bx + 17, by - 16, MTL[3]);
  // большой палец сбоку (кулак правой руки, вид сзади)
  BLOB(ctx, bx - 31, by - 11, 14, 20, GLV);
  VL(ctx, bx - 29, by - 9, 12, GLV[4]);
  HL(ctx, bx - 29, by - 10, 8, GLV[4]);
  // швы перчатки
  LINE(ctx, bx - 14, by + 1, bx - 12, by + 10, GLV[1]);
  LINE(ctx, bx + 2, by + 1, bx + 4, by + 10, GLV[1]);
  LINE(ctx, bx + 14, by, bx + 15, by + 8, GLV[1]);
}

function genFist(map) {
  const poses = [
    ['wpn_fist_idle', 152, 130, 186, 196, 0],
    ['wpn_fist_fire0', 182, 148, 212, 198, 0.09],
    ['wpn_fist_fire1', 116, 100, 172, 196, -0.04],
    ['wpn_fist_fire2', 138, 122, 184, 196, 0.03],
  ];
  for (const [key, bx, by, ax, ay, tilt] of poses) {
    const [c, ctx] = mk();
    drawFist(ctx, bx, by, ax, ay);
    if (key === 'wpn_fist_fire1') {
      for (let i = 0; i < 9; i++) {
        LINE(ctx, bx - 54 - i * 2, by - 24 + i * 5, bx - 35 - i, by - 18 + i * 5, i & 1 ? GLV[4] : MTL[4]);
      }
      DITHER_GLOW(ctx, bx - 8, by - 8, 38, 26, GLV[5], 1, 0.54);
    }
    map.set(key, tilt ? TILT(c, tilt) : c);
  }
}

// ================================================================== ПИСТОЛЕТ

function drawPistol(ctx, fi, o) {
  const rb = mulberry32(0xa3b201);
  const rf = mulberry32(0xa3f201 + fi * 7919);
  const dy = o.dy | 0;
  const sb = o.slide | 0;
  const ys = 86 + dy; // дульный срез (верх затвора в покое)

  if (o.smoke) SMOKE(ctx, rf, CX, ys - 6, o.smoke, 22, 26);
  if (o.flash) BURST(ctx, rf, CX, ys - 8, o.flash, FIRE, 10);

  // ствол, видимый при откате затвора
  if (sb > 0) {
    TRAPV(ctx, CX, ys - 2, ys + sb + 3, 12, 13, MS_DK);
    HL(ctx, CX - 6, ys - 3, 13, MTL[4]);
    HL(ctx, CX - 3, ys - 2, 7, DARK);
  }

  const st = ys + sb; // верх затвора после отката
  // верхняя грань затвора (сужается вдаль)
  TRAPV(ctx, CX, st, st + 30, 22, 32, MS_LT);
  // продольный жёлоб
  VL(ctx, CX, st + 2, 26, MTL[3]);
  VL(ctx, CX - 1, st + 2, 26, MTL[4]);
  // мушка
  if (sb === 0) {
    R(ctx, CX - 1, ys - 6, 3, 7, MTL[3]);
    P(ctx, CX - 1, ys - 6, MTL[5]);
    P(ctx, CX, ys - 6, MTL[4]);
    P(ctx, CX + 1, ys - 5, MTL[1]);
  }
  // насечки по бокам ближней части затвора
  for (let i = 0; i < 4; i++) {
    VL(ctx, CX - 15 + i * 2, st + 19, 10, MTL[2]);
    VL(ctx, CX + 14 - i * 2, st + 19, 10, MTL[2]);
  }
  // целик: два уха с белыми точками
  R(ctx, CX - 11, st + 22, 6, 8, MTL[3]);
  R(ctx, CX + 5, st + 22, 6, 8, MTL[3]);
  HL(ctx, CX - 11, st + 22, 6, MTL[5]);
  HL(ctx, CX + 5, st + 22, 6, MTL[5]);
  VL(ctx, CX - 11, st + 22, 8, MTL[4]);
  VL(ctx, CX + 5, st + 22, 8, MTL[4]);
  VL(ctx, CX - 6, st + 23, 7, MTL[1]);
  VL(ctx, CX + 10, st + 23, 7, MTL[1]);
  R(ctx, CX - 5, st + 24, 10, 6, MTL[1]); // прорезь
  P(ctx, CX - 9, st + 26, '#e9edf2');
  P(ctx, CX + 7, st + 26, '#e9edf2');
  // задний торец затвора
  CYLV(ctx, CX - 17, st + 30, 34, 9, MS_DK);
  for (let i = 0; i < 7; i++) VL(ctx, CX - 13 + i * 4, st + 31, 7, MTL[0]);
  // курок
  BLOB(ctx, CX - 6, st + 37, 12, 8, [MTL[0], MTL[1], MTL[2], MTL[3], MTL[4]]);
  HL(ctx, CX - 3, st + 39, 6, MTL[1]);

  // потёртости корпуса (стабильны между кадрами)
  WEAR(ctx, rb, CX - 14, st + 2, 28, 26, 10);
  SCRATCHES(ctx, rb, CX - 13, st + 4, 26, 20, 7);
  SERIAL(ctx, CX - 9, st + 12, 18, MTL[1]);

  // ---- кисть на рукояти (не двигается вместе с затвором)
  const hy = ys + 42;
  // пальцы обхватывают рукоять слева
  FING_H(ctx, CX - 28, hy + 1, 26, 8);
  FING_H(ctx, CX - 29, hy + 9, 27, 8);
  FING_H(ctx, CX - 28, hy + 17, 26, 8);
  FING_H(ctx, CX - 26, hy + 25, 24, 8);
  // тыльная сторона кисти справа
  BLOB(ctx, CX - 4, hy, 34, 33, GLV);
  LINE(ctx, CX + 4, hy + 4, CX + 9, hy + 27, GLV[1]);
  LINE(ctx, CX + 13, hy + 3, CX + 18, hy + 26, GLV[1]);
  P(ctx, CX + 6, hy + 6, GLV[4]);
  P(ctx, CX + 15, hy + 5, GLV[4]);
  // большой палец поверх, к затвору
  BLOB(ctx, CX - 12, hy - 7, 24, 10, GLV);
  HL(ctx, CX - 9, hy - 6, 16, GLV[4]);
  // манжета и рукав до нижней кромки
  CUFF(ctx, CX - 24, hy + 32, 52, 10);
  ARM_DOWN(ctx, CX + 1, hy + 41, 50, 62);

  if (o.flash) {
    FIRE_REFLECT(ctx, CX, ys + 36, fi);
    HL(ctx, CX - 11, st + 5, 22, FIRE[3]);
    P(ctx, CX - 8, hy + 5, FIRE[2]);
    P(ctx, CX + 16, hy + 6, FIRE[1]);
  }
  if (o.smoke) SOOT(ctx, rf, CX, ys - 5, 10, 5, 12);
}

function genPistol(map) {
  const frames = [
    ['wpn_pistol_idle', { dy: 0, slide: 0 }],
    ['wpn_pistol_fire0', { dy: -5, slide: 8, flash: 18 }],
    ['wpn_pistol_fire1', { dy: 8, slide: 3, smoke: 10 }],
    ['wpn_pistol_fire2', { dy: 3, slide: 0, smoke: 4 }],
  ];
  frames.forEach(([key, o], fi) => {
    const [c, ctx] = mk();
    drawPistol(ctx, fi, o);
    map.set(key, c);
  });
}

// ================================================================== ДРОБОВИК

function drawShotgun(ctx, fi, o) {
  const rb = mulberry32(0xa3b303);
  const rf = mulberry32(0xa3f303 + fi * 7919);
  const dy = o.dy | 0;
  const po = o.pump | 0; // ход цевья вниз
  const ym = 50 + dy;    // дульный срез

  if (o.smoke) SMOKE(ctx, rf, CX, ym - 6, o.smoke, 24, 32);
  if (o.flash) BURST(ctx, rf, CX, ym - 10, o.flash, FIRE, 11);

  // ствол: трапеция вдаль, мушка-бусина
  TRAPV(ctx, CX, ym, ym + 48, 11, 17, MS);
  HL(ctx, CX - 5, ym - 1, 11, MTL[4]);
  HL(ctx, CX - 2, ym, 5, DARK);   // дульное отверстие
  P(ctx, CX, ym - 2, FIRE[3]);    // латунная мушка
  // торец магазинной трубки под стволом
  HL(ctx, CX - 2, ym + 4, 5, MTL[1]);
  HL(ctx, CX - 1, ym + 5, 3, DARK);
  // тепловые кольца на стволе
  for (let i = 0; i < 3; i++) {
    const yy = ym + 12 + i * 11;
    const rw = 12 + i * 1.4;
    HL(ctx, Math.round(CX - rw / 2), yy, Math.round(rw), MTL[1]);
  }

  // магазинная трубка, видимая при отведённом цевье
  if (po > 0) TRAPV(ctx, CX, ym + 48, ym + 48 + po, 9, 10, MS_DK);

  // ---- ствольная коробка (за цевьём)
  const rt = ym + 74;
  TRAPV(ctx, CX, rt, rt + 22, 30, 38, MS);
  HL(ctx, CX - 14, rt, 28, MTL[5]);
  // окно выброса гильз справа
  R(ctx, CX + 4, rt + 5, 11, 8, MTL[0]);
  VL(ctx, CX + 4, rt + 5, 8, MTL[1]);
  HL(ctx, CX + 5, rt + 12, 10, MTL[2]);
  SCREW(ctx, CX - 13, rt + 4);
  SCREW(ctx, CX - 13, rt + 14);
  WEAR(ctx, rb, CX - 14, rt + 2, 28, 18, 8);
  SCRATCHES(ctx, rb, CX - 12, rt + 3, 28, 18, 7);
  SERIAL(ctx, CX + 2, rt + 16, 14, MTL[1]);

  // рукав правой руки — под прикладом, к нижнему правому углу
  LIMB(ctx, CX + 28, rt + 30, CX + 60, rt + 74, 11, 17, SLV);
  // приклад: цельная деревянная плита от шейки к нижнему правому углу
  for (let y = rt + 16; y < H; y++) {
    const k = y - (rt + 16);
    const lx = Math.round(CX + 6 + k * 0.85);
    const w = Math.min(26 + k, 46);
    HL(ctx, lx + 1, y, w - 2, WOOD[3]);
    P(ctx, lx, y, WOOD[1]);
    P(ctx, lx + 1, y, WOOD[4]);
    P(ctx, lx + w - 2, y, WOOD[2]);
    P(ctx, lx + w - 1, y, WOOD[0]);
  }
  HL(ctx, CX + 7, rt + 16, 24, WOOD[4]); // блик на шейке
  // волокна дерева вдоль приклада
  for (let i = 0; i < 8; i++) {
    const t = rb();
    const yy = Math.round(rt + 20 + t * 34);
    if (yy < H - 4) {
      const gx = Math.round(CX + 10 + (yy - rt - 16) * 0.85 + rb() * 14);
      LINE(ctx, gx, yy, gx + 3, yy + 4, WOOD[1]);
    }
  }
  // правая кисть обхватывает шейку приклада
  FING_H(ctx, CX + 2, rt + 20, 19, 7);
  FING_H(ctx, CX + 3, rt + 27, 19, 7);
  BLOB(ctx, CX + 18, rt + 18, 18, 19, GLV);
  LINE(ctx, CX + 24, rt + 22, CX + 27, rt + 33, GLV[1]);
  P(ctx, CX + 22, rt + 21, GLV[4]);

  // ---- цевьё (ходит при перезарядке) + левая кисть
  const pt = ym + 48 + po;
  TRAPV(ctx, CX, pt, pt + 24, 26, 34, MS);
  for (let i = 0; i < 5; i++) HL(ctx, CX - 11, pt + 3 + i * 5, 22, MTL[0]);
  // левая рука: рукав из-за левого края к цевью
  LIMB(ctx, CX - 26, pt + 18, CX - 68, H + 8, 11, 19, SLV);
  CUFF(ctx, CX - 38, pt + 14, 18, 8);
  // кисть: тыльная сторона слева, пальцы обхватывают цевьё
  BLOB(ctx, CX - 32, pt + 2, 18, 22, GLV);
  FING_H(ctx, CX - 18, pt + 2, 28, 7);
  FING_H(ctx, CX - 17, pt + 9, 29, 7);
  FING_H(ctx, CX - 18, pt + 16, 28, 7);

  // выброшенная гильза (кадр перелома помпы)
  if (o.shell) {
    const sx = CX + 26, sy = ym + 44;
    R(ctx, sx, sy, 4, 6, '#a51c1c');
    HL(ctx, sx, sy, 4, '#d23b1e');
    R(ctx, sx, sy + 6, 4, 2, FIRE[3]);
    P(ctx, sx - 3, sy - 3, MTL[4]);
    P(ctx, sx - 6, sy - 5, MTL[3]);
  }

  if (o.flash) {
    FIRE_REFLECT(ctx, CX, ym + 52, fi + 2);
    HL(ctx, CX - 7, ym + 8, 14, FIRE[3]);
    P(ctx, CX - 23, pt + 5, FIRE[2]);
    P(ctx, CX + 23, rt + 22, FIRE[1]);
  }
  if (o.smoke) SOOT(ctx, rf, CX, ym - 5, 12, 6, 14);
}

function genShotgun(map) {
  const frames = [
    ['wpn_shotgun_idle', { dy: 0 }, 0],
    ['wpn_shotgun_fire0', { dy: -6, flash: 20 }, 0],
    ['wpn_shotgun_fire1', { dy: 8, smoke: 14 }, 0],
    ['wpn_shotgun_fire2', { dy: 18, pump: 14, smoke: 5, shell: true }, 0.085],
    ['wpn_shotgun_fire3', { dy: 12, pump: 4 }, 0.04],
    ['wpn_shotgun_fire4', { dy: 4 }, 0],
  ];
  frames.forEach(([key, o, tilt], fi) => {
    const [c, ctx] = mk();
    drawShotgun(ctx, fi, o);
    map.set(key, tilt ? TILT(c, tilt) : c);
  });
}

// ================================================================== ПУЛЕМЁТ

function drawChaingun(ctx, fi, o) {
  const rb = mulberry32(0xa3b404);
  const rf = mulberry32(0xa3f404 + fi * 7919);
  const dy = o.dy | 0;
  const my = 84 + dy; // центр дульных блоков
  const phase = o.phase || 0;

  // защитная скоба над стволами
  TRAPV(ctx, CX, my - 22, my - 16, 88, 96, MS);

  // два дульных блока с вращающимися стволами
  for (const sgn of [-1, 1]) {
    const mx = CX + sgn * 26;
    ORB(ctx, mx, my, 14, MS);
    DISC(ctx, mx, my, 10, MTL[2]);
    RING(ctx, mx, my, 9, 10, MTL[1]);
    // четыре ствола по окружности (фаза вращения)
    for (let i = 0; i < 4; i++) {
      const a = phase + i * (Math.PI / 2);
      const bx = Math.round(mx + Math.cos(a) * 6);
      const by = Math.round(my + Math.sin(a) * 6);
      DISC(ctx, bx, by, 2, MTL[1]);
      P(ctx, bx, by, DARK);
      P(ctx, bx - 1, by - 1, MTL[4]);
    }
    // центральная ось
    DISC(ctx, mx, my, 2, MTL[3]);
    P(ctx, mx - 1, my - 1, MTL[5]);
  }

  // корпус
  const by0 = my + 12;
  TRAPV(ctx, CX, by0, by0 + 40, 100, 116, MS);
  HL(ctx, CX - 48, by0, 96, MTL[5]);
  HL(ctx, CX - 49, by0 + 1, 98, MTL[4]);
  // вентиляционные прорези
  for (let i = 0; i < 3; i++) {
    HL(ctx, CX - 42, by0 + 8 + i * 6, 26, MTL[0]);
    HL(ctx, CX - 42, by0 + 9 + i * 6, 26, MTL[1]);
    HL(ctx, CX + 16, by0 + 8 + i * 6, 26, MTL[0]);
    HL(ctx, CX + 16, by0 + 9 + i * 6, 26, MTL[1]);
  }
  // центральная плита с винтами
  R(ctx, CX - 12, by0 + 6, 24, 22, MTL[3]);
  HL(ctx, CX - 12, by0 + 6, 24, MTL[4]);
  VL(ctx, CX - 12, by0 + 6, 22, MTL[4]);
  HL(ctx, CX - 12, by0 + 27, 24, MTL[1]);
  VL(ctx, CX + 11, by0 + 7, 21, MTL[1]);
  SCREW(ctx, CX - 10, by0 + 8);
  SCREW(ctx, CX + 7, by0 + 8);
  SCREW(ctx, CX - 10, by0 + 23);
  SCREW(ctx, CX + 7, by0 + 23);
  HAZARD(ctx, CX - 15, by0 + 31, 30, 4);
  WEAR(ctx, rb, CX - 46, by0 + 4, 92, 32, 16);
  SCRATCHES(ctx, rb, CX - 44, by0 + 6, 88, 28, 13);
  SERIAL(ctx, CX - 8, by0 + 15, 17, MTL[1]);

  // коробка боепитания слева с латунными патронами
  BLOB(ctx, CX - 60, by0 + 8, 18, 24, [MTL[0], MTL[1], MTL[2], MTL[3], MTL[4]]);
  R(ctx, CX - 56, by0 + 13, 10, 14, MTL[0]);
  for (let i = 0; i < 3; i++) {
    VL(ctx, CX - 54 + i * 3, by0 + 15, 4, FIRE[3]);
    P(ctx, CX - 54 + i * 3, by0 + 14, FIRE[2]);
  }

  // рукояти и кисти
  for (const sgn of [-1, 1]) {
    const hx = CX + sgn * 34;
    CYLV(ctx, hx - 4, by0 + 40, 8, 10, MS_DK);
    FING_H(ctx, hx - 12, by0 + 42, 20, 7);
    FING_H(ctx, hx - 12, by0 + 49, 20, 7);
    BLOB(ctx, hx - 12 + (sgn < 0 ? -6 : 16), by0 + 40, 14, 18, GLV);
    ARM_DOWN(ctx, hx + sgn * 4, by0 + 56, 30, 40);
  }

  // вспышки (рисуются поверх стволов)
  if (o.flashL) BURST(ctx, rf, CX - 26, my, o.flashL, FIRE, 9);
  if (o.flashR) BURST(ctx, rf, CX + 26, my, o.flashR, FIRE, 9);
  if (o.flashL || o.flashR) {
    // раскалённые жерла
    P(ctx, CX - 26, my, FIRE[3]);
    P(ctx, CX + 26, my, FIRE[3]);
    FIRE_REFLECT(ctx, CX, my + 24, fi + 4);
    SOOT(ctx, rf, CX - 26, my, 9, 7, 10);
    SOOT(ctx, rf, CX + 26, my, 9, 7, 10);
  }
}

function genChaingun(map) {
  const frames = [
    ['wpn_chaingun_idle', { dy: 0, phase: 0.3 }],
    ['wpn_chaingun_fire0', { dy: -2, phase: 0.3 + Math.PI / 8, flashL: 14, flashR: 9 }],
    ['wpn_chaingun_fire1', { dy: 1, phase: 0.3 + Math.PI / 4, flashL: 9, flashR: 14 }],
  ];
  frames.forEach(([key, o], fi) => {
    const [c, ctx] = mk();
    drawChaingun(ctx, fi, o);
    map.set(key, c);
  });
}

// ================================================================== РАКЕТНИЦА

function drawRocketLauncher(ctx, fi, o) {
  const rb = mulberry32(0xa3b505);
  const rf = mulberry32(0xa3f505 + fi * 7919);
  const dy = o.dy | 0;
  const py = 62 + dy;  // верх фронтальной плиты
  const hcy = py + 26; // центр жерла

  // прицельная стойка
  R(ctx, CX - 2, py - 10, 4, 10, MTL[3]);
  P(ctx, CX - 2, py - 10, MTL[5]);
  P(ctx, CX + 1, py - 10, MTL[1]);
  R(ctx, CX - 4, py - 12, 8, 3, MTL[2]);
  HL(ctx, CX - 4, py - 12, 8, MTL[4]);

  // фронтальная плита с фаской
  R(ctx, CX - 34, py, 68, 50, MTL[3]);
  HL(ctx, CX - 33, py, 66, MTL[5]);
  HL(ctx, CX - 34, py + 1, 68, MTL[4]);
  VL(ctx, CX - 34, py + 1, 48, MTL[4]);
  VL(ctx, CX - 33, py + 2, 46, MTL[4]);
  HL(ctx, CX - 33, py + 49, 66, MTL[1]);
  VL(ctx, CX + 33, py + 1, 48, MTL[1]);
  // скос углов плиты
  ctx.clearRect(CX - 34, py, 2, 2);
  ctx.clearRect(CX + 32, py, 2, 2);
  P(ctx, CX - 32, py + 1, MTL[4]);
  P(ctx, CX + 31, py + 1, MTL[2]);
  // предупредительная полоса по верху
  HAZARD(ctx, CX - 20, py + 3, 40, 4);
  // угловые винты и потёки ржавчины
  SCREW(ctx, CX - 30, py + 9);
  SCREW(ctx, CX + 28, py + 9);
  SCREW(ctx, CX - 30, py + 43);
  SCREW(ctx, CX + 28, py + 43);
  for (let i = 0; i < 4; i++) {
    const x = CX - 28 + ((rb() * 56) | 0);
    VL(ctx, x, py + 12 + ((rb() * 6) | 0), 3 + ((rb() * 5) | 0), RUST[1]);
  }
  WEAR(ctx, rb, CX - 32, py + 8, 64, 40, 14);
  SCRATCHES(ctx, rb, CX - 30, py + 9, 60, 36, 12);
  SERIAL(ctx, CX - 9, py + 35, 19, MTL[1]);

  // жерло: стальной обод и тёмная глотка
  ORB(ctx, CX, hcy, 18, MS);
  DISC(ctx, CX, hcy, 14, DARK2);
  DISC(ctx, CX, hcy, 11, '#0e0e12');
  DISC(ctx, CX, hcy, 7, DARK);
  RING(ctx, CX, hcy, 12, 13, RUST[0]);

  // корпус-труба ниже
  TRAPV(ctx, CX, py + 50, py + 72, 76, 90, MS);
  VL(ctx, CX - 22, py + 52, 18, MTL[2]);
  VL(ctx, CX + 22, py + 52, 18, MTL[2]);
  for (let i = 0; i < 2; i++) {
    HL(ctx, CX - 10, py + 56 + i * 5, 20, MTL[1]);
  }
  SCREW(ctx, CX - 32, py + 56);
  SCREW(ctx, CX + 30, py + 56);

  // боковые рукояти с кистями
  for (const sgn of [-1, 1]) {
    const hx = CX + sgn * 45;
    CYLV(ctx, hx - 4, py + 52, 8, 22, MS_DK);
    FING_H(ctx, hx - 11, py + 56, 19, 7);
    FING_H(ctx, hx - 11, py + 63, 19, 7);
    BLOB(ctx, hx + (sgn < 0 ? -19 : 7), py + 54, 14, 20, GLV);
    CUFF(ctx, hx + sgn * 9 - 8, py + 74, 18, 8);
    LIMB(ctx, hx + sgn * 6, py + 82, hx + sgn * 26, H + 8, 13, 20, SLV);
  }

  // эффекты выстрела (поверх жерла)
  if (o.glow) {
    // тлеющее после выстрела жерло
    RING(ctx, CX, hcy, 9, 11, FIRE[0]);
    RING(ctx, CX, hcy, 6, 7, FIRE[1]);
    for (let i = 0; i < 7; i++) {
      const a = rf() * Math.PI * 2;
      P(ctx, Math.round(CX + Math.cos(a) * 4), Math.round(hcy + Math.sin(a) * 4), FIRE[2]);
    }
    SOOT(ctx, rf, CX, hcy, 16, 12, 18);
  }
  if (o.flash) {
    BURST(ctx, rf, CX, hcy, o.flash, FIRE, 12);
    FIRE_REFLECT(ctx, CX, hcy + 26, fi + 6);
  }
  if (o.smoke) SMOKE(ctx, rf, CX, py - 2, o.smoke, 52, 30);
}

function genRocketLauncher(map) {
  const frames = [
    ['wpn_rocketlauncher_idle', { dy: 0 }],
    ['wpn_rocketlauncher_fire0', { dy: -4, flash: 24, smoke: 10 }],
    ['wpn_rocketlauncher_fire1', { dy: 12, glow: true, smoke: 24 }],
    ['wpn_rocketlauncher_fire2', { dy: 4, smoke: 8 }],
  ];
  frames.forEach(([key, o], fi) => {
    const [c, ctx] = mk();
    drawRocketLauncher(ctx, fi, o);
    map.set(key, c);
  });
}

// ================================================================== ПЛАЗМАГАН

function drawPlasmaRifle(ctx, fi, o) {
  const rb = mulberry32(0xa3b606);
  const rf = mulberry32(0xa3f606 + fi * 7919);
  const dy = o.dy | 0;
  const my = 76 + dy; // верх дульного блока
  const glow = o.glow | 0; // 0 покой, 1/2 фазы выстрела

  // вспышка за дульным блоком
  if (glow) BURST(ctx, rf, CX, my - 8, glow === 1 ? 13 : 10, PLAS, 8);

  // дульный блок: широкая плита с тепловыми жалюзи
  R(ctx, CX - 36, my, 72, 26, MTL[3]);
  HL(ctx, CX - 35, my, 70, MTL[5]);
  HL(ctx, CX - 36, my + 1, 72, MTL[4]);
  VL(ctx, CX - 36, my + 1, 24, MTL[4]);
  VL(ctx, CX + 35, my + 1, 24, MTL[1]);
  HL(ctx, CX - 35, my + 25, 70, MTL[1]);
  ctx.clearRect(CX - 36, my, 1, 2);
  ctx.clearRect(CX + 35, my, 1, 2);
  // три жалюзи (светятся при стрельбе)
  for (let i = 0; i < 3; i++) {
    const sy = my + 5 + i * 7;
    if (glow) {
      HL(ctx, CX - 30, sy, 60, PLAS[1]);
      HL(ctx, CX - 30, sy + 1, 60, glow === 1 ? PLAS[2] : PLAS[1]);
      for (let x = CX - 28; x < CX + 28; x += 4) P(ctx, x + i, sy + 1, PLAS[3]);
    } else {
      HL(ctx, CX - 30, sy, 60, MTL[0]);
      HL(ctx, CX - 30, sy + 1, 60, MTL[1]);
      P(ctx, CX - 12, sy + 1, PLAS[1]);
      P(ctx, CX + 9, sy + 1, PLAS[1]);
    }
  }
  // эмиттер по центру
  DISC(ctx, CX, my + 12, 6, MTL[1]);
  RING(ctx, CX, my + 12, 5, 6, MTL[0]);
  if (glow) {
    DISC(ctx, CX, my + 12, 4, PLAS[2]);
    DISC(ctx, CX, my + 12, 2, PLAS[4]);
  } else {
    DISC(ctx, CX, my + 12, 2, PLAS[1]);
    P(ctx, CX, my + 12, PLAS[2]);
  }
  WEAR(ctx, rb, CX - 34, my + 2, 68, 22, 10);
  SCRATCHES(ctx, rb, CX - 32, my + 3, 64, 20, 9, PLAS[3], MTL[1]);

  // корпус
  const by0 = my + 26;
  TRAPV(ctx, CX, by0, by0 + 38, 64, 92, MS);
  HL(ctx, CX - 30, by0, 60, MTL[5]);
  // энергобатарея слева (окно со свечением плазмы)
  BLOB(ctx, CX - 31, by0 + 6, 14, 24, [MTL[0], MTL[1], MTL[2], MTL[3], MTL[4]]);
  R(ctx, CX - 28, by0 + 10, 8, 16, DARK);
  for (let yy = 0; yy < 16; yy++) {
    for (let xx = 0; xx < 8; xx++) {
      if ((xx + yy) & 1) P(ctx, CX - 28 + xx, by0 + 10 + yy, glow ? PLAS[3] : PLAS[2]);
    }
  }
  VL(ctx, CX - 28, by0 + 10, 16, PLAS[1]);
  // кабель от дульного блока к корпусу справа
  LINE(ctx, CX + 30, my + 22, CX + 38, by0 + 8, DARK2);
  LINE(ctx, CX + 38, by0 + 8, CX + 34, by0 + 20, DARK2);
  LINE(ctx, CX + 31, my + 22, CX + 39, by0 + 8, '#23232c');
  LINE(ctx, CX + 39, by0 + 8, CX + 35, by0 + 20, '#23232c');
  // панель с винтами и индикаторами
  R(ctx, CX - 8, by0 + 8, 22, 18, MTL[3]);
  HL(ctx, CX - 8, by0 + 8, 22, MTL[4]);
  VL(ctx, CX - 8, by0 + 8, 17, MTL[4]);
  HL(ctx, CX - 8, by0 + 25, 22, MTL[1]);
  VL(ctx, CX + 13, by0 + 9, 17, MTL[1]);
  SCREW(ctx, CX - 6, by0 + 10);
  SCREW(ctx, CX + 9, by0 + 10);
  for (let i = 0; i < 3; i++) P(ctx, CX - 3 + i * 4, by0 + 21, glow ? PLAS[3] : (i === 0 ? PLAS[2] : MTL[1]));
  HAZARD(ctx, CX - 14, by0 + 31, 28, 3);
  WEAR(ctx, rb, CX - 28, by0 + 2, 56, 30, 10);
  SERIAL(ctx, CX - 5, by0 + 14, 17, MTL[1]);

  // кисти по бокам снизу
  for (const sgn of [-1, 1]) {
    const hx = CX + sgn * 27;
    FING_H(ctx, hx - 11, by0 + 38, 22, 7);
    FING_H(ctx, hx - 11, by0 + 45, 22, 7);
    BLOB(ctx, hx + (sgn < 0 ? -19 : 9), by0 + 37, 13, 17, GLV);
    ARM_DOWN(ctx, hx + sgn * 6, by0 + 52, 30, 42);
  }
  if (glow) {
    PLASMA_REFLECT(ctx, CX, my + 24, fi);
    HL(ctx, CX - 30, my + 2, 60, PLAS[3]);
  }
}

function genPlasmaRifle(map) {
  const frames = [
    ['wpn_plasmarifle_idle', { dy: 0, glow: 0 }],
    ['wpn_plasmarifle_fire0', { dy: 1, glow: 1 }],
    ['wpn_plasmarifle_fire1', { dy: 0, glow: 2 }],
  ];
  frames.forEach(([key, o], fi) => {
    const [c, ctx] = mk();
    drawPlasmaRifle(ctx, fi, o);
    map.set(key, c);
  });
}

// ================================================================== BFG-9000

function drawBFG(ctx, fi, o) {
  const rb = mulberry32(0xa3b707);
  const rf = mulberry32(0xa3f707 + fi * 7919);
  const dy = o.dy | 0;
  const acy = 88 + dy; // центр апертуры
  const chg = o.charge | 0; // 0 нет, 1 малое, 2 большое, 3 выстрел, 4 затухание

  // ---- боковые кожухи-рога с лампами
  for (const sgn of [-1, 1]) {
    for (let yy = 0; yy < 30; yy++) {
      const t = yy / 29;
      const w = Math.round(16 - t * 4);
      const x0 = Math.round(CX + sgn * (62 - t * 22) - w / 2);
      HL(ctx, x0 + 1, acy - 16 + yy, w - 2, MTL[2]);
      P(ctx, x0, acy - 16 + yy, MTL[0]);
      P(ctx, x0 + 1, acy - 16 + yy, MTL[4]);
      P(ctx, x0 + w - 2, acy - 16 + yy, MTL[1]);
      P(ctx, x0 + w - 1, acy - 16 + yy, MTL[0]);
    }
    // лампа на верхушке рога
    const lx = CX + sgn * 40;
    DISC(ctx, lx, acy - 14, 3, chg >= 2 ? GRN[4] : GRN[1]);
    P(ctx, lx - 1, acy - 15, chg >= 2 ? '#ffffff' : GRN[2]);
    RING(ctx, lx, acy - 14, 3, 4, MTL[1]);
  }

  // ---- центральный кожух апертуры
  R(ctx, CX - 30, acy - 18, 60, 48, MTL[2]);
  HL(ctx, CX - 29, acy - 18, 58, MTL[4]);
  HL(ctx, CX - 30, acy - 17, 60, MTL[3]);
  VL(ctx, CX - 30, acy - 17, 46, MTL[3]);
  VL(ctx, CX + 29, acy - 17, 46, MTL[1]);
  HL(ctx, CX - 29, acy + 29, 58, MTL[1]);
  // зелёные броневые накладки
  R(ctx, CX - 28, acy - 15, 12, 42, '#15300f');
  VL(ctx, CX - 28, acy - 15, 42, '#2c5e1a');
  HL(ctx, CX - 28, acy - 15, 12, '#2c5e1a');
  R(ctx, CX + 16, acy - 15, 12, 42, '#15300f');
  VL(ctx, CX + 16, acy - 15, 42, '#2c5e1a');
  HL(ctx, CX + 16, acy - 15, 12, '#2c5e1a');
  SCREW(ctx, CX - 26, acy - 12);
  SCREW(ctx, CX - 26, acy + 20);
  SCREW(ctx, CX + 22, acy - 12);
  SCREW(ctx, CX + 22, acy + 20);
  WEAR(ctx, rb, CX - 28, acy - 16, 56, 44, 12);
  SCRATCHES(ctx, rb, CX - 26, acy - 14, 52, 40, 12, GRN[3], MTL[1]);

  // ---- апертура
  ORB(ctx, CX, acy, 18, MS);
  DISC(ctx, CX, acy, 13, DARK);
  RING(ctx, CX, acy, 11, 12, GRN[0]);
  if (chg === 0) {
    DISC(ctx, CX, acy, 2, GRN[0]);
    P(ctx, CX, acy, GRN[1]);
  }

  // ---- корпус снизу
  const by0 = acy + 30;
  TRAPV(ctx, CX, by0, by0 + 30, 112, 138, MS_DK);
  HL(ctx, CX - 54, by0, 108, MTL[4]);
  // три вентиляционных слота
  for (let i = 0; i < 3; i++) {
    R(ctx, CX - 27 + i * 20, by0 + 7, 14, 4, MTL[0]);
    HL(ctx, CX - 27 + i * 20, by0 + 11, 14, MTL[2]);
  }
  // силовые кабели через корпус
  LINE(ctx, CX - 44, by0 + 4, CX - 20, by0 + 18, DARK2);
  LINE(ctx, CX - 20, by0 + 18, CX + 14, by0 + 16, DARK2);
  LINE(ctx, CX + 14, by0 + 16, CX + 44, by0 + 5, DARK2);
  LINE(ctx, CX - 44, by0 + 5, CX - 20, by0 + 19, '#23232c');
  LINE(ctx, CX - 20, by0 + 19, CX + 14, by0 + 17, '#23232c');
  LINE(ctx, CX + 14, by0 + 17, CX + 44, by0 + 6, '#23232c');
  // индикаторы заряда
  const lit = chg === 0 ? 1 : chg === 1 ? 2 : chg >= 2 && chg < 4 ? 4 : 1;
  for (let i = 0; i < 4; i++) {
    DISC(ctx, CX - 9 + i * 6, by0 + 23, 1, i < lit ? GRN[3] : '#15300f');
    P(ctx, CX - 9 + i * 6, by0 + 22, i < lit ? GRN[4] : GRN[0]);
  }
  HAZARD(ctx, CX - 16, by0 + 26, 32, 3);
  SCREW(ctx, CX - 50, by0 + 6);
  SCREW(ctx, CX + 48, by0 + 6);
  WEAR(ctx, rb, CX - 52, by0 + 2, 104, 26, 16);
  SERIAL(ctx, CX - 24, by0 + 17, 22, MTL[1]);

  // кисти по нижним углам
  for (const sgn of [-1, 1]) {
    const hx = CX + sgn * 44;
    FING_H(ctx, hx - 11, by0 + 28, 22, 7);
    FING_H(ctx, hx - 11, by0 + 35, 22, 7);
    BLOB(ctx, hx + (sgn < 0 ? -19 : 9), by0 + 27, 13, 16, GLV);
    ARM_DOWN(ctx, hx + sgn * 6, by0 + 42, 30, 42);
  }

  // ---- энергия в апертуре (поверх всего)
  if (chg === 1) {
    DISC(ctx, CX, acy, 5, GRN[2]);
    DISC(ctx, CX, acy, 3, GRN[3]);
    P(ctx, CX, acy, GRN[4]);
    ctx.globalAlpha = 0.55;
    RING(ctx, CX, acy, 6, 8, GRN[1]);
    ctx.globalAlpha = 1;
    GREEN_REFLECT(ctx, CX, acy + 30, fi);
  } else if (chg === 2) {
    BURST(ctx, rf, CX, acy, 14, GRN, 8);
    DISC(ctx, CX, acy, 8, GRN[3]);
    DISC(ctx, CX, acy, 4, GRN[4]);
    ctx.globalAlpha = 0.55;
    RING(ctx, CX, acy, 12, 16, GRN[2]);
    ctx.globalAlpha = 1;
    GREEN_REFLECT(ctx, CX, acy + 28, fi + 2);
  } else if (chg === 3) {
    BURST(ctx, rf, CX, acy, 27, GRN, 13);
    DISC(ctx, CX, acy, 12, GRN[4]);
    DISC(ctx, CX, acy, 6, '#f4ffe0');
    // зелёный отблеск на кромках кожуха
    HL(ctx, CX - 29, acy - 18, 58, GRN[3]);
    P(ctx, CX - 30, acy - 17, GRN[2]);
    P(ctx, CX + 29, acy - 17, GRN[2]);
    GREEN_REFLECT(ctx, CX, acy + 26, fi + 4);
  } else if (chg === 4) {
    RING(ctx, CX, acy, 7, 9, GRN[1]);
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 8; i++) {
      const a = rf() * Math.PI * 2;
      const d = 3 + rf() * 9;
      P(ctx, Math.round(CX + Math.cos(a) * d), Math.round(acy - 6 - rf() * 10 + Math.sin(a) * 2), GRN[2]);
    }
    ctx.globalAlpha = 1;
  }
}

function genBFG(map) {
  const frames = [
    ['wpn_bfg_idle', { dy: 0, charge: 0 }],
    ['wpn_bfg_fire0', { dy: 0, charge: 1 }],
    ['wpn_bfg_fire1', { dy: -1, charge: 2 }],
    ['wpn_bfg_fire2', { dy: 6, charge: 3 }],
    ['wpn_bfg_fire3', { dy: 3, charge: 4 }],
  ];
  frames.forEach(([key, o], fi) => {
    const [c, ctx] = mk();
    drawBFG(ctx, fi, o);
    map.set(key, c);
  });
}

// ================================================================== экспорт

export function generateSprites() {
  const map = new Map();
  genFist(map);
  genPistol(map);
  genShotgun(map);
  genChaingun(map);
  genRocketLauncher(map);
  genPlasmaRifle(map);
  genBFG(map);
  return map;
}
