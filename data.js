/* ============================================================================
 * Better Call Saull 财税法工作台，数据快照
 * 只读快照：全部数字带 _src 溯源；真实业务系统为权威，本文件仅为演示口径。
 * 法规条目 _src 指向 better-call-saull-database/laws/ 库内真实文件（全量目录由 scripts/build-regs.mjs 同步）。
 * ============================================================================ */
var DB = {

meta: {
  asOf: "2026-09-24",
  anchor: "核心定位：守底线 · 保安全",
  company: {
    name: "Better Call Saull 咨询（长沙）有限公司",
    short: "BCS 咨询",
    identity: "增值税一般纳税人",
    standard: "小企业会计准则",
    period: "2026-09（第 1—24 日）",
    bank: "招商银行 · 长沙分行（基本户）"
  },
  _src: "口径：权责发生制；金额单位人民币元；税额为演示估算，以主管税务机关口径为准"
},

/* ---- 总览 KPI（kpi-strip 八格，v dark 为最重要一格） ---- */
kpis: [
  { k: "现金余额", v: "83.59", unit: "万元", w: "截至 09-24，招行基本户", dark: true },
  { k: "本月净现金流", v: "+35.67", unit: "万元", w: "收入 47.79 万 − 支出 12.12 万" },
  { k: "应收账款", v: "24.12", unit: "万元", w: "6 笔，3 笔逾期（1 笔超 90 天）" },
  { k: "应付账款", v: "3.35", unit: "万元", w: "5 笔合计 ¥33,480，最近到期 09-28" },
  { k: "本月支出", v: "12.12", unit: "万元", w: "月度预算执行 101.2%（已超支）" },
  { k: "实际税负率", v: "3.53", unit: "%", w: "年初至 9 月累计口径" },
  { k: "合规风险指数", v: "18", unit: "/100", w: "低风险区间（<30）" },
  { k: "待审合同", v: "2", unit: "份", w: "1 份不通过，1 份有条件通过" }
],
kpis_src: "_src 银行对账单 + 记账台账（本页「自动记账」）+ 合同台账",

/* ---- 记账台账（2026-09） ---- */
ledger: [
  { id: "L-0902-01", date: "09-02", type: "收入", cat: "技术服务费", party: "湖南智造集团", memo: "数据合规平台年费（一期 50%）", amount: 106000, tax: 6000, rate: "6%", status: "已入账", ai: false },
  { id: "L-0905-01", date: "09-05", type: "收入", cat: "咨询费", party: "广州绿洲环保", memo: "排污许可合规咨询（Q3）", amount: 53000, tax: 3000, rate: "6%", status: "已入账", ai: false },
  { id: "L-0908-01", date: "09-08", type: "收入", cat: "顾问年费", party: "深圳云途科技", memo: "数据合规常年顾问（2026）", amount: 212000, tax: 12000, rate: "6%", status: "已入账", ai: false },
  { id: "L-0912-01", date: "09-12", type: "收入", cat: "培训费", party: "长沙高新孵化器", memo: "企业数据合规内训 2 场", amount: 15900, tax: 900, rate: "6%", status: "已入账", ai: false },
  { id: "L-0918-01", date: "09-18", type: "收入", cat: "服务分成", party: "上海星衡律所", memo: "合同审查服务合作分成", amount: 31800, tax: 1800, rate: "6%", status: "已入账", ai: false },
  { id: "L-0917-01", date: "09-17", type: "收入", cat: "违约金", party: "广州绿洲环保", memo: "逾期付款违约金（合同 §7.2）", amount: 5000, tax: 0, rate: "—", status: "已入账", ai: false },
  { id: "L-0922-01", date: "09-22", type: "收入", cat: "利息收入", party: "招商银行", memo: "活期利息（Q3 部分计提）", amount: 1246.8, tax: 0, rate: "—", status: "已入账", ai: false },
  { id: "L-0901-01", date: "09-01", type: "支出", cat: "房租", party: "汇金国际物业", memo: "办公室租金（9 月）", amount: 15000, tax: 714, rate: "9%", status: "已入账", ai: false },
  { id: "L-0905-02", date: "09-05", type: "支出", cat: "工资社保", party: "发薪（6 人）", memo: "9 月工资发放", amount: 62400, tax: 0, rate: "—", status: "已入账", ai: false },
  { id: "L-0906-01", date: "09-06", type: "支出", cat: "云服务", party: "阿里云", memo: "8 月云资源账单", amount: 3860, tax: 219, rate: "6%", status: "已入账", ai: false },
  { id: "L-0908-02", date: "09-08", type: "支出", cat: "专业服务", party: "星衡律所", memo: "劳动仲裁案协作费", amount: 8000, tax: 453, rate: "6%", status: "已入账", ai: false },
  { id: "L-0910-01", date: "09-10", type: "支出", cat: "软件订阅", party: "字节跳动（飞书）", memo: "企业版年费分摊", amount: 2400, tax: 136, rate: "6%", status: "已入账", ai: false },
  { id: "L-0911-01", date: "09-11", type: "支出", cat: "差旅", party: "员工报销", memo: "广州客户现场（高铁+住宿）", amount: 3428.5, tax: 0, rate: "—", status: "已入账", ai: false },
  { id: "L-0913-01", date: "09-13", type: "支出", cat: "市场推广", party: "小红书", memo: "信息流投放（9 月上半月）", amount: 5000, tax: 283, rate: "6%", status: "已入账", ai: false },
  { id: "L-0915-01", date: "09-15", type: "支出", cat: "办公耗材", party: "京东企业购", memo: "打印耗材与文具", amount: 620, tax: 35, rate: "13%", status: "已入账", ai: false },
  { id: "L-0916-01", date: "09-16", type: "支出", cat: "外包服务", party: "白鹿设计工作室", memo: "官网 UI 视觉稿", amount: 6000, tax: 340, rate: "6%", status: "已入账", ai: false },
  { id: "L-0919-01", date: "09-19", type: "支出", cat: "水电物业", party: "汇金国际物业", memo: "9 月水电与物业费", amount: 1380, tax: 0, rate: "—", status: "已入账", ai: false },
  { id: "L-0921-01", date: "09-21", type: "支出", cat: "工资社保", party: "社保公积金", memo: "单位部分缴纳（6 人）", amount: 9680, tax: 0, rate: "—", status: "已入账", ai: false },
  { id: "L-0923-01", date: "09-23", type: "支出", cat: "云服务", party: "阿里云", memo: "域名与 SSL 证书续费", amount: 1180, tax: 67, rate: "6%", status: "AI 待确认", ai: true },
  { id: "L-0924-01", date: "09-24", type: "支出", cat: "业务招待", party: "微信支付", memo: "客户答谢餐费", amount: 2160, tax: 0, rate: "—", status: "AI 待确认", ai: true },
  { id: "L-0924-02", date: "09-24", type: "收入", cat: "技术服务费", party: "湖南智造集团", memo: "二期尾款 50%", amount: 53000, tax: 3000, rate: "6%", status: "AI 待确认", ai: true },
  { id: "L-0924-03", date: "09-24", type: "支出", cat: "办公耗材", party: "顺丰速运", memo: "合同文件寄送", amount: 96, tax: 0, rate: "—", status: "AI 待确认", ai: true }
],
ledger_src: "_src 招行流水（网银导出）+ 增值税发票池 + AI 识别队列（下方）",

/* ---- 自动记账：AI 识别队列（采纳入账后写 localStorage） ---- */
aiQueue: [
  { id: "Q-01", srcType: "银行流水", src: "招商银行对账单 09-24「银联入账 53,000.00 湖南智造集团」",
    suggest: "收入 · 技术服务费 50,000.00 ＋ 销项税额 3,000.00（6%）→ 智造集团 二期尾款", conf: 0.94, ledgerId: "L-0924-02" },
  { id: "Q-02", srcType: "邮件账单", src: "阿里云账单邮件「域名与 SSL 续费 ¥1,180.00」",
    suggest: "支出 · 云服务与软件 1,113.21 ＋ 进项税额 66.79 → 阿里云", conf: 0.88, ledgerId: "L-0923-01" },
  { id: "Q-03", srcType: "支付平台", src: "微信支付商户平台「客户答谢餐费 ¥2,160」",
    suggest: "支出 · 业务招待费 2,160.00（注意：招待费税前扣除限额 60% 且不超过营收 5‰）", conf: 0.71, ledgerId: "L-0924-01" },
  { id: "Q-04", srcType: "支付平台", src: "顺丰速运企业月结「合同文件寄送 ¥96」",
    suggest: "支出 · 办公与耗材 96.00 → 顺丰速运（小额，建议直接采纳）", conf: 0.97, ledgerId: "L-0924-03" }
],
aiQueue_src: "_src AI 识别引擎 v0.3，置信度 <0.80 强制人工确认；采纳后写入台账并留痕",

/* ---- 自动记账：科目识别规则（流水粘贴引擎用，关键词命中即建议科目与税率） ---- */
cat_rules: [
  { k: ["咨询费", "顾问费", "顾问", "服务费", "项目款", "尾款", "年费", "分成", "培训"], type: "收入", cat: "技术服务费", rate: "6%" },
  { k: ["利息", "结息", "派息"], type: "收入", cat: "利息收入", rate: "—" },
  { k: ["退税", "补贴", "补助"], type: "收入", cat: "营业外收入", rate: "—" },
  { k: ["违约金", "赔偿", "滞纳金收入"], type: "收入", cat: "违约金", rate: "—" },
  { k: ["工资", "薪酬", "代发"], type: "支出", cat: "工资社保", rate: "—" },
  { k: ["社保", "公积金"], type: "支出", cat: "工资社保", rate: "—" },
  { k: ["房租", "租金"], type: "支出", cat: "房租", rate: "9%" },
  { k: ["物业", "水电"], type: "支出", cat: "水电物业", rate: "—" },
  { k: ["阿里云", "腾讯云", "华为云", "AWS", "云服务", "服务器", "域名", "SSL"], type: "支出", cat: "云服务", rate: "6%" },
  { k: ["飞书", "订阅", "SaaS", "软件"], type: "支出", cat: "软件订阅", rate: "6%" },
  { k: ["办公用品", "耗材", "文具", "打印"], type: "支出", cat: "办公耗材", rate: "13%" },
  { k: ["税款", "增值税", "个税", "所得税", "附加"], type: "支出", cat: "税费缴纳", rate: "—" },
  { k: ["差旅", "机票", "高铁", "火车票", "酒店"], type: "支出", cat: "差旅", rate: "—" },
  { k: ["招待", "餐费", "餐饮"], type: "支出", cat: "业务招待", rate: "—" },
  { k: ["罚款", "滞纳金"], type: "支出", cat: "营业外支出", rate: "—" }
],
cat_rules_src: "_src 手工维护的科目映射规则，命中关键词即给出科目与参考税率；规则之外一律「待归类」并强制人工确认",

/* ---- 现金流 ---- */
cashflow: {
  months: [
    { m: "2026-04", label: "4月", inflow: 218000, outflow: 246800, end: 591200 },
    { m: "2026-05", label: "5月", inflow: 172500, outflow: 189300, end: 574400 },
    { m: "2026-06", label: "6月", inflow: 268000, outflow: 261500, end: 580900 },
    { m: "2026-07", label: "7月", inflow: 159000, outflow: 214800, end: 525100 },
    { m: "2026-08", label: "8月", inflow: 246000, outflow: 238900, end: 532200 },
    { m: "2026-09", label: "9月①", inflow: 424947, outflow: 121205, end: 835942, note: "实收口径，不含 AI 待确认 53,000" }
  ],
  weeks: [
    { wk: "W28", label: "07/12", inflow: 38500, outflow: 52100, end: 525100 },
    { wk: "W29", label: "07/19", inflow: 21200, outflow: 48600, end: 497700 },
    { wk: "W30", label: "07/26", inflow: 64300, outflow: 42300, end: 519700 },
    { wk: "W31", label: "08/02", inflow: 18900, outflow: 61200, end: 477400 },
    { wk: "W32", label: "08/09", inflow: 72800, outflow: 45900, end: 504300 },
    { wk: "W33", label: "08/16", inflow: 45600, outflow: 52300, end: 497600 },
    { wk: "W34", label: "08/23", inflow: 63200, outflow: 44100, end: 516700 },
    { wk: "W35", label: "08/30", inflow: 27400, outflow: 51500, end: 492600 },
    { wk: "W36", label: "09/06", inflow: 58900, outflow: 74300, end: 477200 },
    { wk: "W37", label: "09/13", inflow: 223100, outflow: 41200, end: 659100 },
    { wk: "W38", label: "09/20", inflow: 96800, outflow: 38600, end: 717300 },
    { wk: "W39", label: "09/24", inflow: 142147, outflow: 23505, end: 835942 }
  ],
  runway: { months: 3.6, note: "按近 5 个月月均支出 ¥23.0 万估算（不含新增收入的保守口径）" }
},
cashflow_src: "_src 招行基本户流水逐笔归集；期初 2026-04-01 余额 ¥620,000；9 月为实收口径（不含 AI 待确认 ¥53,000），与权责口径台账相差即待确认项",

/* ---- 应收应付 ---- */
arap: {
  receivables: [
    { id: "AR-2026-014", party: "湖南智造集团", item: "二期尾款 50%", amount: 53000, due: "2026-09-30", status: "未到期" },
    { id: "AR-2026-011", party: "深圳云途科技", item: "顾问年费分期（Q4）", amount: 106000, due: "2026-10-15", status: "未到期" },
    { id: "AR-2026-013", party: "上海星衡律所", item: "9 月服务分成", amount: 31800, due: "2026-10-05", status: "未到期" },
    { id: "AR-2026-012", party: "长沙高新孵化器", item: "培训费", amount: 15900, due: "2026-09-15", status: "逾期 9 天" },
    { id: "AR-2025-031", party: "某制造业客户（脱敏）", item: "2025 项目尾款", amount: 8000, due: "2026-06-30", status: "逾期 86 天" },
    { id: "AR-2026-009", party: "广州绿洲环保", item: "Q2 咨询尾款", amount: 26500, due: "2026-06-15", status: "逾期 101 天" }
  ],
  payables: [
    { id: "AP-2026-093", party: "汇金国际物业", item: "10 月租金", amount: 15000, due: "2026-09-28", status: "临近" },
    { id: "AP-2026-088", party: "阿里云", item: "9 月云资源预估", amount: 3860, due: "2026-10-10", status: "未到期" },
    { id: "AP-2026-091", party: "白鹿设计工作室", item: "外包设计二期", amount: 6000, due: "2026-10-15", status: "未到期" },
    { id: "AP-2026-095", party: "星衡律所", item: "劳动仲裁协作费", amount: 8000, due: "2026-10-20", status: "未到期" },
    { id: "AP-2026-097", party: "京东企业购", item: "办公耗材月结", amount: 620, due: "2026-10-05", status: "未到期" }
  ],
  aging: [
    { band: "未到期", amount: 190800, n: 3 },
    { band: "逾期 1–30 天", amount: 15900, n: 1 },
    { band: "逾期 31–90 天", amount: 8000, n: 1 },
    { band: "逾期 90 天以上", amount: 26500, n: 1 }
  ]
},
arap_src: "_src 开票系统 + 合同台账 + 银行流水核销记录",

/* ---- 预算与成本（2026-09 月度） ---- */
budget: [
  { cat: "人力（工资+社保）", budget: 75000, actual: 72080, note: "工资 62,400 + 社保公积金 9,680" },
  { cat: "房租物业", budget: 16500, actual: 16380, note: "租金 15,000 + 水电物业 1,380" },
  { cat: "云服务与软件", budget: 7000, actual: 7440, note: "阿里云 3,860 + 1,180（AI）+ 飞书 2,400" },
  { cat: "专业服务（律师等）", budget: 5000, actual: 8000, note: "劳动仲裁案超支 60%" },
  { cat: "市场推广", budget: 6000, actual: 5000, note: "小红书信息流" },
  { cat: "外包服务", budget: 4000, actual: 6000, note: "官网 UI 视觉稿" },
  { cat: "差旅", budget: 4000, actual: 3428.5, note: "广州客户现场" },
  { cat: "办公与耗材", budget: 800, actual: 716, note: "耗材 620 + 快递 96（AI）" },
  { cat: "业务招待", budget: 1500, actual: 2160, note: "答谢餐费 2,160（AI 待确认，超预算 44%）" }
],
budget_src: "_src 记账台账按科目归集；预算为 2026 年度预算月度分摊",

/* ---- 税务：征期日历 ---- */
taxcal: [
  { due: "2026-09-28", item: "房产租金发票开具（代开）", tax: "增值税 675", period: "9 月", status: "待办" },
  { due: "2026-10-15", item: "增值税及附加税费申报（一般纳税人）", tax: "预估 13,597", period: "9 月", status: "待申报" },
  { due: "2026-10-15", item: "个人所得税扣缴申报（工资薪金）", tax: "预估 1,860", period: "9 月", status: "待申报" },
  { due: "2026-10-15", item: "企业所得税季度预缴（Q3）", tax: "预估 19,200", period: "Q3", status: "待申报" },
  { due: "2026-10-20", item: "印花税按季申报（买卖/服务合同）", tax: "预估 242", period: "Q3", status: "待申报" },
  { due: "2026-11-15", item: "增值税及附加税费申报", tax: "—", period: "10 月", status: "未开始" },
  { due: "2026-12-31", item: "残保金申报（按年）", tax: "预估 3,200", period: "2026 年度", status: "未开始" }
],
taxcal_src: "_src 电子税局征期日历口径；具体日期以主管税务机关征期公告顺延为准",

/* ---- 税务：税负分析（月度） ---- */
taxburden: {
  months: [
    { m: "4月", revenue: 306000, vat: 7420, sur: 890, corp: 0, stamp: 153 },
    { m: "5月", revenue: 238000, vat: 6120, sur: 734, corp: 0, stamp: 119 },
    { m: "6月", revenue: 352000, vat: 8940, sur: 1073, corp: 12480, stamp: 176 },
    { m: "7月", revenue: 205000, vat: 5310, sur: 637, corp: 0, stamp: 102 },
    { m: "8月", revenue: 291000, vat: 7280, sur: 874, corp: 0, stamp: 145 },
    { m: "9月", revenue: 485000, vat: 12140, sur: 1457, corp: 0, stamp: 242 }
  ],
  ytd: { revenue: 1877000, total: 66292, rate: 0.0353 }
},
taxburden_src: "_src 电子税局申报回执汇总；附加税费按增值税 12%（城建 7%+教育 3%+地方教育 2%）；企业所得税 Q2 预缴 12,480",

/* ---- 法务：合同审查（AI） ---- */
contracts: [
  {
    id: "C-2026-031", name: "数据合规服务框架合同", party: "华东制造集团", amount: "¥480,000 / 年",
    date: "2026-09-20 收到文本", stage: "审查中",
    verdict: "有条件通过", verdictLevel: "warn",
    summary: "整体框架可用，3 处条款须修改后方可签署：无限连带责任、知识产权归属范围、90 天账期。",
    clauses: [
      { clause: "§4.2 付款条款", level: "中", finding: "验收后 90 日付款，且未约定验收期限与逾期利息上限", fix: "改 45 日；验收期 15 日届满视为通过；逾期日息万分之五、以未付本金为限" },
      { clause: "§8.1 责任条款", level: "高", finding: "乙方对间接损失承担无限连带责任", fix: "改为：责任以合同总价为上限，排除间接损失与利润损失；连带责任删除" },
      { clause: "§9.3 知识产权", level: "高", finding: "交付成果知识产权全部归甲方，含乙方预置组件与方法论模板", fix: "区分：交付物归甲方；预置组件以许可方式授权；方法论模板乙方保留" },
      { clause: "§12.2 争议解决", level: "低", finding: "甲方所在地法院管辖", fix: "改被告所在地或约定长沙仲裁委员会" }
    ]
  },
  {
    id: "C-2026-034", name: "外包开发协议（官网二期）", party: "白鹿设计工作室", amount: "¥60,000",
    date: "2026-09-22 收到文本", stage: "审查中",
    verdict: "不通过", verdictLevel: "bad",
    summary: "2 处硬伤：交付无验收标准、源码与开源许可未约定。修改前禁止签署。",
    clauses: [
      { clause: "§3.1 交付与验收", level: "高", finding: "无验收标准与期限，以「甲方满意」为准", fix: "列明交付物清单 + 客观验收标准；15 日验收期，逾期视为通过" },
      { clause: "§5.2 源码与许可", level: "高", finding: "未约定源码交付与第三方开源组件许可（GPL 传染风险）", fix: "约定源码随验收交付；开源组件清单附表；禁止 GPL 类组件进入闭源交付物" },
      { clause: "§4.1 付款节点", level: "中", finding: "预付 60% 倒挂（行业惯例 30%）", fix: "改 30% / 40% / 30%（预付 / 验收 / 质保期满）" }
    ]
  },
  {
    id: "C-2026-033", name: "办公场地租赁合同（续签）", party: "汇金国际", amount: "¥15,000 / 月",
    date: "2026-09-10", stage: "已通过",
    verdict: "通过", verdictLevel: "ok",
    summary: "标准文本，2 处建议：免租期与物业费调价机制书面化。",
    clauses: [
      { clause: "§2.3 免租期", level: "低", finding: "口头承诺 15 天免租未写入文本", fix: "补充书面条款并加盖骑缝章" },
      { clause: "§6.2 物业费", level: "低", finding: "「物业费随市场调整」无上限", fix: "约定年度涨幅 ≤5%" }
    ]
  },
  {
    id: "C-2026-030", name: "保密协议 NDA（双向）", party: "深圳云途科技", amount: "—",
    date: "2026-08-28 归档", stage: "已归档",
    verdict: "通过", verdictLevel: "ok",
    summary: "双向保密、期限 3 年、违约金对等，无修改意见。",
    clauses: []
  }
],
contracts_src: "_src 合同审查引擎 v0.5（条款抽取 + 风险规则库 42 条）；最终判断以执业律师意见为准",

/* ---- 法务：法规库适用节选（全量目录见 regs.js，由 scripts/build-regs.mjs 从 better-call-saull-database 同步） ---- */
regs: [
  { n: "网络数据安全管理条例", cat: "数据合规", issuer: "国务院", eff: "2025-01-01", tag: "在营业务直接适用", src: "better-call-saull-database/laws/网络数据安全管理条例.md" },
  { n: "数据出境安全评估办法", cat: "数据合规", issuer: "国家网信办", eff: "2022-09-01", tag: "当前无出境场景（豁免）", src: "better-call-saull-database/laws/数据出境安全评估办法.md" },
  { n: "个人信息出境标准合同办法", cat: "数据合规", issuer: "国家网信办", eff: "2023-06-01", tag: "备用模板已入库", src: "better-call-saull-database/laws/个人信息出境标准合同办法.md" },
  { n: "生成式人工智能服务管理暂行办法", cat: "数据合规", issuer: "国家网信办 等七部门", eff: "2023-08-15", tag: "AI 服务上线前适用", src: "better-call-saull-database/laws/生成式人工智能服务管理暂行办法.md" },
  { n: "网络安全审查办法", cat: "数据合规", issuer: "国家网信办 等十三部门", eff: "2022-02-15", tag: "赴港上市触发条款关注", src: "better-call-saull-database/laws/网络安全审查办法.md" },
  { n: "关键信息基础设施安全保护条例", cat: "数据合规", issuer: "国务院", eff: "2021-09-01", tag: "非 CII 运营者（豁免）", src: "better-call-saull-database/laws/关键信息基础设施安全保护条例.md" },
  { n: "互联网信息服务算法推荐管理规定", cat: "数据合规", issuer: "国家网信办 等", eff: "2022-03-01", tag: "无推荐算法（豁免）", src: "better-call-saull-database/laws/互联网信息服务算法推荐管理规定.md" },
  { n: "电信条例", cat: "网络电信", issuer: "国务院", eff: "2000-09-25", tag: "增值电信业务许可关注", src: "better-call-saull-database/laws/电信条例.md" },
  { n: "互联网信息服务深度合成管理规定", cat: "网络电信", issuer: "国家网信办 等", eff: "2023-01-10", tag: "AIGC 标识义务", src: "better-call-saull-database/laws/互联网信息服务深度合成管理规定.md" },
  { n: "网络产品安全漏洞管理规定", cat: "网络电信", issuer: "工信部 等", eff: "2021-09-01", tag: "漏洞 2 日报送义务", src: "better-call-saull-database/laws/网络产品安全漏洞管理规定.md" },
  { n: "计算机信息系统安全保护条例", cat: "网络电信", issuer: "国务院", eff: "1994-02-18", tag: "等保定级依据", src: "better-call-saull-database/laws/计算机信息系统安全保护条例.md" },
  { n: "工伤保险条例", cat: "劳动社保", issuer: "国务院", eff: "2004-01-01", tag: "全员参保核查中", src: "better-call-saull-database/laws/工伤保险条例.md" },
  { n: "失业保险条例", cat: "劳动社保", issuer: "国务院", eff: "1999-01-22", tag: "全员参保", src: "better-call-saull-database/laws/失业保险条例.md" },
  { n: "女职工劳动保护特别规定", cat: "劳动社保", issuer: "国务院", eff: "2012-04-28", tag: "用工制度已纳入", src: "better-call-saull-database/laws/女职工劳动保护特别规定.md" },
  { n: "计算机软件保护条例", cat: "知识产权", issuer: "国务院", eff: "2002-01-01", tag: "自研软著登记 2 项", src: "better-call-saull-database/laws/计算机软件保护条例.md" }
],
regs_src: "_src better-call-saull-database/laws/，本表为与在营业务相关的适用节选并标注适用状态；全量目录由 scripts/build-regs.mjs 自动同步生成 regs.js",

/* ---- 守底线：风险预警（AI 规则引擎） ---- */
riskRules: [
  { id: "R-01", name: "合同无限责任扫描", rule: "条款含「无限 / 连带 / 兜底」且状态为审查中", hit: "C-2026-031 §8.1", level: "高" },
  { id: "R-02", name: "应收逾期红线", rule: "逾期 > 90 天 → 高；> 30 天 → 中", hit: "AR-2026-009（101 天）· AR-2025-031（86 天）", level: "高" },
  { id: "R-03", name: "现金跑道警戒", rule: "支出口径跑道 < 6 个月", hit: "当前 3.6 个月", level: "中" },
  { id: "R-04", name: "征期临近", rule: "申报截止 ≤ 30 天未申报", hit: "10-15 三税连报（剩 21 天）", level: "中" },
  { id: "R-05", name: "合同硬伤拦截", rule: "审查结论「不通过」的合同进入签署流程", hit: "C-2026-034", level: "中" },
  { id: "R-06", name: "进项票缺失", rule: "单笔支出 > ¥3,000 且无进项发票", hit: "阿里云 8 月账单", level: "中" },
  { id: "R-07", name: "个税专项附加扣除", rule: "年度确认窗口开启未确认", hit: "2 名员工待确认", level: "低" }
],
alerts: [
  { id: "A-01", sev: "高", domain: "法", title: "C-2026-031 含无限连带责任条款，修改前禁止签署", detail: "§8.1 乙方对间接损失承担无限连带责任；已附修改建议（以合同总价为上限）。", rule: "R-01", status: "处理中" },
  { id: "A-02", sev: "高", domain: "财", title: "AR-2026-009 逾期 101 天（¥26,500），超 90 天红线", detail: "广州绿洲环保 Q2 咨询尾款；建议：发律师函并暂停服务，同步计提坏账准备。", rule: "R-02", status: "待处理" },
  { id: "A-03", sev: "中", domain: "财", title: "现金跑道 3.6 个月，低于 6 个月警戒线", detail: "月均支出 ¥23.0 万（近 5 个月）；9 月回款改善后回升至 3.6 个月，仍需关注 11 月续费集中期。", rule: "R-03", status: "待处理" },
  { id: "A-04", sev: "中", domain: "税", title: "10-15 征期临近：增值税 + 个税 + 企业所得税预缴", detail: "预估合计应纳 ¥34,657；企业所得税 Q3 预估 ¥19,200（小微优惠口径）。", rule: "R-04", status: "待处理" },
  { id: "A-05", sev: "中", domain: "法", title: "C-2026-034 审查不通过，硬伤未闭环", detail: "交付无验收标准、源码与开源许可未约定；供应商已收到修改清单待回复。", rule: "R-05", status: "待处理" },
  { id: "A-06", sev: "中", domain: "财", title: "阿里云 8 月账单（¥3,860）未取得增值税专用发票", detail: "影响当期进项抵扣约 ¥219；已在电子税局与供应商后台发起换开。", rule: "R-06", status: "待处理" },
  { id: "A-07", sev: "低", domain: "税", title: "个税专项附加扣除：2 名员工待 2026 年度确认", detail: "扣除信息年度确认窗口已开启；未确认不影响扣除，但建议在 12 月前完成。", rule: "R-07", status: "已忽略" }
],
alerts_src: "_src 风险规则引擎 v0.3 每日评估（规则表见上方深舱）；处置动作人工执行并留痕",

/* ---- 守底线：合规检查清单 ---- */
checklist: [
  {
    domain: "工商主体",
    items: [
      { q: "营业执照经营范围覆盖「数据处理、商务咨询」", ref: "公司登记管理条例", done: true },
      { q: "银行基本户 + 税务三方协议已签订", ref: "税收征管法 §17", done: true },
      { q: "注册地址与实际经营地一致（挂靠风险排查）", ref: "市场监管总局口径", done: false },
      { q: "章程修订与股权结构无代持", ref: "公司法 §32", done: false }
    ]
  },
  {
    domain: "税务合规",
    items: [
      { q: "一般纳税人资格登记与税种核定", ref: "增值税暂行条例", done: true },
      { q: "开票品类与经营范围匹配", ref: "发票管理办法 §21", done: true },
      { q: "进项发票按月勾选认证", ref: "增值税暂行条例 §25", done: true },
      { q: "企业所得税小微企业优惠适用", ref: "财税〔2023〕12 号", done: true },
      { q: "违约金收入增值税处理口径确认", ref: "财税〔2016〕36 号", done: false }
    ]
  },
  {
    domain: "劳动用工",
    items: [
      { q: "劳动合同全员书面签署（6/6）", ref: "劳动合同法 §10", done: true },
      { q: "社保公积金基数年度调整（对应预警 A-07）", ref: "社会保险法", done: false },
      { q: "核心岗位保密与竞业限制协议", ref: "劳动合同法 §23–24", done: false },
      { q: "规章制度经民主程序并公示", ref: "劳动合同法 §4", done: true }
    ]
  },
  {
    domain: "数据合规",
    items: [
      { q: "隐私政策与用户协议已上线", ref: "个人信息保护法 §17", done: true },
      { q: "数据分类分级清单建立", ref: "网络数据安全管理条例", done: false },
      { q: "数据出境场景评估（当前无出境，豁免留痕）", ref: "数据出境安全评估办法", done: true },
      { q: "等保二级定级备案", ref: "网络安全法 §21", done: false }
    ]
  },
  {
    domain: "知识产权",
    items: [
      { q: "商标注册（第 9/35/42 类）", ref: "商标法", done: true },
      { q: "软件著作权登记（2 项）", ref: "计算机软件保护条例", done: true },
      { q: "开源组件使用合规清单", ref: "GPL/Apache 许可义务", done: false },
      { q: "员工职务作品归属约定", ref: "著作权法 §18", done: true }
    ]
  }
],
checklist_src: "_src 合规自查框架 v0.4；ref 指向 better-call-saull-database 法规库条目或法规条款",

/* ---- P0-1 公私财产混同防护（OPC 头号法律风险，公司法 §63 连带责任） ---- */
mixing: {
  score: 72, /* 隔离健康度 0-100，越高越安全；<60 高风险 */
  level: "中风险",
  ownerAccount: "股东个人账户（微信/招行尾号 8866）",
  rules: [
    { id: "M-1", name: "疑似个人消费", rule: "公司账户支付餐饮/家庭地址快递/个人会员", hit: "2 笔", level: "中" },
    { id: "M-2", name: "公司→股东转账", rule: "公司账户直接向股东本人转账且未挂借款", hit: "1 笔 ¥20,000", level: "高" },
    { id: "M-3", name: "股东→公司垫付", rule: "股东个人账户代付公司费用未报销", hit: "3 笔 ¥4,820", level: "中" },
    { id: "M-4", name: "微信收货款", rule: "经营收入进入个人微信/支付宝", hit: "0 笔", level: "低" }
  ],
  findings: [
    { id: "F-01", date: "09-14", type: "公司→股东", item: "公司户转股东本人 ¥20,000，摘要「备用金」", risk: "高", fix: "补签《股东借款合同》并约定利率与归还日；年度终了未还视同分红补 20% 个税", ref: "公司法 §63 · 财税〔2003〕158 号" },
    { id: "F-02", date: "09-11", type: "疑似个人消费", item: "公司卡支付「山姆会员店」¥1,280", risk: "中", fix: "认定为个人消费则进项转出 + 补个税；建议改由个人卡支付并归还公司", ref: "增值税暂行条例 §10" },
    { id: "F-03", date: "09-06", type: "股东垫付", item: "股东个人微信代付阿里云 ¥3,860 未报销", risk: "中", fix: "走费用报销流程，公司户归还股东并附发票；避免长期挂账", ref: "企业所得税法 §8" },
    { id: "F-04", date: "09-19", type: "股东垫付", item: "股东个人卡支付高铁票 ¥553 未报销", risk: "低", fix: "同上，纳入 9 月报销", ref: "企业所得税法 §8" },
    { id: "F-05", date: "09-02", type: "疑似个人消费", item: "公司卡支付「爱奇艺年卡」¥248", risk: "中", fix: "与经营无关，进项转出；改个人支付", ref: "增值税暂行条例 §10" }
  ]
},
mixing_src: "_src 公私隔离规则引擎 v0.1（4 条规则扫台账/流水）；公司法 §63 一人公司财产独立举证责任倒置",

/* ---- P0-2 股东往来款与拿钱路径 ---- */
shareholder: {
  loanBalance: 20000, /* 其他应收款-股东 挂账余额 */
  loanSince: "2026-09-14",
  yearEndDays: 98, /* 距年度终了（12-31）天数，asOf 09-24 */
  paths: [
    { path: "工资薪金", amount: 10400, period: "月", tax: "3%–10% 累进", note: "当前口径；可全额税前扣除", best: true },
    { path: "费用报销", amount: 4820, period: "9 月", tax: "0（凭票实报）", note: "垫付未报部分，尽快走流程", best: true },
    { path: "股东借款", amount: 20000, period: "挂账", tax: "年度未还视同分红 20%", note: "12-31 前须归还或转分红", best: false },
    { path: "利润分配", amount: 0, period: "—", tax: "20% 股息红利", note: "须先弥补亏损 + 计提法定公积金", best: false }
  ]
},
shareholder_src: "_src 其他应收款-股东明细账；拿钱路径税负对比引擎 v0.1",

/* ---- P0-3 年度合规大节点（OPC 易漏，含强制审计） ---- */
annual: [
  { id: "Y-01", item: "一人有限公司年度审计报告", deadline: "2027-04-30", period: "2026 年度", status: "未开始", level: "高", note: "公司法 §62：一人公司每年强制审计，OPC 特有", ref: "公司法 §62" },
  { id: "Y-02", item: "企业所得税汇算清缴", deadline: "2027-05-31", period: "2026 年度", status: "未开始", level: "高", note: "业务招待费等纳税调增在此环节", ref: "企业所得税法 §54" },
  { id: "Y-03", item: "工商年报（年度报告公示）", deadline: "2027-06-30", period: "2026 年度", status: "未开始", level: "高", note: "漏报进经营异常名录，影响投标与贷款", ref: "企业信息公示暂行条例" },
  { id: "Y-04", item: "残保金申报缴纳", deadline: "2026-12-31", period: "2026 年度", status: "未开始", level: "中", note: "30 人以下免征（需申报）", ref: "残保金征收使用管理办法" },
  { id: "Y-05", item: "社保/公积金基数年度调整", deadline: "2027-07-01", period: "2027 年度", status: "未开始", level: "中", note: "基数与上年度月均工资匹配", ref: "社会保险法" },
  { id: "Y-06", item: "个税专项附加扣除年度确认", deadline: "2026-12-31", period: "2027 年度", status: "进行中", level: "低", note: "2 名员工待确认（联动预警 A-07）", ref: "个人所得税法" }
],
annual_src: "_src 年度合规节点引擎；公司法 §62 强制审计为一人公司特有义务",

/* ---- P1-1 发票全生命周期 ---- */
invoices: {
  toIssue: [ /* 待开票（合同已收款/已交付未开） */
    { id: "INV-O-01", party: "湖南智造集团", item: "二期尾款 50%", amount: 53000, tax: 3000, status: "待开票", due: "2026-09-30" },
    { id: "INV-O-02", party: "长沙高新孵化器", item: "培训费", amount: 15900, tax: 900, status: "已开未寄", due: "2026-09-26" }
  ],
  toCollect: [ /* 待收票（已付款未取得进项票） */
    { id: "INV-I-01", party: "阿里云", item: "8 月云资源", amount: 3860, tax: 219, status: "换开中", due: "2026-09-30", note: "普票换专票（联动预警 A-06）" },
    { id: "INV-I-02", party: "顺丰速运", item: "9 月寄送费", amount: 96, tax: 0, status: "待申请", due: "2026-10-10" },
    { id: "INV-I-03", party: "微信支付", item: "业务招待餐费", amount: 2160, tax: 0, status: "待申请", due: "2026-10-15" }
  ],
  matchRate: 0.86 /* 三单匹配率：合同-发票-流水 */
},
invoices_src: "_src 开票系统 + 电子税局发票池 + 合同台账三单勾稽",

/* ---- P1-2 合同全生命周期 ---- */
contractLifecycle: [
  { id: "C-2026-031", name: "数据合规服务框架合同", party: "华东制造集团", amount: 480000, signDate: "—", start: "—", end: "—", nextNode: "待签署（审查不通过项未闭环）", nodeDate: "—", invoiced: 0, received: 0, status: "审查中" },
  { id: "C-2026-008", name: "数据合规常年顾问", party: "深圳云途科技", amount: 424000, signDate: "2026-01-01", start: "2026-01-01", end: "2026-12-31", nextNode: "Q4 分期应收", nodeDate: "2026-10-15", invoiced: 318000, received: 212000, status: "履约中" },
  { id: "C-2026-012", name: "数据合规平台开发（一期）", party: "湖南智造集团", amount: 212000, signDate: "2026-03-01", start: "2026-03-01", end: "2026-12-31", nextNode: "二期尾款应收", nodeDate: "2026-09-30", invoiced: 106000, received: 106000, status: "履约中" },
  { id: "C-2025-021", name: "办公场地租赁合同", party: "汇金国际", amount: 180000, signDate: "2025-10-01", start: "2025-10-01", end: "2026-09-30", nextNode: "续签窗口（剩 6 天）", nodeDate: "2026-09-30", invoiced: 0, received: 0, status: "临期" },
  { id: "C-2026-034", name: "外包开发协议（官网二期）", party: "白鹿设计工作室", amount: 60000, signDate: "—", start: "—", end: "—", nextNode: "待签署（硬伤未闭环）", nodeDate: "—", invoiced: 0, received: 0, status: "审查中" }
],
contractLifecycle_src: "_src 合同台账 + 开票/收款勾稽；到期提醒引擎（提前 30/60 天）",

/* ---- P1-3 社保公积金健全性 ---- */
social: {
  headcount: 6,
  issues: [
    { id: "S-01", item: "老板本人劳动合同", finding: "未签署", level: "高", fix: "OPC 老板也是员工，须签劳动合同并缴社保；否则工伤/离职无保障", ref: "劳动合同法 §10" },
    { id: "S-02", item: "社保基数与工资匹配", finding: "2 名技术岗基数低于实际工资 30%", level: "高", fix: "按上年度月均工资核定基数；低基数属稽查高风险", ref: "社会保险法 §60" },
    { id: "S-03", item: "公积金全员覆盖", finding: "6/6 已缴", level: "低", fix: "—", ref: "住房公积金管理条例" },
    { id: "S-04", item: "老板本人社保", finding: "按最低基数缴纳", level: "中", fix: "建议与工资匹配；同时影响未来生育/医疗/养老待遇", ref: "社会保险法" }
  ]
},
social_src: "_src 社保公积金申报数据 vs 工资台账比对；OPC 高发雷区专项",

/* ---- P2-1 税收优惠雷达 ---- */
incentives: [
  { id: "I-01", name: "小微企业企业所得税优惠", fit: "高", saving: "约 ¥38,400/年", cond: "应纳税所得额 ≤300 万、从业 ≤300 人、资产 ≤5000 万", status: "已适用", ref: "财税〔2023〕12 号" },
  { id: "I-02", name: "研发费用加计扣除", fit: "中", saving: "预估 ¥12,000/年", cond: "自研数据合规平台投入可归集研发费", status: "待评估", ref: "财税〔2023〕7 号" },
  { id: "I-03", name: "增值税小规模纳税人减免", fit: "低", saving: "不适用", cond: "已登记一般纳税人，不可转回", status: "不适用", ref: "财政部 税务总局公告 2023-1" },
  { id: "I-04", name: "重点群体就业补贴", fit: "中", saving: "约 ¥7,800/人/年", cond: "招用脱贫人口/失业半年以上人员", status: "待排查", ref: "财税〔2019〕22 号" },
  { id: "I-05", name: "软件产品增值税即征即退", fit: "低", saving: "视产品化进度", cond: "自研软件产品取得软著并检测", status: "待规划", ref: "财税〔2011〕100 号" }
],
incentives_src: "_src 优惠雷达引擎 v0.1：按企业画像（营收/行业/人数/资质）匹配适用优惠",

/* ---- P2-2 股东决定留痕（OPC 以书面决定替代股东会决议） ---- */
resolutions: [
  { id: "D-2026-001", item: "2025 年度利润分配方案（暂不分配）", date: "2026-03-20", type: "年度事项", status: "已签署归档" },
  { id: "D-2026-002", item: "聘任会计师事务所承办 2026 年度审计", date: "2026-09-10", type: "年度事项", status: "已签署归档" },
  { id: "D-2026-003", item: "对外提供担保（为供应商授信担保 ¥100,000）", date: "—", type: "重大事项", status: "待签署", note: "公司法 §16：对外担保须书面决定，否则对公司不发生效力" },
  { id: "D-2026-004", item: "增加注册资本（¥100 万 → ¥200 万）", date: "—", type: "重大事项", status: "待评估", note: "认缴制下仍须书面决定 + 章程修订 + 工商变更" }
],
resolutions_src: "_src 股东决定模板库 + 签署台账；一人公司重大事项程序合法性举证",

/* ---- P2-3 注销 readiness 检查 ---- */
exit: {
  readiness: 0.58,
  blockers: [
    { id: "E-01", item: "未完结诉讼/仲裁", status: "1 项", level: "高", note: "劳动仲裁案在审，注销前须了结" },
    { id: "E-02", item: "未缴销发票/税控设备", status: "待查", level: "中", note: "注销前须缴销空白发票与税控盘" },
    { id: "E-03", item: "欠税/滞纳金", status: "无", level: "低", note: "当前无欠税记录" },
    { id: "E-04", item: "股东往来款未清", status: "¥20,000", level: "高", note: "借款挂账须先清理（补税或归还）" },
    { id: "E-05", item: "社保账户注销", status: "待查", level: "中", note: "须先办社保减员与账户注销" }
  ],
  path: "简易注销（20 天公示）适用条件：无债权债务或已清算完结；当前因 E-01/E-04 暂不满足"
},
exit_src: "_src 注销 readiness 检查引擎；市场监管总局简易注销口径",

/* ---- 全局搜索索引（app.js 构建） ---- */
searchNote: "索引：合同 · 法规 · 往来方 · 税种 · 预警 · 合规项 · 股东往来 · 发票 · 年度节点"
};
