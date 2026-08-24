import { describe, expect, it } from 'vitest';

import { hasPrivateBucket, isOwnCdnUrl, isPrivateKey, keyFromCdnUrl, presignRead } from './r2';

/**
 * ⚠️ NEGA AYNAN SHU FUNKSIYA TESTLANADI.
 *
 * `keyFromCdnUrl` — o'chirish zanjiridagi yagona sof mantiq va u jim
 * yiqiladigan turdan: noto'g'ri kalit qaytarsa, R2 hech qanday xato
 * bermaydi (`DeleteObject` yo'q obyekt uchun ham muvaffaqiyat qaytaradi).
 * Ya'ni "yuz suratini o'chirdim" degan tugma ishlagandek ko'rinib,
 * amalda faylni joyida qoldirardi (12-tz.md D-42).
 *
 * Test muhitida `CDN_BASE_URL` berilmagan — `env.ts` dagi standart
 * qiymat (`https://cdn.looksave.app`) ishlatiladi.
 */

const CDN = 'https://cdn.looksave.app';

describe('keyFromCdnUrl', () => {
  it('oddiy havoladan kalit ajratadi', () => {
    expect(keyFromCdnUrl(`${CDN}/avatar/5fb5316c-2e11.jpg`)).toBe('avatar/5fb5316c-2e11.jpg');
  });

  it('ichma-ich papkani saqlaydi', () => {
    expect(keyFromCdnUrl(`${CDN}/models/auto/48023f22-v1.glb`)).toBe('models/auto/48023f22-v1.glb');
  });

  it('so`rov qismini kesadi — kalitda `?` bo`lmaydi', () => {
    expect(keyFromCdnUrl(`${CDN}/avatar/a.jpg?v=2`)).toBe('avatar/a.jpg');
  });

  it('begona domen uchun null — o`zga saytdagi faylni o`chirmaymiz', () => {
    expect(keyFromCdnUrl('https://evil.example.com/avatar/a.jpg')).toBeNull();
  });

  it('CDN manzilining o`zi uchun null — o`chiradigan kalit yo`q', () => {
    expect(keyFromCdnUrl(`${CDN}/`)).toBeNull();
  });

  /*
   * ⚠️ Prefiks o'xshashligi yetarli emas. `cdn.looksave.app.evil.com`
   * satr sifatida bizning manzil bilan boshlanadi, lekin boshqa domen.
   * `isOwnCdnUrl` oxiriga `/` qo'shib solishtiradi — shu tekshiruv
   * bo'lmasa begona havola "o'ziniki" deb qabul qilinardi.
   */
  it('o`xshash domenni o`ziniki deb hisoblamaydi', () => {
    expect(isOwnCdnUrl('https://cdn.looksave.app.evil.com/a.jpg')).toBe(false);
    expect(keyFromCdnUrl('https://cdn.looksave.app.evil.com/a.jpg')).toBeNull();
  });
});

describe('shaxsiy bucket (D-43)', () => {
  it('face va body — shaxsiy prefiks', () => {
    expect(isPrivateKey('face/abc.jpg')).toBe(true);
    expect(isPrivateKey('body/abc.jpg')).toBe(true);
  });

  /*
   * ⚠️ `avatar` ATAYLAB SHAXSIY EMAS. Profil surati foydalanuvchi o'zi
   * ko'rsatish uchun qo'yadigan rasm: u ro'yxatlarda va do'kon panelida
   * ko'rinishi kerak. Uni shaxsiy qilsak, har ko'rsatishda imzo kerak
   * bo'lardi va keshlash foydasi yo'qolardi.
   */
  it('avatar, product, store — shaxsiy emas', () => {
    expect(isPrivateKey('avatar/abc.jpg')).toBe(false);
    expect(isPrivateKey('product/abc.jpg')).toBe(false);
    expect(isPrivateKey('store/abc.jpg')).toBe(false);
  });

  it('prefiksi yo`q kalit shaxsiy emas', () => {
    expect(isPrivateKey('abc.jpg')).toBe(false);
  });

  it('test muhitida shaxsiy bucket sozlanmagan', () => {
    // `vitest.config.ts` da R2_BUCKET_PRIVATE berilmagan — dev holati
    expect(hasPrivateBucket()).toBe(false);
  });

  /*
   * ⚠️ ENG MUHIM TEKSHIRUV. Shaxsiy bucket sozlanmagan bo'lsa
   * `presignRead` havolani O'ZGARISHSIZ qaytarishi shart.
   *
   * Aks holda hozirgi ishlayotgan AI oqimi buzilardi: FASHN havolani
   * ocholmasdi va har chaqiruv bekorga to'lanardi.
   */
  it('shaxsiy bucketsiz havola o`zgarmaydi', async () => {
    const url = `${CDN}/face/abc.jpg`;
    await expect(presignRead(url)).resolves.toBe(url);
  });

  it('bo`sh qiymat null qaytaradi', async () => {
    await expect(presignRead(null)).resolves.toBeNull();
    await expect(presignRead(undefined)).resolves.toBeNull();
  });

  it('begona domen imzolanmaydi — o`zgarishsiz qaytadi', async () => {
    const url = 'https://evil.example.com/face/abc.jpg';
    await expect(presignRead(url)).resolves.toBe(url);
  });
});
