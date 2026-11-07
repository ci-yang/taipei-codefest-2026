# 微服務開發 Skill 候選（2026-11-07 anysearch + gh 查證）

確認方式：用 `gh api .../git/trees` 確認 repo 內確有該 SKILL.md 路徑；星數／最後 push 來自 `gh api repos/...`。
安裝指令取自 claudeskills.info 頁面（該站從 GitHub 即時抓），尚未實際執行安裝。

## 外部候選

| # | 名稱 | GitHub | 用途 | 安裝指令 | SKILL.md |
|---|------|--------|------|----------|----------|
| 1 | api-gateway-configuration / microservices-patterns / api-contract-testing（同 repo 三個 plugin） | https://github.com/secondsky/claude-skills（247 星，2026-10-31 更新） | Kong/Nginx/Traefik 閘道設定、微服務模式、API 契約測試 | `claude plugin marketplace add secondsky/claude-skills` 然後 `claude plugin install api-gateway-configuration@claude-skills --scope project`（其餘兩個同法換名） | 確認過：`plugins/api-gateway-configuration/skills/api-gateway-configuration/SKILL.md`、`plugins/microservices-patterns/skills/microservices-patterns/SKILL.md`、`plugins/api-contract-testing/skills/api-contract-testing/SKILL.md` |
| 2 | luxor-backend-toolkit（fastapi-microservices-development、express-microservices-architecture、grpc-microservices、rest-api-design-patterns）＋ luxor-devops-suite（docker-compose-orchestration、api-gateway-patterns、microservices-patterns） | https://github.com/manutej/luxor-claude-marketplace（63 星，2026-06-13 更新） | FastAPI / Express 微服務開發、compose 編排、閘道模式；一包涵蓋 Python 與 Node 兩邊 | `npx skills add manutej/luxor-claude-marketplace --skill fastapi-microservices-development --agent claude-code`（其他 skill 換 `--skill` 名稱） | 確認過：`plugins/luxor-backend-toolkit/skills/fastapi-microservices-development/SKILL.md` 等 7 個路徑皆在 tree 內 |
| 3 | generating-docker-compose-files / building-api-gateway / validating-api-contracts / generating-api-contracts | https://github.com/jeremylongshore/claude-code-plugins-plus-skills（2903 星，2026-11-06 更新） | compose 多服務骨架、閘道骨架、契約驗證、API contract 產生；星數最高、維護最勤 | `claude plugin marketplace add jeremylongshore/claude-code-plugins-plus-skills` 然後 `claude plugin install api-gateway-builder@claude-code-plugins-plus --scope project`；compose 另有 plugin `docker-compose-generator` | 確認過：`plugins/api-development/api-gateway-builder/skills/building-api-gateway/SKILL.md`、`plugins/devops/docker-compose-generator/skills/generating-docker-compose-files/SKILL.md`、`plugins/testing/contract-test-validator/skills/validating-api-contracts/SKILL.md`；generating-api-contracts 在鏡像 repo `jeremylongshore/tons-of-skills-marketplace` |
| 4 | openapi-contract-first | https://github.com/loiane/specs-driven-development-spring-angular（62 星，2026-11-06 更新） | contract-first：先寫 OpenAPI → diff gate → 產型別 → 寫 controller | 無 README 安裝指令；複製 `.claude/skills/openapi-contract-first/` 到自己專案。內容偏 Spring/Angular，需改寫成 FastAPI/Node | 確認過（已讀到 frontmatter name/description） |
| 5 | OpenAPI Design（contract-first、OpenAPI 3.1） | 市集頁 https://mcpmarket.com/tools/skills/openapi-design（12 星）；原始 repo 未追到 | 文件先行的 API 設計，前後端可平行開發 | 未查到 | 未確認（只看過市集頁，沒追到 repo） |
| 6 | fastapi-modern-web-development | https://github.com/bobmatnyc/mcp-skillset（20 星，最後更新 2026-03-11）／https://www.skills.sh/bobmatnyc/mcp-skillset/fastapi-modern-web-development | FastAPI 現代寫法 | skills.sh 頁有 Installation 區塊但抓不到指令文字；Security Audits 顯示 Gen Agent Trust Hub Warn、Socket Fail，Snyk Pass | 確認過內容（skills.sh 顯示 SKILL.md）；有安全稽核警示，建議不選 |

## 查不到／弱項
- 「黑客松快速 prototyping」的 Claude Code skill：第 5 條查詢只回黑客松活動頁，沒有可裝的 skill。這塊建議用本機 skill 補。
- 「demo 部署」沒有專門的外部 skill 候選；本機 cloudflare / wrangler 可用。
- 以上市集條目（claudeskills.info、mcpmarket、skillmd.ai）為第三方聚合站，內容以 GitHub 原 repo 為準。第三方 skill 會進 agent context，安裝前請先瀏覽 SKILL.md。

## 本機已有、與微服務開發直接相關
- `harness-init` — 一條龍建專案的團隊＋ROADMAP＋品質閘門，適合新專案開局
- `dev-team-creator` — 依專案描述建 AI 開發團隊與 Backlog
- `prospec-onboard` — 安裝並初始化 Prospec SDD 流程
- `spec` — 規格撰寫（contract-first 前置）
- `e2e-testing-patterns` — 端到端測試模式，可延伸到跨服務流程
- `playwright` — 瀏覽器端 demo 驗證
- `vitest` — Node 服務與前端單元測試
- `cloudflare` — Workers/Pages/D1/Tunnel，demo 部署與閘道
- `design-taste-frontend` — demo 前端不要長得像模板
- `qa-db-safe-write` — 服務碰資料庫時的安全寫入驗證
- `mcp-builder` — 把服務包成 MCP
- `diagram` — 架構圖／服務拓撲
- `domain-modeling` — 切服務邊界前先建領域模型
- `grilling` — 對設計／切分決策做壓力測試
- `plan-eng-review` — 工程計畫審查
- `ship` — 出貨流程
