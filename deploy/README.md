# deploy：GCP VM + Caddy（HTTPS 固定網址）

TownPass 殼的 WebView 需要一個固定的 HTTPS 網址。這裡用一台 GCE VM 跑 `docker compose` 的 prod profile，前面放 Caddy 自動申請 Let's Encrypt 憑證。

```
手機 TownPass WebView
   │ https://codefest.ciyang.dev
   ▼
caddy (80/443，唯一對外的容器)
   ├─ /healthz ──────────────▶ api-prod:8787
   └─ 其他 ──▶ web-prod (nginx：SPA 靜態檔；/api/ 再反代) ──▶ api-prod:8787 ──▶ db (PostGIS，不對外)
```

| 檔案 | 用途 |
|------|------|
| `docker-compose.deploy.yml` | 疊在根目錄 `docker-compose.yml` 上：加 caddy、db/web-prod 不對外、DB 密碼與 CORS 改吃 env、`db-migrate` 一次性容器 |
| `Caddyfile` | `{$DEPLOY_DOMAIN}` 自動 HTTPS、zstd/gzip、`/healthz` 直通 api-prod |
| `.env.deploy.example` | 複製成 `deploy/.env.deploy`（gitignored）後填值 |
| `vm-bootstrap.sh` | Debian 12 的 GCE startup-script：swap、docker + compose plugin、`/opt/codefest`（預設用這個） |
| `cloud-init.yaml` | 同上的 cloud-init 版本，只給有 cloud-init 的 image（Ubuntu）用 |
| `gcp-up.sh` | 建 GCP 資源（可重複執行） |
| `release.sh` | 推程式到 VM、build、migrate、up、驗 `/healthz`；另有 `rollback`／`logs`／`status` |

## 0. 兩個取捨（先讀）

**Cloudflare：DNS only（灰雲），不開 proxy。** Caddy 用 HTTP-01／TLS-ALPN 向 Let's Encrypt 驗證網域，請求必須直接打到 VM。開橘雲的話驗證請求會先經過 Cloudflare，加上「Always Use HTTPS」等設定就容易失敗。另一條路是橘雲 + Cloudflare Origin Certificate + SSL 模式 Full (strict)，要多管一張憑證、改 Caddyfile 的 `tls` 設定。demo 只需要一個能用的 HTTPS 網址，所以選灰雲。代價是 VM 的 IP 會公開，demo 期間可以接受。

**Debian 12 用 startup-script，不用 cloud-init。** GCE 官方 Debian 12 image 沒有內建 cloud-init，放在 `user-data` 的設定不會被執行。所以預設 `BOOTSTRAP=startup-script` 走 `vm-bootstrap.sh`（每次開機都會跑，腳本可重跑）。要用 `cloud-init.yaml` 就設 `BOOTSTRAP=cloud-init`，`gcp-up.sh` 會改用 Ubuntu 24.04 image。

防火牆只用 GCP 規則，VM 內不開 ufw：Docker 發布的 port 會繞過 ufw，開了也擋不住。

## 1. 首次開機

前置：本機有 `gcloud`，已 `gcloud auth login`，知道 GCP 專案 ID。

```bash
# 1) 建 VM（可重複執行；已存在的資源會跳過）
PROJECT=<gcp-project-id> deploy/gcp-up.sh
#   其他參數：ZONE=asia-east1-b MACHINE=e2-medium NAME=codefest-vm STATIC_IP=1 BOOTSTRAP=startup-script
#   最後會印出外部 IP（STATIC_IP=1 時是保留的靜態 IP，VM 停機重開也不會變）

# 2) Cloudflare DNS：A 記錄 codefest.ciyang.dev -> <外部 IP>，Proxy status = DNS only（灰雲）
dig +short codefest.ciyang.dev     # 要回 VM 的 IP 才繼續

# 3) 填部署設定
cp deploy/.env.deploy.example deploy/.env.deploy
openssl rand -hex 16               # 貼到 deploy/.env.deploy 的 DB_PASSWORD

# 4) 第一次部署，順便灌示範資料
PROJECT=<gcp-project-id> SEED=1 deploy/release.sh
```

`gcp-up.sh` 會做四件事：啟用 compute API、建防火牆規則 `codefest-web`（tcp:80、tcp:443、udp:443，套用在 tag `codefest-web`）、保留靜態 IP `codefest-vm-ip`、建 VM（e2-medium、20GB pd-balanced）。SSH 靠 default 網路既有的 `default-allow-ssh` 規則，找不到時腳本會警告。

**第一次執行 `gcloud compute ssh`（`release.sh` 會呼叫）是寫入動作**：它會在本機產生 `~/.ssh/google_compute_engine`，並把公鑰寫進**專案 metadata**，專案裡每台 VM 都會收到這把公鑰。專案若啟用 OS Login，公鑰改寫到 Google 帳號。

## 2. 日常更新

```bash
PROJECT=<gcp-project-id> deploy/release.sh
```

`release.sh` 的流程：

1. 用 `git ls-files -co --exclude-standard` 打包工作目錄，沒 commit 的改動也會帶上，`.env`、`node_modules`、`dist` 不會帶。repo 還沒有任何 commit，所以不用 `git archive HEAD`。
2. 用 `gcloud compute scp` 上傳 tarball 和 `deploy/.env.deploy`。
3. 在 VM 上解到 `/opt/codefest/releases/<時間戳>/`，env 放 `/opt/codefest/shared/.env.deploy`（權限 600）。
4. 執行 `pull --ignore-buildable` → `build` → `db-migrate`（drizzle push；`SEED=1` 時再跑 seed）→ `up -d`。
5. 把 `/opt/codefest/current` 指到新版本，舊版本只留 `KEEP`（預設 5）份。
6. 在本機執行 `curl -fsS https://$DEPLOY_DOMAIN/healthz`，最多重試約 2 分鐘，第一次部署要等申請憑證。

VM 上手動操作時，指令一律從版本目錄執行：

```bash
cd /opt/codefest/current
sudo docker compose --env-file /opt/codefest/shared/.env.deploy \
  -f docker-compose.yml -f deploy/docker-compose.deploy.yml --profile prod ps
```

## 3. 回滾與看 log

```bash
PROJECT=<id> deploy/release.sh status            # 容器狀態、current 指向哪版、版本清單
PROJECT=<id> deploy/release.sh logs              # 全部服務最近 200 行
PROJECT=<id> deploy/release.sh logs caddy        # 單一服務：caddy / web-prod / api-prod / db
PROJECT=<id> deploy/release.sh rollback          # 切到比 current 舊的版本中最新的一版
PROJECT=<id> deploy/release.sh rollback 20261107-143000   # 切到指定版本
```

回滾只會用舊版程式重新 `up -d --build`，不跑 `db-migrate`，資料表維持原樣。db 資料放在 docker volume（compose 專案名固定是 `taipei-codefest`），換版本目錄不影響資料。

注意：`DB_PASSWORD` 只在 db volume 第一次建立時生效。之後在 `.env.deploy` 改密碼，api 會連不上 db。真的要換密碼，就在 db 裡執行 `ALTER USER app PASSWORD ...`，或刪掉 volume 重建（資料會消失）。

## 4. APK 指向雲端服務

```bash
flutter build apk --release --dart-define=CODEFEST_SERVICE_URL=https://codefest.ciyang.dev
```

`CODEFEST_SERVICE_URL` 由 fork 的 `lib/config/codefest.dart` 讀取（已核對）。注意 `db-migrate` 用的 `apps/api` 的 `db:push` 帶 `--force`：schema 若刪欄位，部署時資料會直接被改掉；demo 資料是可重灌的 seed／快取，所以接受此風險。

## 5. Demo 前 checklist

- [ ] `curl -fsS https://codefest.ciyang.dev/healthz` 回 `{"ok":true,"db":"up",...}`
- [ ] `curl -fsS 'https://codefest.ciyang.dev/api/v1/places?lat=25.04&lng=121.56&radius=3000'` 有 features，沒有就用 `SEED=1` 再部署一次
- [ ] `curl -fsS https://codefest.ciyang.dev/api/v1/opendata/sample` 沒有 `"mocked":true`。如果有，代表 VM 打不到 data.taipei，或 `OPENDATA_SAMPLE_RID` 沒設。現場網路不穩時，要確認 mock 也能 demo
- [ ] db 的快取／示範資料前一晚就灌好，demo 當下不靠現場網路去抓 data.taipei
- [ ] 手機用行動網路（不連會場 Wi-Fi）打開 `https://codefest.ciyang.dev/map`，地圖和圖磚都要出現
- [ ] APK 改用 HTTPS 網址後，把開發期為了打區網 HTTP 而開的 cleartext 關掉（AndroidManifest 的 `android:usesCleartextTraffic`／`network_security_config`，以 TownPass fork 實際設定為準）
- [ ] `deploy/release.sh status` 確認 `current` 指向要 demo 的版本，並記下上一版的時間戳，出問題時直接 `rollback <時間戳>`
- [ ] demo 結束後要省錢就停 VM：`gcloud compute instances stop codefest-vm --zone asia-east1-b --project <id>`。靜態 IP 不會變，但閒置的靜態 IP 會另外計費
