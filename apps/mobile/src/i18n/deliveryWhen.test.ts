import { describe, expect, it } from 'vitest';

import { deliveryWhenText } from './deliveryWhen';
import { dictionaries } from './dictionaries';

describe('deliveryWhenText', () => {
  const en = dictionaries.en;

  it('serverning o`zbekcha yozuvlari qurilma tiliga o`giriladi', () => {
    expect(deliveryWhenText(en, 'en', 'Bugun')).toBe(en.checkout.today);
    expect(deliveryWhenText(en, 'en', 'Ertaga kun davomida')).toBe(en.checkout.tomorrow);
    expect(deliveryWhenText(en, 'en', 'Tanlangan kun')).toBe(en.checkout.scheduled);
  });

  it('o`zbekcha qurilmada ham lug`atdan olinadi', () => {
    expect(deliveryWhenText(dictionaries.uz, 'uz', 'Bugun')).toBe(dictionaries.uz.checkout.today);
  });

  it('sana kun siljimasdan formatlanadi', () => {
    const text = deliveryWhenText(en, 'en', '2026-11-19');
    expect(text).toContain('19');
    expect(text).toContain('2026');
    expect(text).not.toBe('2026-11-19');
  });

  it('vaqt berilmagan bo`lsa null', () => {
    expect(deliveryWhenText(en, 'en', null)).toBeNull();
    expect(deliveryWhenText(en, 'en', undefined)).toBeNull();
    expect(deliveryWhenText(en, 'en', '')).toBeNull();
  });

  it('notanish qiymat o`z holicha qoladi', () => {
    expect(deliveryWhenText(en, 'en', 'Kechqurun')).toBe('Kechqurun');
  });
});
