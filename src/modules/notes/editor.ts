import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { indent, indentConfig } from '@milkdown/kit/plugin/indent';
import { prism } from '@milkdown/plugin-prism';
import { getMarkdown, replaceAll, $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import '@milkdown/theme-nord/style.css';

export interface SplitResult {
  before: string;
  after: string;
  isFirstLine: boolean;
}

export interface NoteEditor {
  destroy(): Promise<void>;
  getMarkdown(): string;
  setMarkdown(md: string): void;
  focus(): void;
  splitAtCursor(): SplitResult | null;
}

// 代码块语言标签：作为 ProseMirror widget decoration 注入，不覆盖 prism 的节点视图。
const codeBlockLangKey = new PluginKey('CODE_BLOCK_LANG');

function buildDecos(doc: any): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'code_block') {
      const lang = node.attrs?.language || 'text';
      const el = document.createElement('span');
      el.className = 'milkdown-code-block-lang';
      el.textContent = lang;
      decos.push(Decoration.widget(pos + 1, () => el, { side: -1 }));
    }
  });
  return DecorationSet.create(doc, decos);
}

const codeBlockLangPlugin = $prose(() => new Plugin({
  key: codeBlockLangKey,
  state: {
    init: (_config, state) => buildDecos(state.doc),
    apply: (tr) => buildDecos(tr.doc),
  },
  props: {
    decorations(state) {
      return codeBlockLangKey.getState(state);
    },
  },
}));

export async function createNoteEditor(opts: {
  root: HTMLElement;
  initial: string;
  onMarkdownChange: (md: string) => void;
}): Promise<NoteEditor> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, opts.root);
      ctx.set(defaultValueCtx, opts.initial);
      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) opts.onMarkdownChange(markdown);
      });
      ctx.update(indentConfig.key, (v) => ({ ...v, size: 2 }));
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
    .use(clipboard)
    .use(indent)
    .use(codeBlockLangPlugin)
    .use(prism)
    .create();

  return {
    async destroy() {
      await editor.destroy();
    },
    getMarkdown: () => editor.action(getMarkdown()),
    setMarkdown: (md: string) => editor.action(replaceAll(md)),
    focus() {
      editor.action((ctx) => {
        ctx.get(editorViewCtx).focus();
      });
    },
    splitAtCursor() {
      return editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { from, to, empty } = state.selection;
        if (!empty) return null;
        const serializer = ctx.get(serializerCtx);
        const docType = state.schema.topNodeType;
        const beforeNode = docType.create(null, state.doc.slice(0, from).content);
        const afterNode = docType.create(null, state.doc.slice(from, state.doc.content.size).content);
        const before = serializer(beforeNode);
        const after = serializer(afterNode);
        const isFirstLine =
          state.doc.childCount > 0 && from <= state.doc.child(0).nodeSize;
        return { before, after, isFirstLine };
      });
    },
  };
}
