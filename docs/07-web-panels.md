# 07 — Web panellar

**Stack:** Vite · React 18 · TypeScript · Tailwind CSS · TanStack Query · React Router
**Bog'liq:** [03-api-spec.md](./03-api-spec.md) · [06-dizayn.md](./06-dizayn.md)

Ikkita alohida ilova, bitta umumiy komponent kutubxonasi:

| Panel | Domen | Kim uchun |
|---|---|---|
| Do'kon kabineti | `store.looksave.app` | Do'kon egasi va xodimlari |
| Admin panel | `admin.looksave.app` | LookSave jamoasi |

---

## 1. Nima uchun alohida ilova

Bitta ilovada rol bo'yicha yashirish mumkin edi, lekin:

- Admin kodi do'kon egasining brauzeriga umuman yetib bormaydi
- Bundle kichik — do'kon egasi Toshkentdagi sekin internetdan kiradi
- Deploy mustaqil — adminni yangilash do'konlarga ta'sir qilmaydi
- Xavfsizlik: admin endpointlari haqida ma'lumot tashqariga chiqmaydi

Umumiy qism `packages/ui` da: tugma, jadval, modal, form, toast, sana tanlagich.

---

## 2. Papka tuzilmasi

```
apps/store-panel/
├── src/
│   ├── main.tsx
│   ├── router.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── orders/         List.tsx  Detail.tsx
│   │   ├── products/       List.tsx  Edit.tsx  New.tsx
│   │   ├── Analytics.tsx
│   │   ├── Invoices.tsx
│   │   └── settings/       Store.tsx  Team.tsx  Telegram.tsx  Blocklist.tsx
│   ├── components/
│   │   ├── layout/         Sidebar.tsx  Topbar.tsx  Shell.tsx
│   │   ├── orders/         OrderCard.tsx  StatusBadge.tsx  RejectModal.tsx
│   │   ├── products/       ProductForm.tsx  VariantEditor.tsx  ImageUploader.tsx
│   │   └── charts/
│   ├── hooks/              useOrderStream.ts  useSound.ts  useAuth.ts
│   ├── api/
│   └── lib/
└── tailwind.config.js

apps/admin-panel/            # bir xil tuzilma
packages/ui/                 # umumiy komponentlar
```

---

## 3. Autentifikatsiya

Kirish — **telefon + SMS OTP**, mobil ilovadagi kabi. Parol yo'q: do'kon egasi parolni unutadi, telefoni esa doim yonida.

```
Login sahifasi
   ↓ telefon
   ↓ OTP
   ↓ JWT (role tekshiriladi)
   ├─ store_owner / staff → do'kon kabineti
   ├─ admin              → admin panel
   └─ customer           → "Bu panel do'konlar uchun" + ilova havolasi
```

Token `httpOnly` cookie'da (web'da `localStorage` xavfli — XSS). `refreshToken` ham cookie'da, `SameSite=Strict`.

Bir foydalanuvchi bir necha do'konga ega bo'lsa — yuqorida do'kon almashtirgich.

### Ro'yxatdan o'tish (`/apply`)

> **Hujjatga qo'shimcha.** Bu ekran boshida yo'q edi — panel do'kon
> allaqachon mavjud deb hisoblagan.

`customer` roli bilan kirgan foydalanuvchiga "Do'kon ochmoqchimisiz?"
havolasi ko'rinadi. Ariza yuborilgach rol `store_owner` ga ko'tariladi va
panelga kiradi, lekin do'kon `pending` bo'lgani uchun katalogda ko'rinmaydi.

Koordinata hozircha **qo'lda kiritiladi** (Google Maps'dan nusxa). Xarita
tanlagich alohida ish: panelga Maps kutubxonasi qo'shilishi kerak.

---

## 4. Do'kon kabineti

### 4.1 Umumiy tuzilma

```
┌──────────┬──────────────────────────────────────────┐
│          │ Chilonzor Fashion ▾        🔔 3    👤    │
│  ✨ LS   ├──────────────────────────────────────────┤
│          │                                          │
│ 📊 Bosh  │                                          │
│ 📦 Buyur │              [ mazmun ]                  │
│    tmalar│                                          │
│    ● 3   │                                          │
│ 🏷 Mahsu │                                          │
│    lotlar│                                          │
│ 📈 Statis│                                          │
│ 🧾 Hisob │                                          │
│ ⚙️ Sozla │                                          │
└──────────┴──────────────────────────────────────────┘
```

Yon panel 220px, yig'iladi. Mobilda pastdan tab bar.

**Muhim:** do'kon egasi panelni telefonda ochadi. Barcha ekranlar **mobilda ham to'liq ishlashi shart** — bu "keyin qilamiz" emas, birinchi navbatdagi talab.

### 4.2 Bosh sahifa

```
┌───────────┬───────────┬───────────┬───────────┐
│ Yangi     │ Jarayonda │ Bu oy     │ Daromad   │
│    3      │    7      │   42      │ 18.4 mln  │
│ ● javob   │           │           │           │
│   kutmoqda│           │           │           │
└───────────┴───────────┴───────────┴───────────┘

┌─────────────────────────┬────────────────────────┐
│ Javob tezligi           │ Tasdiqlash foizi       │
│ ⚡ 12 daqiqa            │ 87%                    │
│ Yaxshi                  │ ▓▓▓▓▓▓▓▓░░             │
└─────────────────────────┴────────────────────────┘

Yangi buyurtmalar                       Barchasi ›
┌──────────────────────────────────────────────────┐
│ LS-260812-0043 · 4 daqiqa oldin                  │
│ Aziz Karimov · Nike Air Max 90 · 42              │
│ 1 265 000 so'm · 🚚 Yetkazish                    │
│ [ Tasdiqlash ]  [ Rad etish ]                    │
└──────────────────────────────────────────────────┘

[ 3D kutilmoqda: 5 ta mahsulot ]   [ Ombor tugagan: 2 ta ]
```

**Javob tezligi ko'rsatkichi ataylab yuqorida.** U qidiruv reytingiga ta'sir qiladi (02-database.md, 10.7) va do'konni tez javob berishga undaydi. Baho: `< 15 daq` yaxshi 🟢 · `15-60 daq` o'rtacha 🟡 · `> 60 daq` sekin 🔴

### 4.3 Buyurtmalar — panelning yuragi

```
┌ Yangi (3) ─┬ Jarayonda (7) ─┬ Yakunlangan ─┬ Rad etilgan ┐

┌──────────────────────────────────────────────────────┐
│ LS-260812-0043          🟡 Yangi    ⏱ 22:14 qoldi    │
│ ──────────────────────────────────────────────────── │
│ 👤 Aziz Karimov                                      │
│ 📞 +998 90 123 45 67          [ Qo'ng'iroq ]         │
│ ✅ 4 ta yakunlangan buyurtma · 0 bekor                │
│                                                      │
│ 🚚 Yetkazib berish                                   │
│ 📍 Chilonzor 9-kvartal, 24-uy, 12-xonadon            │
│    Mo'ljal: Mehnat metrosi yonida        [ Xarita ]  │
│                                                      │
│ ┌────┐ Nike Air Max 90                               │
│ │    │ Qora · 42 · 1 dona · 1 250 000                │
│ └────┘                                               │
│                                                      │
│ 💬 "Kechqurun 18:00 dan keyin qo'ng'iroq qiling"     │
│                                                      │
│ Jami: 1 265 000 so'm · 💵 To'lov yetkazilganda       │
│                                                      │
│ [ ✅ Tasdiqlash ]  [ ❌ Rad etish ]                   │
└──────────────────────────────────────────────────────┘
```

**`customerTrust` ko'rsatiladi** — "4 ta yakunlangan, 0 bekor". Yangi mijoz (0 buyurtma) va doimiy mijoz farq qiladi, sotuvchi shunga qarab qaror qiladi.

**Taymer** 24 soatdan orqaga sanaydi. 6 soatdan kam qolsa qizil.

### Rad etish oynasi

```
┌─ Buyurtmani rad etish ───────────────────┐
│                                          │
│  Sabab:                                  │
│  ○ Mahsulot tugagan                      │
│  ○ Bu o'lcham yo'q                       │
│  ○ Narx o'zgargan                        │
│  ● Soxta buyurtma / mijoz kelmadi        │
│  ○ Boshqa                                │
│                                          │
│  Izoh (ixtiyoriy)                        │
│  [ Raqam ishlamayapti              ]     │
│                                          │
│  ☑ Bu raqamni bloklash                   │
│    +998 90 123 45 67 shu do'kondan       │
│    boshqa buyurtma bera olmaydi          │
│                                          │
│         [ Bekor ]  [ Rad etish ]         │
└──────────────────────────────────────────┘
```

Sabab **majburiy**. `fake_order` tanlanganda "bloklash" belgisi avtomatik yoqiladi.

### 4.4 Real vaqtda yangi buyurtma

Panel ochiq bo'lsa, yangi buyurtma **darhol** ko'rinishi kerak.

```ts
// src/hooks/useOrderStream.ts
export function useOrderStream() {
  const qc = useQueryClient();
  const playSound = useSound('/sounds/new-order.mp3');

  useEffect(() => {
    const es = new EventSource('/v1/store/events/stream', { withCredentials: true });

    es.addEventListener('order.new', (e) => {
      const order = JSON.parse(e.data);
      qc.invalidateQueries({ queryKey: ['store', 'orders'] });
      playSound();
      toast.info(`Yangi buyurtma ${order.orderNumber}`, { duration: 10000 });
      document.title = `(${++unseen}) LookSave`;
      if (Notification.permission === 'granted') {
        new Notification('Yangi buyurtma', { body: order.orderNumber });
      }
    });

    es.addEventListener('order.updated', () => {
      qc.invalidateQueries({ queryKey: ['store', 'orders'] });
    });

    es.onerror = () => { es.close(); setTimeout(() => window.location.reload(), 5000); };
    return () => es.close();
  }, []);
}
```

**To'rtta signal birdan:** tovush, toast, sahifa sarlavhasi, brauzer bildirishnomasi. Do'kon egasi boshqa oynada ishlayotgan bo'lishi mumkin.

Tovushni birinchi kirishda so'rang: "Yangi buyurtmalarda tovush chalinsinmi?" — brauzer avtomatik tovushni bloklaydi, foydalanuvchi ruxsati kerak.

> **Lekin asosiy kanal baribir Telegram.** Panel ochiq turmasligi mumkin (K-11). SSE — qo'shimcha qulaylik, yagona umid emas.

### 4.5 Mahsulotlar

```
[ + Mahsulot qo'shish ]     [ Qidirish… ]  [ Kategoriya ▾ ]  [ Holat ▾ ]

┌──────┬─────────────────┬──────────┬────────┬──────┬────────┐
│ Rasm │ Nomi            │ Kategor. │ Narx   │ Omb. │ 3D     │
├──────┼─────────────────┼──────────┼────────┼──────┼────────┤
│ 🖼   │ Nike Air Max 90 │ Krossov. │ 1.25M  │ 10   │ ✅ Tay.│
│ 🖼   │ Zara Hoodie     │ Xudi     │ 450k   │ 3 ⚠️ │ ⏳ Nav.│
│ 🖼   │ Local Jacket    │ Kurtka   │ 890k   │ 0 🔴 │ — Yo'q │
└──────┴─────────────────┴──────────┴────────┴──────┴────────┘
```

`3D` ustuni: `— Yo'q` · `⏳ Navbatda` · `🔄 Ishlanmoqda` · `✅ Tayyor` · `❌ Xato`

### Mahsulot formasi

```
Asosiy
  Nomi *          [ Nike Air Max 90              ]
  Tavsif          [                              ]
  Kategoriya *    [ Oyoq kiyim › Krossovka    ▾ ]
  Brend           [ Nike                      ▾ ]
  Jins *          ( ) Erkak  ( ) Ayol  (•) Unisex
  Narx *          [ 1 250 000 ] so'm
  Eski narx       [ 1 500 000 ]

Rasmlar *  (kamida 3 ta, 1000×1000 dan katta)
  [🖼][🖼][🖼][ + ]

Variantlar (rang)
  ┌────────────────────────────────────────────┐
  │ ● Qora   #1a1a1a                    [ ✕ ] │
  │   O'lchamlar va ombor:                     │
  │   40 [3]  41 [5]  42 [7]  43 [0]  44 [2]  │
  │   [🖼][🖼]  rasmlar                        │
  └────────────────────────────────────────────┘
  [ + Rang qo'shish ]

3D model
  ☐ Bu mahsulot uchun 3D model buyurtma qilish
    Modellar navbat bo'yicha tayyorlanadi (5-10 kun)

[ Qoralama saqlash ]        [ Nashr qilish ]
```

**Rasm yuklash** — `presign` orqali to'g'ridan-to'g'ri R2 ga (03-api-spec.md, 13-bo'lim). Serverdan o'tmaydi.

```ts
async function uploadImage(file: File) {
  const { data } = await api.post('/store/uploads/presign', {
    fileName: file.name, contentType: file.type, purpose: 'product',
  });
  await fetch(data.uploadUrl, { method: 'PUT', body: file,
    headers: { 'Content-Type': file.type } });
  return data.publicUrl;
}
```

Yuklashdan oldin brauzerda siqish (`browser-image-compression`) — 1200px, WebP, 85%. 5 MB foto 200 KB ga tushadi.

### 4.6 Statistika

```
[ 7 kun ] [ 30 kun ] [ 90 kun ] [ Muddat ▾ ]

┌─────────┬─────────┬─────────┬─────────┐
│ Ko'rish │ Try-On  │ Buyurtma│ Konvers.│
│ 4 280   │ 1 140   │ 42      │ 3.7%    │
│ ↑12%    │ ↑28%    │ ↑8%     │ ↓0.3%   │
└─────────┴─────────┴─────────┴─────────┘

[ Buyurtmalar grafigi — kunlik ustunlar ]

Top mahsulotlar
┌────────────────┬────────┬────────┬────────┐
│ Nomi           │ Ko'rish│ Try-On │ Buyurt.│
│ Nike Air Max   │ 890    │ 340    │ 12     │
└────────────────┴────────┴────────┴────────┘
```

**Try-On → buyurtma nisbati** — do'kon uchun eng qimmatli raqam. Agar mahsulot ko'p kiyib ko'rilib, kam sotib olinsa: narx yuqori, o'lcham yo'q yoki 3D model sifatsiz.

Grafiklar — **Recharts** (yengil, React uchun tabiiy).

### 4.7 Hisoblar (komissiya)

```
┌──────────────────────────────────────────────┐
│  Hozircha komissiya olinmaydi                │
│  LookSave dastlabki bosqichda bepul.         │
│  Quyidagi raqamlar ma'lumot uchun.           │
└──────────────────────────────────────────────┘

┌───────────┬─────────┬────────────┬───────────┐
│ Davr      │ Buyurt. │ Aylanma    │ Komissiya │
│ 2026 Iyul │ 38      │ 16.2 mln   │ 0 (bepul) │
│ 2026 Iyun │ 24      │ 9.8 mln    │ 0 (bepul) │
└───────────┴─────────┴────────────┴───────────┘
```

Faza 1-2 da komissiya `0` (K-12). Raqamlar yig'ilib boradi va keyinchalik argument bo'ladi: "sizga 340 ta buyurtma keltirdik".

### 4.8 Sozlamalar

**Do'kon:** nom, tavsif, logo, cover, telefon, ish vaqti (kunlar bo'yicha), **xaritada joylashuv** (pin surish), yetkazib berish (radius slider + xarita doirasi, narx, bepul chegara), olib ketish.

**Jamoa:** xodim qo'shish (telefon + rol), ro'yxat, o'chirish.

**Telegram:**

```
┌──────────────────────────────────────────────┐
│  📱 Telegram bot                             │
│                                              │
│  Buyurtmalar Telegramingizga bir zumda       │
│  keladi. Tugma bosib tasdiqlaysiz —          │
│  panelga kirish shart emas.                  │
│                                              │
│         [ ▣ QR kod ]                         │
│                                              │
│  Yoki: t.me/LookSaveBot?start=LS-A3F8K2      │
│                                              │
│  Holat: 🔴 Ulanmagan                         │
└──────────────────────────────────────────────┘
```

Ulangandan keyin: yashil holat, ulangan akkaunt nomi, test xabar yuborish tugmasi, uzish.

**Qora ro'yxat:** bloklangan raqamlar, sana, sabab, bekor qilish. Global blok bo'lsa alohida belgi: "Bu raqam butun platformada bloklangan".

---

## 5. Admin panel

### 5.1 Bosh sahifa

```
┌──────────┬──────────┬──────────┬──────────┐
│ Do'konlar│ Foydalan.│ Buyurtma │ 3D navbat│
│ 47       │ 3 240    │ 186      │ 12       │
│ +3 kutil.│ +142 hft │ bu hafta │          │
└──────────┴──────────┴──────────┴──────────┘

⚠️ Diqqat talab qiladi
  • 3 ta do'kon tasdiqlanmagan
  • 5 ta mahsulot moderatsiyada
  • 2 ta raqam global blokka tushdi
  • 4 ta do'kon 24 soatdan beri javob bermayapti
```

### 5.2 Do'konlarni tasdiqlash

```
┌──────────────────────────────────────────────┐
│ Chilonzor Fashion            🟡 Kutilmoqda   │
│ 👤 Aziz Karimov · +998 90 123 45 67          │
│ 📍 Chilonzor, Bunyodkor 12  [ Xaritada ]     │
│ 📅 2026-08-10                                │
│ 🖼 Logo, cover yuklangan                     │
│                                              │
│ [ ✅ Tasdiqlash ]  [ ❌ Rad etish ]           │
└──────────────────────────────────────────────┘
```

Tekshiruv ro'yxati: haqiqiy manzil (xaritada), telefon ishlaydi, logo va nom mos, mahsulotlar haqiqiy.

### 5.3 3D navbat

```
┌ Navbatda (12) ─┬ Ishlanmoqda (3) ─┬ Tayyor ─┬ Xato ┐

┌──────────────────────────────────────────────────┐
│ Nike Air Max 90 · Qora                           │
│ Chilonzor Fashion · so'ralgan 2026-08-05         │
│ 🖼🖼🖼🖼  4 ta manba foto                        │
│                                                  │
│ [ Ishga olish ]  [ Fotolar yetarli emas ]        │
└──────────────────────────────────────────────────┘
```

Tayyor bo'lganda GLB va QA natijasi yuklanadi:

```
Model yuklash
  lod0.glb  [ Fayl tanlang ]   1.18 MB · 5 840 tri
  lod1.glb  [ ✅ ]
  lod2.glb  [ ✅ ]
  thumb.webp [ ✅ ]

QA natijasi (04-3d-pipeline.md, 6-bo'lim)
  iPhone 12      [ 60 ] FPS
  Redmi Note 12  [ 38 ] FPS
  Eski Android   [ 27 ] FPS
  Yuklanish      [ 640 ] ms
  RAM            [ 42 ] MB
  hide_body_parts [ body_foot_L, body_foot_R ]

☑ QA checklist to'liq bajarildi

[ Nashr qilish ]
```

QA belgisi qo'yilmasa, nashr tugmasi ishlamaydi. Bu intizom uchun — bitta sifatsiz model butun ilova tajribasini buzadi.

### 5.4 Qora ro'yxat va foydalanuvchilar

```
┌──────────────────────────────────────────────────┐
│ +998 90 123 45 67          🔴 Global blok        │
│ 3 do'kon bloklagan:                              │
│   • Chilonzor Fashion — "mijoz kelmadi"          │
│   • Sergeli Store — "soxta buyurtma"             │
│   • Yunusobod Shop — "raqam ishlamaydi"          │
│                                                  │
│ [ Global blokni bekor qilish ]                   │
└──────────────────────────────────────────────────┘
```

Global blok avtomatik qo'yiladi (baza triggeri), lekin **admin bekor qila oladi** — uch do'kon ham xato qilishi mumkin.

Cheklangan foydalanuvchilar ro'yxati: `user_trust` bo'yicha, cheklovni bekor qilish tugmasi bilan.

### 5.5 Do'kon nazorati

```
┌──────────────────┬────────┬────────┬────────┬────────┐
│ Do'kon           │ Buyurt.│ Javob  │ Tasdiq │ Holat  │
│ Chilonzor Fashion│ 42     │ 12 daq │ 87%    │ 🟢     │
│ Sergeli Store    │ 8      │ 4.2 soat│ 45%   │ 🟡     │
│ Yunusobod Shop   │ 3      │ —      │ 0%     │ 🔴     │
└──────────────────┴────────┴────────┴────────┴────────┘
```

🔴 do'konlar — javob bermaydiganlar. Ular bilan bog'lanish yoki qidiruvda pastga tushirish kerak. Bu ilova sifatining asosiy ko'rsatkichi: bir necha yomon do'kon butun tajribani buzadi.

---

## 6. Umumiy komponentlar

```
packages/ui/
├── Button.tsx      variant: primary | secondary | ghost | danger
├── Input.tsx  Select.tsx  Textarea.tsx  Switch.tsx  Checkbox.tsx
├── Table.tsx       saralash, keyset pagination, bo'sh holat, skeleton
├── Modal.tsx  Drawer.tsx  Toast.tsx
├── Badge.tsx       status ranglari
├── Card.tsx  StatCard.tsx  Tabs.tsx
├── DateRange.tsx  EmptyState.tsx  Skeleton.tsx
├── MapPicker.tsx   xaritada pin qo'yish (do'kon manzili)
└── ImageUploader.tsx  R2 presign + drag&drop + siqish
```

### Jadval

Server tomonda saralash va keyset pagination (`OFFSET` yo'q — 02-database.md, 10.2).

```tsx
<Table
  columns={[
    { key: 'orderNumber', title: 'Raqam', sortable: true },
    { key: 'customer',    title: 'Mijoz' },
    { key: 'total',       title: 'Summa', align: 'right', sortable: true },
    { key: 'status',      title: 'Holat', render: v => <StatusBadge status={v} /> },
  ]}
  data={orders}
  loading={isLoading}
  empty={<EmptyState title="Buyurtma yo'q" />}
  onSort={setSort}
  onLoadMore={fetchNextPage}
/>
```

### MapPicker

Do'kon manzilini kiritishda Autocomplete **ishlatilmaydi** (K-05). Xaritada pin suriladi:

```tsx
<MapPicker
  value={{ lat, lng }}
  onChange={setLocation}
  radiusM={deliveryRadius}       // yetkazish doirasi ko'rsatiladi
  showRadius
/>
```

Nol API chaqiruvi, aniqroq koordinata — ayniqsa savdo markazi ichidagi do'kon uchun.

---

## 7. Dizayn — panel varianti

06-dizayn.md dagi ranglar, lekin ish uchun moslashtirilgan (12-bo'lim):

| Farq | Sabab |
|---|---|
| Glow yo'q | Kun bo'yi ochiq turadi, ko'z charchaydi |
| Fon `#0F0D16` | Kattaroq ekranda kontrast yumshoqroq |
| Asos 14px | Ma'lumot zichligi yuqori |
| Jadval zebra `#14121C` / `#181524` | O'qish qulayligi |
| Aksent faqat CTA va faol holatda | Chalg'itmaslik |

```js
// tailwind.config.js — mobil ilova bilan bir xil manba
theme: {
  extend: {
    colors: {
      bg: '#0A0A0F', panel: '#0F0D16',
      surface: '#14121C', surface2: '#1C1928',
      border: '#241F33', borderStrong: '#332B4A',
      primary: '#8B5CF6', primaryDim: '#6D3FD9', accent: '#C084FC',
      muted: '#9B96AE', dim: '#635D78', limited: '#F5C518',
      success: '#22C55E', warning: '#F59E0B', danger: '#EF4444',
    },
    borderRadius: { card: '16px' },
  },
}
```

### Mobil moslik

| Ekran kengligi | Layout |
|---|---|
| < 768px | Pastdan tab bar, jadvallar → kartalar |
| 768-1024px | Yig'ilgan yon panel (faqat ikonka) |
| > 1024px | To'liq yon panel |

**Buyurtmalar ekrani mobilda mukammal ishlashi shart.** Do'kon egasi ko'pincha telefondan kiradi.

---

## 8. Ishlab chiqish tartibi

| Hafta | Ish |
|---|---|
| 1 | Sozlash, auth, layout, `packages/ui` asosi |
| 2 | **Buyurtmalar ekrani + SSE + rad etish oynasi** |
| 3 | Mahsulotlar, forma, rasm yuklash, MapPicker |
| 4 | Statistika, sozlamalar, Telegram ulash |
| 5 | Admin panel: do'kon tasdiqlash, 3D navbat, blocklist |

**Buyurtmalar ekranidan boshlang.** Do'kon egasi panelga aynan shuning uchun kiradi. Qolgan hamma narsa ikkinchi darajali.

---

## 9. Yodda tutish

**Telegram — asosiy kanal, panel emas.** Panel to'liq boshqaruv uchun, lekin kunlik ish Telegramda kechadi (K-11). Panelni loyihalashda buni unutmang: agar do'kon egasi panelga kunda bir marta kirsa ham, hammasi ishlashi kerak.

**Rad etish sababini majburiy qiling.** Sababsiz rad etish — analitika uchun yo'qolgan ma'lumot va mijoz uchun tushunarsizlik.

**Javob tezligini ko'rinadigan joyga qo'ying.** Bu do'konlarni intizomga soladigan yagona mexanizm.

**Jadvallar mobilda kartaga aylansin.** Gorizontal scroll telefonda ishlatib bo'lmaydi.
