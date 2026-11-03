# 选项卡增强与任务移动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让顶部选项卡等宽易点，支持 Alt+1~9 切换与长按拖动排序（点击别处提交并持久化），并给任务卡 `⋯` 菜单增加「移动」二级分类菜单。

**Architecture:** 标签顺序是 App 里的 id 数组，`tabOrder.ts` 纯函数负责与当前标签集合合并并读写 localStorage；`TabBar` 自持按下/排序/暂定三态与 FLIP 动效，提交时回调 App。任务移动是 `model.ts` 的纯 reducer，卡片只负责菜单与定位。

**Tech Stack:** SolidJS + TypeScript + UnoCSS + Vitest（@solidjs/testing-library、jsdom）+ Tauri 2；本计划无 Rust 改动。

**Spec:** `docs/superpowers/specs/2026-11-03-tabbar-and-task-move-design.md`

## Global Constraints

- 窗口 480×600、最小 320×400；标签栏内容宽 ≈ 窗口宽 − 25.5px（左右各 0.75rem，根字号 17px；480 时约 454.5px，仍为 6 列）。
- 标签高 34px、等宽网格 `repeat(auto-fill, minmax(72px, 1fr))`、`gap: 2px`、`padding-block: 4px`、`max-height: 114px`、超出纵向滚动；480px 时 6 列。
- 长按 2000ms；长按期间位移上限 8px；拖动阈值 4px；FLIP 160ms `cubic-bezier(.22,1,.36,1)`；非拖拽标签 `opacity: .4`；被拖标签 `scale(1.03)`。
- 快捷键只有 Alt+1..9，命中时 `preventDefault()`；排序中（含暂定）忽略 Alt+数字与 Ctrl+Tab。
- localStorage key 固定 `cache:tab-order`，内容为 JSON 字符串数组；写入失败静默忽略。
- 「移动」二级菜单：宽 128px、与按钮水平间距 4px、视口边距 8px、最大高 200px、`position: fixed`。
- 不新增 npm 依赖、不改 Rust；**不执行 `git add` / `git commit`**（项目约定，用户明确要求才提交）。
- 保留现有 Ctrl+Tab / Ctrl+Shift+Tab 与插件标签行为。

## Review Focus

1. 已保存顺序里含暂时卸载的插件 id，插件重新加载后必须追加到末尾且顺序不崩 —— Task 1 的 `mergeTabOrder` 测试。
2. localStorage 写入抛错（配额/隐私模式）时排序照常可用，异常不得冒到 UI —— Task 1 的 `saveTabOrder` 测试。
3. 标签少于 9 个时只显示实际序号，Alt+9 不切换也不报错 —— Task 3 的序号渲染测试 + 手工冒烟。
4. 把某分类最后一条任务移走后该分类必须消失，不能留空分组 —— Task 5 的 `groupAndSort` 测试。
5. 只剩当前分类时「移动」二级菜单必须显示「暂无其他分类」，而不是空菜单 —— Task 6 的组件测试。

---

### Task 1: 标签顺序模块

**Files:**
- Create: `src/components/tabOrder.ts`
- Test: `src/components/tabOrder.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `TAB_ORDER_KEY: string`（值 `'cache:tab-order'`）
  - `mergeTabOrder(saved: readonly string[], current: readonly string[]): string[]`
  - `sameIds(a: readonly string[], b: readonly string[]): boolean`
  - `loadTabOrder(): string[]`
  - `saveTabOrder(ids: readonly string[]): void`

- [ ] **Step 1: 写失败测试**

~~~ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAB_ORDER_KEY, loadTabOrder, mergeTabOrder, sameIds, saveTabOrder } from './tabOrder';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('mergeTabOrder', () => {
  it('按已存顺序保留仍存在的 id', () => {
    expect(mergeTabOrder(['b', 'a', 'c'], ['a', 'b', 'c', 'd'])).toEqual(['b', 'a', 'c', 'd']);
  });

  it('丢弃已消失的 id，新 id 追加到末尾', () => {
    expect(mergeTabOrder(['gone', 'a'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('重复 id 去重', () => {
    expect(mergeTabOrder(['a', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('空 saved 用当前顺序', () => {
    expect(mergeTabOrder([], ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('sameIds', () => {
  it('内容与顺序都相同才为真', () => {
    expect(sameIds(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameIds(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('loadTabOrder / saveTabOrder', () => {
  it('往返保存与读取', () => {
    saveTabOrder(['b', 'a']);
    expect(loadTabOrder()).toEqual(['b', 'a']);
    expect(localStorage.getItem(TAB_ORDER_KEY)).toBe('["b","a"]');
  });

  it('无值/坏 JSON/非数组返回空数组，非字符串元素被过滤', () => {
    expect(loadTabOrder()).toEqual([]);
    localStorage.setItem(TAB_ORDER_KEY, '{oops');
    expect(loadTabOrder()).toEqual([]);
    localStorage.setItem(TAB_ORDER_KEY, '{"a":1}');
    expect(loadTabOrder()).toEqual([]);
    localStorage.setItem(TAB_ORDER_KEY, '["a",1,null,"b"]');
    expect(loadTabOrder()).toEqual(['a', 'b']);
  });

  it('写入抛错时不向外抛', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveTabOrder(['a'])).not.toThrow();
  });
});
~~~

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/tabOrder.test.ts`
Expected: FAIL，`Cannot find module './tabOrder'`。

- [ ] **Step 3: 实现 `src/components/tabOrder.ts`**

- `mergeTabOrder`：先遍历 `saved`，保留仍在 `current` 中且未出现过的 id；再遍历 `current`，追加未出现过的 id。
- `sameIds`：长度相同且逐位相等。
- `loadTabOrder`：`try` 解析 localStorage；非数组返回 `[]`；`filter` 掉非字符串元素。
- `saveTabOrder`：`try { localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(ids)) } catch {}`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/tabOrder.test.ts`
Expected: PASS（8 项）。

- [ ] **Step 5: 类型检查**

Run: `pnpm check`
Expected: exit 0。

---

### Task 2: 标签栏等宽布局

**Files:**
- Modify: `src/components/TabBar.tsx`（整文件重写布局部分）
- Modify: `src/App.css`
- Test: `src/components/TabBar.test.tsx`

**Interfaces:**
- Consumes: `Tab` 类型（`{ id, label, icon? }`）。
- Produces: 按钮带 `data-tab-id` 属性；`TabBar` props 暂时保持 `tabs / active / onSelect`。

- [ ] **Step 1: 写失败测试**

~~~tsx
import { render } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import TabBar from './TabBar';

const tabs = Array.from({ length: 9 }, (_, i) => ({ id: 't' + i, label: '标签' + i }));

describe('TabBar 布局', () => {
  it('渲染全部标签且没有展开按钮', () => {
    const { container, queryByTitle } = render(() => (
      <TabBar tabs={tabs} active="t0" onSelect={() => {}} />
    ));
    expect(container.querySelectorAll('[data-tab-id]')).toHaveLength(9);
    expect(queryByTitle('展开')).toBeNull();
    expect(container.querySelector('.tab-bar')).not.toBeNull();
  });

  it('点击标签回调对应 id', () => {
    const picked: string[] = [];
    const { container } = render(() => (
      <TabBar tabs={tabs} active="t0" onSelect={(id) => picked.push(id)} />
    ));
    (container.querySelector('[data-tab-id="t4"]') as HTMLButtonElement).click();
    expect(picked).toEqual(['t4']);
  });
});
~~~

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/TabBar.test.tsx`
Expected: FAIL，找不到 `[data-tab-id]`。

- [ ] **Step 3: 重写 `TabBar.tsx` 与 `.tab-bar` 样式**

- 删除 `expanded / hasOverflow / checkOverflow / ResizeObserver / toggleExpand` 与展开箭头。
- `.tab-bar` 在 App.css 中改为：`display: grid; position: relative; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 2px; padding-block: 4px; max-height: 114px; overflow-y: auto;`。
- 每个按钮：`<button data-tab-id={tab.id}>`，类含 `relative flex h-[34px] items-center justify-center overflow-hidden border text-xs`，文字 `truncate`。
- 激活/非激活/悬停样式沿用 spec §4.1 的颜色值。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/TabBar.test.tsx`
Expected: PASS（2 项）。

- [ ] **Step 5: 手工检查布局**

Run: `pnpm tauri dev`
Expected: 480 宽时 9 个标签两行（6+3）、等宽、无箭头；把窗口拖到 320 宽仍不出现横向滚动。

---

### Task 3: Alt 序号与 Alt+1~9 切换

**Files:**
- Modify: `src/components/TabBar.tsx`（`altHeld` prop 与序号）
- Modify: `src/App.tsx`（`altHeld` signal、键盘监听、Alt+数字）
- Test: `src/components/TabBar.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `data-tab-id` 与布局。
- Produces: `TabBar` 新 prop `altHeld?: boolean`；App 在 keydown 中处理 Alt+数字。

- [ ] **Step 1: 追加失败测试**

~~~tsx
it('按住 Alt 时前 9 个标签显示序号', () => {
  const { container } = render(() => (
    <TabBar tabs={tabs} active="t0" onSelect={() => {}} altHeld />
  ));
  const badges = [...container.querySelectorAll('[data-shortcut]')].map((el) => el.textContent);
  expect(badges).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
});

it('未按 Alt 时不显示序号', () => {
  const { container } = render(() => (
    <TabBar tabs={tabs} active="t0" onSelect={() => {}} />
  ));
  expect(container.querySelectorAll('[data-shortcut]')).toHaveLength(0);
});

it('少于 9 个标签只显示实际数量', () => {
  const { container } = render(() => (
    <TabBar tabs={tabs.slice(0, 3)} active="t0" onSelect={() => {}} altHeld />
  ));
  expect(container.querySelectorAll('[data-shortcut]')).toHaveLength(3);
});
~~~

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/TabBar.test.tsx`
Expected: FAIL，`altHeld` 未被使用、没有 `[data-shortcut]`。

- [ ] **Step 3: 在 `TabBar` 渲染序号**

- `<For each={props.tabs}>` 的回调带 index 访问器；仅当 `props.altHeld && i < 9` 时渲染 `<span data-shortcut class="absolute left-[4px] top-1/2 -translate-y-1/2 text-[10px] text-white/60 pointer-events-none">{i + 1}</span>`。
- 序号绝对定位，不挤动文字；排序态隐藏序号的逻辑在 Task 4 接入。

- [ ] **Step 4: 在 `App.tsx` 接入 Alt**

- `const [altHeld, setAltHeld] = createSignal(false);`
- 现有 keydown：`e.key === 'Alt'` 时置真；新增 Alt+数字分支（`e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^[1-9]$/.test(e.key)`）：`preventDefault()`，按当前 `[...BUILTIN_TABS, ...pluginTabs()]` 顺序取第 N 个，存在则 `setActiveTab`。
- 新增 keyup：`e.key === 'Alt'` 置假；window `blur` 与 `visibilitychange`（`document.hidden`）也置假；与现有监听一起在 `onCleanup` 移除。
- 传 `altHeld={altHeld()}` 给 `TabBar`。

- [ ] **Step 5: 跑测试与类型检查**

Run: `pnpm test src/components/TabBar.test.tsx && pnpm check`
Expected: 全部 PASS / exit 0。

- [ ] **Step 6: 手工冒烟**

Expected: 按住 Alt 出现 1~9；Alt+5 切到第 5 个；松开消失；Alt+Tab 切走再回来不残留；Alt+0 与 Alt+9（标签不足时）无反应。

---

### Task 4: 长按拖动排序与提交

**Files:**
- Create: `src/components/dragSort.ts`
- Test: `src/components/dragSort.test.ts`
- Modify: `src/components/TabBar.tsx`（按下/排序/暂定状态机）
- Modify: `src/App.tsx`（顺序 signal、提交、快捷键门控）
- Modify: `src/App.css`（进度条、排序态、被拖态）

**Interfaces:**
- Consumes: Task 1 的 `mergeTabOrder / sameIds / loadTabOrder / saveTabOrder`；Task 3 的 `altHeld`。
- Produces:
  - `dragSort.ts`：`interface TabRect { id: string; left: number; top: number; width: number; height: number }`、`interface Point { x: number; y: number }`、`dropIndex(rects: readonly TabRect[], point: Point, draggedId: string): number`（返回被拖项应插入「去掉被拖项后的数组」的下标，0..n）。
  - `TabBar` props 追加：`onCommitOrder?: (ids: string[]) => void`、`onSortingChange?: (sorting: boolean) => void`。
  - App 新增 `commitOrder(ids: string[])`。

- [ ] **Step 1: 写 `dropIndex` 失败测试**

~~~ts
import { describe, expect, it } from 'vitest';
import { dropIndex, type TabRect } from './dragSort';

const rect = (id: string, left: number, top = 0): TabRect => ({ id, left, top, width: 100, height: 34 });
const rects = [rect('a', 0), rect('b', 100), rect('c', 200)];

describe('dropIndex', () => {
  it('落在标签左半时插到它前面', () => {
    expect(dropIndex(rects, { x: 120, y: 10 }, 'a')).toBe(0);
  });

  it('落在标签右半时插到它后面', () => {
    expect(dropIndex(rects, { x: 180, y: 10 }, 'a')).toBe(1);
  });

  it('被拖项从候选里剔除', () => {
    expect(dropIndex(rects, { x: 80, y: 10 }, 'b')).toBe(1);
  });

  it('空白处取最近标签', () => {
    expect(dropIndex(rects, { x: 360, y: 10 }, 'a')).toBe(2);
  });

  it('多行时按最近标签所在行判断', () => {
    const rows = [rect('a', 0), rect('b', 100), rect('c', 200), rect('d', 0, 38), rect('e', 100, 38)];
    expect(dropIndex(rows, { x: 40, y: 45 }, 'a')).toBe(2);
  });

  it('结果夹在 0..n', () => {
    expect(dropIndex(rects, { x: -50, y: 10 }, 'a')).toBe(0);
  });
});
~~~

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/dragSort.test.ts`
Expected: FAIL，找不到 `./dragSort`。

- [ ] **Step 3: 实现 `dragSort.ts`**

- 先过滤掉 `draggedId`。
- 找包含指针的 rect；没有则取「中心距离最近」的 rect。
- 命中 rect 在过滤后数组的下标 `i`；指针 x 小于该 rect 水平中点时返回 `i`，否则 `i + 1`；最后夹到 `0..others.length`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/dragSort.test.ts`
Expected: PASS（6 项）。

- [ ] **Step 5: App 接入顺序与提交**

- `const [order, setOrder] = createSignal(loadTabOrder());`
- `const allTabs = () => [...BUILTIN_TABS, ...pluginTabs()];`
- `const orderedTabs = createMemo(() => mergeTabOrder(order(), allTabs().map(t => t.id)).map(id => allTabs().find(t => t.id === id)).filter((t): t is Tab => !!t))`。
- 把现有 Ctrl+Tab 与 Alt+数字里的 `tabs` 换成 `orderedTabs()`；再给两者加 `if (sorting()) return;` 门控。
- `const [sorting, setSorting] = createSignal(false);`；传 `onSortingChange={setSorting}` 与 `onCommitOrder={commitOrder}`。
- `commitOrder(ids)`：`sameIds(order(), ids)` 为真则返回；否则 `setOrder(ids); saveTabOrder(ids);`。

- [ ] **Step 6: TabBar 按下 → 进入排序**

- 本地 `const [draft, setDraft] = createSignal<string[]>(props.tabs.map(t => t.id))`；非排序态用 createEffect 与 props 同步；排序期间 props.tabs 变化时用 `mergeTabOrder(draft(), 新 ids)` 重算（保留相对顺序，新 id 追加末尾）。`sorting`、`pressingId`、`draggingId`、`suppressClick` 也用 signal。
- `pointerdown`（仅主键）：记录 id/起点/rect，`setPointerCapture`，挂 window 级 `pointermove / pointerup` 兜底，启动 2000ms 定时器。
- 长按期间：位移 > 8px、指针离开标签栏 rect、pointerup、blur、Esc 都取消（清定时器与进度）。
- 到点：`sorting = true`、`draggingId = 按下的 id`、快照 `draft` 用于 Esc、`props.onSortingChange?.(true)`；被按标签 `scale(1.03)` + 阴影，其余 `opacity: .4`。
- 进度条：按下期间在被按标签内渲染 `<span class="tab-hold-progress" />`，CSS 用 3s `scaleX(0→1)` 线性动画。

- [ ] **Step 7: 拖动、重排与 FLIP**

- 排序态 pointerdown 记录起点；位移 > 4px 开始拖，`draggingId` 设为该标签；≤4px 保留给 click。
- pointermove 时用 `offsetLeft/offsetTop` + 标签栏 rect/scroll 换算，设置被拖项的 `transform`，不写布局属性。
- 缓存其他标签的布局 rect，用 `dropIndex` 得到目标下标；下标变化才重排 `draft`。
- 重排前后对非拖拽标签取 `offsetLeft/offsetTop` 差，用 `el.animate([{ transform: translate(${dx}px, ${dy}px) }, { transform: 'none' }], { duration: 160, easing: 'cubic-bezier(.22,1,.36,1)' })`；`prefers-reduced-motion: reduce` 时 duration 为 0。

- [ ] **Step 8: 暂定、提交、取消与点击抑制**

- pointerup 结束拖动：`draggingId = null`、保留 `sorting` 与高亮、被拖标签过渡回格子。
- 点击抑制：只有「进入排序的长按」和「位移 > 4px 的拖动」在 pointerup 时置一次性 `suppressClick`；click 消费或下一次 pointerdown 清除。
- click：若 `suppressClick` 为真 → 清除并返回；否则若 `sorting` → `props.onCommitOrder?.(draft())` 后 `props.onSelect(id)`。
- 提交：标签栏外 `pointerdown`（document 捕获，只提交、不 `preventDefault`，让这次点击照常生效）、window `blur`、页面隐藏；`props.onCommitOrder?.(draft())`，清 `sorting` / 高亮 / transform，`props.onSortingChange?.(false)`。
- Esc：`draft` 恢复快照，退出排序，不提交。
- 排序态隐藏 Alt 序号（Task 3 的 `Show` 条件加 `!sorting`）。

- [ ] **Step 9: 类型检查、测试与构建**

Run: `pnpm check && pnpm test && pnpm build`
Expected: 全部通过。

- [ ] **Step 10: 手工冒烟**

Expected（逐条）：
1. 按住标签 2 秒：进度条走满、该标签高亮、其余半透明。
2. 按住后移动 20px（不松手）再等 2 秒：不进入排序。
3. 拖动到另一位置松手：顺序暂定、高亮保留，其他仍半透明。
4. 暂定态再拖另一个标签：直接跟手，不用再等 2 秒。
5. 点面板空白处：提交并恢复外观；刷新/重启后顺序保持。
6. 暂定态点另一个标签（不拖）：提交并切到该标签。
7. Esc：回到进入排序前的顺序。
8. 提交后 Alt+数字与 Ctrl+Tab 按新顺序工作。

---

### Task 5: `moveTask` 模型

**Files:**
- Modify: `src/modules/tasks/model.ts`
- Test: `src/modules/tasks/model.test.ts`

**Interfaces:**
- Consumes: 现有 `Task` 类型与 `groupAndSort`。
- Produces: `moveTask(tasks: Task[], id: string, category: string, now?: number): Task[]`。

- [ ] **Step 1: 追加失败测试**

~~~ts
describe('moveTask', () => {
  it('改分类并刷新 editedAt，其余字段保留', () => {
    const tasks = [t({ id: '1', category: 'A', status: 'doing', urgent: true, note: 'n', editedAt: 5, createdAt: 1 })];
    const out = moveTask(tasks, '1', 'B', 100);
    expect(out[0]).toMatchObject({
      id: '1', category: 'B', status: 'doing', urgent: true, note: 'n', editedAt: 100, createdAt: 1,
    });
  });

  it('同分类、空分类、未知 id 都不改', () => {
    const base = [t({ id: '1', category: 'A', editedAt: 5 })];
    expect(moveTask(base, '1', 'A', 100)[0].editedAt).toBe(5);
    expect(moveTask(base, '1', '   ', 100)[0].editedAt).toBe(5);
    expect(moveTask(base, 'nope', 'B', 100)[0].category).toBe('A');
  });

  it('移走最后一条任务后原分类消失', () => {
    const out = moveTask([t({ id: '1', category: 'A' }), t({ id: '2', category: 'B' })], '1', 'B', 100);
    expect(groupAndSort(out).map((g) => g.name)).toEqual(['B']);
  });
});
~~~

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/tasks/model.test.ts`
Expected: FAIL，`moveTask` 未导出。

- [ ] **Step 3: 实现 `moveTask`**

- `category.trim()` 为空或等于当前分类 → 原样返回。
- 否则用 `mapTask` 只改 `category` 与 `editedAt = now`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/tasks/model.test.ts`
Expected: PASS（新增 3 项）。

---

### Task 6: 任务「移动」二级菜单

**Files:**
- Modify: `src/modules/tasks/TaskCard.tsx`
- Modify: `src/modules/tasks/TasksPanel.tsx`
- Test: `src/modules/tasks/TaskCard.test.tsx`

**Interfaces:**
- Consumes: Task 5 的 `moveTask`；TasksPanel 现有的 `withReorder`。
- Produces: `TaskCard` 新 props `categories: string[]`、`onMove: (id: string, category: string) => void`。

- [ ] **Step 1: 写组件失败测试**

~~~tsx
import { fireEvent, render } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import TaskCard from './TaskCard';
import type { Task } from './model';

const task: Task = {
  id: '1', category: 'A', content: '内容', status: 'todo', urgent: false, note: '', createdAt: 1, editedAt: 1,
};

const makeProps = () => ({
  task,
  categories: ['A', 'B'],
  onStatus: vi.fn(),
  onUrgent: vi.fn(),
  onContent: vi.fn(),
  onNote: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
});

describe('TaskCard 移动菜单', () => {
  it('打开移动菜单并选择其他分类', () => {
    const props = makeProps();
    const { getByText } = render(() => <TaskCard {...props} />);
    fireEvent.click(getByText('⋯'));
    fireEvent.click(getByText('移动'));
    fireEvent.click(getByText('B'));
    expect(props.onMove).toHaveBeenCalledWith('1', 'B');
  });

  it('没有其他分类时显示提示', () => {
    const props = { ...makeProps(), categories: ['A'] };
    const { getByText } = render(() => <TaskCard {...props} />);
    fireEvent.click(getByText('⋯'));
    fireEvent.click(getByText('移动'));
    expect(getByText('暂无其他分类')).toBeTruthy();
  });
});
~~~

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/tasks/TaskCard.test.tsx`
Expected: FAIL，没有「移动」按钮。

- [ ] **Step 3: 在 `TaskCard` 增加移动菜单**

- 一级菜单在「删除」上方加「移动」按钮。
- 点击时读该按钮 `getBoundingClientRect()`，算 `left = Math.max(8, rect.left - 132)`、`top = Math.min(Math.max(8, rect.top), window.innerHeight - 8 - 96)`、`maxHeight = Math.min(200, window.innerHeight - top - 8)`。
- `moveMenu` signal 存 `{ left, top, maxHeight } | null`；渲染 `<div data-task-menu style={{ position: 'fixed', left, top, width: '128px', 'max-height': maxHeight, overflow: 'auto' }}>`。
- 列 `props.categories`：当前分类 `disabled` 并显示「当前」；否则点击即 `setMoveMenu(null); setMenuOpen(false); props.onMove(task.id, name)`。
- 没有其他分类时显示「暂无其他分类」一行。
- 现有外部 pointerdown / Esc 同时关闭 `moveMenu`。

- [ ] **Step 4: `TasksPanel` 接线**

- `const move = (id: string, category: string) => withReorder(() => setTasks(moveTask(tasks(), id, category)));`
- 主列表与完成栏的 `TaskCard` 都传 `categories={groups().map((g) => g.name)}` 与 `onMove={move}`。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test src/modules/tasks/TaskCard.test.tsx`
Expected: PASS（2 项）。

- [ ] **Step 6: 手工冒烟**

Expected: 打开菜单 →「移动」→ 左侧出现分类列表（当前分类置灰）；选另一分类后任务出现在目标分类、时间刷新；移走最后一条后原分类消失；窗口底部/右侧不裁切二级菜单；Esc 与点外部关闭。

---

### Task 7: 文档与整体验收

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README**

- 功能一览的「任务」行补充「`⋯` 菜单可移动到其他分类」。
- 「窗口与系统集成」补充：标签栏等宽、Alt+1~9 切换、长按 2 秒拖动排序（顺序存本地）。
- 跑完 Step 2 后，把「当前测试规模：前端 43 项」改成实际通过数。

- [ ] **Step 2: 全量校验**

Run: `pnpm check && pnpm test && pnpm build`
Expected: 类型检查 exit 0、全部测试通过、构建成功。

- [ ] **Step 3: 对照 spec §8 逐条验收**

Expected：spec 第 8 节 1–5 条全部满足；无新增 npm 依赖、无 Rust 改动、未执行 git 提交。
