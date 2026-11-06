import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import { STATUS_META, STATUS_ORDER, type Task, type TaskStatus } from './model';
import { confirmTaskDelete } from './storage';
import { renderMarkdown } from './markdown';

export interface TaskCardProps {
  task: Task;
  categories: string[];
  onStatus: (id: string, status: TaskStatus) => void;
  onUrgent: (id: string) => void;
  onContent: (id: string, content: string) => void;
  onNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, category: string) => void;
}

// 同一时间只允许一张卡片的弹出层处于展开状态
const [openCardId, setOpenCardId] = createSignal<string | null>(null);

export default function TaskCard(props: TaskCardProps) {
  const [statusOpen, setStatusOpen] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [menuPos, setMenuPos] = createSignal({ left: 0, top: 0 });
  const [statusPos, setStatusPos] = createSignal<{ right: number; top: number; maxWidth: number } | null>(null);
  const [moveMenu, setMoveMenu] = createSignal<{ left: number; top: number; maxHeight: number } | null>(null);
  let menuButton: HTMLButtonElement | undefined;
  let moveButton: HTMLButtonElement | undefined;
  let statusButton: HTMLButtonElement | undefined;
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal('');
  const [noteEditing, setNoteEditing] = createSignal(false);
  const [noteDraft, setNoteDraft] = createSignal('');

  const meta = () => STATUS_META[props.task.status];

  createEffect(() => {
    const owner = openCardId();
    if (owner !== null && owner !== props.task.id) {
      setStatusOpen(false);
      setMenuOpen(false);
      setMoveMenu(null);
    }
  });

  onMount(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (statusOpen() && !target?.closest('[data-task-status]')) setStatusOpen(false);
      if (menuOpen() && !target?.closest('[data-task-menu]')) setMenuOpen(false);
      if (moveMenu() && !target?.closest('[data-task-menu]')) setMoveMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStatusOpen(false);
        setMenuOpen(false);
        setMoveMenu(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', syncFloating, true);
    window.addEventListener('resize', syncFloating);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', syncFloating, true);
      window.removeEventListener('resize', syncFloating);
    });
  });

  const pickStatus = (status: TaskStatus) => {
    setStatusOpen(false);
    props.onStatus(props.task.id, status);
  };

  const remove = async () => {
    setMenuOpen(false);
    setMoveMenu(null);
    const ok = await confirmTaskDelete('确定删除该任务？删除后不可恢复。');
    if (ok) props.onDelete(props.task.id);
  };

  const placeStatus = (rect: DOMRect) => {
    setStatusPos({
      right: window.innerWidth - rect.left + 4,
      top: Math.max(8, rect.top),
      maxWidth: Math.max(140, rect.left - 8),
    });
  };

  const placeMenu = (rect: DOMRect) => {
    const width = 80;
    const height = 64;
    setMenuPos({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - 8 - width)),
      top: rect.bottom + 4 + height > window.innerHeight - 8
        ? Math.max(8, rect.top - 4 - height)
        : rect.bottom + 4,
    });
  };

  const placeMoveMenu = (rect: DOMRect) => {
    const left = Math.max(8, rect.left - 132);
    const top = Math.min(Math.max(8, rect.top), window.innerHeight - 8 - 96);
    setMoveMenu({ left, top, maxHeight: Math.min(200, window.innerHeight - top - 8) });
  };

  const visibleRect = (el: HTMLElement | undefined) => {
    const rect = el?.getBoundingClientRect();
    if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return null;
    return rect;
  };

  // 浮层用 fixed 定位，滚动或窗口尺寸变化时跟着锚点按钮走；锚点滚出视口就收起
  const syncFloating = () => {
    if (statusOpen()) {
      const rect = visibleRect(statusButton);
      if (rect) placeStatus(rect);
      else setStatusOpen(false);
    }
    if (menuOpen()) {
      const rect = visibleRect(menuButton);
      if (rect) placeMenu(rect);
      else setMenuOpen(false);
    }
    if (moveMenu()) {
      const rect = visibleRect(moveButton);
      if (rect) placeMoveMenu(rect);
      else setMoveMenu(null);
    }
  };

  const toggleStatus = () => {
    if (statusOpen()) {
      setStatusOpen(false);
      return;
    }
    const rect = statusButton?.getBoundingClientRect();
    if (!rect) return;
    setMenuOpen(false);
    setMoveMenu(null);
    placeStatus(rect);
    setStatusOpen(true);
    setOpenCardId(props.task.id);
  };

  const toggleMenu = () => {
    if (menuOpen()) {
      setMenuOpen(false);
      return;
    }
    const rect = menuButton?.getBoundingClientRect();
    if (!rect) return;
    setStatusOpen(false);
    setMoveMenu(null);
    placeMenu(rect);
    setOpenCardId(props.task.id);
    setMenuOpen(true);
  };

  const openMoveMenu = () => {
    if (moveMenu()) {
      setMoveMenu(null);
      return;
    }
    const rect = moveButton?.getBoundingClientRect();
    if (!rect) return;
    placeMoveMenu(rect);
  };

  const chooseCategory = (category: string) => {
    setMoveMenu(null);
    setMenuOpen(false);
    props.onMove(props.task.id, category);
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
              <button
                ref={(el) => (statusButton = el)}
                data-task-status
                class="flex h-[22px] items-center gap-1 rounded border px-2 text-[12px] transition-colors"
                style={{
                  background: meta().bg,
                  'border-color': meta().border,
                  color: meta().dot,
                }}
                onclick={toggleStatus}
              >
                <span class="h-1.5 w-1.5 rounded-full" style={{ background: meta().dot }} />
                {meta().label}
              </button>
              <Show when={statusOpen()}>
                <Portal>
                  <div
                    data-task-status
                    class="task-status-pop fixed z-30 flex w-max flex-wrap items-center gap-1 rounded bg-surface-alt px-1 shadow-lg"
                    style={{
                      right: `${statusPos()?.right ?? 0}px`,
                      top: `${statusPos()?.top ?? 0}px`,
                      'max-width': `${statusPos()?.maxWidth ?? 140}px`,
                    }}
                  >
                    <For each={STATUS_ORDER}>
                      {(status) => (
                        <button
                          class="flex h-[22px] items-center gap-1 whitespace-nowrap rounded border px-2 text-[12px] transition-colors"
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
                </Portal>
              </Show>

            <div class="relative">
              <button
                ref={(el) => (menuButton = el)}
                data-task-menu
                class="flex h-[22px] items-center rounded border border-border bg-transparent px-2 text-[12px] text-text-dim hover:text-text"
                aria-label="更多操作"
                onclick={toggleMenu}
              >
                <span class="text-[14px] leading-none">⋯</span>
              </button>
              <Show when={menuOpen()}>
                <Portal>
                  <div
                    data-task-menu
                    class="fixed z-30 w-20 rounded border border-border bg-surface-alt py-1 shadow-lg"
                    style={{
                      left: `${menuPos().left}px`,
                      top: `${menuPos().top}px`,
                    }}
                  >
                    <button
                      ref={(el) => (moveButton = el)}
                      class="w-full border-0 bg-transparent px-2 py-1 text-left text-[12px] text-text-dim shadow-none outline-none hover:bg-white/10 hover:text-text"
                      onclick={openMoveMenu}
                    >
                      移动
                    </button>
                    <button
                      class="w-full border-0 bg-transparent px-2 py-1 text-left text-[12px] text-red-400 shadow-none outline-none hover:bg-red-400/10"
                      onclick={() => void remove()}
                    >
                      删除
                    </button>
                  </div>
                  <Show when={moveMenu()}>
                    {(menu) => (
                      <Portal>
                        <div
                          data-task-menu
                          data-move-menu
                          class="fixed z-30 rounded border border-border bg-surface-alt py-1 shadow-lg"
                          style={{
                            left: `${menu().left}px`,
                            top: `${menu().top}px`,
                            width: '128px',
                            'max-height': `${menu().maxHeight}px`,
                            overflow: 'auto',
                          }}
                        >
                          <Show
                            when={props.categories.some((name) => name !== props.task.category)}
                            fallback={
                              <div class="px-2 py-1 text-[12px] text-text-dim">暂无其他分类</div>
                            }
                          >
                            <For each={props.categories}>
                              {(name) => (
                                <button
                                  class="flex w-full items-center justify-between border-0 bg-transparent px-2 py-1 text-left text-[12px] shadow-none outline-none"
                                  classList={{
                                    'cursor-default text-text-dim opacity-50':
                                      name === props.task.category,
                                    'text-text hover:bg-white/10': name !== props.task.category,
                                  }}
                                  disabled={name === props.task.category}
                                  onclick={() => {
                                    if (name !== props.task.category) chooseCategory(name);
                                  }}
                                >
                                  <span class="truncate">{name}</span>
                                  {name === props.task.category && (
                                    <span class="ml-1 shrink-0 text-[10px]">当前</span>
                                  )}
                                </button>
                              )}
                            </For>
                          </Show>
                        </div>
                      </Portal>
                    )}
                  </Show>
                </Portal>
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
