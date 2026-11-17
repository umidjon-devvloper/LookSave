import { describe, expect, it } from 'vitest';

import { dictionaries } from './dictionaries';
import { rejectReasonText } from './rejectReason';

describe('rejectReasonText', () => {
  const en = dictionaries.en;

  it('server kodi o`qiladigan matnga aylanadi', () => {
    expect(rejectReasonText(en, 'out_of_stock')).toBe(en.seller.rejectOutOfStock);
    expect(rejectReasonText(en, 'size_unavailable')).toBe(en.seller.rejectNoSize);
    expect(rejectReasonText(en, 'price_changed')).toBe(en.order.rejectPriceChanged);
    expect(rejectReasonText(en, 'other')).toBe(en.seller.rejectOther);
  });

  it('sotuvchi izohi saqlanadi', () => {
    expect(rejectReasonText(en, 'other: closed for the holidays')).toBe(
      `${en.seller.rejectOther}: closed for the holidays`,
    );
  });

  it('«soxta buyurtma» xaridorga aytilmaydi', () => {
    expect(rejectReasonText(en, 'fake_order')).toBe(en.seller.rejectOther);
    expect(rejectReasonText(en, 'fake_order')).not.toContain('fake');
  });

  it('notanish (eski, erkin) matn o`z holicha qoladi', () => {
    expect(rejectReasonText(en, 'Mahsulot qolmadi')).toBe('Mahsulot qolmadi');
  });
});
