import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import TaskCard from './TaskCard';
import type { Task } from './model';

const task: Task = {
  id: '1', category: 'A', content: '内容', status: 'todo', urgent: false, note: '', createdAt: 1, editedAt: 1,
};

const makeProps = () => ({
  task,
  categories: ['A', 'B'],
  onStatus: vi.fn(),
  onUrgent: vi.fn(),
  onContent: vi.fn(),
  onNote: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
});

describe('TaskCard 移动菜单', () => {
  it('打开移动菜单并选择其他分类', () => {
    const props = makeProps();
    render(() => <TaskCard {...props} />);
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByText('移动'));
    fireEvent.click(screen.getByText('B'));
    expect(props.onMove).toHaveBeenCalledWith('1', 'B');
  });

  it('没有其他分类时显示提示', () => {
    const props = { ...makeProps(), categories: ['A'] };
    render(() => <TaskCard {...props} />);
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByText('移动'));
    expect(screen.getByText('暂无其他分类')).toBeTruthy();
  });
});

describe('TaskCard 操作菜单层级', () => {
  it('操作菜单移出卡片层叠上下文', () => {
    const props = makeProps();
    render(() => <TaskCard {...props} />);
    fireEvent.click(screen.getByText('⋯'));
    const menu = screen.getByText('删除').closest('[data-task-menu]');
    expect(menu).not.toBeNull();
    expect(menu?.closest('.task-card-wrap')).toBeNull();
    expect(document.body.contains(menu)).toBe(true);
  });

  it('删除按钮浮在后续任务之上', () => {
    const first = makeProps();
    const second = { ...makeProps(), task: { ...task, id: '2' } };
    render(() => (
      <>
        <TaskCard {...first} />
        <TaskCard {...second} />
      </>
    ));
    fireEvent.click(screen.getAllByText('⋯')[0]);
    const menu = screen.getByText('删除').closest('[data-task-menu]') as HTMLElement;
    expect(menu.closest('.task-card-wrap')).toBeNull();
    expect(menu.classList.contains('fixed')).toBe(true);
    expect(menu.classList.contains('z-30')).toBe(true);
  });

  it('移动菜单移出卡片层叠上下文', () => {
    const props = makeProps();
    render(() => <TaskCard {...props} />);
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByText('移动'));
    const menu = document.querySelector('[data-move-menu]');
    expect(menu).not.toBeNull();
    expect(menu?.closest('.task-card-wrap')).toBeNull();
    expect(document.body.contains(menu)).toBe(true);
  });
});

describe('TaskCard 状态展开', () => {
  it('状态选项以浮层展开，不占布局宽度', () => {
    const props = makeProps();
    render(() => <TaskCard {...props} />);
    const trigger = document.querySelector('[data-task-status]') as HTMLElement;
    fireEvent.click(trigger);
    const pop = document.querySelector('.task-status-pop') as HTMLElement;
    expect(pop).not.toBeNull();
    expect(pop.classList.contains('fixed')).toBe(true);
    // 浮层脱离卡片渲染，不参与布局，备注内容宽度不受影响
    expect(pop.closest('.task-card-wrap')).toBeNull();
    expect(document.body.contains(pop)).toBe(true);
    expect(document.querySelector('[data-task-status]')).toBe(trigger);
  });

  it('滚动时浮层跟随状态按钮', () => {
    render(() => <TaskCard {...makeProps()} />);
    const trigger = document.querySelector('button[data-task-status]') as HTMLElement;
    const rect = { top: 100, left: 300, right: 366, bottom: 122, width: 66, height: 22, x: 300, y: 100 };
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect as unknown as DOMRect);
    fireEvent.click(trigger);
    const pop = document.querySelector('.task-status-pop') as HTMLElement;
    expect(pop.style.top).toBe('100px');
    rect.top = 40;
    rect.bottom = 62;
    fireEvent.scroll(window);
    expect(pop.style.top).toBe('40px');
  });

  it('选择状态后关闭浮层并回调', () => {
    const props = makeProps();
    render(() => <TaskCard {...props} />);
    fireEvent.click(screen.getByText('未开始'));
    fireEvent.click(screen.getByText('规划'));
    expect(props.onStatus).toHaveBeenCalledWith('1', 'plan');
    expect(document.querySelector('.task-status-pop')).toBeNull();
  });
});
describe('TaskCard 同时只展开一个浮层', () => {
  const twoCards = () => {
    const first = makeProps();
    const second = { ...makeProps(), task: { ...task, id: '2' } };
    render(() => (
      <>
        <TaskCard {...first} />
        <TaskCard {...second} />
      </>
    ));
  };

  it('打开新卡片的状态浮层会关闭旧的', () => {
    twoCards();
    const triggers = Array.from(document.querySelectorAll('[data-task-status]'));
    fireEvent.click(triggers[0]);
    expect(document.querySelectorAll('.task-status-pop').length).toBe(1);
    fireEvent.click(triggers[1]);
    expect(document.querySelectorAll('.task-status-pop').length).toBe(1);
  });

  it('打开新卡片的操作菜单会关闭旧的', () => {
    twoCards();
    const triggers = Array.from(document.querySelectorAll('button[data-task-menu]'));
    fireEvent.click(triggers[0]);
    expect(document.querySelectorAll('div[data-task-menu]').length).toBe(1);
    fireEvent.click(triggers[1]);
    expect(document.querySelectorAll('div[data-task-menu]').length).toBe(1);
  });
});
