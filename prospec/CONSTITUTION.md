# Project Constitution: taipei-codefest-2026

> This document defines the guiding principles and constraints for the **taipei-codefest-2026** project.
> AI Agents and developers should consult this document before making architectural or design decisions.
>
> The principles below are **starter rules** seeded from your tech stack — edit, add, or remove to fit your project. Each carries an RFC-2119 severity (**MUST** / **SHOULD** / **MAY**) that `prospec-verify` grades against: violating a MUST → FAIL, SHOULD → WARN; a MAY is advisory (informational, does not affect the grade).

## Principles

### [MUST] Language Policy

**Description**: All generated documents — change artifacts and their archived summaries (`.prospec/changes/**`, `.prospec/archive/**`, `.prospec/abandoned/**`, `prospec/specs/_archived-history/**`) and the trust zone (`prospec/CONSTITUTION.md`, `prospec/README.md`, `prospec/index.md`, `prospec/specs/product.md`, `prospec/specs/features/**`, `prospec/ai-knowledge/**`) — are written in Traditional Chinese; code, identifiers, technical terms, and git commit messages stay English.

**Rationale**: The project owner reads both the change narrative and the trust zone in Traditional Chinese, while code, identifiers, technical terms, and git commit messages stay English so the project reads like the ecosystem it ships into. Both this rule and the agent entry config are generated from one resolved path set, so the two cannot drift into contradicting each other.

**Verify**: stations: all; Files under `.prospec/changes/**`, `.prospec/archive/**`, `.prospec/abandoned/**`, `prospec/specs/_archived-history/**` and `prospec/CONSTITUTION.md`, `prospec/README.md`, `prospec/index.md`, `prospec/specs/product.md`, `prospec/specs/features/**`, `prospec/ai-knowledge/**` are written in Traditional Chinese; code and technical terms are in English. Commit messages follow the team override below (「Commit message 格式」): type/scope in English, description in Traditional Chinese — a Chinese description is NOT a violation of this rule.

---
### [MUST] No any in public APIs

**Description**: Public function and module signatures avoid `any`; use `unknown` or generics.

**Rationale**: `any` disables type checking at exactly the boundaries that need it most.

**Verify**: No `: any` in exported signatures.

---
### [SHOULD] Tested public functions

**Description**: API route 與 demo 主流程要有測試；其餘 public function 有空再補（sprint 模式，2026-11-07 由 MUST 降為 SHOULD）。

**Rationale**: 32 小時黑客松以「能跑、demo 不壞」為先；完整覆蓋率的成本高於收益。

**Verify**: `apps/api` 每個 route 至少一支測試；demo 主流程有 smoke test。

---
### [SHOULD] One-way dependency direction

**Description**: Modules import in one direction only; no upward or circular imports.

**Rationale**: A clean dependency graph keeps layers independently testable.

**Verify**: Lower layers do not import higher layers.

---
### [SHOULD] Validate input at boundaries

**Description**: External input is parsed/validated at system boundaries, not trusted.

**Rationale**: Validating once at the edge prevents malformed data spreading inward.

**Verify**: Boundary handlers parse input before use.

---
<!-- Add your own principles below. Tag each with [MUST] / [SHOULD] / [MAY] so verify can grade them. -->
### [MUST] Commit message 格式（覆蓋上方 Language Policy 的 commit 部分）

**Description**: Conventional Commits：`<type>(<scope>): <描述>`。type 與 scope 用英文（feat／fix／docs／refactor／test／chore／perf／ci），描述用繁體中文。一個 commit 一件事。

**Rationale**: 隊員都讀中文，commit log 是 32 小時內互相同步進度的主要管道；type/scope 保持英文讓工具（changelog、grep）可用。Ci 2026-11-07 拍板（`docs/DECISIONS.md` D5）。上方 Language Policy 是 prospec 產生的預設值，其 Description 不手改以免 `prospec check` 報 language-policy-drift，改以本條覆蓋。

**Verify**: commit 標頭符合 `^(feat|fix|docs|refactor|test|chore|perf|ci)(\([a-z0-9-]+\))?: .+`；描述為繁中或英文都不判 FAIL。

---
### [MUST] 只用開源、免費元件；禁商用地圖

**Description**: 所有依賴須為開源且無授權費／訂閱費；新增套件前確認授權與 AGPL-3.0 相容（MIT／BSD／Apache-2.0 可）。地圖只用 MapLibre／Leaflet + OSM 或 NLSC 圖資，不得使用 Google Maps、Mapbox 等商用地圖。

**Rationale**: 競賽須知開發項目第 3 點；違反可撤銷獎項（第柒條二、（四））。

**Verify**: 新增依賴的 LICENSE 為相容開源授權；程式碼不引用 Google Maps／Mapbox SDK 或 tile URL。lockfile 裡 maplibre 間接依賴的 `@mapbox/*` 開源工具庫（point-geometry、tiny-sdf、unitbezier、vector-tile、jsonlint-lines-primitives）不是商用 SDK，不算違規。

---
### [MUST] 核心資料為開放資料並註明來源

**Description**: 核心資料必須來自合法開放資料（data.taipei、data.gov.tw、TDX 等），並在 README 資料來源表與畫面上註明資料集名稱與連結；非核心資料可用模擬資料但須標示「模擬資料」；不得使用爬蟲資料。

**Rationale**: 競賽須知開發項目第 2 點；初選評分項目含「資料來源正確」。

**Verify**: 每個資料來源在 README 有名稱、連結、是否模擬。

---
### [MUST] 執行期 LLM 推論只在裝置端

**Description**: 作品執行時不得呼叫雲端 LLM API 或自建遠端模型服務，後端不得把使用者輸入送去做 LLM 推論；若做 AI 功能，推論在手機端執行，README 揭露模型名稱、版本、量化格式、推論框架、來源，且不得為大陸廠牌模型。

**Rationale**: 競賽須知開發項目第 4 點；評審可關閉網路現場驗證。

**Verify**: `apps/` 內沒有對雲端 LLM API 的呼叫或其 SDK 依賴。

---
### [MUST] Secret 不進 git

**Description**: 金鑰、token、密碼只放 `.env`（gitignored）或 Actions secrets；`.env.example` 只放空值或本機預設值。

**Rationale**: repo 必須公開（AGPL、比賽要求），明文 secret 一進 git 就外洩。

**Verify**: diff 中無金鑰樣式字串；新增設定項同步更新 `.env.example`。

---

## Quality Standards

<!-- Define quality requirements (testing, documentation, performance) -->

- **Testing**: API route 與 demo 主流程要有測試（見上方 Tested public functions）；`pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全綠才 push。
- **Documentation**: 新功能照 `docs/HOW-TO-ADD-A-FEATURE.md`；資料來源寫進 README 與 AboutPage。

---

> Last updated: 2026-11-07T02:23:33.297Z
