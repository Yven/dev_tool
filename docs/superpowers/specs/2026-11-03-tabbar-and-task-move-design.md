# 选项卡增强与任务移动 设计规格

- 日期：2026-11-03
- 状态：设计待用户确认
- 相关技能：superpowers-brainstorming → 本规格；确认后转 writing-plans
- 前置对话：已确认「松手只暂定、点别处提交」「等宽 34px、480px 宽时每行 6 个、两行常驻」「指针事件 + FLIP」「顺序存 localStorage」「移动用左侧二级菜单」

## 1. 目标与范围

对现有 DevTool 做四项增强，不改变各面板本身的功能：

1. **选项卡加大、等大**：从「文字宽度自适应 + 28px 高度裁剪 + 展开箭头」改为「固定 34px 高、等宽网格、自动换行常驻」，扩大点击区域。
2. **Alt+1~9 切换**：按住 Alt 时在标签文字左侧显示序号，Alt+数字直接切换；序号按当前显示顺序编号。
3. **拖动排序**：按住标签 2 秒进入排序模式，拖动换位；松手只暂定，点击标签栏以外才提交；提交后 Alt 编号与切换顺序同步，并持久化。
4. **任务移动**：任务卡片 `⋯` 菜单新增「移动」，点击展开二级菜单列出当前所有分类，选择后把任务移到该分类。

现有约束：窗口 480×600（最小 320×400）；前端 SolidJS + UnoCSS；任务数据存 `tasks.json`，其余 UI 缓存用 localStorage `cache:` 前缀；不新增 npm / Rust 依赖。

## 2. 非目标（YAGNI）

- 不做标签的显示/隐藏、重命名、自定义快捷键；不做 Alt+0、Alt+10 及以上。
- 不做分类的独立管理（重命名、新建空分类、删除分类、分类排序）；「移动」只改任务自身的 `category`。
- 不改变任务现有的状态/紧急/编辑时间排序规则，不加「移动后置顶」开关。
- 不做拖拽时的边缘自动滚动、触屏长按、键盘拖拽；排序仅鼠标。
- 不做云端同步；顺序只存本机。

## 3. 方案

### 3.1 拖拽与动效

**采用：Pointer Events（`pointerdown/move/up` + `setPointerCapture`）+ FLIP 位移过渡。**
进入排序与「暂定」是两个显式状态，需要在拖动中实时重排、松手后冻结；指针事件能精确控制捕获、取消与点击抑制，FLIP（重排前记位置、重排后反向位移再过渡到 0）只操作 `transform`，不触发重排。

- 否决 HTML5 `draggable`：拖影由系统绘制，`dragover` 节流粗糙，长按与暂定状态都要另搭一套。
- 否决 View Transitions API 做跟手动画：每次快照会冻结交互约 200ms，连续触发会卡；任务页现有的 `startViewTransition` 只用于最终提交后的重排，不用于拖动过程。

### 3.2 顺序状态与持久化

**采用：`src/components/tabOrder.ts` 纯函数模块 + localStorage `cache:tab-order`。**
顺序是 id 数组；与当前标签集合合并时保留已存顺序、丢弃已消失的 id、把新出现的 id 追加到末尾。纯函数可直接单测。

- 否决把逻辑塞进 `App.tsx` 的 signal：合并/去重/追加不便单测。
- 否决新增 Tauri 配置文件：顺序属于 UI 缓存，与现有 `cache:` 约定一致，不值得加 Rust 命令。

### 3.3 任务移动菜单

**采用：`⋯` 菜单内「移动」→ 左侧 `position: fixed` 二级菜单，按「移动」按钮的 rect 计算位置并在视口内夹取。**
卡片位于 480px 窗口右侧，菜单贴着右边缘；二级菜单向右会被裁掉，向左则可能被 `.task-scroll` 的 `overflow` 裁切，所以用 fixed + 视口夹取，并限制最大高度内部滚动。

- 否决居中弹窗：与「二级菜单」不符，小窗口里也笨重。
- 否决把列表直接塞回一级菜单：不符合二级菜单的要求。

## 4. 详细设计

### 4.1 标签栏布局

- 外层 `.tab-bar-wrapper` 保持 `padding-inline: 12px`。
- `.tab-bar` 改为 **CSS Grid**：`position: relative`（供子项 offset 测量）、`grid-template-columns: repeat(auto-fill, minmax(72px, 1fr))`，`gap: 2px`，`padding-block: 4px`，`max-height: 114px`（3 行 + 间距 + 内边距），超出时 `overflow-y: auto`。
  - 480px 窗口：内容宽约 454.5px（左右各 0.75rem，根字号 17px），按 72px 最小宽得到 **6 列**，9 个内置标签正好两行（每行 6 / 3）。
  - 320px 最小窗口：内容宽约 294.5px，得到 4 列；标签文字用 `overflow: hidden; text-overflow: ellipsis` 兜底。
- 每个标签 `height: 34px`、`width` 由网格均分（等大）、文字 12px、水平居中、`border: 1px solid transparent`。
  - 激活：`background: #1e1e1e`（surface）、`border-color: #0078d4`（primary）。
  - 非激活：透明边框；hover `background: rgba(255,255,255,.05)`。
- **删除**展开箭头、`max-height: 28px` 裁剪、`ResizeObserver` 溢出检测、`expanded` 状态（`TabBar.tsx` 约 40 行删除）。插件多到超过 3 行时由标签栏内部滚动，不再挤压面板。

### 4.2 Alt 序号与切换

- `App.tsx` 持有 `altHeld` signal：window `keydown` 中 `e.key === 'Alt'` 置真，`keyup` 置假；window `blur`、`visibilitychange`（隐藏）置假，避免失焦后序号常亮。
- 按住 Alt 时，`TabBar` 在前 9 个标签内渲染绝对定位的序号（`left: 4px`、10px、`rgba(255,255,255,.6)`），**不挤动文字**；第 10 个起不显示。
- `App` 的 keydown 处理：`e.altKey && !ctrl && !meta && !shift && /^[1-9]$/.test(e.key)` → `e.preventDefault()` 并切到当前显示顺序的第 N 个（不存在则忽略）。Alt 单独按下不触发切换，也不阻止默认行为。
- 排序模式进行中（含暂定）忽略 Alt+数字与 Ctrl+Tab，并隐藏序号，避免切换面板与提交时机交叉；排序结束后恢复。TabBar 通过 `onSortingChange(bool)` 把状态上报给 `App`，由 `App` 统一门控快捷键；序号是否显示也由 TabBar 依据该状态自行决定，不引入额外全局 store。
- 现有 Ctrl+Tab / Ctrl+Shift+Tab 逻辑保留，索引仍按当前显示顺序。

### 4.3 拖动排序状态机

状态：`idle`（默认）→ `pressing`（按下计时）→ `sorting`（可拖、可暂定）。

**进入**
- `pointerdown`（仅主键）在标签上：记录 `pointerId`、起点、按下时的 rect；`setPointerCapture`，并同时挂 window 级 `pointermove/pointerup` 兜底（Solid 重排会移动 DOM 节点，pointer capture 可能丢失）；显示 2 秒进度条（标签底部 2px，`scaleX(0→1)` 线性，CSS animation）；启动 2000ms 计时器。
- 取消计时的条件：`pointerup`、指针离开标签栏矩形、**按下后位移超过 8px**、window `blur`、`Esc`。取消时清除进度条与计时器，不进入排序；超过 8px 视为「想拖动但还没进入排序」，宁可不动，也不要在手指已经离开的位置抓错标签。
- 锚点：进入排序时以「按下点」为抓取点（保留 ≤8px 的偏移），不把标签重新吸附到指针中心。
- 计时器到点：进入 `sorting`；被按住的标签高亮（`scale(1.03)`、阴影、`z-index`、primary 边框），其余标签 `opacity: .4`；快照当前顺序用于 Esc 回退。

**拖动**
- `sorting` 中按下任意标签：不等待 2 秒；指针位移超过 4px 即开始拖；位移未超过则按普通点击处理。
- 被拖标签跟随指针：用 `offsetLeft/offsetTop`（相对标签栏内容盒）+ 标签栏 rect/scroll 换算，设置 `transform`，不改布局。
- 换位判定：按缓存布局 rect 找到指针所在标签；落在左半 → 插到它前面，右半 → 插到它后面；命中空白则取最近标签。索引只在「去掉被拖项后」的数组中计算，变化时才重排。
- 重排后对其他标签做 FLIP：记录重排前后 `offsetLeft/offsetTop` 差，`el.animate([{transform: translate(dx,dy)}, {transform: none}], 160ms, cubic-bezier(.22,1,.36,1))`。不使用布局属性做动画。
- 动效尊重 `prefers-reduced-motion: reduce`：时长置 0。

**松手与提交**
- `pointerup`：结束拖动，**保留** `sorting` 与高亮/半透明；被拖标签过渡回自己的格子并保持高亮；顺序只是草稿。
- 暂定期间可再次直接拖任意标签继续调整（不再长按）。
- 暂定期间普通点击某个标签（位移 ≤ 4px）：先提交当前草稿顺序，再切到该标签。
- 提交时机：在标签栏以外 `pointerdown`（document 捕获阶段）、window `blur`、页面隐藏。提交 = 调 `onCommitOrder(ids)` → `App` 更新顺序 signal → 写 localStorage（内容未变则不写）→ 退出 `sorting`、清除高亮/半透明/transform。
- `Esc`：回退到进入 `sorting` 时的快照顺序，退出排序，不写盘。
- 外部点击不 `preventDefault`：例如点在面板输入框上，提交的同时该点击照常生效。

**点击抑制（精确规则）**
- 只有两种手势会抑制随后的 `click`：
  1. 触发 2 秒计时、进入 `sorting` 的那次长按（否则松手会切标签）；
  2. 在 `sorting` 中位移超过 4px、确实发生过拖动的按下。
- 其余情况一律不抑制：`sorting` 中位移 ≤4px 的按下，松手时 `click` 正常触发 → 提交草稿顺序并切到该标签。
- 抑制标记是一次性的：在该次 `click` 被消费或下一次 `pointerdown` 时清除；若 `pointerup` 落在别处导致 `click` 未触发，标记不会残留到下一次点击。
- 一次拖动结束后的下一次独立点击（新的 `pointerdown`）不受影响，可以正常提交并切换。

**与数据变化的关系**
- 排序期间插件加载/卸载：以新标签集合重算草稿（保留相对顺序，新 id 追加末尾）；若草稿与集合不一致以集合为准。
- 标签栏滚动（插件超过 3 行）时拖拽按当前 scroll 换算；不做自动滚动。

### 4.4 标签顺序的数据流

```ts
// src/components/tabOrder.ts
export const TAB_ORDER_KEY = 'cache:tab-order';
export function mergeTabOrder(saved: string[], current: string[]): string[];
export function loadTabOrder(): string[];   // 解析失败/非数组 → []
export function saveTabOrder(ids: string[]): void;
```

- `mergeTabOrder(saved, current)`：按 `saved` 顺序保留仍存在的 id（去重），再把 `current` 中未出现的 id 按原顺序追加。
- `App.tsx`：`order` signal（初值 `loadTabOrder()`）；`allTabs = [...BUILTIN_TABS, ...pluginTabs()]`；`orderedTabs = mergeTabOrder(order(), allTabs ids)` 映射回对象（对象引用保持稳定，保证 `<For>` 只移动节点）。
- 提交：`setOrder(ids)` + `saveTabOrder(ids)`。
- 插件卸载时把该 id 从内存顺序与 `cache:tab-order` 中一起移除；插件再次加载会追加到末尾（不保留旧位置）。这是可接受的简化，写进验收说明。

### 4.5 任务「移动」

**模型**（`src/modules/tasks/model.ts`）

```ts
export function moveTask(tasks: Task[], id: string, category: string, now = Date.now()): Task[]
```

- `category` 先 `trim()`；为空或与当前相同 → 原样返回（不刷新时间）。
- 不同：只改 `category` 与 `editedAt = now`，`id/status/urgent/note/createdAt` 不变。
- 刷新 `editedAt` 的理由：任务在目标分类里按编辑时间排序，不刷新会按旧时间插在中间，看起来像没移过去。

**分类来源**：`TasksPanel` 把 `groups().map(g => g.name)` 传给每张卡片；顺序与页面上的分类顺序一致。分类没有独立实体，只剩一条任务被移走时该分类自然消失。

**菜单与二级菜单**（`TaskCard.tsx`）

- `⋯` 下拉里在「删除」上方加「移动」。点击「移动」时读该按钮的 `getBoundingClientRect()`，计算 `left = max(8, rect.left - 132)`、`top = clamp(rect.top, 8, innerHeight - 8 - 最小高度)`，`max-height = innerHeight - top - 8`（上限 200px），渲染 `position: fixed` 的分类列表（宽 128px，内部滚动）。
- 列表项：分类名（单行截断）；当前分类置灰并标注「当前」，不可点；没有其他分类时显示一行「暂无其他分类」。
- 选择分类：`props.onMove(task.id, category)`，同时关闭二级菜单与一级菜单。
- 关闭：点击外部（现有 `pointerdown` 监听，二级菜单带 `data-task-menu` 视为内部）、`Esc`、再次点「移动」。
- **一级菜单定位不改**：保持现有 `absolute right-0 top-full`。最底部卡片的菜单可能被滚动容器挡住一部分（既有行为，本次不顺手改，避免把「删除」一起卷进回归面）；一级菜单若被挡住，先滚动列表再点。二级菜单用 fixed，锚点取「移动」按钮当时的 rect，只要该按钮可见就能正常展开。

## 5. 文件与职责

```
src/components/tabOrder.ts        新增：顺序合并/读写纯函数
src/components/tabOrder.test.ts   新增：合并规则单测
src/components/TabBar.tsx         改写：等宽网格、Alt 序号、拖动状态机、进度条、上报 sorting
src/App.tsx                       顺序 signal、Alt 监听、快捷键门控（含 sorting 态）、提交回调
src/App.css                       标签栏网格/高亮/半透明/进度条/FLIP 相关类
src/modules/tasks/model.ts        moveTask
src/modules/tasks/model.test.ts   moveTask 单测
src/modules/tasks/TaskCard.tsx    移动菜单 + fixed 二级菜单
src/modules/tasks/TasksPanel.tsx  onMove + withReorder；传入分类列表
README.md                         功能一览补充 Alt 切换/拖动排序/任务移动
```

无 Rust 改动、无新依赖。

## 6. 错误与边界

| 场景 | 行为 |
|---|---|
| localStorage 无值/JSON 损坏/非字符串数组 | 视为空顺序，用当前集合顺序，不报错 |
| 存了已卸载插件的 id | 合并时丢弃；插件回来追加到末尾 |
| 标签少于 9 个 | 只显示/响应存在的序号 |
| 插件超过 3 行 | 标签栏内部竖向滚动，不继续压缩面板 |
| 2 秒内移出标签栏 / 位移超过 8px / 失焦 / Esc | 取消进入排序，不改变任何东西 |
| 暂定态普通点击标签 | 提交当前草稿顺序，并切到该标签 |
| 一级菜单在列表最底部被挡住 | 既有行为，先滚动列表；本次不改其定位 |
| 排序中窗口失焦、页面隐藏 | 提交当前草稿顺序 |
| 排序中按 Alt+数字 / Ctrl+Tab | 忽略，排序结束后恢复 |
| 提交时顺序未变 | 不写 localStorage |
| 移动分类为空/与当前相同 | 不产生新状态，菜单不提供该操作 |
| 移动后原分类无任务 | 分类消失（与现有删除逻辑一致） |
| 二级菜单靠近视口底部/左边 | 位置夹取 + 最大高度内部滚动，不超出窗口 |
| 任务内容很长 | 与现有卡片一致，不因移动改变 |

## 7. 测试策略

**单元（Vitest，纯函数）**

1. `mergeTabOrder`：保留已存顺序；新 id 追加；已消失 id 丢弃；重复 id 去重；空 saved；saved 含未知 id。
2. `loadTabOrder`：无值、坏 JSON、非数组、非字符串元素 → `[]`。
3. `moveTask`：改分类并刷新 `editedAt`；保留其余字段；同分类/空串不改；id 不存在时原样返回。

**手工冒烟（`pnpm tauri dev`，jsdom 不测指针拖拽）**

- 9 个标签两行等大；480 与 320 宽都不溢出、文字截断正常；无展开箭头。
- 按住 Alt 显示 1~9；Alt+5 切到第 5 个；松开消失；Alt+Tab 切走后回来不残留。
- 按住 2 秒出现进度条与高亮、其余半透明；拖动换位有动画；松手仍高亮；再拖调整；点面板空白处提交并恢复；Esc 回退；重启后顺序保持；再按 Alt+数字按新顺序切换。
- 长按期间小幅抖动（≤8px）仍能进入排序；移动超过 8px 则取消、什么都不发生。
- 暂定态下不拖动、直接点另一个标签：顺序提交且切过去。
- 任务 `⋯` →「移动」→ 选择另一分类：任务出现在目标分类并按时间排序；当前分类置灰；靠近窗口底部/右侧不被裁切；Esc 与点外部关闭。

**提交前**：`pnpm check && pnpm test && pnpm build`。

## 8. 验收标准

1. 标签高 34px、等宽、自动换行常驻；480px 宽每行 6 个、9 个内置标签两行；无展开箭头；点击区域明显大于改造前。
2. 按住 Alt 时前 9 个标签左侧显示 1~9；Alt+N 切到第 N 个；松开/失焦后序号消失；不影响输入。
3. 长按 2 秒进入排序；拖动有跟手与让位动画；松手保留暂定态；可继续拖；点击别处提交并恢复外观；Esc 回退；顺序写 localStorage，重启仍在；提交后 Alt 编号与 Ctrl+Tab 顺序同步。
4. 任务卡 `⋯` 含「移动」；二级菜单列出当前所有分类且当前分类不可选；选中后任务改分类、刷新编辑时间、原分类为空时消失；二级菜单不被窗口边缘裁切（一级菜单保持现状）。
5. 现有面板、插件标签、Ctrl+Tab、任务其它操作均无回归；`pnpm check`/`pnpm test`/`pnpm build` 通过。

## 9. 我的默认值（可推翻）

- 标签栏最多 3 行后内部滚动；等宽最小 72px。
- 排序模式中点击标签 = 提交并切换；Esc = 取消；失焦 = 提交。
- 移动刷新 `editedAt`；二级菜单列全部当前分类，当前分类置灰。
- 拖动不做边缘自动滚动；触屏不特殊处理。
- 长按期间允许 ≤8px 抖动，超过则取消；进入排序时保留按下点偏移。
- 一级菜单定位不动，只有二级菜单用 fixed。

> 项目约定：本文件只落盘，不自动执行 `git add` / `git commit`。
