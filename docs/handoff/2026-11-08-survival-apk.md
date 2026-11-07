# 城市生存雷達 APK 試玩版

Ci要求先包APK試玩；本次只重建原生殼的入口URL，未修改原生tracked source，沒有部署正式Worker。

## 下載與開啟
- [APK直接下載](https://github.com/ci-yang/TownPass/releases/download/survival-highlights-demo-20261107/friendly-taipei-survival-20261107.apk)
- [GitHub試玩release與校驗檔](https://github.com/ci-yang/TownPass/releases/tag/survival-highlights-demo-20261107)
- 本機：`/Users/ciyang/Downloads/friendly-taipei-survival-20261107.apk`
- 開啟Town Pass → 友善同行 → 城市生存雷達；可按市府試玩、18%手動電量展示。
- 此APK首次開啟需網路；以WebView載入 `https://ci-share.pages.dev/cc521b0047361278/`，不是內嵌Web離線包。撤回該分享頁會影響APK入口。

## 產物
- 116,052,352 bytes（約116MB）。
- SHA-256：`e8332fede5fa878475ff75f6bc8b558c34ba6bbcc3bc1ca447737d518243ef5b`。
- 原生來源：TownPass `8f106f6ba082bf8f66f266c87ca7a0c1f819a0c6`，保留首頁、服務入口與返回台北通。
- 平台wrapper來源：`4fbb9a26d633964f76e258c32f794c87c49741bf`。兩個工作樹建置前後均乾淨；本文件是事後追加。
- 建置開始：2026-11-07T15:58:35.144Z；完成：15:59:08.063Z（臺北23:59），發布已跨到臺北11/8。
- package `com.example.townpass`，versionName `0.0.12`、versionCode `1`；minSdk24、targetSdk36。
- release模式、通用三ABI；沿用Android Debug簽章，與前版同憑證。此為試玩包，不是商店上架簽章。

## 建置方式
```sh
CODEFEST_SERVICE_URL='https://ci-share.pages.dev/cc521b0047361278/' \
TOWNPASS_DIR='/Users/ciyang/Documents/repos/TownPass-route-experience-20261107' \
FLUTTER_BIN='/Users/ciyang/fvm/versions/3.47.6/bin/flutter' \
DART_BIN='/Users/ciyang/fvm/versions/3.47.6/bin/dart' \
JAVA_HOME='/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home' \
ANDROID_HOME='/Users/ciyang/Library/Android/sdk' \
bash scripts/build-townpass.sh
```
wrapper完成鎖定依賴、產碼、設定檢查、服務URL測試及APK。另以相同兩個URL dart-define執行 `test/codefest_launch_test.dart`，首頁／返回測試11/11通過。

## 獨立驗證
另一代理直接讀成品核對：原始build APK、Downloads、副檔校驗與receipt的SHA／大小一致，且異於前版；v2簽章有效且同前版憑證；manifest non-debuggable、定位及網路權限存在；三ABI ELF皆含完整試玩URL各一次。ZIP CRC、125份來源素材hash與字型引用皆通過。證據在 [evidence/2026-11-08-survival-apk](evidence/2026-11-08-survival-apk)。

公開URL另經匿名完整下載驗證：HTTP200、116,052,352 bytes及SHA皆與本機相同（11.54秒）；沒有使用Authorization或Cookie，證據見public-download.json。

沒有Android裝置或模擬器連線，未宣稱安裝、GPS、bridge、電池事件或真正離線已通過。既有background location與cleartext設定未在此輪改動。GitHub release以prerelease發布，沒有merge原生或Web分支。
