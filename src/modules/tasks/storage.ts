import { invoke } from '@tauri-apps/api/core';

export function readTasksFile(): Promise<string | null> {
  return invoke<string | null>('tasks_read');
}

export function writeTasksFile(json: string): Promise<void> {
  return invoke<void>('tasks_write', { json });
}

export function confirmTaskDelete(message: string): Promise<boolean> {
  return invoke<boolean>('tasks_confirm', { message });
}
