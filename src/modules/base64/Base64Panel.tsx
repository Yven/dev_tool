import { createEffect, createSignal, JSX, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import InputArea from '../../components/InputArea';
import OutputArea from '../../components/OutputArea';

interface Base64Result {
  output: string;
}

export default function Base64Panel(): JSX.Element {
  const [input, setInput] = createSignal('');
  const [result, setResult] = createSignal<Base64Result | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [mode, setMode] = createSignal<'encode' | 'decode'>('encode');
  const [safeMode, setSafeMode] = createSignal<'standard' | 'urlsafe'>('standard');
  const cacheKey = 'cache:base64:input';

  onMount(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) setInput(cached);
  });

  createEffect(() => {
    localStorage.setItem(cacheKey, input());
  });

  const encode = async () => {
    if (!input().trim()) return;
    try {
      const r = await invoke<Base64Result>('cmd_base64_encode', { input: input(), mode: safeMode() });
      setResult(r);
      setMode('encode');
      setError(null);
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  const decode = async () => {
    if (!input().trim()) return;
    try {
      const r = await invoke<Base64Result>('cmd_base64_decode', { input: input(), mode: safeMode() });
      setResult(r);
      setMode('decode');
      setError(null);
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  return (
    <div class="flex flex-col gap-3">
      <InputArea value={input} onInput={setInput} placeholder="输入待转换文本..." />

      <div class="flex gap-2">
        <button
          class="px-3 py-1 text-xs text-white rounded bg-primary hover:bg-primary/80"
          onclick={encode}
        >
          Base64 编码
        </button>
        <button
          class="px-3 py-1 text-xs text-white rounded bg-surface-alt border border-border hover:border-primary"
          onclick={decode}
        >
          Base64 解码
        </button>
        <button
          class="ml-auto px-3 py-1 text-xs text-white rounded border border-border transition-colors"
          classList={{
            'bg-primary border-primary': safeMode() === 'urlsafe',
            'bg-surface-alt hover:border-primary': safeMode() !== 'urlsafe',
          }}
          onclick={() => setSafeMode(safeMode() === 'urlsafe' ? 'standard' : 'urlsafe')}
          title="切换 URL-safe(-/_）模式"
        >
          {safeMode() === 'urlsafe' ? 'URL-safe(-/_)' : '标准(+/)'}
        </button>
      </div>

      {error() && (
        <div class="p-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded">
          {error()}
        </div>
      )}

      {result() && (
        <OutputArea
          value={() => result()!.output}
          label={mode() === 'encode'
            ? `Base64 ${safeMode() === 'urlsafe' ? 'URL-safe' : '标准'} 编码结果`
            : `Base64 ${safeMode() === 'urlsafe' ? 'URL-safe' : '标准'} 解码结果`}
        />
      )}
    </div>
  );
}
