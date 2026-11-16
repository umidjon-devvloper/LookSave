import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Operator natijasiga mijozning yuzini qo'yish (`face.ts`).
 *
 * Almashtirishning o'zi `integrations/facefusion.test.ts` da sinalgan; bu
 * yerda — uning natijasi bilan nima qilinishi: qachon yangi fayl
 * yoziladi, qachon kelgan manzil qoladi va qaysi holat «odam ko'rishi
 * kerak» deb belgilanadi.
 *
 * ⚠️ BAZA BU YERDA SOXTA. `completeTask` va `submitDress` dagi SQL shartlari
 * bu sinovlar bilan ISBOTLANMAYDI — ular haqiqiy baza bilan tekshiriladi.
 */

const mocks = vi.hoisted(() => ({
  enabled: true,
  swapAndCutout: vi.fn(),
  uploadObject: vi.fn(),
  presignRead: vi.fn(),
  query: vi.fn(),
}));

vi.mock('../integrations/facefusion', () => ({
  isFacefusionEnabled: () => mocks.enabled,
  swapAndCutout: mocks.swapAndCutout,
}));

vi.mock('../integrations/r2', () => ({
  uploadObject: mocks.uploadObject,
  presignRead: mocks.presignRead,
}));

vi.mock('../db/pool', () => ({ pool: { query: mocks.query } }));

import { faceNeedsAttention, faceReference, putCustomerFace } from './face';

const RESULT = 'https://cdn.test/avatar/raw.png';
const FACE = 'https://signed.test/face.jpg';
const raw = Buffer.alloc(4096, 3);

beforeEach(() => {
  mocks.enabled = true;
  mocks.swapAndCutout.mockReset();
  mocks.uploadObject.mockReset().mockImplementation(async ({ key }: { key: string }) => `https://cdn.test/${key}`);
  mocks.presignRead.mockReset().mockImplementation(async (url: string) => `${url}?signed`);
  mocks.query.mockReset();

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(raw, { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('putCustomerFace', () => {
  it('almashgan shaffof rasm YANGI kalit bilan PNG bo`lib yoziladi', async () => {
    const swapped = Buffer.alloc(8192, 7);
    mocks.swapAndCutout.mockResolvedValue({ image: swapped, face: 'swapped', transparent: true });

    const out = await putCustomerFace(RESULT, FACE, 'front');

    expect(out.face).toBe('swapped');
    expect(out.transparent).toBe(true);
    expect(out.url).toMatch(/^https:\/\/cdn\.test\/tryon\/manual\/[0-9a-f-]{36}\.png$/);
    expect(mocks.uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({ body: swapped, contentType: 'image/png' }),
    );
    expect(mocks.swapAndCutout).toHaveBeenCalledWith(
      expect.objectContaining({ sourceFaceUrl: FACE, angle: 'front' }),
    );
  });

  it('kesimi yiqilgan (shaffof emas) natija JPEG bo`lib yoziladi', async () => {
    mocks.swapAndCutout.mockResolvedValue({
      image: Buffer.alloc(8192, 7),
      face: 'swapped',
      transparent: false,
    });

    const out = await putCustomerFace(RESULT, FACE, 'front');

    expect(out.transparent).toBe(false);
    expect(out.url).toMatch(/\.jpg$/);
    expect(mocks.uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
  });

  /*
   * ⚠️ ENG MUHIMI. Xizmat yiqilganda natija baribir qaytadi, lekin holat
   * `failed` — chaqiruvchi buni ko'radi va operatorlarni ogohlantiradi.
   */
  it('xizmat yiqilsa kelgan manzil qoladi va holat `failed`', async () => {
    mocks.swapAndCutout.mockImplementation(async ({ target }: { target: Buffer }) => ({
      image: target,
      face: 'failed',
      transparent: false,
      reason: 'HTTP 503',
    }));

    const out = await putCustomerFace(RESULT, FACE, 'front');

    expect(out).toEqual({ url: RESULT, face: 'failed', transparent: false, reason: 'HTTP 503' });
    expect(mocks.uploadObject).not.toHaveBeenCalled();
    expect(faceNeedsAttention(out.face)).toBe(true);
  });

  it('yuz almashmagan, lekin kesim bor — kesim yoziladi, holat `failed` qoladi', async () => {
    mocks.swapAndCutout.mockResolvedValue({
      image: Buffer.alloc(8192, 5),
      face: 'failed',
      transparent: true,
      reason: 'HTTP 502',
    });

    const out = await putCustomerFace(RESULT, FACE, 'front');

    expect(out.face).toBe('failed');
    expect(out.transparent).toBe(true);
    expect(out.url).not.toBe(RESULT);
  });

  it('yuz surati yo`q bo`lsa xizmat chaqirilmaydi', async () => {
    const out = await putCustomerFace(RESULT, null, 'front');

    expect(out).toMatchObject({ url: RESULT, face: 'no-reference', transparent: false });
    expect(mocks.swapAndCutout).not.toHaveBeenCalled();
  });

  it('facefusion sozlanmagan bo`lsa hech narsa qilinmaydi', async () => {
    mocks.enabled = false;

    const out = await putCustomerFace(RESULT, FACE, 'front');

    expect(out).toEqual({ url: RESULT, face: 'disabled', transparent: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('natija o`qilmasa xato tashlanmaydi — `failed`', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );

    const out = await putCustomerFace(RESULT, FACE, 'front');

    expect(out.face).toBe('failed');
    expect(out.url).toBe(RESULT);
    expect(mocks.swapAndCutout).not.toHaveBeenCalled();
  });

  it('kutilmagan xato ham yutiladi — mijoz rasmsiz qolmasin', async () => {
    mocks.swapAndCutout.mockRejectedValue(new Error('boom'));

    const out = await putCustomerFace(RESULT, FACE, 'front');

    expect(out).toMatchObject({ url: RESULT, face: 'failed', reason: 'boom' });
  });
});

describe('faceNeedsAttention', () => {
  it('begona yuz ketgan holatlar belgilanadi', () => {
    expect(faceNeedsAttention('failed')).toBe(true);
    expect(faceNeedsAttention('unchanged')).toBe(true);
    expect(faceNeedsAttention('no-reference')).toBe(true);
  });

  it('kutilgan holatlar belgilanmaydi', () => {
    expect(faceNeedsAttention('swapped')).toBe(false);
    // Yon/orqa burchakda yuz ko'rinmaydi; sozlanmagan xizmat esa ongli tanlov
    expect(faceNeedsAttention('skipped')).toBe(false);
    expect(faceNeedsAttention('disabled')).toBe(false);
  });
});

describe('faceReference', () => {
  it('yuz surati imzolangan havola bilan qaytadi', async () => {
    mocks.query.mockResolvedValue({
      rows: [{ face_texture_url: 'https://private.test/face.jpg', avatar_image_url: 'https://cdn.test/a.png' }],
    });

    expect(await faceReference('user-1', { avatarFallback: false })).toBe(
      'https://private.test/face.jpg?signed',
    );
  });

  it('yuz surati yo`q: avatar faqat ruxsat berilganda manba bo`ladi', async () => {
    mocks.query.mockResolvedValue({
      rows: [{ face_texture_url: null, avatar_image_url: 'https://cdn.test/a.png' }],
    });

    expect(await faceReference('user-1', { avatarFallback: false })).toBeNull();
    expect(await faceReference('user-1', { avatarFallback: true })).toBe('https://cdn.test/a.png?signed');
  });

  it('profil yo`q bo`lsa `null`', async () => {
    mocks.query.mockResolvedValue({ rows: [] });

    expect(await faceReference('user-1', { avatarFallback: true })).toBeNull();
  });
});
