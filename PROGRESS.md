# Loyiha jurnali — Yangihayot MFY Uyushmasi Mini App

Bu fayl loyihaning har bir bosqichini qisqacha qayd etib boradi. Har bir GitHub push'dan oldin shu faylga yangilanish qo'shiladi.

## Loyiha haqida
Yangihayot tuman mahalla uyushmasi uchun Telegram Mini App: boshliq xodimlarga mahalla raislariga tezkor qo'ng'iroq qilish vazifasini beradi, xodimlar bir-birining qo'ng'iroq holatini (bog'landi / ko'tarmadi / o'chiq) real vaqtda ko'radi, dublikat qo'ng'iroqlar oldini olinadi. Qo'shimcha: har bir operatsiya haqida Telegram guruhiga avtomatik xabar yuboriladi.

## Tech stack
- Backend: Fastify + TypeScript + Socket.io + Prisma 6 + PostgreSQL (Docker)
- Bot: Telegraf.js (@YangihayotUyushma_bot)
- Frontend: React + TypeScript + Vite + Tailwind v4 + Telegram WebApp SDK (@telegram-apps/sdk)
- Auth: Telegram `initData` orqali (boss/xodim rollari), dev-mode uchun bypass header

## Bosqichlar

### 2026-09-25 — Loyiha boshlandi
- Talablar aniqlandi: dinamik xodimlar (max 5, boss qo'shadi), 30 ta mahalla raisi, real-time qo'ng'iroq statusi, rangli dashboard (yashil/qizil/sariq)
- Telegram bot yaratildi: `@YangihayotUyushma_bot`
- Node.js 22 ga o'tildi (nvm orqali)
- Backend: Fastify + Socket.io + Telegraf + Prisma 6.19.3 (stabil, 7-RC dan qaytarildi) + ExcelJS o'rnatildi
- PostgreSQL Docker konteynerda ishga tushirildi (port 5433, tizim postgres bilan to'qnashmasligi uchun)
- Prisma schema: User (BOSS/EMPLOYEE), Mahalla, CallCampaign, CallTask, CallEvent
- Backend struktura: auth (Telegram initData HMAC tekshiruvi + dev-bypass), Socket.io gateway ("dashboard" xonasi), REST API (mahalla CRUD + Excel import, xodim taklif-link tizimi, kampaniya yaratish, vazifa holatini o'zgartirish — race-condition himoyasi bilan)
- **Guruh xabarnomasi**: xodim qo'ng'iroq holatini o'zgartirganda (bog'landi/ko'tarmadi/o'chiq) bot avtomatik ravishda belgilangan Telegram guruhiga xabar yuboradi. Guruh ID ni olish uchun botni guruhga qo'shib `/chatid` yozish kifoya
- Server ishga tushirilib tekshirildi: `/health` OK, bot polling ishlayapti
- Frontend: Vite + React + TS skeleti, Tailwind v4, @telegram-apps/sdk, socket.io-client o'rnatildi
