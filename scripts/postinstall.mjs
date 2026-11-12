/**
 * Root postinstall — patch-package'ni himoya bilan ishga tushiradi.
 *
 * Patch'lar MOBIL bog'liqliklar uchun (hozir: react-native-screens —
 * `apps/mobile/patches/`). Veb deploy'ga ular umuman kerak emas: bu
 * paketlar saytning bundle'iga kirmaydi.
 *
 * ⚠️ NEGA HIMOYA KERAK: Vercel'da npm qandaydir sozlama tufayli root
 * bog'liqliklarni o'rnatmaydi (lokal aynan o'sha node 24.19 / npm 11.17
 * bilan uch marta takrorlashda hammasi joyida edi — ya'ni ayb repoda
 * emas). Paket yo'qligida oddiy `patch-package` chaqiruvi butun
 * deploy'ni yiqitardi.
 *
 * ⚠️ JIM O'TKAZIB YUBORISH FAQAT VERCEL'DA. Boshqa har qanday muhitda
 * (lokal, EAS, CI) paket topilmasa BALAND xato beramiz: u yerlarda
 * patch haqiqatan kerak va jim o'tkazish mobil bug'ni qaytaradi.
 *
 * ⚠️ IKKI JOYDA QO'LLANADI. patch-package faqat o'zi ishga tushgan
 * katalogdagi `node_modules` va `patches` ni ko'radi. Mobil paketlar
 * ildizga ko'tarilmaydi (`apps/mobile/node_modules`), shuning uchun
 * ularning patch'i `apps/mobile/patches` da turadi va shu katalogdan
 * alohida qo'llanadi. Ildizdagi `patches/` (bo'lsa) avvalgidek ishlaydi.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

let entry;
try {
  entry = require.resolve('patch-package');
} catch {
  if (process.env.VERCEL) {
    console.warn(
      "[postinstall] patch-package o'rnatilmagan — Vercel muhiti, patch veb uchun keraksiz, o'tkazib yuborildi.",
    );
    process.exit(0);
  }
  console.error(
    "[postinstall] patch-package topilmadi — bu muhitda patch MAJBURIY (mobil paketlar). `npm install` to'liq o'tganini tekshiring.",
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [entry], { stdio: 'inherit' });
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

const mobile = fileURLToPath(new URL('../apps/mobile/', import.meta.url));

if (existsSync(`${mobile}patches`) && existsSync(`${mobile}node_modules`)) {
  if (process.env.VERCEL) {
    console.warn(
      "[postinstall] Vercel muhiti — mobil patch'lar veb uchun keraksiz, o'tkazib yuborildi.",
    );
    process.exit(0);
  }

  /*
   * ⚠️ `--error-on-fail` ATAYLAB. Busiz patch-package lokalda patch
   * qo'llanmasa ham 0 qaytaradi va build jimgina patch'siz yig'iladi —
   * masalan react-native-screens patch'isiz iOS 27 da native «orqaga»
   * tugmasi ikkinchi ekrandan boshlab ishlamay qoladi.
   *
   * Paket versiyasi yangilanib, patch mos kelmay qolsa `npm install`
   * shu yerda to'xtaydi: patch hali kerakmi — tekshiring va eskirgan
   * bo'lsa `apps/mobile/patches/` dan o'chiring.
   */
  const mobileResult = spawnSync(process.execPath, [entry, '--error-on-fail'], {
    stdio: 'inherit',
    cwd: mobile,
  });
  process.exit(mobileResult.status ?? 1);
}
