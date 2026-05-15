import { createEffect, createSignal, JSX, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import OutputArea from '../../components/OutputArea';

interface RandomResult {
  output: string;
}

const CACHE_KEY = 'cache:random:settings';

export default function RandomPanel(): JSX.Element {
  const [uppercase, setUppercase] = createSignal(true);
  const [lowercase, setLowercase] = createSignal(true);
  const [digits, setDigits] = createSignal(true);
  const [symbols, setSymbols] = createSignal(false);
  const [length, setLength] = createSignal(16);
  const [result, setResult] = createSignal<RandomResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const s = JSON.parse(cached);
        setUppercase(s.uppercase ?? true);
        setLowercase(s.lowercase ?? true);
        setDigits(s.digits ?? true);
        setSymbols(s.symbols ?? false);
        setLength(s.length ?? 16);
      } catch { /* ignore */ }
    }
  });

  createEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      uppercase: uppercase(),
      lowercase: lowercase(),
      digits: digits(),
      symbols: symbols(),
      length: length(),
    }));
  });

  const generate = async () => {
    try {
      const r = await invoke<RandomResult>('cmd_random_generate', {
        length: length(),
        uppercase: uppercase(),
        lowercase: lowercase(),
        digits: digits(),
        symbols: symbols(),
      });
      setResult(r);
      setError(null);
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  const toggle = (getter: () => boolean, setter: (v: boolean) => void) => {
    setter(!getter());
  };

  return (
    <div class="flex flex-col gap-3">
      <div class="flex gap-2 flex-wrap">
        <button
          class="px-3 py-1 text-xs rounded border transition-colors"
          classList={{
            'bg-primary/20 text-primary border-primary/40': uppercase(),
            'bg-surface-alt text-text-dim border-border hover:border-primary': !uppercase(),
          }}
          onclick={() => toggle(uppercase, setUppercase)}
        >
          大写 A-Z
        </button>
        <button
          class="px-3 py-1 text-xs rounded border transition-colors"
          classList={{
            'bg-primary/20 text-primary border-primary/40': lowercase(),
            'bg-surface-alt text-text-dim border-border hover:border-primary': !lowercase(),
          }}
          onclick={() => toggle(lowercase, setLowercase)}
        >
          小写 a-z
        </button>
        <button
          class="px-3 py-1 text-xs rounded border transition-colors"
          classList={{
            'bg-primary/20 text-primary border-primary/40': digits(),
            'bg-surface-alt text-text-dim border-border hover:border-primary': !digits(),
          }}
          onclick={() => toggle(digits, setDigits)}
        >
          数字 0-9
        </button>
        <button
          class="px-3 py-1 text-xs rounded border transition-colors"
          classList={{
            'bg-primary/20 text-primary border-primary/40': symbols(),
            'bg-surface-alt text-text-dim border-border hover:border-primary': !symbols(),
          }}
          onclick={() => toggle(symbols, setSymbols)}
        >
          符号 !@#
        </button>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs text-text-dim">长度</span>
        <input
          type="range"
          min={4}
          max={128}
          value={length()}
          onInput={(e) => setLength(Number(e.currentTarget.value))}
          class="flex-1 accent-primary"
        />
        <span class="text-xs font-mono text-text min-w-[2rem] text-right">{length()}</span>
      </div>

      <button
        class="px-3 py-1.5 text-xs text-white rounded bg-primary hover:bg-primary/80 transition-colors"
        onclick={generate}
      >
        生成
      </button>

      {error() && (
        <div class="p-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded">
          {error()}
        </div>
      )}

      {result() && (
        <OutputArea value={() => result()!.output} label="随机字符串" />
      )}
    </div>
  );
}