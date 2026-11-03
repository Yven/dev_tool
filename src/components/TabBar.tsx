import { For, JSX, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { dropIndex, type TabRect } from './dragSort';
import { mergeTabOrder } from './tabOrder';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onSelect: (id: string) => void;
  altHeld?: boolean;
  onCommitOrder?: (ids: string[]) => void;
  onSortingChange?: (sorting: boolean) => void;
}

const HOLD_MS = 2000;
const HOLD_SLOP = 8;
const DRAG_SLOP = 4;
const FLIP_MS = 160;
const RELEASE_MS = 120;
const EASING = 'cubic-bezier(.22,1,.36,1)';

interface PointerStart {
  id: string;
  x: number;
  y: number;
  slotLeft: number;
  slotTop: number;
}

export default function TabBar(props: Props): JSX.Element {
  let barRef!: HTMLDivElement;

  const [sorting, setSorting] = createSignal(false);
  const [draft, setDraft] = createSignal<string[]>(props.tabs.map((tab) => tab.id));
  const [pressingId, setPressingId] = createSignal<string | null>(null);
  const [sortActiveId, setSortActiveId] = createSignal<string | null>(null);

  let press: PointerStart | null = null;
  let drag: PointerStart | null = null;
  let holdTimer: number | undefined;
  let snapshot: string[] = [];
  let ignoreClick = false;

  const tabEl = (id: string): HTMLElement | null =>
    barRef ? barRef.querySelector<HTMLElement>(`[data-tab-id="${id}"]`) : null;

  const visualSlot = (el: HTMLElement) => {
    const rect = barRef.getBoundingClientRect();
    return {
      left: rect.left + el.offsetLeft - barRef.scrollLeft,
      top: rect.top + el.offsetTop - barRef.scrollTop,
    };
  };

  const reduceMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animate = (el: HTMLElement, frames: Keyframe[], duration: number) => {
    if (typeof el.animate !== 'function') return;
    el.animate(frames, { duration: reduceMotion() ? 0 : duration, easing: EASING });
  };

  const clearHold = () => {
    if (holdTimer !== undefined) {
      window.clearTimeout(holdTimer);
      holdTimer = undefined;
    }
  };

  const cancelPress = () => {
    clearHold();
    press = null;
    setPressingId(null);
  };

  const inBar = (x: number, y: number) => {
    const rect = barRef.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const enterSorting = () => {
    holdTimer = undefined;
    if (!press) return;
    snapshot = draft();
    setSorting(true);
    setPressingId(null);
    setSortActiveId(press.id);
    ignoreClick = true;
    props.onSortingChange?.(true);
  };

  const startDrag = () => {
    if (!press || drag) return;
    drag = { ...press };
    setSortActiveId(press.id);
  };

  const updateDrag = (event: PointerEvent) => {
    if (!drag) return;
    const el = tabEl(drag.id);
    if (!el) return;

    const ids = draft();
    const before = new Map<string, { left: number; top: number }>();
    for (const id of ids) {
      const node = tabEl(id);
      if (node) before.set(id, { left: node.offsetLeft, top: node.offsetTop });
    }

    const rects: TabRect[] = ids.map((id) => {
      const node = tabEl(id)!;
      const slot = visualSlot(node);
      return {
        id,
        left: slot.left,
        top: slot.top,
        width: node.offsetWidth,
        height: node.offsetHeight,
      };
    });

    const target = dropIndex(rects, { x: event.clientX, y: event.clientY }, drag.id);
    const without = ids.filter((id) => id !== drag!.id);
    const next = [...without];
    next.splice(target, 0, drag.id);

    if (next.some((id, i) => id !== ids[i])) {
      setDraft(next);
      for (const id of ids) {
        if (id === drag.id) continue;
        const node = tabEl(id);
        const old = before.get(id);
        if (!node || !old) continue;
        const dx = old.left - node.offsetLeft;
        const dy = old.top - node.offsetTop;
        if (dx || dy) {
          animate(
            node,
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: 'none' },
            ],
            FLIP_MS,
          );
        }
      }
    }

    const slot = visualSlot(el);
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    el.style.transform = `translate(${drag.slotLeft + dx - slot.left}px, ${drag.slotTop + dy - slot.top}px) scale(1.03)`;
  };

  const onTabPointerDown = (event: PointerEvent, id: string) => {
    if (event.button !== 0) return;
    ignoreClick = false;
    const el = tabEl(id);
    if (!el) return;
    const slot = visualSlot(el);
    press = { id, x: event.clientX, y: event.clientY, slotLeft: slot.left, slotTop: slot.top };
    if (!sorting()) {
      setPressingId(id);
      clearHold();
      holdTimer = window.setTimeout(enterSorting, HOLD_MS);
    }
  };

  const onWindowPointerMove = (event: PointerEvent) => {
    if (!press) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!sorting()) {
      if (Math.hypot(dx, dy) > HOLD_SLOP || !inBar(event.clientX, event.clientY)) cancelPress();
      return;
    }
    if (!drag && Math.hypot(dx, dy) > DRAG_SLOP) startDrag();
    if (drag) updateDrag(event);
  };

  const endDrag = () => {
    if (!drag) return;
    const draggedId = drag.id;
    const el = tabEl(draggedId);
    drag = null;
    ignoreClick = true;
    if (!el) return;
    if (reduceMotion() || typeof el.animate !== 'function') {
      el.style.transform = '';
      return;
    }
    const current = el.style.transform || 'none';
    const target = 'translate(0, 0) scale(1.03)';
    if (typeof el.animate === 'function') {
      const animation = el.animate(
        [{ transform: current }, { transform: target }],
        { duration: reduceMotion() ? 0 : RELEASE_MS, easing: EASING },
      );
      animation.addEventListener('finish', () => {
        if (!drag || drag.id !== draggedId) el.style.transform = '';
      });
    } else {
      el.style.transform = '';
    }
  };

  const onWindowPointerUp = () => {
    if (!press) return;
    if (!sorting()) {
      cancelPress();
      return;
    }
    if (drag) endDrag();
    press = null;
  };

  const exitSorting = () => {
    if (!sorting()) return;
    const hadGesture = !!press || !!drag;
    clearHold();
    press = null;
    drag = null;
    ignoreClick = hadGesture;
    setSorting(false);
    setPressingId(null);
    setSortActiveId(null);
    barRef?.querySelectorAll<HTMLElement>('[data-tab-id]').forEach((el) => {
      el.style.transform = '';
    });
    props.onSortingChange?.(false);
  };

  const commitOrder = () => {
    props.onCommitOrder?.(draft());
    exitSorting();
  };

  const onTabClick = (id: string) => {
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    if (sorting()) commitOrder();
    props.onSelect(id);
  };

  const onDocPointerDown = (event: PointerEvent) => {
    if (!sorting()) return;
    const target = event.target as Node | null;
    if (target && barRef.contains(target)) return;
    commitOrder();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (sorting()) {
      event.preventDefault();
      setDraft(snapshot);
      exitSorting();
      return;
    }
    if (press) cancelPress();
  };

  const onWindowBlur = () => {
    if (sorting()) commitOrder();
    else cancelPress();
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (sorting()) commitOrder();
      else cancelPress();
    }
  };

  onMount(() => {
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    onCleanup(() => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearHold();
    });
  });

  createEffect(() => {
    const ids = props.tabs.map((tab) => tab.id);
    if (!sorting()) {
      setDraft(ids);
    } else {
      setDraft((prev) => mergeTabOrder(prev, ids));
    }
  });

  const displayTabs = () => {
    const byId = new Map(props.tabs.map((tab) => [tab.id, tab] as const));
    return draft()
      .map((id) => byId.get(id))
      .filter((tab): tab is Tab => !!tab);
  };

  return (
    <div class="tab-bar-wrapper bg-surface-alt">
      <div ref={barRef} class="tab-bar">
        <For each={displayTabs()}>
          {(tab, index) => (
            <button
              data-tab-id={tab.id}
              class="tab-item relative flex h-[34px] items-center justify-center overflow-hidden border border-solid text-xs whitespace-nowrap"
              classList={{
                'bg-surface border-primary text-white': props.active === tab.id,
                'bg-transparent border-transparent text-white/80 hover:bg-white/5 hover:text-white':
                  props.active !== tab.id,
                'is-dimmed': sorting() && sortActiveId() !== tab.id,
                'is-sorting-active': sorting() && sortActiveId() === tab.id,
              }}
              onPointerDown={(event) => onTabPointerDown(event, tab.id)}
              onClick={() => onTabClick(tab.id)}
            >
              {props.altHeld && !sorting() && index() < 9 && (
                <span
                  data-shortcut
                  class="pointer-events-none absolute left-[4px] top-1/2 -translate-y-1/2 text-[10px] text-white/60"
                >
                  {index() + 1}
                </span>
              )}
              {pressingId() === tab.id && !sorting() && <span class="tab-hold-progress" />}
              <span class="max-w-full truncate px-1">{tab.label}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
