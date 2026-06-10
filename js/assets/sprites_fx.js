// HELLBOUND — спрайты снарядов и эффектов (§9, агент A5).
// Всё генерируется кодом: пиксель-арт по сетке, без градиентов и сглаживания.
// Случайность — только детерминированная (mulberry32 / позиционный хеш),
// картинка идентична между запусками. Снаряды/попадания 32×32, взрывы и BFG 64×64,
// всё центрировано (летающие объекты — по центру канваса, §4).

// ---------------------------------------------------------------------------
// Детерминированная случайность
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Позиционный хеш: стабильный «шум», не зависящий от порядка обхода пикселей.
function hash2(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 974711)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Канвас и пиксельные примитивы
// ---------------------------------------------------------------------------

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function px(ctx, x, y, color, alpha = 1) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) return;
  if (alpha <= 0) return;
  const a = alpha >= 1 ? 1 : Math.max(0.52, alpha);
  ctx.fillStyle = a >= 1 ? color : rgba(color, a);
  ctx.fillRect(x, y, 1, 1);
}

// ---------------------------------------------------------------------------
// Палитры (§4)
// ---------------------------------------------------------------------------

const FIRE = ['#7a1f08', '#c44d12', '#f08a1d', '#ffd24a', '#fff6c9'];
const PLASMA = ['#123a6e', '#2a86d4', '#46c8ff', '#9ce6ff', '#e8fbff'];
const VIOLET = ['#1c1042', '#46249c', '#7a4ae0', '#b08aff', '#e8dcff'];
const GREEN = ['#11380d', '#1c6b1c', '#2cab2c', '#7ade3f', '#d6ff9e'];
const GREEN_HOT = ['#1c6b1c', '#2cab2c', '#7ade3f', '#d6ff9e', '#f4ffd6'];
const SMOKE = ['#2e3138', '#494e58', '#6d7380', '#99a0ad'];
const BLOOD = ['#3d0a0a', '#6e1111', '#a51c1c', '#d23b1e'];

// ---------------------------------------------------------------------------
// Общие рисовальщики
// ---------------------------------------------------------------------------

// Пиксельный шар: рваная кромка (шум), тёмный обод, ярусы тонов с дизерингом.
// По умолчанию блик сверху-слева (§4); opts.centerHot — горячее ядро в центре
// (для вспышек). opts.halo — полупрозрачный дизеренный ореол вокруг.
function fxBall(ctx, cx, cy, r, tones, seed, opts = {}) {
  const rough = opts.rough !== undefined ? opts.rough : 0.9;
  const halo = opts.halo !== undefined ? opts.halo : 0;
  const haloColor = opts.haloColor || tones[Math.min(2, tones.length - 1)];
  const hx = cx - r * 0.38;
  const hy = cy - r * 0.42;
  const n = tones.length;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const x0 = Math.max(0, Math.floor(cx - r - halo - 2));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + halo + 2));
  const y0 = Math.max(0, Math.floor(cy - r - halo - 2));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + halo + 2));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const e = hash2(x, y, seed);
      const rr = r + (e - 0.5) * 2 * rough;
      if (d > rr) {
        // дизеренный ореол свечения (полупрозрачность допустима у огня/плазмы)
        if (halo > 0 && d < rr + halo && ((x + y) & 1) === 0) {
          px(ctx, x, y, haloColor, d < rr + halo * 0.5 ? 0.56 : 0.52);
        }
        continue;
      }
      let t;
      if (opts.centerHot) {
        t = 1 - Math.min(1, d / Math.max(1, rr));
      } else {
        const hdx = x + 0.5 - hx;
        const hdy = y + 0.5 - hy;
        t = 1 - Math.min(1, Math.sqrt(hdx * hdx + hdy * hdy) / (r * 1.85));
      }
      let ti = Math.floor(t * n);
      const f = t * n - ti;
      if (f > 0.55 && ((x + y) & 1) === 0) ti++; // дизеринг между ярусами
      if (d > rr - 1.25) ti = 0;                 // тёмный обод (не чисто чёрный)
      else if (d > rr - 2.3 && ti > 1) ti--;
      px(ctx, x, y, tones[Math.max(0, Math.min(n - 1, ti))]);
    }
  }
}

// Комковатое облако из нескольких «долей» (дым, расползающийся огонь).
// mode 'smoke' — свет сверху-слева; mode 'fire' — горячее ядро в центре.
// density<1 — прорехи рассеивания, holes — тёмные пятна копоти внутри.
function cloud(ctx, cx, cy, r, tones, seed, opts = {}) {
  const rng = mulberry32(seed);
  const lumpsN = opts.lumps !== undefined ? opts.lumps : 5;
  const density = opts.density !== undefined ? opts.density : 1;
  const alpha = opts.alpha !== undefined ? opts.alpha : 1;
  const rough = opts.rough !== undefined ? opts.rough : 0.6;
  const mode = opts.mode || 'smoke';
  const holes = opts.holes !== undefined ? opts.holes : 0;
  const holeColor = opts.holeColor || null;
  const lumps = [{ x: cx, y: cy, r: r * 0.85 }];
  for (let i = 0; i < lumpsN; i++) {
    const a = rng() * Math.PI * 2;
    const d = (0.25 + rng() * 0.45) * r;
    lumps.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d * 0.8,
      r: r * (0.35 + rng() * 0.4),
    });
  }
  const n = tones.length;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let field = 1e9;
      for (let i = 0; i < lumps.length; i++) {
        const L = lumps[i];
        const ddx = x + 0.5 - L.x;
        const ddy = y + 0.5 - L.y;
        const dd = Math.sqrt(ddx * ddx + ddy * ddy) / L.r;
        if (dd < field) field = dd;
      }
      const e = hash2(x, y, seed);
      if (field + (e - 0.5) * rough > 1) continue;
      if (density < 1 && hash2(x * 3 + 11, y * 5 + 7, seed ^ 0x5bd1) > density) continue;
      if (holes > 0 && hash2(x + 17, y + 29, seed ^ 0x2c1b) < holes) {
        if (holeColor) px(ctx, x, y, holeColor, alpha);
        continue;
      }
      let t;
      if (mode === 'fire') {
        t = 1 - field + (e - 0.5) * 0.25;
      } else {
        const u = (x + 0.5 - cx) / r;
        const v = (y + 0.5 - cy) / r;
        t = 0.62 - u * 0.2 - v * 0.34 + (1 - field) * 0.25 + (e - 0.5) * 0.2;
      }
      let ti = Math.floor(Math.max(0, Math.min(0.999, t)) * n);
      if (t * n - ti > 0.5 && ((x + y) & 1) === 0 && ti < n - 1) ti++;
      px(ctx, x, y, tones[Math.max(0, Math.min(n - 1, ti))], field > 0.82 ? alpha * 0.7 : alpha);
    }
  }
}

// Разлетающиеся искры/угольки в кольце rMin..rMax вокруг центра.
function sparks(ctx, cx, cy, rMin, rMax, colors, seed, count, alpha = 1) {
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const d = rMin + rng() * (rMax - rMin);
    px(ctx, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d),
      colors[Math.floor(rng() * colors.length)], alpha);
  }
}

// Корона: короткие рваные языки по окружности шара, гаснут к кончику.
function corona(ctx, cx, cy, r, tones, seed, count, maxLen) {
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const len = 1 + rng() * maxLen;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let s = 0; s < len; s++) {
      let ti = Math.round((1 - s / len) * (tones.length - 1));
      ti = Math.max(0, Math.min(tones.length - 2, ti));
      px(ctx, Math.round(cx + ca * (r + s)), Math.round(cy + sa * (r + s)), tones[ti]);
    }
  }
}

// Электрические дуги поперёк шара (молнии какодемона/BFG/плазмы).
function arcs(ctx, cx, cy, r, colMain, colBright, seed, count) {
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const a0 = rng() * Math.PI * 2;
    const a1 = a0 + Math.PI * (0.6 + rng() * 0.8);
    const sx = cx + Math.cos(a0) * r * 0.75;
    const sy = cy + Math.sin(a0) * r * 0.75;
    const ex = cx + Math.cos(a1) * r * 0.75;
    const ey = cy + Math.sin(a1) * r * 0.75;
    const steps = Math.max(5, Math.round(r * 1.7));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(sx + (ex - sx) * t + (rng() - 0.5) * 2.2);
      const y = Math.round(sy + (ey - sy) * t + (rng() - 0.5) * 2.2);
      px(ctx, x, y, s % 3 === 1 ? colBright : colMain);
    }
  }
}

// Хвост пламени влево от шара (волнистые языки, гаснущие к кончику).
function flameTail(ctx, cx, cy, r, tones, seed, len, phase) {
  const rng = mulberry32(seed);
  for (let i = 0; i < 4; i++) {
    const off = (rng() - 0.5) * r * 1.2;
    const amp = 0.8 + rng() * 1.6;
    const fr = 0.55 + rng() * 0.5;
    const l = len * (0.6 + rng() * 0.4);
    for (let s = 0; s < l; s++) {
      const x = Math.round(cx - r * 0.55 - s);
      const y = Math.round(cy + off + Math.sin(s * fr + phase + i * 1.9) * amp);
      const t = 1 - s / l;
      let ti = Math.floor(t * (tones.length - 1));
      if (hash2(x, y, seed) < 0.25 && ti > 0) ti--;
      px(ctx, x, y, tones[ti]);
      if (t > 0.55) px(ctx, x, y + 1, tones[Math.max(0, ti - 1)]);
    }
  }
}

// Вспышка-звезда: лучи + горячее ядро с ореолом.
function flashStar(ctx, cx, cy, coreR, rayLen, tones, seed, rays) {
  const rng = mulberry32(seed);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const len = rayLen * (0.55 + rng() * 0.5);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let s = 0; s < len; s++) {
      const t = s / len;
      const x = Math.round(cx + ca * (coreR * 0.5 + s));
      const y = Math.round(cy + sa * (coreR * 0.5 + s));
      const ti = Math.max(1, Math.round((1 - t) * (tones.length - 1)));
      px(ctx, x, y, tones[ti]);
      if (t < 0.4) px(ctx, x + 1, y, tones[Math.max(1, ti - 1)]);
    }
  }
  fxBall(ctx, cx, cy, coreR, tones, seed + 1, {
    rough: 1.0, halo: 3, haloColor: tones[2], centerHot: true,
  });
}

// ---------------------------------------------------------------------------
// Снаряды (32×32, кроме bfgball 64×64)
// ---------------------------------------------------------------------------

function buildFireball(f) {
  const ctx = makeCanvas(32);
  const seed = 0xf14e + f * 977;
  flameTail(ctx, 16, 16, 6, FIRE, seed + 5, 9 + f, 1.2 + f * 2.1);
  fxBall(ctx, 16.5 + f * 0.4, 16, 6 + f * 0.4, FIRE, seed, {
    rough: 1.5, halo: 3, haloColor: '#f08a1d',
  });
  sparks(ctx, 9, 16, 7, 12, ['#ffd24a', '#f08a1d'], seed + 9, 5);
  return ctx;
}

function buildCacoball(f) {
  const ctx = makeCanvas(32);
  const seed = 0xcac0 + f * 613;
  sparks(ctx, 8, 16, 2, 6, ['#7a4ae0', '#b08aff'], seed + 3, 6, 0.8);
  fxBall(ctx, 17, 16, 6.4 - f * 0.5, VIOLET, seed, {
    rough: 1.1, halo: 3, haloColor: '#7a4ae0',
  });
  arcs(ctx, 17, 16, 6.2 - f * 0.5, '#b08aff', '#e8dcff', seed + 7, 3);
  return ctx;
}

function buildBaronball(f) {
  const ctx = makeCanvas(32);
  const seed = 0xba04 + f * 449;
  flameTail(ctx, 16, 16, 5.6, GREEN, seed + 4, 8 + f, 0.7 + f * 1.9);
  fxBall(ctx, 16.5, 16, 5.8 + f * 0.3, GREEN, seed, {
    rough: 1.6, halo: 3, haloColor: '#2cab2c',
  });
  sparks(ctx, 10, 16, 6, 11, ['#7ade3f', '#d6ff9e'], seed + 9, 4);
  return ctx;
}

function buildPlasmaball(f) {
  const ctx = makeCanvas(32);
  const seed = 0x91a5 + f * 521;
  fxBall(ctx, 16, 16, 5.4 + f * 0.3, PLASMA, seed, {
    rough: 1.0, halo: 3, haloColor: '#46c8ff',
  });
  corona(ctx, 16, 16, 5.4 + f * 0.3, ['#2a86d4', '#46c8ff', '#9ce6ff'], seed + 2, 9, 2.2);
  arcs(ctx, 16, 16, 4.4, '#9ce6ff', '#e8fbff', seed + 5, 2);
  return ctx;
}

function buildBfgball(f) {
  const ctx = makeCanvas(64);
  const seed = 0xbf60 + f * 389;
  const r = f === 0 ? 16.5 : 14.5;
  fxBall(ctx, 32, 32, r, GREEN, seed, { rough: 2.2, halo: 5, haloColor: '#2cab2c' });
  corona(ctx, 32, 32, r, GREEN, seed + 2, 20, f === 0 ? 5 : 3.5);
  arcs(ctx, 32, 32, r * 0.8, '#d6ff9e', '#f4ffd6', seed + 7, 4);
  sparks(ctx, 32, 32, r + 3, r + 8, ['#7ade3f', '#d6ff9e'], seed + 11, 10, 0.85);
  return ctx;
}

// Ракета сзади-сбоку: серая труба, красная боеголовка, стабилизаторы, выхлоп.
function buildRocket() {
  const ctx = makeCanvas(32);
  const seed = 0xa0c7e7;
  const rng = mulberry32(seed);
  // клочья дыма за соплом (полупрозрачный дым допустим)
  for (let i = 0; i < 12; i++) {
    px(ctx, 2 + Math.floor(rng() * 7), 13 + Math.floor(rng() * 7), SMOKE[1], 0.54);
  }
  // выхлопное пламя
  flameTail(ctx, 11, 16, 3, FIRE, seed + 1, 7, 0.8);
  fxBall(ctx, 10, 15.5, 2.9, FIRE, seed + 2, {
    rough: 1.3, halo: 2, haloColor: '#f08a1d', centerHot: true,
  });
  // корпус-труба: свет сверху, тёмный контур
  const rows = [
    [13, '#1b1d22'], [14, '#99a0ad'], [15, '#6d7380'],
    [16, '#494e58'], [17, '#2e3138'], [18, '#1b1d22'],
  ];
  for (let i = 0; i < rows.length; i++) {
    for (let x = 12; x <= 23; x++) px(ctx, x, rows[i][0], rows[i][1]);
  }
  // сопло и стыки панелей корпуса
  for (let y = 14; y <= 17; y++) {
    px(ctx, 12, y, '#1b1d22');
    px(ctx, 17, y, '#2e3138');
    px(ctx, 21, y, '#2e3138');
  }
  px(ctx, 19, 14, '#c2c8d4'); // заклёпка-блик
  // боеголовка (красный конус)
  for (let y = 14; y <= 17; y++) {
    const c = y <= 15 ? '#a51c1c' : '#6e1111';
    px(ctx, 24, y, c);
    px(ctx, 25, y, c);
  }
  px(ctx, 24, 14, '#d23b1e');
  px(ctx, 25, 14, '#d23b1e');
  px(ctx, 26, 15, '#a51c1c');
  px(ctx, 26, 16, '#6e1111');
  px(ctx, 27, 15, '#6e1111');
  px(ctx, 27, 16, '#3d0a0a');
  px(ctx, 24, 13, '#3d0a0a');
  px(ctx, 25, 13, '#3d0a0a');
  px(ctx, 24, 18, '#3d0a0a');
  px(ctx, 25, 18, '#3d0a0a');
  px(ctx, 26, 14, '#3d0a0a');
  px(ctx, 26, 17, '#3d0a0a');
  // стабилизаторы: верхний светлее (свет сверху), нижний в тени
  for (let k = 0; k < 3; k++) {
    for (let x = 12; x <= 13 + k; x++) {
      px(ctx, x, 10 + k, ['#6d7380', '#494e58', '#2e3138'][k]);
      px(ctx, x, 21 - k, ['#1b1d22', '#2e3138', '#494e58'][k]);
    }
  }
  for (let y = 10; y <= 12; y++) px(ctx, 11, y, '#1b1d22');
  for (let y = 19; y <= 21; y++) px(ctx, 11, y, '#1b1d22');
  return ctx;
}

// ---------------------------------------------------------------------------
// Эффекты
// ---------------------------------------------------------------------------

// Дымок попадания в стену: растёт, поднимается, рассеивается.
function buildPuff(f) {
  const ctx = makeCanvas(32);
  const seed = 0x9f0f + f * 233;
  const r = 4.6 + f * 1.6;
  const cy = 16.5 - f * 1.1;
  const tones = f === 0 ? SMOKE.slice(1) : f === 3 ? SMOKE.slice(0, 3) : SMOKE;
  cloud(ctx, 16, cy, r, tones, seed, {
    mode: 'smoke', lumps: 4 + f, rough: 0.75,
    density: 1 - f * 0.16, alpha: 0.95 - f * 0.14,
  });
  if (f === 0) {
    // свежий горячий дымок — пара светлых пикселей в ядре
    px(ctx, 16, Math.round(cy) - 1, '#c2c8d4');
    px(ctx, 15, Math.round(cy), '#b0b6c2');
  }
  return ctx;
}

// Брызги крови: один набор капель, физика по кадрам (разлёт → падение).
function buildBlood(f) {
  const ctx = makeCanvas(32);
  const rng = mulberry32(0xb10d5e);
  const drops = [];
  for (let j = 0; j < 30; j++) {
    drops.push({
      a: rng() * Math.PI * 2,
      v: 0.8 + rng() * 3.4,
      c: 1 + Math.floor(rng() * 3),
      big: rng() < 0.4,
      late: rng() < 0.62,
    });
  }
  if (f === 0) fxBall(ctx, 16, 15, 3.4, BLOOD, 0x51a6, { rough: 1.9 });
  else if (f === 1) fxBall(ctx, 16, 15.5, 2.1, BLOOD.slice(0, 3), 0x51a7, { rough: 2.1 });
  const t = 0.5 + f * 0.5;
  for (let j = 0; j < drops.length; j++) {
    const d = drops[j];
    if (f === 3 && !d.late) continue; // часть капель уже осела
    const fall = 2.6 * t * t - 1.6 * t;
    const x = Math.round(16 + Math.cos(d.a) * d.v * t);
    const y = Math.round(15 + Math.sin(d.a) * d.v * t * 0.55 + fall);
    const col = BLOOD[f >= 2 ? Math.max(1, d.c - 1) : d.c];
    px(ctx, x, y, col);
    if (f < 2) {
      if (d.big) px(ctx, x + 1, y, BLOOD[d.c - 1]);
    } else {
      px(ctx, x, y - 1, BLOOD[Math.max(0, d.c - 1)]); // вытянутая падающая капля
    }
  }
  return ctx;
}

// Взрыв 64×64: вспышка → огненный шар → расползание → тёмный дым.
function buildExplosion(f) {
  const ctx = makeCanvas(64);
  const seed = 0xe9b0 + f * 271;
  if (f === 0) {
    flashStar(ctx, 32, 32, 7, 14, FIRE, seed, 10);
    sparks(ctx, 32, 32, 16, 24, ['#fff6c9', '#ffd24a'], seed + 3, 8);
  } else if (f === 1) {
    fxBall(ctx, 32, 32, 13.5, FIRE, seed, {
      rough: 2.6, halo: 4, haloColor: '#f08a1d', centerHot: true,
    });
    corona(ctx, 32, 32, 13.5, FIRE, seed + 2, 16, 4.5);
    sparks(ctx, 32, 32, 17, 26, ['#ffd24a', '#f08a1d'], seed + 5, 12);
  } else if (f === 2) {
    cloud(ctx, 32, 32, 17.5, FIRE, seed, {
      mode: 'fire', lumps: 6, rough: 0.7, holes: 0.1, holeColor: '#3a2417',
    });
    corona(ctx, 32, 32, 16.5, FIRE, seed + 2, 14, 4);
    sparks(ctx, 32, 32, 20, 28, ['#ffd24a', '#f08a1d'], seed + 5, 10);
  } else if (f === 3) {
    cloud(ctx, 32, 32, 20, ['#3a2417', '#7a1f08', '#c44d12', '#f08a1d'], seed, {
      mode: 'fire', lumps: 7, rough: 0.8, holes: 0.22, holeColor: '#241d18',
    });
    sparks(ctx, 32, 32, 8, 24, ['#ffd24a', '#f08a1d'], seed + 5, 12);
  } else if (f === 4) {
    cloud(ctx, 32, 32, 20.5, ['#141419', '#241d18', '#3a2417', '#5b4632'], seed, {
      mode: 'smoke', lumps: 7, rough: 0.7, density: 0.88, alpha: 0.85, holes: 0.06, holeColor: '#0a0a0d',
    });
    sparks(ctx, 32, 32, 6, 18, ['#c44d12', '#7a1f08'], seed + 5, 7, 0.8);
  } else {
    cloud(ctx, 32, 32, 22, ['#141419', '#241d18', '#3a2417'], seed, {
      mode: 'smoke', lumps: 8, rough: 0.8, density: 0.5, alpha: 0.6,
    });
    sparks(ctx, 32, 32, 8, 20, ['#7a1f08', '#c44d12'], seed + 5, 4, 0.54);
  }
  return ctx;
}

// Вспышка попадания файербола/сгустка (32×32).
function buildFbHit(f) {
  const ctx = makeCanvas(32);
  const seed = 0xfb17 + f * 149;
  if (f === 0) {
    flashStar(ctx, 16, 16, 4.5, 7, FIRE, seed, 7);
  } else if (f === 1) {
    fxBall(ctx, 16, 16, 7.5, FIRE, seed, {
      rough: 2.2, halo: 3, haloColor: '#f08a1d', centerHot: true,
    });
    corona(ctx, 16, 16, 7.5, FIRE, seed + 2, 10, 3);
    sparks(ctx, 16, 16, 10, 14, ['#ffd24a', '#f08a1d'], seed + 4, 6);
  } else {
    cloud(ctx, 16, 16, 9, ['#3a2417', '#7a1f08', '#c44d12'], seed, {
      mode: 'fire', lumps: 5, rough: 0.8, density: 0.55, alpha: 0.75,
      holes: 0.15, holeColor: '#241d18',
    });
    sparks(ctx, 16, 16, 4, 10, ['#f08a1d', '#ffd24a'], seed + 4, 5, 0.8);
  }
  return ctx;
}

// Голубая вспышка плазмы (32×32).
function buildPlasmaHit(f) {
  const ctx = makeCanvas(32);
  const seed = 0x91a7 + f * 173;
  if (f === 0) {
    flashStar(ctx, 16, 16, 5, 7, PLASMA, seed, 8);
    arcs(ctx, 16, 16, 5.5, '#9ce6ff', '#e8fbff', seed + 3, 2);
  } else {
    cloud(ctx, 16, 16, 9, ['#123a6e', '#2a86d4', '#46c8ff'], seed, {
      mode: 'fire', lumps: 5, rough: 0.8, density: 0.5, alpha: 0.7,
    });
    corona(ctx, 16, 16, 7, ['#2a86d4', '#46c8ff', '#9ce6ff'], seed + 2, 8, 2.5);
    sparks(ctx, 16, 16, 5, 12, ['#9ce6ff', '#e8fbff'], seed + 4, 6, 0.8);
  }
  return ctx;
}

// Зелёная вспышка BFG (64×64).
function buildBfgHit(f) {
  const ctx = makeCanvas(64);
  const seed = 0xbf61 + f * 311;
  if (f === 0) {
    flashStar(ctx, 32, 32, 9, 16, GREEN_HOT, seed, 10);
    arcs(ctx, 32, 32, 10, '#d6ff9e', '#f4ffd6', seed + 3, 3);
  } else if (f === 1) {
    fxBall(ctx, 32, 32, 19, GREEN_HOT, seed, {
      rough: 2.8, halo: 5, haloColor: '#2cab2c', centerHot: true,
    });
    corona(ctx, 32, 32, 19, GREEN, seed + 2, 18, 5);
    arcs(ctx, 32, 32, 14, '#d6ff9e', '#f4ffd6', seed + 5, 4);
    sparks(ctx, 32, 32, 23, 30, ['#7ade3f', '#d6ff9e'], seed + 7, 14);
  } else {
    cloud(ctx, 32, 32, 21, GREEN.slice(0, 4), seed, {
      mode: 'fire', lumps: 7, rough: 0.8, density: 0.5, alpha: 0.65,
      holes: 0.18, holeColor: '#11380d',
    });
    sparks(ctx, 32, 32, 10, 26, ['#7ade3f', '#d6ff9e'], seed + 4, 12, 0.7);
  }
  return ctx;
}

function shockRing(ctx, cx, cy, r, colorA, colorB, seed) {
  const rng = mulberry32(seed);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rr = r + (rng() - 0.5) * 1.8;
    const x = Math.round(cx + Math.cos(a) * rr);
    const y = Math.round(cy + Math.sin(a) * rr);
    if ((i & 1) === 0) px(ctx, x, y, colorA, 0.58);
    else px(ctx, x, y, colorB, 0.54);
  }
}

function cinderTrail(ctx, cx, cy, seed, n, colors) {
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx - 2 - rng() * 12);
    const y = Math.round(cy + (rng() - 0.5) * 11);
    px(ctx, x, y, colors[(rng() * colors.length) | 0], 0.58);
    if (rng() < 0.35) px(ctx, x - 1, y + 1, colors[0], 0.54);
  }
}

function polishFx(key, ctx) {
  if (key.startsWith('fireball')) {
    cinderTrail(ctx, 15, 16, 0xf501 + key.charCodeAt(key.length - 1), 8, [FIRE[1], FIRE[2], FIRE[3]]);
  } else if (key.startsWith('cacoball')) {
    shockRing(ctx, 17, 16, 9, VIOLET[3], VIOLET[1], 0xca55 + key.charCodeAt(key.length - 1));
    arcs(ctx, 17, 16, 7, VIOLET[3], VIOLET[4], 0xca70 + key.charCodeAt(key.length - 1), 2);
  } else if (key.startsWith('baronball')) {
    shockRing(ctx, 16, 16, 8, GREEN[3], GREEN[1], 0xba77 + key.charCodeAt(key.length - 1));
    cinderTrail(ctx, 15, 16, 0xba78 + key.charCodeAt(key.length - 1), 7, [GREEN[1], GREEN[3], GREEN[4]]);
  } else if (key.startsWith('plasmaball')) {
    shockRing(ctx, 16, 16, 8, PLASMA[3], PLASMA[1], 0x91f0 + key.charCodeAt(key.length - 1));
  } else if (key.startsWith('bfgball')) {
    shockRing(ctx, 32, 32, key.endsWith('0') ? 22 : 19, GREEN[4], GREEN[2], 0xbf90 + key.charCodeAt(key.length - 1));
    sparks(ctx, 32, 32, 20, 30, [GREEN[3], GREEN[4]], 0xbf91 + key.charCodeAt(key.length - 1), 14, 0.58);
  } else if (key === 'rocketproj0') {
    cinderTrail(ctx, 12, 16, 0xa0c711, 12, [FIRE[0], FIRE[2], SMOKE[2]]);
  } else if (key.startsWith('puff')) {
    const f = key.charCodeAt(key.length - 1) - 48;
    shockRing(ctx, 16, 16 - f, 6 + f * 2, SMOKE[2], SMOKE[0], 0x9f80 + f);
  } else if (key.startsWith('blood')) {
    const f = key.charCodeAt(key.length - 1) - 48;
    for (let i = 0; i < 5 + f * 2; i++) {
      const x = 9 + ((hash2(i, f, 1) * 15) | 0);
      const y = 17 + f + ((hash2(i, f, 2) * 9) | 0);
      px(ctx, x, y, BLOOD[1 + ((hash2(i, f, 3) * 3) | 0)]);
    }
  } else if (key.startsWith('explosion')) {
    const f = key.charCodeAt(key.length - 1) - 48;
    if (f <= 2) shockRing(ctx, 32, 32, 16 + f * 6, FIRE[3], FIRE[1], 0xe001 + f);
    else shockRing(ctx, 32, 32, 20 + f * 2, SMOKE[2], SMOKE[0], 0xe101 + f);
    sparks(ctx, 32, 32, 12, 31, f < 4 ? [FIRE[2], FIRE[3], FIRE[4]] : [FIRE[0], SMOKE[1]], 0xe201 + f, 10 - Math.min(f, 5), 0.58);
  } else if (key.startsWith('fb_hit')) {
    const f = key.charCodeAt(key.length - 1) - 48;
    shockRing(ctx, 16, 16, 7 + f * 3, FIRE[3], FIRE[1], 0xfb90 + f);
  } else if (key.startsWith('plasma_hit')) {
    const f = key.charCodeAt(key.length - 1) - 48;
    shockRing(ctx, 16, 16, 8 + f * 3, PLASMA[3], PLASMA[1], 0x91ff + f);
  } else if (key.startsWith('bfg_hit')) {
    const f = key.charCodeAt(key.length - 1) - 48;
    shockRing(ctx, 32, 32, 18 + f * 8, GREEN_HOT[3], GREEN[1], 0xbfef + f);
    arcs(ctx, 32, 32, 14 + f * 4, GREEN_HOT[3], GREEN_HOT[4], 0xbff0 + f, 4);
  }
}

// ---------------------------------------------------------------------------
// Экспорт (§4/§9)
// ---------------------------------------------------------------------------

export function generateSprites() {
  const sprites = new Map();
  const put = (key, ctx) => {
    polishFx(key, ctx);
    sprites.set(key, ctx.canvas);
  };

  for (let f = 0; f < 2; f++) {
    put('fireball' + f, buildFireball(f));
    put('cacoball' + f, buildCacoball(f));
    put('baronball' + f, buildBaronball(f));
    put('plasmaball' + f, buildPlasmaball(f));
    put('bfgball' + f, buildBfgball(f));
    put('plasma_hit' + f, buildPlasmaHit(f));
  }
  put('rocketproj0', buildRocket());
  for (let f = 0; f < 4; f++) {
    put('puff' + f, buildPuff(f));
    put('blood' + f, buildBlood(f));
  }
  for (let f = 0; f < 6; f++) put('explosion' + f, buildExplosion(f));
  for (let f = 0; f < 3; f++) {
    put('fb_hit' + f, buildFbHit(f));
    put('bfg_hit' + f, buildBfgHit(f));
  }
  return sprites;
}
