#!/usr/bin/env bash
# Contabo to'lovidan 3 kun oldin platforma egasiga bot orqali Telegram'da eslatma.
# Cron (serverda, Toshkent vaqti): 0 9 12 * * /opt/mfy-app/deploy/payment-reminder.sh
# Sinash: /opt/mfy-app/deploy/payment-reminder.sh test
set -euo pipefail

ENV_FILE=/opt/mfy-app/.env
get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'"; }

TOKEN=$(get BOT_TOKEN)
CHAT=$(get PLATFORM_OWNER_TELEGRAM_ID)
PAY_DAY=$(get PAYMENT_DAY); PAY_DAY=${PAY_DAY:-15}

if [[ -z "$TOKEN" || -z "$CHAT" ]]; then
  echo "BOT_TOKEN yoki PLATFORM_OWNER_TELEGRAM_ID .env da yo'q" >&2
  exit 1
fi

TEXT="Eslatma: 3 kundan keyin (${PAY_DAY}-sana) Contabo serveri uchun to'lov muddati. To'lanmasa server o'chadi va bot ishlamay qoladi.

my.contabo.com → Billing"
[[ "${1:-}" == "test" ]] && TEXT="(Sinov) ${TEXT}"

curl -fsS -o /dev/null "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT}" \
  --data-urlencode "text=${TEXT}"
echo "$(date '+%F %T') eslatma yuborildi"
