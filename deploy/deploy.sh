#!/usr/bin/env bash
# Yangi versiyani serverga chiqarish: GitHub'dan oxirgi kodni olib, qayta build qiladi.
# Ishlatish (serverda): /opt/mfy-app/deploy/deploy.sh [branch]   (standart: main)
set -euo pipefail

APP_DIR=/opt/mfy-app
BRANCH=${1:-main}
cd "$APP_DIR"

echo "==> Kod yangilanmoqda ($BRANCH)"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Build va ishga tushirish"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Eski image'larni tozalash"
docker image prune -f >/dev/null

echo "==> Holat"
docker compose -f docker-compose.prod.yml ps
