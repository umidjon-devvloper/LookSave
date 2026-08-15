# apps/mobile

Expo SDK 52 + React Native + expo-router. Mijoz ilovasi.

Spetsifikatsiya: [`docs/05-mobile.md`](../../docs/05-mobile.md) · [`docs/06-dizayn.md`](../../docs/06-dizayn.md)

---

## ⚠️ Expo Go yaramaydi

3D uchun `expo-gl` va native modullar kerak — **development build** majburiy,
birinchi kundan (K-14).

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas build --profile development --platform android    # yoki ios
# .apk o'rnatilgandan keyin:
npx expo start --dev-client
```

Profillar `eas.json` da: `development` (dev-client, APK),
`preview` (ichki sinov), `production` (AAB, versiya avtomatik oshadi).

⚠️ **Android emulyatorida `localhost` — emulyatorning o'zi.** Kompyuterdagi
API'ga `10.0.2.2` orqali murojaat qilinadi — `development` profilida
shunday sozlangan. Haqiqiy qurilmada kompyuterning LAN IP'sini
`EXPO_PUBLIC_API_URL` ga yozing.

Simulyatorsiz tekshirish uchun `npm run typecheck` ishlatiladi.

---

## Monorepo — Metro sozlamasi

`metro.config.js` dagi uch qator **majburiy**, ularsiz
`@looksave/validation` topilmaydi:

| Sozlama                          | Nima uchun                                              |
| -------------------------------- | ------------------------------------------------------- |
| `watchFolders = [workspaceRoot]` | workspace paketlari o'zgarganda qayta yig'ilsin         |
| `nodeModulesPaths`               | modullar ikkala `node_modules` dan izlansin             |
| `disableHierarchicalLookup`      | bitta React nusxasi — ikkitasi bo'lsa hook'lar buziladi |

---

## Tuzilma

```
app/                      expo-router (fayl = ekran)
├── _layout.tsx           providerlar, auth tekshiruvi
├── index.tsx             yo'naltirish
├── (auth)/               welcome · sign-in · sign-up
├── (tabs)/               index (bosh) · stores · cart · profile
├── product/[id].tsx      rasmlar, rang, o'lcham, savatga qo'shish
├── store/[id].tsx        do'kon profili + mahsulotlari
├── checkout.tsx          buyurtma yuborish
├── order/[id].tsx        holat, bosqichlar, bekor qilish
└── orders.tsx            buyurtmalar tarixi
src/
├── api/client.ts         fetch + token yangilash, SecureStore
├── api/endpoints.ts      barcha so'rovlar bir joyda
├── store/                zustand: auth, location
├── i18n/                 uz · ru · en · ar
├── hooks/usePush.ts      qurilma ro'yxati, bildirishnoma bosilishi
├── three/core.ts         Try-On sof mantiqi (GPU'siz, testlangan)
├── components/ui.tsx     Button, Field, Loading, Empty, ErrorView
└── theme/                tokens.ts, format.ts
```

---

## Qoidalar

**Token `expo-secure-store` da** — iOS Keychain, Android
EncryptedSharedPreferences. `AsyncStorage` ishlatilmaydi: u oddiy fayl,
root qilingan qurilmada o'qib bo'ladi.

**Validatsiya `@looksave/validation` dan** — server bilan aynan bir xil
sxema. Shunda "server rad etdi, lekin ilova o'tkazib yubordi" holati
bo'lmaydi. `sign-up.tsx` shu sxemani ishlatadi.

**Har ekranda uchta holat majburiy:** `loading`, `empty`, `error`
(05-mobile §5). Bo'sh oq ekran hech qachon ko'rinmaydi —
`components/ui.tsx` da tayyor komponentlar bor.

**Pul hech qachon `number` ga aylantirilmaydi.** Serverdan string keladi,
`theme/format.ts` faqat ko'rinish uchun ajratadi.

**Push simulyatorda ishlamaydi.** Expo tokeni faqat haqiqiy qurilmada
beriladi — `Device.isDevice` tekshiriladi va simulyatorda jim
o'tkaziladi. Push yetkazilishi kafolatlanmagan, shuning uchun buyurtma
holati ilovada ham ko'rinadi.

**Ekran matnlari lug'atda.** Barcha ekranlar tarjima qilingan: auth,
tablar, bosh sahifa, do'konlar, katalog, mahsulot, savat, checkout,
buyurtmalar, profil, sevimlilar, komplektlar.

Lug'at testlari: kalitlar to'plami bir xilmi, bo'sh matn yo'qmi va
ruscha/inglizcha matn o'zbekchadan farq qiladimi (tarjima qilinmay
qolgan kalitni topadi).

**Til qurilmadan olinadi** va `Accept-Language` sarlavhasida serverga
yuboriladi — kategoriya nomlari va status matnlari shu tilda qaytadi.
Lug'at kalitlari `uz` dan tip sifatida olinadi: boshqa tilda kalit
tushib qolsa TypeScript xato beradi.

**O'lchamlar ekrani `morphTargets` ni ko'rsatadi** — foydalanuvchi
raqam kiritganda avatar shakli qanday o'zgarishini chiziqlarda ko'radi.
Qiymatlar serverdan keladi, ilova hisoblamaydi.

**Qidiruvda 400 ms kutiladi** — har harfda so'rov yuborilsa mobil
tarmoqda ham trafik, ham batareya ketadi.

**Sevimli tugmasi optimistik** — tarmoq javobini kutmasdan darhol
o'zgaradi, xato bo'lsa qaytariladi.

**Joylashuv rad etilsa** Toshkent markazi ishlatiladi va foydalanuvchiga
shu haqda aytiladi — bo'sh ekran ko'rsatishdan yaxshi. Checkout'da bu
alohida ogohlantiriladi: koordinata noto'g'ri bo'lsa buyurtma
`OUT_OF_RANGE` bilan qaytishi mumkin.

**`Idempotency-Key` checkout boshlanganda BIR MARTA yaratiladi**
(`useMemo`, bo'sh bog'liqlik ro'yxati bilan). Har urinishda yangisi
yaratilsa, takroriy yuborish ikkinchi buyurtma yaratib qo'yardi —
idempotentlikning ma'nosi yo'qolardi.

**Server xatolari matnga o'giriladi** (`checkout.tsx` dagi `explain`).
Har biri nima qilish kerakligini aytadi: `OUT_OF_RANGE` → "boshqa manzil
yoki olib ketish", `LIMIT_REACHED` → "avval ularni yakunlang".
05-mobile §6.12 dagi jadval.

**K-10 UX qoidasi:** hech qayerda "To'lash", "Sotib olish" yozilmaydi.
Faqat "Buyurtma yuborish" va "To'lov do'konda / yetkazib berilganda".

---

## Hujjatdan chekinish

**Kirish — telefon + parol, OTP emas** (05-mobile §6.2 da OTP oqimi bor).
Bu 5-bosqichdagi qarorning davomi. OTP qo'shilganda `(auth)/` ichidagi
ikki ekran almashadi, qolgani tegilmaydi.

---

## Try-On: nima tayyor, nima yo'q

3D kodning aksari qismi qurilmada sozlanadi, lekin **qaror qabul qilish
mantig'i** oddiy funksiyalar — ular `src/three/core.ts` da, 23 ta test
bilan qotirilgan:

| Nima               | Qoida                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| LOD tanlash        | sifatga qarab; kerakli daraja yo'q bo'lsa boshqasi olinadi — model yuklanmay qolmaydi |
| Prefetch           | joriy elementdan ±2, ro'yxat aylanma; prefetch bir pog'ona pastroq LOD'da             |
| FPS bo'yicha sifat | 60 kadr o'rtachasi bo'yicha; bitta sakrash sifatni tushirmaydi                        |
| Slot holati        | bir slotda bitta mahsulot, almashtirilgani qaytadi (tozalash uchun)                   |
| `hideBodyParts`    | barcha kiyilganlardan yig'iladi — Z-fighting oldini oladi                             |
| Model keshi        | LRU + xotira byudjeti; kiyilgani chiqarilmaydi (`pin`)                                |

`three.js` obyektlari bu faylga kirmaydi. Tozalash (`dispose`) chaqiruvchi
tomonda — kesh faqat "qaysi modelni chiqarish kerak" deb aytadi.

### Render qismi — yozilgan, lekin qurilmada sozlanmagan

| Fayl                    | Nima                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `three/loader.ts`       | GLB yuklash, `expo-asset` keshi, LOD, `dispose`, morph qo'llash |
| `three/AvatarScene.tsx` | `<Canvas>`, kamera, yorug'lik, FPS kuzatuvi                     |
| `app/tryon.tsx`         | svayp, aylantirish, zoom, slot tablari, mahsulot kartasi        |

⚠️ **Bu kod hech qachon ishga tushmagan.** Quyidagilar qurilmada
o'lchov bilan sozlanadi — hujjat ham shuni aytadi (§7.4 "real qurilmada
sozlanadi"):

- `activeOffsetX` va tezlik chegarasi — svayp va aylantirishni ajratadi
- kamera masofasi (`2.6 / zoom`), avatar o'lchami, yorug'lik kuchi
- yuklash vaqti (maqsad 2.5 s) va xotira byudjeti

**Tozalash eng muhim joy** (§7.6): ekrandan chiqilganda barcha model
`dispose` qilinadi. Bu bo'lmasa 20-30 svaypdan keyin ilova qulaydi —
`three.js` GPU xotirasini o'zi bo'shatmaydi.

**Sinash uchun kerak:** bitta `.glb` avatar tanasi (`mt_*` shape
key'lari bilan) va bitta kiyim modeli. Ularsiz ekran bo'sh ochiladi.

---

## Hali yo'q

- Try-On: raycast bilan slot tanlash (bosilgan joyga qarab)
- Try-On: komplektni saqlash tugmasi
- Face scan, o'lchamlar, jins tanlash
- Xarita (react-native-maps) — hozircha ro'yxat va tashqi Google Maps havolasi
- Til tanlash ekrani — hozircha qurilma tili avtomatik olinadi
- Arabcha uchun RTL (`I18nManager.forceRTL`) — layout'ni ko'zdan
  kechirish kerak, alohida ish
