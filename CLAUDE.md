<!-- prospec:auto-start -->
# taipei-codefest-2026

> AI-augmented project with Prospec Skills and structured AI Knowledge

## Tech Stack

- **Language**: typescript
- **Package Manager**: pnpm

## Language Policy

All generated documents — change artifacts (`.prospec/changes/**`, `.prospec/archive/**`, `.prospec/abandoned/**`, `prospec/specs/_archived-history/**`) and the trust zone (`prospec/CONSTITUTION.md`, `prospec/README.md`, `prospec/index.md`, `prospec/specs/product.md`, `prospec/specs/features/**`, `prospec/ai-knowledge/**`) — are written in **Traditional Chinese**, and requests may be phrased in it; code, identifiers, technical terms, and git commit messages stay English (see the Constitution's Language Policy rule, generated from this same path set).

## Core Resources

### Constitution
Project principles and constraints: [`prospec/CONSTITUTION.md`](prospec/CONSTITUTION.md)

### AI Knowledge Base
Module index and project structure (L1-L3 navigation): [`prospec/index.md`](prospec/index.md)

### Coding Conventions
Coding standards and best practices: [`prospec/ai-knowledge/_conventions.md`](prospec/ai-knowledge/_conventions.md)
Diagram conventions: [`prospec/ai-knowledge/_diagram-conventions.md`](prospec/ai-knowledge/_diagram-conventions.md)
Project glossary and domain terms: [`prospec/ai-knowledge/_glossary.md`](prospec/ai-knowledge/_glossary.md)

## Available Prospec Skills

Prospec Skills use bare `prospec-<name>` as their canonical identity. Use the host-specific guidance below only when you want to invoke a Skill explicitly; descriptions and trigger words continue to support implicit discovery.

## Invoking a Prospec Skill

| Host | Explicit invocation |
|------|---------------------|
| Claude Code | `/prospec-<name>` |

Each Skill's description and trigger words are surfaced automatically from its `SKILL.md` frontmatter, so identify the matching bare `prospec-<name>` Skill.

## Session Start

At the start of a session, run `prospec status` — it deterministically reports each in-progress
change's name, current node, suggested next step, and blocking gates (the executable copy of
`prospec/ai-knowledge/_status-lifecycle.md`). The prospec CLI (version ≥ 2.4.0)
is a required file for the prospec skills: when it is missing or too old, STOP and install/upgrade
the standalone executable before running any skill — never substitute manual steps.

## Working with This Project

**Constraint**: Follow the L0-L3 progressive loading model. Always read `prospec/index.md` (L1) first. Never load L2 (Module READMEs) or L3 (Source Code) proactively before identifying the required modules.

**Station Transition Protocol**: The SDD workflow advances through stations. On advancing to ANY new station — whether `prospec status` routed you there or you cascaded to it autonomously — run `prospec status` first: it names the station's canonical `prospec-<name>` Skill, its reference map, and the resolved skill file as a separate fallback. Load that station's instructions BEFORE taking any station action:

- Invoke — or re-invoke — the named Skill through this host's own skill mechanism, on every transition and re-entry. When that mechanism is unavailable, read the fallback file under `.claude/skills/` instead.

Then read that station's references at the phases it names; loading a station never means its references arrived. If neither route yields the station's instructions, STOP and name what is missing — never act on remembered rules, and never skip an entry gate or a receipt. Accumulated context is no substitute: a long session's diffs and logs dilute the initial instructions.

**Checkpoint Correction Capture Protocol**: At natural reflection points — at session end, or before archiving a change — review the developer corrections you received this session and record each *generalizable* one via `prospec learn upsert` (a cross-cutting architecture, type-contract, testing, or security rule — never a one-off mock or business-string tweak; the deciding heuristic lives in the `prospec-learn` Skill's promotion-format reference under `.claude/skills/`, which you read with your file-reading tool rather than guessing from memory), naming its modules from `prospec/ai-knowledge/module-map.yaml` and terms from `prospec/ai-knowledge/_glossary.md`, with the `description` in the language the correction was given. Stay silent — do not interrupt the conversation or ask a blocking question — and surface a single line only when the command reports a promotion suggestion. Keep this ledger write a separate concern; never fold it into a feature commit.

1. **Before starting**: Read the Constitution to understand project principles
2. **Understand the structure**: Consult the AI Knowledge Index to grasp the module architecture
3. **Coding standards**: Follow the style guide in the Conventions document
4. **Use Skills**: Trigger dedicated workflows via their bare `prospec-<name>` identity
5. **Module dependencies**: Check `prospec/ai-knowledge/module-map.yaml` before modifying

## Notes

- This file is Layer 0 (always loaded) — keep it lean and point to other resources
- Skills are Layer 1-2 — detailed instructions load on demand
- The Knowledge Base is on-demand — load according to the scope of work
<!-- prospec:auto-end -->

<!-- prospec:user-start -->
<!-- Add your own project-specific instructions below. This section is preserved across `prospec agent sync`. -->
## 台北通通通懂台北 — 團隊規則（本段 `prospec agent sync` 不會覆蓋）

**專案**：2026 城市通微服務大黑客松（11/7–8，32 小時不中斷）作品，跑在台北通（TownPass）WebView 裡的城市通微服務。題目待 11/7 公布。模式 **sprint**。

### 比賽硬規則（違反有失格／撤獎風險，出處 `docs/competition-rules-digest.md`）
- 授權 AGPL-3.0（`LICENSE` + `NOTICE` 第捌條聲明）。新增套件只收 MIT／BSD／Apache 等相容授權，裝之前先查。
- 只用開源、免費元件；**禁商用地圖**（Google Maps、Mapbox）→ MapLibre／Leaflet + OSM 或 NLSC 圖資。
- 核心資料必須是合法**開放資料**並註明來源（README 資料來源表）；非核心可 mock 但標「模擬資料」；不准爬蟲。
- 執行期 LLM 推論**只能在裝置端**，前後端都不准呼叫雲端 LLM API。不做 AI 也行。
- 發表只能投影實機畫面、禁止簡報 → 穩定與視覺優先於功能數量。

### Stack 與目錄（scaffold 持續產生中，以實際檔案為準）
- `apps/api` Hono + Drizzle + PostGIS／`apps/web` Vue 3 + Vite + MapLibre／`packages/shared` 前後端共用型別
- `docker-compose.yml` 起 DB；設定一律以 `.env` 為準（範本 `.env.example`；預設 db 5433、api 8787、web 5173）
- 指令與排錯 `docs/RUNBOOK.md`；加功能步驟 `docs/HOW-TO-ADD-A-FEATURE.md`；決策 `docs/DECISIONS.md`
- App 殼在 fork `ci-yang/TownPass` 分支 `codefest-2026`（不在本 repo）。**bridge 一律用 `apps/web/src/composables/useTownPassBridge.ts`**，協定見 `docs/townpass-integration.md`；`docs/reference/` 是 2025 舊版，裡面的 `postMessage().then` 寫法已失效
- 線上 demo `https://codefest.ciyang.dev`（部署見 `deploy/README.md`，`deploy/` 有專人負責，改之前先問）

### 四條核心規則（sprint 模式唯一不放鬆的）
1. **Secret 隔離**：只放 `.env`（gitignored）或 Actions secrets。明文進 git 就是事故，「範例值」也一樣。
2. **不編造**：資料集名稱、API 網址、套件用法、成員資訊查不到就寫「待補／未驗證」或問人。
3. **不可逆先問**：force push、刪分支／資料（含 `pnpm db:push:force`）、改 repo 權限或可見性、對外發布、花錢。可逆的做完說一聲。
4. **決策留痕**：「之後還會再問」的結論當下寫進 `docs/DECISIONS.md`（日期／決定／理由）。

### 多 session 共用工作樹（完整版 `docs/TEAM-PROTOCOL.md`）
- 開工先看 TEAM-PROTOCOL 地盤表：git HEAD、docker compose、各 port、各目錄都有主人；碰別人的先問。
- 別人在跑時不 `checkout`／`pull`／`reset`／重啟服務。**檢查與動作分兩條指令**，看到結果再動。
- 要試別的版本就開 `git worktree`，不動主工作樹 HEAD。`git add` 只點名自己的檔，不用 `-A`。
- 設定值以 `.env`／程式碼為準，不以筆記或其他 session 的轉述為準；轉述不算授權。

### 規格（prospec v2.6，CLI `prospec`）
- CLI 不在 npm（npm 上的 `prospec` 是 0.1.x 舊版，別裝）：2.6.0 是單一執行檔，跟 Ci 拿（Ci 機器上 `~/.local/bin/prospec`），放進 PATH 後 `prospec --version` 應為 2.6.0。**沒有 CLI 的人跳過 prospec 步驟，直接照 HOW-TO 做**（覆蓋上方 auto 段的 STOP 要求）。
- 開工跑 `prospec status`。sprint 不是每改都開 change：**跨人介面（API 契約、bridge message）或 demo 主流程才開**。
- `000-skeleton-harness` 是歷史示範（骨架已完成，留著當範本），`prospec status` 指向它時忽略，不要去推進它；新功能開新 change（`001-` 起）。
- 開 change：`/prospec-new-story`（或 `prospec change story NNN-slug`），檔案在 `.prospec/changes/<name>/`。
- 原則 `prospec/CONSTITUTION.md`（含比賽 MUST 規則）；永久規格 `prospec/specs/`；知識 `prospec/ai-knowledge/`。

### Git 與語氣
- Conventional Commits：`<type>(scope): 描述`，**type/scope 英文、描述繁中**（例 `fix(web): 定位逾時後自動重試`），一個 commit 一件事。覆蓋上方 auto 段「commit stay English」，見 Constitution「Commit message 格式」。
- 小改直推 main；要 demo 的走 PR（`.github/PULL_REQUEST_TEMPLATE.md`）。**AI session 不自行 push／merge／開 PR**：commit 完回報，由人或 lead 執行。
- 對話與文件一律繁中、平輩、直接；有把握就堅持立場。**不要過度設計**；實作前先確認 scope，嚴守邊界。
- 不確定的套件用法先查 context7／官方文件，不要憑記憶。
<!-- prospec:user-end -->
