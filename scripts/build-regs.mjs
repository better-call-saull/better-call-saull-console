#!/usr/bin/env node
/* 从 ../better-call-saull-database 生成法规库全量目录 regs.js。
 * 用法：node scripts/build-regs.mjs [database 路径]
 * 只读解析 laws/*.md 与 laws/judicial-interpretations/*.md 的 frontmatter，
 * 不修改知识库内容。 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONSOLE = resolve(HERE, "..");
const DB = resolve(process.argv[2] || join(CONSOLE, "..", "better-call-saull-database"));
const LAWS = join(DB, "laws");

const SKIP = new Set(["README.md", "INDEX.md", "VERIFICATION_STATUS.md", "REPEALED.md", "SOURCES.md", "CONTRIBUTING.md"]);

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  let key = null;
  for (const raw of m[1].split("\n")) {
    const kv = raw.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) { key = kv[1]; fm[key] = kv[2].trim(); }
    else if (key && /^\s+-\s/.test(raw)) { /* 列表项：忽略，字段均取标量 */ }
  }
  const clean = (s) => s == null ? "" : s.replace(/^['"]|['"]$/g, "").trim();
  return {
    title: clean(fm.title),
    issuer: clean(fm.author),
    eff: clean(fm.effective_date) || clean(fm.publication_date),
    status: clean(fm.status),
    group: clean(fm.group)
  };
}

function collect(dir, forceGroup, srcPrefix) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".md") || SKIP.has(f)) continue;
    const fm = parseFrontmatter(readFileSync(join(dir, f), "utf8"));
    if (!fm || !fm.title) continue;
    out.push({
      t: fm.title,
      issuer: fm.issuer || "—",
      eff: fm.eff || "—",
      status: fm.status || "待核验",
      grp: forceGroup || fm.group || "其他",
      src: srcPrefix + f
    });
  }
  return out;
}

const rows = []
  .concat(collect(LAWS, null, "better-call-saull-database/laws/"))
  .concat(collect(join(LAWS, "judicial-interpretations"), "司法解释", "better-call-saull-database/laws/judicial-interpretations/"));

rows.sort((a, b) => a.grp.localeCompare(b.grp, "zh") || a.eff.localeCompare(b.eff) || a.t.localeCompare(b.t, "zh"));

const groups = {};
for (const r of rows) groups[r.grp] = (groups[r.grp] || 0) + 1;

const asOf = new Date().toISOString().slice(0, 10);
const body =
  "/* 自动生成，勿手改：node scripts/build-regs.mjs\n" +
  " * 来源 better-call-saull-database/laws/（含 judicial-interpretations/）frontmatter。\n" +
  " * 生成日期 " + asOf + "，共 " + rows.length + " 部。 */\n" +
  "var REGS_DB = " + JSON.stringify(rows, null, 0).replace(/\},\{/g, "},\n  {") + ";\n" +
  "var REGS_DB_META = " + JSON.stringify({ asOf, total: rows.length, groups, source: "better-call-saull-database/laws/" }, null, 0) + ";\n";

writeFileSync(join(CONSOLE, "regs.js"), body);
console.log("regs.js 已生成：" + rows.length + " 部", groups);
