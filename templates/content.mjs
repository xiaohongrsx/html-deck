/* ============================================================================
   content.mjs — 你的演示内容
   一页一个对象：id / heading / html / notes / seconds / sources / stage
   改完运行：html-deck build
   ========================================================================== */
export const meta = {
  title: "我的演示标题",
  subtitle: "一句话说清这份材料要回答什么问题",
  prepared: "2026-11-09",
};

// 顶部导轨的环节名，按顺序显示；stage 用下标引用
export const stages = ["开场", "方法", "结果", "下一步"];

export const slides = ({code, image}) => [
  {
    id: "cover",
    short: "封面",
    kind: "cover",
    stage: null,
    heading: "我的演示标题",
    seconds: 40,
    footer: "汇报人 · 2026",
    html: `
<div class="cover">
  <p class="kicker">课题组周会 · 2026 秋季</p>
  <h1>一句话说清这份<br><em>材料在讲什么</em></h1>
  <p class="cover-sub">副标题可以写研究问题、数据规模或结论的版本号。<br>两行以内，不要超过三行。</p>
  <div class="cover-stats">
    <div><b>12</b><span>页</span></div>
    <div><b>20</b><span>分钟</span></div>
    <div><b>3</b><span>个主要结论</span></div>
  </div>
</div>`,
    notes: [
      "开场不要念标题。用一句话说清：这次汇报要回答什么问题，为什么现在要回答它。",
      "讲者视图里的这一段只给你自己看，投影片上不会出现。",
    ],
    sources: ["数据来源：填写实验编号 / 论文标题"],
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
];
