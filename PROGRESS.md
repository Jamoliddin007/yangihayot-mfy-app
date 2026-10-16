# Loyiha jurnali — Yangihayot MFY Uyushmasi Mini App

Bu fayl ikki qismdan iborat:
1. **Hozirgi holat** — loyiha hozir qanday ishlaydi, qanday ishga tushiriladi, nima qolgan (har safar yangilanadi).
2. **Bosqichlar jurnali** — har bir ish bosqichi sana bilan (eng yangisi pastda).

---

# 1. Hozirgi holat

## Loyiha haqida
Yangihayot tuman mahalla uyushmasi uchun Telegram Mini App:
- **Boshliq** "vazifa" yaratadi (masalan: *"Bugun 09:00 majlis haqida xabar berish"*) — unga barcha faol mahalla raislari avtomatik qo'shiladi.
- **Xodimlar** (maksimal 5 ta) raislarga qo'ng'iroq qiladi va natijani belgilaydi: ✅ bog'landi / 📵 ko'tarmadi / ⚠️ telefon o'chiq.
- Hamma holatni **real vaqtda** ko'radi (rangli kartochkalar). Bitta raisga ikki xodim bir vaqtda qo'ng'iroq qila olmaydi.
- Har bir amal haqida Telegram **guruhiga** avtomatik xabar boradi.

## Texnologiyalar
| Qism | Texnologiya | Nega |
|---|---|---|
| Backend | Fastify 5 + TypeScript | Node.js'dagi eng tez frameworklardan biri |
| Ma'lumotlar bazasi | PostgreSQL 16 (Docker, port **5433**) + Prisma 6 | Ishonchli, tipli so'rovlar |
| Real vaqt | Socket.io | Statuslar barcha xodimlarga darhol yetadi |
| Bot | Telegraf (`@YangihayotUyushma_bot`) | Ro'yxatdan o'tish, taklif havolalari, guruh xabarlari |
| Frontend | React 19 + Vite 8 + Tailwind v4 | Yengil (~87 KB gzip), tez |
| Telegram | Rasmiy `telegram-web-app.js` | Auth (initData), mavzu ranglari, tebranish, tasdiqlash oynalari |

## Server
| | |
|---|---|
| Hosting | **Contabo Cloud VPS 4** (4 vCPU, 8 GB RAM, 100 GB SSD), EU (Germaniya), Ubuntu 24.04 — $7.39/oy, oylik obuna (2026-10-16 xarid qilindi) |
| Domen | **https://yangihayot-mfy.duckdns.org** (DuckDNS, bepul) |
| Server IP | **158.220.100.206** (DuckDNS shu IP'ga yo'naltirilgan) |
| Holat | ✅ **Ishlayapti** (2026-10-16 dan). HTTPS: Let's Encrypt, avtomatik yangilanadi |
| Kirish | Faqat SSH kalit bilan: `ssh root@158.220.100.206`. Parol bilan kirish o'chirilgan. Favqulodda: Contabo panelidagi VNC konsoli + root parol |
| Papka (serverda) | `/opt/mfy-app` (kod + `.env`), zaxiralar: `/opt/mfy-backups` |

## Arxitektura (oddiy tilda)
```
Telegram ilova ──► https://yangihayot-mfy.duckdns.org
                        │
                   Caddy (80/443, avtomatik HTTPS sertifikati)
                        │
                   Ilova konteyneri (port 4000, tashqariga yopiq)
                    ├─ /                  → tayyor frontend
                    ├─ /api/...           → REST API
                    ├─ /socket.io         → real vaqt yangilanishlari
                    └─ /telegram/webhook  → Telegram bot (webhook)
                        │
                   PostgreSQL konteyneri (tashqariga yopiq) ── har kuni 03:00 zaxira nusxa
```
Hammasi `docker-compose.prod.yml` da. Server qayta yonsa, hammasi o'zi ishga tushadi.

## Xavfsizlik qanday ishlaydi
- Har bir so'rov Telegram imzolagan `initData` bilan keladi, backend uni bot tokeni bilan tekshiradi (soxtalashtirib bo'lmaydi, 24 soatdan eski bo'lsa rad etiladi).
- Foydalanuvchi bazada bo'lishi va faol (`isActive`) bo'lishi shart.
- Birinchi `/start` bosgan odam — boshliq. Xodimlar faqat boshliq bergan **bir martalik taklif havolasi** orqali qo'shiladi.
- **Dev rejim** (brauzerda Telegram ID bilan kirish) faqat `.env`da `DEV_AUTH=true` bo'lsa ishlaydi. **Ochiq serverda hech qachon yoqmang.**

## Ishga tushirish

### Birinchi marta
```bash
docker compose up -d                       # PostgreSQL
cd backend && npm install && cp .env.example .env   # .env ni to'ldiring
npx prisma migrate deploy
cd ../frontend && npm install
```

### Serverga yangi versiya chiqarish
Kod `main` ga birlashtirilgach, serverda bitta buyruq:
```bash
ssh root@<SERVER_IP> /opt/mfy-app/deploy/deploy.sh
```
U GitHub'dan oxirgi kodni oladi, Docker image'ni qayta build qiladi va ilovani qayta ishga tushiradi (DB migratsiyalari avtomatik).

### Serverni birinchi marta sozlash (bir marta)
1. `deploy/setup-server.sh` — Docker, firewall (faqat 22/80/443), fail2ban, avtomatik xavfsizlik yangilanishlari, kunlik backup cron, kodni `/opt/mfy-app` ga yuklash.
2. `/opt/mfy-app/.env` ni to'ldirish (namuna: `deploy/.env.example`).
3. Eski ma'lumotlarni ko'chirish (lokal DB → server).
4. `deploy/deploy.sh`.

### Server bilan ishlash
```bash
cd /opt/mfy-app
docker compose -f docker-compose.prod.yml ps            # holat
docker compose -f docker-compose.prod.yml logs -f app   # ilova loglari
./deploy/backup.sh                                       # qo'lda zaxira nusxa
```

### Lokal ishlab chiqish (kod o'zgarishini darhol ko'rish)
```bash
cd backend && DEV_AUTH=true npm run dev    # 4000-port
cd frontend && npm run dev                 # 5173-port, /api va /socket.io avtomatik 4000 ga proxy
```
Brauzerda `http://localhost:5173` → Telegram ID kiritib kirish (faqat `DEV_AUTH=true` bo'lsa).

> ⚠️ **Server ishga tushgandan keyin** lokal backendni **asosiy bot tokeni bilan ishga tushirmang**: lokal bot polling rejimida Telegram'dagi webhook'ni o'chirib yuboradi va serverdagi bot javob bermay qoladi. Lokal test uchun BotFather'dan alohida **test bot** oling va lokal `.env` ga uning tokenini yozing.

### Testlar
```bash
cd backend && npm test                     # initData imzosini tekshirish testlari
```

## `.env` sozlamalari (backend)
| O'zgaruvchi | Ma'nosi |
|---|---|
| `BOT_TOKEN`, `BOT_USERNAME` | BotFather'dan |
| `DATABASE_URL` | PostgreSQL manzili (port 5433) |
| `PORT` | Backend porti (standart 4000) |
| `FRONTEND_URL` | Mini App'ning **https** manzili (botdagi "Ilovani ochish" tugmasi) |
| `GROUP_CHAT_ID` | Xabarlar boradigan guruh. Olish: botni guruhga qo'shib `/chatid` yozing |
| `DEV_AUTH` | `true` — faqat lokal test uchun |
| `FRONTEND_DIST` | Ixtiyoriy, frontend build papkasi |
| `BOT_MODE` | `polling` (lokal, standart) yoki `webhook` (server — compose o'zi qo'yadi) |

Serverdagi `.env` boshqacha va soddaroq — `deploy/.env.example` ga qarang (`DOMAIN`, `POSTGRES_PASSWORD`, `BOT_TOKEN`, `BOT_USERNAME`, `GROUP_CHAT_ID`).

## Vazifa holatlari (qoidalar)
```
PENDING (qizil) ──"Qo'ng'iroq qilish"──► IN_PROGRESS (sariq)
IN_PROGRESS / NO_ANSWER / PHONE_OFF ──natija──► REACHED (yashil) | NO_ANSWER (to'q sariq) | PHONE_OFF (kulrang)
Har qanday holat ──"Qayta boshlash" (faqat boshliq)──► PENDING
```
- Natijani faqat vazifani band qilgan xodim (yoki boshliq) belgilaydi. `REACHED` — yakuniy.
- Bir vaqtda faqat **bitta faol vazifa**. Yakunlangan vazifada hech narsa o'zgartirib bo'lmaydi.
- Har bir o'zgarish `CallEvent` jadvaliga yoziladi (kim, qachon, qaysi holat).

## Ochiq masalalar / keyingi qadamlar
- [x] Server xarid qilindi, sozlandi, ma'lumotlar ko'chirildi — **ilova serverda ishlayapti**.
- [ ] **Telegram'da qo'lda sinash**: botga `/start` → "Ilovani ochish" → qo'ng'iroq/natija, tungi rejim, guruh xabari.
- [ ] BotFather'da menyu tugmasi / Mini App manzili sozlangan bo'lsa — `https://yangihayot-mfy.duckdns.org` ga o'zgartirish.
- [ ] Lokal ishlab chiqish uchun alohida test bot (asosiy bot tokeni bilan lokal backendni ishga tushirmang!).
- [ ] Contabo obunasi oylik ($7.39) — keyingi to'lov 2026-11-15.
- [ ] Hisobot: yakunlangan vazifalar tarixi va Excel eksport (backendda ExcelJS bor).
- [ ] Vazifa yo'nalishlari bo'yicha integratsion testlar (hozir faqat auth testlari).
- [ ] Ixtiyoriy: Telegraf → grammY (zamonaviyroq bot kutubxonasi) — shoshilinch emas.

---

# 2. Bosqichlar jurnali

### 2026-09-25 — Loyiha boshlandi
- Talablar aniqlandi: dinamik xodimlar (max 5, boss qo'shadi), 30 ta mahalla raisi, real-time qo'ng'iroq statusi, rangli dashboard (yashil/qizil/sariq)
- Telegram bot yaratildi: `@YangihayotUyushma_bot`
- Node.js 22 ga o'tildi (nvm orqali)
- Backend: Fastify + Socket.io + Telegraf + Prisma 6.19.3 (stabil, 7-RC dan qaytarildi) + ExcelJS o'rnatildi
- PostgreSQL Docker konteynerda ishga tushirildi (port 5433, tizim postgres bilan to'qnashmasligi uchun)
- Prisma schema: User (BOSS/EMPLOYEE), Mahalla, CallCampaign, CallTask, CallEvent
- Backend struktura: auth (Telegram initData HMAC tekshiruvi + dev-bypass), Socket.io gateway ("dashboard" xonasi), REST API (mahalla CRUD + Excel import, xodim taklif-link tizimi, kampaniya yaratish, vazifa holatini o'zgartirish — race-condition himoyasi bilan)
- **Guruh xabarnomasi**: xodim qo'ng'iroq holatini o'zgartirganda bot avtomatik ravishda belgilangan Telegram guruhiga xabar yuboradi
- Frontend: Vite + React + TS skeleti, Tailwind v4, @telegram-apps/sdk, socket.io-client o'rnatildi

### 2026-09-25 — Vaqtinchalik ngrok joylashtirish va bug tuzatishlar
- VPS (45.137.148.109) tarmoq darajasida ulanmadi — o'rniga ngrok tunnel orqali vaqtinchalik ishga tushirildi
- Vite dev-server proxy qo'shildi (`/api`, `/socket.io` → `localhost:4000`)
- ngrok bepul tarifining brauzer ogohlantirish sahifasi chetlab o'tildi (`ngrok-skip-browser-warning` header)
- **Bug**: "Qo'ng'iroq qilish" → "Bad Request" (body'siz so'rovda `Content-Type: application/json`) — tuzatildi
- **Bug**: "Bog'landi" bosilganda UI yangilanmasdi — har bir amal javobi darhol local state'ga qo'llanadigan qilindi
- TaskCard qayta dizayn qilindi
- PR #1: https://github.com/Jamoliddin007/yangihayot-mfy-app/pull/1

### 2026-10-16 — Senior darajadagi audit: xavfsizlik, mantiq, tezlik, Telegram UX
Branch: `feature/hardening-and-perf`

**🔴 Xavfsizlik**
- **Dev-bypass yopildi.** Avval `NODE_ENV` o'rnatilmagani uchun ngrok orqali istalgan odam `x-dev-telegram-id: <boshliq ID>` header'i bilan boshliq bo'lib kira olardi. Endi faqat `DEV_AUTH=true` aniq yoqilganda ishlaydi (standart: o'chiq). HTTP va Socket.io auth bitta `resolveUser()` funksiyasiga birlashtirildi.
- **`/api/users` faqat boshliqqa.** Avval xodimlar ham ko'ra olardi — javobda boshqa xodimlarning ishlatilmagan taklif kodlari bor edi (o'zgalar o'rniga ulanib olish mumkin edi).
- initData hash solishtirish `timingSafeEqual` bilan; buzuq `user` JSON va noto'g'ri Telegram ID endi 500 emas, rad etish beradi.

**🟠 Mantiqiy xatolar**
- Yakunlangan vazifada qo'ng'iroq/natija/reset endi **mumkin emas** (backend tekshiradi).
- Vazifa yakunlanganda ekran darhol yangilanadi: boshliqqa "Yangi vazifa" formasi chiqadi (avval sahifani qayta yuklash kerak edi).
- Bir vaqtda faqat **bitta faol vazifa** yaratish mumkin.
- Natija faqat to'g'ri holatlardan belgilanadi (`REACHED` qayta o'zgartirilmaydi); barcha o'tishlar **atomik** (tranzaksiya + shartli update) — poyga holatlari yo'q.
- "Qayta boshlash" endi tarixga (`CallEvent`) yoziladi va guruhga xabar beradi. Vazifa yaratilishi/yakunlanishi ham guruhga xabar qilinadi (yakunda: "X/Y MFY bilan bog'lanildi").
- 5 xodim limitini o'chirib-yoqish orqali aylanib o'tish yopildi.
- Excel import: faqat `.xlsx` (ExcelJS `.xls` o'qimaydi), takroriy MFY nomlari o'tkazib yuboriladi, fayl hajmi 5 MB bilan cheklandi.
- Socket qayta ulanganda (internet uzilsa) holat avtomatik qayta yuklanadi.
- Yagona xato formati: validatsiya xatolari 400, topilmasa 404 (avval 500 qaytarardi). Bot handler'idagi xato endi botni to'xtatmaydi. To'xtashda DB ulanishi to'g'ri yopiladi.

**⚡ Tezlik**
- **Frontend endi build qilinib, backend'ning o'zidan beriladi** (`@fastify/static`). Avval Vite dev-server ngrok orqali yuzlab siqilmagan fayl yuborardi — endi 3 ta fayl, ~87 KB (gzip).
- gzip siqish (`@fastify/compress`); hash'li fayllar 1 yil keshlanadi, `index.html` har doim yangi.
- Ishlatilmagan paketlar olib tashlandi: `@telegram-apps/sdk`, `react-router-dom`, `pino`, `pino-pretty`.
- TaskCard `memo` bilan: bitta status o'zgarsa, 30 ta kartochkadan faqat bittasi qayta chiziladi.

**📱 Telegram UX**
- **Tungi rejim**: barcha ranglar Telegram mavzusidan olinadi (`--tg-theme-*`), mavzu almashsa avtomatik o'zgaradi. Telegram header/fon ranglari moslashtirildi.
- **Tebranish (haptic)**: qo'ng'iroq, muvaffaqiyat va xatoda.
- **Native tasdiqlash oynasi**: vazifani yakunlash, qayta boshlash, mahallani va xodimni o'chirishdan oldin.

**🧪 Tekshiruv**
- Backend: `npm test` — initData imzosi uchun 5 ta test (to'g'ri, boshqa token, soxtalashtirilgan, eskirgan, buzuq) — hammasi o'tdi.
- `tsc` (backend + frontend) va `vite build` xatosiz.
- Ishlab turgan serverda tekshirildi: static + SPA fallback, gzip, kesh header'lari, 401/403/400/404 javoblari, xodim `/api/users` ga kira olmasligi, `DEV_AUTH` o'chiq bo'lsa boshliq ID bilan kirib bo'lmasligi.
- ⚠️ Telegram ichida qo'lda sinab ko'rish kerak (mavzu, tebranish, tasdiqlash oynalari).

**Ishga tushirishdagi o'zgarish**: endi `cd frontend && npm run build`, keyin backend, ngrok esa **4000** portga (`ngrok http 4000`). `.env`da `DEV_AUTH` yozilmagan bo'lsa — brauzer orqali dev-kirish ishlamaydi (bu to'g'ri).

**Holat**: ✅ PR #1 va PR #2 (https://github.com/Jamoliddin007/yangihayot-mfy-app/pull/2) `main` ga birlashtirildi. Barcha yuqoridagi o'zgarishlar endi `main` da.

### 2026-10-16 — Doimiy serverga (Contabo VPS) tayyorgarlik
Branch: `feature/deploy-vps`

**Qarorlar**
- ngrok o'rniga doimiy server: **Contabo Cloud VPS 4**, EU, Ubuntu 24.04, **1 oylik** obuna ($7.39/oy, QQS bilan). Avto-backup va boshqa pullik qo'shimchalar olinmadi — zaxira nusxani o'zimiz sozlaymiz.
- Domen: **yangihayot-mfy.duckdns.org** (bepul). Telegram Mini App HTTPS talab qiladi — sertifikatni Caddy avtomatik oladi.
- Loyiha tugashini kutmasdan server olindi: Contabo serverni tayyorlashga vaqt ketadi, doimiy manzil sinovni osonlashtiradi, deploy muammolari erta chiqadi.

**Qilingan ishlar**
- **Bot webhook rejimi** (`BOT_MODE=webhook`): Telegram yangilanishlarni `/telegram/webhook` ga yuboradi; soxta so'rovlar maxfiy token orqali rad etiladi (401). Lokal ishlab chiqishda avvalgidek polling.
- **`Dockerfile`**: frontend + backend bitta image'da; ishga tushganda DB migratsiyalari avtomatik; root bo'lmagan foydalanuvchi bilan ishlaydi.
- **`docker-compose.prod.yml`**: PostgreSQL + ilova + Caddy. DB va ilova porti tashqariga yopiq, faqat 80/443 ochiq. Loglar hajmi cheklangan (10 MB × 3).
- **`deploy/setup-server.sh`**: serverni bir marta sozlash (Docker, firewall, fail2ban, avto-yangilanishlar, Toshkent vaqti, kunlik backup).
- **`deploy/deploy.sh`**: yangi versiyani bitta buyruq bilan chiqarish.
- **`deploy/backup.sh`**: har kuni 03:00 da DB zaxira nusxasi, 14 kun saqlanadi.
- Test fayllari production build'ga kirmaydi.

**Tekshiruv**
- Docker image lokal build qilindi va ishga tushirildi: migratsiyalar qo'llandi, frontend berildi, `/health` 200, auth'siz `/api/me` 401. ✅
- `tsc` xatosiz, skriptlar sintaksisi tekshirildi.
- Webhook va HTTPS haqiqiy serverda tekshiriladi (lokalda haqiqiy botning webhook'ini o'zgartirmaslik uchun sinalmadi).

**Keyingi qadam**: Contabo emailidan server IP → DuckDNS'ga yozish → serverni sozlash.

### 2026-10-16 — 🚀 Ilova doimiy serverda ishga tushdi
**Manzil: https://yangihayot-mfy.duckdns.org** · Server: Contabo, `158.220.100.206`

**Qilingan ishlar**
- PR #3 (deploy fayllari) `main` ga birlashtirildi.
- DuckDNS `yangihayot-mfy.duckdns.org` → `158.220.100.206`.
- Contabo'da Ubuntu 24.04 qayta o'rnatildi: root foydalanuvchi + SSH kalit (`jamoliddin-laptop`). Sabab: buyurtmadagi parol bilan kirib bo'lmadi (`l`/`I` harflari skrinshotda farqlanmasdi), server bo'sh edi — qayta o'rnatish eng toza yo'l bo'ldi.
- `deploy/setup-server.sh`: Docker, firewall (faqat 22/80/443), fail2ban, avtomatik xavfsizlik yangilanishlari, Toshkent vaqti, kunlik backup (03:00).
- **SSH'ga parol bilan kirish o'chirildi** — faqat kalit. (Eski parol chatda/skrinshotda ko'ringan edi — endi ahamiyatsiz.)
- `.env` serverga yuklandi (faqat root o'qiy oladi), DB uchun yangi tasodifiy parol.
- Birinchi deploy: DB migratsiyasi, frontend, Caddy HTTPS sertifikati, bot **webhook**.
- **Lokal ma'lumotlar ko'chirildi**: 5 foydalanuvchi, 30 mahalla, 1 vazifa, 29 qo'ng'iroq yozuvi, 18 hodisa — sonlar lokal bilan bir xil.

**Tekshiruv** ✅
- `https://` sahifa 200, `/health` 200, `http` → `https` avtomatik (308).
- Telegram `getWebhookInfo`: to'g'ri URL, xato yo'q. Soxta webhook so'rovi → 401.
- Backup qo'lda sinaldi: `/opt/mfy-backups/mfy-2026-10-16_13-16.sql.gz`.
- Firewall faol, SSH faqat kalit bilan (parol bilan urinish — `Permission denied (publickey)`).

**O'rganilgan saboqlar**
- Contabo qayta o'rnatishdan keyin cloud-init oxirida serverni **yana bir marta qayta yuklaydi** — SSH birinchi ochilganda darhol ishga tushirilgan skript uzilib qoldi. Endi: `cloud-init ... finished` ni kutib, keyin sozlash.
- `docker run --env-file` `.env`dagi qo'shtirnoqlarni qiymatga qo'shib yuboradi — production'da `DATABASE_URL` ni compose o'zi beradi, muammo yo'q.

**⚠️ Muhim**: endi lokal kompyuterda backend'ni **asosiy bot tokeni bilan ishga tushirmang** — polling serverdagi webhook'ni o'chirib yuboradi va bot javob bermay qoladi.
