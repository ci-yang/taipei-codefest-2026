# 城市生存雷達原型交接

## 範圍與版本
- 基底：`fb10cc3`，前輪已部署的目的地本機路線、可展開地圖與TownPass返回版本。
- 本輪分支：`design/survival-highlights`，僅延伸純JS／Leaflet App；不修改正式Worker或原生App。
- Prospec change：`.prospec/changes/add-survival-highlights/`。完成Story與Design原型，保持story，供Ci試玩後再決定正式實作。
- 四入口：首頁城市生存雷達，或原地圖工具列「城市雷達」。原本「出發」仍可用。

## 試玩順序
1. Wi-Fi：選市府試玩，拖動地圖看同心圓、風暴／綠洲／沙漠與估算覆蓋率。
2. 倒數：選一間廁所→等待本機步行路程→開始，可暫停、重置、開20倍展示。水球退水；倒數到零不是抵達偵測。
3. 含金量：沿用已選廁所→查看每秒房貸試算→我已抵達開始累計→停止／重設；完整來源與公式可展開。
4. 生存圈：試玩18%電量→拖至20、19、8、5%→看門檻、深灰範圍及充電候選；點候選可看原資源資訊。
5. 關閉雷達回一般探索，原目的地路線保留。也可展開地圖及收合面板。

## 資料與估算
- Wi-Fi使用resources-data.js全量公開點位，5位小數座標彙整；中心300m內密度，50m假設半徑抽樣圓聯集。不是訊號量測或可連線保證，100m外圈只是動畫視覺。
- 廁所使用獨立本機Worker；步長0.7m、每分鐘100步為假設，不是手機實測步數。GPS與計時均僅存於當次記憶體。
- 房價：內政部本期公開CSV，登記日期2026/10/11～10/20的批次；原始476筆篩出44筆住宅，12區有樣本。非歷年或完整區域行情。詳見taipei-price-sample.md與保留的原始CSV/XML。
- 貸款條件：8成、2.5%、30年、每月30天；非銀行報價、費用或收益。
- 電量：低於20%且未充電才啟動；保留5%、每小時耗電20個百分點、步速4km/h，為可調假設。圈是直線半徑上限，不是道路等時圈。
- iOS Safari／WebView沒有getBattery()支援，提供明示的手動試玩；本輪沒有新增原生電池bridge。

## 可重建
```sh
python3 docs/prototypes/build-taipei-price-sample.py --check
node --test docs/prototypes/tests/friendly-highlight-math.test.cjs
python3 tools/package-highlight-preview.py /tmp/tcf-survival-preview
python3 -m http.server 8885 --bind 127.0.0.1 --directory /tmp/tcf-survival-preview
```
一般App建置仍是`pnpm app:build`，runtime白名單、SW快取與smoke同步增加四個資產。

## 分享版資產
分享台資產預算25MiB；`package-highlight-preview.py`保留全市路網與資源檔bytes不變，只移除data.js已不用的舊名冊、背景feature id／未用屬性，背景座標取5位小數（每軸最多0.000005度差異）。路由與資源座標不減精度。整包由程式強制檢查上限，不放寬發布閘門。

## 驗證紀錄
數學測試12項、獨立數學41項、獨立原始CSV52項通過；離線資產新增後14項快取測試通過，App狀態／數學／離線組合70項通過。完整prototype 103項與Python 17項通過，tooling77項通過；workspace 113項、typecheck、lint與完整build均通過。完整瀏覽器、發布網址與最終結果見change內design-verification.md。

原型不等於正式續航、實測Wi-Fi或抵達判斷。原生iOS離線快取限制沿用前版，沒有在本輪宣稱修復。
