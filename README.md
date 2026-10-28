# DevTool

轻量 Windows 桌面开发工具箱 —— 随叫随到的快捷键面板：秒级启动、极低内存、无边框界面、插件式扩展。

基于 **Tauri 2 + SolidJS + TypeScript + Rust**，当前版本 **0.3.1**。

## 功能一览

### 内置模块

| 模块 | 能力 |
|---|---|
| 时间戳 | 时间戳（s/ms/us）与时间字符串互转、时区切换，输出秒级时间戳 / RFC3339 / 输入与时区时间 |
| 编码 | `\uXXXX`、`&#x...;`、`%E4%B8%AD` 自动识别方向互转 |
| Base64 | 文本编解码，标准与 URL-safe（`-`/`_`）模式切换 |
| URL | RFC 3986 编解码，支持多行批量处理 |
| JSON | 格式化 / 压缩 / 键排序 / Unicode 转义，解析错误带行号定位 |
| 随机数 | 大小写字母、数字、符号自由组合，长度 4–128 |
| 替换 | 批量文本替换并统计替换处数 |
| 笔记 | 多缓冲区编辑、语法高亮、语言/字体/字号设置、回收站，内容保存在本地 |
| 任务 | 任务追踪面板，详见下节 |

### 任务模块

- 顶部多行输入：**第一行是分类**，第二行起是任务内容，`Ctrl + Enter` 提交
- 四态状态：未开始 / 规划 / 进行中 / 完成，可任意切换，卡片底色随状态变化
- 状态下方显示最后编辑时间；编辑内容会刷新排序，**编辑备注不会**
- 左侧 `⚠️` 标记紧急任务（悬停显现、点击固定），列表与分类内均置顶，并加红色外框
- 排序：紧急 > 进行中 > 其余，同层按编辑时间倒序；分类按其中最新编辑时间倒序
- 完成后自动收进该分类的「完成」折叠栏，仍可调整状态
- 任务内容与备注均支持 Markdown 渲染（链接用系统浏览器打开）
- 双击内容就地编辑、备注就地编辑、`⋯` 菜单删除（二次确认）

### 窗口与系统集成

- 无边框窗口 + 自定义标题栏：窗口置顶、隐藏、关闭
- 全局快捷键 `Ctrl + Alt + D`：显示 / 最小化切换
- 开机自启开关、「关于」弹窗（展示应用与 Tauri 版本）
- 标签页切换时各面板保持挂载，输入与输出不丢失

### 插件系统

`plugins/` 目录下放置单文件 ESModule 即可扩展新标签页，插件运行在 iframe 沙箱中，通过 PluginSDK 访问剪贴板、本地存储与后端命令。

## 技术栈

- 前端：SolidJS + TypeScript + Vite + UnoCSS
- 后端：Rust + Tauri 2
- 测试：Vitest（前端，jsdom）+ Cargo test（Rust）

## 环境要求

- Windows 10/11
- Node.js 20 LTS+、pnpm 9+
- Rust stable（Tauri 2 要求 1.77+）
- WebView2（Windows 10 1903+ 一般已内置）

## 快速开始

```bash
pnpm install        # 安装依赖
pnpm dev            # 仅启动前端开发服务（http://localhost:5173）
pnpm tauri dev      # 启动桌面应用（热更新）
```

## 常用脚本

```bash
pnpm check          # TypeScript 类型检查
pnpm test           # Vitest 单元测试
pnpm build          # 前端生产构建
pnpm tauri build    # 打 Windows 安装包（release）
```

当前测试规模：前端 43 项、Rust 28 项，提交前建议依次执行 `pnpm check && pnpm test && pnpm build`。

## 打包与产物

```bash
pnpm tauri build
```

产物位置（以 0.3.1 为例）：

- `src-tauri/target/release/dev-tool.exe`
- `src-tauri/target/release/bundle/nsis/DevTool_0.3.1_x64-setup.exe`（推荐分发）
- `src-tauri/target/release/bundle/msi/DevTool_0.3.1_x64_en-US.msi`

> 编译前请先退出正在运行的 DevTool，否则 release 目录中的 `dev-tool.exe` 被占用会导致构建失败（`os error 5`）。

版本号需同步修改四处：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.lock`（`dev-tool` 条目）；「关于」弹窗通过 `getVersion()` 运行时读取，无需另改。

## 数据存储

应用数据位于 Tauri `app_data_dir`（Windows 下为 `%APPDATA%\com.devtool.app`）：

- `notes/`：笔记索引与内容
- `tasks/tasks.json`：任务数据（整体 JSON 覆盖写）
- 其余模块的临时输入缓存在 WebView localStorage（`cache:` 前缀）

## 目录结构

```text
src/                     前端
  App.tsx                标题栏、标签栏与内置面板挂载
  app.css                主题变量与全局样式
  components/            TabBar / InputArea / OutputArea / CopyButton / Toast
  modules/               timestamp、encoding、base64、url、json、random、replace、notes、tasks
  plugin/                PluginSlot（iframe 沙箱）与 PluginSDK
src-tauri/               Rust 后端
  src/commands/          Tauri Commands：timestamp、encoding、base64、url、json_fmt、random、replace、notes、tasks、config
  src/plugin_loader/     插件扫描、注册表与沙箱常量
  src/window/            多显示器与窗口定位
  src/hotkey/            全局快捷键管理
  tauri.conf.json        窗口、CSP、打包配置
plugins/                 运行时插件目录（用户放置 .js）
docs/                    设计与实施文档
```

## 插件开发

插件为单个 ESModule 文件，放入 `plugins/` 即热插拔：

```ts
export default {
  id: string,
  name: string,
  version: string,
  icon: string,
  render: (container: HTMLElement, sdk: PluginSDK) => void,
  destroy: () => void,
};
```

`PluginSDK` 提供 `clipboard.readText/writeText`、`storage.get/set`、`invoke(cmd, args)`。单文件体积上限 200KB。

## 常见问题

- **构建报「拒绝访问 / os error 5」**：先退出正在运行的 DevTool 再打包。
- **热键无响应**：`Ctrl + Alt + D` 可能被其他程序占用，关闭冲突程序后重启应用。
- **数据想重置**：删除 `%APPDATA%\com.devtool.app` 下对应目录即可（不可恢复）。

## 开发者信息

- 开发者：Yven
- 联系方式：yvenchang@163.com
