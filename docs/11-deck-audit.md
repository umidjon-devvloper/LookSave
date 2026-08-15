# 11 — Deck ↔ kod auditi

**Manba:** `LookSave_Pitch_Deck.pdf` (13 slayd) · **Sana:** 2026-08-14
**Bog'liq:** [06-dizayn.md](./06-dizayn.md) · [05-mobile.md](./05-mobile.md) · [10-roadmap.md](./10-roadmap.md)

Deckdagi har bir slayd ko'rib chiqildi va kod bazasi bilan solishtirildi. Maqsad —
"ilova deckka o'xshamayapti" degan tuyg'uni aniq ro'yxatga aylantirish.

---

## 1. Qisqa xulosa

Uch xil nomuvofiqlik bor, ularni aralashtirmaslik kerak:

| Tur | Nima | Hajmi |
|---|---|---|
| **A. Xato bajarilgan** | Hujjatda deckdan to'g'ri ko'chirilgan, lekin kodda boshqacha yozilgan | Kichik, tuzatildi |
| **B. Ataylab keyinga qoldirilgan** | Deckda bor, hujjatda "Faza 2/3" deb belgilangan | Katta, reja bo'yicha |
| **C. Hech qayerda yo'q** | Deckda ko'rinadi, lekin hujjatda ham, kodda ham yo'q | Qaror talab qiladi |

⚠️ Muhim: `06-dizayn.md` ning birinchi qatorida **"Manba: LookSave pitch deck (13 slayd)"**
deb yozilgan. Ya'ni dizayn tizimi allaqachon deckdan olingan — muammo hujjatda emas,
hujjat bilan koddagi bajarilish orasida edi.

---

## 2. Slaydlar bo'yicha

| # | Slayd | Kodda holati |
|---|---|---|
| 01 | LOOK SAVE — AI Fashion Marketplace | Home ekrani bor, lekin deckdagi hero blok (`EXPLORE. SHOP. ELEVATE.`), brend qatori, `TRENDING NOW` gridi yo'q |
| 02 | The Problem | — (marketing) |
| 03 | The Solution — Create Your Avatar | Face Scan → Body Type → Shoe Size → Complete sehrgari yo'q. Faqat `settings/measurements.tsx` bor |
| 04 | Personal Avatar & Fit Data | 3D avatar bor (`src/three/`), lekin o'lchov overlay chiziqlari (180cm / 82kg / 42EU) yo'q |
| 05 | Virtual Try-On Flow | ⭐ **Bor va ishlaydi** (`app/tryon.tsx`, 354 qator). Rotate/Zoom/Reset, rang, o'lcham deckdagidek |
| 06 | AI Designer | Yo'q. Bazada tayyorgarlik bor: `looks.created_by='ai_designer'`, `occasion` ustuni ([006_looks.sql:15](../infra/migrations/006_looks.sql#L15)). Rejada Faza 3 |
| 07 | Marketplace — MEN / WOMEN / LIMITED | Yo'q. Katalog kategoriya daraxti bo'yicha ishlaydi (tops/bottoms/shoes…), deckdagi jins + limited bo'linishi emas |
| 08 | Premium Brands & Limited Drops | Brendlar bazada bor (`brands`), `limited` rangi tokenda bor. Home'da brend qatori va limited bo'limi yo'q |
| 09 | Smart Mirror & AR | Yo'q. `00-README.md:90` da ❌ deb belgilangan |
| 10 | Business Model | Komissiya bazada bor (`DEFAULT_COMMISSION_RATE=0`, K-12). SaaS/token qatlamlari yo'q |
| 11 | Token / NFT / Digital Shares | Yo'q. `00-README.md:91` da ❌ |
| 12 | Global Fashion Economy | — (vizyon) |
| 13 | Pre-seed $500,000 | — (biznes) |

---

## 3. A tur — tuzatildi

### 3.1 Rang tokenlari

`src/theme/tokens.ts` da 12 ta rang bor edi, `06-dizayn.md` §2 da 25 ta. Bundan tashqari
5 tasining qiymati noto'g'ri edi:

| Token | Kodda edi | Hujjatda (deck) |
|---|---|---|
| `surface` | `#14141C` | `#14121C` |
| `surface2` | `#1E1E2A` | `#1C1928` |
| `border` | `#2A2A3A` | `#241F33` |
| `textMuted` | `#9CA3AF` | `#9B96AE` |
| `textDim` | `#6B7280` | `#635D78` |

Koddagi qiymatlar neytral-kulrang (Tailwind'ning standart kulrangi), deckniki esa
**binafsha tusli** kulrang. Shuning uchun ilova deckdagidek "issiq binafsha" emas,
sovuq kulrang ko'rinardi. Endi hammasi hujjatga teng.

Qo'shildi: `bgElevated`, `surface3`, `borderStrong`, `borderAccent`, `primaryDark`,
`primarySoft`, `accentGlow`, `textOnPrimary`, 4 ta buyurtma status rangi.

### 3.2 Tipografika

Hujjat §3 Inter shriftini talab qiladi, kod esa tizim shriftini `fontWeight` bilan
ishlatardi — ya'ni iOS'da San Francisco, Android'da Roboto. Deckdagi qalin grotesk
tuyg'usi yo'qolardi.

Bajarildi: `expo-font` + `@expo-google-fonts/inter` o'rnatildi, 4 ta qalinlik
(`400/500/600/700`) [_layout.tsx](../apps/mobile/app/_layout.tsx) da yuklanadi, shrift
tayyor bo'lmaguncha ekran ko'rsatilmaydi (sakrash bo'lmasligi uchun).

Qo'shilgan uslublar: `hero` (40px), `wordmark` (`L O O K   S A V E`, letter-spacing 4.5),
`price`, `priceOld`. Hajmlar hujjatga moslandi: `h1` 32→30, `h2` 24→22, `h3` 18→17.

### 3.3 Burchaklar

`radius.xl` 24 → 20, qo'shildi `xxl: 28` (katta karta, bottom sheet) va `pill`.
`full` eski nom sifatida qoldirildi — kodda 14 joyda ishlatilgan.

---

## 4. B tur — rejada bor, hali qurilmagan

Bular [10-roadmap.md](./10-roadmap.md) bo'yicha ataylab keyinga qoldirilgan:

- **AI Designer** — Faza 3, 23-25-haftalar (Gemini + fallback)
- **AR / smart mirror** — fazadan tashqari
- **Token / NFT / digital shares** — fazadan tashqari, yuridik qism alohida

Bularni oldinga surish mumkin, lekin bu roadmap qaroridir — texnik to'siq emas.

---

## 5. C tur — qaror kerak

### 5.1 Pastki navigatsiya — uch xil manba, uch xil javob

| Manba | Tablar |
|---|---|
| **Deck 01/08-slayd** | 🏠 · 🧭 · 🛍 (markazda, ko'tarilgan) · 👥 · 👤 |
| **Deck 07-slayd** | HOME · AI STYLIST · BATTLE · MARKETPLACE · PROFILE |
| **05-mobile.md §4** | Home · **Try-On (markazda, kattaroq)** · Do'konlar · Savat · Profil |
| **Kod** | Home · Do'konlar · Savat · Profil |

Deckning o'zi ikki xil tab qatorini ko'rsatadi. Kodda esa markaziy ko'tarilgan tugma —
deckdagi eng ko'zga tashlanadigan UI elementi — umuman yo'q, 4 ta oddiy tab bor.

**Men buni o'zim tanlamadim**, chunki bu mahsulot qarori: Try-On markazda bo'ladimi
(hujjat shunday deydi) yoki AI Stylist / Marketplace (deckning 07-slaydi shunday)?

### 5.2 "BATTLE" tabi

07-slaydda bor. Loyihada — hujjatda ham, bazada ham, kodda ham — **bir marta ham
uchramaydi**. Nima ekanligi hech qayerda tavsiflanmagan (ikki komplekt ovoz berish?
foydalanuvchilar bellashuvi?). Spetsifikatsiya kerak.

### 5.3 Marketplace bo'linishi

Deck: MEN / WOMEN / LIMITED. Kod: kategoriya daraxti (tops → t-shirts…).
Baza `categories` jadvali ierarxik, jins ustuni yo'q. Bu migratsiya talab qiladi.

### 5.4 Geo-qidiruv deckda yo'q

Teskari nomuvofiqlik: kodda PostGIS bilan "yaqin atrofdagi do'konlar" qurilgan
(`ST_DWithin`, 5 km), va bu arxitekturaning markazida. Deckning **birorta slaydida**
xarita yoki geo-qidiruv yo'q — deck sof marketplace + avatar hikoyasi.

Ya'ni savol faqat "deckka qanday yetamiz" emas, balki **"geo qismi qoladimi?"** ham.

---

## 6. Keyingi qadam

Tartib men taklif qilgan ketma-ketlikda:

1. Navigatsiya qarori (5.1) — bu qolgan hamma ekranning joyini belgilaydi
2. Home ekranini deckka moslash: hero blok, brend qatori, `TRENDING NOW` grid
3. Avatar sehrgari (03-slayd): Face Scan → Body Type → Shoe Size → Complete
4. Marketplace bo'linishi (5.3) — baza migratsiyasi bilan
5. Limited drops bo'limi (08-slayd) — `limited` oltin rangi allaqachon tokenda
6. AI Designer (Faza 3 dan oldinga surilsa)

1-5 texnik jihatdan aniq, faqat 5.1 va 5.3 qarorini kutadi. 6 esa LLM integratsiyasi
va byudjet masalasi.
