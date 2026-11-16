import { tryKey, type TrayInput, type TrayItem, type TryRecord } from './lookTray';

/**
 * Primerka ekranidagi «Kiyib ko'rilganlar» qatori — qaysi natijalar
 * ko'rsatiladi va bosilgani qanday qayta kiyiladi.
 *
 * Ikki manba bor va ikkalasi ham kerak:
 *
 *   - QURILMA (`lookStore.tries`) — oxirgi 6 urinish. Darhol bor, serversiz
 *     ham ishlaydi, lekin ilova qayta o'rnatilsa yoki boshqa telefonda bo'sh.
 *   - SERVER (`GET /tryon/history`) — mijoz kiyintirgan hamma natijalar.
 *     Eski serverda bu yo'l yo'q; u holda tarix shunchaki bo'sh keladi.
 *
 * Sof mantiq: tarmoq ham, React Native ham yo'q, shuning uchun alohida
 * sinaladi (`pastLooks.test.ts`). Chaqiruvchi: `components/ai/LookRoom.tsx`.
 */

/** Serverdagi natija yozuvining (`TryonRender`) qator uchun kerakli qismi. */
export interface PastRender {
  status: string;
  imageUrl: string | null;
  cutoutUrl: string | null;
}

/** Server tarixidagi natijaning (`TryonHistoryItem`) qator uchun kerakli qismi. */
export interface PastHistoryItem {
  render: PastRender & { id: string };
  variantIds: readonly string[];
  completedAt: string;
}

export interface PastLook {
  /**
   * Natija yozuvi (`renderId`) — qatordagi o'ziga xos belgi.
   *
   * ⚠️ TO'PLAM KALITI EMAS. Bitta to'plamning ikki natijasi bo'lishi mumkin
   * (mijoz suratini almashtirib, o'sha kiyimlarni qayta kiyib ko'rgan) —
   * ular ikki alohida surat va qatorda ikkalasi ham turadi.
   */
  id: string;
  /** To'plam kaliti (`tryKey`) */
  key: string;
  /** Shu natijadagi kiyimlar — bosilganda aynan shular qayta kiyiladi */
  variantIds: string[];
  image: string;
  /** Shaffof kesim — odam to'liq bo'yi bilan sig'dirib chiziladi */
  cutout: boolean;
  /** Sahnada AYNAN shu natija turibdi */
  current: boolean;
  /** Natija vaqti (ms) — tartib shundan; qurilmaga eslab qolishda ham kerak */
  at: number;
}

const imageOf = (render: PastRender): string | null =>
  render.status === 'ready' ? (render.cutoutUrl ?? render.imageUrl) : null;

/**
 * Qatorda ko'rsatiladigan natijalar — eng yangisi boshida.
 *
 * ⚠️ FAQAT TAYYORLARI. Navbatdagi yoki yiqilgan urinishning ko'rsatadigan
 * surati yo'q; ular qatorda bo'sh katak bo'lib turmaydi.
 *
 * ⚠️ SAHNADAGISI HAM QATORDA QOLADI — belgilangan holda. Qator mijoz
 * kiyintirgan natijalarning doimiy ro'yxati: tanlov o'zgarganda, kiyim
 * savatdan olib tashlanganda yoki savat bo'shaganda ham joyida turadi.
 * (Dastlab yagona natija sahnada tursa qator yashirilardi — ekrandan
 * yo'qolib-paydo bo'lib turgani uchun egasi rad etdi, 2026-11-13.)
 *
 * ⚠️ IKKI MANBA `id` BO'YICHA BIRLASHADI. Server komplektda aynan ilova
 * kuzatadigan yozuvni beradi, shuning uchun qurilmadagi urinish va tarixdagi
 * natija bitta `id` ga tushadi va qatorda bir marta chiqadi.
 *
 * ⚠️ VAQT — SERVERNIKI USTUN. Qurilmadagi vaqt har bosilganda yangilanishi
 * mumkin (`remember`); tartib unga bog'lansa bosilgan natija qator boshiga
 * sakrardi. Server bilgan natija o'z joyida turadi.
 *
 * @param renders `renderId` → qurilmadagi urinishning server javobi; hali kelmaganlari bo'lmaydi
 * @param history server tarixi; yo'l yo'q yoki javob kelmagan bo'lsa bo'sh
 * @param shownId sahnada turgan natija yozuvi; sahnada natija bo'lmasa `null`
 */
export function pastLooks(
  tries: readonly TryRecord[],
  renders: ReadonlyMap<string, PastRender>,
  history: readonly PastHistoryItem[],
  shownId: string | null,
): PastLook[] {
  const looks = new Map<string, PastLook>();

  for (const item of history) {
    const image = imageOf(item.render);
    if (!image || item.variantIds.length === 0) continue;

    const at = Date.parse(item.completedAt);
    looks.set(item.render.id, {
      id: item.render.id,
      key: tryKey(item.variantIds),
      variantIds: [...item.variantIds].sort(),
      image,
      cutout: item.render.cutoutUrl !== null,
      current: item.render.id === shownId,
      at: Number.isNaN(at) ? 0 : at,
    });
  }

  for (const record of tries) {
    const render = renders.get(record.renderId);
    const image = render ? imageOf(render) : null;
    if (!render || !image) continue;

    const known = looks.get(record.renderId);
    looks.set(record.renderId, {
      id: record.renderId,
      key: record.key,
      variantIds: record.variantIds,
      // Qurilmadagi javob yangiroq: kesim keyin ulangan bo'lishi mumkin
      image,
      cutout: render.cutoutUrl !== null,
      current: record.renderId === shownId,
      at: known ? known.at : record.at,
    });
  }

  // `sort` barqaror: vaqti teng bo'lsa kelgan tartibi saqlanadi
  return [...looks.values()].sort((a, b) => b.at - a.at);
}

/**
 * Natijani qayta kiyish uchun savatga beriladigan kirishlar (`wearOnly`).
 *
 * Urinish faqat variant id larni eslaydi. Savatda turgan kiyimning nomi,
 * surati va narxi saqlanib qoladi (bo'sh qiymat mavjudini o'chirmaydi),
 * savatdan olib tashlangani esa qaytadan qo'shiladi — ekran uni serverdan
 * o'zi aniqlaydi.
 *
 * ⚠️ TARTIB MUHIM — SAVAT TO'LA BO'LGANDA. Savatda yo'q kiyim oxiriga
 * qo'shiladi va sig'imdan oshsa eng BOSHIDAGISI tushib qoladi; u esa shu
 * natijaning kiyimi bo'lishi mumkin. Shuning uchun avval yo'qlari, keyin
 * borlari — savatdagi tartibida: tushib qolgan kiyim o'z navbati kelganda
 * «yo'q» bo'lib chiqadi va qayta qo'shiladi. Boshqa tartibda u yoqilgandan
 * KEYIN tushib qolardi va sahnaga bosilgan natija emas, boshqa to'plam
 * chiqardi.
 */
export function wearInputs(variantIds: readonly string[], tray: readonly TrayItem[]): TrayInput[] {
  const position = new Map<string, number>();
  tray.forEach((item, index) => {
    if (item.variantId !== null) position.set(item.variantId, index);
  });

  const missing = variantIds.filter((id) => !position.has(id));
  const present = variantIds
    .filter((id) => position.has(id))
    .sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));

  return [...missing, ...present].map((variantId) => ({ productId: null, variantId, slot: null }));
}
