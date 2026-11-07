# Stitch App 原型交接

本輪唯一主線：依 Ci 指定的 Stitch 設計先更新可操作原型，排除個人帳號，建立後續實作的設計及截圖依據。

後續進度：Ci 已明確回覆「好部署跟包 apk」，此設計已於 2026-11-07 20:44（臺北）發布至正式 App。以下保留原型交接當時狀態；最新發布及 APK 結果見同目錄的 `2026-11-07-stitch-release.md`。

- 預覽：https://ci-share.pages.dev/4b3e8e0e61010e79/ （直接開 App；持有連結者可觀看）
- 草稿 PR：https://github.com/ci-yang/taipei-codefest-2026/pull/6
- 分支：`design/stitch-friendly-app`；主要改版 commit `114ca6ff9a2b8b88fb74ba7fa90d02eafca980fa`。
- Base：`ci/cloudflare-continuous-deploy`／PR #5；本輪未 merge main、未部署正式 Worker、未重包 APK。PR #5 合併後才調整本 PR base。
- 預覽快取版本：`friendly-resource-v6-090c5fe1c0542cda`。

## 後續要讀

1. `.prospec/changes/adopt-stitch-prototype/proposal.md`
2. 同目錄 `design-spec.md`、`interaction-spec.md`、`screen-map.md`、`review.md`
3. `docs/design/stitch-20261107/`：四張 OpenCLI 畫布截圖、六張來源稿與原始 HTML 文字、六張實作圖及窄螢幕補圖；manifest 含 hash。
4. `docs/prototypes/friendly-route/`：可操作設計本體；`.prospec.yaml` 的 design.output_dir 指向此處。

原本 `enable-friendly-routes/proposal.md` 凍結 blob 未修改：`6da4a77f904db5877d10fe8a54adf90356a178dc`。新 change 保持 story；Ci 審閱後再接 `prospec-plan`，不能把此次原型當成正式路由功能已完成。

## 已驗證與限制

完整紀錄見 review.md。workspace 113 項、prototype 77 Node＋9 Python、App build 5 項通過；六張畫面經獨立代理 review 無 critical／major。來源伺服器停止後重新載入及本機搜尋可用，未代替飛航模式實機驗證。

分享版經 publish-report 的 publish.sh → share.sh 發布；以 curl 下載 index.html／app-ui.css／app.js／sw.js，hash 與本機最終包一致；Chrome 實際看到 App 首頁及 5,948 筆名冊。Python 預設 User-Agent 被分享端回 403，curl 與 Chrome 均正常。

目前為真實資源＋直線距離／方位；交通選項僅偏好，沒有道路路由、估時或轉彎指示。無 GPS 會明示估算基準，不畫假連線。原生導航、撥號、TownPass 實機與 200% 字級尚待驗證。

撤回此預覽：

```bash
bash ~/.claude/skills/publish-report/scripts/share.sh --revoke 4b3e8e0e61010e79
```

本機 worktree：`/Users/ciyang/Documents/repos/tcf-stitch-prototype`。不要改原主樹仍未追蹤的其他 enable-friendly-routes 草稿。來源 ZIP 位於本機 Downloads；已將本輪所需的六組資料與 hash 留在 repo，跨機不依賴 ZIP。
