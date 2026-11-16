import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { isAvatarSheet, splitAvatarSheet } from './avatar-sheet';

/** Uch rangli sinov varag'i: chap — qizil, o'rta — yashil, o'ng — ko'k. */
async function sheet(width: number, height: number): Promise<Buffer> {
  const third = Math.floor(width / 3);
  const block = (r: number, g: number, b: number, w: number) =>
    sharp({ create: { width: w, height, channels: 4, background: { r, g, b, alpha: 1 } } })
      .png()
      .toBuffer();

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: await block(255, 0, 0, third), left: 0, top: 0 },
      { input: await block(0, 255, 0, third), left: third, top: 0 },
      { input: await block(0, 0, 255, width - third * 2), left: third * 2, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function centerColor(input: Buffer): Promise<[number, number, number]> {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const offset =
    (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
  return [data[offset]!, data[offset + 1]!, data[offset + 2]!];
}

/** WebP yo'qotishli — rang aniq emas, ustun kanalni tekshiramiz. */
function dominant([r, g, b]: [number, number, number]): 'red' | 'green' | 'blue' {
  if (r >= g && r >= b) return 'red';
  return g >= b ? 'green' : 'blue';
}

describe('avatar varag`i', () => {
  it('landshaft — varaq, tik yoki kvadrat — emas', () => {
    expect(isAvatarSheet(1536, 1024)).toBe(true);
    expect(isAvatarSheet(1024, 1536)).toBe(false);
    expect(isAvatarSheet(1024, 1024)).toBe(false);
  });

  it('uch teng bo`lakka old · yon · orqa tartibida ajraladi', async () => {
    const parts = await splitAvatarSheet(await sheet(1536, 1024));
    expect(parts).not.toBeNull();

    expect(dominant(await centerColor(parts!.front))).toBe('red');
    expect(dominant(await centerColor(parts!.side))).toBe('green');
    expect(dominant(await centerColor(parts!.back))).toBe('blue');

    for (const part of Object.values(parts!)) {
      const meta = await sharp(part).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([500, 1000, 'webp']);
    }
  });

  it('shaffof bo`shliq bo`yicha kesadi — figura markazdan siljigan bo`lsa ham', async () => {
    // Shaffof fon; figuralar teng bo'lmagan joyda: chap, o'ng-o'rta, o'ng
    const block = (r: number, g: number, b: number, w: number, h: number) =>
      sharp({ create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: 1 } } })
        .png()
        .toBuffer();
    const sheet = await sharp({
      create: { width: 900, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: await block(255, 0, 0, 100, 260), left: 20, top: 20 },
        { input: await block(0, 255, 0, 170, 260), left: 350, top: 20 },
        { input: await block(0, 0, 255, 120, 260), left: 700, top: 20 },
      ])
      .png()
      .toBuffer();

    const parts = await splitAvatarSheet(sheet);
    expect(parts).not.toBeNull();
    expect(dominant(await centerColor(parts!.front))).toBe('red');
    expect(dominant(await centerColor(parts!.side))).toBe('green');
    expect(dominant(await centerColor(parts!.back))).toBe('blue');

    // ⚠️ Shaffof fon WebP'da SAQLANADI — orqa fon bo'lmasligi shart
    for (const part of Object.values(parts!)) {
      const meta = await sharp(part).metadata();
      expect([meta.format, meta.hasAlpha]).toEqual(['webp', true]);
    }
  });

  it('kenglik 3 ga bo`linmasa ham bo`laklar teng', async () => {
    const parts = await splitAvatarSheet(await sheet(1537, 1024));
    const widths = await Promise.all(
      Object.values(parts!).map(async (part) => (await sharp(part).metadata()).width ?? 0),
    );
    // Qoldiq piksel oxirgi bo'lakka qo'shiladi — farq ko'pi bilan 1 px
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  });

  it('bitta pozali tik rasm ajratilmaydi — eski oqim o`zgarmaydi', async () => {
    const tall = await sharp({
      create: { width: 1024, height: 1536, channels: 4, background: '#888' },
    })
      .png()
      .toBuffer();
    expect(await splitAvatarSheet(tall)).toBeNull();
  });
});
