// HELLBOUND — js/engine/raycaster.js [B1]
// Программный рендерер (контракт: docs/architecture.md §13): DDA-стены без «рыбьего
// глаза», раздвижные двери в середине клетки (полотно уезжает вбок по openness, откосы
// SUPPORT), per-pixel пол/потолок с учётом pz и pitch (y-shear), панорамное небо SKY1,
// спрайты с z-буфером и вертикальным позиционированием, 16-ступенчатое квантование света.
// ImageData трактуется как little-endian ABGR (0xAABBGGRR); альфа результата всегда 0xFF.
// Текстуры стен хранятся колонко-мажорно, полы/потолки и спрайты — строко-мажорно.
// В кадровом цикле — ноль аллокаций (все буферы преаллоцированы и переиспользуются).

import { SCREEN_W, VIEW_H, FOV, PROJ_DIST, MAX_DIST, EYE } from '../config.js';

const TWO_PI = Math.PI * 2;
const EMPTY_ENTITIES = [];
const FALLBACK_FLAT = { tex: '', light: 0.6, damage: 0 };

// 16 ступеней света: индекс 0..15 -> целый множитель 1..256 для (канал * f) >> 8.
// LIGHT_F[0]=1 даёт чёрный, LIGHT_F[15]=256 — без затемнения (бандинг в духе Doom).
const LIGHT_F = new Uint16Array(16);
for (let i = 0; i < 16; i++) LIGHT_F[i] = i * 17 + 1;

// Шахматная магента-заглушка 64×64. Паттерн симметричен относительно диагонали,
// поэтому один массив корректен и как колонко-, и как строко-мажорный.
function makeFallbackTexture() {
  const w = 64, h = 64;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[y * w + x] = (((x >> 3) ^ (y >> 3)) & 1) ? 0xffff00ff : 0xff000000;
    }
  }
  return { data, w, h };
}

// Канвас -> { data: Uint32Array (строко-мажорно, little-endian ABGR), w, h }.
function readCanvas(canvas) {
  if (!canvas || !canvas.width || !canvas.height || typeof canvas.getContext !== 'function') return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  return { data: new Uint32Array(img.data.buffer, img.data.byteOffset, w * h), w, h };
}

// Строко-мажорная текстура -> колонко-мажорная (data[x * h + y]); w/h — исходные размеры.
function transposed(t) {
  const { data, w, h } = t;
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) out[x * h + y] = data[row + x];
  }
  return { data: out, w, h };
}

export class Raycaster {
  constructor() {
    const W = SCREEN_W;
    this._walls = new Map();    // колонко-мажорные текстуры (стены, двери, небо)
    this._flats = new Map();    // строко-мажорные текстуры (полы/потолки)
    this._sprites = new Map();  // строко-мажорные спрайты (с альфой)
    this._warned = new Set();
    this._fallback = makeFallbackTexture();
    this._tanHalf = Math.tan(FOV / 2);

    // Поколоночные константы камеры: cameraX в [-1,1) и угловое смещение луча для неба.
    this._camX = new Float32Array(W);
    this._atanA = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const cx = (2 * x) / W - 1;
      this._camX[x] = cx;
      this._atanA[x] = Math.atan(cx * this._tanHalf);
    }

    this._zbuf = new Float32Array(W);   // перпендикулярная дистанция стены по колонке
    this._yTop = new Int16Array(W);     // закрытый стеной вертикальный диапазон
    this._yBot = new Int16Array(W);
    this._skyOff = new Int32Array(W);   // колонко-мажорное смещение в панораме неба
    this._fb = null;                    // Uint32Array-вид буфера кадра (кэш)

    // Буферы сортировки спрайтов (растут степенями двойки, в кадре аллокаций нет).
    this._cap = 256;
    this._sDepth = new Float32Array(this._cap);
    this._sTX = new Float32Array(this._cap);
    this._order = new Int32Array(this._cap);
  }

  // { textures, sprites } — Map<string, canvas>; конвертируется в Uint32Array.
  setAssets(assets) {
    this._walls = new Map();
    this._flats = new Map();
    this._sprites = new Map();
    const textures = assets && assets.textures;
    const sprites = assets && assets.sprites;
    if (textures) {
      for (const [name, canvas] of textures) {
        const t = readCanvas(canvas);
        if (!t) continue;
        this._flats.set(name, t);              // для per-pixel пола/потолка
        this._walls.set(name, transposed(t));  // для колонок стен и неба
      }
    }
    if (sprites) {
      for (const [name, canvas] of sprites) {
        const t = readCanvas(canvas);
        if (t) this._sprites.set(name, t);
      }
    }
  }

  // Отсутствующий ключ: один console.warn + магента-заглушка (кэшируется в Map,
  // чтобы последующие кадры шли по быстрому пути без проверок).
  _lookup(store, name) {
    const t = store.get(name);
    if (t !== undefined) return t;
    const key = String(name);
    if (!this._warned.has(key)) {
      this._warned.add(key);
      console.warn(`HELLBOUND raycaster: отсутствует ассет «${key}» — подставлена заглушка.`);
    }
    store.set(name, this._fallback);
    return this._fallback;
  }

  // frame: ImageData 480×300 (пишутся только строки 0..VIEW_H-1).
  // scene = { map, px, py, pz, angle, pitch, entities, lightBoost, t }
  render(frame, scene) {
    const W = SCREEN_W, VH = VIEW_H;
    if (!this._fb || this._fb.buffer !== frame.data.buffer) {
      this._fb = new Uint32Array(frame.data.buffer);
    }
    const fb = this._fb;
    const map = scene.map;
    if (!map) return;

    const px = scene.px, py = scene.py;
    const pz = typeof scene.pz === 'number' ? scene.pz : EYE;
    const pitch = scene.pitch || 0;
    const boost = scene.lightBoost || 0;
    const horizon = VH / 2 + pitch;
    const dirX = Math.cos(scene.angle), dirY = Math.sin(scene.angle);
    const tanH = this._tanHalf;
    const planeX = -dirY * tanH, planeY = dirX * tanH;
    const zbuf = this._zbuf, yTopA = this._yTop, yBotA = this._yBot;
    const camX = this._camX, LF = LIGHT_F;
    const pMapX = Math.floor(px), pMapY = Math.floor(py);

    // ---- Небо: u зависит только от углов колонок, считается один раз за кадр ----
    const sky = this._lookup(this._walls, 'SKY1');
    const skyData = sky.data, skyH = sky.h;
    const skyOff = this._skyOff;
    const skyScale = sky.w / TWO_PI;
    for (let x = 0; x < W; x++) {
      let u = ((scene.angle + this._atanA[x]) * skyScale) % sky.w;
      if (u < 0) u += sky.w;
      skyOff[x] = (u | 0) * skyH; // колонко-мажорное смещение колонки панорамы
    }

    // ================== 1. Стены и двери: DDA по 480 колонкам ==================
    for (let x = 0; x < W; x++) {
      const cX = camX[x];
      const rayDirX = dirX + planeX * cX;
      const rayDirY = dirY + planeY * cX;
      let mapX = pMapX, mapY = pMapY;
      const deltaX = rayDirX !== 0 ? Math.abs(1 / rayDirX) : 1e30;
      const deltaY = rayDirY !== 0 ? Math.abs(1 / rayDirY) : 1e30;
      let stepX, stepY, sideDistX, sideDistY;
      if (rayDirX < 0) { stepX = -1; sideDistX = (px - mapX) * deltaX; }
      else { stepX = 1; sideDistX = (mapX + 1 - px) * deltaX; }
      if (rayDirY < 0) { stepY = -1; sideDistY = (py - mapY) * deltaY; }
      else { stepY = 1; sideDistY = (mapY + 1 - py) * deltaY; }

      let hit = false, perp = 0, texFrac = 0, flipTex = false, sideF = 1, side = 0;
      let texName = null, lightX = pMapX, lightY = pMapY;
      let prevDoor = null, airX = pMapX, airY = pMapY; // последняя «воздушная» клетка

      for (let i = 0; i < 256; i++) {
        if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
        else { sideDistY += deltaY; mapY += stepY; side = 1; }

        const door = map.getDoor(mapX, mapY);
        if (door) {
          // sideDist уже указывает на СЛЕДУЮЩУЮ границу, поэтому вход — минус delta.
          const entry = side === 0 ? sideDistX - deltaX : sideDistY - deltaY;
          if (door.secret) {
            // Потайная дверь: полотно заподлицо с гранью входа — выглядит как стена,
            // при открытии уезжает вбок так же, как обычная (texX = wallX - openness).
            let wx = side === 0 ? py + entry * rayDirY : px + entry * rayDirX;
            wx -= Math.floor(wx);
            if (wx >= door.openness) {
              hit = true; perp = entry; texName = door.tex;
              texFrac = wx - door.openness; flipTex = false;
              sideF = side === 1 ? 0.78 : 1;
              lightX = airX; lightY = airY;
              break;
            }
          } else {
            // Обычная дверь: полотно в СЕРЕДИНЕ клетки. vertical=false -> плоскость
            // x=ix+0.5 (полотно вдоль Y), vertical=true -> плоскость y=iy+0.5.
            const exitD = sideDistX < sideDistY ? sideDistX : sideDistY;
            let tMid = -1, wx = -1;
            if (!door.vertical) {
              if (rayDirX !== 0) {
                tMid = (mapX + 0.5 - px) / rayDirX;
                wx = py + tMid * rayDirY - mapY;
              }
            } else if (rayDirY !== 0) {
              tMid = (mapY + 0.5 - py) / rayDirY;
              wx = px + tMid * rayDirX - mapX;
            }
            // Полотно задето, только если средняя плоскость пересечена внутри клетки
            // и луч попал в незадвинутую часть (wallX >= openness — иначе проём).
            if (tMid >= entry - 1e-9 && tMid <= exitD + 1e-9 &&
                wx >= 0 && wx < 1 && wx >= door.openness) {
              hit = true; perp = tMid; texName = door.tex;
              texFrac = wx - door.openness; flipTex = false;
              sideF = door.vertical ? 0.78 : 1;
              lightX = mapX; lightY = mapY;
              break;
            }
          }
          prevDoor = door; airX = mapX; airY = mapY;
          continue;
        }

        const wt = map.getWallTex(mapX, mapY);
        if (wt) {
          hit = true;
          perp = side === 0 ? sideDistX - deltaX : sideDistY - deltaY;
          let wx = side === 0 ? py + perp * rayDirY : px + perp * rayDirX;
          wx -= Math.floor(wx);
          texFrac = wx;
          // Откос дверной ниши: грань, перпендикулярная полотну, сразу за дверной клеткой.
          texName = (prevDoor && side === (prevDoor.vertical ? 0 : 1)) ? 'SUPPORT' : wt;
          flipTex = (side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0);
          sideF = side === 1 ? 0.78 : 1;
          lightX = airX; lightY = airY;
          break;
        }
        prevDoor = null; airX = mapX; airY = mapY;
      }

      if (!hit) { zbuf[x] = Infinity; yTopA[x] = VH; yBotA[x] = -1; continue; }
      if (perp < 1e-4) perp = 1e-4;

      const tex = this._lookup(this._walls, texName);
      const tw = tex.w, th = tex.h, tdata = tex.data;
      let tx = (texFrac * tw) | 0;
      if (tx < 0) tx = 0; else if (tx >= tw) tx = tw - 1;
      if (flipTex) tx = tw - 1 - tx;

      // Проекция: перпендикулярная дистанция -> высота колонны; верх/низ через pz и pitch.
      const colH = PROJ_DIST / perp;
      const top = horizon - (1 - pz) * colH;
      const bottom = top + colH; // == horizon + pz * colH
      let y0 = top | 0; if (y0 < top) y0++;       // ceil
      if (y0 < 0) y0 = 0;
      let y1 = bottom | 0; if (y1 > bottom) y1--; // floor
      if (y1 > VH - 1) y1 = VH - 1;

      // §13.5: свет клетки × дистанционное затухание × сторона + вспышка, 16 ступеней.
      const L = map.getLight(lightX, lightY) * (1 - perp / MAX_DIST) * sideF +
        boost / (1 + perp * 0.5);
      let li = (L * 16) | 0;
      if (li < 0) li = 0; else if (li > 15) li = 15;
      const f = LF[li];

      const tStep = th / colH;
      let tPos = (y0 - top) * tStep;
      const base = tx * th; // колонко-мажорный доступ: последовательная память
      let off = y0 * W + x;
      for (let y = y0; y <= y1; y++) {
        let ty = tPos | 0; if (ty >= th) ty = th - 1;
        const c = tdata[base + ty];
        fb[off] = 0xff000000
          | (((((c >>> 16) & 0xff) * f) >> 8) << 16)
          | (((((c >>> 8) & 0xff) * f) >> 8) << 8)
          | (((c & 0xff) * f) >> 8);
        tPos += tStep; off += W;
      }
      zbuf[x] = perp;
      yTopA[x] = y0;
      yBotA[x] = y1 < y0 ? y0 - 1 : y1;
    }

    // ============ 2. Пол/потолок/небо: per-pixel casting по строкам ============
    // Мировая точка интерполируется между крайними лучами строки (cameraX = -1..+1).
    const rdX0 = dirX - planeX, rdY0 = dirY - planeY;
    const stepFX = (2 * planeX) / W, stepFY = (2 * planeY) / W;
    for (let y = 0; y < VH; y++) {
      const isFloor = y > horizon;
      let d = isFloor ? y - horizon : horizon - y;
      if (d < 0.8) d = 0.8; // строки у самого горизонта: дистанция огромна, свет уйдёт в 0
      const rowDist = ((isFloor ? pz : 1 - pz) * PROJ_DIST) / d;
      let wx = px + rowDist * rdX0;
      let wy = py + rowDist * rdY0;
      const swx = rowDist * stepFX, swy = rowDist * stepFY;
      const dF = 1 - rowDist / MAX_DIST;
      const rowBoost = boost / (1 + rowDist * 0.5);
      let vRow = 0;
      if (!isFloor) {
        // Небо: v линейно от верха экрана (0) к горизонту (skyH-1).
        vRow = ((y * skyH) / horizon) | 0;
        if (vRow < 0) vRow = 0; else if (vRow >= skyH) vRow = skyH - 1;
      }
      const rowOff = y * W;
      let lastIx = 0x7fffffff, lastIy = 0x7fffffff;
      let isSky = false, f = 1;
      let fdata = this._fallback.data, fw = 64, fh = 64;
      for (let x = 0; x < W; x++, wx += swx, wy += swy) {
        if (y >= yTopA[x] && y <= yBotA[x]) continue; // пиксель закрыт стеной
        let ix = wx | 0; if (wx < ix) ix--;
        let iy = wy | 0; if (wy < iy) iy--;
        if (ix !== lastIx || iy !== lastIy) {
          lastIx = ix; lastIy = iy;
          let texKey, cellL;
          if (isFloor) {
            const fo = map.getFloor(ix, iy) || FALLBACK_FLAT;
            texKey = fo.tex; cellL = fo.light; isSky = false;
          } else {
            const co = map.getCeil(ix, iy) || FALLBACK_FLAT;
            texKey = co.tex; cellL = co.light; isSky = texKey === 'SKY';
          }
          if (!isSky) {
            const flat = this._lookup(this._flats, texKey);
            fdata = flat.data; fw = flat.w; fh = flat.h;
            const L = cellL * dF + rowBoost;
            let li = (L * 16) | 0;
            if (li < 0) li = 0; else if (li > 15) li = 15;
            f = LF[li];
          }
        }
        if (isSky) {
          // Небо не затемняется ни светом, ни дистанцией.
          fb[rowOff + x] = 0xff000000 | (skyData[skyOff[x] + vRow] & 0xffffff);
          continue;
        }
        const c = fdata[((wy - iy) * fh | 0) * fw + ((wx - ix) * fw | 0)];
        fb[rowOff + x] = 0xff000000
          | (((((c >>> 16) & 0xff) * f) >> 8) << 16)
          | (((((c >>> 8) & 0xff) * f) >> 8) << 8)
          | (((c & 0xff) * f) >> 8);
      }
    }

    // ================== 3. Спрайты: сортировка и z-буфер ==================
    const ents = scene.entities || EMPTY_ENTITIES;
    const n = ents.length;
    if (n > this._cap) {
      let cap = this._cap;
      while (cap < n) cap *= 2;
      this._cap = cap;
      this._sDepth = new Float32Array(cap);
      this._sTX = new Float32Array(cap);
      this._order = new Int32Array(cap);
    }
    const sd = this._sDepth, stx = this._sTX, ord = this._order;
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    let m = 0;
    for (let i = 0; i < n; i++) {
      const e = ents[i];
      if (!e) continue;
      const dx = e.x - px, dy = e.y - py;
      const tY = invDet * (planeX * dy - planeY * dx); // глубина в пространстве камеры
      if (!(tY > 0.05)) continue;                      // за спиной/в плоскости камеры
      sd[m] = tY;
      stx[m] = invDet * (dirY * dx - dirX * dy);
      ord[m] = i;
      m++;
    }
    // Сортировка по убыванию дистанции; вставками — порядок между кадрами почти стабилен.
    for (let i = 1; i < m; i++) {
      const dV = sd[i], tV = stx[i], oV = ord[i];
      let j = i - 1;
      while (j >= 0 && sd[j] < dV) {
        sd[j + 1] = sd[j]; stx[j + 1] = stx[j]; ord[j + 1] = ord[j];
        j--;
      }
      sd[j + 1] = dV; stx[j + 1] = tV; ord[j + 1] = oV;
    }
    const halfW = W / 2;
    for (let k = 0; k < m; k++) {
      const e = ents[ord[k]];
      const tY = sd[k];
      const spr = this._lookup(this._sprites, e.sprite);
      const sw = spr.w, sh = spr.h, sdat = spr.data;
      const scale = PROJ_DIST / tY;
      const eh = e.h > 0 ? e.h : 0.5;
      const wPx = eh * (sw / sh) * scale; // ширина в мире = h * (canvasW / canvasH)
      if (wPx < 1) continue;
      const hPx = eh * scale;
      const screenX = halfW * (1 + stx[k] / tY);
      const x0f = screenX - wPx * 0.5;
      // Вертикаль: z — высота НИЗА спрайта над полом, верх = z + h (формулы как у стен).
      const bottom = horizon + (pz - (e.z || 0)) * scale;
      const top = bottom - hPx;
      let y0 = top | 0; if (y0 < top) y0++;
      if (y0 < 0) y0 = 0;
      let y1 = bottom | 0; if (y1 > bottom) y1--;
      if (y1 > VH - 1) y1 = VH - 1;
      if (y0 > y1) continue;
      let sx0 = x0f | 0; if (sx0 < x0f) sx0++;
      if (sx0 < 0) sx0 = 0;
      let sx1 = (x0f + wPx) | 0;
      if (sx1 > W - 1) sx1 = W - 1;
      if (sx0 > sx1) continue;

      let f;
      if (e.bright) {
        f = 256; // полный свет, без дистанционного затухания
      } else {
        let eix = e.x | 0; if (e.x < eix) eix--;
        let eiy = e.y | 0; if (e.y < eiy) eiy--;
        const L = map.getLight(eix, eiy) * (1 - tY / MAX_DIST) + boost / (1 + tY * 0.5);
        let li = (L * 16) | 0;
        if (li < 0) li = 0; else if (li > 15) li = 15;
        f = LF[li];
      }

      const tStepX = sw / wPx, tStepY = sh / hPx;
      const ty0 = (y0 - top) * tStepY;
      const flip = !!e.flip;
      for (let sx = sx0; sx <= sx1; sx++) {
        if (zbuf[sx] <= tY) continue; // колонка закрыта стеной
        let txp = ((sx - x0f) * tStepX) | 0;
        if (txp < 0) txp = 0; else if (txp >= sw) txp = sw - 1;
        if (flip) txp = sw - 1 - txp;
        let tPos = ty0;
        let off = y0 * W + sx;
        for (let y = y0; y <= y1; y++) {
          let typ = tPos | 0; if (typ >= sh) typ = sh - 1;
          const c = sdat[typ * sw + txp];
          if ((c >>> 24) >= 128) { // альфа <128 — прозрачно
            fb[off] = 0xff000000
              | (((((c >>> 16) & 0xff) * f) >> 8) << 16)
              | (((((c >>> 8) & 0xff) * f) >> 8) << 8)
              | (((c & 0xff) * f) >> 8);
          }
          tPos += tStepY; off += W;
        }
      }
    }
  }
}
