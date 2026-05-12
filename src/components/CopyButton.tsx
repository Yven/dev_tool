import { createSignal, JSX } from 'solid-js';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

interface Props {
  text: () => string;
  label?: string;
}

export default function CopyButton(props: Props): JSX.Element {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    try {
      await writeText(props.text());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  return (
    <button
      class="px-2 py-0.5 text-xs rounded transition-colors"
      classList={{
        'bg-primary/20 text-primary': !copied(),
        'bg-green-500/20 text-green-400': copied(),
      }}
      onclick={handleCopy}
    >
      {copied() ? '✓ 已复制' : (props.label ?? '复制')}
    </button>
  );
}
