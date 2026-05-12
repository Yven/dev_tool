import { createEffect, createSignal, JSX, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import InputArea from '../../components/InputArea';
import OutputArea from '../../components/OutputArea';

interface EncodingResult {
  output: string;
  detected_type: string;
}

export default function EncodingPanel(): JSX.Element {
  const [input, setInput] = createSignal('');
  const [direction, setDirection] = createSignal<'decode' | 'encode'>('decode');
  const [result, setResult] = createSignal<EncodingResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const cacheKey = 'cache:encoding:input';

  onMount(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) setInput(cached);
  });

  createEffect(() => {
    localStorage.setItem(cacheKey, input());
  });

  const convert = async () => {
    if (!input().trim()) {
      setResult(null);
      return;
    }
    try {
      const r = await invoke<EncodingResult>('cmd_encoding_convert', {
        input: input(),
        direction: direction(),
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
      <InputArea value={input} onInput={setInput} placeholder="输入待转换文本..." />

      <div class="flex gap-2 items-center">
        <button
          class="px-3 py-1 text-xs text-white rounded border border-border transition-colors"
          classList={{
            'bg-primary text-white border-primary': direction() === 'decode',
            'hover:border-primary': direction() !== 'decode',
          }}
          onclick={() => setDirection('decode')}
        >
          解码
        </button>
        <button
          class="px-3 py-1 text-xs text-white rounded border border-border transition-colors"
          classList={{
            'bg-primary text-white border-primary': direction() === 'encode',
            'hover:border-primary': direction() !== 'encode',
          }}
          onclick={() => setDirection('encode')}
        >
          编码
        </button>
        <button
          class="ml-auto px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/80"
          onclick={convert}
        >
          转换
        </button>
      </div>

      {result() && (
        <div class="flex flex-col gap-2">
          <div class="text-xs text-text-dim">
            检测类型: <span class="text-primary">{result()!.detected_type}</span>
          </div>
          <OutputArea value={() => result()!.output} label="转换结果" />
        </div>
      )}

      {error() && (
        <div class="p-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded">
          {error()}
        </div>
      )}
    </div>
  );
}
