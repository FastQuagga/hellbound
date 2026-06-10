// HELLBOUND — UI-спрайты (§10, агент A6): лицо героя, иконки ключей HUD,
// логотип, фоны титула и экрана статистики.
// Пиксель-арт по сетке (§4): без градиентов и сглаживания, дизеринг разрешён.
// Вся случайность — детерминированная (mulberry32 / позиционный хеш),
// картинка идентична между запусками. Никаких внешних ресурсов.

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

// Позиционный хеш — стабильный «шум», не зависящий от порядка обхода пикселей.
function hash2(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 974711)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Поверхность: Uint32Array (ABGR little-endian), затем перенос в canvas.
// Непрозрачный пиксель — alpha 0xFF; 0 — полностью прозрачно.
// ---------------------------------------------------------------------------

const COLOR_CACHE = new Map();

function c32(hex) {
  let v = COLOR_CACHE.get(hex);
  if (v === undefined) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    v = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    COLOR_CACHE.set(hex, v);
  }
  return v;
}

function surface(w, h) {
  return { w, h, px: new Uint32Array(w * h) };
}

function put(s, x, y, hex) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
  s.px[y * s.w + x] = c32(hex);
}

function getA(s, x, y) {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return 0;
  return s.px[y * s.w + x] >>> 24;
}

function fillR(s, x, y, w, h, hex) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(s, x + i, y + j, hex);
}

function ditherR(s, x, y, w, h, hexA, hexB, parity = 0) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      put(s, x + i, y + j, ((x + i + y + j + parity) & 1) === 0 ? hexA : hexB);
    }
  }
}

function hline(s, x0, x1, y, hex) {
  for (let x = x0; x <= x1; x++) put(s, x, y, hex);
}

function vline(s, x, y0, y1, hex) {
  for (let y = y0; y <= y1; y++) put(s, x, y, hex);
}

function toCanvas(s) {
  const c = document.createElement('canvas');
  c.width = s.w;
  c.height = s.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s.w, s.h);
  new Uint32Array(img.data.buffer).set(s.px);
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Палитры (§4)
// ---------------------------------------------------------------------------

const MET = ['#1b1d22', '#2e3138', '#494e58', '#6d7380', '#99a0ad'];
const RUST = ['#3a2417', '#6b3a24', '#9c5a2e', '#c97f45'];
const BLD = ['#3d0a0a', '#6e1111', '#a51c1c', '#d23b1e'];
const FIRE = ['#7a1f08', '#c44d12', '#f08a1d', '#ffd24a', '#fff6c9'];
const SKIN = ['#5c4632', '#8a6b48', '#c8a06e', '#e8cfa0'];
const ARM = ['#15300f', '#2c5e1a', '#3aa32a', '#7ade3f'];
const OUT = '#2e2218';   // тёмный контур лица (не чисто чёрный)
const EYEW = '#ded9c4';  // белок
const PUP = '#16181c';   // зрачок

// ===========================================================================
// ЛИЦО ГЕРОЯ 36×40 — параметрическая отрисовка
// look: -1 влево, 0 прямо, 1 вправо; expr: 'open'|'pain'|'grin'|'dead'
// tier: 0..4 — степень окровавленности
// ===========================================================================

// Силуэт головы: [xl, xr] для строки y (квадратная челюсть).
function headSpan(y) {
  if (y === 2) return [11, 24];
  if (y === 3) return [9, 26];
  if (y === 4) return [8, 27];
  if (y >= 5 && y <= 7) return [7, 28];
  if (y >= 8 && y <= 19) return [6, 29];
  if (y >= 20 && y <= 24) return [7, 28];
  if (y >= 25 && y <= 27) return [8, 27];
  if (y >= 28 && y <= 30) return [9, 26];
  if (y === 31) return [10, 25];
  if (y === 32) return [11, 24];
  if (y === 33) return [13, 22];
  return null;
}

function drawHeadBase(s) {
  // Шея (за головой и воротом)
  fillR(s, 13, 31, 10, 6, SKIN[1]);
  vline(s, 12, 33, 36, OUT);
  vline(s, 23, 33, 36, OUT);
  hline(s, 13, 22, 35, SKIN[0]); // тень под подбородком
  // Голова
  for (let y = 2; y <= 33; y++) {
    const sp = headSpan(y);
    if (!sp) continue;
    hline(s, sp[0], sp[1], y, SKIN[2]);
    // тень справа (свет сверху-слева)
    put(s, sp[1] - 1, y, SKIN[1]);
    put(s, sp[1] - 2, y, ((y & 1) === 0) ? SKIN[1] : SKIN[2]);
    // контур
    put(s, sp[0], y, OUT);
    put(s, sp[1], y, OUT);
  }
  hline(s, 13, 22, 33, OUT); // низ подбородка
  // Блики кожи (свет сверху-слева)
  ditherR(s, 9, 9, 8, 4, SKIN[3], SKIN[2]);
  ditherR(s, 9, 18, 5, 5, SKIN[3], SKIN[2], 1);
  ditherR(s, 13, 29, 6, 2, SKIN[3], SKIN[2]);
  // Впадины щёк
  ditherR(s, 8, 20, 2, 5, SKIN[1], SKIN[2]);
  ditherR(s, 25, 20, 2, 5, SKIN[1], SKIN[1], 1);
  // Складка подбородка
  hline(s, 14, 21, 31, SKIN[1]);
}

function drawHair(s) {
  // Копна сверху
  hline(s, 11, 24, 1, RUST[0]);
  for (let y = 2; y <= 6; y++) {
    const sp = headSpan(y);
    for (let x = sp[0]; x <= sp[1]; x++) {
      const left = x < 18;
      let col = RUST[1];
      if (left && ((x + y) & 1) === 0 && y <= 4) col = RUST[2];
      if (x === sp[0] || x === sp[1] || y === 2) col = RUST[0];
      put(s, x, y, col);
    }
  }
  // Яркий блик слева
  ditherR(s, 11, 2, 6, 2, RUST[3], RUST[2]);
  // Рваная чёлка
  const sp7 = headSpan(7);
  for (let x = sp7[0]; x <= sp7[1]; x++) {
    const d = 7 + ((hash2(x, 0, 901) * 3) | 0); // глубина 7..9
    for (let y = 7; y <= d; y++) {
      put(s, x, y, (y === d) ? RUST[0] : RUST[1]);
    }
  }
  // Виски/бачки
  for (let y = 8; y <= 13; y++) {
    const sp = headSpan(y);
    put(s, sp[0], y, RUST[0]);
    put(s, sp[0] + 1, y, RUST[1]);
    put(s, sp[1], y, RUST[0]);
    put(s, sp[1] - 1, y, RUST[1]);
  }
}

function drawEars(s) {
  // Левое ухо
  vline(s, 4, 16, 19, OUT);
  vline(s, 5, 15, 20, SKIN[2]);
  vline(s, 6, 15, 20, SKIN[1]);
  put(s, 5, 15, OUT); put(s, 5, 20, OUT);
  put(s, 5, 17, SKIN[0]); put(s, 5, 18, SKIN[0]);
  // Правое ухо
  vline(s, 31, 16, 19, OUT);
  vline(s, 30, 15, 20, SKIN[1]);
  vline(s, 29, 15, 20, SKIN[0]);
  put(s, 30, 15, OUT); put(s, 30, 20, OUT);
}

function drawCollar(s) {
  // Зелёный ворот брони, плечи трапецией
  const rows = [[36, 8, 27], [37, 6, 29], [38, 4, 31], [39, 3, 32]];
  for (const [y, xl, xr] of rows) {
    for (let x = xl; x <= xr; x++) {
      let col = ARM[1];
      if (x < 18 && ((x + y) & 1) === 0) col = ARM[2]; // свет слева
      if (x === xl || x === xr || y === 39) col = ARM[0];
      put(s, x, y, col);
    }
  }
  // Кромка ворота
  hline(s, 8, 12, 36, ARM[2]);
  hline(s, 23, 27, 36, ARM[1]);
  // Тёмная окантовка горловины
  put(s, 12, 36, ARM[0]); put(s, 23, 36, ARM[0]);
  hline(s, 13, 22, 37, SKIN[0]); // шея уходит за ворот
  hline(s, 13, 22, 38, ARM[0]);
  hline(s, 13, 22, 39, ARM[1]);
  // Заклёпки на плечах
  put(s, 7, 38, ARM[2]); put(s, 28, 38, ARM[2]);
}

function drawBrows(s, expr) {
  if (expr === 'dead') {
    hline(s, 10, 15, 13, RUST[0]);
    hline(s, 20, 25, 13, RUST[0]);
    return;
  }
  if (expr === 'pain') {
    // Брови вздёрнуты у переносицы (страдание)
    hline(s, 9, 12, 13, RUST[0]); hline(s, 13, 15, 12, RUST[0]);
    hline(s, 14, 15, 11, RUST[1]);
    hline(s, 23, 26, 13, RUST[0]); hline(s, 20, 22, 12, RUST[0]);
    hline(s, 20, 21, 11, RUST[1]);
    // морщины на лбу
    hline(s, 13, 22, 9, SKIN[1]);
    hline(s, 14, 21, 7, SKIN[1]);
    return;
  }
  if (expr === 'grin') {
    // Брови сведены вниз к переносице (ярость)
    hline(s, 9, 11, 11, RUST[0]); hline(s, 12, 14, 12, RUST[0]);
    put(s, 15, 13, RUST[0]); put(s, 16, 14, RUST[0]);
    hline(s, 24, 26, 11, RUST[0]); hline(s, 21, 23, 12, RUST[0]);
    put(s, 20, 13, RUST[0]); put(s, 19, 14, RUST[0]);
    // складка меж бровей
    vline(s, 17, 12, 14, SKIN[1]); vline(s, 18, 12, 14, SKIN[1]);
    return;
  }
  // Нейтральный хмурый взгляд: брови чуть ниже у переносицы
  hline(s, 9, 14, 12, RUST[0]); put(s, 15, 13, RUST[0]);
  hline(s, 9, 13, 11, RUST[1]);
  hline(s, 21, 26, 12, RUST[0]); put(s, 20, 13, RUST[0]);
  hline(s, 22, 26, 11, RUST[1]);
}

function drawEyes(s, expr, look, tier) {
  if (expr === 'dead') {
    // Закрытые глаза: веки и тёмная линия
    fillR(s, 10, 14, 6, 2, SKIN[1]);
    fillR(s, 20, 14, 6, 2, SKIN[1]);
    hline(s, 10, 15, 16, OUT);
    hline(s, 20, 25, 16, OUT);
    put(s, 9, 15, SKIN[0]); put(s, 26, 15, SKIN[0]);
    return;
  }
  if (expr === 'pain') {
    // Зажмуренные: толстые изломанные щели + морщины
    fillR(s, 10, 14, 6, 3, SKIN[1]);
    fillR(s, 20, 14, 6, 3, SKIN[1]);
    hline(s, 10, 15, 15, OUT); put(s, 11, 14, OUT); put(s, 14, 16, OUT);
    hline(s, 20, 25, 15, OUT); put(s, 24, 14, OUT); put(s, 21, 16, OUT);
    put(s, 9, 16, SKIN[0]); put(s, 16, 16, SKIN[0]);
    put(s, 19, 16, SKIN[0]); put(s, 26, 16, SKIN[0]);
    return;
  }
  // Открытые глаза (open/grin)
  const swollen = tier >= 3; // правый глаз заплыл
  // Левый глаз
  fillR(s, 10, 14, 6, 3, EYEW);
  hline(s, 10, 15, 13, SKIN[0]);
  put(s, 9, 14, SKIN[0]); put(s, 16, 15, SKIN[0]);
  hline(s, 10, 15, 17, SKIN[1]);
  // Правый глаз
  if (swollen) {
    fillR(s, 20, 14, 6, 1, EYEW);
    fillR(s, 20, 15, 6, 2, SKIN[1]); // заплывшее веко
    hline(s, 20, 25, 15, BLD[1]);
    hline(s, 20, 25, 13, SKIN[0]);
  } else {
    fillR(s, 20, 14, 6, 3, EYEW);
    hline(s, 20, 25, 13, SKIN[0]);
    put(s, 19, 14, SKIN[0]); put(s, 26, 15, SKIN[0]);
    hline(s, 20, 25, 17, SKIN[1]);
  }
  // Зрачки 2×2, сдвиг по look
  const lx = 12 + look * 2;
  fillR(s, lx, 14, 2, 2, PUP);
  if (!swollen) {
    const rx = 22 + look * 2;
    fillR(s, rx, 14, 2, 2, PUP);
  } else {
    fillR(s, 22 + look, 14, 2, 1, PUP);
  }
  if (expr === 'grin') {
    // Прищур: верхнее веко срезает глаз
    hline(s, 10, 15, 14, SKIN[1]);
    if (!swollen) hline(s, 20, 25, 14, SKIN[1]);
  }
}

function drawNose(s, expr) {
  // Переносица и тень справа
  vline(s, 18, 14, 20, SKIN[1]);
  vline(s, 19, 16, 20, SKIN[1]);
  vline(s, 16, 15, 19, SKIN[3]); // блик слева
  // Основание носа
  hline(s, 14, 21, 21, SKIN[1]);
  put(s, 14, 21, OUT); put(s, 15, 21, OUT);
  put(s, 20, 21, OUT); put(s, 21, 21, OUT);
  hline(s, 14, 21, 22, SKIN[1]);
  put(s, 16, 20, SKIN[3]); put(s, 17, 20, SKIN[3]);
  if (expr === 'pain') {
    // Раздутые ноздри
    put(s, 13, 21, OUT); put(s, 22, 21, OUT);
  }
}

function drawMouth(s, expr) {
  if (expr === 'dead') {
    // Безвольно приоткрыт
    fillR(s, 14, 26, 8, 3, BLD[0]);
    hline(s, 13, 22, 25, OUT);
    hline(s, 14, 21, 29, SKIN[1]);
    put(s, 13, 27, OUT); put(s, 22, 27, OUT);
    return;
  }
  if (expr === 'pain') {
    // Открыт в крике: тёмный зев, верхний ряд зубов
    fillR(s, 13, 24, 10, 6, BLD[0]);
    hline(s, 13, 22, 24, EYEW);
    put(s, 15, 24, OUT); put(s, 18, 24, OUT); put(s, 21, 24, OUT);
    vline(s, 12, 24, 29, OUT); vline(s, 23, 24, 29, OUT);
    hline(s, 13, 22, 30, OUT);
    hline(s, 13, 22, 31, SKIN[1]); // нижняя губа
    hline(s, 12, 23, 23, SKIN[1]);
    return;
  }
  if (expr === 'grin') {
    // Широкая злая ухмылка с зубами, углы вверх
    hline(s, 10, 25, 24, OUT);
    put(s, 9, 23, OUT); put(s, 26, 23, OUT);
    fillR(s, 11, 25, 14, 2, EYEW);
    for (let x = 12; x <= 24; x += 3) vline(s, x, 25, 26, SKIN[0]);
    hline(s, 11, 24, 27, OUT);
    put(s, 10, 25, OUT); put(s, 25, 25, OUT);
    hline(s, 12, 23, 28, SKIN[1]); // тень под губой
    // носогубные складки
    put(s, 10, 22, SKIN[1]); put(s, 11, 21, SKIN[1]);
    put(s, 25, 22, SKIN[1]); put(s, 24, 21, SKIN[1]);
    return;
  }
  // Нейтральный мрачный рот: прямая линия, углы вниз
  hline(s, 12, 23, 26, OUT);
  put(s, 11, 25, OUT); put(s, 24, 25, OUT);
  hline(s, 12, 23, 27, SKIN[1]);
  hline(s, 13, 22, 25, SKIN[1]);
}

// Кровь: паттерн зависит ТОЛЬКО от tier (одинаков для fwd/left/right/pain/grin).
function applyBlood(s, tier, expr) {
  const dead = expr === 'dead';
  if (tier <= 0 && !dead) return;
  const t = dead ? 4 : tier;
  const rng = mulberry32(0xfa5e + t * 1013);
  const inEye = (x, y) => y >= 13 && y <= 17 && ((x >= 9 && x <= 16) || (x >= 19 && x <= 26));
  // Потёки от линии волос вниз
  const streaks = [0, 2, 3, 5, 7][t] + (dead ? 3 : 0);
  for (let i = 0; i < streaks; i++) {
    let x = 8 + ((rng() * 20) | 0);
    const len = 4 + ((rng() * (t * 4 + 4)) | 0);
    for (let y = 8; y < 8 + len && y <= 33; y++) {
      if (rng() < 0.3) x += rng() < 0.5 ? -1 : 1;
      if (x < 7 || x > 28) break;
      if (inEye(x, y) && !dead) continue;
      const sp = headSpan(y);
      if (!sp || x <= sp[0] || x >= sp[1]) continue;
      put(s, x, y, y < 12 ? BLD[2] : (rng() < 0.5 ? BLD[1] : BLD[2]));
      if (rng() < 0.25) put(s, x + 1, y, BLD[1]);
    }
  }
  if (t >= 1) {
    // Царапина на правой скуле
    put(s, 24, 19, BLD[2]); put(s, 25, 20, BLD[3]); put(s, 26, 21, BLD[2]);
  }
  if (t >= 2) {
    // Рассечение над левой бровью + кровь у угла рта
    hline(s, 9, 12, 10, BLD[3]); put(s, 10, 11, BLD[2]);
    put(s, 24, 27, BLD[2]); put(s, 25, 28, BLD[1]);
  }
  if (t >= 3) {
    // Гематома вокруг правого глаза, кровь из носа
    for (let y = 12; y <= 18; y++) {
      for (let x = 19; x <= 27; x++) {
        if (inEye(x, y)) continue;
        if (hash2(x, y, 333) < 0.4) put(s, x, y, BLD[1]);
      }
    }
    vline(s, 15, 22, 24, BLD[2]);
    put(s, 15, 25, BLD[1]);
  }
  if (t >= 4) {
    // Лоб и челюсть залиты кровью (дизеринг)
    for (let y = 5; y <= 11; y++) {
      const sp = headSpan(y);
      for (let x = sp[0] + 1; x < sp[1]; x++) {
        if (hash2(x, y, 71) < 0.45) put(s, x, y, hash2(x, y, 72) < 0.5 ? BLD[1] : BLD[2]);
      }
    }
    for (let y = 28; y <= 33; y++) {
      const sp = headSpan(y);
      for (let x = sp[0] + 1; x < sp[1]; x++) {
        if (hash2(x, y, 73) < 0.35) put(s, x, y, BLD[1]);
      }
    }
    put(s, 20, 22, BLD[2]); vline(s, 20, 22, 23, BLD[2]);
  }
  if (dead) {
    // Кровь изо рта в обе стороны, тёмные подтёки
    vline(s, 13, 27, 31, BLD[2]); vline(s, 12, 29, 32, BLD[1]);
    vline(s, 22, 27, 32, BLD[2]); vline(s, 23, 30, 33, BLD[1]);
    for (let y = 13; y <= 20; y++) {
      for (let x = 8; x <= 27; x++) {
        if (hash2(x, y, 74) < 0.18) put(s, x, y, BLD[0]);
      }
    }
  }
}

function enhanceFace(s, look, expr, tier) {
  // Мелкие пиксели читаются как выражение в HUD: зрачковый блик, шрамы, зубы, броня.
  if (expr !== 'dead' && expr !== 'pain') {
    put(s, 12 + look * 2, 14, '#ffffff');
    if (tier < 3) put(s, 22 + look * 2, 14, '#ffffff');
  }
  if (expr === 'pain') {
    hline(s, 12, 23, 30, BLD[1]);
    put(s, 15, 25, '#ffffff');
    put(s, 20, 25, '#ffffff');
  } else if (expr === 'grin') {
    for (let x = 12; x <= 24; x += 2) put(s, x, 25, '#ffffff');
    hline(s, 11, 24, 27, '#5c4632');
    put(s, 10, 23, SKIN[1]);
    put(s, 25, 23, SKIN[1]);
  }
  if (tier >= 1) {
    put(s, 8, 18, BLD[1]);
    put(s, 9, 19, BLD[2]);
  }
  if (tier >= 2) {
    hline(s, 21, 24, 10, BLD[2]);
    put(s, 23, 11, BLD[3]);
  }
  if (tier >= 3) {
    vline(s, 27, 16, 23, BLD[0]);
    put(s, 26, 18, BLD[2]);
  }
  if (tier >= 4 || expr === 'dead') {
    hline(s, 9, 27, 5, BLD[0]);
    put(s, 13, 6, BLD[2]);
    put(s, 21, 8, BLD[2]);
    hline(s, 14, 21, 32, BLD[1]);
  }
  // Потёртая броня на вороте.
  put(s, 8, 37, ARM[3]);
  put(s, 27, 37, ARM[0]);
  hline(s, 5, 31, 39, ARM[0]);
}

function makeFace(look, expr, tier) {
  const s = surface(36, 40);
  drawHeadBase(s);
  drawHair(s);
  drawEars(s);
  drawCollar(s);
  drawBrows(s, expr);
  drawEyes(s, expr, look, tier);
  drawNose(s, expr);
  drawMouth(s, expr);
  applyBlood(s, tier, expr);
  enhanceFace(s, look, expr, tier);
  return toCanvas(s);
}

// ===========================================================================
// ИКОНКИ КЛЮЧЕЙ HUD 16×16
// ===========================================================================

const KEY_TONES = {
  blue: ['#1c2e6e', '#2a52c4', '#4a90ff', '#9cc2ff'],
  yellow: ['#6e4a08', '#b8860b', '#ffd24a', '#fff0a8'],
  red: ['#5c0e0e', '#a51c1c', '#ff4a4a', '#ffb0a0'],
};

function makeHudKey(kind) {
  const s = surface(16, 16);
  const T = KEY_TONES[kind];
  // Корпус карты 10×14 с контуром
  fillR(s, 4, 2, 8, 12, T[1]);
  // Металлическая верхушка с отверстием
  fillR(s, 4, 2, 8, 3, MET[2]);
  hline(s, 5, 10, 2, MET[3]);
  fillR(s, 7, 3, 2, 1, MET[0]); // отверстие
  // Цветное тело: свет слева-сверху, тень справа-снизу
  fillR(s, 4, 5, 8, 9, T[1]);
  vline(s, 4, 5, 13, T[2]);
  hline(s, 4, 10, 5, T[2]);
  vline(s, 11, 6, 13, T[0]);
  hline(s, 5, 11, 13, T[0]);
  // Блик-искра (видно издалека)
  put(s, 5, 6, T[3]); put(s, 6, 6, T[3]); put(s, 5, 7, T[3]);
  // Контактные прорези чипа
  hline(s, 6, 9, 9, T[0]);
  hline(s, 6, 9, 11, T[0]);
  // Внешний контур
  hline(s, 4, 11, 1, MET[0]);
  vline(s, 3, 2, 14, MET[0]);
  vline(s, 12, 2, 14, MET[0]);
  hline(s, 4, 11, 14, MET[0]);
  return toCanvas(s);
}

// ===========================================================================
// ЛОГОТИП «HELLBOUND» 400×110 — металлические буквы с фаской, огонь снизу
// ===========================================================================

const GLYPHS = {
  H: [
    '##.....##', '##.....##', '##.....##', '##.....##',
    '#########', '#########',
    '##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##',
  ],
  E: [
    '#########', '#########', '##.......', '##.......',
    '#######..', '#######..',
    '##.......', '##.......', '##.......', '##.......', '#########', '#########',
  ],
  L: [
    '##.......', '##.......', '##.......', '##.......', '##.......', '##.......',
    '##.......', '##.......', '##.......', '##.......', '#########', '#########',
  ],
  B: [
    '########.', '#########', '##.....##', '##.....##',
    '########.', '########.',
    '##.....##', '##.....##', '##.....##', '##.....##', '#########', '########.',
  ],
  O: [
    '.#######.', '#########', '##.....##', '##.....##', '##.....##', '##.....##',
    '##.....##', '##.....##', '##.....##', '##.....##', '#########', '.#######.',
  ],
  U: [
    '##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##',
    '##.....##', '##.....##', '##.....##', '##.....##', '#########', '.#######.',
  ],
  N: [
    '##.....##', '##.....##', '####...##', '####...##',
    '##.##..##', '##.##..##',
    '##..##.##', '##..##.##', '##...####', '##...####', '##.....##', '##.....##',
  ],
  D: [
    '########.', '#########', '##.....##', '##.....##', '##.....##', '##.....##',
    '##.....##', '##.....##', '##.....##', '##.....##', '#########', '########.',
  ],
};

function makeLogo() {
  const W = 400, H = 110;
  const s = surface(W, H);

  // --- Маска букв (с «талией» как у логотипа DOOM: сужение к середине) ---
  const word = 'HELLBOUND';
  const LW = 38, GAP = 4, LH = 84, X0 = 13, Y0 = 8;
  const mask = new Uint8Array(W * H);
  for (let li = 0; li < word.length; li++) {
    const g = GLYPHS[word[li]];
    const bx = X0 + li * (LW + GAP);
    for (let y = 0; y < LH; y++) {
      const t = y / (LH - 1);
      const pinch = 1 - 0.15 * Math.sin(Math.PI * t);
      const row = Math.min(11, (y / LH * 12) | 0);
      for (let x = 0; x < LW; x++) {
        const u = ((x - 18.5) / pinch + 18.5) / LW * 9;
        const col = u | 0;
        if (col < 0 || col > 8) continue;
        if (g[row][col] === '#') mask[(Y0 + y) * W + (bx + x)] = 1;
      }
    }
  }
  const m = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? mask[y * W + x] : 0;

  // --- Поле огня позади букв (классический «demo fire», детерминированный) ---
  const FT = 46; // огонь не поднимается выше этой строки
  const heat = new Float32Array(W * H);
  for (let x = 0; x < W; x++) {
    const base = 0.62 + 0.38 * hash2(x >> 2, 0, 51);
    heat[(H - 1) * W + x] = base;
    heat[(H - 2) * W + x] = base * 0.96;
  }
  for (let y = H - 3; y >= FT; y--) {
    for (let x = 0; x < W; x++) {
      const xl = x > 0 ? x - 1 : x, xr = x < W - 1 ? x + 1 : x;
      const below = (heat[(y + 1) * W + xl] + heat[(y + 1) * W + x] +
        heat[(y + 1) * W + xr] + heat[(y + 2) * W + x]) * 0.25;
      const cool = 0.86 + 0.13 * hash2(x, y, 52);
      heat[y * W + x] = below * cool;
    }
  }
  for (let y = FT; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = heat[y * W + x];
      if (h < 0.22) continue;
      const lvl = Math.min(4, ((h - 0.22) / 0.78 * 5) | 0);
      // рваная кромка пламени
      if (lvl === 0 && hash2(x, y, 53) < 0.35) continue;
      put(s, x, y, FIRE[lvl]);
    }
  }

  // --- Буквы: металл с фаской, свет сверху-слева, отражение огня снизу ---
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!m(x, y)) continue;
      const up = !m(x, y - 1), dn = !m(x, y + 1), lf = !m(x - 1, y), rt = !m(x + 1, y);
      const up2 = !m(x, y - 2), dn2 = !m(x, y + 2), lf2 = !m(x - 2, y), rt2 = !m(x + 2, y);
      let col;
      if (up || lf) col = MET[4];
      else if (dn || rt) col = MET[0];
      else if (up2 || lf2) col = MET[3];
      else if (dn2 || rt2) col = MET[1];
      else {
        col = MET[2];
        const ly = y - Y0;
        if (ly >= 9 && ly <= 20 && ((x + y) & 1) === 0) col = MET[3]; // светлый пояс
        const n = hash2(x, y, 54);
        if (n < 0.05) col = MET[1];        // царапины
        else if (n > 0.96) col = MET[3];
      }
      // Отражение огня на нижней части букв
      const gy = y - 58;
      if (gy > 0) {
        const f = gy / (H - 58);
        const n = hash2(x, y, 55);
        if (dn && y > 72) col = FIRE[2];                 // раскалённая нижняя кромка
        else if (n < f * 0.85) col = f > 0.6 ? FIRE[1] : (f > 0.3 ? RUST[2] : RUST[1]);
      }
      put(s, x, y, col);
    }
  }

  // --- Тёмная окантовка букв там, где нет пламени ---
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (m(x, y) || getA(s, x, y) !== 0) continue;
      if (m(x - 1, y) || m(x + 1, y) || m(x, y - 1) || m(x, y + 1)) put(s, x, y, '#141419');
    }
  }

  // --- Искры над пламенем ---
  const rng = mulberry32(0x10601);
  for (let i = 0; i < 30; i++) {
    const x = (rng() * W) | 0;
    const y = 30 + ((rng() * 45) | 0);
    if (m(x, y) || getA(s, x, y) !== 0) continue;
    put(s, x, y, rng() < 0.5 ? FIRE[3] : FIRE[2]);
    if (rng() < 0.3) put(s, x, y + 1, FIRE[1]);
  }
  // Заклёпки и подплавленные капли на нижней кромке букв.
  for (let x = 18; x < W - 16; x += 19) {
    for (let y = 12; y < 86; y += 18) {
      if (!m(x, y)) continue;
      put(s, x, y, MET[4]);
      put(s, x + 1, y, MET[1]);
      put(s, x, y + 1, MET[1]);
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 82; y < 94; y++) {
      if (!m(x, y) || m(x, y + 1) || hash2(x, y, 57) > 0.06) continue;
      const len = 2 + ((hash2(x, y, 58) * 5) | 0);
      for (let j = 0; j < len; j++) put(s, x, y + j, j < 2 ? FIRE[2] : FIRE[1]);
    }
  }
  return toCanvas(s);
}

// ===========================================================================
// ФОН ТИТУЛА 480×300 — марсианский пейзаж, база, багровое небо, портал
// ===========================================================================

function makeTitleBg() {
  const W = 480, H = 300, s = surface(W, H);
  const HOR = 212;                 // линия горизонта (начало грунта)
  const PCX = 352, PCY = 76, PR = 33; // портал
  const SKY = ['#0a0a0d', '#141419', '#26090f', '#3d0a0a', '#56120e', '#6e1111'];

  // --- Небо: ступенчатые полосы (блоки 2×2), подсветка вокруг портала ---
  for (let y = 0; y < HOR; y += 2) {
    for (let x = 0; x < W; x += 2) {
      let f = y / HOR * (SKY.length - 1);
      const dx = x - PCX, dy = y - PCY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 90) f += (90 - d) / 38;        // зарево портала
      let i = f | 0;
      const frac = f - i;
      if (hash2(x >> 1, y >> 1, 11) < frac) i++; // дизеринг границ полос
      if (i > 5) i = 5;
      const col = SKY[i];
      put(s, x, y, col); put(s, x + 1, y, col);
      put(s, x, y + 1, col); put(s, x + 1, y + 1, col);
    }
  }
  // --- Звёзды (гуще кверху) ---
  const rng = mulberry32(0xbadc0de);
  for (let i = 0; i < 130; i++) {
    const x = (rng() * W) | 0;
    const y = (rng() * rng() * 165) | 0;
    const dx = x - PCX, dy = y - PCY;
    if (dx * dx + dy * dy < (PR + 14) * (PR + 14)) continue;
    const c = rng();
    put(s, x, y, c < 0.5 ? MET[3] : (c < 0.85 ? MET[4] : RUST[3]));
    if (c > 0.93) { put(s, x + 1, y, MET[2]); put(s, x - 1, y, MET[2]); put(s, x, y + 1, MET[2]); }
  }

  // --- Горящий портал: огненное кольцо, внутри фиолетовый вихрь ---
  for (let y = PCY - PR - 14; y <= PCY + PR + 14; y++) {
    for (let x = PCX - PR - 14; x <= PCX + PR + 14; x++) {
      const dx = x - PCX, dy = y - PCY;
      const d = Math.sqrt(dx * dx + dy * dy);
      const wob = (hash2(x, y, 13) - 0.5) * 2.4; // рваная кромка
      const rr = d + wob;
      if (rr > PR + 12) continue;
      if (rr > PR + 5) {
        if (hash2(x, y, 14) < (PR + 12 - rr) / 16) put(s, x, y, FIRE[0]);
      } else if (rr > PR + 2) {
        put(s, x, y, hash2(x, y, 15) < 0.5 ? FIRE[1] : FIRE[0]);
      } else if (rr > PR - 3) {
        put(s, x, y, hash2(x, y, 16) < 0.55 ? FIRE[2] : FIRE[1]);
      } else if (rr > PR - 5) {
        put(s, x, y, hash2(x, y, 17) < 0.6 ? FIRE[3] : FIRE[2]);
      } else if (rr > 5) {
        // спиральные рукава вихря
        const ang = Math.atan2(dy, dx);
        const arm = ((ang * 3 + rr * 0.45) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        let col = arm < Math.PI ? '#46249c' : '#1c1042';
        const n = hash2(x, y, 18);
        if (n < 0.05) col = '#7a4ae0';
        else if (n > 0.97) col = '#b08aff';
        put(s, x, y, col);
      } else {
        put(s, x, y, '#0a0a0d'); // чёрное ядро
      }
    }
  }
  // Языки пламени вверх от кольца
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI * 0.92 + k * 0.24 + (rng() - 0.5) * 0.1;
    let fx = PCX + Math.cos(a) * PR, fy = PCY + Math.sin(a) * PR;
    const len = 4 + ((rng() * 7) | 0);
    for (let j = 0; j < len; j++) {
      put(s, fx | 0, (fy - j) | 0, j < 2 ? FIRE[2] : (j < 4 ? FIRE[1] : FIRE[0]));
      fx += (rng() - 0.5) * 1.6;
    }
  }

  // --- Дальние горы ада (силуэт с рваным гребнем) ---
  let ridge = 176;
  for (let x = 0; x < W; x++) {
    ridge += (hash2(x >> 2, 0, 19) - 0.5) * 4;
    if (hash2(x, 1, 19) < 0.025) ridge -= 9; // редкие пики
    if (ridge < 150) ridge = 150;
    if (ridge > 200) ridge = 200;
    const top = ridge | 0;
    for (let y = top; y < HOR; y++) put(s, x, y, '#1a070b');
    if (hash2(x, 2, 19) < 0.55) put(s, x, top, '#56120e'); // багровый риммлайт
  }
  // --- Ближний хребет ---
  let r2 = 198;
  for (let x = 0; x < W; x++) {
    r2 += (hash2(x >> 1, 3, 23) - 0.5) * 3;
    if (r2 < 186) r2 = 186;
    if (r2 > 209) r2 = 209;
    for (let y = r2 | 0; y < HOR; y++) put(s, x, y, '#200b10');
  }

  // --- Силуэт базы «Гефест-1» слева ---
  const towers = [
    { x: 28, w: 36, top: 166 }, { x: 64, w: 58, top: 184 },
    { x: 122, w: 26, top: 156 }, { x: 148, w: 40, top: 190 },
  ];
  for (const tw of towers) {
    fillR(s, tw.x, tw.top, tw.w, HOR - tw.top, '#0d0d11');
    hline(s, tw.x, tw.x + tw.w - 1, tw.top, MET[0]);          // кромка крыши
    vline(s, tw.x, tw.top, HOR - 1, MET[0]);
    // освещённые окна
    for (let wy = tw.top + 5; wy < HOR - 4; wy += 6) {
      for (let wx = tw.x + 3; wx < tw.x + tw.w - 3; wx += 5) {
        const n = hash2(wx, wy, 29);
        if (n < 0.38) { put(s, wx, wy, FIRE[2]); put(s, wx + 1, wy, FIRE[1]); }
        else if (n < 0.5) put(s, wx, wy, RUST[1]);
      }
    }
  }
  // Антенна с сигнальным огнём
  vline(s, 46, 128, 165, MET[0]);
  hline(s, 42, 50, 138, MET[0]);
  hline(s, 44, 48, 132, MET[0]);
  put(s, 46, 126, '#ff4a4a'); put(s, 46, 125, '#ffb0a0');
  // Купол радара
  for (let dx = -8; dx <= 8; dx++) {
    const dy = Math.round(Math.sqrt(Math.max(0, 64 - dx * dx)) * 0.7);
    put(s, 135 + dx, 156 - dy, MET[1]);
  }
  // Трубопровод к горизонту
  fillR(s, 188, 202, 78, 3, '#0d0d11');
  hline(s, 188, 265, 202, MET[0]);
  for (let x = 192; x < 264; x += 9) vline(s, x, 202, 206, MET[0]);

  // --- Грунт: красный марсианский реголит ---
  const G = ['#160a06', '#241208', '#33200e', '#3a2417'];
  for (let y = HOR; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = hash2(x, y, 31);
      let i = n < 0.5 ? 1 : (n < 0.82 ? 2 : (n < 0.94 ? 0 : 3));
      if ((y % 7) === 0 && hash2(x, y, 32) < 0.5) i = 0; // горизонтальные борозды
      put(s, x, y, G[i]);
    }
  }
  hline(s, 0, W - 1, HOR, '#56120e'); // подсвеченная линия горизонта
  // Валуны
  for (let i = 0; i < 26; i++) {
    const bx = (rng() * W) | 0;
    const by = HOR + 8 + ((rng() * (H - HOR - 16)) | 0);
    const r = 2 + ((rng() * ((by - HOR) / 22)) | 0);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        if (dx * dx * 0.6 + dy * dy > r * r) continue;
        let col = '#2c1810';
        if (dy < -r * 0.3 && dx < 0) col = '#4e3019';   // свет сверху-слева
        else if (dy > r * 0.3 || dx > r * 0.5) col = '#120805';
        put(s, bx + dx, by + dy, col);
      }
    }
  }
  // Трещины со свечением лавы
  for (let i = 0; i < 6; i++) {
    let cx = 30 + ((rng() * (W - 60)) | 0);
    let cy = HOR + 14 + ((rng() * 60) | 0);
    const len = 24 + ((rng() * 50) | 0);
    for (let j = 0; j < len; j++) {
      cx += (rng() * 3 | 0) - 1;
      cy += rng() < 0.6 ? 1 : 0;
      if (cy >= H) break;
      put(s, cx, cy, rng() < 0.4 ? FIRE[1] : FIRE[0]);
      if (rng() < 0.3) put(s, cx + 1, cy, '#3a1208');
      if (rng() < 0.3) put(s, cx - 1, cy, '#3a1208');
    }
  }
  // Передний план: чёрные зубцы скал, сломанные трубы и огни базы.
  for (let x = 0; x < W; x++) {
    const h = 8 + Math.round(Math.sin(x * 0.045) * 4) + ((hash2(x, 0, 59) * 6) | 0);
    for (let y = H - h; y < H; y++) put(s, x, y, '#080405');
    if ((x % 37) === 0) {
      vline(s, x, H - h - 20, H - h, '#0a0a0d');
      hline(s, x - 4, x + 5, H - h - 12, '#0a0a0d');
    }
  }
  for (let i = 0; i < 36; i++) {
    const x = 24 + ((rng() * 180) | 0);
    const y = 170 + ((rng() * 38) | 0);
    put(s, x, y, rng() < 0.5 ? FIRE[2] : '#2cab2c');
    if (rng() < 0.3) put(s, x + 1, y, FIRE[0]);
  }
  for (let i = 0; i < 28; i++) {
    const a = rng() * Math.PI * 2;
    const d = PR + 12 + rng() * 32;
    put(s, Math.round(PCX + Math.cos(a) * d), Math.round(PCY + Math.sin(a) * d), rng() < 0.5 ? FIRE[3] : FIRE[1]);
  }
  // --- Виньетка по углам (дизеринг) ---
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ex = Math.min(x, W - 1 - x), ey = Math.min(y, H - 1 - y);
      const e = Math.min(ex, ey);
      if (e < 26 && hash2(x, y, 37) < (26 - e) / 26 * 0.55) put(s, x, y, '#0a0a0d');
    }
  }
  return toCanvas(s);
}

// ===========================================================================
// ФОН ЭКРАНА СТАТИСТИКИ 480×300 — приглушённая тактическая карта базы
// ===========================================================================

function makeInterBg() {
  const W = 480, H = 300, s = surface(W, H);
  // --- Тёмная подложка с лёгкой текстурой (блоки 2×2) ---
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const col = hash2(x >> 1, y >> 1, 41) < 0.5 ? '#0b0b10' : '#0f0f15';
      put(s, x, y, col); put(s, x + 1, y, col);
      put(s, x, y + 1, col); put(s, x + 1, y + 1, col);
    }
  }
  // Сетка планшета
  for (let x = 0; x < W; x += 16) vline(s, x, 0, H - 1, '#13131b');
  for (let y = 0; y < H; y += 16) hline(s, 0, W - 1, y, '#13131b');

  // --- Выцветший демонический череп-водяной знак (справа, дизеринг) ---
  const SCX = 366, SCY = 168;
  for (let y = -52; y <= 60; y++) {
    for (let x = -46; x <= 46; x++) {
      const ax = Math.abs(x);
      let inside = false;
      if (y < 14) inside = x * x / (44 * 44) + y * y / (50 * 50) < 1;            // черепная коробка
      else if (y < 36) inside = ax < 30 - (y - 14) * 0.45;                        // скулы
      else if (y < 52) inside = ax < 16;                                          // челюсть
      if (!inside) continue;
      // глазницы и носовая щель
      const exl = (x + 18) * (x + 18) / 121 + (y + 6) * (y + 6) / 64 < 1;
      const exr = (x - 18) * (x - 18) / 121 + (y + 6) * (y + 6) / 64 < 1;
      const nose = ax < 4 && y > 12 && y < 28 && ax < (28 - y) * 0.5;
      const teeth = y >= 38 && y < 52 && (((x + 46) / 6) | 0) % 2 === 0;
      let col = '#1d0c12';
      if (exl || exr || nose) col = '#08080c';
      else if (teeth) col = '#241016';
      if (hash2(x, y, 43) < 0.62) put(s, SCX + x, SCY + y, col);
    }
  }
  // Рога
  for (let k = 0; k < 2; k++) {
    const sgn = k === 0 ? -1 : 1;
    for (let j = 0; j < 26; j++) {
      const hx = SCX + sgn * (40 + Math.round(j * 0.7));
      const hy = SCY - 24 - j;
      const wdt = Math.max(1, 5 - (j >> 3));
      for (let i = 0; i < wdt; i++) {
        if (hash2(hx + i, hy, 44) < 0.62) put(s, hx + sgn * i, hy, '#241016');
      }
    }
  }

  // --- Чертёж базы: сектора и коридоры (приглушённые) ---
  const FILL = { tech: '#0f161a', yard: '#12130c', acid: '#0e1a0e', hell: '#1c0b0f' };
  const EDGE = { tech: '#26323a', yard: '#2e2c1a', acid: '#1f3a1f', hell: '#4a1616' };
  const ROOMS = [
    { x: 30, y: 116, w: 50, h: 44, k: 'tech' },   // старт
    { x: 80, y: 132, w: 56, h: 12, k: 'tech' },   // коридор
    { x: 136, y: 100, w: 64, h: 58, k: 'tech' },  // склад
    { x: 166, y: 158, w: 14, h: 36, k: 'tech' },
    { x: 130, y: 194, w: 88, h: 56, k: 'yard' },  // двор
    { x: 200, y: 114, w: 16, h: 30, k: 'tech' },
    { x: 216, y: 92, w: 70, h: 52, k: 'tech' },   // машинный зал
    { x: 250, y: 144, w: 14, h: 42, k: 'acid' },
    { x: 224, y: 186, w: 64, h: 44, k: 'acid' },  // кислотный резервуар
    { x: 286, y: 106, w: 48, h: 30, k: 'tech' },  // крыло жёлтого ключа
    { x: 304, y: 136, w: 12, h: 28, k: 'hell' },
    { x: 300, y: 164, w: 60, h: 70, k: 'hell' },  // адская зона
    { x: 360, y: 188, w: 34, h: 32, k: 'hell' },  // зал барона
    { x: 394, y: 196, w: 26, h: 14, k: 'hell' },  // к рубильнику
  ];
  for (const r of ROOMS) {
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        if (hash2(x, y, 45) < 0.6) put(s, x, y, FILL[r.k]);
      }
    }
    hline(s, r.x, r.x + r.w - 1, r.y, EDGE[r.k]);
    hline(s, r.x, r.x + r.w - 1, r.y + r.h - 1, EDGE[r.k]);
    vline(s, r.x, r.y, r.y + r.h - 1, EDGE[r.k]);
    vline(s, r.x + r.w - 1, r.y, r.y + r.h - 1, EDGE[r.k]);
  }
  // Отметки дверей по ключам (тусклые засечки)
  const doorMark = (x, y, vert, col) => {
    if (vert) { vline(s, x, y - 3, y + 3, col); vline(s, x + 1, y - 3, y + 3, col); }
    else { hline(s, x - 3, x + 3, y, col); hline(s, x - 3, x + 3, y + 1, col); }
  };
  doorMark(216, 118, true, '#23406e');   // синяя дверь в машинный зал
  doorMark(310, 136, false, '#6e5a14');  // жёлтая дверь в ад
  doorMark(334, 121, true, '#6e1c1c');   // красное хранилище
  // Точки ключей и метки
  put(s, 160, 220, '#2a4a8e'); fillR(s, 159, 219, 3, 3, '#23406e'); // синий ключ во дворе
  fillR(s, 309, 119, 3, 3, '#6e5a14');                              // жёлтый ключ
  fillR(s, 268, 206, 3, 3, '#6e1c1c');                              // красный ключ в кислоте
  // Старт (треугольник) и выход (крест)
  put(s, 42, 136, '#2a4a2a'); hline(s, 41, 43, 137, '#2a4a2a'); hline(s, 40, 44, 138, '#1c4a1c');
  hline(s, 404, 202, 408, '#1c4a1c'); // штрих выхода
  vline(s, 406, 200, 204, '#1c4a1c');
  // Подсвеченный путь прохождения и опасные зоны.
  const route = [[42, 137], [108, 138], [166, 128], [173, 220], [254, 208], [310, 151], [330, 198], [406, 202]];
  for (let i = 0; i < route.length - 1; i++) {
    const [x0, y0] = route[i];
    const [x1, y1] = route[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let j = 0; j <= steps; j += 3) {
      const x = Math.round(x0 + ((x1 - x0) * j) / steps);
      const y = Math.round(y0 + ((y1 - y0) * j) / steps);
      put(s, x, y, '#274a27');
      if ((j & 1) === 0) put(s, x + 1, y, '#1c341c');
    }
  }
  for (const [cx, cy, r] of [[256, 208, 18], [330, 198, 22], [384, 204, 12]]) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r || d < r - 2 || hash2(x, y, 61) > 0.45) continue;
        put(s, x, y, '#3d0a0a');
      }
    }
  }

  // --- Брызги крови по краям планшета ---
  const rng = mulberry32(0x17e2);
  const splat = (cx, cy, n, r) => {
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const d = rng() * rng() * r;
      const x = (cx + Math.cos(a) * d) | 0;
      const y = (cy + Math.sin(a) * d * 0.7) | 0;
      put(s, x, y, rng() < 0.6 ? BLD[0] : BLD[1]);
      if (rng() < 0.3) put(s, x + 1, y, BLD[0]);
    }
  };
  splat(36, 262, 90, 26);
  splat(446, 38, 70, 22);
  splat(452, 270, 50, 16);
  // Царапины
  for (let i = 0; i < 4; i++) {
    let x = (rng() * W) | 0, y = (rng() * H) | 0;
    const len = 14 + ((rng() * 22) | 0);
    for (let j = 0; j < len; j++) { put(s, x, y, '#16161e'); x++; y += rng() < 0.4 ? 1 : 0; }
  }

  // --- Затемнение полос под заголовок и подсказку + виньетка ---
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const band = y < 56 || y > 252;
      if (band && hash2(x, y, 47) < 0.5) put(s, x, y, '#08080c');
      const ex = Math.min(x, W - 1 - x), ey = Math.min(y, H - 1 - y);
      const e = Math.min(ex, ey);
      if (e < 20 && hash2(x, y, 48) < (20 - e) / 20 * 0.6) put(s, x, y, '#070709');
    }
  }
  return toCanvas(s);
}

// ===========================================================================
// Сборка
// ===========================================================================

export function generateSprites() {
  const map = new Map();
  const looks = { fwd: 0, left: -1, right: 1 };
  for (let t = 0; t <= 4; t++) {
    for (const name of ['fwd', 'left', 'right']) {
      map.set('face_' + t + '_' + name, makeFace(looks[name], 'open', t));
    }
    map.set('face_' + t + '_pain', makeFace(0, 'pain', t));
    map.set('face_' + t + '_grin', makeFace(0, 'grin', t));
  }
  map.set('face_dead', makeFace(0, 'dead', 4));
  map.set('hudkey_blue', makeHudKey('blue'));
  map.set('hudkey_yellow', makeHudKey('yellow'));
  map.set('hudkey_red', makeHudKey('red'));
  map.set('logo', makeLogo());
  map.set('title_bg', makeTitleBg());
  map.set('inter_bg', makeInterBg());
  return map;
}
