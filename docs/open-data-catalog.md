# 臺北開放資料速查表（城市通微服務大黑客松 2026）

> 用途：題目一公布，10 分鐘內挑到資料集、打到第一筆資料。依「市民情境」分類，「一句話找服務」最常用的情境排在前面。
> 實測日期：2026-11-07（上午）。本表「實測」欄的筆數、欄位名，都是當天實際打 API 拿到的回傳，不是從說明頁抄來的。
> 資料集清單來源：data.gov.tw 全站目錄匯出 `https://data.gov.tw/datasets/export/csv`（篩選提供機關含「臺北市」），rid 從目錄的下載網址取出，再逐一打 data.taipei API 驗證。

---

## 0. 先讀這段：三種取資料的方式

| 來源 | 端點樣式 | 要不要 key | 備註 |
|---|---|---|---|
| **臺北市資料大平臺 data.taipei** | `GET https://data.taipei/api/v1/dataset/{rid}?scope=resourceAquire&limit=1000&offset=0` | 不用 | 回 `{"result":{"limit","offset","count","results":[...]}}`。單次 `limit` 上限 **1000**（實測傳 1001 回 limit=1000）。翻頁用 `offset`。每筆多帶 `_id`、`_importdate` 兩個系統欄位。**`q` 參數實測沒有作用**（帶了 count 不變），要篩選就整包抓回來自己濾。 |
| data.taipei 原始檔下載 | `GET https://data.taipei/api/dataset/{datasetId}/resource/{rid}/download` | 不用 | KML／ODS／GeoJSON／SHP 這類檔案**打 v1 API 不會回正常 JSON**，一律走這個下載網址。 |
| data.taipei 資料集頁面 | `https://data.taipei/dataset/detail?id={datasetId}` | — | 給人看的頁面（實測公廁那頁會回 `<title>臺北市資料大平臺 ｜ 臺北市公廁點位資訊</title>`）。備註來源時貼這個網址。 |
| 市府 Azure Blob 即時檔 | `https://tcgbusfs.blob.core.windows.net/...`、`https://tpdep.blob.core.windows.net/...` | 不用 | YouBike、停車、AQI 這類即時資料放在這裡，直接 GET 整包 JSON。 |
| **TDX 運輸資料流通服務** | `https://tdx.transportdata.tw/api/basic/...` | **需註冊**（免費，拿 client_id／client_secret 換 token） | 未帶 token 實測回 401。公車即時到站、捷運、路況都在這裡。 |
| **中央氣象署 CWA** | `https://opendata.cwa.gov.tw/api/v1/rest/datastore/{資料代碼}?Authorization={key}` | **需註冊**（免費會員拿授權碼） | 未帶 key 實測回 401。 |

**授權**：下表的「授權」欄寫 `OGDL-1` 的，代表 data.gov.tw 目錄登記為「政府資料開放授權條款－第1版」（https://data.gov.tw/license ，實測 200）。這個授權可以商用、可以改作，條件是**要標示來源**。比賽規定也要求備註來源，建議 App 裡固定放一頁「資料來源」，逐條列出機關名稱和資料集頁面網址。

**座標欄位怎麼看**：
- `WGS84`：經緯度（例：121.525, 25.118），可以直接丟給 MapLibre。
- `TWD97`：二度分帶座標 EPSG:3826（例：303357.64, 2773912.6），**要先轉成 WGS84**。前端可用 `proj4`：
  ```js
  proj4.defs('EPSG:3826','+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  const [lng, lat] = proj4('EPSG:3826', 'EPSG:4326', [x, y]);
  ```
- `只有地址`：沒有座標，要做距離排序就得先地理編碼（見 §5，有使用限制）。

---

## 1. 第一筆資料 30 秒（實測可用）

```bash
# 臺北市垃圾車點位路線資訊（環保局）— 「倒垃圾」情境的核心資料
curl -s "https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202?scope=resourceAquire&limit=3"
```

2026-11-07 實測回傳：`count: 4012`。前 3 筆的欄位與值如下：

| _id | 行政區 | 里別 | 分隊 | 局編 | 車號 | 路線 | 車次 | 抵達時間 | 離開時間 | 地點 | 經度 | 緯度 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 士林區 | 天壽里 | 天母分隊 | 103-074 | 821-BT | 天母-1 | 第1車 | 1630 | 1640 | 臺北市士林區天母西路48號 | 121.525 | 25.11836 |
| 2 | 士林區 | 天壽里 | 天母分隊 | 103-074 | 821-BT | 天母-1 | 第1車 | 1641 | 1651 | 臺北市士林區天母西路20號 | 121.52724 | 25.1184 |
| 3 | 士林區 | 天壽里 | 天母分隊 | 103-074 | 821-BT | 天母-1 | 第1車 | 1652 | 1700 | 臺北市士林區天母西路10號〈地下室旁〉 | 121.52844 | 25.11839 |

欄位注意：`抵達時間`／`離開時間` 是 `HHMM` 字串（"1630"），不是時間戳。經緯度是**字串**，要先 `parseFloat`。另有系統欄位 `_importdate`（實測值 2026-11-02）。

抓全部 4012 筆（limit 上限 1000，要翻 5 頁）：

```bash
for off in 0 1000 2000 3000 4000; do
  curl -s "https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202?scope=resourceAquire&limit=1000&offset=$off" > garbage_$off.json
done
```

> 網路提醒：實測當天 data.taipei 偶爾出現 TLS handshake timeout 或 connection reset，重試就好。**比賽時建議開賽先把要用的資料集抓成本地 JSON 快取**，Demo 時不要即時依賴 data.taipei。

---

## 2. TDX 取 token（需註冊，以下不含真實 secret）

1. 到 https://tdx.transportdata.tw/ 註冊會員（實測首頁 200），在會員中心取得 `client_id`／`client_secret`。
2. 放進 `.env`（記得加進 gitignore），不要寫進程式碼。

```bash
# .env
# TDX_CLIENT_ID=xxxx
# TDX_CLIENT_SECRET=xxxx

TOKEN=$(curl -s -X POST \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data "grant_type=client_credentials&client_id=$TDX_CLIENT_ID&client_secret=$TDX_CLIENT_SECRET" \
  https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')

# 例：臺北市公車路線（取 1 筆）
curl -s -H "authorization: Bearer $TOKEN" \
  "https://tdx.transportdata.tw/api/basic/v2/Bus/Route/City/Taipei?%24top=1&%24format=JSON"
```

實測：token 端點用假帳號打會回 `{"error":"invalid_client","error_description":"Invalid client credentials"}`，表示端點和參數格式是對的。公車 API 不帶 token 會回 401。**換到真 token 後實際回傳的內容尚未驗證**，因為隊上還沒有帳號。token 有效期與頻率限制請以 TDX 會員中心說明為準（未驗證）。

> 建議：開賽當下先請一位隊員註冊 TDX 和 CWA，兩個帳號的 key 都放進共用的 `.env`。

---

## 3. 資料集速查表（依市民情境）

欄位說明：**即時** = 分鐘級更新；**key** = 是否需註冊；**實測** = 2026-11-07 打 API 拿到的筆數，或卡關原因。
API 欄寫 `rid:xxxx` 的，打法都是 `https://data.taipei/api/v1/dataset/{rid}?scope=resourceAquire`。
頁面欄寫 `ds:xxxx` 的，網址是 `https://data.taipei/dataset/detail?id={ds}`。

### 3.1 垃圾／清潔　★「一句話找服務」第一優先

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| 臺北市垃圾車點位路線資訊 | 環保局 | ds:6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae | rid:a6e90031-7ec4-4089-afb5-361a4efe7202 | JSON(API)／CSV | 不定期 | 否（時刻表，不是車輛 GPS） | 否 | WGS84 `經度`/`緯度` | OGDL-1 | 4012 筆 ✅ |
| 垃圾資源回收、廚餘回收限時收受點 | 環保局 | ds:1acf38f3-1509-4cb1-898a-9b1d4f31a3af | rid:0263f0ce-403a-45ed-a407-c69285b6cad2 | JSON／CSV | 不定期 | 否 | 否 | WGS84 `經度`/`緯度` | OGDL-1 | 30 筆 ✅ 欄位：行政區;分隊;電話;地址;備註;經度;緯度 |
| 社區資源回收站資訊 | 環保局 | ds:32d5286a-deea-4ea4-9789-605705001d96 | rid:0ab06b17-3ac0-4a7b-9e64-66ef69bba697 | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 389 筆 ✅ |
| 資源回收分類方式 | 環保局 | ds:74643872-ee76-4727-bd02-d73b536eaad7 | rid:a4693269-1a96-4914-9c4d-cd7cfb3f3bce | JSON／CSV | 不定期 | 否 | 否 | 無（文字知識） | OGDL-1 | 11 筆 ✅ 欄位：大類別;子類別;說明;回收時間。可以拿來回答「這個要丟哪」 |

### 3.2 交通（公車、捷運、YouBike、停車）

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| YouBike2.0 臺北市即時資訊 | 交通局 | https://data.gov.tw/dataset/137993 | `https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json` | JSON 整包 | 每 1 分 | **是**（實測 `mday` 2026-11-07 10:27） | 否 | WGS84 `latitude`/`longitude` | OGDL-1 | 1824 站 ✅ 欄位：sno;sna;sarea;mday;ar;…;Quantity;available_rent_bikes;latitude;longitude;available_return_bikes |
| 臺北市停車場基本資料 | 停車管理工程處 | [資料集頁未查到，端點來自 TownPass mock 檔名 `TCMSV_alldesc.json`] | `https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json`（另有 `.gz`） | JSON 整包（約 2.9MB） | 不明 | 否 | 否 | **TWD97** `tw97x`/`tw97y`，要轉換 | 未確認 | ✅ 可取。欄位含 name;address;payex;serviceTime;totalcar;totalmotor;Handicap_First;AED_Equipment;EntranceCoord… ⚠ `UPDATETIME` 是 2026-10-19 |
| 臺北市停車場即時剩餘車位 | 停車管理工程處 | [同上，資料集頁未查到] | `https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json` | JSON 整包 | 標稱即時 | **存疑** | 否 | 用 `id` 對應基本資料 | 未確認 | ✅ 可取，但 `UPDATETIME: Mon Oct 19 10:26:00 CST 2026`，**已經 19 天沒更新**。值 `-9` 代表無此類車位。Demo 前要再確認 |
| 臺北捷運車站出入口 | 臺北捷運公司 | ds:19a3a425-1b95-4e72-a1c4-9eadaef52fc9 | rid:c6582350-0d86-437f-b912-29486f4c00a6 | JSON／CSV | 不定期 | 否 | 否 | **無座標**（只有 stationid、locationdescription） | OGDL-1 | 365 筆 ✅ 有 stair/escalator/elevator 欄 |
| 臺北捷運車站無障礙設施 | 臺北捷運公司 | ds:3c799405-4e44-40dd-b747-daed09e88cdb | rid:5d45ef49-d60d-4354-b634-8dcf7d28da07 | JSON／CSV | 不定期 | 否 | 否 | 無（站名、站號） | OGDL-1 | 119 站 ✅ 欄位含電梯、輪椅位、無障礙廁所、手語服務 |
| 臺北捷運車站周邊轉乘停車場 | 臺北捷運公司 | ds:49222b97-aeac-4113-9831-6341535caa36 | rid:74cfc01d-242f-428d-bc2f-caf5edd6e404 | JSON／CSV | 不定期 | 否 | 否 | WGS84 `緯度`/`經度` | OGDL-1 | 182 筆 ✅ |
| 敬老愛心卡補助搭乘公車捷運路線表 | 社會局 | ds:074036e5-7098-4cb0-bdcf-820fbb5b4395 | rid:d94e3229-2190-4ae3-bcff-68340d29e960 | JSON／CSV | 不定期 | 否 | 否 | 無 | OGDL-1 | 270 筆 ✅ 欄位：路線名稱;起迄站;頭班車時間;末班車時間 |
| 臺北市道路施工／活動使用管制圖資 | 工務局 | https://data.gov.tw/dataset/145613 | `https://tpnco.blob.core.windows.net/blobfs/ExtRest/ExtRest.json` | GeoJSON（含 BOM） | 每 1 日 | 否 | 否 | **TWD97** MultiPolygon | OGDL-1 | ✅ 可取（56KB）。欄位：er_name;road;st_date;en_date;contman… |
| 臺北市公車車上擁擠度 | 公共運輸處 | https://data.gov.tw/dataset/175726 | `https://tcgbusfs.blob.core.windows.net/blobbus/TstBusSeatEvent.json` | JSON | 不定期 | **否**（實測 `DataTime` 是 2025-12-12） | 否 | 無 | OGDL-1 | ⚠ 可取，但資料停在去年，不建議用 |
| TDX 公車路線／即時到站／捷運／路況 | 交通部 | https://tdx.transportdata.tw/ | `https://tdx.transportdata.tw/api/basic/v2/Bus/...` 等 | JSON (OData) | 依項目 | **是** | **需註冊** | WGS84 | 依 TDX 授權（未驗證細節） | 端點未帶 token 回 401 ✅；拿 token 後的回傳未驗證 |

### 3.3 醫療／長照／AED

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| AED 自動體外心臟去顫器設置地點 | 衛生局 | ds:cd050577-115f-4299-b37a-012ff490a632 | rid:438c61ad-24f6-4e54-a1cc-e2cfe0e7051e | JSON／CSV | 不定期 | 否 | 否 | WGS84 `緯度`/`經度` | OGDL-1 | 2729 筆 ✅ 欄位：場所名稱;場所地址;AED放置地點;AED地點描述 |
| 臺北市藥局 | 衛生局 | ds:6fa3ed67-e60e-44d9-a366-ce7008e322de | rid:42cfc382-f2b8-4c3a-87ad-37249634f78e | JSON／CSV | 不定期 | 否 | 否 | WGS84 `經度`/`緯度` | OGDL-1 | 894 筆 ✅ |
| 公私立醫院診療科別 | 衛生局 | ds:2ffa97d9-1e21-47e1-a58e-0bbea02f2e5c | rid:417d8412-376a-4184-bba8-b4916269793c | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 36 家 ✅ 每科一欄（內科門診、兒科門診、急診醫學科…），可以回答「哪家有開這科」 |
| 臺北市健康服務中心 | 衛生局 | ds:d4c6d4e0-c2b4-48e3-99b4-f670d820326b | rid:1e57f3cb-7063-4db7-a263-106ab9bdf6d1 | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 12 筆 ✅（`行政區` 欄是代碼，例 63000050） |
| 流感疫苗合約醫療院所（3 歲以上） | 衛生局 | ds:f2a66aec-9b15-4580-9d04-9e991d45e908 | rid:caf1807b-fabf-4db9-8521-6cdd5fa97517 | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 248 筆 ✅ |
| 夜間急診或 24 小時動物醫院 | 動物保護處 | ds:55abae3d-57e3-4793-b68f-e4917f4e6b6a | rid:b502a9ac-7a9e-4705-8c2e-78ba7f4a279b | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 29 筆 ✅ |
| 長照喘息服務特約單位 | 衛生局 | ds:959c34b2-9698-4d99-8987-d389efe18c04 | rid:5a6c44e4-39df-460b-8a10-e2367a7879ea | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 65 筆 ✅ |
| 如何申請長照服務 | 衛生局 | ds:e1e24ba4-3293-4d38-a915-ac65d1365fb2 | rid:e21f84e5-3c01-4526-a3fc-5669bb59961e | JSON／CSV | 不定期 | 否 | 否 | 無（流程文字） | OGDL-1 | 3 筆 ✅（例：「請撥打1966長照專線」） |
| 失智症篩檢、確診評估及關懷服務合約醫院 | 衛生局 | ds:1417e9ae-4c86-4f74-88a2-d7031712db44 | rid:7da0648c-bfd9-469b-85ad-ca32023266b9 | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 12 筆 ✅ |

### 3.4 社福／長者／身障（含數位落差）

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| 銀髮族服務：社區照顧關懷據點 | 社會局 | ds:d082dc87-d3fd-479d-89c6-745ff1be955a | rid:11930dc6-4092-4bde-a42c-7722e0416462 | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 510 筆 ✅ |
| 銀髮族服務：老人共餐單位 | 社會局 | ds:fe55795c-a220-4b88-bde1-5b994321f8af | rid:86d839db-85c7-48b0-991b-dc86922eb093 | JSON／CSV | 每 1 年 | 否 | 否 | 只有地址 | OGDL-1 | 440 筆 ✅ |
| 社會福利服務中心 | 社會局 | ds:ece023db-a5f8-4399-97da-f04d7f4009e3 | rid:1a2d417e-c121-4a12-835f-97ee6852c4b8 | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 13 筆 ✅ |
| 身障社區長照機構 | 社會局 | ds:06a3d0c3-1949-4501-b16f-a0c4c036e2d5 | rid:5e6dd32d-ac91-48cd-87ab-776fcc4811b7 | JSON／CSV | 每 1 年 | 否 | 否 | 只有地址 | OGDL-1 | 7 筆 ✅ 欄位含失能等級、服務時間 |
| 臺北市民免費數位課程情形 | 資訊局 | ds:8cc19f6f-d5ab-4bfc-8cf7-ae46ccd4d228 | rid:07fdc506-4811-43fe-99eb-90c9aaac9821 | JSON／CSV | 不定期 | 否 | 否 | 只有上課地點 | OGDL-1 | 1149 筆 ✅ 欄位：年度;行政區;上課地點;上課日期;上課時間;課程名稱;人數。⚠ 第一筆的年度是 109，要先確認有沒有今年的課 |

### 3.5 教育／圖書館／托育

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| 臺北市立圖書館各分館暨民眾閱覽室 | 教育局 | ds:43772803-6504-469c-894d-35904342a53b | rid:fb6cc268-e2b8-43a7-86f2-e79702291a2b | JSON／CSV | 每 1 年 | 否 | 否 | WGS84 `緯度`/`經度` | OGDL-1 | 70 筆 ✅ |
| 嬰幼兒照顧服務：親子館 | 社會局 | ds:fd4779d0-827d-4ab3-8f65-2a356abad6d9 | rid:5c09f39f-79cc-45b8-be8e-9b3ea8b220e3 | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 13 筆 ✅ |
| 嬰幼兒照顧服務：公辦民營托嬰中心 | 社會局 | ds:9c9a3f77-8340-48d8-bc0e-f9155521b758 | rid:a02ccc34-dd28-4c5d-b527-c5433ec1a453 | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 29 筆 ✅ |

### 3.6 環境（空氣、水質、天氣）

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| 臺北市空氣品質即時污染指標 | 環保局 | https://data.gov.tw/dataset/145702 | `https://tpdep.blob.core.windows.net/techdep/tldep_AQI_DAYHour.json` | JSON 整包 | 每小時（實測最新一筆 `時間` 2026-11-07T04:00） | 準即時 | 否 | 無，用 `站名` 對應測站基本資料 | OGDL-1 | ✅ 欄位：時間;發布時間;站名代號;站名;指標物;中文指標物;指標值;指標等級 |
| 空氣品質監測站基本資料 | 環保局 | ds:505c09be-4956-4884-b6c3-675034ce4d99 | rid:bf9f74e7-22d0-4e0f-8e3d-31c04eda22a4 | JSON／CSV | 不定期 | 否 | 否 | WGS84 `longitude_經度`/`latitude_緯度` | OGDL-1 | 17 站 ✅ |
| 水質監測站基本資料 | 環保局 | ds:0f5c88a8-3d92-49a3-9415-9c4fa25339e0 | rid:91b15e17-ed2d-4bbb-9d22-d486e445745a | JSON／CSV | 不定期 | 否 | 否 | WGS84 `經度`/`緯度` | OGDL-1 | 16 站 ✅ |
| CWA 鄉鎮天氣預報（臺北市） | 中央氣象署 | https://opendata.cwa.gov.tw/ [首頁實測連線失敗，連結未驗證] | `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-061?Authorization={key}` | JSON | 依產品 | 準即時 | **需註冊** | 依產品 | 政府資料開放授權（未驗證細節） | 不帶 key 回 401 ✅。**F-D0047-061 對應哪個預報區間，請用 CWA 文件確認**（未驗證） |

### 3.7 公共設施（公廁、飲水機、公園、運動中心、Wi-Fi、無障礙）

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| 臺北市公廁點位資訊 | 環保局 | ds:ca205b54-a06f-4d84-894c-d6ab5079ce79 | rid:9e0e6ad4-b9f9-4810-8551-0cffd1b915b3 | JSON／CSV | 不定期 | 否 | 否 | WGS84 `經度`/`緯度` | OGDL-1 | 1531 筆 ✅ 欄位含無障礙廁座數、親子廁座數、照護床位置。⚠ 欄名 `改善級 ` 尾巴多一個空白 |
| 公共場所飲水機資訊 | 環保局 | ds:f158e1bc-8400-44c2-a93a-e09361ddb7f5 | rid:52538305-ed23-490c-8f67-3efff2d777c3 | JSON／CSV | 不定期 | 否 | 否 | WGS84 `緯度`/`經度` | OGDL-1 | 144 筆 ✅ 欄位含場所開放時間、飲水台數 |
| 臺北市公園基本資料 | 公園路燈工程管理處 | https://data.gov.tw/dataset/128366 | `https://parks.gov.taipei/parks/api/` | JSON 整包（約 4.2MB） | 不定期 | 否 | 否 | WGS84 `pm_Longitude`/`pm_Latitude` | OGDL-1 | 813 筆 ✅ |
| 臺北市各區運動中心 | 體育局 | ds:80be7612-593f-4795-9935-a10ce0f7b75b | rid:e7c46724-3517-4ce5-844f-5a4404897b7d | JSON／CSV | 每 1 年 | 否 | 否 | WGS84 `經度`/`緯度` | OGDL-1 | 12 筆 ✅ |
| 公眾區免費無線上網熱點（新版） | 資訊局 | ds:6aa6532d-652f-4c1b-814a-4646b75407af | rid:549b3a9b-eb6c-4cb1-848b-8c238735e2db | JSON／CSV | 每 6 月 | 否 | 否 | WGS84 `latitude`/`longitude` | OGDL-1 | 3305 筆 ✅（數位落差情境可用） |
| 人行道固定設施物：無障礙斜坡道 | 工務局新建工程處 | ds:8ab0c662-b560-4310-a825-001ae7fdc524 | 下載：`https://data.taipei/api/dataset/8ab0c662-b560-4310-a825-001ae7fdc524/resource/ee522d94-daa7-4118-b52a-4bf144af2744/download` | GeoJSON | 不定期 | 否 | 否 | **TWD97**（`crs: EPSG:3826`） | OGDL-1 | 下載 ✅；打 v1 API 不會回正常 JSON |

### 3.8 災防（避難所、防空、淹水）

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| 114 年臺北市可供避難收容處所一覽表 | 社會局 | ds:f327232d-9230-44d0-bf0c-df151802da32 | rid:3f20cc14-91a9-41de-8d03-6e019ec4d82c | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 399 筆 ✅ 欄位含水災/震災/土石流適用、無障礙設施、容納人數 |
| （同名，教育局版）可供避難收容處所 | 教育局 | ds:aaf97773-3631-40e2-b3cc-da87bf2ce1d5 | rid:4c92dbd4-d259-495a-8390-52628119a4dd | — | — | — | — | — | OGDL-1 | ❌ API 回的是壞資料（欄名 `pk\u0003\u0004`，看起來是把 zip 當 CSV 匯入）。**改用上一列** |
| 北市警政 APP 防空避難設備位置 | 警察局 | ds:83eecdf1-3bbb-40f9-9484-b55b700c37ef | rid:39ca53a1-c861-40bc-b329-fc9b28c10e01 | JSON／CSV | 不定期 | 否 | 否 | WGS84，但欄名叫 `座標x`(經度)/`座標y`(緯度) | OGDL-1 | 6052 筆 ✅ 欄位含容納人數、地下層數 |
| 水利處易積水地區 | 工務局水利處 | ds:08101966-7aca-48e0-a028-6da02ba1192e | 下載：`https://data.taipei/api/dataset/08101966-7aca-48e0-a028-6da02ba1192e/resource/db12426f-777c-48f0-90a8-bb582f39a33e/download` | KML | 每 1 年 | 否 | 否 | KML 內含幾何 | OGDL-1 | 下載 ✅；v1 API 不適用 |
| 水利處抽水站 | 工務局水利處 | ds:026cc0fa-cecc-4c78-b986-ead3b0c8b95b | rid:d1f9c6e0-5f72-4fc4-ac18-0b75ce0b002e | JSON／CSV | 每 1 年 | 否 | 否 | **TWD97** `x坐標`/`y坐標` | OGDL-1 | 88 站 ✅ |
| 雨水下水道水位監測站（站點） | 工務局水利處 | ds:b3648c5d-15c8-416a-a603-fda7a9ac1b0d | rid:586e5233-aa60-4680-8ac1-cbb9ef7f7fde | JSON／CSV | 不定期 | 否（只有站點，**不含即時水位**） | 否 | WGS84 `經度`/`緯度` | OGDL-1 | 233 站 ✅ |

### 3.9 文化活動／市集

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| 臺北市藝文館所 | 文化局 | ds:f058688f-1fd0-40d4-85e6-18267484cd18 | rid:e290a9e2-1c97-4bfc-b720-b640153a3c1d | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 46 筆 ✅ |
| 臺北市集會堂、活動中心 | 民政局 | ds:5ed70753-73a4-4fc1-b78c-df09f7499594 | 下載：`https://data.taipei/api/dataset/5ed70753-73a4-4fc1-b78c-df09f7499594/resource/5ae02e14-50fc-4906-86a7-96e0231780e1/download` | ODS | 不定期 | 否 | 否 | `座標X`/`座標Y`（座標系未驗證） | OGDL-1 | v1 API 不會回正常 JSON；下載未逐一驗證 |
| 臺北旅遊網景點資料（中文） | 觀光傳播局 | ds:bd31c976-d3a5-4eed-b8c3-7454bc266afa | rid:36847f3f-deff-4183-a5bb-800737591de5 | JSON／CSV | 不定期 | 否 | 否 | 無 | OGDL-1 | 13 筆 ✅（以行政區為單位的彙整文字，不是逐筆景點） |
| 臺北旅遊網 Open API（活動、景點） | 觀光傳播局 | https://www.travel.taipei/open-api/ [連結未驗證] | `https://www.travel.taipei/open-api/zh-tw/Events/Activity?page=1` | JSON | — | — | 否（官方說法，未驗證） | — | 未驗證 | ❌ 從 curl 打會被 Cloudflare 擋（403 "Just a moment..."），**後端拿不到**。要用的話得先確認瀏覽器端能不能呼叫 |

### 3.10 戶政／稅務／申辦

| 名稱 | 提供單位 | 頁面 | API／下載 | 格式 | 更新 | 即時 | key | 座標 | 授權 | 實測 |
|---|---|---|---|---|---|---|---|---|---|---|
| 各區戶政事務所（資料集名稱是「等候人數」） | 民政局 | ds:3b9856c9-d26b-4089-95ad-bc4c5908461e | rid:b69e905a-0436-4151-aad8-dfc94054defc | JSON／CSV | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 12 筆 ✅ ⚠ API 只回所名、地址、電話和一個 `網址` 欄（cloud.taipei 頁面），**沒有等候人數本身** |
| 各區戶政事務所規費收費一覽表 | 民政局 | ds:fbc367bd-8591-4bd4-942e-5a1758af02dc | 下載：`https://data.taipei/api/dataset/fbc367bd-8591-4bd4-942e-5a1758af02dc/resource/5cd9f0ba-cdfc-4a25-b79e-b4d58604a317/download` | ODS | 不定期 | 否 | 否 | 無 | OGDL-1 | v1 API 不適用；下載未驗證 |
| 各區公所免費市民法律諮詢服務 | 民政局 | ds:95e1fc57-7605-4c89-8361-dfeac479f45f | 下載：`https://data.taipei/api/dataset/95e1fc57-7605-4c89-8361-dfeac479f45f/resource/58af883a-6e50-44f9-bfa3-e4001014e088/download` | ODS | 不定期 | 否 | 否 | 只有地址 | OGDL-1 | 下載 ✅（檔案類型確認為 OpenDocument Spreadsheet） |
| 市政信箱（陳情系統）及 1999 資訊 | 研考會 | ds:82f84ae8-4ccf-4073-b493-949044054b50 | rid:1caf2007-05b8-4b67-9cc0-73f19414e871 | JSON／CSV | 不定期 | 否 | 否 | 無 | OGDL-1 | 1 筆 ✅（1999、(02)27208889、網址） |
| 稅務服務據點 | 稅捐稽徵處 | — | — | — | — | — | — | — | — | ❌ **目錄裡沒找到「稅捐處服務據點／地址」這類資料集**，只有統計表。若題目跟稅務有關，要另外找來源 |

**合計 56 列**（含 1 列「稅務服務據點」缺口說明、1 列教育局避難所壞資料），標 ✅ 的有 50 列。其中 TDX 和 CWA 兩列只驗到「不帶 key 回 401」，其餘 48 列都實際拿到資料。

---

## 4. 「一句話找服務」情境 → 資料集對照（建議先接）

| 使用者說 | 用哪個資料集 | 怎麼算 |
|---|---|---|
| 「倒垃圾」「垃圾車幾點來」 | 垃圾車點位 + 限時收受點 | 現在時間對 `抵達時間`，加上 GPS 距離排序，取最近的 3 個點 |
| 「這個要丟哪」 | 資源回收分類方式 | 關鍵字比對 `大類別`/`子類別`/`說明` |
| 「附近廁所」「要換尿布」 | 公廁點位 | 距離排序，可依 `親子廁座數>0` 或 `無障礙廁座數>0` 篩選 |
| 「有人昏倒」「AED」 | AED 設置地點 | 距離排序，顯示 `AED放置地點` 描述 |
| 「借腳踏車」 | YouBike 即時 | 篩選 `available_rent_bikes>0`，再按距離排序 |
| 「哪裡裝水」 | 飲水機 | 距離排序，並看 `場所開放時間` |
| 「地震／淹水去哪避難」 | 114 避難收容處所 + 防空避難 | 依災別欄位篩選；收容處所只有地址，**要先地理編碼** |
| 「爸媽想學手機」（數位落差） | 免費數位課程 + Wi-Fi 熱點 + 社區關懷據點 | 篩選行政區與日期 |
| 「長照怎麼申請」 | 如何申請長照服務 + 長照喘息特約 | 直接回 1966 專線，再列附近單位 |

---

## 5. 「不能用」清單與替代方案

### 5.1 禁用或不建議

| 項目 | 原因 | 替代 |
|---|---|---|
| **Google Maps JS API／Geocoding API** | 比賽規則禁用；而且是付費服務。⚠ **TownPass-Services 官方範本本身就用了 Google Maps**（`src/stores/googleMaps.ts` 用 `@googlemaps/js-api-loader`，`src/components/organisms/LocationModal.vue` 呼叫 `maps.googleapis.com/maps/api/geocode/json`），**直接沿用範本會踩線，地圖元件要換掉** | MapLibre GL JS + OSM／NLSC 圖磚 |
| Mapbox GL JS v2 以上、Mapbox 圖磚 | 要 token，用量超過免費額度會計費 | MapLibre GL JS（Mapbox GL v1 的開源分支） |
| 臺北旅遊網 Open API | 伺服器端被 Cloudflare 擋（403） | 景點／館所改用 data.taipei 的藝文館所、公園資料 |
| 爬市府網頁（例如戶政等候人數頁） | 不是開放資料，規則要求核心資料必須是公開合法的開放資料 | 只用 API 或資料集裡有的欄位 |
| TownPass 的 `public/mock/*.json` | 那是假資料（例如 `place_list.json`、`TCMSV_alldesc.json` 的 mock），不是正式來源 | 改用本表列的正式端點 |
| 公車擁擠度 JSON | 資料停在 2025-12 | TDX 公車即時資料（需註冊） |

### 5.2 開源地圖組合（實測可用）

| 元件 | 網址 | 實測 | 使用限制 |
|---|---|---|---|
| MapLibre GL JS | https://maplibre.org/maplibre-gl-js/docs/ | 200 ✅ | BSD 授權，免 key |
| MapLibre 示範樣式 | https://demotiles.maplibre.org/style.json | 200 ✅ | 只有世界粗略底圖，只適合測試 |
| OSM 標準圖磚 | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | 200 ✅ | 依 https://operations.osmfoundation.org/policies/tiles/ ：**必須標示「© OpenStreetMap contributors」**，禁止大量或離線抓取。Demo 等級的流量可以用 |
| **內政部國土測繪中心 NLSC WMTS**（政府圖資，建議優先） | Capabilities：`https://wmts.nlsc.gov.tw/wmts`；圖磚：`https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}` | Capabilities 200 ✅（圖層含 EMAP、EMAP2、EMAP5、EMAP5_OPENDATA…）；z16 圖磚回 200 image/jpeg ✅ | 屬於政府開放資料，要標示來源「內政部國土測繪中心」。網址裡 x/y 的順序請依 Capabilities 的 ResourceURL 為準（我是用 `{z}/{y}/{x}` 順序測到圖片） |
| 臺北市政府自己的 WMTS | — | ❌ **沒找到公開的臺北市 WMTS 端點**（搜尋結果只有新聞提到市府系統用 OSM 當底圖） | 改用 NLSC |

MapLibre 接 NLSC 的最小範例：

```js
new maplibregl.Map({
  container: 'map',
  center: [121.5654, 25.0330], zoom: 13,
  style: {
    version: 8,
    sources: { nlsc: { type: 'raster', tileSize: 256,
      tiles: ['https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}'],
      attribution: '© 內政部國土測繪中心' } },
    layers: [{ id: 'nlsc', type: 'raster', source: 'nlsc' }]
  }
});
```

### 5.3 地理編碼（地址轉座標）

| 方案 | 實測 | 限制 |
|---|---|---|
| Nominatim（OSM） `https://nominatim.openstreetmap.org/search?q=...&format=json` | 200 ✅（查「台北車站」有結果） | 依 https://operations.osmfoundation.org/policies/nominatim/ ：**每秒最多 1 個請求**；必須帶能識別 App 的 User-Agent 或 Referer（http 函式庫預設的 UA 不行）；**不鼓勵批次地理編碼**，「App 定期發出的請求視同批次」。→ **只能拿來做一次性的前處理，跑完把結果快取成檔案，不要在 App 執行時即時呼叫** |
| 內政部 TGOS 地址定位 | 未驗證 | 需申請 key（未驗證） |
| 最省事的做法 | — | **盡量挑本來就有 WGS84 座標的資料集**（垃圾車、公廁、AED、YouBike、飲水機、藥局、圖書館、防空避難都有），只有地址的資料集留到第二階段再處理 |

---

## 6. 風險與待決

- **TDX、CWA 都需要註冊**，開賽就要先辦帳號。token 換到之後的實際回傳本表沒有驗證。
- **停車場即時資料 `UPDATETIME` 停在 2026-10-19**，公車擁擠度停在 2025-12。用到即時資料的功能，Demo 前要再打一次確認。
- data.taipei 當天斷線好幾次（TLS timeout、connection reset、DNS 失敗），重試後都恢復了。**開賽先把資料抓成本地快取。**
- 教育局版的避難收容處所 API 回壞資料，請改用社會局 114 年版。
- 標「未驗證」的項目：臺北旅遊網 Open API、CWA 首頁、TGOS、ODS 規費表下載、F-D0047-061 的預報區間、TDX 授權細節。
