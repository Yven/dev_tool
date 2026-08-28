import { JSX, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createNoteEditor, NoteEditor } from './editor';
import { Box } from './boxes';

interface Props {
  box: Box;
  focus?: () => boolean;
  onChange: (id: string, content: string) => void;
  onSplit: (id: string, before: string, after: string, isFirstLine: boolean) => void;
  onDelete: (id: string) => void;
}

export default function NoteBox(props: Props): JSX.Element {
  let root!: HTMLDivElement;
  const [editor, setEditor] = createSignal<NoteEditor | null>(null);
  const [failed, setFailed] = createSignal(false);

  onMount(async () => {
    try {
      const ed = await createNoteEditor({
        root,
        initial: props.box.content,
        onMarkdownChange: (md) => props.onChange(props.box.id, md),
      });
      setEditor(ed);
    } catch (e) {
      console.error('NoteBox editor init failed:', e);
      setFailed(true);
    }
    root.addEventListener('keydown', handleKeyDown, true);
  });

  createEffect(() => {
    const ed = editor();
    if (props.focus?.() && ed) ed.focus();
  });

  onCleanup(() => {
    root.removeEventListener('keydown', handleKeyDown, true);
    editor()?.destroy();
  });

  function handleKeyDown(e: KeyboardEvent) {
    const ed = editor();
    if (!ed) return;
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const r = ed.splitAtCursor();
      if (r) props.onSplit(props.box.id, r.before, r.after, r.isFirstLine);
      return;
    }
    if (e.key === 'Backspace') {
      const md = ed.getMarkdown();
      if (md.trim() === '') {
        e.preventDefault();
        e.stopPropagation();
        props.onDelete(props.box.id);
      }
    }
  }

  return (
    <div class="notes-box" data-note-id={props.box.id}>
      <Show when={failed()} fallback={<div ref={root} />}>
        <pre class="notes-box-fallback text-sm whitespace-pre-wrap break-words">{props.box.content}</pre>
      </Show>
    </div>
  );
}
