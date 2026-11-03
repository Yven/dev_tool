export interface TabRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * 返回被拖项应插入「去掉被拖项后的数组」的下标（0..n）。
 * 指针落在某个标签上时按其水平半区决定前后；落在空白处时取中心最近的标签。
 */
export function dropIndex(rects: readonly TabRect[], point: Point, draggedId: string): number {
  const others = rects.filter((r) => r.id !== draggedId);
  if (others.length === 0) return 0;

  let hit = others.find(
    (r) =>
      point.x >= r.left &&
      point.x <= r.left + r.width &&
      point.y >= r.top &&
      point.y <= r.top + r.height,
  );

  if (!hit) {
    let best = others[0];
    let bestDistance = Infinity;
    for (const r of others) {
      const dx = point.x - (r.left + r.width / 2);
      const dy = point.y - (r.top + r.height / 2);
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = r;
      }
    }
    hit = best;
  }

  const index = others.indexOf(hit);
  const insertBefore = point.x < hit.left + hit.width / 2;
  return Math.max(0, Math.min(others.length, insertBefore ? index : index + 1));
}
