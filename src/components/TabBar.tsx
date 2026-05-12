import { For, JSX } from 'solid-js';

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
  return (
    <div class="flex gap-1 px-2 py-1 bg-surface-alt border-b border-border overflow-x-auto">
      <For each={props.tabs}>
        {(tab) => (
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap"
            classList={{
              'bg-primary text-white': props.active === tab.id,
              'text-white/90 hover:text-white hover:bg-surface': props.active !== tab.id,
            }}
            onclick={() => props.onSelect(tab.id)}
          >
            {tab.icon && <span class={tab.icon} />}
            <span>{tab.label}</span>
          </button>
        )}
      </For>
    </div>
  );
}
