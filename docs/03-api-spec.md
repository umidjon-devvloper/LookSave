# 03 — API spetsifikatsiyasi

**Base URL:** `https://api.looksave.app/v1`
**Format:** JSON, UTF-8
**Bog'liq:** [01-arxitektura.md](./01-arxitektura.md) · [02-database.md](./02-database.md)

---

## 1. Umumiy kelishuvlar

### Javob formati

Har bir javob **bir xil qobiqda** qaytadi. Ilova kodida bitta handler yetadi.

**Muvaffaqiyat:**
```json
{
  "data": { "id": "…", "title": "…" },
  "meta": { "requestId": "req_8f3a…" }
}
```

**Ro'yxat (keyset pagination):**
```json
{
  "data": [ { "id": "…" }, { "id": "…" } ],
  "meta": {
    "requestId": "req_8f3a…",
    "nextCursor": "eyJhdCI6IjIwMjYtMDgtMTIiLCJpZCI6Ii4uLiJ9",
    "hasMore": true
  }
}
```

**Xato:**
```json
{
  "error": {
    "code": "PHONE_NOT_VERIFIED",
    "message": "Bu raqam tasdiqlanmagan",
    "details": { "phone": "+998901234567" }
  },
  "meta": { "requestId": "req_8f3a…" }
}
```

`message` — foydalanuvchiga ko'rsatish uchun, `Accept-Language` bo'yicha tarjima qilinadi.
`code` — ilova kodida tekshirish uchun, hech qachon o'zgarmaydi.

### Sarlavhalar

| Sarlavha | Majburiy | Misol |
|---|---|---|
| `Authorization` | Himoyalangan endpointlarda | `Bearer eyJhbGc…` |
| `Accept-Language` | Yo'q | `uz` · `ru` · `en` · `ar` |
| `X-Device-Id` | Mobil ilovada | `a3f8…` |
| `X-App-Version` | Mobil ilovada | `1.2.0` |
| `Idempotency-Key` | `POST /orders` da | UUID |

### Pagination

`OFFSET` ishlatilmaydi. Keyset cursor — base64 kodlangan `{ at, id }`.

```
GET /products?limit=20&cursor=eyJhdCI6…
```

`limit` — standart 20, maksimum 50.

### Sana va vaqt

Barcha vaqtlar ISO 8601, UTC: `2026-08-12T14:30:00.000Z`

### Pul

```json
{ "amount": "1250000.00", "currency": "UZS" }
```

Pul **string** sifatida yuboriladi. JavaScript'da `number` katta summalarda aniqlikni yo'qotadi.

---

## 2. Autentifikatsiya

JWT juftligi: qisqa muddatli `accessToken` + uzoq muddatli `refreshToken`.

| Token | Muddat | Saqlanadi |
|---|---|---|
| `accessToken` | 15 daqiqa | Xotirada (mobil), memory (web) |
| `refreshToken` | 30 kun | `expo-secure-store` / httpOnly cookie |

```
Authorization: Bearer <accessToken>
```

`accessToken` muddati tugasa → `401 TOKEN_EXPIRED` → ilova `/auth/refresh` chaqiradi → qayta urinadi. Bu ilovada interceptor sifatida bir joyda yoziladi.

### JWT payload

```json
{
  "sub": "user-uuid",
  "role": "customer",
  "storeIds": ["store-uuid"],
  "iat": 1755000000,
  "exp": 1755000900
}
```

`storeIds` — `store_owner` va `staff` uchun. Do'kon endpointlarida shu ro'yxat tekshiriladi.

---

## 3. Xato kodlari

| HTTP | Kod | Ma'nosi |
|---|---|---|
| 400 | `BAD_REQUEST` | So'rov formati noto'g'ri |
| 401 | `UNAUTHORIZED` | Token yo'q |
| 401 | `TOKEN_EXPIRED` | Token muddati tugadi → refresh |
| 401 | `TOKEN_INVALID` | Token buzilgan → qayta kirish |
| 403 | `FORBIDDEN` | Ruxsat yo'q |
| 403 | `PHONE_NOT_VERIFIED` | Raqam OTP bilan tasdiqlanmagan |
| 403 | `BLOCKED` | Qora ro'yxatda (do'kon yoki global) |
| 403 | `RESTRICTED` | Vaqtinchalik cheklangan |
| 404 | `NOT_FOUND` | Topilmadi |
| 409 | `OUT_OF_STOCK` | Ombor yetarli emas |
| 409 | `ALREADY_EXISTS` | Takroriy yozuv |
| 409 | `INVALID_STATE` | Bu statusda bu amal mumkin emas |
| 422 | `VALIDATION_ERROR` | Maydonlar noto'g'ri (`details` da ro'yxat) |
| 422 | `OUT_OF_RANGE` | Manzil do'kon radiusidan tashqarida |
| 422 | `INVALID_PHONE` | Telefon formati yoki turi noto'g'ri |
| 429 | `RATE_LIMITED` | Juda ko'p so'rov |
| 429 | `LIMIT_REACHED` | Buyurtma limiti (ochiq yoki kunlik) |
| 429 | `OTP_TOO_SOON` | OTP juda tez qayta so'raldi |
| 500 | `INTERNAL_ERROR` | Server xatosi |
| 503 | `SERVICE_UNAVAILABLE` | Tashqi servis ishlamayapti |

### `VALIDATION_ERROR` tafsiloti

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ma'lumotlar to'liq emas",
    "details": {
      "fields": [
        { "field": "contactName",  "code": "TOO_SHORT",     "message": "Ism kamida 2 harf bo'lishi kerak" },
        { "field": "address.lat",  "code": "REQUIRED",      "message": "Xaritada joyni belgilang" },
        { "field": "contactPhone", "code": "INVALID_FORMAT","message": "Telefon raqami noto'g'ri" }
      ]
    }
  }
}
```

Ilova bu ro'yxatni olib, har bir maydon ostiga qizil matn chiqaradi.

---

## 4. Rate limiting

| Endpoint | Limit |
|---|---|
| `POST /auth/send-otp` | 1 / 60 s, 5 / soat (telefon bo'yicha) |
| `POST /auth/verify-otp` | 5 urinish / kod |
| `POST /orders` | 5 / 24 soat (foydalanuvchi bo'yicha) |
| `POST /phones/send-otp` | 3 / kun |
| Umumiy (auth qilingan) | 120 / daqiqa |
| Umumiy (anonim) | 30 / daqiqa |

Javob sarlavhalari:
```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 117
X-RateLimit-Reset: 1755000900
Retry-After: 43
```

---

## 5. Auth

### `POST /auth/send-otp`

```json
{ "phone": "+998901234567" }
```

```json
{ "data": { "sent": true, "expiresIn": 120, "retryAfter": 60 } }
```

Xatolar: `INVALID_PHONE` · `OTP_TOO_SOON` · `RATE_LIMITED`

> Dev muhitida kod SMS o'rniga javobda qaytadi (`devCode`). Produksiyada **hech qachon**.

### `POST /auth/verify-otp`

```json
{ "phone": "+998901234567", "code": "4821", "deviceId": "a3f8…", "platform": "ios" }
```

```json
{
  "data": {
    "accessToken": "eyJhbGc…",
    "refreshToken": "eyJhbGc…",
    "isNewUser": true,
    "user": { "id": "…", "phone": "+998901234567", "role": "customer", "gender": null }
  }
}
```

`isNewUser: true` → ilova onboarding oqimiga (jins → face scan → o'lchamlar) yo'naltiradi.

Xatolar: `VALIDATION_ERROR` (kod noto'g'ri) · `NOT_FOUND` (kod topilmadi yoki muddati tugagan)

### `POST /auth/refresh`

```json
{ "refreshToken": "eyJhbGc…" }
```
```json
{ "data": { "accessToken": "eyJhbGc…", "refreshToken": "eyJhbGc…" } }
```

Refresh token **rotatsiya qilinadi** — eskisi darhol bekor bo'ladi. O'g'irlangan token qayta ishlatilsa, butun sessiya bekor qilinadi.

### `POST /auth/logout`
### `DELETE /auth/account`

Akkauntni o'chirish (App Store talabi). 30 kunlik kutish, keyin anonimlashtirish — buyurtma tarixi do'kon uchun saqlanadi, lekin shaxsiy ma'lumot o'chiriladi.

```json
{ "password": "…", "confirm": "DELETE" }
```

Parol tasdiqlanadi va barcha sessiyalar yopiladi.

**Rad etiladi (`INVALID_STATE`):** yakunlanmagan buyurtma bor · foydalanuvchi do'kon egasi.
Bu shart hujjatda yo'q edi, implementatsiyada qo'shildi (`auth/deletion.ts` dagi izoh).

### `GET /auth/account/deletion`

```json
{ "data": { "pending": true, "requestedAt": "…", "scheduledFor": "…" } }
```

### `POST /auth/account/restore`

30 kun ichida bekor qiladi. `POST /auth/login` ham avtomatik bekor qiladi.

---

## 6. Profil va avatar

### `GET /profile`

```json
{
  "data": {
    "id": "…", "phone": "+998901234567", "fullName": "Aziz Karimov",
    "gender": "male", "locale": "uz", "country": "UZ",
    "measurements": {
      "height": 180, "weight": 82, "chest": 98, "waist": 84,
      "hips": 96, "shoeSize": 42, "shoeSizeSystem": "EU"
    },
    "morphTargets": {
      "height": 0.62, "weight": 0.48, "shoulderWidth": 0.55,
      "waist": 0.40, "chest": 0.51, "hips": 0.44
    },
    "faceTextureUrl": "https://cdn.looksave.app/faces/…webp",
    "faceScanStatus": "ready",
    "trust": { "isRestricted": false, "openOrders": 1 }
  }
}
```

### `PATCH /profile`
```json
{ "fullName": "Aziz Karimov", "gender": "male", "locale": "uz" }
```

### `PATCH /profile/measurements`

```json
{ "height": 180, "weight": 82, "chest": 98, "waist": 84, "hips": 96, "shoeSize": 42 }
```

Server `morphTargets` ni **o'zi hisoblaydi** va qaytaradi:

```json
{
  "data": {
    "measurements": { "…": "…" },
    "morphTargets": { "height": 0.62, "weight": 0.48, "…": "…" }
  }
}
```

Hisoblash formulasi serverda — shunda ertaga model o'zgarsa, ilovani yangilash shart emas.

Validatsiya: `height` 120–220 sm · `weight` 30–200 kg · `shoeSize` 30–50 (EU)

### `POST /avatar/face-texture`

`multipart/form-data`, maydon `file` (WebP/JPEG, ≤ 2 MB).

Yuz **qurilmada** qayta ishlanadi (MediaPipe/ARKit) — serverga tayyor tekstura keladi.

```json
{ "data": { "faceTextureUrl": "https://cdn…", "faceScanStatus": "ready" } }
```

### `GET /avatar/config`

Try-On ekrani ochilganda birinchi chaqiriladi.

```json
{
  "data": {
    "bodyGlbUrl": "https://cdn.looksave.app/avatar/male-base-v3.glb",
    "skeletonVersion": "v3",
    "morphTargets": { "height": 0.62, "…": "…" },
    "faceTextureUrl": "https://cdn…",
    "animations": {
      "idle": "https://cdn…/idle.glb",
      "turn": "https://cdn…/turn.glb",
      "walk": "https://cdn…/walk.glb",
      "sit":  "https://cdn…/sit.glb"
    },
    "qualityHint": "medium"
  }
}
```

`qualityHint` — server qurilma modeli va `X-App-Version` asosida tavsiya beradi (`low` / `medium` / `high`). Ilova baribir FPS o'lchab o'zi tuzatadi.

---

## 7. Telefon raqamlari

### `GET /phones`
```json
{
  "data": [
    { "id": "…", "phone": "+998901234567", "isPrimary": true,  "verifiedAt": "2026-08-01T…" },
    { "id": "…", "phone": "+998939876543", "isPrimary": false, "verifiedAt": "2026-08-10T…" }
  ]
}
```

### `POST /phones/send-otp`
### `POST /phones/verify-otp`
### `DELETE /phones/:id`

Asosiy raqamni o'chirib bo'lmaydi (`INVALID_STATE`).

> **Nega bu kerak:** buyurtma faqat tasdiqlangan raqamdan beriladi (K-15). Foydalanuvchi boshqa raqam ishlatmoqchi bo'lsa, avval shu yerda tasdiqlaydi.

---

## 8. Do'konlar va geo

### `GET /stores/nearby` ⭐

```
GET /stores/nearby?lat=41.3111&lng=69.2797&radius=5000&category=shoes&limit=20
```

| Parametr | Majburiy | Standart |
|---|---|---|
| `lat`, `lng` | ✅ | — |
| `radius` | ❌ | 5000 m (maks 50000) |
| `category` | ❌ | — |
| `only3d` | ❌ | false |
| `openNow` | ❌ | false |
| `limit` | ❌ | 20 |

```json
{
  "data": [
    {
      "id": "…",
      "name": "Chilonzor Fashion",
      "logoUrl": "https://cdn…",
      "address": "Chilonzor tumani, Bunyodkor ko'chasi 12",
      "distanceM": 340,
      "rating": 4.6,
      "isOpen": true,
      "closesAt": "22:00",
      "productCount": 128,
      "product3dCount": 34,
      "currency": "UZS",
      "location": { "lat": 41.2756, "lng": 69.2041 },
      "deliveryEnabled": true,
      "pickupEnabled": true
    }
  ]
}
```

`isOpen` va `closesAt` — server do'konning vaqt zonasida hisoblaydi. Ilova buni o'zi hisoblamasin, Dubay va Toshkent farq qiladi.

### `GET /stores/map`

```
GET /stores/map?swLat=41.2&swLng=69.1&neLat=41.4&neLng=69.4&zoom=12
```

Zoom past bo'lsa klaster qaytadi:

```json
{
  "data": {
    "clusters": [ { "lat": 41.30, "lng": 69.24, "count": 47 } ],
    "markers":  [ { "id": "…", "lat": 41.2756, "lng": 69.2041, "name": "…", "logoUrl": "…" } ]
  }
}
```

### `GET /stores/:id`

```json
{
  "data": {
    "id": "…", "name": "…", "description": "…", "logoUrl": "…", "coverUrl": "…",
    "address": "…", "landmark": "…", "phone": "+998…",
    "location": { "lat": 41.2756, "lng": 69.2041 },
    "workingHours": [ { "day": 1, "open": "10:00", "close": "22:00" } ],
    "isOpen": true,
    "rating": 4.6, "reviewCount": 89,
    "avgResponseMin": 12,
    "delivery": {
      "enabled": true, "radiusM": 15000,
      "fee": "15000.00", "freeFrom": "300000.00"
    },
    "pickupEnabled": true,
    "currency": "UZS",
    "categories": [ { "id": "…", "slug": "shoes", "name": "Oyoq kiyim", "count": 42 } ]
  }
}
```

### `GET /stores/:id/products`

`/products` bilan bir xil filtrlar.

---

## 9. Katalog

### `GET /categories`

```json
{
  "data": [
    {
      "id": "…", "slug": "tops", "name": "Ustki kiyim", "icon": "shirt",
      "slot": "top", "sizeType": "clothing",
      "children": [
        { "id": "…", "slug": "tshirt", "name": "Futbolka", "slot": "top" },
        { "id": "…", "slug": "jacket", "name": "Kurtka",   "slot": "outer" }
      ]
    }
  ]
}
```

Nom `Accept-Language` bo'yicha tanlanadi. Bu javob **24 soat keshlanadi**.

### `GET /products`

```
GET /products?category=sneakers&gender=male&brand=nike&priceMin=100000
             &priceMax=900000&only3d=true&storeId=…&q=air&sort=popular&limit=20
```

`sort`: `newest` (standart) · `popular` · `priceAsc` · `priceDesc` · `nearest` (lat/lng bilan)

```json
{
  "data": [
    {
      "id": "…",
      "title": "Nike Air Max 90",
      "brand": { "id": "…", "name": "Nike" },
      "store": { "id": "…", "name": "Chilonzor Fashion", "distanceM": 340 },
      "price": "1250000.00",
      "oldPrice": "1500000.00",
      "currency": "UZS",
      "image": "https://cdn…/1.webp",
      "has3d": true,
      "isLimited": false,
      "availableSizes": ["40","41","42","43"]
    }
  ],
  "meta": { "nextCursor": "eyJhdCI6…", "hasMore": true }
}
```

### `GET /products/:id`

```json
{
  "data": {
    "id": "…", "title": "Nike Air Max 90", "description": "…",
    "category": { "id": "…", "slug": "sneakers", "name": "Krossovka" },
    "slot": "feet", "gender": "male",
    "brand": { "id": "…", "name": "Nike", "logoUrl": "…" },
    "store": {
      "id": "…", "name": "Chilonzor Fashion", "logoUrl": "…",
      "distanceM": 340, "isOpen": true, "avgResponseMin": 12
    },
    "price": "1250000.00", "currency": "UZS",
    "images": ["https://cdn…/1.webp","https://cdn…/2.webp"],
    "variants": [
      {
        "id": "var-1",
        "colorHex": "#1a1a1a", "colorName": "Qora",
        "images": ["https://cdn…/black-1.webp"],
        "priceDelta": "0.00",
        "sizes": [
          { "size": "41", "available": true,  "stock": 3 },
          { "size": "42", "available": true,  "stock": 7 },
          { "size": "43", "available": false, "stock": 0 }
        ],
        "asset3d": {
          "status": "ready",
          "glbUrl": "https://cdn…/var-1.glb",
          "lodUrls": { "lod0": "…", "lod1": "…", "lod2": "…" },
          "fileSizeBytes": 1180000,
          "hideBodyParts": [],
          "hasMorphs": true
        }
      }
    ],
    "isFavorite": false,
    "sizeChart": { "type": "shoes", "system": "EU" }
  }
}
```

`stock` aniq son sifatida qaytadi — "faqat 3 ta qoldi" ko'rsatish uchun. Agar bu raqobatchilarga ma'lumot bersin deb istamasangiz, 5 dan yuqorisini `"5+"` qilib bering.

---

## 10. Try-On

### `GET /tryon/slots`

```json
{
  "data": [
    { "slot": "head",   "label": "Bosh kiyim",  "count": 24 },
    { "slot": "face",   "label": "Ko'zoynak",   "count": 11 },
    { "slot": "top",    "label": "Ustki kiyim", "count": 156 },
    { "slot": "outer",  "label": "Kurtka",      "count": 43 },
    { "slot": "bottom", "label": "Pastki kiyim","count": 98 },
    { "slot": "feet",   "label": "Oyoq kiyim",  "count": 87 },
    { "slot": "wrist",  "label": "Soat",        "count": 19 }
  ]
}
```

### `GET /tryon/slot/:slot` ⭐

Svayp uchun asosiy endpoint.

```
GET /tryon/slot/feet?gender=male&storeId=…&lat=…&lng=…&radius=5000&limit=50
```

```json
{
  "data": [
    {
      "variantId": "var-1",
      "productId": "prod-1",
      "title": "Nike Air Max 90",
      "colorHex": "#1a1a1a",
      "price": "1250000.00",
      "currency": "UZS",
      "thumbnail": "https://cdn…/thumb.webp",
      "glbUrl": "https://cdn…/var-1.glb",
      "lodUrls": { "lod0": "…", "lod1": "…", "lod2": "…" },
      "fileSizeBytes": 1180000,
      "hideBodyParts": [],
      "hasMorphs": true,
      "storeId": "…",
      "storeName": "Chilonzor Fashion"
    }
  ],
  "meta": { "nextCursor": "…", "hasMore": true }
}
```

**Muhim:** ilova bu ro'yxatni **butunlay xotirada saqlaydi** va svayp qilganda tarmoqqa chiqmaydi. Faqat GLB fayllari yuklanadi (kesh orqali). Har svaypda API chaqirsangiz, tajriba buziladi.

### `POST /tryon/event`

Analitika. Fon rejimda, javobini kutmasdan.

```json
{ "variantId": "var-1", "durationMs": 4200 }
```

### `GET /looks` · `POST /looks` · `DELETE /looks/:id`

```json
{
  "name": "Kechki kiyim",
  "items": [
    { "slot": "top",    "variantId": "…", "size": "M" },
    { "slot": "bottom", "variantId": "…", "size": "32" },
    { "slot": "feet",   "variantId": "…", "size": "42" }
  ],
  "thumbnailBase64": "data:image/webp;base64,…"
}
```

Thumbnail — 3D sahnadan olingan snapshot, ilova o'zi tayyorlaydi va serverga yuboradi.

---

## 11. Savat

### `GET /cart`

```json
{
  "data": {
    "stores": [
      {
        "store": { "id": "…", "name": "Chilonzor Fashion", "currency": "UZS" },
        "items": [
          {
            "id": "…", "variantId": "…", "productId": "…",
            "title": "Nike Air Max 90", "colorName": "Qora",
            "image": "https://cdn…", "size": "42", "qty": 1,
            "unitPrice": "1250000.00", "totalPrice": "1250000.00",
            "available": true, "stock": 7
          }
        ],
        "subtotal": "1250000.00",
        "deliveryFee": "15000.00",
        "total": "1265000.00"
      }
    ],
    "itemCount": 1
  }
}
```

**Savat do'konlar bo'yicha bo'linadi.** Har bir do'kon — alohida buyurtma, chunki har biri o'zi tasdiqlaydi va o'zi yetkazadi. Bu MVP'da muhim: bitta buyurtmada ikki do'kon bo'lsa, biri tasdiqlab, biri rad etsa, holat chalkashadi.

### `POST /cart/items`
```json
{ "variantId": "…", "size": "42", "qty": 1 }
```
Xatolar: `OUT_OF_STOCK` · `NOT_FOUND`

### `PATCH /cart/items/:id` · `DELETE /cart/items/:id` · `DELETE /cart`

---

## 12. Buyurtmalar

### `POST /orders` ⭐

Tizimning eng muhim endpointi. `Idempotency-Key` sarlavhasi majburiy — tarmoq uzilib qayta yuborilsa, ikkinchi buyurtma yaratilmaydi.

```json
{
  "storeId": "…",
  "deliveryType": "delivery",
  "contactName": "Aziz Karimov",
  "contactPhone": "+998901234567",
  "address": {
    "text": "Chilonzor 9-kvartal, 24-uy, 12-xonadon",
    "lat": 41.2801,
    "lng": 69.2043,
    "landmark": "Mehnat metrosi yonida"
  },
  "note": "Kechqurun 18:00 dan keyin qo'ng'iroq qiling",
  "items": [ { "variantId": "…", "size": "42", "qty": 1 } ]
}
```

**Server tekshiruvlari (tartib bo'yicha):**

| # | Tekshiruv | Xato |
|---|---|---|
| 1 | Token | `401 UNAUTHORIZED` |
| 2 | Maydonlar formati | `422 VALIDATION_ERROR` |
| 3 | `contactPhone` tasdiqlanganmi | `403 PHONE_NOT_VERIFIED` |
| 4 | Qora ro'yxat (do'kon + global) | `403 BLOCKED` |
| 5 | `user_trust.is_restricted` | `403 RESTRICTED` |
| 6 | Ochiq buyurtma < 3, kunlik < 5 | `429 LIMIT_REACHED` |
| 7 | `delivery` bo'lsa lat/lng bor va radiusda | `422 OUT_OF_RANGE` |
| 8 | Do'kon `active`, mahsulot mavjud | `409 OUT_OF_STOCK` |

```json
{
  "data": {
    "id": "…",
    "orderNumber": "LS-260812-0043",
    "status": "new",
    "expiresAt": "2026-08-13T14:30:00.000Z",
    "store": { "id": "…", "name": "Chilonzor Fashion", "phone": "+998…", "avgResponseMin": 12 },
    "total": "1265000.00",
    "currency": "UZS",
    "paymentMethod": "cash",
    "paymentNote": "To'lov do'konda yoki yetkazib berilganda"
  }
}
```

> **UX qoidasi:** ilovada hech qayerda "To'lash", "Sotib olish", "Buy now" yozilmaydi. Faqat **"Buyurtma yuborish"**. Mijoz pul yechilishini kutmasligi kerak (K-10).

### `GET /orders`

```
GET /orders?status=active&limit=20
```
`status`: `active` (new/seen/confirmed/ready) · `completed` · `cancelled` · `all`

### `GET /orders/:id`

```json
{
  "data": {
    "id": "…", "orderNumber": "LS-260812-0043", "status": "confirmed",
    "statusLabel": "Do'kon tasdiqladi",
    "createdAt": "2026-08-12T14:30:00.000Z",
    "expiresAt": "2026-08-13T14:30:00.000Z",
    "deliveryType": "delivery",
    "contactName": "Aziz Karimov", "contactPhone": "+998901234567",
    "address": { "text": "…", "lat": 41.2801, "lng": 69.2043 },
    "store": { "id": "…", "name": "…", "phone": "+998…", "location": { "lat": …, "lng": … } },
    "items": [
      {
        "title": "Nike Air Max 90", "colorName": "Qora", "size": "42",
        "qty": 1, "unitPrice": "1250000.00", "image": "https://cdn…"
      }
    ],
    "subtotal": "1250000.00", "deliveryFee": "15000.00", "total": "1265000.00",
    "currency": "UZS",
    "paymentMethod": "cash", "paymentStatus": "unpaid",
    "canCancel": true
  }
}
```

`items[].title` va `image` — `order_items.snapshot` dan. Mahsulot keyin o'chirilsa yoki o'zgarsa ham buyurtma to'g'ri ko'rinadi.

### `GET /orders/:id/events`

```json
{
  "data": [
    { "toStatus": "new",       "actorType": "customer", "createdAt": "…14:30:00Z" },
    { "toStatus": "seen",      "actorType": "store", "channel": "telegram", "createdAt": "…14:41:00Z" },
    { "toStatus": "confirmed", "actorType": "store", "channel": "telegram", "createdAt": "…14:42:00Z" }
  ]
}
```

### `POST /orders/:id/cancel`

```json
{ "reason": "Fikrimdan qaytdim" }
```

Faqat `new`, `seen`, `confirmed` statuslarida. `ready` dan keyin — `409 INVALID_STATE`, do'kon bilan bog'lanish kerak.

---

## 13. Do'kon paneli

Barcha endpointlar `store_owner` yoki `staff` rolini va JWT dagi `storeIds` mosligini talab qiladi.

### `GET /store/dashboard`

```json
{
  "data": {
    "newOrders": 3,
    "inProgress": 7,
    "completedMonth": 42,
    "revenueMonth": "18400000.00",
    "currency": "UZS",
    "avgResponseMin": 12,
    "confirmRate": 0.87,
    "productCount": 128,
    "product3dCount": 34,
    "pending3d": 5,
    "topProducts": [ { "id": "…", "title": "…", "orders": 12, "tryons": 340 } ]
  }
}
```

### `GET /store/orders`

```
GET /store/orders?status=new&limit=20
```

```json
{
  "data": [
    {
      "id": "…", "orderNumber": "LS-260812-0043", "status": "new",
      "createdAt": "…", "expiresAt": "…", "minutesLeft": 1334,
      "customer": { "name": "Aziz Karimov", "phone": "+998901234567" },
      "deliveryType": "delivery",
      "address": { "text": "…", "lat": …, "lng": …, "landmark": "…" },
      "items": [ { "title": "Nike Air Max 90", "size": "42", "qty": 1, "unitPrice": "…" } ],
      "total": "1265000.00", "currency": "UZS",
      "note": "Kechqurun 18:00 dan keyin qo'ng'iroq qiling",
      "customerTrust": { "completedOrders": 4, "cancelledOrders": 0 }
    }
  ]
}
```

`customerTrust` — sotuvchiga qaror qabul qilishga yordam beradi. Yangi mijoz (0 buyurtma) va 4 marta xarid qilgan mijoz farq qiladi.

### Status o'zgartirish

| Endpoint | Dan → Ga | Body |
|---|---|---|
| `POST /store/orders/:id/seen` | new → seen | — |
| `POST /store/orders/:id/confirm` | new/seen → confirmed | `{ note? }` |
| `POST /store/orders/:id/reject` | new/seen → rejected | `{ reason, blockPhone? }` |
| `POST /store/orders/:id/ready` | confirmed → ready | — |
| `POST /store/orders/:id/complete` | ready → completed | `{ paymentMethod }` |
| `POST /store/orders/:id/report-noshow` | ready → cancelled | `{ blockPhone? }` |

**`/reject`:**
```json
{
  "reason": "fake_order",
  "comment": "Raqam ishlamayapti",
  "blockPhone": true
}
```
`reason`: `out_of_stock` · `size_unavailable` · `price_changed` · `fake_order` · `other`

`blockPhone: true` → raqam shu do'kon uchun bloklanadi. 3 xil do'kon bloklasa → global blok (bazada trigger avtomatik).

### `GET /store/blocklist` · `POST /store/blocklist` · `DELETE /store/blocklist/:id`

### Mahsulotlar

```
GET    /store/products?status=&category=&q=
POST   /store/products
PATCH  /store/products/:id
DELETE /store/products/:id          → archived
POST   /store/products/:id/variants
PATCH  /store/variants/:id/stock    { sizes: [{ size, stock }] }
POST   /store/products/:id/request-3d
```

**`POST /store/products`:**
```json
{
  "title": "Nike Air Max 90",
  "description": "…",
  "categoryId": "…",
  "brandId": "…",
  "gender": "male",
  "basePrice": "1250000.00",
  "images": ["https://cdn…/1.webp"],
  "variants": [
    {
      "colorHex": "#1a1a1a",
      "colorName": { "uz": "Qora", "en": "Black" },
      "sizes": [ { "size": "41", "stock": 3 }, { "size": "42", "stock": 7 } ]
    }
  ]
}
```

### Rasm yuklash

```
POST /store/uploads/presign
{ "fileName": "shoe.webp", "contentType": "image/webp", "purpose": "product" }
```
```json
{
  "data": {
    "uploadUrl": "https://…r2.cloudflarestorage.com/…?X-Amz-Signature=…",
    "publicUrl": "https://cdn.looksave.app/products/…webp",
    "expiresIn": 900
  }
}
```

Fayl **to'g'ridan-to'g'ri R2 ga** yuklanadi, serverdan o'tmaydi. VPS kanali bo'shab qoladi.

### `GET /store/telegram/link`

```json
{
  "data": {
    "linkCode": "LS-A3F8K2",
    "botUrl": "https://t.me/LookSaveBot?start=LS-A3F8K2",
    "isLinked": false
  }
}
```

Do'kon egasi havolani bosadi → bot `chat_id` ni saqlaydi → buyurtmalar Telegramga kela boshlaydi.

### `GET /store/analytics` · `GET /store/invoices`

---

## 14. Realtime (do'kon paneli)

Yangi buyurtma panelda **darhol** ko'rinishi kerak. Polling o'rniga SSE:

```
GET /store/events/stream
Accept: text/event-stream
```

```
event: order.new
data: {"orderId":"…","orderNumber":"LS-260812-0043","total":"1265000.00"}

event: order.updated
data: {"orderId":"…","status":"confirmed"}

event: ping
data: {}
```

SSE — WebSocket'dan sodda, faqat serverdan mijozga kerak, Caddy orqali muammosiz o'tadi. `ping` har 30 soniyada — proxy ulanishni uzmasligi uchun.

---

## 14b. Do'kon arizasi

> **Hujjatga qo'shimcha.** Bu bo'lim boshida yo'q edi: `pending` status va
> admin tasdiqlash tasvirlangan, lekin arizani yaratadigan endpoint
> ko'rsatilmagan edi. Do'konlar SQL bilan qo'lda qo'shilardi.

```
POST /stores/apply
GET  /stores/my-application
```

`POST /stores/apply` — kirgan foydalanuvchi ariza beradi:

```json
{
  "name": "Chilonzor Fashion",
  "phone": "+998901234567",
  "address": "Chilonzor 19, 5-uy",
  "city": "Toshkent",
  "country": "UZ",
  "location": { "lat": 41.311081, "lng": 69.279737 },
  "currency": "UZS",
  "deliveryEnabled": true,
  "pickupEnabled": true
}
```

Natija: `stores` da `status = 'pending'` qatori, `store_members` da `owner`,
foydalanuvchi roli `customer` → `store_owner`.

**Qoidalar:** bir foydalanuvchi — bitta ariza (`ALREADY_EXISTS`) · rad etilgan
ariza tuzatilib qayta yuboriladi (yangi qator yaratilmaydi) · sutkasiga 3 marta.

`slug` nomdan avtomatik: kirill transliteratsiya qilinadi, band bo'lsa raqam
qo'shiladi. Lotin harfi chiqmasa (arabcha nom) zaxira `store-xxxxxx`.

---

## 15. Admin

```
GET    /admin/stores?status=pending
POST   /admin/stores/:id/approve
POST   /admin/stores/:id/reject         { reason }
POST   /admin/stores/:id/suspend
GET    /admin/products/moderation
POST   /admin/products/:id/approve
GET    /admin/orders?status=&storeId=&from=&to=
GET    /admin/3d-queue?status=queued
PATCH  /admin/3d-queue/:id              { status, glbUrl, lodUrls, polyCount, qaResult }
GET    /admin/blocklist
DELETE /admin/blocklist/:id             → xato blokni bekor qilish
GET    /admin/users?restricted=true
POST   /admin/users/:id/unrestrict
GET    /admin/analytics
```

---

## 16. Telegram webhook

```
POST /telegram/webhook
```

Telegram tugma bosilishini shu yerga yuboradi:

```json
{
  "callback_query": {
    "id": "…",
    "from": { "id": 123456789 },
    "data": "order:confirm:<order-uuid>"
  }
}
```

**Server:**
1. `X-Telegram-Bot-Api-Secret-Token` sarlavhasini tekshiradi
2. `from.id` ni `stores.telegram_chat_id` bilan solishtiradi
3. `SET LOCAL app.actor_type='store'; app.channel='telegram'`
4. Statusni o'zgartiradi
5. Telegram xabarini tahrirlaydi ("✅ Tasdiqlandi")
6. Mijozga push yuboradi

`callback_data` formati: `order:<action>:<uuid>` — `action`: `seen` · `confirm` · `reject`

---

## 17. Umumiy validatsiya sxemalari

`packages/validation` — mobil ilova va server **bir xil** Zod sxemalarini ishlatadi. Shunda qoidalar ikki joyda ajralib ketmaydi.

```ts
import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const phoneSchema = z.string().superRefine((val, ctx) => {
  const p = parsePhoneNumberFromString(val);
  if (!p?.isValid()) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_FORMAT' });
    return;
  }
  if (p.getType() !== 'MOBILE') {
    ctx.addIssue({ code: 'custom', message: 'NOT_MOBILE' });
  }
});

export const addressSchema = z.object({
  text:     z.string().min(10, 'TOO_SHORT'),
  lat:      z.number().min(-90).max(90),
  lng:      z.number().min(-180).max(180),
  landmark: z.string().max(200).optional(),
});

export const createOrderSchema = z.object({
  storeId:      z.string().uuid(),
  deliveryType: z.enum(['delivery', 'pickup']),
  contactName:  z.string().min(2, 'TOO_SHORT').max(80)
                 .regex(/^[\p{L}\s'-]+$/u, 'INVALID_CHARS'),
  contactPhone: phoneSchema,
  address:      addressSchema.optional(),
  note:         z.string().max(500).optional(),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    size:      z.string().min(1).max(10),
    qty:       z.number().int().min(1).max(10),
  })).min(1).max(20),
}).refine(
  d => d.deliveryType === 'pickup' || d.address !== undefined,
  { path: ['address'], message: 'REQUIRED' }
);

export const measurementsSchema = z.object({
  height:    z.number().min(120).max(220),
  weight:    z.number().min(30).max(200),
  chest:     z.number().min(60).max(160).optional(),
  waist:     z.number().min(50).max(160).optional(),
  hips:      z.number().min(60).max(160).optional(),
  shoeSize:  z.number().min(30).max(50).optional(),
});
```

**Ilovada:** shu sxema bilan tugmani `disabled` qilinadi.
**Serverda:** shu sxema bilan `422 VALIDATION_ERROR` qaytariladi.

Ilovadagi tekshiruv — qulaylik uchun. **Serverdagisi — himoya.** Ilova tekshiruvi hech qachon yagona himoya bo'lmaydi.

---

## 18. Versiyalash

URL'da: `/v1/…`. Buzuvchi o'zgarish bo'lsa `/v2` ochiladi, `/v1` kamida 6 oy ishlaydi.

Mobil ilova eskirgan bo'lsa:

```json
{
  "error": {
    "code": "APP_UPDATE_REQUIRED",
    "message": "Ilovani yangilang",
    "details": { "minVersion": "1.2.0", "storeUrl": "https://apps.apple.com/…" }
  }
}
```

Server `X-App-Version` sarlavhasini tekshiradi. 3D formati o'zgarganda bu kerak bo'ladi — eski ilova yangi GLB'ni ocholmaydi.
