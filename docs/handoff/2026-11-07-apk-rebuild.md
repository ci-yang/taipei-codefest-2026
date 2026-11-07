# 友善同行 APK 重新打包

Ci 要求「包 apk」，於 2026-11-07 19:37（臺北時間）完成 release 模式通用 APK，沒有修改原生程式。

- 交付檔：`/Users/ciyang/Downloads/friendly-taipei-20261107.apk`，校驗檔為同路徑加 `.sha256`。
- 大小：115,790,112 bytes，約 116 MB。
- SHA-256：`fb815e2f9d03f0402d5db3105c2a93fd4fda506391e6ebf2c9716d7db1cb7a68`。
- TownPass 來源：`9701688709fa0faf5fd1c2257c968c5440ee6421`；wrapper 所在 repo 來源：`9d996f37104b50b024bb68d6780b2247cfd4249e`，建置前後乾淨。
- 服務網址：`https://taipei-friendly-platform.jason21131.workers.dev`；本輪讀取 `/config` 確認線上 Web App 為 `8044891fd3642d441214fb9b7c88522b65355952`。wrapper 的來源 SHA 不等於線上 Web 版本。
- 原生殼和網址未改，因此新建置的二進位雜湊與既有 APK 相同；新檔 mtime 在本次建置區間，未把未建置的舊檔冒稱新產物。既有 GitHub release 草稿的 APK digest 亦相同，本輪未重新上傳或公開發布。

使用既有 `scripts/build-townpass.sh`，明確傳入 `TOWNPASS_DIR`、`FLUTTER_BIN`、`DART_BIN` 與 HTTPS 服務網址。沿用台北通殼及服務入口；並未改成獨立地圖 launcher。

獨立驗證通過：收據／SHA／檔案大小與時間、package `com.example.townpass`、版本 `0.0.12`（code 1）、INTERNET 與粗略／精確定位權限、非 debuggable、v2 簽章，以及 arm64-v8a／armeabi-v7a／x86_64 內嵌網址。交付副本另核對 SHA 與建置產物相同。

仍使用 Android Debug 憑證，供團隊展示測試。`adb devices -l` 無連線裝置，未執行安裝、GPS、WebView、導航或離線重開實機驗證。

原始證據：[建置收據](evidence/2026-11-07-apk-rebuild/build.json)、[獨立驗證](evidence/2026-11-07-apk-rebuild/verification.json)。[既有 GitHub release 草稿](https://github.com/ci-yang/TownPass/releases/tag/untagged-f991213db1395b66fcdb) 需具草稿存取權限，其下載檔與本次 APK 雜湊相同。
