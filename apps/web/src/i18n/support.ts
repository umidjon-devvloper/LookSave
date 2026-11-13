import type { Locale } from './locale';

/**
 * Yordam markazi matni — to'rt tilda (`routes/support.tsx` chizadi).
 *
 * ⚠️ BU SAHIFA APPLE UCHUN HAM. App Store har ilovadan «Support URL»
 * so'raydi, hisob yaratadigan ilovadan esa hisobni O'CHIRISH YO'LINI
 * (Guideline 5.1.1(v)). Ko'rib chiquvchi shu yerdagi qadamlarni ilovada
 * takrorlaydi, shuning uchun:
 *
 *   1. HAR TIL O'Z MATNIDA — `Record<Locale, …>`: yangi til qo'shilsa,
 *      tarjimasi yozilmaguncha tip tekshiruvi o'tmaydi.
 *   2. TUGMA NOMLARI ILOVADAGI BILAN BIR XIL
 *      (`apps/mobile/src/i18n/dictionaries.ts`): `tabs.profile`,
 *      `profile.deleteAccount`, `deleteAccount.confirm`,
 *      `profile.myMeasurements`, `tryon.title`, `tryon.retry`. Ilovada
 *      nom o'zgarsa — bu yerda ham. Arabchada tab nomi «الحساب».
 *   3. HISOBNI O'CHIRISH VA AI HAQIDAGI JUMLALAR MAXFIYLIK SIYOSATI BILAN
 *      BIR XIL (`i18n/privacy.ts`). Birini o'zgartirsangiz — ikkinchisini ham.
 *
 * ⚠️ FAQAT KODDA TASDIQLANGAN NARSA YOZILGAN (2026-11-12). Manbalar:
 *
 *   • hisobni o'chirish: parol so'raladi, 30 kun kutiladi, qayta kirish
 *     tiklaydi — `api/routes/auth.ts` (DELETE /auth/account),
 *     `api/auth/deletion.ts`; nima o'chadi — `020_anonymize_images.sql`
 *   • ochiq buyurtma yoki faol do'kon bo'lsa so'rov qabul qilinmaydi —
 *     `api/routes/auth.ts`, `countOpenOrders` / `ownsActiveStore`
 *   • buyurtma yozuvi saqlanadi — `anonymize_due_accounts()` `orders` ga
 *     tegmaydi
 *   • kiyintirish «odatda bir necha daqiqa», natija saqlanadi — ilovadagi
 *     `tryon.waitingHint`, `docs/16-appstore-metadata.md` §5
 *   • kunlik chegara — `api/tryon/render.ts` (`assertDailyLimit`), soni
 *     muhitdan (`TRYON_DAILY_LIMIT`), shuning uchun SON YOZILMAGAN
 *   • o'lcham taklifi tanlangan razmerlardan — `validation/sizing.ts`
 *     (`recommendSize`)
 *   • surat serverga, undan uchinchi tomon AI xizmatiga — `i18n/privacy.ts`
 *     boshidagi manbalar
 *
 * ⚠️ ILGARIGI MATNDA KODGA ZID EDI (tuzatildi):
 *   • «hisob 24 soat ichida o'chiriladi» → 30 kun kutish
 *   • «buyurtma tarixi ham olib tashlanadi» → buyurtma yozuvi saqlanadi
 *   • «AI generatsiyasi 10–20 soniya» → oddiy foydalanuvchida so'rovni
 *     jamoa bajaradi, natija daqiqalarda keladi
 *   • «Yangilash» tugmasi → ilovada «Qayta urinish»
 *   • «bo'y va vazn asosida o'lcham» → `recommendSize` faqat tanlangan
 *     razmerga (eski profillarda ko'krak/bel aylanasiga) qaraydi
 *   • «old, yon va orqadan ko'rasiz» → hozirgi kiyintirish ekranida
 *     burchak tanlash yo'q (`mobile/src/components/ai/LookRoom.tsx`)
 *   • «Faqat mening o'lchamim» filtri → ilovaning hozirgi ekranida yo'q
 *   • «kiyintirish provayderi» → maxfiylik siyosatidagi ibora
 *   • `support@looksave.app`, `store.looksave.app` → `.app` domeni o'lik
 *
 * ⚠️ AI XIZMATI NOMI BU YERDA ATAYIN YO'Q. Nomlar (`AI_SERVICE`)
 * `i18n/privacy.ts` da, bitta joyda; bu yerda takrorlansa, biri
 * almashganda ikkinchisi eskirib qoladi. Sahifa «uchinchi tomon AI
 * xizmati» deydi va siyosatga havola beradi.
 *
 * ⚠️ YURIDIK KO'RIB CHIQISHDAN O'TMAGAN. Ruscha va arabcha matnni shu
 * tilni biladigan odam o'qib chiqsin.
 *
 * Belgilash (`components/RichText.tsx`): `**…**` — ajratib ko'rsatish;
 * `{email}`, `{telegram}`, `{store}`, `{privacy}` — sahifa qo'yadigan
 * havolalar.
 */

/**
 * ⚠️ EGASI TASDIQLASHI KERAK — BU QIYMATLARNI KOD TASDIQLAY OLMAYDI.
 *
 * Ular va'da: sahifada turibdi, lekin rostligini faqat jamoa biladi.
 * Noto'g'ri bo'lsa — shu yerda tuzating, matnning to'rt tili ham o'zi
 * yangilanadi.
 *
 *   • `SUPPORT_EMAIL` — `.app` → `.uz` ko'chirilganda almashdi (eski
 *     `support@looksave.app` o'lik domen). `support@looksave.uz` qutisi
 *     XAT QABUL QILISHI TEKSHIRILMAGAN; Apple'ga yoziladigan javobda ham
 *     shu manzil turibdi (`docs/17-appstore-review-reply.md`).
 *   • `TELEGRAM_*` — hisob tekshirilmagan (`components/Footer.tsx` dagi
 *     ogohlantirish bilan bir xil manzil).
 *   • `REPLY_WITHIN_HOURS` — «24 soat ichida javob beramiz».
 *   • `HOURS_FROM` / `HOURS_TO` — ish vaqti, Toshkent vaqti bilan.
 */
export const SUPPORT_EMAIL = 'support@looksave.uz';
export const TELEGRAM_HANDLE = '@looksave';
export const TELEGRAM_URL = 'https://t.me/looksave';

const REPLY_WITHIN_HOURS = 24;
const HOURS_FROM = '09:00';
const HOURS_TO = '21:00';

/**
 * Sotuvchi kabineti — `components/Footer.tsx` va API'dagi
 * `STORE_PANEL_URL` bilan bir xil. 2026-11-12 da ochilishi tekshirilgan.
 */
export const STORE_PANEL_URL = 'https://store.looksave.uz';
export const STORE_PANEL_LABEL = 'store.looksave.uz';

export interface SupportFaqItem {
  question: string;
  /** `{privacy}` — maxfiylik siyosatiga havola (`privacyLink` matni bilan). */
  answer: string;
}

export interface SupportCopy {
  meta: { title: string; description: string };
  eyebrow: string;
  title: string;
  /** ⚠️ Javob muddati va'dasi — `REPLY_WITHIN_HOURS`. */
  lead: string;
  contact: {
    title: string;
    /** `{email}` */
    email: string;
    /** `{telegram}` */
    telegram: string;
    /** ⚠️ Ish vaqti — `HOURS_FROM` / `HOURS_TO`. */
    hours: string;
  };
  faq: { title: string; items: SupportFaqItem[] };
  /** `{privacy}` o'rniga chiqadigan havola matni — gap ichidagi kelishikda. */
  privacyLink: string;
  deletion: {
    title: string;
    intro: string;
    /** Tartibli ro'yxat — ilovadagi qadamlar. */
    steps: string[];
    /** Qadamlardan keyingi paragraflar: muddat, nima o'chadi, to'siqlar. */
    after: string[];
    /** ⚠️ Egasining va'dasi (kodda bunday yo'l yo'q). `{email}` */
    noAccess: string;
    mailSubject: string;
  };
  stores: {
    title: string;
    /** `{store}` va `{email}` */
    text: string;
    mailSubject: string;
  };
}

export const SUPPORT_COPY: Record<Locale, SupportCopy> = {
  uz: {
    meta: {
      title: 'Yordam — LookSave',
      description:
        "LookSave bilan bog'lanish, tez-tez so'raladigan savollar va hisobni o'chirish yo'li.",
    },
    eyebrow: 'Yordam',
    title: 'Yordam markazi',
    lead: `Savol yoki muammo bo'lsa yozing — ${REPLY_WITHIN_HOURS} soat ichida javob beramiz.`,
    contact: {
      title: "Biz bilan bog'lanish",
      email: 'Elektron pochta: {email}',
      telegram: 'Telegram: {telegram}',
      hours: `Ish vaqti: har kuni, ${HOURS_FROM} – ${HOURS_TO} (Toshkent vaqti).`,
    },
    faq: {
      title: "Tez-tez so'raladigan savollar",
      items: [
        {
          question: 'AI kiyintirish qanday ishlaydi?',
          answer:
            "Bir marta yuz suratingizni qo'shasiz va o'lchamlaringizni kiritasiz — shundan avataringiz yasaladi. Keyin ilovada mahsulot kartasidagi «Look» tugmasi bilan kiyimlarni yig'asiz va «Kiyib ko'rish» ekranida ularni avataringizga birga kiyintirasiz. Suratingiz qurilmangizdan serverimizga yuboriladi va uni jamoamiz uchinchi tomon AI xizmati yordamida qayta ishlaydi — batafsil {privacy}.",
        },
        {
          question: "O'lcham qanday tanlanadi?",
          answer:
            "Profilda ko'rsatgan kiyim va oyoq kiyim razmerlaringiz asosida sizga mos o'lcham taklif qilinadi. Ularni ilovada istalgan vaqtda o'zgartirishingiz mumkin: Profil → O'lchamlarim.",
        },
        {
          question: 'Mahsulotni qaytarish yoki almashtirish mumkinmi?',
          answer:
            "Qaytarish va almashtirish shartlari sotuvchi do'kon siyosatiga bo'ysunadi. LookSave nizoda vositachi bo'ladi: bizga yozing, biz do'kon bilan bog'lanamiz.",
        },
        {
          question: 'Kiyintirish sekin kelayapti yoki xato chiqdi',
          answer:
            "Kiyintirish odatda bir necha daqiqa oladi: ilova navbat holatini ko'rsatadi, ilovadan chiqsangiz ham natija saqlanadi. Xato chiqsa, «Qayta urinish» ni bosing yoki boshqa kiyim tanlang. Takrorlansa — qaysi kiyimda bo'lganini bizga yozib yuboring.",
        },
        {
          question: 'Kunlik AI chegarasi tugadi',
          answer:
            "Bir kunda yasash mumkin bo'lgan yangi AI rasmlar soni cheklangan. Tayyor rasmlar joyida qoladi; yangilarini ertasi kuni yasashingiz mumkin.",
        },
      ],
    },
    privacyLink: 'maxfiylik siyosatida',
    deletion: {
      title: "Hisobni o'chirish",
      intro: "Hisobingizni ilovaning o'zidan o'chirishingiz mumkin:",
      steps: [
        'Ilovaning pastki panelidagi «Profil» ni oching.',
        "Sahifa oxiridagi «Akkauntni o'chirish» tugmasini bosing.",
        "Parolingizni kiriting va «Ha, akkauntni o'chir» tugmasini bosing.",
      ],
      after: [
        "So'rovdan keyin **30 kun** kutiladi; shu davrda qayta kirsangiz, hisob tiklanadi.",
        "30 kundan keyin ism, telefon raqami, o'lchamlar, surat, avatar va kiyintirish rasmlari, sevimlilar va saqlangan komplektlar o'chiriladi. Buyurtmalar yozuvi — ularda ko'rsatilgan aloqa ma'lumotlari bilan birga — do'konning hisob-kitobi uchun saqlanadi.",
        "Yakunlanmagan buyurtmangiz bo'lsa, avval uni yakunlang yoki bekor qiling. Do'kon egasi bo'lsangiz, avval bizga yozing — do'kon yopilgach hisobni o'chirish mumkin bo'ladi.",
      ],
      noAccess:
        "Ilovaga kira olmayotgan bo'lsangiz, {email} ga hisobingizga bog'langan telefon raqamini ko'rsatib yozing — biz tekshirib o'chiramiz.",
      mailSubject: "Hisobni o'chirish",
    },
    stores: {
      title: "Do'konlar uchun",
      text: "Do'kon ochish, mahsulot yuklash yoki sotuvchi kabineti bo'yicha savol bo'lsa, {store} ga o'ting yoki {email} ga xat yuboring.",
      mailSubject: "Do'kon",
    },
  },

  ru: {
    meta: {
      title: 'Помощь — LookSave',
      description: 'Как связаться с LookSave, частые вопросы и как удалить аккаунт.',
    },
    eyebrow: 'Помощь',
    title: 'Центр помощи',
    lead: `Если возник вопрос или проблема — напишите нам, ответим в течение ${REPLY_WITHIN_HOURS} часов.`,
    contact: {
      title: 'Связаться с нами',
      email: 'Электронная почта: {email}',
      telegram: 'Telegram: {telegram}',
      hours: `Время работы: ежедневно, ${HOURS_FROM} – ${HOURS_TO} (по ташкентскому времени).`,
    },
    faq: {
      title: 'Частые вопросы',
      items: [
        {
          question: 'Как работает ИИ-примерка?',
          answer:
            'Вы один раз добавляете фото лица и указываете свои размеры — из этого создаётся ваш аватар. Затем в приложении вы собираете вещи кнопкой «Look» на карточке товара и на экране «Примерка» примеряете их вместе на аватаре. Фото отправляется с вашего устройства на наш сервер, и наша команда обрабатывает его с помощью стороннего ИИ-сервиса — подробнее {privacy}.',
        },
        {
          question: 'Как подбирается размер?',
          answer:
            'Подходящий размер предлагается на основе размеров одежды и обуви, которые вы указали в профиле. Их можно изменить в приложении в любой момент: Профиль → Мои размеры.',
        },
        {
          question: 'Можно ли вернуть или обменять товар?',
          answer:
            'Условия возврата и обмена определяются правилами магазина-продавца. В спорной ситуации LookSave выступает посредником: напишите нам, и мы свяжемся с магазином.',
        },
        {
          question: 'Примерка идёт медленно или завершилась ошибкой',
          answer:
            'Примерка обычно занимает несколько минут: приложение показывает статус очереди, а результат сохранится, даже если вы выйдете из приложения. При ошибке нажмите «Повторить» или выберите другую вещь. Если ошибка повторяется — напишите нам, с какой вещью это произошло.',
        },
        {
          question: 'Дневной лимит AI исчерпан',
          answer:
            'Количество новых ИИ-изображений, которые можно создать за день, ограничено. Готовые изображения остаются; новые можно будет создать на следующий день.',
        },
      ],
    },
    privacyLink: 'в политике конфиденциальности',
    deletion: {
      title: 'Удаление аккаунта',
      intro: 'Аккаунт можно удалить прямо в приложении:',
      steps: [
        'Откройте «Профиль» на нижней панели приложения.',
        'Внизу страницы нажмите «Удалить аккаунт».',
        'Введите пароль и нажмите «Да, удалить аккаунт».',
      ],
      after: [
        'После запроса начинается **30-дневный** период ожидания; если за это время вы снова войдёте, аккаунт восстановится.',
        'Через 30 дней удаляются имя, номер телефона, мерки, фото, аватар и изображения примерки, избранное и сохранённые образы. Записи о заказах — вместе с указанными в них контактными данными — сохраняются для учёта магазина.',
        'Если у вас есть незавершённый заказ, сначала завершите или отмените его. Если вы владелец магазина, сначала напишите нам — удалить аккаунт можно будет после закрытия магазина.',
      ],
      noAccess:
        'Если вы не можете войти в приложение, напишите на {email} и укажите номер телефона, привязанный к аккаунту, — мы проверим и удалим его.',
      mailSubject: 'Удаление аккаунта',
    },
    stores: {
      title: 'Для магазинов',
      text: 'Если у вас вопрос об открытии магазина, загрузке товаров или кабинете продавца, перейдите на {store} или напишите на {email}.',
      mailSubject: 'Магазин',
    },
  },

  en: {
    meta: {
      title: 'Support — LookSave',
      description:
        'How to contact LookSave, frequently asked questions and how to delete your account.',
    },
    eyebrow: 'Support',
    title: 'Help Center',
    lead: `If you have a question or a problem, write to us — we reply within ${REPLY_WITHIN_HOURS} hours.`,
    contact: {
      title: 'Contact us',
      email: 'Email: {email}',
      telegram: 'Telegram: {telegram}',
      hours: `Hours: every day, ${HOURS_FROM} – ${HOURS_TO} (Tashkent time).`,
    },
    faq: {
      title: 'Frequently asked questions',
      items: [
        {
          question: 'How does AI try-on work?',
          answer:
            'You add a photo of your face once and enter your measurements — your avatar is built from them. Then, in the app, you collect items with the “Look” button on product cards and try them on together on your avatar on the “Try-on” screen. Your photo is sent from your device to our server, and our team processes it with a third-party AI service — see {privacy} for details.',
        },
        {
          question: 'How is my size chosen?',
          answer:
            'A size is suggested based on the clothing and shoe sizes you set in your profile. You can change them in the app at any time: Profile → My measurements.',
        },
        {
          question: 'Can I return or exchange an item?',
          answer:
            'Returns and exchanges are subject to the policy of the store that sold the item. LookSave acts as a mediator in a dispute: write to us and we will contact the store.',
        },
        {
          question: 'Try-on is slow or ended with an error',
          answer:
            'Try-on usually takes a few minutes: the app shows the queue status, and the result is saved even if you leave the app. If you see an error, tap “Try again” or choose a different item. If it keeps happening, write to us and tell us which item it was.',
        },
        {
          question: 'Daily AI limit reached',
          answer:
            'The number of new AI images you can generate per day is limited. Finished images stay; you can generate new ones the next day.',
        },
      ],
    },
    privacyLink: 'the privacy policy',
    deletion: {
      title: 'Deleting your account',
      intro: 'You can delete your account right in the app:',
      steps: [
        'Open “Profile” in the app’s bottom bar.',
        'Tap “Delete account” at the bottom of the page.',
        'Enter your password and tap “Yes, delete my account”.',
      ],
      after: [
        'A **30-day** waiting period starts after the request; if you sign in during that time, the account is restored.',
        'After 30 days your name, phone number, measurements, photo, avatar and try-on images, favourites and saved looks are erased. Order records — together with the contact details given in them — are kept for the store’s accounting.',
        'If you have an unfinished order, finish or cancel it first. If you own a store, write to us first — the account can be deleted once the store is closed.',
      ],
      noAccess:
        'If you cannot sign in to the app, write to {email} and include the phone number linked to your account — we will verify it and delete the account.',
      mailSubject: 'Delete account',
    },
    stores: {
      title: 'For stores',
      text: 'For questions about opening a store, uploading products or the seller dashboard, go to {store} or write to {email}.',
      mailSubject: 'Store',
    },
  },

  ar: {
    meta: {
      title: 'المساعدة — LookSave',
      description: 'طرق التواصل مع LookSave والأسئلة الشائعة وطريقة حذف الحساب.',
    },
    eyebrow: 'المساعدة',
    title: 'مركز المساعدة',
    lead: `إذا كان لديك سؤال أو مشكلة فاكتب لنا — نرد خلال ${REPLY_WITHIN_HOURS} ساعة.`,
    contact: {
      title: 'تواصل معنا',
      email: 'البريد الإلكتروني: {email}',
      telegram: 'تيليغرام: {telegram}',
      hours: `ساعات العمل: يوميًا من ${HOURS_FROM} إلى ${HOURS_TO} (بتوقيت طشقند).`,
    },
    faq: {
      title: 'الأسئلة الشائعة',
      items: [
        {
          question: 'كيف تعمل تجربة الملابس بالذكاء الاصطناعي؟',
          answer:
            'تضيف صورة وجهك مرة واحدة وتُدخل قياساتك — ومنها يُنشأ الأفاتار الخاص بك. بعد ذلك تجمع القطع في التطبيق بزر «Look» على بطاقة المنتج، ثم تجرّبها معًا على الأفاتار في شاشة «القياس». تُرسل صورتك من جهازك إلى خادمنا، ويعالجها فريقنا باستخدام خدمة ذكاء اصطناعي تابعة لجهة خارجية — التفاصيل في {privacy}.',
        },
        {
          question: 'كيف يُختار المقاس؟',
          answer:
            'يُقترح المقاس المناسب بناءً على مقاسات الملابس والأحذية التي حدّدتها في حسابك. يمكنك تغييرها في التطبيق في أي وقت: الحساب ← مقاساتي.',
        },
        {
          question: 'هل يمكن إرجاع المنتج أو استبداله؟',
          answer:
            'تخضع شروط الإرجاع والاستبدال لسياسة المتجر البائع. يقوم LookSave بدور الوسيط عند النزاع: اكتب لنا وسنتواصل مع المتجر.',
        },
        {
          question: 'التجربة بطيئة أو انتهت بخطأ',
          answer:
            'تستغرق التجربة عادةً بضع دقائق: يعرض التطبيق حالة قائمة الانتظار، وتُحفظ النتيجة حتى لو خرجت من التطبيق. إذا ظهر خطأ فاضغط «إعادة المحاولة» أو اختر قطعة أخرى. وإذا تكرّر الخطأ فاكتب لنا واذكر القطعة التي حدث معها.',
        },
        {
          question: 'انتهى الحد اليومي للذكاء الاصطناعي',
          answer:
            'عدد صور الذكاء الاصطناعي الجديدة التي يمكن إنشاؤها في اليوم محدود. تبقى الصور الجاهزة، ويمكنك إنشاء صور جديدة في اليوم التالي.',
        },
      ],
    },
    privacyLink: 'سياسة الخصوصية',
    deletion: {
      title: 'حذف الحساب',
      intro: 'يمكنك حذف حسابك من داخل التطبيق مباشرةً:',
      steps: [
        'افتح «الحساب» في الشريط السفلي للتطبيق.',
        'اضغط «حذف الحساب» في أسفل الصفحة.',
        'أدخل كلمة المرور واضغط «نعم، احذف حسابي».',
      ],
      after: [
        'تبدأ بعد الطلب فترة انتظار مدتها **30 يومًا**؛ وإذا سجّلت الدخول خلالها يُستعاد الحساب.',
        'بعد 30 يومًا يُحذف اسمك ورقم هاتفك وقياساتك وصورتك والأفاتار وصور التجربة والمفضّلة والإطلالات المحفوظة. أما سجلات الطلبات — مع بيانات الاتصال الواردة فيها — فتُحفظ لأغراض حسابات المتجر.',
        'إذا كان لديك طلب غير مكتمل فأكمله أو ألغِه أولًا. وإذا كنت صاحب متجر فاكتب لنا أولًا — يمكن حذف الحساب بعد إغلاق المتجر.',
      ],
      noAccess:
        'إذا لم تتمكن من الدخول إلى التطبيق فاكتب إلى {email} واذكر رقم الهاتف المرتبط بحسابك — سنتحقق ونحذف الحساب.',
      mailSubject: 'حذف الحساب',
    },
    stores: {
      title: 'للمتاجر',
      text: 'للأسئلة حول فتح متجر أو رفع المنتجات أو لوحة البائع، انتقل إلى {store} أو راسلنا على {email}.',
      mailSubject: 'متجر',
    },
  },
};
