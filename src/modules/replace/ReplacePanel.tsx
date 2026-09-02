import { createEffect, createSignal, JSX, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import InputArea from '../../components/InputArea';
import OutputArea from '../../components/OutputArea';

interface ReplaceResult {
  output: string;
  count: number;
}

const CACHE_KEY = 'cache:replace:settings';

export default function ReplacePanel(): JSX.Element {
  const [input, setInput] = createSignal('');
  const [search, setSearch] = createSignal('');
  const [replacement, setReplacement] = createSignal('');
  const [result, setResult] = createSignal<ReplaceResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const s = JSON.parse(cached);
        setInput(s.input ?? '');
        setSearch(s.search ?? '');
        setReplacement(s.replacement ?? '');
      } catch { /* ignore */ }
    }
  });

  createEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      input: input(),
      search: search(),
      replacement: replacement(),
    }));
  });

  const doReplace = async (replaceAll: boolean) => {
    try {
      const r = await invoke<ReplaceResult>('cmd_text_replace', {
        input: input(),
        search: search(),
        replacement: replacement(),
        replace_all: replaceAll,
      });
      setResult(r);
      setError(null);
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  return (
    <div class="flex flex-col gap-3">
      <InputArea value={input} onInput={setInput} placeholder="输入文本..." />

      <div class="flex items-center gap-2">
        <input
          type="text"
          class="flex-1 min-w-0 px-2 py-1 text-sm bg-surface-alt border border-border rounded outline-none focus:border-primary font-mono select-text"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          placeholder="搜索文本"
        />
        <span class="text-xs text-text-dim">→</span>
        <input
          type="text"
          class="flex-1 min-w-0 px-2 py-1 text-sm bg-surface-alt border border-border rounded outline-none focus:border-primary font-mono select-text"
          value={replacement()}
          onInput={(e) => setReplacement(e.currentTarget.value)}
          placeholder="替换文本"
        />
      </div>

      <button
        class="px-3 py-1.5 text-xs text-white rounded bg-primary hover:bg-primary/80 transition-colors"
        onclick={() => doReplace(true)}
      >
        全部替换
      </button>

      {error() && (
        <div class="p-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded">
          {error()}
        </div>
      )}

      {result() && (
        <OutputArea
          value={() => result()!.output}
          label={`替换结果（${result()!.count} 处替换）`}
        />
      )}
    </div>
  );
}
