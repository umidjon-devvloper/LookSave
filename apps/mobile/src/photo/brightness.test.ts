import { describe, expect, it } from 'vitest';

import { MIN_BRIGHTNESS } from './faceQuality';

/**
 * ⚠️ NEGA BU TEST BOR. Chegara qiymati o'ylab topilgan emas — u
 * bazadagi HAQIQIY selfilardan o'lchangan:
 *
 *   ishlagan selfi      30/255  (faqat `normalise()` dan keyin tanildi)
 *   ishlamagan selfi     3/255  (deyarli qora, yuz umuman yo'q)
 *
 * Chegara ikkalasidan yuqori: 45 dan past surat serverda ham qiynaladi.
 * Kimdir uni «juda qattiq» deb pasaytirsa, jim yo'qotish qaytadi —
 * surat yuklanadi, `face_morphs` bo'sh qoladi, sabab ko'rinmaydi.
 *
 * Yorqinlik hisobining o'zi `averageBrightness` ichida va u fayl tizimi
 * bilan ishlaydi, shuning uchun bu yerda faqat chegara qulflanadi.
 */
describe('yuz skaneri yorug`lik chegarasi', () => {
  it('ishlamagan selfidan (3/255) YUQORI', () => {
    expect(MIN_BRIGHTNESS).toBeGreaterThan(3);
  });

  it('zo`rg`a ishlagan selfidan (30/255) ham yuqori', () => {
    expect(MIN_BRIGHTNESS).toBeGreaterThan(30);
  });

  it('oddiy xona yorug`ligini rad etmaydi', () => {
    /*
     * Ichki yorug'likdagi selfi odatda 60…120 oralig'ida bo'ladi.
     * Chegara 60 dan oshsa, normal sharoitda ham skaner ishlamay
     * qolardi — foydalanuvchi sababsiz rad javobini olardi.
     */
    expect(MIN_BRIGHTNESS).toBeLessThan(60);
  });
});
