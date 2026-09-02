import { describe, it, expect } from 'vitest';
import {
  defaultIndex, parseIndex, addBuffer, renameBuffer, closeBuffer, moveBuffer, setActive,
} from './buffers';

const idx = (buffers: { id: string; title: string }[], activeId: string) => ({ buffers, activeId });

describe('buffers reducer', () => {
  it('parseIndex 还原合法数据', () => {
    const parsed = parseIndex(JSON.stringify(idx([{ id: 'a', title: 'x' }, { id: 'b', title: '' }], 'b')));
    expect(parsed.buffers.map((b) => b.id)).toEqual(['a', 'b']);
    expect(parsed.activeId).toBe('b');
  });

  it('parseIndex 对损坏数据回退为单缓冲', () => {
    const parsed = parseIndex('{bad json');
    expect(parsed.buffers.length).toBe(1);
  });

  it('parseIndex 对无 activeId 取首个缓冲', () => {
    const parsed = parseIndex(JSON.stringify({ buffers: [{ id: 'a', title: '' }] }));
    expect(parsed.activeId).toBe('a');
  });

  it('addBuffer 追加并激活新缓冲', () => {
    const next = addBuffer(idx([{ id: 'a', title: '' }], 'a'));
    expect(next.buffers.length).toBe(2);
    expect(next.activeId).toBe(next.buffers[1].id);
  });

  it('renameBuffer 按 id 更新 title', () => {
    const next = renameBuffer(idx([{ id: 'a', title: 'old' }], 'a'), 'a', 'new');
    expect(next.buffers[0].title).toBe('new');
  });

  it('closeBuffer 删除并修正 active（删非 active 不变）', () => {
    const base = idx([{ id: 'a', title: '' }, { id: 'b', title: '' }], 'a');
    expect(closeBuffer(base, 'b').buffers.map((b) => b.id)).toEqual(['a']);
    expect(closeBuffer(base, 'b').activeId).toBe('a');
  });

  it('closeBuffer 删除 active 时切到前一个', () => {
    const base = idx([{ id: 'a', title: '' }, { id: 'b', title: '' }], 'b');
    const next = closeBuffer(base, 'b');
    expect(next.buffers.map((b) => b.id)).toEqual(['a']);
    expect(next.activeId).toBe('a');
  });

  it('closeBuffer 至少保留一个缓冲', () => {
    const base = idx([{ id: 'a', title: '' }], 'a');
    expect(closeBuffer(base, 'a')).toEqual(base);
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

  it('defaultIndex 返回单空缓冲', () => {
    const d = defaultIndex();
    expect(d.buffers.length).toBe(1);
    expect(d.activeId).toBe(d.buffers[0].id);
  });
});
