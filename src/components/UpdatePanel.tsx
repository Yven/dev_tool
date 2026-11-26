import { JSX, Show } from 'solid-js';
import { checkForUpdate, error, installUpdate, progress, status, update } from '../updater';

const isBusy = () =>
  status() === 'checking' || status() === 'downloading' || status() === 'installing';

export default function UpdatePanel(): JSX.Element {
  return (
    <div class="mt-2 pt-2 border-t border-border">
      <div class="flex items-center justify-between">
        <span>应用更新</span>
        <button
          class="px-2 py-0.5 text-xs rounded border border-border bg-surface text-text-dim transition-colors hover:border-primary"
          classList={{ 'opacity-50 cursor-not-allowed hover:border-border': isBusy() }}
          disabled={isBusy()}
          onclick={() => void checkForUpdate()}
        >
          {status() === 'checking' ? '检查中…' : '检查更新'}
        </button>
      </div>

      <Show when={status() === 'latest'}>
        <div class="mt-1 text-[11px] text-text-dim">已是最新版本</div>
      </Show>

      <Show when={status() === 'error'}>
        <div class="mt-1 break-all text-[11px] text-red-400">{error()}</div>
      </Show>

      <Show when={update()}>
        <div class="mt-2 rounded border border-border bg-surface p-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs">
              新版本 <span class="font-mono text-primary">v{update()!.version}</span>
            </span>
            <Show when={status() === 'available' || status() === 'error'}>
              <button
                class="px-2 py-0.5 text-xs rounded border border-primary/40 bg-primary/20 text-primary transition-colors hover:bg-primary/30"
                onclick={() => void installUpdate()}
              >
                {status() === 'error' ? '重试' : '下载并安装'}
              </button>
            </Show>
          </div>

          <Show when={update()!.body}>
            <div class="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[11px] leading-4 text-text-dim">
              {update()!.body}
            </div>
          </Show>

          <Show when={status() === 'downloading' || status() === 'installing'}>
            <div class="mt-2">
              <div class="h-1 overflow-hidden rounded bg-surface-alt">
                <div
                  class="h-full bg-primary transition-all"
                  style={{ width: progress() < 0 ? '100%' : `${progress()}%` }}
                />
              </div>
              <div class="mt-1 text-[11px] text-text-dim">
                {status() === 'installing'
                  ? '正在安装，应用即将自动重启…'
                  : progress() < 0
                    ? '正在下载…'
                    : `正在下载 ${Math.round(progress())}%`}
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
