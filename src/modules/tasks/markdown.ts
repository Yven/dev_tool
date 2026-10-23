import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

export function renderMarkdown(text: string): string {
  if (!text.trim()) return '';
  try {
    const raw = marked.parse(text, { async: false, gfm: true, breaks: true });
    return DOMPurify.sanitize(raw);
  } catch {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }
}
