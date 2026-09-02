import { JSX, createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import NotesEditor from './NotesEditor';
import {
  NotesIndex, defaultIndex, parseIndex, addBuffer, renameBuffer, closeBuffer, moveBuffer, setActive,
} from './buffers';
import { readIndex, writeIndex, deleteBuffer } from './files';

interface Props {
  active?: boolean;
}

export default function NotesPanel(props: Props): JSX.Element {
  const [index, setIndex] = createSignal<NotesIndex>(defaultIndex());
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<{ language: string; auto: boolean } | null>(null);
  const [ready, setReady] = createSignal(false);

  onMount(async () => {
    (window as any).__heynoteOnCursorChange = (info: any) => {
      setStatus({ language: info.language, auto: info.auto });
    };
    try {
      const loaded = await readIndex();
      if (loaded) setIndex(loaded);
    } catch (e) {
      console.error('load notes index failed:', e);
    }
    setReady(true);
  });

  createEffect(() => {
    if (!ready()) return;
    writeIndex(index()).catch((e) => console.error('save index failed:', e));
  });

  onCleanup(() => {
    delete (window as any).__heynoteOnCursorChange;
  });

  const handleAdd = () => setIndex((prev) => addBuffer(prev));

  const handleClose = (id: string) => {
    const prev = index();
    if (prev.buffers.length <= 1) return;
    setIndex((p) => closeBuffer(p, id));
    deleteBuffer(`${id}.txt`).catch(() => {});
  };

  const handleRename = (id: string, title: string) => setIndex((p) => renameBuffer(p, id, title));

  const handleMove = (id: string, dir: -1 | 1) => {
    const prev = index();
    const idx = prev.buffers.findIndex((b) => b.id === id);
    if (idx < 0) return;
    setIndex((p) => moveBuffer(p, id, idx + dir));
  };

  const activeId = () => index().activeId;
  const activeTitle = () => index().buffers.find((b) => b.id === activeId())?.title ?? '';
  const langLabel = () => (status() ? `${status()!.language}${status()!.auto ? ' (自动)' : ''}` : '—');

  return (
    <div class="flex flex-col h-full">
      {/* 缓冲区标签条 */}
      <div class="flex items-center gap-1 pb-2 overflow-x-auto">
        <For each={index().buffers}>
          {(buf) => (
            <div
              class="flex items-center gap-1 px-2 py-1 text-xs rounded border cursor-pointer whitespace-nowrap"
              classList={{
                'border-primary bg-primary/15 text-primary': buf.id === activeId(),
                'border-border text-text-dim hover:text-text': buf.id !== activeId(),
              }}
              onclick={() => setIndex((p) => setActive(p, buf.id))}
            >
              <button
                class="text-text-dim hover:text-text"
                title="左移"
                onclick={(e) => { e.stopPropagation(); handleMove(buf.id, -1); }}
              >◀</button>
              <Show
                when={editingId() === buf.id}
                fallback={<span ondblclick={() => setEditingId(buf.id)}>{buf.title || '未命名'}</span>}
              >
                <input
                  class="w-20 bg-surface-alt border border-border rounded px-1"
                  value={buf.title}
                  autofocus
                  onblur={(e) => { handleRename(buf.id, e.currentTarget.value); setEditingId(null); }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') { handleRename(buf.id, e.currentTarget.value); setEditingId(null); }
                  }}
                />
              </Show>
              <button
                class="text-text-dim hover:text-text"
                title="右移"
                onclick={(e) => { e.stopPropagation(); handleMove(buf.id, 1); }}
              >▶</button>
              <button
                class="text-text-dim hover:text-red-400"
                onclick={(e) => { e.stopPropagation(); handleClose(buf.id); }}
              >×</button>
            </div>
          )}
        </For>
        <button
          class="px-2 py-1 text-xs rounded border border-border text-text-dim hover:text-text"
          onclick={handleAdd}
        >＋</button>
      </div>

      {/* 编辑器 */}
      <div class="flex-1 min-h-0">
        <NotesEditor activeId={activeId()} title={activeTitle()} active={props.active} />
      </div>

      {/* 状态栏（当前块语言） */}
      <div class="flex items-center justify-between pt-1 text-[11px] text-text-dim border-t border-border">
        <span>语言：{langLabel()}</span>
        <span>{index().buffers.length} 个缓冲区</span>
      </div>
    </div>
  );
}
