# Stitch App 正式發布與 APK

後續 iOS 實機建置與安裝狀態見：[iOS 實體機安裝](2026-11-07-ios-device.md)。

Ci 在確認原型後明確授權「好部署跟包 apk」。本次發布沿用既有 Cloudflare Worker／D1 與本機 Wrangler OAuth，沒有建立新憑證或改寫其他工作樹。

## 正式 App

- URL：https://taipei-friendly-platform.jason21131.workers.dev
- 發布時間：2026-11-07 20:44（臺北）。
- 發布來源：`40360b60a8ac24c9669d11fcd9464efeb7712101`，已通過 [CI run 42373473938](https://github.com/ci-yang/taipei-codefest-2026/actions/runs/42373473938)。
- Worker version：`19bdf1ef-5b55-4f78-a208-b92cd2386ea9`。
- 離線版本：`friendly-resource-v6-c0150f4063526057`。
- 發布收據：[deployment.json](evidence/2026-11-07-stitch-deploy/deployment.json)。收據內包含前版及回退資訊；D1 不隨 Worker 回退。
- API／資料／migration 本輪沒有修改；發布腳本照既有流程套 migration、重複匯入及核對同版本快照。API 仍為 `friendly-route-2026-11-07-v1` 的 103 筆地方資料；App 自己的全市靜態名冊為 5,948 筆，兩者不混稱。

發布 wrapper 的 smoke 與另一代理獨立執行的 remote smoke 都通過：根頁、runtime hash、21 個 manifest 項、redirect／404、config／health 與 API。另一代理核對時間為 20:45:09（臺北）。Chrome 另確認實際新版首頁、出發入口與 5,948 筆名冊：[畫面](evidence/2026-11-07-stitch-deploy/production-home.png)。

既有瀏覽器第一次開啟可能先讀取舊離線包；本次在快取更新後重開頁面取得新版，未清除儲存資料。[升級邊界紀錄](evidence/2026-11-07-stitch-deploy/upgrade-boundary.json) 區分真瀏覽器觀察與程式診斷，不宣稱所有裝置固定只需兩次重開。

## APK

- 新安裝檔：`/Users/ciyang/Downloads/friendly-taipei-stitch-20261107.apk`；同名 `.sha256` 校驗檔一起保留。舊 APK 沒有覆蓋。
- 檔案大小：115,282,208 bytes（約 115 MB）。
- SHA-256：`cf893b7848190f247d09db33d5e6b17787f0474cc9b428a69b240b53d7146761`。
- Native 來源：[TownPass e3ea904](https://github.com/ci-yang/TownPass/commit/e3ea904f80ef378704c634a0195cb43a020bf217)，分支 `feat/stitch-direct-app` 已推送；建置前後工作樹乾淨。
- 套件：`com.example.townpass`，版本 `0.0.12`／code `1`，圖示名稱沿用 **Town Pass**。Android minSdk 24、targetSdk 36。
- 啟動根頁改為 `CodefestView`，直接載入正式 App URL，不再先進台北通主殼首頁；保留 `initServices` 及共用 bridge，先完成 message listener 註冊再載入網址。新畫面沒有原生頂部工具列。
- 三種 ABI（arm64-v8a、armeabi-v7a、x86_64）皆核對到正式根網址。APK 載入遠端網站，並非將 Web 版本固定封裝在 APK 內。
- 建置模式 release，manifest 為 non-debuggable；簽章為與前版相同的 **Android Debug 憑證**，v2 簽章驗證通過，尚非正式上架簽章。

驗證：變更範圍 `flutter analyze` 無 issues；7 項 Flutter 及 7 項 Python 建置／URL 測試通過。另一代理先做入口程式審查，修正錯誤遮罩殘留及無效 geolocation origin 後複核通過；再獨立核對 APK、下載副本與 checksum 一致，權限、版本、簽章與三 ABI URL 均通過。

證據：[建置收據](evidence/2026-11-07-stitch-deploy/apk-build.json)、[獨立 APK 驗證](evidence/2026-11-07-stitch-deploy/apk-verification.json)、[Flutter 測試](evidence/2026-11-07-stitch-deploy/flutter-tests.txt)、[建置腳本測試](evidence/2026-11-07-stitch-deploy/build-script-tests.txt)、[分析紀錄](evidence/2026-11-07-stitch-deploy/flutter-analyze.txt)。收據記錄 platform repo dirty，是此份交接文件與發布證據尚在整理；原生建置來源已獨立確認為乾淨的 e3ea904，不能把兩個 repo 的狀態混稱。

限制：adb 未連接 Android 裝置，所以未安裝、未驗真機 GPS、飛航模式或外部導航。Android 返回鍵處理 WebView 文件歷史，沒有文件歷史時會退出 App；首頁／探索／導引的內部返回使用 Web 畫面按鈕。

## 分支及後續

正式 Worker 已發布，但 PR #5／#6 仍未合併 main。PR #5 的自動 CD 專用 Actions token 尚未設定，這次不將「已由本機發布」寫成「自動 CD 已驗證」。PR #6 仍疊在 `ci/cloudflare-continuous-deploy` 上，後續處理其 base。

設計確認已記入 `adopt-stitch-prototype/screen-map.md`，仍須由正式 `prospec-plan` 規劃道路路由／交通估時等未完成能力。凍結的原始 proposal 未修改；本次交接文件 commit 不等於重新部署網站。
