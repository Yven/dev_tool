# DevTool v0.1 ToDoList（基于《具体落地方案》）

生成时间：2026-05-11
检查范围：当前仓库代码与目录（未执行 GUI 手工验收）

## 一、实施步骤检查

### Step 1：项目脚手架搭建
- [x] 2.1 初始化 Tauri + SolidJS 项目（目录结构与基础文件齐全）
- [x] 2.2 安装前端依赖（package.json 已包含核心依赖）
- [x] 2.3 Rust 侧依赖（Cargo.toml 已包含方案核心依赖）
- [~] 2.4 关键配置文件（基本完成；`vite.config.ts` 未按方案设置 `minify: 'terser'`）
- [x] 2.5 目录结构创建完成（含 `src-tauri/src/*`、`src/modules/*`、`plugins`、`tests`）

### Step 2：Rust 核心骨架
- [x] 3.1 `main.rs` 入口完成
- [~] 3.2 `lib.rs` 插件注册与命令挂载基本完成（热键注册方式与方案不同）
- [x] 3.3 `commands/timestamp.rs` 已实现并含测试
- [x] 3.4 `commands/encoding.rs` 已实现（检测 + 编解码）
- [x] 3.5 `commands/url.rs` 已实现（RFC3986 + 多行）
- [x] 3.6 `commands/json_fmt.rs` 已实现（格式化/压缩/排序/Unicode/错误行号）
- [~] 3.7 `hotkey/manager.rs` 部分完成（有 `toggle_window`，但无方案中的 `register_default`）
- [x] 3.8 `window/edge_hide.rs` 已接入（贴边收缩 + 鼠标移入触发条展开）
- [x] 3.9 `plugin_loader` 已实现启动扫描 + 轮询监听增删事件
- [x] 3.10 `capabilities/default.json` 已配置

### Step 3：前端核心骨架
- [x] 4.1 `App.tsx` 完成（Tab、面板切换、窗口命令调用、插件事件监听）
- [x] 4.2 `components/CopyButton.tsx` 完成
- [x] 4.3 `components/InputArea.tsx` 完成
- [x] 4.4 `components/OutputArea.tsx` 完成
- [x] 4.5 `modules/timestamp/TimestampPanel.tsx` 完成
- [x] 4.6 `modules/json/JsonPanel.tsx` UI完成（依赖后端未实现命令）
- [x] 4.7 `plugin/sdk.ts` 完成（`plugin_storage_get/set` 后端已补齐）
- [x] 4.8 `plugin/PluginSlot.tsx` 完成（动态加载 + 销毁）

### Step 4：tauri.conf.json 配置
- [x] 完成（窗口、构建、bundle 等核心项已配置）

### 运行修正记录（2026-05-11）
- [x] 移除未配置 updater 导致的启动崩溃点（已取消 `lib.rs` 中 `tauri-plugin-updater` 初始化）
- [x] 解决构建下载超时：使用 `TAURI_BUNDLER_TOOLS_GITHUB_MIRROR_TEMPLATE` 镜像完成 NSIS/WiX 下载与打包

### Step 5：package.json scripts
- [x] 完成（已补 `lint` script）

## 二、验收 Checklist 检查

- [ ] `pnpm tauri dev` 启动 ≤ 800ms（已实测，Vite `ready in 1314ms`，未达标）
- [~] Ctrl+Shift+Space 唤出/隐藏窗口（代码已接入，未实机验证）
- [~] 窗口贴边自动缩为 3px 触发条（已接入逻辑，待实机验证）
- [~] 鼠标移入触发条窗口展开（已接入 `onMouseEnter -> expand_from_trigger`，待实机验证）
- [x] 时间戳模块（秒/毫秒/微秒、UTC/本地、RFC3339/ISO8601/Excel）
- [x] 编码模块（`\uXXXX` / `&#x` / `%XX` 检测与转换）
- [x] URL 模块（RFC3986 + 多行）
- [x] JSON 模块（格式化 + 压缩 + 排序 + Unicode转义 + 错误行号）
- [~] 插件自动加载/卸载（事件名已统一，当前为轮询监听）
- [ ] 内存 ≤ 35MB（未验证）
- [x] `pnpm tauri build` NSIS 安装包 ≤ 8MB（`DevTool_0.1.0_x64-setup.exe` = 2.58MB）
- [x] `cargo test` 全部通过
- [x] `pnpm test` 全部通过（当前无测试文件，`--passWithNoTests`）
- [x] `pnpm run check` 通过（TypeScript 无报错）

## 三、优先待办（建议按顺序）

- [x] 实现 `src-tauri/src/commands/url.rs`（RFC3986 + 多行）
- [x] 实现 `src-tauri/src/commands/json_fmt.rs`（格式化/压缩/排序/Unicode/错误行号）
- [x] 补齐后端命令：`hide_window`、`quit`、`plugin_storage_get`、`plugin_storage_set`
- [x] 统一插件事件名（使用 `plugin-loaded` / `plugin-unloaded`）
- [x] 将 `edge_hide` 接入窗口事件与展开/收缩触发逻辑
- [x] 修复测试执行权限问题后重跑：`cargo test`、`pnpm test`
- [x] 补 `lint` script（若保持与方案一致）

## 四、问题修复（2026-05-11）

- [~] 无法拖动窗口（已改为 `startDragging`，待实机确认）
- [x] 时间戳、编码、URL、JSON、最小化、关闭控件背景与暗色主题不一致
- [x] 输入框文本在暗色背景下可读性差
- [x] 时间戳输入框默认无值时未动态显示当前时间戳
- [~] 最小化后无法通过任务栏唤回（已改为 `minimize`，待实机确认）
- [x] 输出框支持鼠标框选并复制部分内容

## 五、本轮需求（2026-05-11）

- [x] 时间戳、编码、URL、JSON 选项框未选中字体改为白色
- [x] 时间戳删除显示：毫秒、微秒、ISO8601、Excel
- [x] 时间戳支持输入时间戳或时间字符串（如 `2026-05-11 19:55:22`）
- [x] 时间戳支持选择全球时区（UTC 偏移列表）
- [x] 删除窗口贴边功能
- [~] 注册全局触发键 `Ctrl+Alt+D`，触发后在显示和最小化之间切换（代码完成，待实机确认）
- [x] 最小化按钮旁增加 `?` 按钮，显示框架版本、开发者、联系方式、全局触发键
- [x] 禁止非显示框和输入框的鼠标拖动文本选中
- [x] 减小滚动条大小
- [x] 增加输入内容缓存记录（时间戳/编码/URL/JSON）
