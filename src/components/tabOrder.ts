export const TAB_ORDER_KEY = 'cache:tab-order';

export function mergeTabOrder(saved: readonly string[], current: readonly string[]): string[] {
  const available = new Set(current);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of saved) {
    if (available.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of current) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function dropTabId(ids: readonly string[], id: string): string[] {
  return ids.filter((existing) => existing !== id);
}

export function loadTabOrder(storage?: Storage): string[] {
  try {
    const store = storage ?? window.localStorage;
    const raw = store.getItem(TAB_ORDER_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function saveTabOrder(ids: readonly string[], storage?: Storage): void {
  try {
    const store = storage ?? window.localStorage;
    store.setItem(TAB_ORDER_KEY, JSON.stringify(ids));
  } catch {
    // localStorage 不可用或配额不足时静默忽略，排序仍在内存中生效
  }
}
