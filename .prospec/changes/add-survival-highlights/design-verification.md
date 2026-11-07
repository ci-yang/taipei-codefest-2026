# 城市生存雷達：Design 原型驗證

## 範圍
本輪依 Ci「先用 Prospec 跑 prototype，用現在版本」指示，沿用既有 App 生成四項元件與互動，完成 Story＋Design。狀態保持 `story`，沒有宣稱正式 implement／review／verify 完成。主正式站與原生 App 未部署本次改動。

## 獨立驗證
由沒有撰寫 runtime 的 `highlight_design_qa` 核對實際分享包 `http://127.0.0.1:8885/`。Chrome 視窗 320×568、390×844、768×1024、844×390；公共市府測試座標明示，非實際裝置 GPS。

| 檢查 | 結果與證據 |
|---|---|
| 瀏覽器主流程 | 81/81 PASS，見 evidence/browser-report.json（長陣列保留筆數與hash，所有check結果保留） |
| 補充倒數／金額累計 | 5/5 PASS，見 evidence/supplement-report.json |
| 來源凍結 | 35 個 runtime／packager 檔案前後 SHA-256 一致，見 source-before／after.json |
| 實際本機 Worker | 較遠廁所有道路幾何；原目的地及路線圖層保留 |
| 響應式與互動 | 四模式、四尺寸無水平溢出、44px觸控、地圖展開／面板收合及焦點、reduced-motion 通過 |
| Wi-Fi | 同心圓、300m統計、拖曳後重新計算、脈動上限通過 |
| 廁所 | 選取、開始、暫停、恢復、重置、20倍、換目標、歸零未自動抵達通過 |
| 含金量 | 官方來源、日期、公式可見；啟動／停止／歸零通過 |
| 生存圈 | 20／19／8／5%邊界、深灰圈外、圈內候選詳情、電池API缺少及無定位降級通過 |
| 資料與公式 | 獨立CSV重篩52/52；數學邊界41/41；正式新增測試12/12通過 |

首輪發現未掛載的 Leaflet circle 呼叫 getBounds 會拋錯；改為直接計算 bounds，最後驗證未重現。主程式無未捕捉例外；刻意阻擋外部底圖造成的網路錯誤另列，不誤算通過。

## 建置與回歸
完整 `pnpm test:prototype`：Node 103/103、Python17/17通過；tooling77項、workspace113項通過。`pnpm typecheck`、`pnpm lint`、`pnpm build`與Story／Design結構驗證通過。新增文件及README的content-gate均為exit0。

## 視覺與規格
四項主要畫面見 evidence/*.png。proposal 的雷達入口、模式列、Wi-Fi圈、水球卡、房價卡、生存圈、試玩控制均在 design-spec／interaction-spec 有對應元件及狀態。主文字、色彩、圓角延續既有 Stitch App。

最終瀏覽器驗證後只補充 NOTICE 的官方房價來源與本分支原始碼網址；未變更 JS／CSS／路網或資源資料。重新打包後的版本戳可不同，功能來源仍以凍結 hash 對照。獨立再核對8/8通過：35檔僅NOTICE變動，新版四入口正常，見evidence/notice-refresh.json。

## 驗證限制
- 未驗實機、TownPass WebView、實際電池／充電事件、真實GPS與背景節流。
- 本輪瀏覽器刻意停用SW並阻擋外部圖磚；不代表已驗證真斷網或線上圖磚。離線資產另有自動測試。
- 未驗200%文字放大、所有行政區，以及實際訊號／步行／續航準確度。
- iOS目前用明示手動電量試玩，沒有新增原生電池bridge。
- Ci尚未給本輪視覺回饋；這是可試玩的設計原型。

## 分享部署驗證
App原型：https://ci-share.pages.dev/cc521b0047361278/ 。版本 `friendly-resource-v6-e464d4e7c528085c`。

獨立部署後smoke 22/22 PASS：四入口、市府試玩、18%灰圈、真正本機Worker的386m道路與倒數、金價手動累計皆正常；四個新增資產與Worker／路網／資源檔均HTTP200，無應用例外。證據見evidence/public-smoke.json與public-home.png。本次仍為桌面模擬、停用SW並阻擋外部底圖，不擴大為實機／離線聲明。

文件與精簡證據另由同一獨立驗證者核對：81項check的name／pass、原始report SHA、11處陣列摘要與其餘證據檔全部一致。

## 後續
Ci試玩後可用 `prospec-plan` 決定正式範圍。Wi-Fi為點位密度估算；步長、步頻、房貸、耗電均為可見假設；生存圈為直線半徑上限，不能宣稱道路等時圈或保證到達。

Met 3/3 | Unmet: 無產物缺件 | Overall: WARN | Next: Ci試玩；正式化再進入prospec-plan。
