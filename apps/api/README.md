# apps/api

Node.js 20 + Express 5 + TypeScript + Zod. Barcha biznes-mantiq shu yerda.

Spetsifikatsiya: [`docs/03-api-spec.md`](../../docs/03-api-spec.md) · [`docs/01-arxitektura.md`](../../docs/01-arxitektura.md)

---

## Ishga tushirish

```bash
cd infra && docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis
cd ../apps/api

cat > .env <<'EOF'
DATABASE_URL=postgres://looksave:looksave@localhost:5432/looksave
REDIS_URL=redis://localhost:6379
PORT=3000
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:5173
EOF

npm run dev
curl http://localhost:3000/health
```

| Buyruq              | Nima qiladi                             |
| ------------------- | --------------------------------------- |
| `npm run dev`       | tsx watch — o'zgarishda qayta yuklanadi |
| `npm run build`     | tsup → `dist/index.js` (bitta bundle)   |
| `npm start`         | `node dist/index.js`                    |
| `npm test`          | vitest                                  |
| `npm run typecheck` | `tsc --noEmit`                          |

---

## Tuzilma

```
src/
├── index.ts            server + graceful shutdown
├── app.ts              Express app fabrikasi
├── logger.ts           pino (PII maydonlari redact qilinadi)
├── config/env.ts       muhit o'zgaruvchilari — Zod bilan tekshiriladi
├── auth/
│   ├── password.ts     scrypt (node:crypto — tashqi bog'liqliksiz)
│   ├── tokens.ts       JWT (jose) + refresh rotatsiyasi (Redis)
│   └── users.ts        foydalanuvchi DB so'rovlari
├── profile/
│   ├── morphs.ts       o'lcham → blendshape hisobi
│   └── profile.ts      profil, avatar konfiguratsiyasi, raqamlar
├── tryon/
│   └── tryon.ts        svayp ro'yxati, sevimlilar, komplektlar
├── jobs/
│   └── scheduler.ts    avtomatik jarayonlar (Redis qulfi bilan)
├── admin/
│   └── admin.ts        moderatsiya, 3D navbat, global bloklar
├── store/
│   ├── store.ts        do'kon paneli: kirish, dashboard, status o'tishlari
│   └── products.ts     mahsulot CRUD, ombor, 3D so'rovi
├── integrations/
│   ├── push.ts         Expo Push — mijozga buyurtma xabari
│   ├── telegram.ts     Bot API mijozi
│   ├── notify.ts       buyurtma xabarlari (Telegram + SSE)
│   └── events.ts       SSE — Redis pub/sub
├── orders/
│   ├── cart.ts         savat (do'konlar bo'yicha bo'linadi)
│   └── orders.ts       buyurtma yaratish — tranzaksiya, FOR UPDATE
├── catalog/
│   ├── cursor.ts       keyset pagination (OFFSET yo'q)
│   ├── hours.ts        isOpen / closesAt — do'kon vaqt zonasida
│   ├── locale.ts       Accept-Language → nom tanlash
│   ├── stores.ts       PostGIS so'rovlari
│   └── products.ts     filtr, qidiruv, saralash
├── db/pool.ts          PostgreSQL pool
├── db/redis.ts         Redis
├── http/
│   ├── api-error.ts    ApiError — HTTP status kod jadvalidan
│   ├── respond.ts      sendData / sendList — { data, meta }
│   ├── request-id.ts   har so'rovga requestId
│   ├── validate.ts     Zod → VALIDATION_ERROR fields[]
│   ├── auth-middleware.ts  requireAuth / optionalAuth / requireRole
│   ├── rate-limit.ts   Redis fixed-window, X-RateLimit-* sarlavhalari
│   ├── idempotency.ts  Idempotency-Key (POST /orders)
│   └── error-handler.ts
└── routes/
    ├── health.ts       GET /health
    ├── auth.ts         register / login / refresh / logout / change-password
    ├── profile.ts      GET /v1/profile
    ├── cart.ts         savat
    ├── orders.ts       buyurtma oqimi
    ├── tryon.ts        Try-On, sevimlilar, komplektlar
    ├── admin.ts        admin panel
    ├── store.ts        do'kon paneli
    ├── telegram.ts     webhook
    ├── stores.ts       nearby / map / :id
    ├── products.ts     products / :id / variants/:id/asset3d
    └── v1.ts           GET /v1/categories, /v1/brands
```

---

## Qoidalar

**Javob `res.json()` bilan yuborilmaydi.** Faqat `sendData` / `sendList` orqali — shunda `{ data, meta }` qobig'i hech qayerda unutilmaydi.

**HTTP status qo'lda yozilmaydi.** `new ApiError('OUT_OF_STOCK', '...')` — status `ERROR_CODES` jadvalidan olinadi (`packages/shared-types/src/errors.ts`). Shunda bir xil kod turli joyda turli status bermaydi.

**`try/catch` shart emas.** Express 5 async handler'lardagi xatolarni o'zi `errorHandler` ga uzatadi.

**Pul `number` ga aylantirilmaydi.** `pg` NUMERIC ni string qaytaradi va shunday qolishi kerak — `db/pool.ts` da hech qanday `setTypeParser` yo'q, atayin.

**Validatsiya sxemalari `packages/validation` da.** Mobil ilova bilan bir xil qoidalar.

---

## `/health` — istisno

`GET /health` `{ data, meta }` qobig'idan **tashqarida**:

```json
{ "status": "ok", "checks": { "db": true, "redis": true }, "uptime": 128.4, "version": "a3f8c21" }
```

Bu format Docker healthcheck va UptimeRobot uchun [`docs/08-deployment.md` §10](../../docs/08-deployment.md) da kelishilgan. `db` yoki `redis` javob bermasa — `503`, Docker konteynerni `unhealthy` deb belgilaydi va deploy to'xtaydi.

---

## Auth — Faza 1 (parol, OTP'siz)

⚠️ **Bu 00-README K-15 dan chekinish.** Hujjatda telefon OTP bilan bog'lanishi
soxta buyurtmaga qarshi asosiy himoya deb belgilangan. Mijoz qaroriga ko'ra
Faza 1 da OTP yo'q — telefon + ism + parol.

| Endpoint                        | Cheklov                              |
| ------------------------------- | ------------------------------------ |
| `POST /v1/auth/register`        | 5 / soat (IP)                        |
| `POST /v1/auth/login`           | 10 / 15 daq (IP), 5 / 15 daq (raqam) |
| `POST /v1/auth/refresh`         | 30 / daq                             |
| `POST /v1/auth/logout`          | —                                    |
| `POST /v1/auth/logout-all`      | token kerak                          |
| `POST /v1/auth/change-password` | 5 / soat, token kerak                |
| `GET /v1/profile`               | token kerak                          |

**Parol** — `node:crypto` scrypt (N=2^16, r=8, p=1). Format:
`scrypt$N$r$p$salt$hash` — keyinchalik boshqa algoritmga o'tish oson.

**Refresh rotatsiyasi** — har `refresh` da eski token darhol bekor bo'ladi.
Bekor qilingan token qayta ishlatilsa, o'sha foydalanuvchining **barcha
sessiyalari** yopiladi (o'g'irlangan token belgisi).

**Ro'yxatdan o'tganda** raqam `verified_phones` ga `verified_via =
'password_signup'` bilan yoziladi — ya'ni OTP'dan **o'tmagan**. OTP
qo'shilganda shu belgi bo'yicha qayta tasdiqlatish mumkin.

---

## Geo va katalog

| Endpoint                       | Izoh                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `GET /v1/stores/nearby`        | `lat`, `lng` majburiy · `radius` maks 50 km · `category`, `only3d`, `openNow` |
| `GET /v1/stores/map`           | zoom ≥ 12 → marker (maks 300), < 12 → klaster                                 |
| `GET /v1/stores/:id`           | profil + kategoriyalar sanog'i                                                |
| `GET /v1/stores/:id/products`  | `/products` bilan bir xil filtrlar                                            |
| `GET /v1/products`             | `sort`: newest · popular · priceAsc · priceDesc · nearest                     |
| `GET /v1/products/:id`         | variantlar, o'lchamlar, 3D asset, `isFavorite`                                |
| `GET /v1/variants/:id/asset3d` | Try-On uchun bitta model                                                      |

**`isOpen` serverda hisoblanadi.** Toshkent UTC+5, Dubay UTC+4, foydalanuvchi
uchinchi zonada bo'lishi mumkin. Yarim tundan o'tuvchi jadval (`14:00–02:00`)
ham to'g'ri ishlaydi — `catalog/hours.ts`.

**Pagination — keyset, `OFFSET` emas.** Cursor kaliti SQL'da
`to_char(..., 'US')` bilan yasaladi: `TIMESTAMPTZ` mikrosekund aniqligida,
JS `Date` esa millisekund. `toISOString()` dan yasalgan cursor
mikrosekundlarni yo'qotadi va **keyingi sahifa jim bo'sh qaytadi**.

**Qidiruv** — to'liq matn (`tsvector`) + trigram `<%` (word_similarity).
`%` (similarity) ishlatilmaydi: u butun sarlavhani solishtiradi va uzun
sarlavha qisqa so'rovga mos kelmaydi. Trigram **xato yozilishni** tuzatadi
(`nikee` → Nike), **transliteratsiyani emas** (`nayk` → topilmaydi).
Buning uchun sinonim lug'ati kerak.

---

## Savat va buyurtmalar

| Endpoint                                                                        | Izoh                                 |
| ------------------------------------------------------------------------------- | ------------------------------------ |
| `GET /v1/cart`                                                                  | do'konlar bo'yicha bo'lingan         |
| `POST /v1/cart/items` · `PATCH`/`DELETE /v1/cart/items/:id` · `DELETE /v1/cart` |                                      |
| `POST /v1/orders` ⭐                                                            | `Idempotency-Key` **majburiy**       |
| `GET /v1/orders?status=active`                                                  | active · completed · cancelled · all |
| `GET /v1/orders/:id` · `/events`                                                | `items` — `snapshot` dan             |
| `POST /v1/orders/:id/cancel`                                                    | faqat new/seen/confirmed             |

**Savat do'konlar bo'yicha bo'linadi.** Har do'kon — alohida buyurtma: biri
tasdiqlab, biri rad etsa bitta buyurtma ichida holat chalkashib ketardi.

**Tekshiruvlar tartibi** (03-api-spec §12) — tartib muhim, qora ro'yxatdagi
odam ombor holatidan xabar topmasligi kerak:

1. Token → `401` · 2. Format → `422` · 3. Raqam tasdiqlangan → `403 PHONE_NOT_VERIFIED`
2. Qora ro'yxat → `403 BLOCKED` · 5. Cheklov → `403 RESTRICTED`
3. Limitlar → `429 LIMIT_REACHED` · 7. Yetkazish radiusi → `422 OUT_OF_RANGE`
4. Ombor → `409 OUT_OF_STOCK`

**`SELECT ... FOR UPDATE`** — parallel buyurtmalardan himoya. Oxirgi bitta
tovar uchun 3 ta bir vaqtdagi so'rovdan aynan bittasi o'tadi.

**Rezerv qaytarish** — `010_orders_flow.sql` dagi trigger. Buyurtma faol
holatdan chiqqanda `reserved` kamayadi; `completed` bo'lsa `stock` ham.

**`json_build_object` ichida `NUMERIC` ni `::text` qilish SHART** — aks holda
u JSON soniga aylanadi va pul aniqligi yo'qoladi.

---

## Do'kon paneli va Telegram

| Endpoint                                                                       | Izoh                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------- |
| `GET /v1/store/dashboard`                                                      | sanoqlar, oylik daromad, top mahsulotlar |
| `GET /v1/store/orders?status=new`                                              | `minutesLeft`, `customerTrust`           |
| `POST /v1/store/orders/:id/{seen,confirm,reject,ready,complete,report-noshow}` |                                          |
| `GET·POST·DELETE /v1/store/blocklist`                                          | global blokni do'kon o'chira olmaydi     |
| `GET /v1/store/telegram/link`                                                  | `LS-XXXXXX` kod + bot havolasi           |
| `GET /v1/store/events/stream`                                                  | SSE                                      |
| `POST /v1/telegram/webhook`                                                    | bot tugmalari                            |

**Do'kon id JWT dan tekshiriladi.** Bitta do'koni bo'lsa avtomatik, bir nechta
bo'lsa `X-Store-Id` sarlavhasi kerak. So'rovdagi id JWT dagi `storeIds` bilan
solishtiriladi — so'rovga ishonilmaydi.

**Status o'zgartirish — yagona yo'l** (`store/store.ts` → `transitionOrder`).
Panel ham, Telegram ham shu funksiyani chaqiradi, aks holda qoidalar
ikki joyda ajralib ketardi.

**Telegram nosozligi buyurtmani to'xtatmaydi.** `sendMessage` uch xil natija
qaytaradi: `ok` · `skipped` (bot sozlanmagan) · `failed`. Ulanish faqat
`fatal` xatoda (403 blok, 400 chat yo'q) uziladi — tarmoq uzilishida emas.

**Mijozga push** — status o'zgarganda `notifyCustomer` chaqiriladi.
Matn foydalanuvchi tilida (`users.locale`), `DeviceNotRegistered`
qaytgan tokenlar avtomatik tozalanadi. `EXPO_ACCESS_TOKEN` bo'sh bo'lsa
push jim o'chiriladi.

**`POST /v1/devices`** — ilova har ochilganda qurilmani va push tokenini
yozadi. Token berilmasa eskisi saqlanadi (`COALESCE`), chunki kirish
paytida token hali olinmagan bo'lishi mumkin. Bitta token bitta
foydalanuvchida bo'ladi: akkaunt almashtirilsa eski egadan olib
tashlanadi — aks holda yangi egasining buyurtmasi haqida eski egaga
xabar borardi.

**Takroriy callback** — `callback_query.id` Redis'da 60 s saqlanadi.
Telegram javob kechiksa bir xil tugmani ikki marta yuborishi mumkin.

**Do'kon mahsulotni `active` qila olmaydi** — faqat `draft` yoki `pending`.
Nashr admin moderatsiyasi orqali. Nashrga yuborishda kamida 3 rasm kerak.

**Rasm faqat `presign` orqali.** URL bizning CDN'dan bo'lmasa rad etiladi —
aks holda do'kon tashqi saytdagi rasmni ulab qo'yadi va u sayt o'chsa
katalogda bo'sh joy qoladi.

**Ombor rezervdan kam qilib bo'lmaydi.** Buyurtma qilingan tovarni
"yo'q" qilib qo'yish mumkin emas — `INVALID_STATE`.

**O'chirish = arxivlash.** Qator o'chirilmaydi: unga eski buyurtmalar
bog'langan (`order_items.variant_id`).

**Presign javobidagi `headers` ni PUT so'rovida yuborish SHART.**
Imzolangan URL'da `SignedHeaders=host` — `Content-Type` va `Cache-Control`
imzoga kirmaydi. Yuborilmasa R2 obyektni kesh sarlavhasisiz saqlaydi va
CDN keshi ishlamaydi (rasm har safar R2 dan qayta yuklanadi).

**SSE uchun Caddy'da `flush_interval -1` shart** — aks holda hodisalar
buferlanadi va panel yangi buyurtmani ko'rmaydi.

---

## Admin

| Endpoint                                                                      | Izoh                                          |
| ----------------------------------------------------------------------------- | --------------------------------------------- |
| `GET /v1/admin/overview`                                                      | bosh sahifa sanoqlari + "diqqat talab qiladi" |
| `GET /v1/admin/stores?status=pending`                                         | egasi, manzil, koordinata, sanoqlar           |
| `POST /v1/admin/stores/:id/{approve,reject,suspend}`                          | `reject`/`suspend` uchun sabab majburiy       |
| `GET /v1/admin/products/moderation`                                           | rasmlar, variantlar, ombor                    |
| `POST /v1/admin/products/:id/{approve,reject}`                                |                                               |
| `GET /v1/admin/3d-queue?status=queued`                                        | manba fotolar bilan                           |
| `PATCH /v1/admin/3d-queue/:id`                                                | nashr — GLB va QA majburiy                    |
| `GET·DELETE /v1/admin/blocklist`                                              | global bloklar, sabablari bilan               |
| `GET /v1/admin/users?restricted=true` · `POST /v1/admin/users/:id/unrestrict` |                                               |

**3D nashr qilish uchun uch shart:** `glbUrl`, to'liq `qaResult` va
`checklistPassed: true`. Bittasi yetishmasa `422`. Bu intizom uchun —
bitta sifatsiz model butun ilova tajribasini buzadi (07-web-panels §5.3).
`products.has_3d` triggerda avtomatik yoqiladi.

**Global blokni admin bekor qila oladi.** U baza triggeri bilan avtomatik
qo'yiladi (uch do'kon bloklaganda), lekin uchala do'kon ham xato qilishi
mumkin. Javobda har bir do'konning sababi ko'rsatiladi.

**`GET /admin/overview` — hujjatda yo'q.** §15 da `GET /admin/analytics`
bor, lekin bosh sahifa (§5.1) uchun alohida yig'ma so'rov kerak edi.

---

## Testlar

Ikki xil:

**Birlik testlari** (`src/**/*.test.ts`) — sxemalar, formulalar, sof
funksiyalar. Bazasiz ishlaydi, tez.

**Integratsion testlar** (`tests/**/*.integration.test.ts`) — haqiqiy
PostgreSQL + PostGIS + Redis bilan. Xatolar odatda SQL'da,
tranzaksiyalarda va triggerlarda chiqadi — ularni sxema testlari
ko'rmaydi.

```bash
cd infra && docker compose -f docker-compose.dev.yml up -d
npm run test:integration --workspace=apps/api
```

Baza (`looksave_it`) har ishga tushirishda **noldan quriladi** va
migratsiyalar shu yerda ham tekshiriladi — ular buzilgan bo'lsa testlar
boshlanmaydi. Ishchi bazangizga tegilmaydi.

Qamrov:

| Nima                                              | Nechta |
| ------------------------------------------------- | ------ |
| Buyurtma oqimi: savat → buyurtma → rezerv → bekor | 12     |
| Auth, do'kon paneli, katalog                      | 14     |

Alohida ta'kidga arziydi:

**Oxirgi dona uchun uchta parallel so'rov** yuboriladi va aynan bittasi
o'tishi tekshiriladi. `SELECT ... FOR UPDATE` bo'lmasa uchalasi ham o'tib
ketardi — bunday xatoni qo'lda sinab topib bo'lmaydi.

**Telegram webhook bot tokenisiz sinaladi.** Sir tekshiruvi, callback
mantig'i, begona chatdan kelgan tugma va status o'zgarishi — hammasi
haqiqiy Telegram serversiz. `sendMessage` token bo'lmagani uchun jim
o'tkaziladi (`skipped`), qolgan mantiq to'liq ishlaydi.

**Cron vazifalari to'g'ridan-to'g'ri chaqiriladi.** Ular productionda
nazoratsiz ishlaydi: muddat o'tishi rezervni qaytaradimi, eslatma ikki
marta ketmaydimi, javob tezligi to'g'ri hisoblanadimi — shular
tekshiriladi.

---

## Profil va avatar

| Endpoint                                   | Izoh                                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| `GET /v1/profile`                          | o'lchamlar, `morphTargets`, `faceScanStatus`, `trust` |
| `PATCH /v1/profile`                        | ism, jins, til                                        |
| `PATCH /v1/profile/measurements`           | qisman yuboriladi, eskisi ustiga qo'shiladi           |
| `GET /v1/avatar/config`                    | Try-On ekrani ochilganda birinchi chaqiriladi         |
| `GET /v1/phones` · `DELETE /v1/phones/:id` | asosiy raqamni o'chirib bo'lmaydi                     |

**`morphTargets` serverda hisoblanadi** (03-api-spec §6) — model
o'zgarganda ilovani yangilash shart emas, faqat `profile/morphs.ts`
tuzatiladi.

⚠️ **Formula hujjatda yo'q.** Uni 04-3d-pipeline §3 dagi diapazonga
(`0.0 → 1.0`, `0.5` neytral) va §6 dagi misol qiymatlarga qarab tuzdim.
3D modelning haqiqiy shape key'lari bilan solishtirilishi kerak:
`mt_height = 1.0` da avatar necha santimetr bo'ladi — shuni o'lchab
chegaralar tuzatiladi. Hozircha bu **taxmin**.

Mantiq: bo'y 150–200 sm oralig'ida chiziqli; vazn BMI orqali (kilogramm
bo'y bilan bog'liq, aks holda ikki marta hisoblanardi); ko'krak, bel,
son — bo'yga nisbat sifatida, jinsga qarab boshqa tipik nisbat bilan;
yelka alohida o'lchanmaydi, ko'krak va hajmdan chiqadi.

**Bo'y kiritilmasa neytral avatar** — aylana o'lchamlarini bo'ysiz
talqin qilib bo'lmaydi.

**Model havolalari muhit o'zgaruvchisidan** (`AVATAR_SKELETON_VERSION`):
skelet yangilanganda ilovani qayta chiqarish shart emas.

**Try-On → buyurtma nisbati** — do'kon uchun eng qimmatli raqam
(07-web-panels §4.6). Mahsulot ko'p kiyib ko'rilib kam sotib olinsa,
sabab uchtadan biri: narx yuqori, o'lcham yo'q yoki 3D model sifatsiz.
Mahsulot darajasida ham hisoblanadi — qaysi model ishlamayotgani
ko'rinadi.

**Ish vaqti va joylashuv boshqalardan muhimroq.** `isOpen` ish vaqtidan
hisoblanadi va katalogda ko'rinadi — noto'g'ri bo'lsa mijoz yopiq
do'konga buyurtma beradi. Yetkazish radiusi joylashuvdan o'lchanadi —
xato pin qo'yilsa yaqin mijozlar ham `OUT_OF_RANGE` oladi. Ikkalasi ham
integratsion testda tekshiriladi.

**Yetkazish va olib ketishning ikkalasini ham o'chirib bo'lmaydi** —
aks holda do'konga buyurtma umuman berib bo'lmaydi.

**Xodim avval ilovada ro'yxatdan o'tadi**, keyin do'kon egasi uni
telefon raqami bo'yicha qo'shadi. Egasi xodim uchun akkaunt yaratsa,
parolni ham u bilardi — parol va raqam foydalanuvchining o'zida
qolishi kerak.

Qo'shilganda `users.role` `store_owner` ga ko'tariladi (aks holda
middleware to'xtatadi), chiqarilganda boshqa do'koni qolmagan bo'lsa
`customer` ga qaytariladi.

---

## Try-On

| Endpoint                           | Izoh                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| `GET /v1/tryon/slots`              | har slotda nechta tayyor model, nomi tilga qarab         |
| `GET /v1/tryon/slot/:slot` ⭐      | svayp ro'yxati — 50 tagacha, GLB va LOD havolalari bilan |
| `POST /v1/tryon/event`             | analitika, mehmon ham yubora oladi                       |
| `GET·PUT·DELETE /v1/favorites/:id` | sevimlilar                                               |
| `GET·POST·DELETE /v1/looks`        | komplektlar                                              |

**Svayp paytida tarmoqqa chiqilmaydi.** Ilova bitta so'rovda 50 tagacha
modelni oladi va xotirada saqlaydi (03-api-spec §10). Har svaypda API
chaqirilsa tajriba buziladi — shuning uchun bu so'rov bir marta ishlaydi,
lekin to'liq bo'ladi: GLB, LOD, `hideBodyParts`, `hasMorphs`, fayl hajmi.

**Saralash — ommaboplik bo'yicha** (`products.tryon_count`). Foydalanuvchi
birinchi svayplarda eng yaxshi modellarni ko'rishi kerak.

**`tryon_count` darhol yangilanadi** — u svayp ro'yxatining saralash
kaliti, kechiktirib bo'lmaydi.

**Bir slotda bitta mahsulot** — sxemada ham, bazada ham
(`UNIQUE (look_id, slot)`).

---

## Avtomatik jarayonlar

`jobs/scheduler.ts` — server ichida, tashqi cron emas. Sabab: muddati
o'tgan buyurtma uchun mijozga push va Telegramdagi xabarni yangilash
kerak, buni `psql` dan qilib bo'lmaydi.

| Vazifa                                             | Qachon                                   |
| -------------------------------------------------- | ---------------------------------------- |
| Muddati o'tgan buyurtmalarni yopish                | har 5 daqiqada                           |
| Javobsiz buyurtma haqida eslatma (15 daq)          | har 5 daqiqada, bir buyurtmaga bir marta |
| Do'kon javob tezligi va tasdiqlash foizi           | kuniga, 04:00 UTC (Toshkentda 09:00)     |
| Eskirgan OTP va idempotentlik kalitlarini tozalash | kuniga                                   |
| Oylik komissiya hisoboti                           | oyning 1-sanasi, 05:00 UTC               |

**Har vazifa Redis qulfi ostida.** API bir nechta nusxada ishlasa,
ikkalasi bir vaqtda ishlab mijozga ikkita push yuborardi. Qulf
ochilmaydi — TTL bilan o'zi tugaydi.

**Redis yo'q bo'lsa vazifa o'tkazib yuboriladi.** Ikki marta
bajarilishidan ko'ra bir marta o'tkazib yuborish xavfsizroq.

`infra/migrations/010` dagi `expire_stale_orders()` funksiyasi qoladi —
qo'lda tekshirish va zaxira yo'l uchun. U bildirishnoma yubormaydi.

---

## Hali yo'q (keyingi bosqichlar)

- OTP (K-15 ni tiklash)
- Qidiruvda transliteratsiya (sinonim lug'ati)
- SSE (do'kon paneli uchun real vaqt buyurtmalar)
