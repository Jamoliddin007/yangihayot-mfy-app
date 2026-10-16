# Loyiha jurnali — MFY qo'ng'iroqlari platformasi (Telegram Mini App)

Bu fayl ikki qismdan iborat:
1. **Hozirgi holat** — loyiha hozir qanday ishlaydi, qanday ishga tushiriladi, nima qolgan (har safar yangilanadi).
2. **Bosqichlar jurnali** — har bir ish bosqichi sana bilan (eng yangisi pastda).

---

# 1. Hozirgi holat

## Loyiha haqida
Mahalla uyushmalari uchun **ko'p tashkilotli platforma** (Telegram bot + Mini App). Birinchi mijoz — **Yangihayot tumani MFY uyushmasi**; boshqa tumanlarga ham sotish mumkin — har bir tuman alohida tashkilot, bir-birini ko'rmaydi.

Ish jarayoni:
1. **Boshliq** topshiriq beradi: *nima* (yig'ilish / tadbir / boshqa), *qachon* (sana va vaqt), *qayerda*. Har bir xodimga botdan shaxsiy xabar boradi.
2. Har bir **MFY doimiy bitta xodimga biriktirilgan** (Yangihayot: 3 xodim × 10 MFY). Xodim o'z MFY raislariga qo'ng'iroq qilib, natijani belgilaydi: bog'landi / ko'tarmadi / telefon o'chiq + ixtiyoriy **izoh** ("rais kasalxonada").
3. Xodimlar bir-birining MFY'lari va holatini ko'radi; kerak bo'lsa **"Yordam berish"** orqali boshqaning MFY'siga qo'ng'iroq qiladi — boshliq va guruh buni ko'radi.
4. **Telegram guruhiga**: har bir natija + yakunlanganda xodimlar bo'yicha **yakuniy hisobot**.

## Tashkilotlar va rollar (universal tuzilma)
```
Platforma egasi (Jamoliddin) — yangi tashkilotlarni tasdiqlaydi, boshliq taklifini yaratadi
 └─ Tashkilot (masalan, Yangihayot tumani MFY uyushmasi)
     ├─ Boshliq(lar)  — topshiriq beradi, MFY va xodimlarni boshqaradi
     ├─ Xodimlar      — o'z MFY'lariga qo'ng'iroq qiladi, boshqalarga yordam beradi
     ├─ MFY'lar       — har biri bitta mas'ul xodimga biriktirilgan (sektor raqami bilan)
     ├─ Topshiriqlar  — bir vaqtda bittasi faol; tarix saqlanadi
     └─ Telegram guruhi (/ulash)
```
- **Rol tashkilot ichida** saqlanadi: bir kishi bir tashkilotda boshliq, boshqasida xodim bo'lishi mumkin; ilovada profil orqali tashkilot almashtiriladi.
- **Hech kim o'zini o'zi boshliq qila olmaydi.** Kirish faqat:
  - **Taklif havolasi** — rol havolaning ichida (xodim/boshliq), bir martalik, 14 kun amal qiladi, bekor qilinishi mumkin.
  - **Yangi tashkilot so'rovi** — botda "Tashkilot ochish" → platforma egasi botda "Tasdiqlash / Rad etish" → so'rovchi boshliq bo'ladi.
- **Ism** Telegram'dan olinadi; o'zi profilda, boshliq a'zo kartochkasida o'zgartira oladi.
- Boshliq xodimni **oldindan ism bilan qo'shishi** mumkin (MFY'larni darhol biriktirish uchun) — xodim havolani ochganda shu o'rinni egallaydi. U boshqa tashkilotda allaqachon ro'yxatdan o'tgan bo'lsa — akkauntlar xavfsiz birlashtiriladi.
- Himoyalar: oxirgi boshliqni o'chirib/xodimga tushirib bo'lmaydi; MFY'si bor xodimni o'chirishdan oldin MFY'larini o'tkazish shart; tashkilot to'xtatilsa (SUSPENDED) a'zolar kira olmaydi.

## Bot buyruqlari
| Qayerda | Buyruq | Kim | Nima qiladi |
|---|---|---|---|
| Shaxsiy | `/start` | hamma | Salomlashish + "Ilovani ochish"; a'zo bo'lmasa — "Tashkilot ochish" |
| Shaxsiy | `/start <kod>` | taklif olgan | Taklif havolasi orqali qo'shilish |
| Shaxsiy | `/tashkilotlar` | platforma egasi | Barcha tashkilotlar + "Boshliq taklifi" tugmasi |
| Guruh | `/ulash` | boshliq | Natijalar va hisobotlar shu guruhga |
| Guruh | `/uzish` | boshliq | Guruhni uzish |

Bot menyusi va "Ilova" tugmasi server ishga tushganda avtomatik sozlanadi (BotFather'da qo'lda shart emas).

## Texnologiyalar
| Qism | Texnologiya | Nega |
|---|---|---|
| Backend | Fastify 5 + TypeScript | Node.js'dagi eng tez frameworklardan biri |
| Ma'lumotlar bazasi | PostgreSQL 16 + Prisma 6 | Ishonchli, tipli so'rovlar, migratsiyalar |
| Real vaqt | Socket.io (har tashkilot — alohida xona) | Statuslar faqat o'z tashkiloti a'zolariga darhol yetadi |
| Bot | Telegraf (`@YangihayotUyushma_bot`), webhook | Ro'yxatdan o'tish, takliflar, xabarlar |
| Frontend | React 19 + Vite 8 + Tailwind v4 | Yengil (~95 KB gzip), tez |
| Telegram | Rasmiy `telegram-web-app.js` | Auth (initData), mavzu ranglari, native tugmalar, tebranish |

## Server
| | |
|---|---|
| Hosting | **Contabo Cloud VPS 4** (4 vCPU, 8 GB RAM, 100 GB SSD), EU, Ubuntu 24.04 — $7.39/oy, oylik (2026-10-16 dan) |
| Domen | **https://yangihayot-mfy.duckdns.org** (DuckDNS) |
| Server IP | **158.220.100.206** |
| Kirish | Faqat SSH kalit: `ssh root@158.220.100.206` (parol bilan kirish o'chirilgan). Favqulodda: Contabo panelidagi VNC + root parol |
| Papkalar | `/opt/mfy-app` (kod + `.env`), zaxiralar: `/opt/mfy-backups` (har kuni 03:00, 14 kun) |

## Arxitektura
```
Telegram ──► https://yangihayot-mfy.duckdns.org
                 │
            Caddy (80/443, avtomatik HTTPS)
                 │
            Ilova konteyneri (4000, tashqariga yopiq)
             ├─ /                  → frontend
             ├─ /api/...           → REST API (har so'rov: initData → foydalanuvchi → tashkilot a'zoligi)
             ├─ /socket.io         → real vaqt (org:<id> xonalari)
             └─ /telegram/webhook  → bot
                 │
            PostgreSQL konteyneri (tashqariga yopiq)
```

## Xavfsizlik
- Har so'rov Telegram imzolagan `initData` bilan; backend bot tokeni bilan tekshiradi (24 soatdan eski — rad).
- **Tashkilot izolyatsiyasi**: tashkilot faqat foydalanuvchining tasdiqlangan a'zoligidan olinadi; barcha so'rovlar `orgId` bilan cheklanadi; real vaqt hodisalari faqat o'z tashkiloti xonasiga. Avtomatik test bilan tekshirilgan (begona tashkilot ma'lumoti, tahriri va hodisalari yetib bormaydi).
- Taklif havolalari: tasodifiy, bir martalik, muddatli, bekor qilinadigan.
- **Dev rejim** faqat `DEV_AUTH=true` bo'lsa. Serverda hech qachon yoqilmaydi.
- Raislarning shaxsiy ma'lumotlari (ism, telefon) **GitHub'ga qo'shilmaydi** (repo ochiq) — faqat serverda.

## Ishga tushirish

### Serverga yangi versiya chiqarish
```bash
ssh root@158.220.100.206 /opt/mfy-app/deploy/deploy.sh            # main
ssh root@158.220.100.206 /opt/mfy-app/deploy/deploy.sh <branch>   # sinov uchun boshqa branch
```
GitHub'dan kodni oladi, image'ni qayta build qiladi, ilovani qayta ishga tushiradi (DB migratsiyalari avtomatik). Katta o'zgarishdan oldin: `./deploy/backup.sh`.

### Server bilan ishlash
```bash
cd /opt/mfy-app
docker compose -f docker-compose.prod.yml ps            # holat
docker compose -f docker-compose.prod.yml logs -f app   # ilova loglari
./deploy/backup.sh                                       # qo'lda zaxira nusxa
```

### Lokal ishlab chiqish
```bash
docker compose up -d                                         # PostgreSQL (5433)
cd backend && npx prisma migrate deploy
cd backend && BOT_MODE=off DEV_AUTH=true npm run dev         # 4000, bot o'chiq (serverdagi botga tegmaydi)
cd frontend && npm run dev                                   # 5173, /api va /socket.io → 4000
```
Brauzerda `http://localhost:5173/?dev=<telegram_id>` — o'sha foydalanuvchi bo'lib kirish. `BOT_MODE=off`da guruh va shaxsiy xabarlar yuborilmaydi — logga yoziladi.

> ⚠️ Lokal backendni **asosiy bot tokeni bilan polling rejimida ishga tushirmang** — serverdagi webhook o'chib, bot javob bermay qoladi. Faqat `BOT_MODE=off` yoki alohida test bot.

### Testlar
```bash
cd backend && npm test                                       # 12 ta: initData imzosi, xabarlar formati
cd backend && npx tsx scripts/smoke-invites.ts               # takliflar/tashkilot mantig'i (FAQAT lokal baza!)
```

## `.env` (backend, lokal)
| O'zgaruvchi | Ma'nosi |
|---|---|
| `BOT_TOKEN`, `BOT_USERNAME` | BotFather'dan |
| `DATABASE_URL` | PostgreSQL (lokal port 5433) |
| `FRONTEND_URL` | Mini App'ning **https** manzili |
| `BOT_MODE` | `off` (lokal), `polling`, `webhook` (server — compose o'zi qo'yadi) |
| `DEV_AUTH` | `true` — faqat lokal |
| `GROUP_CHAT_ID` | Eskirgan — guruh endi har tashkilot uchun `/ulash` bilan bazada saqlanadi |

Serverdagi `.env`: `deploy/.env.example` (`DOMAIN`, `POSTGRES_PASSWORD`, `BOT_TOKEN`, `BOT_USERNAME`).

## Vazifa holatlari (qoidalar)
```
Navbatda ──qo'ng'iroq──► Qo'ng'iroqda ──natija (+izoh)──► Bog'landi | Ko'tarmadi | Telefon o'chiq
Ko'tarmadi / O'chiq ──qayta qo'ng'iroq──► ...            Bog'landi = yakuniy (izohni keyin ham qo'shsa bo'ladi)
Har qanday holat ──"Natijani bekor qilish" (faqat boshliq)──► Navbatda
```
- Topshiriqda har bir MFY vazifasi o'sha MFY'ning **mas'ul xodimiga** beriladi.
- Xodim o'z MFY'lari bilan ishlaydi; boshqanikiga faqat **"Yordam berish"** (tasdiqlash bilan) — natijada "Ramazon (Diyorbek o'rniga)" yoziladi.
- Mas'ul o'zgarsa, joriy topshiriqdagi bog'lanilmagan vazifa ham yangi xodimga o'tadi.
- Tashkilotda bir vaqtda **bitta faol topshiriq**. Har bir o'zgarish `CallEvent` jadvaliga yoziladi (kim, qachon, qaysi holat, izoh).
- Yig'ilish va tadbirda **sana-vaqt majburiy**; "Boshqa"da ixtiyoriy.

## Ochiq masalalar / keyingi qadamlar
- [x] Yangi versiya serverda (2026-10-16): migratsiya, 30 MFY rasmiy ro'yxat bo'yicha, guruh ulangan. Branch `feature/assigned-mfy-redesign` — Telegramda sinalgach `main`ga birlashtiriladi.
- [ ] Ulug'bek'ka **boshliq taklif havolasi**ni yuborish.
- [ ] Ramazon va Diyorbek'ka xodim havolalari (ilovada → Xodimlar → a'zo → "Telegram orqali yuborish").
- [ ] Botni guruhga qo'shib, boshliq `/ulash` yozadi.
- [ ] Telegram'da to'liq sinash (boshliq, xodim, yordam, izoh, guruh xabarlari).
- [ ] Contabo obunasi oylik ($7.39) — keyingi to'lov 2026-11-15.
- [ ] Keyinroq: Excel hisobot eksporti; platforma egasi uchun to'lov/obuna boshqaruvi; o'z domen.

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


### 2026-10-16 — MFY'larni xodimlarga biriktirish va UI'ni to'liq qayta loyihalash
Branch: `feature/assigned-mfy-redesign`

**Talablar (foydalanuvchidan)**
- 30 MFY 3 xodimga 10 tadan **doimiy** taqsimlangan; hammasi dinamik bo'lsin. → Boshliq qayta biriktira oladi.
- Guruhga: har bir natija + yakuniy hisobot (boshqa xabarlar yo'q).
- UI: sahifalar orasida surib o'tish; emoji/stikerlar yo'q; o'chirish tugmalari doim ko'rinib turmasin; senior darajada, "shablon"ga o'xshamasin.

**Backend**
- `Mahalla.assignedToId` (doimiy mas'ul xodim) va `Setting` jadvali — migratsiya `mahalla_assignee_and_settings`.
- Topshiriq yaratilganda vazifalar mas'ul xodimlarga avtomatik beriladi. "Kim birinchi bossa" mantiqi olib tashlandi.
- Xodim faqat o'z MFY'si bilan ishlaydi; boshliq — hammasi bilan. Barcha o'tishlar atomik.
- Mas'ulni o'zgartirish faol topshiriqdagi bog'lanilmagan vazifalarga ham ta'sir qiladi; barcha ochiq ilovalar avtomatik yangilanadi.
- Xodimning barcha MFY'larini boshqa xodimga o'tkazish; MFY'si bor xodimni o'chirish taqiqlangan.
- Excel import: 4-ustun — mas'ul xodim ismi (bor MFY'larning mas'ulini ham yangilaydi).
- Guruh: `/ulash` buyrug'i (faqat boshliq), guruh ID bazada; guruh supergroup'ga aylansa yangi ID avtomatik saqlanadi. Bot guruhga qo'shilganda yo'riqnoma yozadi.
- Guruh xabarlari HTML formatda, emojisiz: natija (holat, MFY, rais, xodim, Toshkent vaqti, jami) va xodimlar bo'yicha guruhlangan yakuniy hisobot.
- Bot menyusi (`/start` shaxsiy chatda, `/ulash` guruh adminlarida) va "Ilova" tugmasi avtomatik sozlanadi — BotFather'da qo'lda qilish shart emas.
- `BOT_MODE=off` — lokal ishlab chiqishda bot va guruh xabarlari butunlay o'chiq.

**Frontend (to'liq qayta yozildi)**
- Telegram/iOS uslubidagi guruhlangan ro'yxatlar, Telegram mavzu ranglari (kunduzgi/tungi), emoji yo'q — holatlar rang + matn bilan.
- Sahifalar barmoq bilan chapga/o'ngga suriladi: boshliq — Topshiriq / Raislar / Xodimlar; xodim — Mening MFY'larim / Jamoa.
- Har qanday element bosilganda pastdan oyna ochiladi; o'chirish va boshqa xavfli amallar faqat shu oyna ichida, eng pastda, tasdiqlash bilan.
- Telegram'ning native pastki tugmasi (MainButton) va "Orqaga" tugmasi; ro'yxatni aylantirganda ilova yopilib ketmaydi.
- Qo'ng'iroq oynasi: katta qo'ng'iroq tugmasi (+998 bilan; bir nechta raqam bo'lsa — har biriga alohida), uchta natija tugmasi.
- Raislar: qidiruv, xodimlar bo'yicha guruhlash, mas'ulni tanlash. Xodimlar: avatar, MFY soni, taklif havolasini Telegram orqali yuborish.

**Tekshiruv**
- Backend: 8/8 test (initData + guruh xabarlari formati), `tsc` xatosiz.
- Lokal API'da jarayon sinaldi: o'z MFY'si 200, begona MFY 403, bog'langanni qayta o'zgartirish 409, xodim reset 403, xodim `/api/users` 403, ikkinchi faol topshiriq 409, MFY'si bor xodimni o'chirish 400, o'tkazish → 9 MFY + faol vazifalar ko'chdi, yakuniy hisobot to'g'ri.
- UI headless Chrome'da telefon o'lchamida (390×844) 12 ta skrinshot bilan tekshirildi, kunduzgi va tungi mavzu. Topilib tuzatilgan: CSS qatlami ranglarni bosib ketgani, "navbatda"/"o'chiq" bir xil ko'ringani, telefon raqamidagi ortiqcha vergul va +998 yo'qligi.
- ⚠️ Hali serverga chiqarilmagan — MFY ↔ xodim ro'yxati kelgach birga deploy qilinadi.

### 2026-10-16 — Universal (ko'p tashkilotli) platforma, rasmiy MFY ro'yxati, yordam va izohlar
Branch: `feature/assigned-mfy-redesign`

**Talablar (foydalanuvchidan)**
- Botni boshqa tumanlarga ham sotish mumkin bo'lsin — boshliq/xodim kimligi qat'iy kodda emas, universal bo'lsin.
- Boshliq uchun sodda: nima (yig'ilish/tadbir/sabab), qachon (sana-vaqt muhim), qayerda. Xodimlar shuni ko'radi.
- Xodim o'z 10 ta MFY'si bilan ishlaydi, qolganlarnikini ko'radi; yordam bersa — boshliq bilsin. Istisno holatlarda izoh yozilsin.
- Rasmiy ro'yxat: 30 MFY, 3 xodimga 10 tadan (Raxmonberdiyev Ramazon, Saydirasulov Jamoliddin, Tobilov Diyorbek). Boshliq — Ulug'bek (taklif orqali qo'shiladi). Eski test topshirig'i — o'chirilsin.

**Arxitektura qarorlari**
- `Organization` (holati: kutilmoqda/faol/to'xtatilgan/rad etilgan, vaqt mintaqasi, guruh), `Membership` (rol tashkilot ichida), `Invite` (rol havolada, bir martalik, 14 kun, bekor qilinadigan, o'rinbosarga bog'lanishi mumkin).
- Platforma egasi (`isPlatformOwner`) — yangi tashkilot so'rovlarini botda tasdiqlaydi. Yangi o'rnatishda birinchi so'rovchi avtomatik egasi bo'ladi.
- Har bir API so'rovi va socket ulanishi tashkilot a'zoligi bilan cheklanadi (`x-org-id` faqat tanlov uchun, server tekshiradi).

**Ma'lumotlar**
- Migratsiya `multi_tenant_organizations` qo'lda yozildi: avval yangi jadvallar → mavjud ma'lumotni birinchi tashkilotga ko'chirish → eski ustunlarni o'chirish. Serverdagi bazaning aniq nusxasida va bo'sh bazada sinaldi; natija Prisma sxemasi bilan to'liq mos.
- Eski test topshirig'i serverdan o'chirildi (oldin zaxira olindi).
- 30 MFY rasmiy ro'yxatga keltirildi (28 tasi telefon raqami bo'yicha moslashtirildi; Xumo raisi/telefoni yangilandi; Oriyat qo'shildi; sektorlar 1–4; tartib 1–30); har biri o'z xodimiga biriktirildi. Ro'yxat GitHub'ga qo'shilmadi (shaxsiy ma'lumot).

**Yangi imkoniyatlar**
- Bot: "Tashkilot ochish" → platforma egasi tasdiqlaydi; taklif havolalari; `/tashkilotlar`, `/ulash`, `/uzish`; guruh supergroup'ga aylansa yoki bot chiqarilsa — avtomatik hisobga olinadi.
- Topshiriq: turi, nomi, sana-vaqt, joy, izoh; xodimlarga botdan shaxsiy xabar; topshiriqlar tarixi.
- Xodim: "Jamoa" sahifasida hammaning MFY'lari; "Yordam berish"; natijaga izoh, keyin ham izoh qo'shish.
- Boshliq: a'zolar (oldindan qo'shish, taklif havolasi, ism tahriri, rol o'zgartirish, MFY'larni o'tkazish), boshliq taklifi; MFY'lar sektor va tartib raqami bilan.
- Profil: ismni o'zgartirish, tashkilot almashtirish.
- Guruh xabarlari tashkilot vaqt mintaqasida: natija ("Ramazon (Diyorbek o'rniga)", izoh), yakuniy hisobot (xodimlar bo'yicha, izohlar, yordam berganlar).

**Tekshiruv**
- Backend unit testlari: 12/12.
- Takliflar/tashkilotlar sinovi (`scripts/smoke-invites.ts`): boshliq taklifi, bir martalik havola, o'rinbosarni egallash, tashkilot so'rovi/tasdiqlash, ikki tashkilot a'zosi uchun akkaunt birlashtirish, muddati o'tgan/bekor qilingan havola, to'xtatilgan tashkilot — hammasi o'tdi.
- API + real vaqt sinovi (28 tekshiruv): tashkilotlar izolyatsiyasi (ma'lumot, tahrir, socket hodisalari), yordam, izoh, ruxsatlar, himoyalar — hammasi o'tdi.
- UI: telefon o'lchamida 13 skrinshot (kunduzgi/tungi). Topilib tuzatilgan: uzun holat nomi rais ismini qisqartirgani, tungi rejimda tanlov ko'rinmagani, "Qo'ng'iroq qildi" yorlig'i, xodim xabaridagi takror so'z.
