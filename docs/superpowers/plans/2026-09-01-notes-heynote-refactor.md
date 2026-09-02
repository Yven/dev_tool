# 笔记面板重构（对齐 heynote）实施计划

> **面向 Agent 执行者：** 必需子技能：使用 superpower-subagent-driven-development（推荐）或 superpower-executing-plans 按任务逐项执行本计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 把 DevTool「笔记」面板从 Milkdown WYSIWYG 重构为对齐 heynote 的分块源码编辑器：移植 heynote 的 CodeMirror 6 编辑器核心，支持块级编辑、语言自动识别、语法高亮、数学块、多缓冲区标签、磁盘文件持久化、明暗主题、Prettier 自动格式化。

**架构：** vendor heynote 的 `src/editor/*`（CodeMirror 6 扩展集合，隔离在 `src/modules/notes/heynote/`），仅经 `NotesEditor.tsx` 单一适配层访问；通过一个 `window.heynote` 垫片（buffer/platform）+ `window.math`（Math.js 实例）替代其 Electron/Pinia 依赖；缓冲区列表状态用 Solid signal 存于 `NotesPanel`，内容持久化走新增 Rust 命令 `notes_*`（`appDataDir()/notes/`，每缓冲一个 `.txt` + `index.json`）。

**技术栈：** SolidJS + TypeScript + UnoCSS + Vite + Tauri v2；CodeMirror 6（`@codemirror/*`）、`heynote-lang-mathjs` + `mathjs`（数学块）、`prettier`（格式化）、`debounce`/`semver`/`w3c-keyname`（heynote 依赖）。

**规格：** `docs/superpowers/specs/2026-09-01-notes-heynote-refactor-design.md`（执行者需同时阅读本计划与规格）

## 规格勘误（本计划以 heynote 真实行为为准，覆盖规格中相应表述）

1. **许可证**：heynote 的 `package.json` 声明为 `"Commons Clause MIT"`，非纯 MIT。vendor 时须保留其版权头，并在 README 中如实注明该许可证。
2. **格式化快捷键**：heynote 手动格式化是 `Alt+Shift+F`（`formatBlockContent`），不是 `Ctrl/Cmd+Shift+F`。本计划 vendor 其 keymap 原样，故用 `Alt+Shift+F`。
3. **分块快捷键**：`Ctrl/Cmd+Enter` 是「在当前块**之后**新增块」（`addNewBlockAfterCurrent`）；「在**光标处**分割」是 `Ctrl/Cmd+Alt+Enter`（`insertNewBlockAtCursor`）。
4. **语言标签**：heynote 不在块顶部显示语言标签，而是在**底部状态栏**显示当前块语言；块之间靠「12px 分隔 + 奇偶交替底色」区分。本计划加一个极简状态栏显示当前块语言。
5. **单缓冲搜索**：保留 `@codemirror/search` 提供的单编辑器搜索面板（`Mod-f`/`F3`），因其随依赖免费附带且属 heynote 体验；多缓冲库搜索（ripgrep）仍不做。

## 全局约束

- **工作目录**：`.worktrees/notes-panel`（分支 `feat/notes-panel`），所有命令、文件路径均相对该目录。
- **不执行 git 提交**（遵循 CLAUDE.md「不自动提交 git」）。本计划不设提交步骤。
- 状态用 Solid Signals，不引入外部 store；持久化走 Rust 命令 + `appDataDir()/notes/`。
- vendored heynote 代码（`src/modules/notes/heynote/`）外部仅经 `NotesEditor.tsx` 访问，不散落调用其内部 API。
- 源码获取渠道：`https://cdn.jsdelivr.net/gh/heyman/heynote@v2.9.1/<path>`（本机已确认可达；GitHub 直连被墙）。
- 复用现有约定：`invoke` 自 `@tauri-apps/api/core`；命令注册在 `src-tauri/src/lib.rs` 的 `generate_handler!`；命令模块声明在 `src-tauri/src/commands/mod.rs`。
- 项目无 `public/` 目录（本次新建）；`tsconfig.json` 需加 `allowJs` 以解析 vendored `.js`。

---

### 任务 1：切换依赖 + tsconfig 放行 vendored JS

**文件：**
- 修改：`package.json`（经 pnpm，不手写）
- 修改：`tsconfig.json`

**接口：** 依赖输入：无。对外产出：后续所有任务的 CodeMirror/prettier/mathjs 依赖 + JS 模块可被 tsc 解析。

- [ ] **步骤 1：移除 Milkdown 依赖**

```bash
pnpm remove @milkdown/kit @milkdown/plugin-prism @milkdown/theme-nord
```

- [ ] **步骤 2：安装 CodeMirror / prettier / mathjs 等依赖**

```bash
pnpm add @codemirror/state @codemirror/view @codemirror/commands @codemirror/language @codemirror/autocomplete @codemirror/lint @codemirror/search @codemirror/lang-json @codemirror/lang-python @codemirror/lang-javascript @codemirror/lang-html @codemirror/lang-sql @codemirror/lang-markdown @codemirror/lang-java @codemirror/lang-lezer @codemirror/lang-php @codemirror/lang-css @codemirror/lang-cpp @codemirror/lang-xml @codemirror/lang-rust @codemirror/lang-vue @codemirror/legacy-modes @replit/codemirror-lang-csharp codemirror-lang-elixir codemirror-lang-mermaid @lezer/common @lezer/highlight @lezer/markdown prettier heynote-lang-mathjs mathjs debounce semver w3c-keyname
```

预期：`package.json` 的 `dependencies` 出现上述包；`@milkdown/*` 消失。

- [ ] **步骤 3：tsconfig 放行 vendored JS**

在 `tsconfig.json` 的 `compilerOptions` 中新增 `"allowJs": true`（`checkJs` 保持默认 false，即不校验 `.js` 内部，仅用于模块解析）：

```json
{
  "compilerOptions": {
    "allowJs": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "paths": { "~/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **步骤 4：验证**

运行 `pnpm install`（确保 lockfile 更新）与 `pnpm check`，预期 `tsc --noEmit` 无新增错误（当前旧 Milkdown 代码已删依赖，会在任务 9 一并清理类型错误）。

---

### 任务 2：vendor heynote 编辑器核心

**文件：**
- 新建：`src/modules/notes/heynote/**`（41 个文件，见脚本）
- 新建：`src/modules/notes/heynote/README.md`（来源与许可证说明）
- 新建：`public/langdetect-worker.js`、`public/guesslang.min.js`

**接口：** 依赖输入：任务 1 依赖。对外产出：`heynote/editor.js` 的 `HeynoteEditor` 类（任务 7 消费）、其余模块（任务 3 适配）。

- [ ] **步骤 1：下载 41 个文件**

在 `.worktrees/notes-panel` 根目录执行以下 PowerShell（jsdelivr 可达，逐文件落盘到对应路径）：

```powershell
$ErrorActionPreference = 'Stop'
$base = 'https://cdn.jsdelivr.net/gh/heyman/heynote@v2.9.1'
$map = @{
  'src/editor/annotation.js' = 'src/modules/notes/heynote/annotation.js'
  'src/editor/close-brackets.js' = 'src/modules/notes/heynote/close-brackets.js'
  'src/editor/commands.js' = 'src/modules/notes/heynote/commands.js'
  'src/editor/editor.js' = 'src/modules/notes/heynote/editor.js'
  'src/editor/indentation.js' = 'src/modules/notes/heynote/indentation.js'
  'src/editor/keymap.js' = 'src/modules/notes/heynote/keymap.js'
  'src/editor/languages.js' = 'src/modules/notes/heynote/languages.js'
  'src/editor/save.js' = 'src/modules/notes/heynote/save.js'
  'src/editor/setup.js' = 'src/modules/notes/heynote/setup.js'
  'src/editor/todo-checkbox.ts' = 'src/modules/notes/heynote/todo-checkbox.ts'
  'src/editor/scroll-margin.js' = 'src/modules/notes/heynote/scroll-margin.js'
  'src/editor/date-time.js' = 'src/modules/notes/heynote/date-time.js'
  'src/editor/fold-gutter.js' = 'src/modules/notes/heynote/fold-gutter.js'
  'src/editor/mark-mode.js' = 'src/modules/notes/heynote/mark-mode.js'
  'src/editor/block/block.js' = 'src/modules/notes/heynote/block/block.js'
  'src/editor/block/block-parsing.js' = 'src/modules/notes/heynote/block/block-parsing.js'
  'src/editor/block/commands.js' = 'src/modules/notes/heynote/block/commands.js'
  'src/editor/block/format-code.js' = 'src/modules/notes/heynote/block/format-code.js'
  'src/editor/block/math.js' = 'src/modules/notes/heynote/block/math.js'
  'src/editor/block/move-lines.js' = 'src/modules/notes/heynote/block/move-lines.js'
  'src/editor/block/select-all.js' = 'src/modules/notes/heynote/block/select-all.js'
  'src/editor/block/delete-line.js' = 'src/modules/notes/heynote/block/delete-line.js'
  'src/editor/block/transpose-chars.js' = 'src/modules/notes/heynote/block/transpose-chars.js'
  'src/editor/clipboard/copy-paste.js' = 'src/modules/notes/heynote/clipboard/copy-paste.js'
  'src/editor/clipboard/drag-drop.js' = 'src/modules/notes/heynote/clipboard/drag-drop.js'
  'src/editor/lang-heynote/external-tokens.js' = 'src/modules/notes/heynote/lang-heynote/external-tokens.js'
  'src/editor/lang-heynote/heynote.js' = 'src/modules/notes/heynote/lang-heynote/heynote.js'
  'src/editor/lang-heynote/nested-parser.js' = 'src/modules/notes/heynote/lang-heynote/nested-parser.js'
  'src/editor/lang-heynote/parser.js' = 'src/modules/notes/heynote/lang-heynote/parser.js'
  'src/editor/lang-heynote/parser.terms.js' = 'src/modules/notes/heynote/lang-heynote/parser.terms.js'
  'src/editor/language-detection/autodetect.js' = 'src/modules/notes/heynote/language-detection/autodetect.js'
  'src/editor/language-detection/levenshtein.js' = 'src/modules/notes/heynote/language-detection/levenshtein.js'
  'src/editor/search/selection-match.js' = 'src/modules/notes/heynote/search/selection-match.js'
  'src/editor/theme/base.js' = 'src/modules/notes/heynote/theme/base.js'
  'src/editor/theme/light.js' = 'src/modules/notes/heynote/theme/light.js'
  'src/editor/theme/dark.js' = 'src/modules/notes/heynote/theme/dark.js'
  'src/editor/theme/font-theme.js' = 'src/modules/notes/heynote/theme/font-theme.js'
  'src/common/note-format.js' = 'src/modules/notes/heynote/common/note-format.js'
  'src/common/constants.js' = 'src/modules/notes/heynote/common/constants.js'
  'public/langdetect-worker.js' = 'public/langdetect-worker.js'
  'public/guesslang.min.js' = 'public/guesslang.min.js'
}
foreach ($k in $map.Keys) {
  $dest = $map[$k]
  $dir = Split-Path $dest -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$k" -OutFile $dest -TimeoutSec 30
  Write-Output "OK $dest"
}
```

- [ ] **步骤 2：写入来源与许可证说明**

新建 `src/modules/notes/heynote/README.md`：

```markdown
# vendored from heynote

- 来源：https://github.com/heyman/heynote （tag v2.9.1，commit c301e42）
- 许可证：Commons Clause MIT（见 heynote 仓库 LICENSE，非纯 MIT）
- 裁剪：已剔除 image/、search/search.js、spell-check.js、crosshair-cursor.js、color-preview.js、links.js；保留 search/selection-match.js。
- 适配：见本目录各文件内 `// [DEVTool]` 注释标记的改动点（任务 3 完成）。
```

- [ ] **步骤 3：验证**

运行 `Get-ChildItem -Recurse src/modules/notes/heynote | Measure-Object`，预期 39 个文件；`public/` 下存在 2 个文件。

---

### 任务 3：适配 heynote 编辑器核心的耦合点

**文件：**
- 修改：`src/modules/notes/heynote/editor.js`
- 修改：`src/modules/notes/heynote/commands.js`
- 修改：`src/modules/notes/heynote/keymap.js`
- 修改：`src/modules/notes/heynote/setup.js`
- 修改：`src/modules/notes/heynote/block/block.js`
- 修改：`src/modules/notes/heynote/block/math.js`
- 修改：`src/modules/notes/heynote/lang-heynote/heynote.js`
- 修改：`src/modules/notes/heynote/clipboard/drag-drop.js`
- 修改：`src/modules/notes/heynote/common/constants.js`

**接口：** 依赖输入：任务 2 的文件。对外产出：可被 `NotesEditor.tsx` 以「无 Pinia / 无 Electron / 无图片」方式实例化的 `HeynoteEditor`。

> 说明：以下每处改动都附加 `// [DEVTool]` 注释标记，便于与上游 diff 对齐。`window.heynote.buffer/platform` 与 `window.math` 由任务 7 的垫片在实例化前注入，故编辑器内的这些引用**无需改**。

- [ ] **步骤 1：editor.js —— 去掉 Pinia store、图片/搜索/拼写/色彩/链接**

① 删除这些 import 行：

```js
import { imageExtension } from "./image/image.js"
import { links } from "./links.js"
import { colorPreviewExtension } from "./color-preview.js"
import { useHeynoteStore } from "../stores/heynote-store.js";
import { useErrorStore } from "../stores/error-store.js";
import { heynoteSearch } from "./search/search.js"
import { spellcheckConfig } from "./spell-check.js"
```

② 改两条 common 路径：

```js
import { NoteFormat } from "../common/note-format.js"
import { AUTO_SAVE_INTERVAL } from "../common/constants.js"
```
→
```js
import { NoteFormat } from "./common/note-format.js"
import { AUTO_SAVE_INTERVAL } from "./common/constants.js"
```

③ 删除构造器里两行：

```js
        this.notesStore = useHeynoteStore()
        this.errorStore = useErrorStore()
```

④ 扩展数组里删除这些行（`extensions: [...]` 内）：

```js
                heynoteSearch,
                imageExtension(),
                links,
                this.colorPreviewCompartment.of(colorPreviewEnabled ? colorPreviewExtension : []),
                this.spellcheckCompartment.of(spellcheckConfig(this.spellcheckEnabled)),
```

⑤ `setContent()` 里：

```js
            this.errorStore.addError(`Failed to load note: ${e.message}`)
```
→
```js
            console.error(`Failed to load note: ${e.message}`) // [DEVTool]
```

⑥ 删除整段方法 `createNewBuffer(path, name)` 与 `createNewBufferFromActiveBlock(path, name)`（引用 `this.notesStore`，我们自行管理缓冲区）。

⑦ 删除整段方法 `setSpellcheckEnabled(enabled)` 与 `setColorPreviewEnabled(enabled)`（引用已删 import）。

⑧ 在 `setContent(content)` 方法之后，新增 `setBuffer` 方法（供任务 7 切缓冲）：

```js
    async setBuffer(path, name) { // [DEVTool]
        await this.save()
        if (this.onChange) {
            window.heynote.buffer.removeOnChangeCallback(this.path, this.onChange)
        }
        this.path = path
        this.name = name
        await this.loadContent()
    }
```

- [ ] **步骤 2：commands.js —— 去掉 store/拼写/侧栏/标签命令**

① 删除这些 import：

```js
import { useHeynoteStore } from "../stores/heynote-store.js";
import { useSettingsStore } from "../stores/settings-store.js"
import { toggleSpellcheck, enableSpellcheck, disableSpellcheck } from "./spell-check.js"
```

② 删除整段定义：`openLanguageSelector`、`openBufferSelector`、`openCommandPalette`、`openMoveToBuffer`、`openCreateNewBuffer`、`closeCurrentTab`、`reopenLastClosedTab`、`switchToLastTab`、`nextTab`、`previousTab`、`toggleAlwaysOnTop`、`toggleLeftPanel`、`openBufferExplorer`、`openLibrarySearch`。

③ 在 `HEYNOTE_COMMANDS` 对象里删除这些键：`openLanguageSelector`、`openBufferSelector`、`openCommandPalette`、`openMoveToBuffer`、`openCreateNewBuffer`、`toggleLeftPanel`、`openBufferExplorer`、`openLibrarySearch`、`closeCurrentTab`、`reopenLastClosedTab`、`switchToLastTab`、`previousTab`、`nextTab`、`toggleSpellcheck`、`enableSpellcheck`、`disableSpellcheck`、`toggleAlwaysOnTop`，以及生成 `switchToTab1..9` 的 `...Object.fromEntries(...)` 整段展开。

- [ ] **步骤 3：keymap.js —— 去掉平台探测与已删命令的绑定**

① 替换顶部平台探测：

```js
const isMac = window.heynote.platform.isMac
const isLinux = window.heynote.platform.isLinux
const isWindows = window.heynote.platform.isWindows
```
→
```js
const isMac = window.heynote?.platform?.isMac ?? false // [DEVTool]
const isLinux = window.heynote?.platform?.isLinux ?? false
const isWindows = window.heynote?.platform?.isWindows ?? true
```

② 在 `DEFAULT_KEYMAP` 数组里删除以下绑定行（命令已在步骤 2 删除）：

```js
    cmd("Mod-p", "openBufferSelector"),
    cmd("Mod-Shift-p", "openCommandPalette"),
    cmd("Mod-s", "openMoveToBuffer"),
    cmd("Mod-n", "openCreateNewBuffer"),
    cmd("Mod-w", "closeCurrentTab"),
    cmd("Mod-Shift-t", "reopenLastClosedTab"),
    cmd("Ctrl-Tab", "nextTab"),
    cmd("Ctrl-Shift-Tab", "previousTab"),
    cmd("Mod-1", "switchToTab1"),
    cmd("Mod-2", "switchToTab2"),
    cmd("Mod-3", "switchToTab3"),
    cmd("Mod-4", "switchToTab4"),
    cmd("Mod-5", "switchToTab5"),
    cmd("Mod-6", "switchToTab6"),
    cmd("Mod-7", "switchToTab7"),
    cmd("Mod-8", "switchToTab8"),
    cmd("Mod-9", "switchToTab9"),
    cmd("Mod-0", "switchToLastTab"),
    cmd("Mod-Shift-s", "toggleLeftPanel"),
    cmd("Mod-Shift-e", "openBufferExplorer"),
    cmd("Mod-Shift-f", "openLibrarySearch"),
    cmd("Mod-l", "openLanguageSelector"),
```

（保留 `cmd("Alt-Shift-f", "formatBlockContent")`、`cmd("Mod-Enter", "addNewBlockAfterCurrent")`、`cmd("Mod-Alt-Enter", "insertNewBlockAtCursor")` 等编辑器命令绑定。）

- [ ] **步骤 4：setup.js —— 用标准 crosshairCursor 替换自定义版**

删除 import 行：

```js
import { crosshairCursor as customCrosshairCursor} from "./crosshair-cursor.js"
```

并在 `customSetup` 数组内把：

```js
    customCrosshairCursor({
        eventFilter: e => e.altKey && e.shiftKey
    }),
```
→
```js
    crosshairCursor(),
```

（`crosshairCursor` 已在文件顶部的 `@codemirror/view` import 中。）

- [ ] **步骤 5：block/block.js —— 去掉 Pinia，改回调**

① 删除 import：

```js
import { useHeynoteStore } from "../../stores/heynote-store.js"
```

② `emitCursorChange` 里，删除 `const heynoteStore = useHeynoteStore()` 一行，并把 `update(update)` 内的：

```js
                    const block = getActiveNoteBlock(update.state)
                    if (block && cursorLine) {
                        heynoteStore.currentCursorLine = cursorLine
                        heynoteStore.currentSelectionSize = selectionSize
                        heynoteStore.currentLanguage = block.language.name
                        heynoteStore.currentLanguageAuto = block.language.auto
                        heynoteStore.currentBufferName = editor.name
                        heynoteStore.currentCreatedTime = block.created ? new Date(Date.parse(block.created)) : null
                    }
```
→
```js
                    const block = getActiveNoteBlock(update.state)
                    if (block && cursorLine) { // [DEVTool] 状态栏回调
                        const cb = window.__heynoteOnCursorChange
                        if (cb) cb({
                            line: cursorLine,
                            selectionSize,
                            language: block.language.name,
                            auto: block.language.auto,
                            name: editor.name,
                            created: block.created ? new Date(Date.parse(block.created)) : null,
                        })
                    }
```

- [ ] **步骤 6：block/math.js —— 用导入的 mathjs 替换 window.math**

① 在文件顶部新增 import：

```js
import { create, all } from "mathjs" // [DEVTool]
const math = create(all)
```

② 把 `window.math.parser()` 与 `window.math.format(...)` 两处分别改为 `math.parser()` 与 `math.format(...)`（即删除 `window.` 前缀；`math.format` 两处、`math.parser` 一处）。

- [ ] **步骤 7：lang-heynote/heynote.js —— 修路径别名**

```js
import { FOLD_LABEL_LENGTH } from "@/src/common/constants.js"
```
→
```js
import { FOLD_LABEL_LENGTH } from "../common/constants.js"
```

- [ ] **步骤 8：clipboard/drag-drop.js —— 去掉图片粘贴**

删除 import `import { createImageTag } from "../image/image-parsing.js"`、整段 `buildImageTagFromFile`、`insertImageTags`，并把 `heynoteDropPaste` 简化为仅处理纯文本拖放：

```js
export const heynoteDropPaste = () => { // [DEVTool] 仅文本
    const handleDrop = (event, view) => {
        const text = event.dataTransfer?.getData("text/plain")
        if (!text || view.state.readOnly) return false
        event.preventDefault()
        event.stopPropagation()
        view.focus()
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            ?? view.state.selection.main.head
        view.dispatch(view.state.replaceSelection(text))
        return true
    }
    const handleDragOver = (event) => {
        if (!event.dataTransfer?.getData("text/plain")) return false
        event.preventDefault()
        return true
    }
    return EditorView.domEventHandlers({ dragover: handleDragOver, drop: handleDrop })
}
```

- [ ] **步骤 9：common/constants.js —— 自动保存间隔改为 500ms**

把 `export const AUTO_SAVE_INTERVAL = 2000` 改为 `export const AUTO_SAVE_INTERVAL = 500`（其余常量保留，未用到也无害）。

- [ ] **步骤 10：验证无残留越界引用**

```powershell
grep -rnE "from \"(\.\./)+stores|from \"\.\./\.\./stores|window\.heynote\.(buffer|platform)|@/src|image/image|search/search|spell-check|color-preview|crosshair|\.\./image" src/modules/notes/heynote --include=*.js --include=*.ts
```

预期：仅 `editor.js`/`keymap.js`/`block/block.js` 中保留 `window.heynote.buffer/platform`（由垫片提供）与 `window.__heynoteOnCursorChange`（任务 7/8 注入）；无 `../stores`、`@/src`、`image/image`、`search/search`、`spell-check`、`color-preview`、`crosshair` 命中。若有其它命中，逐个按本任务同款方式解耦并加 `// [DEVTool]` 注释。

---

### 任务 4：Rust 持久化命令（TDD）

**文件：**
- 新建：`src-tauri/src/commands/notes.rs`
- 修改：`src-tauri/src/commands/mod.rs`
- 修改：`src-tauri/src/lib.rs`

**接口：** 依赖输入：无。对外产出（任务 6 依赖，前端 invoke 名）：
- `notes_read_index() -> Result<Option<String>, String>`
- `notes_write_index(json: String) -> Result<(), String>`
- `notes_read(path: String) -> Result<String, String>`
- `notes_write(path: String, content: String) -> Result<(), String>`
- `notes_delete(path: String) -> Result<(), String>`

- [ ] **步骤 1：编写失败测试**

在 `src-tauri/src/commands/notes.rs` 先写实现骨架与测试（步骤 3 补全纯函数，先让测试因缺少实现而失败）：

```rust
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

fn notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data.join("notes");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn resolve_note_path(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    if p.components().count() != 1 {
        return Err("invalid note path".to_string());
    }
    let name = p
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "invalid note path".to_string())?;
    validate_note_name(name)?;
    Ok(notes_dir(app)?.join(name))
}

#[tauri::command]
pub fn notes_read_index(app: AppHandle) -> Result<Option<String>, String> {
    let path = notes_dir(&app)?.join("index.json");
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notes_write_index(app: AppHandle, json: String) -> Result<(), String> {
    let path = notes_dir(&app)?.join("index.json");
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notes_read(app: AppHandle, path: String) -> Result<String, String> {
    let p = resolve_note_path(&app, &path)?;
    if !p.exists() {
        return Err(format!("note not found: {}", path));
    }
    fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notes_write(app: AppHandle, path: String, content: String) -> Result<(), String> {
    let p = resolve_note_path(&app, &path)?;
    fs::write(&p, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notes_delete(app: AppHandle, path: String) -> Result<(), String> {
    let p = resolve_note_path(&app, &path)?;
    if p.exists() {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_traversal() {
        assert!(validate_note_name("../x.txt").is_err());
        assert!(validate_note_name("a/b.txt").is_err());
        assert!(validate_note_name("..\\x.txt").is_err());
        assert!(validate_note_name("ok.txt").is_ok());
        assert!(validate_note_name("").is_err());
    }
}
```

- [ ] **步骤 2：运行并确认失败**

运行 `cargo test notes`，预期编译错误（`validate_note_name` 未定义）。

- [ ] **步骤 3：补全纯函数，让测试通过**

在 `resolve_note_path` 之前新增：

```rust
fn validate_note_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err("invalid note path".to_string());
    }
    Ok(())
}
```

- [ ] **步骤 4：运行并确认通过**

运行 `cargo test notes`，预期 PASS。

- [ ] **步骤 5：注册模块与命令**

`src-tauri/src/commands/mod.rs` 追加 `pub mod notes;`。

`src-tauri/src/lib.rs` 的 `generate_handler![...]` 追加：

```rust
            commands::notes::notes_read_index,
            commands::notes::notes_write_index,
            commands::notes::notes_read,
            commands::notes::notes_write,
            commands::notes::notes_delete,
```

- [ ] **步骤 6：验证**

运行 `cargo test`，预期全部 PASS。

---

### 任务 5：buffers.ts 纯 reducer（TDD）

**文件：**
- 新建：`src/modules/notes/buffers.ts`
- 测试：`src/modules/notes/buffers.test.ts`

**接口：** 依赖输入：无。对外产出（任务 6/8 依赖）：
- `interface BufferMeta { id: string; title: string }`
- `interface NotesIndex { buffers: BufferMeta[]; activeId: string }`
- `newId(): string`
- `defaultIndex(): NotesIndex`
- `parseIndex(json: string): NotesIndex`
- `addBuffer(index): NotesIndex`
- `renameBuffer(index, id, title): NotesIndex`
- `closeBuffer(index, id): NotesIndex`
- `moveBuffer(index, id, toIndex): NotesIndex`
- `setActive(index, id): NotesIndex`

- [ ] **步骤 1：编写失败的测试**

新建 `src/modules/notes/buffers.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import {
  defaultIndex, parseIndex, addBuffer, renameBuffer, closeBuffer, moveBuffer, setActive,
} from './buffers';

const idx = (buffers: { id: string; title: string }[], activeId: string) => ({ buffers, activeId });

describe('buffers reducer', () => {
  it('parseIndex 还原合法数据', () => {
    const parsed = parseIndex(JSON.stringify(idx([{ id: 'a', title: 'x' }, { id: 'b', title: '' }], 'b')));
    expect(parsed.buffers.map((b) => b.id)).toEqual(['a', 'b']);
    expect(parsed.activeId).toBe('b');
  });

  it('parseIndex 对损坏数据回退为单缓冲', () => {
    const parsed = parseIndex('{bad json');
    expect(parsed.buffers.length).toBe(1);
  });

  it('parseIndex 对无 activeId 取首个缓冲', () => {
    const parsed = parseIndex(JSON.stringify({ buffers: [{ id: 'a', title: '' }] }));
    expect(parsed.activeId).toBe('a');
  });

  it('addBuffer 追加并激活新缓冲', () => {
    const next = addBuffer(idx([{ id: 'a', title: '' }], 'a'));
    expect(next.buffers.length).toBe(2);
    expect(next.activeId).toBe(next.buffers[1].id);
  });

  it('renameBuffer 按 id 更新 title', () => {
    const next = renameBuffer(idx([{ id: 'a', title: 'old' }], 'a'), 'a', 'new');
    expect(next.buffers[0].title).toBe('new');
  });

  it('closeBuffer 删除并修正 active（删非 active 不变）', () => {
    const base = idx([{ id: 'a', title: '' }, { id: 'b', title: '' }], 'a');
    expect(closeBuffer(base, 'b').buffers.map((b) => b.id)).toEqual(['a']);
    expect(closeBuffer(base, 'b').activeId).toBe('a');
  });

  it('closeBuffer 删除 active 时切到前一个', () => {
    const base = idx([{ id: 'a', title: '' }, { id: 'b', title: '' }], 'b');
    const next = closeBuffer(base, 'b');
    expect(next.buffers.map((b) => b.id)).toEqual(['a']);
    expect(next.activeId).toBe('a');
  });

  it('closeBuffer 至少保留一个缓冲', () => {
    const base = idx([{ id: 'a', title: '' }], 'a');
    expect(closeBuffer(base, 'a')).toEqual(base);
  });

  it('moveBuffer 重排', () => {
    const base = idx([{ id: 'a', title: '' }, { id: 'b', title: '' }, { id: 'c', title: '' }], 'a');
    expect(moveBuffer(base, 'c', 0).buffers.map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('setActive 仅在 id 存在时生效', () => {
    const base = idx([{ id: 'a', title: '' }, { id: 'b', title: '' }], 'a');
    expect(setActive(base, 'b').activeId).toBe('b');
    expect(setActive(base, 'nope').activeId).toBe('a');
  });

  it('defaultIndex 返回单空缓冲', () => {
    const d = defaultIndex();
    expect(d.buffers.length).toBe(1);
    expect(d.activeId).toBe(d.buffers[0].id);
  });
});
```

- [ ] **步骤 2：运行并确认失败**

运行 `pnpm vitest run src/modules/notes/buffers.test.ts`，预期 FAIL（`Cannot find module './buffers'`）。

- [ ] **步骤 3：编写最小实现**

新建 `src/modules/notes/buffers.ts`：

```ts
export interface BufferMeta {
  id: string;
  title: string;
}

export interface NotesIndex {
  buffers: BufferMeta[];
  activeId: string;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `buf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function defaultIndex(): NotesIndex {
  const id = newId();
  return { buffers: [{ id, title: '' }], activeId: id };
}

export function parseIndex(json: string): NotesIndex {
  try {
    const raw = JSON.parse(json);
    if (!raw || !Array.isArray(raw.buffers) || raw.buffers.length === 0) {
      return defaultIndex();
    }
    const buffers = raw.buffers.map((b: any) => ({
      id: String(b.id),
      title: String(b.title ?? ''),
    }));
    const activeId =
      typeof raw.activeId === 'string' && buffers.some((b: any) => b.id === raw.activeId)
        ? raw.activeId
        : buffers[0].id;
    return { buffers, activeId };
  } catch {
    return defaultIndex();
  }
}

export function addBuffer(index: NotesIndex): NotesIndex {
  const buf = { id: newId(), title: '' };
  return { buffers: [...index.buffers, buf], activeId: buf.id };
}

export function renameBuffer(index: NotesIndex, id: string, title: string): NotesIndex {
  return {
    ...index,
    buffers: index.buffers.map((b) => (b.id === id ? { ...b, title } : b)),
  };
}

export function closeBuffer(index: NotesIndex, id: string): NotesIndex {
  if (index.buffers.length <= 1) return index;
  const idx = index.buffers.findIndex((b) => b.id === id);
  if (idx < 0) return index;
  const buffers = index.buffers.filter((b) => b.id !== id);
  const activeId = index.activeId === id ? buffers[Math.max(0, idx - 1)].id : index.activeId;
  return { buffers, activeId };
}

export function moveBuffer(index: NotesIndex, id: string, toIndex: number): NotesIndex {
  const idx = index.buffers.findIndex((b) => b.id === id);
  if (idx < 0) return index;
  const buffers = index.buffers.slice();
  const [b] = buffers.splice(idx, 1);
  const clamped = Math.max(0, Math.min(toIndex, buffers.length));
  buffers.splice(clamped, 0, b);
  return { ...index, buffers };
}

export function setActive(index: NotesIndex, id: string): NotesIndex {
  if (!index.buffers.some((b) => b.id === id)) return index;
  return { ...index, activeId: id };
}
```

- [ ] **步骤 4：运行并确认通过**

运行 `pnpm vitest run src/modules/notes/buffers.test.ts`，预期 11 个用例全 PASS。

---

### 任务 6：files.ts 前端持久化适配层

**文件：**
- 新建：`src/modules/notes/files.ts`

**接口：** 依赖输入：任务 4 命令、任务 5 `NotesIndex`。对外产出（任务 7/8 依赖）：
- `readIndex(): Promise<NotesIndex | null>`
- `writeIndex(index: NotesIndex): Promise<void>`
- `readBuffer(path: string): Promise<string>`
- `saveBuffer(path: string, content: string): Promise<void>`
- `deleteBuffer(path: string): Promise<void>`

- [ ] **步骤 1：实现**

新建 `src/modules/notes/files.ts`：

```ts
import { invoke } from '@tauri-apps/api/core';
import { NotesIndex } from './buffers';

export async function readIndex(): Promise<NotesIndex | null> {
  const json = await invoke<string | null>('notes_read_index');
  if (json == null || json === '') return null;
  return JSON.parse(json) as NotesIndex;
}

export async function writeIndex(index: NotesIndex): Promise<void> {
  await invoke('notes_write_index', { json: JSON.stringify(index) });
}

export async function readBuffer(path: string): Promise<string> {
  return await invoke<string>('notes_read', { path });
}

export async function saveBuffer(path: string, content: string): Promise<void> {
  await invoke('notes_write', { path, content });
}

export async function deleteBuffer(path: string): Promise<void> {
  await invoke('notes_delete', { path });
}
```

- [ ] **步骤 2：类型检查**

运行 `pnpm check`，预期本文件无类型错误。

---

### 任务 7：NotesEditor.tsx（HeynoteEditor 包装 + 垫片）

**文件：**
- 新建：`src/modules/notes/NotesEditor.tsx`

**接口：** 依赖输入：任务 3 的 `HeynoteEditor`、任务 6 的 `readBuffer/saveBuffer`。对外产出（任务 8 依赖）：
- `interface NotesEditorProps { activeId: string; title: string; active?: boolean }`
- 默认导出组件 `NotesEditor(props): JSX.Element`

- [ ] **步骤 1：实现**

新建 `src/modules/notes/NotesEditor.tsx`：

```tsx
import { JSX, createEffect, onCleanup, onMount } from 'solid-js';
import { create, all } from 'mathjs';
import { HeynoteEditor } from './heynote/editor.js';
import { readBuffer, saveBuffer } from './files';

interface Props {
  activeId: string;
  title: string;
  active?: boolean;
}

function installShim() {
  const w = window as any;
  if (!w.heynote) {
    w.heynote = {
      buffer: {
        save: (path: string, content: string) => saveBuffer(path, content),
        load: (path: string) => readBuffer(path),
        addOnChangeCallback: () => {},
        removeOnChangeCallback: () => {},
        close: () => {},
      },
      platform: { isMac: false, isLinux: false, isWindows: true },
    };
  }
  if (!w.math) {
    w.math = create(all);
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
    });
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

  onCleanup(() => {
    editor?.destroy(true);
  });

  return <div ref={root} class="notes-editor h-full w-full" />;
}
```

- [ ] **步骤 2：类型检查**

运行 `pnpm check`。若 `HeynoteEditor` 因 `allowJs` 被推断为 `any` 且 TS 报 `implicitly any` 类错误，则在 `NotesEditor.tsx` 顶部加 `// @ts-nocheck`（仅此适配层）。预期其余无类型错误。

---

### 任务 8：NotesPanel.tsx（缓冲列表 + 标签条 + 状态栏）

**文件：**
- 修改：`src/modules/notes/NotesPanel.tsx`（覆盖旧 Milkdown 实现）

**接口：** 依赖输入：任务 5 的 buffers 函数、任务 6 的 files、任务 7 的 `NotesEditor`。对外产出：被 `App.tsx` 消费的 `NotesPanel(props: { active?: boolean })`（App.tsx 已接线，无需改）。

- [ ] **步骤 1：实现**

用以下内容**覆盖** `src/modules/notes/NotesPanel.tsx`：

```tsx
import { JSX, createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import NotesEditor from './NotesEditor';
import {
  NotesIndex, defaultIndex, parseIndex, addBuffer, renameBuffer, closeBuffer, setActive,
} from './buffers';
import { readIndex, writeIndex, deleteBuffer } from './files';

interface Props {
  active?: boolean;
}

export default function NotesPanel(props: Props): JSX.Element {
  const [index, setIndex] = createSignal<NotesIndex>(defaultIndex());
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<{ language: string; auto: boolean } | null>(null);
  let ready = false;

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
    ready = true;
  });

  createEffect(() => {
    if (!ready) return;
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

  const activeId = () => index().activeId;
  const activeTitle = () => index().buffers.find((b) => b.id === activeId())?.title ?? '';
  const langLabel = () => (status() ? `${status()!.language}${status()!.auto ? ' (自动)' : ''}` : '—');

  return (
    <div class="flex flex-col h-full">
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
              <button class="text-text-dim hover:text-red-400" onclick={(e) => { e.stopPropagation(); handleClose(buf.id); }}>×</button>
            </div>
          )}
        </For>
        <button class="px-2 py-1 text-xs rounded border border-border text-text-dim hover:text-text" onclick={handleAdd}>＋</button>
      </div>

      <div class="flex-1 min-h-0">
        <NotesEditor activeId={activeId()} title={activeTitle()} active={props.active} />
      </div>

      <div class="flex items-center justify-between pt-1 text-[11px] text-text-dim border-t border-border">
        <span>语言：{langLabel()}</span>
        <span>{index().buffers.length} 个缓冲区</span>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：类型检查 + 单测**

运行 `pnpm check` 与 `pnpm test`，预期类型通过、`buffers.test.ts` 11 用例通过。

---

### 任务 9：样式收尾 + 移除旧文件 + 构建验证

**文件：**
- 修改：`src/app.css`（追加笔记面板容器样式）
- 删除：`src/modules/notes/NoteBox.tsx`、`src/modules/notes/editor.ts`、`src/modules/notes/boxes.ts`、`src/modules/notes/boxes.test.ts`（旧 Milkdown 残留）

**接口：** 依赖输入：任务 8 产物。对外产出：可构建的完整面板。

- [ ] **步骤 1：追加容器样式**

在 `src/app.css` 末尾追加：

```css
/* 笔记面板（heynote 分块编辑器的外层容器） */
.notes-editor .cm-editor {
  height: 100%;
  font-size: 13px;
}
.notes-editor .cm-content {
  padding-bottom: 24px;
}
```

> 分块底色、块间距、语言标签、数学结果等外观由 vendored `theme/base.js`、`theme/light.js`、`theme/dark.js` 的 `EditorView.theme` 提供，无需额外 CSS。

- [ ] **步骤 2：删除旧 Milkdown 残留文件**

```powershell
Remove-Item src/modules/notes/NoteBox.tsx, src/modules/notes/editor.ts, src/modules/notes/boxes.ts, src/modules/notes/boxes.test.ts
```

- [ ] **步骤 3：构建验证**

运行 `pnpm build`，预期 Vite 构建成功、无报错，`dist/` 正常生成，且 `dist/langdetect-worker.js`、`dist/guesslang.min.js` 存在（public 静态拷贝）。

---

### 任务 10：整体冒烟验证与收尾

**文件：** 无新增（验证为主）。

**接口：** 依赖任务 1–9 全部产物。

- [ ] **步骤 1：启动应用**

运行 `pnpm tauri dev`。

- [ ] **步骤 2：逐项冒烟**

1. 「笔记」tab 存在，切过去出现一个带「12px 分隔」的空文本块，自动聚焦，可输入。
2. `Ctrl+Enter`：在当前块后新增一个块（出现新的分块分隔与交替底色）。
3. 粘贴 `{"a":1}`：语言自动识别为 json，语法高亮生效，状态栏显示「json (自动)」。
4. `Ctrl+Alt+Enter`：在当前光标处把块一分为二。
5. 数学块：输入 `∞∞∞math` 作为分隔行建立数学块，输入 `2+3`，行尾出现绿色结果标签 `5`。
6. `Alt+Shift+F`：对 JS/JSON 块手动格式化生效。
7. 粘贴一段 JS 代码：自动识别为 javascript 并高亮、Prettier 自动格式化。
8. 标签条：`＋` 新建、点击切换、双击改名、`×` 关闭（至少保留一个）。
9. 重启应用：缓冲区列表与内容仍在（`appDataDir()/notes/*.txt` 与 `index.json`）。
10. 明暗主题：块底色/语法配色随主题切换（当前固定 dark，主题切换逻辑接入后验证）。

- [ ] **步骤 3：确认验收标准**

对照规格 §10 的 8 条验收标准逐条核对，并叠加本计划「规格勘误」5 条，全部满足即完成。

---

### 自检记录

- **规格覆盖度**：规格 §1.1 的 10 项范围 → 任务 2/3（编辑器核心）、任务 5/6/8（多缓冲）、任务 4/6（持久化）、任务 3/7（明暗主题、格式化、分块、数学）。规格 §7 错误处理 → 任务 5 `parseIndex` 回退、任务 8 `try/catch`、`closeBuffer` 保底一缓冲。规格 §9 测试 → 任务 4/5 单测 + 任务 10 冒烟。
- **占位符扫描**：无 TBD/TODO；所有代码步骤均含完整代码；「任务 3 步骤 10」的 grep 为有明确模式与处置方式的收敛检查，非占位。
- **类型一致性**：`BufferMeta`/`NotesIndex` 在任务 5 定义、任务 6/8 复用，命名一致；命令名 `notes_read_index` 等在任务 4（Rust）与任务 6（`invoke`）两端一致；`HeynoteEditor.setBuffer` 在任务 3 新增、任务 7 调用，签名一致。
