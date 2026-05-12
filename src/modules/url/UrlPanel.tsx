import { createEffect, createSignal, JSX, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import InputArea from '../../components/InputArea';
import OutputArea from '../../components/OutputArea';

interface UrlResult {
  output: string;
  line_count: number;
}

export default function UrlPanel(): JSX.Element {
  const [input, setInput] = createSignal('');
  const [result, setResult] = createSignal<UrlResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [mode, setMode] = createSignal<'encode' | 'decode'>('encode');
  const cacheKey = 'cache:url:input';

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
      const r = await invoke<UrlResult>('cmd_url_encode', { input: input() });
      setResult(r);
      setError(null);
      setMode('encode');
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  const decode = async () => {
    if (!input().trim()) return;
    try {
      const r = await invoke<UrlResult>('cmd_url_decode', { input: input() });
      setResult(r);
      setError(null);
      setMode('decode');
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  return (
    <div class="flex flex-col gap-3">
      <InputArea value={input} onInput={setInput} placeholder="输入待编解码文本（支持多行）..." />

      <div class="flex gap-2">
        <button
          class="px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/80"
          onclick={encode}
        >
          编码
        </button>
        <button
          class="px-3 py-1 text-xs text-white rounded bg-surface-alt border border-border hover:border-primary"
          onclick={decode}
        >
          解码
        </button>
      </div>

      {error() && (
        <div class="p-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded">
          {error()}
        </div>
      )}

      {result() && (
        <div class="flex flex-col gap-2">
          <div class="text-xs text-text-dim">
            {mode() === 'encode' ? '编码' : '解码'}结果
            {result()!.line_count > 1 && ` (${result()!.line_count} 行)`}
          </div>
          <OutputArea value={() => result()!.output} label="" />
        </div>
      )}
    </div>
  );
}
