# Better Call Saull 财税法工作台（BCS FIN · TAX · LAW DESK）

CEO Stack「守底线保安全」组件：把「财 · 税 · 法」三条线的底线指标收敛到一屏。AI 负责记账、审合同、发预警，人只做确认与处置。**只读快照**——所有写操作仅落 localStorage，不回写网银 / 发票池 / 合同系统。

- 主体：Better Call Saull 咨询（长沙）有限公司 · 一人有限责任公司（OPC）
- 快照日期：见 `data.js → meta.asOf`
- 风格来源：`jac-global/operation-center`（投行研究报告风：冷灰纸面 + 藏蓝 + 香槟金，衬线标题 + 等宽数字，零圆角，数据须带 `_src` 溯源）

## 运行

无构建静态站。推荐 Makefile 入口（`make help` 查看全部目标）：

```bash
make serve      # python3 -m http.server 8937 → http://localhost:8937
make check      # 语法 + 数据一致性 + 流水解析 一键自检
make regs       # 知识库更新后重新同步法规目录
```

## 结构

```
index.html   壳：侧栏五线导航 + 20 个视图容器 + 顶栏（搜索 / 时钟 / 打印 / CONFIDENTIAL）
styles.css   设计系统（参考站整卷移植 + 本工作台专有组件 + @media print 一页简报）
data.js      唯一真相文件：var DB = {…}，每个分区配 _src 溯源串
regs.js      自动生成，勿手改：法规库全量目录 var REGS_DB（frontmatter 同步）
app.js       hash 路由 + 20 视图渲染 + 交互（排序 / 筛选 / AI 采纳 / 流水识别 / 清单勾选 / 全局搜索）
Makefile     自检与运行入口：serve / syntax / data / parse / regs / check / open
scripts/
  build-regs.mjs     从 ../better-call-saull-database/laws/ 重新生成 regs.js
  check-data.mjs     数据一致性断言（90 项，vm 沙箱求值，只读）
  test-parseflow.mjs 流水解析引擎用例（9 例，vm 沙箱抽取 app.js 真实函数）
```

## 五条线 20 视图

| 线 | 视图 |
|---|---|
| 总览 | 工作台总览（KPI · 三大 AI 能力 · 守底线速览 · 合规健康度 · OPC 速览） |
| 财 | 自动记账（AI 队列 + 流水粘贴识别引擎 v0.4，置信度 <0.80 强制确认，支持导出 CSV）· 现金流 · 应收应付 · 预算与成本 |
| 税 | 纳税日历 · 税负分析 |
| 法 | 合同审查（风险规则库 42 条）· 法规库（适用节选 + 全库目录 192 部） |
| 守底线 | 风险预警（7 规则每日评估）· 合规清单（五域逐项核对） |
| OPC 防护 | 财产混同 · 股东往来 · 年度合规 · 发票池 · 合同生命周期 · 劳动用工 · 激励政策 · 股东决议 · 注销退出 |

## 数据口径

- **权责发生制（台账）vs 实收（现金流）**：9 月差额即「AI 待确认未入账」收入，两表各自标注口径，check-data 断言差额。
- 法规库两层：适用节选（人工维护 + 适用状态）与全库目录（`node scripts/build-regs.mjs` 从知识库 frontmatter 同步，法律 / 行政法规 / 部门规章 / 司法解释）。
- localStorage 键：`bcs.aiDone.v1` `bcs.aiSkip.v1` `bcs.checklist.v1` `bcs.alertDone.v1` `bcs.ledgerLocal.v1`（记账视图「重置队列」一键清除全部本地状态）。
- **流水粘贴识别（本地规则引擎，非云端）**：每行网银流水按 `data.js → cat_rules`（15 条科目映射）识别出凭证草稿，置信度基准 0.92，每项歧义扣分（缺日期 −0.10、方向靠规则推定 −0.15、关键词冲突 −0.05、无规则命中封顶 0.45）；≥0.80 标「建议自动归类」，否则「强制人工确认」。采纳仅写入 `bcs.ledgerLocal.v1` 并在台账带「本地」标签，刷新不丢，绝不回写网银。

## 自检

```bash
make check                          # = 下面三步
node --check app.js && node --check data.js
node scripts/check-data.mjs         # 数据一致性 90 项
node scripts/test-parseflow.mjs     # 流水解析 9 例
```

## 依赖

零依赖、零框架、ES5 IIFE；图表为内联 SVG。知识库侧仅以文件形式读取 `better-call-saull-database/`，不写入。
