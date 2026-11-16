import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Yuz almashtirish — natijani TO'G'RI E'LON QILISH.
 *
 * ⚠️ BU SINOVLAR NIMANI QO'RIQLAYDI. 2026-11-11 gacha bu modul har qanday
 * nosozlikda jimgina asl rasmni qaytarardi: fly.io mashinasi xotira tugab
 * qayta ishga tushganda (502) mijozga AI chizgan begona yuz ketardi va
 * buni hech narsa ko'rsatmasdi. Bu yerda uch narsa tekshiriladi:
 * vaqtinchalik nosozlikda qayta urinish, «almashmadi» signalini o'qish va
 * muvaffaqiyatsizlikni `face` maydonida ochiq qaytarish.
 */

const settings = vi.hoisted(() => ({
  FACEFUSION_URL: 'https://swap.test',
  FACEFUSION_TOKEN: '',
  FACEFUSION_MODEL: 'inswapper_128',
  FACEFUSION_PIXEL_BOOST: '512x512',
  FACEFUSION_ENHANCE: true,
  FACEFUSION_FRONT_ONLY: true,
}));

/*
 * Qolgan sozlamalar HAQIQIY (`loadEnv`) — logger va boshqa modullar ularni
 * import paytida o'qiydi. Faqat facefusion maydonlari almashtiriladi.
 */
vi.mock('../config/env', async (original) => {
  const actual = await original<typeof import('../config/env')>();
  const base = actual.loadEnv();
  return { ...actual, env: () => ({ ...base, ...settings }) };
});

import { faceSwap, swapAndCutout } from './facefusion';

const FACE_URL = 'https://cdn.test/face.jpg';
const NO_WAIT = { retryDelaysMs: [0, 0] };

const bytes = (fill: number, size = 4096): Buffer => Buffer.alloc(size, fill);

function image(body: Buffer, type: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status: 200, headers: { 'content-type': type, ...headers } });
}

function failure(status: number, detail = 'x'): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface Script {
  face?: () => Response;
  swap?: Array<() => Response | Promise<Response>>;
  swapOnly?: Array<() => Response | Promise<Response>>;
  cutout?: () => Response;
}

/** `fetch` ni manzilga qarab javob beradigan qilib almashtiradi va chaqiruvlarni sanaydi. */
function script(plan: Script) {
  const calls = { face: 0, swap: 0, swapOnly: 0, cutout: 0, headers: [] as unknown[] };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === FACE_URL) {
        calls.face += 1;
        return (plan.face ?? (() => image(bytes(1), 'image/jpeg')))();
      }

      calls.headers.push(init?.headers);

      if (url.endsWith('/swap-and-cutout')) {
        const step = plan.swap?.[calls.swap] ?? plan.swap?.at(-1);
        calls.swap += 1;
        if (!step) throw new Error('kutilmagan /swap-and-cutout');
        return step();
      }

      if (url.endsWith('/swap')) {
        const step = plan.swapOnly?.[calls.swapOnly] ?? plan.swapOnly?.at(-1);
        calls.swapOnly += 1;
        if (!step) throw new Error('kutilmagan /swap');
        return step();
      }

      if (url.endsWith('/cutout')) {
        calls.cutout += 1;
        return (plan.cutout ?? (() => failure(503)))();
      }

      throw new Error(`kutilmagan manzil: ${url}`);
    }),
  );

  return calls;
}

const target = bytes(9);
const input = { target, sourceFaceUrl: FACE_URL, angle: 'front' as const };

beforeEach(() => {
  settings.FACEFUSION_URL = 'https://swap.test';
  settings.FACEFUSION_TOKEN = '';
  settings.FACEFUSION_FRONT_ONLY = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('swapAndCutout — muvaffaqiyat', () => {
  it('yuz almashdi va rasm shaffof PNG', async () => {
    const result = bytes(7);
    const calls = script({
      swap: [() => image(result, 'image/png', { 'x-face-swap': 'done', 'x-cutout': 'alpha' })],
    });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('swapped');
    expect(out.transparent).toBe(true);
    expect(out.image.equals(result)).toBe(true);
    expect(calls).toMatchObject({ face: 1, swap: 1, cutout: 0 });
  });

  it('eski xizmat sarlavha yubormaydi — avvalgidek «almashdi» deb olinadi', async () => {
    script({ swap: [() => image(bytes(7), 'image/png')] });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('swapped');
    expect(out.transparent).toBe(true);
  });

  it('kesim yiqilgan bo`lsa rasm shaffof EMAS — alohida kesim kerak', async () => {
    script({
      swap: [() => image(bytes(7), 'image/jpeg', { 'x-face-swap': 'done', 'x-cutout': 'failed' })],
    });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('swapped');
    expect(out.transparent).toBe(false);
  });

  it('token bo`lsa Bearer bilan yuboriladi', async () => {
    settings.FACEFUSION_TOKEN = 'sir';
    const calls = script({ swap: [() => image(bytes(7), 'image/png')] });

    await swapAndCutout(input, NO_WAIT);

    expect(calls.headers[0]).toEqual({ Authorization: 'Bearer sir' });
  });
});

describe('swapAndCutout — xizmat rasmda yuz topmadi', () => {
  it('`X-Face-Swap: none` — «almashmadi» deb qaytadi, jim o`tib ketmaydi', async () => {
    const calls = script({
      swap: [() => image(bytes(7), 'image/png', { 'x-face-swap': 'none', 'x-cutout': 'alpha' })],
    });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('unchanged');
    expect(out.reason).toMatch(/yuz topilmadi/);
    // Qayta urinilmaydi: xizmat ishladi, natija o'zgarmaydi
    expect(calls.swap).toBe(1);
  });
});

describe('swapAndCutout — xizmatda almashtirish o`chirilgan', () => {
  it('`X-Face-Swap: off` — `skipped`: kesilgan rasm olinadi, xato deb hisoblanmaydi', async () => {
    const cut = bytes(7);
    const calls = script({
      swap: [() => image(cut, 'image/png', { 'x-face-swap': 'off', 'x-cutout': 'model' })],
    });

    const out = await swapAndCutout(input, NO_WAIT);

    // `unchanged` bo'lsa har rasm «begona yuz ketdi» deb operatorga xabar qilinardi
    expect(out.face).toBe('skipped');
    expect(out.reason).toBeUndefined();
    expect(out.transparent).toBe(true);
    expect(out.image.equals(cut)).toBe(true);
    expect(calls).toMatchObject({ swap: 1, cutout: 0 });
  });
});

describe('swapAndCutout — vaqtinchalik nosozlik', () => {
  /*
   * ⚠️ AYNAN SHU HOL (2026-11-11): mashina xotira tugab o'ldirildi, o'sha
   * paytdagi so'rov 502 oldi, bir daqiqadan keyin xizmat yana ishladi.
   */
  it('502 dan keyin qayta urinadi va almashtiradi', async () => {
    const calls = script({
      swap: [() => failure(502), () => image(bytes(7), 'image/png', { 'x-face-swap': 'done' })],
    });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('swapped');
    expect(calls.swap).toBe(2);
    expect(calls.cutout).toBe(0);
  });

  it('tarmoq uzilishi ham vaqtinchalik', async () => {
    const calls = script({
      swap: [
        () => {
          throw new Error('socket hang up');
        },
        () => failure(503),
        () => image(bytes(7), 'image/png', { 'x-face-swap': 'done' }),
      ],
    });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('swapped');
    expect(calls.swap).toBe(3);
  });

  it('hamma urinish yiqilsa — `failed`, va asl rasmning kesimi qaytadi', async () => {
    const cut = bytes(5);
    const calls = script({ swap: [() => failure(503)], cutout: () => image(cut, 'image/png') });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('failed');
    expect(out.reason).toMatch(/503/);
    expect(out.image.equals(cut)).toBe(true);
    expect(out.transparent).toBe(true);
    expect(calls.swap).toBe(3);
  });

  it('kesim ham yiqilsa — asl rasmning O`ZI qaytadi', async () => {
    script({ swap: [() => failure(503)], cutout: () => failure(503) });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('failed');
    expect(out.image).toBe(target);
    expect(out.transparent).toBe(false);
  });
});

describe('swapAndCutout — tuzalmaydigan xato', () => {
  it('422 (yuz suratida yuz yo`q) qayta urinilmaydi', async () => {
    const calls = script({
      swap: [() => failure(422, 'no_source_face')],
      cutout: () => image(bytes(5), 'image/png'),
    });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('failed');
    expect(out.reason).toMatch(/qayta skaner/);
    expect(calls.swap).toBe(1);
  });

  it('yuz surati yuklanmasa xizmat umuman chaqirilmaydi', async () => {
    const calls = script({ face: () => failure(404), cutout: () => failure(503) });

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out.face).toBe('failed');
    expect(out.reason).toMatch(/yuklab olinmadi/);
    expect(calls.swap).toBe(0);
  });

  it('sozlanmagan bo`lsa tarmoqqa chiqilmaydi', async () => {
    settings.FACEFUSION_URL = '';
    const calls = script({});

    const out = await swapAndCutout(input, NO_WAIT);

    expect(out).toMatchObject({ face: 'failed', transparent: false });
    expect(out.image).toBe(target);
    expect(calls).toMatchObject({ face: 0, swap: 0, cutout: 0 });
  });
});

describe('swapAndCutout — yon va orqa', () => {
  it('yuz almashtirilmaydi (`skipped`), faqat kesim', async () => {
    const cut = bytes(5);
    const calls = script({ cutout: () => image(cut, 'image/png') });

    const out = await swapAndCutout({ ...input, angle: 'side' }, NO_WAIT);

    expect(out.face).toBe('skipped');
    expect(out.image.equals(cut)).toBe(true);
    expect(calls).toMatchObject({ face: 0, swap: 0, cutout: 1 });
  });
});

describe('faceSwap — server o`zi yasagan natija', () => {
  async function pictures() {
    // Chap yarmi shaffof, o'ng yarmi ko'rinadigan 64×96 rasm
    const alpha = Buffer.alloc(64 * 96);
    for (let y = 0; y < 96; y += 1) alpha.fill(255, y * 64 + 32, y * 64 + 64);

    const rgba = await sharp({
      create: { width: 64, height: 96, channels: 3, background: { r: 200, g: 40, b: 40 } },
    })
      .joinChannel(alpha, { raw: { width: 64, height: 96, channels: 1 } })
      .png()
      .toBuffer();

    const swapped = await sharp({
      create: { width: 64, height: 96, channels: 3, background: { r: 20, g: 180, b: 60 } },
    })
      .jpeg()
      .toBuffer();

    // Juda kichik javob «rasm emas» deb rad etiladi — sinov rasmi undan katta bo'lsin
    return { rgba, swapped: Buffer.concat([swapped, Buffer.alloc(2048)]) };
  }

  it('almashgan rasmga ASL shaffoflik qaytariladi', async () => {
    const { rgba, swapped } = await pictures();
    script({ swapOnly: [() => image(swapped, 'image/jpeg', { 'x-face-swap': 'done' })] });

    const out = await faceSwap({ ...input, target: rgba }, NO_WAIT);

    const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => {
      const i = (y * info.width + x) * 4;
      return { g: data[i + 1], a: data[i + 3] };
    };

    expect(info).toMatchObject({ width: 64, height: 96, channels: 4 });
    expect(at(8, 48).a).toBe(0);
    expect(at(56, 48).a).toBe(255);
    // Rang yangi (yashil) rasmdan
    expect(at(56, 48).g).toBeGreaterThan(150);
  });

  it('xizmat yuz topmasa asl rasm qaytadi', async () => {
    const { rgba, swapped } = await pictures();
    script({ swapOnly: [() => image(swapped, 'image/jpeg', { 'x-face-swap': 'none' })] });

    expect(await faceSwap({ ...input, target: rgba }, NO_WAIT)).toBe(rgba);
  });

  it('xizmatda almashtirish o`chirilgan bo`lsa asl rasmning O`ZI qaytadi', async () => {
    const { rgba, swapped } = await pictures();
    script({ swapOnly: [() => image(swapped, 'image/jpeg', { 'x-face-swap': 'off' })] });

    expect(await faceSwap({ ...input, target: rgba }, NO_WAIT)).toBe(rgba);
  });

  it('vaqtinchalik nosozlikda qayta urinadi', async () => {
    const { rgba, swapped } = await pictures();
    const calls = script({
      swapOnly: [() => failure(502), () => image(swapped, 'image/jpeg', { 'x-face-swap': 'done' })],
    });

    const out = await faceSwap({ ...input, target: rgba }, NO_WAIT);

    expect(out).not.toBe(rgba);
    expect(calls.swapOnly).toBe(2);
  });

  it('hamma urinish yiqilsa asl rasm qaytadi', async () => {
    const { rgba } = await pictures();
    const calls = script({ swapOnly: [() => failure(503)] });

    expect(await faceSwap({ ...input, target: rgba }, NO_WAIT)).toBe(rgba);
    expect(calls.swapOnly).toBe(3);
  });
});
