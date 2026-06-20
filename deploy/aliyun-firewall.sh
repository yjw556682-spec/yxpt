#!/usr/bin/env bash
# aliyun-firewall.sh — open 80/443 for HTTP/HTTPS traffic.
#
# IMPORTANT — two layers of firewall exist on Aliyun Lightweight:
#   1. Aliyun Security Group (in the web console). This is the OUTER layer.
#      You MUST also add rules there — adding iptables rules alone is NOT
#      enough, the Security Group is checked first.
#      → Console: 轻量应用服务器 → 实例 → 防火墙 → 添加规则 → TCP:80, TCP:443
#   2. iptables / ufw inside the OS (this script). Defense in depth.
#
# Run with sudo:  sudo bash deploy/aliyun-firewall.sh

set -euo pipefail

echo "[yxpt] configuring in-OS firewall (iptables)..."

# Try ufw first (Ubuntu/Debian default)
if command -v ufw >/dev/null 2>&1; then
  echo "[yxpt] ufw detected — using it"
  ufw allow OpenSSH || true
  ufw allow 80/tcp  || true
  ufw allow 443/tcp || true
  # Don't enable ufw here non-interactively — many Aliyun images ship with
  # iptables rules already; turning ufw on without review can lock you out.
  echo "[yxpt] ufw rules added. Run 'ufw enable' after review if it's not already active."
else
  # Fall back to iptables
  echo "[yxpt] using iptables"
  iptables -C INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80  -j ACCEPT
  iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 443 -j ACCEPT

  # Persist across reboots if iptables-save is available
  if command -v iptables-save >/dev/null 2>&1 && [ -d /etc/iptables ]; then
    iptables-save > /etc/iptables/rules.v4 || true
    echo "[yxpt] iptables rules persisted to /etc/iptables/rules.v4"
  fi
fi

cat <<'EOF'

[yxpt] in-OS firewall updated. NEXT STEP — Aliyun Security Group:

  1. Open https://swas.console.aliyun.com/
  2. Pick your Lightweight instance → 防火墙 (Firewall)
  3. Add rules:
       TCP 80   (HTTP)
       TCP 443  (HTTPS)
  4. (Optional) Restrict the source to your office/home IP for SSH (22).

EOF