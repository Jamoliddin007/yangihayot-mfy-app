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

## Arxitektura (oddiy tilda)
```
Telegram ilova ──► https://<domen yoki ngrok>  ──►  Backend (port 4000)
                                                    ├─ /           → tayyor frontend (frontend/dist)
                                                    ├─ /api/...    → REST API
                                                    ├─ /socket.io  → real vaqt yangilanishlari
                                                    └─ Telegram bot (polling)
                                                         │
                                                    PostgreSQL (Docker, 5433)
```
Production'da **bitta port, bitta server**: backend frontend'ni ham o'zi beradi.

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

### Production / Telegram'da sinash (tavsiya etiladi — tez)
```bash
cd frontend && npm run build               # frontend/dist yaratiladi
cd ../backend && npm run dev               # yoki: npm run build && npm start
ngrok http 4000                            # FRONTEND_URL ni shu https manzilga qo'ying
```

### Lokal ishlab chiqish (kod o'zgarishini darhol ko'rish)
```bash
cd backend && DEV_AUTH=true npm run dev    # 4000-port
cd frontend && npm run dev                 # 5173-port, /api va /socket.io avtomatik 4000 ga proxy
```
Brauzerda `http://localhost:5173` → Telegram ID kiritib kirish (faqat `DEV_AUTH=true` bo'lsa).

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
- [ ] **Doimiy server (VPS)** — hozir ngrok vaqtinchalik. VPS'da: HTTPS domen, `NODE_ENV=production`, process manager (pm2/systemd), bot **webhook** rejimi.
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

**Holat**: commit `eeaaabe` → `feature/hardening-and-perf` branch'ga push qilindi. PR `feature/dev-single-origin-proxy` (PR #1) ustiga ochiladi — PR #1 birlashtirilgach GitHub uni avtomatik `main` ga o'tkazadi.
