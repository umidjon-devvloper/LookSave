import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { isStripedCutout } from './cutout-damage';

/** Shaffof fonda siluet — sog'lom kesim. */
async function silhouette(width: number, height: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <ellipse cx="${width / 2}" cy="${height * 0.14}" rx="${width * 0.11}" ry="${height * 0.09}" fill="#553322"/>
    <ellipse cx="${width / 2}" cy="${height * 0.6}" rx="${width * 0.24}" ry="${height * 0.38}" fill="#225544"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * 2026-11-13 gacha bo'lgan nuqsonni AYNAN takrorlaydi: silliqlangan alfa
 * uch kanalli bo'lib qaytgan (har qiymat uch marta), kod esa uning boshini
 * bitta kanal deb o'qigan — ya'ni `alfa[i] = asl[i / 3]`.
 */
async function damage(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const broken = Buffer.from(data);

  for (let i = 0; i < pixels; i += 1) {
    const alpha = data[Math.floor(i / 3) * 4 + 3]!;
    broken[i * 4 + 3] = alpha < 40 ? 0 : alpha > 200 ? 255 : alpha;
  }

  return sharp(broken, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

describe('kesim — yo`l-yo`l buzilganini aniqlash', () => {
  it.each([
    [96, 144],
    [100, 200],
    [431, 768],
  ])('buzuq kesim topiladi (%d×%d)', async (width, height) => {
    expect(await isStripedCutout(await damage(await silhouette(width, height)))).toBe(true);
  });

  it.each([
    [96, 144],
    [100, 200],
    [431, 768],
  ])('sog`lom kesim buzuq deb topilmaydi (%d×%d)', async (width, height) => {
    expect(await isStripedCutout(await silhouette(width, height))).toBe(false);
  });

  it('alfasiz surat — buzuq emas', async () => {
    const jpeg = await sharp({
      create: { width: 120, height: 180, channels: 3, background: '#d8d8d6' },
    })
      .jpeg()
      .toBuffer();
    expect(await isStripedCutout(jpeg)).toBe(false);
  });

  it('matoning gorizontal yo`llari alfaga ta`sir qilmaydi — buzuq emas', async () => {
    // Yo'l-yo'l KIYIM: rang satrma-satr almashadi, shaffoflik esa butun
    const { data, info } = await sharp(await silhouette(96, 144))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const i = (y * info.width + x) * 4;
        data[i] = y % 3 === 0 ? 240 : 20;
      }
    }
    const striped = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();
    expect(await isStripedCutout(striped)).toBe(false);
  });

  it('o`qib bo`lmaydigan fayl — buzuq emas (xato tashlanmaydi)', async () => {
    expect(await isStripedCutout(Buffer.from('rasm emas'))).toBe(false);
  });
});
