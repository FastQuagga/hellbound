// HELLBOUND — js/assets/sprites_enemies3.js [A2c]
// Спрайты врагов: cacodemon (64×64, центрирован — летает) и baron (96×96, ноги на нижней кромке).
// 13 ключей на врага: <type>_walk0..3, <type>_attack0..2, <type>_pain0, <type>_die0..4.
// Пиксель-арт по целочисленной сетке (fillRect 1×1), без градиентов; дизеринг — шахматный.
// Вся случайность — детерминированный mulberry32 с фиксированным сидом на каждый кадр.

const SEED = 0xa2c51de;

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
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function px(ctx, x, y, color) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function disc(ctx, cx, cy, r, color) {
  const ri = Math.max(1, Math.round(r));
  const r2 = r * r + 0.4;
  for (let yy = -ri; yy <= ri; yy++) {
    for (let xx = -ri; xx <= ri; xx++) {
      if (xx * xx + yy * yy <= r2) px(ctx, cx + xx, cy + yy, color);
    }
  }
}

// Толстая ломаная из пиксельных «дисков» — конечности, рога.
function limb(ctx, pts, w, color) {
  const r = w / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i + 1][0], y1 = pts[i + 1][1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let j = 0; j <= n; j++) {
      disc(ctx, Math.round(x0 + ((x1 - x0) * j) / n), Math.round(y0 + ((y1 - y0) * j) / n), r, color);
    }
  }
}

// Лужа крови: рваный пиксельный эллипс, 2 тона + шахматный дизеринг.
function bloodPool(ctx, rnd, cx, cy, rx, ry, pal) {
  for (let yy = -ry; yy <= ry; yy++) {
    const v = yy / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - v * v)) * (0.86 + rnd() * 0.2));
    for (let xx = -half; xx <= half; xx++) {
      const e = Math.hypot(xx / rx, v);
      const dith = ((xx + yy) & 1) === 0;
      let c;
      if (e > 0.78) c = dith ? pal[1] : pal[0];
      else c = dith && e < 0.42 ? pal[3] : pal[2];
      px(ctx, cx + xx, cy + yy, c);
    }
  }
}

// Брызги вокруг точки.
function splatter(ctx, rnd, cx, cy, n, pal) {
  for (let i = 0; i < n; i++) {
    const x = cx + Math.round((rnd() - 0.5) * 18);
    const y = cy + Math.round((rnd() - 0.5) * 20);
    px(ctx, x, y, pal[1 + Math.floor(rnd() * (pal.length - 2))]);
    if (rnd() < 0.5) px(ctx, x, y + 1, pal[1]);
  }
}

function addFrame(m, key, size, painter) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  painter(ctx, mulberry32(SEED ^ strSeed(key)));
  m.set(key, c);
}

// ===================== CACODEMON (64×64, центрирован) =====================

const CACO_PAL = {
  body: ['#1c0404', '#3d0a0a', '#6e1111', '#a51c1c', '#d23b1e', '#ff6b3d'],
  horn: ['#23252b', '#494e58', '#6d7380', '#99a0ad'],
  mouthIn: '#140303',
  gum: '#4a0d0d',
  teeth: ['#a89d80', '#e8e0c4'],
  iris: ['#15300f', '#2c5e1a', '#3aa32a', '#7ade3f'],
  pupil: '#0a0a0d',
  glint: '#d6ff9e',
  blood: ['#131c4e', '#23379b', '#3a55d0', '#6e8aff'],
  bolt: ['#2356c8', '#46c8ff', '#9ce6ff', '#fff6ff'],
};

// Бородавки в нормированных координатах сферы — одинаковы на всех кадрах.
const CACO_WARTS = (() => {
  const r = mulberry32(SEED ^ 0x57a7);
  const list = [];
  while (list.length < 24) {
    const u = r() * 2 - 1, v = r() * 2 - 1;
    const d = Math.hypot(u, v);
    if (d < 0.86 && (v > -0.05 || Math.abs(u) > 0.4)) list.push({ u, v, big: r() < 0.3 });
  }
  return list;
})();

// Сфера тела: 5 тонов, свет сверху-слева, тёмный обод, складки при сдувании (sag 0..1).
function cacoBody(ctx, cx, cy, rx, ry, sag) {
  for (let yy = -ry; yy <= ry; yy++) {
    const v = yy / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - v * v)));
    for (let xx = -half; xx <= half; xx++) {
      const u = xx / rx;
      const edge = Math.hypot(u, v);
      let tone;
      if (edge > 0.93) tone = 1;
      else {
        let s = Math.hypot(u + 0.42, v + 0.46) * 0.6;
        s += ((xx + yy) & 1) ? 0.025 : -0.025;
        if (sag > 0) s += 0.16 * sag + (Math.sin(yy * 1.7) > 0.35 ? 0.14 * sag : 0);
        tone = s < 0.2 ? 5 : s < 0.37 ? 4 : s < 0.6 ? 3 : s < 0.84 ? 2 : 1;
      }
      px(ctx, cx + xx, cy + yy, CACO_PAL.body[tone]);
    }
  }
  for (const w of CACO_WARTS) {
    const wx = cx + Math.round(w.u * rx * 0.9);
    const wy = cy + Math.round(w.v * ry * 0.9);
    px(ctx, wx, wy, CACO_PAL.body[2]);
    if (w.big) {
      px(ctx, wx + 1, wy, CACO_PAL.body[2]);
      px(ctx, wx, wy - 1, CACO_PAL.body[4]);
    }
  }
}

// Тёмные волнистые складки «сдувания».
function cacoCreases(ctx, cx, cy, rx, ry, n) {
  for (let i = 0; i < n; i++) {
    const v = -0.6 + ((i + 0.5) / n) * 1.2;
    const y0 = cy + Math.round(v * ry);
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - v * v)) * 0.82);
    for (let x = -half; x <= half; x++) {
      const y = y0 + Math.round(Math.sin(x * 0.45 + i * 2.1) * 1.2);
      if (((x + i) & 3) !== 3) px(ctx, cx + x, y, CACO_PAL.body[1]);
    }
  }
}

// Шесть коротких серых рогов по верхней дуге; droop — обвисание при смерти.
function cacoHorns(ctx, cx, cy, rx, ry, droop) {
  const angs = [-2.62, -2.18, -1.78, -1.36, -0.96, -0.52];
  for (let i = 0; i < angs.length; i++) {
    const a = angs[i];
    const dx = Math.cos(a), dy = Math.sin(a);
    const bx = cx + dx * rx * 0.95;
    const by = cy + dy * ry * 0.95;
    const len = i === 0 || i === angs.length - 1 ? 4 : 6;
    for (let j = 0; j <= len; j++) {
      const x = Math.round(bx + dx * j);
      const y = Math.round(by + dy * j + droop * j * 0.8);
      px(ctx, x, y, j >= len - 1 ? CACO_PAL.horn[3] : CACO_PAL.horn[j < 2 ? 1 : 2]);
      if (j < len - 1) px(ctx, x, y + 1, CACO_PAL.horn[0]);
    }
  }
}

// Единственный зелёный глаз. mode: 'open' | 'wide' | 'squint' | 'shut'; look — сдвиг зрачка.
function cacoEye(ctx, cx, ey, mode, look) {
  if (mode === 'shut') {
    for (let x = -6; x <= 6; x++) px(ctx, cx + x, ey + Math.round(Math.abs(x) * 0.15), CACO_PAL.body[1]);
    px(ctx, cx - 7, ey + 1, CACO_PAL.body[1]);
    px(ctx, cx + 7, ey + 1, CACO_PAL.body[1]);
    return;
  }
  const h = mode === 'wide' ? 5 : mode === 'squint' ? 2 : 4;
  const w = mode === 'wide' ? 8 : 7;
  for (let yy = -h; yy <= h; yy++) {
    const half = Math.round(w * Math.sqrt(Math.max(0, 1 - (yy / h) * (yy / h))));
    for (let xx = -half; xx <= half; xx++) {
      const e = Math.hypot(xx / w, yy / h);
      let c;
      if (e > 0.85) c = CACO_PAL.iris[0];
      else if (Math.abs(xx - look) <= 1 && Math.abs(yy) <= h - 2) c = CACO_PAL.pupil;
      else c = CACO_PAL.iris[xx < -2 || yy < -1 ? 3 : 2];
      px(ctx, cx + xx, ey + yy, c);
    }
  }
  px(ctx, cx - 3 + look, ey - h + 1, CACO_PAL.glint);
  if (mode === 'open' || mode === 'squint') {
    for (let x = -w; x <= w; x++) {
      px(ctx, cx + x, ey - h - 2 + Math.round(((x * x) / (w * w)) * 2), CACO_PAL.body[1]);
    }
  }
}

// Пасть-ухмылка с приподнятыми уголками; open — раскрытие в px (0 — щель).
function cacoMouth(ctx, cx, my, mw, open, opts = {}) {
  for (let x = -mw; x <= mw; x++) {
    const t = x / mw;
    const yc = my - Math.round(t * t * 4);
    const span = Math.round(open * Math.sqrt(Math.max(0.04, 1 - t * t * 0.9)));
    const topY = yc - Math.round(span * 0.45);
    const botY = yc + (span - Math.round(span * 0.45));
    for (let y = topY; y <= botY; y++) px(ctx, cx + x, y, CACO_PAL.mouthIn);
    px(ctx, cx + x, topY - 1, CACO_PAL.gum);
    px(ctx, cx + x, botY + 1, CACO_PAL.body[1]);
    if (opts.teeth !== false && span >= 3 && Math.abs(t) < 0.92) {
      const m4 = ((x % 4) + 4) % 4;
      if (m4 === 0) {
        const len = Math.min(3, span - 1);
        for (let k = 0; k < len; k++) px(ctx, cx + x, topY + k, k === len - 1 ? CACO_PAL.teeth[0] : CACO_PAL.teeth[1]);
      } else if (m4 === 2) {
        const len = Math.min(2, span - 1);
        for (let k = 0; k < len; k++) px(ctx, cx + x, botY - k, k === len - 1 ? CACO_PAL.teeth[0] : CACO_PAL.teeth[1]);
      }
    }
  }
}

// Молния в раскрытой пасти (кадр атаки).
function cacoBolt(ctx, rnd, cx, my, mw, open) {
  const amp = Math.max(2, Math.round(open * 0.32));
  let yPrev = my;
  for (let x = -mw + 3; x <= mw - 3; x += 3) {
    const yN = my + Math.round((rnd() - 0.5) * 2 * amp);
    const lo = Math.min(yPrev, yN), hi = Math.max(yPrev, yN);
    for (let y = lo; y <= hi; y++) px(ctx, cx + x, y, CACO_PAL.bolt[2]);
    for (let d = 1; d < 3 && x + d <= mw - 3; d++) px(ctx, cx + x + d, yN, d === 1 ? CACO_PAL.bolt[3] : CACO_PAL.bolt[2]);
    px(ctx, cx + x, yN + 1, CACO_PAL.bolt[1]);
    yPrev = yN;
  }
}

// Потёки синей крови по телу.
function cacoBlood(ctx, rnd, cx, cy, rx, ry, amount) {
  for (let i = 0; i < amount; i++) {
    const u = rnd() * 1.6 - 0.8;
    const x = cx + Math.round(u * rx);
    const yTop = cy + Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * ry * (0.25 + rnd() * 0.5));
    const len = 2 + Math.floor(rnd() * 5);
    for (let k = 0; k < len; k++) px(ctx, x, yTop + k, CACO_PAL.blood[k === len - 1 ? 3 : 2]);
    px(ctx, x, yTop + len, CACO_PAL.blood[1]);
  }
}

function buildCacodemon(m) {
  const cx = 32;
  // walk0..3 — парение: тело «дышит», зрачок гуляет.
  const hover = [
    { cy: 31, rx: 25, ry: 25, open: 3, look: 0 },
    { cy: 32, rx: 26, ry: 24, open: 4, look: 1 },
    { cy: 31, rx: 25, ry: 25, open: 3, look: 0 },
    { cy: 30, rx: 25, ry: 26, open: 4, look: -1 },
  ];
  hover.forEach((p, i) => {
    addFrame(m, 'cacodemon_walk' + i, 64, (ctx) => {
      cacoBody(ctx, cx, p.cy, p.rx, p.ry, 0);
      cacoHorns(ctx, cx, p.cy, p.rx, p.ry, 0);
      cacoEye(ctx, cx, p.cy - 9, 'open', p.look);
      cacoMouth(ctx, cx, p.cy + 11, 18, p.open);
    });
  });
  // attack0..2 — пасть раскрывается, на кадре 1 внутри молния.
  const atk = [
    { open: 7, eye: 'wide', bolt: false },
    { open: 13, eye: 'wide', bolt: true },
    { open: 6, eye: 'open', bolt: false },
  ];
  atk.forEach((p, i) => {
    addFrame(m, 'cacodemon_attack' + i, 64, (ctx, rnd) => {
      cacoBody(ctx, cx, 31, 25, 25, 0);
      cacoHorns(ctx, cx, 31, 25, 25, 0);
      cacoEye(ctx, cx, 21, p.eye, 0);
      cacoMouth(ctx, cx, 42, 19, p.open);
      if (p.bolt) {
        cacoBolt(ctx, rnd, cx, 42, 19, p.open);
        for (let g = 0; g < 16; g++) {
          const a = rnd() * Math.PI * 2;
          const gx = cx + Math.round(Math.cos(a) * (14 + rnd() * 5));
          const gy = 42 + Math.round(Math.sin(a) * (7 + rnd() * 3));
          px(ctx, gx, gy, CACO_PAL.bolt[Math.floor(rnd() * 2)]);
        }
      }
    });
  });
  // pain0 — отшатнулся, прищур, стиснутая пасть.
  addFrame(m, 'cacodemon_pain0', 64, (ctx, rnd) => {
    cacoBody(ctx, cx + 2, 32, 25, 24, 0);
    cacoHorns(ctx, cx + 2, 32, 25, 24, 0);
    cacoEye(ctx, cx + 2, 23, 'squint', 0);
    cacoMouth(ctx, cx + 2, 43, 17, 2);
    cacoBlood(ctx, rnd, cx + 2, 32, 25, 24, 3);
  });
  // die0..4 — вопль, сдувается складками и оседает в лужу синей крови.
  const die = [
    { cy: 31, rx: 25, ry: 25, sag: 0.1, open: 12, eye: 'wide', drips: 3, pool: 0 },
    { cy: 36, rx: 26, ry: 20, sag: 0.35, open: 8, eye: 'squint', drips: 6, pool: 0 },
    { cy: 42, rx: 27, ry: 14, sag: 0.6, open: 5, eye: 'shut', drips: 8, pool: 10 },
    { cy: 49, rx: 27, ry: 9, sag: 0.85, open: 0, eye: 'shut', drips: 6, pool: 16 },
    { cy: 55, rx: 26, ry: 5, sag: 1, open: 0, eye: 'shut', drips: 0, pool: 22 },
  ];
  die.forEach((p, i) => {
    addFrame(m, 'cacodemon_die' + i, 64, (ctx, rnd) => {
      if (p.pool) bloodPool(ctx, rnd, cx, 59, p.pool, i === 4 ? 4 : 3, CACO_PAL.blood);
      cacoBody(ctx, cx, p.cy, p.rx, p.ry, p.sag);
      if (p.sag > 0.3) cacoCreases(ctx, cx, p.cy, p.rx, p.ry, p.sag > 0.7 ? 4 : 2);
      cacoHorns(ctx, cx, p.cy, p.rx, p.ry, p.sag);
      if (i < 4) cacoEye(ctx, cx, p.cy - Math.round(p.ry * 0.35), p.eye, 0);
      if (p.open > 0) cacoMouth(ctx, cx, p.cy + Math.round(p.ry * 0.45), Math.min(18, p.rx - 6), p.open, { teeth: i < 2 });
      if (p.drips) cacoBlood(ctx, rnd, cx, p.cy, p.rx, p.ry, p.drips);
      if (i === 4) {
        px(ctx, cx - 14, 59, CACO_PAL.teeth[1]);
        px(ctx, cx - 14, 60, CACO_PAL.teeth[0]);
        px(ctx, cx + 11, 60, CACO_PAL.teeth[1]);
        px(ctx, cx + 16, 58, CACO_PAL.horn[2]);
        px(ctx, cx + 17, 57, CACO_PAL.horn[3]);
      }
    });
  });
}

// ===================== BARON (96×96, ноги на нижней кромке) =====================

const BARON_PAL = {
  skin: ['#2a1d10', '#5c4632', '#8a6b48', '#c8a06e', '#e8cfa0'],
  fur: ['#16100a', '#2e2014', '#4a3318', '#6b4a22'],
  horn: ['#3a2c18', '#8a6b48', '#c8a06e', '#e8cfa0'],
  hoof: ['#101114', '#1b1d22', '#2e3138', '#494e58'],
  eye: ['#15300f', '#3aa32a', '#7ade3f', '#d6ff9e'],
  mouth: '#140303',
  tongue: '#6e1111',
  teeth: ['#a89d80', '#e8e0c4'],
  blood: ['#1d0404', '#3d0a0a', '#6e1111', '#a51c1c'],
  orb: ['#15300f', '#2c5e1a', '#3aa32a', '#7ade3f', '#d6ff9e'],
};

const BARON_SKIN_LIMB = [BARON_PAL.skin[0], BARON_PAL.skin[2], BARON_PAL.skin[3]];
const BARON_FUR_LIMB = [BARON_PAL.fur[0], BARON_PAL.fur[1], BARON_PAL.fur[2]];
const BARON_HORN_LIMB = [BARON_PAL.horn[0], BARON_PAL.horn[1], BARON_PAL.horn[2]];

function hline(ctx, x0, x1, y, color) {
  for (let x = x0; x <= x1; x++) px(ctx, x, y, color);
}

// Конечность с объёмом: тёмный контур + средний тон + блик сверху-слева.
function shadedLimb(ctx, x0, y0, x1, y1, w, pal) {
  limb(ctx, [[x0, y0], [x1, y1]], w, pal[0]);
  limb(ctx, [[x0 - 0.5, y0 - 0.7], [x1 - 0.5, y1 - 0.7]], Math.max(1.6, w - 2), pal[1]);
  limb(ctx, [[x0 - 1, y0 - 1.4], [x1 - 1, y1 - 1.4]], Math.max(1, w - 3.6), pal[2]);
}

// Туша/голова: контурный край, 3–4 тона со светом сверху-слева,
// шахматный дизеринг между тонами и шумовые крапинки кожи.
function fleshBlob(ctx, cx, cy, rx, ry, pal, rnd, noise = 0) {
  const tones = pal.length - 1;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (d > 0.82) { px(ctx, x, y, pal[0]); continue; }
      let s = 0.58 - nx * 0.3 - ny * 0.36 - d * 0.26 + (((x + y) & 1) ? 0.06 : -0.06);
      if (noise && rnd() < noise) s += rnd() < 0.5 ? -0.2 : 0.16;
      px(ctx, x, y, pal[Math.max(1, Math.min(tones, 1 + Math.floor(s * tones)))]);
    }
  }
}

// Раздвоенное копыто: тёмный блок с бликом и щелью посередине (низ — строка fy).
function baronHoof(ctx, fx, fy) {
  hline(ctx, fx - 2, fx + 2, fy - 2, BARON_PAL.hoof[2]);
  hline(ctx, fx - 3, fx + 3, fy - 1, BARON_PAL.hoof[1]);
  hline(ctx, fx - 3, fx + 3, fy, BARON_PAL.hoof[0]);
  px(ctx, fx, fy - 2, BARON_PAL.hoof[0]);
  px(ctx, fx, fy - 1, BARON_PAL.hoof[0]);
  px(ctx, fx - 2, fy - 2, BARON_PAL.hoof[3]);
}

// Козлиная нога: мощное мохнатое бедро, тонкая голень, копыто.
function baronLeg(ctx, hx, hy, fx, fy) {
  const mx = hx + (fx - hx) * 0.5;
  const my = hy + (fy - hy) * 0.52 + 1;
  shadedLimb(ctx, hx, hy, mx, my, 5, BARON_FUR_LIMB);
  shadedLimb(ctx, mx, my, fx, fy - 2, 2.4, BARON_FUR_LIMB);
  // клочья шерсти на бедре
  px(ctx, Math.round(mx) - 3, Math.round(my) + 1, BARON_PAL.fur[0]);
  px(ctx, Math.round(mx) + 2, Math.round(my) + 2, BARON_PAL.fur[0]);
  px(ctx, Math.round(mx) - 1, Math.round(my) - 2, BARON_PAL.fur[3]);
  baronHoof(ctx, Math.round(fx), Math.round(fy));
}

function baronClaws(ctx, x, y, spread) {
  for (const dx of [-spread, 0, spread]) {
    px(ctx, x + dx, y + 2, BARON_PAL.horn[2]);
    px(ctx, x + dx, y + 3, BARON_PAL.horn[3]);
  }
}

// Опущенная рука: плечо→локоть→кисть с костяными когтями.
function baronArm(ctx, sx, sy, hx, hy, out) {
  const ex = sx + (hx - sx) * 0.45 + out * 2.5;
  const ey = sy + (hy - sy) * 0.5;
  shadedLimb(ctx, sx, sy, ex, ey, 3.6, BARON_SKIN_LIMB);
  shadedLimb(ctx, ex, ey, hx, hy, 2.8, BARON_SKIN_LIMB);
  disc(ctx, hx, hy, 2.2, BARON_PAL.skin[1]);
  disc(ctx, hx - 1, hy - 1, 1.3, BARON_PAL.skin[3]);
  baronClaws(ctx, hx, hy, 2);
}

// Бычий рог: толстое основание, изгиб вверх-наружу, светлый кончик, насечки.
function baronHorn(ctx, x, y, side) {
  shadedLimb(ctx, x, y, x + side * 3.5, y - 4.5, 3.2, BARON_HORN_LIMB);
  shadedLimb(ctx, x + side * 3.5, y - 4.5, x + side * 5.5, y - 10, 2, BARON_HORN_LIMB);
  px(ctx, x + side * 6, y - 11, BARON_PAL.horn[3]);
  px(ctx, x + side * 6, y - 12, BARON_PAL.horn[3]);
  px(ctx, x + side * 2, y - 3, BARON_PAL.horn[0]);
  px(ctx, x + side * 4, y - 7, BARON_PAL.horn[0]);
}

// Зелёные глаза. mode: 'norm' | 'wide' | 'squint' | 'dead'.
function baronEyes(ctx, hx, ey, mode) {
  if (mode === 'dead') {
    px(ctx, hx - 3, ey, BARON_PAL.skin[0]);
    px(ctx, hx + 3, ey, BARON_PAL.skin[0]);
    return;
  }
  if (mode === 'squint') {
    px(ctx, hx - 3, ey, BARON_PAL.eye[1]);
    px(ctx, hx + 3, ey, BARON_PAL.eye[1]);
    hline(ctx, hx - 4, hx - 2, ey - 1, BARON_PAL.skin[0]);
    hline(ctx, hx + 2, hx + 4, ey - 1, BARON_PAL.skin[0]);
    return;
  }
  px(ctx, hx - 4, ey, BARON_PAL.eye[1]);
  px(ctx, hx - 3, ey, BARON_PAL.eye[2]);
  px(ctx, hx + 3, ey, BARON_PAL.eye[2]);
  px(ctx, hx + 4, ey, BARON_PAL.eye[1]);
  if (mode === 'wide') {
    px(ctx, hx - 3, ey - 1, BARON_PAL.eye[3]);
    px(ctx, hx + 3, ey - 1, BARON_PAL.eye[3]);
    px(ctx, hx - 4, ey + 1, BARON_PAL.eye[0]);
    px(ctx, hx + 4, ey + 1, BARON_PAL.eye[0]);
  }
  // злые брови «домиком»
  const by = ey - (mode === 'wide' ? 2 : 1);
  px(ctx, hx - 2, by, BARON_PAL.skin[0]);
  px(ctx, hx - 3, by - 1, BARON_PAL.skin[0]);
  px(ctx, hx - 4, by - 1, BARON_PAL.skin[0]);
  px(ctx, hx + 2, by, BARON_PAL.skin[0]);
  px(ctx, hx + 3, by - 1, BARON_PAL.skin[0]);
  px(ctx, hx + 4, by - 1, BARON_PAL.skin[0]);
}

// Пасть. mode: 0 — сжата (клыки из-под губы), 1 — оскал, 2 — рёв.
function baronMouth(ctx, hx, my, mode) {
  if (mode === 0) {
    hline(ctx, hx - 3, hx + 3, my, BARON_PAL.skin[0]);
    px(ctx, hx - 2, my - 1, BARON_PAL.teeth[1]);
    px(ctx, hx + 2, my - 1, BARON_PAL.teeth[1]);
    return;
  }
  const h = mode === 1 ? 2 : 4;
  const w = mode === 1 ? 3 : 4;
  for (let yy = -1; yy < h - 1; yy++) hline(ctx, hx - w, hx + w, my + yy, BARON_PAL.mouth);
  for (const dx of [-3, -1, 1, 3]) px(ctx, hx + dx, my - 1, BARON_PAL.teeth[0]);
  px(ctx, hx - w, my + h - 2, BARON_PAL.teeth[1]);
  px(ctx, hx + w, my + h - 2, BARON_PAL.teeth[1]);
  if (mode === 2) {
    px(ctx, hx - w, my + h - 3, BARON_PAL.teeth[1]);
    px(ctx, hx + w, my + h - 3, BARON_PAL.teeth[1]);
    px(ctx, hx - 1, my + h - 2, BARON_PAL.tongue);
    px(ctx, hx, my + h - 2, BARON_PAL.tongue);
  }
}

// Голова: рога позади, надбровные дуги, ноздри, бородка.
function baronHead(ctx, rnd, hx, hy, eyes, mouth) {
  baronHorn(ctx, hx - 5, hy - 3, -1);
  baronHorn(ctx, hx + 5, hy - 3, 1);
  fleshBlob(ctx, hx, hy, 7, 7.5, BARON_PAL.skin, rnd, 0.05);
  hline(ctx, hx - 5, hx - 1, hy - 4, BARON_PAL.skin[1]);
  hline(ctx, hx + 1, hx + 5, hy - 4, BARON_PAL.skin[1]);
  baronEyes(ctx, hx, hy - 2, eyes);
  px(ctx, hx - 1, hy + 1, BARON_PAL.skin[1]);
  px(ctx, hx + 1, hy + 1, BARON_PAL.skin[1]);
  baronMouth(ctx, hx, hy + 4, mouth);
  px(ctx, hx, hy + 7, BARON_PAL.fur[1]);
  px(ctx, hx, hy + 8, BARON_PAL.fur[2]);
}

// Рельеф торса: грудные мышцы, пресс, старые шрамы.
function baronChest(ctx, cx, ty) {
  hline(ctx, cx - 8, cx - 1, ty - 3, BARON_PAL.skin[1]);
  hline(ctx, cx + 1, cx + 8, ty - 3, BARON_PAL.skin[1]);
  px(ctx, cx - 9, ty - 4, BARON_PAL.skin[1]);
  px(ctx, cx + 9, ty - 4, BARON_PAL.skin[1]);
  for (let y = ty; y <= ty + 8; y += 2) px(ctx, cx, y, BARON_PAL.skin[1]);
  hline(ctx, cx - 3, cx - 1, ty + 2, BARON_PAL.skin[1]);
  hline(ctx, cx + 1, cx + 3, ty + 2, BARON_PAL.skin[1]);
  hline(ctx, cx - 3, cx - 1, ty + 5, BARON_PAL.skin[1]);
  hline(ctx, cx + 1, cx + 3, ty + 5, BARON_PAL.skin[1]);
  for (let i = 0; i < 3; i++) px(ctx, cx - 6 + i, ty - 7 + i, BARON_PAL.skin[4]);
  for (let i = 0; i < 4; i++) px(ctx, cx + 7 - i, ty + i - 1, BARON_PAL.skin[1]);
}

// Меховой пояс на бёдрах: дизеринг двух тонов, рваный нижний край.
function baronWaist(ctx, cx, y, halfW) {
  hline(ctx, cx - halfW, cx + halfW, y - 1, BARON_PAL.fur[0]);
  for (let yy = 0; yy < 4; yy++) {
    const hw = halfW - yy;
    for (let x = -hw; x <= hw; x++) {
      px(ctx, cx + x, y + yy, ((x + yy) & 1) ? BARON_PAL.fur[2] : BARON_PAL.fur[1]);
    }
  }
  for (let x = -halfW + 1; x <= halfW - 1; x += 3) px(ctx, cx + x, y + 4, BARON_PAL.fur[1]);
}

// Зелёный сгусток в ладони: квантованные кольца кислотных тонов + ошмётки и капля.
function baronOrb(ctx, rnd, cx, cy, r) {
  disc(ctx, cx, cy, r, BARON_PAL.orb[1]);
  disc(ctx, cx - 1, cy - 1, r * 0.68, BARON_PAL.orb[2]);
  disc(ctx, cx - 1, cy - 1, r * 0.38, BARON_PAL.orb[3]);
  px(ctx, cx - 1, cy - 2, BARON_PAL.orb[4]);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = r + 0.7 + rnd() * 1.6;
    px(ctx, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), i & 1 ? BARON_PAL.orb[3] : BARON_PAL.orb[2]);
  }
  px(ctx, cx, Math.round(cy + r + 1), BARON_PAL.orb[2]);
  px(ctx, cx, Math.round(cy + r + 2), BARON_PAL.orb[1]);
}

// Сборка позы барона. Земля — нижняя кромка (копыта на y=95).
function baronFrame(ctx, rnd, p) {
  const o = {
    bob: 0, lean: 0, hipY: 57,
    feetL: [40, 95], feetR: [56, 95],
    armL: [29, 57], armR: [67, 57],
    armRaised: false, thrown: false, orb: 0, orbAt: null,
    eyes: 'norm', mouth: 0, bloodChest: 0, ...p,
  };
  const cx = 48 + o.lean;
  const torsoY = 41 + o.bob + Math.max(0, o.hipY - 57) * 0.6;
  const shY = torsoY - 10;
  const headX = cx + Math.round(o.lean * 0.5);
  const headY = torsoY - 20;
  const hipY = o.hipY + o.bob;
  // козлиные ноги
  baronLeg(ctx, cx - 7, hipY, o.feetL[0], o.feetL[1]);
  baronLeg(ctx, cx + 7, hipY, o.feetR[0], o.feetR[1]);
  // опущенные руки — за корпусом
  baronArm(ctx, cx - 12, shY, o.armL[0], o.armL[1], -1);
  if (!o.armRaised && !o.thrown) baronArm(ctx, cx + 12, shY, o.armR[0], o.armR[1], 1);
  // торс
  fleshBlob(ctx, cx, torsoY, 13.5, 15, BARON_PAL.skin, rnd, 0.07);
  baronChest(ctx, cx, torsoY - 4);
  baronWaist(ctx, cx, hipY - 3, 10);
  if (o.bloodChest) splatter(ctx, rnd, cx, torsoY - 3, o.bloodChest * 8, BARON_PAL.blood);
  // плечи
  disc(ctx, cx - 12, shY, 4.6, BARON_PAL.skin[1]);
  disc(ctx, cx - 13, shY - 1, 3.1, BARON_PAL.skin[3]);
  disc(ctx, cx + 12, shY, 4.6, BARON_PAL.skin[1]);
  disc(ctx, cx + 11, shY - 1, 3.1, BARON_PAL.skin[2]);
  // шея и голова
  disc(ctx, cx, Math.round(torsoY - 14), 3.4, BARON_PAL.skin[2]);
  baronHead(ctx, rnd, headX, headY, o.eyes, o.mouth);
  // поднятая рука со сгустком — поверх всего
  if (o.armRaised && o.orbAt) {
    const sx = cx + 12;
    const hx = o.orbAt[0];
    const hy = o.orbAt[1] + (o.orb === 2 ? 6 : 5);
    shadedLimb(ctx, sx, shY, sx + 5, shY - 6, 3.6, BARON_SKIN_LIMB);
    shadedLimb(ctx, sx + 5, shY - 6, hx, hy, 2.8, BARON_SKIN_LIMB);
    disc(ctx, hx, hy, 2.2, BARON_PAL.skin[1]);
    px(ctx, hx - 3, hy - 2, BARON_PAL.horn[3]);
    px(ctx, hx + 3, hy - 2, BARON_PAL.horn[3]);
    if (o.orb) baronOrb(ctx, rnd, o.orbAt[0], o.orbAt[1], o.orb === 2 ? 5.5 : 3.8);
  }
  // рука выброшена к зрителю, кисть крупно, остаточное зелёное свечение
  if (o.thrown) {
    const sx = cx + 12;
    shadedLimb(ctx, sx, shY, sx + 4, shY + 7, 3.8, BARON_SKIN_LIMB);
    disc(ctx, sx + 5, shY + 10, 3.4, BARON_PAL.skin[1]);
    disc(ctx, sx + 4, shY + 9, 2.2, BARON_PAL.skin[3]);
    for (const [dx, dy] of [[-4, 2], [0, 5], [4, 2], [-5, -1], [5, -1]]) {
      px(ctx, sx + 5 + dx, shY + 10 + dy, BARON_PAL.horn[3]);
    }
    px(ctx, sx + 4, shY + 9, BARON_PAL.orb[3]);
    px(ctx, sx + 6, shY + 11, BARON_PAL.orb[2]);
  }
}

const BARON_POSES = {
  walk0: { feetL: [40, 95], feetR: [56, 95] },
  walk1: { bob: -1, lean: -1, feetL: [36, 92], feetR: [57, 95], armL: [32, 51], armR: [65, 61] },
  walk2: { feetL: [42, 95], feetR: [54, 95] },
  walk3: { bob: -1, lean: 1, feetL: [39, 95], feetR: [60, 92], armL: [31, 61], armR: [66, 51] },
  attack0: { eyes: 'wide', mouth: 1, armRaised: true, orb: 1, orbAt: [65, 24], armL: [28, 54] },
  attack1: { eyes: 'wide', mouth: 2, armRaised: true, orb: 2, orbAt: [63, 18], armL: [27, 52], lean: -1 },
  attack2: { eyes: 'wide', mouth: 2, thrown: true, lean: 2, armL: [26, 56] },
  pain0: { eyes: 'squint', mouth: 2, lean: -3, bob: 1, armL: [25, 49], armR: [69, 49], bloodChest: 2 },
};

function baronDie(ctx, rnd, st) {
  if (st === 0) { // рёв, руки вскинуты, кровь на груди
    baronFrame(ctx, rnd, {
      lean: 1, eyes: 'wide', mouth: 2, bloodChest: 2,
      armL: [22, 36], armR: [74, 36], feetL: [38, 95], feetR: [58, 95],
    });
    return;
  }
  if (st === 1) { // оседает: бёдра вниз, ноги разъехались, руки повисли
    baronFrame(ctx, rnd, {
      hipY: 66, bob: 8, eyes: 'squint', mouth: 2, bloodChest: 3,
      armL: [26, 75], armR: [70, 75], feetL: [33, 95], feetR: [63, 95],
    });
    return;
  }
  if (st === 2) { // заваливается вперёд, опирается на руку
    bloodPool(ctx, rnd, 44, 91, 11, 2.5, BARON_PAL.blood);
    shadedLimb(ctx, 56, 78, 68, 88, 5, BARON_FUR_LIMB);
    shadedLimb(ctx, 68, 88, 76, 92, 2.6, BARON_FUR_LIMB);
    baronHoof(ctx, 78, 94);
    shadedLimb(ctx, 50, 82, 60, 92, 3.6, BARON_FUR_LIMB);
    baronHoof(ctx, 62, 95);
    fleshBlob(ctx, 45, 71, 14, 10.5, BARON_PAL.skin, rnd, 0.07);
    baronWaist(ctx, 52, 78, 7);
    disc(ctx, 36, 64, 4.4, BARON_PAL.skin[1]);
    disc(ctx, 35, 63, 3, BARON_PAL.skin[3]);
    shadedLimb(ctx, 36, 66, 26, 78, 3.4, BARON_SKIN_LIMB);
    shadedLimb(ctx, 26, 78, 22, 90, 2.8, BARON_SKIN_LIMB);
    disc(ctx, 22, 90, 2.2, BARON_PAL.skin[1]);
    baronClaws(ctx, 22, 91, 2);
    baronHead(ctx, rnd, 33, 58, 'squint', 2);
    splatter(ctx, rnd, 44, 72, 14, BARON_PAL.blood);
    return;
  }
  if (st === 3) { // рухнул, голова на боку, рука выброшена
    bloodPool(ctx, rnd, 46, 92, 16, 3, BARON_PAL.blood);
    shadedLimb(ctx, 58, 84, 74, 88, 4, BARON_FUR_LIMB);
    baronHoof(ctx, 78, 90);
    shadedLimb(ctx, 56, 88, 70, 92, 3, BARON_FUR_LIMB);
    baronHoof(ctx, 74, 94);
    fleshBlob(ctx, 46, 82, 15, 7, BARON_PAL.skin, rnd, 0.08);
    baronWaist(ctx, 56, 83, 6);
    shadedLimb(ctx, 36, 82, 20, 89, 3, BARON_SKIN_LIMB);
    disc(ctx, 19, 89, 2, BARON_PAL.skin[1]);
    baronClaws(ctx, 18, 88, 2);
    baronHorn(ctx, 27, 74, -1);
    baronHorn(ctx, 33, 73, 1);
    fleshBlob(ctx, 30, 78, 5.5, 5, BARON_PAL.skin, rnd, 0.05);
    px(ctx, 28, 78, BARON_PAL.eye[1]); // гаснущие глаза
    px(ctx, 32, 78, BARON_PAL.eye[1]);
    hline(ctx, 27, 33, 81, BARON_PAL.skin[0]);
    px(ctx, 28, 80, BARON_PAL.teeth[1]);
    px(ctx, 32, 80, BARON_PAL.teeth[1]);
    splatter(ctx, rnd, 44, 84, 10, BARON_PAL.blood);
    return;
  }
  // st === 4 — труп: низкий, в луже крови (кадр остаётся в мире)
  bloodPool(ctx, rnd, 48, 92, 22, 3.4, BARON_PAL.blood);
  shadedLimb(ctx, 60, 89, 78, 91, 3, BARON_FUR_LIMB);
  baronHoof(ctx, 82, 93);
  shadedLimb(ctx, 58, 92, 74, 94, 2.4, BARON_FUR_LIMB);
  baronHoof(ctx, 77, 95);
  fleshBlob(ctx, 47, 89, 16, 4.4, BARON_PAL.skin, rnd, 0.1);
  baronWaist(ctx, 56, 89, 5);
  shadedLimb(ctx, 38, 91, 16, 93, 2.4, BARON_SKIN_LIMB);
  baronClaws(ctx, 14, 91, 2);
  baronHorn(ctx, 25, 85, -1);
  baronHorn(ctx, 31, 84, 1);
  fleshBlob(ctx, 28, 88, 5, 3.4, BARON_PAL.skin, rnd, 0.05);
  px(ctx, 26, 88, BARON_PAL.skin[0]); // закрытые глаза
  px(ctx, 30, 88, BARON_PAL.skin[0]);
  hline(ctx, 25, 31, 90, BARON_PAL.skin[0]);
  px(ctx, 26, 89, BARON_PAL.teeth[0]);
  px(ctx, 30, 89, BARON_PAL.teeth[0]);
  splatter(ctx, rnd, 42, 90, 8, BARON_PAL.blood);
}

function buildBaron(m) {
  for (const name of ['walk0', 'walk1', 'walk2', 'walk3', 'attack0', 'attack1', 'attack2', 'pain0']) {
    addFrame(m, 'baron_' + name, 96, (ctx, rnd) => baronFrame(ctx, rnd, BARON_POSES[name]));
  }
  for (let i = 0; i < 5; i++) {
    addFrame(m, 'baron_die' + i, 96, (ctx, rnd) => baronDie(ctx, rnd, i));
  }
}

// ===================== Экспорт =====================

export function generateSprites() {
  const m = new Map();
  buildCacodemon(m);
  buildBaron(m);
  return m;
}
