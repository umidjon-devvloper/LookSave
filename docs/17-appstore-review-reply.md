# 17 — App Review bilan yozishmalar (4.3(b) + 2.1(a))

Apple'ga yoziladigan matnlar: uchrashuv uchun savollar va qayta topshirishdagi
javob xati. Review Notes — `docs/16-appstore-metadata.md` §5 da.

> ⚠️ **Bu faylning 2026-10-28 dagi qoralamasi yuborilmasin** (git tarixida bor).
> Unda haqiqatga mos kelmaydigan da'volar bor edi: «~60 ta haqiqiy mahsulot»,
> «FASHN provayderi», «Upload a full-body photo». 2026-11-12 dagi tekshiruvda:
> jonli katalogda 16 ta mahsulot va sinov do'konlari bor edi, serverda FASHN
> olib tashlangan (server faqat OpenAI'ni chaqiradi), avatar sehrgarida esa
> galereyadan yuklash yo'li yo'q.

## Holat (2026-11-12)

Bitta ariza (`684aa5e7-f6e8-40a0-adfa-6fda75c0649b`) bo'yicha 5 ta rad:

| # | Sana | Build | Qurilma | Band |
|---|---|---|---|---|
| 1 | 5-okt | 22 | iPad Air (M3) | 5.1.1(ii) galereya matni + 2.1(a) «Kiyintirish» da qulash |
| 2 | 6-okt | 24 | iPad Air (M3) | 2.1(a) demo akkauntda tugmalar bosilmaydi |
| 3 | 9-okt | 26 | iPad Air (M3) | 4.3(b) + Extended Review |
| 4 | 6-noy | 47 | iPhone 17 Pro Max | 4.3(b) + Extended Review |
| 5 | 11-noy | 61 | iPhone 17 Pro Max, iOS 27.0.1 | 4.3(b) + Extended Review + 2.1(a) ishga tushishda qulash |

11-oktabrda Apple'dan aniq sabab so'ralgan — yozma javob kelmagan.

---

## 0. Yuborishdan oldin — har bir band ROST bo'lishi shart

Quyidagi xat va Review Notes shu ishlar BAJARILGAN deb yozilgan. Bajarilmagan
bandni matndan olib tashlang — da'vo qilib, bajarmaslik eng yomon variant
(qoidalarning 2.3.1 bandi: chalg'ituvchi ma'lumot dasturdan chiqarishgacha
olib boradi).

- [ ] **Kontent.** Prod'da sinov do'konlari va mahsulotlari yashirilgan yoki
      o'chirilgan. Tekshirish: `https://api.looksave.uz/v1/products?limit=50`
      va `/v1/stores/nearby?lat=41.311&lng=69.279` — tasodifiy harfli nomlar,
      0 mahsulotli do'konlar, begona Instagram skrinshotlari qolmagan.
      **2026-11-17 dagi holat (jonli API): hali BAJARILMAGAN.** Toshkent
      atrofida 13 do'kondan 10 tasi bo'sh («Ndjxjx», «Fufu», «umidjon»,
      «Jackets», «Bulls», «Harmony», uchta «Chilonzor»…); mahsuloti bor uchtasi —
      «luxury» (71), «Sergeli» (5), «Diorpro» (5). «Jsjcjc» mahsuloti
      («Chilomzor» do'koni) hamon katalogda. Bo'sh do'konlar ilovada avatar
      sehrgarining «do'kon tanlash» qadamida ro'yxat bo'lib chiqadi.
- [ ] **Brend logotiplari.** Hamkor bo'lmagan brendlar (Nike, Adidas, Zara,
      Puma, New Balance) `/v1/brands` dan va bosh sahifadan olib tashlangan.
- [ ] **Demo akkaunt** — 2026-11-13 dan `+998937844572` («LookSave Review»);
      eski `+998900007777` endi ishlatilmaydi. Jonli API'dan o'qilgan holati
      (2026-11-13): avatar tayyor (old · yon · orqa, kesimi bor), yuz surati
      bor, bo'y 180 / vazn 80 / poyabzal 46, jinsi erkak, kiyintirish natijasi
      2 ta. Qolgani:
  - [ ] **Natijalar toza.** Kamida 2–3 ta va hammasining kesimi butun.
        2026-11-13 dagi ikkinchi natijaning (yashil kurtka + oq-ko'k shim)
        kesimi yo'l-yo'l: tuzatish kodi tayyor, lekin prod'ga chiqarilmagan
        va mavjud kesim qayta yasalmagan (`apps/api/scripts/repair-striped-cutouts.ts`).
  - [ ] **Do'kon.** Akkaunt do'kon egasi (`store_owner`): profilida «My
        store» ko'rinadi va u «Chilomzor» do'koniga olib boradi, undagi yagona
        mahsulot — «Jsjcjc» (katalogda ham ko'rinadi). Do'kon nomi va
        mahsulotini haqiqiysiga almashtiring yoki akkauntni oddiy xaridorga
        aylantiring (pastdagi «Kontent» bandi bilan birga).
        ⚠️ Do'kon egasi bo'lgani uchun KIRGACH ILOVA SOTUVCHI PANELIGA olib
        boradi (`app/(auth)/sign-in.tsx`) — ko'rib chiquvchining birinchi
        ekrani shu. Review Notes 1-qadamiga shu yozildi (2026-11-17); akkaunt
        xaridorga aylantirilsa o'sha jumlani olib tashlang. Panel shu kuni
        inglizcha qurilmada SINOV ma'lumoti bilan ko'rib chiqildi (matnlar,
        tugmalar) — haqiqiy akkaunt bilan emas.
        **2026-11-17 kechqurun jonli API'dagi holat:** do'konda 14 mahsulot —
        «Shoes» ×5, «T-shirt» ×2, «Shim» ×2, «Krasovka» ×2, «Qizil krasovka»
        (15 000 so'm), «Ko’ulak» (12 000 so'm), «Jsjcjc»; mo'ljal —
        «Nznxndjdj», tavsif — «Nsndnxnnxnznzmakskxnxn»; ba'zi suratlarda Nike
        belgisi bor. Ko'rib chiquvchi kirgach aynan shu do'konning panelini
        ko'radi.
  - [ ] **Parol.** App Store Connect'dagi «Sign-In Information» ga kiritilgan
        va REPODA YO'Q (repo ochiq). Review Notes'dagi `[parol]` qo'lda
        almashtiriladi.
- [ ] **Eski demo akkaunt yopilgan.** `+998900007777` ning paroli shu repoda
      ochiq turgan (`docs/16` va `scripts/create-review-account.sh` ning git
      tarixi). Uning UUID'si va raqami prod sozlamalaridan olib tashlansin,
      paroli almashtirilsin yoki akkaunt o'chirilsin — aks holda istalgan odam
      shu akkaunt bilan kirib, cheklovsiz AI kiyintirishni sizning hisobingizdan
      ishlata oladi.
- [ ] **Prod sozlamalari:** `DEVELOPER_AI_AUTO_USERS` da YANGI demo
      foydalanuvchining UUID'si (natija operatorni kutmasdan chiqadi),
      `TRYON_UNLIMITED_PHONES` da `+998937844572`, `OPENAI_API_KEY` da mablag'
      bor; keyin `pm2 restart looksave-api`. O'zgartirgach shu akkaunt bilan
      bitta kiyintirish qilib ko'ring — natija operatorsiz chiqishi kerak.
      (Hozir qaysi qiymatlar turgani TEKSHIRILMAGAN: prod sozlamalarini bu
      yerdan o'qib bo'lmaydi.)
- [ ] **Server tarixi chiqarilgan** (`a0f305f`, `3d624b5`). Shundan keyingina
      toza qurilmada demo akkaunt bilan kirganda «Your try-ons» qatorida
      avvalgi natijalar ko'rinadi — Review Notes'dagi «Earlier try-ons»
      jumlasi shunga tayanadi. Chiqarilmasa o'sha jumlani o'chiring.
- [ ] **Toza qurilmada sinov:** ilovani o'chirib qayta o'rnatib, Review Notes
      dagi 5 qadam boshidan oxirigacha o'tilgan; natija necha soniyada chiqishi
      o'lchangan (matndagi `[60]` shu son bilan almashtiriladi).
- [ ] **Build:** UIScene tuzatishi ichida; release build iOS 27 li iPhone VA
      iPad'da ochilgan, fonga chiqib qaytgan. Qurilma nomlari xatga yoziladi.
      **70-build (2026-11-18, TestFlight'ga yuklangan):** lokal Xcode 27.2
      (iOS 27.2 SDK), sahna manifesti ichida; 69-builddan Info.plist'da faqat
      raqam va joylashuv matni farq qiladi. Arxivdagi AYNAN O'SHA JS iOS 27.0
      simulyatorida sinalgan: iPhone'da toza o'rnatish (onboarding uch
      slayddan «Next» bilan o'tadi → bosh sahifa) va 41 ekran; iPad'da
      (iPhone-moslik oynasi) 41 ekran va ochilish — qulash yo'q, ko'rinib
      turib bosilmaydigan tugma yo'q. Bu simulyator: HAQIQIY qurilmada hali
      ochilmagan. Topshirishdan oldin TestFlight'dan o'rnatib, ilovani
      o'chirib qayta o'rnatib, onboarding'dan o'tib ko'ring — shundan keyin
      belgilang.
- [x] **AI provayderi tasdiqlangan (2026-11-12).** Ikkalasi ham ishlatiladi:
      server OpenAI'ni chaqiradi, operator esa ChatGPT va Gemini'da ishlaydi.
      Matnlarda «OpenAI or Google» qoladi (tavsif, Review Notes, ilovadagi
      rozilik, maxfiylik sahifasi).
- [x] **Maxfiylik sahifasi jonli saytda yangilangan (tekshirildi
      2026-11-17).** `looksave.uz/en/privacy` inglizcha, «OpenAI» va «Google»
      bor, «FASHN» yo'q; `/privacy` va `/terms` `/en/…` ga yo'naltiradi;
      `{uz,ru,en,ar}/{privacy,terms,support}` — hammasi 200.
- [x] **Ilova ichidagi matnlar tuzatilgan (2026-11-12), build 63 da bor.**
      Rozilik ekrani («OpenAI or Google»), «Look» tugmasi va mahsulot sahifasi
      to'rt tilda; «10 seconds» va «front, side, and back» da'volari yo'q.
- [x] **Onboarding (2026-11-17, kodda — keyingi build'da).** Ilk ochilishda
      xaridor uchun uch qadamli kirish chiqadi, to'rt tilda; «Skip» yuqori o'ng
      burchakda (Review Notes shunga tayanadi). Simulyatorda toza o'rnatishda
      ko'rilgan.
      ⚠️ Shu tekshiruvda jiddiy nuqson topildi va tuzatildi (2026-11-18):
      iOS 27 da toza o'rnatilgan ilovada «Next» / «Get started» tugmasi
      ko'rinardi, lekin BOSILMASDI (faqat «Skip» ishlardi) — kirish marshruti
      sarlavha bilan ochilib almashgani uchun ekranning pastki 116 nuqtasi
      ramkadan tashqarida qolardi (`app/_layout.tsx`, `index` endi
      sarlavhasiz). Yangi build'da ilovani O'CHIRIB QAYTA O'RNATIB, uch
      slayddan «Next» bilan o'tib ko'ring.
- [x] **Ilovadagi havolalar ochiladi (2026-11-17, kodda — keyingi build'da).**
      Profil → «Privacy policy» / «Terms of use» va kirishdagi «Forgot
      password?» `looksave.uz/<qurilma tili>/…` ni ochadi; manzillar 200.
- [x] **Joylashuv matni (2026-11-17, keyingi build'da).** Ruxsat matniga
      yetkazish manzili uchun boshlang'ich nuqta ham yozildi (`app.json` ning
      ikki joyi va lokal `ios/LookSave/Info.plist`).
- [ ] **Ilova tili (2026-11-17, kodda — keyingi build'da).** Inglizcha
      qurilmada o'zbekcha chiqadigan joylar tuzatildi: avatar sehrgari,
      komplektlarim, o'lchamlar, checkout, buyurtmalar, sotuvchi paneli,
      xato xabarlari. Yangi build'da inglizcha telefonda bir marta aylanib
      chiqing — shundan keyin belgilang.
- [ ] **Bosilmaydigan tugmalar (2026-11-17, build 70 da).**
      «Forgot password?», kartalardagi yurakcha, sotuvchi panelidagi
      qo'ng'iroq (uch ekranda) ishlaydigan qilindi; bosilmaydigan «Barchasi»
      yozuvlari olib tashlandi. 2-raddagi «tugmalar bosilmaydi» e'tirozi
      takrorlanmasligi uchun yangi build'da qo'lda bosib ko'ring.
      **2026-11-18, avtomatik tekshiruv (iOS 27.0 simulyatori, XCUITest
      `isHittable`):** kirmagan holatda 41 ekran — ko'rinib turgan, lekin
      bosilmaydigan tugma 0 ta; kirgan xaridor va sotuvchi ekranlari (20 ta,
      sinov ma'lumoti bilan) — pastdagi sotuvchi bandidan tashqari 0 ta. Bu
      simulyator natijasi; qo'lda tekshiruv o'rnini bosmaydi.
- [x] **Sotuvchi paneli: pastki menyu ostidagi tugmalar (2026-11-18, build
      70 da).** «Products» tabidagi «Add product» tugmasi suzuvchi tab bar
      ostida butunlay yashirin edi (ko'rinmasdi ham, bosilmasdi ham), bosh
      ekrandagi oxirgi amal («Store settings») esa oxirigacha aylantirilganda
      ham yarmi bilan bar ostida qolardi. Demo akkaunt aynan shu panelga
      tushadi. Tuzatildi (`src/theme/sellerTabBar.ts`) va sinov ma'lumoti
      bilan iPhone hamda iPad simulyatorida tekshirildi: tugma bar ustida,
      bosiladi, shaklni ochadi; panelning olti ekrani oxirigacha
      aylantirilganda bar ostida qolib ketadigan tugma yo'q.
      ⚠️ Kirgach iOS «Save Password?» oynasini chiqaradi — u yopilmaguncha
      ilovadagi hech narsa bosilmaydi. Bu tizim oynasi, ilova nuqsoni emas
      (iPad sinovida shu oyna «hamma tugma bosilmaydi» degan soxta signal
      bergan edi).
- [x] **Kutilmagan xatoda ilova yopilmaydi (2026-11-18, build 70 da).** Har
      navigatorda ekran xato chegarasi bor (`ScreenErrorBoundary`), ildizda —
      oxirgi to'siq. Buzuq server javobi ekranni «Something went wrong · Try
      again · Go to home» ga almashtiradi, navigatsiya ishlayveradi. Ilgari
      bironta chegara yo'q edi: bitta buzuq mahsulot yozuvi release build'ni
      yopardi (2.1(a)). Ataylab buzilgan mahsulot javobi bilan sinalgan.
- [ ] **TestFlight:** tashqi sinovchilar bo'lgan bo'lsa — soni va sanalari
      xatga yoziladi; bo'lmagan bo'lsa o'sha jumla o'chiriladi.

---

## 1. «Meet with Apple» uchrashuvi — topshirishdan OLDIN

Apple har xabarida 30 daqiqalik video uchrashuvni taklif qilgan (seshanba va
payshanba, mahalliy ish vaqtida). So'rov havolasi Apple xabarining oxirida
(«Request an App Review Appointment at Meet with Apple») va
`developer.apple.com/distribute/app-review` sahifasida. Aniq sababni olishning
yagona yo'li shu — yozma savolga javob kelmagan.

Uchrashuvda TestFlight'dagi yangi build'ni ko'rsating va shularni so'rang:

```
1. For builds 26 and 47, which area weighed most in the 4.3(b) decision:
   design, content, or the overall concept?
2. Is a local fashion marketplace with AI try-on on the shopper's own avatar
   an acceptable concept, provided the content and execution are solid?
3. For regular users, try-on images are prepared by our team with an AI model
   and take a few minutes. Is that acceptable if it is clearly disclosed in
   the app, the privacy policy and the Review Notes?
4. We removed test listings, redesigned the main screens and made the core
   feature reachable with the demo account. Is that the kind of "significant
   change" you expect, or is something else missing?
5. The app is marked for Extended Review. What should we do so that the next
   submission does not make this worse?
```

---

## 2. Qayta topshirishdagi javob xati (inglizcha)

App Store Connect → ilova → rad etilgan versiya → **Reply to App Review**.
Kvadrat qavsdagi joylarni to'ldiring; bajarilmagan bandni o'chiring.

```
Hello App Review team,

Thank you for the feedback. This submission addresses both open issues.

1. CRASH ON LAUNCH — Guideline 2.1(a)

Build 61 was compiled with the iOS 27 SDK but did not adopt the UIScene life
cycle, so iOS 27 terminated it at launch. The app now declares a scene
manifest and uses a scene delegate. We tested the release build on
[iPhone model, iOS 27.x] and [iPad model, iPadOS 27.x]: launch, sign-in,
try-on, checkout, background and resume.

2. DESIGN, CONTENT AND CONCEPT — Guideline 4.3(b)

Earlier builds did not show the app at the level you expect: the production
catalog still contained test listings, and the core feature was hard to reach
for a reviewer. We changed the following.

• Content. All test stores and placeholder listings were removed. The catalog
  now has [N] real stores in Tashkent with [N] products, each with the
  seller's own photos, sizes and prices in UZS. Logos of brands we do not
  work with were removed.

• Core feature. AI try-on is now the centre of the app: tap "Look" on the
  items you like, open Try-on and dress your avatar in the whole outfit with
  one button. The demo account has a ready avatar, so the feature can be seen
  in about two minutes without scanning a face.

• Design. Home, Marketplace and Try-on were redesigned. [We tested the new
  version with N beta testers in TestFlight from DATE to DATE.]

• Accuracy. The store listing, the onboarding texts and the privacy policy
  now describe the app as it actually works, including the AI providers we
  use and how long a try-on takes.

HOW TO REVIEW

The demo account and step-by-step instructions are in the Review Notes.

If any part of the app still falls short, we would be grateful if you could
tell us which area — design, content or concept — so that we can address it
precisely.

Best regards,
LookSave team
support@looksave.uz
```

«Earlier builds did not show the app at the level you expect…» jumlasi —
ixtiyoriy. Men qoldirishni tavsiya qilaman: Apple'ning «kontent» e'tirozi
tushunilganini ko'rsatadi.

---

## 3. Qoidalar

- **Tez qayta yubormang.** Apple «Do not resubmit until significant changes»
  deb yozgan va Extended Review ogohlantirishi uch marta kelgan; takroriy
  rad hisobning dasturdan chiqarilishiga olib kelishi mumkin.
- Xat yangi build bilan BIRGA yuboriladi, alohida emas.
- Xatda faqat tekshirilgan narsa yoziladi. Sonlar (do'kon, mahsulot, sinovchi)
  yuborish kunidagi haqiqiy qiymat bo'lsin.
- Bitta rad uchun faqat bitta apellyatsiya beriladi (App Review Board) — uni
  uchrashuvdan keyingi zaxira yo'l sifatida saqlang.
