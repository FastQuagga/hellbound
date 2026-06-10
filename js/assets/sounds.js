// Звуковой движок HELLBOUND [A7]. Контракт: docs/architecture.md §11.
// Все звуки синтезируются узлами WebAudio в момент play(): осцилляторы,
// белый шум (AudioBuffer) + biquad-фильтры + огибающие. Длительность ≤1.5с.
// Лёгкая случайная вариация питча при каждом play — допустима по контракту.
// Безопасная деградация: без AudioContext / в suspended — тихий no-op,
// исключения наружу не выходят никогда.

import { clamp } from '../config.js';

// ---------------------------------------------------------------------------
// AudioContext — ленивый синглтон
// ---------------------------------------------------------------------------

let _ctx; // undefined = ещё не пробовали, null = недоступен

export function getAudioCtx() {
  if (_ctx !== undefined) return _ctx;
  try {
    const AC = (typeof window !== 'undefined')
      ? (window.AudioContext || window.webkitAudioContext)
      : (typeof AudioContext !== 'undefined' ? AudioContext : null);
    _ctx = AC ? new AC() : null;
  } catch (e) {
    _ctx = null;
  }
  return _ctx;
}

// ---------------------------------------------------------------------------
// Общий буфер белого шума (детерминированный, mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Общий seeded-поток случайности для лёгких per-play вариаций
// (без Math.random() — детерминированная последовательность между запусками).
const _rng = mulberry32(0x534F554E); // 'SOUN'

const NOISE_DUR = 1.5;
let _noiseBuf = null;
let _noiseBufCtx = null;

function getNoiseBuffer(ctx) {
  if (_noiseBuf && _noiseBufCtx === ctx) return _noiseBuf;
  const len = Math.max(1, Math.floor(ctx.sampleRate * NOISE_DUR));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = mulberry32(0x48454C4C); // фиксированный сид — детерминированный шум
  for (let i = 0; i < len; i++) data[i] = rnd() * 2 - 1;
  _noiseBuf = buf;
  _noiseBufCtx = ctx;
  return buf;
}

// ---------------------------------------------------------------------------
// Билдер одного проигрывания: голоса (tone) и шумовые слои (noise)
// ---------------------------------------------------------------------------
// Опции tone():
//   type        — тип осциллятора ('sine'|'square'|'sawtooth'|'triangle')
//   f, f1       — старт/конец частоты (экспоненциальный глайд; bend:'lin' — линейный)
//   fcurve      — [[доляДлит, частота], ...] — произвольная кривая частоты
//   dur, delay  — длительность и задержка старта, сек
//   vol, a,hold — пик громкости, атака, удержание до спада
//   spread      — детюн-пара ±cents (жирные пилы)
//   vib         — {f, amp} вибрато частоты (amp в Гц)
//   trem        — {f, depth} тремоло/рык амплитуды
//   filter      — {type, f, q} статический фильтр на слое
// Опции noise(): dur, delay, vol, a, hold, ftype, f, f1, fcurve, q

class Voice {
  constructor(ctx, out, t0, pv) {
    this.ctx = ctx;
    this.out = out;
    this.t0 = t0;
    this.pv = pv;  // множитель вариации питча этого проигрывания
    this.end = 0;  // момент окончания самого длинного слоя (для уборки графа)
  }

  _mark(o) {
    this.end = Math.max(this.end, (o.delay || 0) + o.dur);
  }

  _env(g, t, o) {
    const vol = Math.max(0.001, o.vol != null ? o.vol : 0.5);
    const a = o.a != null ? o.a : 0.004;
    const p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(vol, t + a);
    if (o.hold) p.setValueAtTime(vol, Math.min(t + a + o.hold, t + o.dur - 0.01));
    p.exponentialRampToValueAtTime(0.0001, t + o.dur);
  }

  _freq(param, t, dur, o) {
    const fq = (v) => Math.max(1, v * this.pv);
    if (o.fcurve) {
      param.setValueAtTime(fq(o.fcurve[0][1]), t);
      for (let i = 1; i < o.fcurve.length; i++) {
        param.exponentialRampToValueAtTime(fq(o.fcurve[i][1]), t + o.fcurve[i][0] * dur);
      }
    } else if (o.f1 != null && o.f1 !== o.f) {
      param.setValueAtTime(fq(o.f), t);
      if (o.bend === 'lin') param.linearRampToValueAtTime(fq(o.f1), t + dur);
      else param.exponentialRampToValueAtTime(fq(o.f1), t + dur);
    } else {
      param.setValueAtTime(fq(o.f != null ? o.f : 440), t);
    }
  }

  _lfo(t, dur, f, depth, target) {
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = f;
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(0.0001, t);
    lg.gain.linearRampToValueAtTime(depth, t + 0.03);
    // держать глубину до ~70% длительности, гасить только в хвосте
    lg.gain.setValueAtTime(depth, Math.max(t + 0.03, t + dur * 0.7));
    lg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lfo.connect(lg);
    lg.connect(target);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }

  tone(o) {
    this._mark(o);
    const ctx = this.ctx;
    const t = this.t0 + (o.delay || 0);
    const g = ctx.createGain();
    this._env(g, t, o);
    let tail = this.out;
    if (o.filter) {
      const fl = ctx.createBiquadFilter();
      fl.type = o.filter.type;
      fl.frequency.value = Math.max(1, o.filter.f * this.pv);
      fl.Q.value = o.filter.q != null ? o.filter.q : 0.7;
      fl.connect(tail);
      tail = fl;
    }
    g.connect(tail);
    const dets = o.spread ? [-o.spread, o.spread] : [0];
    for (const cents of dets) {
      const os = ctx.createOscillator();
      os.type = o.type || 'square';
      this._freq(os.frequency, t, o.dur, o);
      if (cents) os.detune.value = cents;
      if (o.vib) this._lfo(t, o.dur, o.vib.f, o.vib.amp * this.pv, os.frequency);
      os.connect(g);
      os.start(t);
      os.stop(t + o.dur + 0.05);
    }
    if (o.trem) this._lfo(t, o.dur, o.trem.f, o.trem.depth, g.gain);
  }

  noise(o) {
    this._mark(o);
    const ctx = this.ctx;
    const t = this.t0 + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = o.ftype || 'lowpass';
    this._freq(fl.frequency, t, o.dur, { f: o.f != null ? o.f : 1200, f1: o.f1, fcurve: o.fcurve, bend: o.bend });
    fl.Q.value = o.q != null ? o.q : 0.7;
    const g = ctx.createGain();
    this._env(g, t, o);
    src.connect(fl);
    fl.connect(g);
    g.connect(this.out);
    if (o.trem) this._lfo(t, o.dur, o.trem.f, o.trem.depth, g.gain);
    src.start(t, _rng() * NOISE_DUR);
    src.stop(t + o.dur + 0.05);
  }
}

// ---------------------------------------------------------------------------
// Переиспользуемые генераторы
// ---------------------------------------------------------------------------

// Выстрел пистолета: сухой щелчок + тело + низкий удар.
function pistolShot(b, vol) {
  b.noise({ dur: 0.13, vol: 0.65 * vol, ftype: 'highpass', f: 950 });
  b.noise({ dur: 0.24, vol: 0.75 * vol, ftype: 'lowpass', f: 1500, f1: 300 });
  b.tone({ type: 'sine', f: 235, f1: 55, dur: 0.2, vol: 0.85 * vol });
  b.tone({ type: 'triangle', f: 130, f1: 60, dur: 0.16, vol: 0.45 * vol });
}

// Дробовик: мясистый низкий удар + широкий шумовой выброс.
function shotgunBlast(b, vol) {
  b.tone({ type: 'sine', f: 150, f1: 34, dur: 0.5, vol: 1.0 * vol });
  b.tone({ type: 'triangle', f: 95, f1: 40, dur: 0.42, vol: 0.6 * vol });
  b.noise({ dur: 0.55, vol: 0.95 * vol, ftype: 'lowpass', f: 2800, f1: 260 });
  b.noise({ dur: 0.3, vol: 0.5 * vol, ftype: 'bandpass', f: 650, q: 0.9 });
  b.noise({ dur: 0.07, vol: 0.45 * vol, ftype: 'highpass', f: 3500 });
}

// Хриплый человеческий голос (зомби, сержант, игрок): пила с вибрато,
// октавный обертон, рычащий скрип и шумное дыхание.
function humanVoice(b, o) {
  const fc = o.fcurve || null;
  const vibF = o.vibF || 27;
  const vibA = o.vibA || 14;
  b.tone({ type: 'sawtooth', fcurve: fc, f: o.f0, f1: o.f1, dur: o.dur, vol: o.vol, vib: { f: vibF, amp: vibA } });
  b.tone({
    type: 'sawtooth',
    fcurve: fc ? fc.map(([tt, ff]) => [tt, ff * 2.03]) : null,
    f: (o.f0 || 150) * 2.03, f1: (o.f1 || 90) * 1.97,
    dur: o.dur * 0.88, vol: o.vol * 0.42,
    vib: { f: vibF * 1.12, amp: vibA * 2 },
  });
  b.tone({
    type: 'square',
    fcurve: fc ? fc.map(([tt, ff]) => [tt, ff * 3.1]) : null,
    f: (o.f0 || 150) * 3.1, f1: (o.f1 || 90) * 2.8,
    dur: o.dur * 0.6, vol: o.vol * 0.13,
  });
  b.noise({ dur: o.dur * 0.85, vol: o.breath != null ? o.breath : 0.28, ftype: 'bandpass', f: 950, f1: 480, q: 0.8 });
}

// Утробный звериный рёв (демон, барон): детюн-пара пил с амплитудным рыком,
// саб-синус и низкое шумное дыхание.
function beastRoar(b, o) {
  const fc = o.fcurve || null;
  const growl = o.growl || 16;
  b.tone({
    type: 'sawtooth', fcurve: fc, f: o.f0, f1: o.f1, dur: o.dur, vol: o.vol,
    spread: 14, trem: { f: growl, depth: o.vol * 0.7 },
  });
  b.tone({
    type: 'sawtooth',
    fcurve: fc ? fc.map(([tt, ff]) => [tt, ff * 1.98]) : null,
    f: (o.f0 || 90) * 1.98, f1: (o.f1 || 60) * 2.05,
    dur: o.dur * 0.85, vol: o.vol * 0.4,
    trem: { f: growl * 1.13, depth: o.vol * 0.3 },
  });
  b.tone({
    type: 'sine',
    fcurve: fc ? fc.map(([tt, ff]) => [tt, ff * 0.5]) : null,
    f: (o.f0 || 90) * 0.5, f1: (o.f1 || 60) * 0.5,
    dur: o.dur, vol: o.vol * (o.sub != null ? o.sub : 0.5) * 1.4,
  });
  b.noise({ dur: o.dur * 0.9, vol: o.breath != null ? o.breath : 0.3, ftype: 'lowpass', f: 500, f1: 240 });
}

// Шипящий визг импа: высокая пила с быстрым вибрато + жёсткий хайпас-хисс.
function impShriek(b, o) {
  b.tone({ type: 'sawtooth', fcurve: o.fcurve, dur: o.dur, vol: o.vol, vib: { f: 42, amp: 55 } });
  b.tone({
    type: 'square',
    fcurve: o.fcurve.map(([tt, ff]) => [tt, ff * 1.5]),
    dur: o.dur * 0.9, vol: o.vol * 0.35,
    vib: { f: 38, amp: 70 },
  });
  b.noise({ dur: o.dur, vol: o.hiss != null ? o.hiss : 0.28, ftype: 'highpass', f: 2400 });
}

// Электрическое гудение/бульканье какодемона: биения двух осцилляторов
// с медленным вобблом + резонансный булькающий шум.
function cacoVoice(b, o) {
  const wob = o.wob || 7;
  b.tone({ type: 'square', fcurve: o.fcurve, dur: o.dur, vol: o.vol, vib: { f: wob, amp: 28 } });
  b.tone({
    type: 'sawtooth',
    fcurve: o.fcurve.map(([tt, ff]) => [tt, ff * 1.013]),
    dur: o.dur, vol: o.vol * 0.6,
    vib: { f: wob * 1.7, amp: 42 },
  });
  b.noise({
    dur: o.dur, vol: o.vol * 0.55, ftype: 'bandpass', q: 7,
    fcurve: o.bubble || [[0, 420], [0.3, 760], [0.6, 380], [1, 560]],
  });
  b.tone({ type: 'sine', fcurve: o.fcurve.map(([tt, ff]) => [tt, ff * 0.33]), dur: o.dur, vol: o.vol * 0.7 });
}

// ---------------------------------------------------------------------------
// Таблица звуков: имя -> рецепт. Полный список §11.
// ---------------------------------------------------------------------------

const SOUNDS = {
  // --- UI ---
  menu_move: (b) => {
    b.tone({ type: 'square', f: 520, f1: 660, dur: 0.06, vol: 0.22 });
  },
  menu_select: (b) => {
    b.tone({ type: 'square', f: 440, dur: 0.06, vol: 0.25 });
    b.tone({ type: 'square', f: 880, dur: 0.14, vol: 0.25, delay: 0.07 });
    b.tone({ type: 'sine', f: 220, f1: 110, dur: 0.12, vol: 0.3 });
  },
  menu_back: (b) => {
    b.tone({ type: 'square', f: 620, f1: 270, dur: 0.12, vol: 0.22 });
  },

  // --- Игрок ---
  pl_pain: (b) => {
    humanVoice(b, { f0: 205, f1: 122, dur: 0.3, vol: 0.5 });
  },
  pl_die: (b) => {
    humanVoice(b, { f0: 215, f1: 62, dur: 1.15, vol: 0.5, vibA: 20, breath: 0.32 });
    b.noise({ dur: 1.0, vol: 0.18, ftype: 'bandpass', f: 700, f1: 250, q: 1 });
  },
  pl_pickup: (b) => {
    b.tone({ type: 'square', f: 640, f1: 990, dur: 0.1, vol: 0.28 });
    b.tone({ type: 'square', f: 1280, f1: 1980, dur: 0.08, vol: 0.12, delay: 0.02 });
  },
  pl_wpnup: (b) => {
    b.tone({ type: 'square', f: 330, dur: 0.07, vol: 0.26 });
    b.tone({ type: 'square', f: 494, dur: 0.07, vol: 0.26, delay: 0.08 });
    b.tone({ type: 'square', f: 660, dur: 0.2, vol: 0.28, delay: 0.16 });
    b.noise({ dur: 0.05, vol: 0.3, ftype: 'bandpass', f: 1800, q: 3, delay: 0.16 });
  },
  pl_keyup: (b) => {
    b.tone({ type: 'triangle', f: 880, dur: 0.12, vol: 0.32 });
    b.tone({ type: 'triangle', f: 1175, dur: 0.3, vol: 0.3, delay: 0.1 });
    b.tone({ type: 'square', f: 1760, dur: 0.25, vol: 0.08, delay: 0.1 });
  },
  pl_power: (b) => {
    b.tone({ type: 'sawtooth', f: 150, f1: 780, dur: 0.75, vol: 0.3, trem: { f: 9, depth: 0.18 } });
    b.tone({ type: 'square', f: 300, f1: 1560, dur: 0.75, vol: 0.12 });
    b.tone({ type: 'triangle', f: 1320, dur: 0.3, vol: 0.18, delay: 0.6 });
  },
  pl_noammo: (b) => {
    b.noise({ dur: 0.035, vol: 0.45, ftype: 'bandpass', f: 2300, q: 5 });
    b.tone({ type: 'square', f: 215, f1: 150, dur: 0.05, vol: 0.3 });
  },
  pl_oof: (b) => {
    b.tone({ type: 'sine', f: 135, f1: 50, dur: 0.16, vol: 0.85 });
    b.tone({ type: 'sawtooth', f: 170, f1: 95, dur: 0.13, vol: 0.3 });
    b.noise({ dur: 0.1, vol: 0.4, ftype: 'lowpass', f: 520, f1: 200 });
  },

  // --- Оружие ---
  wp_punch: (b) => {
    b.tone({ type: 'sine', f: 115, f1: 38, dur: 0.17, vol: 0.9 });
    b.noise({ dur: 0.12, vol: 0.6, ftype: 'lowpass', f: 850, f1: 200 });
    b.noise({ dur: 0.07, vol: 0.5, ftype: 'bandpass', f: 330, q: 1.5 });
  },
  wp_swing: (b) => {
    b.noise({ dur: 0.22, vol: 0.45, ftype: 'bandpass', q: 2, fcurve: [[0, 350], [0.5, 1250], [1, 450]] });
  },
  wp_pistol: (b) => pistolShot(b, 1),
  wp_shotgun: (b) => shotgunBlast(b, 1),
  wp_pump: (b) => {
    b.noise({ dur: 0.05, vol: 0.55, ftype: 'bandpass', f: 1150, q: 4 });
    b.tone({ type: 'square', f: 240, f1: 170, dur: 0.045, vol: 0.2 });
    b.noise({ dur: 0.06, vol: 0.6, ftype: 'bandpass', f: 780, q: 4, delay: 0.13 });
    b.tone({ type: 'sine', f: 160, f1: 90, dur: 0.1, vol: 0.5, delay: 0.13 });
  },
  wp_chaingun: (b) => {
    b.noise({ dur: 0.09, vol: 0.7, ftype: 'highpass', f: 1000 });
    b.noise({ dur: 0.14, vol: 0.7, ftype: 'lowpass', f: 1600, f1: 350 });
    b.tone({ type: 'sine', f: 250, f1: 70, dur: 0.13, vol: 0.8 });
  },
  wp_rocket: (b) => {
    b.noise({ dur: 0.6, vol: 0.85, ftype: 'lowpass', f: 1600, f1: 220 });
    b.tone({ type: 'sawtooth', f: 115, f1: 42, dur: 0.5, vol: 0.45, trem: { f: 22, depth: 0.2 } });
    b.tone({ type: 'sine', f: 75, f1: 30, dur: 0.55, vol: 0.7 });
  },
  wp_plasma: (b) => {
    b.tone({ type: 'square', f: 1500, f1: 280, dur: 0.16, vol: 0.4 });
    b.tone({ type: 'sawtooth', f: 1470, f1: 265, dur: 0.15, vol: 0.25 });
    b.noise({ dur: 0.05, vol: 0.22, ftype: 'highpass', f: 2200 });
    b.tone({ type: 'sine', f: 90, f1: 60, dur: 0.1, vol: 0.35 });
  },
  wp_bfg: (b) => {
    b.tone({ type: 'sawtooth', f: 70, f1: 330, dur: 0.85, vol: 0.4, bend: 'lin', spread: 12 });
    b.tone({ type: 'sine', f: 55, f1: 165, dur: 0.85, vol: 0.4, bend: 'lin' });
    b.tone({ type: 'square', f: 560, f1: 1350, dur: 0.8, vol: 0.1, bend: 'lin', trem: { f: 28, depth: 0.08 } });
  },
  wp_bfg_hit: (b) => {
    b.tone({ type: 'sine', f: 70, f1: 26, dur: 1.25, vol: 1 });
    b.noise({ dur: 1.15, vol: 0.9, ftype: 'lowpass', f: 1900, f1: 110 });
    b.tone({ type: 'sawtooth', f: 170, f1: 48, dur: 0.95, vol: 0.45, trem: { f: 24, depth: 0.3 } });
    b.noise({ dur: 0.4, vol: 0.45, ftype: 'bandpass', f: 480, q: 1 });
  },
  explosion: (b) => {
    b.noise({ dur: 1.05, vol: 1, ftype: 'lowpass', f: 2300, f1: 90 });
    b.tone({ type: 'sine', f: 100, f1: 24, dur: 0.95, vol: 0.9 });
    b.noise({ dur: 0.5, vol: 0.5, ftype: 'bandpass', f: 420, q: 0.8 });
  },

  // --- Мир ---
  door_open: (b) => {
    b.noise({ dur: 0.08, vol: 0.4, ftype: 'bandpass', f: 600, q: 2 });
    b.noise({ dur: 0.85, vol: 0.32, a: 0.06, hold: 0.5, ftype: 'lowpass', fcurve: [[0, 380], [0.7, 950], [1, 700]] });
    b.tone({ type: 'sawtooth', f: 46, dur: 0.8, vol: 0.26, a: 0.05, hold: 0.55, vib: { f: 9, amp: 3.5 }, filter: { type: 'lowpass', f: 260 } });
    b.tone({ type: 'sine', f: 120, f1: 75, dur: 0.12, vol: 0.35, delay: 0.78 });
  },
  door_close: (b) => {
    b.noise({ dur: 0.75, vol: 0.3, a: 0.05, hold: 0.4, ftype: 'lowpass', fcurve: [[0, 900], [1, 320]] });
    b.tone({ type: 'sawtooth', f: 42, dur: 0.7, vol: 0.26, a: 0.05, hold: 0.45, vib: { f: 8, amp: 3 }, filter: { type: 'lowpass', f: 240 } });
    b.tone({ type: 'sine', f: 110, f1: 45, dur: 0.22, vol: 0.7, delay: 0.66 });
    b.noise({ dur: 0.12, vol: 0.5, ftype: 'lowpass', f: 700, f1: 200, delay: 0.66 });
  },
  switch: (b) => {
    b.noise({ dur: 0.04, vol: 0.55, ftype: 'bandpass', f: 1400, q: 4 });
    b.tone({ type: 'sine', f: 210, f1: 90, dur: 0.12, vol: 0.6 });
    b.noise({ dur: 0.05, vol: 0.4, ftype: 'bandpass', f: 900, q: 3, delay: 0.07 });
  },
  secret: (b) => {
    b.tone({ type: 'triangle', f: 250, f1: 740, dur: 0.55, vol: 0.35, vib: { f: 7, amp: 10 } });
    b.tone({ type: 'square', f: 500, f1: 1480, dur: 0.5, vol: 0.1 });
  },

  // --- Снаряды ---
  prj_fire: (b) => {
    b.noise({ dur: 0.35, vol: 0.55, ftype: 'bandpass', q: 1.2, fcurve: [[0, 320], [0.4, 1350], [1, 480]] });
    b.tone({ type: 'sawtooth', f: 190, f1: 95, dur: 0.3, vol: 0.32, trem: { f: 19, depth: 0.18 } });
  },
  prj_hit: (b) => {
    b.noise({ dur: 0.28, vol: 0.7, ftype: 'lowpass', f: 1500, f1: 200 });
    b.tone({ type: 'sine', f: 190, f1: 55, dur: 0.2, vol: 0.6 });
    b.noise({ dur: 0.08, vol: 0.35, ftype: 'highpass', f: 1800 });
  },

  // --- Зомби: хриплый человеческий голос ---
  en_zombie_sight: (b) => {
    humanVoice(b, { fcurve: [[0, 150], [0.18, 205], [1, 105]], dur: 0.45, vol: 0.45 });
  },
  en_zombie_pain: (b) => {
    humanVoice(b, { f0: 185, f1: 115, dur: 0.26, vol: 0.5 });
  },
  en_zombie_die: (b) => {
    humanVoice(b, { f0: 195, f1: 58, dur: 1.1, vol: 0.5, vibA: 20 });
    b.noise({ dur: 0.95, vol: 0.18, ftype: 'bandpass', f: 650, f1: 240, q: 1 });
  },
  en_zombie_attack: (b) => pistolShot(b, 0.9),

  // --- Сержант: ниже и грубее ---
  en_sergeant_sight: (b) => {
    humanVoice(b, { fcurve: [[0, 120], [0.2, 162], [1, 82]], dur: 0.55, vol: 0.5, breath: 0.35 });
  },
  en_sergeant_pain: (b) => {
    humanVoice(b, { f0: 152, f1: 95, dur: 0.28, vol: 0.52 });
  },
  en_sergeant_die: (b) => {
    humanVoice(b, { f0: 160, f1: 48, dur: 1.2, vol: 0.52, vibA: 22, breath: 0.34 });
    b.noise({ dur: 1.0, vol: 0.2, ftype: 'bandpass', f: 560, f1: 210, q: 1 });
  },
  en_sergeant_attack: (b) => shotgunBlast(b, 0.85),

  // --- Имп: шипящий визг ---
  en_imp_sight: (b) => {
    impShriek(b, { fcurve: [[0, 560], [0.3, 1100], [1, 380]], dur: 0.55, vol: 0.3, hiss: 0.3 });
  },
  en_imp_pain: (b) => {
    impShriek(b, { fcurve: [[0, 820], [0.25, 950], [1, 480]], dur: 0.28, vol: 0.32 });
  },
  en_imp_die: (b) => {
    impShriek(b, { fcurve: [[0, 900], [0.2, 1000], [1, 140]], dur: 1.25, vol: 0.3, hiss: 0.26 });
    b.noise({ dur: 1.0, vol: 0.18, ftype: 'bandpass', f: 600, f1: 200, q: 1 });
  },
  en_imp_attack: (b) => {
    b.noise({ dur: 0.32, vol: 0.5, ftype: 'bandpass', q: 1.2, fcurve: [[0, 400], [0.5, 1500], [1, 600]] });
    b.tone({ type: 'sawtooth', f: 260, f1: 120, dur: 0.3, vol: 0.3, trem: { f: 21, depth: 0.16 } });
    b.noise({ dur: 0.3, vol: 0.25, ftype: 'highpass', f: 2600 });
  },

  // --- Демон: утробный рёв, чавкающий укус ---
  en_demon_sight: (b) => {
    beastRoar(b, { fcurve: [[0, 78], [0.3, 102], [1, 58]], dur: 0.8, vol: 0.55, growl: 17 });
  },
  en_demon_pain: (b) => {
    beastRoar(b, { f0: 115, f1: 80, dur: 0.32, vol: 0.55, growl: 21, breath: 0.25 });
  },
  en_demon_die: (b) => {
    beastRoar(b, { fcurve: [[0, 100], [0.12, 112], [1, 32]], dur: 1.35, vol: 0.55, growl: 14 });
  },
  en_demon_attack: (b) => {
    b.noise({ dur: 0.05, vol: 0.6, ftype: 'bandpass', f: 950, q: 3 });
    b.tone({ type: 'sine', f: 150, f1: 48, dur: 0.2, vol: 0.9, delay: 0.06 });
    b.noise({ dur: 0.28, vol: 0.5, ftype: 'lowpass', f: 700, f1: 180, delay: 0.05 });
    b.tone({ type: 'sawtooth', f: 90, f1: 60, dur: 0.25, vol: 0.3, delay: 0.05, trem: { f: 19, depth: 0.2 } });
  },

  // --- Какодемон: электрическое гудение/бульканье ---
  en_cacodemon_sight: (b) => {
    cacoVoice(b, { fcurve: [[0, 160], [0.3, 232], [0.6, 180], [1, 210]], dur: 0.8, vol: 0.3 });
  },
  en_cacodemon_pain: (b) => {
    b.tone({ type: 'square', f: 420, f1: 260, dur: 0.3, vol: 0.32, vib: { f: 55, amp: 70 } });
    b.tone({ type: 'sawtooth', f: 424, f1: 255, dur: 0.28, vol: 0.2, vib: { f: 47, amp: 60 } });
    b.noise({ dur: 0.2, vol: 0.3, ftype: 'bandpass', f: 1300, q: 2 });
  },
  en_cacodemon_die: (b) => {
    cacoVoice(b, {
      fcurve: [[0, 260], [0.25, 300], [1, 55]], dur: 1.35, vol: 0.3, wob: 11,
      bubble: [[0, 820], [0.3, 480], [0.6, 560], [1, 140]],
    });
  },
  en_cacodemon_attack: (b) => {
    b.tone({ type: 'square', f: 160, f1: 520, dur: 0.35, vol: 0.3, bend: 'lin', vib: { f: 33, amp: 40 } });
    b.noise({ dur: 0.3, vol: 0.3, ftype: 'highpass', f: 2000 });
    b.noise({ dur: 0.06, vol: 0.4, ftype: 'bandpass', f: 1600, q: 3, delay: 0.3 });
  },

  // --- Барон: низкий мощный рёв ---
  en_baron_sight: (b) => {
    beastRoar(b, { fcurve: [[0, 52], [0.25, 80], [0.75, 68], [1, 40]], dur: 1.35, vol: 0.6, growl: 13, sub: 0.7, breath: 0.35 });
  },
  en_baron_pain: (b) => {
    beastRoar(b, { f0: 85, f1: 58, dur: 0.45, vol: 0.6, growl: 18, sub: 0.6 });
  },
  en_baron_die: (b) => {
    beastRoar(b, { fcurve: [[0, 75], [0.15, 86], [1, 22]], dur: 1.45, vol: 0.6, growl: 12, sub: 0.7 });
    b.noise({ dur: 1.4, vol: 0.25, ftype: 'lowpass', f: 300, f1: 80 });
  },
  en_baron_attack: (b) => {
    b.tone({ type: 'sawtooth', f: 72, f1: 50, dur: 0.3, vol: 0.35, trem: { f: 15, depth: 0.22 } });
    b.tone({ type: 'sine', f: 95, f1: 40, dur: 0.35, vol: 0.7 });
    b.noise({ dur: 0.45, vol: 0.5, ftype: 'bandpass', q: 1.2, fcurve: [[0, 350], [0.5, 1300], [1, 300]] });
    b.tone({ type: 'sawtooth', f: 130, f1: 65, dur: 0.4, vol: 0.35, trem: { f: 16, depth: 0.2 } });
  },
};

// ---------------------------------------------------------------------------
// SoundEngine
// ---------------------------------------------------------------------------

const _warned = new Set();

export class SoundEngine {
  constructor() {
    this._volume = 1;
    this._ctx = null;
    this._master = null;
  }

  // Лениво подключает движок к AudioContext: мастер-gain -> компрессор -> выход.
  _ensure() {
    if (this._master) return this._ctx;
    const ctx = getAudioCtx();
    if (!ctx) return null;
    this._ctx = ctx;
    this._master = ctx.createGain();
    this._master.gain.value = this._volume;
    let tail = ctx.destination;
    try {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.002;
      comp.release.value = 0.18;
      comp.connect(ctx.destination);
      tail = comp;
    } catch (e) {
      // без компрессора — напрямую в destination
    }
    this._master.connect(tail);
    return ctx;
  }

  // Вызвать по первому пользовательскому вводу (autoplay policy).
  resume() {
    try {
      const ctx = this._ensure();
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) {
      // тихий no-op
    }
  }

  // Общий уровень SFX, 0..1.
  setVolume(v) {
    try {
      this._volume = clamp(+v || 0, 0, 1);
      if (this._master && this._ctx) {
        const t = this._ctx.currentTime;
        this._master.gain.cancelScheduledValues(t);
        this._master.gain.setTargetAtTime(this._volume, t, 0.03);
      }
    } catch (e) {
      // тихий no-op
    }
  }

  // Проиграть звук по имени: play(name, {volume=1, pan=0}). pan -1..1.
  // Никогда не бросает исключений (в т.ч. при opts=null или мусорных значениях).
  play(name, opts) {
    try {
      const recipe = Object.prototype.hasOwnProperty.call(SOUNDS, name) ? SOUNDS[name] : null;
      if (!recipe) {
        if (!_warned.has(name)) {
          _warned.add(name);
          console.warn(`SoundEngine: неизвестный звук "${name}"`);
        }
        return;
      }
      const o = opts || {};
      const volume = clamp(o.volume != null && Number.isFinite(+o.volume) ? +o.volume : 1, 0, 1);
      const pan = clamp(o.pan != null && Number.isFinite(+o.pan) ? +o.pan : 0, -1, 1);
      if (volume <= 0 || this._volume <= 0) return;
      const ctx = this._ensure();
      if (!ctx || ctx.state !== 'running') return; // suspended/closed -> тихий no-op
      const g = ctx.createGain();
      g.gain.value = volume;
      let tail = g;
      if (typeof ctx.createStereoPanner === 'function') {
        const sp = ctx.createStereoPanner();
        sp.pan.value = pan;
        g.connect(sp);
        tail = sp;
      }
      tail.connect(this._master);
      // Лёгкая вариация питча на каждое проигрывание (живость, в духе Doom).
      const pv = 1 + (_rng() * 2 - 1) * 0.055;
      const v = new Voice(ctx, g, ctx.currentTime + 0.003, pv);
      recipe(v);
      // Уборка графа после окончания самого длинного слоя.
      setTimeout(() => {
        try {
          g.disconnect();
          if (tail !== g) tail.disconnect();
        } catch (e2) {
          // уже отключено
        }
      }, Math.ceil((v.end + 0.4) * 1000));
    } catch (e) {
      // никаких исключений наружу
    }
  }
}
