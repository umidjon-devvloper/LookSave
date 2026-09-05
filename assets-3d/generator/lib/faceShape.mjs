import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

/**
 * Selfidan avatar YUZ SHAKLI morflarini (`fm_*`) hisoblaydi.
 *
 * ⚠️ NEGA SERVERDA, QURILMADA EMAS. Hermes'da WebAssembly yo'q
 * (04-3d-pipeline §0), ya'ni MediaPipe telefonda ishlamaydi. ARKit
 * aniqroq bo'lardi, lekin u faqat iPhone X+ da va Android uchun baribir
 * server yo'li kerak bo'ladi — shuning uchun bitta umumiy yo'l tanlandi.
 *
 * ⚠️ NEGA `@mediapipe/tasks-vision` EMAS. U loyihada bor, lekin BRAUZER
 * uchun: ishga tushishda `document.createElement('canvas')` va undan
 * WebGL kontekst so'raydi. Node'da sinaldi — «document is not defined»,
 * DOM shim qo'yilgach «addEventListener is not a function». Shimni
 * chuqurlashtirish oxir-oqibat WebGL da to'xtaydi.
 *
 * `@vladmandic/human` o'sha MediaPipe mesh'ini (468 nuqta) beradi va
 * WASM backend bilan DOM'siz ishlaydi.
 */

// lib → generator → assets-3d → repo ildizi (node_modules shu yerda)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const HUMAN = join(ROOT, 'node_modules/@vladmandic/human');
const WASM = join(ROOT, 'node_modules/@tensorflow/tfjs-backend-wasm/dist');

/**
 * Model fayllarini qisqa umrli localhost serverdan uzatadi.
 *
 * ⚠️ NEGA HTTP. `human` modellarni `fetch` bilan o'qiydi va Node'da ikki
 * yo'l ham yopiq: `file://` sxemasini undici qo'llab-quvvatlamaydi,
 * oddiy fayl yo'li esa «Failed to parse URL» beradi. Fayllar diskda
 * qoladi, server faqat shu jarayon davomida yashaydi — tarmoqqa
 * chiqilmaydi.
 */
async function serveModels(dir) {
  const { createServer } = await import('node:http');
  const { createReadStream, existsSync } = await import('node:fs');

  const server = createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0]);
    const file = join(dir, name);

    // Papkadan chiqib ketishga yo'l qo'yilmaydi
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': name.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    });
    createReadStream(file).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}

let cached = null;

/** Modellarni bir marta yuklaydi — har surat uchun qayta yuklash sekin. */
async function detector() {
  if (cached) return cached;

  const mod = await import(`file://${join(HUMAN, 'dist/human.node-wasm.js')}`);
  const Human = mod.default ?? mod.Human ?? mod;
  const HumanClass = Human.Human ?? Human;

  const models = await serveModels(join(HUMAN, 'models'));
  const human = new HumanClass({
    modelBasePath: models.base,
    backend: 'wasm',
    wasmPath: `${WASM}/`,
    face: {
      enabled: true,
      detector: { enabled: true, rotation: false },
      mesh: { enabled: true },
      iris: { enabled: false },
      description: { enabled: false },
      emotion: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
  });

  await human.load();
  cached = { human, close: models.close };
  return cached;
}

/** Modellarni bo'shatadi — skript oxirida chaqiriladi. */
export function closeFaceDetector() {
  cached?.close();
  cached = null;
}

/* ── MediaPipe mesh nuqtalari (468 nuqtali standart indekslar) ── */
const P = {
  faceTop: 10,
  chin: 152,
  cheekL: 234,
  cheekR: 454,
  jawL: 172,
  jawR: 397,
  eyeOuterL: 33,
  eyeOuterR: 263,
  noseTop: 168,
  noseTip: 4,
  noseWingL: 48,
  noseWingR: 278,
  lipTop: 13,
  lipBottom: 14,
  mouthL: 61,
  mouthR: 291,
};

/**
 * O'rtacha yuzning nisbatlari — morf NOLI shu qiymatlarda bo'ladi.
 *
 * ⚠️ BULAR TAXMIN, o'lchov emas. Antropometrik o'rtachalar keng tarqalgan
 * proporsiyalardan olindi (yuz uzunligi ≈ kengligining 1.35 baravari va
 * h.k.). Ular AVATAR modeliga nisbatan kalibrlanishi kerak: `fm_* = 1`
 * bo'lganda mesh qanchalik o'zgarishini o'lchab, bu yerdagi `SPREAD`
 * tuzatiladi. Hozircha natija «o'xshash tomonga» suradi, aniq nusxa emas.
 */
const AVERAGE = {
  faceLength: 1.35, // uzunlik / kenglik
  jawWidth: 0.78, // jag' / yonoq kengligi
  eyeDistance: 0.64, // ko'z orasi / yonoq kengligi
  noseWidth: 0.26, // burun / yonoq kengligi
  noseLength: 0.28, // burun uzunligi / yuz uzunligi
  lipFullness: 0.22, // lab balandligi / og'iz kengligi
  chinShape: 0.31, // iyak-og'iz / yuz uzunligi
};

/**
 * Nisbat o'rtachadan qancha chetlashganini morf qiymatiga o'giradi.
 *
 * ⚠️ DIAPAZON −1…+1, NEYTRAL 0 (`morphs.ts` dagi `NEUTRAL_FACE` bilan bir
 * xil kelishuv). `SPREAD` — nisbatning qanchalik farqi to'liq morfga
 * teng bo'lishi: 20% chetlanish ±1 beradi. Kattaroq qiymat yuzni
 * karikaturaga aylantiradi.
 */
const SPREAD = 0.2;

function morph(value, average) {
  const relative = (value - average) / (average * SPREAD);
  return Math.round(Math.max(-1, Math.min(1, relative)) * 100) / 100;
}

/**
 * Selfidan yuz shakli morflarini qaytaradi. Yuz topilmasa `null`.
 *
 * @param {string} url  Selfi havolasi
 * @returns {Promise<Record<string, number> | null>}
 */
export async function faceMorphs(url) {
  const { human } = await detector();

  const response = await fetch(url);
  if (!response.ok) throw new Error(`surat yuklanmadi: HTTP ${response.status}`);

  /*
   * ⚠️ KICHRAYTIRISH VA YORQINLASHTIRISH — ikkalasi ham SHART.
   *
   * Telefon selfisi 3024×4032 bo'lib keladi va bunday o'lchamda detektor
   * yuzni topa olmadi (model kichik kirishga o'rgatilgan).
   *
   * Sinov selfilarining o'rtacha yorqinligi 3…30/255 chiqdi — deyarli
   * qora. `normalise()` gistogrammani cho'zadi va yuz shundan ham
   * chiqadi; yorug' suratga ta'siri sezilmaydi.
   */
  const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()))
    .rotate() // EXIF burilishi — selfi tik holatga keladi
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .normalise()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = human.tf.tensor(new Uint8Array(data), [1, info.height, info.width, 3], 'int32');
  const result = await human.detect(tensor);
  human.tf.dispose(tensor);

  const mesh = result.face?.[0]?.mesh;
  if (!mesh || mesh.length < 468) return null;

  const dist = (a, b) => Math.hypot(mesh[a][0] - mesh[b][0], mesh[a][1] - mesh[b][1]);

  const faceWidth = dist(P.cheekL, P.cheekR);
  const faceHeight = dist(P.faceTop, P.chin);
  if (faceWidth < 1 || faceHeight < 1) return null;

  const ratios = {
    faceLength: faceHeight / faceWidth,
    jawWidth: dist(P.jawL, P.jawR) / faceWidth,
    eyeDistance: dist(P.eyeOuterL, P.eyeOuterR) / faceWidth,
    noseWidth: dist(P.noseWingL, P.noseWingR) / faceWidth,
    noseLength: dist(P.noseTop, P.noseTip) / faceHeight,
    lipFullness: dist(P.lipTop, P.lipBottom) / dist(P.mouthL, P.mouthR),
    chinShape: dist(P.lipBottom, P.chin) / faceHeight,
  };

  return {
    faceLength: morph(ratios.faceLength, AVERAGE.faceLength),
    /*
     * `faceWidth` morfi alohida nisbatdan emas, `faceLength` ning teskarisi
     * sifatida olinadi: uzun yuz — tor, keng yuz — kalta. Mustaqil o'lchov
     * uchun boshning umumiy kattaligi kerak, u esa suratdan bilinmaydi
     * (masofa noma'lum).
     */
    faceWidth: -morph(ratios.faceLength, AVERAGE.faceLength),
    jawWidth: morph(ratios.jawWidth, AVERAGE.jawWidth),
    chinShape: morph(ratios.chinShape, AVERAGE.chinShape),
    noseWidth: morph(ratios.noseWidth, AVERAGE.noseWidth),
    noseLength: morph(ratios.noseLength, AVERAGE.noseLength),
    eyeDistance: morph(ratios.eyeDistance, AVERAGE.eyeDistance),
    lipFullness: morph(ratios.lipFullness, AVERAGE.lipFullness),
  };
}
