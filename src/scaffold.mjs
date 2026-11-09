/* ============================================================================
   scaffold.mjs — 建一个新的 deck 目录
   ========================================================================== */
import fs from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, "..", "templates");

export async function scaffold(dir, {force = false, title, quiet = false} = {}) {
  const target = path.resolve(dir);
  const contentFile = path.join(target, "content.mjs");
  if (existsSync(contentFile) && !force) {
    throw new Error(`${contentFile} 已经存在。要覆盖请加 --force（会丢掉原来的内容）。`);
  }

  await fs.mkdir(path.join(target, "images"), {recursive: true});

  const deckTitle = title || path.basename(target);
  const content = (await fs.readFile(path.join(TEMPLATES, "content.mjs"), "utf8"))
    .replaceAll("我的演示标题", deckTitle);

  const files = [
    [path.join(target, "content.mjs"), content],
    [path.join(target, "theme.css"), await fs.readFile(path.join(TEMPLATES, "theme.css"), "utf8")],
    [path.join(target, "images", "sample.svg"), await fs.readFile(path.join(TEMPLATES, "sample.svg"), "utf8")],
  ];
  for (const [file, body] of files) await fs.writeFile(file, body);

  if (!quiet) {
    console.log(`✓ 已创建 ${path.relative(process.cwd(), target) || target}`);
    console.log("  content.mjs   内容（一页一个对象）");
    console.log("  theme.css     配色与版式的覆盖");
    console.log("  images/       图片目录，构建时自动内联进单文件");
    console.log("");
    console.log("下一步：");
    console.log(`  cd ${path.relative(process.cwd(), target) || "."}`);
    console.log("  html-deck build --open");
  }
  return {dir: target, title: deckTitle, files: files.map(([file]) => file)};
}
