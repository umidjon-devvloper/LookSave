# 14 — Test va ishga tushirish

**Bog'liq:** [12-tz.md §6](./12-tz.md) · [RUNBOOK.md](../RUNBOOK.md) · [08-deployment.md](./08-deployment.md)

`RUNBOOK.md` — **birinchi marta** haqiqiy muhitga qo'yish (VPS, TLS, R2, Telegram).
Bu hujjat — **har kungi** ish: lokal ko'tarish, tekshirish, simulyator, qurilma.

---

## 1. Bir qarashda

| Nima kerak | Buyruq |
|---|---|
| Kod toza ekanini tekshirish | `npm run check` |
| Testlar | `npm test` |
| Backend + baza ko'tarish | `./scripts/dev-up.sh` |
| To'xtatish | `./scripts/dev-down.sh` |
| Sayt / panellarni ochish | `.claude/launch.json` (brauzer paneli) |
| Simulyator | `./scripts/sim.sh` |
| Haqiqiy iPhone | `./scripts/device.sh` |
| 3D modellarni tekshirish | `node assets-3d/generator/validate.mjs` |

---

## 2. Kod tekshiruvi

```bash
npm run check
```

`format:check` + `lint` + `typecheck` — uchalasi ketma-ket, ~40 soniya.
**Commit oldidan majburiy.**

```bash
npm test
```

238 birlik test (api 153 · mobile 71 · web-panel 14), ~15 soniya. Baza kerak emas.

```bash
npm run test:integration --workspace=apps/api
```

86 integratsion test — **haqiqiy baza kerak**, avval `dev-up.sh`.

---

## 3. Backend va baza

```bash
./scripts/dev-up.sh
```

Ketma-ketlik: sozlama → Postgres/Redis → migratsiya → seed → smoke → API.

### Ikki muhit avtomatik aniqlanadi

| Muhit | Qachon | Nima qiladi |
|---|---|---|
| **docker** | `docker info` javob bersa | `infra/docker-compose.dev.yml` ni ko'taradi |
| **local** | Docker bo'lmasa | 5432/6379 portlarini tekshiradi (Postgres.app + brew redis) |

Lokal rejimda skript servislarni **o'zi ko'tarmaydi** — ular tizim xizmati va
boshqa loyihalar ham ulardan foydalanayotgan bo'lishi mumkin.

### Bayroqlar

| Bayroq | Nima qiladi |
|---|---|
| `--no-api` | Faqat baza; API ni o'zingiz yurgizasiz |
| `--adopt` | Mavjud migratsiyalarni «qo'llangan» deb belgilaydi (**yurgizmasdan**) |
| `--fresh` | Sxemani tozalab noldan quradi — **so'raydi**, `--yes` bilan so'ramaydi |

### ⚠️ «Jadval bor, qaydnoma bo'sh» holati

Migratsiyalar **idempotent emas** (001 dan boshqasida `IF NOT EXISTS` yo'q).
Baza qo'lda migratsiya qilingan bo'lsa (RUNBOOK dagi `for`-halqa bilan),
`schema_migrations` bo'sh qoladi va skript qayta yurgizsa xato beradi.

Shuning uchun bu holatda skript **to'xtaydi** va tanlovni odamga qoldiradi:

```bash
./scripts/dev-up.sh --adopt   # mavjudini "qo'llangan" deb belgilash
./scripts/dev-up.sh --fresh   # tozalab noldan qurish
```

`--adopt` dan **oldin** bazada haqiqatan hamma jadval borligiga ishonch hosil qiling:

```bash
grep -rhioE "CREATE TABLE (IF NOT EXISTS )?[a-z0-9_]+" infra/migrations/*.sql \
  | awk '{print tolower($NF)}' | sort -u > /tmp/want.txt
psql "$DATABASE_URL" -tAq -c \
  "select table_name from information_schema.tables where table_schema='public'" \
  | sort -u > /tmp/have.txt
comm -23 /tmp/want.txt /tmp/have.txt    # bo'sh bo'lishi kerak
```

Bo'sh bo'lmasa — `--adopt` qilmang, aks holda qo'llanmagan migratsiyani
«qo'llangan» deb belgilab, muammoni yashirasiz.

---

## 4. Sayt va panellar

| Ilova | Port | Workspace |
|---|---|---|
| Tanishtiruv sayti | 5175 | `@looksave/web` |
| Do'kon paneli | 5173 | `@looksave/store-panel` |
| Admin panel | 5174 | `@looksave/admin-panel` |

Uchalasi `/v1` ni `127.0.0.1:3000` ga proksilaydi — CORS kerak emas.

```bash
npm run dev --workspace @looksave/web
```

### ⚠️ `127.0.0.1` ishlamaydi, `localhost` ishlaydi

Vite standart holatda **faqat IPv6** da tinglaydi (`[::1]:5175`). macOS'da
`localhost` avval `::1` ga hal bo'ladi, `127.0.0.1` esa IPv4 — u yerda hech kim yo'q.

```bash
curl http://127.0.0.1:5175/    # HTTP 000 — chalg'ituvchi
curl http://localhost:5175/    # HTTP 200 ✅
```

«Server ishga tushdi, lekin ochilmayapti» deyilganda sabab odatda shu.

---

## 5. Mobil ilova

### 5.1 Simulyator

```bash
./scripts/sim.sh                      # standart: iPhone 17
./scripts/sim.sh --device "iPhone 17 Pro"
./scripts/sim.sh --list               # mavjud simulyatorlar
```

Skript API manzilini avtomatik `http://localhost:3000` ga qo'yadi —
simulyator Mac bilan bir xil tarmoq stekida va bu qiymat Wi-Fi
almashganda eskirmaydi. `.env` dagi LAN IP kerak bo'lsa: `--lan`.

### ⚠️ Simulyator 3D uchun ishonchsiz

`src/three/Scene3D.tsx` da o'lchangan: simulyator **10 ta ishga
tushirishning 4 tasida** chizdi, haqiqiy qurilmada esa barqaror ishladi.
Sabab — simulyator OpenGL ni Metal ustida taqlid qiladi.

| Nima sinaladi | Qayerda |
|---|---|
| Ekranlar, navigatsiya, formalar, API, i18n | ✅ Simulyator yetarli |
| **3D sahna, FPS, GLB yuklash, animatsiya** | ❌ **Faqat qurilma** |
| Kamera (yuz skani), push, geolokatsiya | ❌ Faqat qurilma |

Simulyatorda qora ekran ko'rsangiz — **kodni tuzatishga oshiqmang**,
avval qurilmada tekshiring.

### 5.2 Haqiqiy iPhone

```bash
./scripts/device.sh --check    # avval tayyorlikni tekshiring
./scripts/device.sh
```

`--check` uchta narsani ko'radi: qurilma ulanganmi, `.env` dagi API manzili
Mac'ning hozirgi LAN IP'siga to'g'ri keladimi, Xcode team ID o'rnidami.

### ⚠️ `--device` ga QIYMAT berish shart

`npx expo run:ios --device` (qiymatsiz) qurilmani **interaktiv so'raydi** va
skriptdan chaqirilganda shunday yiqiladi:

```
CommandError: Input is required, but 'npx expo' is in non-interactive mode.
```

`device.sh` UDID ni o'zi topadi. Qo'lda kerak bo'lsa:

```bash
xcrun xctrace list devices
```

⚠️ **Ikki xil identifikator bor va ular ALMASHTIRILMAYDI:**

| Vosita | Nima beradi | Namuna |
|---|---|---|
| `xcrun devicectl list devices` | CoreDevice UUID | `51E23A0D-8168-57B7-…` |
| `xcrun xctrace list devices` | **Qurilma UDID'i** | `00008030-001864381A8B802E` |

`expo run:ios` ichida **xctrace** ishlatiladi — ya'ni faqat ikkinchisi
qabul qilinadi. Birinchisini bersangiz qurilma «topilmadi» bo'ladi.

### ⚠️ «Devices Offline»

`xctrace` qurilmani `Devices Offline` bo'limida ko'rsatsa, `devicectl`
«available (paired)» desa ham build o'tmaydi. Sabab odatda: telefon
**Wi-Fi orqali** ulangan (USB emas), qulflangan, yoki `Trust`
tasdiqlanmagan. Uchalasini ham tekshiring — `device.sh` bu holatni
ogohlantirish bilan aytadi.

### Uchta nostandart qadam

| # | Nima | Nega |
|---|---|---|
| 1 | `pod` har doim `RUBYOPT=-rlogger` bilan | Tizim Ruby 2.6 + CocoaPods 1.15.2 aks holda «uninitialized constant Logger» beradi |
| 2 | `expo run:ios` **`--no-install`** bilan | Ichki `pod install` qotib qoladi (13+ daqiqa, 0% CPU). Alohida: `cd apps/mobile/ios && RUBYOPT=-rlogger pod install` — 40 soniya |
| 3 | Team ID = `Y4Z2G3NK2N` | `security find-identity` ko'rsatadigan `PL4HJFRNR5` — **sertifikat ID'si, team emas**; u bilan build «No profiles found» beradi |

### ⚠️ Wi-Fi almashsa

Telefonda `localhost` **ishlamaydi** — u telefonning o'zini bildiradi.
`apps/mobile/.env` dagi `EXPO_PUBLIC_API_URL` Mac'ning LAN IP'si bo'lishi kerak,
va u **build paytida** ilovaga yoziladi — ya'ni o'zgartirgandan keyin **qayta build**.

`./scripts/device.sh --check` buni o'zi tekshiradi va tuzatish buyrug'ini beradi.

---

## 6. 3D modellar

```bash
node assets-3d/generator/build.mjs      # modellarni yasash → export/
node assets-3d/generator/validate.mjs   # tuzilma, animatsiya, kiyim o'lchami
node assets-3d/generator/measure.mjs    # proporsiya va aylana (sm)
python3 blender_scripts/test_rules.py   # 32 qoida testi
```

Blender (oynasiz):

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python <skript>
```

### ⚠️ `validate.mjs` hamma narsani ushlamaydi

U kiyim bilan tana orasidagi eng tor masofani **namuna balandliklarda**
o'lchaydi. Yeng, yelka va tizza kabi joylarda tana kiyim ichidan chiqib
turgan bo'lsa ham «✅» berishi mumkin — bu 2026-08-23 da saytda ko'z bilan
ko'rildi (12-tz.md D-39, D-40).

**Xulosa: raqam yetarli emas, modelni ko'zingiz bilan ham ko'ring.**

---

## 7. Qo'lda tekshiriladigan yo'l

Har release oldidan bosib chiqiladi. Har qadamda: ishladi / ishlamadi.

| # | Qadam | Qayerda |
|---|---|---|
| 1 | Ro'yxatdan o'tish → jins → o'lchamlar | Simulyator |
| 2 | Home: yaqin do'konlar (geolokatsiya bilan **va busiz**) | Qurilma |
| 3 | Do'kon → katalog → mahsulot sahifasi | Simulyator |
| 4 | **Kiyintirish:** avatar → kiyim almashtirish → o'lcham tavsiyasi | **Qurilma** |
| 5 | Savatga → checkout → buyurtma | Simulyator |
| 6 | Telegram: sotuvchiga xabar keldimi, tugma ishlaydimi | Haqiqiy bot |
| 7 | Buyurtma statusi ilovada yangilandimi (SSE / push) | Qurilma |
| 8 | Til almashtirish (uz / ru / en) — **hamma** ekran | Simulyator |
| 9 | Akkauntni o'chirish (App Store talabi) | Simulyator |
| 10 | Sayt: hero, 3D blok, waitlist formasi | Brauzer |

---

## 8. Tez-tez uchraydigan chalg'ituvchi xatolar

| Belgi | Haqiqiy sabab |
|---|---|
| `curl 127.0.0.1:5175` → 000, lekin server ishlayapti | Vite faqat IPv6 da tinglaydi — `localhost` ishlating (§4) |
| Simulyatorda 3D qora ekran | Simulyator OpenGL taqlidi — qurilmada tekshiring (§5.1) |
| Telefonda «tarmoq xatosi» | `.env` dagi LAN IP eskirgan + qayta build kerak (§5.2) |
| `dev-up.sh` migratsiyada to'xtadi | Qaydnoma bo'sh — `--adopt` yoki `--fresh` (§3) |
| `smoke.sql` birinchi `INSERT` da yiqiladi | Fikstura telefon raqami haqiqiy akkaunt bilan to'qnashgan. Rezerv diapazon: `+998999000xxx` |
| `pod install` 13 daqiqa 0% CPU da turibdi | `expo run:ios` ning ichki chaqiruvi — `--no-install` ishlating (§5.2) |
| `Input is required, but 'npx expo' is in non-interactive mode` | `--device` ga UDID berilmagan (§5.2) |
| Qurilma UDID berildi, lekin «topilmadi» | `devicectl` ning UUID'i berilgan — `xctrace` niki kerak (§5.2) |
| Blender «faylni o'qib bo'lmadi» | **Eskirgan sabab.** git-lfs endi ishlatilmaydi (12-tz.md D-37) — pointer muammosi yo'q |
