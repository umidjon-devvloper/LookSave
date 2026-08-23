import { describe, expect, it } from 'vitest';

import { buildAvatarPrompt, missingForAvatar } from './avatar-prompt';

/**
 * Tavsif sinovlari.
 *
 * ⚠️ NEGA MUHIM: `model-create` da o'lcham boshqaruvi yo'q — bo'y, gavda
 * va poza FAQAT shu matn orqali beriladi. Tavsifdagi xato to'g'ridan-to'g'ri
 * yaroqsiz avatarga aylanadi va u pul turadi.
 */

describe('avatar tavsifi', () => {
  it('bo`y va jinsni tavsifga kiritadi', () => {
    const prompt = buildAvatarPrompt('male', { height: 180, weight: 78 });
    expect(prompt).toContain('180 cm tall');
    expect(prompt).toContain('man');
  });

  it('ayol uchun boshqa asosiy kiyim beradi', () => {
    const female = buildAvatarPrompt('female', { height: 165, weight: 58 });
    const male = buildAvatarPrompt('male', { height: 165, weight: 58 });
    expect(female).toContain('leggings');
    expect(male).toContain('shorts');
  });

  it('jins ko`rsatilmasa neytral so`z ishlatiladi', () => {
    expect(buildAvatarPrompt(null, { height: 170, weight: 65 })).toContain('person');
  });

  /*
   * Uchta talab kiyintirish modeli uchun majburiy. Ular tushib qolsa
   * natija yaroqsiz bo'ladi, lekin buni faqat qurilmada ko'rish mumkin —
   * shuning uchun sinov bilan qulflanadi.
   */
  it('to`liq gavda talabini yo`qotmaydi', () => {
    const prompt = buildAvatarPrompt('male', { height: 175, weight: 70 });
    expect(prompt).toContain('head to feet');
    expect(prompt).toContain('nothing is cropped');
  });

  it('poza talabini yo`qotmaydi', () => {
    const prompt = buildAvatarPrompt('female', { height: 168, weight: 60 });
    expect(prompt).toContain('arms relaxed at the sides');
  });

  it('sodda fon talabini yo`qotmaydi', () => {
    expect(buildAvatarPrompt('male', { height: 175, weight: 70 })).toContain(
      'Plain light grey seamless studio background',
    );
  });

  it('gavda tuzilishi vaznga qarab o`zgaradi', () => {
    const slim = buildAvatarPrompt('male', { height: 185, weight: 60 });
    const heavy = buildAvatarPrompt('male', { height: 165, weight: 95 });
    expect(slim).toContain('slim');
    expect(heavy).toContain('heavy-set');
  });

  it('o`lchovlar to`liq bo`lsa gavda shakli qo`shiladi', () => {
    const prompt = buildAvatarPrompt('female', {
      height: 168,
      weight: 58,
      chest: 88,
      waist: 66,
      hips: 98,
    });
    expect(prompt).toContain('fuller hips');
  });

  /*
   * To'liq bo'lmagan o'lchovda shakl UMUMAN aytilmaydi: taxminiy tavsif
   * noto'g'ri gavda yasaydi va foydalanuvchi o'zini tanimaydi.
   */
  it('o`lchovlar chala bo`lsa shakl aytilmaydi', () => {
    const prompt = buildAvatarPrompt('female', { height: 168, weight: 58, chest: 88 });
    expect(prompt).not.toContain('hips');
    expect(prompt).not.toContain('broad shoulders');
  });

  it('vazn yo`q bo`lsa ham tavsif tuziladi', () => {
    expect(buildAvatarPrompt('male', { height: 180 })).toContain('average build');
  });
});

describe('yetishmayotgan o`lchov', () => {
  it('bo`y yo`qligini aytadi', () => {
    expect(missingForAvatar({})).toBe("bo'y");
  });

  it('vazn yo`qligini aytadi', () => {
    expect(missingForAvatar({ height: 180 })).toBe('vazn');
  });

  it('ikkalasi bor bo`lsa null', () => {
    expect(missingForAvatar({ height: 180, weight: 75 })).toBeNull();
  });
});
