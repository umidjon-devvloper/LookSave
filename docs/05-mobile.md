# 05 — Mobil ilova

**Stack:** Expo SDK 52 · React Native · expo-router · NativeWind · three.js
**Bog'liq:** [03-api-spec.md](./03-api-spec.md) · [04-3d-pipeline.md](./04-3d-pipeline.md)

---

## 1. Sozlash

### Expo Go — kundalik ish uchun yetarli

⚠️ Bu bo'lim avval "Expo Go yaramaydi, development build majburiy" der edi.
**Amalda tekshirildi (2026-08-14): Expo Go ishlaydi** — ilova iOS simulyatorida
to'liq ochildi. Sabab: loyihadagi barcha native modullar (`expo-gl`,
`react-native-maps`, `expo-location`, `expo-secure-store`, `reanimated`)
Expo Go ichiga allaqachon kirgan, `three` / `expo-three` / `@react-three/fiber`
esa sof JavaScript.

```bash
npm start          # = expo start --go, keyin `i` bosiladi
```

Development build faqat quyidagilar uchun kerak:

- **Push bildirishnomalar** — `expo-notifications` Expo Go'da to'liq ishlamaydi
- Kelajakda Expo Go tarkibida yo'q native modul qo'shilsa

Kerak bo'lganda (`eas.json` da `development-simulator` profili tayyor):

```bash
npx eas-cli build --profile development-simulator --platform ios
npm run start:dev-client
```

```bash
npx create-expo-app looksave-mobile --template
cd looksave-mobile

npx expo install expo-dev-client expo-gl expo-three three \
  @react-three/fiber @react-three/drei \
  expo-location expo-camera expo-file-system expo-secure-store \
  expo-notifications react-native-maps \
  react-native-gesture-handler react-native-reanimated \
  react-native-safe-area-context react-native-screens

npm i @tanstack/react-query zustand nativewind zod \
  libphonenumber-js date-fns

# Development build
eas build --profile development --platform android
```

Bundan keyin `npx expo start --dev-client`.

### `app.json` muhim qismlari

```json
{
  "expo": {
    "name": "LookSave",
    "slug": "looksave",
    "scheme": "looksave",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "ios": {
      "bundleIdentifier": "app.looksave.mobile",
      "config": { "googleMapsApiKey": "$GOOGLE_MAPS_IOS_KEY" },
      "infoPlist": {
        "NSCameraUsageDescription": "Avatar yaratish uchun kameraga ruxsat kerak",
        "NSLocationWhenInUseUsageDescription": "Yaqin atrofdagi do'konlarni ko'rsatish uchun"
      }
    },
    "android": {
      "package": "app.looksave.mobile",
      "config": { "googleMaps": { "apiKey": "$GOOGLE_MAPS_ANDROID_KEY" } },
      "permissions": ["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "…" }],
      ["expo-camera", { "cameraPermission": "…" }]
    ]
  }
}
```

---

## 2. Papka tuzilmasi

```
apps/mobile/
├── app/                          # expo-router (fayl = ekran)
│   ├── _layout.tsx               # root: providerlar, auth gate
│   ├── index.tsx                 # splash / redirect
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── onboarding.tsx
│   │   ├── phone.tsx
│   │   ├── otp.tsx
│   │   ├── gender.tsx
│   │   ├── face-scan.tsx
│   │   └── measurements.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx           # 5 tab
│   │   ├── index.tsx             # Home
│   │   ├── tryon.tsx
│   │   ├── stores.tsx
│   │   ├── cart.tsx
│   │   └── profile.tsx
│   ├── store/[id].tsx
│   ├── product/[id].tsx
│   ├── catalog.tsx
│   ├── checkout.tsx
│   ├── order/[id].tsx
│   ├── orders.tsx
│   ├── looks.tsx
│   └── settings/
│       ├── index.tsx
│       ├── measurements.tsx
│       ├── phones.tsx
│       └── language.tsx
│
├── src/
│   ├── three/                    # 3D dvigatel (04-3d-pipeline.md)
│   │   ├── AvatarScene.tsx
│   │   ├── AvatarRig.ts
│   │   ├── SlotManager.ts
│   │   ├── AssetLoader.ts
│   │   ├── RaycastHandler.ts
│   │   ├── AnimationController.ts
│   │   └── PerformanceMonitor.ts
│   ├── api/
│   │   ├── client.ts             # fetch wrapper + interceptor
│   │   ├── auth.ts  profile.ts  stores.ts  products.ts
│   │   ├── tryon.ts cart.ts     orders.ts
│   │   └── queryKeys.ts
│   ├── store/                    # Zustand
│   │   ├── authStore.ts
│   │   ├── tryonStore.ts
│   │   ├── locationStore.ts
│   │   └── settingsStore.ts
│   ├── components/
│   │   ├── ui/                   # Button, Input, Sheet, Skeleton…
│   │   ├── product/  store/  order/  tryon/
│   ├── hooks/
│   ├── i18n/                     # uz.json ru.json en.json ar.json
│   ├── theme/                    # tokens.ts
│   └── utils/
└── assets/
```

---

## 3. State boshqaruvi

Ikki tizim, aniq chegara bilan:

| Tizim | Nima uchun |
|---|---|
| **TanStack Query** | Serverdan keladigan hamma narsa (do'konlar, mahsulotlar, buyurtmalar) |
| **Zustand** | Faqat mijoz holati (token, joriy 3D holat, sozlamalar) |

Server ma'lumotini Zustand'ga ko'chirmang — kesh, refetch, invalidation muammosi boshlanadi.

### `authStore.ts`

```ts
interface AuthState {
  accessToken: string | null;
  user: User | null;
  isHydrated: boolean;

  setSession: (t: Tokens, u: User) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;   // ilova ochilganda SecureStore'dan
}
```

`refreshToken` faqat `expo-secure-store` da. `accessToken` — xotirada, diskka yozilmaydi.

### `tryonStore.ts`

```ts
interface TryonState {
  activeSlot: Slot;                        // 'feet'
  equipped: Record<Slot, EquippedItem>;    // { top: {...}, feet: {...} }
  morphs: MorphTargets;
  quality: 'low' | 'medium' | 'high';
  animation: 'idle' | 'turn' | 'walk' | 'sit';
  isLoading: boolean;

  setActiveSlot: (s: Slot) => void;
  equip: (slot: Slot, item: TryonItem) => Promise<void>;
  unequip: (slot: Slot) => void;
  setMorphs: (m: Partial<MorphTargets>) => void;
  reset: () => void;
}
```

---

## 4. Navigatsiya

```
_layout (root)
├─ token yo'q → (auth)
└─ token bor → profil to'liqmi?
              ├─ yo'q → (auth)/gender yoki /measurements
              └─ ha  → (tabs)

(tabs)
├─ Home       🏠
├─ Try-On     ✨   ← markaziy, kattaroq tugma
├─ Do'konlar  📍
├─ Savat      🛍   ← badge: soni
└─ Profil     👤
```

### Deep link

```
looksave://product/{id}
looksave://store/{id}
looksave://order/{id}
looksave://tryon?variantId={id}
```

Push bosilganda buyurtma sahifasi ochiladi.

---

## 5. Dizayn tokenlari

Deck asosida — qora fon, binafsha aksent.

```ts
// src/theme/tokens.ts
export const colors = {
  bg:        '#0A0A0F',
  surface:   '#14141C',
  surface2:  '#1E1E2A',
  border:    '#2A2A3A',

  primary:   '#8B5CF6',
  primaryDim:'#6D3FD9',
  accent:    '#C084FC',

  text:      '#FFFFFF',
  textMuted: '#9CA3AF',
  textDim:   '#6B7280',

  success:   '#22C55E',
  warning:   '#F59E0B',
  danger:    '#EF4444',
} as const;

export const radius  = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const text = {
  h1:    { fontSize: 32, fontWeight: '700', lineHeight: 40 },
  h2:    { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  h3:    { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  body:  { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  tiny:  { fontSize: 11, fontWeight: '500', lineHeight: 14 },
} as const;
```

**Qoida:** har bir ekranda uchta holat majburiy — `loading` (skeleton), `empty` (rasm + matn + amal), `error` (sabab + "Qayta urinish"). Bo'sh oq ekran hech qachon ko'rinmaydi.

---

## 6. Ekranlar

### 6.1 Onboarding

3 slayd, `skip` mavjud.

| # | Sarlavha | Matn |
|---|---|---|
| 1 | Yaqiningizdagi do'konlar | Atrofingizdagi kiyim do'konlarini bir joyda toping |
| 2 | Kiyib ko'ring | Avatarga kiydiring, o'lchamingizda ko'ring |
| 3 | Buyurtma bering | Do'konga to'g'ridan-to'g'ri so'rov yuboring |

Faqat bir marta ko'rsatiladi (`settingsStore.onboardingSeen`).

---

### 6.2 Telefon → OTP

**`phone.tsx`**

- Mamlakat tanlash: 🇺🇿 +998 / 🇦🇪 +971 (GPS bo'yicha avtomatik)
- Maska: `90 123 45 67`
- Real vaqtda `libphonenumber-js` bilan tekshirish
- Tugma faqat to'g'ri raqamda faol

**`otp.tsx`**

- 4 katak, avtomatik fokus
- SMS avtomatik o'qish (Android: `autoComplete="sms-otp"`)
- 60 soniyalik taymer, keyin "Qayta yuborish"
- 5 marta xato → 15 daqiqa blok

**Chekka holatlar:**

| Holat | Xatti-harakat |
|---|---|
| SMS kelmadi | 60 s dan keyin qayta yuborish |
| Kod muddati tugadi | "Kod eskirdi, qayta yuboring" |
| `RATE_LIMITED` | Qolgan vaqtni ko'rsatish |
| Tarmoq yo'q | "Internet yo'q" + qayta urinish |

---

### 6.3 Jins tanlash

Ikki katta karta: 👨 Erkak / 👩 Ayol. Butun katalogni filtrlaydi.

Profil sozlamalarida keyin o'zgartirilishi mumkin, lekin ogohlantirish bilan: "Avatar va tanlangan komplektlar qayta yaratiladi."

---

### 6.4 Face Scan

**Muhim:** to'liq **qurilmada** ishlaydi, serverga faqat tayyor tekstura ketadi.

```
Ko'rsatma ekrani
   • Yorug' joyda turing
   • Ko'zoynak va shlyapani yeching
   • To'g'ridan qarang
        ↓
Kamera (old) + yuz konturi overlay
   • MediaPipe Face Mesh real vaqtda
   • Yuz konturga tushganda konturi yashil
   • Avtomatik suratga olish (3 s hisob)
        ↓
Qurilmada: crop → UV mapping → WebP
        ↓
POST /avatar/face-texture
        ↓
Natija ko'rsatiladi:  [ Qayta ]  [ Davom etish ]
```

**"O'tkazib yuborish"** doim mavjud — standart avatar bilan davom etadi. Bu muhim: face scan majburiy bo'lsa, foydalanuvchilarning bir qismi shu yerda ilovani tashlab ketadi.

| Xato | Xabar |
|---|---|
| Kamera ruxsati yo'q | "Sozlamalarda ruxsat bering" + tugma |
| Yuz topilmadi | "Yuzingiz konturga tushsin" |
| Yorug'lik kam | "Yorug'roq joyga o'ting" |
| Bir nechta yuz | "Kadrda faqat siz bo'ling" |

---

### 6.5 O'lchamlar

**Majburiy:** bo'y (120-220 sm), vazn (30-200 kg)
**Ixtiyoriy:** ko'krak, bel, son, oyoq razmeri

Slider + raqam kiritish. Har o'zgarishda **avatar preview real vaqtda o'zgaradi** — bu eng yaxshi UX momenti, foydalanuvchi darhol natijani ko'radi.

Server `morphTargets` ni hisoblab qaytaradi (03-api-spec.md, 6-bo'lim).

---

### 6.6 Home

```
┌─────────────────────────────────┐
│  📍 Toshkent, Chilonzor    🔔   │
├─────────────────────────────────┤
│  [ Qidirish… ]                  │
├─────────────────────────────────┤
│  ✨ AI Designer                 │  ← Faza 3 da faol
├─────────────────────────────────┤
│  Yaqin do'konlar     Barchasi › │
│  ┌────┐ ┌────┐ ┌────┐           │
│  │340m│ │1.2k│ │2.1k│           │
│  └────┘ └────┘ └────┘           │
├─────────────────────────────────┤
│  Kategoriyalar                  │
│  👕 👖 👟 🧢 🕶                  │
├─────────────────────────────────┤
│  Brendlar            Barchasi › │
├─────────────────────────────────┤
│  Trend                          │
│  ┌──────┐ ┌──────┐              │
│  │ ✨3D │ │      │              │  ← 3D bor belgisi
│  └──────┘ └──────┘              │
└─────────────────────────────────┘
```

**Geolokatsiya yo'q bo'lsa:** yaqin do'konlar o'rniga "Joylashuvni yoqing" kartasi + tugma. Qolgan bo'limlar ishlayveradi — ilova bloklanmaydi.

---

### 6.7 Do'konlar

Ikki rejim, yuqorida almashtirgich: **Xarita** / **Ro'yxat**

**Xarita:**
- `react-native-maps`, `PROVIDER_GOOGLE`
- Do'kon marker'lari (logo bilan), klasterlash
- Marker bosilganda pastdan karta chiqadi
- "Meni topish" tugmasi

**Ro'yxat:**
- Masofa bo'yicha saralangan
- Har karta: logo, nom, masofa, reyting, "Ochiq/Yopiq", mahsulot soni, 3D soni

**Filtrlar (bottom sheet):** radius (1/3/5/10/20 km) · kategoriya · faqat ochiq · faqat 3D bor · yetkazib berish bor

---

### 6.8 Do'kon sahifasi

```
[ Cover rasm ]
Chilonzor Fashion        ⭐ 4.6 (89)
📍 Chilonzor 12-uy · 340 m
🕐 Ochiq · 22:00 gacha
⚡ O'rtacha javob: 12 daqiqa

[ 📞 Qo'ng'iroq ]  [ 🗺 Yo'nalish ]

──────────────────────────────
Kategoriyalar: Hammasi | 👟 42 | 👕 31
──────────────────────────────
[ Mahsulotlar to'ri ]
```

**"Yo'nalish"** — deep-link, telefonning o'z xaritasi ochiladi. API chaqiruvi yo'q (K-05).

**"O'rtacha javob: 12 daqiqa"** — bu mijozga ishonch beradi va do'konlarni tez javob berishga undaydi.

---

### 6.9 Mahsulot sahifasi

```
[ Rasm karuseli ]              ♡
Nike Air Max 90
Chilonzor Fashion · 340 m
1 250 000 so'm   ~~1 500 000~~

Rang:  ● ○ ○ ○
O'lcham:  40  41  [42]  43̶

┌──────────────────────────────┐
│  ✨ Avatarda kiyib ko'rish   │  ← has3d bo'lsa
└──────────────────────────────┘
[ Savatga qo'shish ]

Tavsif · O'lcham jadvali · Do'kon haqida
```

- Mavjud bo'lmagan o'lcham — chizilgan, bosilmaydi
- "3 ta qoldi" — `stock ≤ 5` bo'lsa
- 3D yo'q bo'lsa "Kiyib ko'rish" tugmasi ko'rinmaydi (kulrang emas — umuman yo'q)

---

### 6.10 Try-On ekrani ⭐

Ilovaning yuragi. Alohida bo'limda batafsil (7-bo'lim).

```
┌─────────────────────────────────┐
│  ←              Nike Air Max 90 │
│                       1 250 000 │
│                                 │
│           ┌─────────┐           │
│           │         │           │
│    🔄     │ AVATAR  │    ⚙️     │
│    ➕     │   3D    │    ↺      │
│           │         │           │
│           └─────────┘           │
│                                 │
│  ← svayp: oyoq kiyim almashadi  │
├─────────────────────────────────┤
│  🧢 👕 🧥 👖 👟 ⌚              │  ← slot tanlash
│           ●                     │
├─────────────────────────────────┤
│  ┌──┐┌──┐┌──┐┌──┐┌──┐          │  ← joriy slot mahsulotlari
│  │  ││✓ ││  ││  ││  │          │
│  └──┘└──┘└──┘└──┘└──┘          │
├─────────────────────────────────┤
│  [ 💾 Saqlash ]  [ 🛍 Savatga ] │
└─────────────────────────────────┘
```

Chap panel: 🔄 aylantirish · ➕ zoom · ↺ reset
O'ng panel: ⚙️ sozlamalar (sifat, animatsiya, o'lchamlar)

---

### 6.11 Savat

**Do'konlar bo'yicha bo'lingan** (03-api-spec.md, 11-bo'lim):

```
┌─────────────────────────────────┐
│ 🏪 Chilonzor Fashion            │
│  ┌────┐ Nike Air Max 90         │
│  │    │ Qora · 42 · 1 dona      │
│  └────┘ 1 250 000    [-] 1 [+]  │
│                                 │
│  Mahsulotlar     1 250 000      │
│  Yetkazib berish    15 000      │
│  Jami            1 265 000      │
│  [ Buyurtma berish ]            │
├─────────────────────────────────┤
│ 🏪 Dubai Mall Store             │
│  …                              │
│  [ Buyurtma berish ]            │
└─────────────────────────────────┘
```

Har do'kon — alohida tugma, alohida buyurtma.

Mahsulot tugagan bo'lsa: karta kulrang + "Mavjud emas" + o'chirish tugmasi.

---

### 6.12 Checkout

```
Yetkazib berish turi
  ( ) 🏪 Do'kondan olib ketaman
  (•) 🚚 Yetkazib berish

Aloqa
  Ism:      [ Aziz Karimov        ]
  Telefon:  +998 90 *** ** 67  ✅
            [ Boshqa raqam ]

Manzil                          (delivery uchun)
  ┌───────────────────────────┐
  │      [ XARITA ]           │
  │         📍                │
  └───────────────────────────┘
  [ Xaritada belgilash ]
  Manzil: [ Chilonzor 9-kvartal… ]
  Mo'ljal: [ Mehnat metrosi yonida ]

Izoh
  [ Kechqurun qo'ng'iroq qiling… ]

──────────────────────────────
Mahsulotlar          1 250 000
Yetkazib berish         15 000
Jami                 1 265 000

💵 To'lov do'konda yoki yetkazib berilganda

[ Buyurtma yuborish ]
```

**UX qoidalari (K-10):**
- Hech qayerda "To'lash", "Sotib olish", "Buy now" **yozilmaydi**
- Faqat **"Buyurtma yuborish"**
- To'lov usuli aniq ko'rsatiladi: "To'lov do'konda yoki yetkazib berilganda"

**Validatsiya** — `packages/validation` dagi umumiy Zod sxemasi (03-api-spec.md, 17-bo'lim). Tugma to'g'ri to'ldirilmaguncha o'chiq turadi, har maydon ostida aniq xato.

**Server xatolari:**

| Kod | Ilovada |
|---|---|
| `PHONE_NOT_VERIFIED` | "Raqamni tasdiqlang" + OTP oynasi |
| `OUT_OF_RANGE` | "Bu manzil do'kon xizmat hududidan tashqarida" + xaritada radius |
| `LIMIT_REACHED` | "Sizda 3 ta tasdiqlanmagan buyurtma bor" + ro'yxatga havola |
| `BLOCKED` / `RESTRICTED` | "Buyurtma berish vaqtincha cheklangan" + qo'llab-quvvatlash |
| `OUT_OF_STOCK` | Qaysi mahsulot tugaganini ko'rsatish + savatni yangilash |

---

### 6.13 Buyurtma sahifasi

```
№ LS-260812-0043
┌─────────────────────────────────┐
│ ⏱ Do'kon javobini kutmoqda      │
│    23 soat 14 daqiqa qoldi      │
└─────────────────────────────────┘

●───────○───────○───────○
Yuborildi  Tasdiq  Tayyor  Topshirildi

🏪 Chilonzor Fashion
   [ 📞 Qo'ng'iroq ]  [ 🗺 Yo'nalish ]

Mahsulotlar
  Nike Air Max 90 · Qora · 42 · 1 dona

Jami            1 265 000 so'm
💵 To'lov do'konda

[ Bekor qilish ]
```

**Status matnlari:**

| Status | Matn | Rang |
|---|---|---|
| `new` | Do'kon javobini kutmoqda | 🟡 |
| `seen` | Do'kon buyurtmani ko'rdi | 🟡 |
| `confirmed` | Do'kon tasdiqladi | 🟢 |
| `ready` | Olib ketishga tayyor / Jo'natildi | 🟢 |
| `completed` | Yakunlandi | ⚪ |
| `rejected` | Do'kon rad etdi + sabab | 🔴 |
| `cancelled` | Bekor qilindi | ⚪ |
| `expired` | Do'kon javob bermadi | 🔴 |

`expired` bo'lganda: "Kechirasiz, do'kon javob bermadi" + **"Shu mahsulotni boshqa do'konda topish"** tugmasi. Bu muhim — foydalanuvchini yo'qotmaslik uchun.

---

### 6.14 Profil

```
👤 Aziz Karimov
   +998 90 123 45 67

📦 Buyurtmalarim            (2 faol) ›
💾 Saqlangan komplektlar         (7) ›
❤️ Sevimlilar                   (23) ›
📏 O'lchamlarim                     ›
📱 Telefon raqamlarim               ›
🌐 Til                          O'zbek ›
⚙️ Sozlamalar                       ›
❓ Yordam                           ›
   Chiqish
```

---

## 7. Try-On ekrani — chuqur

### 7.1 Arxitektura

```
TryOnScreen
├── <Canvas> (expo-gl + R3F)
│   ├── <AvatarRig>            skelet + morph + yuz teksturasi
│   ├── <EquippedItems>        har slot uchun GLB
│   ├── <Lighting>             3 nuqta: key + fill + rim
│   └── <RaycastHandler>       teginish → slot
├── <SlotTabs>                 🧢👕🧥👖👟⌚
├── <ItemStrip>                joriy slot mahsulotlari
├── <ControlPanel>             aylantirish, zoom, reset, sozlamalar
└── <ActionBar>                Saqlash · Savatga
```

### 7.2 Yuklanish ketma-ketligi

```
1. GET /avatar/config              → tana GLB + morph + tekstura
2. Tana yuklanadi (~1.2 s)         → skeleton progress
3. GET /tryon/slot/{activeSlot}    → 50 ta mahsulot (metadata)
4. Standart komplekt kiydiriladi   → oxirgi holat yoki bo'sh
5. Prefetch: ±2 model fonda
6. Sahna tayyor                    → progress yo'qoladi
```

**Maqsad: 2.5 soniya.** Undan uzoq bo'lsa, skeleton avatar (past sifatli) darhol ko'rsatiladi, sifatli versiya keyin almashadi.

### 7.3 Raycast bilan slot tanlash

```ts
// src/three/RaycastHandler.ts
const raycaster = new THREE.Raycaster();

function onTouch(x: number, y: number, camera, scene, size) {
  const ndc = new THREE.Vector2(
    (x / size.width) * 2 - 1,
    -(y / size.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObjects(scene.children, true);
  for (const hit of hits) {
    const slot = hit.object.userData.slot as Slot | undefined;
    if (slot) return slot;
  }
  return null;
}
```

Har bir mesh yuklanganda `userData.slot` belgilanadi — tana qismlariga ham (`body_foot_L → feet`), kiyimlarga ham.

### 7.4 Svayp

```ts
const swipe = Gesture.Pan()
  .activeOffsetX([-20, 20])
  .onEnd(e => {
    if (Math.abs(e.velocityX) < 300) return;
    const dir = e.velocityX < 0 ? 1 : -1;
    runOnJS(nextItem)(dir);
  });

const rotate = Gesture.Pan()
  .activeOffsetY([-20, 20])
  .onChange(e => { avatarRotation.value += e.changeX * 0.01; });

const pinch = Gesture.Pinch()
  .onChange(e => { cameraZoom.value = clamp(cameraZoom.value * e.scale, 0.7, 2.2); });

const gestures = Gesture.Race(swipe, Gesture.Simultaneous(rotate, pinch));
```

**Chalkashlikni oldini olish:** gorizontal svayp — mahsulot almashtirish, vertikal + gorizontal sekin harakat — avatarni aylantirish. `activeOffsetX` va tezlik chegarasi shu ikkisini ajratadi. Bu real qurilmada sozlanadi.

### 7.5 Mahsulot almashtirish

```ts
async function equipItem(slot: Slot, item: TryonItem) {
  setLoading(slot, true);
  try {
    const model = await loadGarment(item.variantId, item.lodUrls, quality);

    model.traverse(o => { o.userData.slot = slot; });
    applyMorphs(model, morphs);                 // tana bilan sinxron
    hideBodyParts(item.hideBodyParts);          // Z-fighting oldini olish

    slotManager.replace(slot, model);
    trackTryon(item.variantId);                 // fon rejimda
    prefetchAround(items, index, quality);
  } catch {
    toast('Model yuklanmadi');                  // eski model joyida qoladi
  } finally {
    setLoading(slot, false);
  }
}
```

### 7.6 Xotira boshqaruvi

3D'da eng katta xavf — xotira sizib ketishi (memory leak). Har almashtirishda eski model **to'liq** tozalanishi shart:

```ts
function disposeObject(obj: THREE.Object3D) {
  obj.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach(m => {
        Object.values(m).forEach(v => {
          if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        });
        m.dispose();
      });
    }
  });
}
```

`useEffect` cleanup'da butun sahna tozalanadi. Bu qilinmasa, 20-30 svaypdan keyin ilova qulaydi.

### 7.7 Ishlash monitoringi

```ts
// FPS pasaysa sifatni tushirish (04-3d-pipeline.md, 10-bo'lim)
if (fps < 24 && quality !== 'low')       setQuality('low');
else if (fps < 40 && quality === 'high') setQuality('medium');
else if (fps > 55 && quality === 'low')  setQuality('medium');
```

Sozlamalarda qo'lda tanlash ham bo'lsin — avtomatik tizim doim to'g'ri qaror qilmaydi.

### 7.8 Chekka holatlar

| Holat | Xatti-harakat |
|---|---|
| Slotda mahsulot yo'q | "Bu turkumda hozircha 3D model yo'q" + boshqa slotga taklif |
| Model yuklanmadi | Toast, eski model qoladi, ilova yiqilmaydi |
| Internet uzildi | Keshdagi modellar ishlaydi, yangilari yuklanmaydi |
| Ilova fon rejimiga o'tdi | Renderer to'xtatiladi (batareya) |
| Qurilma qizidi | Sifat avtomatik pasayadi |
| Xotira kam | Kesh tozalanadi, LOD2 ga o'tiladi |

---

## 8. Ruxsatlar

| Ruxsat | Qachon so'raladi | Rad etilsa |
|---|---|---|
| Joylashuv | Onboarding oxirida, sababi bilan | Shahar qo'lda tanlanadi |
| Kamera | Face scan tugmasi bosilganda | Standart avatar |
| Bildirishnoma | Birinchi buyurtmadan keyin | Ilova ichida holat ko'rinadi |

**Qoida:** ruxsat so'rashdan oldin **nima uchun kerakligini tushuntiring**. To'g'ridan-to'g'ri tizim oynasini chiqarish — rad etish foizini keskin oshiradi.

Rad etilgan ruxsat ilovani **hech qachon bloklamaydi**. Har biriga zaxira yo'l bor.

---

## 9. Push bildirishnomalar

| Hodisa | Matn |
|---|---|
| Buyurtma ko'rildi | Do'kon buyurtmangizni ko'rdi |
| Tasdiqlandi | ✅ Buyurtma tasdiqlandi — LS-260812-0043 |
| Rad etildi | Do'kon buyurtmani rad etdi: {sabab} |
| Tayyor | 📦 Buyurtmangiz tayyor |
| Muddati tugadi | Do'kon javob bermadi. Boshqa do'konni ko'ring |

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
  }),
});

// Bosilganda
Notifications.addNotificationResponseReceivedListener(res => {
  const { orderId } = res.notification.request.content.data;
  if (orderId) router.push(`/order/${orderId}`);
});
```

Token `POST /devices` orqali serverga yuboriladi.

---

## 10. Oflayn va xatolar

### Tarmoq holati

```ts
// Global banner
{!isConnected && (
  <View className="bg-warning px-4 py-2">
    <Text>Internet yo'q — keshdagi ma'lumot ko'rsatilmoqda</Text>
  </View>
)}
```

### Nima oflayn ishlaydi

| Ishlaydi | Ishlamaydi |
|---|---|
| Ko'rilgan mahsulotlar (kesh) | Yangi qidiruv |
| Yuklangan 3D modellar | Yangi model yuklash |
| Savat (lokal) | Buyurtma yuborish |
| Buyurtma tarixi (kesh) | Status yangilanishi |

TanStack Query keshi `AsyncStorage` da saqlanadi (`persistQueryClient`), 24 soat.

### Xato chegaralari

Har bir tab o'z `ErrorBoundary` sida. Try-On yiqilsa, butun ilova emas, faqat shu ekran qayta yuklanadi.

---

## 11. Ko'p tillilik

| Til | Kod | Bozor |
|---|---|---|
| O'zbek | `uz` | Toshkent (asosiy) |
| Rus | `ru` | Toshkent |
| Ingliz | `en` | Dubay (asosiy) |
| Arab | `ar` | Dubay |

Arab tili **RTL** — `I18nManager.forceRTL(true)`. Tayyor bo'lmasa, Faza 2 ga qoldiring, lekin layout'ni boshidan RTL'ga tayyor qiling (`marginStart` ishlating, `marginLeft` emas).

Standart til: qurilma tili → mos kelmasa `en`.

---

## 12. Analitika hodisalari

```ts
type Event =
  | 'app_open' | 'onboarding_complete'
  | 'signup_complete' | 'face_scan_complete' | 'face_scan_skipped'
  | 'measurements_saved'
  | 'store_viewed' | 'product_viewed'
  | 'tryon_opened' | 'tryon_item_swiped' | 'tryon_look_saved'
  | 'cart_add' | 'checkout_started' | 'order_placed'
  | 'order_confirmed' | 'order_rejected' | 'order_expired';
```

**Asosiy voronka:**

```
app_open → signup_complete → measurements_saved
        → tryon_opened → cart_add → order_placed → order_confirmed
```

Deckdagi "investor-ready metrics" aynan shu: activation, try-on rate, saved looks, conversion, repeat usage.

---

## 13. Build va chiqarish

```bash
eas build --profile development --platform all   # ishlab chiqish
eas build --profile preview --platform android   # ichki test (APK)
eas build --profile production --platform all    # do'konga

eas submit --platform ios
eas submit --platform android
```

### App Store uchun majburiy

- [ ] Maxfiylik siyosati sahifasi
- [ ] Akkauntni o'chirish funksiyasi (`DELETE /auth/account`)
- [ ] Yuz ma'lumotini qanday ishlatishini tushuntirish
- [ ] Ruxsatlar uchun aniq sabab matnlari
- [ ] Skrinshotlar (6.7", 6.5", iPad)
- [ ] Test akkaunti (reviewer uchun)

**Diqqat:** yuz skani — Apple uchun sezgir mavzu. Ma'lumot qurilmada qayta ishlanishini va serverda faqat tekstura saqlanishini aniq yozing. Bu review'dan o'tishni osonlashtiradi.

---

## 14. Rivojlantirish tartibi

| Hafta | Ish |
|---|---|
| 1 | Sozlash, dev build, **3D siqish sinovi** (04, 0-bo'lim), dizayn tizimi |
| 2 | Auth oqimi, jins, o'lchamlar |
| 3 | Home, do'konlar (xarita + ro'yxat), do'kon sahifasi |
| 4 | Katalog, mahsulot sahifasi, savat |
| 5-6 | **Try-On ekrani** (eng katta blok) |
| 7 | Checkout, buyurtma, statuslar |
| 8 | Profil, sozlamalar, push, sayqallash, test |

**5-6 haftani qisqartirmang.** Try-On — ilovaning eng murakkab qismi va aynan u loyihaning qiymatini belgilaydi.
