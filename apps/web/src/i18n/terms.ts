import type { Locale } from './locale';

/**
 * Foydalanish shartlari matni — to'rt tilda (`routes/terms.tsx` chizadi).
 *
 * ⚠️ ILOVA SHU SAHIFANI OCHADI: Profil → «Foydalanish shartlari»
 * (`apps/mobile/app/(tabs)/profile.tsx`). Apple ko'rib chiquvchisi ham
 * shu yerga tushadi, shuning uchun HAR TIL O'Z MATNIDA —
 * `Record<Locale, …>`: yangi til qo'shilsa, tarjimasi yozilmaguncha tip
 * tekshiruvi o'tmaydi.
 *
 * ⚠️ ASOSIY BAND: LookSave sotuvchi EMAS (00-README K-10). Buyurtma —
 * do'konga yuborilgan so'rov, shartnoma esa xaridor bilan do'kon
 * o'rtasida tuziladi. Bu yozilmasa mas'uliyat chegarasi noaniq qoladi.
 *
 * Matn ikki xil jumladan iborat — farqini bilib tahrirlang:
 *
 *   KODDA TASDIQLANGAN (2026-11-12):
 *   • mahsulot do'konga tegishli — `004_catalog.sql` (`products.store_id`)
 *   • onlayn to'lov yo'q, to'lov do'konda yoki yetkazilganda —
 *     `api/orders/orders.ts` (`paymentNote`), K-10
 *   • do'kon tasdiqlaydi — buyurtma statuslari (`api/routes/orders.ts`)
 *   • buyurtma berish vaqtincha cheklanadi: 3 ta bekor qilingan, javobsiz
 *     yoki olib ketilmagan buyurtma va birorta yakunlangani yo'q → 7 kun
 *     (`007_functions.sql` → `update_user_trust`), ilovada «Buyurtma
 *     berish vaqtincha cheklangan». Ilgari matn «hisob cheklanadi» der
 *     edi — cheklanadigani hisob emas, buyurtma berish.
 *
 *   EGASINING QARORI (kod tasdiqlay olmaydi, shu sababli O'ZGARTIRILMAGAN):
 *   • «shartnoma siz bilan do'kon o'rtasida»
 *   • «qaytarish do'kon siyosatiga bo'ysunadi», «LookSave nizoda vositachi»
 *
 * ⚠️ ILGARIGI MATNDAN OLIB TASHLANGAN, CHUNKI KODDA YO'Q:
 *   • «do'konning o'lcham jadvali» — API'da o'lcham jadvali yo'q, faqat
 *     o'lcham tizimi (`web/src/api/endpoints.ts` → `sizeChart`)
 *   • «3D kiyintirish» — ilovadagi kiyintirish endi AI rasm
 *     (`mobile/app/(tabs)/tryon.tsx`)
 *
 * ⚠️ YURIDIK KO'RIB CHIQISHDAN O'TMAGAN. Ruscha va arabcha matnni shu
 * tilni biladigan odam o'qib chiqsin.
 *
 * Matn ichidagi `**…**` — ajratib ko'rsatish (`components/RichText.tsx`).
 */

export interface TermsSection {
  title: string;
  /** Har biri alohida paragraf. */
  blocks: string[];
}

export interface TermsCopy {
  meta: { title: string; description: string };
  eyebrow: string;
  title: string;
  updated: string;
  lead: string;
  sections: TermsSection[];
}

export const TERMS_COPY: Record<Locale, TermsCopy> = {
  uz: {
    meta: {
      title: 'Foydalanish shartlari — LookSave',
      description: "Xizmatdan foydalanish qoidalari va mas'uliyat chegarasi.",
    },
    eyebrow: 'Huquqiy',
    title: 'Foydalanish shartlari',
    updated: 'Oxirgi yangilanish: 2026-yil noyabr',
    lead: 'Bu shartlar LookSave mobil ilovasi va looksave.uz saytidan foydalanishga tegishli.',
    sections: [
      {
        title: 'LookSave nima qiladi',
        blocks: [
          "LookSave — do'konlar va xaridorlarni bog'laydigan platforma. Biz mahsulot sotmaymiz va ombor tutmaymiz: har bir mahsulot ro'yxatdan o'tgan do'konga tegishli.",
        ],
      },
      {
        title: 'Buyurtma',
        blocks: [
          "Buyurtma berish — do'konga yuborilgan **so'rov**. Do'kon uni tasdiqlagach shartnoma siz bilan do'kon o'rtasida tuziladi. To'lov do'konda yoki yetkazib berilganda amalga oshiriladi; platformada onlayn to'lov yo'q.",
        ],
      },
      {
        title: 'Qaytarish',
        blocks: [
          "Qaytarish va almashtirish shartlari do'kon siyosatiga bo'ysunadi. LookSave nizoda vositachi bo'ladi, lekin sotuvchi sifatida javob bermaydi.",
        ],
      },
      {
        title: 'Kiyintirish natijasi',
        blocks: [
          "Avatar va AI kiyintirish rasmlari — taxminiy ko'rinish. Ular kiyimning haqiqiy o'lchami, rangi va matosini to'liq aks ettirmasligi mumkin; xarid qilishdan oldin mahsulot sahifasidagi o'lchamni ham tekshiring.",
        ],
      },
      {
        title: 'Hisobingiz',
        blocks: [
          "Telefon raqami haqiqiy bo'lishi kerak — u buyurtmani do'kon bilan bog'laydi. Soxta, qayta-qayta bekor qilingan yoki olib ketilmagan buyurtmalar uchun buyurtma berish vaqtincha cheklanishi mumkin.",
        ],
      },
    ],
  },

  ru: {
    meta: {
      title: 'Условия использования — LookSave',
      description: 'Правила пользования сервисом и границы ответственности.',
    },
    eyebrow: 'Правовая информация',
    title: 'Условия использования',
    updated: 'Последнее обновление: ноябрь 2026 г.',
    lead: 'Эти условия относятся к использованию мобильного приложения LookSave и сайта looksave.uz.',
    sections: [
      {
        title: 'Что делает LookSave',
        blocks: [
          'LookSave — платформа, которая связывает магазины и покупателей. Мы не продаём товары и не держим склад: каждый товар принадлежит зарегистрированному магазину.',
        ],
      },
      {
        title: 'Заказ',
        blocks: [
          'Оформление заказа — это **запрос**, отправленный магазину. После того как магазин его подтвердит, договор заключается между вами и магазином. Оплата производится в магазине или при доставке; онлайн-оплаты на платформе нет.',
        ],
      },
      {
        title: 'Возврат',
        blocks: [
          'Условия возврата и обмена определяются правилами магазина. В спорной ситуации LookSave выступает посредником, но не отвечает как продавец.',
        ],
      },
      {
        title: 'Результат примерки',
        blocks: [
          'Аватар и изображения ИИ-примерки — это приблизительный вид. Они могут неточно передавать реальный размер, цвет и ткань вещи; перед покупкой проверьте также размер на странице товара.',
        ],
      },
      {
        title: 'Ваш аккаунт',
        blocks: [
          'Номер телефона должен быть настоящим — по нему заказ связывается с магазином. За фиктивные, неоднократно отменённые или невыкупленные заказы оформление заказов может быть временно ограничено.',
        ],
      },
    ],
  },

  en: {
    meta: {
      title: 'Terms of Use — LookSave',
      description: 'The rules for using the service and the limits of our responsibility.',
    },
    eyebrow: 'Legal',
    title: 'Terms of Use',
    updated: 'Last updated: November 2026',
    lead: 'These terms apply to your use of the LookSave mobile app and the looksave.uz website.',
    sections: [
      {
        title: 'What LookSave does',
        blocks: [
          'LookSave is a platform that connects stores and shoppers. We do not sell products and do not hold stock: every product belongs to a registered store.',
        ],
      },
      {
        title: 'Orders',
        blocks: [
          'Placing an order is a **request** sent to the store. Once the store confirms it, the contract is between you and the store. You pay at the store or on delivery; there is no online payment on the platform.',
        ],
      },
      {
        title: 'Returns',
        blocks: [
          'Returns and exchanges are subject to the store’s policy. LookSave acts as a mediator in a dispute but is not liable as the seller.',
        ],
      },
      {
        title: 'Try-on results',
        blocks: [
          'The avatar and AI try-on images are an approximation. They may not fully reflect the real size, colour and fabric of a garment; check the size on the product page as well before you buy.',
        ],
      },
      {
        title: 'Your account',
        blocks: [
          'Your phone number must be real — it links the order to the store. Fake orders, or orders that are repeatedly cancelled or not collected, may lead to ordering being temporarily restricted.',
        ],
      },
    ],
  },

  ar: {
    meta: {
      title: 'شروط الاستخدام — LookSave',
      description: 'قواعد استخدام الخدمة وحدود المسؤولية.',
    },
    eyebrow: 'قانوني',
    title: 'شروط الاستخدام',
    updated: 'آخر تحديث: نوفمبر 2026',
    lead: 'تنطبق هذه الشروط على استخدامك لتطبيق LookSave للجوال وموقع looksave.uz.',
    sections: [
      {
        title: 'ما الذي يقدّمه LookSave',
        blocks: [
          'LookSave منصّة تربط بين المتاجر والمتسوّقين. نحن لا نبيع المنتجات ولا نحتفظ بمخزون: كل منتج يعود إلى متجر مسجَّل.',
        ],
      },
      {
        title: 'الطلب',
        blocks: [
          'تقديم الطلب هو **طلب يُرسل إلى المتجر**. بعد أن يؤكّده المتجر يُبرم العقد بينك وبين المتجر. يتم الدفع في المتجر أو عند التوصيل؛ ولا يوجد دفع إلكتروني على المنصّة.',
        ],
      },
      {
        title: 'الإرجاع',
        blocks: [
          'تخضع شروط الإرجاع والاستبدال لسياسة المتجر. يقوم LookSave بدور الوسيط عند النزاع، لكنه لا يتحمّل مسؤولية البائع.',
        ],
      },
      {
        title: 'نتيجة تجربة الملابس',
        blocks: [
          'الأفاتار وصور التجربة بالذكاء الاصطناعي عرض تقريبي. قد لا تعكس تمامًا المقاس واللون والقماش الحقيقي للقطعة؛ لذا تحقّق أيضًا من المقاس في صفحة المنتج قبل الشراء.',
        ],
      },
      {
        title: 'حسابك',
        blocks: [
          'يجب أن يكون رقم الهاتف حقيقيًا — فهو يربط الطلب بالمتجر. الطلبات الوهمية أو التي تُلغى مرارًا أو لا تُستلم قد تؤدي إلى تقييد تقديم الطلبات مؤقتًا.',
        ],
      },
    ],
  },
};
