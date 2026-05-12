# DevTool v0.1

Windows 桌面轻量级辅助工具 — 秒级启动、极低内存、插件式扩展。

## Tech Stack

- **Desktop**: Tauri v2 (Rust + WebView2)
- **Frontend**: SolidJS + TypeScript + UnoCSS + Vite
- **State**: Solid Signals (no external store)
- **Test**: Vitest (unit) + Playwright (e2e) + cargo test (Rust)
- **Package Manager**: pnpm

## Project Structure

```
src-tauri/          # Rust backend (Tauri Commands + plugins)
  src/commands/     # Core logic: timestamp, encoding, url, json_fmt
  src/plugin_loader/# Plugin scanner, registry, sandbox
  src/window/       # Edge hide, multi-monitor
  src/hotkey/       # Global shortcut manager
src/                # Frontend (SolidJS)
  components/       # Shared UI: TabBar, CopyButton, InputArea, OutputArea, Toast
  modules/          # 4 built-in modules: timestamp, encoding, url, json
  plugin/           # PluginSlot, SDK, loader
  stores/           # App state (Solid Signals)
  hooks/            # useClipboard, useInvoke
plugins/            # Runtime plugin directory (user drops .js files)
tests/              # e2e/ + perf/
```

## Key Architecture Decisions

1. **Computation in Rust** — All conversion/formatting logic via Tauri Commands, frontend only renders UI
2. **iframe sandbox for plugins** — Full isolation, PluginSDK exposes clipboard/storage/invoke
3. **Solid Signals for state** — Native fine-grained reactivity, zero extra dependencies
4. **UnoCSS** — Zero-runtime atomic CSS, minimal output (~2-5KB)

## Tauri Plugins Used

global-shortcut, single-instance, clipboard-manager, fs, window-state, updater, process, positioner

## Performance Targets

- Cold start: ≤ 800ms (HDD)
- Hot start: ≤ 300ms
- Memory: ≤ 35MB (no plugins)
- Installer: ≤ 8MB

## Commands

```bash
pnpm install          # Install dependencies
pnpm tauri dev        # Dev mode (Vite HMR + Tauri)
pnpm tauri build      # Production build (NSIS + MSI)
pnpm test             # Vitest unit tests
cargo test            # Rust unit tests
```

## Built-in Modules (v0.1)

| Module | Rust Command | Description |
|--------|-------------|-------------|
| Timestamp | cmd_timestamp_convert | s/ms/us conversion, timezone, RFC3339/ISO8601/Unix/Excel |
| Encoding | cmd_encoding_convert | \uXXXX/&#x/%E auto-detect, bidirectional |
| URL | cmd_url_encode/decode | RFC 3986, configurable safe chars, batch |
| JSON | cmd_json_format | Error line number, compress/sort/unicode-escape |

## Plugin Spec

```typescript
export default {
  id: string,
  name: string,
  version: string,
  icon: string,
  render: (container: HTMLElement, sdk: PluginSDK) => void,
  destroy: () => void
}
```

Single file, ESModule, ≤ 200KB, hot-pluggable via plugins/ directory.
