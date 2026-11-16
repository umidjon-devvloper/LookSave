# 16 — App Store Connect metadata

LookSave iOS ilovasini App Store'ga joylash uchun **tayyor, copy-paste** matnlar.
Apple ko'rib chiqishi (App Review) va 4.3(b) ("spam / past sifat / dublikat") rad
etilishining oldini olish uchun yozilgan.

> ⚠️ **Yuridik ko'rib chiqishdan o'tmagan.** Bu yerda faqat texnik haqiqat.
> Ishga tushirishdan oldin maxfiylik matni va shartlar yurist tomonidan
> tasdiqlanishi shart (xuddi `apps/web/src/routes/privacy.tsx` dagidek).

> ⚠️ **Tasdiqlanishi kerak — pochta qutilari.** Butun kod bazasi `.app` dan
> `.uz` ga ko'chirildi (URL'lar va emaillar: `privacy@looksave.uz`,
> `admin@looksave.uz`). App Store Connect'ga kiritishdan oldin bu pochta
> qutilari **haqiqatan xat qabul qilishini** tekshiring — App Review va
> foydalanuvchilar shu manzilga yozadi.

> ⚠️ **2026-11-12 da haqiqatga moslab tuzatildi.** Oldingi matnlarda noto'g'ri
> da'volar bor edi: «FASHN» (serverda olib tashlangan — server faqat OpenAI'ni
> chaqiradi, operator kengaytmasi esa ChatGPT va Gemini'da ishlaydi), «in seconds» (oddiy foydalanuvchida natija daqiqalarda keladi),
> «upload a full-body photo» (ilovada bunday yo'l yo'q), «tenge» (O'zbekiston
> valyutasi emas). Ruscha va arabcha matnlarni yuborishdan oldin shu tilni
> biladigan odam o'qib chiqsin. Yuborishdan oldingi tekshiruv ro'yxati —
> `docs/17-appstore-review-reply.md` §0.

---

## 1. Umumiy sozlamalar (tilga bog'liq emas)

| Maydon | Qiymat |
|---|---|
| **Bundle ID** | `com.looksave.looksave` |
| **SKU** | `looksave-ios-01` |
| **Primary language** | English (U.S.) |
| **Primary category** | Shopping |
| **Secondary category** | Lifestyle |
| **Price** | Free |
| **In-App Purchases** | Yo'q (ilovada to'lov yo'q — pastga qarang) |
| **Copyright** | © 2026 LookSave |
| **Support URL** | https://looksave.uz |
| **Marketing URL** | https://looksave.uz |
| **Privacy Policy URL** | https://looksave.uz/en/privacy |

### App Store tillari

Ilova 4 tilda (uz · ru · en · ar), lekin **App Store Connect o'zbek tilini
qo'llab-quvvatlamaydi**. Shuning uchun do'kon ko'rinishi: **English (default) +
Russian + Arabic**. Uchalasi ham quyida tayyor.

### Age Rating (yosh reytingi)

Taklif: **4+**. Ilovada zo'ravonlik, kattalar kontenti yo'q. Diqqat: sotuvchilar
mahsulot rasmlarini yuklaydi (cheklangan UGC) — Apple anketasidagi
"User-Generated Content" savoliga **Ha** deb javob bering va moderatsiya borligini
belgilang (admin-panel'da mahsulot tasdiqlash bor). Bu odatda reytingni 12+ ga
ko'tarmaydi, lekin anketani halol to'ldiring.

---

## 2. English (default / primary)

**App Name** (≤30)
```
LookSave
```

**Subtitle** (≤30)
```
AI try-on for real stores
```

**Promotional Text** (≤170)
```
See how clothes look on you before you buy. Scan once, try on items from stores near you with AI, then order the right size straight from the shop.
```

**Keywords** (≤100, vergul bilan, bo'sh joysiz)
```
virtual try-on,fitting room,fashion,outfit,wardrobe,avatar,boutique,local stores,style,clothing
```

**Description** (≤4000)
```
LookSave lets you see clothes on yourself with AI — before you buy.

Scan your face once and add your height and weight to build your personal avatar.
Then browse real clothing from local stores, collect the pieces you like and see
the whole outfit on your avatar. No more guessing how something will look.

HOW IT WORKS
• Build your avatar — one quick face scan plus your height, weight and shoe size.
• Find stores nearby — browse the catalog or the map of local shops.
• Try it on — tap "Look" on the items you like, then try them on together. Your
  result is ready within a few minutes and stays saved in the app. Not happy?
  Swap one piece and try again.
• Order from the shop — add what suits you to your cart and send the order
  straight to the store, with delivery or pickup.

NO PAYMENT INSIDE THE APP
LookSave is not a payment app. Your order is a request sent to a physical store.
You settle up with the shop directly — on delivery or in person. There are no
in-app purchases and no card details to enter.

BUILT FOR YOUR CITY
LookSave connects you with real local boutiques and shops, not a faceless
warehouse. Everything you try on is something you can actually buy near you.

PRIVACY YOU CONTROL
Your face photo is used only to create your avatar and dress it. To generate the
images it is processed by our team with an AI image-generation service (OpenAI or
Google),
solely for that purpose. You can delete your photo or your whole account anytime
in the app. Location is optional and used only to show nearby stores and to
pre-fill your delivery point on the map.

Available in English, Russian, Uzbek and Arabic.
```

**What's New** (release notes, ≤4000)
```
• Simpler AI try-on: collect items with "Look" and try the whole outfit at once.
• Redesigned home and marketplace.
• Fixed a crash on launch on iOS 27.
```

> Eslatma: ilovaning birinchi versiyasida bu maydon App Store Connect'da ko'rinmaydi.

---

## 3. Russian (Русский)

**App Name** (≤30)
```
LookSave
```

**Subtitle** (≤30)
```
AI-примерка и магазины рядом
```

**Promotional Text** (≤170)
```
Посмотрите, как одежда сидит на вас, ещё до покупки. Один раз отсканируйтесь, примеряйте вещи из магазинов рядом с помощью AI и заказывайте свой размер.
```

**Keywords** (≤100)
```
виртуальная примерка,мода,одежда,образ,гардероб,аватар,бутик,магазины рядом,стиль
```

**Description** (≤4000)
```
LookSave показывает одежду на вас с помощью AI — ещё до покупки.

Один раз отсканируйте лицо и укажите рост и вес, чтобы создать персональный аватар.
Затем выбирайте реальную одежду из местных магазинов, собирайте понравившиеся вещи
и смотрите весь образ на своём аватаре. Больше не нужно гадать, как вещь будет
смотреться.

КАК ЭТО РАБОТАЕТ
• Создайте аватар — быстрое сканирование лица, а также рост, вес и размер обуви.
• Найдите магазины рядом — каталог и карта местных магазинов.
• Примеряйте — нажмите «Look» на понравившихся вещах и примерьте их вместе.
  Результат готов в течение нескольких минут и сохраняется в приложении.
  Не понравилось? Замените одну вещь и попробуйте снова.
• Заказывайте в магазине — добавьте подходящее в корзину и отправьте заказ
  напрямую продавцу: доставка или самовывоз.

БЕЗ ОПЛАТЫ В ПРИЛОЖЕНИИ
LookSave — не платёжное приложение. Ваш заказ — это запрос в реальный магазин.
Оплата происходит напрямую с магазином: при доставке или на месте. Никаких
встроенных покупок и ввода данных карты.

ДЛЯ ВАШЕГО ГОРОДА
LookSave связывает вас с настоящими местными магазинами и бутиками. Всё, что вы
примеряете, можно купить рядом.

КОНФИДЕНЦИАЛЬНОСТЬ ПОД ВАШИМ КОНТРОЛЕМ
Фото лица используется только для создания и одевания аватара. Для генерации
изображений его обрабатывает наша команда с помощью сервиса генерации изображений
(OpenAI или Google) — исключительно для этой цели. Вы в любой момент можете удалить фото или
весь аккаунт в приложении. Геолокация необязательна и нужна только, чтобы показать
магазины рядом и отметить точку доставки на карте.

Доступно на русском, английском, узбекском и арабском.
```

**What's New**
```
• Проще AI-примерка: соберите вещи кнопкой «Look» и примерьте весь образ сразу.
• Новый дизайн главной и маркетплейса.
• Исправлен сбой при запуске на iOS 27.
```

---

## 4. Arabic (العربية)

**App Name** (≤30)
```
LookSave
```

**Subtitle** (≤30)
```
تجربة ذكية ومتاجر قريبة
```

**Promotional Text** (≤170)
```
شاهد كيف تبدو الملابس عليك قبل الشراء. امسح مرة واحدة، وجرّب قطعًا من متاجر قريبة منك بالذكاء الاصطناعي، ثم اطلب مقاسك مباشرة من المتجر.
```

**Keywords** (≤100)
```
تجربة افتراضية,غرفة قياس,أزياء,إطلالة,خزانة,أفاتار,بوتيك,متاجر قريبة,ستايل,ملابس
```

**Description** (≤4000)
```
يتيح لك LookSave رؤية الملابس عليك بالذكاء الاصطناعي — قبل الشراء.

امسح وجهك مرة واحدة وأدخل طولك ووزنك لإنشاء الأفاتار الخاص بك. ثم تصفّح ملابس حقيقية من
متاجر محلية، واجمع القطع التي تعجبك وشاهد الإطلالة كاملة على أفاتارك. لا مزيد من التخمين
حول الشكل.

كيف يعمل
• أنشئ الأفاتار — مسح سريع للوجه مع الطول والوزن ومقاس الحذاء.
• اعثر على متاجر قريبة — تصفّح الكتالوج أو خريطة المتاجر المحلية.
• جرّب — اضغط «Look» على القطع التي تعجبك ثم جرّبها معًا. تجهز النتيجة خلال بضع دقائق
  وتبقى محفوظة في التطبيق. لم تعجبك؟ بدّل قطعة وجرّب من جديد.
• اطلب من المتجر — أضف ما يناسبك إلى السلة وأرسل الطلب مباشرة إلى المتجر، بالتوصيل أو
  بالاستلام من المتجر.

لا دفع داخل التطبيق
LookSave ليس تطبيق دفع. طلبك هو طلب يُرسَل إلى متجر حقيقي. تتم التسوية مع المتجر
مباشرة — عند التوصيل أو في المكان. لا مشتريات داخل التطبيق ولا إدخال لبيانات
البطاقة.

مصمَّم لمدينتك
يربطك LookSave بمتاجر وبوتيكات محلية حقيقية. كل ما تجرّبه يمكنك شراؤه بالقرب منك.

خصوصية تتحكم بها
تُستخدم صورة وجهك فقط لإنشاء الأفاتار وإلباسه. ولتوليد الصور يعالجها فريقنا باستخدام خدمة
توليد صور بالذكاء الاصطناعي (OpenAI أو Google) لهذا الغرض حصرًا. يمكنك حذف صورتك أو حسابك بالكامل
في أي وقت من داخل التطبيق. الموقع اختياري ويُستخدم فقط لعرض المتاجر القريبة
وتحديد نقطة التوصيل على الخريطة.

متوفر بالعربية والإنجليزية والروسية والأوزبكية.
```

**What's New**
```
• تجربة أبسط بالذكاء الاصطناعي: اجمع القطع بزر «Look» وجرّب الإطلالة كاملة مرة واحدة.
• تصميم جديد للصفحة الرئيسية والمتجر.
• إصلاح تعطّل التطبيق عند التشغيل على iOS 27.
```

---

## 5. App Review Notes (Apple ko'rib chiquvchisiga — INGLIZCHA)

> App Store Connect → App Review Information → Notes maydoniga qo'ying.
> Kvadrat qavsdagi joylarni to'ldiring. Har jumla yuborish kunida ROST bo'lishi
> shart — tekshiruv ro'yxati `docs/17-appstore-review-reply.md` §0 da.
>
> ⚠️ **Demo akkaunt paroli bu faylga YOZILMAYDI** — repo ochiq. Parol faqat
> App Store Connect'dagi «Sign-In Information» maydonlarida turadi; matndagi
> `[parol]` ni joylashtirayotganda qo'lda almashtiring. Demo akkaunt
> 2026-11-13 dan `+998937844572` («LookSave Review»); eski `+998900007777`
> ning paroli shu faylning git tarixida ochiq qolgan — u yopilishi kerak
> (`docs/17` §0).

> Matn 2026-11-13 da build 1.0 (64) uchun yangilandi; uzunligi 3592 belgi
> (maydon chegarasi 4000).

```
ABOUT THE APP
LookSave is a fashion marketplace for Uzbekistan that connects shoppers with physical local stores. Its core feature is AI try-on: the shopper collects items from the catalog and sees the whole outfit on their own avatar before ordering.

WHAT WE FIXED SINCE BUILD 1.0 (61)
• Crash on launch on iOS 27 — the reason build 61 could not be opened. The app now adopts the UIScene life cycle. Verified with a release build on iOS 27.
• On iOS 27 the Back button stopped responding after its first use, so a screen could not be left. Fixed.
• Tapping a push notification while the app was closed did not open the related screen. Fixed.
• The first-launch introduction was never shown because of a storage error. Fixed.
• Permission prompts (camera, photos, location) are now in English and state exactly what the data is used for. The photo-library purpose string that caused the crash in build 22 is in place.

WHAT WE REDESIGNED
• Home, Marketplace and Try-on screens have a new design.
• Try-on was rebuilt: tap "Look" on product cards to collect items, then try them on together with one button.
• Outfits already tried are kept in a "Your try-ons" row and open instantly.
• Test stores and placeholder listings were removed from the production catalog.

DEMO ACCOUNT
Phone: +998 93 784 45 72
Password: [parol]
The account already has an avatar, body measurements and saved try-on results, so you do not need to scan your own face.

HOW TO SEE THE CORE FEATURE (about 2 minutes)
1. Open the app and skip the introduction (link in the top-right corner). Open the Profile tab and sign in with the demo account.
2. On the Home screen, tap the "Look" chip on two or three product cards — for example a jacket, trousers and sneakers. The round button in the middle of the tab bar shows how many items are collected.
3. Tap that middle button to open "Try-on". The collected items are listed at the bottom. Tap "Try on · N items".
4. The result appears on the avatar in about [60] seconds. Tap an item in the list to take it off or put it back on and try again.
5. Tap "Add to cart", open the cart and place the order (delivery or pickup).

GOOD TO KNOW
• Timing. For this demo account the image is generated automatically right away. For regular users, during the launch period each request is processed by our team with an AI image model and usually takes a few minutes; the app shows the queue status and keeps the result once it is ready.
• New avatar. Creating one requires a live face scan with the front camera (camera icon on the Try-on screen), so it cannot be done in the Simulator.
• Orders. There is no payment in the app. An order is a request sent to the store; the shopper pays the store on delivery or at pickup. Orders placed with the demo account go to [a test store operated by us].
• The catalog and stores can be browsed without an account.

PERMISSIONS
• Camera — the face scan for the avatar.
• Photos — only for a profile picture and for sellers' product photos.
• Location — optional; used to show nearby stores on the map.
• Notifications — optional; order status and avatar-ready messages.

PRIVACY
The face photo is sent to our server and is used by our team to generate the avatar and try-on images with third-party AI image models (OpenAI or Google), solely for that purpose. The user agrees on a consent screen before the scan and can delete the photo (Profile → Face photo) or the account (Profile → Delete account) at any time.
Policy: https://looksave.uz/en/privacy

LANGUAGES
The interface follows the device language: English, Russian, Uzbek, Arabic.
```

---

## 6. Pre-submission checklist (ekran rasmlari va texnik)

- [ ] **Avval `docs/17-appstore-review-reply.md` §0** — kontent, demo akkaunt,
      prod sozlamalari va maxfiylik sahifasi bo'yicha asosiy ro'yxat o'sha yerda.
- [ ] **Screenshots** — 6.9" va 6.5" majburiy. Kamida: (1) kiyintirish natijasi
      avatarda, (2) «Look» bilan yig'ilgan kiyimlar, (3) do'konlar, (4) savat va
      buyurtma, (5) bosh ekran. Rasmlar HAQIQIY kontentdan olinsin: sinov
      nomlari va hamkor bo'lmagan brend logotiplari ko'rinmasin.
- [ ] **iPad** — `supportsTablet: false`, iPad skrinshoti shart emas, lekin
      Apple iPad'da ham tekshiradi (1–3-radlar iPad'da bo'lgan): release
      build iPad'da ochilishini sinang.
- [ ] **App Preview** (video) — ixtiyoriy, lekin try-on uchun kuchli ta'sir.
- [ ] **App Privacy "Nutrition Label"** — App Store Connect anketasida belgilang:
      Contact Info (ism, telefon), Location (taxminiy), User Content (fotosuratlar
      — "linked to identity", "app functionality"). Yuz surati uchinchi tomon
      AI xizmatiga (OpenAI yoki Google) uzatilishini ham ko'rsating.
- [ ] **Encryption** — `ITSAppUsesNonExemptEncryption: false` allaqachon
      `app.json` da. Export compliance savoli avtomatik hal bo'ladi.
- [ ] **`version` / build** — `version` `1.0.0`. Build raqami oxirgi yuborilgan
      (61) dan katta bo'lsin — IKKI joyda: `apps/mobile/app.json`
      (`expo.ios.buildNumber`) va `apps/mobile/ios/LookSave/Info.plist`
      (`CFBundleVersion`).
- [ ] **iOS 27** — arxiv Xcode 27 da yig'ilsa, `Info.plist` da
      `UIApplicationSceneManifest` borligini tekshiring va release build'ni
      iOS 27 da oching (build 61 shusiz ishga tushmagan).
- [ ] **Usage strings** — kamera/foto/joylashuv matnlari misolli. Mikrofon,
      Face ID va «doimiy» joylashuv matnlari hali plugin'ning umumiy inglizcha
      matni — ilova ularni so'ramaydi, lekin iloji bo'lsa aniqlashtiring.
- [ ] **Support/privacy pochta** — `.app` → `.uz` domenini tasdiqlang (yuqoridagi
      ogohlantirish).
