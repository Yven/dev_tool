export interface BufferMeta {
  id: string;
  title: string;
}

export interface NotesIndex {
  buffers: BufferMeta[];
  activeId: string;
  trash: BufferMeta[];
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `buf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function defaultIndex(): NotesIndex {
  const id = newId();
  return { buffers: [{ id, title: '' }], activeId: id, trash: [] };
}

export function parseIndex(json: string): NotesIndex {
  try {
    const raw = JSON.parse(json);
    if (!raw || !Array.isArray(raw.buffers) || raw.buffers.length === 0) {
      return defaultIndex();
    }
    const buffers = raw.buffers.map((b: any) => ({
      id: String(b.id),
      title: String(b.title ?? ''),
    }));
    const activeId =
      typeof raw.activeId === 'string' && buffers.some((b: any) => b.id === raw.activeId)
        ? raw.activeId
        : buffers[0].id;
    const trash = Array.isArray(raw.trash)
      ? raw.trash.map((b: any) => ({ id: String(b.id), title: String(b.title ?? '') }))
      : [];
    return { buffers, activeId, trash };
  } catch {
    return defaultIndex();
  }
}

export function addBuffer(index: NotesIndex): NotesIndex {
  const buf = { id: newId(), title: '' };
  return { buffers: [...index.buffers, buf], activeId: buf.id, trash: index.trash ?? [] };
}

export function renameBuffer(index: NotesIndex, id: string, title: string): NotesIndex {
  return {
    ...index,
    buffers: index.buffers.map((b) => (b.id === id ? { ...b, title } : b)),
  };
}

export const TRASH_LIMIT = 5;

export interface CloseToTrashResult {
  index: NotesIndex;
  evictedId: string | null;
}

// 关闭页签：移出 buffers、压入回收站 trash，最多保留 TRASH_LIMIT 个；
// 超出时挤出最旧的，其正文文件由调用方删除（通过 evictedId 返回）。
export function closeToTrash(index: NotesIndex, id: string): CloseToTrashResult {
  if (index.buffers.length <= 1) return { index, evictedId: null };
  const idx = index.buffers.findIndex((b) => b.id === id);
  if (idx < 0) return { index, evictedId: null };
  const buf = index.buffers[idx];
  const buffers = index.buffers.filter((b) => b.id !== id);
  const activeId = index.activeId === id ? buffers[Math.max(0, idx - 1)].id : index.activeId;
  let trash = [...(index.trash ?? []), { id: buf.id, title: buf.title }];
  let evictedId: string | null = null;
  if (trash.length > TRASH_LIMIT) {
    evictedId = trash[0].id;
    trash = trash.slice(1);
  }
  return { index: { buffers, activeId, trash }, evictedId };
}

export function restoreFromTrash(index: NotesIndex, id: string): NotesIndex {
  const trashList = index.trash ?? [];
  const idx = trashList.findIndex((b) => b.id === id);
  if (idx < 0) return index;
  const buf = trashList[idx];
  const trash = trashList.filter((b) => b.id !== id);
  return { buffers: [...index.buffers, buf], activeId: buf.id, trash };
}

export function moveBuffer(index: NotesIndex, id: string, toIndex: number): NotesIndex {
  const idx = index.buffers.findIndex((b) => b.id === id);
  if (idx < 0) return index;
  const buffers = index.buffers.slice();
  const [b] = buffers.splice(idx, 1);
  const clamped = Math.max(0, Math.min(toIndex, buffers.length));
  buffers.splice(clamped, 0, b);
  return { ...index, buffers };
}

export function setActive(index: NotesIndex, id: string): NotesIndex {
  if (!index.buffers.some((b) => b.id === id)) return index;
  return { ...index, activeId: id };
}
