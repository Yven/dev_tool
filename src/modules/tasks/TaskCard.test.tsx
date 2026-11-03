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
    const { getByText } = render(() => <TaskCard {...props} />);
    fireEvent.click(getByText('⋯'));
    fireEvent.click(getByText('移动'));
    fireEvent.click(screen.getByText('B'));
    expect(props.onMove).toHaveBeenCalledWith('1', 'B');
  });

  it('没有其他分类时显示提示', () => {
    const props = { ...makeProps(), categories: ['A'] };
    const { getByText } = render(() => <TaskCard {...props} />);
    fireEvent.click(getByText('⋯'));
    fireEvent.click(getByText('移动'));
    expect(screen.getByText('暂无其他分类')).toBeTruthy();
  });
});

describe('TaskCard 移动菜单层级', () => {
  it('移动菜单移出卡片层叠上下文', () => {
    const props = makeProps();
    const { getByText } = render(() => <TaskCard {...props} />);
    fireEvent.click(getByText('⋯'));
    fireEvent.click(getByText('移动'));
    const menu = document.querySelector('[data-move-menu]');
    expect(menu).not.toBeNull();
    expect(menu?.closest('.task-card-wrap')).toBeNull();
    expect(document.body.contains(menu)).toBe(true);
  });
});
