import { JSX, createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import NotesEditor, { NOTES_LANGUAGES } from './NotesEditor';
import {
  NotesIndex, defaultIndex, addBuffer, renameBuffer, closeToTrash, restoreFromTrash, setActive,
} from './buffers';
import { readIndex, writeIndex, deleteBuffer } from './files';

const FONT_CACHE_KEY = 'cache:notes:font';
const LANG_CACHE_KEY = 'cache:notes:language';
const FONT_FAMILIES = ['Space Mono', 'Consolas', 'Cascadia Code', 'Segoe UI', 'system-ui'];
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
  return { family: 'Space Mono', size: 14 };
}

function loadLangPref(): string {
  try {
    const lang = localStorage.getItem(LANG_CACHE_KEY);
    if (lang) return lang;
  } catch {
    /* 解析失败回退默认 */
  }
  return 'text';
}

export default function NotesPanel(props: Props): JSX.Element {
  const [index, setIndex] = createSignal<NotesIndex>(defaultIndex());
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<{ language: string; auto: boolean } | null>(null);
  const [ready, setReady] = createSignal(false);
  const [trashOpen, setTrashOpen] = createSignal(false);
  const initialFont = loadFontPref();
  const [fontFamily, setFontFamily] = createSignal(initialFont.family);
  const [fontSize, setFontSize] = createSignal(initialFont.size);
  const [defaultLanguage, setDefaultLanguage] = createSignal(loadLangPref());

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

  const handleClose = async (id: string) => {
    if (index().buffers.length <= 1) return;
    let ok = false;
    try {
      ok = await invoke<boolean>('notes_confirm', { message: '确定关闭该页签？' });
    } catch (e) {
      console.error('notes_confirm failed:', e);
      return;
    }
    if (!ok) return;
    const cur = index();
    if (cur.buffers.length <= 1) return;
    const { index: next, evictedId } = closeToTrash(cur, id);
    setIndex(next);
    if (evictedId) deleteBuffer(`${evictedId}.txt`).catch(() => {});
  };

  const handleRestore = (id: string) => {
    setIndex((p) => restoreFromTrash(p, id));
    setTrashOpen(false);
  };

  const handleRename = (id: string, title: string) => setIndex((p) => renameBuffer(p, id, title));

  const handleSetLanguage = (lang: string) => {
    setDefaultLanguage(lang);
    try {
      localStorage.setItem(LANG_CACHE_KEY, lang);
    } catch {
      /* ignore */
    }
    (window as any).__heynoteSetLanguage?.(lang);
  };

  const activeId = () => index().activeId;
  const activeTitle = () => index().buffers.find((b) => b.id === activeId())?.title ?? '';

  return (
    <div class="flex flex-col h-full">
      {/* 缓冲区标签条 */}
      <div class="flex items-center gap-1 pb-2 overflow-x-auto">
        <For each={index().buffers}>
          {(buf) => (
            <div
              class="flex items-center justify-between pl-3 pr-1.5 py-0.5 text-xs min-w-[82px] rounded border cursor-pointer whitespace-nowrap"
              classList={{
                'border-primary bg-primary/15 text-primary': buf.id === activeId(),
                'border-border text-text-dim hover:text-text': buf.id !== activeId(),
              }}
              onclick={() => setIndex((p) => setActive(p, buf.id))}
            >
              <Show
                when={editingId() === buf.id}
                fallback={<span class="flex-1 min-w-0 truncate text-left" ondblclick={() => setEditingId(buf.id)}>{buf.title || '未命名'}</span>}
              >
                <input
                  class="w-24 bg-surface-alt border border-border rounded px-1"
                  value={buf.title}
                  autofocus
                  onblur={(e) => { handleRename(buf.id, e.currentTarget.value); setEditingId(null); }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') { handleRename(buf.id, e.currentTarget.value); setEditingId(null); }
                  }}
                />
              </Show>
              <button
                class="w-4 h-4 shrink-0 flex items-center justify-center rounded-full appearance-none border-0 bg-transparent text-text-dim hover:text-red-400 hover:bg-red-400/15"
                title="关闭"
                onclick={(e) => { e.stopPropagation(); handleClose(buf.id); }}
              >×</button>
            </div>
          )}
        </For>
        <button
          class="w-5 h-5 flex items-center justify-center rounded appearance-none border-0 bg-transparent text-text hover:text-primary hover:bg-surface-alt"
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
          defaultLanguage={defaultLanguage()}
        />
      </div>

      {/* 状态栏（当前块语言可选 + 字体字号设置 + 缓冲区数） */}
      <div class="flex items-center justify-between gap-3 pt-1 text-[11px] text-text-dim border-t border-border">
        <label class="flex items-center gap-1">
          语言
          <select
            class="bg-surface-alt border border-border rounded px-1 py-0.5 text-[11px] text-text"
            value={status()?.language ?? 'text'}
            onchange={(e) => handleSetLanguage(e.currentTarget.value)}
          >
            {NOTES_LANGUAGES.map((l) => <option value={l.token}>{l.name}</option>)}
          </select>
        </label>
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
        <div class="relative flex items-center gap-2">
          <span>{index().buffers.length} 个缓冲区</span>
          <button
            class="flex items-center justify-center w-5 h-5 rounded appearance-none border-0 bg-transparent text-text-dim hover:text-text hover:bg-surface"
            title="回收站"
            onclick={() => setTrashOpen((v) => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
          <Show when={trashOpen()}>
            <div class="absolute bottom-full right-0 mb-1 w-44 max-h-48 overflow-auto bg-surface-alt border border-border rounded shadow-lg p-1 z-20">
              <Show
                when={index().trash.length > 0}
                fallback={<div class="px-2 py-1 text-text-dim">回收站为空</div>}
              >
                <For each={[...index().trash].reverse()}>
                  {(b) => (
                    <button
                      class="w-full text-left px-2 py-1 text-xs text-text hover:bg-surface rounded truncate"
                      title={b.title || '未命名'}
                      onclick={() => handleRestore(b.id)}
                    >
                      {b.title || '未命名'}
                    </button>
                  )}
                </For>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
