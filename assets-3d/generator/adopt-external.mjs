import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';

/**
 * Tashqi kiyim GLB'sini (Sketchfab va h.k.) ilova formatiga o'tkazadi.
 *
 *   node assets-3d/generator/adopt-external.mjs incoming/shirt.glb --slot top --key sf-tshirt
 *
 * ⚠️ NEGA KERAK. Tashqi modellar ilova kutgan kelishuvlarga mos KELMAYDI:
 * masshtab har xil (Sketchfab model`ida ba'zan 350000 birlik), markaz
 * boshqa joyda, ba'zan +Z up. Bu skript ularni bir standartga keltiradi —
 * shundan keyin ular protsedural kiyimlar bilan bir qatorda ishlaydi.
 *
 * NIMA QILADI:
 *   1. Draco/Meshopt bo'lsa dekod qiladi (ba'zi Sketchfab eksportlari siqilgan)
 *   2. Masshtab: eng katta o'lchov `--height` ga (standart 0.62 m — futbolka)
 *   3. Markazlash: X va Z markazga, Y esa oyoq (pastki chet) 0 ga
 *   4. Tekstura va material hisobotini beradi — bu "haqiqiy ko'rinadimi"ning belgisi
 *   5. `export/<key>-v1.glb` ga yozadi
 *
 * ⚠️ NIMA QILMAYDI. Skeletga bog'lash (skinning) va shape key — YO'Q.
 * Tashqi modelda ular boshqacha yoki umuman yo'q. Ya'ni bu kiyim tana
 * bilan birga qimirlamaydi va o'lcham o'zgarganda moslashmaydi. Test uchun
 * bu yetarli: "haqiqiy model qanday ko'rinadi" degan savolga javob beradi.
 * To'liq integratsiya (rig, morph) alohida ish.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const EXPORT = join(ROOT, 'export');

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split('=')[1];
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return fallback;
}

const input = process.argv[2];
if (!input || input.startsWith('--')) {
  console.error('❌ Foydalanish: adopt-external.mjs <fayl.glb> --slot top --key nom');
  process.exit(1);
}

const inputPath = join(ROOT, input);
if (!existsSync(inputPath)) {
  console.error(`❌ topilmadi: ${inputPath}`);
  process.exit(1);
}

const slot = arg('slot', 'top');
const key = arg('key', basename(input).replace(/\.glb$/i, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase());
const targetHeight = Number(arg('height', slot === 'feet' ? 0.12 : slot === 'head' ? 0.22 : 0.62));

const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression, EXTMeshoptCompression])
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'meshopt.decoder': MeshoptDecoder,
  });

const doc = await io.read(inputPath);
await doc.transform(prune(), dedup());

const root = doc.getRoot();

// ── Hisobot: haqiqiy model belgilari ──
const meshes = root.listMeshes();
const materials = root.listMaterials();
const textures = root.listTextures();
let triangles = 0;
for (const mesh of meshes) {
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    triangles += idx ? idx.getCount() / 3 : (prim.getAttribute('POSITION')?.getCount() ?? 0) / 3;
  }
}

// PBR tekstura turlarini sanaymiz — "haqiqiy ko'rinish" aynan shulardan
const texKinds = new Set();
for (const m of materials) {
  if (m.getBaseColorTexture()) texKinds.add('albedo');
  if (m.getNormalTexture()) texKinds.add('normal');
  if (m.getMetallicRoughnessTexture()) texKinds.add('metal/rough');
  if (m.getOcclusionTexture()) texKinds.add('ao');
  if (m.getEmissiveTexture()) texKinds.add('emissive');
}

// ── Masshtab va markazlash ──
// Bounding box — barcha mesh POSITION accessor'idan. Ko'pchilik tashqi
// kiyim bitta node bo'lgani uchun local koordinata yetarli aniq; ierarxiya
// chuqur bo'lsa `--height` bilan qo'lda to'g'rilanadi.
let min = [Infinity, Infinity, Infinity];
let max = [-Infinity, -Infinity, -Infinity];
for (const mesh of meshes) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const el = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, el);
      for (let a = 0; a < 3; a++) {
        if (el[a] < min[a]) min[a] = el[a];
        if (el[a] > max[a]) max[a] = el[a];
      }
    }
  }
}

const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
const largest = Math.max(...size);
const scale = largest > 0 ? targetHeight / largest : 1;

// Markaz: X/Z o'rtaga, Y pastki chet 0 ga (kiyim oyoq ustida turadi)
const centre = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];

for (const mesh of meshes) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const el = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, el);
      pos.setElement(i, [
        (el[0] - centre[0]) * scale,
        (el[1] - centre[1]) * scale,
        (el[2] - centre[2]) * scale,
      ]);
    }
  }
}

mkdirSync(EXPORT, { recursive: true });
const outName = `${key}-v1.glb`;
const outPath = join(EXPORT, outName);
await io.write(outPath, doc);

// ── credits.json — CC-BY atributi ──
const creditsPath = join(ROOT, 'external', 'credits.json');
let credits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : {};
credits[key] = {
  source: input,
  note: 'Tashqi model. CC-BY bo\'lsa muallif nomini shu yerga yozing.',
  adoptedAt: 'stamp-after',
};
writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n');

console.log(`\n── ${input}  →  export/${outName}`);
console.log(`   slot: ${slot} · key: ${key}`);
console.log(`   mesh: ${meshes.length} · uchburchak: ${Math.round(triangles)} · material: ${materials.length}`);
console.log(`   tekstura: ${textures.length}  [${[...texKinds].join(', ') || 'YO`Q — tekis rang'}]`);
console.log(`   asl o'lchov: ${size.map((s) => s.toFixed(1)).join(' × ')} → ${targetHeight} m (masshtab ${scale.toExponential(2)})`);

if (textures.length === 0) {
  console.log('\n⚠️  TEKSTURA YO`Q — bu model ham tekis rangda, "haqiqiy" ko`rinmaydi.');
} else if (texKinds.has('albedo')) {
  console.log('\n✅ Albedo teksturasi bor — bu model haqiqiy mato ko`rinishiga ega.');
}

console.log('\nKeyingi: manifestga qo`shish uchun external.json ni yangilang, keyin publish.mjs');
