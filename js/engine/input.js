// Ввод: клавиатура, мышь, колесо, pointer lock.
// Контракт: docs/architecture.md §19. Потребители: main.js (keysPressed),
// player.js (движение/взгляд/use), weapons.js (fire/weaponSelect/wheelDelta).

// Удерживаемые клавиши: код -> имя флага в объекте input.
const HOLD_KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'strafeL', KeyD: 'strafeR',
  ArrowLeft: 'turnL', ArrowRight: 'turnR',
  ShiftLeft: 'run', ShiftRight: 'run',
};

// preventDefault только для этих кодов; Escape не трогаем —
// он нужен браузеру для выхода из pointer lock.
const PREVENT_KEYS = new Set([
  'Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ControlLeft', 'ControlRight',
]);

const KEY_QUEUE_MAX = 32;

export function createInput(canvas) {
  let ctrlFire = false;   // огонь с клавиатуры (Ctrl, удержание)
  let mouseFire = false;  // огонь ЛКМ (только при pointer lock)

  const input = {
    forward: false, back: false, strafeL: false, strafeR: false,
    turnL: false, turnR: false, run: false,
    fire: false,
    use: false,             // одноразовое нажатие, сбрасывается в endFrame
    weaponSelect: null,     // 1..7, действует один кадр
    wheelDelta: 0,          // -1 | 0 | 1, действует один кадр
    mouseDx: 0, mouseDy: 0, // накопленный сдвиг мыши при pointer lock
    keysPressed: [],        // очередь e.code нажатий (сбрасывает потребитель)
    pointerLocked: false,
    requestLock,
    exitLock,
    endFrame,
  };

  function syncFire() { input.fire = ctrlFire || mouseFire; }

  // Сброс всех удерживаемых состояний (потеря фокуса/pointer lock),
  // чтобы клавиши не «залипали» при пропущенном keyup.
  function resetHeld() {
    input.forward = input.back = input.strafeL = input.strafeR = false;
    input.turnL = input.turnR = input.run = false;
    ctrlFire = mouseFire = false;
    syncFire();
  }

  function requestLock() {
    if (document.pointerLockElement === canvas) return;
    try {
      const res = canvas.requestPointerLock();
      if (res && typeof res.catch === 'function') res.catch(() => { /* отказ браузера */ });
    } catch { /* запрос вне пользовательского жеста */ }
  }

  function exitLock() {
    if (!document.pointerLockElement) return;
    try { document.exitPointerLock(); } catch { /* уже снят */ }
  }

  function endFrame() {
    input.mouseDx = 0;
    input.mouseDy = 0;
    input.wheelDelta = 0;
    input.use = false;
    input.weaponSelect = null;
  }

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (!code) return;
    if (PREVENT_KEYS.has(code)) e.preventDefault();

    if (!e.repeat) {
      input.keysPressed.push(code);
      if (input.keysPressed.length > KEY_QUEUE_MAX) input.keysPressed.shift();
    }

    const flag = HOLD_KEYS[code];
    if (flag) input[flag] = true;

    if (code === 'ControlLeft' || code === 'ControlRight') {
      ctrlFire = true;
      syncFire();
    } else if ((code === 'KeyE' || code === 'Space') && !e.repeat) {
      input.use = true;
    } else if (code.length === 6 && code.startsWith('Digit')) {
      const n = code.charCodeAt(5) - 48;
      if (n >= 1 && n <= 7) input.weaponSelect = n;
    }
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    if (!code) return;
    const flag = HOLD_KEYS[code];
    if (flag) input[flag] = false;
    if (code === 'ControlLeft' || code === 'ControlRight') {
      ctrlFire = false;
      syncFire();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!input.pointerLocked) return;
    input.mouseDx += e.movementX || 0;
    input.mouseDy += e.movementY || 0;
  });

  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && input.pointerLocked) {
      mouseFire = true;
      syncFire();
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouseFire = false;
      syncFire();
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0) input.wheelDelta = 1;
    else if (e.deltaY < 0) input.wheelDelta = -1;
  }, { passive: false });

  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
    if (!input.pointerLocked) resetHeld();
  });

  window.addEventListener('blur', resetHeld);

  return input;
}
