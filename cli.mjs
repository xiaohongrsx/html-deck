#!/usr/bin/env node
/* ============================================================================
   cli.mjs — html-deck 命令入口
   ========================================================================== */
import fs from "node:fs/promises";
import {existsSync, readFileSync, watch} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {spawn} from "node:child_process";

import {buildDeck} from "./src/build.mjs";
import {checkDeck} from "./src/check.mjs";
import {exportDeck} from "./src/export.mjs";
import {scaffold} from "./src/scaffold.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = JSON.parse(readFileSync(path.join(HERE, "package.json"), "utf8"));

const HELP = `html-deck ${PACKAGE.version} — 单文件 HTML 演示引擎

用法
  html-deck new <目录> [--title "标题"]        新建一个 deck
  html-deck build [目录]                       构建 → index.html + 讲稿.md
  html-deck dev [目录]                         监听改动，自动重建
  html-deck check [目录] [--sync] [--pdf]      自检：版心溢出 / 双窗口同步 / PDF 页数
  html-deck export [目录] [--pdf] [--png]      导出：PDF 一份，或每页一张 PNG

选项
  --open          构建完打开浏览器
  --shots         自检时把每页截图存到 .preview/
  --scale <n>     PNG 的像素倍率，默认 2（1280×720 版式 → 2560×1440）
  --title <文字>   new 时替换标题
  --force         new 时覆盖已有 content.mjs
  --quiet         只输出错误

例子
  html-deck new 组会汇报
  cd 组会汇报 && html-deck build --open
  html-deck check --sync --pdf
  html-deck export --all
`;

const argv = process.argv.slice(2);
const valueFlags = new Set(["title", "scale"]);
const flags = new Map();
const positionals = [];
for (let index = 0; index < argv.length; index++) {
  const token = argv[index];
  if (token.startsWith("--")) {
    const name = token.slice(2);
    if (valueFlags.has(name)) flags.set(name, argv[++index]);
    else flags.set(name, true);
  } else {
    positionals.push(token);
  }
}
const command = positionals[0] || "help";
const dirGiven = positionals.length > 1;
const target = positionals[1] || ".";

function openFile(file) {
  const url = pathToFileURL(file).href;
  const options = {stdio: "ignore", detached: true};
  const child = process.platform === "win32"
    ? spawn("cmd", ["/c", "start", "", url], options)
    : spawn(process.platform === "darwin" ? "open" : "xdg-open", [file], options);
  child.unref();
}

async function run(command) {
  switch (command) {
    case "new": {
      if (!dirGiven) {
        console.error("用法：html-deck new <目录>");
        return 1;
      }
      await scaffold(target, {force: flags.has("force"), title: flags.get("title")});
      return 0;
    }

    case "build": {
      const result = await buildDeck({dir: target, quiet: flags.has("quiet")});
      if (flags.has("open")) openFile(result.outFile);
      return 0;
    }

    case "dev": {
      const deckDir = path.resolve(target);
      const watched = [path.join(deckDir, "content.mjs"), path.join(deckDir, "theme.css")];
      let timer = null;
      const rebuild = label => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            await buildDeck({dir: deckDir, quiet: true});
            console.log(`↻ ${new Date().toLocaleTimeString("zh-CN", {hour12: false})}  重建完成（${label}）`);
          } catch (error) {
            console.error(`✗ ${error.message}`);
          }
        }, 120);
      };
      await buildDeck({dir: deckDir, quiet: true});
      for (const file of watched) {
        if (existsSync(file)) watch(file, () => rebuild(path.basename(file)));
      }
      const imagesDir = path.join(deckDir, "images");
      if (existsSync(imagesDir)) {
        watch(imagesDir, {recursive: true}, () => rebuild("images/"));
      }
      console.log(`👀 监听中：content.mjs / theme.css / images/     Ctrl+C 退出`);
      return new Promise(() => {});
    }

    case "check": {
      await buildDeck({dir: target, quiet: true});
      const result = await checkDeck({
        dir: target,
        shots: flags.has("shots"),
        sync: flags.has("sync"),
        pdf: flags.has("pdf"),
        quiet: flags.has("quiet"),
      });
      console.log(result.ok ? "\n全部检查通过" : `\n${result.failures.length} 项未通过`);
      return result.ok ? 0 : 1;
    }

    case "export": {
      const formats = [];
      if (flags.has("all") || flags.has("pdf")) formats.push("pdf");
      if (flags.has("all") || flags.has("png")) formats.push("png");
      if (!formats.length) {
        console.error("要用 --pdf 或 --png（或 --all）指定导出格式。");
        return 1;
      }
      await buildDeck({dir: target, quiet: true});
      const scale = Number(flags.get("scale") ?? 2);
      if (!(scale >= 1)) {
        console.error("--scale 要是 ≥1 的数（1 = 1280×720，2 = 2560×1440）。");
        return 1;
      }
      await exportDeck({dir: target, formats, scale});
      return 0;
    }

    case "version":
      console.log(PACKAGE.version);
      return 0;

    case "help":
    default:
      console.log(HELP);
      return command === "help" ? 0 : 1;
  }
}

run(command).then(code => {
  if (code !== 0) process.exitCode = code;
}).catch(error => {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
});
