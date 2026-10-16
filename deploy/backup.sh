#!/usr/bin/env bash
# DB zaxira nusxasi: /opt/mfy-backups/ ga siqilgan SQL fayl, 14 kundan eskilari o'chiriladi.
# Cron har kuni 03:00 da ishga tushiradi. Qo'lda ham ishlatsa bo'ladi.
# Tiklash: gunzip -c FAYL.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U mfy -d manage_boss
set -euo pipefail

APP_DIR=/opt/mfy-app
BACKUP_DIR=/opt/mfy-backups
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

FILE="$BACKUP_DIR/mfy-$(date +%Y-%m-%d_%H-%M).sql.gz"
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U mfy -d manage_boss --clean --if-exists | gzip > "$FILE"
find "$BACKUP_DIR" -name 'mfy-*.sql.gz' -mtime +14 -delete

echo "$(date '+%F %T') zaxira tayyor: $FILE ($(du -h "$FILE" | cut -f1))"
