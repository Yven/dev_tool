import { describe, it, expect } from 'vitest';
import {
  defaultIndex, parseIndex, addBuffer, renameBuffer, closeToTrash, restoreFromTrash, moveBuffer, setActive, TRASH_LIMIT,
} from './buffers';

const idx = (
  buffers: { id: string; title: string }[],
  activeId: string,
  trash: { id: string; title: string }[] = [],
) => ({ buffers, activeId, trash });

describe('buffers reducer', () => {
  it('parseIndex 还原合法数据', () => {
    const parsed = parseIndex(JSON.stringify(idx([{ id: 'a', title: 'x' }, { id: 'b', title: '' }], 'b')));
    expect(parsed.buffers.map((b) => b.id)).toEqual(['a', 'b']);
    expect(parsed.activeId).toBe('b');
    expect(parsed.trash).toEqual([]);
  });

  it('parseIndex 还原 trash 字段', () => {
    const parsed = parseIndex(JSON.stringify(idx([{ id: 'a', title: '' }], 'a', [{ id: 'x', title: 'X' }])));
    expect(parsed.trash.map((b) => b.id)).toEqual(['x']);
  });

  it('parseIndex 对旧索引（缺 trash）回退为空回收站', () => {
    const parsed = parseIndex(JSON.stringify({ buffers: [{ id: 'a', title: '' }], activeId: 'a' }));
    expect(parsed.trash).toEqual([]);
  });

  it('parseIndex 对损坏数据回退为单缓冲', () => {
    const parsed = parseIndex('{bad json');
    expect(parsed.buffers.length).toBe(1);
    expect(parsed.trash).toEqual([]);
  });

  it('parseIndex 对无 activeId 取首个缓冲', () => {
    const parsed = parseIndex(JSON.stringify({ buffers: [{ id: 'a', title: '' }] }));
    expect(parsed.activeId).toBe('a');
  });

  it('addBuffer 追加并激活新缓冲，且保留 trash', () => {
    const next = addBuffer(idx([{ id: 'a', title: '' }], 'a', [{ id: 'x', title: '' }]));
    expect(next.buffers.length).toBe(2);
    expect(next.activeId).toBe(next.buffers[1].id);
    expect(next.trash.map((b) => b.id)).toEqual(['x']);
  });

  it('renameBuffer 按 id 更新 title', () => {
    const next = renameBuffer(idx([{ id: 'a', title: 'old' }], 'a'), 'a', 'new');
    expect(next.buffers[0].title).toBe('new');
  });

  it('moveBuffer 重排', () => {
    const base = idx([{ id: 'a', title: '' }, { id: 'b', title: '' }, { id: 'c', title: '' }], 'a');
    expect(moveBuffer(base, 'c', 0).buffers.map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('setActive 仅在 id 存在时生效', () => {
    const base = idx([{ id: 'a', title: '' }, { id: 'b', title: '' }], 'a');
    expect(setActive(base, 'b').activeId).toBe('b');
    expect(setActive(base, 'nope').activeId).toBe('a');
  });

  it('defaultIndex 返回单空缓冲与空回收站', () => {
    const d = defaultIndex();
    expect(d.buffers.length).toBe(1);
    expect(d.activeId).toBe(d.buffers[0].id);
    expect(d.trash).toEqual([]);
  });

  describe('closeToTrash', () => {
    it('兼容缺 trash 字段的旧索引（不抛错且能关闭）', () => {
      const base = { buffers: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], activeId: 'a' } as any;
      const r = closeToTrash(base, 'b');
      expect(r.index.buffers.map((b) => b.id)).toEqual(['a']);
      expect(r.index.trash.map((b) => b.id)).toEqual(['b']);
      expect(r.evictedId).toBeNull();
    });

    it('关闭非 active 页签：移入回收站，active 不变', () => {
      const base = idx([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], 'a');
      const r = closeToTrash(base, 'b');
      expect(r.index.buffers.map((b) => b.id)).toEqual(['a']);
      expect(r.index.activeId).toBe('a');
      expect(r.index.trash.map((b) => b.id)).toEqual(['b']);
      expect(r.evictedId).toBeNull();
    });

    it('关闭 active 页签：切到前一个页签', () => {
      const base = idx([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }], 'b');
      const r = closeToTrash(base, 'b');
      expect(r.index.buffers.map((b) => b.id)).toEqual(['a', 'c']);
      expect(r.index.activeId).toBe('a');
      expect(r.index.trash.map((b) => b.id)).toEqual(['b']);
    });

    it('至少保留一个页签：单页签关闭无效果', () => {
      const base = idx([{ id: 'a', title: '' }], 'a');
      const r = closeToTrash(base, 'a');
      expect(r.index).toEqual(base);
      expect(r.evictedId).toBeNull();
    });

    it('回收站超过上限时挤出最旧并返回其 id', () => {
      const trash = Array.from({ length: TRASH_LIMIT }, (_, i) => ({ id: `o${i}`, title: '' }));
      const base = idx([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], 'a', trash);
      const r = closeToTrash(base, 'b');
      expect(r.evictedId).toBe('o0');
      expect(r.index.trash.map((b) => b.id)).toEqual(['o1', 'o2', 'o3', 'o4', 'b']);
    });
  });

  describe('restoreFromTrash', () => {
    it('从回收站移回 buffers 并激活', () => {
      const base = idx([{ id: 'a', title: '' }], 'a', [{ id: 'x', title: 'X' }]);
      const next = restoreFromTrash(base, 'x');
      expect(next.buffers.map((b) => b.id)).toEqual(['a', 'x']);
      expect(next.activeId).toBe('x');
      expect(next.trash).toEqual([]);
    });

    it('id 不在回收站时原样返回', () => {
      const base = idx([{ id: 'a', title: '' }], 'a', []);
      expect(restoreFromTrash(base, 'nope')).toBe(base);
    });
  });
});