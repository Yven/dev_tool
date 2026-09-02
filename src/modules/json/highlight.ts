// JSON 输出语法高亮 + 拆行纯函数（独立模块，便于单测）

const TOKEN_RE =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 将单行 JSON 文本转成带语法高亮的 HTML（已做 HTML 转义）。 */
export function highlightJsonLine(line: string): string {
  const escaped = escapeHtml(line);
  return escaped.replace(TOKEN_RE, (match, strToken, boolOrNullToken, numberToken) => {
    if (strToken) {
      const isKey = /:$/.test(strToken);
      return `<span class="${isKey ? 'json-key' : 'json-string'}">${strToken}</span>`;
    }
    if (boolOrNullToken) {
      return `<span class="json-literal">${boolOrNullToken}</span>`;
    }
    if (numberToken) {
      return `<span class="json-number">${numberToken}</span>`;
    }
    return match;
  });
}

/** 将整段输出拆成逻辑行并逐行高亮，返回 HTML 字符串数组。 */
export function highlightJsonLines(text: string): string[] {
  if (!text) return [];
  return text.split('\n').map(highlightJsonLine);
}