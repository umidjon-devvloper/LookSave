import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 3D generatsiya worker'i — navbatni avtomatik bo'shatadi.
 *
 *   node assets-3d/generator/worker-3d.mjs                 # har 30 s
 *   node assets-3d/generator/worker-3d.mjs --interval=15
 *   node assets-3d/generator/worker-3d.mjs --once          # bir marta
 *
 * ⚠️ NEGA ALOHIDA WORKER, API ICHIDA EMAS. `from-photo.mjs` three.js va
 * sharp'ni ishlatib geometriya quradi — bular og'ir bog'liqliklar. Ularni
 * API serverga qo'shsak, u har so'rovda shu yukni ko'tarardi va Docker
 * imiji bir necha barobar kattalashardi. Worker esa alohida jarayon:
 * API yengil qoladi, generatsiya esa mustaqil ishlaydi.
 *
 * ⚠️ HAR SIKL YANGI JARAYON. `from-photo.mjs` ni bolalar jarayoni sifatida
 * chaqiramiz va u har safar tugaydi. Sabab: three.js sahna obyektlarini
 * to'liq tozalash qiyin va uzoq ishlaydigan jarayonda xotira asta o'sadi.
 * Alohida jarayon esa har navbatdan keyin butunlay tozalanadi.
 *
 * ⚠️ FAQAT BITTA NUSXA ISHLASHI KERAK. Ikki worker bir vaqtda bir
 * `queued` qatorni olib, ikkita model yasashi mumkin. Status o'tishi
 * (queued → ready) amaliy himoya, lekin ikki worker orasidagi poygani
 * yopmaydi. Ishlab chiqarishda bitta docker-compose xizmati sifatida
 * yuriting (08-deployment.md).
 *
 * ⚠️ ISHGA TUSHISH USULI: bu worker `--apply` ni O'ZI qo'shadi — quruq
 * yurish worker uchun ma'nosiz, u doim haqiqiy ish qiladi.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'from-photo.mjs');

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}

const ONCE = process.argv.includes('--once');
const intervalMs = Math.max(5, Number(arg('interval', 30))) * 1000;

let stopping = false;
let running = false;

/** `from-photo.mjs --apply` ni bir marta yurgizadi. */
function drainOnce() {
  return new Promise((resolve) => {
    running = true;
    const child = spawn('node', [SCRIPT, '--apply'], { cwd: join(HERE, '..', '..') });

    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));

    child.on('close', (code) => {
      running = false;

      // Faqat mazmunli qatorni chiqaramiz — "navbat bo'sh" har 30 s
      // takrorlanib logni ifloslantirmasin
      const made = out.match(/✅ (\d+) ta yasaldi, (\d+) ta xato/);
      if (made && (made[1] !== '0' || made[2] !== '0')) {
        stamp(`yasaldi ${made[1]}, xato ${made[2]}`);
      } else if (code !== 0) {
        stamp(`⚠️ from-photo chiqish kodi ${code}`);
        // Sababni ko'rsatamiz — jim yiqilishning oldini oladi
        process.stderr.write(out);
      }
      resolve();
    });

    child.on('error', (err) => {
      running = false;
      stamp(`⚠️ ishga tushmadi: ${err.message}`);
      resolve();
    });
  });
}

function stamp(message) {
  // Vaqtsiz: bu worker jurnalga yoziladi va u vaqt belgisini o'zi qo'yadi.
  // Argsiz `new Date()` ba'zi muhitlarda taqiqlangan — ishlatmaymiz.
  console.log(`[worker-3d] ${message}`);
}

async function loop() {
  stamp(`ishga tushdi · interval ${intervalMs / 1000} s`);

  while (!stopping) {
    await drainOnce();
    if (ONCE) break;

    // Uxlash, lekin SIGTERM darhol uyg'otsin
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      timers.add(timer);
    });
  }

  stamp('to`xtadi');
}

const timers = new Set();

function shutdown(signal) {
  stamp(`${signal} — to'xtatilmoqda${running ? ' (joriy ish tugaydi)' : ''}`);
  stopping = true;
  for (const timer of timers) clearTimeout(timer);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

await loop();
