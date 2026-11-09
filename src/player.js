/* ============================================================================
   player.js — 演示运行时
   职责：缩放画布 / 翻页 / 讲者视图双窗口同步 / 计时 / 目录 / 放大 / 打印
   约定：主窗口是唯一真相源，讲者窗口只是镜像 + 遥控器。
   ========================================================================== */
(() => {
  "use strict";

  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 4.8v14.4L19.6 12z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="4.6" width="3.7" height="14.8" rx="1"/><rect x="13.3" y="4.6" width="3.7" height="14.8" rx="1"/></svg>',
    maximize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>',
  };

  const meta = JSON.parse(document.getElementById("deck-metadata").textContent);
  const slides = Array.from(document.querySelectorAll(".slide"));
  const area = document.querySelector(".presentation-area");
  const frame = document.querySelector(".frame");
  const counter = document.getElementById("page-status");
  const progress = document.querySelector(".progress-fill");
  const overview = document.getElementById("overview-dialog");
  const zoomDialog = document.getElementById("zoom-dialog");
  const zoomStage = document.getElementById("zoom-stage");
  const blackout = document.getElementById("blackout");

  const params = new URLSearchParams(location.search);
  const compact = matchMedia("(max-width: 760px), (max-width: 1024px) and (max-height: 500px)");
  const isPresenter = params.get("presenter") === "1";
  const session = params.get("session") ||
    globalThis.crypto?.randomUUID?.() || `deck-${Date.now()}-${Math.random()}`;

  let currentIndex = 0;
  let speakerWindow = null;
  let zoomScale = 1;
  let toastTimer;
  let pointerStart = null;
  let clockRunning = false;
  let clockAccumulated = 0;
  let clockStartedAt = 0;
  let presenterElapsed = 0;
  let clockStarted = false;

  const formatTime = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  const elapsed = () => clockAccumulated + (clockRunning ? Date.now() - clockStartedAt : 0);
  const announce = text => {
    const toast = document.getElementById("toast");
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
  };

  /* ---------- 1. 画布缩放：永远 1280×720，只缩放不重排 ---------- */
  function resize() {
    if (compact.matches) {
      frame.style.removeProperty("width");
      frame.style.removeProperty("height");
      document.documentElement.style.setProperty("--scale", "1");
      return;
    }
    const style = getComputedStyle(area);
    const availableWidth = area.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    // 讲者视图是两栏：幻灯片那一栏只占约 1.15/1.95 的宽度
    const width = isPresenter && innerWidth > 1100 ? (availableWidth - 26) * 1.15 / 1.95 : availableWidth;
    const scale = Math.max(.2, Math.min(width / 1280, availableHeight / 720, 1.65));
    document.documentElement.style.setProperty("--scale", String(scale));
    frame.style.width = `${1280 * scale}px`;
    frame.style.height = `${720 * scale}px`;
  }

  /* ---------- 2. 讲者视图的内容填充 ---------- */
  function updateSpeaker() {
    const slide = meta.slides[currentIndex];
    document.getElementById("speaker-current").textContent = slide.heading;
    document.getElementById("speaker-notes").replaceChildren(...slide.notes.map(text => {
      const p = document.createElement("p");
      p.textContent = text;
      return p;
    }));
    document.getElementById("speaker-next").textContent = meta.slides[currentIndex + 1]?.heading || "结束";
    const planned = meta.slides.slice(0, currentIndex + 1).reduce((sum, item) => sum + item.seconds, 0);
    document.getElementById("speaker-plan").textContent = formatTime(planned * 1000);
    document.getElementById("speaker-sources").replaceChildren(...(slide.sources || []).map(text => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }));
  }

  /* ---------- 3. 主窗口 → 讲者窗口的状态广播 ---------- */
  function postState() {
    if (!speakerWindow || speakerWindow.closed) return;
    speakerWindow.postMessage({
      channel: session,
      type: "state",
      index: currentIndex,
      elapsed: elapsed(),
      running: clockRunning,
    }, "*");
  }

  /* ---------- 4. 翻页 ---------- */
  function goTo(index, {broadcast = true, user = false} = {}) {
    if (!Number.isFinite(index)) return;
    const next = Math.max(0, Math.min(slides.length - 1, Math.trunc(index)));
    const previous = currentIndex;
    currentIndex = next;
    slides.forEach((slide, number) => {
      const active = number === currentIndex;
      slide.hidden = !active;
      slide.inert = !active;
      slide.setAttribute("aria-hidden", String(!active));
    });
    counter.textContent = `${String(currentIndex + 1).padStart(2, "0")} / ${slides.length}`;
    document.getElementById("toolbar-title").textContent = meta.slides[currentIndex].short || meta.slides[currentIndex].heading;
    document.getElementById("previous-button").disabled = currentIndex === 0;
    document.getElementById("next-button").disabled = currentIndex === slides.length - 1;
    progress.style.width = `${((currentIndex + 1) / slides.length) * 100}%`;
    document.querySelectorAll(".overview-item").forEach((item, number) => {
      if (number === currentIndex) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    try {
      history.replaceState(null, "", `#slide-${meta.slides[currentIndex].id}`);
    } catch {}
    if (isPresenter) updateSpeaker();
    if (user && currentIndex !== previous && !isPresenter) {
      if (!clockStarted && currentIndex > 0) {
        clockStarted = true;
        clockRunning = true;
        clockStartedAt = Date.now();
      }
      if (compact.matches) area.scrollTo({top: 0, behavior: "instant"});
    }
    if (broadcast) {
      if (isPresenter && window.opener) {
        window.opener.postMessage({channel: session, type: "navigate", index: currentIndex}, "*");
      } else {
        postState();
      }
    }
  }

  /* ---------- 5. 打开讲者视图：同文件 + ?presenter=1 ---------- */
  function openPresenter() {
    if (isPresenter) return;
    const url = new URL(location.href);
    url.searchParams.set("presenter", "1");
    url.searchParams.set("session", session);
    speakerWindow = window.open(url.href, `speaker-${session}`, "popup,width=1440,height=960");
    if (!speakerWindow) announce("讲者窗口被浏览器拦截了");
    else speakerWindow.focus();
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      announce("当前窗口无法进入全屏");
    }
  }

  /* ---------- 6. 计时器：数值只存在于主窗口 ---------- */
  function updateClock() {
    const ms = isPresenter ? presenterElapsed : elapsed();
    document.getElementById("speaker-elapsed").textContent = formatTime(ms);
    const toggle = document.getElementById("clock-toggle");
    toggle.setAttribute("title", clockRunning ? "暂停计时" : "开始计时");
    toggle.setAttribute("aria-label", clockRunning ? "暂停计时" : "开始计时");
    const wanted = clockRunning ? "pause" : "play";
    if (toggle.dataset.icon !== wanted) {
      toggle.dataset.icon = wanted;
      toggle.innerHTML = ICON[wanted];
    }
  }

  function clockAction(action) {
    if (isPresenter && window.opener) {
      window.opener.postMessage({channel: session, type: "clock", action}, "*");
      return;
    }
    if (action === "reset") {
      clockAccumulated = 0;
      clockRunning = false;
      clockStarted = false;
      clockStartedAt = 0;
    } else if (clockRunning) {
      clockAccumulated = elapsed();
      clockRunning = false;
    } else {
      clockStarted = true;
      clockRunning = true;
      clockStartedAt = Date.now();
    }
    updateClock();
    if (isPresenter) updateSpeaker();
    postState();
  }

  /* ---------- 7. 点任何 .zoomable 都能放大看得更清 ---------- */
  function applyZoom(value) {
    const item = zoomStage.firstElementChild;
    if (!item) return;
    zoomScale = Math.min(4, Math.max(.2, value));
    item.style.zoom = String(zoomScale);
    document.getElementById("zoom-value").textContent = `${Math.round(zoomScale * 100)}%`;
  }

  function fitZoom() {
    const item = zoomStage.firstElementChild;
    if (!item) return;
    item.style.zoom = "1";
    const w = item.offsetWidth;
    const h = item.offsetHeight;
    if (!w || !h) return;
    const scroll = zoomDialog.querySelector(".zoom-scroll");
    applyZoom(Math.min((scroll.clientWidth - 56) / w, (scroll.clientHeight - 56) / h, 2));
  }

  function openZoom(element) {
    const clone = element.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    clone.classList.remove("zoomable");
    zoomStage.replaceChildren(clone);
    zoomDialog.showModal();
    fitZoom();
    zoomDialog.querySelector(".zoom-scroll").scrollTo(0, 0);
  }

  /* ---------- 8. 绑定控件 ---------- */
  document.getElementById("previous-button").addEventListener("click", () => goTo(currentIndex - 1, {user: true}));
  document.getElementById("next-button").addEventListener("click", () => goTo(currentIndex + 1, {user: true}));
  document.getElementById("fullscreen-button").addEventListener("click", fullscreen);
  document.getElementById("presenter-button").addEventListener("click", openPresenter);
  document.getElementById("overview-button").addEventListener("click", () => overview.showModal());
  document.getElementById("print-button").addEventListener("click", () => window.print());
  document.getElementById("clock-toggle").addEventListener("click", () => clockAction("toggle"));
  document.getElementById("clock-reset").addEventListener("click", () => clockAction("reset"));
  document.getElementById("zoom-in").addEventListener("click", () => applyZoom(zoomScale * 1.25));
  document.getElementById("zoom-out").addEventListener("click", () => applyZoom(zoomScale / 1.25));
  document.getElementById("zoom-fit").addEventListener("click", fitZoom);
  document.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close());
  });
  document.querySelectorAll(".overview-item").forEach((button, index) => {
    button.addEventListener("click", () => {
      goTo(index, {user: true});
      overview.close();
    });
  });
  document.querySelectorAll(".zoomable").forEach(element => {
    element.addEventListener("click", () => openZoom(element));
  });
  [overview, zoomDialog].forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });

  /* ---------- 9. 键盘 / 触屏 ---------- */
  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest("input, textarea, select, [contenteditable=true]")) return;
    if (document.querySelector("dialog[open]")) return;
    if (event.key === "Escape") { blackout.hidden = true; return; }
    if (event.key === " " && event.target.closest("button, a")) return;
    const actions = {
      ArrowRight: () => goTo(currentIndex + 1, {user: true}),
      PageDown: () => goTo(currentIndex + 1, {user: true}),
      " ": () => goTo(currentIndex + 1, {user: true}),
      ArrowLeft: () => goTo(currentIndex - 1, {user: true}),
      PageUp: () => goTo(currentIndex - 1, {user: true}),
      Home: () => goTo(0, {user: true}),
      End: () => goTo(meta.slides.length - 1, {user: true}),
      f: fullscreen, F: fullscreen,
      o: () => overview.showModal(), O: () => overview.showModal(),
      n: openPresenter, N: openPresenter,
      b: () => { blackout.hidden = !blackout.hidden; },
      B: () => { blackout.hidden = !blackout.hidden; },
    };
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  });
  blackout.addEventListener("click", () => { blackout.hidden = true; });
  area.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || !event.isPrimary || event.target.closest("button, a, .zoomable")) return;
    pointerStart = {x: event.clientX, y: event.clientY};
  }, {passive: true});
  area.addEventListener("pointerup", event => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      goTo(currentIndex + (dx < 0 ? 1 : -1), {user: true});
    }
  }, {passive: true});
  area.addEventListener("pointercancel", () => { pointerStart = null; });

  /* ---------- 10. 双窗口协议 ---------- */
  window.addEventListener("message", event => {
    const data = event.data;
    if (!data || data.channel !== session) return;      // 只认本场 session
    if (isPresenter && event.source === window.opener && data.type === "state") {
      if (!Number.isInteger(data.index) || !Number.isFinite(data.elapsed)) return;
      presenterElapsed = Math.max(0, data.elapsed);
      clockRunning = data.running === true;
      goTo(data.index, {broadcast: false});
      updateClock();
    } else if (!isPresenter && event.source === speakerWindow) {
      if (data.type === "ready") postState();
      if (data.type === "navigate" && Number.isInteger(data.index)) goTo(data.index, {user: true});
      if (data.type === "clock" && ["toggle", "reset"].includes(data.action)) clockAction(data.action);
    }
  });

  /* ---------- 11. 用 #slide-id 记住看到哪一页 ---------- */
  const indexFromHash = () => {
    const value = location.hash.match(/^#slide-(.+)$/)?.[1];
    if (!value) return -1;
    if (/^\d+$/.test(value)) return Number(value) - 1;
    return meta.slides.findIndex(slide => slide.id === value);
  };
  window.addEventListener("hashchange", () => {
    const index = indexFromHash();
    if (index >= 0) goTo(index);
  });
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", () => {
    resize();
    const button = document.getElementById("fullscreen-button");
    const active = Boolean(document.fullscreenElement);
    button.setAttribute("title", active ? "退出全屏" : "全屏");
    button.setAttribute("aria-label", active ? "退出全屏" : "全屏");
    button.innerHTML = ICON[active ? "minimize" : "maximize"];
  });

  /* ---------- 12. 启动 ---------- */
  if (isPresenter) {
    document.body.classList.add("presenter");
    document.getElementById("presenter-button").hidden = true;
    document.getElementById("clock-actions").hidden = false;
    document.title = `${meta.title} · 讲者视图`;
  }
  const initial = indexFromHash();
  goTo(initial >= 0 ? initial : 0, {broadcast: false});
  updateClock();
  resize();
  if (isPresenter && window.opener) {
    window.opener.postMessage({channel: session, type: "ready"}, "*");
  }
  setInterval(() => {
    if (isPresenter && clockRunning) presenterElapsed += 1000;   // 两帧之间做平滑
    updateClock();
    if (!isPresenter) postState();
  }, 1000);

  // 供外部脚本/检查工具使用
  globalThis.deck = Object.freeze({
    get currentIndex() { return currentIndex; },
    get length() { return slides.length; },
    goTo,
    resize,
    meta,
  });
})();
