import { createSignal } from 'solid-js';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { showToast } from './components/Toast';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'latest'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error';

const [status, setStatus] = createSignal<UpdateStatus>('idle');
const [update, setUpdate] = createSignal<Update | null>(null);
const [error, setError] = createSignal('');
const [downloaded, setDownloaded] = createSignal(0);
const [contentLength, setContentLength] = createSignal(0);

export { status, update, error };

export const updateAvailable = () => status() === 'available';

/** 下载进度 0-100；总大小未知时返回 -1。 */
export const progress = () => {
  const total = contentLength();
  return total > 0 ? Math.min(100, (downloaded() / total) * 100) : -1;
};

let checking = false;

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return '未知错误';
  }
}

export async function checkForUpdate(silent = false): Promise<void> {
  if (checking || status() === 'downloading' || status() === 'installing') return;
  checking = true;
  if (!silent) {
    setStatus('checking');
    setError('');
  }
  try {
    const found = await check();
    const previous = update();
    if (previous) {
      setUpdate(null);
      void previous.close().catch(() => {});
    }
    if (found) {
      setUpdate(found);
      setStatus('available');
      setError('');
      if (silent) showToast(`发现新版本 v${found.version}，打开「关于」即可更新`, 'info', 6000);
    } else {
      setStatus('latest');
      setError('');
    }
  } catch (e) {
    console.warn('检查更新失败:', e);
    if (silent) {
      setStatus('idle');
    } else {
      setStatus('error');
      setError(messageOf(e));
    }
  } finally {
    checking = false;
  }
}

export async function installUpdate(): Promise<void> {
  const pending = update();
  if (!pending || status() === 'downloading' || status() === 'installing') return;
  setStatus('downloading');
  setError('');
  setDownloaded(0);
  setContentLength(0);
  try {
    await pending.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          setContentLength(event.data.contentLength ?? 0);
          break;
        case 'Progress':
          setDownloaded((bytes) => bytes + event.data.chunkLength);
          break;
        case 'Finished':
          setStatus('installing');
          break;
      }
    });
    // Windows 安装时应用会自动退出，通常执行不到这里
    await relaunch();
  } catch (e) {
    setStatus('error');
    setError(messageOf(e));
  }
}
