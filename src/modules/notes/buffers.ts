export interface BufferMeta {
  id: string;
  title: string;
}

export interface NotesIndex {
  buffers: BufferMeta[];
  activeId: string;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `buf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function defaultIndex(): NotesIndex {
  const id = newId();
  return { buffers: [{ id, title: '' }], activeId: id };
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
    return { buffers, activeId };
  } catch {
    return defaultIndex();
  }
}

export function addBuffer(index: NotesIndex): NotesIndex {
  const buf = { id: newId(), title: '' };
  return { buffers: [...index.buffers, buf], activeId: buf.id };
}

export function renameBuffer(index: NotesIndex, id: string, title: string): NotesIndex {
  return {
    ...index,
    buffers: index.buffers.map((b) => (b.id === id ? { ...b, title } : b)),
  };
}

export function closeBuffer(index: NotesIndex, id: string): NotesIndex {
  if (index.buffers.length <= 1) return index;
  const idx = index.buffers.findIndex((b) => b.id === id);
  if (idx < 0) return index;
  const buffers = index.buffers.filter((b) => b.id !== id);
  const activeId = index.activeId === id ? buffers[Math.max(0, idx - 1)].id : index.activeId;
  return { buffers, activeId };
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
