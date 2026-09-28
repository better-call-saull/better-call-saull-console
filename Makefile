PORT ?= 8937

.PHONY: help serve check syntax regs data parse open

help:
	@echo "make serve   启动本地静态服务（默认 :$(PORT)）"
	@echo "make check   语法校验 + 数据一致性自检（推荐提交前运行）"
	@echo "make syntax  仅 node --check 全部 JS"
	@echo "make data    仅 scripts/check-data.mjs 断言"
	@echo "make parse   流水粘贴解析器行为用例"
	@echo "make regs    从知识库重新生成 regs.js（依赖 ../better-call-saull-database）"
	@echo "make open    浏览器打开工作台"

serve:
	@echo "serving on http://localhost:$(PORT)"
	@python3 -m http.server $(PORT)

syntax:
	@node --check app.js && node --check data.js && node --check regs.js \
	  && node --check scripts/build-regs.mjs && node --check scripts/check-data.mjs \
	  && node --check scripts/test-parseflow.mjs && echo "syntax OK"

data:
	@node scripts/check-data.mjs

parse:
	@node scripts/test-parseflow.mjs

check: syntax data parse

regs:
	@node scripts/build-regs.mjs

open:
	@open "http://localhost:$(PORT)" || true
