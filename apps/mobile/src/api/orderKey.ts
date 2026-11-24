/**
 * Buyurtma uchun idempotentlik kaliti (`Idempotency-Key`).
 *
 * Server kalitni SO'ROV TANASI bilan birga eslab qoladi
 * (`apps/api/src/http/idempotency.ts`):
 *  - o'sha kalit + o'sha tana  → saqlangan javob qaytariladi (xato bo'lsa — o'sha xato);
 *  - o'sha kalit + boshqa tana → «bu kalit boshqa so'rov uchun ishlatilgan».
 *
 * ⚠️ ILGARI kalit ekran ochilganda BIR MARTA yaratilardi. Server bir marta
 * rad etsa (do'kon faqat olib ketishga ishlaydi, o'lcham tugagan, ism
 * noto'g'ri) — foydalanuvchi nimani tuzatmasin, har urinish yana rad
 * etilardi: tuzatsa tana o'zgargan, tuzatmasa eski xato qaytariladi.
 * Ekrandan chiqib qayta kirmaguncha buyurtma berib bo'lmasdi.
 *
 * Qoida:
 *  - tana o'zgardi                      → yangi kalit;
 *  - server XATO bilan javob berdi      → kalit tashlanadi (buyurtma
 *    yaratilmagan — keyingi urinish toza kalit bilan);
 *  - TARMOQ xatosi (javob kelmadi)      → kalit SAQLANADI: buyurtma
 *    yaratilgan bo'lishi mumkin, o'sha kalit bilan qayta yuborish ikkinchi
 *    buyurtma ochmaydi.
 */
export interface OrderKey {
  key: string;
  /** Kalit qaysi tana uchun berilgan */
  body: string;
}

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Shu tana uchun kalit: avvalgisi mos kelsa o'sha, bo'lmasa yangisi. */
export function orderKeyFor(
  previous: OrderKey | null,
  body: unknown,
  make: () => string = newKey,
): OrderKey {
  const serialized = JSON.stringify(body);
  return previous && previous.body === serialized ? previous : { key: make(), body: serialized };
}

/**
 * Urinish xato bilan tugagach kalitni saqlash kerakmi. Faqat tarmoq xatosida.
 *
 * `ApiError` import qilinmaydi (u React Native modullarini tortadi va bu
 * fayl sof qolishi kerak — testlanadi); `code` maydoni bo'yicha aniqlanadi.
 */
export function keepOrderKeyAfter(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'NETWORK'
  );
}
