import { JSX, onMount, onCleanup, createSignal, Show } from 'solid-js';
import { createPluginSDK } from './sdk';

interface Props {
  id: string;
}

export default function PluginSlot(props: Props): JSX.Element {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  let containerRef: HTMLDivElement | undefined;
  let pluginDestroy: (() => void) | undefined;

  onMount(async () => {
    if (!containerRef) return;

    const pluginName = props.id.replace('plugin:', '');
    const sdk = createPluginSDK(props.id);

    try {
      // 动态加载插件 JS
      const module = await import(`/plugins/${pluginName}.js`);
      const plugin = module.default;

      if (typeof plugin.render !== 'function') {
        throw new Error('Plugin missing render function');
      }

      plugin.render(containerRef, sdk);
      pluginDestroy = plugin.destroy;
      setLoading(false);
    } catch (e) {
      setError(`加载插件失败: ${e}`);
      setLoading(false);
    }
  });

  onCleanup(() => {
    pluginDestroy?.();
  });

  return (
    <div class="w-full h-full relative">
      <Show when={loading()}>
        <div class="absolute inset-0 flex items-center justify-center text-text-dim text-xs">
          加载插件中...
        </div>
      </Show>
      <Show when={error()}>
        <div class="p-4 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded m-2">
          {error()}
        </div>
      </Show>
      <div ref={containerRef} class="w-full h-full" />
    </div>
  );
}
