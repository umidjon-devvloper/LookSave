# 13 — Sayt (`looksave.app`)

**Stack:** React Router v7 (framework mode) · Vite · React 18 · TypeScript · Tailwind CSS · TanStack Query · three.js
**Bog'liq:** [15-sayt-dizayn.md](./15-sayt-dizayn.md) · [06-dizayn.md](./06-dizayn.md) · [05-mobile.md](./05-mobile.md) · [03-api-spec.md](./03-api-spec.md) · [07-web-panels.md](./07-web-panels.md) · [12-tz.md](./12-tz.md) §4.3

---

## 0. Bu hujjat nima

`12-tz.md` D-20 aytadi: **sayt hujjatlarda umuman yo'q**. U `apps/web/` da
o'z-o'zicha o'sdi va «yagona haqiqat manbai»dan tashqarida qoldi. Bu hujjat
shu teshikni yopadi va IP-05 ni almashtiradi — IP-05 faqat huquqiy sahifa va
SEO haqida edi, bu yerda esa **to'liq sayt** tasvirlanadi.

Bu hujjat **reja**, kod emas. Har bir bo'lim: nima quriladi, **nega aynan
shunday**, va qachon tayyor deb hisoblanadi.

---

## 1. Nega ilova bo'la turib sayt kerak

| Sabab | Nima yutiladi |
|---|---|
| **Qidiruvdan kirish** | Ilova App Store'da qidiriladi. Sayt Google'da topiladi: «Dubai denim jacket try on» → mahsulot sahifasi. Ilovada bunday kanal umuman yo'q |
| **Havola ulashiladi** | Do'kon mahsulotini WhatsApp'ga tashlaydi. `looksave.app/p/...` ochiladi — ilova o'rnatish shart emas |
| **Investorlar va do'konlar** | Deckdan keyin birinchi qadam — sayt. `store.looksave.app` ga ariza shu yerdan boshlanadi |
| **Desktopda kiyintirish** | 3D katta ekranda ancha yaxshi ko'rinadi. Telefonda 6 dyuym, brauzerda 27 |
| **iOS'siz foydalanuvchi** | Android build hali yo'q. Sayt — yagona kirish yo'li |

⚠️ **Sayt ilovaning o'rnini bosmaydi.** U ilovaga **eshik**: har bir sahifada
«App Store» va «davom ettirish» yo'li ochiq turadi. Lekin eshikdan kirmagan
odam ham xarid qila olishi kerak — shuning uchun qamrov to'liq (§2).

---

## 2. Qamrov — qaror (2026-08-29)

**Sayt = mobil ilovaning to'liq veb nusxasi**, ustiga marketing va huquqiy
sahifalar. To'rt til: `uz`, `ru`, `en`, `ar` (arabcha RTL).

| Bor | Yo'q |
|---|---|
| Marketing sahifalari (bosh, qanday ishlaydi, do'konlar uchun) | Do'kon kabineti — `store.looksave.app` da qoladi |
| Katalog, filtr, qidiruv, kolleksiya, brend | Admin panel — `admin.looksave.app` da qoladi |
| Mahsulot sahifasi, o'lcham maslahati | Onlayn to'lov — K-10 kuchda: to'lov offline |
| 3D kiyintirish studiyasi (bepul, tez) | Native ilova funksiyalari: push, kamera skaneri |
| AI kiyintirish (avatar + render) | |
| Savat, checkout, buyurtmalar | |
| Profil, o'lchovlar, yuz surati, sozlamalar | |
| Do'konlar xaritasi va do'kon sahifasi | |
| Huquqiy sahifalar, SEO, OG, sitemap | |

---

## 3. Bugungi holat — o'lchangan, taxmin emas

`apps/web/dist/` (2026-08-23 build):

| O'lchov | Qiymat | Baho |
|---|---|---|
| `Stage-*.js` | 1 181 742 B (gzip **322 KB**) | ❌ D-21. Sekin 3G da hero 8+ soniya kutadi |
| `index-*.js` | 352 441 B (gzip **110 KB**) | ⚠️ Marketing sahifa uchun ko'p |
| CSS | 40 897 B | ✅ |
| Sahifalar soni | **1** (router yo'q) | ❌ D-22 |
| Tillar | **1** (inglizcha, qattiq yozilgan) | ❌ D-25 |
| Huquqiy sahifalar | **0** | ❌ D-23, App Store talabi |
| `sitemap.xml`, `robots.txt`, favicon, OG rasm | **yo'q** | ❌ D-24 |
| Deploy | **yo'q** — `Caddyfile` saytni bilmaydi | ❌ D-26 |

Bor va yaxshi: `packages/design-system` preseti uchala veb ilovada bir xil,
haqiqiy GLB modellar `public/models/` da, `Hero`/`TryOn`/`Wardrobe` bo'limlari
3D ni allaqachon brauzerda chizadi (r3f brauzerda ishlaydi — 12-tz §3 dagi
muammo faqat React Native'da edi).

---

## 4. Arxitektura qarorlari

| # | Qaror | Sabab |
|---|---|---|
| **S-01** | **Bitta ilova, bitta domen** — `apps/web` kengaytiriladi, alohida `apps/shop` ochilmaydi | Marketingdan katalogga o'tish uzluksiz bo'lishi kerak; SEO vazni bitta domenda to'planadi. Panellar alohida, chunki ular boshqa auditoriya — bu yerda auditoriya bitta |
| **S-02** | **SSR — React Router v7 framework mode** | Mahsulot sahifasi indekslanishi SHART: SPA'da Google JS'ni kutadi va ko'pincha indekslamaydi. v7 — panellardagi `react-router-dom` v6 ning davomi, ya'ni yangi ekotizim emas. Vite saqlanadi, preset saqlanadi |
| **S-03** | **Cloudflare Workers'ga deploy** (Pages emas, SSR kerak) | K-02 izohi: panellar allaqachon Cloudflare'da, VPS faqat API bilan band. Sayt SSR uchun VPS'ni yuklamasin |
| **S-04** | **BFF sessiya** — refresh token `httpOnly` cookie'da, JS uni ko'rmaydi | Panellarda token `localStorage` da (`store-panel/src/api/client.ts:33`) va bu XSS'da o'g'irlanadi. Saytda mijoz puli va manzili bor — takrorlanmaydi. SSR server tokenni o'zida ushlaydi, brauzerga faqat imzolangan cookie chiqadi |
| **S-05** | **Yo'lda til** — `/uz/...`, `/ru/...`, `/en/...`, `/ar/...` | `hreflang` faqat alohida URL bilan ishlaydi. Cookie'ga qo'yilsa Google to'rt tilni ham bitta sahifa deb ko'radi va uchtasi yo'qoladi |
| **S-06** | **Tarjima va formatlash `packages/i18n` ga chiqariladi** | Bugun to'rt til `apps/mobile/src/i18n/dictionaries.ts` da. Nusxa ko'chirilsa ikkisi bir hafta ichida ajraladi. Bitta manba — ilova ham, sayt ham shundan o'qiydi |
| **S-07** | **Komponent kiti `packages/ui-web`** — mobil `ui.tsx` bilan 1:1 | «Ilova bilan bir xil» qoidasi tokendan kuchliroq bo'lishi kerak: bir xil rang bilan ham har xil tugma chizish mumkin (§6 buni o'lchaydi) |
| **S-08** | **Rasm — Cloudflare Images** (R2 ustida) | K-03 R2 ni tanlagan; katalog rasmlari saytda eng og'ir yuk. `srcset` + AVIF bilan LCP ikki barobar tushadi |
| **S-09** | **3D — `three` alohida bo'lakda, faqat so'ralganda** | D-21. Bosh sahifada 322 KB kutish yo'q: hero `poster` rasm bilan ochiladi, 3D `IntersectionObserver` yoki bosishdan keyin keladi |

### Rad etilgan variantlar

| Variant | Nega yo'q |
|---|---|
| Next.js | Kuchliroq rasm quvuri, lekin repo butunlay Vite: uchta ilova, bitta preset, bitta `tsconfig.base.json`. Ikkinchi bundler solo ishlab chiquvchiga qimmat |
| SPA + prerender | Marketing sahifasi indekslanadi, **mahsulot sahifasi yo'q**. Marketplace uchun aynan mahsulot muhim |
| Alohida `apps/shop` | Ikki deploy, ikki bundle, foydalanuvchi uchun bitta sayt. Foyda yo'q |

---

## 5. Sahifalar xaritasi

Har bir yo'l oldida til bo'lagi: `/:locale/...`. `/` — `Accept-Language` va
geo bo'yicha yo'naltirish (302, keshlanmaydi).

### Ochiq (auth talab qilinmaydi)

| Yo'l | Sahifa | SSR | Ilovadagi ekran |
|---|---|---|---|
| `/:l` | Bosh sahifa | ✅ | `(tabs)/index.tsx` |
| `/:l/catalog` | Katalog + filtr (filtr URL'da) | ✅ | `catalog.tsx` |
| `/:l/c/:slug` | Kategoriya | ✅ | `catalog.tsx?category=` |
| `/:l/collection/:slug` | Kolleksiya (MEN / WOMEN / LIMITED) | ✅ | `collection.tsx` |
| `/:l/brand/:slug` | Brend sahifasi | ✅ | — (yangi) |
| `/:l/p/:slug-:id` | Mahsulot | ✅ | `product/[id].tsx` |
| `/:l/search?q=` | Qidiruv | ✅ | `catalog.tsx` |
| `/:l/stores` | Do'konlar xaritasi va ro'yxati | ✅ | `stores.tsx` |
| `/:l/store/:id` | Do'kon sahifasi | ✅ | `store/[id].tsx` |
| `/:l/try-on` | 3D studiya (mehmon uchun ham) | qisman | `ai/studio.tsx` |
| `/:l/how-it-works` | Qanday ishlaydi | ✅ | — |
| `/:l/for-stores` | Do'konlar uchun + arizaga havola | ✅ | `seller/apply.tsx` |
| `/:l/download` | Ilovani yuklash | ✅ | — |
| `/:l/privacy`, `/terms`, `/cookies`, `/returns` | Huquqiy | ✅ | `settings/` |
| `/:l/sign-in`, `/sign-up` | Kirish, ro'yxat | ✅ | `(auth)/` |

### Shaxsiy (sessiya kerak)

| Yo'l | Sahifa | Ilovadagi ekran |
|---|---|---|
| `/:l/cart` | Savat (do'kon bo'yicha guruhlangan) | `(tabs)/cart.tsx` |
| `/:l/checkout` | Rasmiylashtirish | `checkout.tsx` |
| `/:l/orders`, `/:l/order/:id` | Buyurtmalar | `orders.tsx`, `order/[id].tsx` |
| `/:l/favorites`, `/:l/looks` | Saqlanganlar | `favorites.tsx`, `looks.tsx` |
| `/:l/tryon` | To'liq studiya: 3D + AI render | `ai/` |
| `/:l/profile` | Profil | `(tabs)/profile.tsx` |
| `/:l/profile/measurements` | O'lchovlar | `settings/measurements.tsx` |
| `/:l/profile/face-photo` | Yuz surati + rozilik | `settings/face-photo.tsx` |
| `/:l/profile/settings`, `/delete-account` | Sozlamalar, o'chirish | `settings/` |

**Xatolar:** `404` (kategoriya taklifi bilan), `500`, `/offline`.

⚠️ **Sotuvchi kabineti bu yerda qayta qurilmaydi.** `/for-stores` →
`store.looksave.app` ga havola. Ikki panelni parallel yuritish — 07-hujjat
allaqachon rad etgan yo'l.

---

## 6. Dizayn tengligi — «ilova bilan bir xil» nimani anglatadi

> **Sahifa-sahifa maket va «premium» ning o'lchanadigan ta'rifi —
> [15-sayt-dizayn.md](./15-sayt-dizayn.md).** Bu yerda faqat tizim
> darajasidagi qoida va WEB-01 da yopilgan uzilishlar qoladi.

### 6.1 Qoida

**Bir xil = bir xil TIL, bir xil piksel emas.** Telefon ekranini cho'zish —
premium emas, dangasalik. Quyidagi jadval chegarani aniq qo'yadi:

| Aynan bir xil bo'ladi | Web'ga moslashadi |
|---|---|
| Rang shkalasi (barcha 24 token) | Ustunlar soni: 2 → 4 → 6 |
| Tipografika nisbatlari va `letter-spacing` | Asos o'lcham: 15px → 16px, hero 40px → 72px |
| Burchak radiuslari | Chekka padding: 16px → `max-w-6xl` markazda |
| Tugma balandligi (52px), gradient, bosishda 0.97 ga kichrayish | Hover holati — telefonda yo'q, web'da SHART |
| Input fokus holati (chegara `#7C3AED`, fon `surface2`) | Klaviatura fokus halqasi (`:focus-visible`) |
| Bo'sh/xato holatlari: 64px doira, ikonka, oq sarlavha | Kontent kengligi: matn ≤ 72 belgi |
| Bo'lim sarlavhasi: 11px, `letter-spacing: 1.6`, KATTA HARF | Yon menyu → yuqori navigatsiya |
| Mahsulot kartasi tuzilishi va narx uslubi | Kartalar tarmog'i o'lchami |
| Ikonka to'plami | Sichqoncha kursori, tanlanish rangi |

### 6.2 Uzilishlar — o'lchangan ✅ YOPILDI (2026-08-29, WEB-01)

`apps/web/src/` shadcn standartlarida chizilgan edi, ilovada esa boshqacha.
Jadval tarixiy yozuv sifatida qoladi — qaysi qiymat qayerdan kelgani shu
yerda, va yangi komponent yozilganda solishtirish uchun kerak:

| # | Uzilish | Saytda bugun | Ilovada | Fayl |
|---|---|---|---|---|
| **P-01** | Asosiy tugma **yassi**, gradientsiz | `bg-primary` | `LinearGradient(#8B5CF6 → #6D3FD9)` | `ui/button.tsx` ↔ `mobile/ui.tsx:170` |
| **P-02** | Tugma **`rounded-full`** | pill | `radius.md` = 12px | `Hero.tsx:70` ↔ `tokens.ts` |
| **P-03** | Tugma balandligi shadcn'niki (40/44px) | `size="lg"` | qat'iy **52px** | — |
| **P-04** | Bosishda javob yo'q | — | `scale 0.97`, spring | `mobile/ui.tsx:139` |
| **P-05** | Tipografika shkalasi presetda **umuman yo'q** | ixtiyoriy `text-5xl` | 11 ta nomlangan uslub | `tailwind-preset.js` |
| **P-06** | `surface3`, `primarySoft`, `accentGlow` tokenlari yo'q | — | bor | `tokens.ts:11,20,22` |
| **P-07** | Buyurtma statusi ranglari yo'q | — | `statusWaiting/Confirmed/Rejected/Done` | `tokens.ts:37` |
| **P-08** | Bo'sh va xato holati komponenti yo'q | — | `Empty`, `ErrorView` (64px doira) | `mobile/ui.tsx:40,84` |
| **P-09** | Input fokus holati shadcn'niki (ring) | `ring` | chegara + fon o'zgaradi | `mobile/ui.tsx:210` |
| **P-10** | Logotip `tracking-wordmark` (0.32em), ilovada 4.5px | ≈ farq bor | `text.wordmark` | `Nav.tsx:47` |

Bu ro'yxat **WEB-01 ning qabul mezoni** edi. O'ntasi ham yopildi va
brauzerda `getComputedStyle` bilan tekshirildi: tugma 52px / radius 12 /
gradient `#8B5CF6 → #6D3FD9` / matn 15px-500, maydon 52px / fon `#14121C` /
fokusda chegara `#7C3AED`, yorliq 11px / 1.595px, logotip 14px / 4.48px.

#### ⚠️ Yo'lda topilgan tuzoq — `tailwind-merge` shkalani bilmaydi

Eng qimmat xato shu bo'ldi va u **jim** edi. `twMerge` sinfni nomiga qarab
guruhga ajratadi; bizning `text-body` ni u RANG deb o'yladi va `text-foreground`
bilan bir guruhga qo'shib, o'chirib yubordi. Kodda ikkala sinf ham
ko'rinib turardi, brauzerga esa faqat rang yetib borardi — natijada tugma
matni 15px o'rniga 16px chiqdi. Faqat `getComputedStyle` bilan topildi.

Yechim: `packages/ui-web/src/cn.ts` da `extendTailwindMerge` — shkala
kalitlari ochiq sanab o'tilgan. `apps/web/src/lib/utils.ts` endi o'z
`cn` ini yozmaydi, shu yerdan qayta eksport qiladi.

**Qoida:** presetdagi `fontSize` ga yangi o'lcham qo'shilsa, `cn.ts` dagi
ro'yxatga ham qo'shiladi. Aks holda xato jimgina qaytadi.

### 6.3 Presetni kengaytirish (`packages/design-system`)

Qo'shiladi — bitta joyda, uchala veb ilovaga:

```js
// tokenlar
'--surface-3':   '252 24% 17%',  /* #252036 — hover/bosilgan */
'--primary-soft': '258 90% 66% / 0.14',
'--glow':         '258 90% 66% / 0.45',
'--status-waiting':   '38 92% 50%',
'--status-confirmed': '142 71% 45%',
'--status-rejected':  '0 84% 60%',
'--status-done':      '253 13% 42%',

// tipografika shkalasi — 06-dizayn.md §3 dan, web nisbatlari bilan
fontSize: {
  hero:  ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
  h1:    ['clamp(1.875rem, 3vw, 3rem)', { lineHeight: '1.1',  letterSpacing: '-0.02em' }],
  h2:    ['1.375rem', { lineHeight: '1.27', letterSpacing: '-0.014em' }],
  h3:    ['1.0625rem', { lineHeight: '1.41' }],
  body:  ['1rem',     { lineHeight: '1.5' }],
  small: ['0.8125rem',{ lineHeight: '1.38' }],
  tiny:  ['0.6875rem',{ lineHeight: '1.27' }],
  label: ['0.6875rem',{ lineHeight: '1.27', letterSpacing: '0.145em' }],
  price: ['1.125rem', { lineHeight: '1.33' }],
},

// gradient — tugma va kartalar uchun
backgroundImage: { 'primary-grad': 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-dim)))' },
```

⚠️ **Ilovadagi `letter-spacing` px'da, web'da `em` da.** 11px shriftda
`1.6px` = `0.145em`. Aynan shu hisob qilinmasa, sarlavhalar ikki
platformada boshqacha keng bo'ladi — ko'zga darrov tashlanadi.

### 6.4 Komponent kiti (`packages/ui-web`)

Mobil `src/components/ui.tsx` va `Icon.tsx` ning veb dubli. Har biri
yonida qaysi mobil komponentga teng ekani yozilgan izoh turadi:

| Komponent | Nima | Ilovadagi manba |
|---|---|---|
| `Button` | 52px, gradient, `active:scale-[0.97]`, `variant: primary/ghost/danger` | `ui.tsx:113` |
| `Field` | 52px input, fokusda chegara `borderAccent` + fon `surface2` | `ui.tsx:196` |
| `Card` | `#14121C`, 1px `#241F33`, radius 16 | `06-dizayn.md §7` |
| `Chip` | pill, tanlanganda `primarySoft` fon | `06-dizayn.md §7` |
| `SectionHeader` | 11px KATTA HARF + «hammasi ›» havolasi | `home/Sections.tsx:11` |
| `ProductCard` | rasm 3:4, nom, narx, eski narx, `limited` belgisi | `06-dizayn.md §7` |
| `Empty` / `ErrorView` | 64px doira + ikonka; tarmoq xatosi alohida | `ui.tsx:40,84` |
| `Skeleton` | `surface2` pulsatsiya | `Skeleton.tsx` |
| `StatusBadge` | buyurtma statusi ranglari | `theme/orderStatus.ts` |
| `Money` | `packages/i18n` dagi formatlash | `theme/format.ts` |

⚠️ **Kit `apps/web` ichida emas, `packages/` da.** Sabab: store-panel ham
sekin-asta shunga o'tadi, va uchinchi ilova ochilganda takroriy chizish
boshlanmaydi.

### 6.5 Web'ga xos — ilovada bo'lmagan, lekin premium uchun shart

| Element | Talab |
|---|---|
| Hover | Karta: 150 ms da `translateY(-2px)` + chegara `borderStrong`. Tugma: 8% yorqinroq |
| `:focus-visible` | 2px `#8B5CF6` halqa, 2px oraliq. **Sichqoncha bosishida ko'rinmaydi** |
| Kursor | Bosiladigan hamma narsada `pointer` |
| Skroll | `scroll-behavior: smooth`, `scroll-margin-top: 96px` (bor) |
| Tanlanish | `::selection` binafsha 35% (bor) |
| Sahifa o'tishi | `<ViewTransition>` — 180 ms fade. Katalog → mahsulot rasmi joyida qoladi |
| Harakat | `prefers-reduced-motion` da hammasi o'chadi (bor) |
| Kursorli 3D | Sichqoncha bilan aylantirish, g'ildirak bilan zoom, ikki barmoq bilan pan |

---

## 7. To'rt til va RTL

### 7.1 Tuzilma

`packages/i18n` yangi paket. Ichida:

```
packages/i18n/
├── src/
│   ├── dictionaries/   uz.ts  ru.ts  en.ts  ar.ts   ← mobil'dan KO'CHIRILADI
│   ├── format.ts       money() distance() phone() date()
│   ├── locale.ts       Locale turi, RTL ro'yxati, fallback zanjiri
│   └── index.ts
```

`apps/mobile/src/i18n/dictionaries.ts` shu paketga ko'chadi va mobil ilova
undan import qiladi. **Nusxa qoldirilmaydi** — S-06.

### 7.2 Yo'naltirish

| Holat | Xatti-harakat |
|---|---|
| `/` ga kirish | `Accept-Language` → mos til; mos til yo'q → `en` (Dubay bozori). 302, `Cache-Control: no-store` |
| `/uz/catalog` | To'g'ridan-to'g'ri, yo'naltirishsiz |
| Til almashtirildi | Bir xil sahifada qoladi: `/en/p/denim-jacket-42` → `/ar/p/denim-jacket-42`. **Bosh sahifaga tashlanmaydi** |
| Tanlov eslanadi | `looksave_locale` cookie, 1 yil. Faqat `/` yo'naltirishiga ta'sir qiladi |

`<html lang>` va `<html dir>` har javobda serverda qo'yiladi — brauzerda
JS bilan emas. Aks holda arabcha sahifa bir zum chapdan o'ngga chizilib,
keyin sakraydi.

### 7.3 RTL

| Ish | Qanday |
|---|---|
| Maket | Faqat mantiqiy xossalar: `ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `border-s`. `pl-`/`pr-` **taqiqlanadi** (ESLint qoidasi) |
| Ikonka | Yo'nalishli ikonkalar ko'zguga solinadi (`rtl:-scale-x-100`): `next`, `back`, `arrow`. **Ko'zguga solinmaydi:** logotip, ijtimoiy belgilar, ✓ |
| 3D sahna | **Ko'zguga solinmaydi.** Kiyim jismoniy narsa; chap yeng chap yengligicha qoladi. Faqat UI qatlami aylanadi |
| Xarita | Google Maps o'zi RTL ni biladi; boshqaruv tugmalari `dir` dan meros oladi |
| Raqam va narx | Lotin raqamlari (`numberingSystem: 'latn'`). BAA'da narxlar shunday yoziladi; arab-hind raqamlari chalkashtiradi |
| Sana | `Intl.DateTimeFormat` mos taqvim bilan |

### 7.4 Shrift

Inter arabchani qoplamaydi — harflar tizim shriftiga tushadi va sahifa
«tayyor emas»dek ko'rinadi.

| Til | Shrift | Og'irliklar |
|---|---|---|
| uz, ru, en | Inter Variable (o'zimizda, CDN'siz) | 400, 500, 600, 700 |
| ar | **IBM Plex Sans Arabic** | 400, 500, 600, 700 |

Kirill `latin` subsetida yo'q — `cyrillic` subseti alohida yuklanadi va
faqat `ru` sahifalarida `preload` qilinadi.

### 7.5 Tarjima qoidalari

⚠️ **Qattiq yozilgan matn — eng jim xato.** Ilovada bugun ham bor:
`apps/mobile/app/checkout.tsx:280` da `To'lov do'konda` to'g'ridan-to'g'ri
yozilgan va inglizcha interfeysda o'zbekcha chiqadi. Saytda bu takrorlanmasin:

- ESLint: JSX ichida lotin/kirill harfli literal matn — xato
- KATTA HARF faqat inglizcha yorliqlarda (06-dizayn.md §3). `KO'YLAK` va
  arabcha katta harf yo'q — CSS `text-transform` tilga qarab o'chadi
- Tarjima yetishmasa: `en` ga tushadi va build'da ogohlantiradi

---

## 8. Kiyintirish saytda

12-tz.md §3 qarori kuchda: **3D — tez va bepul, AI — bitta realistik surat.**
Saytda ikkalasi ham bor, chunki brauzerda r3f muammosi yo'q.

### 8.1 3D studiya

| Xususiyat | Tafsilot |
|---|---|
| Manba | `apps/web/public/models/` — `assets-3d/dist/` bilan bir xil (`scripts/sync-models.mjs`) |
| Slotlar | `head`, `top`, `outer`, `bottom`, `feet`, `wrist`, `bag` — ilovadagi to'liq to'plam |
| Boshqaruv | Sichqoncha bilan aylantirish, g'ildirak zoom, slot bo'yicha svayp |
| Avatar | Mehmon: o'lchov kiritsa moslashadigan asos model. Kirgan: profil o'lchovlari |
| Yuklanish | `poster` rasm darrov → `three` bo'lagi keyin. **Hech qachon bo'sh quti ko'rinmaydi** |
| Zaxira | WebGL yo'q/o'chirilgan → 360° surat aylanmasi (12 kadr). Xato xabari emas |

### 8.2 AI kiyintirish

| Qadam | Sahifa | Talab |
|---|---|---|
| Yuz surati | `/profile/face-photo` | **Aniq rozilik**: surat serverga va tashqi provayderga (FASHN) ketishi yozilgan. Belgilanmagan katakcha bilan |
| To'liq bo'yli surat | `/profile/face-photo` | `purpose: 'body'` — `private` kesh |
| Avatar | `/tryon` | `POST /v1/tryon/avatar`, holat so'rab turiladi |
| Render | `/tryon` | **Faqat tugma bosilganda.** Har surat kredit turadi (K-08a) |

⚠️ Kutish 5–17 soniya. Bo'sh spinner emas — qadamlar ko'rsatiladi
(«avatar tayyorlanmoqda» → «kiyim kiydirilmoqda»), va sahifadan chiqib
ketsa ish davom etadi, qaytganda natija turadi.

---

## 9. Auth — BFF sessiya

```
brauzer ──(httpOnly cookie)──▶ SSR server ──(Bearer JWT)──▶ api.looksave.app
```

| Element | Qaror |
|---|---|
| Kirish | Telefon + parol (ilovadagidek). OTP keyingi bosqichda |
| Refresh token | `httpOnly; Secure; SameSite=Lax; Path=/` cookie. JS o'qiy olmaydi |
| Access token | Serverda, so'rov davomida. Brauzerga umuman chiqmaydi |
| Yangilash | SSR server 401 ni ushlab, `POST /v1/auth/refresh` ni o'zi chaqiradi |
| CSRF | O'zgartiruvchi so'rovlar `POST` + `Origin` tekshiruvi + bir martalik token |
| Chiqish | `POST /v1/auth/logout` + cookie o'chiriladi |
| Mehmon savati | Serverdagi imzolangan `guest_cart` cookie. Kirgach savat birlashtiriladi — **tashlab yuborilmaydi** |

⚠️ **Bu API'ga o'zgarish talab qiladi:** `/v1/auth/*` bugun refresh tokenni
javob tanasida qaytaradi (mobil uchun to'g'ri). SSR server uni o'zi cookie'ga
soladi — API o'zgarmaydi, cookie qatlami saytda. Shu sabab BFF tanlandi.

---

## 10. Savat, checkout, buyurtma

Ilovadagi mantiq **aynan** takrorlanadi (`(tabs)/cart.tsx`, `checkout.tsx`):

| Qoida | Tafsilot |
|---|---|
| Guruhlash | Savat **do'kon bo'yicha** bo'linadi — har do'kon alohida buyurtma |
| Yetkazish | `pickup` yoki `delivery`. `pickup` da yetkazish narxi va manzil yo'qoladi |
| To'lov | **Onlayn to'lov yo'q** (K-10). «To'lov do'konda / yetkazilganda» — tarjima qilingan matn bilan |
| Idempotentlik | `Idempotency-Key` har checkout uchun **bir marta** yasaladi, har urinishda emas |
| Valyuta | Do'kondan keladi: Dubay `AED`, Toshkent `UZS`. Formatlash `packages/i18n` da |
| Bo'sh savat | Ilovadagi `CartArt.tsx` bilan bir xil rasm va matn |
| Buyurtma holati | `orderStatus.ts` ranglari; sahifa ochiq turganda yangilanadi |

---

## 11. SEO va ulashish

| Element | Talab |
|---|---|
| `<title>` / `description` | Har sahifada o'ziniki, tilga qarab. Mahsulotda: `{nom} — {brend} \| LookSave` |
| `hreflang` | To'rt til + `x-default` (`en`). Har sahifada o'zaro havolalar |
| `canonical` | Filtr parametrlari kanonik URL'ga kirmaydi (`?size=M` alohida sahifa emas) |
| JSON-LD | `Organization`, `WebSite`+`SearchAction`, `Product`+`Offer` (narx, valyuta, mavjudlik), `BreadcrumbList`, do'konda `LocalBusiness` (manzil, koordinata, ish vaqti) |
| `sitemap.xml` | Til bo'yicha bo'lingan; mahsulot va do'kon URL'lari bazadan yasaladi, sutkada bir marta |
| `robots.txt` | `/checkout`, `/cart`, `/profile`, `/orders` — `Disallow` |
| OG rasm | Mahsulot uchun **dinamik**: rasm + nom + narx, qora-binafsha fonda. Worker yasaydi va keshlaydi |
| Favicon | `.ico`, `.svg`, 180px apple-touch, `manifest.webmanifest` |
| Smart banner | iOS'da `apple-itunes-app` meta |

Sinov: havola Telegram, WhatsApp va X'ga tashlanadi — uchalasida ham karta
chiqishi kerak. Bu **qo'lda** tekshiriladi, chunki har biri o'z keshini
tutadi.

---

## 12. Ishlash byudjeti

Cheklar CI'da o'lchanadi va **buzilsa build yiqiladi**. Aks holda bir yilda
sekin-asta og'irlashadi va hech kim sezmaydi.

| O'lchov | Chegara | Bugun |
|---|---|---|
| Boshlang'ich JS (bosh sahifa, gzip) | **≤ 120 KB** | 110 KB ✅ (lekin router'siz) |
| Eng katta bo'lak (gzip) | **≤ 200 KB** | 322 KB ❌ |
| `three` bo'lagi | alohida, faqat so'ralganda | ❌ hero bilan keladi |
| LCP (4G, Moto G) | ≤ 2.0 s | o'lchanmagan |
| CLS | < 0.05 | rasm o'lchovlari yo'q |
| INP | < 200 ms | — |
| Lighthouse (mobil) | ≥ 92 | — |

Vositalar: `manualChunks` (`three`, `react`, `ui`), marshrut bo'yicha lazy,
rasm `width`/`height` majburiy, shrift `preload` faqat ishlatilganini,
`Cache-Control: immutable` xesh nomli fayllarga.

---

## 13. Kirish imkoniyati (a11y)

| Talab | Tafsilot |
|---|---|
| Kontrast | Matn ≥ 4.5:1. ⚠️ `textDim` (#635D78) `bg` (#0A0A0F) ustida ≈ 4.2:1 — **kichik matnda ishlatilmaydi**, faqat 15px+ |
| Klaviatura | Butun xarid yo'li sichqonchasiz o'tilishi kerak: katalog → mahsulot → o'lcham → savat → checkout |
| Fokus | `:focus-visible` hamma joyda ko'rinadi |
| «Kontentga o'tish» | Birinchi Tab'da chiqadigan havola |
| Rasm | Mahsulot rasmida `alt` = nom + rang; bezak rasmlarda `alt=""` |
| 3D | Klaviatura bilan aylantirish (o'q tugmalari) + matnli tavsif |
| Forma | Har maydonda `<label>`, xato `aria-describedby` bilan bog'lanadi |
| Til | `<html lang>` to'g'ri — ekran o'quvchi talaffuzi shunga bog'liq |

Sinov: `axe` CI'da, klaviatura bilan qo'lda bir marta.

---

## 14. Maxfiylik va huquqiy sahifalar

`10-roadmap.md §4` bo'yicha 18-haftaga **majburiy**, App Store talabi.

| Sahifa | Ichida nima bo'lishi SHART |
|---|---|
| `/privacy` | **Yuz va gavda surati serverga ketishi va tashqi provayderga (FASHN) yuborilishi aniq yozilgan** (K-08a, D-42). Saqlash muddati, o'chirish yo'li, kimga uzatiladi |
| `/terms` | Buyurtma = do'konga so'rov, LookSave sotuvchi emas (K-10). Bekor qilish, nizolar |
| `/cookies` | Qaysi cookie, nima uchun, qancha yashaydi |
| `/returns` | Qaytarish — do'kon siyosati; LookSave vositachi |

Cookie banneri: analitika **rozilikdan keyin** yuklanadi. Zarur cookie'lar
(sessiya, savat, til) rozilikni kutmaydi va shu sahifada sanab o'tiladi.
Barcha to'rt tilda tarjima qilinadi — tarjimasiz huquqiy matn kuchsiz.

---

## 15. Analitika

| Nima | Qanday |
|---|---|
| Vosita | Plausible yoki PostHog (o'zimizda) — uchinchi tomonga shaxsiy ma'lumot ketmaydi |
| Rozilik | Bannerdan keyin. Rad etilsa umuman yuklanmaydi |
| Voqealar | `view_product`, `try_on_started`, `try_on_completed`, `add_to_cart`, `checkout_started`, `order_created`, `app_download_clicked`, `store_directions_clicked` |
| Voronka | Ko'rildi → kiyib ko'rildi → savat → buyurtma. **Kiyintirish konversiyaga ta'sir qiladimi** — loyihaning asosiy savoli, o'lchanmasa javob yo'q |

---

## 16. Deploy

| Element | Qaror |
|---|---|
| Xosting | Cloudflare Workers (S-03). Panellar allaqachon Cloudflare'da |
| Domen | `looksave.app` + `www` → asosiyga yo'naltiriladi |
| API | `api.looksave.app` — VPS'da, Caddy orqali (bor). SSR server u bilan server-server gaplashadi |
| CORS | Kerak emas: brauzer faqat o'z domeni bilan gaplashadi (BFF) |
| Sarlavhalar | `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, va **CSP** (`script-src 'self'`) |
| Kesh | HTML — `no-cache`; xesh nomli aktivlar — `immutable, max-age=31536000`; katalog javoblari — chekkada 60 s |
| CI | `.github/workflows/` ga: `typecheck` → `lint` → `test` → `build` → byudjet cheki → deploy |
| Rollback | Cloudflare versiyalari; oldingi deploy bir bosishda qaytadi |

`docs/08-deployment.md` va `infra/Caddyfile` yangilanadi — bugun ikkalasi
ham saytni bilmaydi (D-26).

---

## 17. Test

| Qatlam | Nima |
|---|---|
| Birlik (`vitest`) | Formatlash, filtr URL'i, savat hisobi, til fallback'i |
| Komponent | `ui-web` kiti — holatlar: normal, hover, fokus, o'chiq, yuklanmoqda |
| E2E (`playwright`) | **Asosiy yo'l:** katalog → filtr → mahsulot → o'lcham → savat → checkout → buyurtma. Har commitda |
| E2E RTL | Arabcha bosh sahifa + mahsulot: `dir=rtl`, ikonkalar ko'zguda, maket buzilmagan |
| Vizual | Mahsulot va bosh sahifa — to'rt tilda skrinshot solishtiruv |
| Lighthouse CI | §12 byudjeti; buzilsa build yiqiladi |
| `axe` | Har sahifada, xatoga chidamsiz |
| Qo'lda | OG karta uchta messenjerda; sekin 3G'da hero; WebGL o'chirilgan brauzer |

---

## 18. Ish paketlari

Uchta relizga bo'lingan. **Har reliz mustaqil chiqariladi** — birinchisidan
keyin sayt allaqachon ishlaydi va havola yuborsa bo'ladi. Bu muhim: to'qqiz
hafta hech narsa ko'rinmaydigan ish — eng katta xavf.

### Reliz R1 · «Ko'rinish» — ochiq sayt, indekslanadi (~3 hafta)

#### WEB-00 · Poydevor ✅ BAJARILDI (2026-08-29)

- [x] `/en`, `/uz`, `/ru`, `/ar` ochiladi; `/` `Accept-Language` bo'yicha yo'naltiradi (`q=` og'irliklari bilan)
- [x] Sahifa serverda chiziladi — HTML ichida mahsulot nomi, narxi va do'koni bor
- [x] `three` alohida bo'lakda: boshlang'ich yuk **139.8 KB gzip** (byudjet 200 KB), 3D bo'lagi 314 KB alohida
- [x] `npm run build --workspace @looksave/web` ✅

**Nima o'zgardi:** `index.html` + `main.tsx` + `App.tsx` o'rniga
`root.tsx` + `routes.ts` + 20 ta marshrut fayli; marshrut bo'yicha
bo'linish; `layouts/shell.tsx` (shapka + futer + xato chegarasi).

**Yo'lda hal qilingan uchta to'siq:**

| To'siq | Sabab | Yechim |
|---|---|---|
| Dev server ishga tushmasdi | RR7 plagini `react-router-dom` ni ham oldindan yig'adi; root'da panellarning v6 nusxasi turardi | `apps/web` ga `react-router-dom@7` o'rnatildi |
| Har sahifa 500 | Radix paketlari CJS — Node nomlangan eksportni ko'rmaydi | `vite.config.ts` da `ssr.noExternal` |
| Katalog rasmlari ko'rinmasdi | SSR da rasm gidratatsiyadan oldin yuklanadi, `onLoad` o'tib ketadi | `ImageFrame` `complete` ni o'zi tekshiradi va DOM tinglovchisini bitta tikda ulaydi |

#### WEB-01 · Dizayn tengligi kiti ✅ BAJARILDI (2026-08-29)

Preset kengaytmasi (§6.3) + `packages/ui-web` (§6.4).

- [x] §6.2 dagi **P-01…P-10 ning o'ntasi ham yopilgan**
- [x] Tugma: 52px, gradient, `active:scale-97` — o'lchangan, ilova qiymatlari bilan bir xil
- [x] Tipografika shkalasi presetda; `text-5xl` kabi ixtiyoriy o'lchamlar kodda qolmagan
- [x] `Empty`, `ErrorView`, `Loading`, `Skeleton` kitda
- [x] `npm run check` va uchala ilova build ✅

**Nima qilindi:**

| Fayl | O'zgarish |
|---|---|
| `packages/design-system/tailwind-preset.js` | 11 o'lchamli tipografika shkalasi, `--surface-3`, `--border-accent`, `primarySoft`, status ranglari, `bg-primary-grad`, `h-control`, `scale-97`, `opacity-45`, `animate-pulse-soft`. `tracking-label` 0.1em → **0.145em** (ilovadagi 1.6px) |
| `packages/ui-web/` (yangi) | `Button`, `Field`, `Card`, `Chip`, `SectionHeader`, `Empty`, `ErrorView`, `Loading`, `Skeleton*`, `StatusBadge`, `Icon` (44 nom, ilova bilan bir xil), `GarmentIcons`, sozlangan `cn` |
| `apps/web/` | 10 fayl shkalaga o'tkazildi; `Button`/`Field` kitdan; shapka 64 → 72px (ichida 52px tugma turadi); karta burchagi 12 → 16px |
| `apps/web/src/components/ui/` | `button.tsx`, `input.tsx`, `label.tsx` **o'chirildi** — ikkinchi Button aynan shu tarzda drift keltirib chiqaradi |

**Ochiq qolgani:** kit hozircha faqat `apps/web` da. `store-panel` va
`admin-panel` unga keyinroq o'tadi — preset o'zgarishi ularga ham tegdi va
ikkalasi ham quriladi, lekin komponentlari hali shadcn standartida.

#### WEB-02 · To'rt til va RTL (3 kun)

`packages/i18n`, mobil lug'atlar ko'chirilgan, RTL, shriftlar.

- [ ] Mobil ilova `packages/i18n` dan o'qiydi; `dictionaries.ts` nusxasi **yo'q**
- [ ] Arabcha sahifada `dir="rtl"`, ikonkalar ko'zguda, 3D sahna ko'zguda **emas**
- [ ] ESLint: `pl-`/`pr-` va JSX ichida qattiq matn — xato
- [ ] Til almashtirilganda **o'sha sahifada** qolinadi

#### WEB-03 · Marketing sahifalari (4 kun)

Bosh sahifa ilova maketiga keltiriladi (hero, brendlar, trend, kategoriya,
limited), `how-it-works`, `for-stores`, `download`.

- [ ] Bosh sahifa bo'limlari ilovadagi `(tabs)/index.tsx` tartibiga mos
- [ ] Hero: `poster` darrov, 3D keyin — bo'sh quti hech qachon ko'rinmaydi
- [ ] `for-stores` → `store.looksave.app/apply` ga o'tadi
- [ ] To'rt tilda to'liq tarjima

#### WEB-04 · Huquqiy, SEO, ulashish (2–3 kun)

- [ ] `/privacy` **yuz surati bandi bilan**, `/terms`, `/cookies`, `/returns` — to'rt tilda
- [ ] `hreflang` (4 + `x-default`), `canonical`, `sitemap.xml`, `robots.txt`
- [ ] Havola Telegram, WhatsApp, X'da karta bilan chiqadi
- [ ] Cookie banneri; rad etilsa analitika yuklanmaydi
- [ ] **Deploy:** `looksave.app` ochiq, `08-deployment.md` yangilangan

### Reliz R2 · «Katalog» — ko'rish va kiyib ko'rish (~3 hafta)

#### WEB-05 · Katalog, filtr, qidiruv 🟡 ASOSIY QISMI ISHLAYDI (2026-08-29)

- [x] Filtr URL'da: `?q=&category=&brand=&sort=&only3d=&limited=` — havola ulashilganda o'sha natija
- [x] SSR: mahsulot ro'yxati serverda chiziladi
- [x] Bo'sh natija — `Empty`, filtrni tozalash tugmasi bilan
- [x] «Yana yuklash» — kursor bilan, `useFetcher` orqali qo'shib boriladi
- [ ] `/c/:slug` alohida SSR sahifa (hozircha katalogga yo'naltiradi)
- [ ] Yon filtr paneli (desktop) va narx oralig'i — hozircha chiplar

#### WEB-06 · Mahsulot sahifasi 🟡 ASOSIY QISMI ISHLAYDI (2026-08-29)

- [x] Gallereya (kichik rasmlar + katta rasm), rang varianti, o'lcham, do'kon bloki, ishonch qatori, tavsif
- [x] `og:title` / `og:image` — mahsulotning haqiqiy rasmi
- [x] O'lcham tanlanmaguncha CTA o'chiq va «o'lchamni tanlang» yozuvi
- [ ] `Product` JSON-LD
- [ ] O'lcham maslahati (profil o'lchovlariga qarab)

#### WEB-07 · 3D studiya (4 kun)

- [ ] To'liq slot to'plami; svayp bilan almashtirish
- [ ] Mehmon ham kiyib ko'radi (o'lchov kiritsa moslashadi)
- [ ] WebGL yo'q → 360° surat aylanmasi, xato xabari emas
- [ ] Klaviatura bilan aylantirish ishlaydi

#### WEB-11 · Do'konlar 🟡 RO'YXAT ISHLAYDI (2026-08-29)

- [x] Do'konlar ro'yxati, masofa (300 km chegarasi bilan)
- [x] Joylashuv: server bozor markazidan boshlaydi, foydalanuvchi ruxsat bersa aniqlashadi
- [x] Do'kon sahifasi: mahsulotlari, manzil, telefon, ish holati
- [x] Xarita (Google Maps, qorong'i uslub) — kalitsiz ham ishlaydi, ro'yxatga tushadi
- [ ] `LocalBusiness` JSON-LD, «yo'nalish» tugmasi

⚠️ **Topilgan:** `GET /v1/stores/nearby` `lat`/`lng` ni **majburiy** talab
qiladi (ularsiz 422). Hujjatda «joylashuvsiz ham ishlaydi» deb yozilgan
edi — noto'g'ri. Sayt bozor markazidan boshlaydi.

### Reliz R3 · «Xarid» — sessiya va buyurtma (~3 hafta)

#### WEB-08 · Auth va profil 🟡 ASOSIY QISMI ISHLAYDI (2026-08-29)

- [x] BFF sessiya: token `httpOnly` cookie'da, JS'da **yo'q** (`curl` bilan tekshirilgan)
- [x] Kirish, ro'yxat, chiqish; token muddati tugashidan 60 s oldin jimgina yangilanadi
- [x] Himoyalangan sahifalar `?next=` bilan kirishga yo'naltiradi
- [x] Profil bo'limi: karkas, ma'lumot tahriri, **o'lchovlar** va avatar shakli
- [ ] Sozlamalar, akkauntni o'chirish, yuz surati oqimi (WEB-09)
- [ ] Mehmon savati birlashuvi
- [ ] Sessiya cookie'si imzolangan, lekin **shifrlanmagan** — serverdagi saqlash (Redis/KV) qoladi

#### WEB-09 · AI kiyintirish (3 kun)

- [ ] Yuz surati — **belgilanmagan rozilik katakchasi** va maxfiylikka havola bilan
- [ ] Avatar va render holati qadamlar bilan ko'rsatiladi
- [ ] Render faqat tugma bosilganda so'raladi (kredit himoyasi)
- [ ] Sahifadan chiqib qaytilsa natija joyida

#### WEB-10 · Savat, checkout, buyurtmalar ✅ OQIM ISHLAYDI (2026-08-29)

- [x] Savat do'kon bo'yicha guruhlanadi; son o'zgartirish va o'chirish server tomonida
- [x] `pickup`/`delivery`, validatsiya `@looksave/validation` dagi `createOrderSchema` dan — server bilan bitta sxema
- [x] `Idempotency-Key` **loader'da** yasaladi, har yuborishda emas
- [x] Buyurtma ro'yxati va tafsiloti; `StatusBadge` ranglari ilova bilan bir xil
- [x] To'lov matni tarjima qilinadigan joyda
- [x] **Uchdan uchgacha tekshirildi:** ro'yxatdan o'tish → savatga → checkout → `LS-260829-0001` buyurtmasi yaratildi
- [ ] Mahsulot ro'yxati serverda savatdan qayta o'qiladi (brauzerga ishonilmaydi) — bajarildi, lekin bir do'kon uchun; ko'p do'konli buyurtma sinalmagan

#### WEB-12 · Sayqal: ishlash, a11y, testlar (4 kun)

- [ ] §12 byudjeti CI'da; buzilsa build yiqiladi
- [ ] `axe` toza; xarid yo'li sichqonchasiz o'tiladi
- [ ] Playwright: asosiy yo'l + arabcha RTL
- [ ] Lighthouse mobil ≥ 92

---

## 19. Tayyor deb hisoblanadi, agar

Bitta ro'yxat — relizlardan mustaqil, yakuniy holat:

- [ ] To'rt til, arabcha RTL bilan; qattiq yozilgan matn yo'q
- [ ] §6.2 dagi o'nta uzilish yopilgan — sayt va ilova yonma-yon qo'yilganda **bitta mahsulotdek** ko'rinadi
- [ ] Mahsulot sahifasi Google'da indekslanadi va rich result beradi
- [ ] Eng katta bo'lak gzip < 200 KB, LCP < 2 s, Lighthouse ≥ 92
- [ ] Mehmon: ko'radi, kiyib ko'radi, savatga soladi. Kirgan: buyurtma beradi
- [ ] `/privacy` da yuz surati bandi bor
- [ ] `looksave.app` ochiq, CI deploy qiladi, rollback bir bosishda

---

## 20. Bu hujjatdan keyin yangilanadigan hujjatlar

| Hujjat | Nima o'zgaradi |
|---|---|
| `00-README.md` | 13-qator `⏳ IP-05` → `✅`; qarorlar jadvaliga S-01…S-09 |
| `12-tz.md` | IP-05 shu hujjatga havola bilan almashtiriladi; D-20…D-26 shu yerda yopiladi |
| `06-dizayn.md` | §12 «Web panellar bilan moslik» → sayt ham qo'shiladi; yangi tokenlar |
| `08-deployment.md` | Sayt deployi, Cloudflare, CI |
| `05-mobile.md` | i18n endi `packages/i18n` da |
| `apps/web/README.md` | Bo'lim jadvali → sahifalar jadvali |
| `15-sayt-dizayn.md` | Har sahifa chizilgach — haqiqiy maket bilan solishtirib yangilanadi |

---

## 21. Bu ishga kirmaydi

- Onlayn to'lov — K-10 kuchda, alohida qaror va litsenziya kerak
- Do'kon kabinetini saytga ko'chirish — `store.looksave.app` da qoladi
- Blog, yangiliklar, kontent tizimi — bozor tasdiqlanganidan keyin
- Native ilova funksiyalari: push, kamera skaneri, offline rejim
- Tailwind v4 ga o'tish — uchala ilovaga tegadi, alohida ish
