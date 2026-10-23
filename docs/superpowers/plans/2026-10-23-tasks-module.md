# 任务面板（Tasks）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 DevTool 中新增「任务」内置面板：多行输入按分类记录任务，支持四种状态、紧急标记、Markdown 内容与备注、按编辑时间与优先级排序、完成栏折叠、删除二次确认，数据落到本地 JSON。

**Architecture:** 前端用扁平 `Task[]` 存全部任务，所有排序/分组/变更集中在 `src/modules/tasks/model.ts` 的纯函数里；`TasksPanel` 持有唯一状态并在变更后整文件写回 `app_data/tasks/tasks.json`；Rust 侧新增 `tasks_read` / `tasks_write` / `tasks_confirm` 三个命令。Markdown 用 `marked` + `DOMPurify` 渲染，链接交给系统浏览器。

**Tech Stack:** Tauri v2 / Rust、SolidJS + TypeScript、UnoCSS、Vitest（jsdom）、marked、DOMPurify、tauri-plugin-opener。

**Spec:** `docs/superpowers/specs/2026-10-23-tasks-module-design.md`

## Global Constraints

- 不执行 `git add` / `git commit`（`CLAUDE.md` 明确禁止自动提交）；每个任务末尾的「检查点」只跑验证命令，是否提交由用户决定。
- 新增 UI 文案一律中文；颜色值必须逐字取自规格 §8 的表格。
- 除 `marked`、`dompurify` 外不新增任何 npm 运行时依赖；Rust 侧只新增 `tauri-plugin-opener`。
- 面板沿用 App.tsx 的「常驻挂载 + `display: none` 切换」模式，切换标签不丢状态。
- Rust 命令名与前端 `invoke` 字符串完全一致：`tasks_read`、`tasks_write`、`tasks_confirm`。
- 数据文件路径固定 `app_data/tasks/tasks.json`，内容 `{ "version": 1, "tasks": [...] }`。
- 所有命令在仓库根 `D:\work\dnmp\www\dev_tool` 执行；Windows 下用 `pnpm` / `cargo`。

## Review Focus

- 超长任务内容、深嵌套列表、宽代码块：卡片不得横向撑破面板，`word-break: break-word` 与 `pre { overflow-x: auto }` 必须生效。
- 仅含空白的备注保存：必须清除备注而不是留下空白行。
- 中文输入法组合中按 `Ctrl+Enter`：不得误提交（`e.isComposing` 判断）。
- 内容含 `<`、`>`、`&` 或粘贴的 HTML：必须按文本/Markdown 正常显示，不破坏卡片结构。
- `javascript:` 链接与 `<img onerror>`：必须被 DOMPurify 清洗，点击不执行、不导航 WebView。

---

### Task 1: Markdown 渲染工具

**Files:**
- Modify: `package.json`
- Create: `src/modules/tasks/markdown.ts`
- Test: `src/modules/tasks/markdown.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `renderMarkdown(text: string): string`（已清洗的 HTML 片段，空输入返回 `''`）；`escapeHtml(text: string): string`。

- [ ] **Step 1: 安装依赖**

```bash
pnpm add marked dompurify
```

预期：`package.json` 的 `dependencies` 出现 `marked`、`dompurify`。

- [ ] **Step 2: 写失败的测试**

创建 `src/modules/tasks/markdown.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { escapeHtml, renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('渲染粗体、行内代码、列表和链接', () => {
    const html = renderMarkdown('**重点** 和 `code`\n\n- a\n- b\n\n[链接](https://example.com)');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>a</li>');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('单个换行渲染为 <br>', () => {
    expect(renderMarkdown('a\nb')).toContain('a<br');
  });

  it('清洗 script 与事件属性', () => {
    const html = renderMarkdown('<script>alert(1)</script><img src=x onerror="alert(2)">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });

  it('移除 javascript: 链接', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('javascript:');
  });

  it('空白输入返回空串', () => {
    expect(renderMarkdown('   ')).toBe('');
  });

  it('escapeHtml 转义尖括号与引号', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run src/modules/tasks/markdown.test.ts`
Expected: FAIL，报 `Failed to resolve import "./markdown"`。

- [ ] **Step 4: 实现 `src/modules/tasks/markdown.ts`**

签名：

```ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function escapeHtml(text: string): string
export function renderMarkdown(text: string): string
```

要点：`marked.parse(text, { async: false, gfm: true, breaks: true })` 得到字符串后 `DOMPurify.sanitize(...)`；`trim()` 为空直接返回 `''`；`try/catch` 时返回 `escapeHtml(text).replace(/\n/g, '<br>')`；`escapeHtml` 至少转义 `& < > " '`。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/modules/tasks/markdown.test.ts`
Expected: PASS，6 个用例全绿。

- [ ] **Step 6: 检查点**

Run: `pnpm check`
Expected: 无 TypeScript 错误。

---

### Task 2: 数据模型与排序

**Files:**
- Create: `src/modules/tasks/model.ts`
- Test: `src/modules/tasks/model.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces（后续任务直接引用这些签名）：

```ts
export type TaskStatus = 'todo' | 'plan' | 'doing' | 'done';

export interface Task {
  id: string;
  category: string;
  content: string;
  status: TaskStatus;
  urgent: boolean;
  note: string;
  createdAt: number;
  editedAt: number;
}

export interface CategoryGroup {
  name: string;
  tasks: Task[];
  completed: Task[];
}

export const STATUS_META: Record<TaskStatus, { label: string; bg: string; border: string; dot: string }>;

export function parseTaskInput(text: string): { category: string; content: string } | null;
export function groupAndSort(tasks: Task[]): CategoryGroup[];
export function addTask(tasks: Task[], category: string, content: string, now: number): Task[];
export function setStatus(tasks: Task[], id: string, status: TaskStatus): Task[];
export function toggleUrgent(tasks: Task[], id: string): Task[];
export function updateContent(tasks: Task[], id: string, content: string, now: number): Task[];
export function updateNote(tasks: Task[], id: string, note: string): Task[];
export function removeTask(tasks: Task[], id: string): Task[];
export function parseTasksFile(raw: string | null): Task[];
export function serializeTasks(tasks: Task[]): string;
```

- [ ] **Step 1: 写失败的测试**

创建 `src/modules/tasks/model.test.ts`，至少覆盖：

```ts
import { describe, expect, it } from 'vitest';
import {
  addTask, groupAndSort, parseTaskInput, parseTasksFile, serializeTasks,
  setStatus, toggleUrgent, updateContent, updateNote, removeTask,
} from './model';

const base = { category: '工作', content: '写文档', status: 'todo' as const, urgent: false, note: '', createdAt: 1, editedAt: 1 };

describe('parseTaskInput', () => {
  it('两行以上拆出分类与内容', () => {
    expect(parseTaskInput('  工作\n第一行\n第二行  ')).toEqual({ category: '工作', content: '第一行\n第二行' });
  });
  it('CRLF 归一', () => {
    expect(parseTaskInput('工作\r\n内容')).toEqual({ category: '工作', content: '内容' });
  });
  it('单行或空内容返回 null', () => {
    expect(parseTaskInput('只有分类')).toBeNull();
    expect(parseTaskInput('分类\n   ')).toBeNull();
    expect(parseTaskInput('   \n内容')).toBeNull();
  });
});

describe('排序与分组', () => {
  it('done 进 completed，紧急分类置顶，doing 优先', () => { /* 构造 3 分类、5 任务断言顺序 */ });
  it('层内按 editedAt 倒序、同值按 createdAt/id 稳定', () => { /* ... */ });
  it('只剩完成的分类排最后', () => { /* ... */ });
});

describe('变更', () => {
  it('setStatus 改 done 时清除 urgent 并更新 editedAt', () => {});
  it('toggleUrgent 更新 editedAt；updateNote 不更新 editedAt', () => {});
  it('updateContent 更新 editedAt；removeTask 只删目标', () => {});
});

describe('文件解析', () => {
  it('损坏 JSON 返回空数组', () => {
    expect(parseTasksFile('{oops')).toEqual([]);
    expect(parseTasksFile(null)).toEqual([]);
  });
  it('丢弃非法条目、补齐缺省字段', () => {
    const raw = JSON.stringify({ version: 1, tasks: [
      { id: 'a', category: 'x', content: 'y' },
      { category: '', content: 'z' },
    ]});
    const out = parseTasksFile(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', status: 'todo', urgent: false, note: '' });
  });
  it('serialize 输出 version 1 与 tasks', () => {
    expect(JSON.parse(serializeTasks([]))).toEqual({ version: 1, tasks: [] });
  });
});
```

排序断言按规格 §5：分类三层（有未完成紧急 → 有未完成 → 只剩完成），层内 `max(editedAt)` 倒序，同值 `localeCompare('zh')`；任务三层（urgent → doing → 其余），层内 `editedAt` 倒序、`createdAt` 倒序、`id` 升序。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/modules/tasks/model.test.ts`
Expected: FAIL，`Failed to resolve import "./model"`。

- [ ] **Step 3: 实现 `src/modules/tasks/model.ts`**

`STATUS_META` 逐字使用规格 §8 的值（未开始 `rgba(100,116,139,.16)`；规划 `rgba(234,179,8,.13)`；进行中 `rgba(239,68,68,.13)`；完成 `rgba(34,197,94,.12)`，边框与圆点同表）。所有变更函数返回新数组、不改入参；`now` 由调用方传入以便测试。`parseTasksFile` 丢弃 `category`/`content` 为空或非字符串的条目，`status` 非四种之一时回落 `todo`，数值字段非有限数时用 `Date.now()`。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/modules/tasks/model.test.ts`
Expected: PASS。

- [ ] **Step 5: 检查点**

Run: `pnpm test && pnpm check`
Expected: 全绿。

---

### Task 3: Rust 命令与权限

**Files:**
- Create: `src-tauri/src/commands/tasks.rs`
- Modify: `src-tauri/src/commands/mod.rs`（加 `pub mod tasks;`）
- Modify: `src-tauri/src/lib.rs`（注册命令 + opener 插件）
- Modify: `src-tauri/Cargo.toml`（`tauri-plugin-opener = "2"`）
- Modify: `src-tauri/capabilities/default.json`（`"opener:default"`）

**Interfaces:**
- Consumes: 无。
- Produces: Tauri 命令 `tasks_read() -> Option<String>`、`tasks_write(json: String)`、`tasks_confirm(message: String) -> bool`。

- [ ] **Step 1: 实现 `src-tauri/src/commands/tasks.rs`**

参照 `src-tauri/src/commands/notes.rs` 的写法：

```rust
fn tasks_dir(app: &AppHandle) -> Result<PathBuf, String>  // app_data/tasks，create_dir_all

#[tauri::command]
pub fn tasks_read(app: AppHandle) -> Result<Option<String>, String>  // tasks.json 不存在返回 Ok(None)

#[tauri::command]
pub fn tasks_write(app: AppHandle, json: String) -> Result<(), String>

#[tauri::command]
pub async fn tasks_confirm(app: AppHandle, message: String) -> Result<bool, String>  // dialog Warning + OkCancel，title "DevTool"
```

- [ ] **Step 2: 注册命令与插件**

`commands/mod.rs` 加 `pub mod tasks;`；`lib.rs` 的 `generate_handler!` 尾部追加 `commands::tasks::tasks_read, commands::tasks::tasks_write, commands::tasks::tasks_confirm`；在 `.plugin(tauri_plugin_dialog::init())` 后加 `.plugin(tauri_plugin_opener::init())`。

- [ ] **Step 3: 依赖与权限**

`src-tauri/Cargo.toml` `[dependencies]` 加 `tauri-plugin-opener = "2"`；`src-tauri/capabilities/default.json` 的 `permissions` 加 `"opener:default"`。

- [ ] **Step 4: 编译验证**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: `Finished`，无 error（首次会拉取 opener crate）。

- [ ] **Step 5: 检查点**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: 通过（含 notes 既有单测）。

---

### Task 4: 存储封装、面板列表与状态切换

**Files:**
- Create: `src/modules/tasks/storage.ts`
- Create: `src/modules/tasks/TasksPanel.tsx`
- Create: `src/modules/tasks/TaskCard.tsx`
- Modify: `src/App.tsx`（import、`BUILTIN_TABS`、面板区）
- Modify: `src/App.css`（卡片基础样式，后续任务再补 `.task-md`）

**Interfaces:**
- Consumes: Task 2 的 `Task`、`TaskStatus`、`STATUS_META`、`parseTaskInput`、`groupAndSort`、`addTask`、`setStatus`、`parseTasksFile`、`serializeTasks`。
- Produces:

```ts
// storage.ts
export function readTasksFile(): Promise<string | null>;
export function writeTasksFile(json: string): Promise<void>;
export function confirmTaskDelete(message: string): Promise<boolean>;

// TaskCard.tsx
interface TaskCardProps {
  task: Task;
  onStatus: (id: string, status: TaskStatus) => void;
}
export default function TaskCard(props: TaskCardProps): JSX.Element;
```

- [ ] **Step 1: 实现 `storage.ts`**

三个函数分别 `invoke('tasks_read')` / `invoke('tasks_write', { json })` / `invoke('tasks_confirm', { message })`。

- [ ] **Step 2: 实现 `TasksPanel.tsx`**

结构：`input` 区（3 行 textarea，占位三行文案，右下角「Ctrl+Enter 添加」）→ 错误提示 → 按 `groupAndSort` 渲染分类区块 → 每块「分类名 + 未完成数」→ 任务卡列表 → `完成 (n)` 折叠栏。

状态与行为：
- `const [tasks, setTasks] = createSignal<Task[]>([])`、`const [ready, setReady] = createSignal(false)`、`const [input, setInput] = createSignal('')`、`const [error, setError] = createSignal('')`、`const [openDone, setOpenDone] = createSignal<Record<string, boolean>>({})`。
- `onMount`：`readTasksFile()` → `parseTasksFile` → `setTasks`，最后 `setReady(true)`；读取失败空列表 + `console.error`。
- `createEffect`：`ready()` 为真时 `void writeTasksFile(serializeTasks(tasks())).catch(() => showToast('任务保存失败', 'error'))`。
- 提交：`onKeyDown` 判断 `e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing` → `parseTaskInput(input())`；`null` 时 `setError('第一行填分类，第二行起填任务内容')`，否则 `setTasks(addTask(tasks(), category, content, Date.now()))`、清空输入与错误。
- 分组渲染用 `groups = () => groupAndSort(tasks())`；分类标题不可点击。
- 完成栏：`<button>` 显示 `完成 (n)`，点击切换 `openDone()[name]`；展开后渲染 `completed` 列表。

- [ ] **Step 3: 实现 `TaskCard.tsx`（本任务只做状态）**

布局：`[⚠️ 占位（后续任务补）] 内容  [状态按钮] [ ... 占位 ]`。内容先用 `white-space: pre-wrap` 纯文本（Markdown 在 Task 6 接入）。状态按钮：`STATUS_META[task.status].label`，`style={{ background: meta.bg, 'border-color': meta.border }}`；点击打开四项浮层，当前项 `dot` 高亮；选项点击调用 `onStatus`；点击外部 / `Esc` 关闭。卡片根 `class="task-card"`，`style={{ background: meta.bg, 'border-color': meta.border }}`。

- [ ] **Step 4: 接入 App.tsx**

- `import TasksPanel from './modules/tasks/TasksPanel';`
- `BUILTIN_TABS` 末尾加 `{ id: 'tasks', label: '任务', icon: 'i-carbon-task' }`。
- 面板区在 notes 之后加 `<div style={{ display: activeTab() === 'tasks' ? 'block' : 'none' }}><TasksPanel /></div>`。

- [ ] **Step 5: 补 `src/App.css` 基础样式**

`.task-card { border-width: 1px; border-style: solid; border-radius: 4px; padding: 8px 12px; }`、`.task-card + .task-card { margin-top: 6px }`、分类区块间距。颜色只来自行内 style，CSS 不写死状态色。

- [ ] **Step 6: 验证**

Run: `pnpm check && pnpm build`
Expected: 类型与构建通过；`pnpm tauri dev` 中新增「任务」标签，提交两行文本后卡片出现，状态切换后底色与文案变化。

---

### Task 5: 紧急标记与删除

**Files:**
- Modify: `src/modules/tasks/TaskCard.tsx`
- Modify: `src/modules/tasks/TasksPanel.tsx`

**Interfaces:**
- Consumes: Task 2 的 `toggleUrgent`、`removeTask`；Task 4 的 `confirmTaskDelete`。
- Produces: `TaskCardProps` 增加 `onUrgent: (id: string) => void`、`onDelete: (id: string) => void`。

- [ ] **Step 1: 紧急标记**

卡片最左按钮文案 `⚠️`，`class="task-urgent"`：
- 常态 `opacity: 0`；卡片 `:hover` 或按钮 `:focus-visible` 时 `opacity: 1`；`task.urgent` 为真时始终 `opacity: 1`。
- 点击调用 `onUrgent(task.id)`；`aria-label={task.urgent ? '取消紧急' : '标记紧急'}`。
- 紧急时卡片外层包一层 `<div class="task-urgent-ring">`：`border: 1px solid #ef4444; padding: 2px; border-radius: 5px;`，内层卡片保持自身状态色。

- [ ] **Step 2: `...` 菜单与删除**

卡片最右按钮 `...`，点击打开下拉（仅「删除」，红色）。点击删除：

```ts
const ok = await confirmTaskDelete('确定删除该任务？删除后不可恢复。');
if (ok) props.onDelete(props.task.id);
```

点击菜单外部 / `Esc` 关闭。`TasksPanel` 的 `onDelete` 调用 `setTasks(removeTask(tasks(), id))`。

- [ ] **Step 3: 验证**

Run: `pnpm check && pnpm test`
Expected: 通过。`pnpm tauri dev` 手工冒烟：悬停显示 ⚠️、点击后红边且内距 2px、删除弹原生确认框、取消不删。

---

### Task 6: 内容编辑 + Markdown 渲染 + 链接

**Files:**
- Modify: `src/modules/tasks/TaskCard.tsx`
- Modify: `src/modules/tasks/TasksPanel.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: Task 1 `renderMarkdown`；Task 2 `updateContent`；`@tauri-apps/plugin-opener` 的 `openUrl`。
- Produces: `TaskCardProps` 增加 `onContent: (id: string, content: string) => void`。

- [ ] **Step 1: 渲染 Markdown**

内容区改为 `<div class="task-md" innerHTML={renderMarkdown(props.task.content)} onclick={...} />`；双击该区域进入编辑。`TaskCard` 内维护 `const [editing, setEditing] = createSignal(false)` 与 `draft`。

- [ ] **Step 2: 就地编辑**

编辑态为 `<textarea class="task-edit">`，值为当前 `task.content` 原文：
- `Enter` 换行；`Ctrl+Enter`/`Cmd+Enter` 保存（`!e.isComposing`）；`Esc` 取消。
- 保存：`const v = draft().trim(); if (v) props.onContent(props.task.id, v); setEditing(false)`；空内容恢复原值。
- `autoFocus`，失焦不保存（避免误触）。

- [ ] **Step 3: 链接委托**

`TasksPanel` 根节点 `onClick` 委托：`const a = (e.target as HTMLElement).closest('a[href]');` 命中则 `e.preventDefault()`，`const href = a.getAttribute('href') ?? ''`，仅当 `/^https?:/i.test(href)` 时 `void openUrl(href)`（`import { openUrl } from '@tauri-apps/plugin-opener'`）。

- [ ] **Step 4: `.task-md` 样式（规格 §8.1）**

在 `src/App.css` 追加：`.task-md { font-size: 12px; word-break: break-word; }`、`.task-md h1..h6 { font-size: 1.05em; font-weight: 600; margin: .3em 0 }`、`.task-md p, .task-md ul, .task-md ol { margin: .25em 0 }`、`ul/ol { padding-left: 1.2em; list-style: revert }`、`code` 浅底圆角、`pre { overflow-x: auto }`、`blockquote` 左边框、`a` primary 色下划线、表格横向滚动。

- [ ] **Step 5: 验证**

Run: `pnpm check && pnpm test && pnpm build`
Expected: 通过；`pnpm tauri dev` 中粘贴 `**粗体**`、列表、链接验证渲染与跳转，含 `<` 文本正常显示，宽代码块不撑破卡片。

---

### Task 7: 备注

**Files:**
- Modify: `src/modules/tasks/TaskCard.tsx`
- Modify: `src/modules/tasks/TasksPanel.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: Task 2 `updateNote`；Task 1 `renderMarkdown`。
- Produces: `TaskCardProps` 增加 `onNote: (id: string, note: string) => void`。

- [ ] **Step 1: 展示**

内容下常显一行「备注 ✎」（`text-[11px] text-dim`）。已有备注时，正文在标记**下一行**：`<div class="task-note task-md" innerHTML={renderMarkdown(task.note)} />`，样式 `.task-note { font-size: 11px; color: var(--text-dim); line-height: 1.4; margin-top: 2px }`。

- [ ] **Step 2: 编辑**

点击「备注」行或 ✎ 进入编辑：`<textarea class="task-note-edit">` +「保存」「取消」：
- `Enter` 换行、`Ctrl+Enter` 保存、`Esc` 取消，均判断 `!e.isComposing`。
- 保存调用 `onNote(task.id, draft().trim())`；**不修改 `editedAt`**（由 `updateNote` 保证）。
- 空字符串即清除备注，展示行回到只有「备注 ✎」。

- [ ] **Step 3: 验证**

Run: `pnpm check && pnpm test && pnpm build`
Expected: 通过；手工验证备注小号灰字在标记下方、Markdown 生效、改备注后任务顺序不变。

---

### Task 8: 整体验证

**Files:** 无新增。

- [ ] **Step 1: 全量检查**

Run: `pnpm test && pnpm check && pnpm build`
Expected: Vitest 全绿、`tsc --noEmit` 无错、Vite 构建成功。

- [ ] **Step 2: Rust 检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml && cargo test --manifest-path src-tauri/Cargo.toml`
Expected: 通过。

- [ ] **Step 3: 手工冒烟（`pnpm tauri dev`）**

按规格 §12 的清单逐条确认：Ctrl+Enter 提交与 IME 不误触发；四色与文字对比；紧急红边内距 2px；完成栏默认折叠/可改回；备注层级；Markdown 与链接；删除二次确认；重启后数据仍在（`app_data/tasks/tasks.json`）。
