/* ============================================================================
   export.mjs — 导出：PDF（一份文件交出去）/ PNG（每页一张 2560×1440）
   ========================================================================== */
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {startBrowser, sleep} from "./chrome.mjs";

// 截图前把画布钉死在 1:1，避免浏览器尺寸影响导出分辨率
const FREEZE = `(() => {
  document.documentElement.style.setProperty("--scale", "1");
  const frame = document.querySelector(".frame");
  frame.style.width = "1280px";
  frame.style.height = "720px";
  return true;
})()`;

export async function exportDeck({dir = ".", formats = ["pdf"], scale = 2, quiet = false} = {}) {
  const deckDir = path.resolve(dir);
  const entry = pathToFileURL(path.join(deckDir, "index.html")).href;
  const outDir = path.join(deckDir, "export");
  await fs.mkdir(outDir, {recursive: true});

  const browser = await startBrowser({width: 1340, height: 820});
  const page = await browser.connectFirst();
  const result = {pdf: null, png: []};
  try {
    await page.load(entry);
    await page.evaluate(FREEZE);
    const total = await page.evaluate("document.querySelectorAll('.slide').length");

    if (formats.includes("pdf")) {
      const file = path.join(outDir, "slides.pdf");
      const bytes = await page.pdf(file);
      result.pdf = {file, pages: (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length, bytes: bytes.length};
      if (!quiet) console.log(`✓ PDF   ${path.relative(process.cwd(), file)}（${result.pdf.pages} 页，${(bytes.length / 1024).toFixed(0)} KB）`);
    }

    if (formats.includes("png")) {
      await page.viewport(1340, 820, scale);   // 像素密度 = scale，版式仍是 1280×720
      await page.evaluate(FREEZE);
      for (let index = 0; index < total; index++) {
        await page.evaluate(`deck.goTo(${index})`);
        await sleep(90);
        const rect = await page.evaluate(`(() => {
          const box = document.querySelector(".frame").getBoundingClientRect();
          return {x: box.x, y: box.y, width: box.width, height: box.height};
        })()`);
        const file = path.join(outDir, `slide-${String(index + 1).padStart(2, "0")}.png`);
        await page.screenshot(file, {...rect, scale: 1});
        result.png.push(file);
      }
      if (!quiet) console.log(`✓ PNG   ${path.relative(process.cwd(), outDir)}（${result.png.length} 张，1280×720 版式 → ${1280 * scale}×${720 * scale} 像素）`);
    }
    return result;
  } finally {
    page.close();
    await browser.close();
  }
}
