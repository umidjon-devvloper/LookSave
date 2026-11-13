import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as EnvModule from '../config/env';

/**
 * Kesim — «bu rasm allaqachon kesilganmi?» qoidasi.
 *
 * ⚠️ BU SINOVLAR NIMANI QO'RIQLAYDI. Qoida ikki marta teskari tomonga
 * og'gan va ikkalasida ham mijoz buzuq surat ko'rgan:
 *
 *  • 2026-11-09 gacha «to'rt burchagi shaffof = tayyor» edi — varaqdan
 *    qirqilgan panel (figura ortida QORA fon) ham o'tib ketar, ekranda
 *    qora to'rtburchak chiqardi;
 *  • shundan keyin yorliq butunlay olib tashlandi — tayyor kesim ham modelga
 *    ketdi: xizmatga ikki barobar yuk, xizmat yiqilganda esa zaxira model
 *    aniq alfani o'z taxminiga almashtirardi (2026-11-13, prod).
 *
 * To'g'ri javob o'rtada: haqiqiy kesim o'tadi, qora fonli panel o'tmaydi.
 */

const settings = vi.hoisted(() => ({
  FACEFUSION_URL: '',
  FACEFUSION_TOKEN: '',
  CUTOUT_URL: '',
}));

/*
 * Qolgan sozlamalar HAQIQIY (`loadEnv`) — logger ularni import paytida
 * o'qiydi. Faqat kesim xizmatining manzili almashtiriladi.
 */
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

const SOURCE = 'https://cdn/a.png';
const SERVICE = 'https://cutout.test';

/** Rasm manzili — berilgan surat; kesim xizmati — chaqirilsa 502 (sanash uchun). */
function serve(image: Buffer): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: unknown) => {
    if (String(input).startsWith(SERVICE)) return new Response('yiqilgan', { status: 502 });
    return new Response(image, { headers: { 'content-type': 'image/png' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Kutubxonaning xom RGBA shartnomasi: kirgan RGB o'zgarmaydi, alfa esa
 * model «taxmini» bilan almashadi (bu yerda — hamma joy odam).
 */
function modelKeepsEverything(): void {
  vi.mocked(removeBackground).mockImplementation(async (source) => {
    const blob = source as Blob;
    const data = Buffer.from(await blob.arrayBuffer());
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    return new Blob([data], { type: blob.type });
  });
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Shaffof fonda odam silueti (ellips) — haqiqiy kesim shunday ko'rinadi. */
async function silhouette(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200">
    <ellipse cx="50" cy="100" rx="22" ry="84" fill="#335577"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Varaqdan qirqilgan panel: figura QORA fonda, atrofi shaffof hoshiya. */
async function blackPanel(): Promise<Buffer> {
  const figure = await sharp({
    create: { width: 20, height: 100, channels: 4, background: '#c8a080' },
  })
    .png()
    .toBuffer();
  const panel = await sharp({
    create: { width: 60, height: 150, channels: 4, background: '#000000' },
  })
    .composite([{ input: figure, left: 20, top: 25 }])
    .png()
    .toBuffer();

  return sharp({ create: { width: 100, height: 200, channels: 4, background: TRANSPARENT } })
    .composite([{ input: panel, left: 20, top: 25 }])
    .png()
    .toBuffer();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(removeBackground).mockReset();
  settings.FACEFUSION_URL = '';
});

afterEach(() => vi.unstubAllGlobals());

describe('kesim — tayyor kesim qayta kesilmaydi', () => {
  it('fon allaqachon shaffof — model chaqirilmaydi, asl havola qaytadi', async () => {
    serve(await silhouette());

    expect(await makeCutout(SOURCE, 'avatar')).toBe(SOURCE);
    expect(removeBackground).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it('kesim xizmati sozlangan bo`lsa ham unga yuborilmaydi', async () => {
    settings.FACEFUSION_URL = SERVICE;
    const fetchMock = serve(await silhouette());

    expect(await makeCutout(SOURCE, 'tryon')).toBe(SOURCE);
    // Yagona so'rov — rasmning o'zini yuklab olish
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(SOURCE);
  });
});

describe('kesim — tayyor bo`lmagan surat modelga boradi', () => {
  it('alfa kanali bor, lekin hamma piksel ko`rinadi (oq fon) — model ishlaydi', async () => {
    const png = await sharp({
      create: { width: 100, height: 200, channels: 4, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    serve(png);
    modelKeepsEverything();

    expect(await makeCutout('https://cdn/b.png', 'avatar')).toBe('https://cdn/x.png');
    expect(removeBackground).toHaveBeenCalledTimes(1);
  });

  it('alfa kanali yo`q (JPEG) — model ishlaydi', async () => {
    const jpeg = await sharp({
      create: { width: 100, height: 200, channels: 3, background: '#d8d8d6' },
    })
      .jpeg()
      .toBuffer();
    serve(jpeg);
    modelKeepsEverything();

    expect(await makeCutout('https://cdn/c.jpg', 'tryon')).toBe('https://cdn/x.png');
    expect(removeBackground).toHaveBeenCalledTimes(1);
  });

  it('burchaklari shaffof, figura ortida qora fon (panel) — tayyor EMAS, model ishlaydi', async () => {
    // 2026-11-09 dagi nosozlik: eski «to'rt burchak» tekshiruvi buni o'tkazib yuborgan
    serve(await blackPanel());
    modelKeepsEverything();

    expect(await makeCutout('https://cdn/d.png', 'avatar')).toBe('https://cdn/x.png');
    expect(removeBackground).toHaveBeenCalledTimes(1);
  });

  it('butunlay shaffof (bo`sh) rasm — tayyor emas', async () => {
    const empty = await sharp({
      create: { width: 100, height: 200, channels: 4, background: TRANSPARENT },
    })
      .png()
      .toBuffer();
    serve(empty);
    modelKeepsEverything();

    expect(await makeCutout('https://cdn/e.png', 'avatar')).toBe('https://cdn/x.png');
    expect(removeBackground).toHaveBeenCalledTimes(1);
  });
});
