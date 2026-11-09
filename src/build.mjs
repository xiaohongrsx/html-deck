/* ============================================================================
   build.mjs — 构建核心：读 content.mjs → 校验 → 内联 → 单个 HTML + 讲稿
   ========================================================================== */
import fs from "node:fs/promises";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {code, escapeHtml as escape} from "./build-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = JSON.parse(readFileSync(path.join(HERE, "..", "package.json"), "utf8"));

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif",
};

/* ---------- 图标：内联 SVG，不引任何库 ---------- */
const ICONS = {
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  presenter: '<path d="M12 3a3 3 0 0 0-3 3v1H5a2 2 0 0 0-2 2v3h18V9a2 2 0 0 0-2-2h-4V6a3 3 0 0 0-3-3z"/><path d="m3 12 2 7a2 2 0 0 0 2 1.6h10A2 2 0 0 0 19 19l2-7"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  play: '<path d="M8 4.8v14.4L19.6 12z" fill="currentColor" stroke="none"/>',
  "arrow-up-right": '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
};
const icon = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const iconButton = (id, name, label, extra = "") =>
  `<button id="${id}" class="icon-button" type="button" title="${label}" aria-label="${label}" ${extra}>${icon(name)}</button>`;

/* ---------- 校验 ---------- */
const ROLES = new Set(["main", "detail", "reference"]);

function validate(slides, stages, deckFile, logic = []) {
  const problems = [];
  const ids = new Set();
  let seconds = 0;
  slides.forEach((slide, index) => {
    const at = `${path.basename(deckFile)} 第 ${index + 1} 页（${slide.id || "没有 id"}）`;
    if (!slide.id) problems.push(`${at}：缺少 id`);
    else if (ids.has(slide.id)) problems.push(`${at}：id 重复`);
    ids.add(slide.id);
    if (!slide.heading) problems.push(`${at}：缺少 heading`);
    if (!slide.html?.trim()) problems.push(`${at}：正文为空`);
    if (!Array.isArray(slide.notes) || slide.notes.length === 0) problems.push(`${at}：没有讲者备注 notes`);
    if (!Number.isInteger(slide.seconds) || slide.seconds <= 0) problems.push(`${at}：seconds 必须是正整数`);
    if (slide.stage !== null && slide.stage !== undefined &&
        (!Number.isInteger(slide.stage) || slide.stage < 0 || slide.stage >= stages.length)) {
      problems.push(`${at}：stage 越界（0–${stages.length - 1}）`);
    }
    if (slide.script !== undefined) {
      const spoken = Array.isArray(slide.script) ? slide.script : [slide.script];
      if (!spoken.length || spoken.some(text => typeof text !== "string" || !text.trim())) {
        problems.push(`${at}：script 必须是非空字符串或字符串数组`);
      }
    }
    if (slide.transition !== undefined &&
        (typeof slide.transition !== "string" || !slide.transition.trim())) {
      problems.push(`${at}：transition 必须是非空字符串`);
    }
    if (slide.role !== undefined && !ROLES.has(slide.role)) {
      problems.push(`${at}：role 只能是 main / detail / reference`);
    }
    seconds += slide.seconds || 0;
  });
  if (!slides.length) problems.push("一页都没有");
  if (!Array.isArray(logic)) {
    problems.push("logic 必须是数组");
  } else {
    logic.forEach((row, index) => {
      const at = `logic 第 ${index + 1} 行`;
      for (const key of ["range", "gained", "open"]) {
        if (typeof row?.[key] !== "string" || !row[key].trim()) problems.push(`${at}：缺少 ${key}`);
      }
    });
  }
  return {problems, seconds};
}

/* ---------- 加载内容 ---------- */
async function loadContent(deckDir) {
  const contentFile = path.join(deckDir, "content.mjs");
  if (!existsSync(contentFile)) {
    throw new Error(`找不到 ${contentFile}\n先用 html-deck new <目录> 建一个 deck。`);
  }
  const module = await import(pathToFileURL(contentFile).href + `?t=${Date.now()}`);

  const cache = new Map();
  const image = name => {
    if (cache.has(name)) return cache.get(name);
    const candidates = [path.join(deckDir, "images", name), path.join(deckDir, name)];
    const file = candidates.find(candidate => existsSync(candidate));
    if (!file) throw new Error(`找不到图片 ${name}（放到 ${path.join(deckDir, "images")} 下）`);
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) throw new Error(`不支持的图片格式：${file}`);
    const data = `data:${mime};base64,${readFileSync(file).toString("base64")}`;
    cache.set(name, data);
    return data;
  };

  const helpers = {code, image};
  let body = module.default ?? module;
  if (typeof body === "function") body = await body(helpers);

  const meta = body.meta || module.meta || {};
  const stages = body.stages || module.stages || [];
  const logic = body.logic || module.logic || [];
  const slides = typeof body.slides === "function" ? await body.slides(helpers) : body.slides || module.slides;
  return {meta, stages, logic, slides, image};
}

/* ---------- 主流程 ---------- */
export async function buildDeck({dir = ".", out, quiet = false} = {}) {
  const deckDir = path.resolve(dir);
  const outDir = out ? path.resolve(out) : deckDir;
  const {meta, stages, logic, slides} = await loadContent(deckDir);
  const contentFile = path.join(deckDir, "content.mjs");

  const {problems, seconds: totalSeconds} = validate(slides, stages, contentFile, logic);
  if (problems.length) {
    const error = new Error(`构建失败，${problems.length} 个问题：\n` + problems.map(problem => `  · ${problem}`).join("\n"));
    error.problems = problems;
    throw error;
  }

  const rail = stage => Number.isInteger(stage)
    ? `<div class="story-position" aria-label="当前环节：${escape(stages[stage])}">${
        stages.map((name, index) =>
          `<span${index === stage ? ' class="position-current"' : ""}>${escape(name)}</span>${
            index < stages.length - 1 ? '<span class="sep">›</span>' : ""}`).join("")
      }</div>`
    : "";

  const sections = slides.map((slide, index) => `
  <section id="slide-${escape(slide.id)}" class="slide${slide.kind ? ` ${escape(slide.kind)}` : ""}" data-slide="${index}"${index ? ' hidden inert aria-hidden="true"' : ' aria-hidden="false"'} aria-label="${escape(slide.heading)}">
    ${slide.kind === "cover" ? "" : `<header>${rail(slide.stage)}<h2>${escape(slide.heading)}</h2></header>`}
    <div class="slide-content">${slide.html}</div>
    <footer class="slide-footer"><span>${escape(slide.footer || meta.title || "")}</span><span>${String(index + 1).padStart(2, "0")} / ${slides.length}</span></footer>
  </section>`).join("\n");

  const overviewItems = slides.flatMap((slide, index) => {
    const block = [];
    if (Number.isInteger(slide.stage) && slide.stage !== slides[index - 1]?.stage) {
      block.push(`<p class="overview-section">${escape(stages[slide.stage])}</p>`);
    }
    if (slide.role === "reference" && slides[index - 1]?.role !== "reference") {
      block.push('<p class="overview-section">参考文献</p>');
    }
    block.push(`<button class="overview-item" type="button"${index === 0 ? ' aria-current="page"' : ""}>
    <span class="overview-number">${String(index + 1).padStart(2, "0")}</span>
    <span class="overview-heading">${escape(slide.heading)}</span>
    ${icon("arrow-up-right")}
  </button>`);
    return block;
  }).join("\n  ");

  const metadata = {
    title: meta.title || "未命名演示",
    subtitle: meta.subtitle || "",
    prepared: meta.prepared || "",
    version: PACKAGE.version,
    totalSeconds,
    stages,
    slides: slides.map(slide => ({
      id: slide.id,
      heading: slide.heading,
      short: slide.short || slide.heading,
      stage: Number.isInteger(slide.stage) ? stages[slide.stage] : null,
      seconds: slide.seconds,
      notes: slide.notes,
      sources: slide.sources || [],
    })),
  };
  const metadataJson = JSON.stringify(metadata).replace(/</g, "\\u003c");

  const baseStyles = await fs.readFile(path.join(HERE, "deck.css"), "utf8");
  const themeFile = path.join(deckDir, "theme.css");
  const themeStyles = existsSync(themeFile) ? await fs.readFile(themeFile, "utf8") : "";
  const player = await fs.readFile(path.join(HERE, "player.js"), "utf8");

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="generator" content="html-deck ${PACKAGE.version}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>${escape(metadata.title)}</title>
  <style>${baseStyles}${themeStyles ? `\n${themeStyles}` : ""}</style>
</head>
<body>
  <main class="app" aria-label="${escape(metadata.title)}">
    <div class="presentation-area">
      <div class="frame"><div class="slides">${sections}</div></div>
      <aside class="speaker-panel" aria-label="讲者备注">
        <div class="speaker-clocks">
          <div><p class="speaker-clock-label">已用时间</p><p id="speaker-elapsed" class="speaker-clock-value">00:00</p></div>
          <div><p class="speaker-clock-label">累计计划时间</p><p id="speaker-plan" class="speaker-clock-value">00:00</p></div>
        </div>
        <h2 id="speaker-current"></h2>
        <div id="speaker-notes" class="speaker-note"></div>
        <div class="speaker-next"><h3>下一页</h3><p id="speaker-next"></p></div>
        <div class="speaker-sources"><h3>本页出处</h3><ul id="speaker-sources"></ul></div>
        <p class="speaker-hint">← → 翻页 · N 讲者视图 · O 目录 · B 黑屏 · F 全屏</p>
      </aside>
    </div>
    <nav class="toolbar" aria-label="演示控制">
      <div class="toolbar-group">
        ${iconButton("previous-button", "chevron-left", "上一页", "disabled")}
        <span id="page-status" class="page-status" aria-live="polite">01 / ${slides.length}</span>
        ${iconButton("next-button", "chevron-right", "下一页")}
      </div>
      <span id="toolbar-title" class="toolbar-title">${escape(slides[0].short || slides[0].heading)}</span>
      <div id="clock-actions" class="clock-actions" hidden>
        ${iconButton("clock-toggle", "play", "开始计时")}
        ${iconButton("clock-reset", "rotate-ccw", "重置计时")}
      </div>
      <div class="toolbar-group">
        ${iconButton("overview-button", "grid", "页面列表")}
        ${iconButton("presenter-button", "presenter", "讲者视图")}
        ${iconButton("print-button", "printer", "打印 / 导出 PDF")}
        ${iconButton("fullscreen-button", "maximize", "全屏")}
      </div>
    </nav>
  </main>
  <div class="progress" aria-hidden="true"><div class="progress-fill"></div></div>
  <dialog id="overview-dialog" class="overview-dialog" aria-labelledby="overview-title">
    <div class="dialog-header"><h2 id="overview-title">页面列表</h2>${iconButton("overview-close", "x", "关闭页面列表", 'data-close-dialog="overview-dialog"')}</div>
    <div class="overview-list">${overviewItems}</div>
  </dialog>
  <dialog id="zoom-dialog" class="zoom-dialog" aria-labelledby="zoom-title">
    <div class="dialog-header">
      <h2 id="zoom-title">图示</h2>
      <div class="zoom-actions">
        ${iconButton("zoom-out", "minus", "缩小")}
        <span id="zoom-value" class="zoom-value">100%</span>
        ${iconButton("zoom-in", "plus", "放大")}
        ${iconButton("zoom-fit", "fit", "适合窗口")}
        ${iconButton("zoom-close", "x", "关闭", 'data-close-dialog="zoom-dialog"')}
      </div>
    </div>
    <div class="zoom-scroll"><div id="zoom-stage"></div></div>
  </dialog>
  <div id="toast" class="toast" role="status" hidden></div>
  <div id="blackout" class="blackout" hidden aria-label="黑屏"></div>
  <script id="deck-metadata" type="application/json">${metadataJson}</script>
  <script>${player.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>`;

  await fs.mkdir(outDir, {recursive: true});
  const outFile = path.join(outDir, "index.html");
  await fs.writeFile(outFile, html);

  const notesFile = path.join(deckDir, "讲稿.md");
  const mmss = value => {
    const total = Math.max(0, Math.round(value));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const starts = [];
  slides.reduce((acc, slide) => { starts.push(acc); return acc + slide.seconds; }, 0);

  const cell = text => String(text).replace(/\|/g, "\\|");
  const roleLabel = slide => slide.role === "detail" ? "案例" : slide.role === "reference" ? "参考" : "主线";
  const mainCount = slides.filter(slide => !slide.role || slide.role === "main").length;
  const detailCount = slides.filter(slide => slide.role === "detail").length;
  const referenceCount = slides.filter(slide => slide.role === "reference").length;
  const mixed = detailCount > 0 || referenceCount > 0;
  const roleParts = [];
  if (detailCount) roleParts.push(`${detailCount} 页主题案例`);
  if (referenceCount) roleParts.push(`${referenceCount} 页参考文献`);
  const roleNote = roleParts.length ? `含 ${mainCount} 页主线、${roleParts.join("、")}。` : "";

  const script = [
    `# ${metadata.title}`,
    "",
    ...(metadata.subtitle ? [`> ${metadata.subtitle}`, ""] : []),
    `共 ${slides.length} 页，计划 ${Math.round(totalSeconds / 60)} 分钟（${mmss(totalSeconds)}）。${roleNote}由 html-deck ${PACKAGE.version} 从 content.mjs 生成。`,
    "",
    ...(logic.length ? [
      "## 讲述逻辑",
      "",
      "| 页面 | 这一段得到什么 | 尚未解决什么 |",
      "| --- | --- | --- |",
      ...logic.map(row => `| ${cell(row.range)} | ${cell(row.gained)} | ${cell(row.open)} |`),
      "",
    ] : []),
    "## 时长一览",
    "",
    ...(mixed
      ? ["| 页 | 标题 | 类型 | 计划 | 累计 |", "| --- | --- | --- | --- | --- |"]
      : ["| 页 | 标题 | 计划 | 累计 |", "| --- | --- | --- | --- |"]),
    ...slides.map((slide, index) => mixed
      ? `| ${String(index + 1).padStart(2, "0")} | ${cell(slide.heading)} | ${roleLabel(slide)} | ${mmss(slide.seconds)} | ${mmss(starts[index] + slide.seconds)} |`
      : `| ${String(index + 1).padStart(2, "0")} | ${cell(slide.heading)} | ${mmss(slide.seconds)} | ${mmss(starts[index] + slide.seconds)} |`),
    "",
    ...slides.flatMap((slide, index) => {
      const spoken = slide.script === undefined
        ? null
        : (Array.isArray(slide.script) ? slide.script : [slide.script]);
      return [
        `## ${String(index + 1).padStart(2, "0")} · ${slide.heading}`,
        "",
        `${mmss(starts[index])} – ${mmss(starts[index] + slide.seconds)} · 计划 ${mmss(slide.seconds)}`,
        "",
        ...(spoken ?? slide.notes).flatMap(text => [text, ""]),
        ...(spoken && slide.notes?.length ? [`> 备注：${slide.notes.join(" ")}`, ""] : []),
        ...(slide.transition ? [`**过渡：${slide.transition}**`, ""] : []),
        ...(slide.sources?.length ? [`来源：${slide.sources.join("；")}`, ""] : []),
      ];
    }),
  ].join("\n");
  await fs.writeFile(notesFile, script);

  const result = {
    deckDir, outFile, notesFile,
    pages: slides.length,
    seconds: totalSeconds,
    bytes: Buffer.byteLength(html),
    title: metadata.title,
  };
  if (!quiet) {
    console.log(`✓ ${result.pages} 页 / ${Math.round(totalSeconds / 60)} 分钟 / 单文件 ${(result.bytes / 1024).toFixed(0)} KB`);
    console.log(`  ${path.relative(process.cwd(), outFile) || outFile}`);
    console.log(`  ${path.relative(process.cwd(), notesFile) || notesFile}`);
  }
  return result;
}
