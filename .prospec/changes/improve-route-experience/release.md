# 發布與安裝收據

## 原生 App

- TownPass commit：`8f106f6ba082bf8f66f266c87ca7a0c1f819a0c6`，分支 `feat/townpass-friendly-entry`，PR：https://github.com/ci-yang/TownPass/pull/2。
- Android APK：`friendly-taipei-routes-20261107.apk`，116,052,352 bytes，SHA-256 `b3e6026fc94a501a563e224cca7ad633c1e08e058760ac2e0dc5b50ab2871f25`。沿用測試簽章，未做 Android 實機操作。
- iOS：Release 簽署建置與 codesign 驗證通過；兩支既有授權 iPhone 皆已安裝 `com.ciyang.friendlytaipei` 並收到 devicectl 啟動成功回覆。裝置識別碼、個人憑證與截圖不入庫。
- 原生人工點按首頁→友善同行→返回仍待確認；不得把 install／launch 當成點按通過。離線快取限制見交接。

## 平台首次發布及自動回退

- 平台 PR：https://github.com/ci-yang/taipei-codefest-2026/pull/7，以原 Stitch 分支為 base。
- 2026-11-07 首次發布來源：`b7b2c437c0d6f29ce33c8a4c48878bc55d14ad35`；Worker version `d0c4acd6-3ebf-45c6-b3f9-7d98872f8874`。
- 發布後 smoke 讀取 20,758,759 bytes 全市路網時觸發既有 8,000,000 bytes 上限：`Response exceeds output limit.`。
- Wrapper 回報 `failed-and-rolled-back`，已還原 Worker `19bdf1ef-5b55-4f78-a208-b92cd2386ea9`／來源 `40360b60a8ac24c9669d11fcd9464efeb7712101`，完成時間 `2026-11-07T14:22:57.785Z`。
- 這是發布檢查器不支援新增合法資產大小的問題。後續修正 App 資產讀取上限，以 manifest 宣告大小、25 MiB 硬上限及 caller 較低上限共同限制；API／manifest 通用讀取限制、timeout、hash 驗證維持。

## 最終網頁操作證據

`evidence/browser-final.json` 是獨立設計核對重跑結果，82 項通過、0 失敗，七個 runtime source hash 與本輪最終 App 程式相同。它仍是桌面 Chromium 模擬；不涵蓋實機點按、iOS離線或外部圖磚。

發布檢查器回歸：`node --test --test-name-pattern='App asset limits' scripts/smoke-platform.test.mjs` 修正前7 pass／13 fail，修後20/20通過；完整 `pnpm test:tooling` 為77/77。API與manifest預設8 MB、timeout、hash保持；新增合法邊界、超宣告、超25 MiB、caller更低界線及historical測試。

獨立審查收據：`evidence/release-review.json`。真實本機 Worker／D1 整合完整通過（25 個 App 資產、20,758,759 bytes 路網與逐檔 hash）；沒有 remote writes。累計差異第二輪 review 為 0 critical／0 major，更新後驗證等級 A；保留 acceptance late-capture 與原生實機點按待確認兩項限制。
