# 臺北市本機步行候選路網

App runtime 使用 `friendly-route/routing-data.js`，路線在裝置端計算，建圖查詢只含固定公開行政區與道路類別，沒有使用者 GPS。這份資產獨立於 `data/friendly/routing-graph.json`；後者仍是既有 API／D1／舊路線比較測試的局部圖 fixture。

## 範圍與來源

範圍標示為「臺北市行政界相交道路，含完整道路節點」。查詢以 [臺北市 OSM relation 1293250](https://www.openstreetmap.org/relation/1293250) 轉換成 Overpass area，選取固定 `highway` 白名單的 ways，再輸出所有引用 nodes 的完整 body，保留節點 `foot`／`access` tags。完整查詢見 [taipei-routing.ql](taipei-routing.ql)。白名單不含 `motorway` 或 `trunk`。

這是 Overpass area 選出的道路集合，沒有額外市界緩衝；完整道路的節點可能落在行政界外。`bounds` 是保留道路節點的外包矩形 `[[24.9597595,121.458289],[25.2102221,121.6662864]]`，並非行政區多邊形，也不代表矩形內所有位置均可步行或連通。

| 項目 | 實際紀錄 |
| --- | --- |
| Runtime version | `friendly-taipei-pedestrian-snapshot-2026-11-07-v2` |
| API endpoint | `https://overpass-api.de/api/interpreter` |
| API generator | `Overpass API 0.7.62.11 87bfad18` |
| OSM 基準時間 | `2026-11-07T14:01:50Z` |
| Area 基準時間 | `2026-11-07T10:09:06Z` |
| 原始 XML 最後寫入時間 | `2026-11-07T14:03:40.339265+00:00` |
| 輸入 XML | 43,504,161 bytes；286,385 nodes；64,080 ways |
| 輸出 graph | 271,533 nodes；621,530 directed edges |
| 弱連通分量 | 保留全部 904 個；最大分量 264,707 nodes |
| 被節點存取規則擋下 | 480 nodes |
| Runtime JS | 20,758,759 bytes，約 19.80 MiB |
| License／attribution | `ODbL-1.0`／© OpenStreetMap contributors |

本次只發送一次 GET。下載後紀錄程式遇到 Python 3.9 不支援 `hashlib.file_digest`，所以 HTTP status 與精確請求起迄、耗時未留存；未為補紀錄重送下載。`retrievedAt` 如實採原始 XML 檔案的最後寫入時間，metadata 明示 `retrievalTimestampBasis: local-file-last-write`，不可解讀為 API 資料更新時間。XML 已完整解析、無 Overpass error remark，且所有保留 ways 的引用節點均存在。

| 檔案 | SHA-256 |
| --- | --- |
| `taipei-routing.ql` | `e184e3c0fc4d8af3378439afe467f9497fc8a8540b442a98c0e47c1f1139d792` |
| `taipei-routing-20261107.osm` | `d70a2220b8fb7c639629992fcc22f92c68a1ca7775a17ca3449f6762e50fe16b` |
| `friendly-route/routing-data.js` | `1afe78ce7135dcbbc09ac908b85cf9ea74a5fb1eab4a3bc2fd40677f47d5070c` |

## 建圖規則

`build-friendly-routing.py` 以 `iterparse` 讀 XML，每個 node／way 完成後釋放 XML element；雜湊以固定大小區塊讀取，不把整份 XML 留在記憶體。圖仍需在建置端保留節點與邊的索引，這不等於固定記憶體用量。

沿用原有規則：排除 `foot`／`access` 的 `no`、`private`、`customers`、`permit`、`delivery`，排除室內、面積型 way、施工與停用道路；節點禁行會切斷相鄰邊，不跨過節點接線。套用 `oneway:foot`，忽略僅限制汽車的 `oneway`。保留所有有可用邊的弱連通分量，不再只取最大分量；孤立、無可用邊的單點不進路由圖。

未傳 `--bounds` 時，從保留道路節點推導外包矩形。需要局部測試時可傳 `--bounds SOUTH WEST NORTH EAST`，只保留兩端都在矩形內的邊，不跨越界外節點重接道路。

`--compact` 只移除 runtime 不使用的 `osmNodeIds` 與 edge 第四欄 way ID；node 座標及 edge 順序、方向、長度不變。長度維持四位小數公尺。沒有路徑簡化、座標降精度或分檔。本次輸出低於 25 MiB。

## 用保留的原始檔重建

本機原始檔位於 `/tmp/taipei-routing-20261107.osm`，下載紀錄位於 `/tmp/taipei-routing-20261107-retrieval.json`，兩者未提交 repository。若暫存檔已清除，官方 API 的新查詢只能取得當時的新快照，不能保證復原本次相同 bytes。

在 repository 根目錄執行：

```sh
python3 docs/prototypes/build-friendly-routing.py \
  --osm /tmp/taipei-routing-20261107.osm \
  --out docs/prototypes/friendly-route/routing-data.js \
  --compact \
  --source https://overpass-api.de/api/interpreter \
  --version friendly-taipei-pedestrian-snapshot-2026-11-07-v2 \
  --coverage '臺北市行政界相交道路，含完整道路節點' \
  --coverage-label '臺北市行政區道路快照' \
  --query docs/prototypes/taipei-routing.ql \
  --retrieval-metadata /tmp/taipei-routing-20261107-retrieval.json
```

Builder 會核對 receipt 的 XML bytes／hash、API endpoint、query hash；若 receipt 留有 HTTP status／exit code，也會拒絕失敗值。缺少 referenced node、Overpass error remark 或沒有可用邊會中止，不輸出部分路網。

## 更新公開資料時的單次下載

僅在確定要更新快照時執行，失敗先讀錯誤，不設高頻重試。此命令使用公開 API，沒有瀏覽器爬取或個人位置參數。新下載放入不同暫存目錄，後續建圖時使用新路徑並更新版本、實際 metadata 與上述雜湊。

```sh
python3 - <<'PY'
import datetime
import hashlib
import json
import pathlib
import subprocess
import tempfile
import time

query = pathlib.Path('docs/prototypes/taipei-routing.ql')
directory = pathlib.Path(tempfile.mkdtemp(prefix='taipei-routing-'))
output = directory / 'taipei-routing.osm'
receipt = {
    'endpoint': 'https://overpass-api.de/api/interpreter',
    'querySha256': hashlib.sha256(query.read_bytes()).hexdigest(),
    'retrievalStartedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
started = time.monotonic()
result = subprocess.run([
    'curl', '--get', '--max-time', '300', '--fail-with-body', '--silent', '--show-error',
    '--user-agent', 'TaipeiCodefestFriendlyRoutes/1.0 (fixed public city dataset)',
    '--data-urlencode', f'data@{query}', '--output', str(output),
    '--write-out', '%{http_code}', receipt['endpoint'],
], capture_output=True, text=True)
receipt.update({
    'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'retrievalTimestampBasis': 'request-completed',
    'elapsedSeconds': round(time.monotonic() - started, 3),
    'httpStatus': result.stdout,
    'exitCode': result.returncode,
    'error': result.stderr,
})
if output.exists():
    digest = hashlib.sha256()
    with output.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    receipt.update({'bytes': output.stat().st_size, 'sha256': digest.hexdigest()})
receipt_path = directory / 'retrieval.json'
receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
print(output, receipt_path, json.dumps(receipt, indent=2), sep='\n')
raise SystemExit(result.returncode)
PY
```

官方說明：[公共 instance 使用原則](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)、[行政 area 查詢](https://dev.overpass-api.de/overpass-doc/en/full_data/area.html)、[ways 與 referenced nodes](https://dev.overpass-api.de/overpass-doc/en/full_data/osm_types.html)、[OSMF API policy](https://operations.osmfoundation.org/policies/api/)。

## 驗證與限制

```sh
python3 -m unittest discover -s docs/prototypes/tests -p 'test_friendly_routing_builder.py' -v
node docs/prototypes/tests/friendly-taipei-routing.test.cjs
```

Builder 的 8 個測試使用明示的合成 XML，核對串流解析仍保留 blocked-node tags、步行單行方向、道路排除規則、全部連通分量、自動／指定 bounds、compact 不改路長，以及不完整輸入必須失敗。

跨區 smoke 使用既有公開資料的固定座標：

| 測試點 | 公開座標與來源 |
| --- | --- |
| 臺北車站(忠孝)-W1-忠孝西路一段 | `[25.0466977,121.5171673]`；[Taipei Free 熱點](https://data.taipei/dataset/detail?id=6aa6532d-652f-4c1b-814a-4646b75407af)，既有資源 ID `wifi-c624979e27` |
| 捷運市政府站(板南線) | `[25.04092,121.565328]`；[臺北市公廁](https://data.taipei/dataset/detail?id=ca205b54-a06f-4d84-894c-d6ab5079ce79)，既有資源 ID `toilet-5a00e06569` |

2026-11-07 本機 Node v24.18.0 VM 單次實測：graph 解析與 adjacency 初始化 230 ms，`compare({ shortestOnly: true, stores: [] })` 404 ms，輸出 4,950 m、139 個道路點，其中起終點估計接線合計 216 m。路由版本會在 120 m 接線範圍內評估候選節點，因此不一定選距各端點最近的單一節點。VM 沒有網路 API，沒有使用真實 GPS。這不是手機效能或實際可步行性的證明；路由版本、裝置與執行狀態改變後需重新量測。

同份公廁資料的「臺北車站」座標 `[25.047893,121.516989]`，最近 OSM 點 `[25.0478566,121.5168861]` 距 11.128 m，位於只有兩個節點的分量。這只是最近單一節點的觀察，不能據此認定該公廁一定無法連通。另次 smoke 驗證候選接線版本可由該公廁座標到市政府站：5,117 m、152 個道路點、接線合計 231 m，單次計算 495 ms。保留小分量不等於每個資源都能互相抵達，120 m 內的候選接線也未經實地入口驗證。

這份圖沒有驗證人行穿越、出入口、施工、營業狀態、無障礙或完整都會區涵蓋。OSM 未標示的通道、跨界路段或不同分量，仍可能使路線無法計算。
