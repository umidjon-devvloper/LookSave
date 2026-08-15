import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * GLB yozish.
 *
 * NEGA POLIFILL: `GLTFExporter` brauzer uchun yozilgan va binar chiqishda
 * `FileReader` ga tayanadi — Node'da bunday global yo'q. Polifill `Blob`
 * ustiga qurilgan (Node 18+ da bor), shuning uchun qo'shimcha paket
 * kerak emas. IMPORT'DAN OLDIN o'rnatilishi shart: `GLTFExporter` modul
 * yuklanganda emas, chaqirilganda foydalanadi, lekin tartibni buzmaslik
 * uchun shu yerda birinchi qatorda turadi.
 */
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }

    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onloadend?.();
      });
    }
  };
}

const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

/**
 * Sahnani GLB qilib faylga yozadi.
 *
 * `onlyVisible: false` — tana qismlari kiyim ostida yashirilishi mumkin,
 * lekin eksportda hammasi bo'lishi shart (yashirish ilovada qilinadi).
 */
export async function writeGlb(scene, filePath, options = {}) {
  const exporter = new GLTFExporter();

  const buffer = await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, {
      binary: true,
      onlyVisible: false,
      // Tangent three.js tomonidan hisoblanadi (04-3d-pipeline §5)
      includeCustomExtensions: false,
      ...options,
    });
  });

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.from(buffer));
  return buffer.byteLength;
}
