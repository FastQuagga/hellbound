// Коллизии: круг против сетки карты и против других сущностей.

// Перемещение со скольжением вдоль стен: оси разрешаются раздельно.
export function moveWithCollision(map, x, y, dx, dy, radius) {
  let collided = false;
  let nx = x + dx;
  if (!regionFree(map, nx, y, radius)) { nx = x; collided = true; }
  let ny = y + dy;
  if (!regionFree(map, nx, ny, radius)) { ny = y; collided = true; }
  return { x: nx, y: ny, collided };
}

function regionFree(map, x, y, r) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      if (!map.isSolid(ix, iy)) continue;
      // точная проверка: круг против квадрата клетки
      const cx = Math.max(ix, Math.min(x, ix + 1));
      const cy = Math.max(iy, Math.min(y, iy + 1));
      const ddx = x - cx, ddy = y - cy;
      if (ddx * ddx + ddy * ddy < r * r) return false;
    }
  }
  return true;
}

// Блокировка другими сущностями ({x, y, radius, solid}); разрешает расходиться,
// если уже пересеклись (движение, увеличивающее дистанцию, не блокируется).
export function entityBlocked(things, self, nx, ny) {
  for (const t of things) {
    if (t === self || !t.solid) continue;
    const rr = t.radius + self.radius;
    const dx = t.x - nx, dy = t.y - ny;
    if (dx * dx + dy * dy < rr * rr) {
      const cx = t.x - self.x, cy = t.y - self.y;
      if (cx * cx + cy * cy > dx * dx + dy * dy) return true;
    }
  }
  return false;
}
