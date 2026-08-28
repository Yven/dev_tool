import { JSX, createSignal, createEffect, onMount, For } from 'solid-js';
import NoteBox from './NoteBox';
import {
  Box,
  newId,
  addOnTop,
  splitAtCursor,
  deleteEmpty,
  updateContent,
  isTopFirstLine,
} from './boxes';

const CACHE_KEY = 'cache:notes:boxes';

interface Props {
  active?: boolean;
}

export default function NotesPanel(props: Props): JSX.Element {
  const [boxes, setBoxes] = createSignal<Box[]>([{ id: newId(), content: '' }]);
  const [focusId, setFocusId] = createSignal<string | null>(null);
  const [focusTick, setFocusTick] = createSignal(0);

  onMount(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Box[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBoxes(parsed.map((b) => ({ id: String(b.id), content: String(b.content ?? '') })));
        }
      } catch {
        /* 解析失败回退为单个空框 */
      }
    }
  });

  createEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(boxes()));
  });

  const requestFocus = (id: string | null) => {
    setFocusId(id);
    setFocusTick((t) => t + 1);
  };

  // 切换到本面板时聚焦最顶框（focusTick 自增保证每次激活都触发）
  createEffect(() => {
    if (props.active) requestFocus(boxes()[0]?.id ?? null);
  });

  const onChange = (id: string, content: string) => {
    setBoxes((prev) => updateContent(prev, id, content));
  };

  const onSplit = (id: string, before: string, after: string, isFirstLine: boolean) => {
    let target = id;
    setBoxes((prev) => {
      if (isTopFirstLine(prev, id, isFirstLine)) {
        target = newId();
        return addOnTop(prev, target);
      }
      return splitAtCursor(prev, id, before, after);
    });
    requestFocus(target);
  };

  const onDelete = (id: string) => {
    const prev = boxes();
    const idx = prev.findIndex((b) => b.id === id);
    const next = deleteEmpty(prev, id);
    if (next === prev) return;
    setBoxes(next);
    requestFocus(next[idx]?.id ?? next[idx - 1]?.id ?? null);
  };

  return (
    <div class="flex flex-col gap-2">
      <For each={boxes()}>
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
