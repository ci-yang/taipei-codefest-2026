# iOS 實體機安裝

Ci 授權將已發布的友善同行 App 安裝到實體 iPhone。本次沿用 TownPass 的直開 WebView 與台北通 bridge，沒有重新部署網站。

## 建置與安裝

- 原生來源：[TownPass 7180078](https://github.com/ci-yang/TownPass/commit/7180078)，分支 `feat/stitch-ios-device`；基底為已完成 Android 建置的 `e3ea904`。
- 正式入口：<https://taipei-friendly-platform.jason21131.workers.dev>，透過 `CODEFEST_SERVICE_URL` 明確傳入，不使用程式中的預設網域。
- 裝置：iPhone 16 Pro Max，iOS 26.6.2；已配對，裝置原先已開啟開發者模式。
- App：`com.ciyang.friendlytaipei`，圖示名稱 **Town Pass**；版本及 build number 均為 `0.0.12`，最低 iOS 15.5。
- Flutter 3.47.6、Xcode 26.6、CocoaPods 1.17.0；Release 模式、現有 Apple Development 憑證簽署。
- Provisioning profile 包含目標裝置，有效至 **2026-11-14 21:07:04（臺北）**。這是實機開發測試版，沒有上架 App Store 或 TestFlight。
- 簽署產物：原生工作樹的 `build/ios-device/Build/Products/Release-iphoneos/Runner.app`。
- `devicectl` 於 2026-11-07 21:09 成功安裝；首次啟動被 iOS 的簽章／信任檢查拒絕。Ci 完成開發者信任後，21:14 再次啟動成功。
- Xcode 實機截圖確認新版首頁、目前已連線、5,948 筆全市資源名冊與「出發」按鈕：[實機首頁](evidence/2026-11-07-ios-device/device-home.png)。
- 實機畫面同時顯示「此環境不支援離線快取」。此項為已觀察到的 iOS WebView 限制，**不宣稱離線 P0 已通過**；本輪沒有變更離線實作。

## 修正與驗證

初次安裝因全域 `PRODUCT_BUNDLE_IDENTIFIER` 覆寫連帶改變內嵌 frameworks 的識別碼，被 iOS 以 `DuplicateIdentifier` 拒絕。修正為只在 Runner 的 Debug／Release／Profile 引用 `CODEFEST_IOS_BUNDLE_ID`；預設值保留 `com.example.townpass`，建置時可針對 App 覆寫，不影響 frameworks。

重新建置 `BUILD SUCCEEDED`。獨立代理確認 Runner、App.framework、Flutter.framework、OrderedSet.framework 與 flutter_inappwebview_ios.framework 的識別碼均不重複；每一項與整包 `codesign --verify --deep --strict` 均通過，AOT binary 包含正式入口。定位權限說明、iOS plugin 註冊及先註冊 bridge 再載入網頁的順序也經獨立檢查。

啟動被拒絕後，獨立代理再次比對已簽 entitlements 與 provisioning profile：App identifier、team、get-task-allow 及其餘權限均在授權範圍內，沒有發現 artifact 的簽署不一致。Ci 隨後確認已信任，工具回報啟動成功；實機截圖另確認首頁顯示。[去識別驗證紀錄](evidence/2026-11-07-ios-device/verification.json) 分別保存建置、安裝、啟動與尚未執行的功能檢查狀態。

本次只提交 Runner 設定修正；CocoaPods 產生的 checksum／工具版本差異沒有混入程式 commit。沒有把裝置識別碼、帳號、私鑰、憑證或 provisioning profile 加入 repo。

## 後續重建

在原生 repo 先執行 `flutter pub get --enforce-lockfile` 與 `dart run build_runner build`，再用 `flutter build ios --release --no-codesign --config-only --dart-define=CODEFEST_SERVICE_URL=https://taipei-friendly-platform.jason21131.workers.dev` 產生設定；首次需要準備原生依賴。Flutter／Dart 須使用 `.fvmrc` 對應版本。

Xcode 建置使用 `Runner.xcworkspace`、`Runner` scheme、`Release`、實機 destination；傳入實際開發團隊的 `DEVELOPMENT_TEAM`、`CODEFEST_IOS_BUNDLE_ID=com.ciyang.friendlytaipei`、`CODE_SIGN_STYLE=Automatic`、`CODE_SIGN_IDENTITY=Apple Development`、`CODE_SIGNING_ALLOWED=YES`，依裝置／profile 狀態使用 provisioning updates 與 device registration。**不要全域覆寫 `PRODUCT_BUNDLE_IDENTIFIER`**。安裝使用 `xcrun devicectl device install app`，啟動使用 `device process launch`。

手機首次使用開發者測試版可能需要在「設定 → 一般 → VPN 與裝置管理」信任開發者；電腦配對的「信任這部電腦」與 App 開發者信任是不同步驟。簽章到期後需重新簽署安裝。尚未完成實機 GPS、離線及外部導航功能驗證。
