import type { RenderDto } from './render';

/**
 * Kiyintirish tarixi — foydalanuvchining tayyor natijalari, TO'PLAM bo'yicha.
 *
 * Ilovadagi «Kiyib ko'rilganlar» qatori shundan to'ladi. Qurilma faqat
 * oxirgi 6 urinishni eslaydi va ilova qayta o'rnatilsa unutadi; server esa
 * hamma natijani saqlaydi — lekin QATORMA-QATOR, to'plam belgisisiz.
 * Bu modul qatorlardan «nima kiyilgan edi» ni tiklaydi.
 *
 * ⚠️ BU YERDA BAZA YO'Q — ATAYIN. Qoidalar nozik (pastga qara) va xato
 * jimgina o'tadi: noto'g'ri guruhlangan natija ekranda rasm bilan chiqadi,
 * faqat bosilganda boshqa kiyimlar yoqiladi. Shuning uchun qoidalar sof va
 * sinaladi (`render-history.test.ts`); so'rovning o'zi `render.ts` da
 * (`listRenderHistory`).
 */

/**
 * Komplekt xeshining uzunligi.
 *
 * ⚠️ QATORNING TURI FAQAT SHUNDAN BILINADI. Bitta kiyim natijasining xeshi
 * to'liq sha256 (64 belgi), komplektniki 32 ga qirqilgan
 * (`requestBundleRender` shu o'zgarmasni ishlatadi). Jadvalda «bu komplekt
 * qatori» degan ustun yo'q.
 *
 * Nega xeshning bir xilligi yetmaydi: bitta mahsulotning ikki rangi o'z
 * suratisiz bo'lsa ikkalasi mahsulot suratiga tushadi va BITTA KIYIMLI
 * natijalarining xeshi bir xil chiqadi — ular esa ikki alohida natija.
 */
export const BUNDLE_HASH_LENGTH = 32;

export const isBundleHash = (hash: string): boolean => hash.length === BUNDLE_HASH_LENGTH;

/** Bitta urinishdagi kiyimlar soni uchun zaxira — o'qiladigan qatorlar hisobida */
const ROWS_PER_LOOK = 6;
/** Yiqilgan va navbatdagi qatorlar ham o'qiladi (ular guruhni to'liq ko'rish uchun kerak) */
const ROWS_SPARE = 100;

/**
 * Nechta qator o'qiladi.
 *
 * Natijalar emas, QATORLAR sanaladi: komplekt bir necha qator. Chegara
 * so'rovni ushlab turadi — eski oqim tasmadagi hamma kiyimni oldindan
 * kiyintirgan va ayrim akkauntlarda yuzlab qator bor.
 */
export function historyRowCap(limit: number): number {
  return limit * ROWS_PER_LOOK + ROWS_SPARE;
}

/** `tryon_renders` qatorining tarix uchun kerakli qismi. */
export interface RenderHistoryRow {
  id: string;
  variant_id: string;
  source_hash: string;
  status: string;
  result_url: string | null;
  cutout_url: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface RenderHistoryDto {
  /**
   * Kuzatiladigan yozuv; holati doim `ready`.
   *
   * ⚠️ KOMPLEKTDA — ENG KICHIK VARIANT ID NIKI. Ilova ham kiyimlarni
   * tartiblab yuboradi va birinchisining yozuvini kuzatadi
   * (`mobile/src/ai/lookTryon.ts`). Shu tufayli qurilma eslab qolgan urinish
   * va serverdan kelgan tarix BITTA `id` ga tushadi — qatorda natija ikki
   * marta chiqmaydi.
   */
  render: RenderDto;
  /** Natijadagi hamma kiyimlar, tartiblangan */
  variantIds: string[];
  completedAt: string;
}

const byVariant = (a: RenderHistoryRow, b: RenderHistoryRow): number =>
  a.variant_id < b.variant_id ? -1 : a.variant_id > b.variant_id ? 1 : 0;

/**
 * Qatorlarni natijalarga yig'adi — eng yangisi boshida.
 *
 * ⚠️ FAQAT TO'LIQ VA TAYYOR GURUH. Komplektning qatorlari birma-bir
 * yangilanadi va birma-bir o'chishi mumkin (mahsulot o'chirilsa uning
 * qatori CASCADE bilan ketadi). Chala guruh ko'rsatilsa surat uch kiyimli,
 * to'plam esa ikki kiyimli bo'lib qolardi. Bir qatorga tushib qolgan
 * komplekt umuman ko'rsatilmaydi: qolgan kiyimlarini bilib bo'lmaydi.
 *
 * ⚠️ KESILGAN GURUH TASHLANADI. `truncated` — so'rov chegaraga tirlagan,
 * ya'ni eng eski o'qilgan qatorning guruhi yarmidan kesilgan bo'lishi
 * mumkin. U ham chala guruh.
 *
 * @param rows `created_at DESC` tartibida (eng eskisi oxirida)
 */
export function groupHistory(
  rows: readonly RenderHistoryRow[],
  limit: number,
  truncated: boolean,
): RenderHistoryDto[] {
  const groups = new Map<string, RenderHistoryRow[]>();

  for (const row of rows) {
    // Komplekt — xesh bo'yicha bitta guruh; bitta kiyim — har qator o'zi
    const key = isBundleHash(row.source_hash) ? `bundle:${row.source_hash}` : `single:${row.id}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const oldest = rows[rows.length - 1];
  if (truncated && oldest && isBundleHash(oldest.source_hash)) {
    groups.delete(`bundle:${oldest.source_hash}`);
  }

  const looks: Array<{ at: number; dto: RenderHistoryDto }> = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort(byVariant);
    const lead = sorted[0];
    if (!lead) continue;

    if (isBundleHash(lead.source_hash) && sorted.length < 2) continue;
    if (!sorted.every((row) => row.status === 'ready' && row.result_url)) continue;

    // Guruh oxirgi qatori yangilanganda tayyor bo'ladi
    const at = Math.max(...sorted.map((row) => (row.completed_at ?? row.created_at).getTime()));

    looks.push({
      at,
      dto: {
        render: {
          id: lead.id,
          variantId: lead.variant_id,
          angle: 'front',
          status: 'ready',
          imageUrl: lead.result_url,
          // Kesim hamma qatorda bir xil; biriga yozilmay qolgan bo'lsa qo'shnisidan
          cutoutUrl: sorted.find((row) => row.cutout_url)?.cutout_url ?? null,
          baseRenderId: null,
          error: null,
        },
        variantIds: sorted.map((row) => row.variant_id),
        completedAt: new Date(at).toISOString(),
      },
    });
  }

  looks.sort((a, b) => b.at - a.at);
  return looks.slice(0, limit).map((look) => look.dto);
}
