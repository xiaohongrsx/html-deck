/* ============================================================================
   content.mjs — 你的演示内容
   一页一个对象：id / heading / html / notes / seconds / sources / stage / script / transition
   改完运行：html-deck build
   ========================================================================== */
export const meta = {
  title: "示例演示：从内容到单文件",
  subtitle: "一句话说清这份材料要回答什么问题",
  prepared: "2026-11-09",
};

// 顶部导轨的环节名，按顺序显示；stage 用下标引用
export const stages = ["开场", "方法", "结果", "下一步"];

// 可选：讲述逻辑，生成到 讲稿.md 开头
export const logic = [
  {range: "1–2", gained: "一句话说清这份材料要回答什么", open: "为什么这件事现在要回答"},
  {range: "3–4", gained: "给出设置和一张主图", open: "这个结论在什么边界内成立"},
  {range: "5", gained: "讲不完时怎么拆页（主题案例）", open: "拆完还缺哪一块"},
  {range: "6–7", gained: "下一步、分工和延伸阅读", open: "谁在什么时间点交付"},
];

export const slides = ({code, image}) => [
  {
    id: "cover",
    short: "封面",
    kind: "cover",
    stage: null,
    heading: "示例演示：从内容到单文件",
    seconds: 40,
    footer: "汇报人 · 2026",
    html: `
<div class="cover">
  <p class="kicker">课题组周会 · 2026 秋季</p>
  <h1>一句话说清这份<br><em>材料在讲什么</em></h1>
  <p class="cover-sub">副标题可以写研究问题、数据规模或结论的版本号。<br>两行以内，不要超过三行。</p>
  <div class="cover-stats">
    <div><b>7</b><span>页</span></div>
    <div><b>10</b><span>分钟</span></div>
    <div><b>3</b><span>个主要结论</span></div>
  </div>
</div>`,
    notes: [
      "开场不要念标题。用一句话说清：这次汇报要回答什么问题，为什么现在要回答它。",
      "讲者视图里的这一段只给你自己看，投影片上不会出现。",
    ],
    sources: ["数据来源：填写实验编号 / 论文标题"],
    // 可选：口播稿。写了就整段进 讲稿.md；不写就导出上面的 notes
    script: [
      "今天用八分钟讲一件事：一份内容怎么变成一个能直接讲的网页。",
      "先说结论：内容写成数据，排版交给引擎，交付只有一个文件。",
      "下面按三步走：先写内容，再看版式，最后验收和导出。",
    ],
    // 可选：下一页的过渡句，讲稿里会加粗
    transition: "先说第一个结论：为什么要把内容写成数据。",
  },

  {
    id: "summary",
    short: "结论先行",
    stage: 0,
    heading: "先给结论，再给证据",
    seconds: 100,
    footer: "每一页只讲一件事",
    html: `
<p class="lead">把最重要的判断放在最前面。听众只需要记住 <em>三件事</em>，剩下的都是支撑。</p>
<div class="cards c3">
  <div class="card"><div class="num">01</div><div class="ttl">结论一</div><div class="p">一句话写清楚，不要用「有一定提升」这种糊说法，给方向和量级。</div></div>
  <div class="card"><div class="num">02</div><div class="ttl">结论二</div><div class="p">第二条同样要具体：在什么设置下、相对什么基线、差多少。</div></div>
  <div class="card"><div class="num">03</div><div class="ttl">结论三</div><div class="p">如果暂时没有第三个结论，就删掉这张卡，不要凑数。</div></div>
</div>
<table class="table">
  <thead><tr><th style="width:20%">结论</th><th style="width:40%">证据</th><th>在第几页</th></tr></thead>
  <tbody>
    <tr><td>结论一</td><td>主实验对比</td><td>第 3 页</td></tr>
    <tr><td>结论二</td><td>消融</td><td>第 4 页</td></tr>
    <tr><td>结论三</td><td>边界条件</td><td>第 4 页</td></tr>
  </tbody>
</table>
<div class="callout">下面每一页都能回答「这一页在支撑上面哪一条」。答不上来的页，删掉。</div>`,
    notes: [
      "这一页是全场最容易被记住的一页，写完再回头检查一遍：三条结论之间有没有重叠。",
      "卡片的字号已经调好，超过三行就会挤；写不下说明结论还不够锋利。",
    ],
    sources: [],
  },

  {
    id: "setup",
    short: "实验设置",
    stage: 1,
    heading: "把设置讲清楚，比讲结果重要",
    seconds: 120,
    footer: "表格只留三列：变量、取值、说明",
    html: `
<div class="kpis">
  <div class="kpi hot"><b>12 万</b><span>条偏好对</span></div>
  <div class="kpi"><b>2</b><span>个模型规模</span></div>
  <div class="kpi"><b>4</b><span>个评测集</span></div>
  <div class="kpi"><b>3</b><span>个 epoch</span></div>
</div>
<table class="table">
  <thead><tr><th style="width:24%">变量</th><th style="width:30%">取值</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>模型</td><td>7B / 32B</td><td>同一个 base，只换规模</td></tr>
    <tr><td>数据</td><td>12 万条偏好对</td><td>与基线完全同分布，不做重采样</td></tr>
    <tr><td>训练</td><td>3 epoch，lr 1e-6</td><td>超参沿用主实验，未针对本组调参</td></tr>
    <tr><td>评测</td><td>4 个 benchmark</td><td>报告平均分与最差一项</td></tr>
  </tbody>
</table>
<p class="tiny">脚注写清楚哪些是复现、哪些引用自原论文，避免被追问时说不清。</p>
<div class="callout">时间不够时只讲「数据」这一行——它是后面所有结论的前提，其余三行留给提问环节。</div>`,
    notes: [
      "设置页不要念表格，挑两个最容易被质疑的点说：为什么用这个数据、为什么没调参。",
      "评审最喜欢问的就是「你是不是只在自己有利的设置上比」。",
    ],
    sources: ["原论文 Table 2", "本地复现脚本 run_setup.sh"],
  },

  {
    id: "result",
    short: "主要结果",
    stage: 2,
    heading: "一张图讲完主要结果",
    seconds: 150,
    footer: "图片放进 images/ 目录，构建时会自动内联成单文件",
    html: `
<div class="split ratio-6-4 stretch">
  <figure class="figure zoomable">
    <img src="${image("sample.svg")}" alt="示例示意图">
    <figcaption>示例图：点一下可以整屏放大，滚轮缩放；换成你自己的结果图即可。</figcaption>
  </figure>
  <div class="stack">
    <h3 class="h3">怎么读这张图</h3>
    <div class="bullets">
      <div><b>先看轴</b>：横轴是什么、纵轴单位是什么，一句话交代。</div>
      <div><b>再看差</b>：和基线差多少，能不能被噪声解释。</div>
      <div><b>最后看边界</b>：什么情况下这个结论不成立。</div>
    </div>
    <div class="callout">读图落点：先说轴，再说差，最后说边界——三句话讲完一张图，超过三句说明图没选对。</div>
  </div>
</div>`,
    notes: [
      "这页的目标不是让听众看清每个数字，是让他们相信「差异是真的」。所以先讲轴和基线，再讲差。",
      "如果被问到误差棒，要能立刻说清楚是自己算的还是原论文报的。",
    ],
    sources: ["images/sample.svg（占位图，记得替换）"],
  },

  {
    id: "case",
    short: "案例：拆页",
    role: "detail",
    stage: 2,
    heading: "案例：一页讲不完时怎么拆",
    seconds: 70,
    footer: "拆页的判断标准在最后那句 callout 里",
    html: `
<p class="lead">这一页原本和方法、结果挤在一起，<em>按「一页只回答一个问题」拆开</em>之后才讲得完。</p>
<table class="table">
  <thead><tr><th style="width:18%">页</th><th style="width:30%">只回答一个问题</th><th>证据放哪</th></tr></thead>
  <tbody>
    <tr><td>方法页</td><td>我们是怎么做的</td><td>设置表，三列以内</td></tr>
    <tr><td>结果页</td><td>差多少、能不能被噪声解释</td><td>一张主图加一行结论</td></tr>
    <tr><td>局限</td><td>什么时候不成立</td><td>写进讲者备注，不占版面</td></tr>
  </tbody>
</table>
<div class="callout">判断标准：把标题、图、结论分别念一遍，三者说的不是同一件事，就该拆成两页。</div>`,
    notes: [
      "案例页的作用是示范「拆页」这个动作，不是补充新结论；讲的时候用 30 秒带过即可。",
      "如果时间紧，这页可以整页跳过，主线不受影响——这就是主题案例的意思。",
    ],
    script: [
      "插一个案例。这一页原本和方法、结果挤在一起，讲的时候听众跟不上。",
      "拆的原则很简单：一页只回答一个问题。方法页只讲怎么做，结果页只讲差多少。",
      "局限性不用占版面，写进讲者备注就行，被问到再展开。",
    ],
    transition: "拆完之后，回到主线：接下来做什么。",
    sources: [],
  },

  {
    id: "next",
    short: "下一步",
    stage: 3,
    heading: "接下来做什么",
    seconds: 80,
    footer: "给明确的时间点，不要写「后续计划」",
    html: `
<div class="steps">
  <div class="step"><b>STEP 1</b><h4>本周</h4><p>把消融跑完，补齐 32B 的两组设置。</p></div>
  <div class="step"><b>STEP 2</b><h4>下周</h4><p>整理成一张总图，确定投哪一篇。</p></div>
  <div class="step"><b>STEP 3</b><h4>月底</h4><p>初稿写完，内部过一遍逻辑。</p></div>
</div>
${code(`# 构建与自检
html-deck build              # 改完 content.mjs 跑一次
html-deck dev                # 或者开着它，存盘自动重建
html-deck check --sync       # 版心溢出 + 讲者视图同步
html-deck export --pdf       # 交给导师的版本
html-deck export --png       # 每页一张 2560×1440，贴进任何地方`)}
<div class="callout">三步里只有第一步是本周必须做完的；二和三可以并行，不要串成一条链。</div>`,
    notes: [
      "结尾别写「谢谢」，写下一步和需要谁配合。",
      "这一页的代码块是提示：这份文件本身就可以用三条命令维护。",
    ],
    sources: [],
  },

  {
    id: "reading",
    short: "延伸阅读",
    role: "reference",
    stage: 3,
    heading: "延伸阅读",
    seconds: 40,
    footer: "文档比博客可靠，版本号一起记下来",
    html: `
<p class="lead">这套做法依赖的东西都不新：<em>查规范比查博客省时间</em>。</p>
<table class="table">
  <thead><tr><th style="width:26%">主题</th><th>出处</th></tr></thead>
  <tbody>
    <tr><td>transform 缩放</td><td>CSS Transforms Level 1（W3C）</td></tr>
    <tr><td>窗口间通信</td><td>HTML Standard · postMessage / MessageEvent</td></tr>
    <tr><td>单文件与 CSP</td><td>Content Security Policy Level 3</td></tr>
    <tr><td>打印与分页</td><td>CSS Paged Media / <code>@page</code></td></tr>
  </tbody>
</table>
<div class="callout">本项目自己的实现说明在 <code>docs/design.md</code>：读那一份比读这四份更省时间。</div>`,
    notes: [
      "这页不讲，翻到说一句「出处都在这」就结束，把时间留给提问。",
      "被问到「能不能改字号/换字体」，答案在 theme.css，不用翻规范。",
    ],
    script: [
      "最后一页是延伸阅读，不展开。",
      "四个主题对应四个坑：缩放、窗口通信、单文件安全策略、打印分页。",
    ],
    sources: [],
  },
];
