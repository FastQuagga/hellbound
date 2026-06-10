// Коллизии: круг против сетки карты и против других сущностей.

// Перемещение со скольжением вдоль стен: оси разрешаются раздельно.
// Ход по оси блокируется, только если УВЕЛИЧИВАЕТ глубину пересечения со
// стенами: из свободного состояния (глубина 0) в стену войти нельзя, но если
// игрока уже затолкало в клетку (например, расталкиванием сущностей у угла
// ящика), движение наружу разрешено — иначе он застревает намертво.
const PEN_EPS = 1e-9;
export function moveWithCollision(map, x, y, dx, dy, radius) {
  let collided = false;
  let depth = penetration(map, x, y, radius);
  let nx = x + dx;
  const dpx = penetration(map, nx, y, radius);
  if (dpx > depth + PEN_EPS) { nx = x; collided = true; } else { depth = dpx; }
  let ny = y + dy;
  if (penetration(map, nx, ny, radius) > depth + PEN_EPS) { ny = y; collided = true; }
  return { x: nx, y: ny, collided };
}

// Глубина проникновения круга в солидные клетки (0 — свободно).
function penetration(map, x, y, r) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  let depth = 0;
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      if (!map.isSolid(ix, iy)) continue;
      // точная проверка: круг против квадрата клетки
      const cx = Math.max(ix, Math.min(x, ix + 1));
      const cy = Math.max(iy, Math.min(y, iy + 1));
      const ddx = x - cx, ddy = y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < r * r) {
        const pen = r - Math.sqrt(d2);
        if (pen > depth) depth = pen;
      }
    }
  }
  return depth;
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
