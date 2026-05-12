import { JSX, Show } from 'solid-js';
import CopyButton from './CopyButton';

interface Props {
  value: () => string;
  label?: string;
  error?: () => string | null;
}

export default function OutputArea(props: Props): JSX.Element {
  return (
    <div class="w-full max-w-full min-w-0 flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="text-xs text-text-dim">{props.label ?? '输出'}</span>
        <CopyButton text={props.value} />
      </div>
      <Show when={props.error?.()}>
        <div class="p-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded">
          {props.error?.()}
        </div>
      </Show>
      <pre class="w-full max-w-full min-w-0 min-h-24 p-2 text-sm text-text bg-surface-alt border border-border rounded overflow-x-hidden overflow-y-auto font-mono whitespace-pre-wrap break-words break-all select-text cursor-text">
        {props.value()}
      </pre>
    </div>
  );
}
