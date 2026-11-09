/* 把示例 deck 复制成 GitHub Pages 首页（docs/index.html） */
import fs from "node:fs";
import path from "node:path";

const from = path.join("examples", "demo", "index.html");
const to = path.join("docs", "index.html");

if (!fs.existsSync(from)) {
  console.error(`找不到 ${from}，先跑 html-deck build examples/demo`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(to), {recursive: true});
fs.copyFileSync(from, to);
console.log(`${to} ← ${from}（${(fs.statSync(to).size / 1024).toFixed(0)} KB）`);
