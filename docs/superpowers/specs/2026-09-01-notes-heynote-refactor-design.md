# 笔记面板重构（对齐 heynote）设计规格

- 日期：2026-09-01
- 状态：已评审待实现
- 分支/工作树：`feat/notes-panel`（`.worktrees/notes-panel`）
- 相关技能：superpower-brainstorming → 本规格；实现阶段转 writing-plans
- 上游来源：heynote（MIT 协议，https://github.com/heyman/heynote）

## 1. 目标与范围

将上一版基于 Milkdown 的「所见即所得 Markdown」笔记面板，**重构为对齐 heynote 的分块源码编辑器**：块级编辑、语言自动识别与语法高亮、数学块、多缓冲区标签、磁盘文件持久化、明暗主题、自动格式化。

本规格覆盖：编辑器核心移植（vendor heynote `src/editor`）、分块交互、语言识别、数学求值、自动格式化、多缓冲标签、Tauri fs 持久化、错误处理与测试。

### 1.1 范围内（已与用户确认）

1. **分块 CodeMirror 6 编辑器**：源码视图（输入 `# 标题` 显示 `# 标题`），非 WYSIWYG。
2. **语言自动识别**：粘贴/输入时自动判断块语言。
3. **语法高亮**：按块语言高亮（JS/TS/JSON/CSS/HTML/Python/Rust/Go/Shell/SQL/YAML/Markdown 等）。
4. **数学块**：块语言为 `math` 时用 Math.js 本地求值，结果内联显示。
5. **多缓冲区标签**：DevTool 面板内部二级标签条，增/删/改名/切换/重排。
6. **磁盘文件持久化**：Tauri fs，每缓冲一个 `.txt`，另存元数据索引。
7. **明暗主题**：跟随 DevTool 主题体系。
8. **自动格式化**：Prettier，粘贴自动格式化 + `Ctrl/Cmd+Shift+F` 手动；仅 Prettier 支持的语言。
9. **分块快捷键**：`Ctrl/Cmd+Enter` 分割块、块首退格合并（替换旧版 shift+enter/删空框逻辑）。
10. **形态**：作为 DevTool 顶部 TabBar 里的一个常驻面板（非独立窗口）。

### 1.2 非目标（YAGNI，明确排除）

搜索（单/多缓冲）、内联图片、拼写检查、多光标、货币换算、侧边缓冲区树、独立窗口/弹出、云同步、导出、全文搜索。以上均不做。

## 2. 技术选型

### 2.1 编辑器：vendor heynote `src/editor`（方案 1）

- **决策**：直接移植 heynote 的编辑器核心（`src/editor/`，CodeMirror 6 扩展集合），而非从零自研、也非整包嵌入其 webapp。
- **理由**：分块编辑（块边框、语言标签、分割/合并、跨块光标）是 heynote 经上千次提交打磨的核心，自研成本高且难保「完全一样」；其编辑器核心与 Vue 界面基本解耦，是移植成本最低的高保真路径。
- **裁剪**：仅引入范围内模块，剔除 `image/`、`search/`、`spell-check.js`、`crosshair-cursor.js`、`color-preview.js`、`fold-gutter.js`、`annotation.js`、`links.js`、`mark-mode.js`、`date-time.js`、`clipboard/`（图片粘贴）。裁剪时若保留模块依赖被剔除模块，以最小改动打补丁解耦并集中标注。
- **版权**：vendored 文件顶部保留 heynote MIT 版权注释；新增 `README` 记录来源 commit 与裁剪说明。

### 2.2 依赖

- 编辑器：`@codemirror/*`（heynote 依赖的 CodeMirror 6 生态）+ heynote 自带的语言语法包（Lezer grammars 等）。
- 数学：`mathjs`（块语言 `math` 本地求值）。
- 格式化：`prettier`（standalone，动态 import）。
- 语言识别：heynote `language-detection/` 的 Web Worker 方案（`langdetect-worker`）。
- 移除：`@milkdown/kit`、`@milkdown/plugin-prism`、`@milkdown/theme-nord` 等上一版依赖。

## 3. 架构与组件

```
src/modules/notes/
  heynote/                 # vendor 自 heynote src/editor（MIT，保留版权）
    block/                 # 分块模型 + 块装饰 + 分割/合并
    lang-heynote/          # 分块感知语言定义
    languages.js           # 语言表 + 语法高亮动态加载
    language-detection/    # 语言自动识别（Worker）
    editor.js              # HeynoteEditor 主类
    commands.js keymap.js  # 分块/格式化等快捷键
    setup.js               # 扩展装配
    theme/                 # 明暗主题
    math.js                # Math.js 求值
    save.js                # 块↔文本序列化（沿用 heynote 磁盘格式）
    close-brackets.js indentation.js todo-checkbox.ts
  NotesPanel.tsx           # 面板：缓冲列表状态 + 标签条 + 持久化 + 挂载编辑器
  NotesEditor.tsx          # 包装单个 HeynoteEditor 实例，随 active 缓冲 setBuffer
  buffers.ts               # 纯 reducer：add/rename/close/reorder/setActive
  buffers.test.ts
  files.ts                 # 前端持久化适配层（调 Tauri 命令）
```

**职责边界：**
- `heynote/` 是**隔离的 vendored 第三方代码**，外部仅通过 `NotesEditor.tsx` 单一适配层访问，不散落调用其内部 API。
- `buffers.ts` 是纯函数，只处理「缓冲列表结构」，不依赖 DOM/编辑器，可单测。
- `NotesPanel.tsx` 是唯一持有缓冲列表状态的组件。
- `files.ts` 只封装持久化 I/O，隔离 Tauri 命令。
- `NotesEditor.tsx` 只负责「编辑器实例生命周期 + 内容→文件 的防抖回写」。

## 4. 数据模型

```ts
interface BufferMeta { id: string; title: string }   // title 为空时取首行派生
```

- `buffers: BufferMeta[]`（顺序即标签条顺序）；`activeBufferId: string`。
- 编辑器内容存于 `HeynoteEditor` 的 `BufferState`（分块模型），**不进 Solid signal**——避免每次击键触发重渲染；仅「缓冲列表结构」走 signal。
- `id` 用 `crypto.randomUUID()`，作为 `.txt` 文件名，重命名只改 `title` 不动文件。
- 磁盘格式沿用 heynote 的块序列化（vendor `save.js`），块结构与语言可往返、与 heynote 文件互读。

## 5. 交互流程

### 5.1 分块

- `Ctrl/Cmd+Enter`：在光标处把当前块一分为二（上块保留原语言，下块语言自动识别）。
- `Backspace`：光标在块首时合并到上一块（heynote 语义，替换旧版「空框退格删除」）。

### 5.2 语言识别与高亮

- 粘贴/输入触发自动识别（Worker），识别失败回退为纯文本块。
- 每块顶部显示**语言标签**（heynote 式块装饰）。
- 语法高亮按块语言动态加载对应语法包。

### 5.3 自动格式化

- 粘贴：Prettier 支持的语言（JS/TS/JSX/TSX/JSON/CSS/HTML/Markdown/YAML 等）**粘贴即格式化**；其余语言仅高亮不格式化。
- 手动：`Ctrl/Cmd+Shift+F` 格式化当前块（仅 Prettier 支持语言，否则忽略）。

### 5.4 数学块

- 块语言设为 `math` 时，用 Math.js 本地求值表达式，结果以块装饰内联显示；求值异常静默降级为纯文本。

### 5.5 缓冲区管理

- `＋` 新建缓冲并激活；点标签切换（`setBuffer`）；`×` 或右键关闭；双击改名；拖拽/按钮重排（顺序写入索引）。

## 6. 持久化（Tauri fs）

- 目录：`appDataDir()/notes/`；每缓冲 `notes/<id>.txt`；`notes/index.json` 存 `{ buffers:[{id,title}], order, activeId }`。
- Rust 新增 `src-tauri/src/commands/notes.rs` 并注册：`notes_list` / `notes_read` / `notes_write` / `notes_delete` / `notes_read_index` / `notes_write_index`。用 `tauri::path().app_data_dir()` + `std::fs`。
- 写盘时机：击键防抖 **500ms**、切换缓冲、关闭应用（`onCleanup`/beforeunload 兜底）。
- 前端仅通过 `files.ts` 调命令，逻辑在 Rust（符合 CLAUDE.md 架构）。

## 7. 错误处理

- `index.json` 损坏 / 文件读取失败 → 回退为单个空缓冲，不崩溃。
- 编辑器初始化失败 → 面板降级为只读纯文本 `<textarea>` 兜底。
- 写盘失败（磁盘满/权限）→ Toast 提示，保留内存态不丢数据。
- 语言识别 / 格式化 / Math.js 异常 → 静默降级纯文本，不打断输入。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 语言语法包 + Prettier + Math.js 体积大，威胁 ≤8MB 安装包 | 语法包与 Prettier 动态 import 按需加载（heynote 同款）；Math.js 评估是否可用轻量子集 |
| vendored 代码与本项目 TS 风格差异 | 隔离在 `heynote/`，仅 `NotesEditor.tsx` 单一适配层访问 |
| 与上游 heynote 漂移 | 集中 vendor + 版权注释 + README 记录来源 commit，后续选择性跟进 |
| 分块跨块光标/合并边角 | 复用 heynote 原版 block 逻辑，不重造 |
| 中文 IME 输入 | 交给 CodeMirror 内置输入处理，不手写重渲染 |

## 9. 测试策略

- **Vitest 单测**：`buffers.ts` 纯 reducer —— add/rename/close/reorder/setActive 的正确性与不变式。
- **cargo test**：`notes.rs` 命令读写/删除/索引往返、路径越界防护。
- **手工冒烟**：分块分割/合并、语言识别、数学求值、粘贴格式化、多缓冲切换、重启持久化、明暗主题、中文 IME。
- e2e（Playwright）作为后续补充，非本次硬性门槛。

## 10. 验收标准

1. 「笔记」面板作为 DevTool 常驻 tab，切换不丢状态。
2. `Ctrl/Cmd+Enter` 分割块、块首退格合并，均符合 heynote 语义。
3. 粘贴代码/JSON 自动识别语言并高亮；Prettier 支持语言粘贴即格式化。
4. 每块显示语言标签；数学块表达式本地求值并内联显示结果。
5. `Ctrl/Cmd+Shift+F` 手动格式化当前块。
6. 多缓冲可新建/切换/改名/关闭/重排。
7. 重启应用后缓冲内容仍在（`appDataDir()/notes/*.txt`）。
8. 明暗主题切换正常。
