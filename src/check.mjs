/* ============================================================================
   check.mjs — 自检：版心溢出 / 双窗口同步 / PDF 页数
   ========================================================================== */
import path from "node:path";
import {pathToFileURL} from "node:url";
import {startBrowser, sleep, waitFor} from "./chrome.mjs";

const MEASURE = index => `(() => {
  deck.goTo(${index});
  const slide = document.querySelector(".slide:not([hidden])");
  const content = slide.querySelector(".slide-content");
  const footer = slide.querySelector(".slide-footer");
  const boxes = [...content.children].map(node => node.getBoundingClientRect());
  const bottom = boxes.length ? Math.max(...boxes.map(box => box.bottom)) : 0;
  return {
    id: slide.id.replace(/^slide-/, ""),
    overflow: slide.scrollHeight - slide.clientHeight,
    spare: Math.round((footer.getBoundingClientRect().top - bottom) * 10) / 10,
  };
})()`;

export async function checkDeck({dir = ".", shots = false, sync = false, pdf = false, quiet = false} = {}) {
  const deckDir = path.resolve(dir);
  const entry = pathToFileURL(path.join(deckDir, "index.html")).href;
  const previewDir = path.join(deckDir, ".preview");
  const failures = [];
  const log = line => { if (!quiet) console.log(line); };
  const check = (ok, label, extra = "") => {
    log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
    if (!ok) failures.push(label);
  };

  const browser = await startBrowser();
  const main = await browser.connectFirst();
  try {
    await main.load(entry);
    const count = await main.evaluate("document.querySelectorAll('.slide').length");
    const rows = [];
    for (let index = 0; index < count; index++) {
      rows.push(await main.evaluate(MEASURE(index)));
      if (shots) {
        await sleep(120);
        await main.screenshot(path.join(previewDir, `p${String(index + 1).padStart(2, "0")}-${rows.at(-1).id}.png`));
      }
    }

    if (!quiet) {
      console.log("页码  id                  溢出px   底边余量px");
      rows.forEach((row, index) => {
        console.log(`${String(index + 1).padStart(2)}    ${row.id.padEnd(18)}${String(row.overflow).padStart(6)}${String(row.spare).padStart(11)}`);
      });
    }
    const tight = rows.filter(row => row.overflow > 0 || row.spare < -1);
    check(tight.length === 0, `${count} 页全部在 1280×720 以内`,
      tight.length ? `第 ${tight.map(row => rows.indexOf(row) + 1).join("、")} 页撑出去了` : "");

    if (sync) {
      await main.evaluate("deck.goTo(0)");
      await main.evaluate(`document.getElementById("presenter-button").click()`);
      const speaker = await browser.connectTo(
        item => item.type === "page" && item.url.includes("presenter=1"),
        {label: "讲者窗口没有打开（浏览器拦截了弹窗？）"},
      ).catch(error => (check(false, "讲者窗口被打开", error.message), null));

      if (speaker) {
        await waitFor(async () =>
          (await speaker.evaluate("document.readyState")) === "complete", {timeout: 8000}).catch(() => {});
        await sleep(600);
        const presenter = await speaker.evaluate("document.body.classList.contains('presenter')");
        check(presenter, "讲者窗口进入两栏布局");
        const notes = await speaker.evaluate("document.querySelectorAll('#speaker-notes p').length");
        check(notes > 0, "备注已填进面板", `${notes} 段`);

        const heading = await main.evaluate("deck.meta.slides[3]?.heading");
        if (heading) {
          await main.evaluate("deck.goTo(3)");
          await sleep(500);
          const shown = await speaker.evaluate("document.getElementById('speaker-current').textContent");
          check(shown === heading, "主窗口翻页 → 讲者面板跟着换", `第 4 页：${heading}`);
          await speaker.evaluate(`document.getElementById("next-button").click()`);
          await sleep(500);
          const back = await main.evaluate("deck.currentIndex");
          check(back === 4, "讲者窗口点下一页 → 主窗口跟着翻", `主窗口在第 ${back + 1} 页`);
        }
        if (shots) {
          await speaker.evaluate("deck.goTo(0)");
          await sleep(200);
          await speaker.screenshot(path.join(previewDir, "presenter.png"));
        }
        speaker.close();
      }
    }

    if (pdf) {
      const bytes = await main.pdf(path.join(previewDir, "deck.pdf"));
      const pages = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
      check(pages === count, "打印 PDF 页数等于幻灯片页数", `${pages} 页，${(bytes.length / 1024).toFixed(0)} KB`);
    }

    return {ok: failures.length === 0, failures, rows};
  } finally {
    main.close();
    await browser.close();
  }
}
