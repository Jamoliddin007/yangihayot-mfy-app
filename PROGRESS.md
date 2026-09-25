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

### 2026-09-25 — Vaqtinchalik ngrok joylashtirish va bug tuzatishlar
- VPS (45.137.148.109) tarmoq darajasida umuman ulanmadi (ping/portlar yopiq) — doimiy server keyinga qoldirildi, o'rniga ngrok tunnel orqali vaqtinchalik ishga tushirildi
- Bitta ngrok tunnel (frontend porti) orqali frontend+backend ishlashi uchun Vite dev-server proxy qo'shildi (`/api`, `/socket.io` → `localhost:4000`), `VITE_API_URL` bo'sh qoldirilib same-origin qilindi
- ngrok bepul tarifining brauzer ogohlantirish sahifasi (`ngrok-skip-browser-warning` header) chetlab o'tildi — aks holda frontend JSON o'rniga HTML olib xato berardi
- **Bug**: "Qo'ng'iroq qilish" tugmasi bosilganda "Bad Request" — sababi: body yo'q so'rovlarda ham `Content-Type: application/json` yuborilib, Fastify `FST_ERR_CTP_EMPTY_JSON_BODY` xatosi berardi. `api.ts`da faqat body mavjud bo'lganda shu header qo'shiladigan qilib tuzatildi
- **Bug**: "Bog'landi" natija tugmasi bosilganda UI yangilanmasdi (backend 200 qaytarsa ham) — sababi UI faqat Socket.io broadcast eventiga tayangan, ba'zan yetib bormagan. `useCampaign.ts`ga `applyTask` qo'shilib, har bir amal (start/result/reset) o'z javobini darhol local state'ga qo'llaydigan qilindi
- **TaskCard qayta dizayn qilindi**: status badge qo'shildi, har bir amal uchun alohida "band" holati (bitta umumiy busy flag o'rniga), natija tugmalari 3 ustunli grid'ga, rangi va matni aniqroq qilib joylashtirildi, muvaffaqiyat toast xabari qo'shildi
- O'zgarishlar `feature/dev-single-origin-proxy` branchga commit+push qilindi, PR #1 yangilandi: https://github.com/Jamoliddin007/yangihayot-mfy-app/pull/1
- **Keyingi qadam**: `GROUP_CHAT_ID` hali sozlanmagan — guruh xabarnomasi ishlamayapti, foydalanuvchi botni guruhga qo'shib `/chatid` yozishi kerak
