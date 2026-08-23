import type { Slot } from '@looksave/validation';

import manifest from '../../assets/models/manifest.json';

/**
 * 1–2-bosqich uchun ilova ichiga joylashtirilgan 3D assetlar.
 *
 * Spetsifikatsiya §8 bu bosqichlarni "hech qanday backend yo'q" deb
 * belgilaydi, shuning uchun modellar tarmoqdan emas, to'plamdan olinadi.
 * 3-bosqichda ular CDN ga ko'chadi va bu fayl o'chadi — `GarmentSpec`
 * shakli esa serverdan keladigan ma'lumot bilan bir xil qoladi, ya'ni
 * ekranlar o'zgarmaydi.
 *
 * ⚠️ `require` YO'LLARI HARFMA-HARF BO'LISHI SHART. Metro to'plamni statik
 * tahlil qiladi: o'zgaruvchi bilan yasalgan yo'l (`require(base + name)`)
 * yig'ilishda topilmaydi va ilova ishga tushganda "Unknown module"
 * beradi. Shuning uchun quyidagi jadval qo'lda emas, manifestdan
 * generatsiya qilingan.
 */

/** Fayl nomi → Metro modul identifikatori. */
const FILES: Record<string, number> = {
  'tshirt-blender-v1.glb': require('../../assets/models/tshirt-blender-v1.glb') as number,
  'tshirt-white-v1.glb': require('../../assets/models/tshirt-white-v1.glb') as number,
  'tshirt-black-v1.glb': require('../../assets/models/tshirt-black-v1.glb') as number,
  'tshirt-violet-v1.glb': require('../../assets/models/tshirt-violet-v1.glb') as number,
  'jacket-denim-v1.glb': require('../../assets/models/jacket-denim-v1.glb') as number,
  'pants-graphite-v1.glb': require('../../assets/models/pants-graphite-v1.glb') as number,
  'pants-beige-v1.glb': require('../../assets/models/pants-beige-v1.glb') as number,
  'sneakers-white-v1.glb': require('../../assets/models/sneakers-white-v1.glb') as number,
  'sneakers-black-v1.glb': require('../../assets/models/sneakers-black-v1.glb') as number,
  'watch-steel-v1.glb': require('../../assets/models/watch-steel-v1.glb') as number,
  'watch-gold-v1.glb': require('../../assets/models/watch-gold-v1.glb') as number,
  'cap-black-v1.glb': require('../../assets/models/cap-black-v1.glb') as number,
  'cap-violet-v1.glb': require('../../assets/models/cap-violet-v1.glb') as number,
};

export interface GarmentSpec {
  key: string;
  /** `@looksave/validation` dagi umumiy ro'yxat — server bilan bitta til. */
  slot: Slot;
  title: string;
  colorName: string;
  colorHex: string;
  /** Kiyim ostida qoladigan tana qismlari — ular yashiriladi (§4.3). */
  hideBodyParts: string[];
  /** Metro modul identifikatori — `Asset.fromModule` uchun. */
  module: number;
}

export const DEMO_GARMENTS: GarmentSpec[] = manifest.garments.map((garment) => {
  const module = FILES[garment.file];
  if (module === undefined) {
    // Manifest va to'plam bir-biriga mos emas — yig'ilishda sezilishi kerak
    throw new Error(`3D model to'plamda yo'q: ${garment.file}`);
  }

  return {
    key: garment.key,
    slot: garment.slot as Slot,
    title: garment.title,
    colorName: garment.colorName,
    colorHex: garment.colorHex,
    hideBodyParts: garment.hideBodyParts ?? [],
    module,
  };
});

/** Namoyishda mavjud slotlar, ekrandagi tartibda. */
export const SLOT_ORDER: Slot[] = ['top', 'outer', 'bottom', 'feet', 'head', 'wrist'];

export const SLOT_TITLE: Partial<Record<Slot, string>> = {
  top: 'Ustki',
  outer: 'Kurtka',
  bottom: 'Pastki',
  feet: 'Oyoq kiyim',
  head: 'Bosh kiyim',
  wrist: 'Aksessuar',
};
