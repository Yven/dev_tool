import { JSX, createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import NotesEditor from './NotesEditor';
import {
  NotesIndex, defaultIndex, addBuffer, renameBuffer, closeBuffer, setActive,
} from './buffers';
import { readIndex, writeIndex, deleteBuffer } from './files';

const FONT_CACHE_KEY = 'cache:notes:font';
const FONT_FAMILIES = ['monospace', 'Consolas', 'Cascadia Code', 'Segoe UI', 'system-ui'];
const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22, 24];

interface Props {
  active?: boolean;
}

function loadFontPref(): { family: string; size: number } {
  try {
    const raw = localStorage.getItem(FONT_CACHE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.family === 'string' && typeof p.size === 'number') {
        return { family: p.family, size: p.size };
      }
    }
  } catch {
    /* 解析失败回退默认 */
  }
  return { family: 'monospace', size: 14 };
}

export default function NotesPanel(props: Props): JSX.Element {
  const [index, setIndex] = createSignal<NotesIndex>(defaultIndex());
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<{ language: string; auto: boolean } | null>(null);
  const [ready, setReady] = createSignal(false);
  const initialFont = loadFontPref();
  const [fontFamily, setFontFamily] = createSignal(initialFont.family);
  const [fontSize, setFontSize] = createSignal(initialFont.size);

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

  createEffect(() => {
    if (!ready()) return;
    localStorage.setItem(FONT_CACHE_KEY, JSON.stringify({ family: fontFamily(), size: fontSize() }));
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
              class="flex items-center gap-1 pl-2 pr-1 py-1 text-xs rounded border cursor-pointer whitespace-nowrap"
              classList={{
                'border-primary bg-primary/15 text-primary': buf.id === activeId(),
                'border-border text-text-dim hover:text-text': buf.id !== activeId(),
              }}
              onclick={() => setIndex((p) => setActive(p, buf.id))}
            >
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
                class="w-4 h-4 flex items-center justify-center rounded-full text-text-dim hover:text-red-400 hover:bg-red-400/15"
                title="关闭"
                onclick={(e) => { e.stopPropagation(); handleClose(buf.id); }}
              >×</button>
            </div>
          )}
        </For>
        <button
          class="w-5 h-5 flex items-center justify-center rounded border border-transparent text-text hover:text-primary hover:bg-surface-alt hover:border-border"
          title="新建"
          onclick={handleAdd}
        >＋</button>
      </div>

      {/* 编辑器 */}
      <div class="flex-1 min-h-0">
        <NotesEditor
          activeId={activeId()}
          title={activeTitle()}
          active={props.active}
          fontFamily={fontFamily()}
          fontSize={fontSize()}
        />
      </div>

      {/* 状态栏（当前块语言 + 字体字号设置 + 缓冲区数） */}
      <div class="flex items-center justify-between gap-3 pt-1 text-[11px] text-text-dim border-t border-border">
        <span>语言：{langLabel()}</span>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1">
            字体
            <select
              class="bg-surface-alt border border-border rounded px-1 py-0.5 text-[11px] text-text"
              value={fontFamily()}
              onchange={(e) => setFontFamily(e.currentTarget.value)}
            >
              {FONT_FAMILIES.map((f) => <option value={f}>{f}</option>)}
            </select>
          </label>
          <label class="flex items-center gap-1">
            字号
            <select
              class="bg-surface-alt border border-border rounded px-1 py-0.5 text-[11px] text-text"
              value={String(fontSize())}
              onchange={(e) => setFontSize(Number(e.currentTarget.value))}
            >
              {FONT_SIZES.map((s) => <option value={s}>{s}px</option>)}
            </select>
          </label>
        </div>
        <span>{index().buffers.length} 个缓冲区</span>
      </div>
    </div>
  );
}
