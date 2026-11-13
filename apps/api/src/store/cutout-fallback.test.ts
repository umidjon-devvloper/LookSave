import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as EnvModule from '../config/env';

/**
 * Kesim — ZAXIRA yo'l (kesim xizmati javob bermaganda shu serverdagi model).
 *
 * ⚠️ BU SINOVLAR NIMANI QO'RIQLAYDI. 2026-11-13 da prod'da kesim xizmati
 * qayta ishga tushayotgan paytda yasalgan kesim YO'L-YO'L chiqdi (har uch
 * qatordan ikkitasi shaffof, figura o'rnida fon), ranglari esa 256 taga
 * tushib qolgan edi. Uch nuqson birga ishlagan:
 *
 *  1. silliqlangan alfa uch kanalli bo'lib qaytar, kod uni bitta kanal deb
 *     o'qirdi — maska uch barobar cho'zilib, satrlarga sochilardi;
 *  2. kutubxonadan PNG so'ralardi — u palitrali (256 rang) qilib kodlaydi;
 *  3. rasmning o'z alfasi tashlanardi — shaffof joy ostidagi rang chiqardi.
 *
 * Zaxira yo'l kam ishlaydi (faqat xizmat yiqilganda), shuning uchun u
 * buzilsa hech kim sezmaydi — bu nuqson to'rt kun ko'rinmay yurgan.
 */

const settings = vi.hoisted(() => ({
  FACEFUSION_URL: '',
  FACEFUSION_TOKEN: '',
  CUTOUT_URL: '',
}));

vi.mock('../config/env', async (original) => {
  const actual = await original<typeof EnvModule>();
  const base = actual.loadEnv();
  return { ...actual, env: () => ({ ...base, ...settings }) };
});

vi.mock('@imgly/background-removal-node', () => ({ removeBackground: vi.fn() }));
vi.mock('../integrations/r2', () => ({ uploadObject: vi.fn(async () => 'https://cdn/x.png') }));

import { removeBackground } from '@imgly/background-removal-node';

import { uploadObject } from '../integrations/r2';

import { makeCutout } from './cutout';

const SOURCE = 'https://cdn/result.png';
const SERVICE = 'https://cutout.test';

type Mask = (x: number, y: number) => number;

/** Rasm manzili — berilgan surat; kesim xizmati — `service` nima desa o'sha. */
function serve(image: Buffer, service?: () => Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: unknown) => {
    if (String(input).startsWith(SERVICE)) {
      return service ? service() : new Response('yiqilgan', { status: 502 });
    }
    return new Response(image, { headers: { 'content-type': 'image/png' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Kutubxonaning xom RGBA shartnomasi (`image/x-rgba8;width=…;height=…`):
 * kirgan RGB o'zgarmaydi, alfa esa model maskasi bilan ALMASHTIRILADI.
 */
function modelSays(mask: Mask): void {
  vi.mocked(removeBackground).mockImplementation(async (source) => {
    const blob = source as Blob;
    const [type, ...rest] = blob.type.split(';');
    const params = Object.fromEntries(rest.map((part) => part.split('=')));
    const width = Number(params['width']);
    const height = Number(params['height']);

    expect(type).toBe('image/x-rgba8');
    const data = Buffer.from(await blob.arrayBuffer());
    expect(data.length).toBe(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) data[(y * width + x) * 4 + 3] = mask(x, y);
    }
    return new Blob([data], { type: blob.type });
  });
}

interface Pixels {
  data: Buffer;
  width: number;
  height: number;
  palette: boolean;
}

/** R2 ga yuborilgan PNG — ochilgan holda. */
async function uploaded(): Promise<Pixels> {
  const call = vi.mocked(uploadObject).mock.calls[0]?.[0];
  if (!call) throw new Error('hech narsa yuklanmadi');

  expect(call.contentType).toBe('image/png');
  const { data, info } = await sharp(call.body).raw().toBuffer({ resolveWithObject: true });
  expect(info.channels).toBe(4);

  return {
    data,
    width: info.width,
    height: info.height,
    // PNG sarlavhasi (IHDR), 25-bayt — rang turi: 3 = palitra, 6 = to'liq rang + alfa
    palette: call.body[25] === 3,
  };
}

/** Har pikseli boshqa rangdagi, alfasiz surat (studiya fonidagi natija o'rnida). */
async function gradient(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      raw[i] = 40 + x * 2;
      raw[i + 1] = 40 + y * 2;
      raw[i + 2] = 60 + ((x + y) % 64);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

const WIDTH = 96;
const HEIGHT = 72;
/** «Odam» — kadr ichidagi to'rtburchak soha. */
const BOX = { left: 30, right: 66, top: 12, bottom: 60 };
const inBox: Mask = (x, y) =>
  x >= BOX.left && x < BOX.right && y >= BOX.top && y < BOX.bottom ? 255 : 0;

/** Piksel maska chegarasidan necha piksel uzoqda (chekka silliqlanadi — u yer tekshirilmaydi). */
function distanceToEdge(x: number, y: number): number {
  const dx = Math.min(Math.abs(x - BOX.left), Math.abs(x - (BOX.right - 1)));
  const dy = Math.min(Math.abs(y - BOX.top), Math.abs(y - (BOX.bottom - 1)));
  const insideX = x >= BOX.left && x < BOX.right;
  const insideY = y >= BOX.top && y < BOX.bottom;
  if (insideX && insideY) return Math.min(dx, dy);
  if (insideX) return dy;
  if (insideY) return dx;
  return Math.min(dx, dy);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(removeBackground).mockReset();
  settings.FACEFUSION_URL = '';
});

afterEach(() => vi.unstubAllGlobals());

describe('kesim — zaxira model', () => {
  it('maska o`z joyida qoladi — cho`zilmaydi va satrlarga sochilmaydi', async () => {
    serve(await gradient(WIDTH, HEIGHT));
    modelSays(inBox);

    expect(await makeCutout(SOURCE, 'tryon')).toBe('https://cdn/x.png');

    const out = await uploaded();
    expect([out.width, out.height]).toEqual([WIDTH, HEIGHT]);

    const wrong: string[] = [];
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        if (distanceToEdge(x, y) < 3) continue;
        const alpha = out.data[(y * WIDTH + x) * 4 + 3];
        if (alpha !== inBox(x, y)) wrong.push(`(${x},${y})=${alpha}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('xizmat yiqilganda (502) ham kesim to`g`ri chiqadi — 2026-11-13 dagi holat', async () => {
    settings.FACEFUSION_URL = SERVICE;
    const fetchMock = serve(await gradient(WIDTH, HEIGHT));
    modelSays(inBox);

    expect(await makeCutout(SOURCE, 'tryon')).toBe('https://cdn/x.png');
    expect(fetchMock).toHaveBeenCalledTimes(2); // rasm + xizmatga bitta urinish
    expect(removeBackground).toHaveBeenCalledTimes(1);

    const out = await uploaded();
    const row = (y: number): number[] =>
      Array.from({ length: WIDTH }, (_, x) => out.data[(y * WIDTH + x) * 4 + 3]!);

    // Qo'shni satrlar bir xil: yo'l-yo'l kesimda ular navbat bilan bo'sh va to'la edi
    for (let y = BOX.top + 3; y < BOX.bottom - 4; y += 1) {
      expect(row(y + 1)).toEqual(row(y));
    }
    expect(row(HEIGHT >> 1).filter((alpha) => alpha === 255).length).toBeGreaterThan(28);
  });

  it('ranglar to`liq saqlanadi — palitraga (256 rang) tushmaydi', async () => {
    const source = await gradient(WIDTH, HEIGHT);
    serve(source);
    modelSays(() => 255);

    await makeCutout(SOURCE, 'tryon');

    // Kutubxonadan PNG emas, XOM piksel so'raladi: PNG ni u palitrali qilib kodlaydi
    const config = vi.mocked(removeBackground).mock.calls[0]?.[1];
    expect(config?.output?.format).toBe('image/x-rgba8');

    const out = await uploaded();
    expect(out.palette).toBe(false);

    const original = await sharp(source).ensureAlpha().raw().toBuffer();
    expect(out.data.equals(original)).toBe(true);
  });

  it('rasmning o`z alfasi saqlanadi — yashirin piksel kesimda ko`rinmaydi', async () => {
    // Shaffof hoshiya ichida to'la to'rtburchak: «tayyor kesim» emas, modelga boradi
    const panel = await sharp({
      create: { width: 60, height: 48, channels: 4, background: '#202020' },
    })
      .png()
      .toBuffer();
    const padded = await sharp({
      create: {
        width: WIDTH,
        height: HEIGHT,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite([{ input: panel, left: 18, top: 12 }])
      .png()
      .toBuffer();
    serve(padded);
    // Model hoshiyani ham «odam» deydi — yashirin oq rang yuzaga chiqmasligi kerak
    modelSays(() => 255);

    await makeCutout(SOURCE, 'avatar');

    const out = await uploaded();
    const alphaAt = (x: number, y: number): number => out.data[(y * WIDTH + x) * 4 + 3]!;
    expect(alphaAt(4, 4)).toBe(0);
    expect(alphaAt(WIDTH - 5, HEIGHT - 5)).toBe(0);
    expect(alphaAt(48, 36)).toBe(255);
  });

  it('model kutilmagan o`lchamda qaytarsa — kesim yo`q, buzuq rasm yuklanmaydi', async () => {
    serve(await gradient(WIDTH, HEIGHT));
    vi.mocked(removeBackground).mockResolvedValue(new Blob([Buffer.alloc(100)]));

    expect(await makeCutout(SOURCE, 'tryon')).toBeNull();
    expect(uploadObject).not.toHaveBeenCalled();
  });
});

describe('kesim — xizmat asosiy yo`l', () => {
  it('xizmat javob bersa o`sha natija yuklanadi, zaxira model ishlamaydi', async () => {
    settings.FACEFUSION_URL = SERVICE;
    const fromService = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 9, g: 9, b: 9, alpha: 0.5 } },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(fromService.byteLength).toBeGreaterThan(1024);

    const fetchMock = serve(
      await gradient(WIDTH, HEIGHT),
      () => new Response(fromService, { headers: { 'content-type': 'image/png' } }),
    );

    expect(await makeCutout(SOURCE, 'tryon')).toBe('https://cdn/x.png');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${SERVICE}/cutout`);
    expect(removeBackground).not.toHaveBeenCalled();
    expect(vi.mocked(uploadObject).mock.calls[0]?.[0].body.equals(fromService)).toBe(true);
  });
});
