#!/usr/bin/env bash
# Yangi Ubuntu 24.04 serverni bir marta sozlash (root sifatida ishga tushiriladi).
# Takroran ishga tushirish xavfsiz.
set -euo pipefail

APP_DIR=/opt/mfy-app
REPO_URL=https://github.com/Jamoliddin007/yangihayot-mfy-app.git

echo "==> Tizimni yangilash va kerakli paketlar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades

echo "==> Vaqt mintaqasi: Asia/Tashkent"
timedatectl set-timezone Asia/Tashkent

echo "==> Avtomatik xavfsizlik yangilanishlari"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> Firewall: faqat SSH, HTTP, HTTPS"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> fail2ban (SSH parol taxmin qilishdan himoya)"
systemctl enable --now fail2ban

echo "==> Loyiha kodi: $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> Kunlik DB zaxira nusxasi (har kuni 03:00)"
chmod +x "$APP_DIR/deploy/"*.sh
cat > /etc/cron.d/mfy-backup <<EOF
0 3 * * * root $APP_DIR/deploy/backup.sh >> /var/log/mfy-backup.log 2>&1
EOF

echo
echo "Tayyor. Keyingi qadam: $APP_DIR/.env faylini to'ldirib, $APP_DIR/deploy/deploy.sh ni ishga tushiring."
