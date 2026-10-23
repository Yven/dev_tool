import { describe, expect, it } from 'vitest';
import { escapeHtml, renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('渲染粗体、行内代码、列表和链接', () => {
    const html = renderMarkdown('**重点** 和 `code`\n\n- a\n- b\n\n[链接](https://example.com)');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>a</li>');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('单个换行渲染为 <br>', () => {
    expect(renderMarkdown('a\nb')).toContain('a<br');
  });

  it('清洗 script 与事件属性', () => {
    const html = renderMarkdown('<script>alert(1)</script><img src=x onerror="alert(2)">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });

  it('移除 javascript: 链接', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('javascript:');
  });

  it('空白输入返回空串', () => {
    expect(renderMarkdown('   ')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('转义尖括号、引号与 &', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});
