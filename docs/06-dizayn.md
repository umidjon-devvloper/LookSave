# 06 — Dizayn tizimi

**Manba:** LookSave pitch deck (13 slayd)
**Bog'liq:** [05-mobile.md](./05-mobile.md) · [07-web-panels.md](./07-web-panels.md)

Maqsad — deckdagi vizual tilni **kodga tushirish**, shunda ilova ham, web panellar ham, marketing materiallari ham bir xil ko'rinadi.

---

## 1. Vizual til — deckdan nima olinadi

| Element | Deckda qanday | Ilovada qanday |
|---|---|---|
| Fon | Deyarli qora, biroz binafsha tusli | `#0A0A0F` |
| Aksent | Yorqin binafsha, nurlanuvchi | `#8B5CF6` + glow |
| Kartalar | Nozik binafsha chegara, qorong'i to'ldirish | 1px `#2A2440` + `#14121C` |
| Bezak | Yupqa binafsha aylanalar, past shaffoflik | SVG fon qatlami |
| Sarlavha | Qalin, katta, siqilgan harflar | 32-40px, weight 700 |
| Bo'lim nomi | Kichkina, katta harf, keng oraliq | 11px, `letter-spacing: 1.6px` |
| Telefon ramkasi | Binafsha chegara + nurlanish | Faqat marketingda |
| Avatar platformasi | Nurlanuvchi konsentrik halqalar | 3D sahnada |
| O'lchov chiziqlari | Gorizontal nurlanuvchi chiziqlar + raqamlar | 3D overlay |
| Limited | Oltin/sariq aksent | `#F5C518` |

**Asosiy tuyg'u:** premium, kechki, texnologik. Oq fon yo'q, hech qayerda.

---

## 2. Ranglar

```ts
// src/theme/colors.ts
export const colors = {
  // ── Fon qatlamlari ──
  bg:         '#0A0A0F',   // eng past qatlam, ekran foni
  bgElevated: '#0F0D16',   // modal, bottom sheet
  surface:    '#14121C',   // karta
  surface2:   '#1C1928',   // karta ustidagi element (chip, input)
  surface3:   '#252036',   // hover / bosilgan holat

  // ── Chegaralar ──
  border:       '#241F33',  // oddiy ajratgich
  borderStrong: '#332B4A',  // ta'kidlangan
  borderAccent: '#7C3AED',  // faol / tanlangan

  // ── Binafsha shkala ──
  primary:     '#8B5CF6',   // asosiy tugma, faol holat
  primaryDim:  '#6D3FD9',   // bosilgan
  primaryDark: '#4C2A9E',   // fon to'ldirish
  primarySoft: 'rgba(139,92,246,0.14)',  // yumshoq fon
  accent:      '#C084FC',   // yorqin urg'u, ikonka
  accentGlow:  'rgba(139,92,246,0.45)',  // nurlanish

  // ── Matn ──
  text:      '#FFFFFF',
  textMuted: '#9B96AE',
  textDim:   '#635D78',
  textOnPrimary: '#FFFFFF',

  // ── Semantik ──
  success: '#22C55E',
  warning: '#F59E0B',
  danger:  '#EF4444',
  limited: '#F5C518',   // Limited drops — oltin

  // ── Status (buyurtma) ──
  statusWaiting:   '#F59E0B',
  statusConfirmed: '#22C55E',
  statusRejected:  '#EF4444',
  statusDone:      '#635D78',
} as const;
```

### Ranglardan foydalanish qoidalari

| Qoida | Sabab |
|---|---|
| Bir ekranda **bitta** to'ldirilgan binafsha tugma | Ikkitasi bo'lsa, ikkalasi ham urg'usini yo'qotadi |
| Ikkinchi darajali amal — chegarali tugma | Vizual ierarxiya |
| `accent` (#C084FC) faqat ikonka va kichik urg'u uchun | Katta maydonda ko'zni qamashtiradi |
| `limited` (oltin) faqat cheklangan mahsulotlarda | Qadri tushmasligi uchun |
| Oq fon hech qayerda yo'q | Deck bilan mos kelmaydi |

---

## 3. Tipografika

Deckda qalin, siqilgan grotesk ishlatilgan. Eng yaqin bepul variant — **Inter** (yoki **Space Grotesk** hero uchun).

```bash
npx expo install expo-font @expo-google-fonts/inter
```

```ts
// src/theme/typography.ts
export const type = {
  hero:    { fontFamily: 'Inter_700Bold',     fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
  h1:      { fontFamily: 'Inter_700Bold',     fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  h2:      { fontFamily: 'Inter_600SemiBold', fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h3:      { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 24 },
  body:    { fontFamily: 'Inter_400Regular',  fontSize: 15, lineHeight: 22 },
  bodyMed: { fontFamily: 'Inter_500Medium',   fontSize: 15, lineHeight: 22 },
  small:   { fontFamily: 'Inter_400Regular',  fontSize: 13, lineHeight: 18 },
  tiny:    { fontFamily: 'Inter_500Medium',   fontSize: 11, lineHeight: 14 },

  // Deckdagi "TOP BRANDS", "TRENDING NOW" uslubi
  label:   { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14,
             letterSpacing: 1.6, textTransform: 'uppercase' },

  // Logotip: "L O O K   S A V E"
  wordmark:{ fontFamily: 'Inter_600SemiBold', fontSize: 14, letterSpacing: 4.5,
             textTransform: 'uppercase' },

  price:   { fontFamily: 'Inter_700Bold',     fontSize: 18, lineHeight: 24 },
  priceOld:{ fontFamily: 'Inter_400Regular',  fontSize: 13, lineHeight: 18,
             textDecorationLine: 'line-through' },
} as const;
```

### Katta harf qayerda ishlatiladi

Deckda `EXPLORE. SHOP. ELEVATE.` va `MEN COLLECTION` katta harfda. Lekin **hamma joyda emas**:

| Katta harf | Oddiy |
|---|---|
| Bo'lim nomlari (`TRENDING NOW`) | Mahsulot nomi |
| Kategoriya kartalari (`MEN`) | Tugma matni |
| Logotip | Tavsif, izoh |
| Marketing sarlavhalari | Xato xabarlari |

O'zbek va rus tilida katta harf ingliz tilidagidek chiroyli chiqmaydi — kirill va o'zbek diakritikasi bilan ehtiyot bo'ling. `Ko'ylak` → `KO'YLAK` yomon ko'rinadi. Shuning uchun katta harf faqat **inglizcha yoki qisqa** yorliqlarda.

---

## 4. Oraliq va burchaklar

```ts
export const space  = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 };
```

| Element | Radius |
|---|---|
| Chip, kichik tugma | `pill` |
| Input, oddiy tugma | `md` (12) |
| Mahsulot kartasi | `lg` (16) |
| Katta karta, bottom sheet | `xxl` (28) |
| Modal | `xxl` yuqori burchaklar |

Ekran chetlaridan gorizontal padding — doim **16px**.

---

## 5. Nurlanish (glow) — platformalar bo'yicha

Deckdagi eng ko'zga tashlanadigan effekt. RN'da bu qiyin, chunki:

- **iOS:** `shadowColor` rangli soya beradi ✅
- **Android:** `elevation` faqat qora soya chizadi ❌

### Yechim 1 — ikki qatlamli (eng ishonchli)

```tsx
// src/components/ui/GlowView.tsx
export function GlowView({ children, color = colors.primary, intensity = 0.35 }) {
  return (
    <View style={{ position: 'relative' }}>
      {/* Nurlanish qatlami — asosiy elementdan kattaroq */}
      <View
        style={{
          position: 'absolute',
          top: -6, left: -6, right: -6, bottom: -6,
          borderRadius: radius.xxl,
          backgroundColor: color,
          opacity: intensity * 0.5,
        }}
      />
      {/* Asosiy element */}
      <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}
```

Bu ikkala platformada bir xil ishlaydi. "Haqiqiy" blur emas, lekin ko'zga yaqin.

### Yechim 2 — gradient chegara

```tsx
import { LinearGradient } from 'expo-linear-gradient';

<LinearGradient
  colors={['#8B5CF6', '#4C2A9E', '#8B5CF6']}
  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
  style={{ padding: 1.5, borderRadius: radius.xl }}
>
  <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl - 1.5 }}>
    {children}
  </View>
</LinearGradient>
```

Deckdagi telefon ramkalari va faol kartalar aynan shunday.

### Yechim 3 — platformaga qarab

```ts
export const glow = (color = colors.primary, strength: 'sm' | 'md' | 'lg' = 'md') => {
  const map = { sm: 8, md: 16, lg: 28 };
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: map[strength],
    },
    android: {
      // Android'da rangli glow yo'q — chegara bilan almashtiriladi
      borderWidth: 1,
      borderColor: color,
    },
    default: {},
  });
};
```

### ⚠️ Ishlash ogohlantirishi

Glow qatlamlari **ro'yxatda ishlatilmaydi**. 20 ta mahsulot kartasida glow bo'lsa, FlatList sekinlashadi. Glow faqat:

- Asosiy CTA tugmasi
- Faol/tanlangan element
- Try-On ekranidagi avatar platformasi
- Bo'sh holat illyustratsiyasi

Ro'yxat kartalarida glow o'rniga **chegara rangi** o'zgaradi.

---

## 6. Fon bezaklari

Deckda har slaydda yupqa binafsha aylana konturlari bor. Ilovada ular **bir marta**, ekran foni sifatida chiziladi:

```tsx
// src/components/ui/BackdropRings.tsx
import Svg, { Circle } from 'react-native-svg';

export function BackdropRings() {
  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0 }}
      width="100%" height="100%"
      pointerEvents="none"
    >
      <Circle cx="15%"  cy="8%"  r="180" stroke="#8B5CF6" strokeWidth="1" fill="none" opacity="0.10" />
      <Circle cx="95%"  cy="45%" r="240" stroke="#8B5CF6" strokeWidth="1" fill="none" opacity="0.07" />
      <Circle cx="-5%"  cy="88%" r="200" stroke="#8B5CF6" strokeWidth="1" fill="none" opacity="0.06" />
    </Svg>
  );
}
```

Faqat **statik ekranlarda**: onboarding, kirish, bo'sh holatlar, profil. Ro'yxatli ekranlarda ishlatilmaydi — mazmunni chalg'itadi.

---

## 7. Komponentlar

### Tugma

```tsx
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
```

| Variant | Fon | Chegara | Matn | Glow |
|---|---|---|---|---|
| `primary` | `#8B5CF6` | — | oq | ha (md) |
| `secondary` | shaffof | 1px `#332B4A` | oq | yo'q |
| `ghost` | shaffof | — | `#9B96AE` | yo'q |
| `danger` | shaffof | 1px `#EF4444` | `#EF4444` | yo'q |

Balandlik: 52px (asosiy), 44px (o'rta), 36px (kichik). Radius 12. Bosilganda `scale: 0.97` + fon `primaryDim`.

**O'chiq holat:** `opacity: 0.4`, bosilmaydi. Checkout tugmasi ma'lumot to'liq bo'lmaguncha shu holatda (05-mobile.md, 6.12).

### Karta

```tsx
{
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  padding: space.lg,
}
```

Faol/tanlangan holatda: `borderColor: colors.borderAccent`.

### Chip (o'lcham, rang, filtr)

| Holat | Fon | Chegara | Matn |
|---|---|---|---|
| Oddiy | `#1C1928` | 1px `#241F33` | `#9B96AE` |
| Tanlangan | `#8B5CF6` | — | oq |
| Mavjud emas | `#14121C` | 1px `#241F33` | `#635D78` + chiziq |

Balandlik 36px, radius `pill`, gorizontal padding 16.

### Bo'lim sarlavhasi

Deckdagi `✦ CHOOSE CATEGORY ✦` uslubi:

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  <Text style={[type.label, { color: colors.textMuted }]}>TRENDING NOW</Text>
  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
  <Text style={[type.small, { color: colors.primary }]}>Barchasi ›</Text>
</View>
```

### Kategoriya kartasi

Deckdagi `MEN COLLECTION` kartasi:

```
┌──────────────────────────────────┐
│ [foto, qorong'i overlay]         │
│                                  │
│  ERKAKLAR                    ( › )│
│  COLLECTION                      │
└──────────────────────────────────┘
```

- Balandlik 96px, radius `lg`
- Fon rasm + `rgba(10,10,15,0.55)` overlay (chapdan o'ngga gradient)
- Sarlavha `h2`, ostidagi yorliq `label` + `textMuted`
- O'ng tomonda 32px doira, ichida `›`, chegara `borderAccent`

### Mahsulot kartasi

```
┌────────────┐
│         ♡  │
│   [rasm]   │
│      ✨3D  │  ← has3d bo'lsa
├────────────┤
│ Nike Air…  │
│ 1 250 000  │
│ 340 m      │
└────────────┘
```

- Rasm nisbati 3:4, radius `lg`
- `✨ 3D` belgisi: `primarySoft` fon, `accent` matn, `pill` radius, 11px
- Yurak ikonkasi o'ng yuqorida, `rgba(0,0,0,0.4)` doira ichida

### Pastki navigatsiya

Deckdagidek — markazda ko'tarilgan doira:

```
┌─────────────────────────────────┐
│  🏠      📍     ╭───╮    🛍   👤 │
│                │ ✨ │            │
│                ╰───╯            │
└─────────────────────────────────┘
```

- Fon `#0F0D16`, yuqori chegara 1px `#241F33`
- Markaziy tugma: 58px doira, `primary` fon, 8px yuqoriga ko'tarilgan, glow (lg)
- Faol tab ikonkasi `primary`, nofaol `textDim`
- Savat badge: `danger` fon, oq raqam, 18px doira

---

## 8. 3D sahna vizuali

Deckdagi eng ta'sirli qism — avatar ostidagi nurlanuvchi halqalar va o'lchov chiziqlari.

### Platforma halqalari

```ts
// src/three/Platform.ts
function createPlatform(scene: THREE.Scene) {
  const rings = [
    { r: 0.45, opacity: 0.85, color: 0xC084FC },
    { r: 0.60, opacity: 0.50, color: 0x8B5CF6 },
    { r: 0.78, opacity: 0.25, color: 0x8B5CF6 },
  ];

  rings.forEach(({ r, opacity, color }) => {
    const geo = new THREE.RingGeometry(r - 0.012, r, 96);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);
  });
}
```

Sekin aylanish (`0.15 rad/s`) — deckdagi harakat tuyg'usi. Batareyani yemaydi, chunki faqat rotatsiya.

### Yoritish

```ts
scene.add(new THREE.AmbientLight(0x2A2440, 1.1));

const key = new THREE.DirectionalLight(0xFFFFFF, 1.5);
key.position.set(2, 3, 2);
scene.add(key);

const rimL = new THREE.DirectionalLight(0x8B5CF6, 1.2);   // chap kontur — binafsha
rimL.position.set(-3, 1.5, -1.5);
scene.add(rimL);

const rimR = new THREE.DirectionalLight(0xC084FC, 0.7);   // o'ng kontur
rimR.position.set(3, 1, -2);
scene.add(rimR);
```

Binafsha rim light — deckdagi ko'rinishning kaliti. Uni olib tashlasangiz, avatar oddiy o'yin personajiga o'xshab qoladi.

### O'lchov overlay

Deckdagi `180 cm`, `82 kg`, `42 EU` yorliqlari — bu 3D emas, **2D overlay**. Avatar ustiga absolyut joylashtiriladi:

```tsx
<View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <MeasureLabel value="180" unit="cm" top="8%"  side="left" />
  <MeasureLabel value="82"  unit="kg" top="38%" side="right" />
  <MeasureLabel value="42"  unit="EU" top="72%" side="right" />
</View>
```

Har yorliq: `surface2` fon, `border` chegara, radius `sm`, raqam `bodyMed` oq, birlik `tiny` `textMuted`.

Ular yonidagi gorizontal nurlanuvchi chiziq — 1px `LinearGradient` (`transparent → #8B5CF6 → transparent`).

**Faqat "O'lchamlarim" rejimida ko'rinadi**, oddiy try-on'da yo'q — aks holda ekran to'lib ketadi.

---

## 9. Animatsiya

```ts
export const motion = {
  fast:   150,   // bosish javobi
  base:   250,   // ekran elementlari
  slow:   400,   // modal, bottom sheet
  easing: Easing.bezier(0.22, 1, 0.36, 1),   // easeOutQuint
};
```

| Harakat | Effekt |
|---|---|
| Tugma bosilishi | `scale 1 → 0.97`, 150ms |
| Ekran o'tishi | Gorizontal slide, 250ms |
| Bottom sheet | Pastdan, spring |
| Karta paydo bo'lishi | `opacity 0→1` + `translateY 12→0`, ketma-ket 40ms kechikish |
| Slot almashtirish (3D) | Eski model `opacity 1→0` 120ms, yangi `0→1` 180ms |
| Skeleton | Shimmer, chapdan o'ngga, 1.2s loop |

**Qoida:** `useNativeDriver: true` bo'lmagan animatsiya yozilmaydi. Aks holda JS thread bloklandi va 3D sahna sekinlashadi.

---

## 10. Skeleton va bo'sh holatlar

### Skeleton

```tsx
{
  backgroundColor: colors.surface2,
  borderRadius: radius.md,
  overflow: 'hidden',
}
// Ustida shimmer: LinearGradient
// ['transparent', 'rgba(139,92,246,0.12)', 'transparent'], chapdan o'ngga
```

Har ro'yxat uchun o'z skeletoni — mahsulot to'ri, do'kon ro'yxati, buyurtma kartasi.

### Bo'sh holat

```
      ╭───────╮
      │  ✨   │        ← 72px doira, primarySoft fon
      ╰───────╯
   Hozircha bo'sh
   Yaqin atrofda do'kon topilmadi
   [ Radiusni kengaytirish ]
```

Sarlavha `h3`, izoh `small` + `textMuted`, tugma `secondary`.

| Ekran | Matn | Amal |
|---|---|---|
| Yaqin do'konlar bo'sh | Yaqin atrofda do'kon topilmadi | Radiusni kengaytirish |
| Savat bo'sh | Savatingiz bo'sh | Xarid qilishni boshlash |
| Buyurtma yo'q | Hali buyurtma bermagansiz | Do'konlarni ko'rish |
| Slot bo'sh (3D) | Bu turkumda 3D model yo'q | Boshqa turkum |
| Qidiruv natijasiz | Hech narsa topilmadi | Filtrlarni tozalash |

---

## 11. Ikonkalar

**Lucide** — nozik, zamonaviy, deckdagi uslubga mos.

```bash
npm i lucide-react-native react-native-svg
```

| O'lcham | Qayerda |
|---|---|
| 16 | Matn ichida, chip |
| 20 | Ro'yxat, tugma |
| 24 | Navigatsiya, sarlavha |
| 32+ | Bo'sh holat, onboarding |

`strokeWidth: 1.75` — standart 2 dan nozikroq, deckdagi tuyg'uga yaqin.

### Bajarilishi

Barcha ikonkalar `src/components/Icon.tsx` dagi **yagona jadvaldan** keladi —
ekranlar Lucide'ni to'g'ridan-to'g'ri import qilmaydi. Sabab: to'plam
almashtirilganda o'nlab faylni emas, bitta faylni tahrirlash kerak bo'ladi.

```tsx
<Icon name="cart" size={22} color={colors.accent} />
```

⚠️ **Kiyim slotlari istisno.** Lucide'da moda ikonkalari deyarli yo'q — shim,
kurtka va kepka umuman topilmaydi. Shuning uchun beshta slot
(`slotTop`, `slotBottom`, `slotFeet`, `slotOuter`, `slotHead`)
MaterialCommunityIcons dan olinadi. Ularning chizig'i Lucide'nikidan bir oz
yo'g'onroq, `slotBottom` esa vaqtincha ilgich (hanger) ikonkasi — buyurtma
qilingan ikonka to'plami kelganda birinchi navbatda shular almashtiriladi.

---

## 12. Web panellar bilan moslik

Do'kon kabineti va admin panel **bir xil rang tizimida**, lekin ish uchun moslashtirilgan:

| Farq | Sabab |
|---|---|
| Glow yo'q | Ish paneli, uzoq ishlatiladi — ko'z charchaydi |
| Fon `#0F0D16` (biroz ochiqroq) | Ekran katta, kontrast yumshoqroq bo'lsin |
| Jadval qatorlari zebra `#14121C` / `#181524` | O'qish qulayligi |
| Tipografika 14px asos | Ma'lumot zichligi yuqori |
| Aksent faqat CTA va faol holatda | Chalg'itmaslik |

Tailwind konfiguratsiyasi (07-web-panels.md da batafsil):

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      bg: '#0A0A0F', surface: '#14121C', surface2: '#1C1928',
      border: '#241F33', primary: '#8B5CF6', accent: '#C084FC',
      muted: '#9B96AE', dim: '#635D78', limited: '#F5C518',
    },
    borderRadius: { card: '16px', xl2: '28px' },
  },
}
```

`nativewind` mobil ilovada shu konfiguratsiyani ishlatadi — bitta manba, ikkala platforma.

---

## 13. Qoidalar ro'yxati

**Oq fon yo'q.** Hech qayerda, hech qachon. Modal ham, sheet ham qorong'i.

**Bir ekranda bitta binafsha tugma.** Ikkitasi urg'uni yo'qotadi.

**Glow ro'yxatlarda ishlatilmaydi.** FlatList'da 20 ta glow — kafolatlangan sekinlik.

**Katta harf faqat qisqa inglizcha yorliqlarda.** O'zbek va rus tilida chiroyli chiqmaydi.

**Har komponentning 3 holati bor:** oddiy, bosilgan, o'chiq. Uchtasini ham chizing.

**Kontrastni tekshiring.** Qora fonda `textDim` (#635D78) chegarada — uni faqat ikkinchi darajali ma'lumot uchun ishlating, hech qachon muhim matn uchun emas.

**Deckdagi telefon ramkalari faqat marketingda.** Ilova ichida ilovaning o'zi telefonda — ramka ichida ramka kulgili ko'rinadi.
