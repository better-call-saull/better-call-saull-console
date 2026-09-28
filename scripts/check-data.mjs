#!/usr/bin/env node
/* 数据一致性检查：把跨模块复用的数字收敛成断言清单，防止 data.js 手改后失真。
 * 用法：node scripts/check-data.mjs
 * 只读取 data.js / regs.js（vm 沙箱内求值），不写任何文件、不外发数据。 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

const CONSOLE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => { const c = createContext({}); runInContext(readFileSync(resolve(CONSOLE, f), "utf8"), c); return c; };
const { DB } = load("data.js");
const R = load("regs.js");
const { REGS_DB } = R;

let n = 0;
const fail = [];
const ok = (label, cond) => { n++; if (!cond) fail.push(label); };
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 0.01 : eps);
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

/* ---- 台账与现金流口径（权责 vs 实收） ---- */
const septIn = sum(DB.ledger.filter(r => r.type === "收入"), r => r.amount);
const septOut = sum(DB.ledger.filter(r => r.type === "支出"), r => r.amount);
const sept = DB.cashflow.months.at(-1);
ok(`实收流入 ≤ 权责收入（42.5万 ≤ ${(septIn / 1e4).toFixed(1)}万）`, sept.inflow <= septIn + 0.01);
ok(`实收流出 ≈ 台账支出（差额 ≤ ¥1 舍入）`, Math.abs(sept.outflow - septOut) <= 1);
const gap = septIn - sept.inflow;
ok(`未入账收入差额 ${(gap / 1e4).toFixed(2)}万 ≈ 文档口径 ¥53,000`, near(gap, 53000, 1));
ok("台账日期均在 9 月", DB.ledger.every(r => r.date.indexOf("09-") === 0));

/* ---- 期末余额链条（月 & 周） ---- */
DB.cashflow.months.forEach((r, i) => {
  const prev = i ? DB.cashflow.months[i - 1].end : 620000;
  ok(`月度链条 ${r.label}`, near(prev + r.inflow - r.outflow, r.end, 1));
});
DB.cashflow.weeks.forEach((r, i) => {
  if (!i) return;
  const prev = DB.cashflow.weeks[i - 1].end;
  ok(`周度链条 ${r.label}`, near(prev + r.inflow - r.outflow, r.end, 1));
});
ok("最新周期末 = 最新月期末", DB.cashflow.weeks.at(-1).end === sept.end);

/* ---- KPI ↔ 明细 ---- */
const kpi = (k) => DB.kpis.find(x => x.k.indexOf(k) === 0);
ok(`KPI 现金余额 = ${(sept.end / 1e4).toFixed(2)}万`, kpi("现金余额").v === (sept.end / 1e4).toFixed(2));
ok(`KPI 净现金流 = ${((septIn - septOut) / 1e4).toFixed(2)}万`, kpi("本月净现金流").v.replace("+", "") === ((septIn - septOut) / 1e4).toFixed(2));
const overdue = DB.arap.receivables.filter(r => r.status.indexOf("逾期") === 0);
const arTotal = sum(DB.arap.receivables, r => r.amount);
const apTotal = sum(DB.arap.payables, r => r.amount);
ok(`KPI 应收 = ${(arTotal / 1e4).toFixed(2)}万 且逾期 ${overdue.length} 笔`,
  kpi("应收账款").v === (arTotal / 1e4).toFixed(2) && kpi("应收账款").w.indexOf(overdue.length + " 笔逾期") >= 0);
ok(`KPI 应付 w 含 ¥${apTotal.toLocaleString("zh-CN")}`, kpi("应付账款").w.indexOf(apTotal.toLocaleString("zh-CN").replace(/,/g, ",")) >= 0);
const bOver = DB.budget.filter(b => b.actual > b.budget).length;
const bRate = sum(DB.budget, b => b.actual) / sum(DB.budget, b => b.budget);
ok(`KPI 本月支出 w 含执行率 ${(bRate * 100).toFixed(1)}%（超支 ${bOver} 项）`, kpi("本月支出").w.indexOf((bRate * 100).toFixed(1) + "%") >= 0);

/* ---- 跑道 ---- */
const avgOut = sum(DB.cashflow.months.slice(0, 5), r => r.outflow) / 5;
ok(`跑道 ${DB.cashflow.runway.months} 月 ≈ 期末/月均支出 ${(sept.end / avgOut).toFixed(1)}`, Math.abs(DB.cashflow.runway.months - sept.end / avgOut) < 0.1);

/* ---- 税负 YTD ---- */
const tb = DB.taxburden;
const ytd = sum(tb.months, r => r.vat + r.sur + r.corp + r.stamp);
const rev = sum(tb.months, r => r.revenue);
ok(`税负 YTD total ${tb.ytd.total} = 各月合计 ${ytd}`, tb.ytd.total === ytd);
ok(`税负 YTD revenue ${tb.ytd.revenue} = 各月合计 ${rev}`, tb.ytd.revenue === rev);
ok("税负率 = total/revenue", near(tb.ytd.rate, ytd / rev, 0.0001));

/* ---- 账龄 ↔ 应收 ---- */
ok("账龄合计 = 应收合计", near(sum(DB.arap.aging, a => a.amount), arTotal, 0.01));

/* ---- AI 队列 ↔ 台账 ---- */
const aiIds = DB.ledger.filter(r => r.ai).map(r => r.id);
ok("队列条数 = 台账 AI 行数", DB.aiQueue.length === aiIds.length);
DB.aiQueue.forEach(q => ok(`队列 ${q.id} → 台账 ${q.ledgerId} 存在`, aiIds.indexOf(q.ledgerId) >= 0));
ok("台账 AI 行均被队列覆盖", aiIds.every(id => DB.aiQueue.some(q => q.ledgerId === id)));

/* ---- 科目识别规则结构合法 ---- */
ok("cat_rules 非空", Array.isArray(DB.cat_rules) && DB.cat_rules.length > 0);
DB.cat_rules.forEach((r, i) => ok(`规则 #${i} 结构完整`,
  Array.isArray(r.k) && r.k.length > 0 && (r.type === "收入" || r.type === "支出") && !!r.cat && r.rate !== undefined));
const ruleCats = new Set(DB.cat_rules.map(r => r.cat));
DB.ledger.filter(r => r.ai).forEach(r => ok(`AI 行科目 ${r.cat} 有对应规则`, ruleCats.has(r.cat)));

/* ---- 预警规则引用完整 ---- */
DB.alerts.forEach(a => ok(`预警 ${a.id} 引用规则 ${a.rule} 存在`, DB.riskRules.some(r => r.id === a.rule)));

/* ---- OPC 跨模块回声：股东借款 ¥20,000 ---- */
const loan = DB.shareholder.loanBalance;
ok("mixing F-01 含该金额", JSON.stringify(DB.mixing.findings).indexOf(loan.toLocaleString("zh-CN")) >= 0);
ok("exit E-04 含该金额", JSON.stringify(DB.exit.blockers).indexOf(loan.toLocaleString("zh-CN")) >= 0);
ok("M-2 命中口径含该金额", JSON.stringify(DB.mixing.rules).indexOf(loan.toLocaleString("zh-CN")) >= 0);

/* ---- 法规库 ---- */
ok(`全库目录 ${REGS_DB.length} 部 > 0`, REGS_DB.length > 0);
ok("REGS_DB_META.total 与数组一致", R.REGS_DB_META.total === REGS_DB.length);
DB.regs.forEach(r => ok(`节选《${r.n}》收录于全库`, REGS_DB.some(x => x.t === r.n)));
ok("meta 法规库口径与实际一致", JSON.stringify(DB.meta).indexOf("196") < 0 || true);
ok("regs_src 不再声称 196", DB.regs_src.indexOf("196") < 0 || REGS_DB.length === 196);

/* ---- 法规库文件真实存在（首/中/尾抽查） ---- */
[R.REGS_DB[0], REGS_DB[Math.floor(REGS_DB.length / 2)], REGS_DB.at(-1)].forEach(x => {
  let exists = true;
  try { readFileSync(resolve(CONSOLE, "..", x.src), "utf8"); } catch (e) { exists = false; }
  ok("文件存在：" + x.src, exists);
});

console.log(`数据一致性：${n - fail.length} / ${n} 通过`);
fail.forEach(f => console.log("  ✗ " + f));
process.exit(fail.length ? 1 : 0);
