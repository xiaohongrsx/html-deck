/* build-lib.mjs — 构建期小工具：转义 + 极简语法高亮（零依赖） */

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char =>
  ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[char]));

// 单次扫描做词法染色，避免多次 replace 互相破坏
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@media|@page|@font-face|!important|const|let|function|return|if|else|new|await|async|import|from|export|true|false|null|window|document|Math)\b|(\b\d+(?:\.\d+)?(?:px|ms|s|mm|%|rem)?\b)|(\b[A-Za-z_$][\w$]*(?=\())/g;

export function highlight(source) {
  let out = "";
  let last = 0;  for (const match of String(source).matchAll(TOKEN)) {
    out += escapeHtml(source.slice(last, match.index));
    const [text, comment, string, keyword, number, call] = match;
    const cls = comment ? "c" : string ? "s" : keyword ? "k" : (number || call) ? "n" : "";
    out += cls ? `<span class="${cls}">${escapeHtml(text)}</span>` : escapeHtml(text);
    last = match.index + text.length;
  }
  return out + escapeHtml(String(source).slice(last));
}

export const code = source =>
  `<pre class="code">${highlight(Array.isArray(source) ? source.join("\n") : source)}</pre>`;
