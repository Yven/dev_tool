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
    setHasOverflow(barRef.scrollHeight > barRef.clientHeight + 1);
  };

  onMount(() => {
    const observer = new ResizeObserver(() => checkOverflow());
    observer.observe(barRef);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    props.tabs;
    checkOverflow();
    if (expanded() && !hasOverflow()) {
      setExpanded(false);
    }
  });

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
        <div class="flex justify-center mt-1">
          <button
            class="w-5 h-5 flex items-center justify-center rounded-full bg-surface text-text-dim hover:text-text hover:bg-primary/20 transition-colors"
            onclick={() => setExpanded(!expanded())}
            title={expanded() ? '收起' : '展开'}
          >
            <span class={expanded() ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'} />
          </button>
        </div>
      )}
    </div>
  );
}
