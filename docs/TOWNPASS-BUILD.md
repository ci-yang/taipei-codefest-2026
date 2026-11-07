# TownPass 建置與服務註冊（Codefest 2026）

實際在 Ci 的 Mac 上跑過的紀錄，日期 2026-11-07。

- Repo：`/Users/ciyang/Documents/repos/TownPass`（origin = `ci-yang/TownPass` fork，upstream = `taipei-doit/TownPass`）
- 分支：`codefest-2026`

## 機器環境（盤點結果）

| 項目 | 狀態 |
|---|---|
| CPU | arm64（Apple Silicon，不會出現 Intel 停止支援警告） |
| Xcode | 26.6（17F113），`xcode-select` 指向 `/Applications/Xcode.app` |
| iOS 模擬器 | iOS 26.5 runtime，有 iPhone 17 Pro / 17 Pro Max / 17e |
| CocoaPods | 1.17.0 |
| Homebrew | 7.0.12 |
| Java | 原本只有 Temurin 1.8。**已補裝** `openjdk@17`（17.0.21），並用 `flutter config --jdk-dir` 指定給 Flutter 用 |
| Android SDK | **已補裝**到 `~/Library/Android/sdk`，只裝 CLI 工具，沒有裝 Android Studio |
| `flutter doctor` | Flutter ✓、Xcode ✓、Chrome ✓、**Android toolchain ✓（Android SDK version 36.0.0，All Android licenses accepted）** |

## 實際走過的指令與耗時

```bash
brew tap leoafarias/fvm && brew install fvm      # 約 11 分鐘（下載 bottle 很慢），裝好 fvm 4.3.2
cd /Users/ciyang/Documents/repos/TownPass
fvm install                                      # 約 13.5 分鐘（clone flutter git cache + 下載 Dart SDK 215MB，約 650KB/s）
fvm flutter --version                            # Flutter 3.47.6 • Dart 3.13.5
fvm flutter doctor -v                            # 首次跑會下載 iOS 相關檔案，約 1 分鐘
fvm flutter pub get                              # 不到 1 分鐘
fvm dart run build_runner build --delete-conflicting-outputs   # 21 秒，wrote 13 outputs
fvm flutter build ios --simulator --debug        # 約 4.5 分鐘（含 pod install 11 秒），✓ Built build/ios/iphonesimulator/Runner.app
```

從零開始總共大約 30 分鐘，其中下載就佔了約 25 分鐘。**比賽現場如果網路擁擠會更慢，要先在家把 `fvm install` 跑完。**

跑在模擬器上：

```bash
open -a Simulator
fvm flutter run -d "iPhone 17 Pro" --dart-define=CODEFEST_SERVICE_URL=http://localhost:5173
```

若要直接測福利雷達服務，先在本 repo 執行 `pnpm dev:web`，再把 URL 改為 `http://localhost:5173/benefits`。既有服務註冊與 `userinfo` bridge 不需修改；一般瀏覽器則用 `/benefits?mockBridge=1` 模擬殼回覆。

（這次是用 `xcrun simctl install/launch` 裝上已經 build 好的 Runner.app，確認 App 能啟動、首頁正常顯示。）

## 踩到的坑

1. **建置會改到 `ios/Podfile.lock`**：pod install 會把 `COCOAPODS: 1.16.2` 改成 1.17.0，`flutter_inappwebview_ios` 的 checksum 也會跟著變。這只是本機雜訊，**不要 commit**，用 `git checkout ios/Podfile.lock` 還原。
2. `flutter_inappwebview_ios` 不支援 Swift Package Manager，會出警告。目前不影響建置。
3. `flutter analyze` 會報 2 個 upstream 本來就有的問題（`trending_service_widget.dart` 有一個沒用到的 import，`pinned_service_widget.dart` 有 underscores 提示），跟我們的改動無關。
4. `build_runner` 產生的檔案（`*.g.dart`、`lib/gen/`）已經被 gitignore，clone 下來後一定要跑一次，不然會編譯失敗。

## 我們在 TownPass 裡改了什麼（最小改動）

| 檔案 | 改動 |
|---|---|
| `lib/config/codefest.dart`（新增） | 常數 `kCodefestServiceUrl`，預設值 `http://10.0.2.2:5173`，可以用 `--dart-define=CODEFEST_SERVICE_URL=...` 覆蓋 |
| `lib/page/city_service/model/my_service_model.dart` | enum 加上 `codefest`，switch 加上 `MyServiceItem`：名稱「台北通通通懂台北」，分類「探索臺北」，icon 先借用 `iconLocationSearch24` |
| `lib/page/city_service/widget/pinned_service_widget_controller.dart` | 把 `codefest` 放在預設釘選清單的第一個，demo 時在服務頁最上方就看得到 |
| `android/app/src/main/AndroidManifest.xml` | 補上 `INTERNET` 權限（upstream 只在 debug/profile manifest 有，release 版載網頁會全白），並加 `usesCleartextTraffic="true"` 讓 App 能連 http 的 dev server。**這是開發期設定，demo 改用 HTTPS 後可以移除** |
| `ios/Runner/Info.plist` | `NSAppTransportSecurity > NSAllowsLocalNetworking = true`，讓 iOS 可以連 localhost / `.local` 的 http |

服務的運作方式：`MyServiceItem.destinationUrl` 不是空字串時，點進去就會用 in-app WebView（flutter_inappwebview）開這個 URL。要改名稱、描述或 icon，改 `my_service_model.dart` 裡 `MyServiceItemId.codefest` 這一段。

## 把 URL 指到開發機

**不用改程式**，build 或 run 時加 `--dart-define` 就好：

| 情境 | URL |
|---|---|
| Android 模擬器 | `http://10.0.2.2:5173`（預設值） |
| iOS 模擬器 | `http://localhost:5173`（模擬器跟 Mac 共用網路） |
| 實機（跟 Mac 在同一個 Wi-Fi） | `http://<Mac 區網 IP>:5173`，IP 用 `ipconfig getifaddr en0` 查。Vite 要加 `--host` 綁定 0.0.0.0 |
| 部署後 | `https://<網域>`，最穩定，也沒有 ATS 或 cleartext 問題 |

範例：`fvm flutter run --dart-define=CODEFEST_SERVICE_URL=http://192.168.1.23:5173`

**iPhone 實機的注意事項（還沒驗證）**：`NSAllowsLocalNetworking` 確定涵蓋 `localhost` 和 `*.local`，但用區網 IP 走 http 時，WKWebView 會不會被 ATS 擋下來，這次沒有測。保險的做法有兩種：(a) 用 `http://<Mac名稱>.local:5173`（`scutil --get LocalHostName` 查名稱）；(b) 直接部署成 https，或用 tunnel 拿到一個 https URL。

## Android 建置（demo 主線，已實際走過）

### 一次性安裝 toolchain（不需要 Android Studio GUI）

```bash
brew install openjdk@17                                  # 不用 sudo（temurin@17 cask 是 pkg 安裝檔，需要 sudo，所以沒用它）
brew install --cask android-commandlinetools             # 兩個加起來約 1.5 分鐘
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
SDK=$HOME/Library/Android/sdk
yes | sdkmanager --sdk_root=$SDK --licenses
sdkmanager --sdk_root=$SDK "cmdline-tools;latest" "platform-tools" "platforms;android-36" \
  "build-tools;36.0.0" "ndk;29.0.13113456"               # 約 11 分鐘，裝完 3.5GB
fvm flutter config --android-sdk $SDK --jdk-dir $JAVA_HOME
fvm flutter doctor -v                                    # Android toolchain ✓
```

版本依據：`android/app/build.gradle` 裡 compileSdk 用 `flutter.compileSdkVersion`（Flutter 3.47.6 是 36），`ndkVersion = "29.0.13113456"`。

`~/.zshrc` 已經加了以下三行（加之前先 grep 過沒有重複，原檔備份在 `~/.zshrc.bak-2026-11-07`）：

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Build profile APK

```bash
cd /Users/ciyang/Documents/repos/TownPass
fvm flutter build apk --profile --dart-define=CODEFEST_SERVICE_URL=https://codefest.ciyang.dev
# Running Gradle task 'assembleProfile'... 21.7s
# ✓ Built build/app/outputs/flutter-apk/app-profile.apk (160.5MB)
```

- **正式服務網址：`https://codefest.ciyang.dev`**（HTTPS，2026-11-07 用 curl 測 `/healthz` 回 200）。demo 用的 APK 一律用這個網址 build。
- 第一次 build（當時用佔位網址 `codefest.example.invalid`）約 **21 分鐘**，大部分時間花在下載：Gradle 9.3.1、依賴套件，`~/.gradle` 長到 4.5GB。之後再 build 會快很多。
- **網址是 build 時寫死進 APK 的**：換網址就要重新 build。有快取的話，重新 build 實測只要約 **23 秒**。
- 用正式網址重新 build 後，APK 從 139.9MB 變成 160.5MB，原因還沒查（程式碼只差網址字串）。不影響安裝和功能。
- 檢查過產出的 APK（`aapt2 dump`）：有 `INTERNET` 權限、`usesCleartextTraffic=true`、targetSdk 36，三個 ABI 的 `libapp.so` 裡都找得到 `codefest.ciyang.dev`，佔位網址 `example.invalid` 都是 0 筆。
- profile build 用 debug key 簽章（`build.gradle:55`），不用另外準備 keystore，可以直接安裝。

### 踩到的坑（Android）

1. **Gradle 會自己再下載 NDK 28.2.13676358（2.8GB）和 CMake 3.22.1**：雖然專案指定 NDK 29，但有 plugin 用的是 Flutter 預設的 NDK 28.2。因為 license 已經接受過，Gradle 會自動下載，不用手動處理，但很佔空間：Android SDK 裝完約 6.5GB，加上 `~/.gradle` 4.5GB。**磁碟至少要留 12GB 空間。**
2. Gradle 會出一些 deprecated API 的 Note（geolocator_android 等套件），不影響建置。
3. 這次建置又把 `ios/Podfile.lock` 改掉了，改動跟之前一樣是 CocoaPods 版本的雜訊，已經用 `git checkout` 還原。

### 裝到手機、傳給隊友

```bash
adb devices                                              # 手機要開「開發人員選項 → USB 偵錯」，接上 USB 後在手機上按允許
fvm flutter install --profile                            # 或者：
adb install -r build/app/outputs/flutter-apk/app-profile.apk
```

- **隊友不用裝任何 toolchain**：直接把 `app-profile.apk`（約 140MB）用 AirDrop、Google Drive 或 USB 傳過去，在手機上開啟，允許「安裝不明來源應用程式」就能安裝。
- 隊友手機上如果已經有官方台北通，也不會衝突，因為我們的 package 是 `com.example.townpass`。
- **2026-11-07 這次沒有接任何 Android 實機**（`adb devices` 是空的），所以還沒實際裝上手機測試。

## 模擬器 vs 實機、demo 建議

- 這台 Mac 現在 **Android（APK 建置 ✓）和 iOS 模擬器（✓）都能用**。Android 模擬器的 system image 沒有裝，因為 demo 定案用實機。
- **iOS 實機要換 Team 和 bundle id**：`ios/Runner.xcodeproj/project.pbxproj` 寫死的 `DEVELOPMENT_TEAM = ZLLDAN62HX`（第 483、667、691 行）不是我們的 Team。repo 裡沒有改它；要在 Xcode 開 `ios/Runner.xcworkspace` → Signing & Capabilities，**在本機**改成自己的 Apple ID Personal Team，bundle id `com.example.townpass` 也要改成不會撞名的 id（例：`dev.ciyang.townpass.codefest`）。這些本機簽章改動不要 commit。免費帳號簽的 App 7 天後會過期。
- **Demo 建議（team-lead 指示）**：實機 demo 用 **Android 實機跑 profile build**（`fvm flutter run --profile --dart-define=CODEFEST_SERVICE_URL=<URL>`）。Android 不用開發者帳號，main manifest 已經補上 INTERNET 和 cleartext。前提是這台 Mac 先補好 Android SDK 和 Java 17（見待決）。Android 還沒就緒前，備案是用這台 Mac 跑 iOS 模擬器加 `localhost` dev server。
- iOS 模擬器如果要連區網 http：`Info.plist` 已經加了 `NSAllowsLocalNetworking`（開發期設定，涵蓋 localhost 和 `*.local`）。

## 待決

- 還沒裝到 Android 實機：要等手機接上後跑 `adb install`，並確認點服務後 WebView 能打開真的網址。
- `usesCleartextTraffic` 是開發期設定，正式網址改用 HTTPS 後可以從 main manifest 移除。
