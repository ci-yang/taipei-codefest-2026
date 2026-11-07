#!/usr/bin/env bash
# 把本機工作目錄推到 VM 並重啟服務；也負責回滾、看 log、看狀態。
#
#   PROJECT=<gcp-project-id> deploy/release.sh             # 部署（預設 action = release）
#   PROJECT=... SEED=1 deploy/release.sh                    # 部署並重灌示範資料（db:seed 可重複執行）
#   PROJECT=... deploy/release.sh rollback [<時間戳>]       # 回到上一版（或指定版本）
#   PROJECT=... deploy/release.sh logs [<service>]          # 最近 200 行 log，例：logs caddy
#   PROJECT=... deploy/release.sh status                    # docker compose ps + 版本清單
#
# 參數（環境變數）：PROJECT（必填）、ZONE (asia-east1-b)、NAME (codefest-vm)、
#   ENV_FILE (deploy/.env.deploy)、SEED (0)、KEEP (5，VM 上保留幾個舊版本)
#
# 傳輸方式：一般 `gcloud compute ssh/scp`（走 VM 外部 IP 的 22 port，靠 default-allow-ssh 防火牆規則）。
#   不用 --tunnel-through-iap：IAP 還要另開 35.235.240.0/20 的防火牆規則與 IAP 權限，黑客松現場多一個失敗點。
#   ⚠ 第一次執行 gcloud compute ssh 會：在本機產生 ~/.ssh/google_compute_engine 金鑰，
#     並把公鑰寫進「專案 metadata」（專案內所有 VM 都會收到這把公鑰）。這是寫入動作，不是唯讀。
#     若專案啟用了 OS Login，則改寫到你的 Google 帳號，不寫專案 metadata。
#
# 打包內容：`git ls-files -co --exclude-standard`（已追蹤＋未追蹤但沒被 .gitignore 排除的檔），
#   所以還沒 commit 的改動也會帶上，.env／node_modules／dist 不會。repo 目前沒有任何 commit，
#   所以不用 `git archive HEAD`（沒有 HEAD 可打包）。
#
# VM 上的目錄：/opt/codefest/releases/<時間戳>/（每次部署一份）、/opt/codefest/current（指向線上版本）、
#   /opt/codefest/shared/.env.deploy（600 權限）。db 資料在 docker volume（compose 專案名固定為
#   taipei-codefest），換版本目錄不影響資料。
set -euo pipefail

ACTION="${1:-release}"
ARG="${2:-}"
: "${PROJECT:?請設定 PROJECT=<gcp-project-id>}"
ZONE="${ZONE:-asia-east1-b}"
NAME="${NAME:-codefest-vm}"
SEED="${SEED:-0}"
KEEP="${KEEP:-5}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/.env.deploy}"

GC=(gcloud --project "$PROJECT")
vm_ssh() { "${GC[@]}" compute ssh "$NAME" --zone "$ZONE" -- "$@"; }

log() { echo "==> $*"; }

# 在 VM 上以 root 執行的腳本。參數：ACTION TS SEED KEEP
remote_script() {
  cat <<'REMOTE'
set -euo pipefail
ACTION="$1"; TS="$2"; SEED="$3"; KEEP="$4"
ROOT=/opt/codefest

# 第一次部署時 VM 可能還在跑 bootstrap（裝 docker），最多等 5 分鐘
for _ in $(seq 60); do
  if [ -f /var/lib/codefest-bootstrap.done ] && docker compose version >/dev/null 2>&1; then break; fi
  echo "等待 VM bootstrap 完成..."; sleep 5
done
docker compose version >/dev/null

compose() {
  docker compose --env-file "$ROOT/shared/.env.deploy" \
    -f docker-compose.yml -f deploy/docker-compose.deploy.yml "$@"
}

case "$ACTION" in
  release)
    DIR="$ROOT/releases/$TS"
    mkdir -p "$DIR"
    tar -xzf "/tmp/codefest-$TS.tgz" -C "$DIR"
    install -m 600 "/tmp/codefest-$TS.env" "$ROOT/shared/.env.deploy"
    rm -f "/tmp/codefest-$TS.tgz" "/tmp/codefest-$TS.env"
    cd "$DIR"
    compose --profile prod pull --ignore-buildable
    compose --profile prod build
    SEED="$SEED" compose --profile migrate run --rm db-migrate
    compose --profile prod up -d --remove-orphans
    ln -sfn "$DIR" "$ROOT/current"
    # 只保留最近 KEEP 份。目錄名是 YYYYmmdd-HHMMSS，字典序＝時間序；current 指向的那份一定最新
    # shellcheck disable=SC2012  # 目錄名只有數字與 -，ls 安全
    ls -1 "$ROOT/releases" | sort -r | tail -n +"$((KEEP + 1))" | sed "s|^|$ROOT/releases/|" | xargs -r rm -rf
    ;;
  rollback)
    CUR="$(basename "$(readlink -f "$ROOT/current")")"
    if [ -n "$TS" ]; then
      TARGET="$TS"
    else
      # 不指定時：比 current 舊的版本裡最新的一個
      # shellcheck disable=SC2012  # 目錄名只有數字與 -，ls 安全
      TARGET="$(ls -1 "$ROOT/releases" | sort -r | awk -v cur="$CUR" 'found { print; exit } $0 == cur { found = 1 }')"
    fi
    [ -n "$TARGET" ] && [ -d "$ROOT/releases/$TARGET" ] || { echo "找不到可回滾的版本（現在是 $CUR）" >&2; exit 1; }
    echo "回滾：$CUR -> $TARGET"
    cd "$ROOT/releases/$TARGET"
    # 只換程式，不跑 db-migrate（drizzle push 是往前同步 schema，回滾時不要動資料表）
    compose --profile prod up -d --build --remove-orphans
    ln -sfn "$ROOT/releases/$TARGET" "$ROOT/current"
    ;;
  logs)
    cd "$ROOT/current"
    if [ -n "$TS" ]; then compose --profile prod logs --tail 200 "$TS"; else compose --profile prod logs --tail 200; fi
    ;;
  status)
    cd "$ROOT/current"
    compose --profile prod ps
    echo; echo "current -> $(readlink -f "$ROOT/current")"
    ls -1t "$ROOT/releases"
    ;;
  *)
    echo "未知 action：$ACTION" >&2; exit 1
    ;;
esac
REMOTE
}

run_remote() { remote_script | vm_ssh sudo bash -s -- "$@"; }

check_health() {
  # shellcheck disable=SC1090
  DEPLOY_DOMAIN="$(set -a; . "$ENV_FILE"; echo "${DEPLOY_DOMAIN:?}")"
  log "檢查 https://${DEPLOY_DOMAIN}/healthz（第一次部署含申請憑證，最多等約 2 分鐘）"
  curl -fsS --retry 24 --retry-delay 5 --retry-all-errors --max-time 10 "https://${DEPLOY_DOMAIN}/healthz"
  echo
}

# 先跑一次不吃 stdin 的 ssh：第一次用 gcloud compute ssh 時要產生金鑰（可能互動詢問 passphrase），
# 不能讓它吃到後面 pipe 進去的遠端腳本
log "確認可以 ssh 到 ${NAME}（${ZONE}）"
vm_ssh true

case "$ACTION" in
  release)
    [ -f "$ENV_FILE" ] || { echo "找不到 $ENV_FILE，先 cp deploy/.env.deploy.example deploy/.env.deploy 並填值" >&2; exit 1; }
    if grep -q '^DB_PASSWORD=CHANGE_ME' "$ENV_FILE"; then
      echo "$ENV_FILE 的 DB_PASSWORD 還是範本值，請用 openssl rand -hex 16 產生" >&2; exit 1
    fi
    TS="$(date +%Y%m%d-%H%M%S)"
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    log "打包 ${REPO}"
    if git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
      (cd "$REPO" && git ls-files -co --exclude-standard -z | COPYFILE_DISABLE=1 tar --null -T - -czf "$TMP/codefest-$TS.tgz")
    else
      (cd "$REPO" && COPYFILE_DISABLE=1 tar -czf "$TMP/codefest-$TS.tgz" \
        --exclude ./node_modules --exclude '*/node_modules' --exclude '*/dist' \
        --exclude ./.git --exclude ./.env --exclude './deploy/.env.deploy' .)
    fi
    cp "$ENV_FILE" "$TMP/codefest-$TS.env"
    log "上傳（$(du -h "$TMP/codefest-$TS.tgz" | cut -f1)）"
    "${GC[@]}" compute scp --zone "$ZONE" "$TMP/codefest-$TS.tgz" "$TMP/codefest-$TS.env" "${NAME}:/tmp/"
    log "VM 上 build + migrate + up（版本 ${TS}）"
    run_remote release "$TS" "$SEED" "$KEEP"
    check_health
    ;;
  rollback)
    run_remote rollback "$ARG" 0 "$KEEP"
    check_health
    ;;
  logs | status)
    run_remote "$ACTION" "$ARG" 0 "$KEEP"
    ;;
  *)
    echo "用法：deploy/release.sh [release|rollback [時間戳]|logs [service]|status]" >&2
    exit 1
    ;;
esac
