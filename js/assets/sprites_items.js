// HELLBOUND — спрайты предметов и декора (§8, агент A4).
// Канвас 64×64; наземные предметы стоят основанием на нижней кромке,
// soulsphere центрирована (парит). Пиксель-арт по целочисленной сетке,
// 3–6 тонов на материал, свет сверху-слева, тёмный контур (§4).
// Вся случайность — детерминированная (mulberry32 / позиционный хеш),
// картинка идентична между запусками. Полупрозрачность — только у
// свечений (soulsphere, лампа, факел, плазма/энергия), как разрешено §4.

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

// Позиционный хеш — стабильный «шум», не зависящий от порядка обхода.
function hash2(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 974711)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Канвас и пиксельные примитивы
// ---------------------------------------------------------------------------

const S = 64;

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
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
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  ctx.fillStyle = alpha >= 1 ? color : rgba(color, alpha);
  ctx.fillRect(x, y, 1, 1);
}

function hline(ctx, x0, x1, y, color) {
  for (let x = x0; x <= x1; x++) px(ctx, x, y, color);
}

function vline(ctx, x, y0, y1, color) {
  for (let y = y0; y <= y1; y++) px(ctx, x, y, color);
}

function rect(ctx, x, y, w, h, color) {
  for (let j = 0; j < h; j++) hline(ctx, x, x + w - 1, y + j, color);
}

// Шахматный дизеринг двух тонов (c2 === null — пропуск пикселя).
function ditherRect(ctx, x, y, w, h, c1, c2) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = ((x + i + y + j) & 1) === 0 ? c1 : c2;
      if (c) px(ctx, x + i, y + j, c);
    }
  }
}

// Тень на полу под предметом: дизеренный плоский эллипс у нижней кромки.
function groundShadow(ctx, cx, halfW) {
  const rows = [[61, 0.66], [62, 1], [63, 0.85]];
  for (const [yy, k] of rows) {
    const w = Math.round(halfW * k);
    for (let x = cx - w; x <= cx + w; x++) {
      if (((x + yy) & 1) === 0) px(ctx, x, yy, '#0a0a0d');
    }
  }
}

// Блик «звёздочкой» для ярких подбираемых предметов.
function sparkle(ctx, x, y, bright, mid) {
  px(ctx, x, y, bright);
  px(ctx, x - 1, y, mid);
  px(ctx, x + 1, y, mid);
  px(ctx, x, y - 1, mid);
  px(ctx, x, y + 1, mid);
}

// Пиксельный шар: тёмный обод, ярусы тонов с дизерингом, блик сверху-слева.
function ball(ctx, cx, cy, r, tones, seed, alpha = 1) {
  const n = tones.length;
  const hx = cx - r * 0.38;
  const hy = cy - r * 0.42;
  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const rr = r + (hash2(x, y, seed) - 0.5) * 0.8;
      if (d > rr) continue;
      const hdx = x + 0.5 - hx;
      const hdy = y + 0.5 - hy;
      let t = 1 - Math.min(1, Math.sqrt(hdx * hdx + hdy * hdy) / (r * 1.8));
      let ti = Math.floor(t * n);
      if (t * n - ti > 0.55 && ((x + y) & 1) === 0) ti++;
      if (d > rr - 1.2) ti = 0;
      else if (d > rr - 2.2 && ti > 1) ti--;
      px(ctx, x, y, tones[Math.max(0, Math.min(n - 1, ti))], alpha);
    }
  }
}

// ---------------------------------------------------------------------------
// Палитры (§4)
// ---------------------------------------------------------------------------

const METAL = ['#1b1d22', '#2e3138', '#494e58', '#6d7380', '#99a0ad'];
const RUST = ['#3a2417', '#6b3a24', '#9c5a2e', '#c97f45'];
const BLOOD = ['#3d0a0a', '#6e1111', '#a51c1c', '#d23b1e', '#ff6b3d'];
const SKIN = ['#5c4632', '#8a6b48', '#c8a06e', '#e8cfa0'];
const FIRE = ['#7a1f08', '#c44d12', '#f08a1d', '#ffd24a', '#fff6c9'];
const OUT = '#101116'; // общий тёмный контур (не чисто чёрный)
// кислота (#15300f #2c5e1a #3aa32a #7ade3f) и плазма (#123a6e #2a86d4 #46c8ff
// #9ce6ff) используются литералами в barrel/cell и plasmarifle/healthbonus.

// ---------------------------------------------------------------------------
// Аптечки
// ---------------------------------------------------------------------------

// Белая медицинская коробка с красным крестом. a — полудлина креста.
function medbox(ctx, cx, w, h, dep, a) {
  const x = cx - (w >> 1);
  const fy = 63 - h;        // верх фронтальной грани
  const ty = fy - dep;      // верх верхней грани
  groundShadow(ctx, cx, (w >> 1) + 3);
  // верхняя грань (видна чуть сверху) — трапеция, светлее
  for (let j = 0; j < dep; j++) {
    const ins = dep - 1 - j;
    hline(ctx, x + ins + 1, x + w - 2 - ins, ty + j, j === 0 ? '#ffffff' : '#eef0f6');
  }
  // фронтальная грань
  rect(ctx, x, fy, w, h, '#d4d8e2');
  hline(ctx, x, x + w - 1, fy, '#ffffff');
  vline(ctx, x, fy + 1, fy + h - 2, '#eef0f6');
  hline(ctx, x, x + w - 1, fy + h - 1, '#8c90a0');
  vline(ctx, x + w - 1, fy + 1, fy + h - 2, '#8c90a0');
  hline(ctx, x + 1, x + w - 2, fy + 2, '#a8acba'); // шов крышки
  // контур
  vline(ctx, x - 1, ty, fy + h - 1, OUT);
  vline(ctx, x + w, ty, fy + h - 1, OUT);
  hline(ctx, x + dep, x + w - 1 - dep, ty - 1, OUT);
  hline(ctx, x - 1, x + w, 63, OUT);
  // красный крест
  const cy = fy + (h >> 1) + 1;
  rect(ctx, cx - 1, cy - a, 3, a * 2 + 1, '#d23b1e');
  rect(ctx, cx - a, cy - 1, a * 2 + 1, 3, '#d23b1e');
  hline(ctx, cx - a, cx + a, cy + 1, '#a51c1c');
  vline(ctx, cx + 1, cy - a, cy + a, '#a51c1c');
  hline(ctx, cx - a, cx - 2, cy - 1, '#ff6b3d');
  vline(ctx, cx - 1, cy - a, cy - 2, '#ff6b3d');
  // металлические уголки-заклёпки
  px(ctx, x + 1, fy + 1, '#99a0ad');
  px(ctx, x + w - 2, fy + 1, '#99a0ad');
  px(ctx, x + 1, fy + h - 2, '#6d7380');
  px(ctx, x + w - 2, fy + h - 2, '#6d7380');
}

function drawStimpack(ctx) {
  medbox(ctx, 32, 20, 12, 3, 4);
}

function drawMedikit(ctx) {
  medbox(ctx, 32, 34, 17, 5, 6);
  // замки-защёлки по бокам крышки
  rect(ctx, 18, 48, 3, 4, '#6d7380');
  rect(ctx, 43, 48, 3, 4, '#6d7380');
  px(ctx, 18, 48, '#99a0ad');
  px(ctx, 43, 48, '#99a0ad');
}

// ---------------------------------------------------------------------------
// Здоровье и броня
// ---------------------------------------------------------------------------

function drawHealthBonus(ctx) {
  groundShadow(ctx, 32, 8);
  const cx = 32;
  // колба: [y, полуширина] снизу вверх
  const shape = [
    [62, 5], [61, 7], [60, 8], [59, 8], [58, 8], [57, 8], [56, 8],
    [55, 7], [54, 6], [53, 4], [52, 3],
  ];
  for (const [y, hw] of shape) {
    for (let x = cx - hw; x <= cx + hw; x++) {
      let c = '#46c8ff';
      if (x === cx - hw || x === cx + hw || y === 62) c = '#123a6e';
      else if (x >= cx + hw - 2) c = '#2a86d4';
      else if (x <= cx - hw + 2 && y <= 58) c = '#9ce6ff';
      px(ctx, x, y, c);
    }
  }
  // пузырьки светящейся жидкости
  px(ctx, cx + 2, 59, '#9ce6ff');
  px(ctx, cx - 1, 56, '#e8fbff');
  px(ctx, cx + 3, 55, '#9ce6ff');
  // горлышко
  rect(ctx, cx - 2, 48, 5, 4, '#2a86d4');
  vline(ctx, cx - 2, 48, 51, '#123a6e');
  vline(ctx, cx + 2, 48, 51, '#123a6e');
  vline(ctx, cx - 1, 48, 51, '#9ce6ff');
  // пробка
  rect(ctx, cx - 2, 45, 5, 3, '#9c5a2e');
  hline(ctx, cx - 2, cx + 2, 45, '#c97f45');
  px(ctx, cx - 2, 47, '#6b3a24');
  px(ctx, cx + 2, 47, '#6b3a24');
  // дизеренное свечение вокруг склянки + блик (видно издалека)
  for (let y = 50; y <= 62; y++) {
    for (let x = cx - 11; x <= cx + 11; x++) {
      const d = Math.abs(x - cx);
      if (d >= 9 && d <= 10 && ((x + y) & 1) === 0 && y >= 53) px(ctx, x, y, '#46c8ff', 0.55);
    }
  }
  sparkle(ctx, cx - 4, 55, '#ffffff', '#e8fbff');
}

function drawArmorBonus(ctx) {
  groundShadow(ctx, 32, 10);
  const cx = 32;
  // маленький шлем: купол, низ на y=62
  const dome = [
    [50, 3], [51, 6], [52, 8], [53, 9], [54, 9], [55, 10], [56, 10],
    [57, 10], [58, 10], [59, 10],
  ];
  for (const [y, hw] of dome) {
    for (let x = cx - hw; x <= cx + hw; x++) {
      let c = '#2c5e1a';
      if (x === cx - hw || x === cx + hw) c = '#15300f';
      else if (x <= cx - hw + 3 && y <= 57) c = '#3aa32a';
      else if (x >= cx + hw - 3) c = '#1c3f14';
      px(ctx, x, y, c);
    }
  }
  // гребень по куполу
  vline(ctx, cx, 50, 56, '#7ade3f');
  vline(ctx, cx + 1, 51, 56, '#1c3f14');
  px(ctx, cx, 49, '#15300f');
  // нижний обод-юбка (шире купола)
  hline(ctx, cx - 11, cx + 11, 60, '#3aa32a');
  hline(ctx, cx - 11, cx + 11, 61, '#1c3f14');
  hline(ctx, cx - 10, cx + 10, 62, '#15300f');
  px(ctx, cx - 11, 60, '#7ade3f');
  vline(ctx, cx - 12, 60, 61, OUT);
  vline(ctx, cx + 12, 60, 61, OUT);
  // смотровая щель с металлической окантовкой
  hline(ctx, cx - 6, cx + 6, 56, '#494e58');
  rect(ctx, cx - 6, 57, 13, 2, '#0f1013');
  px(ctx, cx - 6, 57, '#6d7380');
  px(ctx, cx + 6, 58, '#1b1d22');
  // заклёпки на ободе
  px(ctx, cx - 8, 60, '#d6ff9e');
  px(ctx, cx + 8, 60, '#15300f');
  // блик
  sparkle(ctx, cx - 5, 53, '#d6ff9e', '#7ade3f');
  hline(ctx, cx - 10, cx + 10, 63, OUT);
}

// Бронежилет на стойке. tones: [тёмный, тень, основной, свет, блик]
function armorVest(ctx, tones) {
  groundShadow(ctx, 32, 13);
  const cx = 32;
  // стойка: основание и шест
  hline(ctx, cx - 8, cx + 8, 62, '#1b1d22');
  hline(ctx, cx - 10, cx + 10, 63, OUT);
  rect(ctx, cx - 1, 52, 3, 10, '#2e3138');
  vline(ctx, cx - 1, 52, 61, '#494e58');
  // торс: [y, полуширина] сверху вниз
  const torso = [];
  for (let y = 22; y <= 52; y++) {
    let hw;
    if (y <= 24) hw = 13;          // плечи
    else if (y <= 28) hw = 14;     // наплечники
    else if (y <= 38) hw = 12;     // грудь
    else hw = 11 - Math.floor((y - 39) / 5); // талия
    torso.push([y, hw]);
  }
  for (const [y, hw] of torso) {
    for (let x = cx - hw; x <= cx + hw; x++) {
      // горловина
      if (y <= 26 && Math.abs(x - cx) <= 4) continue;
      let c = tones[2];
      if (x === cx - hw || x === cx + hw) c = tones[0];
      else if (x <= cx - hw + 2) c = tones[3];
      else if (x >= cx + hw - 3) c = tones[1];
      // сегменты-пластины (горизонтальные швы)
      if ((y === 34 || y === 41 || y === 47) && x > cx - hw && x < cx + hw) c = tones[0];
      if ((y === 35 || y === 42 || y === 48) && x <= cx - hw + 4) c = tones[3];
      px(ctx, x, y, c);
    }
  }
  // окантовка горловины
  for (let y = 22; y <= 27; y++) {
    px(ctx, cx - 5, y, tones[0]);
    px(ctx, cx + 5, y, tones[0]);
  }
  hline(ctx, cx - 4, cx + 4, 27, tones[0]);
  hline(ctx, cx - 13, cx - 5, 21, tones[0]);
  hline(ctx, cx + 5, cx + 13, 21, tones[0]);
  // швы наплечников
  vline(ctx, cx - 9, 22, 28, tones[0]);
  vline(ctx, cx + 9, 22, 28, tones[0]);
  px(ctx, cx - 11, 24, tones[4]);
  // заклёпки на груди
  px(ctx, cx - 7, 31, tones[4]);
  px(ctx, cx + 7, 31, tones[1]);
  px(ctx, cx - 7, 38, tones[4]);
  px(ctx, cx + 7, 38, tones[1]);
  // яркий блик (видно издалека)
  sparkle(ctx, cx - 8, 25, '#ffffff', tones[4]);
}

function drawArmorGreen(ctx) {
  armorVest(ctx, ['#15300f', '#1c4a14', '#2c5e1a', '#3aa32a', '#7ade3f']);
}

function drawArmorBlue(ctx) {
  armorVest(ctx, ['#0e2348', '#123a6e', '#1d5ca8', '#2a86d4', '#46c8ff']);
}

function drawSoulsphere(ctx) {
  const cx = 32, cy = 32, r = 17;
  // дизеренный ореол
  for (let y = cy - r - 5; y <= cy + r + 5; y++) {
    for (let x = cx - r - 5; x <= cx + r + 5; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r && d < r + 4 && ((x + y) & 1) === 0) {
        px(ctx, x, y, '#46c8ff', d < r + 2 ? 0.62 : 0.52);
      }
    }
  }
  // полупрозрачное тело сферы
  ball(ctx, cx, cy, r, ['#123a6e', '#1d5ca8', '#2a86d4', '#46c8ff', '#9ce6ff'], 77, 0.62);
  // лицо-душа внутри: пустые глазницы и вопящий рот (как у духа в сфере)
  const f = [
    // глазницы — большие, скошены скорбно
    [-7, -4], [-6, -4], [-5, -4], [-4, -4], [4, -4], [5, -4], [6, -4], [7, -4],
    [-7, -3], [-6, -3], [-5, -3], [-4, -3], [4, -3], [5, -3], [6, -3], [7, -3],
    [-6, -2], [-5, -2], [5, -2], [6, -2],
    // провал носа
    [-1, 1], [0, 1], [1, 1], [0, 0],
    // распахнутый в вопле рот
    [-3, 4], [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4], [3, 4],
    [-3, 5], [-2, 5], [-1, 5], [0, 5], [1, 5], [2, 5], [3, 5],
    [-2, 6], [-1, 6], [0, 6], [1, 6], [2, 6],
    [-1, 7], [0, 7], [1, 7],
  ];
  for (const [dx, dy] of f) px(ctx, cx + dx, cy + dy, '#0a1c3a');
  // бледное свечение черепа: надбровья и скулы
  for (const [dx, dy] of [
    [-7, -6], [-6, -6], [-5, -6], [-4, -6], [4, -6], [5, -6], [6, -6], [7, -6],
    [-7, 0], [-6, 0], [6, 0], [7, 0], [-4, 2], [4, 2],
  ]) {
    px(ctx, cx + dx, cy + dy, '#e8fbff', 0.8);
  }
  // блик сверху-слева — непрозрачный, читается издалека
  for (const [dx, dy] of [[-8, -9], [-7, -9], [-9, -8], [-8, -8], [-7, -8], [-6, -8], [-8, -7], [-7, -7]]) {
    px(ctx, cx + dx, cy + dy, '#e8fbff');
  }
  sparkle(ctx, cx - 7, cy - 8, '#ffffff', '#e8fbff');
}

// ---------------------------------------------------------------------------
// Боеприпасы
// ---------------------------------------------------------------------------

function drawAmmoClip(ctx) {
  groundShadow(ctx, 32, 8);
  const x = 27, y = 47, w = 10, h = 15;
  // корпус обоймы (слегка скошен)
  for (let j = 0; j < h; j++) {
    const sx = x + (j >> 3); // лёгкий наклон
    let c = '#494e58';
    hline(ctx, sx, sx + w - 1, y + j, c);
    px(ctx, sx, y + j, '#6d7380');
    px(ctx, sx + w - 1, y + j, '#2e3138');
  }
  // рёбра жёсткости
  hline(ctx, x + 1, x + w - 1, y + 4, '#2e3138');
  hline(ctx, x + 1, x + w, y + 9, '#2e3138');
  // контур
  vline(ctx, x - 1, y, y + h - 1, OUT);
  vline(ctx, x + w + 1, y + 8, y + h - 1, OUT);
  vline(ctx, x + w, y, y + 8, OUT);
  hline(ctx, x - 1, x + w + 1, 62, OUT);
  // латунный патрон сверху
  rect(ctx, x + 2, y - 4, 5, 4, '#c97f45');
  px(ctx, x + 2, y - 4, '#e8cfa0');
  px(ctx, x + 3, y - 4, '#e8cfa0');
  px(ctx, x + 6, y - 1, '#9c5a2e');
  hline(ctx, x + 2, x + 6, y - 5, OUT);
  sparkle(ctx, x + 3, y - 3, '#fff6c9', '#e8cfa0');
}

function drawAmmoBulletbox(ctx) {
  groundShadow(ctx, 32, 17);
  const x = 18, y = 46, w = 28, h = 16;
  // оливково-металлический короб
  rect(ctx, x, y, w, h, '#3c422e');
  hline(ctx, x, x + w - 1, y, '#5a6342');
  vline(ctx, x, y + 1, y + h - 2, '#5a6342');
  hline(ctx, x, x + w - 1, y + h - 1, '#23271a');
  vline(ctx, x + w - 1, y + 1, y + h - 2, '#23271a');
  // открытая крышка сзади (приподнята)
  rect(ctx, x + 2, y - 5, w - 4, 4, '#2e3424');
  hline(ctx, x + 2, x + w - 3, y - 5, '#5a6342');
  hline(ctx, x + 1, x + w - 2, y - 6, OUT);
  // латунные кончики пуль рядами в коробе
  for (let i = 0; i < 8; i++) {
    const bx = x + 3 + i * 3;
    px(ctx, bx, y + 1, '#e8cfa0');
    px(ctx, bx, y + 2, '#c97f45');
    px(ctx, bx, y + 3, '#9c5a2e');
  }
  hline(ctx, x + 2, x + w - 3, y + 4, '#23271a');
  // трафарет-маркировка: жёлтая полоса и точки «AMMO»
  hline(ctx, x + 3, x + w - 4, y + 8, '#ffd24a');
  for (let i = 0; i < 4; i++) rect(ctx, x + 5 + i * 6, y + 10, 3, 3, '#c9a82e');
  // ручка
  rect(ctx, x + 11, y + 13, 6, 2, '#1b1d22');
  px(ctx, x + 11, y + 13, '#494e58');
  // контур
  vline(ctx, x - 1, y - 1, y + h - 1, OUT);
  vline(ctx, x + w, y - 1, y + h - 1, OUT);
  hline(ctx, x - 1, x + w, 62, OUT);
  sparkle(ctx, x + 6, y + 1, '#fff6c9', '#e8cfa0');
}

// Один патрон дробовика: красная гильза + латунный цоколь (стоит).
function shellUpright(ctx, x, baseY, h) {
  // латунный цоколь
  rect(ctx, x, baseY - 3, 5, 3, '#c97f45');
  px(ctx, x, baseY - 3, '#e8cfa0');
  px(ctx, x + 4, baseY - 1, '#9c5a2e');
  // красная гильза
  rect(ctx, x, baseY - h, 5, h - 3, '#a51c1c');
  vline(ctx, x, baseY - h, baseY - 4, '#d23b1e');
  vline(ctx, x + 4, baseY - h, baseY - 4, '#6e1111');
  hline(ctx, x, x + 4, baseY - h, '#d23b1e');
  px(ctx, x + 1, baseY - h + 1, '#ff6b3d');
  // контур
  vline(ctx, x - 1, baseY - h, baseY - 1, OUT);
  vline(ctx, x + 5, baseY - h, baseY - 1, OUT);
  hline(ctx, x - 1, x + 5, baseY, OUT);
}

function drawAmmoShells(ctx) {
  groundShadow(ctx, 32, 15);
  shellUpright(ctx, 19, 62, 14);
  shellUpright(ctx, 27, 63, 15);
  shellUpright(ctx, 35, 62, 14);
  shellUpright(ctx, 43, 63, 15);
}

function drawAmmoShellbox(ctx) {
  groundShadow(ctx, 32, 18);
  const x = 16, y = 47, w = 32, h = 15;
  // картонно-металлическая коробка дроби
  rect(ctx, x, y, w, h, '#6b3a24');
  hline(ctx, x, x + w - 1, y, '#9c5a2e');
  vline(ctx, x, y + 1, y + h - 2, '#9c5a2e');
  hline(ctx, x, x + w - 1, y + h - 1, '#3a2417');
  vline(ctx, x + w - 1, y + 1, y + h - 2, '#3a2417');
  // открытый верх: ряд красных дробовых патронов
  rect(ctx, x + 2, y - 4, w - 4, 4, '#3a2417');
  for (let i = 0; i < 7; i++) {
    const bx = x + 4 + i * 4;
    px(ctx, bx, y - 3, '#d23b1e');
    px(ctx, bx + 1, y - 3, '#a51c1c');
    px(ctx, bx, y - 2, '#a51c1c');
    px(ctx, bx + 1, y - 2, '#6e1111');
    px(ctx, bx, y - 1, '#e8cfa0');
    px(ctx, bx + 1, y - 1, '#c97f45');
  }
  hline(ctx, x + 1, x + w - 2, y - 5, OUT);
  // этикетка: жёлтый ромб-пиктограмма дроби
  rect(ctx, x + 4, y + 4, 10, 8, '#c8b89a');
  for (const [dx, dy] of [[2, 4], [3, 3], [4, 2], [5, 3], [6, 4], [5, 5], [4, 6], [3, 5], [4, 4]]) {
    px(ctx, x + 4 + dx + 1, y + 2 + dy, '#a51c1c');
  }
  // надпись-штрихи
  hline(ctx, x + 17, x + 27, y + 6, '#ffd24a');
  hline(ctx, x + 17, x + 24, y + 9, '#c9a82e');
  // контур
  vline(ctx, x - 1, y - 1, y + h - 1, OUT);
  vline(ctx, x + w, y - 1, y + h - 1, OUT);
  hline(ctx, x - 1, x + w, 62, OUT);
  sparkle(ctx, x + 6, y - 2, '#fff6c9', '#e8cfa0');
}

function drawAmmoRocket(ctx) {
  groundShadow(ctx, 32, 9);
  const cx = 32, tipY = 30, baseY = 62;
  // стабилизаторы
  for (let j = 0; j < 7; j++) {
    hline(ctx, cx - 4 - (j >> 1), cx - 4, baseY - 7 + j, '#2e3138');
    hline(ctx, cx + 4, cx + 4 + (j >> 1), baseY - 7 + j, '#1b1d22');
  }
  vline(ctx, cx - 8, baseY - 3, baseY - 1, OUT);
  vline(ctx, cx + 8, baseY - 3, baseY - 1, OUT);
  // корпус
  rect(ctx, cx - 4, tipY + 10, 9, baseY - tipY - 10, '#6d7380');
  vline(ctx, cx - 4, tipY + 10, baseY - 1, '#99a0ad');
  vline(ctx, cx - 3, tipY + 10, baseY - 1, '#99a0ad');
  vline(ctx, cx + 3, tipY + 10, baseY - 1, '#494e58');
  vline(ctx, cx + 4, tipY + 10, baseY - 1, '#2e3138');
  // кольцевые швы
  hline(ctx, cx - 4, cx + 4, tipY + 16, '#494e58');
  hline(ctx, cx - 4, cx + 4, baseY - 9, '#494e58');
  // боеголовка: красный конус
  const cone = [[0, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [4, 5], [4, 6]];
  for (let j = 0; j < 10; j++) {
    const hw = cone[j][1];
    hline(ctx, cx - hw, cx + hw, tipY + j, '#a51c1c');
    px(ctx, cx - hw, tipY + j, '#d23b1e');
    px(ctx, cx + hw, tipY + j, '#6e1111');
  }
  px(ctx, cx, tipY, '#ff6b3d');
  px(ctx, cx - 1, tipY + 2, '#ff6b3d');
  hline(ctx, cx - 4, cx + 4, tipY + 10, '#3d0a0a');
  // сопло
  hline(ctx, cx - 3, cx + 3, baseY - 1, '#1b1d22');
  hline(ctx, cx - 4, cx + 4, baseY, OUT);
  vline(ctx, cx - 5, tipY + 9, baseY - 1, OUT);
  vline(ctx, cx + 5, tipY + 9, baseY - 1, OUT);
  sparkle(ctx, cx - 2, tipY + 13, '#c8ccd6', '#99a0ad');
}

function drawAmmoRocketbox(ctx) {
  groundShadow(ctx, 32, 21);
  const x = 11, y = 40, w = 42, h = 22;
  // деревянно-металлический ящик (открытый, вид спереди-сверху)
  rect(ctx, x, y, w, h, '#6b3a24');
  hline(ctx, x, x + w - 1, y, '#9c5a2e');
  vline(ctx, x, y + 1, y + h - 2, '#9c5a2e');
  hline(ctx, x, x + w - 1, y + h - 1, '#3a2417');
  vline(ctx, x + w - 1, y + 1, y + h - 2, '#3a2417');
  // металлические уголки
  for (const ex of [x + 1, x + w - 4]) {
    rect(ctx, ex, y + 1, 3, 3, '#494e58');
    rect(ctx, ex, y + h - 4, 3, 3, '#2e3138');
  }
  // 3 ракеты лежат носами вправо (видны в открытом верхе)
  for (let i = 0; i < 3; i++) {
    const ry = y + 3 + i * 6;
    // корпус
    rect(ctx, x + 4, ry, 26, 4, '#6d7380');
    hline(ctx, x + 4, x + 29, ry, '#99a0ad');
    hline(ctx, x + 4, x + 29, ry + 3, '#494e58');
    // сопло слева
    rect(ctx, x + 4, ry, 2, 4, '#2e3138');
    // красный нос справа
    for (let j = 0; j < 4; j++) hline(ctx, x + 30, x + 30 + 5 - j - (j > 1 ? 2 : 0), ry + j, j < 2 ? '#d23b1e' : '#a51c1c');
    px(ctx, x + 35, ry, '#ff6b3d');
    hline(ctx, x + 4, x + 35, ry - 1, OUT);
  }
  hline(ctx, x + 3, x + w - 3, y + 20, '#3a2417');
  // трафарет «опасно»
  for (let i = 0; i < 5; i++) px(ctx, x + 6 + i * 7, y + h - 3, '#ffd24a');
  // контур
  vline(ctx, x - 1, y - 1, y + h - 1, OUT);
  vline(ctx, x + w, y - 1, y + h - 1, OUT);
  hline(ctx, x - 1, x + w, 62, OUT);
}

// Энергобатарея: тёмный корпус + зелёное светящееся окно с дизерингом.
function cellBody(ctx, x, y, w, h, winInset) {
  rect(ctx, x, y, w, h, '#2e3138');
  hline(ctx, x, x + w - 1, y, '#6d7380');
  vline(ctx, x, y + 1, y + h - 2, '#494e58');
  hline(ctx, x, x + w - 1, y + h - 1, '#1b1d22');
  vline(ctx, x + w - 1, y + 1, y + h - 2, '#1b1d22');
  // окно энергии
  const wx = x + winInset, wy = y + 3, ww = w - winInset * 2, wh = h - 7;
  rect(ctx, wx, wy, ww, wh, '#2cab2c');
  ditherRect(ctx, wx + 1, wy + 1, ww - 2, wh - 2, '#7ade3f', '#2cab2c');
  px(ctx, wx + 1, wy + 1, '#d6ff9e');
  px(ctx, wx + 2, wy + 1, '#d6ff9e');
  vline(ctx, wx, wy, wy + wh - 1, '#15300f');
  vline(ctx, wx + ww - 1, wy, wy + wh - 1, '#15300f');
  hline(ctx, wx, wx + ww - 1, wy + wh - 1, '#15300f');
  // дизеренное свечение наружу
  for (let i = 0; i < ww + 4; i++) {
    if ((i & 1) === 0) px(ctx, wx - 2 + i, wy - 2, '#7ade3f', 0.55);
  }
  // контур
  vline(ctx, x - 1, y - 1, y + h - 1, OUT);
  vline(ctx, x + w, y - 1, y + h - 1, OUT);
  hline(ctx, x, x + w - 1, y - 1, OUT);
  hline(ctx, x - 1, x + w, y + h, OUT);
}

function drawAmmoCell(ctx) {
  groundShadow(ctx, 32, 9);
  cellBody(ctx, 25, 47, 14, 16, 3);
  // клеммы сверху
  rect(ctx, 27, 44, 3, 3, '#99a0ad');
  rect(ctx, 34, 44, 3, 3, '#6d7380');
  hline(ctx, 27, 29, 43, OUT);
  hline(ctx, 34, 36, 43, OUT);
  sparkle(ctx, 29, 52, '#d6ff9e', '#7ade3f');
}

function drawAmmoCellpack(ctx) {
  groundShadow(ctx, 32, 17);
  cellBody(ctx, 18, 41, 28, 22, 4);
  // ручка для переноски
  hline(ctx, 24, 39, 37, '#494e58');
  hline(ctx, 24, 39, 38, '#2e3138');
  vline(ctx, 24, 38, 40, '#2e3138');
  vline(ctx, 39, 38, 40, '#1b1d22');
  hline(ctx, 23, 40, 36, OUT);
  // болты по углам
  px(ctx, 20, 43, '#99a0ad');
  px(ctx, 43, 43, '#6d7380');
  px(ctx, 20, 60, '#494e58');
  px(ctx, 43, 60, '#494e58');
  // маркировка мощности
  for (let i = 0; i < 3; i++) hline(ctx, 21, 23, 46 + i * 3, '#ffd24a');
  sparkle(ctx, 26, 49, '#d6ff9e', '#7ade3f');
}

// ---------------------------------------------------------------------------
// Оружие на полу (вид сбоку, лежит, ствол вправо)
// ---------------------------------------------------------------------------

// Горизонтальный ствол с бликом сверху.
function gunBarrel(ctx, x0, x1, y, th) {
  rect(ctx, x0, y, x1 - x0 + 1, th, '#494e58');
  hline(ctx, x0, x1, y, '#99a0ad');
  if (th > 2) hline(ctx, x0, x1, y + 1, '#6d7380');
  hline(ctx, x0, x1, y + th - 1, '#2e3138');
  hline(ctx, x0 - 1, x1 + 1, y - 1, OUT);
  hline(ctx, x0 - 1, x1 + 1, y + th, OUT);
}

function drawPickupShotgun(ctx) {
  groundShadow(ctx, 32, 26);
  // деревянный приклад слева (скошенный)
  for (let j = 0; j < 11; j++) {
    const xs = 6 + (j < 6 ? 0 : (j - 5));
    hline(ctx, xs, 17 + (j >> 2), 50 + j, j < 2 ? '#9c5a2e' : j > 8 ? '#3a2417' : '#6b3a24');
  }
  vline(ctx, 5, 50, 60, OUT);
  hline(ctx, 5, 12, 61, OUT);
  hline(ctx, 6, 16, 49, OUT);
  // ствольная коробка
  rect(ctx, 17, 49, 10, 8, '#2e3138');
  hline(ctx, 17, 26, 49, '#6d7380');
  vline(ctx, 17, 49, 56, '#494e58');
  hline(ctx, 17, 26, 56, '#1b1d22');
  // спусковая скоба
  hline(ctx, 20, 24, 58, '#1b1d22');
  px(ctx, 20, 57, '#1b1d22');
  px(ctx, 24, 57, '#1b1d22');
  // ствол + магазинная трубка
  gunBarrel(ctx, 27, 57, 49, 3);
  hline(ctx, 27, 54, 53, '#494e58');
  hline(ctx, 27, 54, 54, '#2e3138');
  hline(ctx, 26, 55, 55, OUT);
  // деревянная помпа
  rect(ctx, 36, 52, 9, 5, '#9c5a2e');
  hline(ctx, 36, 44, 52, '#c97f45');
  hline(ctx, 36, 44, 56, '#3a2417');
  vline(ctx, 39, 52, 56, '#6b3a24');
  vline(ctx, 42, 52, 56, '#6b3a24');
  vline(ctx, 35, 52, 57, OUT);
  vline(ctx, 45, 52, 57, OUT);
  hline(ctx, 36, 44, 57, OUT);
  // дуло
  px(ctx, 57, 50, '#1b1d22');
  vline(ctx, 58, 49, 51, OUT);
  sparkle(ctx, 31, 50, '#c8ccd6', '#99a0ad');
}

function drawPickupChaingun(ctx) {
  groundShadow(ctx, 32, 26);
  // блок стволов: три видимых ствола
  for (let i = 0; i < 3; i++) {
    const y = 45 + i * 5;
    gunBarrel(ctx, 34, 56, y, 3);
    px(ctx, 56, y + 1, '#1b1d22'); // дульный срез
  }
  // стяжное кольцо стволов
  rect(ctx, 46, 44, 3, 15, '#2e3138');
  vline(ctx, 46, 44, 58, '#6d7380');
  vline(ctx, 48, 44, 58, '#1b1d22');
  vline(ctx, 45, 43, 59, OUT);
  vline(ctx, 49, 43, 59, OUT);
  // корпус-кожух
  rect(ctx, 12, 44, 22, 15, '#494e58');
  hline(ctx, 12, 33, 44, '#99a0ad');
  vline(ctx, 12, 44, 58, '#6d7380');
  hline(ctx, 12, 33, 58, '#1b1d22');
  vline(ctx, 33, 45, 57, '#2e3138');
  // вентиляционные щели
  for (let i = 0; i < 3; i++) hline(ctx, 15, 22, 47 + i * 4, '#1b1d22');
  // рукоять сверху
  rect(ctx, 18, 40, 12, 3, '#2e3138');
  hline(ctx, 18, 29, 40, '#6d7380');
  hline(ctx, 17, 30, 39, OUT);
  vline(ctx, 17, 40, 43, OUT);
  vline(ctx, 30, 40, 43, OUT);
  // барабан с лентой снизу
  rect(ctx, 16, 59, 14, 3, '#2e3138');
  hline(ctx, 16, 29, 59, '#494e58');
  hline(ctx, 15, 30, 62, OUT);
  vline(ctx, 15, 59, 61, OUT);
  vline(ctx, 30, 59, 61, OUT);
  // латунная лента
  px(ctx, 31, 60, '#c97f45');
  px(ctx, 32, 59, '#e8cfa0');
  px(ctx, 33, 60, '#c97f45');
  // контур корпуса
  vline(ctx, 11, 43, 58, OUT);
  hline(ctx, 11, 34, 43, OUT);
  hline(ctx, 12, 33, 59, OUT);
  sparkle(ctx, 20, 45, '#c8ccd6', '#99a0ad');
}

function drawPickupRocketlauncher(ctx) {
  groundShadow(ctx, 32, 27);
  // труба
  rect(ctx, 8, 46, 44, 10, '#494e58');
  hline(ctx, 8, 51, 46, '#99a0ad');
  hline(ctx, 8, 51, 47, '#6d7380');
  hline(ctx, 8, 51, 54, '#2e3138');
  hline(ctx, 8, 51, 55, '#1b1d22');
  // кольцевые рёбра
  for (const rx of [14, 30, 44]) {
    vline(ctx, rx, 46, 55, '#2e3138');
    vline(ctx, rx + 1, 46, 55, '#6d7380');
  }
  // казённый срез слева
  vline(ctx, 8, 46, 55, '#1b1d22');
  vline(ctx, 7, 45, 56, OUT);
  // дульный раструб справа
  for (let j = 0; j < 14; j++) {
    hline(ctx, 52, 58, 44 + j, j === 0 ? '#6d7380' : j > 11 ? '#1b1d22' : '#494e58');
  }
  rect(ctx, 55, 46, 3, 10, '#15171c');
  vline(ctx, 54, 46, 55, '#1b1d22');
  vline(ctx, 58, 44, 57, OUT);
  hline(ctx, 52, 58, 43, OUT);
  hline(ctx, 52, 58, 58, OUT);
  hline(ctx, 8, 51, 45, OUT);
  hline(ctx, 8, 51, 56, OUT);
  // пистолетная рукоять и скоба
  rect(ctx, 24, 56, 4, 6, '#2e3138');
  vline(ctx, 24, 56, 61, '#494e58');
  vline(ctx, 23, 56, 62, OUT);
  vline(ctx, 28, 56, 62, OUT);
  hline(ctx, 24, 27, 62, '#1b1d22');
  // плечевой упор
  rect(ctx, 12, 56, 6, 3, '#2e3138');
  hline(ctx, 11, 18, 59, OUT);
  // жёлтая предупреждающая маркировка
  for (let i = 0; i < 3; i++) px(ctx, 34 + i * 3, 50, '#ffd24a');
  sparkle(ctx, 20, 47, '#c8ccd6', '#99a0ad');
}

function drawPickupPlasmarifle(ctx) {
  groundShadow(ctx, 32, 25);
  // приклад слева
  rect(ctx, 9, 48, 7, 9, '#2e3138');
  hline(ctx, 9, 15, 48, '#6d7380');
  vline(ctx, 8, 47, 57, OUT);
  hline(ctx, 8, 15, 58, OUT);
  // корпус
  rect(ctx, 16, 44, 26, 14, '#494e58');
  hline(ctx, 16, 41, 44, '#99a0ad');
  vline(ctx, 16, 44, 57, '#6d7380');
  hline(ctx, 16, 41, 57, '#1b1d22');
  hline(ctx, 15, 42, 43, OUT);
  hline(ctx, 16, 41, 58, OUT);
  // светящиеся плазменные катушки на корпусе
  for (let i = 0; i < 3; i++) {
    const wx = 20 + i * 7;
    rect(ctx, wx, 47, 4, 6, '#123a6e');
    ditherRect(ctx, wx, 48, 4, 4, '#46c8ff', '#2a86d4');
    px(ctx, wx + 1, 48, '#9ce6ff');
    hline(ctx, wx, wx + 3, 46, OUT);
    // свечение над катушкой (плазма — полупрозрачность разрешена)
    px(ctx, wx + 1, 45, '#46c8ff', 0.6);
    px(ctx, wx + 3, 45, '#46c8ff', 0.52);
  }
  // ствол-кожух
  gunBarrel(ctx, 42, 55, 47, 4);
  rect(ctx, 42, 52, 10, 3, '#2e3138');
  hline(ctx, 42, 51, 55, OUT);
  // дуло с плазменным свечением
  rect(ctx, 56, 47, 2, 4, '#123a6e');
  px(ctx, 56, 48, '#9ce6ff');
  px(ctx, 57, 48, '#46c8ff');
  px(ctx, 56, 49, '#46c8ff');
  vline(ctx, 58, 46, 51, OUT);
  px(ctx, 59, 48, '#46c8ff', 0.6);
  px(ctx, 60, 49, '#46c8ff', 0.52);
  // рукоять
  rect(ctx, 30, 58, 4, 4, '#2e3138');
  vline(ctx, 29, 58, 62, OUT);
  vline(ctx, 34, 58, 62, OUT);
  hline(ctx, 30, 33, 62, '#1b1d22');
  sparkle(ctx, 22, 45, '#c8ccd6', '#99a0ad');
}

function drawPickupBfg(ctx) {
  groundShadow(ctx, 32, 28);
  // массивный зелёный корпус
  rect(ctx, 8, 38, 34, 21, '#1c6b1c');
  hline(ctx, 8, 41, 38, '#3aa32a');
  hline(ctx, 8, 41, 39, '#2cab2c');
  vline(ctx, 8, 38, 58, '#2cab2c');
  hline(ctx, 8, 41, 58, '#11380d');
  vline(ctx, 41, 39, 57, '#11380d');
  // бронепластины-сегменты
  for (const sx of [16, 26, 36]) {
    vline(ctx, sx, 39, 57, '#11380d');
    vline(ctx, sx + 1, 39, 57, '#2cab2c');
  }
  // болты
  for (const sx of [12, 22, 32]) {
    px(ctx, sx, 41, '#7ade3f');
    px(ctx, sx, 55, '#11380d');
  }
  // тёмное металлическое основание
  rect(ctx, 10, 59, 30, 3, '#2e3138');
  hline(ctx, 10, 39, 59, '#494e58');
  hline(ctx, 9, 40, 62, OUT);
  vline(ctx, 9, 59, 61, OUT);
  vline(ctx, 40, 59, 61, OUT);
  // дульная башня: широкий раструб справа
  rect(ctx, 42, 42, 12, 16, '#1c6b1c');
  hline(ctx, 42, 53, 42, '#3aa32a');
  vline(ctx, 53, 43, 57, '#11380d');
  // тёмная апертура с зелёным ядром
  rect(ctx, 54, 44, 4, 12, '#15171c');
  vline(ctx, 54, 44, 55, '#1b1d22');
  rect(ctx, 55, 47, 3, 6, '#2cab2c');
  vline(ctx, 56, 48, 51, '#7ade3f');
  px(ctx, 56, 49, '#d6ff9e');
  // зелёное свечение из дула (энергия — полупрозрачность разрешена)
  for (const [gx, gy, a] of [[59, 48, 0.65], [60, 49, 0.55], [59, 51, 0.6], [61, 50, 0.52], [59, 46, 0.52]]) {
    px(ctx, gx, gy, '#7ade3f', a);
  }
  // контуры
  hline(ctx, 7, 42, 37, OUT);
  vline(ctx, 7, 37, 58, OUT);
  hline(ctx, 42, 54, 41, OUT);
  vline(ctx, 58, 43, 57, OUT);
  hline(ctx, 42, 58, 58, OUT);
  hline(ctx, 54, 58, 43, OUT);
  // верхняя ручка
  rect(ctx, 18, 34, 14, 3, '#2e3138');
  hline(ctx, 18, 31, 34, '#6d7380');
  hline(ctx, 17, 32, 33, OUT);
  vline(ctx, 17, 34, 37, OUT);
  vline(ctx, 32, 34, 37, OUT);
  sparkle(ctx, 14, 40, '#d6ff9e', '#7ade3f');
}

// ---------------------------------------------------------------------------
// Ключ-карты
// ---------------------------------------------------------------------------

// tones: [тёмный, тень, основной, свет, блик]
function keycard(ctx, tones) {
  groundShadow(ctx, 32, 10);
  const x = 25, y = 41, w = 14, h = 21;
  // торец (карта стоит чуть боком — виден правый срез)
  vline(ctx, x + w, y + 1, y + h - 1, tones[1]);
  vline(ctx, x + w + 1, y + 2, y + h - 1, tones[0]);
  // лицевая сторона
  rect(ctx, x, y, w, h, tones[2]);
  hline(ctx, x, x + w - 1, y, tones[3]);
  vline(ctx, x, y + 1, y + h - 2, tones[3]);
  hline(ctx, x, x + w - 1, y + h - 1, tones[1]);
  // выемка-ключ сверху
  rect(ctx, x + 5, y, 4, 3, '#0a0a0d');
  px(ctx, x + 4, y, tones[0]);
  px(ctx, x + 9, y, tones[0]);
  // белая полоса допуска
  rect(ctx, x + 2, y + 5, w - 4, 3, '#e8eaf0');
  hline(ctx, x + 2, x + w - 3, y + 5, '#ffffff');
  hline(ctx, x + 2, x + w - 3, y + 7, '#b0b4c0');
  // чип
  rect(ctx, x + 3, y + 11, 5, 5, tones[3]);
  px(ctx, x + 4, y + 12, tones[4]);
  vline(ctx, x + 7, y + 11, y + 15, tones[1]);
  hline(ctx, x + 3, x + 7, y + 15, tones[1]);
  // штрихи кода
  for (let i = 0; i < 3; i++) hline(ctx, x + 10, x + 11, y + 11 + i * 2, tones[0]);
  // диагональный блик по лицу
  for (let i = 0; i < 5; i++) px(ctx, x + 9 - i, y + 17 + (i >> 1), tones[4]);
  // контур
  vline(ctx, x - 1, y - 1, y + h - 1, OUT);
  vline(ctx, x + w + 2, y + 2, y + h - 1, OUT);
  hline(ctx, x - 1, x + w + 1, y - 1, OUT);
  hline(ctx, x - 1, x + w + 2, y + h, OUT);
  // яркие блики — видно издалека
  sparkle(ctx, x + 3, y + 2, '#ffffff', tones[4]);
  sparkle(ctx, x + 11, y + 18, '#ffffff', tones[4]);
}

function drawKeyBlue(ctx) {
  keycard(ctx, ['#0e2348', '#1a3a8c', '#2a6ad4', '#4a90ff', '#9cc8ff']);
}

function drawKeyYellow(ctx) {
  keycard(ctx, ['#5a3c06', '#8c5a08', '#d49a12', '#ffd24a', '#fff6c9']);
}

function drawKeyRed(ctx) {
  keycard(ctx, ['#3d0a0a', '#6e1111', '#a51c1c', '#ff4a4a', '#ffb0a0']);
}

// ---------------------------------------------------------------------------
// Бочка
// ---------------------------------------------------------------------------

function drawBarrel(ctx) {
  groundShadow(ctx, 32, 15);
  const cx = 32, top = 28, bot = 62, hw = 12;
  // корпус: вертикальное цилиндрическое затенение клёпаного металла
  for (let y = top + 2; y <= bot; y++) {
    for (let x = cx - hw; x <= cx + hw; x++) {
      const t = (x - (cx - hw)) / (hw * 2); // 0..1 слева направо
      let c;
      if (t < 0.06 || t > 0.96) c = '#1b1d22';
      else if (t < 0.16) c = '#2e3138';
      else if (t < 0.3) c = '#494e58';
      else if (t < 0.42) c = '#6d7380';      // блик слева от центра
      else if (t < 0.52) c = '#494e58';
      else if (t < 0.78) c = '#2e3138';
      else c = '#1b1d22';
      // потёртости металла
      if (hash2(x, y, 31) > 0.93) c = '#494e58';
      px(ctx, x, y, c);
    }
  }
  // обручи-рёбра (как у бочек Doom)
  for (const ry of [top + 6, top + 18, bot - 3]) {
    hline(ctx, cx - hw, cx + hw, ry, '#15171c');
    hline(ctx, cx - hw, cx + hw, ry + 1, '#6d7380');
    px(ctx, cx - hw + 3, ry + 1, '#99a0ad');
    hline(ctx, cx - hw, cx + hw, ry + 2, '#1b1d22');
  }
  // верхний обод (эллипс, виден сверху)
  hline(ctx, cx - hw + 3, cx + hw - 3, top, '#6d7380');
  hline(ctx, cx - hw + 1, cx + hw - 1, top + 1, '#494e58');
  px(ctx, cx - hw, top + 2, '#2e3138');
  px(ctx, cx + hw, top + 2, '#1b1d22');
  // зелёная светящаяся жижа в открытом верхе
  hline(ctx, cx - hw + 4, cx + hw - 4, top + 1, '#2c5e1a');
  for (let x = cx - hw + 3; x <= cx + hw - 3; x++) {
    const n = hash2(x, 7, 13);
    px(ctx, x, top + 2, n > 0.6 ? '#7ade3f' : '#3aa32a');
    if (x > cx - hw + 4 && x < cx + hw - 4) px(ctx, x, top + 3, n > 0.75 ? '#3aa32a' : '#2c5e1a');
  }
  // пузыри
  px(ctx, cx - 4, top + 2, '#d6ff9e');
  px(ctx, cx + 5, top + 3, '#7ade3f');
  // подтёк жижи по корпусу
  vline(ctx, cx + 7, top + 4, top + 9, '#3aa32a');
  px(ctx, cx + 7, top + 10, '#7ade3f');
  px(ctx, cx + 6, top + 6, '#2c5e1a');
  // свечение над жижей (разрешённая полупрозрачность)
  for (let x = cx - 6; x <= cx + 6; x += 2) px(ctx, x, top - 1, '#7ade3f', 0.55);
  // символ радиационной опасности (жёлтый круг-наклейка)
  rect(ctx, cx - 4, top + 23, 9, 8, '#c9a82e');
  hline(ctx, cx - 3, cx + 3, top + 22, '#ffd24a');
  hline(ctx, cx - 3, cx + 3, top + 31, '#8c5a08');
  for (const [dx, dy] of [[0, 0], [-2, -2], [2, -2], [-1, -1], [1, -1], [0, 2], [0, 3]]) {
    px(ctx, cx + dx, top + 27 + dy, '#1b1d22');
  }
  // контур
  vline(ctx, cx - hw - 1, top + 2, bot, OUT);
  vline(ctx, cx + hw + 1, top + 2, bot, OUT);
  hline(ctx, cx - hw + 1, cx + hw - 1, top - 1, OUT);
  hline(ctx, cx - hw - 1, cx + hw + 1, 63, OUT);
}

// ---------------------------------------------------------------------------
// Лампа (2 кадра мерцания)
// ---------------------------------------------------------------------------

function drawLamp(ctx, frame) {
  groundShadow(ctx, 32, 11);
  const cx = 32;
  // основание-постамент
  for (let j = 0; j < 4; j++) {
    const hw = 5 + j;
    hline(ctx, cx - hw, cx + hw, 59 + j, j === 0 ? '#6d7380' : '#2e3138');
    px(ctx, cx - hw, 59 + j, '#494e58');
    px(ctx, cx + hw, 59 + j, '#1b1d22');
  }
  hline(ctx, cx - 8, cx + 8, 63, OUT);
  vline(ctx, cx - 9, 61, 62, OUT);
  vline(ctx, cx + 9, 61, 62, OUT);
  // стойка
  rect(ctx, cx - 2, 38, 5, 21, '#2e3138');
  vline(ctx, cx - 2, 38, 58, '#6d7380');
  vline(ctx, cx + 2, 38, 58, '#1b1d22');
  vline(ctx, cx - 3, 38, 58, OUT);
  vline(ctx, cx + 3, 38, 58, OUT);
  // кольца на стойке
  hline(ctx, cx - 2, cx + 2, 44, '#494e58');
  hline(ctx, cx - 2, cx + 2, 52, '#494e58');
  // плафон: светящаяся колба
  const glow = frame === 0;
  const lampTones = glow
    ? ['#c44d12', '#f08a1d', '#ffd24a', '#fff6c9', '#ffffff']
    : ['#a8400e', '#d4711a', '#f0b83a', '#ffe9a0', '#fff6c9'];
  const dome = [[28, 3], [29, 5], [30, 6], [31, 7], [32, 7], [33, 7], [34, 7], [35, 6], [36, 5], [37, 4]];
  for (const [y, hw] of dome) {
    for (let x = cx - hw; x <= cx + hw; x++) {
      const d = Math.abs(x - cx) / hw;
      let ti = d < 0.35 ? 4 : d < 0.6 ? 3 : d < 0.85 ? 2 : 1;
      if (y >= 36) ti = Math.max(1, ti - 1);
      px(ctx, x, y, lampTones[ti]);
    }
  }
  // металлический колпак сверху
  hline(ctx, cx - 5, cx + 5, 26, '#494e58');
  hline(ctx, cx - 6, cx + 6, 27, '#2e3138');
  px(ctx, cx - 5, 26, '#99a0ad');
  hline(ctx, cx - 5, cx + 5, 25, OUT);
  // крепление плафона к стойке
  hline(ctx, cx - 4, cx + 4, 38, '#1b1d22');
  // дизеренное свечение вокруг плафона (кадры различаются радиусом)
  const halo = glow ? 4 : 2;
  for (let y = 26 - halo; y <= 40 + (glow ? 2 : 0); y++) {
    for (let x = cx - 8 - halo; x <= cx + 8 + halo; x++) {
      const d = Math.hypot(x - cx, (y - 32) * 1.3);
      if (d > 8 && d < 8 + halo && ((x + y) & 1) === 0) {
        px(ctx, x, y, glow ? '#ffd24a' : '#f0b83a', d < 10 ? 0.6 : 0.52);
      }
    }
  }
  // блик
  px(ctx, cx - 3, 30, '#ffffff');
  px(ctx, cx - 2, 29, '#ffffff');
}

// ---------------------------------------------------------------------------
// Адский факел (4 кадра пламени)
// ---------------------------------------------------------------------------

// Пиксельное пламя: языки по детерминированному шуму, рваная кромка.
function flame(ctx, cx, baseY, w, h, seed) {
  for (let j = 0; j < h; j++) {
    const t = j / h; // 0 у основания, 1 у вершины
    const y = baseY - j;
    const hw = Math.max(1, Math.round((w / 2) * (1 - t * t) + (hash2(3, j, seed) - 0.5) * 2.4 * t));
    const sway = Math.round((hash2(7, j, seed) - 0.5) * 4 * t);
    for (let x = cx - hw + sway; x <= cx + hw + sway; x++) {
      if (t > 0.4 && hash2(x, y, seed) > 0.82) continue; // рваная кромка
      const dc = Math.abs(x - cx - sway) / Math.max(1, hw);
      const heat = (1 - t) * (1 - dc * 0.7);
      let c;
      if (heat > 0.72) c = FIRE[4];
      else if (heat > 0.52) c = FIRE[3];
      else if (heat > 0.34) c = FIRE[2];
      else if (heat > 0.17) c = FIRE[1];
      else c = FIRE[0];
      px(ctx, x, y, c);
    }
  }
  // искры над пламенем
  const rng = mulberry32(seed * 7919 + 17);
  for (let i = 0; i < 4; i++) {
    const sx = cx + Math.floor((rng() - 0.5) * w * 1.4);
    const sy = baseY - h - 1 - Math.floor(rng() * 5);
    px(ctx, sx, sy, rng() > 0.5 ? FIRE[3] : FIRE[2]);
  }
  // тёплый отсвет у основания пламени (вплотную, без «обруча»)
  for (let x = cx - (w >> 1) - 2; x <= cx + (w >> 1) + 2; x++) {
    if (((x + baseY) & 1) === 0) px(ctx, x, baseY + 1, FIRE[1], 0.6);
  }
}

function drawTorch(ctx, frame) {
  groundShadow(ctx, 32, 10);
  const cx = 32;
  // треножное основание
  hline(ctx, cx - 7, cx + 7, 62, RUST[0]);
  hline(ctx, cx - 5, cx + 5, 61, RUST[1]);
  px(ctx, cx - 7, 61, RUST[2]);
  hline(ctx, cx - 8, cx + 8, 63, OUT);
  // кованый шест
  rect(ctx, cx - 1, 36, 3, 25, RUST[1]);
  vline(ctx, cx - 1, 36, 60, RUST[2]);
  vline(ctx, cx + 1, 36, 60, RUST[0]);
  vline(ctx, cx - 2, 36, 60, OUT);
  vline(ctx, cx + 2, 36, 60, OUT);
  // кольцо-узел на шесте
  hline(ctx, cx - 2, cx + 2, 47, METAL[0]);
  hline(ctx, cx - 2, cx + 2, 48, METAL[2]);
  // чаша с когтями
  for (let j = 0; j < 4; j++) {
    const hw = 6 - j;
    hline(ctx, cx - hw, cx + hw, 32 + j, j === 0 ? RUST[2] : RUST[1]);
    px(ctx, cx - hw, 32 + j, RUST[3]);
    px(ctx, cx + hw, 32 + j, RUST[0]);
  }
  hline(ctx, cx - 7, cx + 7, 31, OUT);
  hline(ctx, cx - 3, cx + 3, 36, OUT);
  // когти-зубцы по краям чаши
  for (const dx of [-6, 0, 6]) {
    vline(ctx, cx + dx, 28, 30, RUST[1]);
    px(ctx, cx + dx, 27, RUST[2]);
  }
  // пламя (кадры различаются высотой, наклоном и языками)
  const hgt = [16, 19, 17, 21][frame];
  flame(ctx, cx, 30, 12, hgt, 211 + frame * 37);
  // отсвет на чаше
  hline(ctx, cx - 3, cx + 1, 32, FIRE[2]);
  px(ctx, cx - 1, 33, FIRE[3]);
}

// ---------------------------------------------------------------------------
// Техно-колонна
// ---------------------------------------------------------------------------

function drawPillar(ctx) {
  groundShadow(ctx, 32, 15);
  const cx = 32;
  // капитель
  hline(ctx, cx - 12, cx + 12, 27, METAL[3]);
  hline(ctx, cx - 13, cx + 13, 28, METAL[2]);
  hline(ctx, cx - 13, cx + 13, 29, METAL[1]);
  hline(ctx, cx - 12, cx + 12, 26, OUT);
  vline(ctx, cx - 14, 28, 29, OUT);
  vline(ctx, cx + 14, 28, 29, OUT);
  // ствол колонны с цилиндрическим затенением и панелями
  for (let y = 30; y <= 57; y++) {
    for (let x = cx - 10; x <= cx + 10; x++) {
      const t = (x - (cx - 10)) / 20;
      let ti = t < 0.05 ? 0 : t < 0.18 ? 1 : t < 0.34 ? 2 : t < 0.48 ? 3 : t < 0.6 ? 2 : t < 0.85 ? 1 : 0;
      // швы панелей
      if (y === 37 || y === 47) ti = 0;
      if ((y === 38 || y === 48) && ti > 0) ti = Math.min(4, ti + 1);
      // потёртости
      if (hash2(x, y, 57) > 0.94) ti = Math.min(4, ti + 1);
      px(ctx, x, y, METAL[ti]);
    }
  }
  vline(ctx, cx - 11, 30, 57, OUT);
  vline(ctx, cx + 11, 30, 57, OUT);
  // заклёпки
  for (const ry of [33, 43, 53]) {
    px(ctx, cx - 8, ry, METAL[4]);
    px(ctx, cx + 8, ry, METAL[3]);
  }
  // сигнальная лампочка-индикатор
  px(ctx, cx, 33, '#7ade3f');
  px(ctx, cx - 1, 33, '#2cab2c');
  px(ctx, cx, 32, '#2cab2c');
  // жёлтая предупредительная разметка
  for (let i = 0; i < 5; i++) {
    px(ctx, cx - 6 + i * 3, 51, '#ffd24a');
    px(ctx, cx - 5 + i * 3, 52, '#c9a82e');
  }
  // база
  hline(ctx, cx - 12, cx + 12, 58, METAL[2]);
  hline(ctx, cx - 13, cx + 13, 59, METAL[1]);
  rect(ctx, cx - 13, 60, 27, 3, METAL[1]);
  hline(ctx, cx - 13, cx + 13, 60, METAL[3]);
  hline(ctx, cx - 13, cx + 13, 62, METAL[0]);
  vline(ctx, cx - 14, 59, 62, OUT);
  vline(ctx, cx + 14, 59, 62, OUT);
  hline(ctx, cx - 14, cx + 14, 63, OUT);
}

// ---------------------------------------------------------------------------
// Трупы
// ---------------------------------------------------------------------------

function drawCorpse0(ctx) {
  // морпех, сполз по стене: сидит, ноги вытянуты вправо
  const rng = mulberry32(9001);
  // лужа крови
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng());
    const x = Math.round(26 + Math.cos(a) * r * 20);
    const y = Math.round(60 + Math.sin(a) * r * 3.2);
    px(ctx, x, y, rng() > 0.7 ? BLOOD[0] : BLOOD[1]);
  }
  // вытянутые ноги (вправо)
  rect(ctx, 30, 54, 14, 4, '#2c5e1a');
  hline(ctx, 30, 43, 54, '#3aa32a');
  hline(ctx, 30, 43, 57, '#15300f');
  // ботинки
  rect(ctx, 44, 53, 5, 5, '#3a2417');
  hline(ctx, 44, 48, 53, '#6b3a24');
  vline(ctx, 49, 53, 57, OUT);
  hline(ctx, 44, 49, 58, OUT);
  // вторая нога согнута
  rect(ctx, 33, 50, 8, 4, '#1c4a14');
  hline(ctx, 33, 40, 50, '#2c5e1a');
  // торс, привалился к стене (слева, чуть наклонён)
  for (let j = 0; j < 14; j++) {
    const hw = 6 + (j > 9 ? 1 : 0);
    const tx = 22 - (j >> 3);
    hline(ctx, tx - hw + 4, tx + hw, 40 + j, j < 2 ? '#3aa32a' : '#2c5e1a');
    px(ctx, tx - hw + 4, 40 + j, '#3aa32a');
    px(ctx, tx + hw, 40 + j, '#15300f');
  }
  // рваная рана на груди
  for (let i = 0; i < 12; i++) {
    const x = 19 + Math.floor(rng() * 7);
    const y = 44 + Math.floor(rng() * 6);
    px(ctx, x, y, rng() > 0.5 ? BLOOD[2] : BLOOD[1]);
  }
  px(ctx, 22, 46, BLOOD[3]);
  // подтёк крови вниз
  vline(ctx, 23, 50, 56, BLOOD[1]);
  px(ctx, 23, 57, BLOOD[2]);
  // рука, упавшая на пол
  rect(ctx, 12, 52, 4, 8, '#2c5e1a');
  vline(ctx, 12, 52, 59, '#3aa32a');
  rect(ctx, 11, 59, 4, 3, SKIN[2]);
  px(ctx, 11, 59, SKIN[3]);
  hline(ctx, 10, 14, 62, OUT);
  // голова, упавшая на грудь
  for (const [y, hw] of [[34, 3], [35, 4], [36, 4], [37, 4], [38, 4], [39, 3]]) {
    for (let x = 24 - hw; x <= 24 + hw; x++) {
      let c = SKIN[2];
      if (x <= 24 - hw + 1) c = SKIN[3];
      else if (x >= 24 + hw - 1) c = SKIN[1];
      if (y <= 36) c = x < 24 ? '#1c4a14' : '#2c5e1a'; // каска
      px(ctx, x, y, c);
    }
  }
  hline(ctx, 20, 28, 33, OUT);
  px(ctx, 25, 38, BLOOD[2]); // кровь у рта
  // контур силуэта снизу
  hline(ctx, 14, 30, 58, '#15300f');
}

function drawCorpse1(ctx) {
  // тело, насаженное на кол (адский декор)
  const rng = mulberry32(6660);
  groundShadow(ctx, 32, 9);
  const cx = 32;
  // лужа и брызги у основания
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng());
    px(ctx, Math.round(cx + Math.cos(a) * r * 9), Math.round(61 + Math.sin(a) * r * 2.2), rng() > 0.6 ? BLOOD[0] : BLOOD[1]);
  }
  // деревянный кол, заострён кверху
  rect(ctx, cx - 1, 18, 3, 45, RUST[1]);
  vline(ctx, cx - 1, 18, 62, RUST[2]);
  vline(ctx, cx + 1, 20, 62, RUST[0]);
  px(ctx, cx, 16, RUST[2]);
  px(ctx, cx, 17, RUST[1]);
  vline(ctx, cx - 2, 22, 62, OUT);
  vline(ctx, cx + 2, 22, 62, OUT);
  // потёки крови по колу
  vline(ctx, cx, 30, 38 + Math.floor(rng() * 6), BLOOD[1]);
  px(ctx, cx - 1, 36, BLOOD[2]);
  // тело перегнуто через остриё (торс горизонтально, спина выгнута)
  for (let j = 0; j < 7; j++) {
    const y = 22 + j;
    const hw = [5, 7, 8, 8, 8, 7, 5][j];
    for (let x = cx - hw; x <= cx + hw; x++) {
      let c = SKIN[1];
      if (j === 0) c = SKIN[2];
      else if (j >= 5) c = SKIN[0];
      if (Math.abs(x - cx) <= 1 && j >= 2) c = BLOOD[2]; // рана вокруг острия
      if (hash2(x, y, 66) > 0.88) c = BLOOD[1];          // запёкшаяся кровь
      px(ctx, x, y, c);
    }
  }
  px(ctx, cx, 21, RUST[2]); // остриё торчит из спины
  px(ctx, cx, 20, BLOOD[3]);
  hline(ctx, cx - 6, cx + 6, 21, OUT);
  // свесившаяся голова (слева, вниз)
  for (const [y, hw] of [[29, 2], [30, 3], [31, 3], [32, 3], [33, 2]]) {
    for (let x = cx - 11; x <= cx - 11 + hw * 2; x++) {
      px(ctx, x, y, x < cx - 9 ? SKIN[2] : SKIN[1]);
    }
  }
  px(ctx, cx - 10, 31, '#0a0a0d'); // запавший глаз
  px(ctx, cx - 8, 34, BLOOD[2]);
  vline(ctx, cx - 9, 34, 37, BLOOD[1]); // кровь капает с головы
  // свесившиеся руки
  vline(ctx, cx - 7, 29, 38, SKIN[1]);
  vline(ctx, cx - 6, 29, 36, SKIN[0]);
  px(ctx, cx - 7, 39, SKIN[2]);
  // свесившиеся ноги (справа)
  vline(ctx, cx + 6, 29, 40, '#3a2d22');
  vline(ctx, cx + 7, 29, 41, '#2a2018');
  rect(ctx, cx + 6, 41, 3, 3, RUST[0]); // ботинок
  px(ctx, cx + 8, 44, OUT);
  // капля крови в полёте
  px(ctx, cx - 9, 44, BLOOD[2]);
  px(ctx, cx - 9, 52, BLOOD[1]);
}

// ---------------------------------------------------------------------------
// Экспорт (§4/§8): все ключи предметов и декора
// ---------------------------------------------------------------------------

export function generateSprites() {
  const sprites = new Map();
  const add = (key, draw, ...args) => {
    const ctx = makeCanvas();
    draw(ctx, ...args);
    sprites.set(key, ctx.canvas);
  };

  add('stimpack', drawStimpack);
  add('medikit', drawMedikit);
  add('healthbonus', drawHealthBonus);
  add('armorbonus', drawArmorBonus);
  add('armorgreen', drawArmorGreen);
  add('armorblue', drawArmorBlue);
  add('soulsphere', drawSoulsphere);

  add('ammo_clip', drawAmmoClip);
  add('ammo_bulletbox', drawAmmoBulletbox);
  add('ammo_shells', drawAmmoShells);
  add('ammo_shellbox', drawAmmoShellbox);
  add('ammo_rocket', drawAmmoRocket);
  add('ammo_rocketbox', drawAmmoRocketbox);
  add('ammo_cell', drawAmmoCell);
  add('ammo_cellpack', drawAmmoCellpack);

  add('pickup_shotgun', drawPickupShotgun);
  add('pickup_chaingun', drawPickupChaingun);
  add('pickup_rocketlauncher', drawPickupRocketlauncher);
  add('pickup_plasmarifle', drawPickupPlasmarifle);
  add('pickup_bfg', drawPickupBfg);

  add('key_blue', drawKeyBlue);
  add('key_yellow', drawKeyYellow);
  add('key_red', drawKeyRed);

  add('barrel', drawBarrel);
  for (let i = 0; i < 2; i++) add('lamp' + i, drawLamp, i);
  for (let i = 0; i < 4; i++) add('torch' + i, drawTorch, i);
  add('pillar', drawPillar);
  add('corpse0', drawCorpse0);
  add('corpse1', drawCorpse1);

  return sprites;
}
