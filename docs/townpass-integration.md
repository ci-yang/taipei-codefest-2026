# TownPass 整合手冊：把 Vue 3 微服務掛進城市通並在手機上 demo

> 撰寫：2026-11-07（比賽第 1 天）。對象：工程團隊。照順序做就能動。
> **查證基準**（以下所有 `檔案:行號` 都指這兩個 commit，clone 在 scratchpad，唯讀）：
> - Flutter 殼 `taipei-doit/TownPass` @ `e65b586`（2026-10-17）
> - 微服務 `taipei-doit/TownPass-Services` @ `3274852`（2025-01-09，之後沒有新 commit）
> - 文件站 `https://tpe-guideline.web.app/en/docs/`（2026-11-07 用 curl 抓原始 HTML 讀，不是摘要）
>
> 標記：**[官方原始碼]** 有 檔案:行號；**[官方文件]** 有頁面路徑；**[未在官方 repo 找到，推測]** 是我依平台常識推的，動手前要實測。

---

## 0. 三十秒版

1. 殼只做一件事：按服務按鈕 → `TPRoute.openUri(destinationUrl)` → 推一個 `TPWebView` 頁 → WebView 載入那個 URL，並注入全域 JS 物件 `flutterObject`。
2. 註冊服務 = 改一個檔 `lib/page/city_service/model/my_service_model.dart`（enum 加一個值 + switch 加一個 `MyServiceItem`），想讓它出現在首頁置頂再改 `pinned_service_widget_controller.dart` 一行。
3. Bridge 協定：`flutterObject.postMessage(JSON.stringify({name, data}))` 送出；`flutterObject.addEventListener('message', e => JSON.parse(e.data))` 收回覆。**`postMessage` 不回傳 Promise**（去年文件寫錯，見 §6）。
4. 手機連開發機：Android 的 main manifest **沒有 INTERNET 權限、也沒開 cleartext**，iOS Info.plist **沒有 ATS 例外**。最省事的路是：開發期在我們的 fork 開 cleartext＋用 debug／profile build；demo 當天用 HTTPS 的固定網址。
5. 備援：同一個 Vue build 在一般瀏覽器開 `?mockBridge=1`，mock 會模擬 `flutterObject`。

---

## 1. 架構（文字版）

```
┌─────────────────────────────── 手機 ───────────────────────────────┐
│ TownPass Flutter 殼（我們 fork 的 taipei-doit/TownPass）              │
│  城市服務頁 / 首頁置頂                                                │
│    └─ 點 MyServiceItem → TPRoute.openUri(destinationUrl)              │
│         └─ GetX 推 /web_view → TPWebView                              │
│              └─ InAppWebView（flutter_inappwebview 6.1.5）            │
│                   ├─ addWebMessageListener(jsObjectName: flutterObject)│
│                   │    └─ TPWebMessageListener → 9 個 handler         │
│                   │       （userinfo/location/notify/…，Dart 端執行）  │
│                   └─ loadUrl(destinationUrl) ────────────┐            │
└──────────────────────────────────────────────────────────┼────────────┘
                                                           │ HTTPS
                       ┌───────────────────────────────────▼──────────┐
                       │ 我們的 Vue 3 + Vite 微服務（靜態檔）            │
                       │  useTownPassBridge() ⇄ window.flutterObject   │
                       │  地圖：Leaflet / MapLibre + OSM 圖磚（禁商用地圖）│
                       └───────────────┬──────────────────────────────┘
                                       │ fetch（CORS，HTTPS）
                       ┌───────────────▼──────────────────────────────┐
                       │ 我們的 Hono API                                │
                       └───────┬───────────────────────┬──────────────┘
                               │ SQL                   │ 定時匯入
                       ┌───────▼────────┐     ┌────────▼─────────────────┐
                       │ PostgreSQL +    │     │ 開放資料（data.taipei、     │
                       │ PostGIS         │◀────│ 政府資料開放平臺…，註明來源）│
                       └────────────────┘     └──────────────────────────┘
```

查證過的節點：
- 點按鈕 → `openUri`：`lib/page/city_service/widget/pinned_service_item_widget.dart:24-29`（置頂區，會帶 `forceWebViewTitle`）、`lib/page/city_service_edit/city_service_edit_view.dart:132-135`（「更多服務」頁，**不帶** `forceTitle`）。[官方原始碼]
- `openUri`：空字串直接 return；scheme 是 `local` 走 App 內路由，其他一律開 WebView：`lib/util/tp_route.dart:190-209`。[官方原始碼]
- `/web_view` 路由 → `TPWebView`：`lib/util/tp_route.dart:176-179`。[官方原始碼]
- WebView 先 `await addWebMessageListener(...)` 再呼叫外部 `onWebViewCreated`（裡面才 `loadUrl`），所以頁面載入前 bridge 已註冊：`lib/util/tp_web_view.dart:256-259`、`lib/util/tp_web_view.dart:80-87`。[官方原始碼]
- JS 物件名 `flutterObject`、沒有設 `allowedOriginRules`：`lib/util/web_message_handler/tp_web_message_listener.dart:24-25`。flutter_inappwebview 6.1.5 Android 端未設時預設 `{"*"}`（`flutter_inappwebview_android/lib/src/web_message/web_message_listener.dart:25`，從上游 repo tag v6.1.5 讀）。也就是任何網域都拿得到 `flutterObject`，換網址不用改殼的白名單。[官方原始碼／上游原始碼；iOS 端預設值未查]
- 殼「註冊服務」這段跟 Hono / PostGIS 無關，那兩層是我們自己的。官方微服務的資料全是 `public/mock` 假資料與 localStorage。[官方原始碼：`TownPass-Services/public/mock/`、`src/views/SubscriptionView.vue:42`]

---

## 2. 把服務註冊進 TownPass（最小改動）

官方檔頭就寫了步驟：「先於 MyServiceItemId enum 加入新服務；再在 MyServiceIdExt 擴充中加入該服務的 MyServiceItem 物件」：`lib/page/city_service/model/my_service_model.dart:4-8`。[官方原始碼] 文件站 `flutter/taipeipass-service/custom-design.html` 講的是同一件事。[官方文件]

### 2.1 必改：`lib/page/city_service/model/my_service_model.dart`

(a) enum 加值（目前 21 個，最後一個是 `zoo`，在 `:31`，`;` 在 `:32`）：

```dart
enum MyServiceItemId {
  // ...既有項目
  zoo,
  ourService, // ← 新增
  ;
}
```

(b) `MyServiceIdExt.item` 的 switch 加一支（switch 在 `:37-186`；Dart 3 的 switch expression 要窮舉，**少加這支會編譯失敗**）：

```dart
      MyServiceItemId.ourService => MyServiceItem(
          title: '我們的服務',          // 按鈕文字
          description: '一句話說明',     // 「更多服務／編輯」頁顯示
          icon: Assets.svg.iconLocationSearch24.svg(), // 先借既有 icon，見 2.3
          category: MyServiceCategory.cityLife,          // cityService/healthCare/cityLife/explore/other
          destinationUrl: const String.fromEnvironment(
            'CODEFEST_SERVICE_URL',
            defaultValue: 'https://<demo 網域>/',
          ),
          forceWebViewTitle: '我們的服務', // 可省；省略時用網頁 <title>
        ),
```

- `MyServiceItem` 欄位定義：`my_service_model.dart:190-206`（`forceWebViewTitle` 選填）。[官方原始碼]
- 分類 enum 與中文標題：`my_service_model.dart:208-227`。[官方原始碼]
- `String.fromEnvironment` + `--dart-define` 讓同一份程式碼切換開發機網址和 demo 網址，不用改 code 重 commit。這是我們加的做法。[未在官方 repo 找到，推測：Dart 標準功能，官方 repo 是寫死字串]
- `destinationUrl` 為空字串時按了沒反應（`pinned_service_item_widget.dart:25-30` 的 `false => null`）。很多官方項目就是空字串，不要誤以為是 bug。[官方原始碼]

### 2.2 建議改：讓它出現在首頁「置頂」，demo 少點一層

`lib/page/city_service/widget/pinned_service_widget_controller.dart:5-11` 是預設置頂清單（現在是 `locationSearch, districtOffice, dashboard`），把 `MyServiceItemId.ourService` 放第一個。置頂上限 12 個（同檔 `:27-30`）。[官方原始碼]
另外有一個「熱門服務」清單 `lib/page/city_service/model/trending_service_model.dart:5-26`（`:23` 有「在此列表後加入新熱門按鈕」註解），想多一個入口可以加。[官方原始碼]

> 置頂清單存在 `RxList` 記憶體裡，看不出有持久化。改預設值後要**冷啟動 App** 才看得到。[官方原始碼看到的是 in-memory；有沒有其他地方持久化，我沒有全 repo 查，推測]

### 2.3 自訂 icon（可選）

SVG 放 `assets/svg/`，snake_case 命名，透過 flutter_gen 產生 `Assets.svg.<camelCase>.svg()`；**加完要重跑 `dart run build_runner build`**，否則 `Assets.svg.xxx` 不存在、編譯失敗。[官方文件 `flutter/taipeipass-service/custom-design.html`；`pubspec.yaml:61-62` 有 `build_runner`、`flutter_gen_runner`]

### 2.4 執行指令

```bash
fvm install                      # 讀 .fvmrc → Flutter 3.47.6
fvm flutter pub get
fvm dart run build_runner build
fvm flutter run --dart-define=CODEFEST_SERVICE_URL=https://<網址>/
```

- `.fvmrc` 鎖 `"flutter": "3.47.6"`；文件說對應 Dart 3.13.5，版本低於 3.47 時 `pub get` 會失敗。[官方原始碼 `.fvmrc:2`；官方文件 `flutter/home/project-setup.html`]
- `pubspec.yaml:22` `sdk: '>=3.13.0 <4.0.0'`。[官方原始碼]
- README 寫的是不加 `fvm` 前綴的 `flutter pub get` / `dart run build_runner build` / `flutter run`（`README.md` "Build the Project" 段）。用 FVM 就全部加 `fvm` 前綴。[官方原始碼／官方文件]

### 2.5 不需要改的部分

- 現有 9 個 handler 夠用就**不要動** `tp_web_message_handler.dart`／`tp_web_message_listener.dart`。需要自訂 handler 的做法：繼承 `TPWebMessageHandler`，加進 `_cachedMessageHandlers`（`tp_web_message_listener.dart:9-19`）。[官方原始碼；官方文件 `two-way-connection/app.html`]
- 回覆的 `data` 必須能被 `jsonEncode`（number/bool/string/null/list/map/有 `toJson()` 的物件）。[官方文件 `two-way-connection/app.html`]

---

## 3. JS Bridge：六個方法的格式與 composable

### 3.1 協定本體

| 方向 | 怎麼做 | 出處 |
|---|---|---|
| Web → App | `flutterObject.postMessage(JSON.stringify({ name, data }))`，**只收一個字串** | `TownPass-Services/src/composables/useConnectionMessage.ts:14-21`；文件 `two-way-connection/web.html` |
| App 解析 | `jsonDecode(webMessage.data)`，用 `dataMap['name']` 比對 handler，把 `dataMap['data']` 傳進去 | `tp_web_message_listener.dart:31-41` |
| App → Web | `replyProxy.postMessage(WebMessage(type: STRING, data: jsonEncode({name, data})))` | `tp_web_message_reply.dart:23-32`、`tp_web_message_listener.dart:38` |
| Web 收 | `flutterObject.addEventListener('message', e => JSON.parse(e.data))` 或 `onmessage` | `TownPass-Services/src/composables/useHandleConnectionData.ts:9-22`；文件 `two-way-connection/web.html` |

要點：
- **回覆沒有 request id**，只能用 `name` 對應。同一個頁面兩處同時要 `location`，兩個 listener 都會收到同一則回覆。[官方原始碼 `tp_web_message_reply.dart:26-31` 只有 name、data]
- 官方建議每個 view 只掛一次 listener，unmount 時移除（`useHandleConnectionData.ts:7`、`:16-19`）；文件也警告 listener 是全域的，要注意生命週期。[官方原始碼／官方文件]
- 官方沒有 mock bridge：`flutterObject` 不存在時 `useConnectionMessage` 什麼都不做（`useConnectionMessage.ts:16`）。[官方原始碼]
- 官方 composable 用 `// @ts-ignore` 跳過型別（`useConnectionMessage.ts:15,19`），沒有型別宣告檔（`types/` 只有 `body-scroll-lock.d.ts`）。[官方原始碼]

### 3.2 六個方法（另附殼內實際還有的 3 個）

Handler 實作都在 `lib/util/web_message_handler/tp_web_message_handler.dart`，以下簡稱 `handler.dart`。

| name | 送出 data | 回覆 data | 會不會回覆 | 出處 |
|---|---|---|---|---|
| `userinfo` | `null` | Account 物件；沒帳號時 `[]` | 一定回 | `handler.dart:39-54`；文件 `app_method.html#userinfo` |
| `launch_map` | URL 字串 | `bool`（`canLaunchUrl` 結果），true 時接著開啟 | 一定回 | `handler.dart:56-83` |
| `phone_call` | 電話字串，例 `"02-1234-5678"` | `bool`，true 時撥 `tel://<data>` | 一定回 | `handler.dart:142-169` |
| `location` | `null` | geolocator `Position.toJson()`；**失敗回 `[]`** | 一定回 | `handler.dart:171-195` |
| `deviceinfo` | `null` | device_info_plus 的 `BaseDeviceInfo.data`；無資料 `[]` | 一定回 | `handler.dart:197-212` |
| `notify` | `{ title, content }` | 失敗才回 `false` | **成功時不回** | `handler.dart:234-265`；文件 `app_method.html#notify` |
| `open_link`（額外） | URL 字串 | `null` data 時回 `false` | 成功不回 | `handler.dart:214-232` |
| `qr_code_scan`（額外） | `null` | 掃到的字串；按返回為 `null` | 一定回 | `handler.dart:267-283` |
| `1999agree`（額外） | 非 null 任意值 | 不能撥或不同意條款時 `false` | 顯示撥號對話框時不回 | `handler.dart:85-140` |

9 個 handler 註冊清單：`tp_web_message_listener.dart:9-19`。[官方原始碼]

**各方法細節：**

**userinfo**
```json
→ {"name":"userinfo","data":null}
← {"name":"userinfo","data":{"id":"…","account":"…","username":"…","realName":"…","idNo":"…","email":"…","phoneNo":"…","birthday":"1988/12/12","memberType":"personal","verifyLevel":"3","addresses":[{"zip3":104,"city":"臺北市","town":"中山區","village":"…","street":"…","usageType":"0","seq":1,"priority":true}],"residentAddress":"…","citizen":true,"nativePeople":false,"cityInternetUid":""}}
```
- 欄位與 `@JsonKey` 名稱：`lib/bean/account.dart:39-84`（`idNo`、`phoneNo`、`addresses` 是 JSON key，不是 Dart 欄位名）。`memberType` 值 `personal/organization/foreigner/employee`；`verifyLevel` `"0"` 未驗證、大於 0 為實名。[官方原始碼／官方文件 `app_method.html`]
- **開源殼沒有真的登入**：`AccountService.init()` 從 `assets/mock_data/account.json` 讀固定假帳號（`lib/service/account_service.dart:13-19`）。demo 時 userinfo 永遠是同一個假人，不要把「依身分個人化」當主賣點，也不要在畫面上秀出 `idNo`。[官方原始碼]

**launch_map**
```json
→ {"name":"launch_map","data":"https://www.openstreetmap.org/?mlat=25.0375&mlon=121.5637#map=18/25.0375/121.5637"}
← {"name":"launch_map","data":true}
```
- 官方文件範例是 Google Maps 短網址；比賽禁商用地圖，我們傳 OSM 網址或 `geo:` URI。外部 App 能不能處理 `geo:`，取決於手機上裝了什麼。[官方文件；`geo:` 部分為推測]
- 坑：`data` 不是字串時，handler 先回 `false`，但**沒有 return**，接著 `message as String` 會拋例外（`handler.dart:67-72`）。composable 已先擋空值。[官方原始碼]

**phone_call**
```json
→ {"name":"phone_call","data":"02-1234-5678"}
← {"name":"phone_call","data":true}
```
- 同一種沒 return 的坑：`data` 為 null 時回 false，接著 `message!` 拋例外（`handler.dart:153-158`）。模擬器通常 `canLaunchUrl(tel:)` 為 false。[官方原始碼；模擬器行為為推測]

**location**
```json
→ {"name":"location","data":null}
← {"name":"location","data":{"latitude":25.03,"longitude":121.56,"timestamp":1724466344054,"accuracy":5.0,"altitude":0.0,"altitude_accuracy":0.0,"floor":null,"heading":-1.0,"heading_accuracy":-1.0,"speed":0.0,"speed_accuracy":0.0,"is_mocked":false, …}}
← 失敗：{"name":"location","data":[]}
```
- 失敗（定位服務沒開、權限拒絕、永久拒絕）一律 `[]`：`handler.dart:182-193`。拒絕原因只在 Dart log，Web 端分不出是哪一種（`lib/service/geo_locator_service.dart:9-35` 的三種 `Future.error`）。[官方原始碼]
- 第一次呼叫時 App 才會跳系統權限框（`geo_locator_service.dart:20-23`）。[官方原始碼]
- 文件站列的欄位還有 `vertical_speed`、`has_*` 等，那些取決於 geolocator 版本（lock 檔是 `geolocator 14.1.1`，`pubspec.lock:560-567`）。**只依賴 `latitude`／`longitude`／`timestamp`**。[官方文件 `app_method.html#location`；官方原始碼]
- 另一條路：`TPWebView` 對網頁的 `navigator.geolocation` 權限請求一律自動允許（`tp_web_view.dart:97-100`，這是 Android WebView 的 callback）。所以 Android 殼內 `navigator.geolocation` 可能也能用，但官方範例走 bridge，我們也以 bridge 為主。[官方原始碼；iOS 行為未查]

**deviceinfo**
```json
→ {"name":"deviceinfo","data":null}
← {"name":"deviceinfo","data":{"systemName":"iOS","model":"iPhone","systemVersion":"17.x", …}}   // Android 是 android.os.Build 欄位
```
- iOS 與 Android 欄位完全不同，文件站各給一份範例。[官方文件 `app_method.html#deviceinfo`；`lib/service/device_service.dart:11-14`]

**notify**
```json
→ {"name":"notify","data":{"title":"訂閱通知","content":"已訂閱信義區施工資訊"}}
（成功：沒有回覆）
← 失敗：{"name":"notify","data":false}
```
- `content` 符合 `已訂閱(.+)` 時把後面的字加進 App 的訂閱清單；符合 `已取消訂閱(.+)` 時移除（`handler.dart:252-259`）。只認中文字串。[官方原始碼；官方文件 `app_method.html#notify`]
- 官方範例：`TownPass-Services/src/views/SubscriptionView.vue:37-40`。[官方原始碼]
- 坑：`content` 缺少時 `final String content = json['content']` 會拋例外（`handler.dart:252`），通知已經跳出去但流程中斷。**一定要帶字串 `content`**。[官方原始碼]
- **不要 await 回覆**，成功時永遠等不到。

### 3.3 `useTownPassBridge.ts`（可直接貼進 `src/composables/`）

設計：
- 一個全域 listener、依 `name` 的 FIFO 佇列把回覆配對回 Promise；預設逾時 10 秒。
- `notify` 不等回覆，只回 `true`（已送出）或 `null`（不在殼內）。
- bridge 不存在：`location` 改用 `navigator.geolocation`，其餘回 `null` 並 `console.warn`。
- `location` 失敗（App 回 `[]`、瀏覽器拒絕、逾時）一律回 `[]`。
- `userinfo`／`deviceinfo` 的 App 回 `[]` 時正規化成 `null`。

驗證：在 scratchpad 用 `typescript@5.4.5`（官方 Services 用 `~5.4.0`）+ `vue@3.4.21` 跑 `tsc --strict --noEmit`，0 錯誤。另用 esbuild 打包、在 Node 裡做 smoke test：無 bridge 時 userinfo=null、location=[]；裝 mock 後 userinfo／location（兩個並發）／deviceinfo／launch_map／notify 都回預期值；App 回 `[]` 時 location=[]、userinfo=null；不回覆時 location 逾時回 []。**沒有在真機或 TownPass 殼內跑過**，第一次上手機要照 §5 的 smoke 步驟驗。

```ts
/**
 * useTownPassBridge — TownPass（城市通）Flutter 殼 JS bridge 的 Vue 3 composable
 *
 * 協定（已對官方原始碼查證）：
 * - 殼注入全域物件 `flutterObject`（flutter_inappwebview WebMessageListener）。
 * - Web → App：flutterObject.postMessage(JSON.stringify({ name, data }))，只收一個字串，回傳值不是 Promise。
 * - App → Web：flutterObject 的 'message' 事件，event.data 是 JSON 字串 {"name": ..., "data": ...}。
 * - 回覆沒有 request id，只能用 name 對應；同名請求以 FIFO 配對。
 * - notify / open_link / 1999agree 成功時「不回覆」，只有失敗才回 false，所以不能 await 它們的回覆。
 *
 * 降級：bridge 不存在（一般瀏覽器）時，location 改用 navigator.geolocation，其餘回 null 並 console.warn。
 * location 失敗（權限被拒、逾時、無定位）一律回 []，與 App 端行為一致。
 */
import { onScopeDispose, getCurrentScope, ref, type Ref } from 'vue';

// ---------- 型別 ----------

export type BridgeName =
  | 'userinfo'
  | 'launch_map'
  | 'phone_call'
  | 'location'
  | 'deviceinfo'
  | 'notify'
  | 'open_link'
  | 'qr_code_scan'
  | '1999agree';

export interface TownPassAddress {
  zip3: number;
  city: string;
  town: string;
  village: string;
  street: string;
  usageType: string;
  seq: number;
  priority: boolean;
}

export interface TownPassUser {
  id: string;
  account: string;
  username: string;
  realName: string;
  idNo: string;
  email: string;
  phoneNo: string;
  birthday: string;
  memberType: string;
  verifyLevel: string;
  addresses: TownPassAddress[];
  residentAddress: string;
  citizen: boolean;
  nativePeople: boolean;
  cityInternetUid: string;
}

/** geolocator Position.toJson()；只有 latitude / longitude / timestamp 保證存在 */
export interface TownPassPosition {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  altitude_accuracy?: number;
  heading?: number;
  heading_accuracy?: number;
  speed?: number;
  speed_accuracy?: number;
  floor?: number | null;
  is_mocked?: boolean;
  [key: string]: unknown;
}

/** 失敗時 App 回 []（tp_web_message_handler.dart LocationMessageHandler） */
export type LocationResult = TownPassPosition | [];

export type DeviceInfo = Record<string, unknown>;

interface BridgeMessage<T = unknown> {
  name: string;
  data: T;
}

interface FlutterObject {
  postMessage(message: string): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

declare global {
  interface Window {
    flutterObject?: FlutterObject;
  }
}

// ---------- 底層：單一全域 listener + 依 name 的 FIFO 佇列 ----------

const DEFAULT_TIMEOUT_MS = 10_000;

interface Pending {
  resolve: (data: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingByName = new Map<string, Pending[]>();
let listenerAttachedTo: FlutterObject | null = null;

function getFlutterObject(): FlutterObject | null {
  if (typeof window === 'undefined') return null;
  const obj = window.flutterObject;
  return obj && typeof obj.postMessage === 'function' ? obj : null;
}

export function isTownPassBridgeAvailable(): boolean {
  return getFlutterObject() !== null;
}

function onBridgeMessage(event: { data: unknown }): void {
  let msg: BridgeMessage | null = null;
  try {
    msg = typeof event.data === 'string' ? (JSON.parse(event.data) as BridgeMessage) : (event.data as BridgeMessage);
  } catch {
    console.warn('[TownPassBridge] 無法解析 App 回傳：', event.data);
    return;
  }
  if (!msg || typeof msg.name !== 'string') return;
  const queue = pendingByName.get(msg.name);
  const head = queue?.shift();
  if (!head) return; // 不是我們發的（例如官方 useHandleConnectionData 的請求），忽略
  clearTimeout(head.timer);
  head.resolve(msg.data);
}

function ensureListener(obj: FlutterObject): void {
  if (listenerAttachedTo === obj) return;
  obj.addEventListener('message', onBridgeMessage);
  listenerAttachedTo = obj;
}

/** 送出但不等回覆（notify / open_link / 1999agree 用） */
function post<T>(name: BridgeName, data: T): boolean {
  const obj = getFlutterObject();
  if (!obj) return false;
  ensureListener(obj);
  obj.postMessage(JSON.stringify({ name, data }));
  return true;
}

/** 送出並等同名回覆；逾時回 timeoutValue */
function request<T, R>(name: BridgeName, data: T, timeoutValue: R, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown | R> {
  const obj = getFlutterObject();
  if (!obj) return Promise.resolve(timeoutValue);
  ensureListener(obj);
  return new Promise((resolve) => {
    const entry: Pending = {
      resolve,
      timer: setTimeout(() => {
        const queue = pendingByName.get(name);
        const idx = queue?.indexOf(entry) ?? -1;
        if (queue && idx >= 0) queue.splice(idx, 1);
        console.warn(`[TownPassBridge] ${name} 等待回覆逾時 ${timeoutMs}ms`);
        resolve(timeoutValue);
      }, timeoutMs),
    };
    const queue = pendingByName.get(name) ?? [];
    queue.push(entry);
    pendingByName.set(name, queue);
    obj.postMessage(JSON.stringify({ name, data }));
  });
}

function warnNoBridge(name: string): null {
  console.warn(`[TownPassBridge] 找不到 flutterObject（非 TownPass 環境），${name} 回傳 null`);
  return null;
}

// ---------- 瀏覽器降級：定位 ----------

function browserLocation(timeoutMs: number): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('[TownPassBridge] 瀏覽器不支援 geolocation，location 回傳 []');
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: pos.timestamp,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? 0,
          altitude_accuracy: pos.coords.altitudeAccuracy ?? 0,
          heading: pos.coords.heading ?? -1,
          speed: pos.coords.speed ?? 0,
          floor: null,
          is_mocked: false,
        }),
      (err) => {
        console.warn(`[TownPassBridge] navigator.geolocation 失敗（code ${err.code}）：${err.message}，回傳 []`);
        resolve([]);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

function isPosition(v: unknown): v is TownPassPosition {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as TownPassPosition).latitude === 'number' &&
    typeof (v as TownPassPosition).longitude === 'number'
  );
}

// ---------- 對外 API ----------

export interface UseTownPassBridge {
  /** 呼叫當下是否在 TownPass 殼內（bridge 物件是否存在） */
  isAvailable: Ref<boolean>;
  getUserInfo(): Promise<TownPassUser | null>;
  getLocation(options?: { timeoutMs?: number }): Promise<LocationResult>;
  getDeviceInfo(): Promise<DeviceInfo | null>;
  /** true = App 判定可開啟並已開啟；false = 不可開啟；null = 非 TownPass 環境 */
  launchMap(url: string): Promise<boolean | null>;
  /** true = 可撥號並已呼叫撥號；false = 不可；null = 非 TownPass 環境 */
  phoneCall(phone: string): Promise<boolean | null>;
  /**
   * 送出本機通知。App 成功時不回覆，所以這裡只代表「已送出」：
   * true = 已交給 App；null = 非 TownPass 環境。
   * content 若為「已訂閱xxx」「已取消訂閱xxx」會被 App 當成訂閱狀態變更。
   */
  notify(title: string, content: string): boolean | null;
}

export function useTownPassBridge(): UseTownPassBridge {
  const isAvailable = ref(isTownPassBridgeAvailable());

  // iOS 上 flutterObject 可能比 setup 晚一點出現：短暫輪詢 3 秒更新旗標
  if (!isAvailable.value && typeof window !== 'undefined') {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (isTownPassBridgeAvailable()) {
        isAvailable.value = true;
        clearInterval(timer);
      } else if (tries >= 15) {
        clearInterval(timer);
      }
    }, 200);
    if (getCurrentScope()) onScopeDispose(() => clearInterval(timer));
  }

  async function getUserInfo(): Promise<TownPassUser | null> {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('userinfo');
    const data = await request('userinfo', null, null);
    // App 沒有帳號時回 []
    if (!data || Array.isArray(data)) return null;
    return data as TownPassUser;
  }

  async function getLocation(options: { timeoutMs?: number } = {}): Promise<LocationResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!isTownPassBridgeAvailable()) {
      console.warn('[TownPassBridge] 非 TownPass 環境，location 改用 navigator.geolocation');
      return browserLocation(timeoutMs);
    }
    const data = await request('location', null, [] as [], timeoutMs);
    return isPosition(data) ? data : [];
  }

  async function getDeviceInfo(): Promise<DeviceInfo | null> {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('deviceinfo');
    const data = await request('deviceinfo', null, null);
    if (!data || Array.isArray(data)) return null;
    return data as DeviceInfo;
  }

  async function launchMap(url: string): Promise<boolean | null> {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('launch_map');
    // 官方 handler 在 data 非字串時會先回 false 再拋例外，所以這裡先擋
    if (typeof url !== 'string' || url.length === 0) return false;
    const data = await request('launch_map', url, null);
    return typeof data === 'boolean' ? data : null;
  }

  async function phoneCall(phone: string): Promise<boolean | null> {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('phone_call');
    if (typeof phone !== 'string' || phone.length === 0) return false;
    const data = await request('phone_call', phone, null);
    return typeof data === 'boolean' ? data : null;
  }

  function notify(title: string, content: string): boolean | null {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('notify');
    return post('notify', { title, content });
  }

  return { isAvailable, getUserInfo, getLocation, getDeviceInfo, launchMap, phoneCall, notify };
}
```

在 view 裡用（官方建議只在 `/views` 層呼叫 bridge，`useConnectionMessage.ts:12`）：

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useTownPassBridge, type LocationResult } from '@/composables/useTownPassBridge';

const bridge = useTownPassBridge();
const pos = ref<LocationResult>([]);

onMounted(async () => {
  pos.value = await bridge.getLocation();
  if (Array.isArray(pos.value)) {
    // 顯示「請開啟定位權限」並提供重試按鈕
  }
});
</script>
```

### 3.4 `mockTownPassBridge.ts`（備援與本機開發）

在 `main.ts` 最前面呼叫 `installMockTownPassBridge()`。只有網址帶 `?mockBridge=1` 或 `VITE_MOCK_BRIDGE=1` 時才裝，且偵測到真的 `flutterObject` 就不覆蓋，所以同一個 build 可以同時放進殼和瀏覽器。回覆格式照官方 `TPWebStringMessageReply`，`notify` 成功時不回覆，跟真殼一樣。

```ts
/**
 * mockTownPassBridge — 在一般瀏覽器裡模擬 TownPass 的 flutterObject，給 demo 備援與本機開發用。
 * 只在 URL 帶 ?mockBridge=1 或 VITE_MOCK_BRIDGE=1 時安裝；真的在 TownPass 殼內（flutterObject 已存在）時不覆蓋。
 * 回覆格式照官方 TPWebStringMessageReply：event.data = JSON 字串 {"name","data"}。
 * 使用者資料全部是假資料。
 */
type Listener = (event: { data: unknown }) => void;

const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  account: 'demo',
  username: 'Demo',
  realName: '測試市民',
  idNo: 'A000000000',
  email: 'demo@example.com',
  phoneNo: '0900000000',
  birthday: '1990/01/01',
  memberType: 'personal',
  verifyLevel: '1',
  addresses: [
    { zip3: 110, city: '臺北市', town: '信義區', village: '', street: '市府路', usageType: '0', seq: 1, priority: true },
  ],
  residentAddress: '臺北市信義區市府路1號',
  citizen: true,
  nativePeople: false,
  cityInternetUid: '',
};

// 臺北市政府附近
const MOCK_POSITION = { latitude: 25.0375, longitude: 121.5637, timestamp: 0, accuracy: 10, floor: null, is_mocked: true };

export function installMockTownPassBridge(force = false): boolean {
  if (typeof window === 'undefined') return false;
  const enabled =
    force ||
    new URLSearchParams(window.location.search).get('mockBridge') === '1' ||
    import.meta.env?.VITE_MOCK_BRIDGE === '1';
  if (!enabled || window.flutterObject) return false;

  const listeners = new Set<Listener>();
  const reply = (name: string, data: unknown) =>
    setTimeout(() => listeners.forEach((l) => l({ data: JSON.stringify({ name, data }) })), 150);

  window.flutterObject = {
    postMessage(raw: string) {
      const { name, data } = JSON.parse(raw) as { name: string; data: unknown };
      console.info('[mockBridge] ←', name, data);
      switch (name) {
        case 'userinfo':
          return reply(name, MOCK_USER);
        case 'location':
          return reply(name, { ...MOCK_POSITION, timestamp: Date.now() });
        case 'deviceinfo':
          return reply(name, { systemName: 'MockOS', isPhysicalDevice: false, model: 'Browser' });
        case 'launch_map':
          if (typeof data === 'string') window.open(data, '_blank');
          return reply(name, typeof data === 'string');
        case 'phone_call':
          return reply(name, typeof data === 'string');
        case 'notify': {
          const d = data as { title?: string; content?: string } | null;
          if (!d || typeof d !== 'object') return reply(name, false);
          console.info(`[mockBridge] 通知：${d.title} / ${d.content}`);
          return; // 官方 App 成功時不回覆
        }
        default:
          console.warn('[mockBridge] 未模擬的 handler：', name);
      }
    },
    addEventListener: (_type: 'message', l: Listener) => void listeners.add(l),
    removeEventListener: (_type: 'message', l: Listener) => void listeners.delete(l),
  };
  console.info('[mockBridge] 已安裝模擬 flutterObject');
  return true;
}
```

```ts
// src/main.ts
import { installMockTownPassBridge } from '@/composables/mockTownPassBridge';
installMockTownPassBridge();
// ...createApp(App).use(router).mount('#app')
```

---

## 4. 本機開發：手機上的 TownPass 連開發機的 Vite

### 4.1 先知道殼的網路設定（這是卡關主因）

| 平台 | 現況 | 影響 | 出處 |
|---|---|---|---|
| Android | main manifest **只有** `ACCESS_FINE_LOCATION`、`ACCESS_BACKGROUND_LOCATION` 兩個權限，**沒有 `INTERNET`** | `INTERNET` 只寫在 `src/debug` 和 `src/profile` 的 manifest。**`--release` build 會連不上網**，debug／profile 沒問題 | `android/app/src/main/AndroidManifest.xml:1-3`；`android/app/src/debug/AndroidManifest.xml:6`；`android/app/src/profile/AndroidManifest.xml:6` |
| Android | `<application>` 沒有 `android:usesCleartextTraffic`，`res/xml/` 只有 `path_provider_paths.xml`，沒有 network security config | targetSdk ≥ 28 時預設擋明文 HTTP，WebView 載 `http://192.168.x.x:5173` 預期出現 `net::ERR_CLEARTEXT_NOT_PERMITTED` | `AndroidManifest.xml:4-7`；擋 HTTP 是 Android 平台預設行為 [推測，未實測] |
| iOS | `Info.plist` 沒有 `NSAppTransportSecurity` | ATS 預設擋 HTTP；連區網 IP 是否被擋，我沒有查到確定答案 | `ios/Runner/Info.plist`（grep 無此 key）[ATS 對 IP 的行為：推測] |
| iOS | 簽章 `DEVELOPMENT_TEAM = ZLLDAN62HX`、bundle id `com.example.townpass` | 要換成我們自己的 Team；免費 Apple ID 的 bundle id 要唯一，很可能也要改 | `ios/Runner.xcodeproj/project.pbxproj:483,491` [bundle id 衝突為推測] |
| iOS | 最低版本 15.0／15.5 | 舊 iPhone 跑不了 | `project.pbxproj:467,486`；`ios/Podfile:2`（註解狀態） |
| Android | applicationId `com.example.townpass` | 跟其他隊伍的 build 同時裝會互相覆蓋 | `android/app/build.gradle:42` |

### 4.2 推薦做法（依穩定度排序）

**A. 開發期：區網 HTTP + fork 開 cleartext（最快）**

1. Vite 對外綁定：`pnpm dev --host`（或 `vite.config.ts` 設 `server: { host: true, port: 5173 }`）。官方 `vite.config.ts:7-16` 沒設 `server`，預設只聽 localhost，手機連不到。[官方原始碼；Vite 預設行為]
2. 我們的 TownPass fork 加（**只在比賽 fork，不要送回官方**）：
   - Android `AndroidManifest.xml`：`<uses-permission android:name="android.permission.INTERNET" />`，`<application android:usesCleartextTraffic="true" ...>`
   - iOS `Info.plist`：`NSAppTransportSecurity` → `NSAllowsArbitraryLoads = true`（開發用；demo 改 HTTPS 後可以拿掉）
3. `fvm flutter run --dart-define=CODEFEST_SERVICE_URL=http://<開發機區網 IP>:5173/`
4. 手機和開發機要在同一個 Wi-Fi。**比賽場館 Wi-Fi 很可能開了 client isolation**（裝置之間不能互連）[推測]，連不到就改用開發機開熱點，或走 B。

**B. 需要 HTTPS 時：tunnel**

- `cloudflared tunnel --url http://localhost:5173`：cloudflared 本身是 Apache-2.0 開源，但服務是 Cloudflare 的。它只用在開發與 demo 連線，不會打包進作品，應該不違反「作品只能用開源套件」[推測，規則原文沒提到開發工具，要問主辦]。這台機器目前**沒裝 cloudflared**。
- 純開源、可自架的替代：`frp`（Apache-2.0，要有一台有公開 IP 的機器跑 frps，再配 Caddy 自動簽憑證）；`localtunnel`（MIT，用公共的 loca.lt 伺服器，穩定度差）。`bore` 只轉 TCP、沒有 HTTPS，不適合拿來解 ATS／cleartext。[推測，未實測]
- Vite 開 tunnel 時要允許外部 Host：Vite 5.2.8（官方鎖的版本）不檢查 Host header。我們如果用 Vite ≥ 6，新版有 `server.allowedHosts` 檢查，要把 tunnel 網域加進去，否則回 403。[推測：依 Vite 2025 年的安全修補，請以實際版本為準]
- **自簽憑證不要用**：`TPInAppWebView` 沒有接 `onReceivedServerTrustAuthRequest`（`tp_web_view.dart:298` 只是透傳 null），WebView 預期會拒絕自簽憑證。[推測]

**C. Android 免網路：adb reverse**

`adb reverse tcp:5173 tcp:5173`，然後 `CODEFEST_SERVICE_URL=http://localhost:5173/`。不吃 Wi-Fi，但 localhost 的 HTTP 是否也被 cleartext 政策擋，我不確定，所以同樣要開 A 的 cleartext。[推測]

### 4.3 除錯

- Android：`chrome://inspect` 看 WebView console。debug build 中 flutter_inappwebview 是否預設開啟 inspectable，官方 repo 沒有設定 `initialSettings`（`TPWebView` 沒傳）[推測：debug build 應可 inspect，未實測]。
- iOS：Safari → 開發 → 裝置名稱，需在 iPhone 設定開啟「網頁檢閱器」。iOS 16.4+ 要 `isInspectable`，官方沒設 [推測]。真的看不到時，就用畫面上的 debug 面板把 bridge 回覆印出來。
- 網頁標題：沒有 `forceWebViewTitle` 時，App bar 顯示網頁的 `<title>`（`tp_web_view.dart:91-96`）。**每個 route 都要設 `document.title`**。官方 Services 的 #4、#6 issue 就是標題錯誤（facts §4）。
- 返回鍵：App bar 左上的返回鍵依 WebView history 顯示（`tp_web_view.dart:56-66,88-90`），右上 X 直接關 WebView（`:68-74`）。Vue Router 用 `createWebHistory`（官方 `src/router/index.ts:50`）就會有 history。部署時靜態主機要設 SPA fallback（所有路徑回 `index.html`），否則重新整理子路由會 404。
- `window.close()` 會觸發 `onCloseWindow` → `Get.back()` 關掉 WebView（`tp_web_view.dart:101`）。可以用來做「完成」按鈕。[官方原始碼]

### 4.4 API（Hono）要注意

- WebView 的 origin 是微服務網域，Hono 要開 CORS 允許那個 origin（或 demo 時直接同網域反代 `/api`，避開 CORS）。
- 微服務是 HTTPS 時，API 也必須是 HTTPS（mixed content 會被擋）。最簡單：前端與 API 同網域、同一個反代。[推測，Web 標準行為]

---

## 5. Demo 當天 checklist

**今天（11/07）就要決定並記錄：**

- [ ] **Demo 主機與手機**：建議 **Android 實機 + profile build**。iOS 要 Apple 開發者帳號或免費 Apple ID（免費簽章 7 天過期 [推測]），還要改 Team／bundle id（§4.1）。
- [ ] **開發機要先裝 FVM 和 Flutter 3.47.6**：這台機器（Ci 的 Mac）**目前沒有 `fvm` 也沒有 `flutter`**（`which` 查不到），Android SDK／Xcode 狀態沒查。第一件事就是裝，下載量大，**避開場館 Wi-Fi**，用手機熱點或先在家裝好。
- [ ] **Build 時間**：沒有實測。估計第一次 `pub get` + `build_runner` + Gradle 首次 build 是十幾分鐘等級，之後增量 build 1–3 分鐘 [估計，未實測]。第一次 build 一定要在 11/07 白天跑完，不要留到晚上。
- [ ] **兩個 fork 各自凍結 commit**：TownPass fork（殼）與我們的 monorepo（服務＋API）各記一個 SHA，寫進 README。凍結後只修 demo blocker。
- [ ] **服務網址固定**：demo 用固定 HTTPS 網址，透過 `--dart-define=CODEFEST_SERVICE_URL=...` 打進 APK，不要依賴開發機 IP。

**Build 與安裝（凍結後）：**

```bash
cd townpass-fork
fvm flutter clean && fvm flutter pub get && fvm dart run build_runner build
fvm flutter build apk --profile --dart-define=CODEFEST_SERVICE_URL=https://<demo 網址>/
adb install -r build/app/outputs/flutter-apk/app-profile.apk
```
- 若要 `--release`：**必須先在 main manifest 加 `INTERNET` 權限**（§4.1 第一列），否則 WebView 全白。
- 準備 2 台手機都裝好同一顆 APK。

**上台前 30 分鐘 smoke（每台手機）：**

- [ ] 冷啟動 App → 首頁置頂看得到我們的服務 → 點進去 → App bar 標題對
- [ ] 第一次定位 → 系統權限框 → 允許 → 地圖定位到現場
- [ ] 拒絕權限的路徑（另一台手機）→ 畫面顯示引導，不是白畫面
- [ ] notify 有跳通知（Android 13+ 要通知權限 [推測]）
- [ ] 關掉 Wi-Fi 只用行動網路還能開（場館 Wi-Fi 不可靠）
- [ ] 投影：Android 用 `scrcpy`（Apache-2.0）有線鏡像；規則是「只能投影實際運作畫面，禁止簡報」（`docs/competition-rules-digest.md` 成果發表段）

**備援方案（依序）：**

1. 第二台手機，同 APK。
2. 純瀏覽器：筆電 Chrome 開 `https://<demo 網址>/?mockBridge=1`，DevTools 切手機尺寸。功能都在，只有 userinfo／通知是模擬的。**要誠實講這是備援畫面**。
3. 服務掛掉：前端改讀打包進 build 的靜態 JSON 快照（需要事先做，建議 11/08 早上前完成）。
4. 錄好一段 30 秒的真機操作影片。這算不算「實際運作畫面」，要事先問主辦 [規則未明講，推測]。

---

## 6. 已知坑

**Bridge 協定**

1. **`postMessage` 不回傳 Promise**。去年的 `WEBVIEW_BRIDGE_QUICK_REFERENCE.md:15-23,57-61` 寫 `postMessage(...).then(response => …)`；去年的 `frontend/src/services/flutterBridge.ts` 的 `FlutterBridge.call` 也是 `await postMessage` 再 `JSON.parse(response)`。實際上 flutter_inappwebview 的 `postMessage` 沒有回傳值，回覆是從 `message` 事件回來（`tp_web_message_listener.dart:38` 用 `replyProxy.postMessage`）。照去年那樣寫，`JSON.parse(undefined)` 會拋 SyntaxError。去年的 `requestLocation()` 走 event listener，那條路是對的。
2. **回覆沒有 request id**（§3.1）。同名的並發請求會串在一起，要用 FIFO 或避免同時發。
3. **`notify`／`open_link`／`1999agree` 成功時不回覆**（§3.2）。await 它們會卡到逾時。
4. **`launch_map`／`phone_call` 傳 null 會讓 handler 拋例外**（`handler.dart:67-72`、`153-158`）；`notify` 少 `content` 也會拋例外（`:252`）。
5. **location 失敗是 `[]`，不是 null 或 error**（`handler.dart:192`）。判斷要用 `Array.isArray(data)`，或是看 `data.latitude` 有沒有值（官方 `LocationModal.vue:41` 就這樣做）。
6. **listener 全域共用**：一個 view 掛多次、或在 component 層掛，會重複觸發（`useHandleConnectionData.ts:7`；文件 `web.html` 的警告）。
7. **訂閱字串只認中文**：`已訂閱xxx`／`已取消訂閱xxx`，會影響 App 的訂閱清單（`handler.dart:253-259`）。只想跳通知的話，`content` 不要用這兩個開頭。
8. **userinfo 是假帳號**（`account_service.dart:14`），demo 時不要秀 `idNo`。

**殼與平台**

9. **Android release 沒有 INTERNET 權限**（§4.1）。這是最容易在 demo 前一晚才爆的坑。
10. **Cleartext／ATS**：HTTP 開發網址在兩個平台都預期會被擋，要開例外或改走 HTTPS（§4.2）。
11. **`destinationUrl` 空字串時按了沒反應**；`category` 決定它出現在「更多服務」的哪一區（`city_service_edit_view_controller.dart:6-15`）。
12. **switch 要窮舉**：enum 加了值卻沒在 `MyServiceIdExt` 加對應項，會編譯失敗（`my_service_model.dart:37`）。
13. **加 SVG 後要重跑 build_runner**（§2.3）。
14. **Flutter 版本**：`.fvmrc` 是 3.47.6，低於 3.47 時 `pub get` 失敗。不要用系統上的其他 Flutter 版本。
15. **iOS 簽章**：預設的 Team `ZLLDAN62HX` 不是我們的（`project.pbxproj:483`）。
16. **同 applicationId**：各隊的 build 都是 `com.example.townpass`（`build.gradle:42`），借別人的手機裝會蓋掉對方的 App。

**照抄官方微服務的坑**

17. **官方 Services 重度依賴 Google Maps**：`package.json` 有 `@googlemaps/js-api-loader`、`@googlemaps/markerclusterer`、`vue3-google-map`、`@types/google.maps`；`LocationModal.vue:5` import `GoogleMap`，`:42-44` 直接打 Google Geocoding API。**比賽禁商用地圖**（`docs/competition-rules-digest.md` 第 3 條），照抄這些頁面會違規。換成 Leaflet／MapLibre + OSM；反向地理編碼用 Nominatim 要遵守它的使用政策（有流量限制、要帶 UA），或用 PostGIS 自己查行政區。[Nominatim 政策細節：推測，請查官方頁]
18. **官方 Services 已經一年多沒更新**（最後 commit 2025-01-09），依賴版本較舊（Vue 3.4.21、Vite 5.2.8、TS ~5.4）。直接 fork 它來改，或在我們的 monorepo 新開 Vue 專案都可以；新開的話，只需要搬 §3 的 composable。
19. **官方資料全是 mock**（`public/mock/`），不能當作「開放資料」的來源。

**去年專案帶來的坑**

20. 去年前端是 **React + Mapbox**（`docs/deployment/FRONTEND_DEPLOYMENT.md:271` 有 `VITE_MAPBOX_ACCESS_TOKEN`）。Mapbox 是商用地圖，今年不能用。去年的 `flutterBridge.ts` 也不能直接搬（React 專案，加上坑 1）。
21. 去年的 `microservice_requirements.md` 列的「location 失敗回 `[]`」、「notify 訂閱字串」、「先檢查 `flutterObject` 存在」這三點，對照原始碼都正確。
22. 去年的 quick reference 寫 `launch_map` 回「是否成功」。實際上回的是 `canLaunchUrl` 的結果，也就是「能不能開」，App 回覆後才去開（`handler.dart:73-81`）。

---

## 附：查證來源清單

- TownPass @ e65b586：`lib/page/city_service/model/my_service_model.dart`、`lib/page/city_service/model/trending_service_model.dart`、`lib/page/city_service/widget/pinned_service_widget_controller.dart`、`lib/page/city_service/widget/pinned_service_item_widget.dart`、`lib/page/city_service_edit/city_service_edit_view.dart`、`lib/page/city_service_edit/city_service_edit_view_controller.dart`、`lib/util/tp_route.dart`、`lib/util/tp_web_view.dart`、`lib/util/web_message_handler/{tp_web_message_handler,tp_web_message_listener,tp_web_message_reply}.dart`、`lib/service/{account_service,geo_locator_service,device_service}.dart`、`lib/bean/account.dart`、`.fvmrc`、`pubspec.yaml`、`pubspec.lock`、`android/app/src/{main,debug,profile}/AndroidManifest.xml`、`android/app/build.gradle`、`ios/Runner/Info.plist`、`ios/Runner.xcodeproj/project.pbxproj`、`ios/Podfile`、`README.md`
- TownPass-Services @ 3274852：`src/composables/useConnectionMessage.ts`、`src/composables/useHandleConnectionData.ts`、`src/components/organisms/LocationModal.vue`、`src/views/HomeView.vue`、`src/views/SubscriptionView.vue`、`src/router/index.ts`、`vite.config.ts`、`package.json`、`README.md`
- flutter_inappwebview v6.1.5：`flutter_inappwebview_android/lib/src/web_message/web_message_listener.dart`、`flutter_inappwebview_platform_interface/lib/src/web_message/platform_web_message_listener.dart`
- 文件站：`/en/docs/two-way-connection/{app_method,app,web}.html`、`/en/docs/flutter/home/{prerequisites,project-setup}.html`、`/en/docs/flutter/taipeipass-service/custom-design.html`、`/en/docs/micro-service/introductions/{prerequisites,project-setup}.html`
- 去年專案：`smart-road-safety-system/docs/WEBVIEW_BRIDGE_QUICK_REFERENCE.md`、`docs/microservice_requirements.md`、`frontend/src/services/flutterBridge.ts`、`docs/deployment/FRONTEND_DEPLOYMENT.md`
