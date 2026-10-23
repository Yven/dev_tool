# 任务面板（按分类追踪的小任务清单）设计规格

- 日期：2026-10-23
- 状态：设计已确认，待评审规格
- 相关技能：superpower-brainstorming → 本规格；实现阶段转 writing-plans

## 1. 目标与范围

在 DevTool 新增内置面板「任务」，用于在桌面工具里快速记录并按分类追踪小任务：输入第一行为分类、其余行任务内容；任务可设四种状态、标记紧急、添加备注，按编辑时间与优先级自动排序，完成后自动收进分类内的「完成」折叠栏。任务内容与备注以 Markdown 渲染，编辑时使用原始 Markdown 文本。

本规格覆盖：面板接入、任务数据模型、输入解析、排序与分组、状态/紧急/备注/内容编辑/删除交互、Markdown 渲染与链接处理、本地 JSON 持久化、配色与视觉、错误处理、测试与验收。

非目标（YAGNI）：不做分类管理（重命名/删除/排序/合并）、不做多级子任务、不做截止日期/提醒/重复任务、不做搜索与筛选、不做拖拽排序、不做云端同步、不做已完成任务的批量清理、不做键盘导航（除输入框与 Esc 关闭浮层）。

## 2. 需求规格（已与用户确认）

1. 面板顶部一个多行输入框，`Ctrl+Enter` 提交新任务。
2. 输入第一行（trim 后）作为分类；第二行起为任务内容。
3. 列表默认按编辑时间新→旧；按分类汇总展示；分类顺序由该分类最新一条编辑时间新→旧决定。
4. （原始编号无第 4 条）
5. 列表右侧一个按钮显示当前状态，点击展开四个选项：未开始 / 规划 / 进行中 / 完成；选择后按钮显示该状态名，任务卡片背景显示对应状态颜色（未开始=蓝灰、规划=黄、进行中=红、完成=绿）。四色需低饱和、低透明度，保证文字可读且不刺眼；四种状态可任意互切，无先后约束。
6. 状态改为「完成」后，任务自动收进该分类的「完成」栏；完成栏默认折叠，内部按编辑时间新→旧排序，也可改回其他状态。
7. 列表任务最左侧是紧急标志 ⚠️：平时隐藏，鼠标悬停卡片时才显示；点击后固定显示并标记为紧急；卡片最外层加红色边框，边框与内容内边距为 2px。
8. 排序：默认按编辑时间新→旧；有紧急任务时，列表与分类最顶部都是紧急；其他非紧急任务中「进行中」排最前；同层及不满足以上两种的按默认顺序。
9. 任务内容下方有「备注」标记，右侧带编辑图标；点击可新增/修改备注，**备注编辑不改变任务的编辑时间**。
10. 列表最右侧 `...` 按钮，点击展开下拉框，其中含删除；删除需二次确认。

### 2.1 澄清结论（本轮新增）

- **编辑时间语义**：只有修改备注不更新 `editedAt`；新建任务、修改任务内容、修改状态、切换紧急都更新 `editedAt`。
- **任务内容可编辑**：双击任务内容进入就地编辑；`Ctrl+Enter` 保存、`Enter` 换行、`Esc` 取消（键位随 2.2 第二轮反馈调整）；保存后刷新 `editedAt`。
- **标为完成即清除紧急**：状态改为 `done` 时强制 `urgent = false`，红边同时消失；已完成后不能再处于紧急状态。
- **持久化**：写本地 JSON 文件（`app_data/tasks/tasks.json`），不用 localStorage。

### 2.2 补充需求（第二轮反馈）

11. 备注字号小于任务正文、用灰色显示；备注正文位于「备注」标记**下方**；备注编辑时 `Enter` 换行、`Ctrl+Enter` 确定。
12. 任务内容与备注正文都支持按 Markdown 语法渲染；编辑态仍是纯文本 Markdown 源。

由此推导的配套决定（可推翻）：

- 任务内容的就地编辑键位同步改为 `Enter` 换行、`Ctrl+Enter` 保存，否则多行 Markdown（列表、代码块）无法输入；`Esc` 取消。
- 渲染后的卡片高度随内容变化；内容仍可双击进入编辑。
- 备注文本不参与排序，不刷新 `editedAt`（与第 9 条一致）。

## 3. 方案选择

采用**扁平 `Task[]` + 渲染时纯函数分组排序**，否决按分类嵌套的 `{ category: Task[] }`。

- 扁平结构：状态、紧急、备注、内容、删除都按 `id` 定位改一条，无需在分类间搬移；分类随最后一条任务删除自动消失；排序规则集中在一个纯函数，可直接单测。
- 嵌套结构需要维护「改状态跨分类搬移」「空分类清理」「分类内排序」三类逻辑，边界更多且难测，收益仅是渲染时少一次分组。

技术栈沿用现有约定：SolidJS Signals 持有状态，纯函数 reducer 放 `model.ts`，Tauri Command 负责文件读写，UI 用 UnoCSS + 现有主题 token。

### 3.1 Markdown 渲染

- 用 `marked`（GFM、`breaks: true`、同步 `parse`）把源文本转成 HTML，再用 `dompurify` 清洗，以 `innerHTML` 注入。
- **理由**：两者体积小、成熟；手写 Markdown 解析与转义容易出现 XSS、嵌套强调、代码块边界错误，代码量也远大于引入依赖。
- **否决** `@lezer/markdown`（已随 CodeMirror 安装）：它只提供 AST，还需自写树遍历、转义与标签映射，属于重复造轮子且更难保证正确性。
- 原始 HTML 默认不被信任：DOMPurify 会移除 `<script>`、事件属性、`javascript:` 等危险链接。
- 依赖变更：`package.json` 增加 `marked`、`dompurify`，需要执行一次 `pnpm install`（本会话无法联网安装，需由用户补跑）。

### 3.2 链接

- 渲染出的 `<a>` 统一在容器上做事件委托：命中链接时 `preventDefault()`，调用 `@tauri-apps/plugin-opener` 的 `openUrl(href)` 交给系统浏览器。
- JS 包已在 `package.json`，但 Rust 侧未注册：需在 `src-tauri/Cargo.toml` 增加 `tauri-plugin-opener = "2"`，在 `src-tauri/src/lib.rs` 注册 `tauri_plugin_opener::init()`，并在 `src-tauri/capabilities/default.json` 增加 `opener:default`（必要时补 `opener:allow-open-url`）。
- 仅允许 `http:` / `https:` 打开；其他协议忽略（DOMPurify 已先行移除危险协议）。

## 4. 数据模型

持久化文件 `app_data/tasks/tasks.json`：

```json
{ "version": 1, "tasks": [] }
```

```ts
type TaskStatus = 'todo' | 'plan' | 'doing' | 'done';

interface Task {
  id: string;         // crypto.randomUUID()
  category: string;   // 输入第一行 trim
  content: string;    // 第二行起 join('\n') 后 trim
  status: TaskStatus; // 默认 'todo'
  urgent: boolean;    // 默认 false
  note: string;       // 默认 ''
  createdAt: number;  // Date.now()
  editedAt: number;   // 最后编辑时间
}
```

- `version` 仅作未来迁移占位；当前读取忽略未知字段，缺失字段用默认值补齐，无法解析的条目丢弃。
- 分类没有独立实体，名称即 key；同名（区分大小写）自动合并。

## 5. 排序与分组规则（纯函数，必须单测）

### 5.1 分组

`groupAndSort(tasks): CategoryGroup[]`

```ts
interface CategoryGroup {
  name: string;
  tasks: Task[];      // 未完成
  completed: Task[];  // 完成
}
```

- `status === 'done'` 进 `completed`，其余进 `tasks`。
- 分类按下方 5.2 排序；`tasks` 按 5.3 排序；`completed` 按 `editedAt` 倒序。

### 5.2 分类排序

分层（数字小在前）：

1. 该分类存在**未完成**且 `urgent` 的任务。
2. 该分类存在未完成任务。
3. 该分类只剩完成任务。

层内按「该分类所有任务（含完成）的 `max(editedAt)`」倒序；相同则按分类名 `localeCompare('zh')` 升序，保证稳定。

> 说明：只剩完成的分类排在最后，避免刚把某分类最后一条任务标完成时，该分类带着折叠的完成栏突然跳到顶部。

### 5.3 未完成任务排序

分层（数字小在前）：

1. `urgent === true`。
2. `status === 'doing'`。
3. 其余（`todo` / `plan`）。

层内按 `editedAt` 倒序；相同则 `createdAt` 倒序；再相同按 `id` 升序，保证稳定。

### 5.4 完成栏

- 每个分类底部显示 `完成 (n)`，默认折叠，展开状态仅存在内存中，不持久化。
- 展开后按 `editedAt` 倒序；改回任意非完成状态后回到主列表，并按新 `editedAt` 重新排序。

## 6. 输入解析与提交

`parseTaskInput(text): { category: string; content: string } | null`

1. 统一换行：`\r\n` / `\r` → `\n`。
2. 按 `\n` 切分，第一行 `trim()` 为 `category`；第二行起用 `\n` 连接后 `trim()` 为 `content`。
3. 以下情况返回 `null`（不提交）：`category` 为空、`content` 为空、总行数 < 2。
4. `null` 时输入框下方显示红字：「第一行填分类，第二行起填任务内容」。
5. 成功：插入新任务（`status='todo'`、`urgent=false`、`createdAt=editedAt=Date.now()`），清空输入框并保持焦点，清除错误提示。
6. 输入框内 `Enter` 正常换行；`e.isComposing === true`（中文输入法组合中）时不触发 `Ctrl+Enter` 提交。

## 7. 交互规格

### 7.0 面板与分类区块

- 面板纵向排列：输入区（固定高度，不随列表滚动）→ 分类列表（超出时由外层容器滚动）。
- 输入区：3 行高 textarea，占位文案三行：「第一行：分类」「第二行起：任务内容」「Ctrl+Enter 添加」；右下角一行 `text-[11px] text-dim` 提示「Ctrl+Enter 添加」。
- 分类标题：`分类名` + `未完成数量`（dim，小号）；标题行不可点击、不可编辑。
- 分类之间用 12px 间距分隔，不加分割线；分类区块本身无卡片容器，仅任务卡有底色。

### 7.1 任务卡片布局

```
[⚠️]  任务内容（Markdown 渲染）                [状态 pill]  [...]
      备注 ✎
      备注正文（Markdown 渲染，小号灰字）
```

- 卡片整体背景 = 状态色（半透明叠加在 `#2d2d2d` 上），`1px` 边框 = 同色系更高透明度。
- 紧急时外层 wrapper `border: 1px solid #ef4444` + `padding: 2px`（border-box，边框与内容之间 2px）；内层卡片保持自己的状态色。
- ⚠️ 按钮：默认 `opacity: 0`；卡片 `:hover` 或按钮 `:focus-visible` 时 `opacity: 1`；`urgent` 时始终可见并显示为激活色。点击切换紧急，立即刷新 `editedAt`。`aria-label` 为「标记紧急/取消紧急」。
- 内容：Markdown 渲染后的富文本（`div.task-md`），容器 `word-break: break-word`；单个换行按 `<br>` 处理（`breaks: true`）。
- 双击内容进入编辑：textarea 就地替换内容区，显示原始 Markdown 源；`Enter` 换行、`Ctrl+Enter` 保存、`Esc` 取消；保存时 `trim()`，为空则恢复原值。保存后刷新 `editedAt`。

### 7.2 状态按钮与浮层

- 按钮常显，文案为当前状态名；点击打开浮层，列出四项（色点 + 名称），当前项高亮。
- 选择后立即更新并关闭浮层；点击浮层外部或按 `Esc` 关闭。
- 状态改为 `done`：若 `urgent` 为真则同时置假；任务移入完成栏（完成栏保持当前折叠状态）。
- 状态改为非 `done`：任务回到主列表对应层级。

### 7.3 备注

- 内容下方常显「备注」+ 铅笔图标；有备注时，正文显示在「备注」标记的**下一行**。
- 备注正文：约 `11px`、`text-dim`（灰色）、Markdown 渲染、行高紧凑，与任务正文形成清晰层级差。
- 点击「备注」行或铅笔进入编辑：多行 textarea（显示原始 Markdown）+「保存」「取消」按钮；`Enter` 换行、`Ctrl+Enter` 保存、`Esc` 取消；**保存只更新 `note`，不更新 `editedAt`**。
- 备注允许为空（保存空字符串即清除备注）；不改变任务状态与排序。
- 编辑区内的 Markdown 语法不实时预览，保存后按渲染态显示（保持实现简单）。

### 7.4 `...` 菜单与删除

- 点击 `...` 打开下拉，当前仅有「删除」一项（红色）。
- 点击删除 → 调用原生确认框（`tasks_confirm`，标题 `DevTool`、Warning 图标、OK/Cancel），文案「确定删除该任务？删除后不可恢复。」
- 确认后从数组移除；若是该分类最后一条任务，分类整体消失。
- 点击菜单外部或按 `Esc` 关闭。

### 7.5 空状态

无任务时显示一行 dim 文案：「还没有任务，输入第一行分类、第二行开始写任务，Ctrl+Enter 添加」。

## 8. 配色

文字统一 `#cccccc`，不随底色变化；状态色只用于背景、边框和圆点。

| 状态 | 背景（叠加 #2d2d2d） | 1px 边框 | 圆点 |
|---|---|---|---|
| 未开始 | `rgba(100,116,139,.16)` | `rgba(148,163,184,.30)` | `#94a3b8` |
| 规划 | `rgba(234,179,8,.13)` | `rgba(234,179,8,.32)` | `#eab308` |
| 进行中 | `rgba(239,68,68,.13)` | `rgba(239,68,68,.34)` | `#ef4444` |
| 完成 | `rgba(34,197,94,.12)` | `rgba(34,197,94,.30)` | `#22c55e` |

- 红边（紧急）：`#ef4444`，1px。
- 这些值集中定义在 `STATUS_META` 常量中，UI 通过 `style` 应用（避免 UnoCSS 任意值在透明度上的歧义）。

### 8.1 Markdown 排版（`.task-md`）

- 正文字号沿用卡片正文（12px）；`h1~h6` 统一 `font-size: 1.05em`、`font-weight: 600`、上下 `0.3em`，避免标题撑爆卡片。
- `p` / `ul` / `ol` 的垂直间距 `0.25em`；`ul/ol` 恢复 `padding-left: 1.2em` 与列表符号（reset 已去掉）。
- 行内 `code`：`font-mono`、`background: rgba(255,255,255,.08)`、`padding: 0 3px`、`border-radius: 3px`。
- 代码块 `pre`：小内边距、`overflow-x: auto`、同款底色；不引入语法高亮。
- 引用块：左侧 2px `border` 色边框 + `text-dim`。
- 链接：`primary` 色、下划线，点击交给系统浏览器（见 3.2）。
- `hr`、表格：按 `border-border` 给最小样式，表格允许横向滚动。
- 备注内的 Markdown 继承同一套规则，但整体字号 11px、间距更紧。

## 9. 持久化与 Tauri 命令

新增 `src-tauri/src/commands/tasks.rs`：

- `tasks_read() -> Result<Option<String>, String>`：读取 `app_data/tasks/tasks.json`，不存在返回 `None`。
- `tasks_write(json: String) -> Result<(), String>`：写入整个 JSON（目录不存在则 `create_dir_all`）。
- `tasks_confirm(message: String) -> Result<bool, String>`：沿用 `notes_confirm` 的原生对话框实现。

前端 `storage.ts` 封装三个 `invoke`。

状态流：

1. `onMount` → `tasks_read()` → `parseTasks()` → `setTasks`；失败则空列表并 `console.error`。
2. `createEffect` 监听 `tasks()`，`ready` 后每次变更整体写回；写入失败 `showToast('任务保存失败', 'error')` 并保留内存状态，不阻塞交互。
3. 写入为整文件覆盖，任务量小（个人工具），不做增量与防抖；所有 mutation 都是离散操作（提交、保存、切换、删除），不会每敲一键写盘。

## 10. 文件与职责

```
src/modules/tasks/
  model.ts        # Task 类型、STATUS_META、parseTaskInput、增删改 reducer、groupAndSort
  model.test.ts   # 纯函数单测
  markdown.ts     # renderMarkdown(text): string（marked + DOMPurify + breaks）
  markdown.test.ts# 渲染与清洗单测
  storage.ts      # invoke 读写封装
  TasksPanel.tsx  # 唯一状态持有者：加载/保存、输入框、分组成员、完成栏折叠、链接委托
  TaskCard.tsx    # 单卡：紧急、内容编辑、状态浮层、备注编辑、... 菜单

src/App.tsx                                # 新增 tab + 挂载
src/App.css                                # .task-md Markdown 排版样式
package.json                               # 新增 marked、dompurify
src-tauri/Cargo.toml                       # 新增 tauri-plugin-opener
src-tauri/capabilities/default.json        # 新增 opener:default
src-tauri/src/commands/tasks.rs            # 新增命令
src-tauri/src/commands/mod.rs              # mod tasks;
src-tauri/src/lib.rs                       # 注册 3 个命令 + tauri_plugin_opener::init()
```

- `model.ts` 不依赖 DOM / Tauri，全部纯函数。
- `TaskCard` 只接收 `task` 与回调（`onStatus` / `onUrgent` / `onContent` / `onNote` / `onDelete`），不持有全局状态。
- `TasksPanel` 是唯一持有 `tasks` 与折叠状态的地方。

## 11. 错误处理与边界

| 场景 | 行为 |
|---|---|
| 输入不足两行 / 分类或内容为空 | 不提交，输入框下红字提示 |
| 输入超长（分类或内容） | 正常保存，UI 内换行；不做长度限制 |
| 备注编辑中切换面板 | 组件常驻挂载（`display:none`），编辑态保留 |
| 数据文件损坏 | `parseTasks` 返回空数组，不阻塞面板 |
| 数据文件缺失 | 空列表，首次写入时创建 |
| 写盘失败 | Toast 报错，内存数据不丢；下次变更再次尝试 |
| 删除最后一条任务 | 该分类消失 |
| 连续快速点击状态 | 每次基于当前 signal 计算，`editedAt` 取 `Date.now()` |
| 完成栏内改回状态 | 回到主列表，按新时间参与排序 |
| Markdown 渲染抛错 | `try/catch` 回退为纯文本显示（`pre-wrap`），不阻塞卡片 |

## 12. 测试策略

**Vitest（重点，`model.test.ts`）**

1. `parseTaskInput`：两行、多行、CRLF、首行空白、仅一行、内容为空、首行与内容同时 trim。
2. 分组：done 进入 `completed`；同名分类合并；分类删除后消失。
3. 分类排序：紧急分类 > 有未完成 > 只剩完成；层内按 max(editedAt)；同值按名称稳定。
4. 任务排序：紧急 > 进行中 > 其余；层内 `editedAt` 倒序；同值稳定。
5. `setStatus(id,'done')` 清除 urgent；改回非 done 回主列表。
6. `toggleUrgent` 更新 `editedAt`；`updateNote` **不**更新 `editedAt`。
7. `updateContent` 更新 `editedAt`；`removeTask` 只删目标。

**Markdown（`markdown.test.ts`）**

1. 粗体、行内代码、无序列表、链接渲染为对应标签。
2. 单个换行渲染为 `<br>`（`breaks: true`）。
3. `<script>`、`onerror` 等事件属性被清洗。
4. `javascript:` 链接被移除。
5. 空字符串返回空串，不抛错。

**静态与构建**：`pnpm test`、`pnpm check`（tsc --noEmit）、`pnpm build`、`cargo test`。

**手工冒烟（`pnpm tauri dev`）**：Ctrl+Enter 提交；中文输入法组合中不误提交；四色观感与文字对比；hover 显示 ⚠️；紧急红边内距 2px；完成栏折叠/展开；备注小号灰字且在标记下方；任务与备注的 Markdown 渲染与链接跳转；备注编辑不改变顺序；删除二次确认；重启后数据仍在。

## 13. 验收标准

1. 「任务」标签出现，切换面板不丢状态。
2. 多行输入按「首行分类 / 其余内容」正确入库；不合法输入不提交并提示。
3. 分类与任务排序完全符合第 5 节；紧急置顶且分类置顶；进行中排在普通任务前。
4. 四种状态可任意切换，卡片底色与按钮文案随之变化，四种颜色符合第 8 节。
5. 改为完成后进入完成栏且清除紧急；完成栏默认折叠、内部倒序、可改回。
6. ⚠️ 默认隐藏、hover 出现、点击固定并加 1px 红边（内距 2px）。
7. 备注可增改，且不改变任务顺序。
8. `...` 删除有二次确认，确认后移除。
9. 重启应用后任务与备注仍在（JSON 文件）。
10. `pnpm test` / `pnpm check` / `cargo test` 通过。
11. 任务内容与备注按 Markdown 渲染（单换行生效）；备注为小号灰字、位于「备注」标记下方；编辑时 `Enter` 换行、`Ctrl+Enter` 确定。
12. 渲染内容中的 `<script>` / 事件属性被清洗；点击链接由系统浏览器打开，不改变应用页面。

## 14. 已知环境约束

当前会话的 `bash` 与 `pwsh` 都在 workspace 预处理阶段失败：`D:\work\dnmp\www\dev_tool` 的所有者不是当前用户，缺少 `WRITE_OWNER`，sandbox 拒绝自动 ACL 准备。因此实现阶段可以写文件，但无法在本会话执行 `pnpm test` / `pnpm build` / `cargo test`。需要在以下三种方式中选一：修正目录所有者/ACL、启用 `danger-full-access`、或由用户自行运行验证命令。

另外，本轮新增 `marked`、`dompurify` 两个 npm 依赖，需要先执行 `pnpm install`；`tauri-plugin-opener` 首次构建时会拉取 crate。
