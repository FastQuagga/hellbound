// js/assets/sprites_enemies2.js — спрайты врагов imp и demon [агент A2b]
// 13 ключей на врага: <type>_walk0..3, _attack0..2, _pain0, _die0..4.
// Канвас 64×64, враг анфас, ноги/основание на нижней кромке (die4 — труп).
// Пиксель-арт по сетке, свет сверху-слева, вся случайность — mulberry32.

// ---------- Детерминированный PRNG ----------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- Палитры (по §4) ----------

const IMP_BODY = ['#241208', '#3a2417', '#6b3a24', '#9c5a2e']; // контур, тень, средний, свет
const IMP_HEAD = ['#241208', '#6b3a24', '#9c5a2e', '#c97f45'];
const IMP_LIMB = ['#241208', '#6b3a24', '#9c5a2e'];
const IMP_LEG  = ['#241208', '#3a2417', '#6b3a24'];
const BONE_L = '#e8cfa0'; // кость: шипы, рога, когти
const BONE_D = '#c8a06e';

const DEM_BODY   = ['#33101a', '#7a3340', '#b25a64', '#dd8f92']; // розовая туша «пинки»
const DEM_HAUNCH = ['#33101a', '#5c2430', '#8f4350', '#b86a72']; // таз/бёдра — темнее
const DEM_LIMB   = ['#33101a', '#7a3340', '#b25a64'];
const DEM_LEG    = ['#33101a', '#4a1a24', '#7a3340'];
const MOUTH_DK = '#1d0507';
const GUM = '#6e1111';
const TONGUE = '#a51c1c';
const TEETH_L = '#e8cfa0';
const TEETH_D = '#8a6b48';
const HOOF_PAL = ['#1b1d22', '#2e3138', '#494e58']; // копыта — тёмный металл-рог

const BLOOD = ['#3d0a0a', '#6e1111', '#a51c1c'];

// ---------- Хелперы рисования ----------

function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); }

function hline(ctx, x0, x1, y, c) { for (let x = x0; x <= x1; x++) px(ctx, x, y, c); }

function disc(ctx, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) px(ctx, x, y, c);
    }
}

function strokeLine(ctx, x0, y0, x1, y1, r, c) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) disc(ctx, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, c);
}

// Конечность: тёмный контур + средний тон + блик сверху-слева.
function limb(ctx, x0, y0, x1, y1, r, pal) {
  strokeLine(ctx, x0, y0, x1, y1, r, pal[0]);
  strokeLine(ctx, x0 - 0.5, y0 - 0.6, x1 - 0.5, y1 - 0.6, Math.max(0.8, r - 1), pal[1]);
  strokeLine(ctx, x0 - 1, y0 - 1.2, x1 - 1, y1 - 1.2, Math.max(0.75, r - 1.9), pal[2]);
}

// Эллиптическая «туша»: контурный край, 3 тона со светом сверху-слева,
// шахматный дизеринг на границах тонов, шумовые крапинки кожи через rng.
function blob(ctx, cx, cy, rx, ry, pal, rng, noise = 0) {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(63, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(63, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (d > 0.8) { px(ctx, x, y, pal[0]); continue; }
      let s = 0.62 - nx * 0.34 - ny * 0.42 - d * 0.3 + (((x + y) & 1) ? 0.07 : -0.07);
      if (noise && rng() < noise) s += rng() < 0.5 ? -0.22 : 0.18;
      px(ctx, x, y, s > 0.74 ? pal[3] : s > 0.38 ? pal[2] : pal[1]);
    }
}

// Шип/рог/ухо: основание 2px, остриё 1px, со сдвигом slant за ряд (растёт вверх от y).
function slantSpike(ctx, x, y, h, slant, light, dark) {
  for (let i = 0; i < h; i++) {
    const xx = Math.round(x + slant * i);
    px(ctx, xx, y - i, light);
    if (i < h - 2) px(ctx, xx + 1, y - i, dark);
  }
}

// Брызги крови (n — интенсивность 0..3).
function splat(ctx, rng, x, y, n) {
  for (let i = 0; i < n * 7; i++)
    px(ctx, Math.round(x + (rng() - 0.5) * 11), Math.round(y + (rng() - 0.5) * 9), BLOOD[(rng() * 3) | 0]);
}

// Лужа крови с рваным краем (под трупами; рисовать ДО тела).
function bloodPool(ctx, rng, cx, cy, rx, ry) {
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(63, Math.ceil(cy + ry));
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(63, Math.ceil(cx + rx));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny + (rng() - 0.5) * 0.5;
      if (d > 1) continue;
      let c = BLOOD[1];
      if (d > 0.62 || (((x + y) & 1) && d > 0.3)) c = BLOOD[0];
      else if (rng() < 0.1) c = BLOOD[2];
      px(ctx, x, y, c);
    }
}

// Огненный шар в руке импа: ядро из квантованных колец + языки пламени.
function fireball(ctx, rng, cx, cy, r) {
  disc(ctx, cx, cy, r, '#c44d12');
  disc(ctx, cx - 0.4, cy - 0.4, r * 0.74, '#f08a1d');
  disc(ctx, cx - 0.7, cy - 0.7, r * 0.46, '#ffd24a');
  px(ctx, Math.round(cx - 1), Math.round(cy - 1), '#fff6c9');
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, rr = r + 0.6 + rng() * 1.4;
    px(ctx, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr - 1), i & 1 ? '#f08a1d' : '#ffd24a');
  }
  px(ctx, Math.round(cx), Math.round(cy - r - 2), '#c44d12'); // язычок вверх
}

// Когти: три костяных пальца веером вниз от кисти.
function claws(ctx, x, y, spread) {
  for (const dx of [-spread, 0, spread]) {
    px(ctx, x + dx, y + 1, BONE_D);
    px(ctx, x + dx, y + 2, BONE_L);
  }
}

// ==================================================================
// IMP — бурый шипастый демон
// ==================================================================

function impLeg(ctx, hx, hy, fx, fy, side) {
  const kx = (hx + fx) / 2 + side * 2.5, ky = (hy + fy) / 2 - 1;
  limb(ctx, hx, hy, kx, ky, 2.3, IMP_LEG);
  limb(ctx, kx, ky, fx, fy - 1, 1.9, IMP_LEG);
  disc(ctx, fx, fy - 1, 1.7, IMP_LEG[1]);
  // когтистая ступня
  px(ctx, fx - 2, fy, BONE_L); px(ctx, fx, fy, BONE_L); px(ctx, fx + 2, fy, BONE_L);
}

function impArm(ctx, sx, sy, hx, hy) {
  const ex = sx + (hx - sx) * 0.45 + (hx < sx ? -1.5 : 1.5);
  const ey = sy + (hy - sy) * 0.5;
  limb(ctx, sx, sy, ex, ey, 2.1, IMP_LIMB);
  limb(ctx, ex, ey, hx, hy, 1.8, IMP_LIMB);
  claws(ctx, hx, hy, 2);
}

function impShoulder(ctx, x, y, side) {
  disc(ctx, x, y, 3.2, IMP_BODY[1]);
  disc(ctx, x - 0.5, y - 0.8, 2.3, IMP_BODY[2]);
  slantSpike(ctx, x + side, y - 3, 6, side * 0.7, BONE_L, BONE_D);
  slantSpike(ctx, x + side * 3, y - 2, 4, side * 0.9, BONE_L, BONE_D);
  slantSpike(ctx, x - side, y - 3, 3, side * 0.3, BONE_L, BONE_D);
}

function impFace(ctx, hx, hy, eyes, mouth) {
  const ey = hy - 2;
  if (eyes === 'dead') {
    px(ctx, hx - 3, ey, '#1a0c04'); px(ctx, hx + 3, ey, '#1a0c04');
  } else if (eyes === 'squint') {
    px(ctx, hx - 3, ey, '#f08a1d'); px(ctx, hx + 3, ey, '#f08a1d');
    hline(ctx, hx - 4, hx - 2, ey - 1, IMP_HEAD[0]); hline(ctx, hx + 2, hx + 4, ey - 1, IMP_HEAD[0]);
  } else {
    px(ctx, hx - 4, ey, '#f08a1d'); px(ctx, hx - 3, ey, '#ffd24a');
    px(ctx, hx + 3, ey, '#ffd24a'); px(ctx, hx + 4, ey, '#f08a1d');
    if (eyes === 'wide') { px(ctx, hx - 3, ey - 1, '#ffd24a'); px(ctx, hx + 3, ey - 1, '#ffd24a'); }
    const by = ey - (eyes === 'wide' ? 2 : 1); // злые брови
    px(ctx, hx - 2, by, IMP_HEAD[0]); px(ctx, hx - 3, by - 1, IMP_HEAD[0]); px(ctx, hx - 4, by - 1, IMP_HEAD[0]);
    px(ctx, hx + 2, by, IMP_HEAD[0]); px(ctx, hx + 3, by - 1, IMP_HEAD[0]); px(ctx, hx + 4, by - 1, IMP_HEAD[0]);
  }
  const my = hy + 3;
  if (mouth === 0) {
    hline(ctx, hx - 3, hx + 3, my, IMP_HEAD[0]);
    px(ctx, hx - 2, my + 1, BONE_L); px(ctx, hx + 2, my + 1, BONE_L); // клыки из-под губы
  } else {
    const h = mouth === 1 ? 2 : 4;
    for (let yy = -1; yy < h - 1; yy++) hline(ctx, hx - 3, hx + 3, my + yy, MOUTH_DK);
    for (const dx of [-3, -1, 1, 3]) px(ctx, hx + dx, my - 1, BONE_L); // верхние зубы
    if (mouth === 2) {
      px(ctx, hx - 1, my + h - 2, TONGUE); px(ctx, hx, my + h - 2, TONGUE);
      px(ctx, hx - 3, my + h - 2, BONE_L); px(ctx, hx + 3, my + h - 2, BONE_L); // нижние клыки
    }
  }
}

function impFrame(ctx, rng, p) {
  const o = {
    bob: 0, lean: 0, hipY: 45,
    feetL: [26, 63], feetR: [38, 63],
    armL: [20, 43], armR: [44, 43],
    armRaised: false, thrown: false, ball: 0, ballAt: null,
    mouth: 0, eyes: 'norm', bloodChest: 0, ...p,
  };
  const cx = 32 + o.lean;
  const torsoY = 36 + o.bob + Math.max(0, o.hipY - 45) * 0.6;
  const shY = torsoY - 8;
  const headX = cx + Math.round(o.lean * 0.6);
  const headY = torsoY - 17;
  // ноги
  impLeg(ctx, cx - 5, o.hipY + o.bob, o.feetL[0], o.feetL[1], -1);
  impLeg(ctx, cx + 5, o.hipY + o.bob, o.feetR[0], o.feetR[1], 1);
  // опущенные руки — за корпусом
  impArm(ctx, cx - 9, shY, o.armL[0], o.armL[1]);
  if (!o.armRaised && !o.thrown) impArm(ctx, cx + 9, shY, o.armR[0], o.armR[1]);
  // корпус
  blob(ctx, cx, torsoY, 9.5, 11, IMP_BODY, rng, 0.1);
  hline(ctx, cx - 4, cx - 1, torsoY - 3, IMP_BODY[1]); // грудные пластины
  hline(ctx, cx + 1, cx + 4, torsoY - 3, IMP_BODY[1]);
  px(ctx, cx, torsoY + 1, IMP_BODY[1]); px(ctx, cx, torsoY + 4, IMP_BODY[1]); // пресс
  if (o.bloodChest) splat(ctx, rng, cx, torsoY - 1, o.bloodChest);
  // плечи с шипами
  impShoulder(ctx, cx - 9, shY, -1);
  impShoulder(ctx, cx + 9, shY, 1);
  // шея и голова с рогами
  disc(ctx, cx, torsoY - 12, 2.6, IMP_BODY[2]);
  blob(ctx, headX, headY, 6.5, 7, IMP_HEAD, rng, 0.06);
  slantSpike(ctx, headX - 4, headY - 5, 4, -0.6, BONE_L, BONE_D);
  slantSpike(ctx, headX + 4, headY - 5, 4, 0.6, BONE_L, BONE_D);
  impFace(ctx, headX, headY, o.eyes, o.mouth);
  // файербол и атакующая рука (поверх)
  if (o.ball && o.ballAt) fireball(ctx, rng, o.ballAt[0], o.ballAt[1], o.ball === 2 ? 4.6 : 3.4);
  if (o.armRaised && o.ballAt) {
    const sx = cx + 9, bx = o.ballAt[0], byy = o.ballAt[1] + (o.ball === 2 ? 5 : 4);
    limb(ctx, sx, shY, sx + 4, shY - 4, 2.1, IMP_LIMB);
    limb(ctx, sx + 4, shY - 4, bx, byy, 1.8, IMP_LIMB);
    disc(ctx, bx, byy, 1.6, IMP_BODY[2]);
    px(ctx, bx - 2, byy - 2, BONE_L); px(ctx, bx + 2, byy - 2, BONE_L); // когти охватывают шар
  }
  if (o.thrown) { // рука выброшена к зрителю, кисть крупно
    const sx = cx + 9;
    limb(ctx, sx, shY, sx + 3, shY + 6, 2.5, IMP_LIMB);
    disc(ctx, sx + 4, shY + 8, 2.8, IMP_BODY[1]);
    disc(ctx, sx + 3.4, shY + 7.4, 1.9, IMP_BODY[3]);
    for (const [dx, dy] of [[-3, 2], [0, 4], [3, 2], [-4, -1], [4, -1]])
      px(ctx, sx + 4 + dx, shY + 8 + dy, BONE_L);
  }
}

const IMP_POSES = {
  walk0: { feetL: [26, 63], feetR: [38, 63] },
  walk1: { bob: -1, lean: -1, feetL: [23, 61], feetR: [39, 63], armL: [19, 40], armR: [45, 45] },
  walk2: { feetL: [28, 63], feetR: [36, 63] },
  walk3: { bob: -1, lean: 1, feetL: [25, 63], feetR: [41, 61], armL: [21, 45], armR: [43, 40] },
  attack0: { mouth: 1, eyes: 'wide', armRaised: true, ball: 1, ballAt: [46, 17], armL: [18, 40] },
  attack1: { mouth: 2, eyes: 'wide', armRaised: true, ball: 2, ballAt: [44, 12], armL: [17, 38], lean: -1 },
  attack2: { mouth: 2, eyes: 'wide', thrown: true, lean: 2, armL: [16, 42] },
  pain0: { mouth: 2, eyes: 'squint', lean: -2, bob: 1, armL: [17, 36], armR: [47, 36], bloodChest: 1 },
};

function impDie(ctx, rng, st) {
  if (st === 0) { // отшатнулся, руки вскинуты
    impFrame(ctx, rng, {
      lean: 2, bob: 1, mouth: 2, eyes: 'wide', bloodChest: 2,
      armL: [14, 31], armR: [50, 31], feetL: [25, 63], feetR: [40, 63],
    });
    return;
  }
  if (st === 1) { // оседает на колени
    impFrame(ctx, rng, {
      hipY: 50, bob: 6, mouth: 2, eyes: 'squint', bloodChest: 3,
      armL: [17, 52], armR: [47, 52], feetL: [22, 63], feetR: [42, 63],
    });
    return;
  }
  if (st === 2) { // заваливается на бок
    bloodPool(ctx, rng, 30, 58, 8, 2.2);
    limb(ctx, 38, 52, 46, 58, 2.2, IMP_LEG);
    limb(ctx, 46, 58, 50, 62, 1.8, IMP_LEG);
    limb(ctx, 36, 54, 43, 61, 2.2, IMP_LEG);
    blob(ctx, 31, 51, 11, 6.5, IMP_BODY, rng, 0.1);
    impShoulder(ctx, 25, 47, -1);
    blob(ctx, 21, 49, 5.5, 5, IMP_HEAD, rng, 0.06);
    slantSpike(ctx, 18, 45, 3, -0.7, BONE_L, BONE_D);
    impFace(ctx, 21, 49, 'squint', 2);
    limb(ctx, 26, 53, 16, 58, 2, IMP_LIMB);
    claws(ctx, 16, 58, 2);
    splat(ctx, rng, 30, 50, 2);
    return;
  }
  if (st === 3) { // почти на земле
    bloodPool(ctx, rng, 31, 60, 12, 2.6);
    limb(ctx, 40, 57, 50, 60, 2, IMP_LEG);
    blob(ctx, 32, 56.5, 12, 4.5, IMP_BODY, rng, 0.1);
    slantSpike(ctx, 24, 52, 4, -0.4, BONE_L, BONE_D);
    blob(ctx, 19, 57, 4.5, 3.5, IMP_HEAD, rng, 0.06);
    slantSpike(ctx, 17, 54, 3, -0.7, BONE_L, BONE_D);
    px(ctx, 18, 57, '#1a0c04'); px(ctx, 21, 57, '#1a0c04');
    limb(ctx, 26, 58, 14, 61, 1.8, IMP_LIMB);
    claws(ctx, 14, 61, 2);
    splat(ctx, rng, 32, 56, 2);
    return;
  }
  // st === 4 — труп: низкий, в луже крови (кадр остаётся в мире)
  bloodPool(ctx, rng, 32, 61, 16, 2.8);
  limb(ctx, 42, 60, 53, 61.5, 1.8, IMP_LEG);
  limb(ctx, 40, 61, 50, 62.5, 1.6, IMP_LEG);
  blob(ctx, 32, 60, 13, 3.2, IMP_BODY, rng, 0.12);
  slantSpike(ctx, 25, 57, 3, -0.5, BONE_L, BONE_D);
  blob(ctx, 18, 60.5, 3.8, 2.6, IMP_HEAD, rng, 0.06);
  slantSpike(ctx, 16, 58, 3, -0.8, BONE_L, BONE_D);
  px(ctx, 17, 60, '#1a0c04');
  limb(ctx, 25, 61, 12, 62, 1.5, IMP_LIMB);
  claws(ctx, 12, 61, 2);
  splat(ctx, rng, 30, 59, 2);
}

// ==================================================================
// DEMON — массивный розовый «пинки» с гигантской пастью
// ==================================================================

function hoof(ctx, fx, fy) {
  hline(ctx, fx - 2, fx + 2, fy - 1, HOOF_PAL[1]);
  hline(ctx, fx - 2, fx + 2, fy, HOOF_PAL[0]);
  px(ctx, fx - 2, fy - 1, HOOF_PAL[2]); // блик сверху-слева
  px(ctx, fx, fy, '#0a0a0d');           // расщеп копыта
}

function demonLeg(ctx, hx, hy, fx, fy, side) {
  const kx = (hx + fx) / 2 + side * 1.5, ky = (hy + fy) / 2;
  limb(ctx, hx, hy, kx, ky, 3.0, DEM_LEG);
  limb(ctx, kx, ky, fx, fy - 2, 2.4, DEM_LEG);
  hoof(ctx, fx, fy);
}

function demonArm(ctx, sx, sy, hx, hy) {
  const ex = sx + (hx - sx) * 0.5 + (hx < sx ? -1 : 1);
  const ey = sy + (hy - sy) * 0.45;
  limb(ctx, sx, sy, ex, ey, 2.7, DEM_LIMB);
  limb(ctx, ex, ey, hx, hy, 2.2, DEM_LIMB);
  claws(ctx, hx, hy, 2);
}

function demonEars(ctx, hx, hy) {
  slantSpike(ctx, hx - 9, hy - 4, 4, -0.8, DEM_BODY[3], DEM_BODY[1]);
  slantSpike(ctx, hx + 9, hy - 4, 4, 0.8, DEM_BODY[3], DEM_BODY[1]);
}

function demonEyes(ctx, hx, ey, mode) {
  if (mode === 'dead') {
    px(ctx, hx - 4, ey, MOUTH_DK); px(ctx, hx + 4, ey, MOUTH_DK);
    return;
  }
  if (mode === 'squint') {
    px(ctx, hx - 4, ey, BONE_D); px(ctx, hx + 4, ey, BONE_D);
    hline(ctx, hx - 5, hx - 3, ey - 1, DEM_BODY[0]); hline(ctx, hx + 3, hx + 5, ey - 1, DEM_BODY[0]);
    return;
  }
  px(ctx, hx - 5, ey, BONE_D); px(ctx, hx - 4, ey, '#fff6c9');
  px(ctx, hx + 4, ey, '#fff6c9'); px(ctx, hx + 5, ey, BONE_D);
  if (mode === 'wide') { px(ctx, hx - 4, ey - 1, '#fff6c9'); px(ctx, hx + 4, ey - 1, '#fff6c9'); }
  const by = ey - (mode === 'wide' ? 2 : 1); // нависшие надбровья
  hline(ctx, hx - 6, hx - 3, by, DEM_BODY[0]);
  hline(ctx, hx + 3, hx + 6, by, DEM_BODY[0]);
}

// Гигантская пасть: open=0 — сомкнутая с торчащими клыками, open>0 — высота зева в px.
function demonMouth(ctx, rng, cx, my, halfW, open) {
  if (open <= 0) { // сомкнутая пасть — широкая щель с клыками внахлёст «крокодилом»
    hline(ctx, cx - halfW, cx + halfW, my - 1, DEM_BODY[0]); // верхняя губа
    hline(ctx, cx - halfW, cx + halfW, my, MOUTH_DK);
    hline(ctx, cx - halfW + 1, cx + halfW - 1, my + 1, MOUTH_DK);
    hline(ctx, cx - halfW + 1, cx + halfW - 1, my + 2, GUM);
    let up = true;
    for (let x = cx - halfW + 1; x <= cx + halfW - 1; x += 2) {
      if (up) { px(ctx, x, my - 1, TEETH_L); px(ctx, x, my, TEETH_D); }
      else { px(ctx, x, my + 1, TEETH_L); px(ctx, x, my + 2, TEETH_D); }
      up = !up;
    }
    return;
  }
  const top = my - (open >> 1), bot = top + open;
  for (let y = top; y <= bot; y++) { // тёмный зев, сужается к челюстям
    const t = (y - top) / open;
    const w = Math.max(3, Math.round(halfW * (0.72 + 0.28 * Math.sin(Math.PI * t))));
    hline(ctx, cx - w, cx + w, y, MOUTH_DK);
    if (y === top || y === bot) { px(ctx, cx - w, y, GUM); px(ctx, cx + w, y, GUM); }
  }
  hline(ctx, cx - halfW + 2, cx + halfW - 2, top, GUM); // дёсны
  hline(ctx, cx - halfW + 2, cx + halfW - 2, bot, GUM);
  let k = 0;
  for (let x = cx - halfW + 2; x <= cx + halfW - 2; x += 3, k++) { // верхний ряд клыков
    px(ctx, x, top + 1, TEETH_L);
    if (open >= 6) px(ctx, x, top + 2, k & 1 ? TEETH_D : TEETH_L);
  }
  k = 0;
  for (let x = cx - halfW + 3; x <= cx + halfW - 3; x += 3, k++) { // нижний ряд клыков
    px(ctx, x, bot - 1, TEETH_L);
    if (open >= 6) px(ctx, x, bot - 2, k & 1 ? TEETH_L : TEETH_D);
  }
  if (open >= 6) { // язык в глубине
    hline(ctx, cx - 2, cx + 2, bot - 2, TONGUE);
    hline(ctx, cx - 3, cx + 3, bot - 1, TONGUE);
    px(ctx, cx + Math.round((rng() - 0.5) * 4), bot - 1, '#d23b1e'); // мокрый блик
  }
}

function demonFrame(ctx, rng, p) {
  const o = {
    bob: 0, lean: 0, hipY: 47, headDrop: 0,
    feetL: [22, 63], feetR: [42, 63],
    armL: [13, 49], armR: [51, 49],
    mouth: 0, eyes: 'norm', bloodChest: 0, drool: false, gore: false, ...p,
  };
  const cx = 32 + o.lean;
  const torsoY = 31 + o.bob + Math.max(0, o.hipY - 47) * 0.5;
  const headY = torsoY - 16 + o.headDrop;
  // задние ляжки — горбом по бокам
  blob(ctx, cx - 10, o.hipY + o.bob, 6.5, 7.5, DEM_HAUNCH, rng, 0.08);
  blob(ctx, cx + 10, o.hipY + o.bob, 6.5, 7.5, DEM_HAUNCH, rng, 0.08);
  // короткие мощные ноги с копытами
  demonLeg(ctx, cx - 10, o.hipY + o.bob + 4, o.feetL[0], o.feetL[1], -1);
  demonLeg(ctx, cx + 10, o.hipY + o.bob + 4, o.feetR[0], o.feetR[1], 1);
  // туша
  blob(ctx, cx, torsoY, 13.5, 13, DEM_BODY, rng, 0.08);
  hline(ctx, cx - 7, cx - 1, torsoY - 1, DEM_HAUNCH[1]); // грудные складки
  hline(ctx, cx + 1, cx + 7, torsoY - 1, DEM_HAUNCH[1]);
  px(ctx, cx, torsoY + 3, DEM_HAUNCH[1]); px(ctx, cx, torsoY + 6, DEM_HAUNCH[1]); // брюхо
  if (o.bloodChest) splat(ctx, rng, cx, torsoY + 2, o.bloodChest);
  // руки поверх туши
  demonArm(ctx, cx - 12, torsoY - 5, o.armL[0], o.armL[1]);
  demonArm(ctx, cx + 12, torsoY - 5, o.armR[0], o.armR[1]);
  // голова без шеи — почти целиком пасть
  blob(ctx, cx, headY, 10.5, 9, DEM_BODY, rng, 0.06);
  demonEars(ctx, cx, headY);
  demonEyes(ctx, cx, headY - 3, o.eyes);
  demonMouth(ctx, rng, cx, headY + 4, 8, o.mouth);
  const mouthBot = o.mouth > 0 ? headY + 4 - (o.mouth >> 1) + o.mouth : headY + 5;
  if (o.drool) { // слюна из углов пасти
    px(ctx, cx - 6, mouthBot + 1, TEETH_L); px(ctx, cx - 6, mouthBot + 2, TEETH_D);
    px(ctx, cx + 5, mouthBot + 1, TEETH_L);
  }
  if (o.gore) splat(ctx, rng, cx, mouthBot, 2); // кровь на морде после укуса
}

const DEMON_POSES = {
  walk0: { feetL: [22, 63], feetR: [42, 63] },
  walk1: { bob: -1, lean: -1, feetL: [18, 60], feetR: [44, 63], armL: [11, 45], armR: [53, 52] },
  walk2: { feetL: [25, 63], feetR: [39, 63] },
  walk3: { bob: -1, lean: 1, feetL: [20, 63], feetR: [46, 60], armL: [11, 52], armR: [53, 45] },
  attack0: { mouth: 5, eyes: 'wide', bob: 1, headDrop: 1, armL: [9, 42], armR: [55, 42] },
  attack1: { mouth: 12, eyes: 'wide', bob: 2, headDrop: 3, armL: [7, 36], armR: [57, 36], drool: true },
  attack2: { mouth: 0, eyes: 'squint', bob: 2, headDrop: 4, armL: [10, 44], armR: [54, 44], gore: true },
  pain0: { mouth: 4, eyes: 'squint', lean: -2, bob: 1, headDrop: -1, bloodChest: 2, armL: [10, 40], armR: [52, 40] },
};

function demonDie(ctx, rng, st) {
  if (st === 0) { // вскинул голову, предсмертный рёв
    demonFrame(ctx, rng, {
      lean: 1, headDrop: -3, mouth: 10, eyes: 'wide', bloodChest: 2,
      armL: [8, 38], armR: [56, 38], feetL: [21, 63], feetR: [43, 63],
    });
    return;
  }
  if (st === 1) { // ноги подламываются, туша оседает
    demonFrame(ctx, rng, {
      bob: 5, hipY: 51, headDrop: 2, mouth: 7, eyes: 'squint', bloodChest: 3,
      armL: [14, 54], armR: [50, 54], feetL: [19, 63], feetR: [45, 63],
    });
    return;
  }
  if (st === 2) { // рухнул на брюхо, упёрся лапами
    bloodPool(ctx, rng, 32, 59, 10, 2.4);
    blob(ctx, 15, 54, 6, 6, DEM_HAUNCH, rng, 0.08);
    blob(ctx, 49, 54, 6, 6, DEM_HAUNCH, rng, 0.08);
    limb(ctx, 13, 57, 7, 62, 2.2, DEM_LEG); hoof(ctx, 7, 63);
    limb(ctx, 51, 57, 57, 62, 2.2, DEM_LEG); hoof(ctx, 57, 63);
    blob(ctx, 32, 45, 13, 10, DEM_BODY, rng, 0.08);
    splat(ctx, rng, 32, 42, 2);
    limb(ctx, 22, 50, 16, 60, 2.4, DEM_LIMB); claws(ctx, 16, 60, 2);
    limb(ctx, 42, 50, 48, 60, 2.4, DEM_LIMB); claws(ctx, 48, 60, 2);
    blob(ctx, 32, 55, 10, 6.5, DEM_BODY, rng, 0.06); // голова падает на грудь
    demonEars(ctx, 32, 55);
    demonEyes(ctx, 32, 52, 'squint');
    demonMouth(ctx, rng, 32, 58, 7, 4);
    return;
  }
  if (st === 3) { // распластался, челюсть на полу
    bloodPool(ctx, rng, 32, 60, 14, 2.8);
    blob(ctx, 16, 57, 5.5, 4.5, DEM_HAUNCH, rng, 0.08);
    blob(ctx, 48, 57, 5.5, 4.5, DEM_HAUNCH, rng, 0.08);
    limb(ctx, 12, 59, 7, 62, 2, DEM_LEG); hoof(ctx, 6, 63);
    limb(ctx, 52, 59, 57, 62, 2, DEM_LEG); hoof(ctx, 58, 63);
    blob(ctx, 32, 53, 13.5, 6.5, DEM_BODY, rng, 0.1);
    limb(ctx, 21, 56, 14, 61, 2, DEM_LIMB); claws(ctx, 14, 61, 2);
    limb(ctx, 43, 56, 50, 61, 2, DEM_LIMB); claws(ctx, 50, 61, 2);
    blob(ctx, 32, 59.5, 9.5, 3.8, DEM_BODY, rng, 0.06);
    slantSpike(ctx, 24, 56, 3, -0.8, DEM_BODY[3], DEM_BODY[1]);
    slantSpike(ctx, 40, 56, 3, 0.8, DEM_BODY[3], DEM_BODY[1]);
    px(ctx, 28, 57, MOUTH_DK); px(ctx, 36, 57, MOUTH_DK); // глаза закрылись
    hline(ctx, 26, 38, 61, MOUTH_DK); // пасть-щель у самого пола
    for (let x = 27; x <= 37; x += 2) px(ctx, x, 60, TEETH_L);
    splat(ctx, rng, 32, 56, 2);
    return;
  }
  // st === 4 — труп: плоская розовая туша в луже крови (остаётся в мире)
  bloodPool(ctx, rng, 32, 61, 17, 2.8);
  blob(ctx, 18, 60, 5, 3, DEM_HAUNCH, rng, 0.1);
  blob(ctx, 46, 60, 5, 3, DEM_HAUNCH, rng, 0.1);
  hoof(ctx, 8, 63); hoof(ctx, 56, 63);
  blob(ctx, 32, 58.5, 15, 4.2, DEM_BODY, rng, 0.12);
  limb(ctx, 20, 60, 13, 61.5, 1.6, DEM_LIMB); claws(ctx, 13, 61, 2);
  blob(ctx, 32, 61, 8.5, 2.5, DEM_BODY, rng, 0.06);
  slantSpike(ctx, 24, 58, 3, -0.8, DEM_BODY[3], DEM_BODY[1]);
  for (let x = 27; x <= 37; x += 2) px(ctx, x, 62, TEETH_L); // оскал трупа
  px(ctx, 29, 60, MOUTH_DK);
  splat(ctx, rng, 32, 58, 2);
}

// ==================================================================
// Экспорт (§4/§6): ровно 13 ключей на врага, Map<string, HTMLCanvasElement>
// ==================================================================

export function generateSprites() {
  const sprites = new Map();
  const add = (key, draw) => {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    draw(ctx, mulberry32(hashStr(key))); // сид из имени кадра — стабильно между запусками
    sprites.set(key, cv);
  };
  for (const [name, pose] of Object.entries(IMP_POSES))
    add('imp_' + name, (ctx, rng) => impFrame(ctx, rng, pose));
  for (let i = 0; i < 5; i++) {
    const st = i;
    add('imp_die' + i, (ctx, rng) => impDie(ctx, rng, st));
  }
  for (const [name, pose] of Object.entries(DEMON_POSES))
    add('demon_' + name, (ctx, rng) => demonFrame(ctx, rng, pose));
  for (let i = 0; i < 5; i++) {
    const st = i;
    add('demon_die' + i, (ctx, rng) => demonDie(ctx, rng, st));
  }
  return sprites;
}
