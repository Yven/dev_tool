import { For, JSX, onCleanup, onMount } from 'solid-js';

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

  onMount(() => {
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      barRef.scrollLeft += e.deltaY;
    };
    barRef.addEventListener('wheel', handler, { passive: false });
    onCleanup(() => barRef.removeEventListener('wheel', handler));
  });

  return (
    <div class="tab-bar-wrapper py-1 bg-surface-alt border-b border-border">
      <div ref={barRef} class="tab-bar flex gap-1 overflow-x-auto">
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
    </div>
  );
}
