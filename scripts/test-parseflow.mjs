import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname;
const app = readFileSync(root + "app.js", "utf8");
const data = readFileSync(root + "data.js", "utf8");

/* 抽取纯解析函数（matchCatRules + parseFlow），不触碰 DOM */
const start = app.indexOf("function matchCatRules");
const end = app.indexOf("function ledgerRowFromDraft");
if (start < 0 || end < 0 || end <= start) { console.error("extract failed"); process.exit(1); }
const src = app.slice(start, end);

const ctx = vm.createContext({ console });
vm.runInContext(data, ctx);
vm.runInContext(src, ctx);
vm.runInContext("var __t = parseFlow;", ctx); // sanity

const cases = [
  // [line, expect]
  ["09-24 银联入账 53,000.00 湖南智造集团 二期尾款", { type: "收入", cat: "技术服务费", amount: 53000, date: "09-24", auto: true }],
  ["09-25 支付宝扣费 1,180.00 阿里云 域名与SSL续费", { type: "支出", cat: "云服务", amount: 1180, auto: true }],
  ["2026年09月25日 代发工资 62,400 招商银行", { type: "支出", cat: "工资社保", amount: 62400, date: "09-25", auto: false }], // 方向未明示，按规则判支出，conf 降级人工确认
  ["付款 9月房租 15,000.00 汇金国际物业", { type: "支出", cat: "房租", amount: 15000, auto: false }],       // 「物业」误命中第二规则 → 多规则降级
  ["跨行转入 8,800.00 某某科技 尾款", { type: "收入", cat: "技术服务费", amount: 8800, auto: true }],
  ["转账 500.00 张三", { type: "收入", cat: "待归类", conf: 0.45, auto: false }],
  ["09-26 -3,428.50 差旅报销 员工", { type: "支出", cat: "差旅", amount: 3428.5, auto: false }], // 方向未明示 → 0.92-0.15=0.77 <0.80
  ["垃圾行 无数字", null],
  ["", null],
];

let fail = 0;
for (const [line, exp] of cases) {
  const d = ctx.parseFlow(line);
  if (!exp) {
    if (d !== null) { fail++; console.log("REJECT-FAIL", JSON.stringify(line), d); }
    else console.log("reject  ok  ", line || "(empty)");
    continue;
  }
  if (!d) { fail++; console.log("NULL   ", line); continue; }
  const auto = d.conf >= 0.80;
  const bad = [];
  if (exp.type && d.type !== exp.type) bad.push(`type=${d.type} want=${exp.type}`);
  if (exp.cat && d.cat !== exp.cat) bad.push(`cat=${d.cat} want=${exp.cat}`);
  if (exp.amount != null && Math.abs(d.amount - exp.amount) > 0.001) bad.push(`amt=${d.amount} want=${exp.amount}`);
  if (exp.date && d.date !== exp.date) bad.push(`date=${d.date} want=${exp.date}`);
  if (exp.conf != null && Math.abs(d.conf - exp.conf) > 0.001) bad.push(`conf=${d.conf} want=${exp.conf}`);
  if (exp.auto != null && auto !== exp.auto) bad.push(`auto=${auto} want=${exp.auto}`);
  if (bad.length) { fail++; console.log("MISMATCH", line, "→", bad.join(" | "), "conf=" + d.conf); }
  else console.log("parse  ok  ", line, `→ ${d.type}/${d.cat}/${d.amount}/${d.party} conf=${d.conf}${auto ? " (自动)" : " (人工确认)"}`);
}
console.log(fail ? `\n${fail} case(s) failed` : "\nall parse cases pass");
process.exit(fail ? 1 : 0);
