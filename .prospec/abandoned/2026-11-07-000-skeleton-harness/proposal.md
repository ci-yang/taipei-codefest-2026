# 000-skeleton-harness

> 示範 change：讓隊員看到一份 prospec 規格長什麼樣。題目公布前先用「骨架與 harness」當內容。

## Premise

```yaml
problem: "5 人 + 多個 Claude Code / Codex session 在 32 小時內共用同一棵工作樹，沒有共同規則與地盤劃分就會互相踩（切分支、搶 port、改到別人的檔）。"
source: ai-proposed
source_ref: "隊長 Ci 2026-11-07 開賽前指示；教訓來源 team-brain playbooks/多 session 共用工作樹.md"
evidence:
  kind: observation
  ref: "team-brain playbooks/多 session 共用工作樹.md（2026-09-12 決賽日半天四次事故）"
  result: "共用 git index、dev server port、HEAD 是全域狀態，一人切換、全員受影響。"
withdrawal: "若隊伍改成每人各自 clone、互不共用工作樹，TEAM-PROTOCOL 的地盤規則可大幅縮減。"
verification:
  status: verified
  by: "Ci（口頭／問答確認）"
  conclusion: "Ci 於 2026-11-07 上午確認前提：兩 repo 配置、stack、harness 採 prospec sprint 模式（見 docs/DECISIONS.md D1–D3）。"
```

## User Story

As a 剛 clone 下 repo 的隊員（或他開的 AI session），
I want 打開 CLAUDE.md / AGENTS.md 一頁就知道專案是什麼、硬規則、地盤怎麼分、怎麼開規格，
So that 不用問隊長就能開工，且不會違反比賽規則或踩到別人的 session。

## Acceptance Criteria

1. 新開一個 Claude Code session 問「這個專案能不能用 Google Maps／雲端 LLM API」，答案是不能，並指出 CLAUDE.md 的出處。
2. 新開一個 session 問「我要改 docker-compose 或切分支前要做什麼」，答案指向 `docs/TEAM-PROTOCOL.md` 的地盤表，且說出「檢查與動作分兩條指令」。
3. `LICENSE` 為 AGPL-3.0 全文，`NOTICE` 含比賽規則第捌條指定聲明（program name、2026、隊名已填）。
4. `docs/DECISIONS.md` 記有今天已定的決策（兩 repo 配置、stack、harness），每條有日期與理由。
5. `pnpm install && docker compose up` 能把骨架跑起來（骨架由 scaffold 負責，見 `docs/RUNBOOK.md`）。

## Related Modules

_題目公布、`/prospec-knowledge-generate` 跑過後再補。_

## Notes

- sprint 模式：不是每個改動都要開 change。開 change 的時機見 CLAUDE.md「規格（prospec）」段。
- 本 change 不做任何產品功能；題目 11/7 公布後，第一個真正的 change 從 `001-` 開始。
