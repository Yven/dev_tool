import { describe, it, expect } from 'vitest';
import { addOnTop, splitAtCursor, deleteEmpty, updateContent, isTopFirstLine } from './boxes';

const b = (id: string, content: string) => ({ id, content });

describe('boxes reducer', () => {
  it('addOnTop 在最前插入空框', () => {
    const boxes = [b('1', 'a'), b('2', 'b')];
    const next = addOnTop(boxes, '3');
    expect(next[0]).toEqual({ id: '3', content: '' });
    expect(next.map((x) => x.id)).toEqual(['3', '1', '2']);
  });

  it('splitAtCursor 在原位替换为 上框+下框，上框保留原 id', () => {
    const boxes = [b('1', 'top'), b('2', 'hello world')];
    const next = splitAtCursor(boxes, '2', 'hello', ' world');
    expect(next.map((x) => x.content)).toEqual(['top', 'hello', ' world']);
    expect(next[1].id).toBe('2');
    expect(next[2].id).not.toBe('2');
  });

  it('splitAtCursor 找不到 id 时原样返回', () => {
    const boxes = [b('1', 'a')];
    expect(splitAtCursor(boxes, 'nope', 'x', 'y')).toBe(boxes);
  });

  it('deleteEmpty 删除空框', () => {
    const boxes = [b('1', 'a'), b('2', '   '), b('3', 'c')];
    expect(deleteEmpty(boxes, '2').map((x) => x.id)).toEqual(['1', '3']);
  });

  it('deleteEmpty 忽略非空框', () => {
    const boxes = [b('1', 'a'), b('2', 'b')];
    expect(deleteEmpty(boxes, '2')).toBe(boxes);
  });

  it('deleteEmpty 至少保留一个框', () => {
    const boxes = [b('1', '')];
    expect(deleteEmpty(boxes, '1')).toBe(boxes);
  });

  it('updateContent 按 id 更新', () => {
    expect(updateContent([b('1', 'a')], '1', 'b')[0].content).toBe('b');
  });

  it('isTopFirstLine 仅在顶框且第一行时为真', () => {
    const boxes = [b('1', 'a'), b('2', 'b')];
    expect(isTopFirstLine(boxes, '1', true)).toBe(true);
    expect(isTopFirstLine(boxes, '2', true)).toBe(false);
    expect(isTopFirstLine(boxes, '1', false)).toBe(false);
  });
});
