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
  alertDone: "bcs.alertDone.v1",/* {alertId: status} */
  ledgerLocal: "bcs.ledgerLocal.v1" /* [row] 流水粘贴采纳后本地入账的凭证 */
};
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } }
function lsGetArr(k) { try { var v = JSON.parse(localStorage.getItem(k) || "[]"); return Object.prototype.toString.call(v) === "[object Array]" ? v : []; } catch (e) { return []; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

var aiDone = lsGet(LS.aiDone), aiSkip = lsGet(LS.aiSkip), cklState = lsGet(LS.ckl), alertDone = lsGet(LS.alertDone);
var ledgerLocal = lsGetArr(LS.ledgerLocal);   /* 本地入账凭证（不回写业务系统） */
var baseLedger = DB.ledger.slice();           /* 静态快照，重置时回退到它 */
DB.ledger = baseLedger.concat(ledgerLocal);
var drafts = [];                              /* 流水粘贴识别出的草稿，仅本次会话 */

/* ------------------------------------------------------------ 路由 */
var VIEWS = ["overview", "finance", "legal", "datacenter", "contractrisk", "settings", "ledger", "cashflow", "arap", "budget", "taxcal", "taxburden", "contracts", "regulations", "alerts", "checklist",
  "mixing", "shareholder", "annual", "invoices", "lifecycle", "social", "incentives", "resolutions", "exit"];
var NAMES = {
  overview: "工作台总览", finance: "财税管理", legal: "法务管理",
  datacenter: "数据中心", contractrisk: "合同与商务风险", settings: "设置与合规",
  ledger: "自动记账", cashflow: "现金流", arap: "应收应付", budget: "预算与成本",
  taxcal: "纳税日历", taxburden: "税负分析", contracts: "合同审查", regulations: "法规库",
  alerts: "风险预警", checklist: "合规清单",
  mixing: "公私混同防护", shareholder: "股东往来", annual: "年度合规节点",
  invoices: "发票管理", lifecycle: "合同台账", social: "社保健全",
  incentives: "优惠雷达", resolutions: "股东决定", exit: "注销预案"
};
var EN = {
  overview: "Executive Overview", finance: "Finance Hub", legal: "Legal Hub",
  datacenter: "Data Center", contractrisk: "Contract & Business Risk", settings: "Settings & Compliance",
  ledger: "AI Bookkeeping", cashflow: "Cash Flow", arap: "AR / AP Aging", budget: "Budget vs Actual",
  taxcal: "Tax Calendar", taxburden: "Tax Burden", contracts: "Contract Review", regulations: "Regulation Library",
  alerts: "Risk Alerts", checklist: "Compliance Checklist",
  mixing: "Commingling Guard", shareholder: "Shareholder Account", annual: "Annual Compliance",
  invoices: "Invoice Lifecycle", lifecycle: "Contract Lifecycle", social: "Social Security Audit",
  incentives: "Incentive Radar", resolutions: "Shareholder Resolutions", exit: "Exit Readiness"
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

/* ------------------------------------------------------------ 视图：总览（新版 6 区块布局） */
function vOverview(el) {
  var openAlerts = DB.alerts.filter(function (a) { var st = alertDone[a.id] || a.status; return st !== "已忽略" && st !== "已闭环"; });

  /* ---- ① 核心指标卡片（4 格 2×2） ---- */
  var inSum = 0, outSum = 0;
  DB.ledger.forEach(function (r) { if (r.type === "收入") inSum += r.amount; else outSum += r.amount; });
  var overdue = DB.arap.receivables.filter(function (r) { return r.status.indexOf("逾期") === 0; });
  var overdueAmt = overdue.reduce(function (s, r) { return s + r.amount; }, 0);
  var metrics = [
    { label: "现金余额", value: DB.kpis[0].v, unit: "万元", sub: "招行基本户 09-24", trend: "+12.3%", trendUp: true, href: "#/cashflow" },
    { label: "本月净利", value: fmt((inSum - outSum) / 10000, 2), unit: "万元", sub: "收 " + fmt(inSum / 10000, 2) + " − 支 " + fmt(outSum / 10000, 2), trend: "-8.2%", trendUp: false, href: "#/ledger" },
    { label: "应收预警", value: fmt(overdueAmt / 10000, 2), unit: "万元", sub: DB.arap.receivables.length + " 笔，" + overdue.length + " 笔逾期", trend: overdue.length + " 笔超 90 天", trendUp: false, href: "#/arap", danger: overdue.length > 0 },
    { label: "税负健康", value: "3.53", unit: "%", sub: "年初至 9 月累计", trend: "行业均值 3.2%", trendUp: true, href: "#/taxburden" }
  ];
  var metricCards = metrics.map(function (m) {
    return '<a class="ov-metric' + (m.danger ? ' danger' : '') + '" href="' + m.href + '">' +
      '<div class="ov-metric-label">' + esc(m.label) + '</div>' +
      '<div class="ov-metric-value">' + esc(m.value) + '<small> ' + esc(m.unit) + '</small></div>' +
      '<div class="ov-metric-sub">' + esc(m.sub) + '</div>' +
      '<div class="ov-metric-trend ' + (m.trendUp ? 'up' : 'down') + '">' + esc(m.trend) + '</div>' +
    '</a>';
  }).join("");

  /* ---- ② 待办事项中心 ---- */
  /* 紧急待办：税务申报 + 合同到期 + 应收逾期 */
  var urgentTodos = [];
  DB.taxcal.filter(function (t) { return t.status === "待申报" || t.status === "待办"; }).slice(0, 2).forEach(function (t) {
    urgentTodos.push({ icon: "📅", text: t.due + " " + t.item, href: "#/taxcal", urgent: true });
  });
  if (overdue.length > 0) {
    urgentTodos.push({ icon: "⚠️", text: "应收逾期 90 天 - " + overdue[0].party + " " + yuan(overdue[0].amount), href: "#/arap", urgent: true });
  }
  /* 本周待办：合同 + 发票 + 决定 */
  var weekTodos = [];
  var urgentContracts = DB.contractLifecycle.filter(function (c) { return c.status === "临期"; });
  urgentContracts.slice(0, 1).forEach(function (c) {
    weekTodos.push({ icon: "📄", text: c.end + " " + c.name + " 续签", href: "#/lifecycle" });
  });
  DB.invoices.toIssue.slice(0, 1).forEach(function (i) {
    weekTodos.push({ icon: "🧾", text: i.due + " 发票开具 " + i.party + " " + yuan(i.amount), href: "#/invoices" });
  });
  DB.resolutions.filter(function (r) { return r.status === "待签署"; }).slice(0, 1).forEach(function (r) {
    weekTodos.push({ icon: "📝", text: "签署股东决定 - " + r.item, href: "#/resolutions" });
  });
  DB.checklist.forEach(function (g) {
    g.items.forEach(function (it, i) {
      var checked = cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done;
      if (!checked && weekTodos.length < 5) {
        weekTodos.push({ icon: "✅", text: it.q.split("（")[0], href: "#/checklist" });
      }
    });
  });
  /* 已逾期 */
  var overdueTodos = [];
  DB.invoices.toCollect.filter(function (i) { return i.status === "换开中"; }).forEach(function (i) {
    overdueTodos.push({ icon: "⚫", text: i.party + " 发票换开（逾期）", href: "#/invoices" });
  });

  var todoHtml = '<div class="ov-todo-section">' +
    '<div class="ov-todo-header"><span class="ov-todo-count urgent">' + urgentTodos.length + '</span> 紧急待办</div>' +
    urgentTodos.map(function (t) { return '<a class="ov-todo-item urgent" href="' + t.href + '">' + t.icon + ' ' + esc(t.text) + '</a>'; }).join("") +
    '</div>' +
    '<div class="ov-todo-section">' +
    '<div class="ov-todo-header"><span class="ov-todo-count week">' + weekTodos.length + '</span> 本周待办</div>' +
    weekTodos.map(function (t) { return '<a class="ov-todo-item" href="' + t.href + '">' + t.icon + ' ' + esc(t.text) + '</a>'; }).join("") +
    '</div>' +
    (overdueTodos.length ? '<div class="ov-todo-section">' +
    '<div class="ov-todo-header"><span class="ov-todo-count overdue">' + overdueTodos.length + '</span> 已逾期</div>' +
    overdueTodos.map(function (t) { return '<a class="ov-todo-item overdue" href="' + t.href + '">' + t.icon + ' ' + esc(t.text) + '</a>'; }).join("") +
    '</div>' : '');

  /* 快捷操作 */
  var quickActions = [
    { text: "一键申报", href: "#/taxcal" },
    { text: "查看合同", href: "#/lifecycle" },
    { text: "生成催款函", href: "#/arap" },
    { text: "审查合同", href: "#/contracts" },
    { text: "导出报告", href: "#/overview", onclick: "window.print()" }
  ];
  var quickHtml = quickActions.map(function (a) {
    return '<a class="btn" href="' + a.href + '"' + (a.onclick ? ' onclick="' + a.onclick + '"' : '') + '>' + esc(a.text) + '</a>';
  }).join("");

  /* 完成度 */
  var totalItems = 0, doneItems = 0;
  DB.checklist.forEach(function (g) {
    g.items.forEach(function (it, i) {
      totalItems++;
      var checked = cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done;
      if (checked) doneItems++;
    });
  });
  var completionPct = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0;

  /* ---- ③ 风险雷达 + OPC 生存仪表盘 ---- */
  /* 风险评分计算 */
  var finRisk = 0, taxRisk = 0, legalRisk = 0;
  openAlerts.forEach(function (a) {
    var score = a.sev === "高" ? 15 : a.sev === "中" ? 8 : 3;
    if (a.domain === "财") finRisk += score;
    else if (a.domain === "税") taxRisk += score;
    else legalRisk += score;
  });
  finRisk = Math.min(finRisk, 100);
  taxRisk = Math.min(taxRisk, 100);
  legalRisk = Math.min(legalRisk, 100);

  var riskColor = function (v) { return v > 60 ? "red" : v > 30 ? "gold" : "green"; };
  var riskLevel = function (v) { return v > 60 ? "高风险" : v > 30 ? "中风险" : "低风险"; };

  /* OPC 核心指标 */
  var nearestAnnual = DB.annual.reduce(function (a, b) { return a.deadline < b.deadline ? a : b; });

  /* ---- ④ 经营健康度迷你图表（SVG） ---- */
  var cashflowWeeks = DB.cashflow.weeks.slice(-6);
  var cfSvg = '<svg viewBox="0 0 200 60" class="ov-mini-chart">' +
    '<path d="' + cashflowWeeks.map(function (w, i) {
      var x = 10 + i * 36;
      var vals = cashflowWeeks.map(function (ww) { return ww.end; });
      var min = Math.min.apply(null, vals) * 0.95;
      var max = Math.max.apply(null, vals) * 1.05;
      var y = 55 - (w.end - min) / (max - min) * 45;
      return (i === 0 ? "M" : "L") + x + " " + y;
    }).join(" ") + '" fill="none" stroke="var(--navy)" stroke-width="2"/>' +
    cashflowWeeks.map(function (w, i) {
      var x = 10 + i * 36;
      var vals = cashflowWeeks.map(function (ww) { return ww.end; });
      var min = Math.min.apply(null, vals) * 0.95;
      var max = Math.max.apply(null, vals) * 1.05;
      var y = 55 - (w.end - min) / (max - min) * 45;
      return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + (i === cashflowWeeks.length - 1 ? "var(--gold)" : "var(--navy)") + '"/>';
    }).join("") +
    '</svg>';

  /* 收入构成饼图（简化版） */
  var incomeByCat = {};
  DB.ledger.filter(function (r) { return r.type === "收入"; }).forEach(function (r) {
    incomeByCat[r.cat] = (incomeByCat[r.cat] || 0) + r.amount;
  });
  var incomeCats = Object.keys(incomeByCat).sort(function (a, b) { return incomeByCat[b] - incomeByCat[a]; });
  var totalIncome = incomeCats.reduce(function (s, c) { return s + incomeByCat[c]; }, 0);
  var pieSvg = '<svg viewBox="0 0 60 60" class="ov-mini-pie">';
  var pieAngle = 0;
  var pieColors = ["var(--navy)", "var(--gold)", "var(--ink-3)", "var(--navy-mist)"];
  incomeCats.slice(0, 4).forEach(function (cat, i) {
    var pct = incomeByCat[cat] / totalIncome;
    var startAngle = pieAngle;
    var endAngle = pieAngle + pct * Math.PI * 2;
    var largeArc = pct > 0.5 ? 1 : 0;
    var x1 = 30 + 25 * Math.cos(startAngle);
    var y1 = 30 + 25 * Math.sin(startAngle);
    var x2 = 30 + 25 * Math.cos(endAngle);
    var y2 = 30 + 25 * Math.sin(endAngle);
    pieSvg += '<path d="M30,30 L' + x1 + ',' + y1 + ' A25,25 0 ' + largeArc + ',1 ' + x2 + ',' + y2 + ' Z" fill="' + pieColors[i % pieColors.length] + '"/>';
    pieAngle = endAngle;
  });
  pieSvg += '</svg>';

  /* 预算执行进度条 */
  var budgetTotal = 0, budgetActual = 0;
  DB.budget.forEach(function (b) { budgetTotal += b.budget; budgetActual += b.actual; });
  var budgetPct = budgetTotal > 0 ? Math.round(budgetActual / budgetTotal * 100) : 0;
  var budgetCls = budgetPct > 100 ? "over" : budgetPct > 85 ? "warn" : "";

  /* ---- ⑤ OPC 生存仪表盘 ---- */
  var mixingScore = DB.mixing.score;
  var mixingCls = mixingScore < 60 ? "red" : mixingScore < 80 ? "gold" : "green";

  /* ---- ⑥ AI 助手入口 ---- */
  var aiQueueCount = DB.aiQueue.filter(function (q) { return !aiDone[q.ledgerId] && !aiSkip[q.id]; }).length;

  el.innerHTML =
    vhead("overview",
      "CEO Stack 守底线组件：「财 · 税 · 法」底线指标收敛到一屏，AI 负责记账、审合同、发预警，人只做确认与处置。",
      ["数据源：招行流水 + 发票池 + 合同台账", "口径：权责发生制 · 小企业会计准则"]) +

    /* ① 核心指标卡片 */
    sec("01", "核心指标", "Key Metrics") +
    '<div class="ov-metrics-grid">' + metricCards + '</div>' +
    srcNote(DB.kpis_src) +

    /* ② 待办事项中心 */
    sec("02", "待办事项中心", "Action Center") +
    '<div class="ov-todo-layout">' +
      '<div class="ov-todo-list">' + todoHtml + '</div>' +
      '<div class="ov-todo-actions">' +
        '<div class="ov-quick-actions">' + quickHtml + '</div>' +
        '<div class="ov-completion">' +
          '<div class="ov-completion-label">本周完成度</div>' +
          '<div class="track"><i style="width:' + completionPct + '%" class="' + (completionPct >= 80 ? "" : "warn") + '"></i></div>' +
          '<div class="ov-completion-text">已完成 ' + doneItems + ' / ' + totalItems + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* ③ 风险雷达 + OPC 生存仪表盘 */
    sec("03", "风险雷达 & OPC 生存仪表盘", "Risk Radar & OPC Dashboard") +
    '<div class="ov-risk-opc-layout">' +
      /* 风险雷达 */
      '<div class="ov-risk-radar">' +
        '<h4>风险雷达</h4>' +
        '<div class="ov-risk-rings">' +
          '<div class="ov-risk-ring ' + riskColor(finRisk) + '">' +
            '<div class="ov-risk-value">' + finRisk + '</div>' +
            '<div class="ov-risk-label">财务风险</div>' +
          '</div>' +
          '<div class="ov-risk-ring ' + riskColor(taxRisk) + '">' +
            '<div class="ov-risk-value">' + taxRisk + '</div>' +
            '<div class="ov-risk-label">税务风险</div>' +
          '</div>' +
          '<div class="ov-risk-ring ' + riskColor(legalRisk) + '">' +
            '<div class="ov-risk-value">' + legalRisk + '</div>' +
            '<div class="ov-risk-label">法务风险</div>' +
          '</div>' +
        '</div>' +
        '<div class="ov-risk-alerts">' +
          openAlerts.slice(0, 3).map(function (a) {
            var st = alertDone[a.id] || a.status;
            return '<a class="ov-risk-alert-item" href="#/alerts">' +
              '<span class="tag ' + (a.sev === "高" ? "red" : a.sev === "中" ? "gold" : "plain") + '">' + a.sev + '</span> ' +
              '<span class="ov-risk-alert-text">' + esc(a.title) + '</span>' +
            '</a>';
          }).join("") +
        '</div>' +
        '<a class="fchip" href="#/alerts">查看全部预警 →</a>' +
      '</div>' +

      /* OPC 生存仪表盘 */
      '<div class="ov-opc-dashboard">' +
        '<h4>OPC 生存仪表盘</h4>' +
        '<div class="ov-opc-item">' +
          '<div class="ov-opc-label">隔离健康度</div>' +
          '<div class="ov-opc-score ' + mixingCls + '">' + mixingScore + '/100</div>' +
          '<div class="track"><i style="width:' + mixingScore + '%" class="' + mixingCls + '"></i></div>' +
          '<div class="ov-opc-sub">' + DB.mixing.level + ' · <a href="#/mixing">查看详情</a></div>' +
        '</div>' +
        '<div class="ov-opc-item">' +
          '<div class="ov-opc-label">股东借款</div>' +
          '<div class="ov-opc-value">' + yuan(DB.shareholder.loanBalance) + '</div>' +
          '<div class="ov-opc-countdown">倒计时 <strong>' + DB.shareholder.yearEndDays + '</strong> 天</div>' +
          '<div class="ov-opc-sub">若视同分红补税 ' + yuan(DB.shareholder.loanBalance * 0.2) + ' · <a href="#/shareholder">查看路径</a></div>' +
        '</div>' +
        '<div class="ov-opc-item">' +
          '<div class="ov-opc-label">年度合规</div>' +
          '<div class="ov-opc-next">最近节点：' + esc(nearestAnnual.item) + '</div>' +
          '<div class="ov-opc-deadline">' + nearestAnnual.deadline + '</div>' +
          '<div class="ov-opc-sub">强制审计未开始（公司法 §62） · <a href="#/annual">查看节点</a></div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* ④ 经营健康度 */
    sec("04", "经营健康度", "Business Health") +
    '<div class="ov-health-grid">' +
      '<div class="ov-health-card">' +
        '<h4>现金流趋势</h4>' +
        '<div class="ov-health-chart">' + cfSvg + '</div>' +
        '<div class="ov-health-value">期末 ' + fmt(DB.cashflow.months[DB.cashflow.months.length - 1].end / 10000, 1) + ' 万</div>' +
        '<a class="fchip" href="#/cashflow">查看详情 →</a>' +
      '</div>' +
      '<div class="ov-health-card">' +
        '<h4>收入构成</h4>' +
        '<div class="ov-health-chart">' + pieSvg + '</div>' +
        '<div class="ov-health-legend">' +
          incomeCats.slice(0, 4).map(function (c, i) {
            return '<span class="ov-legend-item"><span class="ov-legend-dot" style="background:' + pieColors[i % pieColors.length] + '"></span>' + esc(c) + ' ' + pct(incomeByCat[c] / totalIncome, 0) + '</span>';
          }).join("") +
        '</div>' +
        '<a class="fchip" href="#/ledger">查看详情 →</a>' +
      '</div>' +
      '<div class="ov-health-card">' +
        '<h4>预算执行</h4>' +
        '<div class="ov-health-budget">' +
          '<div class="ov-budget-bar"><div class="track"><i style="width:' + Math.min(budgetPct, 100) + '%" class="' + budgetCls + '"></i></div></div>' +
          '<div class="ov-budget-text">' + pct(budgetPct / 100, 1) + (budgetPct > 100 ? ' 已超支' : '') + '</div>' +
        '</div>' +
        '<div class="ov-health-value">预算 ' + yuan(budgetTotal) + ' / 实际 ' + yuan(budgetActual) + '</div>' +
        '<a class="fchip" href="#/budget">查看详情 →</a>' +
      '</div>' +
    '</div>' +

    /* ⑤ AI 助手入口 */
    '<div class="ov-ai-entry">' +
      '<div class="ov-ai-icon">🤖</div>' +
      '<div class="ov-ai-content">' +
        '<div class="ov-ai-title">AI 助手</div>' +
        '<div class="ov-ai-sub">有什么可以帮您？' + (aiQueueCount > 0 ? '（' + aiQueueCount + ' 笔待确认）' : '') + '</div>' +
      '</div>' +
      '<div class="ov-ai-actions">' +
        '<a class="btn" href="#/ledger">分析支出</a>' +
        '<a class="btn" href="#/contracts">审查合同</a>' +
        '<a class="btn" href="#/taxburden">查看税负</a>' +
        '<button class="btn gold" onclick="window.print()">生成报告</button>' +
      '</div>' +
    '</div>';
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

/* ------------------------------------------------------------ 视图：财税管理页（3 Tab） */
var financeTab = "ledger"; /* 当前 Tab：ledger | tax | invoice */
function vFinance(el) {
  /* Tab 切换 HTML */
  var tabs = [
    { key: "ledger", label: "记账中心", count: DB.ledger.length },
    { key: "tax", label: "税务中心", count: DB.taxcal.filter(function (t) { return t.status === "待申报" || t.status === "待办"; }).length },
    { key: "invoice", label: "发票中心", count: DB.invoices.toIssue.length + DB.invoices.toCollect.length }
  ];
  var tabHtml = tabs.map(function (t) {
    return '<button class="ov-tab-btn' + (financeTab === t.key ? ' active' : '') + '" data-finance-tab="' + t.key + '">' +
      esc(t.label) + (t.count > 0 ? ' <span class="ov-tab-count">' + t.count + '</span>' : '') + '</button>';
  }).join("");

  var contentHtml = "";

  /* ---- Tab: 记账中心 ---- */
  if (financeTab === "ledger") {
    /* AI 队列 */
    var aiQueue = DB.aiQueue.filter(function (q) { return !aiDone[q.ledgerId] && !aiSkip[q.id]; });
    var aiHtml = aiQueue.length ? aiQueue.map(function (q) {
      return '<div class="ai-row" data-q="' + q.id + '">' +
        '<div class="body"><div class="t">' + esc(q.srcType) + " · 置信度 " + fmt(q.conf * 100, 0) + '%</div>' +
        '<div class="d">原始：' + esc(q.src) + "</div>" +
        '<div class="d">建议：<b style="color:var(--deck-gold)">' + esc(q.suggest) + "</b></div></div>" +
        '<div class="acts"><button class="btn gold" data-ai-accept="' + q.id + '">采纳</button>' +
        '<button class="btn" data-ai-skip="' + q.id + '">忽略</button></div></div>';
    }).join("") : '<p class="note" style="color:var(--deck-ink-2);padding:6px 0">队列已清空。</p>';

    /* 台账统计 */
    var inSum = 0, outSum = 0;
    DB.ledger.forEach(function (r) { if (r.type === "收入") inSum += r.amount; else outSum += r.amount; });

    /* 台账表格 */
    var ledgerRows = DB.ledger.slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); }).slice(0, 10).map(function (r) {
      var pending = r.ai && !aiDone[r.id];
      var amt = r.type === "收入" ? r.amount : -r.amount;
      return '<tr class="' + (pending ? "hl" : "") + '">' +
        '<td class="mono">' + esc(r.date) + "</td>" +
        '<td><span class="tag ' + (r.type === "收入" ? "" : "plain") + '">' + r.type + "</span></td>" +
        "<td>" + esc(r.cat) + "</td><td>" + esc(r.party) + "</td>" +
        '<td class="mono ' + clsNum(amt) + '" style="text-align:right">' + (amt > 0 ? "+" : "") + fmt(amt, 2) + "</td>" +
        '<td>' + (pending ? '<span class="tag gold">待确认</span>' : '<span class="tag plain">已入账</span>') + "</td></tr>";
    }).join("");

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header">' +
          '<h4>📥 智能录入</h4>' +
          '<div class="fin-input-methods">' +
            '<button class="btn" onclick="document.getElementById(\'flowIn\').focus()">📷 拍照识别</button>' +
            '<button class="btn" onclick="document.getElementById(\'flowIn\').focus()">📋 粘贴流水</button>' +
            '<button class="btn">📤 文件上传</button>' +
          '</div>' +
        '</div>' +
        '<div class="fin-flow-paste">' +
          '<textarea class="flow-in" id="flowIn" rows="2" placeholder="粘贴银行流水，每行一条..."></textarea>' +
          '<button class="btn gold" id="flowRun" style="margin-top:6px">识别草稿</button>' +
        '</div>' +
      '</div>' +
      '<div class="fin-section">' +
        '<div class="fin-section-header">' +
          '<h4>📊 本月台账</h4>' +
          '<div class="fin-stats">' +
            '<span class="fin-stat">收入 <strong class="pos">' + yuan(inSum) + '</strong></span>' +
            '<span class="fin-stat">支出 <strong class="neg">' + yuan(outSum) + '</strong></span>' +
            '<span class="fin-stat">净额 <strong class="' + clsNum(inSum - outSum) + '">' + yuan(inSum - outSum) + '</strong></span>' +
            '<span class="fin-stat">AI待确认 <strong>' + aiQueue.length + '</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="sim" style="margin-bottom:12px">' +
          '<div class="sim-head"><span class="t">AI 识别队列</span><span class="en">AI INBOX</span>' +
          '<button class="reset" id="aiReset">重置</button></div>' +
          '<div style="padding:6px 18px 14px">' + aiHtml + '</div>' +
        '</div>' +
        '<div class="table-scroll"><table class="dense"><thead><tr>' +
          '<th>日期</th><th>类型</th><th>科目</th><th>往来方</th><th style="text-align:right">金额</th><th>状态</th>' +
        '</tr></thead><tbody>' + ledgerRows + '</tbody></table></div>' +
        '<div style="margin-top:10px;display:flex;gap:8px">' +
          '<button class="btn" id="csvBtn">导出 CSV</button>' +
          '<a class="fchip" href="#/ledger">查看全部 →</a>' +
        '</div>' +
      '</div>';
  }

  /* ---- Tab: 税务中心 ---- */
  if (financeTab === "tax") {
    /* 待申报事项 */
    var pendingTax = DB.taxcal.filter(function (t) { return t.status === "待申报" || t.status === "待办"; });
    var taxHtml = pendingTax.map(function (t) {
      var lvl = t.status === "待办" ? "red" : "gold";
      return '<div class="fin-tax-item">' +
        '<div class="fin-tax-info">' +
          '<span class="tag ' + lvl + '">' + esc(t.status) + '</span>' +
          '<span class="fin-tax-name">' + esc(t.item) + '</span>' +
          '<span class="fin-tax-due">截止 ' + esc(t.due) + '</span>' +
        '</div>' +
        '<div class="fin-tax-amount">' + esc(t.tax) + '</div>' +
        '<button class="btn gold">一键申报</button>' +
      '</div>';
    }).join("");

    /* 税负分析 */
    var ytd = DB.taxburden.ytd;

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📅 待申报事项</h4></div>' +
        (taxHtml || '<p class="note">暂无待申报事项。</p>') +
      '</div>' +
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📈 税负分析</h4></div>' +
        '<div class="fin-tax-summary">' +
          '<div class="fin-tax-kpi">' +
            '<div class="fin-tax-kpi-label">实际税负率</div>' +
            '<div class="fin-tax-kpi-value">' + pct(ytd.rate, 2) + '</div>' +
            '<div class="fin-tax-kpi-sub">年初至 9 月累计</div>' +
          '</div>' +
          '<div class="fin-tax-kpi">' +
            '<div class="fin-tax-kpi-label">累计营收</div>' +
            '<div class="fin-tax-kpi-value">' + fmt(ytd.revenue / 10000, 1) + '<small> 万</small></div>' +
          '</div>' +
          '<div class="fin-tax-kpi">' +
            '<div class="fin-tax-kpi-label">累计纳税</div>' +
            '<div class="fin-tax-kpi-value">' + fmt(ytd.total / 10000, 2) + '<small> 万</small></div>' +
          '</div>' +
          '<div class="fin-tax-kpi">' +
            '<div class="fin-tax-kpi-label">行业均值</div>' +
            '<div class="fin-tax-kpi-value">3.2%</div>' +
            '<div class="fin-tax-kpi-sub ' + (ytd.rate > 0.032 ? 'neg' : 'pos') + '">' + (ytd.rate > 0.032 ? '高于' : '低于') + '行业</div>' +
          '</div>' +
        '</div>' +
        '<a class="fchip" href="#/taxburden">查看详细分析 →</a>' +
      '</div>';
  }

  /* ---- Tab: 发票中心 ---- */
  if (financeTab === "invoice") {
    /* 待开票 */
    var issueRows = DB.invoices.toIssue.map(function (i) {
      return '<tr><td class="mono">' + esc(i.id) + '</td><td>' + esc(i.party) + '</td><td>' + esc(i.item) + '</td>' +
        '<td class="mono" style="text-align:right">' + fmt(i.amount) + '</td><td class="mono">' + esc(i.due) + '</td>' +
        '<td><span class="tag gold">' + esc(i.status) + '</span></td></tr>';
    }).join("");

    /* 待收票 */
    var collectRows = DB.invoices.toCollect.map(function (i) {
      return '<tr><td class="mono">' + esc(i.id) + '</td><td>' + esc(i.party) + '</td><td>' + esc(i.item) + '</td>' +
        '<td class="mono" style="text-align:right">' + fmt(i.amount) + '</td><td class="mono">' + esc(i.due) + '</td>' +
        '<td><span class="tag ' + (i.status === "换开中" ? "red" : "gold") + '">' + esc(i.status) + '</span></td></tr>';
    }).join("");

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header">' +
          '<h4>📄 发票队列</h4>' +
          '<div class="fin-stats">' +
            '<span class="fin-stat">三单匹配率 <strong>' + pct(DB.invoices.matchRate, 0) + '</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="grid g2">' +
          '<div>' +
            '<h4 class="sub">待开票（销项）<span class="tag gold">' + DB.invoices.toIssue.length + '</span></h4>' +
            '<div class="table-scroll"><table class="dense"><thead><tr>' +
              '<th>编号</th><th>往来方</th><th>事项</th><th style="text-align:right">金额</th><th>期限</th><th>状态</th>' +
            '</tr></thead><tbody>' + issueRows + '</tbody></table></div>' +
          '</div>' +
          '<div>' +
            '<h4 class="sub">待收票（进项）<span class="tag gold">' + DB.invoices.toCollect.length + '</span></h4>' +
            '<div class="table-scroll"><table class="dense"><thead><tr>' +
              '<th>编号</th><th>往来方</th><th>事项</th><th style="text-align:right">金额</th><th>期限</th><th>状态</th>' +
            '</tr></thead><tbody>' + collectRows + '</tbody></table></div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px">' +
          '<button class="btn gold">一键开票</button>' +
          '<button class="btn">申请收票</button>' +
          '<a class="fchip" href="#/invoices">查看全部 →</a>' +
        '</div>' +
      '</div>';
  }

  el.innerHTML =
    vhead("finance",
      "财税管理页整合记账、税务、发票三大核心功能，所有流程支持一键完成。",
      ["记账中心 · 税务中心 · 发票中心"]) +
    '<div class="ov-tabs">' + tabHtml + '</div>' +
    '<div class="fin-content">' + contentHtml + '</div>';
}

/* ------------------------------------------------------------ 视图：法务管理页（3 Tab） */
var legalTab = "contracts"; /* 当前 Tab：contracts | compliance | consult */
function vLegal(el) {
  /* Tab 切换 HTML */
  var tabs = [
    { key: "contracts", label: "合同管理", count: DB.contracts.filter(function (c) { return c.stage === "审查中"; }).length },
    { key: "compliance", label: "合规诊断", count: DB.checklist.reduce(function (s, g) { return s + g.items.length; }, 0) },
    { key: "consult", label: "法律咨询", count: 0 }
  ];
  var tabHtml = tabs.map(function (t) {
    return '<button class="ov-tab-btn' + (legalTab === t.key ? ' active' : '') + '" data-legal-tab="' + t.key + '">' +
      esc(t.label) + (t.count > 0 ? ' <span class="ov-tab-count">' + t.count + '</span>' : '') + '</button>';
  }).join("");

  var contentHtml = "";

  /* ---- Tab: 合同管理 ---- */
  if (legalTab === "contracts") {
    /* 合同队列统计 */
    var stageCounts = {};
    DB.contractLifecycle.forEach(function (c) {
      stageCounts[c.status] = (stageCounts[c.status] || 0) + 1;
    });

    /* 合同列表 */
    var contractRows = DB.contractLifecycle.map(function (c) {
      var lc = c.status === "临期" ? "red" : c.status === "审查中" ? "gold" : "plain";
      var invP = c.amount ? c.invoiced / c.amount : 0;
      var recP = c.amount ? c.received / c.amount : 0;
      return '<tr class="' + (c.status === "临期" ? "hl" : "") + '">' +
        '<td><b>' + esc(c.name) + '</b><div class="note">' + esc(c.party) + '</div></td>' +
        '<td class="mono">' + esc(c.end) + '</td>' +
        '<td><div class="track" title="已开票 ' + pct(invP, 0) + '"><i style="width:' + (invP * 100).toFixed(0) + '%"></i></div></td>' +
        '<td><div class="track" title="已收款 ' + pct(recP, 0) + '"><i style="width:' + (recP * 100).toFixed(0) + '%" class="' + (recP < invP ? "warn" : "") + '"></i></div></td>' +
        '<td><span class="tag ' + lc + '">' + esc(c.status) + '</span></td>' +
        '<td><button class="btn">查看</button></td></tr>';
    }).join("");

    /* AI 审查结果 */
    var reviewCards = DB.contracts.filter(function (c) { return c.stage === "审查中"; }).map(function (c) {
      var lvlCls = c.verdictLevel === "bad" ? "red" : c.verdictLevel === "warn" ? "gold" : "";
      var clauseRows = c.clauses.map(function (cl) {
        var lc = cl.level === "高" ? "red" : cl.level === "中" ? "gold" : "plain";
        return '<tr><td class="mono">' + esc(cl.clause) + '</td>' +
          '<td><span class="tag ' + lc + '">' + cl.level + '</span></td>' +
          '<td>' + esc(cl.finding) + '</td></tr>';
      }).join("");
      return '<div class="card ' + lvlCls + '">' +
        '<h4>' + esc(c.name) + ' <span class="tag ' + lvlCls + '">' + esc(c.verdict) + '</span></h4>' +
        '<p class="src">' + esc(c.id) + ' · ' + esc(c.party) + '</p>' +
        '<p>' + esc(c.summary) + '</p>' +
        (clauseRows ? '<div class="table-scroll" style="margin-top:8px"><table class="dense"><thead><tr><th>条款</th><th>风险</th><th>发现</th></tr></thead><tbody>' + clauseRows + '</tbody></table></div>' : '') +
      '</div>';
    }).join("");

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header">' +
          '<h4>📄 合同队列</h4>' +
          '<div class="fin-stats">' +
            Object.keys(stageCounts).map(function (k) {
              return '<span class="fin-stat">' + esc(k) + ' <strong>' + stageCounts[k] + '</strong></span>';
            }).join("") +
          '</div>' +
        '</div>' +
        '<div class="table-scroll"><table class="dense"><thead><tr>' +
          '<th>合同 / 往来方</th><th>到期日</th><th>开票进度</th><th>收款进度</th><th>状态</th><th>操作</th>' +
        '</tr></thead><tbody>' + contractRows + '</tbody></table></div>' +
        '<div style="margin-top:12px;display:flex;gap:8px">' +
          '<button class="btn gold">上传合同</button>' +
          '<button class="btn">选择模板</button>' +
          '<a class="fchip" href="#/lifecycle">查看全部 →</a>' +
        '</div>' +
      '</div>' +
      (reviewCards ? '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🤖 AI 合同审查</h4></div>' +
        '<div class="grid g2">' + reviewCards + '</div>' +
      '</div>' : '');
  }

  /* ---- Tab: 合规诊断 ---- */
  if (legalTab === "compliance") {
    /* 合规健康度雷达图数据 */
    var domainScores = DB.checklist.map(function (g) {
      var done = g.items.filter(function (it, i) {
        return cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done;
      }).length;
      return { domain: g.domain, score: Math.round(done / g.items.length * 100), done: done, total: g.items.length };
    });

    /* 简化版雷达图（用进度条替代） */
    var radarHtml = domainScores.map(function (d) {
      var cls = d.score >= 80 ? "" : d.score >= 60 ? "warn" : "over";
      return '<div class="legal-radar-item">' +
        '<div class="legal-radar-label">' + esc(d.domain) + '</div>' +
        '<div class="legal-radar-bar"><div class="track"><i style="width:' + d.score + '%" class="' + cls + '"></i></div></div>' +
        '<div class="legal-radar-score">' + d.score + '/100</div>' +
      '</div>';
    }).join("");

    /* 合规清单摘要 */
    var totalItems = 0, doneItems = 0;
    var checklistSummary = DB.checklist.map(function (g) {
      var d = g.items.filter(function (it, i) {
        return cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done;
      }).length;
      totalItems += g.items.length;
      doneItems += d;
      return '<div class="legal-checklist-group">' +
        '<div class="legal-checklist-header">' +
          '<span>' + esc(g.domain) + '</span>' +
          '<span class="tag ' + (d === g.items.length ? "" : "gold") + '">' + d + ' / ' + g.items.length + '</span>' +
        '</div>' +
        '<ul class="ckl">' +
          g.items.map(function (it, i) {
            var checked = cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done;
            return '<li class="' + (checked ? "done" : "") + '">' +
              '<input type="checkbox" id="lg-' + g.domain + '-' + i + '" data-ck="' + esc(g.domain + "|" + i) + '"' + (checked ? " checked" : "") + '>' +
              '<label for="lg-' + g.domain + '-' + i + '">' + esc(it.q) + '<span class="ref">' + esc(it.ref) + '</span></label></li>';
          }).join("") +
        '</ul>' +
      '</div>';
    }).join("");

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🎯 合规健康度</h4></div>' +
        '<div class="legal-radar">' + radarHtml + '</div>' +
        '<div class="legal-overall">总完成度：<strong>' + doneItems + ' / ' + totalItems + '</strong> (' + pct(doneItems / totalItems, 0) + ')</div>' +
      '</div>' +
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>✅ 合规自查清单</h4></div>' +
        '<div class="grid g2">' + checklistSummary + '</div>' +
        '<div style="margin-top:12px">' +
          '<button class="btn" onclick="window.print()">导出报告</button>' +
        '</div>' +
      '</div>';
  }

  /* ---- Tab: 法律咨询 ---- */
  if (legalTab === "consult") {
    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🤖 AI 法务助手</h4></div>' +
        '<div class="legal-ai-chat">' +
          '<div class="legal-ai-messages">' +
            '<div class="legal-ai-msg user">' +
              '<div class="legal-ai-avatar">👤</div>' +
              '<div class="legal-ai-content">一人公司需要签劳动合同吗？</div>' +
            '</div>' +
            '<div class="legal-ai-msg ai">' +
              '<div class="legal-ai-avatar">🤖</div>' +
              '<div class="legal-ai-content">' +
                '<p>根据《劳动合同法》第10条，建立劳动关系应当订立书面劳动合同。</p>' +
                '<p>一人公司虽然只有股东一个"老板"，但如果股东本人也在公司任职（如担任执行董事），同样需要签订劳动合同。</p>' +
                '<p><strong>建议</strong>：立即补签劳动合同，避免双倍工资风险。</p>' +
                '<div style="margin-top:8px">' +
                  '<button class="btn">查看法规依据</button>' +
                  '<button class="btn gold">生成协议模板</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="legal-ai-input">' +
            '<input type="text" placeholder="输入法律问题..." class="flow-in" style="background:var(--paper-3);color:var(--ink);border-color:var(--line)">' +
            '<button class="btn gold">发送</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>👨‍⚖️ 律师对接</h4></div>' +
        '<div class="grid g3">' +
          '<div class="legal-service-card">' +
            '<h4>合同审查</h4>' +
            '<div class="legal-service-price">¥299/份</div>' +
            '<p>专业律师深度审查，出具修改意见</p>' +
            '<button class="btn gold">预约</button>' +
          '</div>' +
          '<div class="legal-service-card">' +
            '<h4>股权架构设计</h4>' +
            '<div class="legal-service-price">¥1,999</div>' +
            '<p>OPC 股权结构优化方案</p>' +
            '<button class="btn gold">预约</button>' +
          '</div>' +
          '<div class="legal-service-card">' +
            '<h4>劳动仲裁代理</h4>' +
            '<div class="legal-service-price">按案收费</div>' +
            '<p>劳动争议案件全程代理</p>' +
            '<button class="btn gold">咨询</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  el.innerHTML =
    vhead("legal",
      "法务管理页整合合同管理、合规诊断、法律咨询三大功能，AI 辅助风险识别与合规保障。",
      ["合同管理 · 合规诊断 · 法律咨询"]) +
    '<div class="ov-tabs">' + tabHtml + '</div>' +
    '<div class="fin-content">' + contentHtml + '</div>';
}

/* ------------------------------------------------------------ 视图：数据中心（4 Tab） */
var dataTab = "health"; /* 当前 Tab：health | risk | forecast | export */
function vDataCenter(el) {
  /* Tab 切换 HTML */
  var tabs = [
    { key: "health", label: "经营健康度" },
    { key: "risk", label: "风险雷达" },
    { key: "forecast", label: "现金流预测" },
    { key: "export", label: "导出报告" }
  ];
  var tabHtml = tabs.map(function (t) {
    return '<button class="ov-tab-btn' + (dataTab === t.key ? ' active' : '') + '" data-data-tab="' + t.key + '">' +
      esc(t.label) + '</button>';
  }).join("");

  var contentHtml = "";

  /* ---- Tab: 经营健康度 ---- */
  if (dataTab === "health") {
    /* 核心指标计算 */
    var inSum = 0, outSum = 0;
    DB.ledger.forEach(function (r) { if (r.type === "收入") inSum += r.amount; else outSum += r.amount; });
    var grossProfit = inSum - outSum;
    var grossMargin = inSum > 0 ? grossProfit / inSum : 0;
    var netMargin = grossMargin; /* 简化：无其他费用 */
    var cashEnd = DB.cashflow.months[DB.cashflow.months.length - 1].end;
    var totalAssets = cashEnd + DB.arap.receivables.reduce(function (s, r) { return s + r.amount; }, 0);
    var totalLiabilities = DB.arap.payables.reduce(function (s, r) { return s + r.amount; }, 0) + DB.shareholder.loanBalance;
    var debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;

    /* 指标卡片 */
    var metrics = [
      { label: "毛利率", value: pct(grossMargin, 1), trend: "行业均值 68%", cls: grossMargin > 0.68 ? "pos" : "neg" },
      { label: "净利率", value: pct(netMargin, 1), trend: "行业均值 12%", cls: netMargin > 0.12 ? "pos" : "neg" },
      { label: "现金流", value: fmt(cashEnd / 10000, 1) + " 万", trend: "跑道 " + DB.cashflow.runway.months + " 个月", cls: DB.cashflow.runway.months >= 6 ? "pos" : "neg" },
      { label: "资产负债率", value: pct(debtRatio, 1), trend: "健康区间 <50%", cls: debtRatio < 0.5 ? "pos" : "neg" }
    ];
    var metricHtml = metrics.map(function (m) {
      return '<div class="dc-metric">' +
        '<div class="dc-metric-label">' + esc(m.label) + '</div>' +
        '<div class="dc-metric-value ' + m.cls + '">' + esc(m.value) + '</div>' +
        '<div class="dc-metric-trend ' + m.cls + '">' + esc(m.trend) + '</div>' +
      '</div>';
    }).join("");

    /* 趋势图（SVG） */
    var months = DB.cashflow.months;
    var trendSvg = '<svg viewBox="0 0 400 120" class="dc-trend-chart">' +
      '<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--navy)" stop-opacity="0.2"/>' +
      '<stop offset="100%" stop-color="var(--navy)" stop-opacity="0"/>' +
      '</linearGradient></defs>';
    /* 网格线 */
    for (var g = 0; g <= 4; g++) {
      var gy = 10 + g * 25;
      trendSvg += '<line x1="40" y1="' + gy + '" x2="390" y2="' + gy + '" stroke="var(--line)" stroke-width="1"/>';
    }
    /* 折线 */
    var maxVal = Math.max.apply(null, months.map(function (m) { return m.end; }));
    var minVal = Math.min.apply(null, months.map(function (m) { return m.end; }));
    var range = maxVal - minVal || 1;
    var lineD = months.map(function (m, i) {
      var x = 40 + i * (350 / (months.length - 1));
      var y = 10 + (1 - (m.end - minVal) / range) * 100;
      return (i === 0 ? "M" : "L") + x + " " + y;
    }).join(" ");
    trendSvg += '<path d="' + lineD + '" fill="none" stroke="var(--navy)" stroke-width="2"/>';
    /* 数据点 */
    months.forEach(function (m, i) {
      var x = 40 + i * (350 / (months.length - 1));
      var y = 10 + (1 - (m.end - minVal) / range) * 100;
      trendSvg += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + (i === months.length - 1 ? "var(--gold)" : "var(--paper-3)") + '" stroke="var(--navy)" stroke-width="1.5"/>';
      trendSvg += '<text x="' + x + '" y="118" text-anchor="middle" fill="var(--ink-3)" font-size="9">' + esc(m.label) + '</text>';
    });
    trendSvg += '</svg>';

    /* 行业对标 */
    var benchmarks = [
      { label: "毛利率", value: grossMargin, industry: 0.68 },
      { label: "净利率", value: netMargin, industry: 0.12 },
      { label: "税负率", value: DB.taxburden.ytd.rate, industry: 0.032 },
      { label: "人效", value: 7.97, industry: 5.2, unit: "万/人" }
    ];
    var benchmarkHtml = benchmarks.map(function (b) {
      var diff = b.value - b.industry;
      var diffPct = b.industry > 0 ? diff / b.industry : 0;
      var cls = diffPct > 0 ? "pos" : "neg";
      var label = diffPct > 0 ? "高于" : "低于";
      return '<div class="dc-benchmark-item">' +
        '<div class="dc-benchmark-label">' + esc(b.label) + '</div>' +
        '<div class="dc-benchmark-value">' + (b.unit ? fmt(b.value, 2) + ' ' + b.unit : pct(b.value, 1)) + '</div>' +
        '<div class="dc-benchmark-industry">行业 ' + (b.unit ? fmt(b.industry, 2) + ' ' + b.unit : pct(b.industry, 1)) + '</div>' +
        '<div class="dc-benchmark-diff ' + cls + '">' + label + ' ' + pct(Math.abs(diffPct), 0) + '</div>' +
      '</div>';
    }).join("");

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📊 核心指标仪表盘</h4></div>' +
        '<div class="dc-metrics-grid">' + metricHtml + '</div>' +
      '</div>' +
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📈 趋势分析</h4></div>' +
        '<div class="dc-trend-container">' + trendSvg + '</div>' +
        '<div class="dc-trend-legend">' +
          '<span class="dc-legend-item"><span class="dc-legend-dot" style="background:var(--navy)"></span>期末现金余额</span>' +
          '<span class="dc-legend-item"><span class="dc-legend-dot" style="background:var(--gold)"></span>最新一期</span>' +
        '</div>' +
      '</div>' +
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🏭 行业对标</h4></div>' +
        '<div class="dc-benchmark-grid">' + benchmarkHtml + '</div>' +
      '</div>';
  }

  /* ---- Tab: 风险雷达 ---- */
  if (dataTab === "risk") {
    /* 风险评分计算 */
    var openAlerts = DB.alerts.filter(function (a) { var st = alertDone[a.id] || a.status; return st !== "已忽略" && st !== "已闭环"; });
    var riskScores = {
      "财务": 0, "税务": 0, "法务": 0, "合规": 0, "信用": 0, "运营": 0, "市场": 0, "人员": 0
    };
    /* 基于预警 */
    openAlerts.forEach(function (a) {
      var score = a.sev === "高" ? 15 : a.sev === "中" ? 8 : 3;
      if (a.domain === "财") riskScores["财务"] += score;
      else if (a.domain === "税") riskScores["税务"] += score;
      else if (a.domain === "法") riskScores["法务"] += score;
    });
    /* 基于合规清单 */
    var compDone = 0, compTotal = 0;
    DB.checklist.forEach(function (g) {
      g.items.forEach(function (it, i) {
        compTotal++;
        var checked = cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done;
        if (checked) compDone++;
      });
    });
    riskScores["合规"] = Math.round((1 - compDone / compTotal) * 50);
    /* 基于应收 */
    var overdue90 = DB.arap.receivables.filter(function (r) { return r.status.indexOf("逾期") >= 0 && parseInt(r.status) > 90; });
    riskScores["信用"] = Math.min(overdue90.length * 15, 60);
    /* 基于社保 */
    riskScores["人员"] = DB.social.issues.filter(function (i) { return i.level === "高"; }).length * 12;
    /* 基于合同 */
    var badContracts = DB.contracts.filter(function (c) { return c.verdictLevel === "bad"; });
    riskScores["运营"] = badContracts.length * 10;
    /* 市场风险（固定低值） */
    riskScores["市场"] = 15;

    /* 限制在 0-100 */
    Object.keys(riskScores).forEach(function (k) {
      riskScores[k] = Math.min(Math.max(riskScores[k], 0), 100);
    });

    /* 雷达图 SVG */
    var riskKeys = Object.keys(riskScores);
    var riskColors = ["var(--red)", "var(--gold)", "var(--navy)", "var(--green)", "var(--ink-3)", "var(--gold-2)", "var(--navy-mist)", "var(--red)"];
    var radarCx = 150, radarCy = 130, radarR = 100;
    var radarSvg = '<svg viewBox="0 0 300 280" class="dc-radar-chart">';
    /* 背景网格 */
    for (var r = 1; r <= 4; r++) {
      var rr = radarR * r / 4;
      var pts = riskKeys.map(function (k, i) {
        var angle = (Math.PI * 2 * i / riskKeys.length) - Math.PI / 2;
        return (radarCx + rr * Math.cos(angle)).toFixed(1) + "," + (radarCy + rr * Math.sin(angle)).toFixed(1);
      }).join(" ");
      radarSvg += '<polygon points="' + pts + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
    }
    /* 轴线 */
    riskKeys.forEach(function (k, i) {
      var angle = (Math.PI * 2 * i / riskKeys.length) - Math.PI / 2;
      var x2 = radarCx + radarR * Math.cos(angle);
      var y2 = radarCy + radarR * Math.sin(angle);
      radarSvg += '<line x1="' + radarCx + '" y1="' + radarCy + '" x2="' + x2 + '" y2="' + y2 + '" stroke="var(--line)" stroke-width="1"/>';
      /* 标签 */
      var lx = radarCx + (radarR + 20) * Math.cos(angle);
      var ly = radarCy + (radarR + 20) * Math.sin(angle);
      radarSvg += '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" fill="var(--ink-2)" font-size="10">' + esc(k) + '</text>';
    });
    /* 数据多边形 */
    var dataPts = riskKeys.map(function (k, i) {
      var angle = (Math.PI * 2 * i / riskKeys.length) - Math.PI / 2;
      var val = riskScores[k] / 100;
      var x = radarCx + radarR * val * Math.cos(angle);
      var y = radarCy + radarR * val * Math.sin(angle);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    radarSvg += '<polygon points="' + dataPts + '" fill="var(--navy)" fill-opacity="0.15" stroke="var(--navy)" stroke-width="2"/>';
    /* 数据点 */
    riskKeys.forEach(function (k, i) {
      var angle = (Math.PI * 2 * i / riskKeys.length) - Math.PI / 2;
      var val = riskScores[k] / 100;
      var x = radarCx + radarR * val * Math.cos(angle);
      var y = radarCy + radarR * val * Math.sin(angle);
      var color = riskScores[k] > 60 ? "var(--red)" : riskScores[k] > 30 ? "var(--gold)" : "var(--green)";
      radarSvg += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + color + '" stroke="var(--paper-3)" stroke-width="2"/>';
    });
    radarSvg += '</svg>';

    /* 风险评分列表 */
    var riskListHtml = riskKeys.map(function (k) {
      var score = riskScores[k];
      var cls = score > 60 ? "red" : score > 30 ? "gold" : "green";
      var level = score > 60 ? "高风险" : score > 30 ? "中风险" : "低风险";
      return '<div class="dc-risk-item">' +
        '<div class="dc-risk-label">' + esc(k) + '</div>' +
        '<div class="dc-risk-bar"><div class="track"><i style="width:' + score + '%" class="' + cls + '"></i></div></div>' +
        '<div class="dc-risk-score ' + cls + '">' + score + '/100</div>' +
        '<div class="dc-risk-level">' + level + '</div>' +
      '</div>';
    }).join("");

    /* 风险整改清单 */
    var整改Items = [];
    openAlerts.forEach(function (a) {
      整改Items.push({ level: a.sev, text: a.title, href: "#/alerts" });
    });
    DB.checklist.forEach(function (g) {
      g.items.forEach(function (it, i) {
        var checked = cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done;
        if (!checked) {
          整改Items.push({ level: "中", text: it.q.split("（")[0], href: "#/checklist" });
        }
      });
    });
    var整改Html = 整改Items.slice(0, 6).map(function (item) {
      var lvlCls = item.level === "高" ? "red" : item.level === "中" ? "gold" : "plain";
      return '<div class="dc-remedy-item">' +
        '<span class="tag ' + lvlCls + '">' + esc(item.level) + '</span>' +
        '<span class="dc-remedy-text">' + esc(item.text) + '</span>' +
      '</div>';
    }).join("");

    contentHtml =
      '<div class="grid g2">' +
        '<div class="fin-section">' +
          '<div class="fin-section-header"><h4>🎯 风险全景</h4></div>' +
          '<div class="dc-radar-container">' + radarSvg + '</div>' +
        '</div>' +
        '<div class="fin-section">' +
          '<div class="fin-section-header"><h4>📋 风险评分</h4></div>' +
          '<div class="dc-risk-list">' + riskListHtml + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📝 风险整改任务清单</h4></div>' +
        '<div class="dc-remedy-list">' +整改Html + '</div>' +
        '<div style="margin-top:10px"><a class="fchip" href="#/alerts">查看全部预警 →</a></div>' +
      '</div>';
  }

  /* ---- Tab: 现金流预测 ---- */
  if (dataTab === "forecast") {
    /* 简单预测：基于最近 3 个月平均 */
    var recentMonths = DB.cashflow.months.slice(-3);
    var avgInflow = recentMonths.reduce(function (s, m) { return s + m.inflow; }, 0) / 3;
    var avgOutflow = recentMonths.reduce(function (s, m) { return s + m.outflow; }, 0) / 3;
    var currentCash = DB.cashflow.months[DB.cashflow.months.length - 1].end;

    var forecastMonths = ["10月", "11月", "12月"];
    var forecastData = forecastMonths.map(function (label, i) {
      var inflow = Math.round(avgInflow * (1 + (i * 0.05))); /* 假设增长 5% */
      var outflow = Math.round(avgOutflow * (1 + (i * 0.03))); /* 假设增长 3% */
      var end = currentCash + (inflow - outflow) * (i + 1);
      return { label: label, inflow: inflow, outflow: outflow, end: end };
    });

    /* 预测卡片 */
    var forecastHtml = forecastData.map(function (f) {
      var net = f.inflow - f.outflow;
      return '<div class="dc-forecast-card">' +
        '<div class="dc-forecast-month">' + esc(f.label) + '</div>' +
        '<div class="dc-forecast-row"><span>预计流入</span><span class="pos">' + yuan(f.inflow) + '</span></div>' +
        '<div class="dc-forecast-row"><span>预计流出</span><span class="neg">' + yuan(f.outflow) + '</span></div>' +
        '<div class="dc-forecast-row"><span>净额</span><span class="' + clsNum(net) + '">' + yuan(net) + '</span></div>' +
        '<div class="dc-forecast-divider"></div>' +
        '<div class="dc-forecast-row"><span>期末余额</span><strong>' + yuan(f.end) + '</strong></div>' +
      '</div>';
    }).join("");

    /* 预警 */
    var warnings = [];
    if (forecastData[2].end < avgOutflow * 3) {
      warnings.push("⚠️ 12 月期末余额低于 3 个月支出，需关注资金安全");
    }
    DB.taxcal.filter(function (t) { return t.due >= "2026-10" && t.due <= "2026-12"; }).forEach(function (t) {
      warnings.push("📅 " + t.due + " " + t.item + " 需预留 " + t.tax);
    });

    var warningHtml = warnings.length ? warnings.map(function (w) {
      return '<div class="dc-warning-item">' + esc(w) + '</div>';
    }).join("") : '<div class="dc-warning-item ok">✅ 无资金安全预警</div>';

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🔮 现金流预测（未来 3 个月）</h4></div>' +
        '<div class="dc-forecast-grid">' + forecastHtml + '</div>' +
        '<div class="dc-forecast-note">* 预测基于最近 3 个月平均收支，假设收入增长 5%、支出增长 3%</div>' +
      '</div>' +
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>⚠️ 预警提示</h4></div>' +
        '<div class="dc-warning-list">' + warningHtml + '</div>' +
      '</div>';
  }

  /* ---- Tab: 导出报告 ---- */
  if (dataTab === "export") {
    var reportTypes = [
      { label: "月度报告", desc: "包含财务、税务、合规摘要", icon: "📊" },
      { label: "季度报告", desc: "深度分析 + 行业对标", icon: "📈" },
      { label: "年度报告", desc: "全年总结 + 下年规划", icon: "📋" }
    ];
    var reportHtml = reportTypes.map(function (r) {
      return '<div class="dc-report-card">' +
        '<div class="dc-report-icon">' + r.icon + '</div>' +
        '<div class="dc-report-info">' +
          '<div class="dc-report-label">' + esc(r.label) + '</div>' +
          '<div class="dc-report-desc">' + esc(r.desc) + '</div>' +
        '</div>' +
        '<button class="btn gold">生成</button>' +
      '</div>';
    }).join("");

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📄 报告生成</h4></div>' +
        '<div class="dc-report-list">' + reportHtml + '</div>' +
        '<div class="dc-report-divider"></div>' +
        '<div class="dc-report-content">' +
          '<h4>报告内容包含</h4>' +
          '<ul class="dc-report-items">' +
            '<li>📊 财务摘要（收入/支出/利润/现金流）</li>' +
            '<li>🏛️ 税务摘要（税负/申报/优惠）</li>' +
            '<li>✅ 合规摘要（清单完成度/风险预警）</li>' +
            '<li>🛡️ OPC 专项（隔离健康度/股东往来/年度节点）</li>' +
            '<li>📝 下月行动建议</li>' +
          '</ul>' +
        '</div>' +
        '<div style="margin-top:16px;display:flex;gap:8px">' +
          '<button class="btn">预览</button>' +
          '<button class="btn gold" onclick="window.print()">下载 PDF</button>' +
          '<button class="btn">发送邮件</button>' +
        '</div>' +
      '</div>';
  }

  el.innerHTML =
    vhead("datacenter",
      "数据中心提供经营健康度仪表盘、风险雷达图、现金流预测曲线等可视化图表，辅助决策。",
      ["经营健康度 · 风险雷达 · 现金流预测 · 导出报告"]) +
    '<div class="ov-tabs">' + tabHtml + '</div>' +
    '<div class="fin-content">' + contentHtml + '</div>';
}

/* ------------------------------------------------------------ 视图：合同与商务风险中心（MBA 认知增强） */
var crTab = "framework"; /* 当前 Tab：framework | clauses | negotiate | structure | cases */
function vContractRisk(el) {
  /* Tab 切换 HTML */
  var tabs = [
    { key: "framework", label: "风险认知框架" },
    { key: "clauses", label: "合同条款解剖" },
    { key: "negotiate", label: "商务谈判工具" },
    { key: "structure", label: "交易结构设计" },
    { key: "cases", label: "案例库" }
  ];
  var tabHtml = tabs.map(function (t) {
    return '<button class="ov-tab-btn' + (crTab === t.key ? ' active' : '') + '" data-cr-tab="' + t.key + '">' +
      esc(t.label) + '</button>';
  }).join("");

  var contentHtml = "";

  /* ---- Tab: 风险认知框架 ---- */
  if (crTab === "framework") {
    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🧠 合同风险认知框架（MBA 级）</h4></div>' +
        '<div class="cr-framework-intro">' +
          '<p>作为 IT 人转型 MBA，理解合同风险需要从「技术思维」转向「商业思维」。以下是核心认知框架：</p>' +
        '</div>' +
        '<div class="cr-framework-grid">' +
          /* 1. 风险识别 */
          '<div class="cr-framework-card">' +
            '<div class="cr-framework-icon">🔍</div>' +
            '<h4>1. 风险识别</h4>' +
            '<p class="cr-framework-desc">从「能跑通」到「能赚钱且安全」</p>' +
            '<ul class="cr-framework-list">' +
              '<li><strong>技术风险</strong>：交付标准模糊、验收条件缺失</li>' +
              '<li><strong>商业风险</strong>：付款条件不利、违约金不对等</li>' +
              '<li><strong>法律风险</strong>：无限责任、知识产权归属不清</li>' +
              '<li><strong>税务风险</strong>：发票类型、税率适用错误</li>' +
            '</ul>' +
            '<div class="cr-framework-tip">💡 IT 人常犯：只关注技术指标，忽略商业条款</div>' +
          '</div>' +
          /* 2. 风险评估 */
          '<div class="cr-framework-card">' +
            '<div class="cr-framework-icon">📊</div>' +
            '<h4>2. 风险评估</h4>' +
            '<p class="cr-framework-desc">用量化思维评估风险等级</p>' +
            '<ul class="cr-framework-list">' +
              '<li><strong>概率评估</strong>：该风险发生的可能性</li>' +
              '<li><strong>影响评估</strong>：发生后对业务的影响程度</li>' +
              '<li><strong>可控性</strong>：我们能否主动规避或转移</li>' +
              '<li><strong>优先级</strong>：高概率+高影响=最高优先级</li>' +
            '</ul>' +
            '<div class="cr-framework-tip">💡 MBA 工具：风险矩阵（概率×影响）</div>' +
          '</div>' +
          /* 3. 风险应对 */
          '<div class="cr-framework-card">' +
            '<div class="cr-framework-icon">🛡️</div>' +
            '<h4>3. 风险应对</h4>' +
            '<p class="cr-framework-desc">四种策略：规避、转移、减轻、接受</p>' +
            '<ul class="cr-framework-list">' +
              '<li><strong>规避</strong>：拒绝高风险条款或交易</li>' +
              '<li><strong>转移</strong>：通过保险或合同条款转移</li>' +
              '<li><strong>减轻</strong>：增加保护性条款降低影响</li>' +
              '<li><strong>接受</strong>：低风险可接受，但需监控</li>' +
            '</ul>' +
            '<div class="cr-framework-tip">💡 IT 人常犯：只懂「接受」，不懂「谈判」</div>' +
          '</div>' +
          /* 4. 合同谈判 */
          '<div class="cr-framework-card">' +
            '<div class="cr-framework-icon">🤝</div>' +
            '<h4>4. 合同谈判</h4>' +
            '<p class="cr-framework-desc">从「签不签」到「怎么签对自己有利」</p>' +
            '<ul class="cr-framework-list">' +
              '<li><strong>BATNA</strong>：最佳替代方案（谈判筹码）</li>' +
              '<li><strong>锚定效应</strong>：先出价者设定谈判基准</li>' +
              '<li><strong>利益交换</strong>：用次要利益换取核心利益</li>' +
              '<li><strong>书面确认</strong>：所有口头承诺必须写入合同</li>' +
            '</ul>' +
            '<div class="cr-framework-tip">💡 MBA 核心：谈判是双赢游戏，不是零和博弈</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      /* 风险清单模板 */
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📋 合同风险自查清单</h4></div>' +
        '<div class="cr-checklist-grid">' +
          '<div class="cr-checklist-group">' +
            '<h4>签约前</h4>' +
            '<ul class="cr-checklist">' +
              '<li><input type="checkbox"> 对方主体资格核查（营业执照、经营范围）</li>' +
              '<li><input type="checkbox"> 对方履约能力评估（注册资本、经营状况）</li>' +
              '<li><input type="checkbox"> 交易背景调查（是否存在关联关系）</li>' +
              '<li><input type="checkbox"> 合同目的明确（我们想要什么结果）</li>' +
            '</ul>' +
          '</div>' +
          '<div class="cr-checklist-group">' +
            '<h4>签约中</h4>' +
            '<ul class="cr-checklist">' +
              '<li><input type="checkbox"> 核心条款逐条审核（标的、价格、付款）</li>' +
              '<li><input type="checkbox"> 违约责任对等性检查</li>' +
              '<li><input type="checkbox"> 争议解决方式确认（仲裁 vs 诉讼）</li>' +
              '<li><input type="checkbox"> 合同生效条件明确</li>' +
            '</ul>' +
          '</div>' +
          '<div class="cr-checklist-group">' +
            '<h4>签约后</h4>' +
            '<ul class="cr-checklist">' +
              '<li><input type="checkbox"> 合同台账登记（到期日、付款节点）</li>' +
              '<li><input type="checkbox"> 履行证据保留（邮件、验收单、付款凭证）</li>' +
              '<li><input type="checkbox"> 定期履约检查（是否按约定执行）</li>' +
              '<li><input type="checkbox"> 变更/补充协议管理</li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---- Tab: 合同条款解剖 ---- */
  if (crTab === "clauses") {
    /* 常见高风险条款 */
    var clauses = [
      {
        name: "无限责任条款",
        risk: "高",
        example: "乙方对甲方的任何损失承担无限连带责任",
        problem: "将所有风险转嫁给乙方，且无上限",
        fix: "改为「以合同总价为上限」或「仅对直接损失负责」",
        mba: "MBA 视角：这是典型的「风险不对等」，接受即意味着用全部资产赌一个项目"
      },
      {
        name: "验收标准模糊",
        risk: "高",
        example: "甲方满意即视为验收通过",
        problem: "验收标准主观，甲方可以无理由拒付",
        fix: "明确验收指标、验收流程、异议期",
        mba: "MBA 视角：「满意」是主观判断，必须转化为可量化的 KPI"
      },
      {
        name: "付款条件不利",
        risk: "中",
        example: "项目完成后 180 天内付款",
        problem: "现金流压力大，且存在坏账风险",
        fix: "争取预付款+里程碑付款，缩短账期",
        mba: "MBA 视角：账期就是隐性成本，180 天账期≈年化 10% 融资成本"
      },
      {
        name: "知识产权归属不清",
        risk: "高",
        example: "项目成果归甲方所有",
        problem: "可能是「全部成果」包括背景 IP",
        fix: "明确「仅限本项目新增 IP」，保留背景 IP 权属",
        mba: "MBA 视角：IP 是科技公司核心资产，必须明确边界"
      },
      {
        name: "违约金不对等",
        risk: "中",
        example: "乙方违约支付合同总价 30% 违约金；甲方违约不承担违约责任",
        problem: "单方面惩罚，显失公平",
        fix: "违约责任应对等，比例合理（通常 10-20%）",
        mba: "MBA 视角：不对等条款在法律上可能被认定为无效"
      },
      {
        name: "竞业限制过宽",
        risk: "中",
        example: "乙方在合同期满后 2 年内不得从事同类业务",
        problem: "限制过度，影响后续业务发展",
        fix: "限定竞业范围、地域、补偿标准",
        mba: "MBA 视角：竞业限制必须有对价（补偿金），否则可能无效"
      }
    ];

    var clauseCards = clauses.map(function (c) {
      var riskCls = c.risk === "高" ? "red" : c.risk === "中" ? "gold" : "plain";
      return '<div class="cr-clause-card">' +
        '<div class="cr-clause-header">' +
          '<h4>' + esc(c.name) + '</h4>' +
          '<span class="tag ' + riskCls + '">' + esc(c.risk) + '风险</span>' +
        '</div>' +
        '<div class="cr-clause-section">' +
          '<div class="cr-clause-label">❌ 问题条款</div>' +
          '<div class="cr-clause-example">' + esc(c.example) + '</div>' +
          '<div class="cr-clause-problem">' + esc(c.problem) + '</div>' +
        '</div>' +
        '<div class="cr-clause-section">' +
          '<div class="cr-clause-label">✅ 修改建议</div>' +
          '<div class="cr-clause-fix">' + esc(c.fix) + '</div>' +
        '</div>' +
        '<div class="cr-clause-section mba">' +
          '<div class="cr-clause-label">🎓 MBA 视角</div>' +
          '<div class="cr-clause-mba">' + esc(c.mba) + '</div>' +
        '</div>' +
      '</div>';
    }).join("");

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🔍 常见高风险条款解剖</h4></div>' +
        '<p class="cr-intro">以下是最常见的 6 类高风险条款，每类都包含「问题条款」→「修改建议」→「MBA 视角」三层解析：</p>' +
        '<div class="cr-clause-grid">' + clauseCards + '</div>' +
      '</div>' +
      /* 条款速查表 */
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📋 条款速查表</h4></div>' +
        '<div class="table-scroll"><table class="dense"><thead><tr>' +
          '<th>条款类型</th><th>风险等级</th><th>关键检查点</th><th>谈判策略</th>' +
        '</tr></thead><tbody>' +
          '<tr><td>付款条款</td><td><span class="tag gold">中</span></td><td>预付款比例、账期、付款条件</td><td>争取 30% 预付 + 里程碑付款</td></tr>' +
          '<tr><td>违约责任</td><td><span class="tag red">高</span></td><td>违约金比例、上限、对等性</td><td>违约金不超过 20%，双向约束</td></tr>' +
          '<tr><td>验收标准</td><td><span class="tag red">高</span></td><td>验收指标、流程、异议期</td><td>量化 KPI，明确验收流程</td></tr>' +
          '<tr><td>知识产权</td><td><span class="tag red">高</span></td><td>归属范围、背景 IP、衍生 IP</td><td>仅限新增 IP，保留背景 IP</td></tr>' +
          '<tr><td>保密条款</td><td><span class="tag gold">中</span></td><td>范围、期限、违约责任</td><td>限定范围，合理期限（2-3 年）</td></tr>' +
          '<tr><td>争议解决</td><td><span class="tag plain">低</span></td><td>管辖法院/仲裁机构</td><td>优先选择己方所在地</td></tr>' +
        '</tbody></table></div>' +
      '</div>';
  }

  /* ---- Tab: 商务谈判工具 ---- */
  if (crTab === "negotiate") {
    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🤝 商务谈判核心工具</h4></div>' +
        '<div class="cr-negotiate-grid">' +
          /* BATNA */
          '<div class="cr-negotiate-card">' +
            '<h4>🎯 BATNA 分析</h4>' +
            '<p class="cr-negotiate-desc"><strong>Best Alternative To a Negotiated Agreement</strong></p>' +
            '<p>谈判前必须想清楚：如果这笔交易谈不成，我们的最佳替代方案是什么？</p>' +
            '<div class="cr-negotiate-example">' +
              '<strong>示例：</strong>' +
              '<ul>' +
                '<li>当前谈判：A 客户，合同金额 50 万，但条款苛刻</li>' +
                '<li>BATNA：B 客户，合同金额 45 万，条款合理</li>' +
                '<li>结论：A 客户的底线是 48 万 + 条款修改</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-negotiate-tip">💡 没有 BATNA 的谈判 = 没有筹码的赌博</div>' +
          '</div>' +
          /* 锚定效应 */
          '<div class="cr-negotiate-card">' +
            '<h4>⚓ 锚定效应</h4>' +
            '<p class="cr-negotiate-desc"><strong>先出价者设定谈判基准</strong></p>' +
            '<p>第一个报价会成为后续谈判的「锚点」，影响双方预期。</p>' +
            '<div class="cr-negotiate-example">' +
              '<strong>策略：</strong>' +
              '<ul>' +
                '<li>如果对方先出价低 → 提出你的高价，拉回谈判区间</li>' +
                '<li>如果你先出价 → 设定一个合理的高位锚点</li>' +
                '<li>报价要有依据 → 让对方觉得「这个价格合理」</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-negotiate-tip">💡 报价 = 成本 + 合理利润 + 谈判空间</div>' +
          '</div>' +
          /* 利益交换 */
          '<div class="cr-negotiate-card">' +
            '<h4>🔄 利益交换</h4>' +
            '<p class="cr-negotiate-desc"><strong>用次要利益换取核心利益</strong></p>' +
            '<p>不要在单一问题上僵持，学会「打包谈判」。</p>' +
            '<div class="cr-negotiate-example">' +
              '<strong>示例：</strong>' +
              '<ul>' +
                '<li>核心利益：预付款比例（30% vs 10%）</li>' +
                '<li>次要利益：交付周期（30 天 vs 45 天）</li>' +
                '<li>交换：接受 45 天交付，换取 30% 预付款</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-negotiate-tip">💡 好的谈判是双赢，不是你死我活</div>' +
          '</div>' +
          /* 书面确认 */
          '<div class="cr-negotiate-card">' +
            '<h4>📝 书面确认</h4>' +
            '<p class="cr-negotiate-desc"><strong>所有口头承诺必须写入合同</strong></p>' +
            '<p>「口说无凭」是商务谈判的大忌。</p>' +
            '<div class="cr-negotiate-example">' +
              '<strong>必须书面化：</strong>' +
              '<ul>' +
                '<li>价格折扣、优惠条件</li>' +
                '<li>交付时间、验收标准</li>' +
                '<li>售后服务、质保期限</li>' +
                '<li>任何口头承诺的额外条件</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-negotiate-tip">💡 没有写入合同的承诺 = 没有承诺</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      /* 谈判策略清单 */
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📋 谈判前准备清单</h4></div>' +
        '<div class="cr-checklist-grid">' +
          '<div class="cr-checklist-group">' +
            '<h4>信息收集</h4>' +
            '<ul class="cr-checklist">' +
              '<li><input type="checkbox"> 对方公司背景调查</li>' +
              '<li><input type="checkbox"> 对方谈判代表风格分析</li>' +
              '<li><input type="checkbox"> 市场行情和竞争对手报价</li>' +
              '<li><input type="checkbox"> 对方可能的 BATNA</li>' +
            '</ul>' +
          '</div>' +
          '<div class="cr-checklist-group">' +
            '<h4>筹码准备</h4>' +
            '<ul class="cr-checklist">' +
              '<li><input type="checkbox"> 我方 BATNA 明确</li>' +
              '<li><input type="checkbox"> 核心利益排序（必须得到 vs 可以交换）</li>' +
              '<li><input type="checkbox"> 让步空间和底线</li>' +
              '<li><input type="checkbox"> 备选方案（Plan B）</li>' +
            '</ul>' +
          '</div>' +
          '<div class="cr-checklist-group">' +
            '<h4>风险预案</h4>' +
            '<ul class="cr-checklist">' +
              '<li><input type="checkbox"> 对方可能的强硬立场</li>' +
              '<li><input type="checkbox"> 谈判破裂的后果评估</li>' +
              '<li><input type="checkbox"> 法律顾问提前沟通</li>' +
              '<li><input type="checkbox"> 合同模板和条款库准备</li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---- Tab: 交易结构设计 ---- */
  if (crTab === "structure") {
    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🏗️ 交易结构设计工具</h4></div>' +
        '<p class="cr-intro">好的交易结构 = 合法 + 合规 + 税优 + 风险可控。以下是 IT 服务常见的交易结构选择：</p>' +
        '<div class="cr-structure-grid">' +
          /* 固定总价 */
          '<div class="cr-structure-card">' +
            '<h4>💰 固定总价合同</h4>' +
            '<div class="cr-structure适用">适用场景：需求明确、范围清晰的项目</div>' +
            '<div class="cr-structure-pros">' +
              '<strong>✅ 优点：</strong>' +
              '<ul>' +
                '<li>收入确定，便于预算管理</li>' +
                '<li>客户预算可控</li>' +
                '<li>结算简单</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-structure-cons">' +
              '<strong>❌ 风险：</strong>' +
              '<ul>' +
                '<li>范围变更导致成本超支</li>' +
                '<li>需求蔓延风险</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-structure-tip">💡 关键：明确范围边界 + 变更流程</div>' +
          '</div>' +
          /* 时间材料 */
          '<div class="cr-structure-card">' +
            '<h4>⏱️ 时间材料合同（T&M）</h4>' +
            '<div class="cr-structure适用">适用场景：需求不明确、持续迭代的项目</div>' +
            '<div class="cr-structure-pros">' +
              '<strong>✅ 优点：</strong>' +
              '<ul>' +
                '<li>灵活性高，适应需求变化</li>' +
                '<li>风险共担</li>' +
                '<li>适合敏捷开发</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-structure-cons">' +
              '<strong>❌ 风险：</strong>' +
              '<ul>' +
                '<li>收入不确定</li>' +
                '<li>客户可能质疑工时</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-structure-tip">💡 关键：透明报价 + 定期报告 + 工时确认</div>' +
          '</div>' +
          /* 里程碑付款 */
          '<div class="cr-structure-card">' +
            '<h4>🎯 里程碑付款</h4>' +
            '<div class="cr-structure适用">适用场景：周期长、阶段明确的项目</div>' +
            '<div class="cr-structure-pros">' +
              '<strong>✅ 优点：</strong>' +
              '<ul>' +
                '<li>现金流友好</li>' +
                '<li>阶段性验收降低风险</li>' +
                '<li>激励按时交付</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-structure-cons">' +
              '<strong>❌ 风险：</strong>' +
              '<ul>' +
                '<li>里程碑定义争议</li>' +
                '<li>前置收款后客户违约</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-structure-tip">💡 关键：里程碑可验证 + 付款与交付挂钩</div>' +
          '</div>' +
          /* 分成模式 */
          '<div class="cr-structure-card">' +
            '<h4>🤝 收益分成模式</h4>' +
            '<div class="cr-structure适用">适用场景：长期合作、利益绑定</div>' +
            '<div class="cr-structure-pros">' +
              '<strong>✅ 优点：</strong>' +
              '<ul>' +
                '<li>利益绑定，激励最大化</li>' +
                '<li>降低客户前期投入</li>' +
                '<li>建立长期关系</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-structure-cons">' +
              '<strong>❌ 风险：</strong>' +
              '<ul>' +
                '<li>收入不确定</li>' +
                '<li>数据透明度要求高</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cr-structure-tip">💡 关键：分成比例 + 数据审计权 + 退出机制</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      /* 税务优化提示 */
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>🏛️ 交易结构与税务优化</h4></div>' +
        '<div class="cr-tax-grid">' +
          '<div class="cr-tax-item">' +
            '<h4>合同拆分</h4>' +
            '<p>将「技术服务 + 硬件销售」拆分为两份合同，适用不同税率（6% vs 13%）</p>' +
            '<div class="cr-tax-saving">预估节税：¥3,000-5,000/单</div>' +
          '</div>' +
          '<div class="cr-tax-item">' +
            '<h4>收入确认时点</h4>' +
            '<p>选择合适的收入确认方式（完工百分比法 vs 完成合同法），优化现金流</p>' +
            '<div class="cr-tax-saving">现金流改善：提前 1-3 个月</div>' +
          '</div>' +
          '<div class="cr-tax-item">' +
            '<h4>关联交易定价</h4>' +
            '<p>集团内服务定价需符合独立交易原则，避免转让定价风险</p>' +
            '<div class="cr-tax-saving">风险规避：避免补税+罚款</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---- Tab: 案例库 ---- */
  if (crTab === "cases") {
    var cases = [
      {
        title: "某 IT 公司因无限责任条款赔偿 200 万",
        type: "反面案例",
        risk: "高",
        summary: "合同约定「乙方对甲方任何损失承担无限责任」，项目上线后甲方系统故障（非 IT 公司原因），甲方起诉索赔 200 万。",
        lesson: "无限责任条款是致命陷阱，必须改为「以合同总价为上限」",
        mba: "MBA 教训：风险管理的核心是「风险边界」，无限责任 = 无限风险"
      },
      {
        title: "验收标准模糊导致 50 万尾款无法收回",
        type: "反面案例",
        risk: "高",
        summary: "合同仅约定「甲方满意即验收」，项目交付后甲方以「不满意」为由拒付尾款 50 万，IT 公司无法举证。",
        lesson: "验收标准必须量化：功能清单 + 性能指标 + 验收流程",
        mba: "MBA 教训：「满意」是主观判断，商业合作需要客观标准"
      },
      {
        title: "通过合同拆分节省税负 8 万",
        type: "正面案例",
        risk: "低",
        summary: "某公司将「软件开发 + 硬件采购」拆分为两份合同，软件部分适用 6% 税率，硬件部分适用 13% 税率，合理降低税负。",
        lesson: "交易结构设计可以合法节税，但需要真实业务支撑",
        mba: "MBA 教训：税务筹划必须基于真实业务，虚假拆分=偷税"
      },
      {
        title: "里程碑付款拯救现金流",
        type: "正面案例",
        risk: "低",
        summary: "某外包项目原定「完工后 90 天付款」，改为「4 个里程碑各付 25%」后，现金流压力大幅缓解。",
        lesson: "付款条款谈判是「时间换空间」的艺术",
        mba: "MBA 教训：账期就是隐性成本，缩短账期 = 降低融资成本"
      },
      {
        title: "竞业限制纠纷损失 30 万",
        type: "反面案例",
        risk: "中",
        summary: "员工离职后加入竞争对手，公司起诉竞业限制违约，但因未支付竞业补偿金，法院判定竞业条款无效。",
        lesson: "竞业限制必须有对价（补偿金），否则可能无效",
        mba: "MBA 教训：权利义务对等是法律基本原则"
      },
      {
        title: "保密条款过宽导致业务受限",
        type: "反面案例",
        risk: "中",
        summary: "合同保密条款约定「不得从事同类业务」，范围过宽，导致 IT 公司后续无法承接类似项目。",
        lesson: "保密范围必须限定：特定项目 + 特定信息 + 特定期限",
        mba: "MBA 教训：条款范围过宽 = 自己给自己挖坑"
      }
    ];

    var caseCards = cases.map(function (c) {
      var typeCls = c.type === "反面案例" ? "red" : "green";
      var riskCls = c.risk === "高" ? "red" : c.risk === "中" ? "gold" : "plain";
      return '<div class="cr-case-card">' +
        '<div class="cr-case-header">' +
          '<h4>' + esc(c.title) + '</h4>' +
          '<span class="tag ' + typeCls + '">' + esc(c.type) + '</span>' +
        '</div>' +
        '<div class="cr-case-summary">' + esc(c.summary) + '</div>' +
        '<div class="cr-case-lesson">' +
          '<strong>📋 教训：</strong>' + esc(c.lesson) +
        '</div>' +
        '<div class="cr-case-mba">' +
          '<strong>🎓 MBA 视角：</strong>' + esc(c.mba) +
        '</div>' +
      '</div>';
    }).join("");

    contentHtml =
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📚 合同风险案例库</h4></div>' +
        '<p class="cr-intro">真实案例是最好的老师。以下是精选的 6 个典型案例，每个都包含「案例事实」→「教训总结」→「MBA 视角」三层解析：</p>' +
        '<div class="cr-case-grid">' + caseCards + '</div>' +
      '</div>' +
      /* 风险案例统计 */
      '<div class="fin-section">' +
        '<div class="fin-section-header"><h4>📊 风险案例统计</h4></div>' +
        '<div class="cr-case-stats">' +
          '<div class="cr-case-stat">' +
            '<div class="cr-case-stat-value">6</div>' +
            '<div class="cr-case-stat-label">案例总数</div>' +
          '</div>' +
          '<div class="cr-case-stat red">' +
            '<div class="cr-case-stat-value">4</div>' +
            '<div class="cr-case-stat-label">反面案例</div>' +
          '</div>' +
          '<div class="cr-case-stat green">' +
            '<div class="cr-case-stat-value">2</div>' +
            '<div class="cr-case-stat-label">正面案例</div>' +
          '</div>' +
          '<div class="cr-case-stat">' +
            '<div class="cr-case-stat-value">¥280万+</div>' +
            '<div class="cr-case-stat-label">潜在损失</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  el.innerHTML =
    vhead("contractrisk",
      "合同与商务风险中心：帮助 IT 人快速建立 MBA 级别的合同风险认知，从「能跑通」到「能赚钱且安全」。",
      ["风险认知框架 · 条款解剖 · 谈判工具 · 交易结构 · 案例库"]) +
    '<div class="ov-tabs">' + tabHtml + '</div>' +
    '<div class="fin-content">' + contentHtml + '</div>';
}

/* ------------------------------------------------------------ 流水粘贴：规则识别引擎 */
function matchCatRules(line) {
  var hits = [];
  (DB.cat_rules || []).forEach(function (r) {
    for (var i = 0; i < r.k.length; i++) {
      if (line.indexOf(r.k[i]) > -1) { hits.push(r); return; }
    }
  });
  return hits;
}
function parseFlow(line) {
  line = (line || "").trim();
  if (!line) return null;
  var rest = line, date = "", conf = 0.92, notes = [];

  var md = rest.match(/(\d{2,4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})日?/);   // YYYY-MM-DD / 2026年9月25日
  if (md) {
    var mo = +md[2], dy = +md[3];
    if (mo > 0 && mo < 13 && dy > 0 && dy < 32) date = (mo < 10 ? "0" : "") + mo + "-" + (dy < 10 ? "0" : "") + dy;
    rest = rest.replace(md[0], " ");
  } else {
    var md2 = rest.match(/(?:^|[\s])(\d{1,2})[-\/](\d{1,2})(?=$|[\s])/);   // 独立 MM-DD
    var m2 = md2 ? +md2[1] : 0, d2 = md2 ? +md2[2] : 0;
    if (m2 > 0 && m2 < 13 && d2 > 0 && d2 < 32) {
      date = (m2 < 10 ? "0" : "") + m2 + "-" + (d2 < 10 ? "0" : "") + d2;
      rest = rest.replace(md2[0], " ");
    } else { conf -= 0.10; notes.push("日期未识别"); }
  }

  var hits = matchCatRules(line);
  var inHit = /(收入|入账|汇入|转入|贷|回款|收款)/.test(line);
  var outHit = /(支出|付款|汇出|转出|借|缴纳|扣费|划扣|代扣)/.test(line);
  var type;
  if (inHit && !outHit) type = "收入";
  else if (outHit && !inHit) type = "支出";
  else if (inHit && outHit) { type = "支出"; conf -= 0.05; notes.push("收支关键词冲突，默认按支出"); }
  else if (hits.length) {                              // 关键词未明示：由科目规则推断方向
    type = hits[0].type; conf -= 0.15; notes.push("方向未明示，按科目规则「" + hits[0].cat + "」判定");
  } else {
    type = /(^|[\s¥￥])[-−]/.test(rest) ? "支出" : "收入";
    conf -= 0.15; notes.push("方向未明示，按符号弱推断");
  }

  var nums = rest.replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  var amount = parseFloat(nums[nums.length - 1]);
  if (!(amount > 0)) return null;

  var cat = "待归类", rate = "—";
  if (hits.length) {
    cat = hits[0].cat; rate = hits[0].rate;
    if (hits.length > 1 && hits[1].cat !== cat) { conf -= 0.10; notes.push("多规则命中，取第一条 " + hits.map(function (h) { return h.cat; }).join("/")); }
  } else {
    conf = Math.min(conf, 0.45); notes.push("无科目规则命中");
  }

  var party = "—";
  var toks = rest.split(/[\s|丨、，,]+/);
  for (var i = 0; i < toks.length; i++) {
    var tk = toks[i].replace(/[:：]/g, "");
    if (!tk || /^[\d.,¥￥-]+$/.test(tk)) continue;
    if (/收入|入账|汇入|转入|支出|付款|汇出|转出|缴纳|扣费|划扣|银联|网银|跨行/.test(tk)) continue;
    party = tk; break;
  }

  return {
    date: date, type: type, cat: cat, rate: rate, amount: amount,
    party: party, memo: line.length > 46 ? line.slice(0, 46) + "…" : line,
    conf: Math.round(conf * 100) / 100, notes: notes
  };
}
function ledgerRowFromDraft(d) {
  var ids = {}; DB.ledger.forEach(function (r) { ids[r.id] = 1; });
  var n = 1; while (ids["L-L" + n]) n++;
  var dd = new Date();
  var pad = function (x) { return x < 10 ? "0" + x : "" + x; };
  var row = {
    id: "L-L" + n,
    date: d.date || (pad(dd.getMonth() + 1) + "-" + pad(dd.getDate())),
    type: d.type, cat: d.cat, party: d.party, memo: d.memo,
    amount: d.amount, tax: 0, rate: d.rate, status: "已入账", ai: true, local: true
  };
  ledgerLocal.push(row);
  lsSet(LS.ledgerLocal, ledgerLocal);
  aiDone[row.id] = true;
  lsSet(LS.aiDone, aiDone);
  DB.ledger = baseLedger.concat(ledgerLocal);
  return row;
}
function exportLedgerCsv() {
  var rows = DB.ledger.slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });
  function cell(v) { v = String(v == null ? "" : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  var lines = [["日期", "类型", "科目", "往来方", "摘要", "金额（含税）", "税率", "状态"].join(",")];
  rows.forEach(function (r) {
    var amt = r.type === "收入" ? r.amount : -r.amount;
    lines.push([r.date, r.type, r.cat, r.party, r.memo, amt.toFixed(2), r.rate,
      (r.ai && !aiDone[r.id]) ? "AI 待确认" : "已入账"].map(cell).join(","));
  });
  var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  var now = new Date();
  a.download = "bcs-ledger-" + now.getFullYear() + "-" + (now.getMonth() + 1 < 10 ? "0" : "") + (now.getMonth() + 1) + ".csv";
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 200);
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

  /* 流水粘贴草稿 */
  var draftRows = drafts.map(function (d, i) {
    var auto = d.conf >= 0.80;
    return '<div class="ai-row">' +
      '<div class="body"><div class="t">流水粘贴 · 置信度 ' + fmt(d.conf * 100, 0) + "% " +
      (auto ? '<span class="tag gold">建议自动归类</span>' : '<span class="tag">强制人工确认</span>') + "</div>" +
      '<div class="d">原始：' + esc(d.memo) + "</div>" +
      '<div class="d">建议：<b style="color:var(--deck-gold)">' + d.type + " · " + esc(d.cat) + " " + yuan(d.amount, 2) +
      "（" + esc(d.rate) + "）→ " + esc(d.party) + "</b></div>" +
      (d.notes.length ? '<div class="d">提示：' + esc(d.notes.join("；")) + "</div>" : "") + "</div>" +
      '<div class="acts"><button class="btn gold" data-d-acc="' + i + '">采纳入账</button>' +
      '<button class="btn" data-d-skip="' + i + '">忽略</button></div></div>';
  }).join("");

  /* 台账表 */
  var rows = DB.ledger.slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); }).map(function (r) {
    var pending = r.ai && !aiDone[r.id];
    var amt = r.type === "收入" ? r.amount : -r.amount;
    return '<tr class="' + (pending ? "hl" : "") + '">' +
      '<td class="mono">' + esc(r.date) + "</td>" +
      '<td><span class="tag ' + (r.type === "收入" ? "" : "plain") + '">' + r.type + "</span></td>" +
      "<td>" + esc(r.cat) + "</td><td>" + esc(r.party) + "</td><td>" + esc(r.memo) + (r.local ? ' <span class="tag plain">本地</span>' : "") + "</td>" +
      '<td class="mono ' + clsNum(amt) + '" style="text-align:right">' + (amt > 0 ? "+" : "") + fmt(amt, 2) + "</td>" +
      '<td class="mono">' + esc(r.rate) + "</td>" +
      '<td>' + (pending ? '<span class="tag gold">AI 待确认</span>' : '<span class="tag plain">已入账</span>') + "</td></tr>";
  }).join("");

  var inSum = 0, outSum = 0;
  DB.ledger.forEach(function (r) { if (r.type === "收入") inSum += r.amount; else outSum += r.amount; });

  el.innerHTML =
    vhead("ledger",
      "银行流水、发票、邮件账单由 AI 识别为凭证草稿；<b>置信度低于 0.80 一律人工确认</b>，采纳后写入台账并留痕。也可直接粘贴网银流水，按科目规则本地识别。本月已入账 " + DB.ledger.filter(function (r) { return !r.ai || aiDone[r.id]; }).length + " 笔。",
      ["AI 识别引擎 v0.4", "科目规则 " + (DB.cat_rules || []).length + " 条 · 强制确认阈值 0.80", "采纳仅落本地，不回写网银"]) +
    '<div class="sim">' +
      '<div class="sim-head"><span class="t">AI 识别队列</span><span class="en">AI INBOX · HUMAN-IN-THE-LOOP</span>' +
      '<button class="reset" id="aiReset">重置队列</button></div>' +
      '<div style="padding:6px 18px 14px">' + aiRows + "</div>" +
      '<div class="sim-note">采纳 = 写入台账（本地留痕）；忽略 = 本条不再提示。原始凭证以网银 / 发票池为准。</div>' +
    "</div>" +
    '<div class="sim">' +
      '<div class="sim-head"><span class="t">流水粘贴识别</span><span class="en">FLOW PASTE · LOCAL RULE ENGINE</span></div>' +
      '<div style="padding:10px 18px 14px">' +
        '<textarea class="flow-in" id="flowIn" rows="3" spellcheck="false" placeholder="每行一条流水，例如：&#10;09-24 银联入账 53,000.00 湖南智造集团 二期尾款&#10;09-25 支付宝扣费 1,180.00 阿里云 域名与SSL续费"></textarea>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-top:8px">' +
          '<button class="btn gold" id="flowRun">识别草稿</button>' +
          '<span style="font-family:var(--mono);font-size:10px;color:var(--deck-ink-2)">纯本地解析，不回传任何数据；置信度 ≥80% 标注建议自动归类，采纳后写入下方台账并持久化于浏览器 localStorage。</span>' +
        "</div>" + draftRows +
      "</div>" +
    "</div>" +
    sec("01", DB.meta.period.split('（')[0] + '记账台账', "Ledger · " + DB.meta.period.split('（')[0]) +
    '<div class="tools"><button class="btn" id="csvBtn">导出 CSV</button>' +
      '<span class="count">收入 ' + yuan(inSum) + " · 支出 " + yuan(outSum) + " · 净额 " + yuan(inSum - outSum) + "</span></div>" +
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
    '<div class="callout red"><div class="c-t">临近征期</div>' + (function() { var due = DB.taxcal.filter(function(t) { return t.status !== "未开始"; }).sort(function(a, b) { return a.due < b.due ? -1 : 1; })[0]; var items = DB.taxcal.filter(function(t) { return t.due === due.due; }); var total = items.reduce(function(s, t) { return s + parseFloat(t.tax.replace(/[^0-9.]/g, '')) || 0; }, 0); return '<b>' + esc(due.due) + '</b>：' + items.map(function(t) { return esc(t.item) + '（预估 ' + esc(t.tax) + '）'; }).join('＋') + '。合计预估 ¥' + fmt(total, 0) + '。'; })() + '</div>' +
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
  var grpCnt = {};
  REGS_DB.forEach(function (r) { grpCnt[r.grp] = (grpCnt[r.grp] || 0) + 1; });
  var grps = ["全部"].concat(Object.keys(grpCnt).sort(function (a, b) { return grpCnt[b] - grpCnt[a]; }));

  el.innerHTML =
    vhead("regulations",
      "法规库两层呈现：<b>适用节选</b>为人工维护的在营业务相关条目（标注适用状态）；<b>全库目录</b>由 <span class=\"mono\">scripts/build-regs.mjs</span> 从 <b>better-call-saull-database/laws/</b> frontmatter 自动同步，另含港英美专题 96 篇（未纳入本表）。",
      ["全库 " + REGS_DB.length + " 部 · 同步于 " + REGS_DB_META.asOf, "适用节选 " + DB.regs.length + " 部", "知识库 make validate 校验 frontmatter"]) +
    sec("01", "适用节选", "Curated for Operations") +
    '<div class="tools"><div class="seg" id="regSeg">' +
      cats.map(function (c, i) { return '<button data-cat="' + esc(c) + '" class="' + (i === 0 ? "on" : "") + '">' + esc(c) + "</button>"; }).join("") +
      '</div><input class="finput" id="regQ" placeholder="搜索法规名称 / 发文机关"><span class="count" id="regCnt"></span></div>' +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>法规名称</th><th>类别</th><th>发文机关</th><th>施行日期</th><th>适用状态</th><th>库内路径</th></tr></thead><tbody id="regBody"></tbody></table></div>' +
    srcNote(DB.regs_src) +
    sec("02", "全库目录", "Full Library · auto-synced") +
    '<div class="tools"><div class="seg" id="reg2Seg">' +
      grps.map(function (c, i) { return '<button data-grp="' + esc(c) + '" class="' + (i === 0 ? "on" : "") + '">' + esc(c) + (c === "全部" ? " " + REGS_DB.length : " " + grpCnt[c]) + "</button>"; }).join("") +
      '</div><input class="finput" id="reg2Q" placeholder="搜索名称 / 发文机关 / 路径"><span class="count" id="reg2Cnt"></span></div>' +
    '<div class="table-scroll" style="max-height:420px;overflow:auto"><table class="dense"><thead><tr><th>法规名称</th><th>类别</th><th>发文机关</th><th>施行日期</th><th>状态</th><th>库内路径</th></tr></thead><tbody id="reg2Body"></tbody></table></div>' +
    srcNote("_src better-call-saull-database/laws/（法律法规 " + (REGS_DB.length - grpCnt["司法解释"]) + " 部 + 司法解释 " + (grpCnt["司法解释"] || 0) + " 件，frontmatter 自动同步）；生成日期 " + REGS_DB_META.asOf);

  function tagFor(r) {
    if (r.status.indexOf("有效") === 0) return '<span class="tag">有效</span>';
    if (r.status.indexOf("导读") >= 0) return '<span class="tag plain">深度导读版</span>';
    return '<span class="tag gold">' + esc(r.status) + "</span>";
  }
  function render() {
    var cat = "全部", q = "";
    function draw() {
      var rows = DB.regs.filter(function (r) {
        if (cat !== "全部" && r.cat !== cat) return false;
        if (q && (r.n + r.issuer).toLowerCase().indexOf(q.toLowerCase()) < 0) return false;
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
      cat = b.getAttribute("data-cat");
      $$("#regSeg button", el).forEach(function (x) { x.classList.toggle("on", x === b); });
      draw();
    });
    $("#regQ", el).addEventListener("input", function (e) { q = e.target.value; draw(); });
    draw();

    var g2 = "全部", q2 = "";
    function draw2() {
      var rows = REGS_DB.filter(function (r) {
        if (g2 !== "全部" && r.grp !== g2) return false;
        if (q2 && (r.t + r.issuer + r.src).toLowerCase().indexOf(q2.toLowerCase()) < 0) return false;
        return true;
      });
      $("#reg2Body", el).innerHTML = rows.map(function (r) {
        return "<tr><td><b>" + esc(r.t) + "</b></td><td>" + esc(r.grp) + "</td><td>" + esc(r.issuer) + '</td><td class="mono">' + esc(r.eff) + "</td>" +
          "<td>" + tagFor(r) + "</td>" +
          '<td class="mono" style="font-size:10px;color:var(--ink-3)">' + esc(r.src.replace("better-call-saull-database/", "")) + "</td></tr>";
      }).join("") || '<tr><td colspan="6" style="text-align:center;color:var(--ink-3);padding:18px">无匹配条目</td></tr>';
      $("#reg2Cnt", el).textContent = rows.length + " / " + REGS_DB.length + " 部";
    }
    $("#reg2Seg", el).addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      g2 = b.getAttribute("data-grp");
      $$("#reg2Seg button", el).forEach(function (x) { x.classList.toggle("on", x === b); });
      draw2();
    });
    $("#reg2Q", el).addEventListener("input", function (e) { q2 = e.target.value; draw2(); });
    draw2();
  }
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
      (function() { var first = null; DB.checklist.some(function(g) { return g.items.some(function(it, i) { var checked = cklState[g.domain + "|" + i] != null ? cklState[g.domain + "|" + i] : it.done; if (!checked) { first = { q: it.q.split('（')[0], ref: it.ref }; return true; } return false; }); }); return first ? '<div class="kpi"><div class="k">待办最高优先</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">' + esc(first.q) + '</div><div class="w">' + esc(first.ref) + '</div></div>' : '<div class="kpi"><div class="k">待办最高优先</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">全部完成</div><div class="w">—</div></div>'; })() +
      (function() { var sec = DB.checklist.filter(function(g) { return g.domain === "数据合规"; })[0]; if (!sec) return ''; var item = sec.items.filter(function(it, i) { return it.q.indexOf("等保") >= 0; })[0]; if (!item) return ''; var idx = sec.items.indexOf(item); var checked = cklState["数据合规|" + idx] != null ? cklState["数据合规|" + idx] : item.done; return '<div class="kpi"><div class="k">等保备案</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">' + (checked ? '已完成' : '未定级') + '</div><div class="w">' + esc(item.ref) + '</div></div>'; })() +
      (function() { var sec = DB.checklist.filter(function(g) { return g.domain === "劳动用工"; })[0]; if (!sec) return ''; var item = sec.items.filter(function(it, i) { return it.q.indexOf("社保") >= 0; })[0]; if (!item) return ''; var idx = sec.items.indexOf(item); var checked = cklState["劳动用工|" + idx] != null ? cklState["劳动用工|" + idx] : item.done; return '<div class="kpi"><div class="k">社保基数调整</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">' + (checked ? '已完成' : '待确认') + '</div><div class="w">联动预警 A-07</div></div>'; })() +
    "</div>" +
    '<div class="grid g2">' + groups + "</div>" +
    srcNote(DB.checklist_src);
}

/* ------------------------------------------------------------ 全局搜索 */
function buildIndex() {
  var idx = [];
  DB.contracts.forEach(function (c) { idx.push({ t: "合同", n: c.name + " · " + c.party, href: "#/contracts" }); });
  DB.regs.forEach(function (r) { idx.push({ t: "法规", n: r.n + " · " + r.issuer, href: "#/regulations" }); });
  REGS_DB.forEach(function (r) { idx.push({ t: "法规·库", n: r.t + " · " + r.grp, href: "#/regulations" }); });
  DB.ledger.forEach(function (r) { idx.push({ t: "台账", n: r.party + " · " + r.memo + " · " + yuan(r.amount), href: "#/ledger" }); });
  DB.alerts.forEach(function (a) { idx.push({ t: "预警", n: a.title, href: "#/alerts" }); });
  DB.taxcal.forEach(function (t) { idx.push({ t: "税种", n: t.item + " · " + t.due, href: "#/taxcal" }); });
  DB.mixing.findings.forEach(function (f) { idx.push({ t: "混同", n: f.item, href: "#/mixing" }); });
  DB.annual.forEach(function (a) { idx.push({ t: "年度", n: a.item + " · " + a.deadline, href: "#/annual" }); });
  DB.invoices.toIssue.concat(DB.invoices.toCollect).forEach(function (i) { idx.push({ t: "发票", n: i.party + " · " + i.item, href: "#/invoices" }); });
  DB.contractLifecycle.forEach(function (c) { idx.push({ t: "合同台账", n: c.name + " · " + c.party, href: "#/lifecycle" }); });
  DB.incentives.forEach(function (i) { idx.push({ t: "优惠", n: i.name, href: "#/incentives" }); });
  DB.resolutions.forEach(function (r) { idx.push({ t: "股东决定", n: r.item, href: "#/resolutions" }); });
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

/* ------------------------------------------------------------ 视图：公私混同防护（P0） */
function vMixing(el) {
  var m = DB.mixing;
  var ruleRows = m.rules.map(function (r) {
    var lc = r.level === "高" ? "red" : r.level === "中" ? "gold" : "plain";
    return "<tr><td class=\"mono\">" + esc(r.id) + "</td><td>" + esc(r.name) + "</td>" +
      '<td style="color:var(--deck-ink-2)">' + esc(r.rule) + "</td>" +
      '<td style="color:var(--deck-gold)">' + esc(r.hit) + '</td><td><span class="tag ' + lc + '">' + r.level + "</span></td></tr>";
  }).join("");
  var findRows = m.findings.map(function (f) {
    var lc = f.risk === "高" ? "red" : f.risk === "中" ? "gold" : "plain";
    return '<tr class="' + (f.risk === "高" ? "hl" : "") + '"><td class="mono">' + esc(f.date) + "</td>" +
      '<td><span class="tag plain">' + esc(f.type) + "</span></td><td>" + esc(f.item) + "</td>" +
      '<td><span class="tag ' + lc + '">' + f.risk + "</span></td>" +
      "<td>" + esc(f.fix) + '</td><td class="mono" style="font-size:10px;color:var(--ink-3)">' + esc(f.ref) + "</td></tr>";
  }).join("");
  el.innerHTML =
    vhead("mixing",
      "一人有限公司最大的雷：股东不能证明公司财产独立于自己财产的，对公司债务承担<b>连带责任</b>（公司法 §63，举证责任倒置）。本页用规则引擎扫台账与流水，把「公司户 ↔ 股东户」的每一笔异常往来摊开。",
      ["隔离健康度 " + m.score + "/100 · " + m.level, "股东账户：" + m.ownerAccount, "举证责任倒置：自证清白"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi dark"><div class="k">隔离健康度</div><div class="v">' + m.score + '<small> /100</small></div><div class="w">' + m.level + " · <60 即高风险</div></div>" +
      '<div class="kpi"><div class="k">高风险发现</div><div class="v">' + m.findings.filter(function (f) { return f.risk === "高"; }).length + '<small> 笔</small></div><div class="w">须本周内处理</div></div>' +
      '<div class="kpi"><div class="k">股东借款挂账</div><div class="v">' + fmt(DB.shareholder.loanBalance / 10000, 1) + '<small> 万元</small></div><div class="w">年度未还视同分红补 20%</div></div>' +
      '<div class="kpi"><div class="k">股东垫付未报</div><div class="v">' + fmt(DB.shareholder.paths.filter(function(p) { return p.path === "费用报销"; })[0].amount, 0) + '<small> 元</small></div><div class="w">走报销流程归还</div></div>' +
    "</div>" +
    '<div class="sim">' +
      '<div class="sim-head"><span class="t">公私隔离规则引擎</span><span class="en">SEPARATION RULE ENGINE</span></div>' +
      '<div style="padding:4px 18px 12px"><table class="dense"><thead><tr><th>规则</th><th>名称</th><th>扫描逻辑</th><th>当前命中</th><th>级别</th></tr></thead><tbody>' + ruleRows + "</tbody></table></div>" +
      '<div class="sim-note">深色 = 机器在算。命中即生成下方处置单；处置动作人工执行并留痕。</div>' +
    "</div>" +
    sec("01", "异常往来处置单", "Findings & Remediation") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>日期</th><th>类型</th><th>事项</th><th>风险</th><th>处置建议</th><th>依据</th></tr></thead><tbody>' + findRows + "</tbody></table></div>" +
    '<div class="callout red" style="margin-top:14px"><div class="c-t">红线</div>公司财产与股东财产混同，是公司被「刺破面纱」、股东对公司债务承担无限连带责任的首要事实依据。每一笔公司户与股东户之间的往来都必须有合同、发票或借款协议支撑。</div>' +
    srcNote(DB.mixing_src);
}

/* ------------------------------------------------------------ 视图：股东往来与拿钱路径（P0） */
function vShareholder(el) {
  var s = DB.shareholder;
  var pathRows = s.paths.map(function (p) {
    return '<tr class="' + (p.best ? "hl" : "") + '"><td><b>' + esc(p.path) + "</b>" + (p.best ? ' <span class="tag">推荐</span>' : "") + "</td>" +
      '<td class="mono" style="text-align:right">' + fmt(p.amount) + '</td><td class="mono">' + esc(p.period) + "</td>" +
      '<td class="mono">' + esc(p.tax) + "</td><td>" + esc(p.note) + "</td></tr>";
  }).join("");
  el.innerHTML =
    vhead("shareholder",
      "OPC 老板从公司拿钱只有三条合法路径：<b>工资、报销、分红</b>。直接转账 = 股东借款，年度终了未还且未用于经营 = 视同分红补 20% 个税 + 滞纳金。",
      ["股东借款挂账 " + yuan(s.loanBalance), "挂账始于 " + s.loanSince, "距年度终了 " + s.yearEndDays + " 天"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi dark"><div class="k">股东借款挂账</div><div class="v">' + fmt(s.loanBalance / 10000, 1) + '<small> 万元</small></div><div class="w">其他应收款-股东</div></div>' +
      '<div class="kpi"><div class="k">年度清零倒计时</div><div class="v">' + s.yearEndDays + '<small> 天</small></div><div class="w">12-31 前归还或转分红</div></div>' +
      '<div class="kpi"><div class="k">若视同分红补税</div><div class="v neg">' + fmt(s.loanBalance * 0.2 / 10000, 2) + '<small> 万元</small></div><div class="w">20% 股息红利 + 滞纳金</div></div>' +
      '<div class="kpi"><div class="k">当前月工资</div><div class="v">' + fmt(s.paths[0].amount, 0) + '<small> 元</small></div><div class="w">3%–10% 累进，可税前扣除</div></div>' +
    "</div>" +
    sec("01", "四条拿钱路径对比", "Withdrawal Paths") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>路径</th><th style="text-align:right">当前金额</th><th>周期</th><th>税负</th><th>说明</th></tr></thead><tbody>' + pathRows + "</tbody></table></div>" +
    '<div class="callout" style="margin-top:14px"><div class="c-t">处置建议</div>股东借款 ¥20,000 须在 <b>2026-12-31</b> 前：① 归还公司户；或 ② 转为正式分红（补 20% 个税 ¥4,000）；或 ③ 补签借款合同并约定利率与归还日（不超过一年）。逾期不还且未用于经营，税务机关有权视同分红追缴。</div>' +
    srcNote(DB.shareholder_src);
}

/* ------------------------------------------------------------ 视图：年度合规节点（P0） */
function vAnnual(el) {
  var rows = DB.annual.map(function (a) {
    var lc = a.level === "高" ? "red" : a.level === "中" ? "gold" : "plain";
    return '<tr><td class="mono">' + esc(a.deadline) + "</td><td><b>" + esc(a.item) + "</b>" +
      (a.id === "Y-01" ? ' <span class="tag red">OPC 特有</span>' : "") + "</td>" +
      '<td class="mono">' + esc(a.period) + '</td><td><span class="tag ' + lc + '">' + a.level + "</span></td>" +
      '<td><span class="tag plain">' + esc(a.status) + "</span></td>" +
      "<td>" + esc(a.note) + '</td><td class="mono" style="font-size:10px;color:var(--ink-3)">' + esc(a.ref) + "</td></tr>";
  }).join("");
  el.innerHTML =
    vhead("annual",
      "月度申报之外，OPC 最容易漏的是<b>年度动作</b>。其中「一人有限公司年度审计」是公司法 §62 规定的<b>强制义务</b>，很多 OPC 老板不知道，漏做即违法。",
      ["年度节点引擎", "强制审计为一人公司特有", "漏报工商年报进经营异常名录"]) +
    '<div class="callout red"><div class="c-t">OPC 特有义务</div><b>公司法 §62</b>：一人有限责任公司应当在每一会计年度终了时编制财务会计报告，并经会计师事务所审计。这是普通有限公司没有的强制义务，目的是以第三方审计佐证财产独立（呼应 §63 举证责任倒置）。</div>' +
    sec("01", "年度节点表", "Annual Compliance Calendar") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>截止日</th><th>事项</th><th>所属期</th><th>级别</th><th>状态</th><th>说明</th><th>依据</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
    srcNote(DB.annual_src);
}

/* ------------------------------------------------------------ 视图：发票全生命周期（P1） */
function vInvoices(el) {
  var inv = DB.invoices;
  var oRows = inv.toIssue.map(function (i) {
    return "<tr><td class=\"mono\">" + esc(i.id) + "</td><td>" + esc(i.party) + "</td><td>" + esc(i.item) + "</td>" +
      '<td class="mono" style="text-align:right">' + fmt(i.amount) + '</td><td class="mono" style="text-align:right">' + fmt(i.tax) + "</td>" +
      '<td class="mono">' + esc(i.due) + '</td><td><span class="tag gold">' + esc(i.status) + "</span></td></tr>";
  }).join("");
  var iRows = inv.toCollect.map(function (i) {
    return "<tr><td class=\"mono\">" + esc(i.id) + "</td><td>" + esc(i.party) + "</td><td>" + esc(i.item) + "</td>" +
      '<td class="mono" style="text-align:right">' + fmt(i.amount) + '</td><td class="mono" style="text-align:right">' + (i.tax ? fmt(i.tax) : "—") + "</td>" +
      '<td class="mono">' + esc(i.due) + '</td><td><span class="tag ' + (i.status === "换开中" ? "red" : "gold") + '">' + esc(i.status) + "</span></td>" +
      "<td>" + esc(i.note || "") + "</td></tr>";
  }).join("");
  el.innerHTML =
    vhead("invoices",
      "发票是 OPC 最耗时间的事：客户催开、供应商催不来、进项票丢了。本页把「待开票 / 待收票」两条队列摊开，并跟踪合同-发票-流水的三单匹配率。",
      ["三单匹配率 " + pct(inv.matchRate, 0), "开票系统 + 发票池 + 合同台账勾稽"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi dark"><div class="k">三单匹配率</div><div class="v">' + pct(inv.matchRate, 0) + '</div><div class="w">合同 ↔ 发票 ↔ 流水</div></div>' +
      '<div class="kpi"><div class="k">待开票</div><div class="v">' + inv.toIssue.length + '<small> 笔</small></div><div class="w">合计 ' + yuan(inv.toIssue.reduce(function (s, i) { return s + i.amount; }, 0)) + '</div></div>' +
      '<div class="kpi"><div class="k">待收票</div><div class="v">' + inv.toCollect.length + '<small> 笔</small></div><div class="w">影响进项抵扣 ' + yuan(inv.toCollect.reduce(function (s, i) { return s + i.tax; }, 0)) + '</div></div>' +
      '<div class="kpi"><div class="k">进项票缺口</div><div class="v neg">' + fmt(inv.toCollect.reduce(function (s, i) { return s + i.tax; }, 0), 0) + '<small> 元</small></div><div class="w">未取得专票的抵扣损失</div></div>' +
    "</div>" +
    sec("01", "待开票（销项）", "To Issue") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>编号</th><th>往来方</th><th>事项</th><th style="text-align:right">金额</th><th style="text-align:right">税额</th><th>期限</th><th>状态</th></tr></thead><tbody>' + oRows + "</tbody></table></div>" +
    sec("02", "待收票（进项）", "To Collect") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>编号</th><th>往来方</th><th>事项</th><th style="text-align:right">金额</th><th style="text-align:right">可抵税额</th><th>期限</th><th>状态</th><th>备注</th></tr></thead><tbody>' + iRows + "</tbody></table></div>" +
    srcNote(DB.invoices_src);
}

/* ------------------------------------------------------------ 视图：合同全生命周期（P1） */
function vLifecycle(el) {
  var rows = DB.contractLifecycle.map(function (c) {
    var lc = c.status === "临期" ? "red" : c.status === "审查中" ? "gold" : "plain";
    var invP = c.amount ? c.invoiced / c.amount : 0, recP = c.amount ? c.received / c.amount : 0;
    return '<tr class="' + (c.status === "临期" ? "hl" : "") + '"><td class="mono">' + esc(c.id) + "</td>" +
      "<td><b>" + esc(c.name) + '</b><div class="note">' + esc(c.party) + "</div></td>" +
      '<td class="mono" style="text-align:right">' + (c.amount ? fmt(c.amount) : "—") + "</td>" +
      '<td class="mono">' + esc(c.end) + "</td>" +
      "<td>" + esc(c.nextNode) + '<div class="note mono">' + esc(c.nodeDate) + "</div></td>" +
      '<td><div class="track" title="已开票 ' + pct(invP, 0) + '"><i style="width:' + (invP * 100).toFixed(0) + '%"></i></div><div class="note mono">' + pct(invP, 0) + " 已开</div></td>" +
      '<td><div class="track" title="已收款 ' + pct(recP, 0) + '"><i style="width:' + (recP * 100).toFixed(0) + '%" class="' + (recP < invP ? "warn" : "") + '"></i></div><div class="note mono">' + pct(recP, 0) + " 已收</div></td>" +
      '<td><span class="tag ' + lc + '">' + esc(c.status) + "</span></td></tr>";
  }).join("");
  el.innerHTML =
    vhead("lifecycle",
      "合同管理不是签完就归档：到期没人提醒、续签错过窗口、开了票没收款。本页把每份合同的<b>下一节点、开票进度、收款进度</b>摊开，临期合同置顶。",
      ["到期提醒：提前 30/60 天", "开票/收款双轨勾稽"]) +
    sec("01", "合同台账", "Contract Register") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>编号</th><th>合同 / 往来方</th><th style="text-align:right">金额</th><th>到期日</th><th>下一节点</th><th>开票进度</th><th>收款进度</th><th>状态</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
    '<div class="callout red" style="margin-top:14px"><div class="c-t">临期</div><b>办公场地租赁合同</b> 2026-09-30 到期，续签窗口剩 6 天。错过窗口将面临无固定期限租赁或被迫搬迁，且注册地址变更牵连工商、税务、银行一串变更。</div>' +
    srcNote(DB.contractLifecycle_src);
}

/* ------------------------------------------------------------ 视图：社保公积金健全性（P1） */
function vSocial(el) {
  var s = DB.social;
  var rows = s.issues.map(function (i) {
    var lc = i.level === "高" ? "red" : i.level === "中" ? "gold" : "plain";
    return '<tr class="' + (i.level === "高" ? "hl" : "") + '"><td><b>' + esc(i.item) + "</b></td>" +
      "<td>" + esc(i.finding) + '</td><td><span class="tag ' + lc + '">' + i.level + "</span></td>" +
      "<td>" + esc(i.fix) + '</td><td class="mono" style="font-size:10px;color:var(--ink-3)">' + esc(i.ref) + "</td></tr>";
  }).join("");
  el.innerHTML =
    vhead("social",
      "OPC 高发雷区：老板忘了自己也是「员工」—— 不签劳动合同、按最低基数交社保。本页把社保公积金申报数据与工资台账比对，揪出基数倒挂与漏签。",
      ["在册 " + s.headcount + " 人", "申报数据 vs 工资台账比对"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi dark"><div class="k">高风险项</div><div class="v">' + s.issues.filter(function (i) { return i.level === "高"; }).length + '<small> 项</small></div><div class="w">须本月内整改</div></div>' +
      '<div class="kpi"><div class="k">在册人数</div><div class="v">' + s.headcount + '<small> 人</small></div><div class="w">含老板本人</div></div>' +
      '<div class="kpi"><div class="k">老板劳动合同</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">未签署</div><div class="w">OPC 最高发疏漏</div></div>' +
      '<div class="kpi"><div class="k">基数倒挂</div><div class="v">2<small> 人</small></div><div class="w">基数低于实际工资 30%</div></div>' +
    "</div>" +
    sec("01", "健全性核查", "Social Security Audit") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>核查项</th><th>发现</th><th>级别</th><th>整改建议</th><th>依据</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
    srcNote(DB.social_src);
}

/* ------------------------------------------------------------ 视图：税收优惠雷达（P2） */
function vIncentives(el) {
  var rows = DB.incentives.map(function (i) {
    var fc = i.fit === "高" ? "" : i.fit === "中" ? "gold" : "plain";
    var sc = i.status === "已适用" ? "" : i.status === "待评估" || i.status === "待排查" || i.status === "待规划" ? "gold" : "plain";
    return "<tr><td><b>" + esc(i.name) + "</b></td>" +
      '<td><span class="tag ' + fc + '">匹配 ' + i.fit + "</span></td>" +
      '<td class="mono">' + esc(i.saving) + "</td><td>" + esc(i.cond) + "</td>" +
      '<td><span class="tag ' + sc + '">' + esc(i.status) + '</span></td>' +
      '<td class="mono" style="font-size:10px;color:var(--ink-3)">' + esc(i.ref) + "</td></tr>";
  }).join("");
  el.innerHTML =
    vhead("incentives",
      "OPC 通常不知道自己能享受什么优惠。优惠雷达按企业画像（营收 / 行业 / 人数 / 资质）主动匹配适用政策，并预估节税额。",
      ["优惠雷达引擎 v0.1", "按企业画像匹配", "预估节税额供决策参考"]) +
    sec("01", "适用优惠匹配", "Matched Incentives") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>优惠</th><th>匹配度</th><th>预估节税</th><th>适用条件</th><th>状态</th><th>依据</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
    '<div class="callout" style="margin-top:14px"><div class="c-t">建议</div><b>研发费用加计扣除</b> 值得评估：自研数据合规平台的投入若可归集为研发费，按 100% 加计扣除，预估年节税 ¥12,000。需建立研发项目台账与费用归集口径。</div>' +
    srcNote(DB.incentives_src);
}

/* ------------------------------------------------------------ 视图：股东决定留痕（P2） */
function vResolutions(el) {
  var rows = DB.resolutions.map(function (r) {
    var sc = r.status === "待签署" ? "red" : r.status === "待评估" ? "gold" : "plain";
    return '<tr class="' + (r.status === "待签署" ? "hl" : "") + '"><td class="mono">' + esc(r.id) + "</td>" +
      "<td><b>" + esc(r.item) + "</b>" + (r.note ? '<div class="note">' + esc(r.note) + "</div>" : "") + "</td>" +
      '<td><span class="tag plain">' + esc(r.type) + '</span></td><td class="mono">' + esc(r.date) + "</td>" +
      '<td><span class="tag ' + sc + '">' + esc(r.status) + "</span></td></tr>";
  }).join("");
  el.innerHTML =
    vhead("resolutions",
      "OPC 没有股东会，但重大事项（增资、对外担保、利润分配）仍须书面《股东决定》才有效。这是关键时刻举证「程序合法」的唯一凭证。",
      ["股东决定模板库 + 签署台账", "替代股东会决议", "程序合法性举证"]) +
    '<div class="callout red"><div class="c-t">待签署</div><b>对外提供担保 ¥100,000</b> 尚未签署股东决定。公司法 §16：公司对外担保须由股东（会）决定，一人公司即由唯一股东书面决定；未经决定，担保对公司不发生效力，且可能构成越权。</div>' +
    sec("01", "决定台账", "Resolution Register") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>编号</th><th>事项</th><th>类型</th><th>签署日</th><th>状态</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
    srcNote(DB.resolutions_src);
}

/* ------------------------------------------------------------ 视图：注销 readiness（P2） */
function vExit(el) {
  var e = DB.exit;
  var rows = e.blockers.map(function (b) {
    var lc = b.level === "高" ? "red" : b.level === "中" ? "gold" : "plain";
    return '<tr class="' + (b.level === "高" ? "hl" : "") + '"><td><b>' + esc(b.item) + "</b></td>" +
      '<td class="mono">' + esc(b.status) + '</td><td><span class="tag ' + lc + '">' + b.level + "</span></td>" +
      "<td>" + esc(b.note) + "</td></tr>";
  }).join("");
  el.innerHTML =
    vhead("exit",
      "OPC 的终点要么是注销，要么是转让。提前知道要清什么，能省半年。本页检查注销 readiness，列出所有阻断项。",
      ["注销 readiness " + pct(e.readiness, 0), "简易注销 20 天公示口径"]) +
    '<div class="kpi-strip">' +
      '<div class="kpi dark"><div class="k">注销 readiness</div><div class="v">' + pct(e.readiness, 0) + '</div><div class="w">距可简易注销尚远</div></div>' +
      '<div class="kpi"><div class="k">高阻断项</div><div class="v">' + e.blockers.filter(function (b) { return b.level === "高"; }).length + '<small> 项</small></div><div class="w">未结诉讼 + 股东往来</div></div>' +
      '<div class="kpi"><div class="k">欠税</div><div class="v pos">无</div><div class="w">当前无欠税记录</div></div>' +
      '<div class="kpi"><div class="k">路径</div><div class="v" style="font-size:15px;line-height:1.5;padding-top:7px">简易注销</div><div class="w">20 天公示（暂不满足）</div></div>' +
    "</div>" +
    sec("01", "阻断项清单", "Blockers") +
    '<div class="table-scroll"><table class="dense"><thead><tr><th>检查项</th><th>状态</th><th>级别</th><th>说明</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
    '<div class="callout" style="margin-top:14px"><div class="c-t">路径判断</div>' + esc(e.path) + "</div>" +
    srcNote(DB.exit_src);
}

/* ------------------------------------------------------------ 渲染与事件 */
var RENDER = {
  overview: vOverview, finance: vFinance, legal: vLegal, datacenter: vDataCenter, contractrisk: vContractRisk,
  ledger: vLedger, cashflow: vCashflow, arap: vArap, budget: vBudget,
  taxcal: vTaxcal, taxburden: vTaxburden, contracts: vContracts, regulations: vRegulations,
  alerts: vAlerts, checklist: vChecklist,
  mixing: vMixing, shareholder: vShareholder, annual: vAnnual,
  invoices: vInvoices, lifecycle: vLifecycle, social: vSocial,
  incentives: vIncentives, resolutions: vResolutions, exit: vExit
};
function render() {
  var v = currentRoute();
  syncRoute(v);
  VIEWS.forEach(function (x) { $("#v-" + x).style.display = x === v ? "" : "none"; });
  RENDER[v]($("#v-" + v));
  window.scrollTo(0, 0);
}

/* 事件委托：AI 采纳 / 忽略 / 重置，流水粘贴草稿，台账导出与打印，预警闭环，清单勾选 */
document.addEventListener("click", function (e) {
  var t = e.target;
  var g = function (a) { return t.getAttribute && t.getAttribute(a); };
  var acc = g("data-ai-accept"), skp = g("data-ai-skip"), cls = g("data-alert-close");
  var dacc = g("data-d-acc"), dskp = g("data-d-skip");
  if (acc) {
    var q = DB.aiQueue.filter(function (x) { return x.id === acc; })[0];
    if (q) { aiDone[q.ledgerId] = true; lsSet(LS.aiDone, aiDone); render(); }
  } else if (skp) {
    aiSkip[skp] = true; lsSet(LS.aiSkip, aiSkip); render();
  } else if (t.id === "aiReset") {
    aiDone = {}; aiSkip = {}; drafts = []; ledgerLocal = [];
    DB.ledger = baseLedger.slice();
    lsSet(LS.aiDone, aiDone); lsSet(LS.aiSkip, aiSkip); lsSet(LS.ledgerLocal, ledgerLocal); render();
  } else if (t.id === "flowRun") {
    var ta = $("#flowIn");
    var added = 0;
    if (ta) ta.value.split(/\r?\n/).forEach(function (ln) { var d = parseFlow(ln); if (d) { drafts.push(d); added++; } });
    if (ta && added) ta.value = "";
    render();
  } else if (dacc !== null) {
    var di = +dacc;
    if (drafts[di]) { ledgerRowFromDraft(drafts[di]); drafts.splice(di, 1); render(); }
  } else if (dskp !== null) {
    drafts.splice(+dskp, 1); render();
  } else if (t.id === "csvBtn") {
    exportLedgerCsv();
  } else if (t.id === "printBtn") {
    window.print();
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
var regCnt = $("#navRegCnt"); if (regCnt && typeof REGS_DB !== "undefined") regCnt.textContent = String(REGS_DB.length);

window.addEventListener("hashchange", render);
bindSearch();
tick(); setInterval(tick, 1000);
render();
})();
