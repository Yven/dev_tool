import { invoke } from '@tauri-apps/api/core';
import { NotesIndex, parseIndex } from './buffers';

export async function readIndex(): Promise<NotesIndex | null> {
  const json = await invoke<string | null>('notes_read_index');
  if (json == null || json === '') return null;
  return parseIndex(json);
}

export async function writeIndex(index: NotesIndex): Promise<void> {
  await invoke('notes_write_index', { json: JSON.stringify(index) });
}

export async function readBuffer(path: string): Promise<string> {
  return await invoke<string>('notes_read', { path });
}

export async function saveBuffer(path: string, content: string): Promise<void> {
  await invoke('notes_write', { path, content });
}

export async function deleteBuffer(path: string): Promise<void> {
  await invoke('notes_delete', { path });
}
