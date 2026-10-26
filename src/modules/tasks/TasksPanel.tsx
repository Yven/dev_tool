import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js';
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
  type TaskStatus,
} from './model';
import { openUrl } from '@tauri-apps/plugin-opener';
import TaskCard from './TaskCard';
import { readTasksFile, writeTasksFile } from './storage';
import { showToast } from '../../components/Toast';

export default function TasksPanel() {
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [ready, setReady] = createSignal(false);
  const [input, setInput] = createSignal('');
  const [error, setError] = createSignal('');
  const [openDone, setOpenDone] = createSignal<Record<string, boolean>>({});

  const groups = createMemo(() => groupAndSort(tasks()));

  onMount(async () => {
    try {
      const raw = await readTasksFile();
      setTasks(parseTasksFile(raw));
    } catch (e) {
      console.error('Load tasks failed:', e);
    }
    setReady(true);
  });

  createEffect(() => {
    const list = tasks();
    if (!ready()) return;
    void writeTasksFile(serializeTasks(list)).catch(() => showToast('任务保存失败', 'error'));
  });

  const submit = () => {
    const parsed = parseTaskInput(input());
    if (!parsed) {
      setError('第一行填分类，第二行起填任务内容');
      return;
    }
    setTasks(addTask(tasks(), parsed.category, parsed.content, Date.now()));
    setInput('');
    setError('');
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const withReorder = (update: () => void) => {
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => unknown;
    };
    if (typeof doc.startViewTransition !== 'function') {
      update();
      return;
    }
    doc.startViewTransition(update);
  };

  const changeStatus = (id: string, status: TaskStatus) => {
    withReorder(() => setTasks(setStatus(tasks(), id, status)));
  };

  const changeUrgent = (id: string) => {
    withReorder(() => setTasks(toggleUrgent(tasks(), id)));
  };

  const changeContent = (id: string, content: string) => {
    withReorder(() => setTasks(updateContent(tasks(), id, content, Date.now())));
  };

  const changeNote = (id: string, note: string) => {
    setTasks(updateNote(tasks(), id, note));
  };

  const remove = (id: string) => {
    setTasks(removeTask(tasks(), id));
  };

  const handleLink = (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement | null)?.closest('a[href]');
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute('href') ?? '';
    if (/^https?:/i.test(href)) {
      void openUrl(href).catch(() => showToast('无法打开链接', 'error'));
    }
  };

  const toggleDone = (name: string) => {
    setOpenDone({ ...openDone(), [name]: !openDone()[name] });
  };

  return (
    <div class="flex h-full flex-col gap-3" onclick={handleLink}>
      <div class="shrink-0">
        <textarea
          class="w-full resize-none rounded border border-border bg-surface-alt px-2 py-1.5 text-[13px] leading-5 text-text outline-none focus:border-primary"
          rows={3}
          placeholder={'第一行：分类\n第二行起：任务内容'}
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <div class="mt-1 flex items-center justify-between">
          <Show when={error()}>
            <span class="text-[12px] text-red-400">{error()}</span>
          </Show>
          <span class="ml-auto text-[12px] text-text-dim">Ctrl+Enter 添加</span>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-auto">
        <Show when={groups().length === 0}>
          <div class="py-8 text-center text-[13px] text-text-dim">
            还没有任务，输入第一行分类、第二行开始写任务，Ctrl+Enter 添加
          </div>
        </Show>
        <For each={groups()}>
          {(group) => (
            <section class="mb-4">
              <div class="mb-1.5 flex items-baseline gap-1.5">
                <span class="text-[14px] font-semibold text-text">{group.name}</span>
                <span class="rounded-full bg-white/10 px-1.5 text-[11px] leading-4 text-text-dim">
                  {group.tasks.length}
                </span>
              </div>
              <For each={group.tasks}>
                {(task) => (
                  <TaskCard
                    task={task}
                    onStatus={changeStatus}
                    onUrgent={changeUrgent}
                    onContent={changeContent}
                    onNote={changeNote}
                    onDelete={remove}
                  />
                )}
              </For>
              <Show when={group.completed.length > 0}>
                <button
                  class="mt-1.5 flex items-center gap-1 border-0 bg-transparent text-[12px] text-text-dim shadow-none outline-none hover:text-text"
                  onclick={() => toggleDone(group.name)}
                >
                  <span>{openDone()[group.name] ? '▾' : '▸'}</span>
                  完成 ({group.completed.length})
                </button>
                <Show when={openDone()[group.name]}>
                  <div class="mt-1.5">
                    <For each={group.completed}>
                      {(task) => (
                        <TaskCard
                          task={task}
                          onStatus={changeStatus}
                          onUrgent={changeUrgent}
                          onContent={changeContent}
                          onNote={changeNote}
                          onDelete={remove}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </section>
          )}
        </For>
      </div>
    </div>
  );
}
