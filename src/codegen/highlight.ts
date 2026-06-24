/**
 * Tiny dependency-free syntax highlighter for the generated JS/JSX shown in the Export panel.
 * Tokenizes comments, strings, numbers, keywords and Capitalized identifiers (THREE, Math,
 * geometry classes…) and wraps them in <span class="hl-*"> for CSS coloring. Returns escaped
 * HTML — safe to inject. Not a full parser; good enough for read-only display of our codegen.
 */

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'new', 'for', 'while', 'do', 'if', 'else',
  'export', 'import', 'from', 'as', 'of', 'in', 'class', 'extends', 'typeof', 'instanceof',
  'this', 'void', 'true', 'false', 'null', 'undefined',
]);

const escapeMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => escapeMap[c]!);

// Ordered alternatives: comment | string | number | word. Words are classified afterwards.
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d[\d_]*\.?\d*(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)/g;

export function highlightCode(code: string): string {
  let out = '';
  let last = 0;
  for (let m = TOKEN.exec(code); m; m = TOKEN.exec(code)) {
    out += escapeHtml(code.slice(last, m.index));
    const [tok, comment, str, num, word] = m;
    if (comment) out += `<span class="hl-comment">${escapeHtml(comment)}</span>`;
    else if (str) out += `<span class="hl-string">${escapeHtml(str)}</span>`;
    else if (num) out += `<span class="hl-number">${escapeHtml(num)}</span>`;
    else if (word && KEYWORDS.has(word)) out += `<span class="hl-keyword">${word}</span>`;
    else if (word && /^[A-Z]/.test(word)) out += `<span class="hl-type">${word}</span>`;
    else out += escapeHtml(tok);
    last = m.index + tok.length;
  }
  out += escapeHtml(code.slice(last));
  return out;
}
