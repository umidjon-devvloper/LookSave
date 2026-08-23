import {
  bodyPhotoSchema,
  renderRequestSchema,
  renderStatusQuerySchema,
} from '@looksave/validation';
import { describe, expect, it } from 'vitest';

import { categoryForSlot } from '../integrations/fashn';

const VARIANT = '11111111-1111-1111-1111-111111111111';
const VARIANT_2 = '22222222-2222-2222-2222-222222222222';

/**
 * AI kiyintirish sinovlari.
 *
 * ⚠️ NEGA AYNAN BULAR: bu yo'lda har chaqiruv PUL turadi, shuning uchun
 * sinovlar pulni himoya qiladigan joylarga qaratilgan — toifani to'g'ri
 * tanlash va kiruvchi ma'lumotni chegaralash.
 */

describe('slot -> provayder toifasi', () => {
  it('ustki kiyimlar `tops` ga tushadi', () => {
    expect(categoryForSlot('top')).toBe('tops');
    expect(categoryForSlot('outer')).toBe('tops');
  });

  it('pastki kiyim `bottoms` ga tushadi', () => {
    expect(categoryForSlot('bottom')).toBe('bottoms');
  });

  /*
   * Model faqat kiyim uchun o'qitilgan. Oyoq kiyim, soat va sumka uchun
   * natija ishonchsiz — bu yerda `auto` qaytadi va chaqirish-chaqirmaslik
   * qarori yuqorida qabul qilinadi.
   */
  it('kiyim bo`lmagan slotlar `auto` bo`lib qoladi', () => {
    expect(categoryForSlot('feet')).toBe('auto');
    expect(categoryForSlot('wrist')).toBe('auto');
    expect(categoryForSlot('bag')).toBe('auto');
    expect(categoryForSlot('head')).toBe('auto');
  });

  it('noma`lum slot ham xato bermaydi', () => {
    expect(categoryForSlot('elbow')).toBe('auto');
  });
});

describe('kiyintirish so`rovi sxemasi', () => {
  it('to`g`ri UUID qabul qilinadi', () => {
    expect(renderRequestSchema.safeParse({ variantId: VARIANT }).success).toBe(true);
  });

  it('UUID bo`lmagan qiymat rad etiladi', () => {
    expect(renderRequestSchema.safeParse({ variantId: 'top' }).success).toBe(false);
  });
});

describe('gallereya holati sxemasi', () => {
  it('vergul bilan ajratilgan ro`yxatni massivga aylantiradi', () => {
    const result = renderStatusQuerySchema.parse({ variantIds: `${VARIANT},${VARIANT_2}` });
    expect(result.variantIds).toEqual([VARIANT, VARIANT_2]);
  });

  it('bo`sh qiymatlar tashlab yuboriladi', () => {
    const result = renderStatusQuerySchema.parse({ variantIds: `${VARIANT},,` });
    expect(result.variantIds).toEqual([VARIANT]);
  });

  /*
   * Chegara so'rov hajmini ushlab turadi: 50 tadan ko'p UUID kelsa
   * `IN` ro'yxati va javob keraksiz kattalashadi.
   */
  it('50 tadan ko`p bo`lsa rad etiladi', () => {
    const many = Array.from({ length: 51 }, () => VARIANT).join(',');
    expect(renderStatusQuerySchema.safeParse({ variantIds: many }).success).toBe(false);
  });

  it('UUID bo`lmagan element butun so`rovni rad etadi', () => {
    expect(renderStatusQuerySchema.safeParse({ variantIds: `${VARIANT},salom` }).success).toBe(
      false,
    );
  });
});

describe('surat manzili sxemasi', () => {
  it('to`g`ri manzil qabul qilinadi', () => {
    expect(bodyPhotoSchema.safeParse({ url: 'https://cdn.looksave.app/body/a.jpg' }).success).toBe(
      true,
    );
  });

  it('manzil bo`lmagan matn rad etiladi', () => {
    expect(bodyPhotoSchema.safeParse({ url: 'body/a.jpg' }).success).toBe(false);
  });

  it('haddan tashqari uzun manzil rad etiladi', () => {
    const long = `https://cdn.looksave.app/${'a'.repeat(500)}.jpg`;
    expect(bodyPhotoSchema.safeParse({ url: long }).success).toBe(false);
  });
});
