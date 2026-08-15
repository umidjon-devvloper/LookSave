# apps/store-panel

Do'kon kabineti. Vite + React 18 + TypeScript + Tailwind + TanStack Query.
Cloudflare Pages'ga deploy qilinadi (K-02).

Spetsifikatsiya: [`docs/07-web-panels.md`](../../docs/07-web-panels.md) · [`docs/06-dizayn.md`](../../docs/06-dizayn.md)

---

## Ishga tushirish

```bash
cd infra && docker compose -f docker-compose.dev.yml up -d
cd ../apps/api && npm run dev          # http://localhost:3000
cd ../store-panel && npm run dev       # http://localhost:5173
```

Vite `/v1` so'rovlarini API'ga proksi qiladi — CORS bilan ovora bo'lish shart emas.

| Buyruq              | Nima qiladi                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | dev server + API proksisi                |
| `npm run build`     | `tsc --noEmit` va `vite build` → `dist/` |
| `npm run typecheck` | faqat tiplar                             |

---

## Sahifalar

| Yo'l         | Nima                                                       |
| ------------ | ---------------------------------------------------------- |
| `/login`     | telefon + parol                                            |
| `/`          | bosh sahifa — sanoqlar, javob tezligi, tasdiqlash foizi    |
| `/orders`    | buyurtmalar: Yangi · Jarayonda · Yakunlangan · Rad etilgan |
| `/blocklist` | qora ro'yxat                                               |
| `/telegram`  | botni ulash                                                |

---

## Hujjatdan chekingan uch joy

**1. Kirish — parol, OTP emas.** Hujjatda telefon + SMS OTP. API'da hozircha
OTP yo'q (5-bosqich qarori), shuning uchun panel ham parol bilan ishlaydi.
OTP qo'shilganda login sahifasi almashadi, qolgani tegilmaydi.

**2. Token `localStorage` da, `httpOnly` cookie emas.** Hujjat cookie'ni
talab qiladi va bu to'g'ri — `localStorage` XSS oldida himoyasiz. Lekin API
cookie o'rnatmaydi: u mobil ilova uchun qurilgan va tokenlarni javob
tanasida qaytaradi. Hozirgi holat: access token faqat **xotirada**,
refresh token `localStorage` da. To'g'ri yechim — API'ga cookie
o'rnatuvchi sessiya endpointi qo'shish. Shu paytgacha panelga uchinchi
tomon skriptlari qo'shilmasligi kerak.

**3. SSE `EventSource` bilan emas, `fetch` bilan.** `EventSource` maxsus
sarlavha yubora olmaydi — na `Authorization: Bearer`, na `X-Store-Id`.
Hujjat tokenni cookie'da deb hisoblagan. Tokenni URL'ga qo'yish mumkin
edi, lekin u proksi va server loglariga tushadi. Shuning uchun oqim
`fetch` + `ReadableStream` bilan o'qiladi (`hooks/useOrderStream.ts`).

---

## Bilib turish kerak

**Yangi buyurtma signali:** sahifa sarlavhasidagi sanoq + brauzer
bildirishnomasi (ruxsat berilgan bo'lsa) + ro'yxat avtomatik yangilanadi.
Tovush hali qo'shilmagan — brauzer avtomatik tovushni bloklaydi,
foydalanuvchidan ruxsat so'rash kerak.

**Asosiy kanal baribir Telegram** (K-11). Panel ochiq turmasligi mumkin,
SSE — qo'shimcha qulaylik.

**Bir necha do'koni bo'lsa** `X-Store-Id` sarlavhasi kerak. Hozir panel uni
`api/client.ts` dagi `setStoreId()` orqali yuboradi; do'kon almashtirgich
UI hali yo'q — bitta do'konli egalar uchun kerak emas.

---

## Rasm yuklash

Rasm **serverdan o'tmaydi**: panel `POST /store/uploads/presign` dan imzolangan
havola oladi va faylni to'g'ridan-to'g'ri R2 ga `PUT` qiladi (09-integrations §4.2).

⚠️ Presign javobidagi `headers` ni **aynan** yuborish kerak. Imzoda
`SignedHeaders=host` — ya'ni `Content-Type` va `Cache-Control` imzoga
kirmaydi, lekin ular yuborilmasa R2 obyektni kesh sarlavhasisiz saqlaydi
va CDN keshi ishlamaydi.

Bazaga faqat `CDN_BASE_URL` bilan boshlanadigan havola tushadi — server
tashqi rasmni rad etadi.

---

## Mahsulot holatlari

`draft` → `pending` → (admin) → `active` yoki `rejected`

Do'kon o'z mahsulotini `active` qila olmaydi. Tekshiruvga yuborish uchun
kamida **3 ta rasm** kerak — forma buni tugmani o'chirib ko'rsatadi.

`DELETE` — o'chirish emas, **arxivlash**: eski buyurtmalar mahsulotga
bog'langan, qator o'chirilsa tarix buziladi.

---

## Ombor

Ombor har rang uchun **alohida** saqlanadi. Buyurtma qilingan miqdordan
kam qilib bo'lmaydi — server `INVALID_STATE` qaytaradi va nechta dona
band ekanini aytadi. Aks holda mijoz buyurtma qilgan tovar "yo'q" bo'lib
qolardi.

---

## Grafik — Recharts emas

⚠️ Hujjatda Recharts ko'rsatilgan (07-web-panels §4.6). Bitta ustunli
grafik uchun ~100 KB kutubxona qo'shish o'zini oqlamaydi — CSS bilan
chizilgan. Bir nechta murakkab grafik kerak bo'lganda Recharts'ga
o'tamiz.

---

## Hali yo'q

- Xaritada pin surish — hozircha koordinata qo'lda kiritiladi va
  Google Maps havolasi bilan tekshiriladi
- Do'kon almashtirgich
- Yangi buyurtma tovushi
