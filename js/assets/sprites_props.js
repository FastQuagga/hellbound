// HELLBOUND — процедурные пропсы и настенные панно.
// Пиксель-арт по целочисленной сетке: все примитивы проходят через px().
// Случайность только детерминированная, без недетерминированных вызовов.

import { generateTextures } from './textures.js';

const S = 64;

// ---------------------------------------------------------------------------
// Детерминированный шум
// ---------------------------------------------------------------------------

function hash2(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 974711)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Пиксельные примитивы
// ---------------------------------------------------------------------------

function makeCanvas(w = S, h = S) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
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
  ctx.fillStyle = alpha >= 1 ? color : rgba(color, alpha);
  ctx.fillRect(x, y, 1, 1);
}

function hline(ctx, x0, x1, y, color, alpha = 1) {
  for (let x = x0; x <= x1; x++) px(ctx, x, y, color, alpha);
}

function vline(ctx, x, y0, y1, color, alpha = 1) {
  for (let y = y0; y <= y1; y++) px(ctx, x, y, color, alpha);
}

function rect(ctx, x, y, w, h, color, alpha = 1) {
  for (let yy = y; yy < y + h; yy++) hline(ctx, x, x + w - 1, yy, color, alpha);
}

function ditherRect(ctx, x, y, w, h, c0, c1, seed = 0, alpha = 1) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const pick = ((xx + yy + seed) & 1) === 0 ? c0 : c1;
      if (pick) px(ctx, xx, yy, pick, alpha);
    }
  }
}

function line(ctx, x0, y0, x1, y1, color, thick = 1, seed = 0) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  let step = 0;
  while (true) {
    if (!seed || hash2(x, y, seed) > 0.16 || step % 7 === 0) {
      const r = thick - 1;
      for (let yy = -r; yy <= r; yy++) {
        for (let xx = -r; xx <= r; xx++) {
          if (Math.abs(xx) + Math.abs(yy) <= r) px(ctx, x + xx, y + yy, color);
        }
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    step++;
  }
}

function bevelRect(ctx, x, y, w, h, base, light, dark) {
  if (base) rect(ctx, x, y, w, h, base);
  hline(ctx, x, x + w - 2, y, light);
  vline(ctx, x, y, y + h - 2, light);
  hline(ctx, x + 1, x + w - 1, y + h - 1, dark);
  vline(ctx, x + w - 1, y + 1, y + h - 1, dark);
}

function rivet(ctx, x, y, light = '#99a0ad', mid = '#6d7380', dark = '#2e3138') {
  px(ctx, x, y, light);
  px(ctx, x + 1, y, mid);
  px(ctx, x, y + 1, mid);
  px(ctx, x + 1, y + 1, dark);
}

function bitmap(ctx, x0, y0, rows, colors) {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const c = colors[rows[y][x]];
      if (c) px(ctx, x0 + x, y0 + y, c);
    }
  }
}

function fillEllipse(ctx, cx, cy, rx, ry, tones, seed = 0, alpha = 1) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      let ti;
      if (d > 0.82) ti = 0;
      else if (x < cx - rx * 0.28 && y < cy + ry * 0.2) ti = tones.length - 1;
      else if (x < cx && y < cy) ti = Math.min(tones.length - 1, tones.length - 2);
      else if (x > cx + rx * 0.42 || y > cy + ry * 0.55) ti = 1;
      else ti = Math.min(tones.length - 2, 2);
      if (seed && hash2(x, y, seed) > 0.9) ti = Math.max(1, ti - 1);
      px(ctx, x, y, tones[ti], alpha);
    }
  }
}

function ellipseBand(ctx, cx, cy, rx, ry, thick, tones, seed = 0) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d < 1 - thick || d > 1.04) continue;
      let c = tones[1];
      if (d > 0.98) c = tones[0];
      else if (x < cx - rx * 0.25 && y < cy) c = tones[3] || tones[2];
      else if (x > cx + rx * 0.32 || y > cy + ry * 0.45) c = tones[0];
      else c = tones[2] || tones[1];
      if (seed && hash2(x, y, seed) > 0.92) c = tones[0];
      px(ctx, x, y, c);
    }
  }
}

function groundShadow(ctx, cx, baseY, halfW, halfH = 3) {
  for (let y = baseY - halfH + 1; y <= baseY; y++) {
    const ny = (y - (baseY - halfH * 0.4)) / Math.max(1, halfH);
    const span = Math.max(1, Math.round(halfW * (1 - ny * ny * 0.45)));
    for (let x = cx - span; x <= cx + span; x++) {
      if (((x + y) & 1) === 0) px(ctx, x, y, '#0a0a0d');
    }
  }
}

// ---------------------------------------------------------------------------
// Палитры
// ---------------------------------------------------------------------------

const METAL = ['#1b1d22', '#2e3138', '#494e58', '#6d7380', '#99a0ad'];
const RUST = ['#3a2417', '#6b3a24', '#9c5a2e', '#c97f45'];
const BLOOD = ['#3d0a0a', '#6e1111', '#a51c1c', '#d23b1e', '#ff6b3d'];
const BONE = ['#5c4632', '#8a6b48', '#c8a06e', '#e8cfa0'];
const FIRE = ['#7a1f08', '#c44d12', '#f08a1d', '#ffd24a', '#fff6c9'];
const ACID = ['#15300f', '#2c5e1a', '#3aa32a', '#7ade3f'];
const OUT = '#141419';

// ---------------------------------------------------------------------------
// Общие формы для пропсов
// ---------------------------------------------------------------------------

function drawBoneStick(ctx, x0, y0, x1, y1, seed = 0) {
  line(ctx, x0, y0, x1, y1, BONE[1], 2);
  line(ctx, x0, y0 - 1, x1, y1 - 1, BONE[3], 1);
  line(ctx, x0, y0 + 1, x1, y1 + 1, BONE[0], 1);
  fillEllipse(ctx, x0, y0, 3, 2, [BONE[0], BONE[1], BONE[2], BONE[3]], seed + 1);
  fillEllipse(ctx, x1, y1, 3, 2, [BONE[0], BONE[1], BONE[2], BONE[3]], seed + 2);
}

function drawSkull(ctx, cx, baseY, seed = 0, small = false) {
  const rows = small
    ? [[-2, 2], [-4, 4], [-5, 5], [-5, 5], [-5, 5], [-4, 4], [-4, 4], [-3, 3], [-4, 4], [-3, 3]]
    : [[-3, 3], [-5, 5], [-6, 6], [-7, 7], [-7, 7], [-7, 7], [-6, 6], [-6, 6], [-5, 5], [-4, 4], [-5, 5], [-4, 4], [-4, 4]];
  const top = baseY - rows.length + 1;
  for (let j = 0; j < rows.length; j++) {
    const [a, b] = rows[j];
    for (let x = cx + a; x <= cx + b; x++) {
      let c = BONE[2];
      if (x === cx + a || x === cx + b || j === rows.length - 1) c = BONE[0];
      else if (x < cx - 2 && j < rows.length - 3) c = BONE[3];
      else if (x > cx + 3 || j > rows.length - 4) c = BONE[1];
      if (hash2(x, top + j, seed) > 0.93) c = BONE[1];
      px(ctx, x, top + j, c);
    }
  }
  const ey = top + (small ? 4 : 5);
  rect(ctx, cx - (small ? 3 : 4), ey, small ? 3 : 4, 2, '#141419');
  rect(ctx, cx + 1, ey, small ? 3 : 4, 2, '#141419');
  px(ctx, cx - 2, ey - 1, BONE[0]);
  px(ctx, cx + 2, ey - 1, BONE[0]);
  px(ctx, cx, ey + 2, '#141419');
  px(ctx, cx - 1, ey + 3, BONE[0]);
  px(ctx, cx + 1, ey + 3, BONE[0]);
  const ty = baseY - 1;
  hline(ctx, cx - 3, cx + 3, ty, BONE[3]);
  for (let x = cx - 2; x <= cx + 2; x += 2) px(ctx, x, ty + 1, '#5c4632');
}

function drawRock(ctx, x, y, w, h, seed) {
  for (let yy = 0; yy < h; yy++) {
    const left = ((hash2(x, y + yy, seed) * 3) | 0) + (yy < 2 ? 1 : 0);
    const right = ((hash2(x + w, y + yy, seed) * 3) | 0) + (yy > h - 3 ? 1 : 0);
    for (let xx = left; xx < w - right; xx++) {
      let c = METAL[2];
      if (yy === 0 || xx === left) c = METAL[4];
      else if (yy >= h - 2 || xx >= w - right - 1) c = METAL[0];
      else if (xx < w * 0.35 && yy < h * 0.45) c = METAL[3];
      else if (hash2(x + xx, y + yy, seed + 3) > 0.88) c = METAL[1];
      px(ctx, x + xx, y + yy, c);
    }
  }
}

function drawFlame(ctx, cx, baseY, w, h, seed, sway = 0) {
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const y = baseY - j;
    const bend = Math.round(sway * t + (hash2(11, j, seed) - 0.5) * 2.1 * t);
    const hw = Math.max(1, Math.round((w * 0.5) * (1 - t * t) + (hash2(3, j, seed) - 0.5) * 1.6));
    for (let x = cx - hw + bend; x <= cx + hw + bend; x++) {
      if (t > 0.35 && hash2(x, y, seed) > 0.84) continue;
      const dc = Math.abs(x - cx - bend) / Math.max(1, hw);
      const heat = (1 - t) * (1 - dc * 0.72);
      let c = FIRE[0];
      if (heat > 0.76) c = FIRE[4];
      else if (heat > 0.55) c = FIRE[3];
      else if (heat > 0.34) c = FIRE[2];
      else if (heat > 0.16) c = FIRE[1];
      px(ctx, x, y, c);
    }
  }
}

function drawChainLink(ctx, cx, cy, vertical, seed) {
  if (vertical) {
    ellipseBand(ctx, cx, cy, 4, 6, 0.42, [METAL[0], METAL[1], METAL[3], METAL[4]], seed);
  } else {
    ellipseBand(ctx, cx, cy, 6, 4, 0.42, [METAL[0], METAL[1], METAL[3], METAL[4]], seed);
  }
  if (hash2(cx, cy, seed) > 0.42) px(ctx, cx + 2, cy + 2, RUST[2]);
  if (hash2(cx + 7, cy, seed) > 0.62) px(ctx, cx - 2, cy - 1, RUST[1]);
}

function drawHook(ctx, cx, topY) {
  line(ctx, cx, topY, cx, topY + 10, METAL[3], 2);
  line(ctx, cx + 1, topY + 10, cx + 6, topY + 16, METAL[2], 2);
  line(ctx, cx + 6, topY + 16, cx + 4, topY + 22, METAL[2], 2);
  line(ctx, cx + 4, topY + 22, cx - 2, topY + 23, METAL[1], 2);
  line(ctx, cx + 1, topY, cx + 1, topY + 10, METAL[0], 1);
  px(ctx, cx - 1, topY + 2, METAL[4]);
  px(ctx, cx + 5, topY + 18, RUST[2]);
}

// ---------------------------------------------------------------------------
// Спрайты
// ---------------------------------------------------------------------------

function drawSkullPile(ctx) {
  groundShadow(ctx, 32, 63, 18, 4);
  drawBoneStick(ctx, 18, 61, 43, 58, 401);
  drawBoneStick(ctx, 25, 60, 48, 62, 402);
  for (const x of [16, 21, 44, 49]) vline(ctx, x, 57, 62, BONE[x & 1 ? 1 : 2]);
  drawSkull(ctx, 23, 50, 410);
  drawSkull(ctx, 37, 50, 411);
  drawSkull(ctx, 31, 43, 412, true);
  drawSkull(ctx, 17, 59, 413, true);
  drawSkull(ctx, 44, 59, 414, true);
  for (let i = 0; i < 18; i++) {
    const x = 15 + ((hash2(i, 3, 420) * 35) | 0);
    const y = 52 + ((hash2(i, 7, 421) * 11) | 0);
    px(ctx, x, y, hash2(x, y, 422) > 0.5 ? BONE[0] : BONE[3]);
  }
}

function drawBones(ctx) {
  groundShadow(ctx, 32, 63, 23, 3);
  // Грудная клетка на боку.
  line(ctx, 20, 51, 34, 58, BONE[2], 2);
  line(ctx, 20, 52, 34, 59, BONE[0], 1);
  for (let i = 0; i < 6; i++) {
    const sx = 22 + i * 2;
    line(ctx, sx, 52 + (i >> 1), sx - 5, 58 + (i & 1), BONE[2], 1);
    line(ctx, sx + 1, 53 + (i >> 1), sx + 6, 60 + (i & 1), BONE[1], 1);
  }
  drawBoneStick(ctx, 8, 61, 30, 55, 501);
  drawBoneStick(ctx, 34, 61, 56, 58, 502);
  drawBoneStick(ctx, 39, 53, 53, 47, 503);
  drawSkull(ctx, 43, 61, 504, true);
  for (let i = 0; i < 14; i++) {
    const x = 6 + ((hash2(i, 9, 505) * 50) | 0);
    const y = 56 + ((hash2(i, 11, 506) * 7) | 0);
    px(ctx, x, y, hash2(x, y, 507) > 0.55 ? BONE[1] : BONE[2]);
  }
}

function drawRubble(ctx) {
  groundShadow(ctx, 32, 63, 23, 4);
  line(ctx, 18, 49, 8, 36, RUST[2], 1);
  line(ctx, 41, 50, 55, 38, RUST[1], 1);
  line(ctx, 35, 46, 45, 34, RUST[2], 1);
  px(ctx, 8, 36, RUST[3]);
  px(ctx, 55, 38, RUST[3]);
  drawRock(ctx, 9, 52, 17, 10, 601);
  drawRock(ctx, 22, 44, 18, 19, 602);
  drawRock(ctx, 37, 50, 18, 12, 603);
  drawRock(ctx, 15, 39, 16, 13, 604);
  drawRock(ctx, 34, 39, 12, 12, 605);
  for (let i = 0; i < 26; i++) {
    const x = 7 + ((hash2(i, 2, 606) * 50) | 0);
    const y = 48 + ((hash2(i, 5, 607) * 15) | 0);
    px(ctx, x, y, hash2(x, y, 608) > 0.55 ? METAL[1] : METAL[3]);
  }
}

function drawShell(ctx, x, y, mode, seed) {
  const dark = '#9c5a2e';
  const mid = '#c97f45';
  const hi = '#ffd24a';
  if (mode === 0) {
    hline(ctx, x, x + 5, y, mid);
    hline(ctx, x + 1, x + 5, y - 1, hi);
    hline(ctx, x, x + 4, y + 1, dark);
    px(ctx, x, y - 1, '#6b3a24');
    px(ctx, x + 5, y, '#f08a1d');
  } else if (mode === 1) {
    line(ctx, x, y, x + 5, y - 2, mid, 1);
    line(ctx, x, y + 1, x + 5, y - 1, dark, 1);
    px(ctx, x + 1, y - 1, hi);
    px(ctx, x + 5, y - 2, '#f08a1d');
  } else {
    vline(ctx, x, y - 4, y, mid);
    vline(ctx, x + 1, y - 4, y, dark);
    px(ctx, x, y - 4, hi);
    hline(ctx, x - 1, x + 2, y, '#6b3a24');
  }
  if (hash2(x, y, seed) > 0.52) px(ctx, x + 2, y, '#ffd24a');
}

function drawShellsSpent(ctx) {
  const shells = [
    [4, 12, 0], [9, 10, 1], [15, 14, 0], [20, 12, 2], [25, 13, 1],
    [30, 10, 0], [35, 14, 2], [40, 12, 1], [46, 13, 0], [51, 10, 1],
    [56, 14, 0], [12, 14, 2], [44, 9, 0],
  ];
  for (const [x, y] of shells) {
    if (((x + y) & 1) === 0) hline(ctx, x - 1, x + 5, Math.min(15, y + 1), '#0a0a0d');
  }
  for (let i = 0; i < shells.length; i++) drawShell(ctx, shells[i][0], shells[i][1], shells[i][2], 701 + i);
}

function drawBloodPool(ctx) {
  const rows = [
    [13, 4, 8], [11, 7, 15], [9, 4, 24], [8, 6, 38],
    [7, 3, 49], [10, 51, 58], [12, 46, 62], [14, 6, 55],
  ];
  for (const [y, x0, x1] of rows) {
    for (let x = x0; x <= x1; x++) {
      if ((x === x0 || x === x1) && hash2(x, y, 801) > 0.55) continue;
      let c = BLOOD[1];
      if (y >= 13 || x < x0 + 2 || x > x1 - 2) c = BLOOD[0];
      else if (x < 18 && y < 10) c = BLOOD[2];
      px(ctx, x, y, c);
    }
  }
  ditherRect(ctx, 14, 9, 16, 2, BLOOD[2], BLOOD[1], 2);
  hline(ctx, 18, 27, 8, BLOOD[2]);
  px(ctx, 20, 8, BLOOD[3]);
  px(ctx, 21, 8, BLOOD[3]);
  for (const [x, y] of [[5, 8], [8, 6], [54, 7], [60, 11], [44, 5], [3, 13]]) {
    px(ctx, x, y, BLOOD[1]);
    if (hash2(x, y, 802) > 0.5) px(ctx, x + 1, y, BLOOD[0]);
  }
}

function drawCableCoil(ctx) {
  groundShadow(ctx, 32, 63, 22, 4);
  ellipseBand(ctx, 32, 54, 22, 9, 0.22, ['#0a0a0d', METAL[0], METAL[1], METAL[2]], 901);
  ellipseBand(ctx, 32, 53, 17, 7, 0.25, ['#0a0a0d', METAL[0], METAL[1], METAL[2]], 902);
  ellipseBand(ctx, 32, 52, 12, 5, 0.3, ['#0a0a0d', METAL[0], METAL[1], METAL[2]], 903);
  ellipseBand(ctx, 32, 51, 7, 3, 0.38, ['#0a0a0d', METAL[0], METAL[1], METAL[2]], 904);
  line(ctx, 45, 51, 54, 46, METAL[0], 2);
  line(ctx, 46, 50, 55, 45, METAL[2], 1);
  rect(ctx, 55, 42, 4, 7, RUST[1]);
  hline(ctx, 55, 58, 42, RUST[3]);
  vline(ctx, 58, 43, 48, RUST[0]);
  px(ctx, 57, 44, '#ffd24a');
  hline(ctx, 54, 59, 49, OUT);
}

function drawMonitorBroken(ctx) {
  groundShadow(ctx, 32, 63, 20, 4);
  // Тумба и основание.
  rect(ctx, 20, 56, 25, 7, METAL[1]);
  hline(ctx, 20, 44, 56, METAL[3]);
  hline(ctx, 20, 44, 62, METAL[0]);
  vline(ctx, 44, 57, 61, METAL[0]);
  hline(ctx, 19, 45, 63, OUT);
  // Корпус ЭЛТ со скошенными боками.
  for (let y = 23; y <= 56; y++) {
    const cut = y < 29 ? 29 - y : y > 51 ? y - 51 : 0;
    const x0 = 13 + cut;
    const x1 = 51 - (cut >> 1);
    for (let x = x0; x <= x1; x++) {
      let c = METAL[2];
      if (x === x0 || y === 56 || x >= x1 - 1) c = METAL[0];
      else if (y <= 25 || x < x0 + 3) c = METAL[4];
      else if (x > 43 || y > 48) c = METAL[1];
      px(ctx, x, y, c);
    }
  }
  hline(ctx, 16, 50, 22, OUT);
  vline(ctx, 12, 28, 54, OUT);
  vline(ctx, 52, 29, 53, OUT);
  // Экран и трещина.
  bevelRect(ctx, 19, 28, 27, 18, '#101216', METAL[0], METAL[3]);
  rect(ctx, 21, 30, 23, 14, '#0a0a0d');
  ditherRect(ctx, 22, 31, 21, 12, '#101216', '#141419', 4);
  line(ctx, 34, 36, 42, 30, '#e8eaf0');
  line(ctx, 34, 36, 42, 41, '#99a0ad');
  line(ctx, 34, 36, 27, 32, '#99a0ad');
  line(ctx, 34, 36, 31, 43, '#e8eaf0');
  px(ctx, 34, 36, '#ffffff');
  // Кнопки и выпавший блок.
  for (const [x, y, c] of [[19, 50, METAL[4]], [24, 50, METAL[3]], [29, 50, METAL[0]], [41, 50, BLOOD[1]]]) {
    rect(ctx, x, y, 3, 2, c);
  }
  rect(ctx, 48, 55, 4, 3, METAL[0]);
  line(ctx, 50, 58, 56, 62, METAL[0], 1);
  line(ctx, 56, 62, 61, 60, METAL[1], 1);
}

function drawCandle(ctx, frame) {
  groundShadow(ctx, 32, 63, 9, 3);
  ditherRect(ctx, 23, 61, 18, 3, BONE[1], BONE[2], 4);
  hline(ctx, 24, 39, 63, BONE[0]);
  for (let y = 50; y <= 61; y++) {
    for (let x = 27; x <= 36; x++) {
      let c = BONE[2];
      if (x === 27 || x === 36 || y === 61) c = BONE[0];
      else if (x < 31 && y < 58) c = BONE[3];
      else if (x > 33) c = BONE[1];
      if (hash2(x, y, 1000 + frame) > 0.94) c = BONE[1];
      px(ctx, x, y, c);
    }
  }
  hline(ctx, 28, 35, 49, BONE[3]);
  px(ctx, 29, 54, BONE[3]);
  px(ctx, 29, 55, BONE[3]);
  px(ctx, 34, 57, BONE[1]);
  vline(ctx, 32, 46, 49, '#3a2417');
  const sway = frame === 0 ? -2 : 2;
  const h = frame === 0 ? 7 : 6;
  px(ctx, 31 + (sway < 0 ? -1 : 1), 41, FIRE[2], 0.58);
  px(ctx, 32 + (sway < 0 ? -2 : 2), 43, FIRE[1], 0.52);
  drawFlame(ctx, 32, 46, 7, h, 1001 + frame * 29, sway);
  px(ctx, 31, 46, FIRE[4]);
}

function drawLampRed(ctx, frame) {
  groundShadow(ctx, 32, 63, 11, 3);
  for (let j = 0; j < 4; j++) {
    const hw = 6 + j;
    hline(ctx, 32 - hw, 32 + hw, 60 + j, j === 0 ? METAL[3] : METAL[1]);
    px(ctx, 32 - hw, 60 + j, METAL[4]);
    px(ctx, 32 + hw, 60 + j, METAL[0]);
  }
  rect(ctx, 30, 27, 5, 33, METAL[1]);
  vline(ctx, 30, 27, 59, METAL[3]);
  vline(ctx, 34, 27, 59, METAL[0]);
  vline(ctx, 29, 28, 58, OUT);
  vline(ctx, 35, 28, 58, OUT);
  for (const y of [36, 48]) hline(ctx, 30, 34, y, METAL[3]);
  // Красный колпак.
  const lit = frame === 0;
  const dome = [[17, 3], [18, 5], [19, 7], [20, 8], [21, 8], [22, 8], [23, 7], [24, 6], [25, 4]];
  for (const [y, hw] of dome) {
    for (let x = 32 - hw; x <= 32 + hw; x++) {
      let c = lit ? BLOOD[3] : BLOOD[1];
      if (x === 32 - hw || x === 32 + hw || y >= 24) c = lit ? BLOOD[1] : BLOOD[0];
      else if (x < 31 && y < 22) c = lit ? '#ff6b3d' : BLOOD[2];
      else if (x > 35) c = lit ? BLOOD[2] : BLOOD[0];
      px(ctx, x, y, c);
    }
  }
  hline(ctx, 25, 39, 26, METAL[0]);
  hline(ctx, 26, 38, 16, OUT);
  hline(ctx, 27, 37, 15, METAL[3]);
  if (lit) {
    for (const [x, y, a] of [[22, 20, 0.54], [42, 22, 0.54], [31, 13, 0.58], [36, 14, 0.52]]) {
      px(ctx, x, y, BLOOD[3], a);
    }
    px(ctx, 29, 19, '#ff6b3d');
    px(ctx, 30, 18, '#ff6b3d');
  }
}

function drawHangingChain(ctx) {
  for (let y = 0; y <= 42; y += 8) drawChainLink(ctx, 32 + ((y >> 3) & 1 ? 1 : -1), y + 4, ((y >> 3) & 1) === 0, 1101 + y);
  line(ctx, 31, 0, 31, 5, METAL[2], 1);
  drawHook(ctx, 32, 42);
  rect(ctx, 28, 40, 8, 3, METAL[0]);
  hline(ctx, 28, 35, 40, METAL[3]);
}

function drawGoreHang(ctx) {
  drawChainLink(ctx, 32, 4, true, 1201);
  drawChainLink(ctx, 32, 12, false, 1202);
  drawHook(ctx, 31, 12);
  // Туша с рваным контуром.
  const rows = [
    [24, -5, 6], [25, -8, 8], [26, -10, 10], [27, -11, 11], [28, -11, 12],
    [29, -12, 12], [30, -12, 12], [31, -11, 11], [32, -10, 12], [33, -11, 11],
    [34, -10, 10], [35, -9, 11], [36, -9, 10], [37, -8, 9], [38, -9, 8],
    [39, -8, 8], [40, -7, 7], [41, -7, 6], [42, -6, 6], [43, -5, 5],
    [44, -6, 4], [45, -5, 4], [46, -4, 3], [47, -4, 2], [48, -3, 2],
  ];
  for (const [y, a, b] of rows) {
    for (let x = 32 + a; x <= 32 + b; x++) {
      if (hash2(x, y, 1210) > 0.96) continue;
      let c = BLOOD[1];
      if (x === 32 + a || x === 32 + b) c = BLOOD[0];
      else if (x < 29 && y < 34) c = BLOOD[3];
      else if (x > 38 || y > 42) c = BLOOD[0];
      else if (hash2(x, y, 1211) > 0.82) c = BONE[1];
      px(ctx, x, y, c);
    }
  }
  // Рёбра и потёки.
  for (let i = 0; i < 5; i++) {
    const y = 31 + i * 3;
    line(ctx, 29, y, 38, y + 1, BONE[2], 1);
    px(ctx, 29, y, BONE[3]);
    px(ctx, 38, y + 1, BONE[0]);
  }
  vline(ctx, 33, 29, 45, BONE[1]);
  vline(ctx, 42, 32, 53, BLOOD[2]);
  vline(ctx, 24, 37, 48, BLOOD[0]);
  px(ctx, 43, 55, BLOOD[3]);
  px(ctx, 42, 59, BLOOD[1]);
}

function drawCrateSmall(ctx) {
  groundShadow(ctx, 32, 63, 24, 4);
  const x = 9, y = 33, w = 46, h = 30;
  const green = ['#1f261f', '#2f3a2f', '#3f4c3f', '#596653', '#7a856d'];
  rect(ctx, x, y, w, h, green[2]);
  ditherRect(ctx, x + 2, y + 3, w - 4, h - 5, green[2], green[1], 5);
  hline(ctx, x, x + w - 1, y, green[4]);
  vline(ctx, x, y + 1, y + h - 2, green[3]);
  hline(ctx, x, x + w - 1, y + h - 1, green[0]);
  vline(ctx, x + w - 1, y + 1, y + h - 2, green[0]);
  hline(ctx, x, x + w - 1, y + 9, green[0]);
  hline(ctx, x, x + w - 1, y + 10, green[3]);
  vline(ctx, x + 15, y + 1, y + h - 2, green[0]);
  vline(ctx, x + 30, y + 1, y + h - 2, green[3]);
  for (const [cx, cy] of [[x + 2, y + 2], [x + w - 5, y + 2], [x + 2, y + h - 5], [x + w - 5, y + h - 5]]) {
    rect(ctx, cx, cy, 4, 4, METAL[0]);
    px(ctx, cx, cy, METAL[3]);
  }
  // Трафаретная маркировка: полоса и грубый знак.
  rect(ctx, x + 18, y + 14, 19, 3, '#ffd24a');
  ditherRect(ctx, x + 18, y + 17, 19, 2, '#c97f45', null, 1);
  line(ctx, x + 13, y + 22, x + 19, y + 14, '#ffd24a', 1);
  line(ctx, x + 19, y + 14, x + 25, y + 22, '#ffd24a', 1);
  hline(ctx, x + 15, x + 23, y + 20, '#c97f45');
  hline(ctx, x - 1, x + w, y + h, OUT);
  vline(ctx, x - 1, y + 1, y + h - 1, OUT);
  vline(ctx, x + w, y + 1, y + h - 1, OUT);
}

// ---------------------------------------------------------------------------
// Настенные панно
// ---------------------------------------------------------------------------

let cachedBaseTextures = null;

function baseCanvas(base, key) {
  if (base && base.has(key)) return base.get(key);
  if (!cachedBaseTextures) cachedBaseTextures = generateTextures();
  return cachedBaseTextures.get(key);
}

function makePanelCtx(base, key) {
  const ctx = makeCanvas();
  const b = baseCanvas(base, key);
  if (b) ctx.drawImage(b, 0, 0);
  else rect(ctx, 0, 0, S, S, METAL[2]);
  return ctx;
}

function sootDrip(ctx, x, y, len, seed) {
  for (let i = 0; i < len; i++) {
    if (hash2(x, y + i, seed) > i / len) px(ctx, x, y + i, i < 3 ? '#141419' : '#0a0a0d');
    if (i > 2 && hash2(x + 2, y + i, seed) > 0.76) px(ctx, x + 1, y + i, '#141419');
  }
}

function rustDrip(ctx, x, y, len, seed) {
  for (let i = 0; i < len; i++) {
    if (hash2(x, y + i, seed) > i / len * 0.75) px(ctx, x, y + i, i < 3 ? RUST[2] : RUST[0]);
    if (hash2(x + 3, y + i, seed) > 0.82) px(ctx, x + 1, y + i, RUST[0]);
  }
}

function drawPaintTech(ctx) {
  bevelRect(ctx, 9, 15, 46, 34, METAL[1], METAL[0], METAL[4]);
  bevelRect(ctx, 12, 18, 40, 25, '#0a0a0d', METAL[0], METAL[3]);
  rect(ctx, 14, 20, 36, 21, '#101216');
  ditherRect(ctx, 15, 21, 34, 19, '#101216', '#141419', 2);
  for (const [x, y] of [[11, 17], [51, 17], [11, 45], [51, 45]]) rivet(ctx, x, y);
  // Пиксельная схема базы на экране.
  const g0 = ACID[1], g1 = ACID[2], g2 = ACID[3];
  rect(ctx, 18, 24, 8, 5, g0);
  rect(ctx, 33, 23, 10, 6, g0);
  rect(ctx, 23, 34, 9, 5, g0);
  rect(ctx, 40, 34, 7, 4, g0);
  hline(ctx, 26, 33, 26, g1);
  vline(ctx, 28, 29, 34, g1);
  hline(ctx, 32, 44, 36, g1);
  vline(ctx, 43, 29, 34, g1);
  px(ctx, 20, 25, g2);
  px(ctx, 36, 24, g2);
  px(ctx, 45, 35, '#d6ff9e');
  px(ctx, 29, 36, '#d6ff9e');
  for (let i = 0; i < 15; i++) {
    const x = 15 + i * 2;
    px(ctx, x, 45, hash2(i, 1, 1301) > 0.45 ? ACID[2] : METAL[0]);
    if (hash2(i, 2, 1302) > 0.7) px(ctx, x, 46, ACID[1]);
  }
}

function drawPaintUac(ctx) {
  bevelRect(ctx, 12, 12, 40, 40, METAL[1], METAL[4], METAL[0]);
  rect(ctx, 15, 15, 34, 34, '#101216');
  ditherRect(ctx, 16, 16, 32, 32, '#101216', '#141419', 3);
  for (const [x, y] of [[14, 14], [48, 14], [14, 48], [48, 48]]) rivet(ctx, x, y, METAL[4], METAL[3], METAL[0]);
  // Эмблема: грубая шестерня/щит и надпись UAC.
  const gold = '#ffd24a';
  const shade = '#c97f45';
  bitmap(ctx, 24, 18, [
    '..####..',
    '.######.',
    '########',
    '##.##.##',
    '########',
    '.######.',
    '..####..',
  ], { '#': shade });
  bitmap(ctx, 25, 19, [
    '.####.',
    '######',
    '##..##',
    '######',
    '.####.',
  ], { '#': gold });
  bitmap(ctx, 20, 31, [
    '#...#.###..###',
    '#...#.#..#.#..',
    '#...#.###..#..',
    '#...#.#..#.#..',
    '.###..###..###',
  ], { '#': gold });
  rect(ctx, 17, 43, 30, 5, BLOOD[3]);
  for (let x = 18; x <= 46; x += 5) line(ctx, x, 47, x + 3, 43, '#0a0a0d');
  rustDrip(ctx, 15, 50, 8, 1401);
  rustDrip(ctx, 49, 50, 7, 1402);
}

function drawVent(ctx) {
  bevelRect(ctx, 12, 18, 40, 28, '#101216', METAL[0], METAL[4]);
  bevelRect(ctx, 15, 21, 34, 19, '#0a0a0d', METAL[0], METAL[2]);
  for (let i = 0; i < 7; i++) {
    const y = 23 + i * 3;
    hline(ctx, 17, 47, y, METAL[4]);
    hline(ctx, 17, 47, y + 1, METAL[2]);
    hline(ctx, 18, 46, y + 2, '#0a0a0d');
    px(ctx, 17, y + 1, METAL[3]);
    px(ctx, 47, y + 1, METAL[0]);
  }
  for (const [x, y] of [[14, 20], [48, 20], [14, 42], [48, 42]]) rivet(ctx, x, y);
  for (const [x, len, seed] of [[21, 8, 1501], [30, 12, 1502], [39, 9, 1503], [45, 7, 1504]]) {
    sootDrip(ctx, x, 47, len, seed);
  }
}

function drawDemonPanelFigure(ctx, cx, y, center) {
  if (center) {
    rect(ctx, cx - 4, y + 10, 9, 18, BLOOD[1]);
    hline(ctx, cx - 6, cx + 6, y + 10, BLOOD[0]);
    line(ctx, cx - 3, y + 9, cx - 7, y + 4, BLOOD[0], 1);
    line(ctx, cx + 3, y + 9, cx + 7, y + 4, BLOOD[0], 1);
    rect(ctx, cx - 3, y + 6, 7, 5, BLOOD[2]);
    px(ctx, cx - 2, y + 8, FIRE[3]);
    px(ctx, cx + 2, y + 8, FIRE[3]);
    line(ctx, cx - 4, y + 20, cx - 8, y + 28, BLOOD[0], 1);
    line(ctx, cx + 4, y + 20, cx + 8, y + 28, BLOOD[0], 1);
  } else {
    drawSkull(ctx, cx, y + 27, 1601 + cx, true);
    line(ctx, cx - 5, y + 18, cx + 4, y + 26, BLOOD[0], 1);
    line(ctx, cx + 5, y + 18, cx - 4, y + 26, BLOOD[1], 1);
  }
}

function drawPaintDemon(ctx) {
  for (const [x, center] of [[8, false], [25, true], [42, false]]) {
    bevelRect(ctx, x, 12, 14, 40, '#1d241d', '#4f5b4e', '#0a0a0d');
    rect(ctx, x + 2, 15, 10, 33, '#141419');
    ditherRect(ctx, x + 2, 15, 10, 33, '#141419', '#1d241d', x);
    drawDemonPanelFigure(ctx, x + 7, 17, center);
    rustDrip(ctx, x + 5, 52, 8, 1603 + x);
    rustDrip(ctx, x + 10, 52, 6, 1604 + x);
  }
  for (let x = 10; x <= 53; x += 4) px(ctx, x, 55 + (x & 2), BLOOD[1]);
}

function drawTinyPentSkull(ctx, cx, cy) {
  bitmap(ctx, cx - 5, cy - 4, [
    '..###..',
    '.#####.',
    '##.#.##',
    '##...##',
    '.#####.',
    '..#.#..',
    '.#####.',
  ], { '#': BONE[2] });
  px(ctx, cx - 2, cy - 1, '#0a0a0d');
  px(ctx, cx + 2, cy - 1, '#0a0a0d');
  px(ctx, cx, cy + 1, '#0a0a0d');
  hline(ctx, cx - 3, cx + 3, cy + 3, BONE[0]);
}

function drawPaintPenta(ctx) {
  const cx = 32, cy = 32;
  ellipseBand(ctx, cx, cy, 22, 22, 0.08, [FIRE[1], FIRE[1], FIRE[2], FIRE[3]], 1701);
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    pts.push([cx + Math.cos(a) * 18, cy + Math.sin(a) * 18]);
  }
  const order = [0, 2, 4, 1, 3, 0];
  for (let i = 0; i < order.length - 1; i++) {
    const a = pts[order[i]];
    const b = pts[order[i + 1]];
    line(ctx, a[0], a[1], b[0], b[1], FIRE[i & 1 ? 2 : 1], i % 3 === 0 ? 2 : 1, 1710 + i);
  }
  for (const [x, y] of pts) {
    fillEllipse(ctx, x, y, 2, 2, [FIRE[1], FIRE[2], FIRE[3], FIRE[4]], 1720);
  }
  drawTinyPentSkull(ctx, cx, cy + 1);
  for (const [x, y] of [[12, 24], [17, 45], [48, 18], [53, 41], [25, 11], [39, 54]]) {
    px(ctx, x, y, hash2(x, y, 1730) > 0.4 ? BLOOD[2] : FIRE[1]);
    if (hash2(x, y, 1731) > 0.55) px(ctx, x + 1, y, BLOOD[0]);
  }
}

// ---------------------------------------------------------------------------
// Экспорты
// ---------------------------------------------------------------------------

export function generateSprites() {
  const sprites = new Map();
  const add = (key, draw, w = S, h = S) => {
    const ctx = makeCanvas(w, h);
    draw(ctx);
    sprites.set(key, ctx.canvas);
  };

  add('skull_pile', drawSkullPile);
  add('bones', drawBones);
  add('rubble', drawRubble);
  add('shells_spent', drawShellsSpent, 64, 16);
  add('blood_pool', drawBloodPool, 64, 16);
  add('cable_coil', drawCableCoil);
  add('monitor_broken', drawMonitorBroken);
  add('candle0', (ctx) => drawCandle(ctx, 0));
  add('candle1', (ctx) => drawCandle(ctx, 1));
  add('lamp_red0', (ctx) => drawLampRed(ctx, 0));
  add('lamp_red1', (ctx) => drawLampRed(ctx, 1));
  add('hanging_chain', drawHangingChain);
  add('gore_hang', drawGoreHang);
  add('crate_small', drawCrateSmall);

  return sprites;
}

export function generatePropTextures(base) {
  const textures = new Map();
  const add = (key, baseKey, draw) => {
    const ctx = makePanelCtx(base, baseKey);
    draw(ctx);
    textures.set(key, ctx.canvas);
  };

  add('PAINT_TECH', 'TECH1', drawPaintTech);
  add('PAINT_UAC', 'TECH1', drawPaintUac);
  add('VENT', 'TECH1', drawVent);
  add('PAINT_DEMON', 'MARBLE', drawPaintDemon);
  add('PAINT_PENTA', 'BRICKRED', drawPaintPenta);

  return textures;
}
