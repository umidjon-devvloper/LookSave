import { describe, expect, it } from 'vitest';

import {
  BUNDLE_HASH_LENGTH,
  groupHistory,
  historyRowCap,
  isBundleHash,
  type RenderHistoryRow,
} from './render-history';

/*
 * Kiyintirish tarixi sinovlari.
 *
 * ⚠️ NEGA AYNAN BULAR: guruhlash xatosi jim o'tadi — natija ekranda rasm
 * bilan chiqadi, faqat bosilganda BOSHQA kiyimlar yoqiladi. Har sinov
 * shunday bitta holatni ushlaydi.
 */

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const SINGLE = 'a'.repeat(64);
const BUNDLE = 'b'.repeat(BUNDLE_HASH_LENGTH);

let counter = 0;

function row(patch: Partial<RenderHistoryRow> & { variant_id: string }): RenderHistoryRow {
  counter += 1;
  const minute = patch.created_at ?? new Date(Date.UTC(2026, 10, 13, 8, counter));
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    source_hash: SINGLE,
    status: 'ready',
    result_url: `https://cdn.test/tryon/${counter}.png`,
    cutout_url: `https://cdn.test/tryon/${counter}-cut.png`,
    created_at: minute,
    completed_at: minute,
    ...patch,
  };
}

/** Bitta surat yozilgan komplekt qatorlari — serverdagidek */
function bundle(
  variants: string[],
  patch: Partial<RenderHistoryRow> = {},
  hash = BUNDLE,
): RenderHistoryRow[] {
  const first = row({ variant_id: variants[0]!, source_hash: hash, ...patch });
  return [
    first,
    ...variants.slice(1).map((variant_id) =>
      row({
        variant_id,
        source_hash: hash,
        result_url: first.result_url,
        cutout_url: first.cutout_url,
        created_at: first.created_at,
        completed_at: first.completed_at,
        ...patch,
      }),
    ),
  ];
}

describe('xesh turi', () => {
  it('32 belgili xesh — komplekt, to`liq sha256 — bitta kiyim', () => {
    expect(isBundleHash(BUNDLE)).toBe(true);
    expect(isBundleHash(SINGLE)).toBe(false);
  });
});

describe('groupHistory', () => {
  it('bitta kiyimli natija — bitta kiyimli to`plam', () => {
    const single = row({ variant_id: A });

    const [look, ...rest] = groupHistory([single], 30, false);

    expect(rest).toEqual([]);
    expect(look).toMatchObject({
      variantIds: [A],
      render: {
        id: single.id,
        variantId: A,
        status: 'ready',
        angle: 'front',
        imageUrl: single.result_url,
        cutoutUrl: single.cutout_url,
        baseRenderId: null,
        error: null,
      },
    });
  });

  it('komplekt qatorlari bitta natijaga yig`iladi', () => {
    const rows = bundle([B, A, C]);

    const looks = groupHistory(rows, 30, false);

    expect(looks).toHaveLength(1);
    expect(looks[0]?.variantIds).toEqual([A, B, C]);
  });

  /*
   * ⚠️ Ilova tartiblangan kiyimlarning BIRINCHISINI kuzatadi. Server boshqa
   * qatorni bersa, qurilmadagi urinish va tarix ikki xil `id` bilan kelib,
   * qatorda bitta natija ikki marta chiqardi.
   */
  it('kuzatiladigan yozuv — eng kichik variant id niki', () => {
    const rows = bundle([C, B, A]);
    const lead = rows.find((item) => item.variant_id === A);

    const [look] = groupHistory(rows, 30, false);

    expect(look?.render.id).toBe(lead?.id);
    expect(look?.render.variantId).toBe(A);
  });

  /*
   * ⚠️ Bir mahsulotning ikki rangi o'z suratisiz bo'lsa xeshlari BIR XIL
   * chiqadi. Xesh bo'yicha guruhlansa ikki alohida natija «komplekt»
   * bo'lib qolardi.
   */
  it('xeshi bir xil ikki bitta kiyimli natija qo`shilib ketmaydi', () => {
    const rows = [row({ variant_id: A }), row({ variant_id: B })];

    const looks = groupHistory(rows, 30, false);

    expect(looks.map((look) => look.variantIds)).toEqual([[B], [A]]);
  });

  it('eng yangisi boshida', () => {
    const old = row({ variant_id: A, completed_at: new Date('2026-11-01T10:00:00Z') });
    const fresh = bundle([B, C], { completed_at: new Date('2026-11-12T10:00:00Z') });
    const middle = row({ variant_id: C, completed_at: new Date('2026-11-05T10:00:00Z') });

    const looks = groupHistory([old, ...fresh, middle], 30, false);

    expect(looks.map((look) => look.variantIds)).toEqual([[B, C], [C], [A]]);
    expect(looks[0]?.completedAt).toBe('2026-11-12T10:00:00.000Z');
  });

  it('tugash vaqti yo`q eski qatorda yaratilgan vaqt olinadi', () => {
    const legacy = row({
      variant_id: A,
      created_at: new Date('2026-09-01T10:00:00Z'),
      completed_at: null,
    });

    expect(groupHistory([legacy], 30, false)[0]?.completedAt).toBe('2026-09-01T10:00:00.000Z');
  });

  it('navbatdagi va yiqilgan natijalar ko`rsatilmaydi', () => {
    const rows = [
      row({ variant_id: A, status: 'pending', result_url: null, cutout_url: null }),
      row({ variant_id: B, status: 'failed', result_url: null, cutout_url: null }),
      row({ variant_id: C, status: 'ready', result_url: null }),
    ];

    expect(groupHistory(rows, 30, false)).toEqual([]);
  });

  /*
   * ⚠️ Komplekt qatorlari birma-bir yangilanadi. Biri hali tayyor bo'lmasa
   * natija chala: surat bor, lekin to'plam to'liq emas.
   */
  it('qatorlaridan biri tayyor bo`lmagan komplekt ko`rsatilmaydi', () => {
    const rows = bundle([A, B]);
    rows[1] = { ...rows[1]!, status: 'processing', result_url: null, cutout_url: null };

    expect(groupHistory(rows, 30, false)).toEqual([]);
  });

  /*
   * ⚠️ Mahsulot o'chirilsa uning qatori CASCADE bilan ketadi. Qolgan bitta
   * qator «bitta kiyimli natija» emas — suratda ikki kiyim bor.
   */
  it('bitta qatori qolgan komplekt ko`rsatilmaydi', () => {
    const [orphan] = bundle([A, B]);

    expect(groupHistory([orphan!], 30, false)).toEqual([]);
  });

  it('kesim bitta qatorga yozilmay qolgan bo`lsa qo`shnisidan olinadi', () => {
    const rows = bundle([A, B]);
    const cutout = rows[1]!.cutout_url;
    rows[0] = { ...rows[0]!, cutout_url: null };

    expect(groupHistory(rows, 30, false)[0]?.render.cutoutUrl).toBe(cutout);
  });

  it('kesimsiz natija ham ko`rsatiladi — ilova oddiy suratni chizadi', () => {
    const plain = row({ variant_id: A, cutout_url: null });

    expect(groupHistory([plain], 30, false)[0]?.render).toMatchObject({
      imageUrl: plain.result_url,
      cutoutUrl: null,
    });
  });

  it('chegaradan ortig`i tashlanadi — eng eskilari', () => {
    const rows = [
      row({ variant_id: A, completed_at: new Date('2026-11-03T10:00:00Z') }),
      row({ variant_id: B, completed_at: new Date('2026-11-02T10:00:00Z') }),
      row({ variant_id: C, completed_at: new Date('2026-11-01T10:00:00Z') }),
    ];

    expect(groupHistory(rows, 2, false).map((look) => look.variantIds)).toEqual([[A], [B]]);
  });

  /*
   * ⚠️ So'rov qatorlar chegarasiga tiralsa, eng eski o'qilgan komplekt
   * yarmidan kesilgan bo'lishi mumkin: uch kiyimlidan ikkitasi o'qilgan.
   * Bunday guruh to'liq ko'rinadi, lekin to'plami noto'g'ri.
   */
  it('chegarada kesilgan eng eski komplekt tashlanadi', () => {
    const fresh = row({ variant_id: C, completed_at: new Date('2026-11-12T10:00:00Z') });
    const cut = bundle([A, B], { completed_at: new Date('2026-11-01T10:00:00Z') });

    expect(groupHistory([fresh, ...cut], 30, true).map((look) => look.variantIds)).toEqual([[C]]);
    // Chegaraga tiralmagan bo'lsa o'sha guruh to'liq — ko'rsatiladi
    expect(groupHistory([fresh, ...cut], 30, false)).toHaveLength(2);
  });

  it('chegarada eng eski qator bitta kiyimli bo`lsa u qoladi — u o`zi to`liq', () => {
    const fresh = bundle([A, B], { completed_at: new Date('2026-11-12T10:00:00Z') });
    const old = row({ variant_id: C, completed_at: new Date('2026-11-01T10:00:00Z') });

    expect(groupHistory([...fresh, old], 30, true)).toHaveLength(2);
  });

  it('ikki xil komplekt aralashmaydi', () => {
    const first = bundle([A, B], { completed_at: new Date('2026-11-10T10:00:00Z') });
    const second = bundle(
      [A, C],
      { completed_at: new Date('2026-11-11T10:00:00Z') },
      'c'.repeat(BUNDLE_HASH_LENGTH),
    );

    // Bazadan vaqt bo'yicha keladi — qatorlar aralash bo'lishi mumkin
    const looks = groupHistory([second[0]!, first[0]!, second[1]!, first[1]!], 30, false);

    expect(looks.map((look) => look.variantIds)).toEqual([
      [A, C],
      [A, B],
    ]);
  });

  it('qator yo`q bo`lsa — bo`sh', () => {
    expect(groupHistory([], 30, false)).toEqual([]);
    expect(groupHistory([], 30, true)).toEqual([]);
  });
});

describe('historyRowCap', () => {
  it('natijalardan ko`p qator o`qiladi — komplekt bir necha qator', () => {
    expect(historyRowCap(30)).toBeGreaterThanOrEqual(30 * 4);
    expect(historyRowCap(1)).toBeGreaterThan(1);
  });
});
