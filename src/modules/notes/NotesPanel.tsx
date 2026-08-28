import { JSX, createSignal, createEffect, onMount, For, untrack } from 'solid-js';
import { createStore } from 'solid-js/store';
import NoteBox from './NoteBox';
import {
  Box,
  newId,
  addOnTop,
  splitAtCursor,
  deleteEmpty,
  isTopFirstLine,
} from './boxes';

const CACHE_KEY = 'cache:notes:boxes';

interface Props {
  active?: boolean;
}

export default function NotesPanel(props: Props): JSX.Element {
  const [boxes, setBoxes] = createStore<Box[]>([{ id: newId(), content: '' }]);
  const [focusId, setFocusId] = createSignal<string | null>(null);
  const [focusTick, setFocusTick] = createSignal(0);

  onMount(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const valid =
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((b) => b && typeof b === 'object' && typeof b.id === 'string');
        if (valid) {
          setBoxes(parsed.map((b) => ({ id: b.id, content: String(b.content ?? '') })));
        }
      } catch {
        /* 解析失败回退为单个空框 */
      }
    }
  });

  createEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(boxes));
    } catch (e) {
      console.error('save notes failed:', e);
    }
  });

  const requestFocus = (id: string | null) => {
    setFocusId(id);
    setFocusTick((t) => t + 1);
  };

  // 切换到本面板时聚焦最顶框（focusTick 自增保证每次激活都触发）
  createEffect(() => {
    if (props.active) requestFocus(untrack(() => boxes[0]?.id ?? null));
  });

  const onChange = (id: string, content: string) => {
    const idx = boxes.findIndex((b) => b.id === id);
    if (idx >= 0) setBoxes(idx, 'content', content);
  };

  const onSplit = (id: string, before: string, after: string, isFirstLine: boolean) => {
    let target = id;
    const prev = boxes.map((b) => ({ ...b }));
    const next = isTopFirstLine(prev, id, isFirstLine)
      ? (target = newId(), addOnTop(prev, target))
      : splitAtCursor(prev, id, before, after);
    setBoxes(next);
    requestFocus(target);
  };

  const onDelete = (id: string) => {
    const prev = boxes.map((b) => ({ ...b }));
    const idx = prev.findIndex((b) => b.id === id);
    const next = deleteEmpty(prev, id);
    if (next === prev) return;
    setBoxes(next);
    requestFocus(next[idx - 1]?.id ?? next[idx]?.id ?? null);
  };

  return (
    <div class="flex flex-col gap-2">
      <For each={boxes}>
        {(box) => (
          <NoteBox
            box={box}
            focus={() => focusId() === box.id && focusTick() > 0}
            onChange={onChange}
            onSplit={onSplit}
            onDelete={onDelete}
          />
        )}
      </For>
    </div>
  );
}
