import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { STATUS_META, STATUS_ORDER, type Task, type TaskStatus } from './model';
import { confirmTaskDelete } from './storage';
import { renderMarkdown } from './markdown';

export interface TaskCardProps {
  task: Task;
  onStatus: (id: string, status: TaskStatus) => void;
  onUrgent: (id: string) => void;
  onContent: (id: string, content: string) => void;
  onNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}

export default function TaskCard(props: TaskCardProps) {
  const [statusOpen, setStatusOpen] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal('');
  const [noteEditing, setNoteEditing] = createSignal(false);
  const [noteDraft, setNoteDraft] = createSignal('');

  const meta = () => STATUS_META[props.task.status];

  onMount(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (statusOpen() && !target?.closest('[data-task-status]')) setStatusOpen(false);
      if (menuOpen() && !target?.closest('[data-task-menu]')) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStatusOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    });
  });

  const pickStatus = (status: TaskStatus) => {
    setStatusOpen(false);
    props.onStatus(props.task.id, status);
  };

  const remove = async () => {
    setMenuOpen(false);
    const ok = await confirmTaskDelete('确定删除该任务？删除后不可恢复。');
    if (ok) props.onDelete(props.task.id);
  };

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const startEdit = () => {
    setDraft(props.task.content);
    setEditing(true);
  };

  const saveEdit = () => {
    const value = draft().trim();
    setEditing(false);
    if (value) props.onContent(props.task.id, value);
  };

  const onEditKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault();
      saveEdit();
    }
  };

  const formatEditedAt = (ts: number) => {
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  const startNote = () => {
    setNoteDraft(props.task.note);
    setNoteEditing(true);
  };

  const saveNote = () => {
    setNoteEditing(false);
    props.onNote(props.task.id, noteDraft().trim());
  };

  const onNoteKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setNoteEditing(false);
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault();
      saveNote();
    }
  };

  return (
    <div
      classList={{ 'task-card-wrap': true, 'task-urgent-ring': props.task.urgent }}
      style={{ 'view-transition-name': `task-${props.task.id}` }}
    >
      <div
        class="task-card group flex flex-col gap-1"
        style={{ background: meta().bg, 'border-color': meta().border }}
      >
        <div class="flex items-start gap-2">
          <button
            class="task-urgent shrink-0 self-center rounded border-0 bg-transparent text-[13px] leading-5 shadow-none outline-none transition-[transform,background-color,box-shadow] duration-150 hover:scale-110 hover:bg-red-400/15 hover:shadow-[0_0_8px_rgba(239,68,68,0.45)] active:scale-95"
            classList={{
              'opacity-0 hover:opacity-100 focus-visible:opacity-100': !props.task.urgent,
            }}
            aria-label={props.task.urgent ? '取消紧急' : '标记紧急'}
            title={props.task.urgent ? '取消紧急' : '标记紧急'}
            onclick={() => props.onUrgent(props.task.id)}
          >
            ⚠️
          </button>

          <div class="min-w-0 flex-1">
            <Show
              when={editing()}
              fallback={
                <div
                  class="task-md break-words text-[13px] leading-5 text-text"
                  ondblclick={startEdit}
                  innerHTML={renderMarkdown(props.task.content)}
                />
              }
            >
              <textarea
                class="min-h-[44px] w-full resize-none overflow-hidden rounded border border-border bg-surface px-2 py-1 text-[13px] leading-5 text-text outline-none focus:border-primary"
                rows={4}
                value={draft()}
                ref={(el) =>
                  queueMicrotask(() => {
                    el.focus();
                    grow(el);
                  })
                }
                onInput={(e) => {
                  setDraft(e.currentTarget.value);
                  grow(e.currentTarget);
                }}
                onKeyDown={onEditKeyDown}
              />
            </Show>

            <div class="mt-1 flex items-start gap-1.5 pl-3">
              <button
                class="flex shrink-0 items-center gap-1 border-0 bg-transparent text-[11px] text-text-dim shadow-none outline-none hover:text-text"
                classList={{
                  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100':
                    props.task.note.trim() === '',
                }}
                onclick={startNote}
              >
                备注
                <span class="i-carbon-edit text-[10px]" />
              </button>
              <div class="min-w-0 flex-1">
                <Show when={noteEditing()}>
                  <textarea
                    class="min-h-[40px] w-full resize-none overflow-hidden rounded border border-border bg-surface px-2 py-1 text-[12px] leading-4 text-text-dim outline-none focus:border-primary"
                    rows={2}
                    value={noteDraft()}
                    ref={(el) =>
                      queueMicrotask(() => {
                        el.focus();
                        grow(el);
                      })
                    }
                    onInput={(e) => {
                      setNoteDraft(e.currentTarget.value);
                      grow(e.currentTarget);
                    }}
                    onKeyDown={onNoteKeyDown}
                  />
                </Show>
                <Show when={!noteEditing() && props.task.note.trim() !== ''}>
                  <div
                    class="task-md task-note-md break-words"
                    ondblclick={startNote}
                    innerHTML={renderMarkdown(props.task.note)}
                  />
                </Show>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-1">
            <div class="flex items-center gap-1">
              <Show
                when={statusOpen()}
              fallback={
                <button
                  data-task-status
                  class="flex h-[22px] items-center gap-1 rounded border px-2 text-[12px] transition-colors"
                  style={{
                    background: meta().bg,
                    'border-color': meta().border,
                    color: meta().dot,
                  }}
                  onclick={() => {
                    setMenuOpen(false);
                    setStatusOpen(true);
                  }}
                >
                  <span class="h-1.5 w-1.5 rounded-full" style={{ background: meta().dot }} />
                  {meta().label}
                </button>
              }
            >
              <div data-task-status class="task-status-pop flex items-center gap-1">
                <For each={STATUS_ORDER}>
                  {(status) => (
                    <button
                      class="flex h-[22px] items-center gap-1 rounded border px-2 text-[12px] transition-colors"
                      style={{
                        background: STATUS_META[status].bg,
                        'border-color': STATUS_META[status].border,
                        color: STATUS_META[status].dot,
                      }}
                      onclick={() => pickStatus(status)}
                    >
                      <span
                        class="h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_META[status].dot }}
                      />
                      {STATUS_META[status].label}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <div class="relative">
              <button
                data-task-menu
                class="flex h-[22px] items-center rounded border border-border bg-transparent px-2 text-[12px] text-text-dim hover:text-text"
                aria-label="更多操作"
                onclick={() => {
                  setStatusOpen(false);
                  setMenuOpen(!menuOpen());
                }}
              >
                <span class="text-[14px] leading-none">⋯</span>
              </button>
              <Show when={menuOpen()}>
                <div
                  data-task-menu
                  class="absolute right-0 top-full z-20 mt-1 w-20 rounded border border-border bg-surface-alt py-1 shadow-lg"
                >
                  <button
                    class="w-full border-0 bg-transparent px-2 py-1 text-left text-[12px] text-red-400 shadow-none outline-none hover:bg-red-400/10"
                    onclick={() => void remove()}
                  >
                    删除
                  </button>
                </div>
              </Show>
            </div>
            </div>
            <span class="text-[12px] leading-4 text-text-dim" title="最后编辑时间">
              {formatEditedAt(props.task.editedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
