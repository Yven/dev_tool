# 笔记面板（自由文本 / Markdown WYSIWYG）实施计划

> **面向 Agent 执行者：** 必需子技能：使用 superpower-subagent-driven-development（推荐）或 superpower-executing-plans 按任务逐项执行本计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 在 DevTool 新增一个「笔记」面板：多文本框、最新在上、Milkdown 所见即所得 Markdown（含 todo 复选框）、代码块 Prism 高亮与语言标签、shift+enter 建框/分割、空框退格删除、切面板自动聚焦、localStorage 实时持久化。

**架构：** 面板状态（`boxes: Box[]`，最新在上）只存于 `NotesPanel` 的 Solid signal；`boxes.ts` 是纯 reducer（可单测）；每个框用 `NoteBox` 包一个 Milkdown 编辑器实例（编辑器只是视图，内容以 markdown 字符串在 signal 与编辑器间同步）；`editor.ts` 封装 Milkdown 实例生命周期、序列化/反序列化、光标分割提取与代码块语言标签。

**技术栈：** SolidJS + TypeScript + UnoCSS + Vite；Milkdown v7（`@milkdown/kit` + `@milkdown/plugin-prism` + `@milkdown/theme-nord`）；Vitest（jsdom）。

**规格：** `docs/superpowers/specs/2026-08-27-notes-panel-design.md`（执行者需同时阅读本计划与规格）

## 全局约束

- 包管理器为 pnpm；命令均从仓库根目录 `D:\work\dnmp\www\dev_tool` 执行。
- **不执行 git 提交**（遵循 CLAUDE.md「不自动提交 git」，覆盖本技能默认的频繁提交）。本计划所有任务末尾不设提交步骤；如需提交由用户显式要求。
- 状态用 Solid Signals，不引入外部 store；持久化用 localStorage，键名 `cache:notes:boxes`。
- 面板接入遵循现有模式：`BUILTIN_TABS` 数组 + 面板区 `<div style={{display:...}}>` 常驻挂载（切换不丢状态）。
- 复用现有 CSS 约定（UnoCSS 原子类 + `app.css` 中的 `bg-surface`/`text-text`/`border-border`/`bg-surface-alt`/`text-text-dim`/`bg-primary` 等）。
- Milkdown/ProseMirror 代码仅出现在 `src/modules/notes/editor.ts` 内，业务组件不直接触碰其内部 API。
- 编辑器实例随框销毁而 `destroy()`，避免内存泄漏。

---

### 任务 1：安装依赖并注册「笔记」空面板骨架

**文件：**
- 修改：`package.json`（通过 pnpm add，不手写）
- 修改：`src/App.tsx`
- 新建：`src/modules/notes/NotesPanel.tsx`

**接口：**
- 依赖输入：无
- 对外产出：`NotesPanel` 组件（暂为占位，任务 5 补齐），tab id 为 `notes`

- [ ] **步骤 1：安装 Milkdown 依赖**

运行：
```bash
pnpm add @milkdown/kit @milkdown/plugin-prism @milkdown/theme-nord
```

预期：`package.json` 的 `dependencies` 出现上述三个包（均为 v7.x）。

- [ ] **步骤 2：创建占位面板组件**

新建 `src/modules/notes/NotesPanel.tsx`：
```tsx
import { JSX } from 'solid-js';

interface Props {
  active?: boolean;
}

export default function NotesPanel(_props: Props): JSX.Element {
  return <div class="text-sm text-text-dim">笔记面板（骨架）</div>;
}
```

- [ ] **步骤 3：在 App.tsx 注册 tab 与面板区**

在 `src/App.tsx` 做三处修改：

① import 区（现有 `import ReplacePanel from './modules/replace/ReplacePanel';` 之后）新增：
```tsx
import NotesPanel from './modules/notes/NotesPanel';
```

② `BUILTIN_TABS` 数组末尾（`replace` 项之后）新增：
```ts
{ id: 'notes', label: '笔记', icon: 'i-carbon-document' },
```

③ 面板区（现有 replace 的 `<div>` 块之后）新增：
```tsx
<div style={{ display: activeTab() === 'notes' ? 'block' : 'none' }}>
  <NotesPanel active={activeTab() === 'notes'} />
</div>
```

- [ ] **步骤 4：验证**

运行 `pnpm check`，预期 `tsc --noEmit` 通过、无类型错误。再运行 `pnpm tauri dev`，确认出现「笔记」tab，点击显示占位文案，切换标签不报错。

---

### 任务 2：boxes.ts 纯 reducer（TDD）

**文件：**
- 新建：`src/modules/notes/boxes.ts`
- 测试：`src/modules/notes/boxes.test.ts`

**接口：**
- 依赖输入：无
- 对外产出（后续任务依赖的精确签名）：
  - `type Box = { id: string; content: string }`
  - `newId(): string`
  - `addOnTop(boxes: Box[], id: string): Box[]`
  - `splitAtCursor(boxes: Box[], id: string, before: string, after: string): Box[]`
  - `deleteEmpty(boxes: Box[], id: string): Box[]`
  - `updateContent(boxes: Box[], id: string, content: string): Box[]`
  - `isTopFirstLine(boxes: Box[], id: string, isFirstLine: boolean): boolean`

- [ ] **步骤 1：编写失败的测试**

新建 `src/modules/notes/boxes.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { addOnTop, splitAtCursor, deleteEmpty, updateContent, isTopFirstLine } from './boxes';

const b = (id: string, content: string) => ({ id, content });

describe('boxes reducer', () => {
  it('addOnTop 在最前插入空框', () => {
    const boxes = [b('1', 'a'), b('2', 'b')];
    const next = addOnTop(boxes, '3');
    expect(next[0]).toEqual({ id: '3', content: '' });
    expect(next.map((x) => x.id)).toEqual(['3', '1', '2']);
  });

  it('splitAtCursor 在原位替换为 上框+下框，上框保留原 id', () => {
    const boxes = [b('1', 'top'), b('2', 'hello world')];
    const next = splitAtCursor(boxes, '2', 'hello', ' world');
    expect(next.map((x) => x.content)).toEqual(['top', 'hello', ' world']);
    expect(next[1].id).toBe('2');
    expect(next[2].id).not.toBe('2');
  });

  it('splitAtCursor 找不到 id 时原样返回', () => {
    const boxes = [b('1', 'a')];
    expect(splitAtCursor(boxes, 'nope', 'x', 'y')).toBe(boxes);
  });

  it('deleteEmpty 删除空框', () => {
    const boxes = [b('1', 'a'), b('2', '   '), b('3', 'c')];
    expect(deleteEmpty(boxes, '2').map((x) => x.id)).toEqual(['1', '3']);
  });

  it('deleteEmpty 忽略非空框', () => {
    const boxes = [b('1', 'a'), b('2', 'b')];
    expect(deleteEmpty(boxes, '2')).toBe(boxes);
  });

  it('deleteEmpty 至少保留一个框', () => {
    const boxes = [b('1', '')];
    expect(deleteEmpty(boxes, '1')).toBe(boxes);
  });

  it('updateContent 按 id 更新', () => {
    expect(updateContent([b('1', 'a')], '1', 'b')[0].content).toBe('b');
  });

  it('isTopFirstLine 仅在顶框且第一行时为真', () => {
    const boxes = [b('1', 'a'), b('2', 'b')];
    expect(isTopFirstLine(boxes, '1', true)).toBe(true);
    expect(isTopFirstLine(boxes, '2', true)).toBe(false);
    expect(isTopFirstLine(boxes, '1', false)).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行 `pnpm vitest run src/modules/notes/boxes.test.ts`，预期 FAIL，提示 `Cannot find module './boxes'`。

- [ ] **步骤 3：编写最小实现**

新建 `src/modules/notes/boxes.ts`：
```ts
export interface Box {
  id: string;
  content: string;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `box-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function addOnTop(boxes: Box[], id: string): Box[] {
  return [{ id, content: '' }, ...boxes];
}

export function splitAtCursor(
  boxes: Box[],
  id: string,
  before: string,
  after: string,
): Box[] {
  const idx = boxes.findIndex((x) => x.id === id);
  if (idx < 0) return boxes;
  const upper: Box = { id: boxes[idx].id, content: before };
  const lower: Box = { id: newId(), content: after };
  const next = boxes.slice();
  next.splice(idx, 1, upper, lower);
  return next;
}

export function deleteEmpty(boxes: Box[], id: string): Box[] {
  if (boxes.length <= 1) return boxes;
  const box = boxes.find((x) => x.id === id);
  if (!box || box.content.trim() !== '') return boxes;
  return boxes.filter((x) => x.id !== id);
}

export function updateContent(boxes: Box[], id: string, content: string): Box[] {
  return boxes.map((x) => (x.id === id ? { ...x, content } : x));
}

export function isTopFirstLine(
  boxes: Box[],
  id: string,
  isFirstLine: boolean,
): boolean {
  return boxes.length > 0 && boxes[0].id === id && isFirstLine;
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行 `pnpm vitest run src/modules/notes/boxes.test.ts`，预期 8 个用例全部 PASS。

---

### 任务 3：editor.ts Milkdown 编辑器工厂

**文件：**
- 新建：`src/modules/notes/editor.ts`

**接口：**
- 依赖输入：Milkdown 依赖已装（任务 1）。
- 对外产出（任务 4 依赖的精确签名）：
  - `type SplitResult = { before: string; after: string; isFirstLine: boolean }`
  - `interface NoteEditor { destroy(): Promise<void>; getMarkdown(): string; setMarkdown(md: string): void; focus(): void; splitAtCursor(): SplitResult | null; }`
  - `createNoteEditor(opts: { root: HTMLElement; initial: string; onMarkdownChange: (md: string) => void }): Promise<NoteEditor>`

- [ ] **步骤 1：编写编辑器工厂实现**

新建 `src/modules/notes/editor.ts`：
```ts
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
import { getMarkdown, replaceAll } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
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

const codeBlockLangPlugin = new Plugin({
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
});

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
    editor,
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
```

> 实现注意（非占位，均为具体动作）：若 `@milkdown/theme-nord/style.css` 导入路径报错，参考 `node_modules/@milkdown/theme-nord/package.json` 的 `exports` 字段确定 CSS 入口；若 `@milkdown/prose/state`、`@milkdown/prose/view` 或 `serializerCtx` 的导出名与 v7 不符，以 `milkdown.dev/docs` 对应页面为准微调导入名，不改动整体结构。

- [ ] **步骤 2：类型检查**

运行 `pnpm check`，预期通过；若 Milkdown 类型报错，按上面「实现注意」调整导入。

- [ ] **步骤 3：冒烟验证（在任务 4/5 完成后执行）**

创建一个含 ```js``` 代码块的框，确认代码按 JS 高亮、代码块顶部出现「js」标签；在多段落框中把光标放到第二段，确认 `splitAtCursor()` 返回 `isFirstLine` 为 `false`。

---

### 任务 4：NoteBox.tsx 单框组件

**文件：**
- 新建：`src/modules/notes/NoteBox.tsx`

**接口：**
- 依赖输入：任务 3 的 `createNoteEditor`/`NoteEditor`；任务 2 的 `Box`。
- 对外产出（任务 5 依赖）：
  - `interface NoteBoxProps { box: Box; focus?: () => boolean; onChange: (id: string, content: string) => void; onSplit: (id: string, before: string, after: string, isFirstLine: boolean) => void; onDelete: (id: string) => void; }`

- [ ] **步骤 1：实现 NoteBox**

新建 `src/modules/notes/NoteBox.tsx`：
```tsx
import { JSX, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createNoteEditor, NoteEditor } from './editor';
import { Box } from './boxes';

interface Props {
  box: Box;
  focus?: () => boolean;
  onChange: (id: string, content: string) => void;
  onSplit: (id: string, before: string, after: string, isFirstLine: boolean) => void;
  onDelete: (id: string) => void;
}

export default function NoteBox(props: Props): JSX.Element {
  let root!: HTMLDivElement;
  const [editor, setEditor] = createSignal<NoteEditor | null>(null);
  const [failed, setFailed] = createSignal(false);

  onMount(async () => {
    try {
      const ed = await createNoteEditor({
        root,
        initial: props.box.content,
        onMarkdownChange: (md) => props.onChange(props.box.id, md),
      });
      setEditor(ed);
    } catch (e) {
      console.error('NoteBox editor init failed:', e);
      setFailed(true);
    }
    root.addEventListener('keydown', handleKeyDown, true);
  });

  createEffect(() => {
    const ed = editor();
    if (props.focus?.() && ed) ed.focus();
  });

  onCleanup(() => {
    root.removeEventListener('keydown', handleKeyDown, true);
    editor()?.destroy();
  });

  function handleKeyDown(e: KeyboardEvent) {
    const ed = editor();
    if (!ed) return;
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const r = ed.splitAtCursor();
      if (r) props.onSplit(props.box.id, r.before, r.after, r.isFirstLine);
      return;
    }
    if (e.key === 'Backspace') {
      const md = ed.getMarkdown();
      if (md.trim() === '') {
        e.preventDefault();
        e.stopPropagation();
        props.onDelete(props.box.id);
      }
    }
  }

  return (
    <div class="notes-box" data-note-id={props.box.id}>
      <Show when={failed()} fallback={<div ref={root} />}>
        <pre class="notes-box-fallback text-sm whitespace-pre-wrap break-words">{props.box.content}</pre>
      </Show>
    </div>
  );
}
```

- [ ] **步骤 2：类型检查**

运行 `pnpm check`，预期通过。

---

### 任务 5：NotesPanel.tsx 面板（状态 + 持久化 + 聚焦）+ 样式收尾

**文件：**
- 修改：`src/modules/notes/NotesPanel.tsx`（替换占位实现）
- 修改：`src/app.css`（追加 Milkdown 块外观样式）

**接口：**
- 依赖输入：任务 2 的 `Box`/`newId`/`addOnTop`/`splitAtCursor`/`deleteEmpty`/`updateContent`/`isTopFirstLine`；任务 4 的 `NoteBox`。
- 对外产出：无（被 App.tsx 消费的组件本身）。

- [ ] **步骤 1：实现 NotesPanel**

用以下内容**覆盖** `src/modules/notes/NotesPanel.tsx`：
```tsx
import { JSX, createSignal, createEffect, onMount, For } from 'solid-js';
import NoteBox from './NoteBox';
import {
  Box,
  newId,
  addOnTop,
  splitAtCursor,
  deleteEmpty,
  updateContent,
  isTopFirstLine,
} from './boxes';

const CACHE_KEY = 'cache:notes:boxes';

interface Props {
  active?: boolean;
}

export default function NotesPanel(props: Props): JSX.Element {
  const [boxes, setBoxes] = createSignal<Box[]>([{ id: newId(), content: '' }]);
  const [focusId, setFocusId] = createSignal<string | null>(null);
  const [focusTick, setFocusTick] = createSignal(0);

  onMount(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Box[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBoxes(parsed.map((b) => ({ id: String(b.id), content: String(b.content ?? '') })));
        }
      } catch {
        /* 解析失败回退为单个空框 */
      }
    }
  });

  createEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(boxes()));
  });

  const requestFocus = (id: string | null) => {
    setFocusId(id);
    setFocusTick((t) => t + 1);
  };

  // 切换到本面板时聚焦最顶框（focusTick 自增保证每次激活都触发）
  createEffect(() => {
    if (props.active) requestFocus(boxes()[0]?.id ?? null);
  });

  const onChange = (id: string, content: string) => {
    setBoxes((prev) => updateContent(prev, id, content));
  };

  const onSplit = (id: string, before: string, after: string, isFirstLine: boolean) => {
    let target = id;
    setBoxes((prev) => {
      if (isTopFirstLine(prev, id, isFirstLine)) {
        target = newId();
        return addOnTop(prev, target);
      }
      return splitAtCursor(prev, id, before, after);
    });
    requestFocus(target);
  };

  const onDelete = (id: string) => {
    const prev = boxes();
    const idx = prev.findIndex((b) => b.id === id);
    const next = deleteEmpty(prev, id);
    if (next === prev) return;
    setBoxes(next);
    requestFocus(next[idx]?.id ?? next[idx - 1]?.id ?? null);
  };

  return (
    <div class="flex flex-col gap-2">
      <For each={boxes()}>
        {(box) => (
          <NoteBox
            box={box}
            focus={() => focusId() === box.id && focusTick() > 0}
            onChange={onChange}
            onSplit={onSplit}
            onDelete={onDelete}
          />
        )}
      </For>
    </div>
  );
}
```

- [ ] **步骤 2：追加 heynote 风格块样式**

在 `src/app.css` 末尾追加（先查看 `app.css` 顶部 `:root` 的实际变量名，把下面 `var(--color-*)` 回退值对齐到现有变量）：
```css
/* 笔记面板：heynote 风格块外观 */
.notes-box {
  border: 1px solid var(--color-border, rgba(255,255,255,0.12));
  border-radius: 8px;
  background: var(--color-surface-alt, rgba(255,255,255,0.04));
  padding: 6px 10px;
  min-height: 44px;
}
.notes-box .milkdown {
  min-height: 32px;
  outline: none;
}
.notes-box-fallback {
  color: var(--color-text-dim, rgba(255,255,255,0.55));
}
.milkdown-code-block-lang {
  display: inline-block;
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-dim, rgba(255,255,255,0.55));
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
  padding: 2px 6px;
  margin-right: 8px;
  user-select: none;
}
```

- [ ] **步骤 3：类型检查 + 单测**

运行 `pnpm check` 与 `pnpm test`，预期类型检查通过、`boxes.test.ts` 8 用例通过。

---

### 任务 6：整体冒烟验证与收尾

**文件：** 无新增（验证为主）

**接口：** 依赖任务 1–5 全部产物。

- [ ] **步骤 1：构建验证**

运行 `pnpm build`，预期 Vite 构建成功、无报错，产物 `dist/` 正常生成。

- [ ] **步骤 2：手工冒烟清单（`pnpm tauri dev` 中逐项验证）**

1. 「笔记」tab 存在，切换后自动聚焦最顶空框。
2. 输入 `# 标题` → 即时渲染为大标题（无原始 `#`）。
3. 输入 `- [ ] 待办` → 渲染为可勾选复选框，点击可切换勾选。
4. 输入 ```js``` 代码块 → 代码按 JS 高亮，顶部出现「js」标签。
5. 顶框第一行按 shift+enter → 顶部新增空框并聚焦。
6. 光标在非顶框（或顶框第二段）按 shift+enter → 该框在光标处切开为两框，聚焦上框。
7. 清空某框后按退格 → 该框被删除；非空框按退格只删字符、不删框；删到只剩一框时不再删除。
8. 中文 IME 连续输入不乱码、光标正常。
9. 重启应用 → 内容仍在（localStorage 持久化）。

- [ ] **步骤 3：确认验收标准**

对照规格 §11 的 7 条验收标准逐条核对，全部满足即完成。
