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
- [x] **AI provayderi tasdiqlangan (2026-11-12).** Ikkalasi ham ishlatiladi:
      server OpenAI'ni chaqiradi, operator esa ChatGPT va Gemini'da ishlaydi.
      Matnlarda «OpenAI or Google» qoladi (tavsif, Review Notes, ilovadagi
      rozilik, maxfiylik sahifasi).
- [ ] **Maxfiylik sahifasi jonli saytda yangilangan.** Yangi matn (to'rt
      tilda, «OpenAI or Google») va `/privacy`, `/terms` yo'naltirishi
      `216b2cb` commitida bor, lekin 2026-11-13 da jonli saytda hali eski
      sahifa turardi: `looksave.uz/en/privacy` o'zbekcha va «FASHN» bilan,
      `/privacy` esa 404. Saytni chiqargach shu ikki manzilni ochib ko'ring.
- [x] **Ilova ichidagi matnlar tuzatilgan (2026-11-12), build 63 da bor.**
      Rozilik ekrani («OpenAI or Google»), «Look» tugmasi va mahsulot sahifasi
      to'rt tilda; «10 seconds» va «front, side, and back» da'volari yo'q.
- [ ] **Onboarding.** Hozirgi ekran sotuvchi uchun va faqat o'zbekcha; bayroqni
      o'qishdagi xato tufayli u umuman chiqmaydi. Qaysi onboarding bo'lishini
      hal qiling (Review Notes «skip the onboarding» deydi — chiqmasa zarari yo'q).
- [ ] **Ilovadagi havolalar ochiladi.** Profil → «Maxfiylik siyosati» va
      «Foydalanish shartlari» `looksave.uz/privacy` va `/terms` ni ochadi —
      2026-11-12 da ikkalasi ham jonli saytda 404 berardi (til bo'lagisiz
      manzil yo'q). Saytda yo'naltirish qo'yilgan yoki ilovadagi havola
      `/en/privacy` kabi to'liq manzilga almashtirilgan bo'lsin.
- [ ] **Joylashuv matni.** Ruxsat so'rovidagi matn faqat «yaqin do'konlar»
      deydi, ilova esa joylashuvni yetkazish nuqtasini xaritada oldindan
      qo'yish uchun ham ishlatadi — matnga shuni qo'shing (`app.json` dagi
      `expo-location` va `ios/LookSave/Info.plist`).
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
