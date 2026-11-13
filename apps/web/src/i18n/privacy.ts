import type { Locale } from './locale';

/**
 * Maxfiylik siyosati matni — to'rt tilda (`routes/privacy.tsx` chizadi).
 *
 * ⚠️ BU SAHIFA APP STORE'DAGI «PRIVACY POLICY URL» (`/en/privacy`). Apple
 * ko'rib chiquvchisi uni ochadi va ilovadagi rozilik ekrani bilan
 * solishtiradi. Shuning uchun:
 *
 *   1. HAR TIL O'Z MATNIDA. `Record<Locale, …>` — yangi til qo'shilsa,
 *      tarjimasi yozilmaguncha tip tekshiruvi o'tmaydi.
 *   2. MATN ILOVADAGI ROZILIK BILAN BIR XIL GAPIRADI
 *      (`apps/mobile/src/i18n/dictionaries.ts` → `avatar.consent2Hint`,
 *      `consent3Hint`, `consent4Hint`, `deleteAccount.*`). Birini
 *      o'zgartirsangiz — ikkinchisini ham.
 *
 * ⚠️ FAQAT KODDA TASDIQLANGAN NARSA YOZILGAN (2026-11-12). Har da'voning
 * manbai:
 *
 *   • hisob: telefon, ism, parol (scrypt xeshi) — `api/routes/auth.ts`,
 *     `api/auth/password.ts`
 *   • o'lchamlar va jins — `validation/auth.ts` (`measurementsSchema`)
 *   • buyurtma: ism, telefon, manzil + xarita nuqtasi, izoh —
 *     `validation/orders.ts`
 *   • joylashuv: yaqin do'konlar va yetkazish nuqtasi —
 *     `mobile/src/store/locationStore.ts`, `mobile/app/checkout.tsx`
 *   • qurilma modeli, platforma, versiya, push-token — `mobile/src/hooks/
 *     usePush.ts`, `002_users.sql` (`devices`); kirishda IP va user-agent —
 *     `009_auth.sql` (`login_attempts`)
 *   • surat AI ga: serverda OpenAI (`api/integrations/openai.ts`), operator
 *     navbatida ChatGPT yoki Gemini (`browser-extension/public/manifest.json`);
 *     AI ga ism/telefon ketmaydi — `api/tryon/avatar.ts`, `render.ts`
 *   • do'kon va yetkazish xizmati buyurtma ma'lumotini ko'radi —
 *     `api/integrations/notify.ts`, `api/delivery/deliveries.ts`
 *   • hisobni o'chirish: 30 kun, keyin anonimlashtirish —
 *     `api/auth/deletion.ts`, `020_anonymize_images.sql`
 *   • cookie: faqat `looksave_session` — `web/src/session.server.ts`
 *
 * ⚠️ BUYURTMA YOZUVI SHAXSSIZLANTIRILMAYDI. `anonymize_due_accounts()`
 * `orders.contact_name / contact_phone / address` ga tegmaydi. Ilgari bu
 * sahifa «shaxssizlantirilgan holda qoladi» der edi — kod buni
 * tasdiqlamaydi, shuning uchun matn bor holatni aytadi.
 *
 * ⚠️ YURIDIK KO'RIB CHIQISHDAN O'TMAGAN. Bu yerda faqat texnik haqiqat;
 * ishga tushirishdan oldin yurist tekshirishi shart. Ruscha va arabcha
 * matnni shu tilni biladigan odam o'qib chiqsin.
 *
 * Matn ichidagi `**…**` — ajratib ko'rsatish (`<strong>`); boshqa
 * belgilash yo'q.
 */

/**
 * Suratni qayta ishlaydigan uchinchi tomon AI xizmatlari.
 *
 * ✅ EGASI TASDIQLAGAN (2026-11-12): amalda IKKALASI HAM ishlatiladi —
 * server avtomatik rejimda OpenAI ni chaqiradi, operator esa brauzerda
 * ChatGPT yoki Gemini bilan ishlaydi. Shuning uchun ikkala nom ham turadi.
 *
 * ⚠️ BIRIDAN VOZ KECHILSA — UNI SHU YERDAN OLIB TASHLANG. Nom matnning
 * uch joyida uchraydi va hammasi shu qiymatdan olinadi. Ilovadagi rozilik
 * matni (`avatar.consent2Hint`) va App Store tavsifi
 * (`docs/16-appstore-metadata.md`) ham shu bilan bir xil bo'lishi kerak.
 */
const AI_SERVICE: Record<Locale, string> = {
  uz: 'OpenAI yoki Google',
  ru: 'OpenAI или Google',
  en: 'OpenAI or Google',
  ar: 'OpenAI أو Google',
};

/** Paragraf yoki nuqtali ro'yxat. */
export type PrivacyBlock = string | { list: string[] };

export interface PrivacySection {
  title: string;
  blocks: PrivacyBlock[];
}

export interface PrivacyCopy {
  meta: { title: string; description: string };
  eyebrow: string;
  title: string;
  updated: string;
  lead: string;
  sections: PrivacySection[];
  /** Pochta manzili matndan keyin qo'yiladi (`PRIVACY_EMAIL`). */
  contact: { title: string; text: string };
}

/**
 * ⚠️ POCHTA QUTISI TEKSHIRILMAGAN. `.app` → `.uz` ko'chirilganda manzil
 * ham almashdi; xat haqiqatan qabul qilinishini egasi tasdiqlashi kerak
 * (`docs/16-appstore-metadata.md` boshidagi ogohlantirish).
 */
export const PRIVACY_EMAIL = 'privacy@looksave.uz';

export const PRIVACY_COPY: Record<Locale, PrivacyCopy> = {
  uz: {
    meta: {
      title: 'Maxfiylik siyosati — LookSave',
      description: "Qanday ma'lumot yig'amiz, nima uchun va qanday o'chiriladi.",
    },
    eyebrow: 'Huquqiy',
    title: 'Maxfiylik siyosati',
    updated: 'Oxirgi yangilanish: 2026-yil noyabr',
    lead: "Bu siyosat LookSave mobil ilovasi va looksave.uz saytiga tegishli. Unda qanday ma'lumot yig'ishimiz, nima uchun kerakligi va uni qanday o'chirishingiz mumkinligi yozilgan.",
    sections: [
      {
        title: "Qanday ma'lumot yig'amiz",
        blocks: [
          {
            list: [
              "**Hisob.** Ro'yxatdan o'tganda telefon raqamingiz, ismingiz va parolingiz. Parol faqat xeshlangan holda saqlanadi.",
              "**Avatar va o'lcham.** O'zingiz kiritgan jins, bo'y, vazn va kiyim razmerlari — avatar yasash va mos o'lchamni taklif qilish uchun.",
              "**Surat.** Kiyintirish uchun yuz yoki to'liq bo'yli suratingiz — agar uni qo'shishni tanlasangiz. Batafsil keyingi bo'limda.",
              '**Buyurtma.** Aloqa uchun ism va telefon raqami; yetkazib berishda — manzil, xaritada belgilagan nuqtangiz va yozgan izohingiz.',
              "**Joylashuv.** Faqat siz ruxsat bersangiz: yaqin do'konlarni ko'rsatish va xaritada yetkazish nuqtasini oldindan qo'yish uchun. Ilova usiz ham ishlaydi.",
              '**Qurilma.** Qurilma modeli, platforma va ilova versiyasi; bildirishnomalarga ruxsat bersangiz — push-token; hisobga kirishda — IP-manzil va brauzer yoki qurilma turi. Bular hisobni himoya qilish hamda buyurtma va avatar haqida xabar yuborish uchun kerak.',
              "**Hisobingizdagi ma'lumot.** Savat, sevimlilar va saqlangan komplektlar.",
            ],
          },
        ],
      },
      {
        title: 'Yuz va gavda surati',
        blocks: [
          'Kiyintirish uchun olgan yoki yuklagan suratingiz **qurilmangizdan chiqadi**: u bizning serverimizga yuboriladi.',
          `Avatar va kiyintirish rasmlarini yasash uchun **suratni jamoamiz uchinchi tomon AI xizmati — ${AI_SERVICE.uz} — yordamida qayta ishlaydi**, faqat shu maqsadda. So'rov avtomatik yoki jamoamiz a'zosi tomonidan bajariladi; jamoa a'zosi bajarganda u suratingizni ko'radi. Ikkala holda ham surat o'sha AI xizmatiga uzatiladi.`,
          "Surat va undan yasalgan rasmlar serverimizda saqlanadi. Fayl manzili tasodifiy va hech qayerda ko'rsatilmaydi, lekin havolani bilgan odam uni ocha oladi.",
          "Suratni istalgan vaqtda ilovadan o'chirishingiz mumkin: Profil → Yuz surati → O'chirish. Akkaunt o'chirilganda surat ham o'chiriladi.",
          "**Rozilik oldindan so'raladi**: surat olinishidan avval shu bandlar ko'rsatiladi va siz ularni o'zingiz tasdiqlaysiz.",
        ],
      },
      {
        title: "Ma'lumot kim bilan bo'lishiladi",
        blocks: [
          {
            list: [
              "**Buyurtma bergan do'koningiz** ismingiz, telefoningiz va manzilingizni ko'radi — busiz buyurtmani bajarib bo'lmaydi. Do'kon buyurtma xabarini Telegram orqali olishi mumkin.",
              "**Yetkazib berish xizmati** — yetkazib berishni tanlasangiz — o'sha aloqa ma'lumotlari va manzilni ko'radi.",
              `**AI xizmati (${AI_SERVICE.uz})** suratingizni, siz kiritgan jins va o'lchamlar asosidagi qisqa tavsifni hamda kiyim rasmini oladi. Ismingiz, telefoningiz va manzilingiz unga yuborilmaydi.`,
              '**Texnik provayderlar** — xizmatimiz ishlaydigan infratuzilma: surat va rasmlar uchun bulutli fayl ombori hamda push-bildirishnoma xizmati.',
            ],
          },
          "Ma'lumotingizni sotmaymiz va yuqoridagilardan boshqa hech kimga bermaymiz.",
        ],
      },
      {
        title: "Hisobni o'chirish",
        blocks: [
          "Hisobingizni ilovadan o'chirishingiz mumkin: Profil → Akkauntni o'chirish. So'rovdan keyin 30 kun kutiladi; shu davrda qayta kirsangiz, hisob tiklanadi.",
          "30 kundan keyin ism, telefon raqami, o'lchamlar, surat, avatar va kiyintirish rasmlari, sevimlilar va saqlangan komplektlar o'chiriladi. Buyurtmalar yozuvi — ularda ko'rsatilgan aloqa ma'lumotlari bilan birga — do'konning hisob-kitobi uchun saqlanadi.",
        ],
      },
      {
        title: 'Cookie',
        blocks: [
          "Sayt bitta zarur cookie ishlatadi — kirgan holatingizni saqlaydigan sessiya cookie'si. Til sahifa manzilida, savat esa hisobingizda saqlanadi, shuning uchun ularga cookie kerak emas. Saytda analitika yoki reklama skriptlari yuklanmaydi.",
        ],
      },
    ],
    contact: { title: "Bog'lanish", text: "Savol yoki so'rov bo'lsa:" },
  },

  ru: {
    meta: {
      title: 'Политика конфиденциальности — LookSave',
      description: 'Какие данные мы собираем, зачем и как их удалить.',
    },
    eyebrow: 'Правовая информация',
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: ноябрь 2026 г.',
    lead: 'Эта политика относится к мобильному приложению LookSave и сайту looksave.uz. В ней описано, какие данные мы собираем, зачем они нужны и как вы можете их удалить.',
    sections: [
      {
        title: 'Какие данные мы собираем',
        blocks: [
          {
            list: [
              '**Аккаунт.** Номер телефона, имя и пароль при регистрации. Пароль хранится только в виде хеша.',
              '**Аватар и размер.** Пол, рост, вес и размеры одежды, которые вы указываете сами, — чтобы создать аватар и подсказать подходящий размер.',
              '**Фото.** Фото лица или в полный рост для примерки — если вы решите его добавить. Подробнее в следующем разделе.',
              '**Заказы.** Контактное имя и номер телефона; при доставке — адрес, точка, отмеченная вами на карте, и ваш комментарий.',
              '**Геолокация.** Только с вашего разрешения: чтобы показать магазины рядом и заранее поставить точку доставки на карте. Приложение работает и без неё.',
              '**Устройство.** Модель устройства, платформа и версия приложения; push-токен, если вы разрешили уведомления; при входе в аккаунт — IP-адрес и тип браузера или устройства. Это нужно для защиты аккаунта и для уведомлений о заказах и готовности аватара.',
              '**Данные в аккаунте.** Корзина, избранное и сохранённые образы.',
            ],
          },
        ],
      },
      {
        title: 'Фото лица и тела',
        blocks: [
          'Фото, которое вы делаете или загружаете для примерки, **покидает ваше устройство**: оно отправляется на наш сервер.',
          `Чтобы создать аватар и изображения примерки, **наша команда обрабатывает фото с помощью стороннего ИИ-сервиса — ${AI_SERVICE.ru}** — и только для этой цели. Запрос выполняется автоматически или сотрудником нашей команды; во втором случае сотрудник видит ваше фото. В обоих случаях фото передаётся этому ИИ-сервису.`,
          'Фото и созданные из него изображения хранятся на нашем сервере. Адрес файла случайный и нигде не показывается, но тот, кто знает ссылку, сможет его открыть.',
          'Вы можете удалить фото в любой момент в приложении: Профиль → Фото лица → Удалить. При удалении аккаунта фото тоже удаляется.',
          '**Согласие запрашивается заранее**: перед съёмкой вам показывают эти пункты, и вы подтверждаете их сами.',
        ],
      },
      {
        title: 'Кому мы передаём данные',
        blocks: [
          {
            list: [
              '**Магазин, в котором вы оформили заказ,** видит ваше имя, телефон и адрес — без этого заказ не выполнить. Магазин может получать уведомление о заказе через Telegram.',
              '**Служба доставки** — если вы выбрали доставку — видит те же контактные данные и адрес.',
              `**ИИ-сервис (${AI_SERVICE.ru})** получает ваше фото, краткое описание на основе указанных вами пола и мерок и изображение одежды. Ваше имя, телефон и адрес ему не передаются.`,
              '**Технические провайдеры** — инфраструктура, на которой работает сервис: облачное хранилище файлов для фото и изображений и сервис push-уведомлений.',
            ],
          },
          'Мы не продаём ваши данные и не передаём их никому, кроме перечисленных выше.',
        ],
      },
      {
        title: 'Удаление аккаунта',
        blocks: [
          'Аккаунт можно удалить в приложении: Профиль → Удалить аккаунт. После запроса начинается 30-дневный период ожидания; если за это время вы снова войдёте, аккаунт восстановится.',
          'Через 30 дней удаляются имя, номер телефона, мерки, фото, аватар и изображения примерки, избранное и сохранённые образы. Записи о заказах — вместе с указанными в них контактными данными — сохраняются для учёта магазина.',
        ],
      },
      {
        title: 'Cookie',
        blocks: [
          'Сайт использует один необходимый cookie-файл — сессионный, чтобы вы оставались в аккаунте. Язык указан в адресе страницы, а корзина хранится в вашем аккаунте, поэтому cookie для них не нужны. Сайт не загружает скрипты аналитики и рекламы.',
        ],
      },
    ],
    contact: { title: 'Контакты', text: 'Вопросы и запросы:' },
  },

  en: {
    meta: {
      title: 'Privacy Policy — LookSave',
      description: 'What data LookSave collects, why, and how you can delete it.',
    },
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    updated: 'Last updated: November 2026',
    lead: 'This policy covers the LookSave mobile app and the looksave.uz website. It explains what data we collect, why we need it, and how you can delete it.',
    sections: [
      {
        title: 'What data we collect',
        blocks: [
          {
            list: [
              '**Account.** Your phone number, name and password when you sign up. The password is stored only as a hash.',
              '**Avatar and sizing.** The gender, height, weight and clothing sizes you enter yourself — to build your avatar and suggest a size.',
              '**Photo.** A face or full-body photo for try-on, if you choose to add one. See the next section.',
              '**Orders.** A contact name and phone number; for delivery — the address, the point you mark on the map and any note you add.',
              '**Location.** Only if you allow it: to show nearby stores and to pre-fill the delivery point on the map. The app works without it.',
              '**Device.** The device model, platform and app version; a push token if you allow notifications; and, when you sign in, your IP address and browser or device type. These are needed to protect your account and to send order and avatar notifications.',
              '**In your account.** Your cart, favourites and saved looks.',
            ],
          },
        ],
      },
      {
        title: 'Face and body photo',
        blocks: [
          'The photo you take or upload for try-on **leaves your device**: it is sent to our server.',
          `To create your avatar and try-on images, **our team processes the photo with a third-party AI service — ${AI_SERVICE.en}** — and only for that purpose. A request is handled either automatically or by a member of our team; when a team member handles it, they see your photo. In both cases the photo is passed to that AI service.`,
          'The photo and the images made from it are stored on our server. The file address is random and is shown nowhere, but anyone with the link can open it.',
          'You can delete the photo at any time in the app: Profile → Face photo → Delete. When you delete your account, the photo is erased too.',
          '**Consent comes first**: before the photo is taken, you are shown these points and confirm them yourself.',
        ],
      },
      {
        title: 'Who we share data with',
        blocks: [
          {
            list: [
              '**The store you order from** sees your name, phone number and address — the order cannot be fulfilled without them. The store may receive the order notification via Telegram.',
              '**The delivery service** — if you choose delivery — sees the same contact details and address.',
              `**The AI service (${AI_SERVICE.en})** receives your photo, a short description based on the gender and measurements you entered, and the picture of the garment. Your name, phone number and address are not sent to it.`,
              '**Technical providers** that our service runs on: cloud file storage for photos and images, and the push-notification service.',
            ],
          },
          'We do not sell your data and do not share it with anyone other than those listed above.',
        ],
      },
      {
        title: 'Deleting your account',
        blocks: [
          'You can delete your account in the app: Profile → Delete account. A 30-day waiting period starts after the request; if you sign in during that time, the account is restored.',
          'After 30 days your name, phone number, measurements, photo, avatar and try-on images, favourites and saved looks are erased. Order records — together with the contact details given in them — are kept for the store’s accounting.',
        ],
      },
      {
        title: 'Cookies',
        blocks: [
          'The website uses one necessary cookie — the session cookie that keeps you signed in. Your language is part of the page address and your cart is stored in your account, so they need no cookies. The website loads no analytics or advertising scripts.',
        ],
      },
    ],
    contact: { title: 'Contact', text: 'Questions or requests:' },
  },

  ar: {
    meta: {
      title: 'سياسة الخصوصية — LookSave',
      description: 'ما البيانات التي نجمعها ولماذا وكيف يمكنك حذفها.',
    },
    eyebrow: 'قانوني',
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: نوفمبر 2026',
    lead: 'تنطبق هذه السياسة على تطبيق LookSave للجوال وموقع looksave.uz. وهي توضّح ما البيانات التي نجمعها ولماذا نحتاجها وكيف يمكنك حذفها.',
    sections: [
      {
        title: 'ما البيانات التي نجمعها',
        blocks: [
          {
            list: [
              '**الحساب.** رقم هاتفك واسمك وكلمة المرور عند التسجيل. تُخزَّن كلمة المرور بصيغة مُجزَّأة (hash) فقط.',
              '**الأفاتار والمقاس.** الجنس والطول والوزن ومقاسات الملابس التي تُدخلها بنفسك — لإنشاء الأفاتار واقتراح المقاس المناسب.',
              '**الصورة.** صورة للوجه أو للجسم كاملًا لتجربة الملابس — إذا اخترت إضافتها. التفاصيل في القسم التالي.',
              '**الطلبات.** اسم جهة الاتصال ورقم الهاتف؛ وعند التوصيل — العنوان والنقطة التي تحدّدها على الخريطة وأي ملاحظة تكتبها.',
              '**الموقع الجغرافي.** فقط إذا سمحت بذلك: لعرض المتاجر القريبة ولوضع نقطة التوصيل على الخريطة مسبقًا. يعمل التطبيق بدونه.',
              '**الجهاز.** طراز الجهاز والمنصّة وإصدار التطبيق؛ ورمز الإشعارات (push token) إذا سمحت بالإشعارات؛ وعند تسجيل الدخول — عنوان IP ونوع المتصفح أو الجهاز. نحتاج ذلك لحماية حسابك ولإرسال إشعارات الطلبات وجاهزية الأفاتار.',
              '**بيانات حسابك.** السلة والمفضّلة والإطلالات المحفوظة.',
            ],
          },
        ],
      },
      {
        title: 'صورة الوجه والجسم',
        blocks: [
          'الصورة التي تلتقطها أو ترفعها لتجربة الملابس **تغادر جهازك**: تُرسل إلى خادمنا.',
          `لإنشاء الأفاتار وصور التجربة، **يعالج فريقنا الصورة باستخدام خدمة ذكاء اصطناعي تابعة لجهة خارجية — ${AI_SERVICE.ar}** — ولهذا الغرض فقط. يُنفَّذ الطلب تلقائيًا أو على يد أحد أعضاء فريقنا؛ وفي الحالة الثانية يرى عضو الفريق صورتك. وفي الحالتين تُرسل الصورة إلى خدمة الذكاء الاصطناعي تلك.`,
          'تُخزَّن الصورة والصور المُنشأة منها على خادمنا. عنوان الملف عشوائي ولا يظهر في أي مكان، لكن من يعرف الرابط يمكنه فتحه.',
          'يمكنك حذف الصورة في أي وقت من التطبيق: الملف الشخصي ← صورة الوجه ← حذف. وعند حذف الحساب تُحذف الصورة أيضًا.',
          '**نطلب موافقتك أولًا**: قبل التقاط الصورة تُعرض عليك هذه النقاط وتؤكدها بنفسك.',
        ],
      },
      {
        title: 'مع من نشارك البيانات',
        blocks: [
          {
            list: [
              '**المتجر الذي تطلب منه** يرى اسمك ورقم هاتفك وعنوانك — لا يمكن تنفيذ الطلب بدونها. وقد يتلقى المتجر إشعار الطلب عبر Telegram.',
              '**خدمة التوصيل** — إذا اخترت التوصيل — ترى بيانات الاتصال والعنوان نفسها.',
              `**خدمة الذكاء الاصطناعي (${AI_SERVICE.ar})** تتلقى صورتك ووصفًا قصيرًا مبنيًا على الجنس والقياسات التي أدخلتها وصورة قطعة الملابس. لا يُرسل إليها اسمك ولا رقم هاتفك ولا عنوانك.`,
              '**مزوّدو الخدمات التقنية** الذين تعمل عليهم خدمتنا: التخزين السحابي لملفات الصور وخدمة الإشعارات.',
            ],
          },
          'لا نبيع بياناتك ولا نشاركها مع أي جهة غير المذكورة أعلاه.',
        ],
      },
      {
        title: 'حذف الحساب',
        blocks: [
          'يمكنك حذف حسابك من التطبيق: الملف الشخصي ← حذف الحساب. تبدأ بعد الطلب فترة انتظار مدتها 30 يومًا؛ وإذا سجّلت الدخول خلالها يُستعاد الحساب.',
          'بعد 30 يومًا يُحذف اسمك ورقم هاتفك وقياساتك وصورتك والأفاتار وصور التجربة والمفضّلة والإطلالات المحفوظة. أما سجلات الطلبات — مع بيانات الاتصال الواردة فيها — فتُحفظ لأغراض حسابات المتجر.',
        ],
      },
      {
        title: 'ملفات تعريف الارتباط',
        blocks: [
          'يستخدم الموقع ملف تعريف ارتباط ضروريًا واحدًا — ملف الجلسة الذي يُبقيك مسجّلًا للدخول. اللغة جزء من عنوان الصفحة والسلة محفوظة في حسابك، لذلك لا تحتاجان إلى ملفات تعريف ارتباط. لا يحمّل الموقع أي سكربتات للتحليلات أو الإعلانات.',
        ],
      },
    ],
    contact: { title: 'تواصل معنا', text: 'للأسئلة أو الطلبات:' },
  },
};
