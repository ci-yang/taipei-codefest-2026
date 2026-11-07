# 臺北住宅批次樣本與亮點試算

這份原型資料來自內政部地政司的[本期發布之不動產買賣實價登錄批次資料](https://data.gov.tw/dataset/25119)，取得日為 2026-11-07。[官方 ZIP 下載網址](https://plvr.land.moi.gov.tw/opendata/lvr_landAcsv.zip)會隨發布更新，因此專案保留本次臺北買賣 CSV 與登記期間 XML。授權為[政府資料開放授權條款第 1 版](https://data.gov.tw/license)；再利用須註明出處，[官方使用說明](https://plvr.land.moi.gov.tw/DownloadOpenData)亦指出批次是靜態資料，動態查詢資料仍為準。

本次 CSV 有 476 筆交易，篩選後為 44 筆、涵蓋 12 區。它是「本批篩選住宅最高總價」，不能解讀成全區行情、全年最高或廁所及停留空間價值。這裡沒有估計缺少的交易或地址。

## 快照與可重建性

| 檔案 | 大小 | SHA-256 |
| --- | ---: | --- |
| 官方 `lvr_landAcsv.zip`（取得時核對，未放入 repo） | 1,133,568 bytes | `4787d9784cc7953c71e746ff805a53e6421dcadb254756e231871f0ee652326b` |
| `data/taipei-price-20261107/a_lvr_land_a.csv` | 165,906 bytes | `0c355797e8f77190fb5753072e9e043405b57981259dad5dcca6b42f5b2d4c2c` |

已逐 byte 核對保留的 CSV 與 XML 符合上述 ZIP 中同名項目。CSV 首列為中文欄名、次列為英文欄名；後者不算交易。`sourceCsvRow` 是原檔從 1 起算的實體列號，包含前兩列欄名。資料包只公開行政區、最高總價、筆數、交易日期、原始編號及列號，不輸出原始門牌供前台呈現。

在 repo 根目錄執行（Python 3.9 以上、只用標準函式庫，不連網）：

```sh
python3 docs/prototypes/build-taipei-price-sample.py
python3 docs/prototypes/build-taipei-price-sample.py --check
node --test docs/prototypes/tests/friendly-highlight-math.test.cjs
```

第一行從快照重建 `friendly-route/price-data.js`；第二行只比對不寫入；`--json` 可輸出同一份資料。腳本先驗 CSV SHA-256，檔案不同就停止，不能把未查證的新批次套上舊來源標籤。更新資料時需一併核對下載來源、快照、雜湊、取得日、XML 登記期間與篩選日期。

## 期間及篩選

- 官方 XML 的買賣**登記日期**為 2026-10-11 至 2026-10-20；這不是成交日期。
- 本原型固定篩選**成交日期**為 2026-01-01 至 2026-10-31。符合的 44 筆實際成交日期落在 2026-05-17 至 2026-10-06。
- `主要用途=住家用`，`交易標的=房地(土地+建物)`，且交易筆棟數中建物為 1、車位為 0。
- 車位移轉面積與車位總價均為 0；總價與建物移轉面積皆大於 0。空白數字欄位不當成零。
- 備註去除前後空白後必須為空；所有非空備註皆排除，包含親友及特殊交易，也會排除部分正常交易。
- 住宅依主要用途判定；使用分區為「商」的住家用住宅仍可能納入。純土地、純建物、含車位或純車位交易不在這份樣本中。
- 相同最高總價若有多筆，保留原檔列號較前者。某區沒有符合資料時省略該區，前台應顯示「待補」。

| 行政區 | 樣本 n | 本批篩選最高總價（元） | 交易日期 | 原始編號 | CSV 列號 |
| --- | ---: | ---: | --- | --- | ---: |
| 中山區 | 8 | 36,000,000 | 2026-07-25 | RPPNMLKKIILGFCA86DA | 330 |
| 中正區 | 2 | 39,320,000 | 2026-06-12 | RPPNMLNKIILGFAA96DA | 366 |
| 信義區 | 2 | 35,000,000 | 2026-07-26 | RPVNMLMJIILGFDA67DA | 333 |
| 內湖區 | 4 | 15,000,000 | 2026-09-10 | RPQNMLMKIILGFCA27EA | 84 |
| 北投區 | 1 | 12,800,000 | 2026-08-14 | RPROMLSJIILGFEA18EA | 234 |
| 南港區 | 4 | 33,000,000 | 2026-06-29 | RPOPMLSKRHLGFDA68DA | 359 |
| 士林區 | 3 | 28,500,000 | 2026-09-12 | RPQNMLNKRHLGFEA28DA | 145 |
| 大同區 | 2 | 36,500,000 | 2026-08-13 | RPRNMLKMRHLGFBA97DA | 263 |
| 大安區 | 6 | 52,500,000 | 2026-10-06 | RPPNMLNKIILGFFA57EA | 21 |
| 文山區 | 5 | 12,150,000 | 2026-08-23 | RPSNMLNKIILGFAA27DA | 238 |
| 松山區 | 4 | 48,800,000 | 2026-08-18 | RPSOMLMKIILGFDA57DA | 249 |
| 萬華區 | 3 | 29,650,000 | 2026-08-15 | RPPNMLTLRHLGFBA58DA | 190 |

## 數學工具契約

`friendly-route/highlight-math.js` 提供瀏覽器的 `window.FriendlyHighlightMath` 及 Node 的 `module.exports`。純本機計算，不讀 GPS、不呼叫外部服務。數字參數須為有限 number，超出範圍時丟出 `TypeError` 或 `RangeError`，前台需捕捉並說明不能估算。

- `wifiSummary(stores, center, {radiusM: 300, signalM: 50})`：中心接受 `{lat,lng}` 或 `[lat,lng]`。只保留服務含 `wifi` 的有效數字座標，以座標小數 5 位分組，使用每群第一筆原始點位；回傳全部去重 `points` 供地圖篩選。`count` 是距中心 300m 內的群數，0 為「Wi-Fi沙漠」、1～2 為「Wi-Fi綠洲」、3 以上為「Wi-Fi風暴」。`coveragePercent` 在中心圓內以 2,821 個固定格點抽樣點位半徑聯集，預設間距 10m；候選包含距中心 350m 內的點，故圈外訊號示意也可覆蓋圈內。覆蓋面積採中心局部平面近似並四捨五入至 0.1%，不是實測訊號或連線可用率；小半徑會受抽樣解析度限制。
- `toiletEstimate(distanceM)`：步長 0.7m、每分鐘 100 步；`steps=ceil(distanceM/0.7)`，`seconds=ceil(distanceM/0.7/100*60)`，兩者各自向上取整。輸入須為非負有限距離，不是實測計步或通行保證。
- `batteryBudget(percent, {reservePercent:5, drainPerHour:20, speedKmh:4, charging:false})`：電量限 0～100，低於 20 且未充電才 `active`。可用小時為 `max(0,percent-reservePercent)/drainPerHour`，再換算 `seconds` 與直線半徑 `radiusM`；未啟動或保留電量不足時數值為零。這是示範耗電與速度假設，並非道路可達圈或實測續航。
- `districtFromAddress(address)`：只接受明載且唯一的臺北市 12 區名稱（包含「區」字）。明示新北或其他臺灣縣市、缺區名、多個區名時回傳 `null`。未以經緯度或路名猜測行政區。
- `mortgage(total, {ltv:0.8, annualRate:0.025, years:30, daysPerMonth:30})`：回傳未四捨五入的 `monthly` 和 `perSecond`。本金 `P=total×ltv`、月利率 `r=annualRate/12`、期數 `n=years×12`，月付 `M=P×r/(1-(1+r)^(-n))`；零利率用 `P/n`。每秒為 `M/(daysPerMonth×24×60×60)`。成數限 0～1、利率非負、期數須為正整數個月。

房貸條件為示範假設，不是當前銀行報價。以大安區本批最高總價 52,500,000 元套用預設條件，月付約 165,950.78 元，每秒約 0.06402422 元；累計試算需使用未取整數值，顯示時才四捨五入。

測試以本金逐月扣款驗證正利率房貸，另核對零利率、Wi-Fi 圓面積與邊界覆蓋、19%／20%／充電／保留電量、缺地址及外縣市。資料測試另外解析原始 CSV，逐區檢查樣本筆數、最高值、原始編號及列號，並檢查產物可離線重建。
