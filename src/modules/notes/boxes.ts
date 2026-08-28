export interface Box {
  id: string;
  content: string;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `box-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function addOnTop(boxes: Box[], id: string): Box[] {
  return [{ id, content: '' }, ...boxes];
}

export function splitAtCursor(
  boxes: Box[],
  id: string,
  before: string,
  after: string,
): Box[] {
  const idx = boxes.findIndex((x) => x.id === id);
  if (idx < 0) return boxes;
  const upper: Box = { id: boxes[idx].id, content: before };
  const lower: Box = { id: newId(), content: after };
  const next = boxes.slice();
  next.splice(idx, 1, upper, lower);
  return next;
}

export function deleteEmpty(boxes: Box[], id: string): Box[] {
  if (boxes.length <= 1) return boxes;
  const box = boxes.find((x) => x.id === id);
  if (!box || box.content.trim() !== '') return boxes;
  return boxes.filter((x) => x.id !== id);
}

export function updateContent(boxes: Box[], id: string, content: string): Box[] {
  return boxes.map((x) => (x.id === id ? { ...x, content } : x));
}

export function isTopFirstLine(
  boxes: Box[],
  id: string,
  isFirstLine: boolean,
): boolean {
  return boxes.length > 0 && boxes[0].id === id && isFirstLine;
}
