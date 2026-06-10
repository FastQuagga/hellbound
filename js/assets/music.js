// js/assets/music.js — музыка HELLBOUND [A8]
//
// Процедурный музыкальный движок на WebAudio: секвенсор с lookahead-планированием
// (таймер setInterval ~25мс, планирование событий на 0.1с вперёд по аудио-часам).
//
// Треки:
//   'menu'    — медленный зловещий эмбиент: низкий гул-дрон, редкие «колокола», ~70 BPM.
//   'level'   — драйвовый рифф в духе E1M1: галопирующий бас в E-миноре, ~138 BPM,
//               7 паттернов (рифф A, рифф A', бридж ×2, соло ×2, сбивка), цикл ~59с без швов.
//   'victory' — короткая триумфальная фанфара, ~100 BPM.
//
// Дорожки: бас (пила/квадрат через lowpass), лид (квадрат с лёгким детюном / «колокол»),
// ударные (кик — синус с падением частоты, снейр и хэт — шум через фильтры).
// Громкость — через мастер-gain. Без AudioContext все методы тихо деградируют в no-op.

import { getAudioCtx } from './sounds.js';

// ---------------------------------------------------------------------------
// Константы планировщика
// ---------------------------------------------------------------------------

const LOOKAHEAD_MS = 25;      // период таймера секвенсора
const SCHEDULE_AHEAD = 0.1;   // на сколько секунд вперёд планировать события

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------------------------------------------------------------------
// Детерминированный PRNG (mulberry32) — только для генерации статичного
// буфера шума (снейр/хэт), чтобы «ассет» был одинаковым между запусками.
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noiseCache = null; // { ctx, buf }

function getNoiseBuffer(ctx) {
  if (noiseCache && noiseCache.ctx === ctx) return noiseCache.buf;
  const len = Math.max(1, Math.floor(ctx.sampleRate));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = mulberry32(0xc0ffee);
  for (let i = 0; i < len; i++) data[i] = rnd() * 2 - 1;
  noiseCache = { ctx, buf };
  return buf;
}

// ---------------------------------------------------------------------------
// Ноты (MIDI-номера) — для читаемости паттернов
// ---------------------------------------------------------------------------

const N = {
  E1: 28, B1: 35,
  C2: 36, D2: 38, E2: 40, F2: 41, G2: 43, A2: 45, As2: 46, B2: 47,
  C3: 48, D3: 50, E3: 52, A3: 57, As3: 58, B3: 59,
  C4: 60, D4: 62, Ds4: 63, E4: 64, Fs4: 66, G4: 67, A4: 69, As4: 70, B4: 71,
  C5: 72, D5: 74, Ds5: 75, E5: 76, F5: 77, G5: 79,
};

// ---------------------------------------------------------------------------
// Инструменты. Все узлы создаются в момент планирования и останавливаются сами.
// Формат событий: бас/лид — [шаг, midi, длительностьВШагах=2, velocity=1],
// ударные — [шаг, 'K'|'S'|'H'|'O', velocity=1] (O — открытый хэт).
// ---------------------------------------------------------------------------

function schedBass(ctx, bus, t, midi, dur, vel, o) {
  const osc = ctx.createOscillator();
  osc.type = o.wave;
  osc.frequency.value = midiHz(midi);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = o.q;
  const cut = o.cutoff * (0.7 + 0.3 * vel);
  lp.frequency.setValueAtTime(cut, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(100, cut * 0.4), t + Math.max(0.05, dur));
  const g = ctx.createGain();
  const peak = o.level * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.setTargetAtTime(peak * o.sustain, t + 0.006, o.decay);
  g.gain.setTargetAtTime(0, t + dur, o.release);
  osc.connect(lp);
  lp.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + dur + o.release * 5 + 0.05);
}

function schedBell(ctx, bus, t, midi, vel, o) {
  const f = midiHz(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.level * vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.release);
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = f;
  const o2 = ctx.createOscillator(); // негармоничный частичный тон — «колокол»
  o2.type = 'sine';
  o2.frequency.value = f * 2.756;
  const g2 = ctx.createGain();
  g2.gain.value = 0.35;
  o1.connect(g);
  o2.connect(g2);
  g2.connect(g);
  g.connect(bus);
  o1.start(t);
  o1.stop(t + o.release + 0.1);
  o2.start(t);
  o2.stop(t + o.release + 0.1);
}

function schedLead(ctx, bus, t, midi, dur, vel, o) {
  if (o.kind === 'bell') {
    schedBell(ctx, bus, t, midi, vel, o);
    return;
  }
  const f = midiHz(midi);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cutoff;
  lp.Q.value = 0.9;
  const g = ctx.createGain();
  const peak = o.level * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.setTargetAtTime(peak * o.sustain, t + 0.005, o.decay);
  g.gain.setTargetAtTime(0, t + dur, o.release);
  const stopAt = t + dur + o.release * 5 + 0.05;
  for (const det of [o.detune, -o.detune]) { // квадрат с лёгким детюном — два голоса
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    osc.detune.value = det;
    osc.connect(lp);
    osc.start(t);
    osc.stop(stopAt);
  }
  lp.connect(g);
  g.connect(bus);
}

function schedKick(ctx, bus, t, vel) {
  const osc = ctx.createOscillator(); // синус с падением частоты
  osc.type = 'sine';
  osc.frequency.setValueAtTime(165, t);
  osc.frequency.exponentialRampToValueAtTime(43, t + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.9 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + 0.26);
}

function schedSnare(ctx, bus, t, vel) {
  const src = ctx.createBufferSource(); // шумовая часть
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(bp);
  bp.connect(g);
  g.connect(bus);
  src.start(t);
  src.stop(t + 0.14);
  const osc = ctx.createOscillator(); // «тело» барабана
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.05);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.3 * vel, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(g2);
  g2.connect(bus);
  osc.start(t);
  osc.stop(t + 0.1);
}

function schedHat(ctx, bus, t, vel, open) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7200;
  const g = ctx.createGain();
  const tail = open ? 0.22 : 0.04;
  g.gain.setValueAtTime(0.22 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
  src.connect(hp);
  hp.connect(g);
  g.connect(bus);
  src.start(t);
  src.stop(t + tail + 0.02);
}

// ---------------------------------------------------------------------------
// Хелперы записи паттернов
// ---------------------------------------------------------------------------

const g8 = (s, midi, vel = 0.85) => [s, midi, 1.7, vel]; // галопирующая восьмая (стаккато)
const K = (s, v = 1) => [s, 'K', v];
const S = (s, v = 1) => [s, 'S', v];
const H = (s, v = 0.4) => [s, 'H', v];
const O = (s, v = 0.55) => [s, 'O', v];

// Дорожка закрытых хэтов восьмыми (шаг = 16-я): акцент на долях.
function hatRow16(len) {
  const r = [];
  for (let s = 0; s < len; s += 2) r.push(H(s, s % 4 === 0 ? 0.42 : 0.26));
  return r;
}

const LV_SNARES = [S(4), S(12), S(20), S(28)]; // бэкбит 2 и 4

// ---------------------------------------------------------------------------
// Треки. Паттерн: { len, bass:[], lead:[], drums:[] }; order — порядок цикла.
// ---------------------------------------------------------------------------

const TRACKS = {
  // -------------------------------------------------------------- 'menu' ---
  // ~70 BPM, шаг = восьмая (0.43с), паттерн 32 шага = 13.7с; цикл 27.4с.
  // E-минорный дрон (E1 -> C2 -> B1 -> E1), редкие диссонансные «колокола»
  // (тритон A#, big-room эхо), «сердцебиение» — глухой двойной кик.
  menu: {
    bpm: 70,
    stepDiv: 2,
    bass: { wave: 'sawtooth', cutoff: 300, q: 7, level: 0.32, sustain: 0.8, decay: 0.9, release: 1.6 },
    lead: { kind: 'bell', level: 0.17, release: 3.2 },
    drums: { level: 0.6 },
    echo: { time: 0.43, fb: 0.42, mix: 0.32 },
    order: ['M1', 'M2'],
    patterns: {
      M1: {
        len: 32,
        bass: [[0, N.E1, 15, 1], [16, N.C2, 15, 0.9]],
        lead: [[5, N.E5, 8, 0.5], [14, N.As4, 8, 0.42], [24, N.Ds5, 8, 0.5]],
        drums: [K(0, 0.45), K(1, 0.3), K(16, 0.42), K(17, 0.28)],
      },
      M2: {
        len: 32,
        bass: [[0, N.B1, 15, 0.95], [16, N.E1, 15, 1]],
        lead: [[3, N.D5, 8, 0.5], [11, N.As4, 8, 0.4], [19, N.E5, 8, 0.52], [27, N.Ds4, 8, 0.45]],
        drums: [K(0, 0.45), K(1, 0.3), K(8, 0.2), K(16, 0.42), K(17, 0.28)],
      },
    },
  },

  // ------------------------------------------------------------- 'level' ---
  // ~138 BPM, шаг = 16-я (0.109с), паттерн 32 шага = 2 такта = 3.48с.
  // E-минор. Структура (17 слотов, ~59.1с, бесшовный цикл):
  //   A A A' A | BR BR' A A' | SO1 SO2 A A' | BR SO2 FILL A A'
  //   A    — главный рифф: галоп E2 + верхние E-D-C и хроматический ход A#-B-C
  //   A'   — рифф с восходящим окончанием G-A-B-E и ответной мелодией лида
  //   BR   — бридж C->D, длинные ноты лида, half-time ударные
  //   BR'  — бридж C->B (доминанта с D#), нагнетание перед возвратом в Em
  //   SO1  — соло: пентатоника e-минор по 16-м на педальном басе
  //   SO2  — соло-кульминация октавой выше
  //   FILL — сбивка: низкий E, нарастающий снейр-ролл, затакт лида
  level: {
    bpm: 138,
    stepDiv: 4,
    bass: { wave: 'sawtooth', cutoff: 820, q: 5, level: 0.3, sustain: 0.45, decay: 0.07, release: 0.06 },
    lead: { kind: 'square', detune: 8, cutoff: 2400, level: 0.13, sustain: 0.55, decay: 0.09, release: 0.12 },
    drums: { level: 1 },
    echo: { time: 0.326, fb: 0.18, mix: 0.1 },
    order: ['A', 'A', 'A2', 'A', 'BR', 'BR2', 'A', 'A2', 'SO1', 'SO2', 'A', 'A2', 'BR', 'SO2', 'FILL', 'A', 'A2'],
    patterns: {
      A: {
        len: 32,
        bass: [
          g8(0, N.E2, 1), g8(2, N.E2, 0.75), g8(4, N.E3, 1), g8(6, N.E2, 0.75),
          g8(8, N.E2, 0.85), g8(10, N.D3, 1), g8(12, N.E2, 0.75), g8(14, N.E2, 0.85),
          g8(16, N.E2, 1), g8(18, N.E2, 0.75), g8(20, N.C3, 1), g8(22, N.E2, 0.75),
          g8(24, N.E2, 0.85), g8(26, N.As2, 1), g8(28, N.B2, 1), g8(30, N.C3, 1),
        ],
        lead: [
          [4, N.E4, 2, 0.8], [10, N.D4, 2, 0.8], [20, N.C4, 2, 0.8],
          [26, N.As3, 1, 0.65], [28, N.B3, 1, 0.7], [30, N.C4, 2, 0.8],
        ],
        drums: [
          K(0), K(6, 0.8), K(8), K(14, 0.8), K(16), K(22, 0.8), K(24), K(30, 0.8),
          ...LV_SNARES, ...hatRow16(30), O(30),
        ],
      },
      A2: {
        len: 32,
        bass: [
          g8(0, N.E2, 1), g8(2, N.E2, 0.75), g8(4, N.E3, 1), g8(6, N.E2, 0.75),
          g8(8, N.E2, 0.85), g8(10, N.D3, 1), g8(12, N.E2, 0.75), g8(14, N.E2, 0.85),
          g8(16, N.E2, 1), g8(18, N.E2, 0.75), g8(20, N.C3, 1), g8(22, N.E2, 0.75),
          g8(24, N.G2, 0.9), g8(26, N.A2, 0.95), g8(28, N.B2, 1), g8(30, N.E3, 1),
        ],
        lead: [
          [4, N.E4, 2, 0.8], [10, N.D4, 2, 0.8],
          [16, N.G4, 2, 0.85], [18, N.E4, 2, 0.75], [20, N.D4, 2, 0.8], [22, N.E4, 2, 0.75],
          [24, N.B3, 3, 0.85], [28, N.D4, 2, 0.75], [30, N.E4, 2, 0.85],
        ],
        drums: [
          K(0), K(6, 0.8), K(8), K(14, 0.8), K(16), K(22, 0.8), K(24),
          ...LV_SNARES, S(26, 0.6), S(30, 0.85),
          ...hatRow16(30), O(30),
        ],
      },
      BR: {
        len: 32,
        bass: [
          g8(0, N.C2, 1), g8(2, N.C2, 0.75), g8(4, N.C3, 1), g8(6, N.C2, 0.75),
          g8(8, N.C2, 0.85), g8(10, N.C3, 0.95), g8(12, N.C2, 0.75), g8(14, N.G2, 0.9),
          g8(16, N.D2, 1), g8(18, N.D2, 0.75), g8(20, N.D3, 1), g8(22, N.D2, 0.75),
          g8(24, N.D2, 0.85), g8(26, N.D3, 0.95), g8(28, N.A2, 0.9), g8(30, N.B2, 0.95),
        ],
        lead: [[0, N.G4, 14, 0.7], [16, N.A4, 10, 0.7], [28, N.B4, 4, 0.75]],
        drums: [
          K(0), K(16),
          S(8), S(24),
          H(0, 0.42), H(4, 0.3), H(8, 0.42), H(12, 0.3),
          H(16, 0.42), H(20, 0.3), H(24, 0.42), O(28, 0.5),
        ],
      },
      BR2: {
        len: 32,
        bass: [
          g8(0, N.C2, 1), g8(2, N.C2, 0.75), g8(4, N.C3, 1), g8(6, N.C2, 0.75),
          g8(8, N.C2, 0.85), g8(10, N.C3, 0.95), g8(12, N.C2, 0.75), g8(14, N.C2, 0.85),
          g8(16, N.B2, 1), g8(18, N.B2, 0.75), g8(20, N.B3, 1), g8(22, N.B2, 0.75),
          g8(24, N.B2, 0.85), g8(26, N.B3, 0.95), g8(28, N.B2, 0.85), g8(30, N.B2, 0.9),
        ],
        lead: [
          [0, N.C5, 6, 0.75], [8, N.B4, 4, 0.7], [12, N.C5, 2, 0.7],
          [16, N.B4, 6, 0.8], [24, N.Ds4, 4, 0.85], [28, N.Fs4, 3, 0.8],
        ],
        drums: [
          K(0), K(16), K(24, 0.85), K(28, 0.9),
          S(8), S(20, 0.7), S(26, 0.8), S(30, 1),
          H(0, 0.42), H(4, 0.3), H(8, 0.42), H(12, 0.3),
          H(16, 0.42), H(18, 0.28), H(20, 0.42), H(22, 0.28),
          H(24, 0.42), H(26, 0.3), O(30, 0.6),
        ],
      },
      SO1: {
        len: 32,
        bass: [
          g8(0, N.E2, 0.9), g8(2, N.E2, 0.75), g8(4, N.E3, 1), g8(6, N.E2, 0.75),
          g8(8, N.E2, 0.85), g8(10, N.E2, 0.75), g8(12, N.E3, 1), g8(14, N.E2, 0.75),
          g8(16, N.E2, 0.9), g8(18, N.E2, 0.75), g8(20, N.E3, 1), g8(22, N.E2, 0.75),
          g8(24, N.E2, 0.85), g8(26, N.E2, 0.75), g8(28, N.E3, 1), g8(30, N.E2, 0.75),
        ],
        lead: [
          [0, N.E4, 1.1, 0.8], [2, N.G4, 1.1, 0.7], [4, N.A4, 1.1, 0.85], [6, N.G4, 1.1, 0.7],
          [8, N.B4, 1.1, 0.85], [10, N.A4, 1.1, 0.7], [12, N.G4, 1.1, 0.8], [14, N.E4, 1.1, 0.7],
          [16, N.D4, 1.1, 0.8], [18, N.E4, 1.1, 0.7], [20, N.G4, 1.1, 0.85], [22, N.B3, 1.1, 0.7],
          [24, N.A3, 1.1, 0.8], [26, N.B3, 1.1, 0.7], [28, N.D4, 1.1, 0.85], [30, N.E4, 1.1, 0.8],
        ],
        drums: [
          K(0), K(6, 0.8), K(8), K(10, 0.7), K(16), K(22, 0.8), K(24), K(26, 0.7),
          ...LV_SNARES, ...hatRow16(32),
        ],
      },
      SO2: {
        len: 32,
        bass: [
          g8(0, N.E2, 1), g8(2, N.E2, 0.8), g8(4, N.E3, 1), g8(6, N.E2, 0.8),
          g8(8, N.E2, 0.9), g8(10, N.E2, 0.8), g8(12, N.E3, 1), g8(14, N.E2, 0.8),
          g8(16, N.E2, 1), g8(18, N.E2, 0.8), g8(20, N.E3, 1), g8(22, N.E2, 0.8),
          g8(24, N.E2, 0.9), g8(26, N.E2, 0.8), g8(28, N.E3, 1), g8(30, N.D3, 1),
        ],
        lead: [
          [0, N.E5, 1.1, 1], [2, N.D5, 1.1, 0.8], [4, N.E5, 1.1, 0.9], [6, N.G5, 1.1, 1],
          [8, N.E5, 1.1, 0.9], [10, N.D5, 1.1, 0.8], [12, N.B4, 1.1, 0.85], [14, N.D5, 1.1, 0.8],
          [16, N.E5, 1.1, 1], [18, N.D5, 1.1, 0.8], [20, N.B4, 1.1, 0.85], [22, N.A4, 1.1, 0.8],
          [24, N.G4, 1.1, 0.85], [26, N.A4, 1.1, 0.8], [28, N.B4, 1.1, 0.9], [30, N.D5, 1.1, 0.95],
        ],
        drums: [
          K(0), K(6, 0.8), K(8), K(14, 0.8), K(16), K(18, 0.7), K(24), K(26, 0.7),
          ...LV_SNARES, ...hatRow16(14), O(14), ...hatRow16(30).filter((h) => h[0] >= 16), O(30),
        ],
      },
      FILL: {
        len: 32,
        bass: [
          [0, N.E2, 10, 1], [12, N.E2, 3, 0.7], [16, N.E1, 10, 1],
          g8(28, N.As2, 0.8), g8(30, N.B2, 0.9),
        ],
        lead: [
          [0, N.E3, 6, 0.6],
          [24, N.B3, 2, 0.7], [26, N.D4, 2, 0.8], [28, N.E4, 3, 0.9],
        ],
        drums: [
          K(0), O(0, 0.6),
          S(16, 0.3), S(18, 0.35), S(20, 0.45), S(22, 0.55),
          S(24, 0.65), S(26, 0.78), S(28, 0.9), S(30, 1),
        ],
      },
    },
  },

  // ----------------------------------------------------------- 'victory' ---
  // ~100 BPM, шаг = 16-я (0.15с), паттерн 32 шага = 4.8с; цикл 19.2с.
  // C-мажорная фанфара с маршевым снейром: V1 (C-G-Am-G), V2 (F-G),
  // V3 — финальный аккорд с роллом и длинной нотой.
  victory: {
    bpm: 100,
    stepDiv: 4,
    bass: { wave: 'square', cutoff: 700, q: 3, level: 0.26, sustain: 0.6, decay: 0.1, release: 0.1 },
    lead: { kind: 'square', detune: 6, cutoff: 3000, level: 0.15, sustain: 0.7, decay: 0.12, release: 0.15 },
    drums: { level: 0.95 },
    echo: { time: 0.3, fb: 0.22, mix: 0.13 },
    order: ['V1', 'V2', 'V1', 'V3'],
    patterns: {
      V1: {
        len: 32,
        bass: [
          [0, N.C2, 3, 1], [4, N.C2, 3, 0.8], [8, N.G2, 3, 1], [12, N.G2, 3, 0.8],
          [16, N.A2, 3, 1], [20, N.A2, 3, 0.8], [24, N.G2, 3, 1], [28, N.G2, 3, 0.8],
        ],
        lead: [
          [0, N.C4, 2, 0.9], [2, N.E4, 2, 0.9], [4, N.G4, 2, 0.9], [6, N.C5, 4, 1],
          [12, N.G4, 2, 0.8], [14, N.A4, 2, 0.85], [16, N.A4, 2, 0.9], [18, N.C5, 2, 0.9],
          [20, N.E5, 6, 1], [26, N.D5, 2, 0.85], [28, N.C5, 2, 0.85], [30, N.B4, 2, 0.85],
        ],
        drums: [
          K(0), K(8), K(16), K(24),
          S(4), S(12), S(20), S(28), S(30, 0.5),
          ...hatRow16(32),
        ],
      },
      V2: {
        len: 32,
        bass: [
          [0, N.F2, 3, 1], [4, N.F2, 3, 0.8], [8, N.F2, 3, 0.9], [12, N.F2, 3, 0.8],
          [16, N.G2, 3, 1], [20, N.G2, 3, 0.8], [24, N.G2, 3, 0.9], [28, N.B2, 3, 0.9],
        ],
        lead: [
          [0, N.A4, 2, 0.9], [2, N.C5, 2, 0.9], [4, N.F5, 6, 1], [10, N.E5, 2, 0.8],
          [12, N.D5, 2, 0.85], [16, N.D5, 2, 0.9], [18, N.B4, 2, 0.85],
          [20, N.D5, 6, 1], [26, N.E5, 2, 0.85], [28, N.G5, 4, 1],
        ],
        drums: [
          K(0), K(8), K(16), K(24),
          S(4), S(12), S(14, 0.5), S(20), S(28), S(30, 0.6),
          ...hatRow16(32),
        ],
      },
      V3: {
        len: 32,
        bass: [
          [0, N.F2, 3, 1], [4, N.G2, 3, 1], [8, N.C2, 14, 1], [24, N.C2, 8, 1],
        ],
        lead: [
          [0, N.C5, 2, 0.9], [2, N.D5, 2, 0.9], [4, N.E5, 2, 0.95], [6, N.G5, 2, 1],
          [8, N.G5, 12, 1], [20, N.E5, 4, 0.8], [24, N.C5, 8, 1],
        ],
        drums: [
          S(0, 0.4), S(2, 0.5), S(4, 0.65), S(6, 0.85),
          K(0), K(4), K(8), O(8, 0.8), S(8),
          K(16, 0.9), K(24), S(24), O(24, 0.8),
        ],
      },
    },
  },
};

// Предкомпиляция паттерна: сетка «шаг -> события» для O(1) доступа в планировщике.
function compileTrack(tr) {
  if (tr._grids) return;
  tr._grids = {};
  for (const name of Object.keys(tr.patterns)) {
    const p = tr.patterns[name];
    const grid = new Array(p.len).fill(null);
    const put = (voice, evs) => {
      for (const ev of evs) {
        const s = ev[0] | 0;
        if (s < 0 || s >= p.len) continue;
        if (!grid[s]) grid[s] = { bass: [], lead: [], drums: [] };
        grid[s][voice].push(ev);
      }
    };
    put('bass', p.bass || []);
    put('lead', p.lead || []);
    put('drums', p.drums || []);
    tr._grids[name] = { len: p.len, grid };
  }
}

const warnedTracks = new Set();

// ---------------------------------------------------------------------------
// MusicPlayer
// ---------------------------------------------------------------------------

export class MusicPlayer {
  constructor() {
    this._ctx = null;
    this._master = null;   // мастер-gain (громкость музыки)
    this._comp = null;     // компрессор — «клей» микса и защита от клиппинга
    this._bus = null;      // шина текущего трека (гасится при stop)
    this._echo = null;     // { delay, fb, wet }
    this._timer = null;
    this._track = null;
    this._volume = 0.7;
    this._seqIdx = 0;
    this._step = 0;
    this._secPerStep = 0;
    this._nextTime = 0;
  }

  // 'menu' | 'level' | 'victory'; повторный вызов перезапускает трек с начала.
  start(name) {
    this.stop();
    const track = TRACKS[name];
    if (!track) {
      if (!warnedTracks.has(name)) {
        warnedTracks.add(name);
        console.warn(`MusicPlayer: неизвестный трек "${name}"`);
      }
      return;
    }
    let ctx = null;
    try {
      ctx = this._ensureGraph();
    } catch {
      ctx = null;
    }
    if (!ctx) return; // безопасная деградация без AudioContext
    try {
      compileTrack(track);
      this._track = track;
      this._seqIdx = 0;
      this._step = 0;
      this._secPerStep = 60 / (track.bpm * track.stepDiv);
      this._bus = ctx.createGain();
      this._bus.gain.value = 1;
      this._bus.connect(this._master);
      if (track.echo) this._buildEcho(ctx, track.echo);
      this._nextTime = ctx.currentTime + 0.05;
      this._timer = setInterval(() => this._tick(), LOOKAHEAD_MS);
      this._tick();
    } catch {
      this.stop();
    }
  }

  stop() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._track = null;
    const ctx = this._ctx;
    const bus = this._bus;
    const echo = this._echo;
    this._bus = null;
    this._echo = null;
    if (!ctx || !bus) return;
    try {
      const t0 = ctx.currentTime;
      bus.gain.setTargetAtTime(0, t0, 0.04); // быстрый фейд вместо щелчка
      if (echo) echo.wet.gain.setTargetAtTime(0, t0, 0.15); // эхо-хвост гасим плавно
      setTimeout(() => {
        try {
          bus.disconnect();
          if (echo) {
            echo.delay.disconnect();
            echo.fb.disconnect();
            echo.wet.disconnect();
          }
        } catch {
          /* узлы уже могли быть отключены */
        }
      }, 900);
    } catch {
      /* контекст мог быть закрыт — молча игнорируем */
    }
  }

  setVolume(v) {
    this._volume = clamp01(Number.isFinite(+v) ? +v : 0);
    if (this._master && this._ctx) {
      try {
        this._master.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.03);
      } catch {
        this._master.gain.value = this._volume;
      }
    }
  }

  // --- внутреннее ---

  _ensureGraph() {
    const ctx = getAudioCtx();
    if (!ctx) return null;
    if (this._ctx !== ctx || !this._master) {
      this._ctx = ctx;
      this._comp = ctx.createDynamicsCompressor();
      this._comp.threshold.value = -14;
      this._comp.knee.value = 18;
      this._comp.ratio.value = 5;
      this._comp.attack.value = 0.004;
      this._comp.release.value = 0.18;
      this._comp.connect(ctx.destination);
      this._master = ctx.createGain();
      this._master.gain.value = this._volume;
      this._master.connect(this._comp);
    }
    return ctx;
  }

  _buildEcho(ctx, spec) {
    const delay = ctx.createDelay(2);
    delay.delayTime.value = spec.time;
    const fb = ctx.createGain();
    fb.gain.value = spec.fb;
    const wet = ctx.createGain();
    wet.gain.value = spec.mix;
    this._bus.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(this._master);
    this._echo = { delay, fb, wet };
  }

  _tick() {
    const ctx = this._ctx;
    const tr = this._track;
    if (!ctx || !tr || !this._bus) return;
    try {
      // После троттлинга таймера (фон вкладки) не наигрываем пропущенное скопом,
      // а продолжаем с текущего шага от «сейчас».
      if (this._nextTime < ctx.currentTime - 0.05) this._nextTime = ctx.currentTime + 0.02;
      const horizon = ctx.currentTime + SCHEDULE_AHEAD;
      while (this._nextTime < horizon) {
        const pat = tr._grids[tr.order[this._seqIdx]];
        this._scheduleStep(ctx, this._nextTime, pat);
        this._nextTime += this._secPerStep;
        if (++this._step >= pat.len) {
          this._step = 0;
          this._seqIdx = (this._seqIdx + 1) % tr.order.length;
        }
      }
    } catch {
      /* ни при каких условиях не роняем игровой цикл */
    }
  }

  _scheduleStep(ctx, t, pat) {
    const cell = pat.grid[this._step];
    if (!cell) return;
    const tr = this._track;
    const bus = this._bus;
    const sps = this._secPerStep;
    for (const ev of cell.bass) {
      schedBass(ctx, bus, t, ev[1], (ev[2] ?? 2) * sps, ev[3] ?? 1, tr.bass);
    }
    for (const ev of cell.lead) {
      schedLead(ctx, bus, t, ev[1], (ev[2] ?? 2) * sps, ev[3] ?? 1, tr.lead);
    }
    for (const ev of cell.drums) {
      const vel = (ev[2] ?? 1) * tr.drums.level;
      if (ev[1] === 'K') schedKick(ctx, bus, t, vel);
      else if (ev[1] === 'S') schedSnare(ctx, bus, t, vel);
      else schedHat(ctx, bus, t, vel, ev[1] === 'O');
    }
  }
}
