import { For, JSX, createEffect, createSignal, onCleanup, onMount } from 'solid-js';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onSelect: (id: string) => void;
}

export default function TabBar(props: Props): JSX.Element {
  let barRef!: HTMLDivElement;
  const [expanded, setExpanded] = createSignal(false);
  const [hasOverflow, setHasOverflow] = createSignal(false);

  const checkOverflow = () => {
    if (!barRef) return;
    if (expanded()) return;
    setHasOverflow(barRef.scrollHeight > 28 + 1);
  };

  onMount(() => {
    checkOverflow();
    const observer = new ResizeObserver(() => {
      if (!expanded()) checkOverflow();
    });
    observer.observe(barRef);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    props.tabs;
    if (!expanded()) checkOverflow();
  });

  const toggleExpand = () => {
    const next = !expanded();
    setExpanded(next);
    if (!next) {
      requestAnimationFrame(() => checkOverflow());
    }
  };

  return (
    <div class="tab-bar-wrapper bg-surface-alt">
      <div
        ref={barRef}
        class="tab-bar flex flex-wrap gap-0"
        style={{ "max-height": expanded() ? "none" : "28px", overflow: "hidden" }}
      >
        <For each={props.tabs}>
          {(tab) => (
            <button
              class="flex items-center justify-center px-2.5 py-1 text-xs text-white whitespace-nowrap transition-colors border-solid border-t border-l border-r border-b-0"
              classList={{
                'bg-surface border-primary': props.active === tab.id,
                'bg-transparent border-transparent hover:bg-white/5': props.active !== tab.id,
              }}
              onclick={() => props.onSelect(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          )}
        </For>
      </div>
      {hasOverflow() && (
        <div class="flex justify-center mt-[5px]">
          <button
            class="w-8 h-[5px] flex items-center justify-center rounded border-0 outline-none transition-colors cursor-pointer"
            classList={{
              'bg-white/10 text-white': !expanded(),
              'text-white/70 hover:text-white hover:bg-white/10': expanded(),
            }}
            onclick={toggleExpand}
            title={expanded() ? '收起' : '展开'}
          >
            <svg width="6" height="4" viewBox="0 0 6 4" fill="currentColor">
              <polygon points={expanded() ? "0,4 3,0 6,4" : "0,0 3,4 6,0"} />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
