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
    <div class="tab-bar-wrapper py-1 bg-surface-alt border-b border-border">
      <div
        ref={barRef}
        class="tab-bar flex flex-wrap gap-1"
        style={{ "max-height": expanded() ? "none" : "28px", overflow: "hidden" }}
      >
        <For each={props.tabs}>
          {(tab) => (
            <button
              class="flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap"
              classList={{
                'bg-primary/40 text-white': props.active === tab.id,
                'text-white/70 hover:text-white hover:bg-surface': props.active !== tab.id,
              }}
              onclick={() => props.onSelect(tab.id)}
            >
              {tab.icon && <span class={tab.icon} />}
              <span>{tab.label}</span>
            </button>
          )}
        </For>
      </div>
      {hasOverflow() && (
        <div class="flex justify-center">
          <button
            class="w-8 h-[5px] flex items-center justify-center rounded transition-colors cursor-pointer"
            classList={{
              'bg-primary/40 text-white': !expanded(),
              'text-white/70 hover:text-white hover:bg-primary/20': expanded(),
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
