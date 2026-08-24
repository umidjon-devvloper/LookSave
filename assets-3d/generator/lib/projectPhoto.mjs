import { NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';

/**
 * Mahsulot suratini kiyim OLD tomoniga proyeksiya qiladi.
 *
 * ⚠️ NEGA PLANAR PROYEKSIYA, MESH UV'SI EMAS. Kiyim qobig'ining o'z UV'si
 * silindrik (tana bo'ylab o'ralgan) — unga tekis mahsulot surati qo'yilsa
 * gavdaga cho'zilib buziladi. Mahsulot surati esa OLDDAN olingan tekis
 * ko'rinish. Shuning uchun UV old tomondan planar proyeksiya bilan qayta
 * hisoblanadi: har verteks (x, y) → surat (u, v). Natijada surat aynan
 * old ko'rinishdek tushadi.
 *
 * ⚠️ ORQA TOMON — SURATNING KO'ZGU AKSI. Old proyeksiya orqa vertekslarni
 * ham qamrab oladi (bir xil x, y). Orqa tomon suratning teskarisini oladi —
 * mahsulot orqasi ko'pincha shunga o'xshash (bir xil rang, chok), shuning
 * uchun buni maqbul deb qabul qilamiz. Aniq orqa surat kerak bo'lsa,
 * do'kon ikkinchi rasm beradi (kelajak ishi).
 *
 * ⚠️ FON. Surat oq studiya fonida bo'ladi va u ham kiyim chetlariga
 * tushadi. To'liq yechim — fonni olib tashlash (`@imgly/background-removal`),
 * lekin u og'ir. Hozircha surat markazga kadrlanadi: kiyim odatda
 * markazda, fon esa chetda qoladi va planar proyeksiyada chetga suriladi.
 */

/** Front-facing vertex normal chegarasi — bundan katta z-normal old deb hisoblanadi. */
const FRONT_Z = 0.1;

/**
 * @param {Buffer} garmentGlb  Qurilgan kiyim GLB (teksturasiz)
 * @param {Buffer} photoBytes  Mahsulot surati (jpg/png)
 * @returns {Promise<Buffer>}  Surat proyeksiya qilingan GLB
 */
export async function projectPhotoOntoGarment(garmentGlb, photoBytes) {
  // ── Suratni tayyorlash: kvadrat, 512, JPEG ──
  // Kvadrat — planar UV 0..1 kvadratга mos kelishi uchun. `cover` markazni
  // saqlaydi (kiyim markazda).
  const image = await sharp(photoBytes)
    .rotate() // EXIF burilishi
    .resize(512, 512, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const io = new NodeIO();
  const doc = await io.readBinary(new Uint8Array(garmentGlb));

  // ── Tekstura ──
  const texture = doc
    .createTexture('garment-photo')
    .setImage(new Uint8Array(image))
    .setMimeType('image/jpeg');

  // ── Umumiy chegara qutisi (barcha mesh bo'ylab) ──
  // Planar proyeksiya butun kiyim bo'ylab bir xil bo'lishi kerak — aks holda
  // har mesh o'z qutisiga moslanib, gavda va yeng orasida surat sakraydi.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const el = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        if (el[0] < minX) minX = el[0];
        if (el[0] > maxX) maxX = el[0];
        if (el[1] < minY) minY = el[1];
        if (el[1] > maxY) maxY = el[1];
      }
    }
  }

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  // ── Har mesh: planar UV + tekstura ──
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      if (!pos) continue;

      const uv = new Float32Array(pos.getCount() * 2);
      const p = [0, 0, 0];
      const n = [0, 0, 1];

      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p);

        // U: chapdan o'ngga; V: yuqoridan pastga (surat konvensiyasi)
        let u = (p[0] - minX) / spanX;
        const v = 1 - (p[1] - minY) / spanY;

        /*
         * ⚠️ ORQA VERTEKSNI KO'ZGU QILAMIZ. Old proyeksiyada orqa
         * verteks ham bir xil (x) oladi, lekin u orqadan qaralganda
         * teskari bo'ladi. `U` ni aylantirsak, orqa tomon suratning
         * to'g'ri (teskarilanmagan) aksini ko'rsatadi.
         */
        if (nor) {
          nor.getElement(i, n);
          if (n[2] < -FRONT_Z) u = 1 - u;
        }

        uv[i * 2] = u;
        uv[i * 2 + 1] = v;
      }

      const accessor = doc.createAccessor().setType('VEC2').setArray(uv);
      prim.setAttribute('TEXCOORD_0', accessor);

      // Material: bazaviy rang teksturasi. Rangni oq qilamiz, aks holda u
      // teksturaga ko'paytirilib qorong'ilashtiradi.
      let material = prim.getMaterial();
      if (!material) {
        material = doc.createMaterial('garment');
        prim.setMaterial(material);
      }
      material.setBaseColorFactor([1, 1, 1, 1]);
      material.setBaseColorTexture(texture);
      material.setRoughnessFactor(0.85);
      material.setMetallicFactor(0);
    }
  }

  const out = await io.writeBinary(doc);
  return Buffer.from(out);
}
