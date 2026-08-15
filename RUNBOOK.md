# Birinchi ishga tushirish

Bu hujjat loyihani **birinchi marta** haqiqiy muhitda ishga tushirish uchun.
Kutilayotgan xatolar va ularning yechimi oldindan yozilgan — ular taxmin emas,
kod yozilayotganda aniqlangan xavfli joylar.

Tartib muhim: har bosqich oldingisiga tayanadi.

---

## 0. Lokal — 10 daqiqa

Eng arzon tekshiruv. VPS ham, telefon ham kerak emas.

```bash
git clone https://github.com/umidjon-devvloper/LookSave.git && cd LookSave
npm install

cd infra
docker compose -f docker-compose.dev.yml up -d
```

**Migratsiyalar:**

```bash
DEV="docker compose -f docker-compose.dev.yml exec -T postgres psql -U looksave -d looksave -v ON_ERROR_STOP=1"
for f in migrations/*.sql; do echo "→ $(basename "$f")"; $DEV -f - < "$f"; done
$DEV -f - < seeds/dev_seed.sql
$DEV -f - < tests/smoke.sql     # 10 qator, hammasi OK bo'lishi kerak
```

**API:**

```bash
cd ../apps/api
cat > .env <<'EOF'
DATABASE_URL=postgres://looksave:looksave@localhost:5432/looksave
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=dev-access-secret-000000000000000000000000
JWT_REFRESH_SECRET=dev-refresh-secret-11111111111111111111111
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
EOF
npm run dev
curl localhost:3000/health
```

**Integratsion testlar** — 66 ta test butun zanjirni yurgizadi:

```bash
npm run test:integration --workspace=apps/api
```

### Bu bosqichda kutilayotgan xato

**`docker compose` topilmadi** — eski Docker'da `docker-compose` (defis bilan).
Docker Engine 20.10+ kerak.

**Postgres ko'tarilmaydi, `initdb` xatosi** — `POSTGRES_INITDB_ARGS` da
`--locale=C.UTF-8` bor. Alpine (musl) faqat `C` va `C.UTF-8` ni biladi,
shuning uchun ishlashi kerak. Agar baribir yiqilsa: `docker-compose.dev.yml`
da imijni Debian variantiga almashtiring — `postgis/postgis:16-3.4`
(`-alpine` siz).

---

## 1. VPS — 30 daqiqa

Hetzner CPX31 (4 vCPU / 8 GB) yoki shunga o'xshash. Ubuntu 24.04.

Tayyorgarlik `docs/08-deployment.md` §2 da: `deploy` foydalanuvchisi, `ufw`,
Docker, swap.

```bash
# DNS: A yozuvi  api.looksave.app → <VPS IP>   (Cloudflare'da "DNS only")

cd /home/deploy
git clone https://github.com/umidjon-devvloper/LookSave.git looksave
cd looksave/infra

cp .env.example .env
chmod 600 .env
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET  ← boshqasi bilan bir xil BO'LMASIN
openssl rand -hex 32      # TELEGRAM_WEBHOOK_SECRET
nano .env

docker compose up -d
./scripts/migrate.sh
curl https://api.looksave.app/health
```

### Bu bosqichda kutilayotgan xato

> Caddy konfiguratsiyasining o'zi tekshirilgan: lokal proksi rejimida SSE
> kechikishsiz o'tadi, xavfsizlik sarlavhalari qo'yiladi, `/health` log'ga
> tushmaydi, 13 MB tana `413` oladi. Ya'ni quyidagi xato chiqsa — sabab
> konfiguratsiyada emas, DNS yoki tarmoqda.

**Caddy sertifikat olmaydi.** Sabablari, ehtimollik tartibida:

1. DNS hali tarqalmagan — `dig api.looksave.app` bilan tekshiring
2. Cloudflare'da "proxied" (to'q sariq bulut) yoqilgan — **DNS only** qiling.
   Caddy TLS'ni o'zi hal qiladi; Cloudflare proksisi orqasida rate limiting
   ham buziladi (barcha so'rov bitta IP'dan ko'rinadi)
3. 80/443 portlari `ufw` da yopiq

Loglar: `docker compose logs caddy --tail 50`

**`ghcr.io` dan image tortilmaydi** — birinchi deployda image hali yo'q.
Avval CI'ni ishga tushiring (`.github/workflows/api.yml`, `workflow_dispatch`)
yoki lokal quring:

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/<owner>/looksave-api:latest .
```

**`npm ci --workspace` Docker ichida yiqiladi** — `package-lock.json`
`package.json` bilan mos kelmasa shunday bo'ladi. `npm install` qilib
lock'ni yangilang va commit qiling.

> Bu bosqich Docker'siz simulyatsiya qilingan: manifestlarni ko'chirish →
> `npm ci --workspace=apps/api --include-workspace-root` → `tsup` build →
> faqat production bog'liqliklari bilan `node dist/index.js`. Uchalasi ham
> ishladi, API `/health` javob berdi. Ya'ni Dockerfile mantig'i to'g'ri —
> qolgani Docker qatlamlariga bog'liq.

**API ishga tushadi, lekin `/health` `degraded`** — `checks` ichida qaysi
biri `false` ekaniga qarang. `db: false` bo'lsa `POSTGRES_PASSWORD` `.env`
va `DATABASE_URL` da mos emasligi ehtimoli yuqori.

---

## 2. Telegram — 15 daqiqa

```bash
# @BotFather da bot yarating, tokenni .env ga yozing
# TELEGRAM_BOT_TOKEN=...
# TELEGRAM_BOT_USERNAME=...

docker compose up -d api

curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://api.looksave.app/v1/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Tekshirish: do'kon panelida `/telegram` sahifasidan kodni oling, botga
`/start LS-XXXXXX` yuboring, keyin test buyurtma bering.

### Kutilayotgan xato

**Webhook 403 qaytaradi** — `secret_token` `.env` dagi
`TELEGRAM_WEBHOOK_SECRET` bilan bir xil emas.

**Xabar kelmaydi, lekin webhook 200** — do'kon botni bloklagan yoki
`telegram_chat_id` tozalangan. Panelda holatni tekshiring, kerak bo'lsa
qaytadan ulang.

---

## 3. Cloudflare R2 — 15 daqiqa

Bucket yarating, S3 API kalitini oling, `.env` ga yozing:
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`,
`CDN_BASE_URL`.

**CORS sozlamasi majburiy** (09-integrations §4.3) — brauzer to'g'ridan-to'g'ri
`PUT` qiladi:

```json
[
  {
    "AllowedOrigins": ["https://store.looksave.app", "http://localhost:5173"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "cache-control"],
    "MaxAgeSeconds": 3600
  }
]
```

### Kutilayotgan xato

**`PUT` 403 qaytaradi** — imzo `X-Amz-Date` bilan bog'liq, server va R2
vaqti farq qilsa yiqiladi. VPS'da `timedatectl` bilan tekshiring.

**`PUT` CORS xatosi** — yuqoridagi sozlama qo'yilmagan yoki
`AllowedHeaders` ichida `cache-control` yo'q. Presign javobidagi
`headers` ni **aynan** yuborish kerak.

---

## 4. Panellar — Cloudflare Pages

Har panel uchun alohida proyekt:

|               | do'kon paneli                                          | admin panel                        |
| ------------- | ------------------------------------------------------ | ---------------------------------- |
| Build command | `npm ci && npm run build --workspace=apps/store-panel` | `... --workspace=apps/admin-panel` |
| Output        | `apps/store-panel/dist`                                | `apps/admin-panel/dist`            |
| Root          | `/`                                                    | `/`                                |

**SPA uchun `_redirects`** kerak — `dist` ichiga qo'shing yoki Pages
sozlamalarida "Single-page app" ni yoqing. Aks holda `/orders` sahifasini
yangilaganda 404 chiqadi.

`CORS_ORIGINS` ga panel domenlarini qo'shishni unutmang, aks holda barcha
so'rov brauzerda bloklanadi.

---

## 5. Mobil ilova

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas build --profile development --platform android
```

`.apk` o'rnatilgandan keyin:

```bash
npx expo start --dev-client
```

### Kutilayotgan xato

**Ilova ochilib darhol yopiladi** — `metro.config.js` dagi monorepo
sozlamalari ishlamayapti. Loglarni `adb logcat | grep ReactNative` bilan
ko'ring. Ehtimol: ikkita React nusxasi
(`config.resolver.disableHierarchicalLookup` shu uchun qo'yilgan).

**Tarmoq xatosi** — Android emulyatorida `localhost` emulyatorning o'zi.
`eas.json` da `development` profili `10.0.2.2` ga sozlangan. Haqiqiy
qurilmada kompyuteringizning LAN IP'sini yozing.

**Push tokeni olinmaydi** — simulyatorda umuman ishlamaydi
(`Device.isDevice` tekshiriladi). Haqiqiy qurilmada `projectId` kerak:
`eas init` bilan proyektni bog'lang.

### Google Maps kaliti

Xarita ekrani uchun kalit **build paytida** kerak — `EXPO_PUBLIC_*`
yaramaydi, u native konfiguratsiyaga yoziladi (`app.config.ts`).

```
1. Google Cloud Console → yangi proyekt
2. APIs & Services → Enable:
   ✅ Maps SDK for Android
   ✅ Maps SDK for iOS
   ❌ Places API — YOQMANG (K-05, hisob shu yerdan oshadi)
3. Credentials → API key → ikkita alohida kalit
4. Har biriga cheklov:
   Android: paket `app.looksave.mobile` + SHA-1
            (`eas credentials` bilan olinadi)
   iOS:     bundle ID `app.looksave.mobile`
5. Billing → Budget alert qo'ying ($10)
```

Kalitlarni EAS Secrets'ga yozing — repoga tushmasin:

```bash
eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_KEY --value AIza...
eas secret:create --scope project --name GOOGLE_MAPS_IOS_KEY --value AIza...
```

**Eng chalkashtiradigan xato: xarita bo'sh kulrang maydon.** Xato xabari
chiqmaydi, ilova qulamaydi — shunchaki hech narsa ko'rinmaydi. Sabablari,
ehtimollik tartibida:

| Sabab                   | Tekshiruv                                                         |
| ----------------------- | ----------------------------------------------------------------- |
| Kalit umuman berilmagan | Build loglarida `app.config` ogohlantirishi                       |
| SHA-1 mos emas          | `eas credentials` → build'dagi barmoq izi bilan solishtiring      |
| Maps SDK yoqilmagan     | Cloud Console → Enabled APIs                                      |
| Billing ulanmagan       | Kalit ishlaydi, lekin xarita "for development only" bo'lib turadi |

**Klaster ko'rinmaydi** — server zoom 12 dan past bo'lgandagina klaster
qaytaradi. Yaqin turib klaster kutmang, uzoqlashtiring.

**Har surilganda so'rov ketmoqda** — `shouldRefetch` chegarasi
(`src/map/region.ts`) juda past. U ko'rinadigan maydonning uchdan biriga
sozlangan, telefonda tuzatiladi.

### Panel uchun uchinchi kalit

Do'kon paneli ham xarita ishlatadi (ariza va sozlamalarda nuqta tanlash),
lekin unga **alohida kalit** kerak — mobil kalitlari web'da ishlamaydi.

```
Cloud Console → Enable "Maps JavaScript API"
Credentials → API key → HTTP referrers:
    https://panel.looksave.app/*
    http://localhost:5173/*
API restrictions → faqat "Maps JavaScript API"
```

Kalit Cloudflare Pages sozlamalarida `VITE_GOOGLE_MAPS_KEY` sifatida
beriladi (namuna: `apps/store-panel/.env.example`).

**Kalit berilmasa panel ishlashda davom etadi** — xarita o'rniga
koordinatani qo'lda kiritish maydoni qoladi. Bu ataylab: do'kon egasi
buyurtmalarni ko'rishi xarita muammosidan muhimroq.

---

## 6. Birinchi ma'lumot

1. Admin foydalanuvchi — ro'yxatdan o'tib bo'lmaydi, qo'lda belgilanadi:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+998901234567';
```

2. Do'kon egasi ilovada ro'yxatdan o'tadi
3. Do'kon yozuvi hozircha qo'lda yaratiladi (do'kon ro'yxatdan o'tish
   ekrani hali yo'q):

```sql
INSERT INTO stores (owner_id, name, slug, location, address, city, country,
                    phone, currency, status)
VALUES ((SELECT id FROM users WHERE phone = '+998901234567'),
        'Do''kon nomi', 'dokon-nomi',
        ST_MakePoint(69.2797, 41.3111)::geography,
        'Manzil', 'Toshkent', 'UZ', '+998901234567', 'UZS', 'pending');
```

4. Admin panelda tasdiqlaysiz
5. Do'kon panelida sozlamalar, mahsulot, Telegram

---

## Nima sinalgan, nima yo'q

|                                             | Holat                      |
| ------------------------------------------- | -------------------------- |
| API mantig'i, migratsiyalar, triggerlar     | ✅ 66 integratsion test    |
| Cron vazifalari, Telegram callback mantig'i | ✅ test bilan              |
| Dockerfile mantig'i (npm ci → build → run)  | ✅ Docker'siz simulyatsiya |
| Docker Compose, Caddy, TLS                  | ❌                         |
| R2 haqiqiy bucket bilan                     | ❌                         |
| Telegram haqiqiy bot bilan                  | ❌                         |
| Mobil ilova qurilmada                       | ❌                         |
| Push haqiqiy qurilmada                      | ❌                         |

Pastdagi beshtasi tashqi xizmat va uskunaga bog'liq — ular faqat shu
qo'llanma bo'yicha yurganda tekshiriladi.
