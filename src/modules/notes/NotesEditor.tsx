// @ts-nocheck
import { JSX, createEffect, onCleanup, onMount } from 'solid-js';
import { HeynoteEditor } from './heynote/editor.js';
import { LANGUAGES } from './heynote/languages.js';
import { readBuffer, saveBuffer } from './files';

export const NOTES_LANGUAGES = LANGUAGES.map((l) => ({ token: l.token, name: l.name }));

interface Props {
  activeId: string;
  title: string;
  active?: boolean;
  fontFamily: string;
  fontSize: number;
}

const defaultBlock = () => `\n∞∞∞text-a;created=${new Date().toISOString()}\n`;

function installShim() {
  const w = window as any;
  if (!w.heynote) {
    w.heynote = {
      buffer: {
        save: (path: string, content: string) => saveBuffer(path, content),
        load: async (path: string) => {
          try {
            return await readBuffer(path);
          } catch {
            // 首次新建缓冲：文件尚未落盘，返回默认空文本块
            return defaultBlock();
          }
        },
        addOnChangeCallback: () => {},
        removeOnChangeCallback: () => {},
        close: () => {},
      },
      platform: { isMac: false, isLinux: false, isWindows: true },
      defaultFontSize: 14,
      defaultFontFamily: "Space Mono",
    };
  }
}

export default function NotesEditor(props: Props): JSX.Element {
  let root!: HTMLDivElement;
  let editor: HeynoteEditor | null = null;
  let lastId = props.activeId;

  onMount(() => {
    installShim();
    editor = new HeynoteEditor({
      element: root,
      path: `${props.activeId}.txt`,
      focus: true,
      theme: 'dark',
      keymap: 'default',
      showLineNumberGutter: true,
      showFoldGutter: true,
      fontFamily: props.fontFamily,
      fontSize: props.fontSize,
    });
    // 供 NotesPanel 的状态栏语言下拉调用
    (window as any).__heynoteSetLanguage = (lang: string) => editor?.setCurrentLanguage(lang, false);
  });

  createEffect(() => {
    const id = props.activeId;
    if (editor && id !== lastId) {
      lastId = id;
      void editor.setBuffer(`${id}.txt`, props.title);
    }
  });

  createEffect(() => {
    if (!editor) return;
    if (props.active) {
      editor.show();
      editor.focus();
    } else {
      editor.hide();
    }
  });

  createEffect(() => {
    if (!editor) return;
    editor.setFont(props.fontFamily, props.fontSize);
  });

  onCleanup(() => {
    delete (window as any).__heynoteSetLanguage;
    editor?.destroy(true);
  });

  return <div ref={root} class="notes-editor h-full w-full" />;
}
