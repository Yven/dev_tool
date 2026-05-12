import { createSignal, JSX, Show, onCleanup } from 'solid-js';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
}

const [toast, setToast] = createSignal<ToastState | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  if (timer) clearTimeout(timer);
  setToast({ message, type });
  timer = setTimeout(() => setToast(null), duration);
}

export default function Toast(): JSX.Element {
  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  return (
    <Show when={toast()}>
      <div
        class="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 text-sm rounded shadow-lg transition-opacity"
        classList={{
          'bg-green-500 text-white': toast()!.type === 'success',
          'bg-red-500 text-white': toast()!.type === 'error',
          'bg-surface-alt text-text border border-border': toast()!.type === 'info',
        }}
      >
        {toast()!.message}
      </div>
    </Show>
  );
}
