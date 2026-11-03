import { fireEvent, render } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import TabBar from './TabBar';

const tabs = Array.from({ length: 9 }, (_, i) => ({ id: 't' + i, label: '标签' + i }));

describe('TabBar 布局', () => {
  it('渲染全部标签且没有展开按钮', () => {
    const { container, queryByTitle } = render(() => (
      <TabBar tabs={tabs} active="t0" onSelect={() => {}} />
    ));
    expect(container.querySelectorAll('[data-tab-id]')).toHaveLength(9);
    expect(queryByTitle('展开')).toBeNull();
    expect(container.querySelector('.tab-bar')).not.toBeNull();
    expect(container.querySelector('[data-tab-id="t0"]')?.className).toContain('border-solid');
  });

  it('点击标签回调对应 id', () => {
    const picked: string[] = [];
    const { container } = render(() => (
      <TabBar tabs={tabs} active="t0" onSelect={(id) => picked.push(id)} />
    ));
    (container.querySelector('[data-tab-id="t4"]') as HTMLButtonElement).click();
    expect(picked).toEqual(['t4']);
  });
});

describe('TabBar 序号', () => {
  it('按住 Alt 时前 9 个标签显示序号', () => {
    const { container } = render(() => (
      <TabBar tabs={tabs} active="t0" onSelect={() => {}} altHeld />
    ));
    const badges = [...container.querySelectorAll('[data-shortcut]')].map((el) => el.textContent);
    expect(badges).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('未按 Alt 时不显示序号', () => {
    const { container } = render(() => (
      <TabBar tabs={tabs} active="t0" onSelect={() => {}} />
    ));
    expect(container.querySelectorAll('[data-shortcut]')).toHaveLength(0);
  });

  it('少于 9 个标签只显示实际数量', () => {
    const { container } = render(() => (
      <TabBar tabs={tabs.slice(0, 3)} active="t0" onSelect={() => {}} altHeld />
    ));
    expect(container.querySelectorAll('[data-shortcut]')).toHaveLength(3);
  });
});

describe('TabBar 排序中的 Esc', () => {
  it('长按期间按 Esc 取消，不会进入排序', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(() => <TabBar tabs={tabs} active="t0" onSelect={() => {}} />);
      const tab = container.querySelector('[data-tab-id="t0"]') as HTMLElement;
      fireEvent(tab, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
      fireEvent.keyDown(document, { key: 'Escape' });
      vi.advanceTimersByTime(3000);
      expect(container.querySelector('.is-sorting-active')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('排序态按 Esc 取消后，松手不会切换标签', () => {
    vi.useFakeTimers();
    try {
      const picked: string[] = [];
      const { container } = render(() => (
        <TabBar tabs={tabs} active="t0" onSelect={(id) => picked.push(id)} />
      ));
      const tab = container.querySelector('[data-tab-id="t0"]') as HTMLElement;
      fireEvent(tab, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
      vi.advanceTimersByTime(3000);
      expect(container.querySelector('.is-sorting-active')).not.toBeNull();
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent(window, new MouseEvent('pointerup', { bubbles: true }));
      fireEvent.click(tab);
      expect(picked).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('TabBar 长按时长', () => {
  it('长按 2 秒进入排序', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(() => <TabBar tabs={tabs} active="t0" onSelect={() => {}} />);
      const tab = container.querySelector('[data-tab-id="t0"]') as HTMLElement;
      fireEvent(tab, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
      vi.advanceTimersByTime(1999);
      expect(container.querySelector('.is-sorting-active')).toBeNull();
      vi.advanceTimersByTime(1);
      expect(container.querySelector('.is-sorting-active')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
