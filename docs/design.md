# 设计说明

这份文档只讲 html-deck 自己的实现，不涉及它参考过的其他项目。

## 1. 固定画布 + 整体缩放

`.slides` 固定 1280×720，`transform: scale(var(--scale))`，`transform-origin: top left`。窗口变化时算：

```js
--scale = clamp(0.2, min(w / 1280, h / 720), 1.65)
```

`.frame` 的宽高也乘上 scale，外框跟着缩，不会出现"里缩放、外不缩"的错位。

好处是所有页面的排版、字号、留白都按 1280×720 写死，不需要任何响应式；投到 4:3 屏幕上会等比缩小并居中。`check` 量的溢出和底边余量也基于这个坐标系，所以数字可复现。

## 2. 页面是叠放的 section

每页一个 `<section class="slide">`，绝对定位叠在一起，切换只改 `hidden` + `inert` + `aria-hidden`。没有路由、没有动画库；每页有 `#slide-<id>` 锚点，可以深链到某一页。

## 3. 讲者视图就是同一个文件

主窗口按 `N` 执行 `window.open(url + "?presenter=1&session=<uuid>", "speaker-" + session, ...)`。

加载时如果 URL 带 `presenter=1`，就给 `body` 加 `.presenter` 类，CSS 把 `.presentation-area` 从 flex 换成：

```css
grid-template-columns: minmax(0, 1.15fr) minmax(320px, .8fr);
```

右栏 `.speaker-panel` 随之显示：幻灯片预览、备注、已用时间、累计计划时间、下一页标题、本页出处。

### postMessage 协议

两个窗口之间只认 `data.channel === session` 且 `event.source` 对得上的消息：

| 类型 | 方向 | 内容 |
| --- | --- | --- |
| `state` | 主 → 讲 | 当前页、已用时间、是否在计时 |
| `navigate` | 讲 → 主 | 下一页 / 上一页 / 跳到某页的**意图** |
| `clock` | 讲 → 主 | 开始 / 暂停计时 |
| `ready` | 讲 → 主 | 讲者窗口加载完毕 |

**主窗口是唯一真相源**：讲者窗口点"下一页"只是发个意图，页码由主窗口应用后广播回来。两边永远不会错位。

## 4. 计时器只存两个数

```js
elapsed = accumulated + (now - startedAt)
```

不是每帧累加，所以切窗口、休眠、切标签页都不丢时间。讲者窗口拿不到主窗口的高精度时间，就用本地 `+= 1000` 平滑走，每次收到 `state` 时校正。

## 5. 构建期把所有事做完

`src/build.mjs` 读 `content.mjs` → 校验 → 内联 → 写 `index.html`：

1. 校验：`id` 唯一、`heading` / `notes` 非空、`seconds` 是正整数、`stage` 下标在 `stages` 范围内
2. 内联：`deck.css`、`player.js`、`theme.css`、图片（base64）、元数据 JSON
3. 任何一条校验失败直接 `throw`，不产出半成品

产物的 CSP 是：

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src data:; font-src data:; connect-src 'none'
```

外链图片、外链字体、外链脚本在产物里都加载不了——逼你把东西内联进来，交出去才真能离线打开。

## 6. 自检用真的浏览器

`src/chrome.mjs` 是一个零依赖的 CDP 客户端（Node 18+ 自带 `fetch`，Node 24 自带 `WebSocket`）：起一个 `--headless=new` 的 Chrome，用临时配置目录。

- 版心：逐页量 `scrollHeight - clientHeight`，负数就是溢出；再量内容底边到页脚的距离（底边余量）
- 同步：真的开两个窗口，验证 `postMessage` 双向都能到
- 打印：`Page.printToPDF` 后数 `/Type /Page`，和页数对不上就报错

"这页放不放得下"不靠肉眼，靠数字。

## 7. 为什么零依赖

构建是字符串拼接，自检和导出走 CDP，语法高亮二十行。整个仓库不到 100 KB，clone 下来 `npm link` 就能用，不需要 `npm install`，也就没有供应链风险。
