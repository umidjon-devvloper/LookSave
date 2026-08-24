import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `assets-3d/export` → `apps/mobile/assets/models`.
 *
 * ⚠️ BU FAQAT DEV EKRANI UCHUN. Ishlab chiqarishda ilova tanani va
 * kiyimlarni **CDN dan** oladi (`GET /avatar/config` va `/tryon/slot/:slot`).
 * To'plamdagi nusxa `app/ai/studio.tsx` va `app/gl-model.tsx` uchun —
 * ular backendsiz ishlaydi va 3D zanjirini alohida sinash imkonini beradi
 * (12-tz.md D-03, D-04).
 *
 * ⚠️ NEGA SKRIPT KERAK. Ilgari fayllar QO'LDA ko'chirilardi va natijada
 * to'plamda `female-base-v1.glb` ham, animatsiyalar ham yo'q edi — dev
 * ekrani faqat erkak avatarini ko'rsatardi va bu jim nomuvofiqlik edi.
 *
 * ⚠️ METRO KUZATUVCHI EMAS. Modelni yangilagach `expo start` ni qayta
 * ishga tushiring — bu skript faqat `prestart`/`preios` da yuguradi.
 */

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../../assets-3d/export');
const target = resolve(here, '../assets/models');

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

if (!(await exists(source))) {
  // Modelsiz ham ilova ishlashi kerak — dev ekrani "yuklanmadi" deydi
  console.warn(`[sync-models] ${source} topilmadi — dev 3D ekrani bo'sh qoladi`);
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(dirname(target), { recursive: true });
await cp(source, target, {
  recursive: true,
  /*
   * Faqat ilovaga keradiganlari. `.md` va Blender manbalari to'plamni
   * bekorga kattalashtiradi — `assetBundlePatterns: ["**\/*"]` hammasini
   * oladi.
   */
  filter: (path) => !/\.(blend1?|md|py)$/i.test(path),
});

const files = await readdir(target, { recursive: true });
const glb = files.filter((name) => name.endsWith('.glb'));
console.warn(`[sync-models] ${glb.length} ta GLB → assets/models`);
