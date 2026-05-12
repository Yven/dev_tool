# DevTool

轻量 Windows 桌面开发工具箱，基于 **Tauri 2 + SolidJS + TypeScript + Rust**。

## 项目概况

DevTool 目标是提供常用开发转换工具的一体化桌面体验，当前包含：

- 时间戳转换（支持时间戳/时间字符串、时区切换）
- 编码转换（Unicode/HTML Entity/Percent）
- Base64 编码解码（标准与 URL-safe 模式）
- URL 编解码
- JSON 格式化（压缩、排序、转义、错误定位）
- 全局快捷键唤起（`Ctrl + Alt + D`）

## 技术栈

- 前端：SolidJS + TypeScript + Vite + UnoCSS
- 后端：Rust + Tauri 2
- 测试：Vitest（前端）、Rust Unit Tests

## 环境要求

- Windows 10/11
- Rust 1.77+
- Node.js 20 LTS+
- pnpm 9+
- WebView2（Windows 10 1903+ 一般已内置）

## 安装依赖

```bash
pnpm install
```

## 开发运行

启动前端开发服务：

```bash
pnpm dev
```

启动桌面应用（Tauri）：

```bash
pnpm tauri dev
```

## 常用脚本

```bash
pnpm run check       # TypeScript 检查
pnpm test            # Vitest（无测试文件时也返回通过）
pnpm tauri build     # 生成发布产物
```

## 打包与可执行文件

执行：

```bash
pnpm tauri build
```

主要产物位置：

- `src-tauri/target/release/dev-tool.exe`
- `src-tauri/target/release/bundle/nsis/DevTool_0.1.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/DevTool_0.1.0_x64_en-US.msi`

推荐使用 NSIS 安装包进行分发。

## 目录结构（简化）

```text
src/                    前端代码
  components/           通用组件
  modules/              功能模块（timestamp/base64/json/url/encoding）
src-tauri/              Rust 与 Tauri 代码
  src/commands/         后端命令实现
  tauri.conf.json       Tauri 配置
plugins/                外部插件目录
tests/                  测试目录
```

## 开发者信息

- 开发者：Yven
- 联系方式：yvenchang@163.com

