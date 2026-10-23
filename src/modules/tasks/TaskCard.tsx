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
  let root: HTMLDivElement | undefined;

  const meta = () => STATUS_META[props.task.status];
  const anyOpen = () => statusOpen() || menuOpen();

  onMount(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (anyOpen() && root && !root.contains(event.target as Node)) {
        setStatusOpen(false);
        setMenuOpen(false);
      }
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
    <div classList={{ 'task-card-wrap': true, 'task-urgent-ring': props.task.urgent }}>
      <div
        ref={root}
        class="task-card group flex items-start gap-2"
        style={{ background: meta().bg, 'border-color': meta().border }}
      >
        <button
          class="task-urgent shrink-0 text-xs leading-5"
          classList={{
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100': !props.task.urgent,
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
                class="task-md break-words text-xs leading-5 text-text"
                ondblclick={startEdit}
                innerHTML={renderMarkdown(props.task.content)}
              />
            }
          >
            <textarea
              class="w-full resize-none rounded border border-border bg-surface px-2 py-1 text-xs leading-5 text-text outline-none focus:border-primary"
              rows={4}
              value={draft()}
              ref={(el) => queueMicrotask(() => el.focus())}
              onInput={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={onEditKeyDown}
            />
          </Show>

          <div class="mt-0.5">
            <button
              class="flex items-center gap-1 text-[10px] text-text-dim hover:text-text"
              onclick={startNote}
            >
              备注
              <span class="i-carbon-edit text-[10px]" />
            </button>
            <Show when={noteEditing()}>
              <textarea
                class="mt-1 w-full resize-none rounded border border-border bg-surface px-2 py-1 text-[11px] leading-4 text-text-dim outline-none focus:border-primary"
                rows={2}
                value={noteDraft()}
                ref={(el) => queueMicrotask(() => el.focus())}
                onInput={(e) => setNoteDraft(e.currentTarget.value)}
                onKeyDown={onNoteKeyDown}
              />
            </Show>
            <Show when={!noteEditing() && props.task.note.trim() !== ''}>
              <div
                class="task-md task-note-md break-words"
                onclick={startNote}
                innerHTML={renderMarkdown(props.task.note)}
              />
            </Show>
          </div>
        </div>

        <div class="relative shrink-0">
          <button
            class="flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] transition-colors"
            style={{ background: meta().bg, 'border-color': meta().border, color: meta().dot }}
            onclick={() => {
              setMenuOpen(false);
              setStatusOpen(!statusOpen());
            }}
          >
            <span class="h-1.5 w-1.5 rounded-full" style={{ background: meta().dot }} />
            {meta().label}
          </button>
          <Show when={statusOpen()}>
            <div class="absolute right-0 top-full z-20 mt-1 w-24 rounded border border-border bg-surface-alt py-1 shadow-lg">
              <For each={STATUS_ORDER}>
                {(status) => (
                  <button
                    class="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] text-text hover:bg-white/5"
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
        </div>

        <div class="relative shrink-0">
          <button
            class="rounded px-1 text-xs leading-5 text-text-dim hover:bg-white/5 hover:text-text"
            aria-label="更多操作"
            onclick={() => {
              setStatusOpen(false);
              setMenuOpen(!menuOpen());
            }}
          >
            ...
          </button>
          <Show when={menuOpen()}>
            <div class="absolute right-0 top-full z-20 mt-1 w-20 rounded border border-border bg-surface-alt py-1 shadow-lg">
              <button
                class="w-full px-2 py-1 text-left text-[11px] text-red-400 hover:bg-red-400/10"
                onclick={() => void remove()}
              >
                删除
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
