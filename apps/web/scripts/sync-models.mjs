import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `assets-3d/export` → `apps/web/public/models`.
 *
 * Nega ko'chirma kerak: Vite faqat o'z ildizidagi fayllarni tarqatadi, GLB lar
 * esa monorepo ildizida — ular mobil ilova bilan umumiy. Nusxa `predev` va
 * `prebuild` da yangilanadi va `.gitignore` da — manba bitta bo'lib qoladi.
 *
 * ⚠️ Modelni yangilagach `npm run dev` ni qayta ishga tushiring: bu skript
 * faqat boshlanishda yuguradi, kuzatuvchi emas.
 */

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../../assets-3d/export');
const target = resolve(here, '../public/models');

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

if (!(await exists(source))) {
  // Modelsiz ham sayt ishlashi kerak — 3D bloklar o'z o'rnida "yuklanmadi" deydi
  console.warn(`[sync-models] ${source} topilmadi — 3D bloklar bo'sh qoladi`);
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(dirname(target), { recursive: true });
await cp(source, target, {
  recursive: true,
  // Blender manbalari va README emas, faqat brauzerga keradiganlari
  filter: (path) => !/\.(blend1?|md|py)$/i.test(path),
});

console.warn(`[sync-models] ${source} → ${target}`);
