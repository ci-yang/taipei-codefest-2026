# Cloudflare CI/CD 交接

> 本文保留 CI/CD 初次建置時的紀錄；之後已將 Cloudflare 根頁切換成 App，實際上線 SHA 與待辦見 [App 根入口交接](2026-11-07-app-root.md)。

日期：2026-11-07。Ci 本輪要求提供 Cloudflare 入口並完成 CI/CD；程式在 `ci/cloudflare-continuous-deploy`，由 [PR #5](https://github.com/ci-yang/taipei-codefest-2026/pull/5) 整合。

## 入口與範圍

- [Cloudflare 平台](https://taipei-friendly-platform.jason21131.workers.dev)，同源 Vue／Hono／D1。
- [公開版本資訊](https://taipei-friendly-platform.jason21131.workers.dev/config) 與 [健康檢查](https://taipei-friendly-platform.jason21131.workers.dev/healthz)。本輪開始實測健康，仍是 `412dd870ea9ebb3fb903794e61a289a462b44e5a`。
- 不改純 JS App 原型分享、凍結規格、APK、GCP 或 DNS。原型與平台仍是不同發布產物。

## 已完成程式與驗證

- `320b160`：main push／手動 dispatch 先 preflight，再重用原 CI，最後發布；PR 只測試，不取得部署 secret。
- 發布固定 SHA，開始、D1 mutation 前與 Worker upload 前核對遠端 main。查不到或 main 已前進即停止。保留 local deploy、收據回退、smoke 失敗回退與追加式 D1。
- workflow 固定 concurrency，`cancel-in-progress: false`；成功顯示網址及 SHA，收據 artifact 保存 30 天。
- 本機 typecheck、lint、build 通過；workspace 113 tests、tooling 37 tests 通過。新增案例涵蓋 SHA 不符、remote lookup 失敗、建置／匯入途中 main 前進；既有 rollback 測試仍通過。
- Claude Code Opus 實際靜態審查 `c0486bb..320b160`，job `review-mw6ab1fe-fgjw7p`，結論可以合併、無阻擋問題。[原始回報](../reviews/2026-11-07-claude-cicd.md)；Claude 未執行測試。
- 審查後只補文件：D1 可能先於 Worker 套用、migration 必須追加且相容舊 Worker；新 dispatch 與舊 run Re-run 的差別；main 的 CI 狀態位置。未變更審查後的執行程式。

## 憑證與實際上線狀態

本輪開始確認 GitHub repository 沒有 `CLOUDFLARE_API_TOKEN` secret。Cloudflare 摘要已準備：名稱 `taipei-codefest-2026-github-actions`、既有帳號 Workers Scripts Edit／D1 Edit、2026-12-07 到期；尚未建立。已向 Ci 請求建立及存入本 repo Actions secret 的確認，不能以等待時間當作同意。

合併前需確認 secret 設定完成及最終 PR head 的 CI 成功。之後由 main push 自動發布，再以 `/config.version`、`/healthz` 與 Actions smoke／收據確認實際上線 SHA；目前本文件不宣稱 CD 已成功或新版已部署。最終執行狀態以 PR 與 Actions 收據為準。

手動重新發布請在 [Deploy Cloudflare platform](https://github.com/ci-yang/taipei-codefest-2026/actions/workflows/deploy-cloudflare.yml) 按 Run workflow 選 main；不要用舊 run 重新發布已過期 SHA。token 到期前由帳號管理者換發並更新同名 secret。
