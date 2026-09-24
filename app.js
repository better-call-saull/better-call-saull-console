/* ============================================================================
 * Better Call Saull 财税法工作台，应用逻辑
 * hash 路由 + 11 个视图渲染；交互含排序、筛选、AI 采纳、清单勾选、全局搜索。
 * 只读快照：所有写操作仅落 localStorage，不回写业务系统。
 * ============================================================================ */
(function () {
"use strict";

/* ------------------------------------------------------------ 基础工具 */
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function fmt(v, d) {
  if (v == null || isNaN(v)) return "—";
  var p = Math.pow(10, d == null ? 0 : d);
  return (Math.round(v * p) / p).toLocaleString("zh-CN", { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 0 : d });
}
function yuan(v, d) { return "¥" + fmt(v, d == null ? 0 : d); }
function pct(v, d) { return fmt(v * 100, d == null ? 1 : d) + "%"; }
function clsNum(v) { return v > 0 ? "pos" : (v < 0 ? "neg" : ""); }

/* ------------------------------------------------------------ 本地状态（localStorage） */
var LS = {
  aiDone: "bcs.aiDone.v1",      /* {ledgerId: true} 已采纳入账 */
  aiSkip: "bcs.aiSkip.v1",      /* {queueId: true} 已忽略 */
  ckl: "bcs.checklist.v1",      /* {domain|idx: true} */
  alertDone: "bcs.alertDone.v1" /* {alertId: status} */
};
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

var aiDone = lsGet(LS.aiDone), aiSkip = lsGet(LS.aiSkip), cklState = lsGet(LS.ckl), alertDone = lsGet(LS.alertDone);

/* ------------------------------------------------------------ 路由 */
var VIEWS = ["overview", "ledger", "cashflow", "arap", "budget", "taxcal", "taxburden", "contracts", "regulations", "alerts", "checklist"];
var NAMES = {
  overview: "工作台总览", ledger: "自动记账", cashflow: "现金流", arap: "应收应付", budget: "预算与成本",
  taxcal: "纳税日历", taxburden: "税负分析", contracts: "合同审查", regulations: "法规库",
  alerts: "风险预警", checklist: "合规清单"
};
var EN = {
  overview: "Executive Overview", ledger: "AI Bookkeeping", cashflow: "Cash Flow", arap: "AR / AP Aging", budget: "Budget vs Actual",
  taxcal: "Tax Calendar", taxburden: "Tax Burden", contracts: "Contract Review", regulations: "Regulation Library",
  alerts: "Risk Alerts", checklist: "Compliance Checklist"
};

function currentRoute() {
  var hh = (location.hash || "").replace(/^#\/?/, "").split("/")[0];
  return VIEWS.indexOf(hh) >= 0 ? hh : "overview";
}
function syncRoute(v) {
  $("#crumbNow").textContent = NAMES[v];
  document.title = NAMES[v] + "，Better Call Saull 财税法工作台";
  $$("#nav a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-v") === v); });
}

/* ------------------------------------------------------------ 视图头 */
function vhead(v, lead, chips) {
  return '<div class="view-head">' +
    '<h2>' + esc(NAMES[v]) + '<span class="en">' + esc(EN[v]) + '</span></h2>' +
    '<div class="vh-meta">' + (DB.meta.company.name + " · " + DB.meta.company.identity + " · " + DB.meta.company.period).split(" · ").map(function (m) { return '<span class="m">' + esc(m) + "</span>"; }).join("") + "</div>" +
    '<p class="lead">' + lead + "</p>" +
    (chips ? '<div class="vh-tags">' + chips.map(function (c) { return '<span class="tag plain">' + esc(c) + "</span>"; }).join(" ") + "</div>" : "") +
    "</div>";
}
function sec(no, t, en) {
  return '<h3 class="sec"><span class="no">' + no + '</span><span class="t">' + esc(t) + '</span><span class="en">' + esc(en) + "</span></h3>";
}
function srcNote(s) { return '<p class="src">' + esc(s) + "</p>"; }

/* ------------------------------------------------------------ 图表（SVG，无依赖） */
var NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

/* 分组柱状图：月度 收入/支出 */
function barChart(rows, w, h) {
  var pad = { l: 44, r: 8, t: 10, b: 22 };
  var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  var max = 0;
  rows.forEach(function (r) { max = Math.max(max, r.inflow, r.outflow); });
  max = Math.ceil(max / 100000) * 100000 || 1;
  var svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "xMidYMid meet" });
  for (var g = 0; g <= 4; g++) {
    var y = pad.t + ih - (ih * g / 4);
    svg.appendChild(svgEl("line", { x1: pad.l, y1: y, x2: w - pad.r, y2: y, "class": g === 0 ? "axis" : "gridline" }));
    var tx = svgEl("text", { x: pad.l - 6, y: y + 3, "text-anchor": "end" });
    tx.textContent = fmt(max * g / 4 / 10000, 0) + "万";
    svg.appendChild(tx);
  }
  var bw = iw / rows.length;
  rows.forEach(function (r, i) {
    var x0 = pad.l + i * bw;
    var bw2 = Math.min(13, bw * 0.26);
    var hIn = ih * r.inflow / max, hOut = ih * r.outflow / max;
    svg.appendChild(svgEl("rect", { x: x0 + bw / 2 - bw2 - 2, y: pad.t + ih - hIn, width: bw2, height: hIn, "class": "bar-in" }));
    svg.appendChild(svgEl("rect", { x: x0 + bw / 2 + 2, y: pad.t + ih - hOut, width: bw2, height: hOut, "class": "bar-out" }));
    var tx = svgEl("text", { x: x0 + bw / 2, y: h - 7, "text-anchor": "middle" });
    tx.textContent = r.label;
    svg.appendChild(tx);
  });
  return svg;
}

/* 折线图：期末现金余额 */
function lineChart(rows, w, h, key) {
  var pad = { l: 48, r: 10, t: 10, b: 22 };
  var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  var vals = rows.map(function (r) { return r[key]; });
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  var span = (max - min) || 1; min -= span * 0.08; max += span * 0.08; span = max - min;
  var svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "xMidYMid meet" });
  for (var g = 0; g <= 4; g++) {
    var y = pad.t + ih - (ih * g / 4);
    svg.appendChild(svgEl("line", { x1: pad.l, y1: y, x2: w - pad.r, y2: y, "class": g === 0 ? "axis" : "gridline" }));
    var tx = svgEl("text", { x: pad.l - 6, y: y + 3, "text-anchor": "end" });
    tx.textContent = fmt((min + span * g / 4) / 10000, 0) + "万";
    svg.appendChild(tx);
  }
  var step = iw / (rows.length - 1);
  var d = "";
  rows.forEach(function (r, i) {
    var x = pad.l + i * step, y = pad.t + ih - ih * (r[key] - min) / span;
    d += (i ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  });
  svg.appendChild(svgEl("path", { d: d, "class": "lline" }));
  rows.forEach(function (r, i) {
    var x = pad.l + i * step, y = pad.t + ih - ih * (r[key] - min) / span;
    svg.appendChild(svgEl("circle", { cx: x, cy: y, r: 3, "class": "ldot" + (i === rows.length - 1 ? " hot" : "") }));
    if (i % Math.ceil(rows.length / 8) === 0 || i === rows.length - 1) {
      var tx = svgEl("text", { x: x, y: h - 7, "text-anchor": "middle" });
      tx.textContent = r.label;
      svg.appendChild(tx);
    }
  });
  return svg;
}

/* ------------------------------------------------------------ 视图：总览 */
function vOverview(el) {
  var kpiHtml = DB.kpis.map(function (k) {
    return '<div class="kpi' + (k.dark ? " dark" : "") + '">' +
      '<div class="k">' + esc(k.k) + '</div>' +
      '<div class="v">' + esc(k.v) + "<small> " + esc(k.unit) + "</small></div>" +
      '<div class="w">' + esc(k.w) + "</div></div>";
  }).join("");

  /* 三大 AI 能力卡 */
  var openAlerts = DB.alerts.filter(function (a) { var st = alertDone[a.id] || a.status; return st !== "已忽略" && st !== "已闭环"; });
  var aiCards = [
    { t: "自动记账", en: "AI BOOKKEEPING", d: "银行流水 / 发票 / 邮件账单 → 凭证草稿，置信度 <0.80 强制人工确认。", n: DB.aiQueue.filter(function (q) { return !aiDone[q.ledgerId] && !aiSkip[q.id]; }).length + " 笔待确认", href: "#/ledger" },
    { t: "合同审查", en: "CONTRACT REVIEW", d: "条款抽取 + 风险规则库 42 条；无限责任、验收缺失、IP 归属等硬伤拦截。", n: DB.contracts.filter(function (c) { return c.stage === "审查中"; }).length + " 份在审", href: "#/contracts" },
    { t: "风险预警", en: "RISK ALERTS", d: "7 条规则每日评估：逾期红线、现金跑道、征期临近、进项票缺失等。", n: openAlerts.length + " 条未闭环", href: "#/alerts" }
  ].map(function (c) {
    return '<div class="card gold"><h4>' + esc(c.t) + ' <span class="tag gold">' + esc(c.en) + '</span></h4>' +
      "<p>" + esc(c.d) + "</p>" +
      '<p style="margin-top:8px"><a class="fchip" href="' + c.href + '">' + esc(c.n) + " →</a></p></div>";
  }).join("");

  /* 守底线速览：最近预警 + 征期 */
  var topAlerts = openAlerts.slice(0, 3).map(function (a) {
    var st = alertDone[a.id] || a.status;
    return '<tr><td><span class="tag ' + (a.sev === "高" ? "red" : a.sev === "中" ? "gold" : "plain") + '">' + a.sev + '</span></td>' +
      '<td><span class="tag plain">' + a.domain + "</span></td>" +
      "<td>" + esc(a.title) + "</td>" +
      '<td class="mono" style="white-space:nowrap">' + esc(st) + "</td></tr>";
  }).join("");
  var nextTax = DB.taxcal.filter(function (t) { return t.status !== "未开始"; }).slice(0, 3).map(function (t) {
    return '<tr><td class="mono">' + esc(t.due) + "</td><td>" + esc(t.item) + '</td><td class="mono">' + esc(t.tax) + "</td></tr>";
  }).join("");

  el.innerHTML =
    vhead("overview",
      "财税法工作台是 CEO Stack 的<b>守底线</b>组件：把「财 · 税 · 法」三条线的底线指标收敛到一屏，AI 负责记账、审合同、发预警，人只做确认与处置。",
      ["数据源：招行流水 + 发票池 + 合同台账", "法规库：better-call-saull-database（196 部）", "口径：权责发生制 · 小企业会计准则"]) +
    '<div class="kpi-strip">' + kpiHtml + "</div>" +
    srcNote(DB.kpis_src) +
    sec("01", "三大 AI 能力", "AI Capabilities") +
    '<div class="grid g3">' + aiCards + "</div>" +
    sec("02", "守底线速览", "Bottom-line Watch") +
    '<div class="grid g2">' +
      '<div class="card red"><h4>未闭环风险预警</h4>' + (topAlerts ? '<div class="table-scroll"><table class="dense"><thead><tr><th>级别</th><th>域</th><th>事项</th><th>状态</th></tr></thead><tbody>' + topAlerts + '</tbody></table></div>' : '<p class="note" style="padding:8px 0 2px">全部预警已闭环。</p>') +
      '<p style="margin-top:8px"><a class="fchip" href="#/alerts">进入风险预警 →</a></p></div>' +
      '<div class="card"><h4>临近征期</h4><div class="table-scroll"><table class="dense"><thead><tr><th>截止</th><th>事项</th><th>预估税额</th></tr></thead><tbody>' + nextTax + '</tbody></table></div>' +
      '<p style="margin-top:8px"><a class="fchip" href="#/taxcal">进入纳税日历 →</a></p></div>' +
    "</div>" +
    sec("03", "合规健康度", "Compliance Health") +
    renderChecklistSummary();
}

/* 合规健康度摘要（总览复用） */
function renderChecklistSummary() {
  var total = 0, done = 0;
  var rows = DB.checklist.map(function (g) {
    var t = g.items.length, d = 0;
    g.items.forEach(function (it, i) { if (cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done) d++; });
    total += t; done += d;
    var p = d / t;
    return '<tr><td>' + esc(g.domain) + '</td><td class="mono">' + d + " / " + t + '</td>' +
      '<td><div class="track"><i style="width:' + (p * 100).toFixed(0) + '%" class="' + (p === 1 ? "" : p >= 0.6 ? "warn" : "over") + '"></i></div></td>' +
      '<td class="mono">' + pct(p, 0) + "</td></tr>";
  }).join("");
  var all = done / total;
  return '<div class="card"><h4>五域合规清单完成度 <span class="tag ' + (all >= 0.8 ? "" : "gold") + '">' + done + " / " + total + "</span></h4>" +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>域</th><th>完成</th><th style="width:40%">进度</th><th>占比</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
    '<p style="margin-top:8px"><a class="fchip" href="#/checklist">进入合规清单逐项核对 →</a></p></div>';
}

/* ------------------------------------------------------------ 视图：自动记账 */
function vLedger(el) {
  /* AI 识别队列（深舱） */
  var queue = DB.aiQueue.filter(function (q) { return !aiDone[q.ledgerId] && !aiSkip[q.id]; });
  var aiRows = queue.length ? queue.map(function (q) {
    return '<div class="ai-row" data-q="' + q.id + '">' +
      '<div class="body"><div class="t">' + esc(q.srcType) + " · 置信度 " + fmt(q.conf * 100, 0) + '%</div>' +
      '<div class="d">原始：' + esc(q.src) + "</div>" +
      '<div class="d">建议：<b style="color:var(--deck-gold)">' + esc(q.suggest) + "</b></div></div>" +
      '<div class="acts"><button class="btn gold" data-ai-accept="' + q.id + '">采纳入账</button>' +
      '<button class="btn" data-ai-skip="' + q.id + '">忽略</button></div></div>';
  }).join("") : '<p class="note" style="color:var(--deck-ink-2);padding:6px 0">队列已清空。新流水 / 发票进入后由 AI 识别引擎生成凭证草稿。</p>';

  /* 台账表 */
  var rows = DB.ledger.slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); }).map(function (r) {
    var pending = r.ai && !aiDone[r.id];
    var amt = r.type === "收入" ? r.amount : -r.amount;
    return '<tr class="' + (pending ? "hl" : "") + '">' +
      '<td class="mono">' + esc(r.date) + "</td>" +
      '<td><span class="tag ' + (r.type === "收入" ? "" : "plain") + '">' + r.type + "</span></td>" +
      "<td>" + esc(r.cat) + "</td><td>" + esc(r.party) + "</td><td>" + esc(r.memo) + "</td>" +
      '<td class="mono ' + clsNum(amt) + '" style="text-align:right">' + (amt > 0 ? "+" : "") + fmt(amt, 2) + "</td>" +
      '<td class="mono">' + esc(r.rate) + "</td>" +
      '<td>' + (pending ? '<span class="tag gold">AI 待确认</span>' : '<span class="tag plain">已入账</span>') + "</td></tr>";
  }).join("");

  var inSum = 0, outSum = 0;
  DB.ledger.forEach(function (r) { if (r.type === "收入") inSum += r.amount; else outSum += r.amount; });

  el.innerHTML =
    vhead("ledger",
      "银行流水、发票、邮件账单由 AI 识别为凭证草稿；<b>置信度低于 0.80 一律人工确认</b>，采纳后写入台账并留痕。本月已入账 " + DB.ledger.filter(function (r) { return !r.ai || aiDone[r.id]; }).length + " 笔。",
      ["AI 识别引擎 v0.3", "强制人工确认阈值 0.80", "采纳仅落本地，不回写网银"]) +
    '<div class="sim">' +
      '<div class="sim-head"><span class="t">AI 识别队列</span><span class="en">AI INBOX · HUMAN-IN-THE-LOOP</span>' +
      '<button class="reset" id="aiReset">重置队列</button></div>' +
      '<div style="padding:6px 18px 14px">' + aiRows + "</div>" +
      '<div class="sim-note">采纳 = 写入台账（本地留痕）；忽略 = 本条不再提示。原始凭证以网银 / 发票池为准。</div>' +
    "</div>" +
    sec("01", "9 月记账台账", "Ledger · 2026-09") +
    '<div class="tools"><span class="count">收入 ' + yuan(inSum) + " · 支出 " + yuan(outSum) + " · 净额 " + yuan(inSum - outSum) + "</span></div>" +
    '<div class="table-scroll"><table class="dense"><thead><tr>' +
    "<th>日期</th><th>类型</th><th>科目</th><th>往来方</th><th>摘要</th><th style='text-align:right'>金额（含税）</th><th>税率</th><th>状态</th>" +
    "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
    srcNote(DB.ledger_src);
}

/* ------------------------------------------------------------ 视图：现金流 */
function vCashflow(el) {
  var m = DB.cashflow.months, w = DB.cashflow.weeks;
  var last = m[m.length - 1];
  var kpis =
    '<div class="kpi dark"><div class="k">期末现金</div><div class="v">' + fmt(last.end / 10000, 1) + '<small> 万元</small></div><div class="w">截至 09-24</div></div>' +
    '<div class="kpi"><div class="k">本月净流入</div><div class="v pos">+' + fmt((last.inflow - last.outflow) / 10000, 1) + '<small> 万元</small></div><div class="w">收入 ' + fmt(last.inflow / 10000, 1) + " − 支出 " + fmt(last.outflow / 10000, 1) + '</div></div>' +
    '<div class="kpi"><div class="k">现金跑道</div><div class="v">' + DB.cashflow.runway.months + '<small> 个月</small></div><div class="w">' + esc(DB.cashflow.runway.note) + '</div></div>' +
    '<div class="kpi"><div class="k">近 5 月平均净流</div><div class="v">' + fmt(m.slice(0, 5).reduce(function (s, r) { return s + r.inflow - r.outflow; }, 0) / 5 / 10000, 1) + '<small> 万元/月</small></div><div class="w">4—8 月口径</div></div>';

  el.innerHTML =
    vhead("cashflow",
      "现金流是底线指标的第一条：左图看月度收支结构，右图看 12 周期末余额趋势。<b>跑道低于 6 个月即触发预警</b>（当前 3.6 个月，见风险预警 A-03）。",
      ["期初 2026-04-01 余额 ¥620,000", "逐笔归集自招行基本户"]) +
    '<div class="kpi-strip">' + kpis + "</div>" +
    '<div class="grid g2">' +
      '<div class="chart-box"><h4>月度收支（近 6 个月）</h4><div id="chM"></div><div class="cap">藏蓝 = 流入 · 灰 = 流出 · 单位：万元</div></div>' +
      '<div class="chart-box"><h4>期末现金余额（近 12 周）</h4><div id="chW"></div><div class="cap">金点 = 最新一期 · 单位：万元</div></div>' +
    "</div>" +
    sec("01", "月度现金流表", "Monthly Statement") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>月份</th><th style="text-align:right">流入</th><th style="text-align:right">流出</th><th style="text-align:right">净额</th><th style="text-align:right">期末余额</th></tr></thead><tbody>' +
    m.map(function (r) {
      var net = r.inflow - r.outflow;
      return "<tr><td>" + esc(r.label) + (r.note ? ' <span class="tag plain" title="' + esc(r.note) + '">实收</span>' : "") + '</td><td class="mono" style="text-align:right">' + fmt(r.inflow) + '</td><td class="mono" style="text-align:right">' + fmt(r.outflow) + '</td><td class="mono ' + clsNum(net) + '" style="text-align:right">' + (net > 0 ? "+" : "") + fmt(net) + '</td><td class="mono" style="text-align:right">' + fmt(r.end) + "</td></tr>";
    }).join("") + "</tbody></table></div>" +
    srcNote(DB.cashflow_src);

  $("#chM", el).appendChild(barChart(m, 560, 240));
  $("#chW", el).appendChild(lineChart(w, 560, 240, "end"));
}

/* ------------------------------------------------------------ 视图：应收应付 */
function vArap(el) {
  var ar = DB.arap.receivables, ap = DB.arap.payables, aging = DB.arap.aging;
  var arTotal = ar.reduce(function (s, r) { return s + r.amount; }, 0);
  var apTotal = ap.reduce(function (s, r) { return s + r.amount; }, 0);
  var overdue = ar.filter(function (r) { return r.status.indexOf("逾期") === 0; });
  var overdueSum = overdue.reduce(function (s, r) { return s + r.amount; }, 0);

  function arRow(r) {
    var over = r.status.indexOf("逾期") === 0;
    var days = over ? parseInt(r.status.replace(/[^0-9]/g, ""), 10) : 0;
    var lvl = days > 90 ? "red" : days > 30 ? "gold" : "plain";
    return "<tr" + (days > 90 ? ' class="hl"' : "") + "><td class=\"mono\">" + esc(r.id) + "</td><td>" + esc(r.party) + "</td><td>" + esc(r.item) + "</td>" +
      '<td class="mono" style="text-align:right">' + fmt(r.amount) + '</td><td class="mono">' + esc(r.due) + "</td>" +
      '<td><span class="tag ' + lvl + '">' + esc(r.status) + "</span></td></tr>";
  }
  function apRow(r) {
    var soon = r.status === "临近";
    return "<tr><td class=\"mono\">" + esc(r.id) + "</td><td>" + esc(r.party) + "</td><td>" + esc(r.item) + "</td>" +
      '<td class="mono" style="text-align:right">' + fmt(r.amount) + '</td><td class="mono">' + esc(r.due) + "</td>" +
      '<td><span class="tag ' + (soon ? "gold" : "plain") + '">' + esc(r.status) + "</span></td></tr>";
  }

  el.innerHTML =
    vhead("arap",
      "应收看回款安全，应付看履约信用。<b>逾期超 90 天触发红线</b>（当前 1 笔 ¥26,500，见预警 A-02）；应付最近一笔 09-28 到期，需预留资金。",
      ["开票系统 + 合同台账 + 银行流水核销"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi"><div class="k">应收合计</div><div class="v">' + fmt(arTotal / 10000, 2) + '<small> 万元</small></div><div class="w">' + ar.length + " 笔</div></div>" +
      '<div class="kpi dark"><div class="k">其中逾期</div><div class="v">' + fmt(overdueSum / 10000, 2) + '<small> 万元</small></div><div class="w">' + overdue.length + " 笔 · 1 笔超 90 天红线</div></div>" +
      '<div class="kpi"><div class="k">应付合计</div><div class="v">' + fmt(apTotal / 10000, 2) + '<small> 万元</small></div><div class="w">' + ap.length + " 笔</div></div>" +
      '<div class="kpi"><div class="k">净头寸</div><div class="v pos">+' + fmt((arTotal - apTotal) / 10000, 2) + '<small> 万元</small></div><div class="w">应收 − 应付</div></div>' +
    "</div>" +
    sec("01", "应收账款", "Accounts Receivable") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>编号</th><th>往来方</th><th>事项</th><th style="text-align:right">金额</th><th>到期日</th><th>状态</th></tr></thead><tbody>' +
    ar.map(arRow).join("") + "</tbody></table></div>" +
    sec("02", "账龄分布", "Aging") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>账龄带</th><th style="text-align:right">金额</th><th>笔数</th><th style="width:42%">占比</th></tr></thead><tbody>' +
    aging.map(function (a) {
      var p = a.amount / arTotal;
      return "<tr><td>" + esc(a.band) + '</td><td class="mono" style="text-align:right">' + fmt(a.amount) + '</td><td class="mono">' + a.n + '</td>' +
        '<td><div class="track"><i style="width:' + (p * 100).toFixed(1) + '%" class="' + (a.band.indexOf("90") >= 0 ? "over" : a.band.indexOf("逾期") === 0 ? "warn" : "") + '"></i></div></td></tr>';
    }).join("") + "</tbody></table></div>" +
    sec("03", "应付账款", "Accounts Payable") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>编号</th><th>往来方</th><th>事项</th><th style="text-align:right">金额</th><th>到期日</th><th>状态</th></tr></thead><tbody>' +
    ap.map(apRow).join("") + "</tbody></table></div>" +
    srcNote(DB.arap_src);
}

/* ------------------------------------------------------------ 视图：预算与成本 */
function vBudget(el) {
  var tB = 0, tA = 0;
  var rows = DB.budget.map(function (b) {
    tB += b.budget; tA += b.actual;
    var p = b.actual / b.budget;
    var cls = p > 1 ? "over" : p >= 0.85 ? "warn" : "";
    var diff = b.actual - b.budget;
    return "<tr><td>" + esc(b.cat) + '</td><td class="mono" style="text-align:right">' + fmt(b.budget) + '</td>' +
      '<td class="mono" style="text-align:right">' + fmt(b.actual) + '</td>' +
      '<td><div class="track"><i style="width:' + Math.min(p * 100, 100).toFixed(1) + '%" class="' + cls + '"></i></div></td>' +
      '<td class="mono" style="text-align:right">' + pct(p, 0) + '</td>' +
      '<td class="mono ' + clsNum(diff) + '" style="text-align:right">' + (diff > 0 ? "+" : "") + fmt(diff) + "</td>" +
      "<td>" + esc(b.note) + "</td></tr>";
  }).join("");
  var tP = tA / tB;

  el.innerHTML =
    vhead("budget",
      "9 月月度预算执行 <b>" + pct(tP, 1) + "</b>（已超支）：专业服务（劳动仲裁案）、外包服务、业务招待三项超支，其余科目在预算内。超支科目已联动预警与 AI 记账提示。",
      ["预算为 2026 年度预算月度分摊", "实际数来自记账台账科目归集"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi"><div class="k">月度预算</div><div class="v">' + fmt(tB / 10000, 2) + '<small> 万元</small></div><div class="w">9 个成本科目</div></div>' +
      '<div class="kpi dark"><div class="k">实际支出</div><div class="v">' + fmt(tA / 10000, 2) + '<small> 万元</small></div><div class="w">截至 09-24</div></div>' +
      '<div class="kpi"><div class="k">执行率</div><div class="v">' + pct(tP, 1) + '</div><div class="w">超支 3 项 · 预警 1 项</div></div>' +
      '<div class="kpi"><div class="k">最大超支科目</div><div class="v" style="font-size:17px;line-height:1.5;padding-top:5px">专业服务</div><div class="w">超 60%（劳动仲裁案协作费）</div></div>' +
    "</div>" +
    sec("01", "分科目执行表", "Budget vs Actual by Category") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>科目</th><th style="text-align:right">预算</th><th style="text-align:right">实际</th><th style="width:26%">执行</th><th style="text-align:right">执行率</th><th style="text-align:right">差异</th><th>备注</th></tr></thead><tbody>' +
    rows + "</tbody></table></div>" +
    '<div class="callout" style="margin-top:14px"><div class="c-t">注意</div><b>业务招待费</b> 超预算 44%（¥2,160 / 预算 ¥1,500），且税前扣除受「发生额 60% 且不超过营收 5‰」双重限额约束，年底汇算清缴需纳税调增。</div>' +
    srcNote(DB.budget_src);
}

/* ------------------------------------------------------------ 视图：纳税日历 */
function vTaxcal(el) {
  var rows = DB.taxcal.map(function (t) {
    var lvl = t.status === "待申报" ? "gold" : t.status === "待办" ? "red" : "plain";
    return "<tr><td class=\"mono\">" + esc(t.due) + "</td><td>" + esc(t.item) + "</td>" +
      '<td class="mono">' + esc(t.period) + '</td><td class="mono" style="text-align:right">' + esc(t.tax) + "</td>" +
      '<td><span class="tag ' + lvl + '">' + esc(t.status) + "</span></td></tr>";
  }).join("");
  el.innerHTML =
    vhead("taxcal",
      "一般纳税人按月申报增值税及附加、按月扣缴个税、按季预缴企业所得税。<b>10-15 为三税连报日</b>，预估合计应纳 ¥34,657；征期以主管税务机关公告顺延为准。",
      ["电子税局征期日历口径", "税额为演示估算"]) +
    '<div class="callout red"><div class="c-t">临近征期</div><b>2026-10-15</b>：增值税及附加（预估 ¥13,597）＋ 个税扣缴（预估 ¥1,860）＋ 企业所得税 Q3 预缴（预估 ¥19,200）。距今 21 天，已触发预警 A-04。</div>' +
    sec("01", "征期与事项", "Filing Calendar") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>截止日</th><th>事项</th><th>所属期</th><th style="text-align:right">预估税额</th><th>状态</th></tr></thead><tbody>' +
    rows + "</tbody></table></div>" +
    srcNote(DB.taxcal_src);
}

/* ------------------------------------------------------------ 视图：税负分析 */
function vTaxburden(el) {
  var m = DB.taxburden.months, y = DB.taxburden.ytd;
  var rows = m.map(function (r) {
    var total = r.vat + r.sur + r.corp + r.stamp;
    var rate = total / r.revenue;
    return "<tr><td>" + esc(r.m) + '</td><td class="mono" style="text-align:right">' + fmt(r.revenue) + "</td>" +
      '<td class="mono" style="text-align:right">' + fmt(r.vat) + '</td><td class="mono" style="text-align:right">' + fmt(r.sur) + "</td>" +
      '<td class="mono" style="text-align:right">' + fmt(r.corp) + '</td><td class="mono" style="text-align:right">' + fmt(r.stamp) + "</td>" +
      '<td class="mono" style="text-align:right">' + fmt(total) + '</td><td class="mono" style="text-align:right">' + pct(rate, 2) + "</td></tr>";
  }).join("");

  el.innerHTML =
    vhead("taxburden",
      "年初至 9 月累计营收 <b>" + fmt(y.revenue / 10000, 1) + " 万元</b>，累计纳税 <b>" + fmt(y.total / 10000, 2) + " 万元</b>，实际税负率 <b>" + pct(y.rate, 2) + "</b>。附加税费按增值税 12% 计提；企业所得税享受小微优惠口径。",
      ["电子税局申报回执汇总", "附加 = 城建 7% + 教育 3% + 地方教育 2%"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi dark"><div class="k">实际税负率</div><div class="v">' + pct(y.rate, 2) + '</div><div class="w">累计纳税 / 累计营收</div></div>' +
      '<div class="kpi"><div class="k">累计营收</div><div class="v">' + fmt(y.revenue / 10000, 1) + '<small> 万元</small></div><div class="w">1—9 月</div></div>' +
      '<div class="kpi"><div class="k">累计纳税</div><div class="v">' + fmt(y.total / 10000, 2) + '<small> 万元</small></div><div class="w">四税合计</div></div>' +
      '<div class="kpi"><div class="k">9 月税负率</div><div class="v">' + pct((m[5].vat + m[5].sur + m[5].corp + m[5].stamp) / m[5].revenue, 2) + '</div><div class="w">增值税 12,140 + 附加 1,457 + 印花 242</div></div>' +
    "</div>" +
    sec("01", "月度税负表", "Monthly Tax Burden") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>月份</th><th style="text-align:right">营收</th><th style="text-align:right">增值税</th><th style="text-align:right">附加税费</th><th style="text-align:right">企业所得税</th><th style="text-align:right">印花税</th><th style="text-align:right">合计</th><th style="text-align:right">税负率</th></tr></thead><tbody>' +
    rows + "</tbody></table></div>" +
    srcNote(DB.taxburden_src);
}

/* ------------------------------------------------------------ 视图：合同审查 */
function vContracts(el) {
  var cards = DB.contracts.map(function (c) {
    var lvlCls = c.verdictLevel === "bad" ? "red" : c.verdictLevel === "warn" ? "gold" : "";
    var cardCls = c.verdictLevel === "bad" ? "red" : c.verdictLevel === "warn" ? "gold" : "";
    var clauseRows = c.clauses.map(function (cl) {
      var lc = cl.level === "高" ? "red" : cl.level === "中" ? "gold" : "plain";
      return "<tr><td class=\"mono\" style=\"white-space:nowrap\">" + esc(cl.clause) + "</td>" +
        '<td><span class="tag ' + lc + '">' + cl.level + "</span></td>" +
        "<td>" + esc(cl.finding) + "</td><td>" + esc(cl.fix) + "</td></tr>";
    }).join("");
    var clauseTbl = c.clauses.length ?
      '<div class="table-scroll" style="margin-top:10px"><table class="dense"><thead><tr><th>条款</th><th>风险</th><th>发现</th><th>修改建议</th></tr></thead><tbody>' + clauseRows + "</tbody></table></div>" :
      '<p class="note" style="margin-top:8px">无修改意见。</p>';
    return '<div class="card ' + cardCls + '">' +
      "<h4>" + esc(c.name) + ' <span class="tag ' + lvlCls + '">' + esc(c.verdict) + '</span> <span class="tag plain">' + esc(c.stage) + "</span></h4>" +
      '<p class="src" style="margin-bottom:6px">' + esc(c.id) + " · " + esc(c.party) + " · " + esc(c.amount) + " · " + esc(c.date) + "</p>" +
      "<p>" + esc(c.summary) + "</p>" + clauseTbl + "</div>";
  }).join("");

  el.innerHTML =
    vhead("contracts",
      "合同文本由 AI 审查引擎做条款抽取与风险规则匹配（规则库 42 条）。<b>结论「不通过」的合同禁止进入签署流程</b>；最终判断以执业律师意见为准。",
      ["合同审查引擎 v0.5", "风险规则库 42 条", "硬伤：无限责任 / 验收缺失 / IP 归属"]) +
    '<div class="grid g2">' + cards + "</div>" +
    srcNote(DB.contracts_src);
}

/* ------------------------------------------------------------ 视图：法规库 */
function vRegulations(el) {
  var cats = ["全部"].concat(DB.regs.map(function (r) { return r.cat; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
  el.innerHTML =
    vhead("regulations",
      "法规库节选自 <b>better-call-saull-database</b>（全库 196 部：法律法规 · 司法解释 · 地方性法规 · 港英美专题）。本表只列与在营业务直接相关的条目，每条标注适用状态。",
      ["全库 196 部", "节选 " + DB.regs.length + " 部", "点击行内路径可定位库内原文"]) +
    '<div class="tools"><div class="seg" id="regSeg">' +
      cats.map(function (c, i) { return '<button data-cat="' + esc(c) + '" class="' + (i === 0 ? "on" : "") + '">' + esc(c) + "</button>"; }).join("") +
      '</div><input class="finput" id="regQ" placeholder="搜索法规名称 / 发文机关"><span class="count" id="regCnt"></span></div>' +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>法规名称</th><th>类别</th><th>发文机关</th><th>施行日期</th><th>适用状态</th><th>库内路径</th></tr></thead><tbody id="regBody"></tbody></table></div>' +
    srcNote(DB.regs_src);

  var state = { cat: "全部", q: "" };
  function render() {
    var rows = DB.regs.filter(function (r) {
      if (state.cat !== "全部" && r.cat !== state.cat) return false;
      if (state.q && (r.n + r.issuer).toLowerCase().indexOf(state.q.toLowerCase()) < 0) return false;
      return true;
    });
    $("#regBody", el).innerHTML = rows.map(function (r) {
      return "<tr><td><b>" + esc(r.n) + "</b></td><td>" + esc(r.cat) + "</td><td>" + esc(r.issuer) + '</td><td class="mono">' + esc(r.eff) + "</td>" +
        '<td><span class="tag ' + (r.tag.indexOf("豁免") >= 0 ? "plain" : r.tag.indexOf("关注") >= 0 ? "gold" : "") + '">' + esc(r.tag) + "</span></td>" +
        '<td class="mono" style="font-size:10px;color:var(--ink-3)">' + esc(r.src) + "</td></tr>";
    }).join("") || '<tr><td colspan="6" style="text-align:center;color:var(--ink-3);padding:18px">无匹配条目</td></tr>';
    $("#regCnt", el).textContent = rows.length + " / " + DB.regs.length + " 部";
  }
  $("#regSeg", el).addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.cat = b.getAttribute("data-cat");
    $$("#regSeg button", el).forEach(function (x) { x.classList.toggle("on", x === b); });
    render();
  });
  $("#regQ", el).addEventListener("input", function (e) { state.q = e.target.value; render(); });
  render();
}

/* ------------------------------------------------------------ 视图：风险预警 */
function vAlerts(el) {
  /* 规则引擎深舱 */
  var ruleRows = DB.riskRules.map(function (r) {
    var lc = r.level === "高" ? "red" : r.level === "中" ? "gold" : "plain";
    return "<tr><td class=\"mono\">" + esc(r.id) + "</td><td>" + esc(r.name) + "</td>" +
      '<td style="color:var(--deck-ink-2)">' + esc(r.rule) + "</td>" +
      '<td style="color:var(--deck-gold)">' + esc(r.hit) + '</td><td><span class="tag ' + lc + '">' + r.level + "</span></td></tr>";
  }).join("");

  var order = { "高": 0, "中": 1, "低": 2 };
  var rows = DB.alerts.slice().sort(function (a, b) { return order[a.sev] - order[b.sev]; }).map(function (a) {
    var st = alertDone[a.id] || a.status;
    var lc = a.sev === "高" ? "red" : a.sev === "中" ? "gold" : "plain";
    var ignored = st === "已忽略" || st === "已闭环";
    return '<tr class="' + (a.sev === "高" && !ignored ? "hl" : "") + '">' +
      '<td><span class="tag ' + lc + '">' + a.sev + '</span></td>' +
      '<td><span class="tag plain">' + a.domain + "</span></td>" +
      "<td><b>" + esc(a.title) + '</b><div class="note" style="margin-top:3px">' + esc(a.detail) + "</div></td>" +
      '<td class="mono">' + esc(a.rule) + '</td>' +
      '<td style="white-space:nowrap"><span class="tag ' + (ignored ? "plain" : "gold") + '">' + esc(st) + "</span>" +
      (ignored ? "" : ' <button class="btn" data-alert-close="' + a.id + '" style="margin-left:6px">闭环</button>') +
      "</td></tr>";
  }).join("");

  el.innerHTML =
    vhead("alerts",
      "风险规则引擎每日评估 7 条规则，命中即生成预警。<b>高级别预警未闭环前，对应业务动作（签署 / 付款）应当暂停</b>。处置动作人工执行并留痕。",
      ["规则引擎 v0.3 · 每日评估", "闭环状态本地留痕"]) +
    '<div class="sim">' +
      '<div class="sim-head"><span class="t">风险规则引擎</span><span class="en">RULE ENGINE · DAILY EVAL</span></div>' +
      '<div style="padding:4px 18px 12px"><table class="dense"><thead><tr><th>规则</th><th>名称</th><th>触发条件</th><th>当前命中</th><th>级别</th></tr></thead><tbody>' + ruleRows + "</tbody></table></div>" +
      '<div class="sim-note">深色 = 机器在算。规则命中即生成下方预警单；规则库版本与阈值见 data.js。</div>' +
    "</div>" +
    sec("01", "预警单", "Alert Tickets") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>级别</th><th>域</th><th>事项与建议</th><th>规则</th><th>状态</th></tr></thead><tbody>' +
    rows + "</tbody></table></div>" +
    srcNote(DB.alerts_src);
}

/* ------------------------------------------------------------ 视图：合规清单 */
function vChecklist(el) {
  var total = 0, done = 0;
  var groups = DB.checklist.map(function (g, gi) {
    var items = g.items.map(function (it, i) {
      var key = g.domain + "|" + i;
      var checked = cklState[key] != null ? cklState[key] : it.done;
      total++; if (checked) done++;
      return '<li class="' + (checked ? "done" : "") + '">' +
        '<input type="checkbox" id="ck-' + gi + "-" + i + '" data-ck="' + esc(key) + '"' + (checked ? " checked" : "") + ">" +
        '<label for="ck-' + gi + "-" + i + '">' + esc(it.q) + '<span class="ref">' + esc(it.ref) + "</span></label></li>";
    }).join("");
    var d = g.items.filter(function (it, i) { return cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done; }).length;
    return '<div class="card"><h4>' + esc(g.domain) + ' <span class="tag ' + (d === g.items.length ? "" : "gold") + '">' + d + " / " + g.items.length + "</span></h4>" +
      '<ul class="ckl">' + items + "</ul></div>";
  }).join("");

  el.innerHTML =
    vhead("checklist",
      "五域合规自查：工商主体 · 税务 · 劳动用工 · 数据合规 · 知识产权。每项标注法规依据（ref 指向法规库条目或条款）。<b>勾选状态本地留痕</b>，完成度回写总览健康度。",
      ["合规自查框架 v0.4", "勾选仅落本地，不回写业务系统"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi dark"><div class="k">总完成度</div><div class="v" id="cklKpi">' + done + " / " + total + '</div><div class="w">五域合计</div></div>' +
      '<div class="kpi"><div class="k">待办最高优先</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">数据分类分级</div><div class="w">网络数据安全管理条例</div></div>' +
      '<div class="kpi"><div class="k">等保备案</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">未定级</div><div class="w">网络安全法 §21</div></div>' +
      '<div class="kpi"><div class="k">社保基数调整</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">待确认</div><div class="w">联动预警 A-07</div></div>' +
    "</div>" +
    '<div class="grid g2">' + groups + "</div>" +
    srcNote(DB.checklist_src);
}

/* ------------------------------------------------------------ 全局搜索 */
function buildIndex() {
  var idx = [];
  DB.contracts.forEach(function (c) { idx.push({ t: "合同", n: c.name + " · " + c.party, href: "#/contracts" }); });
  DB.regs.forEach(function (r) { idx.push({ t: "法规", n: r.n + " · " + r.issuer, href: "#/regulations" }); });
  DB.ledger.forEach(function (r) { idx.push({ t: "台账", n: r.party + " · " + r.memo + " · " + yuan(r.amount), href: "#/ledger" }); });
  DB.alerts.forEach(function (a) { idx.push({ t: "预警", n: a.title, href: "#/alerts" }); });
  DB.taxcal.forEach(function (t) { idx.push({ t: "税种", n: t.item + " · " + t.due, href: "#/taxcal" }); });
  return idx;
}
var SEARCH_IDX = buildIndex();
function bindSearch() {
  var inp = $("#gSearch"), pop = $("#srPop");
  if (!inp) return;
  inp.addEventListener("input", function () {
    var q = inp.value.trim().toLowerCase();
    if (!q) { pop.style.display = "none"; pop.innerHTML = ""; return; }
    var hits = SEARCH_IDX.filter(function (x) { return x.n.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
    pop.innerHTML = hits.length ? hits.map(function (h) {
      return '<a class="sr-item" href="' + h.href + '"><span class="tag plain">' + h.t + "</span> " + esc(h.n) + "</a>";
    }).join("") : '<div class="sr-item" style="color:var(--ink-3)">无匹配</div>';
    pop.style.display = "block";
  });
  inp.addEventListener("blur", function () { setTimeout(function () { pop.style.display = "none"; }, 160); });
  pop.addEventListener("click", function () { inp.value = ""; pop.style.display = "none"; });
}

/* ------------------------------------------------------------ 渲染与事件 */
var RENDER = {
  overview: vOverview, ledger: vLedger, cashflow: vCashflow, arap: vArap, budget: vBudget,
  taxcal: vTaxcal, taxburden: vTaxburden, contracts: vContracts, regulations: vRegulations,
  alerts: vAlerts, checklist: vChecklist
};
function render() {
  var v = currentRoute();
  syncRoute(v);
  VIEWS.forEach(function (x) { $("#v-" + x).style.display = x === v ? "" : "none"; });
  RENDER[v]($("#v-" + v));
  window.scrollTo(0, 0);
}

/* 事件委托：AI 采纳 / 忽略 / 重置，预警闭环，清单勾选 */
document.addEventListener("click", function (e) {
  var t = e.target;
  var acc = t.getAttribute && t.getAttribute("data-ai-accept");
  var skp = t.getAttribute && t.getAttribute("data-ai-skip");
  var cls = t.getAttribute && t.getAttribute("data-alert-close");
  if (acc) {
    var q = DB.aiQueue.filter(function (x) { return x.id === acc; })[0];
    if (q) { aiDone[q.ledgerId] = true; lsSet(LS.aiDone, aiDone); render(); }
  } else if (skp) {
    aiSkip[skp] = true; lsSet(LS.aiSkip, aiSkip); render();
  } else if (t.id === "aiReset") {
    aiDone = {}; aiSkip = {}; lsSet(LS.aiDone, aiDone); lsSet(LS.aiSkip, aiSkip); render();
  } else if (cls) {
    alertDone[cls] = "已闭环"; lsSet(LS.alertDone, alertDone); render();
  }
});
document.addEventListener("change", function (e) {
  var k = e.target.getAttribute && e.target.getAttribute("data-ck");
  if (k) { cklState[k] = e.target.checked; lsSet(LS.ckl, cklState); render(); }
});

/* ------------------------------------------------------------ 时钟与页脚 */
function tick() {
  var d = new Date();
  var p = function (n) { return (n < 10 ? "0" : "") + n; };
  var el = $("#tbClock");
  if (el) el.textContent = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}
$("#sbAsOf").textContent = "快照 " + DB.meta.asOf;
$("#footAsOf").textContent = DB.meta.asOf;
var regCnt = $("#navRegCnt"); if (regCnt) regCnt.textContent = "196";

window.addEventListener("hashchange", render);
bindSearch();
tick(); setInterval(tick, 1000);
render();
})();
