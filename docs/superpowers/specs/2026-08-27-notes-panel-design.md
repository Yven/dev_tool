# 笔记面板（自由文本 / Markdown WYSIWYG）设计规格

- 日期：2026-08-27
- 状态：已评审待实现
- 相关技能：superpower-brainstorming → 本规格；实现阶段转 writing-plans

## 1. 目标与范围

在 DevTool 新增一个内置面板「笔记」，提供一块**多文本框、栈式（最新在上）的 Markdown 所见即所得（WYSIWYG）编辑区**，用于快速记录零散想法/待办，并实时持久化。视觉与代码高亮对齐 [heynote](https://github.com/heyman/heynote) 的分块观感。

本规格覆盖：面板接入、编辑器引擎选型、多文本框数据模型、shift+enter 分割规则、退格删除规则、聚焦管理、localStorage 实时持久化、heynote 风格视觉、错误处理与测试。

非目标（YAGNI）：不做多笔记文档/多标签页、不做云同步、不做图片/附件、不做全文搜索、不做 heynote 的数学计算/自动格式化/多光标/语言自动分配、不做导出（可选后续再加）。

## 2. 需求规格（已与用户确认）

1. **WYSIWYG 渲染**：文本框内不显示原始 `#`、`**` 等标记；输入即时渲染为富文本。
2. **Markdown 支持**：标题、粗体/斜体、列表、引用、链接、分隔线、GFM 表格、删除线等常用语法；**任务列表 todo（`- [ ]` / `- [x]`）渲染为可勾选复选框**。
3. **代码高亮**：``` 围栏代码块内代码按语言语法高亮（Prism，常用语言）。
4. **shift+enter 建框/分割**：
   - 光标在**最顶框的第一行** → 在列表**最顶部**新建一个空框并聚焦（快速记录）。
   - 其余情况（顶框第二行及以后，或任意非顶框）→ 在**光标处**把当前框切开成两个框，聚焦**上框**（光标前文字）。
5. **最新在最上**：新建的框始终位于列表最顶部；列表顺序即「最新在上」。
6. **聚焦**：切换到本面板时，自动聚焦**最顶（最新）文本框**。
7. **直接编辑**：每个文本框都可直接点击进入编辑。
8. **删除**：不提供删除按钮；当框内容为空时按**退格键**删除该框；**至少保留一个框**。
9. **实时保存**：每次内容/结构变化实时写入 localStorage。
10. **分块外观对齐 heynote**：每个文本框呈现为独立的「块」（圆角、细边框、块间清晰分隔）；代码块顶部显示**语言名标签**（如 JavaScript / Python）。

## 3. 技术选型

### 3.1 WYSIWYG 编辑器引擎：Milkdown

- 采用 **Milkdown v7**（ProseMirror 系、markdown 原生）：
  - `@milkdown/kit`：核心 + CommonMark + GFM（含任务列表 task-list）+ 历史/剪贴板/缩进 + listener。
  - `@milkdown/plugin-prism`：Prism 代码高亮（轻量、同步，契合低内存目标）。
- **选型理由**：持久化目标是 markdown 源文本，WYSIWYG 需与源码保真往返；Milkdown 文档模型即 markdown AST，序列化/反序列化是一等公民，Prism 体积优于 Shiki。
- **代价**：JS bundle 增加约 300KB gzip 级（≤8MB 安装包目标内仍有富余）。
- **否决的备选**：
  - Tiptap：富文本优先，markdown 往返靠第三方 `tiptap-markdown`，保真度与体积略逊。
  - 手写 contenteditable + marked/highlight.js 重渲染：中文 IME 组合期间被重渲染打断、光标无法可靠保留，不可接受。
  - CodeMirror 源码编辑（heynote 原方案）：与「WYSIWYG 渲染」需求冲突，已明确不采用。

### 3.2 状态与持久化

- 状态用 Solid Signals（与现有面板一致，不引入外部 store）。
- 持久化用 localStorage（与 Random/Replace 面板一致），不新增 Tauri fs 逻辑。

### 3.3 与 heynote 对齐（借鉴 / 不借鉴）

**借鉴（视觉与显示）：**
- 每个文本框渲染为独立「块」：圆角、细边框、块间间距清晰（heynote 的 cell 观感）。
- 代码块顶部显示**语言名标签**；语言取自围栏信息串（```js）或自动识别。
- 代码高亮语言集对齐 heynote 常用开发语言：JS/TS/JSX/TSX、JSON、HTML/CSS、Python、Rust、Go、Java、Shell、SQL、YAML、Markdown 等。
- 交互上，「shift+enter 在光标处切开框」本身即 heynote「Ctrl+Enter 分割块」的语义，天然一致。

**不借鉴（明确排除，维持本规格）：**
- 不用 CodeMirror 源码编辑模型（保持 Milkdown WYSIWYG）。
- 不做单一线性缓冲区、多缓冲标签、搜索、数学/货币计算、自动格式化、多光标、文本块语言自动分配——均属 YAGNI。

**实现要点**：语言标签需自定义 Milkdown 代码块节点视图（或 CSS 定位），封装在 `editor.ts` 内，隔离于业务组件。

## 4. 架构与组件

```
src/modules/notes/
  NotesPanel.tsx   # 面板：boxes 状态 + 持久化 + 激活时聚焦 + 渲染列表
  NoteBox.tsx      # 单个 WYSIWYG 框：包一个编辑器实例、焦点、内容上抛
  editor.ts        # 编辑器工厂：创建/销毁 Milkdown 实例（prism + listener + 代码块语言标签视图）
  boxes.ts         # 纯状态转换(reducer)：addOnTop / splitAtCursor / deleteEmpty / 顺序不变式
```

`App.tsx` 改动：
- `BUILTIN_TABS` 新增 `{ id: 'notes', label: '笔记', icon: 'i-carbon-notebook' }`。
- 面板区新增 `<div style={{display: activeTab()==='notes'?'block':'none'}}><NotesPanel active={activeTab()==='notes'} /></div>`。
- `NotesPanel` 新增 `active: boolean` prop，用于「切到面板时聚焦最顶框」。

**职责边界**：
- `boxes.ts` 是**纯函数**，只处理「框的增删/分割/顺序」，不依赖 DOM，可单测。
- `NoteBox.tsx` 只负责「单个框的编辑器视图 + 焦点」，把内容以 markdown 字符串上抛。
- `NotesPanel.tsx` 是唯一持有 `boxes` 状态的组件，向下分发、向上收拢事件。
- `editor.ts` 封装 Milkdown 实例的创建/销毁与 markdown 同步，隔离第三方 API。

## 5. 数据模型

```ts
interface Box { id: string; content: string }   // content 为 markdown 源文本
```

- `boxes: Box[]`，**index 0 = 最顶 = 最新**。
- `content` 是 Milkdown 序列化出的 markdown 字符串，是「单一事实来源」；编辑器仅是视图，加载时用 `content` 初始化，变更时序列化回写。
- `id` 用 `crypto.randomUUID()`（或时间戳+随机后缀）生成。

## 6. 交互流程（精确规则）

### 6.1 shift+enter

判定函数 `shouldAddOnTop(boxes, activeBoxId, cursorLine)`：
- 若 `activeBoxId === boxes[0].id` 且光标在**第一行** → `addOnTop(boxes)`：在最前插入 `{ id, content: '' }`，聚焦新框。
- 否则 → `splitAtCursor(boxes, id, offset)`：把该框的 markdown 文本在光标字符偏移处切分为上/下两段，上框=光标前文本、下框=光标后文本，上框替换原位置、下框紧随其后，聚焦上框。

> 注意：「第一行」按 WYSIWYG 视觉行判断，需从编辑器拿到光标所在块/行号；实现时用 Milkdown/ProseMirror 的光标位置映射到 markdown 文本偏移，再按「文本到光标前是否含换行符」判定是否为第一行。

### 6.2 删除

- 监听框内的退格（Backspace）键：当该框 `content` 为空且光标在文首时触发 `deleteEmpty(boxes, id)`。
- 删除后：若仍有框，焦点移到被删框的**上方框**（无则下方框）；若列表将为空，则**忽略删除**（保留至少一个空框）。

### 6.3 聚焦

- `NotesPanel` 监听 `active` prop：由 false→true 时，聚焦 `boxes[0]` 对应编辑器的 DOM（requestAnimationFrame 后聚焦，规避容器刚由 display:none 转可见的布局时序）。

## 7. 持久化

- `onMount`：读 `localStorage['cache:notes:boxes']` → `JSON.parse` → 初始化 `boxes`（解析失败或为空则初始化单个空框）。
- `createEffect`：`boxes` 变化时 `localStorage.setItem('cache:notes:boxes', JSON.stringify(boxes))`。
- 内容级防抖可选：结构操作（增/删/分割）立即写，纯文本输入可由 Milkdown listener 的 markdown 更新节流（如 200ms）后回写，避免高频序列化。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| ProseMirror 在 `display:none` 容器内初始化/渲染异常 | 内容始终在 signal；编辑器视图在面板可见时创建/激活，隐藏时暂停或销毁重建，避免依赖隐藏容器布局 |
| 多实例内存/泄漏 | 框删除、面板隐藏时正确 `destroy()`；编辑器实例数=框数，单实例轻量 |
| Milkdown v7 API 更迭 | `editor.ts` 单点封装，隔离第三方 API，避免散落调用 |
| markdown 往返保真 | 仅存储 Milkdown 自身序列化结果，不手工改写；对不支持语法降级为纯文本 |
| 中文 IME 输入 | 交给 ProseMirror/Milkdown 内置输入处理，禁止手写 innerHTML 重渲染 |
| 代码块语言标签需自定义节点视图 | 在 `editor.ts` 内封装自定义 code-block 视图，隔离于业务组件 |

## 9. 错误处理

- localStorage 读取 `JSON.parse` 失败 → 回退为单个空框，不阻塞启动。
- 编辑器初始化失败 → 该框降级为只读纯文本 `<pre>` 展示，不崩溃整面板。
- 序列化异常 → 保留上一次已知好的 markdown，忽略本次坏数据。

## 10. 测试策略

- **Vitest 单测（重点）**：`boxes.ts` 纯 reducer —— `addOnTop` 插入位置、`splitAtCursor` 切分正确性、`deleteEmpty` 与「保留至少一框」、顺序不变式（最新在上）、`shouldAddOnTop` 的「顶框第一行 vs 其余」判定。不依赖 DOM。
- **手工冒烟**：中文 IME 连续输入、代码块高亮、代码块语言标签、todo 勾选、shift+enter 分割、退格删除、跨重启持久化、面板切换自动聚焦。
- e2e（可选）：Playwright 覆盖 happy path；因 Tauri + Milkdown 链路较重，作为后续补充而非硬性门槛。

## 11. 验收标准

1. 新「笔记」tab 出现并常驻挂载，切换不丢状态。
2. 输入 markdown 即时渲染；todo 可勾选；代码块高亮。
3. shift+enter 遵循 6.1 两条规则；新建框在最顶。
4. 切到面板自动聚焦最顶框。
5. 空框退格删除；非空不删；始终至少一框。
6. 重启应用后内容仍在（localStorage）。
7. 文本框呈块状外观；代码块顶部显示语言名标签。
