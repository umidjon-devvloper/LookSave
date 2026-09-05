# 15 — Sayt dizayni: sahifa-sahifa

**Bog'liq:** [13-sayt.md](./13-sayt.md) · [06-dizayn.md](./06-dizayn.md) · [05-mobile.md](./05-mobile.md)
**Kit:** `packages/ui-web` · **Tokenlar:** `packages/design-system/tailwind-preset.js`

---

## 0. Bu hujjat nima

`13-sayt.md` — **reja**: qanday qamrov, qanday arxitektura, qaysi paket
qachon. Bu hujjat — **dizayn**: har bir sahifa nimaga o'xshaydi, ilovadagi
qaysi ekranga tenglashadi va nega aynan shunday.

Ikkisi ajratilgan, chunki ular boshqa tezlikda o'zgaradi: reja reliz
chiqqach yopiladi, dizayn esa har sahifa qo'shilganda o'sib boradi.
`05-mobile.md` mobil ekranlar uchun nima bo'lsa, bu hujjat sayt uchun shu.

⚠️ **WEB-01 shu hujjatning poydevorini qo'ydi:** rang, tipografika va
komponent kiti tayyor va o'lchangan. Bu yerda ular **qanday
joylashtirilishi** yoziladi.

---

## 1. «Premium» — o'lchanadigan ta'rif

«Premium» so'zi o'zicha hech narsa demaydi. Quyida u yettita qoidaga
bo'lingan, har biri tekshirib bo'ladigan.

### 1.1 Ritm va to'r

| Element | Qiymat |
|---|---|
| Matn konteyneri | `max-w-6xl` (72rem / 1152px) — hozirgi `.shell` |
| To'r konteyneri | `max-w-[90rem]` (1440px) — katalog, mahsulot to'ri uchun **yangi** `.shell-wide` |
| Chekka padding | 20px → 32px (`sm:`) → 40px (`xl:`) |
| Bo'lim oralig'i | `clamp(4rem, 8vw, 7rem)` |
| Bo'lim ichida blok oralig'i | 2.5rem |
| Karta oralig'i | 16px (mobil) → 24px (desktop) |
| Matn qatori | ≤ 68 belgi (`.prose`) |

⚠️ **Ikkita konteyner kengligi ATAYIN.** Matn 1152px dan keng bo'lsa
o'qilmaydi; mahsulot to'ri esa 1152px da desktopda uch ustun bo'lib
qoladi va sahifa bo'sh ko'rinadi. Bitta kenglik ikkalasini ham buzadi.

Barcha oraliqlar **4px** ga karrali (ilovadagi `spacing` shkalasi:
4/8/16/24/32/48). Tailwind ning `gap-3` (12px) kabi oraliq qiymatlari
ishlatilmaydi — ular shkaladan tashqarida.

### 1.2 Harakat tizimi

Ilovada bosish `Animated.spring(speed 40, bounciness 4)`, paydo bo'lish
700 ms. Web muqobili:

| Muddat | Nima uchun | Egri chiziq |
|---|---|---|
| **120 ms** | rang, fon, chegara (hover) | `ease-out` |
| **150 ms** | transform: bosish, karta ko'tarilishi | `ease-spring` |
| **220 ms** | panel, sheet, dropdown ochilishi | `ease-spring` |
| **320 ms** | sahifa o'tishi (View Transition) | `ease-out` |
| **700 ms** | bo'lim `rise` — scroll bilan, **bir marta** | `ease-spring` |
| **1800 ms** | skeleton pulsi | `ease-in-out` |

**Taqiqlanadi:** parallax, scroll-jacking, o'zi aylanadigan karusel,
harflab yoziluvchi matn, sahifa yuklanishida uzoq «kirish» sahnasi.
Bularning hammasi tez ko'rinishni sekinlashtiradi — premium teskarisi.

`prefers-reduced-motion` da hammasi 0.01 ms (allaqachon `index.css` da).

### 1.3 Rasm

Katalogda rasm — sahifaning 80% og'irligi va LCP ning sababi.

| Qoida | Tafsilot |
|---|---|
| Nisbat | Mahsulot **3:4** (ilovadagidek), do'kon 16:9, brend logotipi `contain` |
| `width`/`height` | **Majburiy.** Bo'lmasa CLS o'sadi va sahifa sakraydi |
| Format | AVIF → WebP → JPEG, `<picture>` bilan |
| `srcset` | 320 / 480 / 640 / 960 / 1280 |
| Yuklanish | Birinchi ekrandan tashqarida `loading="lazy"`; hero'da `fetchpriority="high"` |
| O'rin | Kelgunicha `bg-surface` + skeleton, keyin 200 ms `fade-in` |
| Foto ustidagi matn | **Doim** gradient scrim ostida — ilovadagi qoida (`home/Hero.tsx`) |

### 1.4 Chuqurlik — soya va nur

Qorong'i fonda soya deyarli ko'rinmaydi, shuning uchun **chegara birinchi
vosita**, soya ikkinchi.

| Vosita | Qayerda | Cheklov |
|---|---|---|
| `border-border` | Hamma karta, maydon, panel | — |
| `border-borderStrong` | Hover, ta'kidlangan blok | — |
| `shadow-card` | Ko'tarilgan karta (modal, hero karta) | Ro'yxat kartalarida **yo'q** |
| `shadow-glow` | Asosiy CTA | **Bir sahifada ko'pi bilan 2 marta** |
| `backdrop-blur-xl` | Faqat shapka va modal orqa foni | Boshqa joyda yo'q |

⚠️ **Nur qadrini yo'qotmasin.** Deckdagi hissiyot nurlanuvchi binafshadan
keladi, lekin har tugma yonib tursa ko'z ko'nikadi va hech biri urg'u
bermaydi. Bitta sahifada bitta «bosh» tugma.

### 1.5 Zichlik

Ilova zichligi telefon uchun tanlangan. Saytda:

| | Ilova | Sayt |
|---|---|---|
| Karta oralig'i | 8–16px | 16–24px |
| Bo'lim oralig'i | 16px | 64–112px |
| Ustunlar | 2 | 2 → 3 → 4 |
| Asos shrift | 15px | 16px (`text-base`), UI elementlarida 15px (`text-body`) |

⚠️ Zichlikni oshirish — «ko'proq mahsulot ko'rsatish» vasvasasi. Premium
katalogda bo'sh joy mahsulotdan kam ahamiyatli emas.

### 1.6 Mikro-o'zaro ta'sirlar

| Element | Hover | Bosilganda | `:focus-visible` |
|---|---|---|---|
| Asosiy tugma | `brightness-110` | `scale-97` | 2px `ring` + 2px oraliq |
| Ghost tugma | `bg-surface3` | `scale-97` | shu |
| Mahsulot kartasi | `-translate-y-0.5` + `border-borderStrong` | — | ring butun karta atrofida |
| Karta rasmi | `scale-105` (rasm ichida, karta emas) | — | — |
| Chip | `bg-surface3` | — | ring |
| Havola | `text-foreground` (dan `muted`) | — | ring |
| Maydon | `border-borderStrong` | — | chegara `borderAccent` + fon `surface2` |
| Ikonka tugma | `bg-accent` | `scale-97` | ring |

⚠️ **Karta rasmi kattalashadi, kartaning o'zi emas.** Karta kattalashsa
qo'shni kartalar suriladi va to'r «nafas oladi» — bu arzon ko'rinadi.
Rasm `overflow-hidden` ichida kattalashsa, tashqi o'lcham qimirlamaydi.

### 1.7 Kutish xoreografiyasi

| Holat | Nima ko'rinadi |
|---|---|
| Birinchi yuklanish (SSR) | To'liq HTML — skeleton **umuman yo'q** |
| Ichki navigatsiya | Skeleton (kontent shaklida), 200 ms dan uzoq bo'lsa |
| Rasm | `bg-surface` → 200 ms `fade-in` |
| 3D | `poster` rasm + «Kiyib ko'rish» tugmasi → bosilgach canvas |
| AI render | Qadamlar bilan: «avatar tayyorlanmoqda» → «kiyim kiydirilmoqda» |
| Forma yuborilmoqda | Tugma ichida spinner, matn o'rnida (kitda bor) |

**Hech qachon:** butun sahifa o'rtasida yolg'iz spinner.

### 1.8 Taqiqlar ro'yxati

- Oq yoki och fon — hech qayerda (06-dizayn.md §2)
- Sof qora `#000` — fon `#0A0A0F`, u binafsha tusli
- Brauzerning standart ko'k havolasi va standart fokus halqasi
- Emoji ikonka sifatida — faqat Lucide va `GarmentIcons`
- Stok fotolar — faqat haqiqiy mahsulot va do'kon suratlari
- Gradient matn — brend nomidan boshqa joyda
- Bitta ekranda 3 dan ortiq shrift og'irligi
- Markazga tekislangan uzun matn (2 qatordan ortiq)

---

## 2. Tenglik chegarasi

«Ilova bilan bir xil» — bu telefon ekranini cho'zish emas. Chegara:

### Aynan ko'chiriladi

- Rang shkalasi va ularning ma'nosi
- Tipografika nisbatlari, `letter-spacing`
- Burchak radiuslari (chip 999, tugma 12, karta 16, modal 28)
- Komponent anatomiyasi: tugma, maydon, chip, bo'sh/xato holati
- Ikonka to'plami va `strokeWidth: 1.75`
- **Mahsulot kartasi anatomiyasi:** 3:4 rasm, yurakcha o'ngda tepada
  (`rgba(10,10,15,0.55)` doira), «3D» belgisi chapda tepada
  (`primarySoft` + `borderAccent`), nom, narx
- Holat matnlari va ularning ohangi

### Moslashadi

| Ilova | Sayt |
|---|---|
| Pastki tab bar (5 ta) | Yuqori shapka + futer |
| To'liq ekran modal | Markazdagi dialog (desktop), pastdan sheet (mobil) |
| Bottom sheet filtr | Yon panel (desktop), sheet (mobil) |
| Hero 540px | Hero `min-h-[70vh]`, ikki ustunli |
| Gorizontal svayp gallereya | To'r + katta rasm (desktop), svayp (mobil) |
| 2 ustun | 2 → 3 → 4 |
| Pull-to-refresh | Yo'q — brauzer o'zi yangilaydi |

### Hech qachon ko'chirilmaydi

- Safe-area insets (`useSafeAreaInsets`) — brauzerda ma'nosi yo'q
- Pull-to-refresh va uning belgisi
- Svayp bilan navigatsiya yagona yo'l sifatida (klaviatura ishlamaydi)
- Native haptic va tovush
- «Orqaga» tugmasi shapkada — brauzerda o'z tugmasi bor

---

## 3. Umumiy karkas

### 3.1 Shapka (72px)

```
┌──────────────────────────────────────────────────────────────┐
│ [◆] L O O K S A V E   Katalog Kiyintirish Do'konlar   ⌕ 🌐 ♡ 🛍 ⟨kirish⟩ │
└──────────────────────────────────────────────────────────────┘
```

| Element | Tafsilot |
|---|---|
| Balandlik | 72px (ichida 52px tugma qisilmasin — WEB-01) |
| Fon | Tepada shaffof, scroll > 24px da `bg-background/85` + `backdrop-blur-xl` + pastki chegara |
| Kenglik | **`.shell-wide` (1440px)** — sahifa konteyneri bilan bir xil. `.shell` (1152px) bo'lganda logotip katalog to'ri bilan tekislanmasdi va shapka «boshqa sahifadan» ko'chirilgandek turardi |
| Logotip | Ilovadagi belgi (`assets/logo-mark.png`, 32px balandlik) + `LookSave` so'zi — `app/(tabs)/index.tsx` dagidek |
| Menyu | `Katalog` · `Do'konlar` · `Kiyintirish`. ⚠️ Kategoriyalar shapkada **emas**: ular tekis ro'yxatga qo'shilganda oltita havola chiqib, o'ng chekkadagi tugmalarga tiqilib qolardi. Ularning joyi — «Katalog» ustidagi mega-menyu |
| Qidiruv | Ikonka → bosilganda kengayadigan maydon (desktop), alohida sahifa (mobil) |
| Til | `🌐` + dropdown: `O'zbekcha · Русский · English · العربية` |
| Savat | Ikonka + son belgisi (ilovadagi `cartBadge` bilan bir xil: 20px, `primary` fon) |
| Mobil | Logotip + savat + hamburger; menyu o'ngdan sheet bilan |

**Mega-menyu** (desktop, `Katalog` ustida): uch ustun — Erkaklar / Ayollar /
Kolleksiyalar, har birida kategoriya havolalari va o'ng tomonda bitta
banner rasm. Ochilishi 220 ms, `Esc` bilan yopiladi.

### 3.2 Futer

Uch qism: (1) to'rt ustunli havolalar — Kompaniya / Xaridorlar uchun /
Do'konlar uchun / Huquqiy; (2) ilova do'koni tugmalari + ijtimoiy tarmoq;
(3) pastki qator — til tanlagich, `© LookSave`, mamlakat.

⚠️ Futer **oq bo'lmaydi** va fon `bg-panel` (`#0F0D16`) — asosiy fondan
bir zina ochiq, shunda sahifa tugagani ko'rinadi.

### 3.3 Sahifa karkasi

Har sahifa bir xil ritmda: `shapka → (breadcrumb) → sarlavha bloki →
kontent → CTA bloki → futer`. Breadcrumb faqat katalog ichida
(`Bosh → Erkaklar → Kurtkalar`) va u `BreadcrumbList` JSON-LD ga ham
kiradi (13-sayt.md §11).

---

## 4. Sahifalar

Har bir sahifa uchun: ilovadagi juftligi, maket, web'ga xos qo'shimchalar,
uch holat va bitta «premium tafsilot» — o'sha sahifani esda qoldiradigan
narsa.

### 4.1 Bosh sahifa — `/:l`

**Ilovadagi juftlik:** `app/(tabs)/index.tsx` + `components/home/Hero.tsx`

| Blok | Maket |
|---|---|
| **Hero** | Ikki ustun (`1.05fr 0.95fr`), `min-h-[70vh]`. Chapda: `eyebrow` → `text-hero` sarlavha → `text-lead` → ikki tugma → uchta ko'rsatkich. O'ngda: 3D avatar sahnasi (poster bilan) |
| **Ishonch qatori** | Uchta belgi: `authentic` / `delivery` / `premium` — ilovadagi `badges` bilan bir xil ikonka va matn |
| **TOP BRANDS** | `SectionHeader` + logotip kafellari. Ilovada 86×64; saytda 120×80, 6 → 8 ta ko'rinadi, ortiqchasi gorizontal scroll |
| **TRENDING NOW** | Mahsulot to'ri: 2 → 3 → 4 ustun, 8 ta karta + «hammasi ›» |
| **Kategoriyalar** | ERKAKLAR / AYOLLAR / LIMITED — uchta katta karta, fon rasm + scrim + katta harfli nom |
| **Qanday ishlaydi** | Uch qadam, raqamlangan (bu haqiqiy ketma-ketlik) |
| **Kiyintirish** | 3D demo bloki + «o'z avataringizda ko'ring» CTA |
| **Do'konlar uchun** | Qisqa blok + `store.looksave.app` ga havola |

**Web'ga xos:** hero'da 3D **darrov yuklanmaydi** — poster rasm turadi,
`IntersectionObserver` yoki bosish bilan canvas keladi (322 KB, 13-sayt §12).

**Holatlar:** brend/mahsulot ro'yxati bo'sh bo'lsa butun blok chiziladi,
`Empty` emas — bosh sahifada bo'sh holat ko'rsatilmaydi, blok olib
tashlanadi.

**Premium tafsilot:** hero avatari sichqoncha bilan aylantiriladi va
o'lchov yozuvlari (180 cm / 82 kg / 42 EU) avatar bilan birga suriladi.

### 4.2 Katalog — `/:l/catalog`, `/:l/c/:slug`

**Ilovadagi juftlik:** `app/catalog.tsx` + `components/catalog/FilterSheet.tsx`

| Blok | Maket |
|---|---|
| Sarlavha | `text-h1` kategoriya nomi + topilgan soni (`text-small text-dim`) |
| Filtr | **Desktop:** chapda yopishqoq ustun (280px) — kategoriya, o'lcham, rang, narx, brend, «3D bor». **Mobil:** 52px filtr tugmasi (ilovadagidek, faol holatda `primary` chegara + `primarySoft` fon + son belgisi) → pastdan sheet |
| Saralash | O'ngda dropdown: yaqin / ommabop / yangi / narx ↑ / narx ↓ (ilovadagi `SORTS`) |
| Faol filtrlar | Sarlavha ostida `Chip` qatori, har birida `×`, oxirida «tozalash» |
| To'r | 2 → 3 → 4 ustun, `shell-wide` ichida |
| Sahifalash | «Yana yuklash» tugmasi + `IntersectionObserver`. **Cheksiz scroll yolg'iz emas** — futerga yetib bo'lmay qoladi |

**Web'ga xos:** filtr URL'da (`?size=M&color=black&sort=newest`) —
havola ulashilganda o'sha natija ochiladi va SSR uni serverda chizadi.

**Holatlar:** `SkeletonGrid` (ilovadagidek) · natija yo'q → `Empty`
(«Filtrni kengaytirib ko'ring» + eng yaqin kategoriya taklifi) · xato →
`ErrorView` tarmoq varianti bilan.

**Premium tafsilot:** filtr o'zgarganda to'r qayta yuklanmaydi — eski
kartalar 120 ms da 40% shaffoflikka tushadi, yangilari joyiga keladi.
Sahifa sakramaydi.

### 4.3 Mahsulot — `/:l/p/:slug-:id`

**Ilovadagi juftlik:** `app/product/[id].tsx`

| Blok | Maket |
|---|---|
| Karkas | Ikki ustun: chapda gallereya (60%), o'ngda ma'lumot (40%, yopishqoq) |
| Gallereya | **Desktop:** chapda vertikal kichik rasmlar + katta rasm; bosilganda to'liq ekran. **Mobil:** svayp + nuqtalar (ilovadagidek) |
| Belgilar | Rasm ustida: «3D» (chapda tepada), `limited` (oltin), chegirma foizi |
| Ma'lumot | Brend (`text-label`, `text-dim`) → nom (`text-h1`) → narx `text-price` + eski narx chizilgan |
| Do'kon | `Card` ichida: `shop` ikonkasi + nom + masofa + «do'konga o'tish ›» |
| Rang | `Chip` qatori — rangli doira + nom, tanlangani `borderAccent` |
| O'lcham | `Chip` qatori + «o'lcham jadvali» havolasi. Tanlanmasa CTA o'chiq va «o'lchamni tanlang» yozuvi (ilovadagi `panelHint`) |
| O'lcham maslahati | Profil o'lchovlari bo'lsa: «Sizga **M** to'g'ri keladi» — `primarySoft` fon, `accent` matn |
| Amallar | Asosiy: «Savatga» (gradient, to'liq kenglik). Yonida: `favorite` va `chat` ikonka tugmalari |
| Kiyintirish | Ghost tugma «3D da kiyib ko'rish» — sahifadan chiqmasdan modal ochadi |
| Ishonch | Uch element: `authentic` / `delivery` / `premium`, `accent` ikonka bilan |
| Tavsif | Akkordeon: Tavsif · Tarkib va parvarish · Yetkazish va qaytarish |
| Pastda | «Shu do'kondan yana» + «O'xshash mahsulotlar» to'ri |

**Web'ga xos:** o'ng ustun `sticky top-[6.5rem]` — uzun tavsifda ham narx
va «savatga» ko'rinib turadi. Mobilda pastda yopishqoq panel: narx +
«savatga».

**Holatlar:** skeleton gallereya + matn qatorlari · mahsulot yo'q → 404
sahifasi kategoriya taklifi bilan · omborda yo'q → CTA o'rnida «xabar
bering».

**Premium tafsilot:** rang almashtirilganda gallereya rasmlari 200 ms da
almashadi (`fade`), sahifa qolgan qismi qimirlamaydi. URL ham yangilanadi
— tanlangan rang havolada saqlanadi.

### 4.4 Kolleksiya va brend — `/:l/collection/:slug`, `/:l/brand/:slug`

**Ilovadagi juftlik:** `app/collection.tsx`

Katalog bilan bir xil to'r, ustida **muharrir bloki**: to'liq kenglikdagi
banner (16:9 desktop, 4:5 mobil), scrim, `text-hero` nom, qisqa tavsif.
`LIMITED` kolleksiyasida barcha urg'u `limited` (oltin) rangda —
chegara, belgi, sanoq (`3 kun qoldi`).

**Premium tafsilot:** limited kolleksiyada sanoq jonli (`3 kun 14:22`) va
u faqat shu sahifada — boshqa joyda sanoq yo'q, shuning uchun u shoshiltirmaydi,
xabar beradi.

### 4.5 Do'konlar va do'kon — `/:l/stores`, `/:l/store/:id`

**Ilovadagi juftlik:** `app/stores.tsx`, `app/store/[id].tsx`, `components/StoreMap.tsx`

| Sahifa | Maket |
|---|---|
| Ro'yxat | Ikki ustun: chapda kartalar ro'yxati (400px), o'ngda xarita (yopishqoq, to'liq balandlik). Mobilda: xarita/ro'yxat almashtirgichi |
| Karta | Do'kon rasmi (16:9) + nom + masofa + ish holati (`Ochiq` yashil / `Yopiq` kulrang) + kategoriyalar |
| Do'kon sahifasi | Kover 16:9 → logotip + nom + ish holati → ish vaqti jadvali → xarita → mahsulotlar to'ri |

**Web'ga xos:** xarita markeri bosilganda ro'yxatdagi karta yorishadi va
scroll unga keladi. Xarita **qorong'i uslubda** (Google Maps `styles`) —
och xarita butun sahifani buzadi.

**Holatlar:** joylashuv berilmasa masofasiz ro'yxat + «joylashuvni
yoqing» bannerи · 300 km dan uzoq masofa **umuman yozilmaydi**
(`theme/format.ts` qoidasi).

**Premium tafsilot:** ish holati jonli — `Ochiq · 21:00 gacha` yoki
`Yopiq · ertaga 10:00 da ochiladi`.

### 4.6 Kiyintirish studiyasi — `/:l/try-on`, `/:l/tryon`

**Ilovadagi juftlik:** `app/ai/*`, `src/three/Scene3D.tsx`

| Blok | Maket |
|---|---|
| Sahna | Markazda, to'q fon (`#050509`), oyoq ostida binafsha nur, konsentrik halqalar (06-dizayn §8) |
| Boshqaruv | Sahna ostida: `rotate` / `zoom` / `reset` ikonka tugmalari |
| Slotlar | O'ngda vertikal panel: bosh / ust / tashqi / past / oyoq / bilak / sumka. Har slotda gorizontal kiyim qatori |
| O'lchov | Chapda: bo'y / vazn / o'lcham — bosilganda tahrirlanadi |
| AI | Pastda: «Realistik surat» tugmasi + qancha kredit turishi |
| Mehmon | Kirmagan odam 3D ni to'liq ishlatadi; AI uchun «kirish» so'raladi |

**Web'ga xos:** sichqoncha bilan aylantirish, g'ildirak bilan zoom, ikki
barmoq bilan pan; klaviatura: `←` `→` aylantirish, `+` `−` zoom, `0`
reset. WebGL yo'q → 360° surat aylanmasi (12 kadr), xato xabari emas.

**Holatlar:** model yuklanmoqda → sahna ichida progress halqasi ·
AI render → qadamlar matni · xato → `ErrorView` + «qayta urinish».

**Premium tafsilot:** kiyim almashtirilganda avatar qotib qolmaydi —
eski model 150 ms da so'nadi, yangisi shu vaqtda paydo bo'ladi. Sahna
hech qachon bo'sh ko'rinmaydi.

### 4.7 Savat — `/:l/cart`

**Ilovadagi juftlik:** `app/(tabs)/cart.tsx`, `components/CartArt.tsx`

Ikki ustun: chapda do'kon bo'yicha guruhlangan mahsulotlar, o'ngda
yopishqoq hisob-kitob (`Card`): mahsulotlar / yetkazish / **jami** →
«Rasmiylashtirish» tugmasi.

Har guruh sarlavhasi: do'kon nomi + masofa + o'sha do'kon uchun oraliq
jami. Qator: 56px rasm + nom + rang/o'lcham + son o'zgartirgich
(`−` `1` `+`) + o'chirish.

**Bo'sh savat:** ilovadagi `CartArt.tsx` rasmi bilan **bir xil**
kompozitsiya + «Katalogga o'tish» tugmasi.

**Premium tafsilot:** son o'zgarganda jami raqami sakramaydi — eski va
yangi qiymat 150 ms da almashadi (`tabular-nums` bilan kenglik o'zgarmaydi).

### 4.8 Checkout — `/:l/checkout`

**Ilovadagi juftlik:** `app/checkout.tsx`

Bitta ustun (`max-w-2xl`), o'ngda buyurtma xulosasi (desktop). Qadamlar
**bitta sahifada**, sehrgar emas: (1) aloqa, (2) yetkazish turi —
`pickup` / `delivery` ikkita katta tanlov kartasi ikonkasi bilan,
(3) manzil (faqat `delivery` da), (4) izoh, (5) xulosa va tugma.

⚠️ **To'lov maydoni yo'q** (K-10). Xulosa ostida aniq yozuv:
«To'lov do'konda» yoki «To'lov yetkazib berilganda» — **tarjima
qilingan**, ilovadagi qattiq matn xatosi takrorlanmaydi (13-sayt §7.5).

**Holatlar:** maydon xatosi `Field` ning `error` propi orqali · yuborish
→ tugmada spinner · muvaffaqiyat → buyurtma sahifasiga o'tadi.

**Premium tafsilot:** `pickup` tanlanganda yetkazish narxi qatori
o'chmaydi — `0` ga aylanadi va so'nadi. Jami o'zgargani ko'rinib turadi.

### 4.9 Buyurtmalar — `/:l/orders`, `/:l/order/:id`

**Ilovadagi juftlik:** `app/orders.tsx`, `app/order/[id].tsx`

Ro'yxat: uch tab (`Faol` / `Tugagan` / `Bekor`), har qator — 56px rasm +
buyurtma raqami + `StatusBadge` (kitda bor) + do'kon + jami.

Tafsilot: status vaqt chizig'i (yuborildi → ko'rildi → tasdiqlandi →
tayyor), mahsulotlar, manzil, do'kon aloqasi, «bekor qilish» (agar mumkin).

**Premium tafsilot:** vaqt chizig'ida joriy qadam nurlanadi
(`shadow-glow` kichik variantda), o'tganlari `success`, kelajagi `border`.

### 4.10 Profil, o'lchovlar, yuz surati — `/:l/profile/*`

**Ilovadagi juftlik:** `app/(tabs)/profile.tsx`, `app/settings/*`

Chapda yopishqoq menyu (Profil · O'lchovlar · Avatar · Buyurtmalar ·
Saqlanganlar · Sozlamalar · Chiqish), o'ngda kontent.

**O'lchovlar** — ilovadagi `MeasureIcons.tsx` ikonkalari bilan bir xil:
har o'lchov uchun ikonka + nom + maydon + `sm` birligi.

**Yuz surati** — eng nozik sahifa:
- Nima uchun kerakligi bir xatboshida
- **Belgilanmagan** rozilik katakchasi: «Suratim serverga va kiyintirish
  provayderiga (FASHN) yuborilishiga roziman»
- `/privacy` ga havola shu yerda
- «O'chirish» tugmasi doim ko'rinadigan joyda

**Premium tafsilot:** o'lchov kiritilganda o'ng tomondagi avatar
darhol o'zgaradi — raqam va natija bir ekranda.

### 4.11 Kirish va ro'yxat — `/:l/sign-in`, `/:l/sign-up`

**Ilovadagi juftlik:** `app/(auth)/*`

Ikki ustun: chapda forma (`max-w-md`), o'ngda brend bloki (avatar surati +
`text-hero` bitta jumla). Mobilda faqat forma.

Maydonlar `Field` bilan, tugma to'liq kenglikda. Xato **maydon ostida**,
sahifa tepasida emas.

**Premium tafsilot:** telefon maydoni yozilayotganda formatlanadi
(`+998 90 123 45 67`) — `theme/format.ts` dagi qoida bilan bir xil.

### 4.12 Marketing sahifalari

`/how-it-works` — uch qadam, har biri katta rasm + matn, navbatma-navbat
chapdan o'ngga. `/for-stores` — muammo → yechim → foyda → ariza CTA.
`/download` — ilova skrinshotlari (telefon ramkasida, deckdagidek
binafsha chegara + nurlanish) + do'kon tugmalari.

### 4.13 Huquqiy sahifalar

Bitta ustun (`max-w-3xl`), chapda yopishqoq mundarija. Tipografika:
`text-h2` bo'lim, `text-body` matn, qator oralig'i 1.7. Oxirgi
yangilanish sanasi tepada.

⚠️ Huquqiy matn **bezaklanmaydi** — karta, ikonka, gradient yo'q.
Bu yerda o'qilishi va ishonch muhim.

### 4.14 Xato sahifalari

`404` — `Empty` komponenti asosida: 64px doira, «Bunday sahifa yo'q»,
ostida uchta mashhur kategoriya havolasi va qidiruv maydoni.
`500` — `ErrorView`, «qayta urinish» tugmasi bilan.
`/offline` — tarmoq varianti (`variant="network"`).

⚠️ Xato sahifasida ham shapka va futer qoladi — yalang'och xato sahifasi
saytdan chiqib ketgandek tuyuladi.

---

## 5. Komponent qarzi

WEB-01 kitni ochdi, lekin yuqoridagi sahifalar uchun yetmaydi. Quyidagilar
**`packages/ui-web` ga** qo'shiladi — `apps/web` ichiga emas, aks holda
store-panel ularni qayta chizadi.

| Komponent | Nima uchun | Qaysi paketda |
|---|---|---|
| `ProductCard` | 3:4 rasm, yurakcha, «3D» belgisi, nom, narx — ilovadagi anatomiya | WEB-05 |
| `ImageFrame` | Nisbat + skeleton + `fade-in` + `srcset`. **Har rasm shu orqali** | WEB-05 |
| `PriceTag` | Narx + eski narx + chegirma foizi | WEB-05 |
| `Select` | Saralash, til, o'lcham jadvali | WEB-05 |
| `FilterPanel` | Desktopda ustun, mobilda sheet — bitta komponent, ikki ko'rinish | WEB-05 |
| `Breadcrumb` | Katalog ierarxiyasi + JSON-LD manbai | WEB-05 |
| `Gallery` | Kichik rasmlar + katta rasm + to'liq ekran | WEB-06 |
| `Accordion` | Tavsif bloklari (shadcn bor, kit uslubiga keltiriladi) | WEB-06 |
| `SlotRail` | Kiyintirishdagi slot va kiyim qatori | WEB-07 |
| `QuantityStepper` | `−` `1` `+` | WEB-10 |
| `Timeline` | Buyurtma statusi qadamlari | WEB-10 |
| `StoreCard` | Do'kon kartasi + ish holati | WEB-11 |
| `Dialog` / `Sheet` | shadcn bor, lekin burchak 28px (`radius.xxl`) ga keltiriladi | WEB-05 |
| `Money` | `packages/i18n` dagi formatlash ustida | WEB-02 |

⚠️ **`ImageFrame` birinchi bo'lib yoziladi.** Har sahifada rasm bor va
`width`/`height` siz qo'yilgan bitta rasm ham CLS byudjetini buzadi
(13-sayt §12).

---

## 6. To'rt til — dizaynga ta'siri

### 6.1 Maket

| Til | Nima o'zgaradi |
|---|---|
| `en` | Asos. Barcha o'lcham shunga sozlangan |
| `uz` | Matn ≈ 15% uzun — tugma va chip **kenglikka moslashadi**, qat'iy `w-*` yo'q |
| `ru` | Matn ≈ 20% uzun, so'zlar uzun. Ikki qatorli tugma matni **taqiqlanadi** — qisqartiring |
| `ar` | RTL: `dir="rtl"`, mantiqiy xossalar, ikonkalar ko'zguda. 3D sahna ko'zguda **emas** |

### 6.2 Tipografika

| | Lotin/Kirill | Arab |
|---|---|---|
| Shrift | Inter Variable | IBM Plex Sans Arabic |
| Qator oralig'i | Shkaladagidek | **+0.15** (arab harflari baland, tigiz qator o'qilmaydi) |
| `letter-spacing` | Shkaladagidek | **0** — arabchada harflar bog'lanadi, oraliq so'zni buzadi |
| KATTA HARF | Faqat inglizcha yorliq | **Yo'q** — arabchada katta harf tushunchasi yo'q |

⚠️ `text-label` arabchada `letter-spacing: 0` va `text-transform: none`
bo'lishi kerak. Bu CSS da `:lang(ar)` orqali beriladi, komponentda emas —
aks holda har chaqiruvda shart yozishga to'g'ri keladi.

### 6.3 Raqam va narx

Lotin raqamlari (`numberingSystem: 'latn'`) — BAA'da narxlar shunday
yoziladi. `tabular-nums` hamma joyda: narx, jami, o'lchov, sanoq.
Valyuta do'kondan keladi (`AED` / `UZS`), formatlash `packages/i18n` da.

---

## 7. Dizayn qanday qabul qilinadi

Har bir yangi sahifa quyidagi ro'yxatdan o'tadi. O'tmasa — tayyor emas.

- [ ] Komponent ichida **hex rang yo'q** — faqat token sinflari
- [ ] Shrift o'lchami **faqat shkaladan** (`text-h1`, `text-body`…), `text-lg` yo'q
- [ ] Oraliqlar 4px ga karrali
- [ ] Beshta holat chizilgan: normal · hover · `:focus-visible` · o'chiq · yuklanmoqda
- [ ] Uchta sahifa holati: yuklanmoqda (skeleton) · bo'sh (`Empty`) · xato (`ErrorView`)
- [ ] Har rasmda `width`/`height` — CLS 0
- [ ] Klaviatura bilan boshidan oxirigacha o'tiladi
- [ ] Kontrast ≥ 4.5:1 (`text-dim` faqat 15px+ da)
- [ ] Arabchada skrinshot olingan va maket buzilmagan
- [ ] Ilovadagi juftligi bilan **yonma-yon** qo'yilgan va farq tushuntirilgan
- [ ] Bitta ekranda bitta `shadow-glow`

⚠️ Oxirgi ikkitasi eng ko'p tashlab ketiladi va aynan ular
«bir xil mahsulot» hissini beradi.

---

## 8. Ish paketlariga bog'lanish

Bu hujjat `13-sayt.md` §18 dagi paketlarni almashtirmaydi — ularga
**mazmun** beradi:

| Paket | Shu hujjatning qaysi qismi |
|---|---|
| WEB-01 ✅ | §1.6 mikro-o'zaro ta'sirlar, kit poydevori |
| WEB-02 | §6 — to'rt til, arab shrifti, `Money` |
| WEB-03 🟡 | §3 karkas (shapka, futer) ✅, §4.1 bosh sahifa ✅, §4.12 marketing — qoldi |
| WEB-04 | §4.13 huquqiy sahifalar |
| WEB-05 | §4.2 katalog, §5 dagi `ImageFrame`, `ProductCard`, `FilterPanel` |
| WEB-06 | §4.3 mahsulot, `Gallery`, `Accordion` |
| WEB-07 | §4.6 kiyintirish studiyasi, `SlotRail` |
| WEB-08 | §4.10 profil, §4.11 kirish |
| WEB-09 | §4.10 yuz surati va rozilik |
| WEB-10 | §4.7 savat, §4.8 checkout, §4.9 buyurtmalar |
| WEB-11 | §4.5 do'konlar |
| WEB-12 | §7 qabul ro'yxati — hamma sahifa bo'yicha yurgiziladi |

---

## 8.1 Bajarilgan dizayn ishi (2026-08-29)

**Bosh sahifa (§4.1) qayta qurildi:**

| Nima | Qanday |
|---|---|
| Hero | Ilovadagi kompozitsiya: foto o'ngda, chapdan qorong'ilashuv, matn foto ustida (`components/home/Hero.tsx` bilan bir xil). Ilgari bu yerda 3D qutisi turardi va u ko'pincha **bo'sh** chiqardi |
| Balandlik | `min-h-[min(78vh,42rem)]` — baland ekranda hero ikki metrga cho'zilib, matn yo'qolib ketardi |
| Ishonch qatori | Ilovadagi uchta belgi: `authentic` / `delivery` / `premium` |
| TOP BRANDS | Haqiqiy brendlar, kafel o'lchami web uchun 120×80 |
| TRENDING NOW | Haqiqiy mahsulotlar, `ProductCard` kiti bilan |
| Kategoriyalar | `MEN` / `WOMEN` / `LIMITED` — ilovadagi haqiqiy suratlar, `LIMITED` oltin urg'uda (§4.1) |
| Tartib | Hero → ishonch → brendlar → trend → kategoriyalar → qanday ishlaydi → kiyintirish → do'konlar → erta kirish |

**Til yaxlitligi:** marketing bo'limlari inglizcha, interfeys o'zbekcha edi —
bitta sahifada ikki til. Hammasi o'zbekchaga o'tkazildi. (To'liq i18n —
hali ham WEB-02.)

**Olib tashlandi:** `Problem`, `Wardrobe`, `Marketplace` bo'limlari.
Birinchisi deck to'ldiruvchisi, qolgan ikkitasining o'rnini haqiqiy
katalog va kategoriyalar egalladi — ular qolsa sahifa bir narsani ikki
marta aytardi.

**Aktivlar:** `apps/mobile/assets/` dagi suratlar `apps/web/public/img/`
ga ko'chirildi (S-2 savolidagi «yangi surat sotib olish shart emas»
tasdiqlandi).

### Yo'lda topilgan uchta nosozlik

| Nosozlik | Sabab |
|---|---|
| **Butun sahifa xato chegarasini ko'rsatardi** | `TooltipProvider` o'chirilgan `App.tsx` da qolib ketgan edi. ⚠️ Xato **HTTP 200 ostida** yashiringan: React uni render paytida ushlaydi va chegarani chizadi, status esa 200 bo'lib qoladi. Shu sababli `scripts/smoke.mjs` yozildi — u statusni emas, **mazmunni** tekshiradi |
| **Do'konlar «topilmadi» deb ko'rsatardi** | Parametr `radius`, `radiusM` emas; ustiga `.catch(() => [])` server xatosini bo'sh ro'yxatdek ko'rsatardi. Endi xato va bo'shlik — ikki boshqa holat (§1.7) |
| **Matnda teskari tirnoq** | `'ko\`ring'` ekranda ` bo'lib chiqardi. 15 faylda tuzatildi |

---

### Katalog (§4.2) — 2026-08-29

| Element | Qanday |
|---|---|
| Maket | Ikki ustun: chapda **yopishqoq** filtr (17rem), o'ngda to'r. `shell-wide` (1440px) ichida |
| Mobil | Filtr 52px lik tugma ortidagi sheetga ko'chadi — faol holatda binafsha chegara va son belgisi, ilovadagi `catalog.tsx` bilan bir xil |
| Filtr guruhlari | Kimga · Kategoriya · Brend · **Narx** (min/max) · Qo'shimcha |
| Faol filtrlar | Sarlavha ostida chip qatori, har birida ×, oxirida «hammasini tozalash» |
| Saralash | O'ngda ro'yxat: ommabop / yangi / arzondan / qimmatdan / yaqin |
| To'r | 2 → 3 → 4 ustun |
| Sahifalash | «Yana yuklash» tugmasi (cheksiz scroll yolg'iz emas) |

Ilgari uchta chip qatori sahifa tepasida to'kilib yotardi va narx filtri
umuman yo'q edi (API uni boshidan qo'llab-quvvatlagan).

**Filtr komponenti `apps/web/src/components/CatalogFilters.tsx` da**, kitda
emas: u `Category`/`Brand` tiplariga bog'langan. `packages/ui-web` ga
chiqarish uchun avval umumiy «guruh + variant» shakliga keltirish kerak.

⚠️ **Topilgan, hal qilinmagan:** mahsulot suratlari **oq fonda**
(`Chino shim`, `Oq futbolka`…). Qorong'i saytda ular yorqin to'rtburchak
bo'lib turadi va §1.8 dagi «oq fon yo'q» qoidasiga zid. Ilovada ham
shunday. Yechim savdo tomonida: do'kon panelida fon talabini qo'yish yoki
yuklashda fonni olib tashlash (S-2 bilan bog'liq).

### Mahsulot sahifasi (§4.3) — 2026-08-29

| Element | Qanday |
|---|---|
| Rang | Endi haqiqiy nom va namuna (`colorName` + `colorHex`). Ilgari «Variant 1 / Variant 2» chiqardi — tip `color` deb yozilgan edi, serverda esa `colorName` |
| Narx | Variantga qarab o'zgaradi (`priceDelta`) |
| O'lcham | `available` va `stock` alohida hisobga olinadi; kam qolganda ogohlantirish |
| Tanlangan rang | **URL'da** (`?rang=`) — havola ulashilganda o'sha rang ochiladi |
| Tafsilotlar | Akkordeon: Tavsif · Yetkazish va qaytarish · Teglar (teglar katalog qidiruviga havola) |
| Shu do'kondan yana | O'sha do'konning 4 ta mahsuloti |
| Mobil | Pastda yopishqoq panel: narx + o'lcham holati + «Savatga» |
| `Product` JSON-LD | Nom, brend, rasm, narx, valyuta, mavjudlik, sotuvchi |

⚠️ **`<` EKRANLANADI** JSON-LD ichida. Mahsulot nomi va tavsifi do'kondan
keladi; ichida `</script>` bo'lsa u belgini erta yopib, qolganini HTML
sifatida sahifaga qo'yardi — do'kon paneli orqali ochiladigan XSS yo'li.
`JSON.stringify` bunday himoyani bermaydi.

⚠️ **«Sizga M to'g'ri keladi» YOZILMADI.** API `sizeChart` da faqat
`{ type, system }` beradi — haqiqiy o'lcham jadvali (santimetrlar) yo'q.
Bunday maslahat taxmin bo'lardi, noto'g'ri o'lcham esa aynan biz
yechmoqchi bo'lgan muammoni qaytaradi. O'lcham jadvali API'ga
qo'shilgach, §4.3 dagi «o'lcham maslahati» bandi ochiladi.

### Yana ikkita nom farqi

| Men yozgan | Serverda |
|---|---|
| `variant.color` | **`colorName`** (+ `colorHex`, `priceDelta`, `asset3d`) |
| `?store=` | **`?storeId=`** — noto'g'ri nom jimgina e'tiborsiz qoldirilgani uchun «shu do'kondan yana» bo'limida BOSHQA do'konlarning mahsulotlari chiqardi. Bu do'kon sahifasiga ham tegdi |

### Xato holati bir xillashtirildi

Mahsulot sahifasi API xatosida (masalan `RATE_LIMITED`) **yalang'och 500**
qaytarardi; katalog va do'konlar esa `ErrorView` va «qayta urinish»
ko'rsatardi. Endi uchalasi bir xil (§1.7).

### Savat va checkout (§4.7, §4.8) — 2026-08-29

**Savat:**

| Element | Qanday |
|---|---|
| Bo'sh holat | Ilovadagi neon aravacha — `CartArt` kitga ko'chirildi (SVG, PNG emas) |
| Son o'zgartirish | `QuantityStepper` + har qatorning **o'z `fetcher`i**. Ilgari oddiy forma edi va butun sahifani qayta yuklardi: scroll tepaga sakrardi, rasmlar qaytadan chizilardi |
| Raqam kengligi | `w-9` + `tabular-nums` — 9 dan 10 ga o'tganda tugmalar sakramaydi |
| Qoldiq | «3 ta qoldi» / «omborda qolmadi» qator ichida |
| Savatni bo'shatish | Sarlavha yonida |
| Umumiy jami | **Faqat valyuta bitta bo'lganda.** Dubay (AED) va Toshkent (UZS) do'konlari bir savatda bo'lsa raqamlarni qo'shish ma'nosiz — kurs bizda yo'q va kerak ham emas (har do'kon alohida buyurtma) |

**Checkout:**

| Element | Qanday |
|---|---|
| Qadamlar | Raqamlangan: 1 Olish usuli · 2 Aloqa · 3 Manzil · 4 Izoh. **Raqamlar haqiqiy ketma-ketlik** — «olib ketish» tanlanganda manzil tushib qoladi va izoh 3 bo'ladi |
| Olish usuli | Ikkita katta karta, ikonka va narx bilan |
| Koordinata | Alohida blok: berilmagan holatda kulrang, berilgach yashil «joy belgilandi» |
| Xulosa | Mahsulot rasmi + nom + rang/o'lcham × soni |
| Yetkazish qatori | **O'CHMAYDI, qiymati o'zgaradi** (`—`). Qator yo'qolsa xulosa sakraydi va jami nega kamayganini odam tushunmaydi |
| To'lov | Maydon yo'q (K-10); matn tarjima qilinadigan joyda |

`CartArt` gradient `id` lariga prefiks berilgan: bitta sahifada ikkita
nusxa bo'lsa brauzer birinchi topilganini ishlatadi va ikkinchisi
rangsiz chiqadi.

### Buyurtmalar (§4.9) — 2026-08-29

**Ro'yxat:** uchta tab (`?tab=` URL'da — brauzer orqaga tugmasi ishlashi
kerak), qatorda raqam · `StatusBadge` · do'kon · mahsulot · olish usuli ·
jami. Har tabning **o'z bo'sh matni** bor: «faol buyurtma yo'q» va
«bekor qilingan buyurtma yo'q» bir xil gap emas.

**Tafsilot:** markazda holat vaqt chizig'i.

| Holat | Ko'rinishi |
|---|---|
| O'tgan | Yashil doira, ichida ✓ |
| Joriy | Binafsha doira + `shadow-glow`, matni oq va qalin |
| Kelajak | Kulrang kontur, matni `dim` |
| Uzilish | Qizil doira, matni qizil, ostida sabab |

Oqim `apps/api/src/routes/orders.ts` dagi `STATUS_LABELS` dan:
`new → seen → confirmed → ready → completed`.

⚠️ **FAQAT RANG BILAN AJRATILMAYDI.** Joriy qadam kattaroq va matni oq —
rangni ajratmaydigan odam ham qaysi bosqichda ekanini ko'radi (§7).

⚠️ **UZILISH KETMA-KETLIKNI TO'XTATADI, DAVOM ETTIRMAYDI.** «Rad etildi»
ni oxirgi qadam qilib qo'yish noto'g'ri bo'lardi. Server oraliq
holatlarni saqlamagani uchun uzilgan buyurtmada faqat «yuborildi» va
uzilish ko'rsatiladi — yolg'on bosqich chizishdan ko'ra kam ma'lumot
berish yaxshiroq.

⚠️ **YORLIQ SERVERDAN** (`statusLabel`), `lib/orderFlow.ts` faqat
TARTIBNI biladi. Matn to'rt tilda va uni saytda qayta yozish ikkinchi
manba yaratardi.

**Javob muddati** (`expiresAt`) — «javobga 23 soat qoldi», faqat
`new`/`seen` holatida. `Deadline` komponenti **faqat brauzerda** chiziladi:
qolgan vaqt hozirgi vaqtga bog'liq, serverda hisoblansa gidratatsiyada
mos kelmaslik chiqadi va javob keshlansa muddat qotib qoladi.

**Bekor qilish** — sabab maydoni bilan. Sababsiz bekor qilish do'kon
uchun ma'lumotsiz qoladi va takrorlanuvchi muammoni (masalan noto'g'ri
narx) hech kim ko'rmaydi. Maydon ixtiyoriy, lekin ko'rinib turadi.

### Uchta tuzatish (2026-08-29, foydalanuvchi ko'rsatdi)

| Muammo | Sabab va yechim |
|---|---|
| **Logotip yo'q edi** | Shapkada faqat so'z turardi. Ilovadagi belgi (`assets/logo-mark.png`) `apps/web/public/img/` ga ko'chirildi va so'z yoniga qo'yildi. Balandlik 32px dan kam emas: belgida mayda tafsilotlar bor (galstuk, krossovka) va kichikroqda ular bir-biriga qo'shilib ketadi — bu izoh ilovada ham bor |
| **Shapka kengligi kontentga to'g'ri kelmasdi** | Shapka `.shell` (1152px), katalog va mahsulot esa `.shell-wide` (1440px) ishlatardi. Endi shapka, futer va hero ham `.shell-wide` — uchalasi `80…1520` da tekis turadi |
| **Hero rasmining tepasi ko'rinmasdi** | Foto **853×1844** — juda baland portret (nisbat 0.46), slot esa keng (≈1.4), ya'ni balandligining uchdan ikki qismi kesiladi. `center` da boshning tepasi qirqilardi, `top` da esa gavda pastga tushib oyoqlari kesilardi. **30%** ikkalasining orasi |

⚠️ **Baland portret suratlar keng slotda har doim shu muammoni beradi.**
Yangi hero surati qo'yilganda `object-position` ni ko'z bilan tekshirish
shart — «center» standarti bu nisbatda deyarli hech qachon to'g'ri
kelmaydi.

### Do'konlar xaritasi (§4.5) — 2026-08-29

| Element | Qanday |
|---|---|
| Maket | Desktop: chapda ro'yxat (25rem), o'ngda **yopishqoq** xarita, to'liq balandlik. Mobil: ro'yxat/xarita almashtirgichi |
| Marker | Binafsha nuqta (SVG), tanlangani kattaroq va `accent` rangda, ustida turadi |
| Bog'lanish | Marker bosilganda ro'yxatdagi karta chegarasi yorishadi va scroll unga keladi; karta ustiga borilganda marker tanlanadi |
| Ish holati | «Ochiq · 21:00 gacha» / «Yopiq · 10:00 da ochiladi» — `opensAt`/`closesAt` dan |
| Mahsulot soni | «5 mahsulot · 2 tasi 3D» (`productCount`, `product3dCount`) |

⚠️ **XARITA IXTIYORIY QATLAM.** `VITE_GOOGLE_MAPS_KEY` berilmasa ro'yxat
to'liq kenglikda to'r bo'lib ochiladi va hech qanday xato ko'rinmaydi.
Sahifa xarita kalitiga bog'liq bo'lib qolmasligi kerak — bu
`store-panel` dagi `LocationPicker` bilan bir xil qoida.

⚠️ **`Marker`, `AdvancedMarker` EMAS.** `AdvancedMarker` `mapId` talab
qiladi, `mapId` berilganda esa `styles` JSON e'tiborsiz qoladi va xarita
Google'ning **och** uslubida ochiladi — qora sahifada yorqin
to'rtburchak. Klassik marker SVG ikonka bilan brendga bo'yaladi va
qorong'i uslub saqlanadi.

⚠️ **XARITA ALOHIDA BO'LAKDA** (`lazy`): 14.9 KB gzip, `stores`
marshrutining o'zi atigi 2.6 KB. Google Maps brauzer kutubxonasi — SSR
bundle'ga tushmasligi kerak, shuning uchun `mounted` bayrog'i ham bor.

`@types/google.maps` root'da allaqachon bor edi, lekin `apps/web`
tsconfig'idagi `types` ro'yxati uni to'sib turgan — ro'yxatga qo'shildi.

### Profil bo'limi (§4.10) — 2026-08-29

| Element | Qanday |
|---|---|
| Karkas | `layouts/profile.tsx` — chapda yopishqoq menyu (profil kartasi + havolalar + chiqish), o'ngda `Outlet` |
| Ma'lumot | Karkasda **bir marta** yuklanadi; bolalar `useRouteLoaderData` bilan oladi — bo'limlar orasida yurganda ism qayta so'ralmaydi |
| O'lchovlar | Oltita maydon, ilovadagi ro'yxat bilan bir xil. Ikonkalar `MeasureIcons` kitga ko'chirildi (8 ta glif), birlik maydon ichida |
| Avatar shakli | `morphTargets` — gradientli chiziqlar. Saqlanganda server qayta hisoblaydi va chiziqlar darrov o'zgaradi |

⚠️ **TELEFON O'ZGARTIRILMAYDI** — maydon o'chiq va sababi yozilgan.
U buyurtmani do'kon bilan bog'laydi va soxta buyurtmaga qarshi asosiy
himoya (00-README K-15); almashtirish uchun OTP tasdiqlash zanjiri
kerak, u esa hali yo'q. Maydonni jimgina yashirish o'rniga sababni
ko'rsatish tanlandi.

⚠️ **`morphTargets` SERVERDA HISOBLANADI** (03-api-spec §6) — sayt uni
faqat ko'rsatadi. Formulani takrorlash model o'zgarganda ikki joyda
tuzatishni talab qilardi.

⚠️ **YUZ SURATI — HOZIRCHA FAQAT HOLAT**, forma emas. Yuklash rozilik
oqimini talab qiladi (K-08a, 12-tz.md D-42) va u WEB-09 da quriladi.
Lekin holat va maxfiylikka havola shu yerda: odam o'z suratining
qayerdaligini bilishi kerak.

Ikonkalar `MeasureIcons.tsx` da qo'lda chizilgan — Lucide'da tana
o'lchovi glifi yo'q (ko'krak/bel/son atrofidagi o'lchov chizig'i umuman
topilmaydi). Mobil variant bilan yo'l ma'lumoti aynan bir xil.

### Premium bosqichi (2026-08-29)

Foydalanuvchi bosh sahifani ko'rib «premium emas» dedi. To'rtta aniq
sabab topildi va tuzatildi:

| Muammo | Nima qilindi |
|---|---|
| **Hero kuchsiz** — 1440px ekranda sarlavha atigi ~44px | Shkalaga `display` o'lchami qo'shildi: `clamp(3rem, 7.5vw, 7rem)` → 1440px da **108px**. Hero balandligi `78vh/42rem` → `88vh/52rem`, matn ustuni `max-w-2xl` → `max-w-3xl` |
| **TOP BRANDS buzuq ko'rinardi** | Yettita bo'sh kulrang quti o'rniga tinch matn qatori. Bazada `logoUrl: null` — quti bo'sh chiqib, «yuklanmadi» degandek turardi |
| **Bo'lim ritmi tasodifiy** — `py-14`, `py-16`, `py-24`, `py-32` aralash | Yagona `.section-y` sinfi: `clamp(4rem, 8vw, 7rem)`. Butun sahifada **112px** |
| **Bo'lim yorlig'i yolg'iz osilib turardi** | `SectionHeader` ga yupqa chiziq qo'shildi — 11px lik yorliqni kontent kengligiga bog'laydi. Deckdagi uslub saqlanadi |

**Yana ikkita tafsilot:**

`Oling.` gradient bilan — sahifadagi **yagona** gradient matn (§1.8).
Uchinchi so'z xarid harakatini bildiradi va butun sahifaning maqsadi shu.

Ko'rsatkichlar (`1 surat · 360° · 0 taxmin`) endi spetsifikatsiya
varag'idek: raqamlar `text-h1`, orasida yupqa vertikal ajratgich. Faqat
tepadan chiziq tortilganda ular «izoh» bo'lib qolardi.

### Katalog va mahsulot sahifalari (davomi)

Hero ko'tarilgach ular orqada qolib ketdi — endi bir darajada:

| Sahifa | Nima o'zgardi |
|---|---|
| **Katalog** | Sarlavha **filtrga qarab o'zgaradi**: `Hammasi` → `Ustki kiyim` → `«shim»`. Ilgari u doim «Katalog» edi va filtr qo'yilgan sahifa ham shunday turardi — odam qayerdaligini sarlavhadan bilmasdi. «Katalog» endi ustidagi yorliqqa tushdi, sarlavha esa `text-hero` |
| **Mahsulot** | Nom `text-h1` → `text-hero`; narx `text-h2` (22px) → `text-h1` va chegirma foizi yoniga ko'chdi. Xarid sahifasida narx sarlavhadan keyingi eng katta element bo'lishi kerak edi, ilgari u tavsif bilan bir og'irlikda turardi |
| **Barcha sahifalar** | `.section-y` — 10 ta sahifa (katalog, mahsulot, do'konlar, savat, checkout, buyurtmalar, profil, kiyintirish) bitta vertikal ritmga keltirildi |

### Hero — maket bo'yicha qayta qurildi (2026-08-29)

| Element | Qanday |
|---|---|
| Kompozitsiya | `public/img/hero-visual.webp` — mahsulot kartasi, «3D Try-On · 360° View» va figura bitta kadrda. Manba 1.7 MB PNG → 1340px WebP: **79 KB** |
| Joylashuv | Sahifaning **o'ng chetigacha** boradi, konteyner ichida emas |
| Ko'rsatkichlar | Shisha panel: `1 000+ · 360° · 100%`, `backdrop-blur` rasm ustida ishlaydi |

⚠️ **RASM QUTI BO'LMASLIGI KERAK.** U sof qora fonda chizilgan, sahifa
foni esa `#0A0A0F` — binafsha tusli. Farq kichik, lekin rasmning
to'rtburchagi aynan shundan ko'rinadi: tepa, past va chapda tik chiziq.

**To'rt yo'l sinaldi:**

| Yo'l | Natija |
|---|---|
| `mix-blend-screen` | Chetni yo'qotadi, lekin **kurtkani ham shaffof qiladi** — mahsulot yo'qoladi, holbuki butun kadr uning uchun |
| Ikki qatlamli niqob + `mask-composite` | **Umuman qo'llanmadi.** Brauzer prefiksli (`-webkit-mask-composite`) va prefiksiz kalit so'zlar aralashtirilganda ikkala qatlamni ham e'tiborsiz qoldiradi |
| Bitta radial niqob | Ishlaydi, lekin `object-contain` rasmni konteyner o'rtasiga joylashtiradi — niqob chegarasi rasm chetiga to'g'ri kelmaydi va chet baribir ochiq qoladi |
| **Chetlarda fon rangidagi gradient** ✅ | Gradientlar **rasmning o'zi** ustida turadi, markazi shaffof: karta xiralashmaydi, faqat chetlar fonga singiydi. Chapdan 24%, tepa va pastdan 14% |

⚠️ Uchinchi yo'l aynan `object-contain` tufayli ishlamadi — konteyner
rasmdan baland va niqob konteynerga o'lchanadi. Bu tuzoq har safar
`contain` bilan niqob birga ishlatilganda qaytadi.

⚠️ **`object-contain`, `cover` EMAS.** Manba 1.56:1, slot esa deyarli
kvadrat. `cover` uni yon tomonlaridan qattiq kesib, kartani ekranga
sig'maydigan darajada kattalashtirardi. Tayyor kompozitsiyani kesish —
uni yo'q qilish bilan teng.

⚠️ **RASM MANBADAN KESILGAN:** tashqi ramka, pastdagi «100% Xavfsiz va
ishonchli» chipi va generator qoldirgan «ulashish» ikonkasi olib
tashlangan. Birinchisi qutini yasardi, ikkinchisi pastdagi panelda
takrorlanardi — bitta ekranda «100%» ikki marta yozilardi.

⚠️ **`pb-32`** kompozitsiyani yuqoriga suradi: usiz «3D Try-On» chipi
ko'rsatkichlar paneliga tegib, ikkalasi ham o'qilmay qolardi.

⚠️ **«1 000+ Premium mahsulotlar» — TEKSHIRILMAGAN DA'VO.** Maketdan
olingan raqam; bazada hozir mahsulot yo'q. Ishga tushirishdan oldin yo
haqiqiy songa bog'lanishi, yo matn o'zgartirilishi kerak.

⚠️ **RTL da rasm hali chapga ko'chmaydi** — niqob yo'nalishi qat'iy.
Arabcha tarjima qo'shilganda (WEB-02) tekshirilsin.

### Bosh sahifaning qolgan bo'limlari (maket bo'yicha)

**Ishonch qatori** (`sections/TrustBar.tsx`) — hero ostidagi alohida
shisha panel: Original · Yetkazish · Tanlangan.

⚠️ **HERO PANELIDAN FARQI ATAYIN.** Hero paneli — **o'lchov**
(`1 000+`, `360°`, `100%`), ya'ni xizmat nimani va'da qilayotgani; bu
qator — **sabab**, ya'ni nega ishonish mumkinligi. Ikkalasi bir xil
ko'rinishda bo'lsa takrorlanayotgandek tuyulardi, shuning uchun bu
yerda raqam yo'q va ikonka doira ichida.

**Brend kafellari** — kvadrat kafel, ichida logotip, ostida nom.

⚠️ **LOGOTIP BO'LMAGANDA MONOGRAMMA**, zaxira ikonka emas. Bazada
`logoUrl: null` va agar hammasi bitta ikonka ko'rsatsa, yettita kafel
bir xil bo'lib qolardi — «yuklanmadi» degandek. Monogramma (`NB`,
`ZA`, `UN`) har brendda boshqacha va ataylab qilingandek ko'rinadi.

⚠️ **HAQIQIY LOGOTIPLAR DO'KON PANELIDAN YUKLANISHI KERAK.** Ularni
qo'lda chizish — brend belgisini buzish; taqlid qilingan logotip
haqiqiysidan yomonroq.

#### Brend logotiplari — yechildi

`packages/ui-web/src/BrandLogos.tsx` — olti brendning konturi
(`nike`, `adidas`, `zara`, `puma`, `new-balance`, `uniqlo`).

| Nima | Qanday |
|---|---|
| Manba | simple-icons (npm, **CC0-1.0**) — jsDelivr orqali yuklab olindi |
| Nima olindi | faqat `<path d="…">` ma'lumoti; SVG'lar tekshirildi — skript ham, tashqi havola ham yo'q edi |
| Rang | `fill="currentColor"` — kafel holatiga qarab meros bo'ladi |

⚠️ **KONTUR O'ZGARTIRILMAGAN.** Logotipni «qayta chizish» yoki
nisbatini buzish brend belgisini buzadi — original konturdan chetga
chiqilmaydi.

⚠️ **SAVDO BELGILARI EGALARINIKI.** Ular marketpleysda sotilayotgan
brendni KO'RSATISH uchun turadi (nominativ foydalanish), hamkorlik
yoki tasdiq ma'nosini bermaydi.

⚠️ **BU ZAXIRA, ASOSIY YO'L EMAS.** Tartib: `logoUrl` (do'kon
panelidan) → `BrandLogo` (mahalliy) → hech narsa. Baza to'lgach
mahalliy ro'yxat o'z-o'zidan ishlatilmay qoladi. `Local Brand` da
logotip yo'q — u brend emas, guruh nomi.

⚠️ **KAFELDA MONOGRAMMA VA LOGOTIP BIRGA.** Faqat monogramma bo'lsa
yettita kafel bir xil tipografik blok bo'lib qoladi; faqat logotip
bo'lsa logotipsiz brend bo'sh qutida qoladi.

**Bo'lim fonlari** — bitta aktiv varag'idan to'rt lentaga kesildi:

| Fayl | Qayerda | Hajm |
|---|---|---|
| `bg-doorway.webp` | Qanday ishlaydi | 126 KB |
| `bg-store.webp` | Do'konlar uchun | 107 KB |
| `bg-planet.webp` | Erta kirish | 121 KB |
| `bg-waves.webp` | zaxira | 96 KB |

⚠️ **FON TO'LIQ KENGLIKDA.** Ilgari ular `lg:w-[62%]` bilan yarim
kenglikda edi va o'rtada tik chok ko'rinardi. Endi `size-full
object-cover`; matn turgan tomon gradient bilan so'ndiriladi, ya'ni
fon matnni buzmaydi, lekin butun kenglikni egallaydi.

⚠️ **BO'LIMLAR ORASIDA CHEGARA YO'Q.** `border-t border-border` olib
tashlandi. Uchala fon bitta `SectionBackdrop` komponentidan chiziladi
— nusxa ko'chirilganda so'nish qiymatlari bir-biridan uzoqlashib
ketgan edi, chegara esa faqat IKKALA tomon bir xil so'nsagina
ko'rinmaydi.

⚠️ Har birida chet so'ndirgichi bor — Hero'dagi bilan bir xil tuzoq:
rasmning to'rtburchagi fon rangidan farq qilib ko'rinib qoladi.
`-z-10` va `pointer-events-none` — fon kontentni to'smaydi.

#### Ko'ndalang chok — ikki alohida sabab

Bo'limlar tutashgan joyda ko'rinib turgan chiziqni yo'qotish uch
urinish oldi. Ikkita mustaqil sabab bor edi va birinchisini tuzatish
ikkinchisini ochib qo'ydi:

| # | Sabab | Belgisi | Yechim |
|---|---|---|---|
| 1 | **Chiziqli so'ndirish** (`transparent 0%, #000 16%`) | Rasm o'chirilganda ham chiziq qolardi | `EDGE_MASK` — smoothstep egri (`t²(3−2t)`), 11 nuqta, 30% zona |
| 2 | **Qirqilgan nur** — `Grid` ichidagi `bg-primary/25 blur-[120px]` dog'i `top-0 -translate-y-1/2` bilan bo'lim chetiga o'rnashgan va `overflow-hidden` uning yarmini kesib tashlagan | Yorqin binafsha polosa birdan uzilardi | `Grid` qatlamining o'ziga `edgeMaskStyle` |

⚠️ **CHIZIQLI GRADIENT «SILLIQ» EMAS.** Matematik jihatdan uzluksiz,
lekin shaffoflik o'zgarish TEZLIGI so'nish boshlangan nuqtada birdan
noldan doimiyga sakraydi — ko'z aynan shu sinishni chiziq deb o'qiydi
(Mach polosasi). Chetlarida tekislanadigan egri kerak. Qiymat
`src/lib/edgeMask.ts` da, BITTA joyda.

⚠️ **AYB DOIM RASMDA DEB O'YLAMANG.** Uch urinish fon rasmiga
sarflandi, aslida chiziqni `Grid` dagi nur chizayotgan edi. Buni
`document.elementFromPoint` bilan chegara atrofidagi qatlamlarni
sanab, har birini navbat bilan yashirib topsa bo'ladi — ko'z bilan
taxmin qilib emas.

⚠️ **BRAUZER PANELI SCROLL'DAN KEYIN BO'SH KADR QAYTARADI.** Chegarani
ko'rish uchun `document.body.style.marginTop = '-Npx'` ishlatiladi:
sahifa yuqoriga suriladi, `scrollY` esa 0 bo'lib qoladi. Oldingi
bo'limlarni `display:none` qilish YARAMAYDI — `Reveal` ning
`IntersectionObserver` i ishlamay qolib, kontent ko'rinmaydi.

### Bosh sahifa maketi — TRENDING spotlight

Bo'lim endi ikki qavat: yuqorida bitta mahsulot katta qilib
(`sections/Spotlight.tsx`), ostida odatdagi to'r.

⚠️ **SPOTLIGHT TO'RNI ALMASHTIRMAYDI.** Katta karta ko'zni tortadi,
to'r «yana bor» degan ma'noni beradi. Faqat spotlight qolsa blok
ikkita mahsulotdan iborat bo'lib ko'rinardi.

⚠️ **NEON RAMKA RASMDAN KATTAROQ — VA BU MAJBURIY.** Maketda model
neon to'rtburchakni kesib o'tadi, chunki u yerdagi surat foni
qorong'i. Bizda suratlar oq studiya fonida (§4.2): kattalashtirilgan
oq to'rtburchak ramkani BUTUNLAY yopadi va neon umuman ko'rinmaydi.
Bu sinab ko'rilgan va shu holda tuzatilgan.

#### Fon — `portal-bg.webp`

Spotlight foni endi haqiqiy surat: neon portal, tutun va aks etuvchi
pol.

⚠️ **AVVAL BU CSS EDI VA U YETMADI.** Ramka bilan nurni CSS chizadi,
lekin TUTUNNI chizolmaydi: bir necha xira gradient «dog'» beradi.
`feTurbulence` bilan urinildi va qaytarildi — kichik `viewBox` da
hisoblangan shovqin karta kengligiga (~1300px) cho'zilganda mayda
tuzilmasini yo'qotib, loyqa dog' bo'lib chiqdi. Qayta urinilsa:
filtr render o'lchamida hisoblanishi va natija TO'LIQ KENGLIKDA
tekshirilishi shart — kichik oynada u yaxshi ko'rinadi, kattasida
yemiriladi.

⚠️ **PNG SAQLANMAYDI.** Manba 1448×1086 PNG, 1.75 MB edi. 1200px
WebP (sifat 78) — **35 KB**, ya'ni ellik barobar kichik. Yangi fon
qo'shilsa xuddi shu yo'l: `sharp` bilan WebP ga o'tkazish, PNG ni
o'chirish.

⚠️ **KOLLEKSIYA KARTALARI HAM WebP** (`collection-{men,women,limited}.webp`,
sifat 78). JPG lar jami 675 KB edi, WebP — 185 KB. Vebdagi JPG
nusxalari O'CHIRILGAN; asl nusxalar `apps/mobile/assets/` da qoladi —
mobil o'z formatini o'zi hal qiladi.

⚠️ **`object-center` TASODIF EMAS.** Manba 4:3, katak esa ~1.29:1 —
`cover` gorizontal yo'nalishda ~12px kesadi, xolos. Portal 12%–81%
oralig'ida turadi, ya'ni tepa chizig'i ham, poldagi aks etish ham
saqlanadi. Katak nisbati o'zgarsa buni qayta tekshirish kerak.

⚠️ **`eager`, `lazy` EMAS.** Fonsiz karta bo'm-bo'sh qora
to'rtburchak bo'lib turadi — u bezak emas, bo'limning butun muhiti.
35 KB buni kutishga arzimaydi.

⚠️ **O'NG CHET 78% DAN SO'NADI.** Ilgari 62% edi va portalning o'ng
ustunini yeb qo'yardi. So'nishsiz esa rasm matn yarmiga tik chiziq
bilan urilib, kartani ikkiga bo'lib tashlaydi.

⚠️ **KARUSEL O'ZI AYLANMAYDI.** Avtomatik almashinuv o'qiyotgan
odamni uzadi va harakatni kamaytirish sozlamasini buzadi (WCAG
2.2.2). Almashtirgich ikkitadan kam mahsulotda umuman chizilmaydi.

⚠️ **RANGLAR FAQAT IKKITADAN BOSHLAB.** Bitta nuqta tanlov emas — u
«tanlash mumkin» degan noto'g'ri va'da beradi.

#### So'rov narxi — spotlight qanchaga tushdi

Kategoriya va variant ranglari ro'yxat endpointida YO'Q, faqat
`/products/:id` da bor. Uchta kartani serverda boyitsak bosh sahifa
2 emas, **5** so'rov qilardi.

⚠️ **ANONIM CHEGARA — DAQIQASIGA 30 SO'ROV** (03-api-spec §4), VA U
SSR'DA BARCHA MEHMONGA BITTA: cheklov `req.ip` bo'yicha hisoblanadi,
SSR so'rovlari esa hammasi veb-serverning IP'sidan keladi. Ishlab
chiqish paytida bu ko'rindi — brendlar va mahsulotlar «yo'q» bo'lib
qoldi, aslida API 429 qaytarayotgan edi.

Yechim: server faqat BIRINCHI kartani boyitadi, qolganlari
foydalanuvchi o'sha kartaga o'tganda brauzerda yuklanadi.
Ko'rilmagan karta uchun hech narsa to'lanmaydi.

⚠️ **ASOSIY MUAMMO HALI OCHIQ** — §9 ga qarang.

### Futer — panel

Butun kenglikdagi tasma o'rniga yumaloq panel (`components/Footer.tsx`):
chapda brend bloki va ijtimoiy tugmalar, o'ngda uchta havola ustuni,
pastda mualliflik qatori va «Xavfsiz to'lovlar» belgisi.

⚠️ **CHIZIQ EMAS, PANEL.** Ilgari futer `bg-panel` tasmasi edi va
sahifadan «kesib olingan» bo'lak bo'lib turardi. Yumaloq panel esa
shapka bilan bir tilda gapiradi.

⚠️ **PASTDAGI TO'R — SVG, RASM EMAS.** Sabab uchta: hajmi bir necha
yuz bayt, rangi `--primary` dan keladi (token o'zgarsa u ham
o'zgaradi), va chetlari niqob bilan so'nadi — qotirilgan to'rtburchak
qorong'i panelda ko'rinib qolardi. Butun to'r BITTA `<path>` da:
22 ta alohida element o'rniga bitta `d` ni `M … L …` bo'laklari bilan
to'ldirish yetarli.

⚠️ **«XAVFSIZ TO'LOVLAR» — DALIL, BEZAK EMAS.** To'lov xavfsizligi
xaridor savatga o'tishdan oldin so'raydigan yagona savol. Bezak
sifatida qo'yilsa, aksincha, shubha uyg'otadi.

⚠️ **IJTIMOIY MANZILLAR TEKSHIRILMAGAN** (`SOCIAL` massivi). Ular
TAXMIN: `instagram.com/looksave`, `t.me/looksave`,
`tiktok.com/@looksave`, `youtube.com/@looksave`. Sayt hali
joylashtirilmagani uchun hozircha zarari yo'q, LEKIN e'londan oldin
har biri ochib tekshirilishi shart — noto'g'ri manzil odamni begona
hisobga olib boradi, bu havolasizlikdan yomonroq.

⚠️ **AJRATGICH USTUN ICHIDA, YONIDA EMAS.** Alohida element bo'lsa u
mobil ustunda ham qatorga qo'shilib, bo'sh chiziq bo'lib qolardi.

⚠️ **DESKTOPDA HAM `min-height` BOR** (24px). Havola qatori 15px
matn bilan ~20px chiqadi — bu WCAG 2.5.8 ning 24px minimumidan past.
Mobilda 44px.

⚠️ **MUALLIFLIK QATORI `text-dim` EMAS.** `--dim` (253 13% 42%)
panelda ≈3.6:1 beradi, ya'ni 13px matn uchun AA dan past.
`text-muted-foreground` ≈6.7:1.

⚠️ **YIL QO'LDA YOZILMAYDI** — `new Date().getFullYear()`. Qotirilgan
yil har yanvarda eskirib qoladi.

### Shapka — suzuvchi panel

Chetga yopishgan chiziq o'rniga sahifa ustida suzuvchi panel
(`components/Nav.tsx`): 80px, radius 26, chetlardan `shell-wide`.
Telefonda 64px / radius 22.

⚠️ **«TEPADA SHAFFOF» QOIDASI O'ZGARDI.** Ilgari shapka sahifa
tepasida butunlay shaffof edi va pastga tushganda fonli bo'lardi.
Suzuvchi panel doim ko'rinib turadi, ya'ni eski qoida ishlamaydi:
hero ustidagi to'q panel uni ikkiga bo'lardi. Endi tepada fon
45% va nur yo'q, pastga tushganda 85% va nur yonadi.

⚠️ **KONTENT CHEKINISHI PANELGA BOG'LIQ.** `main` da `pt-[5.5rem]
sm:pt-[6.5rem]` — 12px chekinish + 64/80px panel. Panel bo'yi
o'zgarsa buni ham o'zgartirish kerak, aks holda birinchi sarlavha
panel ostida qoladi.

⚠️ **FAOL HOLATNI HALQA KO'RSATADI, FON EMAS.** Fon bor, lekin atigi
14% — halqa va yengil nur ustun turadi. To'q to'ldirilgan pill
qo'shni yozuvlardan ko'proq e'tibor tortib, tugmaga o'xshab qolardi:
odam uni «bosiladigan amal» deb o'qiydi, «shu yerdasiz» deb emas.

⚠️ **SAVAT SONI `aria-label` ICHIDA.** `aria-label` elementning BUTUN
ichkarisini almashtiradi — «Savat» deb yozilsa pastdagi son belgisi
ekran o'quvchiga umuman yetib bormaydi va foydalanuvchi savatda
mahsulot borligini bilmaydi. Shuning uchun son yorliqning o'ziga
qo'shiladi.

⚠️ **SON DOIRA TASHQARISIGA CHIQADI.** Ichida tursa 21px lik belgi
44px lik doiraning yarmini egallab, ikonkani bosib qo'yardi.

⚠️ **ILGAK GLIFI QO'LDA CHIZILGAN** (`GarmentIcons.tsx` dagi `Hanger`).
Lucide'da ilgak yo'q, `Sparkles` esa «kiyib ko'rish» ma'nosini
bermaydi. U LUCIDE emas, GLIF xaritasiga qo'shiladi — lucide
komponentlari `ForwardRefExoticComponent`, qo'lda chizilganlar esa
oddiy funksiya, ya'ni ikkinchisini birinchi xaritaga qo'ysangiz tip
xatosi chiqadi.

⚠️ **SO'Z BELGISI `text-wordmark` DAN KATTAROQ** (18px / 0.06em,
token 14px / 0.32em). Token 72px lik chiziqda to'g'ri edi; 80px lik
panelda u yo'qolib ketadi. «Save» binafsha — bu saytga xos, ilovada
so'z belgisi yaxlit oq.

⚠️ **YASHIRIN BRAUZER PANELIDA `scrollTo` SCROLL HODISASINI
CHIQARMAYDI**, ya'ni `solid` holati sinovda o'zgarmaydi va bu
NOSOZLIK EMAS. Tekshirish uchun `window.dispatchEvent(new
Event('scroll'))` qo'shing; o'tishlar (transition) ham muzlaydi,
shuning uchun haqiqiy qiymatni o'qishdan oldin `*{transition:none}`
bilan ularni o'chiring.

### Brend kafellari va panellar — maketga ko'chirildi

Kafel ichida endi FAQAT logotip va nom (`routes/home.tsx`).

⚠️ **MONOGRAMMA OLIB TASHLANDI.** U logotip ustida turardi va ikkalasi
bir-birini bosardi: brend belgisi kichrayib, kafel tipografik blokka
o'xshab qolardi. Nom kafel ichida turgani uchun bosh harflar keraksiz.

Zaxira tartibi: `logoUrl` (do'kon panelidan) → `BrandLogo` (mahalliy
kontur) → neytral yorliq belgisi (`Icon name="tag"`).

⚠️ **BREND NOMIDA `uppercase` MUMKIN**, sarlavhalarda esa yo'q
(06-dizayn.md §3). Farqi: brend nomi — atoqli ot va deyarli doim lotin
yozuvida, ya'ni katta harf uni buzmaydi; o'zbekcha sarlavhada
`Ko'ylak` → `KO'YLAK` xunuk chiqadi.

⚠️ **IKKALA PANEL BIR XIL KENGLIKDA.** Ishonch qatori `shell-wide`
(1440px) da, brendlar bloki `shell` (1152px) da edi — maketda ular
tekislangan bo'lsa ham saytda chetlari mos kelmasdi. Ikkovi ham endi
`shell-wide`, va orasi bo'lim ritmi emas (`pt-10`): ular bitta guruh.

### Chetida yuruvchi nur — `.edge-beam`

`conic-gradient` butun elementni bo'yaydi, niqob esa faqat 1px lik
ramka halqasini qoldiradi — nur chegara bo'ylab yuradi, ichkariga
tushmaydi. Ikki panelda ishlatiladi, ikkinchisi yarim davr kechikadi.

⚠️ **IKKI XIL NIQOB KALIT SO'ZI, VA ULAR ARALASHTIRILMAYDI.**
`-webkit-mask-composite` `xor` ni tushunadi, standart `mask-composite`
esa `exclude` ni. Bittasini ikkinchisining qiymati bilan yozsangiz
brauzer IKKALASINI ham e'tiborsiz qoldiradi — bu seansda hero rasmida
aynan shu tuzoqqa tushilgan.

⚠️ **`@property` SHART VA U `@layer` ICHIGA KIRMAYDI.** Ro'yxatdan
o'tmagan `--o'zgaruvchi` ni brauzer matn deb biladi va animatsiya
qilmaydi: burchak 0 dan 360 ga sakraydi, nur yurmaydi. `@layer
components` ichiga yozilsa e'lon jimgina e'tiborsiz qoldiriladi.

⚠️ **BRAUZER PANELI YASHIRIN BO'LSA ANIMATSIYA TO'XTAYDI** —
`playState` «running» ko'rinadi, lekin `currentTime` 0 da qotadi va
`requestAnimationFrame` umuman chaqirilmaydi. Buni nosozlik deb
o'ylamang: tekshirish uchun animatsiyani `pause()` qilib
`currentTime` ni qo'lda suring va `--beam-angle` o'zgarishini
o'qing (0° → 90° → 180° → 270° → 360°).

Harakatni kamaytirish sozlamasi `index.css` oxiridagi umumiy qoida
bilan hal bo'ladi — alohida hech narsa kerak emas.

### `Reveal` va `h-full` — jim buziladigan zanjir

⚠️ **`Reveal` QO'SHIMCHA `div` YASAYDI.** U to'r katagi bilan karta
orasiga tushsa, `h-full` zanjiri uziladi: karta 100% deb shu
`div` ni o'lchaydi, `div` esa `height: auto` — ya'ni kontent
bo'yicha. Natijada bir qatordagi kartalar turli balandlikda qoladi
va past chetlari tekislanmaydi. Hech qanday xato chiqmaydi.

To'g'ri tuzilma: to'r katagi — `li` ning O'ZI (`flex`), `Reveal`
esa uning ichida `flex flex-1` bilan, karta ham `flex-1`. `Reveal`
shuning uchun `className` propini oladi.

Bu «Qanday ishlaydi» kartalarida uchradi. Boshqa bo'limlarda
kartalar tik ustunda turgani uchun sezilmasdi — ya'ni yangi to'r
qo'shilganda buni tekshirish kerak.

### Qadam kartalari — portal foni va o'lchov chizig'i

⚠️ **FON `bg-doorway.webp` EMAS, `portal-bg.webp`.** Portal o'ng
chetda va qirqilgan (`w-[62%]`, `object-[82%_30%]`): to'liq
ko'rsatilsa u sarlavha bilan e'tibor uchun kurashadi, kadrga faqat
o'ng ustuni va tepa chizig'ining bir qismi tushishi kerak.

⚠️ **`SectionBackdrop` GA `imageClass` QO'SHILDI**, `className` emas.
Chetlarni so'ndiruvchi niqob RASM QUTISIGA o'lchanadi — qutini
torroq qilsangiz niqob ham o'sha tor qutida ishlaydi va qo'shni
bo'lim bilan tutashish saqlanadi. Alohida prop shuning uchun:
qutini o'zgartirish niqobni buzmasligi kerak.

⚠️ **PASTKI CHIZIQ BEZAK EMAS, O'LCHOV** — «to'rttadan nechanchisi»
(25 / 50 / 75 / 100%). Maketda to'rttasi ham deyarli bir xil to'lgan
edi; bunday chiziq hech nima demaydi va shunchaki shovqin bo'lib
qoladi. `aria-hidden`: qadam raqami («01») yonida allaqachon matn
bo'lib turibdi, ya'ni chiziq ekran o'quvchiga yangi ma'lumot
bermaydi.

### Sarlavha urg'usi — `.headline-accent`

Har bo'lim sarlavhasi FE'L bilan tugaydi va urg'u aynan shu so'zga
tushadi: «Oling.», «yasang», «soting». Bu tizim, bezak emas —
o'quvchidan kutilayotgan harakat.

⚠️ **FAQAT OXIRGI SO'ZGA.** Ikki-uch so'z bo'yalsa gradient o'qishga
xalaqit beradi va urg'u ma'nosini yo'qotadi.

⚠️ Ilgari bu «sahifadagi yagona gradient matn» edi (faqat Hero'da).
Maket uchala bo'lim sarlavhasida ham urg'u ko'rsatgani uchun qoida
kengaytirildi: gradient endi ixtiyoriy bezak emas, BO'LIM SARLAVHASI
uchun qat'iy qoida.

### Qadam va foyda kartalari — ikonkalar

`HowItWorks` va `Stores` kartalarida 56px doira ichida ikonka
(maketdagi ko'rinish).

⚠️ **NUQTALI BOG'LOVCHI — QADAMLAR KETMA-KETLIGI.** Kartalar oddiy
to'rda turganda ular MENYU bo'lib o'qiladi: «to'rttasidan birini
tanlang». Chiziq ularni yo'lga aylantiradi. Ma'no faqat to'rt ustun
bir qatorda turganda to'g'ri, shuning uchun `lg:` dan pastda chiziq
yo'q — u yerda kartalar allaqachon tik ustun.

⚠️ **IKONKA MA'NOGA BOG'LANGAN, MAKETGA EMAS.** Maketda «Surat
yetarli» kartasida diagramma turibdi, lekin u sarlavhaga zid keladi
va o'qiyotgan odamni adashtiradi — u yerda fotoapparat qo'yildi.

---

### Oq fonli suratlar — yechildi

§4.2 da ochiq qolgan muammo. Do'konlar mahsulotni oq studiya fonida
suratga oladi va qorong'i to'rda bunday karta ko'zni uradi.

Suratni o'zgartira olmaymiz (u do'konniki), lekin uni **tinchlantira**
olamiz: `ImageFrame` ning `calmWhite` rejimi tinch holatda
`brightness-[0.92] contrast-[0.96]` qo'yadi, sichqoncha ostida esa
to'liq ochadi. To'r yaxlit ko'rinadi, mahsulotni ko'rmoqchi bo'lgan odam
esa uni to'liq ko'radi.

⚠️ Bu **vaqtinchalik yechim**. Asl yechim savdo tomonida: do'kon
panelida surat foni uchun talab qo'yish (S-2).

---

## 9. Ochiq savollar

| # | Savol | Holat |
|---|---|---|
| S-1 | Logotip belgisining SVG varianti | ❌ **Yo'q.** `apps/mobile/assets/` da faqat `logo.png` va `logo-mark.png`. Saytga SVG kerak: retina, favicon, OG rasm. Kim chizadi — hal qilinmagan |
| S-2 | Mahsulot suratlari uchun minimal o'lcham | Bugun do'konlar ixtiyoriy o'lchamda yuklaydi. 3:4 to'r uchun minimal **1200×1600** kerak; do'kon paneliga tekshiruv qo'shilishi lozim |
| S-3 | Brend logotiplarining oq varianti | ✅ **Hal qilindi.** `BrandLogo` bir rangli konturni `currentColor` bilan chizadi — oq/kulrang varianti kerak emas. Manba: simple-icons (CC0). Do'kon panelidan `logoUrl` kelsa u ustun turadi |
| S-4 | **SSR anonim so'rov chegarasi — BLOKLOVCHI** | ✅ **Hal qilindi: xizmat kaliti + alohida sarlavha.** BFF o'zini `X-LookSave-Service-Key` bilan tanishtiradi va mehmon IP'sini `X-LookSave-Client-Ip` da beradi; API kalit to'g'ri bo'lgandagina uni o'qiydi (`http/client-ip.ts`). `X-Forwarded-For` YO'LI RAD ETILDI — sabab quyida. `trust proxy` 1 bo'lib qoladi |
| S-5 | Reyting | ✅ **Hal qilindi: reyting yo'q.** API'da (`routes/products.ts`, `routes/stores.ts`, `shared-types`) bunday maydon umuman yo'q. Sharhlar tizimi — alohida quyi tizim (moderatsiya, spam, huquq), MVP ga kirmaydi. Spetsifikatsiyadan olib tashlandi |

**Qayta ishlatiladigan aktivlar** (`apps/mobile/assets/`): `hero-home.jpg`,
`hero-market.jpg`, `collection-men.jpg`, `collection-women.jpg`,
`collection-limited.jpg`, `3d-person.jpg` — marketing sahifalari va
kategoriya kartalari uchun tayyor. Yangi surat sotib olish shart emas.

---

### Do'konlar sahifasi maketga keltirildi (§4.5) — 2026-08-30

Maket ikki qavatli: tepada hero (sarlavha + neon xarita kompozitsiyasi),
ostida do'kon kartalari to'ri.

| Element | Qanday |
|---|---|
| Hero | Ikki ustun (`34rem` + qolgani). Chapda `text-hero` sarlavha, lead matn va joylashuv so'rovi; o'ngda kompozitsiya |
| Sarlavha | «Do'» oq, «konlar» `brand` — ikki ohang, **gradientsiz** (§1.8 pastda) |
| Joylashuv so'rovi | Hero ICHIDA: maslahat (joy ikonkasi bilan) va `locate` ikonkali tugma yonma-yon. Ruxsat berilgan bo'lsa blok umuman chizilmaydi |
| Kompozitsiya | `components/StoresArt.tsx` — perspektivadagi neon ko'chalar to'ri, radar halqalari, besh marker |
| Karta | 16:9 muqova → ustida masofa chipi (`1.2 km ➤`) → nom (`text-h2`) → soat/joy ikonkali qatorlar → o'ng pastda o'q doirasi |
| To'r | `md:2 → 2xl:3` ustun. Ilgari `sm:2 → lg:3` edi va kartalar maketdagidan ikki barobar kichik chiqardi |

⚠️ **GRADIENT MATN ISHLATILMADI.** Maketda «konlar» gradientga o'xshaydi,
lekin §1.8 gradient matnni brend nomidan boshqa joyda taqiqlaydi. Yaxlit
`text-brand` bilan ko'zga effekt bir xil — qoidani buzish uchun sabab yo'q.

⚠️ **KOMPOZITSIYA SVG, RASM EMAS** — `CartArt.tsx` bilan bir xil sabab:
PNG ~700 KB qo'shadi, rangni tokendan olmaydi (mavzu o'zgarsa eskiradi)
va chetlari qora to'rtburchak bo'lib ko'rinadi. Vektorda niqob bilan
fonga singib ketadi.

⚠️ **TO'R HAQIQIY PERSPEKTIVADA**, `skewX` bilan emas. Qiyshaytirish
izometrik beradi — chiziqlar parallel qoladi va shablon bo'lib ko'rinadi.
`StoresArt` da kamera modeli bor (`project`), shuning uchun ko'chalar
yo'qolish nuqtasiga yaqinlashadi va uzoqdagi katak kichrayadi. Radar
halqalari ham yerda yotgan aylanalar — `<ellipse>` bilan chizilsa ular
to'r bilan bir tekislikda turmaydi va marker havoda osilib qoladi.
Geometriya **modul darajasida** hisoblanadi: SSR va gidratatsiya bir xil
natija berishi shart.

**Birinchi urinish maketga o'xshamadi — uchta sabab bor edi:**

| Xato | Nega bilinadi | Tuzatish |
|---|---|---|
| To'r siyrak (44 qadam → kadr bo'ylab 15 katak) | Shahar xaritasi emas, oddiy 3D simto'r bo'lib ko'rinadi | Qadam 22 — markazda ≈26px, ya'ni ~29 katak, maketdagidek |
| Halqalar juda katta (kadr enining 69% i) | Kompozitsiya markazi marker emas, halqa bo'lib qoladi | Radiuslar markerga bog'landi, tashqi halqa ≈45% |
| Magistrallar to'g'ri (qalinlashtirilgan to'r chizig'i) | Haqiqiy shaharda magistral kvartal chizig'ini takrorlamaydi — to'g'ri chiziq to'rning bir qatoriday ko'rinadi | Uchta **egri** yo'l, `highway()` sinus bilan |

⚠️ **TEKISLIK KADRDAN CHIQIB KETISHI SHART** (`HALF = 2400`). 900 da
to'rning CHETI ko'rinardi — tepada ikkita qattiq diagonal qirra, ya'ni
«stol ustidagi gilam». Lekin hamma yoqda 22 qadam qo'yib bo'lmaydi:
markaz zich (±700 gacha), undan nari qadam uch barobar yiriklashadi —
o'sha masofada perspektiva chiziqlarni baribir qo'shib yuboradi.

⚠️ **MARKUP O'LCHANADI.** Kompozitsiya SSR HTML'iga tushadi, ya'ni uning
og'irligi haqiqiy. Ikki chora: kadrdan tashqaridagi kesmalar tashlanadi
(`offFrame`) va koordinatalar butun songa yaxlitlanadi (760 birlik ≈
800px, yarim piksel ko'rinmaydi). Natija: 242 → 177 `path`, 29 → 20 KB;
sahifa gzip bilan 35 KB.

⚠️ **KARTA `coverUrl` DAN O'QIYDI, `logoUrl` DAN EMAS.** Karta 16:9,
logo esa kvadrat (do'kon panelidagi maslahat ham shuni yozadi) — logo bu
slotda yon tomonlaridan qirqiladi. Muqova aynan shu nisbat uchun
yuklanadi. `GET /stores/nearby` uni qaytarmasdi (do'kon SAHIFASI
qaytarardi), shuning uchun ro'yxatga hech qachon yetib bormasdi;
`coverUrl` endpointga qo'shildi (03-api-spec §8).

⚠️ **RASMSIZ HOLAT BRENDLANGAN.** `ImageFrame` rasmsiz chegarali quti
chizadi; yonma-yon turgan uchta shunday quti to'rni «yuklanmagan» qilib
ko'rsatadi. Muqova ham, logo ham bo'lmasa binafsha yog'du va do'kon
ikonkasi chiziladi — bo'shliq ATAYIN qilingandek ko'rinadi.

⚠️ **TO'RDA `text-dim` YO'Q.** Tekshiruv ro'yxati uni faqat 15px+ da
ruxsat etadi (kontrast ≥ 4.5:1), kartadagi qatorlar esa 13px —
`text-muted-foreground` ishlatiladi. Xarita yonidagi tor ro'yxatda
o'lchamlar boshqa, shuning uchun `meta` `compact` bo'yicha ikkiga
bo'linadi.

**Ikonkalar:** `clock` (ish holati) va `locate` (joylashuv tugmasi)
qo'shildi — **ikkala kitga ham** (`packages/ui-web`, `apps/mobile`), nomlar
ikki platformada bir xil qolishi uchun (06-dizayn.md §11).
---

### SSR cheklovi mehmon bo'yicha hisoblanadigan bo'ldi (S-4) — 2026-08-30

Sayt server tomonda chiziladi, ya'ni API ga so'rovni MEHMON emas,
VEB-SERVER yuboradi. API esa anonim cheklovni IP bo'yicha hisoblaydi
(daqiqasiga 30, 03-api-spec §4). Natijada butun sayt bitta chelakni
bo'lishardi: ikki-uch kishi bir vaqtda kirsa API 429 qaytarardi va
sahifa **bo'sh** ochilardi — xato hech qayerda ko'rinmasdi.

O'lchangan: bitta bosh sahifa 2–3 so'rov qiladi, ya'ni chelak ~10
mehmonda tugaydi.

#### Nega `X-Forwarded-For` emas

Birinchi taxmin — BFF `X-Forwarded-For` ni uzatsin — **ishlamaydi**, va
buni tekshirib ko'rish kerak bo'ldi. Express `trust proxy = 1` bilan
XFF ning **eng oxirgi** qiymatini oladi (o'lchandi: `XFF: A, B` da
`req.ip` = `B`). Caddy esa o'zi ko'rgan IP'ni ro'yxat **oxiriga**
qo'shadi. Demak zanjir bunday bo'lardi:

```
BFF yuboradi:  X-Forwarded-For: <mehmon>
Caddy qo'shadi: X-Forwarded-For: <mehmon>, <veb-server>
API o'qiydi:                                ^^^^^^^^^^^^ — yana veb-server
```

Ya'ni o'zgarish **behuda** bo'lardi. Hop sonini 2 ga ko'tarish esa
teshik ochadi: mobil ilova `api.looksave.app` ga **to'g'ridan-to'g'ri**
boradi, demak bu yo'l ochiq va haqiqiy — mijozning o'zi yozgan XFF
g'olib chiqib, har kim o'zining cheklovini chetlab o'tardi. O'lchandi:
`trust proxy 2` da soxta IP bilan chelak har safar yangilanadi.

**Xulosa:** `trust proxy` **1 bo'lib qoladi** (`apps/api/src/app.ts`).
Bugungi topologiya uchun u to'g'ri: Caddy — yagona proksi, u XFF ni
o'zi to'ldiradi va mijoz yozgani hech qachon g'olib chiqmaydi.

⚠️ **BU `api` KONTEYNERI PORT OCHMASLIGIGA TAYANADI.**
`infra/docker-compose.yml` da `api` xizmatida `ports:` yo'q — unga
faqat Docker tarmog'i ichidan, ya'ni Caddy orqali kirish mumkin.
Agar kelajakda port ochilsa (debug uchun bo'lsa ham), Caddy'ni chetlab
o'tgan har qanday so'rov o'z `X-Forwarded-For` ini yozib cheklovni
bekor qila oladi. Port ochish — cheklovni buzish demakdir.

#### Tanlangan yechim: xizmat kaliti

BFF API bilan **xizmat kaliti** orqali gaplashadi va mehmon shaxsini
**alohida** beradi:

| Sarlavha | Kim yozadi | Nima uchun |
|---|---|---|
| `X-LookSave-Service-Key` | faqat veb-server | «bu chaqiruv BFF dan» |
| `X-LookSave-Client-Ip` | faqat veb-server | mehmonning haqiqiy IP'si |

Kalit mos kelmasa sarlavha **butunlay e'tiborsiz** qoladi va cheklov
eskicha `req.ip` bo'yicha hisoblanadi. Kalit `INTERNAL_SERVICE_KEY`
da, ikkala ilovada bir xil qiymat.

**Nega bu xavfsiz:**

- Kalit faqat serverda (`process.env`), brauzer to'plamiga tushmaydi —
  Vite faqat `import.meta.env.VITE_*` ni inline qiladi. Mehmon kalitni
  bilmaydi, ya'ni o'z cheklovini o'zgartira olmaydi.
- Sarlavhalar CORS `allowedHeaders` ro'yxatiga **qo'shilmadi**
  (`app.ts`) — brauzer ularni yubora olmasin.
- Caddy bu sarlavhalarga tegmaydi; u faqat XFF ni boshqaradi. Ya'ni
  ikki mexanizm bir-biriga xalaqit bermaydi.
- IP `node:net` ning `isIP()` si bilan tekshiriladi — tekshirilmagan
  matn Redis kalitiga tushmaydi.
- Solishtirish `timingSafeEqual` bilan.

**Nega mehmon IP'si, cookie'dagi «mehmon id»si emas:** id'ni tozalash
bir bosish, ya'ni suiiste'molga qarshi qiymati yo'q. IP — anonim
cheklov uchun odatiy o'lchov.

**Cheklovi ochiq aytiladi:** kalit sizib chiqsa uni bilgan odam
istalgan IP'ni ko'rsatib cheklovni chetlab o'tadi. Shuning uchun kalit
sir sifatida saqlanadi (`infra/.env.example`) va faqat server-server.

#### Veb tomonda: qaysi sarlavhaga ishoniladi

Veb-server mehmon IP'sini o'zi ham **taxmin qilmaydi** — qaysi
sarlavha ishonchli ekani deploydan kelib chiqadi va `WEB_TRUST_PROXY`
bilan aniq aytiladi (`lib/client-ip.server.ts`):

| Qiymat | Qachon | Manba |
|---|---|---|
| `cloudflare` | Cloudflare Workers (13-sayt.md S-03) | `CF-Connecting-IP` — Cloudflare o'zi yozadi, soxtalashtirib bo'lmaydi |
| `1`, `2`, … | oldida shuncha ishonchli proksi | `X-Forwarded-For` oxiridan shuncha-inchi qiymat (Express bilan bir xil hisob) |
| bo'sh | dev, proksisiz | IP olinmaydi — eskicha ishlaydi |

Sozlanmagan bo'lsa IP **umuman olinmaydi**. Noto'g'ri sarlavhaga
ishonib cheklovni butunlay yo'qqa chiqargandan ko'ra shunisi xavfsiz.

#### IP `ApiOptions` orqali o'tadi, global orqali emas

`clientIp` — `ApiOptions` maydoni (`api/client.ts`) va u
`loader`/`action` ga kelgan `Request` dan olinadi. Global o'zgaruvchi
ishlatilmadi: bitta Node jarayoni bir vaqtda bir necha so'rovni
ishlaydi va global qiymat mehmonlar orasida aralashib ketardi —
cheklov noto'g'ri odamga yozilardi.

Kirmagan mehmon uchun `guest(request, locale)` (`session.server.ts`),
kirgan foydalanuvchi uchun `auth()` qaytaradigan `context.options`
ichida. **`{ locale }` ni qo'lda yozmang** — `clientIp` tushib qoladi
va o'sha sahifa yana umumiy chelakka qaytadi.

#### Bo'sh ≠ yiqilgan (§1.7)

Bosh sahifaning `loader` i xatoni `.catch(() => [])` bilan bo'sh
ro'yxatga aylantirardi, ya'ni `RATE_LIMITED` sahifada «brend yo'q»
bo'lib ko'rinardi — aynan shu jimlik S-4 ni topishni kechiktirdi.

Endi `loader` uchala holatni ajratadi:

| Holat | Nima ko'rinadi |
|---|---|
| Ma'lumot bor | Bo'lim odatdagidek |
| Rostdan bo'sh | Bo'lim **umuman chizilmaydi** (§4.1 o'zgarmadi) |
| So'rov yiqildi | Bo'lim sarlavhasi + `ErrorView` + «qayta urinish» |

Sahifa 500 qaytarmaydi: bosh sahifaning ko'p qismi marketing va u
API'ga bog'liq emas — bitta bo'lim kelmagani uchun butun sahifani xato
bilan almashtirish odamni saytdan quvadi.
