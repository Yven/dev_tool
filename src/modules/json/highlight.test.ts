import { describe, it, expect } from 'vitest';
import { highlightJsonLine, highlightJsonLines } from './highlight';

describe('JSON 高亮', () => {
  it('字符串键与数字写入对应高亮 class', () => {
    const html = highlightJsonLine('"a": 123');
    expect(html).toContain('json-key');
    expect(html).toContain('json-number');
  });

  it('布尔与 null 写入 literal class', () => {
    const html = highlightJsonLine('"a": true, "b": null');
    expect((html.match(/json-literal/g) ?? []).length).toBe(2);
  });

  it('转义 HTML 特殊字符', () => {
    const html = highlightJsonLine('"x": "<tag>"');
    expect(html).toContain('&lt;tag&gt;');
  });

  it('按逻辑行拆分', () => {
    const lines = highlightJsonLines('{\n  "a": 1\n}');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('{');
  });

  it('空输入返回空数组', () => {
    expect(highlightJsonLines('')).toEqual([]);
  });
});