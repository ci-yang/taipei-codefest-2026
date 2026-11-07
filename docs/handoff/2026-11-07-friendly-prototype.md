# 友善同行 Prototype 與 Story v1 交接

## 直接開啟

- [單篇分享版](https://ci-share.pages.dev/0d4c5d2fb055c7ae/)
- [分析](https://ci-share.pages.dev/0d4c5d2fb055c7ae/analysis.html)
- [第一版規格](https://ci-share.pages.dev/0d4c5d2fb055c7ae/spec.html)
- [私有報告台，需登入](https://ci-reports-917.pages.dev/reports/2026-11-07-friendly-route-prototype/)

開啟後按「試走示範路線」。五功能可操作，評論與協助僅為本機示範，路線是不能導航的直線連線。原型附大字詢問卡、提案分析與可下載規格。

## 來源與規格

Source branch：`codex/friendly-route-prototype`，隔離工作樹 `/Users/ciyang/Documents/repos/tcf-friendly-prototype`。沒有改 `apps/`、TownPass bridge 或正式部署。

- 原型：`docs/prototypes/friendly-route/`；資料建立工具：`docs/prototypes/build-friendly-data.py`。
- 規格：`.prospec/changes/enable-friendly-routes/{proposal.md,input-evidence.md,metadata.yaml}`。
- Story 已獨立複核、CLI validate PASS、freeze revision 1，共 17 情境。Digest：`5f24e004331f71310636d8397d4408a4ab07168ed871cdb761bf966c9cdc7d50`。
- Knowledge 模組表為空、跨故事契約需計畫站拆定，已以 CLI log 保留 WARN。尚未進 `prospec-plan`。

Prospec 在隔離工作樹回報既有 abandoned skeleton 為 conflicting history；同一份歷史檔案在主工作樹沒有觸發該 gate。為避免繞過 CLI，本次在主工作樹由 CLI 建立、凍結及驗證，再逐檔核對複製到隔離分支。主工作樹仍保留本輪產生的三份 Story 原檔，讓 `prospec status` 可接續工作；沒有手改歷史或 metadata。

## 驗證與發布

詳見原型 `QA.md`。103 店與 8,985 OSM 圖徵由獨立 reviewer 逐筆核對；瀏覽器測完五流程、390px 響應版、服務停止後完整快取重開。最後新分頁快速切換互助、回應與撤銷，console error 為空。

私有主台與分享版均實際開啟，兩者的子路徑離線下載成功。分享版核心 HTML／JS／規格與來源 SHA-256 相同。發布遵 `publish-report`；全 17 資產通過紅線／secret 掃描，Access production 與 deployment 防護通過。主台 commit `062cf30` 已確認 Production / main；分享包含單篇及資產，不含主台目錄。

報告發布已獲 Ci 本輪授權。此專案依 `TEAM-PROTOCOL.md` 不由 AI 自行 push／merge；原型與規格在本地隔離分支提交，由資源主人決定整合。沒有執行正式應用的完整 build／測試矩陣；本輪未變更正式應用。

撤回單篇分享（由 Ci 決定是否執行）：

```bash
bash ~/.claude/skills/publish-report/scripts/share.sh --revoke 0d4c5d2fb055c7ae
```

## 接續

正式開發前跑 `prospec status`，依指示載入 `prospec-plan`。優先定真實步行路由與 TownPass Android 實機離線；公開評論、多人互助仍需後端及維護責任。拿不到的產品效果需與目標族群、店家實測，現在沒有成效數字。
