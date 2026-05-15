import { createEffect, createMemo, createSignal, For, JSX, onCleanup, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import InputArea from '../../components/InputArea';
import CopyButton from '../../components/CopyButton';

interface TimestampResult {
  seconds: number;
  rfc3339: string;
  input_time: string;
  output_time: string;
}

const TIMEZONES = [
  { value: 'local', label: '本地时区 (Local)' },
  { value: 'UTC', label: 'UTC +00:00 (Coordinated Universal Time)' },
  { value: 'UTC-12:00', label: 'UTC -12:00 (Baker Island)' },
  { value: 'UTC-11:00', label: 'UTC -11:00 (American Samoa)' },
  { value: 'UTC-10:00', label: 'UTC -10:00 (Hawaii)' },
  { value: 'UTC-09:00', label: 'UTC -09:00 (Alaska)' },
  { value: 'UTC-08:00', label: 'UTC -08:00 (Pacific Time)' },
  { value: 'UTC-07:00', label: 'UTC -07:00 (Mountain Time)' },
  { value: 'UTC-06:00', label: 'UTC -06:00 (Central Time)' },
  { value: 'UTC-05:00', label: 'UTC -05:00 (Eastern Time)' },
  { value: 'UTC-04:00', label: 'UTC -04:00 (Atlantic Time)' },
  { value: 'UTC-03:00', label: 'UTC -03:00 (Buenos Aires)' },
  { value: 'UTC-02:00', label: 'UTC -02:00 (South Georgia)' },
  { value: 'UTC-01:00', label: 'UTC -01:00 (Azores)' },
  { value: 'UTC+00:00', label: 'UTC +00:00 (London)' },
  { value: 'UTC+01:00', label: 'UTC +01:00 (Berlin/Paris)' },
  { value: 'UTC+02:00', label: 'UTC +02:00 (Athens/Cairo)' },
  { value: 'UTC+03:00', label: 'UTC +03:00 (Moscow/Riyadh)' },
  { value: 'UTC+04:00', label: 'UTC +04:00 (Dubai)' },
  { value: 'UTC+05:00', label: 'UTC +05:00 (Karachi)' },
  { value: 'UTC+05:30', label: 'UTC +05:30 (India Standard Time)' },
  { value: 'UTC+06:00', label: 'UTC +06:00 (Dhaka)' },
  { value: 'UTC+07:00', label: 'UTC +07:00 (Bangkok/Jakarta)' },
  { value: 'UTC+08:00', label: 'UTC +08:00 (Beijing/Singapore)' },
  { value: 'UTC+09:00', label: 'UTC +09:00 (Tokyo/Seoul)' },
  { value: 'UTC+10:00', label: 'UTC +10:00 (Sydney)' },
  { value: 'UTC+11:00', label: 'UTC +11:00 (Solomon Islands)' },
  { value: 'UTC+12:00', label: 'UTC +12:00 (Auckland/Fiji)' },
  { value: 'UTC+13:00', label: 'UTC +13:00 (Samoa)' },
  { value: 'UTC+14:00', label: 'UTC +14:00 (Line Islands)' },
];

const CACHE_KEY = 'cache:timestamp:input';

export default function TimestampPanel(): JSX.Element {
  const [input, setInput] = createSignal('');
  const [nowMs, setNowMs] = createSignal(Date.now());
  const [inputTz, setInputTz] = createSignal<string>('local');
  const [outputTz, setOutputTz] = createSignal<string>('local');
  const [result, setResult] = createSignal<TimestampResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const currentTimestamp = createMemo(() => Math.floor(nowMs() / 1000));

  const convert = async () => {
    const effectiveInput = input().trim() || String(currentTimestamp());
    try {
      const r = await invoke<TimestampResult>('cmd_timestamp_convert', {
        input: effectiveInput,
        unit: 's',
        input_timezone: inputTz(),
        output_timezone: outputTz(),
      });
      setResult(r);
      setError(null);
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  onMount(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) setInput(cached);

    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  createEffect(() => {
    localStorage.setItem(CACHE_KEY, input());
  });

  createEffect(() => {
    const empty = input().trim() === '';
    inputTz();
    outputTz();
    if (empty) nowMs();
    convert();
  });

  return (
    <div class="flex flex-col gap-3">
      <InputArea
        value={input}
        onInput={setInput}
        placeholder={input().trim() ? '输入时间戳或时间字符串（如：2026-05-11 19:55:22 或 2026-05-10）' : `当前时间戳: ${currentTimestamp()}`}
      />

      <div class="flex gap-2 items-center flex-wrap">
        <div class="flex items-center gap-1">
          <span class="text-xs text-text-dim">输入</span>
          <select
            class="bg-surface-alt border border-border rounded px-2 py-1 text-xs text-white"
            value={inputTz()}
            onchange={(e) => setInputTz(e.currentTarget.value)}
          >
            <For each={TIMEZONES}>
              {(zone) => (
                <option value={zone.value}>
                  {zone.label}
                </option>
              )}
            </For>
          </select>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-xs text-text-dim">输出</span>
          <select
            class="bg-surface-alt border border-border rounded px-2 py-1 text-xs text-white"
            value={outputTz()}
            onchange={(e) => setOutputTz(e.currentTarget.value)}
          >
            <For each={TIMEZONES}>
              {(zone) => (
                <option value={zone.value}>
                  {zone.label}
                </option>
              )}
            </For>
          </select>
        </div>
      </div>

      {error() && (
        <div class="p-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded">
          {error()}
        </div>
      )}

      {result() && (
        <div class="grid grid-cols-1 gap-2 text-xs">
          <div class="p-2 bg-surface-alt rounded border border-border">
            <div class="text-text-dim mb-1">秒</div>
            <div class="font-mono mb-1">{result()!.seconds}</div>
            <CopyButton text={() => String(result()!.seconds)} label="复制" />
          </div>
          <div class="p-2 bg-surface-alt rounded border border-border">
            <div class="text-text-dim mb-1">RFC3339</div>
            <div class="font-mono mb-1 text-[11px]">{result()!.rfc3339}</div>
            <CopyButton text={() => result()!.rfc3339} label="复制" />
          </div>
          <div class="p-2 bg-surface-alt rounded border border-border">
            <div class="text-text-dim mb-1">输入时间</div>
            <div class="font-mono mb-1">{result()!.input_time}</div>
            <CopyButton text={() => result()!.input_time} label="复制" />
          </div>
          <div class="p-2 bg-surface-alt rounded border border-border">
            <div class="text-text-dim mb-1">输出时间</div>
            <div class="font-mono mb-1">{result()!.output_time}</div>
            <CopyButton text={() => result()!.output_time} label="复制" />
          </div>
        </div>
      )}
    </div>
  );
}
