import { JSX } from 'solid-js';

interface Props {
  value: () => string;
  onInput: (v: string) => void;
  placeholder?: string;
  class?: string;
}

export default function InputArea(props: Props): JSX.Element {
  return (
    <textarea
      class={`w-full min-h-24 p-2 text-sm text-text bg-surface-alt border border-border rounded resize-y focus:border-primary outline-none font-mono select-text ${props.class ?? ''}`}
      value={props.value()}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      placeholder={props.placeholder ?? '请输入...'}
    />
  );
}
