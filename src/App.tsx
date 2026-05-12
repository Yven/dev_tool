import { createSignal, JSX, Show, onCleanup, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getVersion, getTauriVersion } from '@tauri-apps/api/app';
import { isEnabled, enable, disable } from '@tauri-apps/plugin-autostart';
import TabBar from './components/TabBar';
import TimestampPanel from './modules/timestamp/TimestampPanel';
import EncodingPanel from './modules/encoding/EncodingPanel';
import Base64Panel from './modules/base64/Base64Panel';
import UrlPanel from './modules/url/UrlPanel';
import JsonPanel from './modules/json/JsonPanel';
import PluginSlot from './plugin/PluginSlot';
import Toast from './components/Toast';
import './app.css';

const BUILTIN_TABS = [
  { id: 'timestamp', label: '时间戳', icon: 'i-carbon-time' },
  { id: 'encoding', label: '编码', icon: 'i-carbon-code' },
  { id: 'base64', label: 'Base64', icon: 'i-carbon-character-whole-number' },
  { id: 'url', label: 'URL', icon: 'i-carbon-link' },
  { id: 'json', label: 'JSON', icon: 'i-carbon-json' },
];

interface PluginTab {
  id: string;
  label: string;
  icon?: string;
}

export default function App(): JSX.Element {
  const [activeTab, setActiveTab] = createSignal('timestamp');
  const [pluginTabs, setPluginTabs] = createSignal<PluginTab[]>([]);
  const [showAbout, setShowAbout] = createSignal(false);
  const [appVersion, setAppVersion] = createSignal('unknown');
  const [tauriVersion, setTauriVersion] = createSignal('unknown');
  const [alwaysOnTop, setAlwaysOnTop] = createSignal(false);
  const [autostart, setAutostart] = createSignal(false);

  onMount(async () => {
    try {
      const [v, tv] = await Promise.all([getVersion(), getTauriVersion()]);
      setAppVersion(v);
      setTauriVersion(tv);
      const current = await getCurrentWindow().isAlwaysOnTop();
      setAlwaysOnTop(current);
      setAutostart(await isEnabled());
    } catch (e) {
      console.error('Load version failed:', e);
    }

    // 监听插件加载事件
    const unlistenLoaded = await listen('plugin-loaded', (event) => {
      const plugin = event.payload as { id: string; name: string };
      setPluginTabs((prev) => {
        const tabId = `plugin:${plugin.id}`;
        if (prev.some((t) => t.id === tabId)) return prev;
        return [...prev, { id: tabId, label: plugin.name }];
      });
    });

    const unlistenUnloaded = await listen('plugin-unloaded', (event) => {
      const plugin = event.payload as { id: string };
      setPluginTabs((prev) => prev.filter((t) => t.id !== `plugin:${plugin.id}`));
    });

    const unlistenShowAbout = await listen('show-about', () => {
      setShowAbout(true);
    });

    onCleanup(() => {
      unlistenLoaded();
      unlistenUnloaded();
      unlistenShowAbout();
    });
  });

  const toggleAutostart = async () => {
    try {
      const next = !autostart();
      if (next) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(next);
    } catch (e) {
      console.error('Toggle autostart failed:', e);
    }
  };

  const hideWindow = async () => {
    try {
      await invoke('hide_window');
    } catch (e) {
      console.error('Hide window failed:', e);
    }
  };

  const quitApp = async () => {
    try {
      await invoke('quit');
    } catch (e) {
      console.error('Quit failed:', e);
    }
  };

  const startDragWindow = async (event: MouseEvent) => {
    if (event.button !== 0) return;
    try {
      await getCurrentWindow().startDragging();
    } catch (e) {
      console.error('Start dragging failed:', e);
    }
  };

  const toggleAlwaysOnTop = async () => {
    try {
      const next = !alwaysOnTop();
      await getCurrentWindow().setAlwaysOnTop(next);
      setAlwaysOnTop(next);
    } catch (e) {
      console.error('Toggle always-on-top failed:', e);
    }
  };

  return (
    <div class="h-screen w-screen flex flex-col bg-surface text-text select-none">
      {/* 自定义标题栏 */}
      <div class="h-8 flex items-center bg-surface-alt border-b border-border">
        <div class="h-full flex-1 flex items-center px-3 cursor-move" onMouseDown={startDragWindow}>
          <span class="text-xs text-text-dim">DevTool</span>
        </div>
        <div class="pr-2 flex gap-1">
          <button
            class="w-6 h-6 flex items-center justify-center rounded border border-border transition-colors"
            classList={{
              'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30': alwaysOnTop(),
              'bg-surface-alt text-text-dim hover:text-text hover:bg-surface': !alwaysOnTop(),
            }}
            onclick={toggleAlwaysOnTop}
            title={alwaysOnTop() ? '取消置顶' : '窗口置顶'}
          >
            📌
          </button>
          <button
            class="w-6 h-6 flex items-center justify-center rounded bg-surface-alt text-text-dim border border-border hover:text-text hover:bg-surface transition-colors"
            onclick={() => setShowAbout(true)}
            title="关于"
          >
            ?
          </button>
          <button
            class="w-6 h-6 flex items-center justify-center rounded bg-surface-alt text-text-dim border border-border hover:text-text hover:bg-surface transition-colors"
            onclick={hideWindow}
            title="隐藏"
          >
            ─
          </button>
          <button
            class="w-6 h-6 flex items-center justify-center rounded bg-surface-alt text-text-dim border border-border hover:text-red-400 hover:bg-red-400/10 transition-colors"
            onclick={quitApp}
            title="关闭"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 标签栏 */}
      <TabBar tabs={[...BUILTIN_TABS, ...pluginTabs()]} active={activeTab()} onSelect={setActiveTab} />

      {/* 面板区域：保持挂载，切换时保留状态/输出 */}
      <div class="flex-1 overflow-auto p-3">
        <div style={{ display: activeTab() === 'timestamp' ? 'block' : 'none' }}>
          <TimestampPanel />
        </div>
        <div style={{ display: activeTab() === 'encoding' ? 'block' : 'none' }}>
          <EncodingPanel />
        </div>
        <div style={{ display: activeTab() === 'base64' ? 'block' : 'none' }}>
          <Base64Panel />
        </div>
        <div style={{ display: activeTab() === 'url' ? 'block' : 'none' }}>
          <UrlPanel />
        </div>
        <div style={{ display: activeTab() === 'json' ? 'block' : 'none' }}>
          <JsonPanel />
        </div>
        <Show when={activeTab().startsWith('plugin:')}>
          <PluginSlot id={activeTab()} />
        </Show>
      </div>

      <Toast />

      <Show when={showAbout()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => setShowAbout(false)}>
          <div class="w-[360px] rounded border border-border bg-surface-alt p-4 text-sm text-text" onclick={(e) => e.stopPropagation()}>
            <div class="mb-3 text-base font-semibold">关于 DevTool</div>
            <div class="space-y-1 text-xs leading-5">
              <div>当前工具版本：{appVersion()}</div>
              <div>框架版本：Tauri {tauriVersion()}</div>
              <div>开发者：Yven</div>
              <div>开发者联系方式：yvenchang@163.com</div>
              <div>全局触发键：Ctrl+Alt+D</div>
              <div class="flex items-center justify-between mt-2 pt-2 border-t border-border">
                <span>开机自启</span>
                <button
                  class="px-2 py-0.5 text-xs rounded border transition-colors"
                  classList={{
                    'bg-primary/20 text-primary border-primary/40': autostart(),
                    'bg-surface text-text-dim border-border hover:border-primary': !autostart(),
                  }}
                  onclick={toggleAutostart}
                >
                  {autostart() ? '已开启' : '未开启'}
                </button>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <button class="px-3 py-1 text-xs rounded border border-border hover:border-primary" onclick={() => setShowAbout(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
