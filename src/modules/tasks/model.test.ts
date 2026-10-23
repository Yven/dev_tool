import { describe, expect, it } from 'vitest';
import {
  addTask,
  groupAndSort,
  parseTaskInput,
  parseTasksFile,
  removeTask,
  serializeTasks,
  setStatus,
  toggleUrgent,
  updateContent,
  updateNote,
  type Task,
} from './model';

function t(partial: Partial<Task>): Task {
  return {
    id: 'x',
    category: 'A',
    content: 'c',
    status: 'todo',
    urgent: false,
    note: '',
    createdAt: 1,
    editedAt: 1,
    ...partial,
  };
}

describe('parseTaskInput', () => {
  it('两行以上拆出分类与内容并 trim', () => {
    expect(parseTaskInput('  工作\n第一行\n第二行  ')).toEqual({
      category: '工作',
      content: '第一行\n第二行',
    });
  });

  it('CRLF 归一', () => {
    expect(parseTaskInput('工作\r\n内容')).toEqual({ category: '工作', content: '内容' });
  });

  it('单行、空内容、空分类都返回 null', () => {
    expect(parseTaskInput('只有分类')).toBeNull();
    expect(parseTaskInput('分类\n   ')).toBeNull();
    expect(parseTaskInput('   \n内容')).toBeNull();
    expect(parseTaskInput('')).toBeNull();
  });
});

describe('groupAndSort', () => {
  it('done 进 completed，分类内进行中排在 todo 前', () => {
    const tasks = [
      t({ id: '1', category: 'A', status: 'todo', editedAt: 99 }),
      t({ id: '2', category: 'A', status: 'doing', editedAt: 10 }),
      t({ id: '3', category: 'A', status: 'done', editedAt: 200 }),
    ];
    const [g] = groupAndSort(tasks);
    expect(g.name).toBe('A');
    expect(g.tasks.map((x) => x.id)).toEqual(['2', '1']);
    expect(g.completed.map((x) => x.id)).toEqual(['3']);
  });

  it('分类层：紧急 > 有未完成 > 只剩完成，同层按最新 editedAt 倒序', () => {
    const tasks = [
      t({ id: 'old', category: 'Old', editedAt: 10 }),
      t({ id: 'donely', category: 'DoneOnly', status: 'done', editedAt: 500 }),
      t({ id: 'urg', category: 'Urgent', urgent: true, editedAt: 5 }),
      t({ id: 'new', category: 'New', editedAt: 300 }),
    ];
    expect(groupAndSort(tasks).map((g) => g.name)).toEqual(['Urgent', 'New', 'Old', 'DoneOnly']);
  });

  it('任务层内 editedAt 倒序，同值按 createdAt 倒序', () => {
    const tasks = [
      t({ id: 'b', category: 'A', editedAt: 10, createdAt: 1 }),
      t({ id: 'c', category: 'A', editedAt: 10, createdAt: 2 }),
      t({ id: 'a', category: 'A', editedAt: 20, createdAt: 1 }),
    ];
    expect(groupAndSort(tasks)[0].tasks.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('完成栏内按 editedAt 倒序，空输入返回空数组', () => {
    const tasks = [
      t({ id: 'd1', category: 'A', status: 'done', editedAt: 1 }),
      t({ id: 'd2', category: 'A', status: 'done', editedAt: 2 }),
    ];
    expect(groupAndSort(tasks)[0].completed.map((x) => x.id)).toEqual(['d2', 'd1']);
    expect(groupAndSort([])).toEqual([]);
  });
});

describe('变更', () => {
  it('addTask 生成新任务且时间来自入参', () => {
    const out = addTask([], '工作', '写文档', 123);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      category: '工作',
      content: '写文档',
      status: 'todo',
      urgent: false,
      note: '',
      createdAt: 123,
      editedAt: 123,
    });
  });

  it('setStatus 改为 done 时清除紧急并更新时间', () => {
    const out = setStatus([t({ id: '1', urgent: true, editedAt: 5 })], '1', 'done', 100);
    expect(out[0]).toMatchObject({ status: 'done', urgent: false, editedAt: 100 });
  });

  it('toggleUrgent 更新时间', () => {
    const out = toggleUrgent([t({ id: '1', editedAt: 5 })], '1', 100);
    expect(out[0]).toMatchObject({ urgent: true, editedAt: 100 });
  });

  it('updateNote 不更新时间，updateContent 更新时间', () => {
    const noted = updateNote([t({ id: '1', editedAt: 5 })], '1', '备注');
    expect(noted[0]).toMatchObject({ note: '备注', editedAt: 5 });
    const edited = updateContent([t({ id: '1', editedAt: 5 })], '1', '新内容', 100);
    expect(edited[0]).toMatchObject({ content: '新内容', editedAt: 100 });
  });

  it('removeTask 只删目标', () => {
    const out = removeTask([t({ id: '1' }), t({ id: '2' })], '1');
    expect(out.map((x) => x.id)).toEqual(['2']);
  });
});

describe('文件解析', () => {
  it('损坏或缺失内容返回空数组', () => {
    expect(parseTasksFile('{oops')).toEqual([]);
    expect(parseTasksFile(null)).toEqual([]);
    expect(parseTasksFile('{"tasks": "nope"}')).toEqual([]);
  });

  it('丢弃非法条目、补齐缺省字段', () => {
    const raw = JSON.stringify({
      version: 1,
      tasks: [
        { id: 'a', category: 'x', content: 'y' },
        { category: '', content: 'z' },
      ],
    });
    const out = parseTasksFile(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', status: 'todo', urgent: false, note: '' });
  });

  it('serializeTasks 输出 version 1 与 tasks', () => {
    expect(JSON.parse(serializeTasks([]))).toEqual({ version: 1, tasks: [] });
  });
});
