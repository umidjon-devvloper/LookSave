import { describe, expect, it } from 'vitest';

import { TRAY_LIMIT, tryKey, wearOnly, type TrayItem, type TryRecord } from './lookTray';
import { pastLooks, wearInputs, type PastHistoryItem, type PastRender } from './pastLooks';

function attempt(variantIds: string[], renderId: string, at: number): TryRecord {
  return { key: tryKey(variantIds), variantIds: [...variantIds].sort(), renderId, at };
}

const ready = (name: string, cutout = true): PastRender => ({
  status: 'ready',
  imageUrl: `https://cdn/${name}.jpg`,
  cutoutUrl: cutout ? `https://cdn/${name}.png` : null,
});

/** Server tarixidagi natija */
function past(
  variantIds: string[],
  renderId: string,
  completedAt: string,
  name = renderId,
): PastHistoryItem {
  return { render: { id: renderId, ...ready(name) }, variantIds, completedAt };
}

describe('pastLooks — qurilmadagi urinishlar', () => {
  const newest = attempt(['jacket', 'jeans'], 'r3', 300);
  const middle = attempt(['hoodie'], 'r2', 200);
  const oldest = attempt(['coat', 'jeans'], 'r1', 100);
  const tries = [newest, middle, oldest];

  it('tayyor natijalarni eng yangisidan boshlab beradi', () => {
    const renders = new Map([
      ['r1', ready('one')],
      ['r2', ready('two')],
      ['r3', ready('three')],
    ]);

    const looks = pastLooks(tries, renders, [], null);

    expect(looks.map((look) => look.id)).toEqual(['r3', 'r2', 'r1']);
    expect(looks.map((look) => look.key)).toEqual([newest.key, middle.key, oldest.key]);
    expect(looks.every((look) => !look.current)).toBe(true);
  });

  it('sahnadagi natijani belgilaydi — foydalanuvchi qayerda turganini ko`rsin', () => {
    const renders = new Map([
      ['r2', ready('two')],
      ['r3', ready('three')],
    ]);

    const looks = pastLooks(tries, renders, [], 'r2');

    expect(looks.filter((look) => look.current).map((look) => look.id)).toEqual(['r2']);
  });

  /*
   * ⚠️ Bosilganda aynan shu kiyimlar qayta kiyiladi — to'plam yo'qolsa yoki
   * aralashsa, sahnaga boshqa natija chiqardi.
   */
  it('har natija bilan o`z kiyimlarini qaytaradi', () => {
    const renders = new Map([
      ['r1', ready('one')],
      ['r3', ready('three')],
    ]);

    const [first, second] = pastLooks(tries, renders, [], null);

    expect(first?.variantIds).toEqual(newest.variantIds);
    expect(second?.variantIds).toEqual(oldest.variantIds);
  });

  it('navbatdagi, yiqilgan va javobi kelmagan urinishlarni ko`rsatmaydi', () => {
    const renders = new Map<string, PastRender>([
      ['r3', { status: 'processing', imageUrl: null, cutoutUrl: null }],
      ['r2', { status: 'failed', imageUrl: null, cutoutUrl: null }],
      // r1 — javob hali kelmagan
    ]);

    expect(pastLooks(tries, renders, [], null)).toEqual([]);
  });

  it('«tayyor», lekin surati yo`q yozuvni tashlab ketadi', () => {
    const renders = new Map<string, PastRender>([
      ['r3', { status: 'ready', imageUrl: null, cutoutUrl: null }],
      ['r2', ready('two')],
    ]);

    expect(pastLooks(tries, renders, [], null).map((look) => look.id)).toEqual(['r2']);
  });

  it('shaffof kesim bo`lsa uni oladi, bo`lmasa oddiy suratni', () => {
    const renders = new Map([
      ['r3', ready('three', true)],
      ['r2', ready('two', false)],
    ]);

    const [withCutout, plain] = pastLooks(tries, renders, [], null);

    expect(withCutout).toMatchObject({ image: 'https://cdn/three.png', cutout: true });
    expect(plain).toMatchObject({ image: 'https://cdn/two.jpg', cutout: false });
  });

  /*
   * ⚠️ Qator doimiy: yagona natija sahnada tursa ham u qatordan yo'qolmaydi
   * (egasining talabi — tanlov o'zgarganda qator ko'rinib-yo'qolib turmasin).
   */
  it('yagona natija sahnada tursa ham qatorda qoladi', () => {
    const renders = new Map([['r3', ready('three')]]);

    const looks = pastLooks(tries, renders, [], 'r3');

    expect(looks).toHaveLength(1);
    expect(looks[0]).toMatchObject({ id: 'r3', current: true });
  });

  it('savat bo`shaganda ham natijalar qoladi — hech biri belgilanmagan', () => {
    const renders = new Map([
      ['r1', ready('one')],
      ['r3', ready('three')],
    ]);

    const looks = pastLooks(tries, renders, [], null);

    expect(looks.map((look) => look.id)).toEqual(['r3', 'r1']);
    expect(looks.some((look) => look.current)).toBe(false);
  });

  it('urinish ham, tarix ham yo`q bo`lsa — bo`sh', () => {
    expect(pastLooks([], new Map(), [], null)).toEqual([]);
  });
});

describe('pastLooks — server tarixi bilan', () => {
  it('qurilma hech narsani eslamasa ham tarix ko`rsatiladi (qayta o`rnatish, boshqa telefon)', () => {
    const history = [
      past(['jeans', 'jacket'], 's2', '2026-11-12T10:00:00.000Z'),
      past(['hoodie'], 's1', '2026-11-10T10:00:00.000Z'),
    ];

    const looks = pastLooks([], new Map(), history, null);

    expect(looks.map((look) => look.id)).toEqual(['s2', 's1']);
    expect(looks[0]).toMatchObject({
      key: tryKey(['jacket', 'jeans']),
      variantIds: ['jacket', 'jeans'],
      image: 'https://cdn/s2.png',
      cutout: true,
      at: Date.parse('2026-11-12T10:00:00.000Z'),
    });
  });

  /*
   * ⚠️ Server aynan ilova kuzatadigan yozuvni beradi. Birlashmasa mijoz
   * bitta natijani qatorda ikki marta ko'rardi.
   */
  it('qurilmadagi urinish va tarixdagi natija bitta `id` da birlashadi', () => {
    const tries = [attempt(['jacket', 'jeans'], 'r1', 500)];
    const renders = new Map([['r1', ready('local')]]);
    const history = [past(['jacket', 'jeans'], 'r1', '2026-11-12T10:00:00.000Z', 'server')];

    const looks = pastLooks(tries, renders, history, 'r1');

    expect(looks).toHaveLength(1);
    // Surat — qurilmadagi javobdan (yangiroq), vaqt — serverdan
    expect(looks[0]).toMatchObject({
      id: 'r1',
      image: 'https://cdn/local.png',
      current: true,
      at: Date.parse('2026-11-12T10:00:00.000Z'),
    });
  });

  /*
   * ⚠️ Tarixdagi natija bosilganda qurilma uni eslab qoladi va urinish
   * vaqti yangilanadi. Tartib qurilma vaqtiga bog'lansa, bosilgan surat
   * qator boshiga sakrardi.
   */
  it('server bilgan natija bosilgandan keyin ham o`z joyida turadi', () => {
    const history = [
      past(['coat'], 's3', '2026-11-12T10:00:00.000Z'),
      past(['hoodie'], 's2', '2026-11-11T10:00:00.000Z'),
      past(['jeans'], 's1', '2026-11-10T10:00:00.000Z'),
    ];
    const before = pastLooks([], new Map(), history, null).map((look) => look.id);

    // `s1` bosildi: qurilma uni hozirgi vaqt bilan eslab qoldi
    const tapped = [attempt(['jeans'], 's1', Date.parse('2026-11-13T09:00:00.000Z'))];
    const after = pastLooks(tapped, new Map([['s1', ready('s1')]]), history, 's1');

    expect(after.map((look) => look.id)).toEqual(before);
    expect(after.find((look) => look.current)?.id).toBe('s1');
  });

  it('tarixda hali yo`q yangi natija qurilmadan olinadi va vaqti bo`yicha joylashadi', () => {
    const fresh = attempt(['shirt'], 'r9', Date.parse('2026-11-13T09:00:00.000Z'));
    const history = [past(['hoodie'], 's1', '2026-11-10T10:00:00.000Z')];

    const looks = pastLooks([fresh], new Map([['r9', ready('nine')]]), history, null);

    expect(looks.map((look) => look.id)).toEqual(['r9', 's1']);
  });

  /*
   * ⚠️ Belgi — to'plam emas, YOZUV bo'yicha. Mijoz suratini almashtirib
   * o'sha kiyimlarni qayta kiyib ko'rgan bo'lsa, ikkala surat ham turadi;
   * to'plam bo'yicha belgilansa ikkalasi birdan «sahnada» bo'lib qolardi.
   */
  it('bir xil to`plamning ikki natijasi ikkalasi ham turadi — faqat sahnadagisi belgilanadi', () => {
    const history = [
      past(['jacket', 'jeans'], 'new', '2026-11-12T10:00:00.000Z'),
      past(['jacket', 'jeans'], 'old', '2026-10-01T10:00:00.000Z'),
    ];

    const looks = pastLooks([], new Map(), history, 'old');

    expect(looks.map((look) => [look.id, look.current])).toEqual([
      ['new', false],
      ['old', true],
    ]);
    expect(new Set(looks.map((look) => look.key)).size).toBe(1);
  });

  it('qurilmadagi urinish hali navbatda bo`lsa, tarixdagi tayyor natija baribir ko`rsatiladi', () => {
    const waiting = attempt(['jacket', 'jeans'], 'r5', 900);
    const renders = new Map<string, PastRender>([
      ['r5', { status: 'pending', imageUrl: null, cutoutUrl: null }],
    ]);
    const history = [past(['jacket', 'jeans'], 'old', '2026-10-01T10:00:00.000Z')];

    const looks = pastLooks([waiting], renders, history, null);

    expect(looks.map((look) => look.id)).toEqual(['old']);
    expect(looks[0]?.current).toBe(false);
  });

  it('tarixdagi buzuq yozuvlarni tashlab ketadi', () => {
    const history: PastHistoryItem[] = [
      {
        render: { id: 'x1', status: 'ready', imageUrl: null, cutoutUrl: null },
        variantIds: ['a'],
        completedAt: '2026-11-12T10:00:00.000Z',
      },
      {
        render: { id: 'x2', ...ready('x2') },
        variantIds: [],
        completedAt: '2026-11-12T10:00:00.000Z',
      },
      {
        render: { id: 'x3', status: 'failed', imageUrl: 'https://cdn/x3.jpg', cutoutUrl: null },
        variantIds: ['a'],
        completedAt: '2026-11-12T10:00:00.000Z',
      },
      past(['hoodie'], 'ok', '2026-11-10T10:00:00.000Z'),
    ];

    expect(pastLooks([], new Map(), history, null).map((look) => look.id)).toEqual(['ok']);
  });

  it('vaqti o`qilmaydigan natija ham ko`rsatiladi — oxirida', () => {
    const history = [
      past(['coat'], 'bad', 'kecha'),
      past(['hoodie'], 'ok', '2026-11-10T10:00:00.000Z'),
    ];

    const looks = pastLooks([], new Map(), history, null);

    expect(looks.map((look) => look.id)).toEqual(['ok', 'bad']);
    expect(looks[1]?.at).toBe(0);
  });

  it('kiyimlar tartibsiz kelsa ham to`plam kaliti bir xil', () => {
    const history = [past(['jeans', 'jacket'], 's1', '2026-11-10T10:00:00.000Z')];

    const [look] = pastLooks([], new Map(), history, null);

    expect(look?.key).toBe(tryKey(['jacket', 'jeans']));
    expect(look?.variantIds).toEqual(['jacket', 'jeans']);
  });
});

/*
 * `wearInputs` haqiqiy `wearOnly` bilan birga sinaladi: muhimi kirishlarning
 * o'zi emas, bosilgandan keyin savatda AYNAN shu kiyimlar yoqiq turishi.
 */
describe('wearInputs', () => {
  const garment = (id: string, slot: string, on = false): TrayItem => ({
    productId: `p-${id}`,
    variantId: id,
    slot,
    on,
    title: `Kiyim ${id}`,
  });

  /** Yoqiq kiyimlarning variantlari — tartibsiz solishtirish uchun saralangan */
  const worn = (tray: readonly TrayItem[]): Array<string | null> =>
    tray
      .filter((item) => item.on)
      .map((item) => item.variantId)
      .sort();

  it('savatdagi kiyimlarni yoqadi, qolganlarini o`chiradi', () => {
    const tray = [garment('a', 'top', true), garment('b', 'bottom'), garment('c', 'outer', true)];

    const next = wearOnly(tray, wearInputs(['b', 'a'], tray));

    expect(worn(next)).toEqual(['a', 'b']);
    // O'chgani yo'qolmaydi — nomzod bo'lib qoladi
    expect(next.map((item) => item.variantId)).toEqual(['a', 'b', 'c']);
  });

  it('savatdagi kiyimning nomi va turini o`chirmaydi', () => {
    const tray = [garment('a', 'top')];

    const [item] = wearOnly(tray, wearInputs(['a'], tray));

    expect(item).toMatchObject({ productId: 'p-a', slot: 'top', title: 'Kiyim a', on: true });
  });

  it('savatdan olib tashlangan kiyimni qaytadan qo`shadi', () => {
    const tray = [garment('a', 'top', true)];

    const next = wearOnly(tray, wearInputs(['a', 'x'], tray));

    expect(worn(next)).toEqual(['a', 'x']);
    // Yangisi hali aniqlanmagan — ekran uni serverdan so'raydi
    expect(next.find((item) => item.variantId === 'x')).toMatchObject({
      productId: null,
      slot: null,
    });
  });

  /*
   * ⚠️ Savat to'la: yo'q kiyim qo'shilganda eng boshidagisi tushib qoladi.
   * Natijaning kiyimlari aynan boshida tursa ham, bosilgandan keyin
   * hammasi yoqiq bo'lishi kerak.
   */
  it('to`la savatda ham natijaning hamma kiyimi yoqiq qoladi', () => {
    const tray = Array.from({ length: TRAY_LIMIT }, (_, index) =>
      garment(`g${String(index).padStart(2, '0')}`, `slot-${index}`),
    );
    const look = ['g01', 'x', 'g00', 'y'];

    const next = wearOnly(tray, wearInputs(look, tray));

    expect(worn(next)).toEqual(['g00', 'g01', 'x', 'y']);
    expect(next).toHaveLength(TRAY_LIMIT);
  });

  it('savat bo`sh bo`lsa — natijaning o`zi', () => {
    const next = wearOnly([], wearInputs(['b', 'a'], []));

    expect(worn(next)).toEqual(['a', 'b']);
  });
});
