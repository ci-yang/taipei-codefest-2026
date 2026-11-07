#!/usr/bin/env bash
# GCE startup-script（Debian 12 用）。gcp-up.sh 以 metadata `startup-script` 帶進 VM。
# GCE 每次開機都會跑 startup-script，所以每一步都要能重跑（已裝就跳過）。
#
# 為什麼不是 cloud-init：GCE 官方 Debian 12 image 沒有內建 cloud-init，
# 放在 `user-data` metadata 的 cloud-init.yaml 不會被執行。cloud-init.yaml 留給
# Ubuntu image（BOOTSTRAP=cloud-init）用，兩份做的事相同。
#
# 防火牆：只靠 GCP 防火牆規則（gcp-up.sh 建的 codefest-web + default 網路的 SSH 規則），
# VM 內不開 ufw。Docker 發布的 port 會繞過 ufw 的 iptables 規則，開了也擋不住，徒增誤會。
set -euo pipefail

log() { echo "[codefest-bootstrap] $*"; }

# 1. 2 GB swap：e2-medium 只有 4 GB，pnpm install + vite build 同時跑可能吃滿記憶體
if ! swapon --show | grep -q '/swapfile'; then
  if [ ! -f /swapfile ]; then
    log "建立 /swapfile"
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Docker Engine + compose plugin（Docker 官方 apt repo；Debian 自帶的 docker.io 沒有 compose v2 plugin）
if ! docker compose version >/dev/null 2>&1; then
  log "安裝 docker"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# 3. 部署目錄（release.sh 會放 releases/<時間戳>、current 符號連結、shared/.env.deploy）
install -d -m 0755 /opt/codefest /opt/codefest/releases
install -d -m 0700 /opt/codefest/shared

touch /var/lib/codefest-bootstrap.done
log "完成"
