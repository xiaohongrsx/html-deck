/* ============================================================================
   chrome.mjs — 找到本机浏览器，用 CDP 驱动它（自检与导出的基础设施）
   只依赖 Node 内置能力：child_process + fetch + WebSocket
   ========================================================================== */
import fs from "node:fs/promises";
import {rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";

const CANDIDATES = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

export const sleep = millis => new Promise(resolve => setTimeout(resolve, millis));

export async function waitFor(probe, {timeout = 15000, interval = 150, label = "等待超时"} = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch {}
    await sleep(interval);
  }
  throw new Error(label);
}

export async function findChrome() {
  for (const candidate of CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

/* ---------- 临时 profile：跑完就删，异常退出下次启动时回收 ---------- */
const live = new Set();
let exitHooked = false;

function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  process.on("exit", () => {
    for (const item of live) {
      try { item.child.kill(); } catch {}
      try { rmSync(item.profile, {recursive: true, force: true}); } catch {}
    }
    live.clear();
  });
}

async function sweepStale(maxAge = 12 * 60 * 60 * 1000) {
  const base = os.tmpdir();
  const entries = await fs.readdir(base, {withFileTypes: true}).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("html-deck-")) continue;
    const full = path.join(base, entry.name);
    const stat = await fs.stat(full).catch(() => null);
    if (stat && Date.now() - stat.mtimeMs > maxAge) {
      await fs.rm(full, {recursive: true, force: true}).catch(() => {});
    }
  }
}

/* ---------- 一个极小的 CDP 客户端 ---------- */
export async function connect(webSocketDebuggerUrl) {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error(`自检和导出需要内置 WebSocket，请用 Node 22 以上（当前 ${process.version}）`);
  }
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error("无法连接浏览器调试端口"));
  });

  let messageId = 0;
  const pending = new Map();
  const listeners = new Map();
  const eventWaiters = new Map();

  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    } else if (message.method) {
      const waiter = eventWaiters.get(message.method);
      if (waiter) {
        eventWaiters.delete(message.method);
        waiter();
      }
      for (const handler of listeners.get(message.method) ?? []) handler(message.params);
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, {resolve, reject});
    socket.send(JSON.stringify({id, method, params}));
  });

  const once = (name, timeout = 20000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`等待 ${name} 超时`)), timeout);
    eventWaiters.set(name, () => { clearTimeout(timer); resolve(); });
  });

  const evaluate = async expression => {
    const {result, exceptionDetails} = await send("Runtime.evaluate", {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text || exceptionDetails.exception?.description);
    return result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");

  const client = {
    socket,
    send,
    once,
    evaluate,
    async viewport(width, height, deviceScaleFactor = 1) {
      await send("Emulation.setDeviceMetricsOverride", {width, height, deviceScaleFactor, mobile: false});
    },
    async load(url, settle = 350) {
      const loaded = once("Page.loadEventFired");
      await send("Page.navigate", {url});
      await loaded;
      await sleep(settle);
      await evaluate("document.fonts.ready.then(() => true)").catch(() => {});
    },
    async screenshot(file, clip) {
      const {data} = await send("Page.captureScreenshot", clip ? {format: "png", clip} : {format: "png"});
      await fs.mkdir(path.dirname(file), {recursive: true});
      await fs.writeFile(file, Buffer.from(data, "base64"));
    },
    async pdf(file) {
      const {data} = await send("Page.printToPDF", {printBackground: true, preferCSSPageSize: true});
      const bytes = Buffer.from(data, "base64");
      await fs.mkdir(path.dirname(file), {recursive: true});
      await fs.writeFile(file, bytes);
      return bytes;
    },
    close() {
      try { socket.close(); } catch {}
    },
  };
  return client;
}

/* ---------- 启动一个无头浏览器 ---------- */
export async function startBrowser({headless = true, width = 1440, height = 900} = {}) {
  const chrome = await findChrome();
  if (!chrome) {
    throw new Error("找不到 Chrome / Edge。装一个，或用 CHROME 环境变量指定浏览器路径。");
  }
  await sweepStale();
  const port = 9411 + Math.floor(Math.random() * 400);
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "html-deck-"));
  const baseArgs = [
    "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-popup-blocking", `--window-size=${width},${height}`,
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
    // CI 的容器里没有 user namespace，沙箱起不来
    ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] : []),
  ];
  const modes = headless ? ["--headless=new", "--headless"] : [""];
  let child;
  let started = false;

  for (const mode of modes) {
    child = spawn(chrome, [...(mode ? [mode] : []), ...baseArgs], {stdio: "ignore"});
    try {
      await waitFor(async () => {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        return list.find(item => item.type === "page");
      }, {timeout: 15000});
      started = true;
      break;
    } catch {
      try { child.kill(); } catch {}
      await sleep(200);
    }
  }
  if (!started) {
    try { child?.kill(); } catch {}
    throw new Error("浏览器没能启动（用了 headless 模式）。");
  }

  const pages = async () => (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const record = {child, profile};
  live.add(record);
  hookExit();

  return {
    port,
    chrome,
    profile,
    pages,
    async connectFirst(predicate = item => item.type === "page") {
      const target = await waitFor(async () => (await pages()).find(item => predicate(item) && item.webSocketDebuggerUrl), {label: "找不到页面目标"});
      const client = await connect(target.webSocketDebuggerUrl);
      await client.viewport(width, height);
      return client;
    },
    async connectTo(predicate, options = {}) {
      const target = await waitFor(async () => (await pages()).find(item => predicate(item) && item.webSocketDebuggerUrl),
        {timeout: options.timeout ?? 10000, label: options.label || "找不到新窗口"});
      const client = await connect(target.webSocketDebuggerUrl);
      await client.viewport(width, height);
      return client;
    },
    async close() {
      live.delete(record);
      try { child.kill(); } catch {}
      await sleep(250);
      try { await fs.rm(profile, {recursive: true, force: true}); } catch {}
    },
  };
}
