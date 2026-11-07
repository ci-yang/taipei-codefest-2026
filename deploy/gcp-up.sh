#!/usr/bin/env bash
# 建立（或確認已存在）codefest 的 GCP 資源。可重複執行：每一步先查，存在就跳過。
#
#   PROJECT=<gcp-project-id> deploy/gcp-up.sh
#
# 參數（環境變數，括號內為預設）：
#   PROJECT        必填，GCP 專案 ID
#   ZONE           (asia-east1-b)            REGION 由 ZONE 推得
#   MACHINE        (e2-medium)
#   NAME           (codefest-vm)
#   TAG            (codefest-web)            VM 網路標記，防火牆規則以此套用
#   FIREWALL_RULE  (codefest-web)
#   NETWORK        (default)
#   DISK_SIZE      (20GB)                    pd-balanced
#   STATIC_IP      (1)                       1 = 保留一個區域靜態 IP（NAME-ip），VM 停機重開 IP 不變，DNS 不用改
#   BOOTSTRAP      (startup-script)          startup-script = Debian 12 + deploy/vm-bootstrap.sh
#                                            cloud-init     = Ubuntu 24.04 + deploy/cloud-init.yaml
#
# 會建立的資源：compute API（啟用）、防火牆規則、（可選）靜態 IP、VM。
# 不會碰 DNS／Cloudflare；印出的 IP 要自己（或 lead）設到 Cloudflare A 記錄。
set -euo pipefail

: "${PROJECT:?請設定 PROJECT=<gcp-project-id>}"
ZONE="${ZONE:-asia-east1-b}"
REGION="${ZONE%-*}"
MACHINE="${MACHINE:-e2-medium}"
NAME="${NAME:-codefest-vm}"
TAG="${TAG:-codefest-web}"
FIREWALL_RULE="${FIREWALL_RULE:-codefest-web}"
NETWORK="${NETWORK:-default}"
DISK_SIZE="${DISK_SIZE:-20GB}"
STATIC_IP="${STATIC_IP:-1}"
BOOTSTRAP="${BOOTSTRAP:-startup-script}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
G=(gcloud --project "$PROJECT" --quiet)

log() { echo "==> $*"; }

case "$BOOTSTRAP" in
  startup-script)
    IMAGE_FAMILY=debian-12
    IMAGE_PROJECT=debian-cloud
    METADATA="startup-script=${HERE}/vm-bootstrap.sh"
    ;;
  cloud-init)
    IMAGE_FAMILY=ubuntu-2404-lts-amd64
    IMAGE_PROJECT=ubuntu-os-cloud
    METADATA="user-data=${HERE}/cloud-init.yaml"
    ;;
  *)
    echo "BOOTSTRAP 只能是 startup-script 或 cloud-init" >&2
    exit 1
    ;;
esac

log "專案 ${PROJECT}，${ZONE}，${MACHINE}，VM=${NAME}，image=${IMAGE_PROJECT}/${IMAGE_FAMILY}"

# 1. compute API（已啟用時 gcloud 直接成功，本身就冪等；先查只是讓輸出清楚）
if "${G[@]}" services list --enabled --filter='config.name=compute.googleapis.com' --format='value(config.name)' | grep -q compute; then
  log "compute API 已啟用"
else
  log "啟用 compute API（第一次約 1 分鐘）"
  "${G[@]}" services enable compute.googleapis.com
fi

# 2. 防火牆：80/443（含 HTTP/3 的 udp/443）給帶 TAG 的 VM。
#    SSH(22) 用 default 網路既有的 default-allow-ssh；若專案刪過那條，release.sh 會連不上。
if "${G[@]}" compute firewall-rules describe "$FIREWALL_RULE" >/dev/null 2>&1; then
  log "防火牆規則 ${FIREWALL_RULE} 已存在"
else
  log "建立防火牆規則 ${FIREWALL_RULE}"
  "${G[@]}" compute firewall-rules create "$FIREWALL_RULE" \
    --network "$NETWORK" \
    --direction INGRESS \
    --allow tcp:80,tcp:443,udp:443 \
    --source-ranges 0.0.0.0/0 \
    --target-tags "$TAG"
fi
if ! "${G[@]}" compute firewall-rules describe default-allow-ssh >/dev/null 2>&1; then
  echo "警告：找不到 default-allow-ssh。若沒有其他放行 tcp:22 的規則，release.sh 的 gcloud compute ssh 會連不上。" >&2
fi

# 3. 靜態 IP（可選）
ADDRESS_ARGS=()
if [ "$STATIC_IP" = "1" ]; then
  if "${G[@]}" compute addresses describe "${NAME}-ip" --region "$REGION" >/dev/null 2>&1; then
    log "靜態 IP ${NAME}-ip 已存在"
  else
    log "保留靜態 IP ${NAME}-ip"
    "${G[@]}" compute addresses create "${NAME}-ip" --region "$REGION"
  fi
  ADDRESS_ARGS=(--address "$("${G[@]}" compute addresses describe "${NAME}-ip" --region "$REGION" --format='value(address)')")
fi

# 4. VM
if "${G[@]}" compute instances describe "$NAME" --zone "$ZONE" >/dev/null 2>&1; then
  log "VM ${NAME} 已存在（不重建；要更新 bootstrap 請用 gcloud compute instances add-metadata）"
else
  log "建立 VM ${NAME}"
  "${G[@]}" compute instances create "$NAME" \
    --zone "$ZONE" \
    --machine-type "$MACHINE" \
    --image-family "$IMAGE_FAMILY" \
    --image-project "$IMAGE_PROJECT" \
    --boot-disk-size "$DISK_SIZE" \
    --boot-disk-type pd-balanced \
    --tags "$TAG" \
    --metadata-from-file "$METADATA" \
    ${ADDRESS_ARGS[@]+"${ADDRESS_ARGS[@]}"}  # 空陣列寫法相容 macOS 內建 bash 3.2 的 set -u
fi

IP="$("${G[@]}" compute instances describe "$NAME" --zone "$ZONE" \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)')"

cat <<MSG

外部 IP：${IP}

下一步：
  1. Cloudflare DNS：A 記錄 <DEPLOY_DOMAIN> -> ${IP}，Proxy status = DNS only（灰雲）
  2. 等 VM 裝好 docker（約 2–4 分鐘）。確認方式：
       gcloud compute ssh ${NAME} --project ${PROJECT} --zone ${ZONE} -- test -f /var/lib/codefest-bootstrap.done
  3. PROJECT=${PROJECT} ZONE=${ZONE} NAME=${NAME} deploy/release.sh
MSG
