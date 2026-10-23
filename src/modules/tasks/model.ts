export type TaskStatus = 'todo' | 'plan' | 'doing' | 'done';

export interface Task {
  id: string;
  category: string;
  content: string;
  status: TaskStatus;
  urgent: boolean;
  note: string;
  createdAt: number;
  editedAt: number;
}

export interface CategoryGroup {
  name: string;
  tasks: Task[];
  completed: Task[];
}

export interface StatusMeta {
  label: string;
  bg: string;
  border: string;
  dot: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo: {
    label: '未开始',
    bg: 'rgba(100,116,139,.16)',
    border: 'rgba(148,163,184,.30)',
    dot: '#94a3b8',
  },
  plan: {
    label: '规划',
    bg: 'rgba(234,179,8,.13)',
    border: 'rgba(234,179,8,.32)',
    dot: '#eab308',
  },
  doing: {
    label: '进行中',
    bg: 'rgba(239,68,68,.13)',
    border: 'rgba(239,68,68,.34)',
    dot: '#ef4444',
  },
  done: {
    label: '完成',
    bg: 'rgba(34,197,94,.12)',
    border: 'rgba(34,197,94,.30)',
    dot: '#22c55e',
  },
};

export const STATUS_ORDER: TaskStatus[] = ['todo', 'plan', 'doing', 'done'];

const STATUSES: TaskStatus[] = ['todo', 'plan', 'doing', 'done'];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (STATUSES as string[]).includes(value);
}

export function parseTaskInput(text: string): { category: string; content: string } | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length < 2) return null;
  const category = lines[0].trim();
  const content = lines.slice(1).join('\n').trim();
  if (!category || !content) return null;
  return { category, content };
}

function activeRank(task: Task): number {
  if (task.urgent) return 0;
  if (task.status === 'doing') return 1;
  return 2;
}

function latestEdited(list: Task[]): number {
  return list.reduce((max, task) => Math.max(max, task.editedAt), 0);
}

function categoryTier(group: CategoryGroup): number {
  if (group.tasks.some((task) => task.urgent)) return 0;
  if (group.tasks.length > 0) return 1;
  return 2;
}

function compareActive(a: Task, b: Task): number {
  return (
    activeRank(a) - activeRank(b) ||
    b.editedAt - a.editedAt ||
    b.createdAt - a.createdAt ||
    a.id.localeCompare(b.id)
  );
}

function compareCompleted(a: Task, b: Task): number {
  return b.editedAt - a.editedAt || b.createdAt - a.createdAt || a.id.localeCompare(b.id);
}

export function groupAndSort(tasks: Task[]): CategoryGroup[] {
  const byCategory = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = byCategory.get(task.category);
    if (list) {
      list.push(task);
    } else {
      byCategory.set(task.category, [task]);
    }
  }

  const groups: CategoryGroup[] = [];
  for (const [name, list] of byCategory) {
    groups.push({
      name,
      tasks: list.filter((task) => task.status !== 'done').sort(compareActive),
      completed: list.filter((task) => task.status === 'done').sort(compareCompleted),
    });
  }

  const latest = (group: CategoryGroup) => latestEdited([...group.tasks, ...group.completed]);

  return groups.sort(
    (a, b) =>
      categoryTier(a) - categoryTier(b) ||
      latest(b) - latest(a) ||
      a.name.localeCompare(b.name, 'zh'),
  );
}

function mapTask(tasks: Task[], id: string, update: (task: Task) => Task): Task[] {
  return tasks.map((task) => (task.id === id ? update(task) : task));
}

export function addTask(tasks: Task[], category: string, content: string, now: number): Task[] {
  const task: Task = {
    id: crypto.randomUUID(),
    category,
    content,
    status: 'todo',
    urgent: false,
    note: '',
    createdAt: now,
    editedAt: now,
  };
  return [...tasks, task];
}

export function setStatus(
  tasks: Task[],
  id: string,
  status: TaskStatus,
  now: number = Date.now(),
): Task[] {
  return mapTask(tasks, id, (task) => ({
    ...task,
    status,
    urgent: status === 'done' ? false : task.urgent,
    editedAt: now,
  }));
}

export function toggleUrgent(tasks: Task[], id: string, now: number = Date.now()): Task[] {
  return mapTask(tasks, id, (task) => ({ ...task, urgent: !task.urgent, editedAt: now }));
}

export function updateContent(tasks: Task[], id: string, content: string, now: number): Task[] {
  return mapTask(tasks, id, (task) => ({ ...task, content, editedAt: now }));
}

export function updateNote(tasks: Task[], id: string, note: string): Task[] {
  return mapTask(tasks, id, (task) => ({ ...task, note }));
}

export function removeTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const category = typeof item.category === 'string' ? item.category.trim() : '';
  const content = typeof item.content === 'string' ? item.content.trim() : '';
  if (!category || !content) return null;
  const now = Date.now();
  return {
    id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
    category,
    content,
    status: isTaskStatus(item.status) ? item.status : 'todo',
    urgent: item.urgent === true,
    note: typeof item.note === 'string' ? item.note : '',
    createdAt: toFiniteNumber(item.createdAt, now),
    editedAt: toFiniteNumber(item.editedAt, now),
  };
}

export function parseTasksFile(raw: string | null): Task[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    const list = (parsed as { tasks?: unknown }).tasks;
    if (!Array.isArray(list)) return [];
    return list.map(parseTask).filter((task): task is Task => task !== null);
  } catch {
    return [];
  }
}

export function serializeTasks(tasks: Task[]): string {
  return JSON.stringify({ version: 1, tasks }, null, 2);
}
