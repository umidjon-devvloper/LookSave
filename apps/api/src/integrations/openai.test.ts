import { describe, expect, it } from 'vitest';

import { buildPrompt, garmentKindForSlot } from './openai';

/**
 * OpenAI kiyintirish sinovlari.
 *
 * ⚠️ NEGA PROMPT SINALADI. `gpt-image-1` — umumiy rasm generatori: erkin
 * qo'yilsa u odamning yuzini ham qayta chizadi va foydalanuvchi kadrda
 * O'ZINI EMAS, boshqa odamni ko'radi. Buni to'sadigan yagona narsa —
 * promptdagi cheklovlar. Ular kod ko'rinishida emas, matn ichida, ya'ni
 * tasodifan o'chirilsa hech qayerda xato chiqmaydi: na tip tekshiruvi,
 * na lint sezadi. Sinov o'sha jim yo'qotishni ushlaydi.
 */

describe('slot -> kiyim turi', () => {
  it('ustki kiyimlar `tops` ga tushadi', () => {
    expect(garmentKindForSlot('top')).toBe('tops');
    expect(garmentKindForSlot('outer')).toBe('tops');
  });

  it('pastki kiyim `bottoms`, ko`ylak `one-pieces`', () => {
    expect(garmentKindForSlot('bottom')).toBe('bottoms');
    expect(garmentKindForSlot('dress')).toBe('one-pieces');
  });

  it('noma`lum slot modelga o`zi hal qilishga qoldiriladi', () => {
    expect(garmentKindForSlot('shoes')).toBe('auto');
    expect(garmentKindForSlot('')).toBe('auto');
  });
});

describe('prompt cheklovlari', () => {
  const prompt = buildPrompt('tops');

  it('yuz va tanani o`zgartirishni taqiqlaydi', () => {
    expect(prompt).toMatch(/face/i);
    expect(prompt).toMatch(/unchanged/i);
    expect(prompt).toMatch(/body proportions/i);
  });

  it('poza, yorug`lik va fonni saqlashni talab qiladi', () => {
    expect(prompt).toMatch(/same pose, lighting and background/i);
  });

  it('kiyimni aniq takrorlashni talab qiladi', () => {
    /*
     * Bu jumla eng muhimi: usiz model kiyimni «shunga o'xshash» qilib
     * qayta chizadi va foydalanuvchi buyurtma qilgan mahsulot bilan
     * ko'rgani mos kelmaydi.
     */
    expect(prompt).toMatch(/colour, pattern and shape as accurately as possible/i);
  });

  it('bosma manbasi berilganda uni AYNAN takrorlashni talab qiladi', () => {
    /*
     * Uchta jumla ham kerak: model bosmani «qayta chizishga» moyil va
     * bittasi yetmasligi o'lchandi. Biri o'chirilsa ikonkalar joyi
     * almashib ketadi — ekranda esa bu «shunchaki boshqacha» bo'lib
     * ko'rinadi, xato sifatida emas.
     */
    const withPrint = buildPrompt('tops', { print: true });
    expect(withPrint).toMatch(/copy that artwork EXACTLY/i);
    expect(withPrint).toMatch(/do not redraw/i);
    expect(withPrint).toMatch(/do not rearrange/i);
  });

  it('rasm raqamlari biriktirilganlarga qarab suriladi', () => {
    /*
     * ⚠️ ENG NOZIK JOY. Prompt rasmlarni «third/fourth» deb ataydi va bu
     * `image[]` tartibiga mos kelishi shart. Yuz bo'lmasa bosma
     * UCHINCHI bo'lib qoladi — raqam qotirib qo'yilsa model noto'g'ri
     * rasmga qarardi va buni ekranda payqash deyarli imkonsiz.
     */
    const onlyPrint = buildPrompt('tops', { print: true });
    expect(onlyPrint).toMatch(/third image is a close-up of the exact artwork/i);

    const both = buildPrompt('tops', { face: true, print: true });
    expect(both).toMatch(/third image is a close-up reference of the same person/i);
    expect(both).toMatch(/fourth image is a close-up of the exact artwork/i);
  });

  it('kiyim turini kadrdagi joyiga bog`laydi', () => {
    expect(buildPrompt('tops')).toMatch(/upper-body/i);
    expect(buildPrompt('bottoms')).toMatch(/lower-body/i);
    expect(buildPrompt('one-pieces')).toMatch(/full-body/i);
  });
});
