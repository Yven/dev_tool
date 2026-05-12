import { createEffect, createMemo, createSignal, JSX, onMount, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import InputArea from '../../components/InputArea';
import CopyButton from '../../components/CopyButton';

interface JsonResult {
  output: string;
  error_line: number | null;
  error_msg: string | null;
}

export default function JsonPanel(): JSX.Element {
  const [input, setInput] = createSignal('');
  const [indent, setIndent] = createSignal(2);
  const [sortKeys, setSortKeys] = createSignal(false);
  const [escapeUnicode, setEscapeUnicode] = createSignal(false);
  const [compress, setCompress] = createSignal(false);
  const [result, setResult] = createSignal<JsonResult | null>(null);
  const cacheKey = 'cache:json:input';

  onMount(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) setInput(cached);
  });

  createEffect(() => {
    localStorage.setItem(cacheKey, input());
  });

  const format = async () => {
    if (!input().trim()) return;
    try {
      const r = await invoke<JsonResult>('cmd_json_format', {
        input: input(),
        indent: indent(),
        sortKeys: sortKeys(),
        escapeUnicode: escapeUnicode(),
        compress: compress(),
      });
      setResult(r);
    } catch (e) {
      setResult({ output: '', error_line: null, error_msg: String(e) });
    }
  };

  const highlightedHtml = createMemo(() => {
    const text = result()?.output ?? '';
    if (!text) return '';

    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Basic JSON syntax highlighting for formatted or minified JSON output
    return escaped.replace(
      /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
      (match, strToken, boolOrNullToken, numberToken) => {
        if (strToken) {
          const isKey = /:$/.test(strToken);
          return `<span class="${isKey ? 'json-key' : 'json-string'}">${strToken}</span>`;
        }
        if (boolOrNullToken) {
          return `<span class="json-literal">${boolOrNullToken}</span>`;
        }
        if (numberToken) {
          return `<span class="json-number">${numberToken}</span>`;
        }
        return match;
      }
    );
  });

  return (
    <div class="flex flex-col gap-3">
      <InputArea value={input} onInput={setInput} placeholder="输入 JSON..." />

      <div class="flex gap-2 flex-wrap items-center">
        <button
          class="px-2 py-1 text-xs text-white rounded border border-border transition-colors"
          classList={{
            'bg-primary text-white border-primary': indent() === 2,
            'hover:border-primary': indent() !== 2,
          }}
          onclick={() => setIndent(2)}
        >
          2空格
        </button>
        <button
          class="px-2 py-1 text-xs text-white rounded border border-border transition-colors"
          classList={{
            'bg-primary text-white border-primary': indent() === 4,
            'hover:border-primary': indent() !== 4,
          }}
          onclick={() => setIndent(4)}
        >
          4空格
        </button>
        <button
          class="px-2 py-1 text-xs text-white rounded border border-border transition-colors"
          classList={{
            'bg-primary text-white border-primary': compress(),
            'hover:border-primary': !compress(),
          }}
          onclick={() => setCompress(!compress())}
        >
          压缩
        </button>
        <button
          class="px-2 py-1 text-xs text-white rounded border border-border transition-colors"
          classList={{
            'bg-primary text-white border-primary': sortKeys(),
            'hover:border-primary': !sortKeys(),
          }}
          onclick={() => setSortKeys(!sortKeys())}
        >
          排序
        </button>
        <button
          class="px-2 py-1 text-xs text-white rounded border border-border transition-colors"
          classList={{
            'bg-primary text-white border-primary': escapeUnicode(),
            'hover:border-primary': !escapeUnicode(),
          }}
          onclick={() => setEscapeUnicode(!escapeUnicode())}
        >
          Unicode转义
        </button>
        <button
          class="ml-auto px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/80"
          onclick={format}
        >
          格式化
        </button>
      </div>

      <Show when={result()}>
        <div class="w-full max-w-full min-w-0 flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-dim">输出</span>
            <CopyButton text={() => result()!.output} />
          </div>
          <Show when={result()!.error_msg}>
            <div class="p-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded">
              {`行 ${result()!.error_line ?? '?'}: ${result()!.error_msg}`}
            </div>
          </Show>
          <pre
            class="w-full max-w-full min-w-0 min-h-24 p-2 text-sm text-text bg-surface-alt border border-border rounded overflow-x-hidden overflow-y-auto font-mono whitespace-pre-wrap break-words break-all select-text cursor-text"
            innerHTML={highlightedHtml()}
          />
        </div>
      </Show>
    </div>
  );
}
