# 18 — Motion Design brifi

**Manba:** ilovaning o'z dizayn tizimi
([apps/mobile/src/theme/tokens.ts](../apps/mobile/src/theme/tokens.ts))
**Bog'liq:** [05-mobile.md](./05-mobile.md) · [06-dizayn.md](./06-dizayn.md)
([06-dizayn.md](./06-dizayn.md) deckdan yozilgan eski palitra;
**tokens.ts** haqiqat manbai — u yerda ilova yorug' atelier palitrasiga
o'tgan. Quyidagi barcha qiymatlar tokens.ts dan olingan.)

Maqsad — App Store Preview, Instagram Reels, va web promo uchun
motion design (afishalar, sahnalar, teaser). Ilovaning o'z dizayn tili
bilan **100%** bir xil ko'rinsin: xaridor bosganda hayratga tushmaydi.

---

## 1. Dizayn falsafasi (uslubning "nega"si)

Ilova o'zini SaaS deb hisoblamaydi, u **moda jurnali kabi ko'rinadi**:

- **"Atelier"** — radiuslar kichik va aniq (10/14/18/22/28), yumaloq
  SaaS card-kit emas.
- **"Chanel qoidasi"** — bir ekranda faqat **bitta** jasur binafsha
  tugma. Ikkitasi ham kuchini yo'qotadi.
- **Editorial serif + humanist sans** — Fraunces display uchun, Inter
  matn uchun. Serif qalin ko'rinadi, shuning uchun weight 500 (700 emas).
- **ALL CAPS yo'q** — eyebrow va label italic Fraunces. Bu "LABEL —
  fragment" klişesini sindiradi (Apple spam deydigan belgi).
- **Oq fon** — binafsha emas, krem oq (`#FBFAFF`). Ikat anor aksenti
  oq fonga qarshi chizilgan; dark fonda u qonga o'xshaydi.

Motion ham shunga ergashadi: **tez SaaS pop'lar yo'q**, jurnal sahifasi
varaqlangandek yumshoq o'tish. Ilgari dekk dark bo'lgan — ilova endi
yorug', shuning uchun eski "nurlanuvchi binafsha chiziq" motion'lari ham
olib tashlanadi.

---

## 2. Rang palitrasi (aniq HEX)

### Fon qatlamlari — krem, lavanda, oq

| Rol | HEX | Qayerda |
|---|---|---|
| `bg` | `#FBFAFF` | Ekran foni (motion plate'ning asosiy foni) |
| `bgElevated` | `#FFFFFF` | Modal, bottom sheet |
| `surface` | `#FFFFFF` | Karta |
| `surface2` | `#F4F0FF` | Chip, input, karta ustidagi element |
| `surface3` | `#ECE5FF` | Hover / bosilgan holat, yumshoq lavanda plita |

### Aksent — anor binafsha (ikat)

| Rol | HEX | Qoida |
|---|---|---|
| `primary` | `#8B2CF5` | **Bitta** jasur tugma — Chanel qoidasi |
| `primaryDim` | `#6414D8` | Bosilgan holat |
| `primaryDark` | `#3D087F` | Fon to'ldirish, chuqur yorug'lik |
| `primarySoft` | `rgba(139,44,245,0.10)` | Nozik yumshoq fon |
| `accent` | `#B936F4` | Ikonka, kichik urg'u — katta maydonda yo'q |
| `accentGlow` | `rgba(139,44,245,0.34)` | Faqat avatar platformasida |
| `borderAccent` | `#8B2CF5` | Faol/tanlangan chegara |

### Matn — chernila, ko'mir emas

| Rol | HEX |
|---|---|
| `text` | `#15131E` |
| `textMuted` | `#615D70` |
| `textDim` | `#9691A5` |
| `textOnPrimary` | `#FFFFFF` |

### Semantik — moda palitrasi (neon emas)

| Rol | HEX |
|---|---|
| `success` (sage) | `#16A66A` |
| `warning` | `#F59E0B` |
| `danger` (anor) | `#E8475F` |
| `limited` (oxra) | `#F5A524` |

### Chegara

| Rol | HEX |
|---|---|
| `border` | `#E9E4F2` |
| `borderStrong` | `#D8CDEB` |

⚠️ **Motion'ning "quyidagi rang kombinatsiyalaridan foydalanma":** yorqin
cyan, elektr ko'k, chiroyli gradient rainbow, SaaS neon yashil. Ilovada
yo'q — reklamada ham yo'q.

---

## 3. Tipografika

**Shriftlar** (loyihada EAS build ichida bundled):

- **Fraunces** (editorial serif, display) — hero, h1, h2, narx, wordmark,
  eyebrow, label. Italic esa eyebrow/label uchun.
- **Inter** (humanist sans, body) — h3, body, small, tiny.

Motion design uchun **Fraunces va Inter ni Google Fonts'dan yuklab olish**
shart; o'xshash shrift ishlatilsa — brand chatnashadi.

### Shkala (motion plate uchun)

| Rol | Font | O'lcham / line-height | Letter-spacing |
|---|---|---|---|
| `hero` | Fraunces 700 | 44 / 50 | 0 |
| `h1` | Fraunces 700 | 32 / 38 | 0 |
| `h2` | Fraunces 700 | 24 / 30 | 0 |
| `h3` | Inter 600 | 17 / 24 | — |
| `body` | Inter 400 | 15 / 24 | — |
| `eyebrow` / `label` | **Fraunces italic 600** | 13 / 18 | 0 |
| `price` | Fraunces 600 | 20 / 26 | — |
| `wordmark` ("LookSave") | Fraunces 600 | 16 | 0 |

**Letter-spacing qoidasi:** display matnida 0 — **tracked-out
ALL CAPS yo'q**.

---

## 4. Boshqa tokenlar

### Radius (Atelier shkalasi)

```
sm   10
md   14
lg   18
xl   22
xxl  28
pill 999   (chip, kichik tugma)
```

Motion'dagi har bir karta, tugma, chip shu shkaladan. Rasm maskalari ham.

### Spacing

```
xs  4
sm  8
md  16
lg  24
xl  32
xxl 48
```

Motion poster va kadrdagi hashiyalar shu shkaladan. "Chiroyliroq ko'rinsin"
deb oraliqni qo'shma.

---

## 5. Motion tili (animatsiya uslubi)

### Ritm

- **Oson va asta** — jurnal sahifasi 1.2-1.6 s davomida ochiladi. SaaS'ning
  0.3 s "bounce"'i yo'q.
- **One beat, one move** — har kadrning asosiy harakati bitta. Ikkita
  parallel animatsiya mahsulotni emas, animatorni ko'rsatadi.

### Easing

- Umumiy: **cubic-bezier(0.22, 1, 0.36, 1)** (ease-out quart) — tabiiy,
  oxirida silliq.
- Avatar aylanishi: **linear** — doimiy aylanish, teatr podiumi kabi.
- Narx, logotipning kirishi: **cubic-bezier(0.34, 1.56, 0.64, 1)** (yumshoq
  overshoot, kiyimsiz spring).

### Durations

| Harakat | Davomiyligi |
|---|---|
| Logotip paydo bo'lishi | 900 ms |
| Sarlavha matn | 1200-1600 ms |
| Kiyim manekenga "tushishi" | 1400 ms |
| Scene cut (sahna almashuvi) | 500-700 ms (yumshoq cross-fade) |
| UI chip kirishi | 300-400 ms |
| Narx roll-up | 800 ms |

### Taqiqlar

- **Parallax parallel** yo'q — bir vaqtda ikki qatlam turli tezlikda
  siljisa, teatr emas, veb-dev dek ko'rinadi.
- **Neon glow** yo'q. Faqat `accentGlow` — avatar platformasida, boshqa
  joyda ishlatilmaydi.
- **Letter-by-letter typing animation** yo'q (serif unga mos emas).
- **Yopiq ko'z yoki yulduz-sparkle** yo'q (moda emas, bola o'yini).
- **Shake / jitter / wiggle** yo'q.

### Ruxsatlar

- **Matn yuqoridan yoki pastdan 24 px siljib kirsin** (spacing.lg), bir
  vaqtda opacity 0→1.
- **Karta "clip-path" pastdan ochilsin** — jurnal sahifasi tushgandek.
- **Rasm ichida 1.02-1.06 lik Ken Burns** — tinch nafas olish.
- **Narx sonlari roll-up** (0 dan haqiqiy songacha, 0.8 s).

---

## 6. Logotip va grafik elementlar

### Logotip

- `apps/mobile/assets/logo.png` — gorizontal wordmark "LookSave"
- `apps/mobile/assets/logo-mark.png` — faqat belgi (adaptive icon
  foreground)
- Yorug' fonda — qora wordmark; `primaryDark` fonda — oq wordmark.

**Wordmark animatsiyasi:**
- **Faqat opacity 0→1** + 12 px yuqoridan tushish. Letter-by-letter
  typing yo'q.
- Mark (belgi) ni **aylantirmang, 3D flip qilmang**.

### Avatar platformasi

- Deckdan qolgan `accentGlow` konsentrik halqalar. Marketing uchun
  2 halqa yetadi: ichkisi `rgba(139,44,245,0.34)`, tashqisi
  `rgba(139,44,245,0.14)`.
- Platforma radiuslari: ellipslar, 60% perspektiv tushirish.

### "Trending Now" kartasi

Tokens.ts da aniq yozilgan: rasm, ustida sevimli tugma, pastda nom va
narx. Do'kon nomi va masofa yo'q. **Motion'da ham qo'shma.**

### Ikonlar

`src/components/Icon.tsx` — lineal 1.5 px, kam detal. Motion'da **bold
glyph** ishlatma; motion plate'da ikon kerak bo'lsa SVG'ni ilovadan ol.

---

## 7. Mavjud assets (rasmlar va video)

Hammasi `apps/mobile/assets/` da. Motion plate'da **shu rasmlardan**
foydalaning — tashqi stock photo ishlatilsa, ilova bilan uyg'unlashmaydi.

**Hero'lar va fon:**
- `hero-home-v2.png` — bosh sahifa hero
- `hero-market-v2.jpg` — marketplace hero
- `auth-bg.jpg` · `profile-bg.jpg` — profil / auth fon
- `tryon-premium-bg-v2.png` — primerka asosiy fon
- `tryon-boutique-bg-portrait-v2.png` — primerka portret fon
- `tryon-studio-bg.png` — studio versiya

**Avatar / manekin:**
- `tryon-boutique-female-v1.png` · `tryon-boutique-male-v1.png`
- `3d-person.jpg` — deckdagi ilk vizual

**Kolleksiyalar:**
- `collection-women-v2.jpg` · `collection-men-v2.jpg`
  · `collection-limited-v2.jpg`

**Sotuvchi paneli:**
- `seller-dashboard-bag-v2.png` · `seller-analytics-growth-v1.png`
  · `seller-orders-empty-v2.png` · `seller-settings-gear-v1.png`

**Splash:**
- `splash-intro.mp4` — mavjud intro video. **Yangi splash yasasangiz, shu
  stilga ergashing** (uzunligi, tempi, oxirgi kadr logotipi).

---

## 8. Sahnalar (App Store Preview, 30 s)

Ilovaning asosiy tortuvi — **virtual primerka**. Barcha boshqa narsa yordamchi.

### Scene 1 — Opener (0:00-0:03)

- Krem oq fon (`#FBFAFF`).
- Markazida Fraunces italic eyebrow: *"Kiyimni sotib olishdan oldin"*
- 0.8 s ushlab turing, keyin pastga 24 px siljib ketadi.

### Scene 2 — Avatar kirishi (0:03-0:08)

- `tryon-studio-bg.png` orqa fon ravishda cross-fade orqali keladi
  (opacity 0→1, 1200 ms).
- Avatar (`tryon-boutique-female-v1.png`) markazga ko'tariladi: y: +40 → 0,
  opacity 0→1, 1400 ms.
- Pastda `accentGlow` konsentrik halqalar paydo bo'ladi (platforma).
- Hero matn (Fraunces 44): *"Siz kiyib ko'rganday"*

### Scene 3 — Mahsulot tanlash (0:08-0:14)

- Rost katalogdan 3 ta TrendingCard (ilovaning o'z `TrendingCard`
  komponentidan screenshot/rekord).
- Pastdan stack bo'lib chiqishadi, oraliq 150 ms (stagger).
- Birini "bosganday" tanlanadi: karta borderi `borderAccent` ga
  o'tadi (300 ms).

### Scene 4 — Kiyinish (0:14-0:20)

- Avatar kadrda qoladi, kiyim (mahsulot rasmi) yuqoridan tushadi, 1400 ms,
  easing ease-out quart.
- Avatar aylanishi boshlanadi: 360° / 8 s linear.
- Pastda chip sari narxning roll-up: `650 000 so'm` (Fraunces 600,
  `price` style).

### Scene 5 — "LookSave" wordmark (0:20-0:25)

- Avatar fade-out orqa plan (opacity 1→0.3), surface2 lavanda to'shalma.
- Markazida wordmark "LookSave" (Fraunces 600, 44 px), opacity 0→1
  + 12 px yuqoridan tushish.
- Pastida: *"App Store'da"* (Fraunces italic 13).

### Scene 6 — End card (0:25-0:30)

- Oq fon, markazida `logo.png` + QR / App Store badge.
- 1 primary binafsha tugma (Chanel qoidasi): *"Yuklab oling"*.
- Statik ushlab tur, 2 s.

---

## 9. Qisqa variantlar

### 15 s versiya (Instagram Reels)

Scene 2 → Scene 4 → Scene 6 (opener va mahsulot tanlashni olib tashlang).

### 6 s (bumper, Stories)

Scene 2 ning birinchi 2 s + Scene 4 ning oxirgi 3 s + Scene 6 ning
birinchi 1 s. Bitta tovush effekti — kiyim tushganda yumshoq "whoosh".

### Statik poster (1080×1920, Stories)

- `tryon-premium-bg-v2.png` asos.
- Avatar 60% balandlik, markazlashtirilgan.
- Yuqorida Fraunces hero: *"Siz kiyib ko'rganday"*
- Pastda primary tugma: *"Yuklab oling"*

---

## 10. Tovush

Jonli effektlar — minimal:

- Kiyim tushishi — yumshoq paper-whoosh, -18 dB.
- Narx roll-up — ovozsiz (jurnal uslubi).
- Wordmark kirishi — tabiiy ambient pad (jazz vibraphone yoki yumshoq
  piano C tone, 1 s).

**Taqiqlangan:** EDM drop, trap hi-hat, "tech whoosh" nsuxalari. Moda
boutique uyida eshitilmaydi.

---

## 11. Render spetsifikatsiyasi

| Format | Rasm nisbati | FPS | Codec |
|---|---|---|---|
| App Store Preview (iPhone 6.5" / 6.7") | 886×1920 / 1080×1920 | 30 | H.264, high profile |
| Instagram Reels / TikTok | 1080×1920 | 30 | H.264 |
| Instagram Feed | 1080×1350 | 30 | H.264 |
| Web hero loop | 1920×1080 | 30 | H.264 + WebM VP9 |

**Rangli makon:** sRGB. HDR yo'q — App Store Preview HDR'ni qisadi.

**Fayl nomi konventsiyasi:** `looksave-promo-<scene>-<format>-v<N>.mp4`

---

## 12. Nimani ko'rsatmaslik

- **Sotuvchi paneli (My store)** — oddiy xaridorga qiziq emas.
- **Buzuq kesim yoki natijaning yarmi** — aynan hozirgi tex xato bor,
  motion'da ko'rsatsak diqqatni jalb qiladi.
- **"AI generated"** so'zi — Apple'ning generativ AI jargoniga sezgirligi
  bor, va biz uni "Siz kiyib ko'rganday" deb aytamiz.
- **Narx pasaytirilishi, chegirma rangli belgisi** — hozir katalogda
  chegirma yo'q.
- **Harbiy/politsiya/bola yuzlari** — App Review'ning 1.1-1.3 bo'limi.

---

## 13. Yakuniy tekshirish ro'yxati

Topshirishdan oldin har bir motion asset'ni shu bo'yicha tekshiring:

- [ ] Hamma rang `tokens.ts` dan olingan (brauzer DevTools pipette bilan
  ekranning har qismini tekshiring).
- [ ] Fraunces va Inter ishlatilgan; o'rnini bosuvchi shrift yo'q.
- [ ] Bir ekranda faqat bitta to'ldirilgan binafsha tugma.
- [ ] Oq fonda `primaryDark` (`#3D087F`) matn yo'q (kontrast juda qattiq).
- [ ] Easing cubic-bezier(0.22, 1, 0.36, 1); default "ease" yo'q.
- [ ] Hero matn Fraunces, letter-spacing 0 (tracked-out emas).
- [ ] Mahsulot rasmlar ilovaning haqiqiy katalogidan.
- [ ] Oxirgi 1 s'da logo va "App Store'da" ko'rinadi.
- [ ] Rendering 30 fps; droplet kadr yo'q.
- [ ] Tovush -14 LUFS atrofida (Instagram taleb qiladi).
