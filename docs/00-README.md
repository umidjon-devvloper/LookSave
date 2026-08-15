# LookSave — Loyiha hujjatlari

**Loyiha:** LookSave — AI fashion marketplace
**Bozorlar:** Dubay (BAA) va Toshkent (O'zbekiston)
**Ishlab chiquvchi:** Umidjon (solo)
**Hujjat versiyasi:** 2.1
**Oxirgi yangilanish:** 2026-yil avgust

---

## 1. Loyiha nima

LookSave — foydalanuvchi ilovani ochganda **yaqin atrofidagi kiyim do'konlarini** ko'rsatadigan, mahsulotni **3D avatarda kiyib ko'rish** imkonini beradigan va do'konga to'g'ridan-to'g'ri buyurtma yuboradigan mobil marketplace.

Uch qism birlashadi:

1. **Geo-discovery** — yaqin do'konlar, xarita, katalog
2. **3D Try-On** — avatar, svayp bilan kiyim almashtirish, o'lcham moslash
3. **Marketplace** — savat, buyurtma, do'kon paneli

### Farqlovchi xususiyat

Deckda bu yo'q edi, lekin eng kuchli tomon shu: **geolokatsiya + mahalliy do'konlar**. Global marketplace (Shein, Farfetch, Namshi) bilan urushish o'rniga, hech kim yopmagan nishaga kiriladi — atrofdagi real do'konlar onlayn vitrina va virtual kiyinish oladi.

---

## 2. Hujjatlar xaritasi

| # | Fayl | Nima haqida | Holat |
|---|---|---|---|
| 00 | `00-README.md` | Shu fayl — kirish, qarorlar, kelishuvlar | ✅ |
| 01 | `01-arxitektura.md` | To'liq texnik arxitektura, DB sxemasi, API, 3D tizimi | ✅ |
| 02 | `02-database.md` | Migratsiya fayllari, indexlar, seed data, so'rovlar | ✅ |
| 03 | `03-api-spec.md` | Har bir endpoint: request/response, xato kodlari | ✅ |
| 04 | `04-3d-pipeline.md` | Blender qadamlari, eksport sozlamalari, QA checklist | ✅ |
| 05 | `05-mobile.md` | Ekran-ekran spetsifikatsiya, komponentlar, state | ✅ |
| 06 | `06-dizayn.md` | Rang, tipografika, komponentlar, 3D vizual — deck asosida | ✅ |
| 07 | `07-web-panels.md` | Do'kon kabineti va admin panel ekranlari | ✅ |
| 08 | `08-deployment.md` | docker-compose, .env, VPS sozlash, backup, CI/CD | ✅ |
| 09 | `09-integrations.md` | Telegram bot, SMS, Gemini, Google Maps, R2 | ✅ |
| 10 | `10-roadmap.md` | Fazalar, sprintlar, milestone'lar, risklar | ✅ |
| 11 | `11-shartnoma.md` | Mijoz uchun ko'lam, narx, istisnolar | ⏳ |

---

## 3. Qabul qilingan qarorlar

Bu qarorlar muhokama qilinib, sabablari bilan qabul qilindi. O'zgartirish uchun sabab bo'lishi kerak.

| # | Qaror | Sabab |
|---|---|---|
| K-01 | **Faqat PostgreSQL + PostGIS** (MongoDB yo'q) | Bitta VPS, bitta backup, kam RAM. JSONB moslashuvchanlikni beradi, PostGIS geo'ni, tranzaksiya buyurtmani |
| K-02 | **Bitta VPS + Docker Compose** | Faza 1-2 da managed servislar ~$700/oy ortiqcha xarajat. Chegara ~50k foydalanuvchi |
| K-03 | **Cloudflare R2** fayllar uchun | Egress bepul. 3D fayllar og'ir va doim yuklanadi — S3/UploadThing'da trafik hisobi portlaydi |
| K-04 | **Google Maps mobil SDK** | Ikkala bozorda ishlaydi (Yandex Dubayda zaif). Mobil SDK cheksiz bepul |
| K-05 | **Places API ishlatilmaydi** | Do'konlar bizning bazamizda. Qidiruv PostGIS'da. Bu eng qimmat SKU'ni butunlay chetlab o'tadi |
| K-06 | **3D asset, generatsiya emas** | Svayp uchun generatsiya sekin (3-10 s) va kiyimning aslini buzadi. Asset — 0.2 s va 100% barqaror |
| K-07 | **Mato fizikasi yo'q** | Cloth simulation telefonni qotiradi. Skinning + 2-3 qo'shimcha suyak yetarli |
| K-08 | **Face scan qurilmada** | MediaPipe / ARKit. GPU serveri kerak emas → $0 |
| K-09 | **Stilizatsiyalangan realistik avatar** | To'liq fotorealistik "uncanny valley" xavfi + telefonni qiynaydi |
| K-10 | **MVP'da onlayn to'lov yo'q** | 3-4 hafta ish + yuridik shaxs + litsenziya. Buyurtma = sotuvchiga so'rov, hisob-kitob offline |
| K-11 | **Telegram bot — sotuvchi uchun asosiy kanal** | Do'kon egasi web panel oldida o'tirmaydi, Telegram doim ochiq. Bepul, bir zumda |
| K-12 | **Faza 1-2 da komissiya undirilmaydi** | "Bepul, komissiyasiz" — do'kon jalb qilishda eng kuchli argument. Raqamlar yig'ilib boradi |
| K-13 | **Gemini free tier + Groq fallback** | Kredit karta kerak emas, muddat yo'q. LLM'ga shaxsiy ma'lumot yuborilmaydi |
| K-14 | **Expo development build** (Expo Go emas) | 3D uchun `expo-gl` kerak. Birinchi kundan sozlanadi |
| K-15 | **Telefon OTP bilan bog'lash** | Soxta buyurtmaga qarshi asosiy himoya. Format validatsiyasi o'zi yetarli emas |
| K-16 | **Dizayn deck asosida: qora + binafsha neon** | Premium tuyg'u mahsulotning qiymat taklifi. Oq fon hech qayerda yo'q |
| K-17 | **Glow effekti ikki qatlamli usulda** | Android'da rangli soya yo'q. Ro'yxatlarda glow umuman ishlatilmaydi |

---

## 4. Ko'lam chegaralari

### MVP'ga kiradi

✅ Auth, jins tanlash, o'lchamlar
✅ Geo: xarita, yaqin do'konlar, do'kon profili va katalogi
✅ Katalog: kategoriyalar, filtr, qidiruv, mahsulot sahifasi
✅ 3D Try-On: avatar, svayp, slot tizimi, morph, animatsiya
✅ Face scan → yuz teksturasi (qurilmada)
✅ Savat + buyurtma so'rovi (to'lovsiz)
✅ Do'kon kabineti + Telegram bot
✅ Admin panel
✅ Push, wishlist, saqlangan look'lar

### MVP'ga kirmaydi

❌ Onlayn to'lov (Faza 3)
❌ AI Designer (Faza 3)
❌ AR / smart mirror
❌ Token / NFT / digital shares
❌ Web try-on versiyasi
❌ Chat, ijtimoiy tarmoq funksiyalari
❌ Ko'p tilli to'liq lokalizatsiya (MVP: uz + en)

---

## 5. Texnologiyalar

| Qatlam | Texnologiya |
|---|---|
| Mobil | Expo SDK 52, React Native, expo-router, NativeWind |
| 3D | three.js, @react-three/fiber, expo-gl, expo-three |
| Web | Vite, React 18, Tailwind CSS, TanStack Query |
| Backend | Node.js 20, Express, Zod (validatsiya) |
| Baza | PostgreSQL 16 + PostGIS, Redis 7 |
| Fayllar | Cloudflare R2 (S3 SDK) |
| Xarita | Google Maps SDK (mobil), MapLibre (zaxira) |
| LLM | Gemini API → Groq (fallback) |
| Hosting | Hetzner VPS + Docker Compose + Caddy |
| CI/CD | GitHub Actions, EAS Build |

---

## 6. Repozitoriy tuzilmasi

```
looksave/
├── docs/                  ← shu hujjatlar
├── apps/
│   ├── mobile/            ← Expo RN
│   ├── store-panel/       ← Vite React (do'kon kabineti)
│   ├── admin-panel/       ← Vite React (admin)
│   └── api/               ← Node + Express
├── packages/
│   ├── shared-types/      ← TypeScript tiplar (API kontrakti)
│   └── validation/        ← Zod sxemalar (mobil + server birgalikda)
├── infra/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── migrations/
└── assets-3d/             ← Blender manba fayllari (git-lfs)
```

**Muhim:** `packages/validation` — Zod sxemalari mobil ilova va serverda **bir xil** ishlatiladi. Shunda validatsiya qoidalari ikki joyda ajralib ketmaydi.

---

## 7. Kelishuvlar (conventions)

### Kod

- TypeScript hamma joyda, `strict: true`
- API javoblari: `{ data }` yoki `{ error: { code, message, details } }`
- Xato kodlari — `SCREAMING_SNAKE_CASE` (`PHONE_NOT_VERIFIED`)
- Sana/vaqt — hamma joyda UTC, `TIMESTAMPTZ`
- Pul — `NUMERIC(12,2)`, hech qachon `float`
- ID — UUID v4

### Baza

- Jadval nomlari — ko'plikda, `snake_case` (`product_variants`)
- Har bir jadvalda `created_at`
- O'chirish — `status` orqali (soft delete), `DELETE` faqat kesh jadvallarida
- Migratsiyalar — raqamlangan, orqaga qaytmaydi (`001_init.sql`, `002_orders.sql`)

### Git

- Branch: `main` (stable), `dev`, `feat/*`, `fix/*`
- Commit: `feat: add nearby stores endpoint`
- 3D fayllar — `git-lfs`

---

## 8. Muhim eslatmalar

**Backup — bu eng muhim band.** Bitta VPS = bitta xavf nuqtasi. Kunlik `pg_dump` → R2, haftalik snapshot. Bir marta unutilsa, hamma narsa ketadi.

**3D modellar vaqt yeydi.** Bitta kiyim 8-15 soat. AI vositalari bu bosqichni tezlashtirmaydi. Rejalashtirish shu raqamdan boshlanadi.

**Google Cloud'da budget alert qo'ying.** $10 va $50 da. Standart holatda qattiq chegara yo'q — trafik oshsa yoki bot kirsa, sezmasdan katta hisob chiqadi.

**Bepul tarifga shaxsiy ma'lumot yuborilmaydi.** Gemini free tier so'rovlari model o'qitishda ishlatilishi mumkin. LLM'ga faqat: tadbir turi, kayfiyat, byudjet, mahsulot ro'yxati.

**Brend logolari.** Nike, Gucci, Zara — shartnomasiz ishlatilmaydi. Deckda ham "target brands" deb belgilash kerak.

---

## 9. Ochiq savollar

| Savol | Kim hal qiladi | Muddat |
|---|---|---|
| Loyiha narxi va to'lov grafigi | Umidjon + mijoz | Boshlashdan oldin |
| Faza 1 ga nechta 3D model kiradi | Umidjon + mijoz | Shartnomada |
| Birinchi bozor — Dubay yoki Toshkent | Mijoz | Faza 1 oxirigacha |
| Do'konlarni kim jalb qiladi | Mijoz | Faza 2 boshlanishida |
| Mahsulot fotolarini kim tayyorlaydi | Mijoz | Har do'kon uchun |
| Yuridik shaxs (Dubay yoki UZ) | Mijoz | Faza 3 dan oldin |
