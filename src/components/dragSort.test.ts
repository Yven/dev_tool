import { describe, expect, it } from 'vitest';
import { dropIndex, type TabRect } from './dragSort';

const rect = (id: string, left: number, top = 0): TabRect => ({ id, left, top, width: 100, height: 34 });
const rects = [rect('a', 0), rect('b', 100), rect('c', 200)];

describe('dropIndex', () => {
  it('落在标签左半时插到它前面', () => {
    expect(dropIndex(rects, { x: 120, y: 10 }, 'a')).toBe(0);
  });

  it('落在标签右半时插到它后面', () => {
    expect(dropIndex(rects, { x: 180, y: 10 }, 'a')).toBe(1);
  });

  it('被拖项从候选里剔除', () => {
    expect(dropIndex(rects, { x: 80, y: 10 }, 'b')).toBe(1);
  });

  it('空白处取最近标签', () => {
    expect(dropIndex(rects, { x: 360, y: 10 }, 'a')).toBe(2);
  });

  it('多行时按最近标签所在行判断', () => {
    const rows = [rect('a', 0), rect('b', 100), rect('c', 200), rect('d', 0, 38), rect('e', 100, 38)];
    expect(dropIndex(rows, { x: 40, y: 45 }, 'a')).toBe(2);
  });

  it('结果夹在 0..n', () => {
    expect(dropIndex(rects, { x: -50, y: 10 }, 'a')).toBe(0);
  });
});
