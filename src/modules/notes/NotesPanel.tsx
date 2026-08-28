import { JSX } from 'solid-js';

interface Props {
  active?: boolean;
}

export default function NotesPanel(_props: Props): JSX.Element {
  return <div class="text-sm text-text-dim">笔记面板（骨架）</div>;
}
