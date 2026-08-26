import { readFileSync } from 'node:fs';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Kiyim qobig'ini TANANING O'Z SIRTIDAN yasash.
 *
 * ⚠️ NEGA LOFT YARAMADI. Ilgari kiyim gavdasi ko'ndalang kesimlar (doiralar)
 * to'plamidan quriladi. Doira bilan bel yoki ko'krakni yaqinlashtirsa
 * bo'ladi, lekin YELKANI — yo'q: yelka qiya sirt, uning kesimi doira emas.
 * Natijada kiyimning yuqori qismi tanaga tegmay, ustida konus bo'lib osilib
 * qolardi va katta kosa yoqaga o'xshardi.
 *
 * YECHIM: gavda meshini olib, uni normal bo'ylab tashqariga suramiz. Shunda
 * kiyim tananing har bir qavarig'ini aynan takrorlaydi — yelka ham, ko'krak
 * ham, kurak ham.
 *
 * Bo'yin va etak teshiklari alohida yasalmaydi: kerakli balandlik oralig'idagi
 * uchburchaklar olinadi, qolganlari tashlanadi. Kesim chizig'i tabiiy
 * yoqa va etak bo'lib chiqadi.
 */

/** GLB dagi tana qismlarini nom bo'yicha qaytaradi. */
export function loadBodyParts(glbPath) {
  const buffer = readFileSync(glbPath);

  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      '',
      (gltf) => {
        const parts = new Map();

        gltf.scene.traverse((child) => {
          if (!child.geometry) return;

          /*
           * ⚠️ MORPH OG'IRLIKLARI GEOMETRIYAGA YOZIB QO'YILADI.
           * `prepare()` faqat geometriyani ko'radi, mesh'ni emas — og'irliklar
           * esa mesh'da turadi. Ularsiz qobiq NOTO'G'RI shakl atrofida
           * quriladi (pastdagi izohga qarang).
           */
          child.geometry.userData.morphWeights = child.morphTargetInfluences
            ? Array.from(child.morphTargetInfluences)
            : null;

          parts.set(child.name, child.geometry);
        });

        resolve(parts);
      },
      reject,
    );
  });
}

/** Meshni neytral holatga keltirib, silliqlaydi va normallarini hisoblaydi. */
function prepare(source, smooth) {
  const geometry = source.clone();

  /*
   * Qobiq ILOVA CHIZADIGAN shaklning ustiga quriladi, shuning uchun morflar
   * GLB da yozilgan O'Z og'irliklari bilan qo'llanadi.
   *
   * ⚠️ HAMMASINI 0.5 GA QO'YIB BO'LMAYDI, GARCHI KO'PCHILIGI 0.5 BO'LSA HAM.
   * `body_torso` da o'lcham morflaridan tashqari YUZ morflari ham bor
   * (`fm_faceLength`, `fm_faceWidth`) va ular GLB da 0 da turadi — bo'yin
   * gavdaga qo'shilgani uchun ular shu meshda saqlanadi.
   *
   * Ilgari bu yerda hamma nishonga 0.5 berilardi. Natijada qobiq yuz
   * morflari yarim qo'llangan gavda atrofida qurilar, ilovada esa gavda
   * ularsiz chizilardi — ikki shakl yelka va ko'krak ustida ajralib,
   * teri futbolkadan katta dog' bo'lib chiqib turardi. Buni topish qiyin
   * edi, chunki nuqson kiyimda ko'rinadi, sababi esa TANADA.
   */
  const position = geometry.attributes.position;
  const targets = geometry.morphAttributes.position ?? [];
  const relative = geometry.morphTargetsRelative;
  const weights = geometry.userData.morphWeights;

  for (let t = 0; t < targets.length; t++) {
    const target = targets[t];
    const weight = weights?.[t] ?? 0.5;
    if (weight === 0) continue;

    for (let i = 0; i < position.count; i++) {
      const dx = relative ? target.getX(i) : target.getX(i) - position.getX(i);
      const dy = relative ? target.getY(i) : target.getY(i) - position.getY(i);
      const dz = relative ? target.getZ(i) : target.getZ(i) - position.getZ(i);

      position.setXYZ(
        i,
        position.getX(i) + dx * weight,
        position.getY(i) + dy * weight,
        position.getZ(i) + dz * weight,
      );
    }
  }

  geometry.morphAttributes = {};
  geometry.deleteAttribute('skinIndex');
  geometry.deleteAttribute('skinWeight');

  /*
   * ⚠️ UV SAQLANADI. Ilgari u o'chirilardi — natijada kiyimlarda tekstura
   * koordinatasi umuman bo'lmasdi va ilova mato to'qimasini (normal/roughness
   * xaritasi) ularga qo'llay olmasdi: futbolka silliq plastmassa bo'lib
   * ko'rinardi. Gavda UV bo'yicha ochib qo'yilgan, qobiq esa uning
   * uchburchaklaridan yasaladi — ya'ni tayyor, mantiqiy yoyilma bepul keladi.
   */
  if (smooth > 0) smoothGeometry(geometry, smooth);

  geometry.computeVertexNormals();
  /*
   * ⚠️ NORMAL PAYVANDLASH BU YERDA EMAS. Ilgari shu yerda `weldNormals`
   * chaqirilardi va u FAQAT shu meshni ko'rardi. Natijada ikki tana qismi
   * TUTASHGAN joyda (yelka = gavda+qo'l, tizza = son+boldir, to'piq =
   * boldir+panja) har qism o'z normalini olardi va qobiq ikki tomonga
   * surilardi — mato o'sha yerda yirtilib, ostidan teri chiqib turardi.
   * Renderда bu aynan chegaralarda arra tishli chekka bo'lib ko'rinardi.
   *
   * Endi payvandlash `shellFromMeshes` da, BARCHA qismlar bir vaqtda
   * tayyorlangach bajariladi.
   */

  return geometry;
}

/**
 * Laplas silliqlash — sirtdagi chuqur botiqlarni yumshatadi.
 *
 * ⚠️ POYABZAL UCHUN SHART. Krossovka oyoq panjasining SIRTIDAN yasaladi va
 * 14 mm tashqariga suriladi. Barmoqlar orasidagi ariq esa 14 mm dan tor:
 * ikki yon devor bir-birining ichidan o'tib ketadi va model uchli parchalarga
 * bo'linib ko'rinadi. Hech qanday normal tuzatish buni yechmaydi — sabab
 * surishning o'zida, ya'ni siljigan sirtning O'ZI bilan kesishishida.
 *
 * Silliqlash ariqni to'ldiradi va surish xavfsiz bo'ladi. Bu ayni paytda
 * to'g'ri ham: poyabzal barmoqlar shaklini takrorlamaydi, u ular ustidan
 * silliq qobiq bo'lib o'tadi.
 *
 * Qo'shni verteks O'RIN bo'yicha topiladi (indeks bo'yicha emas) — aks holda
 * qattiq qirra ikki tomoni bir-birini ko'rmay qoladi va chok joyida silliqlash
 * ishlamaydi.
 */
function smoothGeometry(geometry, iterations, strength = 0.5) {
  const position = geometry.attributes.position;
  const index = geometry.getIndex();
  if (!index) return;

  // O'rin bo'yicha payvandlangan nuqtalar
  const idOf = new Map();
  const owner = new Int32Array(position.count);
  const points = [];

  for (let i = 0; i < position.count; i++) {
    const key = `${Math.round(position.getX(i) * WELD)},${Math.round(
      position.getY(i) * WELD,
    )},${Math.round(position.getZ(i) * WELD)}`;

    let id = idOf.get(key);

    if (id === undefined) {
      id = points.length;
      idOf.set(key, id);
      points.push([position.getX(i), position.getY(i), position.getZ(i)]);
    }

    owner[i] = id;
  }

  // Qo'shnilar — uchburchak qirralaridan
  const neighbours = points.map(() => new Set());

  for (let t = 0; t < index.count; t += 3) {
    const a = owner[index.getX(t)];
    const b = owner[index.getX(t + 1)];
    const c = owner[index.getX(t + 2)];

    neighbours[a].add(b).add(c);
    neighbours[b].add(a).add(c);
    neighbours[c].add(a).add(b);
  }

  for (let pass = 0; pass < iterations; pass++) {
    const next = points.map((point, id) => {
      const around = neighbours[id];
      if (around.size === 0) return point;

      let x = 0;
      let y = 0;
      let z = 0;

      for (const other of around) {
        x += points[other][0];
        y += points[other][1];
        z += points[other][2];
      }

      const n = around.size;

      // Asl o'rin bilan qo'shnilar o'rtachasi orasida aralashtirish
      return [
        point[0] + (x / n - point[0]) * strength,
        point[1] + (y / n - point[1]) * strength,
        point[2] + (z / n - point[2]) * strength,
      ];
    });

    for (let id = 0; id < points.length; id++) points[id] = next[id];
  }

  for (let i = 0; i < position.count; i++) {
    const point = points[owner[i]];
    position.setXYZ(i, point[0], point[1], point[2]);
  }

  position.needsUpdate = true;
}

/** Bir joydagi vertekslarni topish uchun koordinata yaxlitlanadi — 0.1 mm. */
const WELD = 1e4;

/** `x,y,z` → payvandlash kaliti. */
const posKey = (x, y, z) =>
  `${Math.round(x * WELD)},${Math.round(y * WELD)},${Math.round(z * WELD)}`;

/**
 * BUTUN TANA bo'ylab normal atlasi — `buildNormalAtlas` to'ldiradi.
 *
 * ⚠️ NEGA GLOBAL, HAR CHAQIRUVDA EMAS. Bitta kiyim bir nechta ALOHIDA
 * `shellFromMeshes` chaqiruvidan yig'iladi: futbolka gavdasi
 * `body_torso` dan, yengi esa `body_upperArm_*` dan. Har chaqiruv o'z
 * ichida payvandlansa ham, YELKADA — ya'ni ikki chaqiruv tutashgan joyda —
 * normallar mos kelmasdi va qobiqlar turli tomonga surilardi. Ekranda bu
 * yelkadagi arra tishli chok bo'lib ko'rinardi (tizzada va bel-shtanina
 * chegarasida ham xuddi shu).
 *
 * Atlas bir marta, hamma tana qismi bo'ylab quriladi; keyin har qanday
 * chaqiruv o'sha yagona qiymatni oladi va chok yo'qoladi.
 */
let normalAtlas = null;

/**
 * Tana qismlarining HAMMASI bo'ylab yagona normal atlasini quradi.
 * `build.mjs` da kiyimlar yasalishidan OLDIN bir marta chaqiriladi.
 */
export function buildNormalAtlas(bodyParts) {
  const prepared = [...bodyParts.values()].map((geometry) => prepare(geometry, 0));
  weldNormals(prepared);

  const atlas = new Map();

  for (const geometry of prepared) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;

    for (let i = 0; i < position.count; i++) {
      atlas.set(posKey(position.getX(i), position.getY(i), position.getZ(i)), [
        normal.getX(i),
        normal.getY(i),
        normal.getZ(i),
      ]);
    }
  }

  normalAtlas = atlas;
  return atlas.size;
}

/**
 * Atlasdagi yagona normalni geometriyaga yozadi.
 *
 * Topilmagan verteks O'Z normalini saqlaydi — `smooth` qo'llangan qobiqda
 * (krossovka) o'rinlar siljigan bo'ladi va atlasда bunday kalit yo'q. Bu
 * to'g'ri: silliqlangan sirt boshqa shakl, unga tananing normali yaramaydi.
 */
function applyAtlas(geometry) {
  if (!normalAtlas) return;

  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;

  for (let i = 0; i < position.count; i++) {
    const found = normalAtlas.get(
      posKey(position.getX(i), position.getY(i), position.getZ(i)),
    );
    if (found) normal.setXYZ(i, found[0], found[1], found[2]);
  }

  normal.needsUpdate = true;
}

/**
 * Bir nuqtadagi normallarni o'rtachalab, hammasiga bir xil qiymat yozadi.
 *
 * ⚠️ BUSIZ KIYIM YIRTILADI, VA SABABINI TOPISH JUDA QIYIN.
 *
 * `computeVertexNormals()` normalni VERTEKS INDEKSI bo'yicha hisoblaydi,
 * o'rin bo'yicha emas. Tana meshida esa qattiq qirra va UV choki bo'ylab
 * bitta nuqtada bir nechta verteks nusxasi turadi (o'lchandi: `body_foot_L`
 * — 905 verteks, ammo atigi 536 noyob o'rin). Har nusxa faqat O'ZI tegishli
 * uchburchaklarning o'rtachasini oladi, ya'ni bir nuqtadagi ikki nusxaning
 * normali HAR XIL bo'ladi.
 *
 * Qobiq esa aynan normal bo'ylab tashqariga suriladi. Bir nuqtadagi
 * nusxalar har xil tomonga ketadi va mato o'sha yerda ochilib qoladi —
 * ekranda bu kiyim ustidagi arra tishli yirtiq bo'lib ko'rinadi, orasidan
 * teri chiqib turadi. Poyabzalda eng yomon, chunki oyoq meshida takror
 * verteks eng ko'p (369 ta).
 *
 * Normal payvandlangach, bir nuqtadagi hamma nusxa bir tomonga suriladi va
 * qobiq butun qoladi. Mato uchun silliq normal to'g'ri ham: kiyimda o'tkir
 * qirra bo'lmaydi, chetlari esa qirqish bilan yasaladi, normal bilan emas.
 */
export function weldNormals(geometries) {
  const list = Array.isArray(geometries) ? geometries : [geometries];

  /*
   * Birinchi yurish — barcha mesh bo'ylab UMUMIY yig'indi. Ikkinchi
   * yurishda har verteksga o'sha umumiy qiymat yoziladi.
   */
  const sums = new Map();
  const keyLists = [];

  for (const geometry of list) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const keys = new Array(position.count);
    keyLists.push(keys);

    for (let i = 0; i < position.count; i++) {
      const key = `${Math.round(position.getX(i) * WELD)},${Math.round(
        position.getY(i) * WELD,
      )},${Math.round(position.getZ(i) * WELD)}`;

      keys[i] = key;

      const sum = sums.get(key);

      if (sum) {
        sum.x += normal.getX(i);
        sum.y += normal.getY(i);
        sum.z += normal.getZ(i);
      } else {
        sums.set(key, { x: normal.getX(i), y: normal.getY(i), z: normal.getZ(i) });
      }
    }
  }

  for (let g = 0; g < list.length; g++) {
    const normal = list[g].attributes.normal;
    const keys = keyLists[g];

    for (let i = 0; i < keys.length; i++) {
      const sum = sums.get(keys[i]);
      const length = Math.hypot(sum.x, sum.y, sum.z);

      /*
       * Uzunlik nolga yaqin — qarama-qarshi normallar bir-birini yo'q qilgan
       * (yupqa devorning ikki tomoni). Bunday nuqtada yo'nalish aniqlanmaydi,
       * shuning uchun asl qiymat qoldiriladi.
       */
      if (length < 1e-6) continue;

      normal.setXYZ(i, sum.x / length, sum.y / length, sum.z / length);
    }

    normal.needsUpdate = true;
  }
}

/**
 * Ko'pburchakni yarim fazoga qirqish (Sutherland–Hodgman).
 *
 * `value` — har bir uchun belgi funksiyasi; musbat tomon SAQLANADI.
 * Funksiya CHIZIQLI bo'lishi shart (balandlik yoki suyak bo'ylab ulush) —
 * shundagina chegara nuqtasi oddiy interpolyatsiya bilan aniq topiladi.
 */
function clipPolygon(polygon, value) {
  const result = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];

    const a = value(current.position);
    const b = value(next.position);

    if (a >= 0) result.push(current);

    // Chegarani kesib o'tdi — aniq nuqtani qo'shamiz
    if ((a >= 0) !== (b >= 0)) {
      const t = a / (a - b);

      result.push({
        position: current.position.clone().lerp(next.position, t),
        normal: current.normal.clone().lerp(next.normal, t).normalize(),
        uv: current.uv && next.uv ? current.uv.clone().lerp(next.uv, t) : null,
      });
    }
  }

  return result;
}

/**
 * Bir yoki bir nechta tana qismidan kiyim qobig'i.
 *
 * Uchburchak qaysi mezonga tushsa, o'sha olinadi:
 *
 *   `from` / `to`   — balandlik oralig'i (gavda, oyoq uchun qulay)
 *   `axis`          — suyak bo'ylab ulush: `{ start, end, fromT, toT }`
 *                     (yeng uchun shart — qo'l qiya turadi va balandlik
 *                     bo'yicha kesish uni noto'g'ri qirqadi)
 *   `around`        — tik o'q atrofidagi doira: `{ x, z, radius, sides }`
 *                     (yoqa uchun shart — bo'yin atrofidagi halqa balandlik
 *                     bilan ajratilmaydi, chunki o'sha balandlikda gavda
 *                     yelkadan yelkagacha cho'zilgan)
 *
 * `offset`    — tanadan qanchalik uzoq.
 * `thickness` — matoning qalinligi. Berilsa, ichki qavat qo'shiladi va
 *               chetlar ular orasida yopiladi.
 *
 * ⚠️ CHEGARADAGI UCHBURCHAKLAR QIRQILADI, TASHLANMAYDI. Ilgari uchburchak
 * butunlay olinardi yoki butunlay tashlanardi va chet zigzag bo'lib
 * qolardi — yoqa, yeng uchi va etakda yirtiq ko'rinardi. Endi chegaraga
 * tushgan uchburchak aynan chegara bo'ylab kesiladi va chet tekis chiqadi.
 */
export function shellFromMeshes(
  sources,
  { from = -Infinity, to = Infinity, offset, axis = null, around = null, thickness = 0, smooth = 0 },
) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Qirqish tekisliklari — hammasi chiziqli
  const planes = [];
  if (Number.isFinite(from)) planes.push((p) => p.y - from);
  if (Number.isFinite(to)) planes.push((p) => to - p.y);

  if (around) {
    /*
     * Doira o'rniga ko'pburchak prizma: qirqish funksiyasi CHIZIQLI bo'lishi
     * shart, doira esa emas. 16 ta tekislik doiradan amalda farq qilmaydi.
     */
    const sides = around.sides ?? 16;

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const nx = Math.cos(angle);
      const nz = Math.sin(angle);

      planes.push((p) => around.radius - ((p.x - around.x) * nx + (p.z - around.z) * nz));
    }
  }

  if (axis) {
    const start = new THREE.Vector3().fromArray(axis.start);
    const direction = new THREE.Vector3().fromArray(axis.end).sub(start);
    const lengthSq = direction.lengthSq();

    if (lengthSq > 0) {
      const share = (p) => p.clone().sub(start).dot(direction) / lengthSq;
      planes.push((p) => share(p) - axis.fromT);
      planes.push((p) => axis.toT - share(p));
    }
  }

  /*
   * Bir xil verteks qayta-qayta yozilmasin. Qirqishdan keyin har bir
   * uchburchak o'z nusxasini yasaydi va qo'shni uchburchaklar chegarani
   * baham ko'rmay qoladi — natijada fayl uch baravar shishadi (306 KB → 1.5 MB
   * o'lchandi). Kalit sifatida o'rin va normal yaxlitlanadi.
   */
  const seen = new Map();

  const addVertex = (vertex) => {
    const x = vertex.position.x + vertex.normal.x * offset;
    const y = vertex.position.y + vertex.normal.y * offset;
    const z = vertex.position.z + vertex.normal.z * offset;

    const uvKey = vertex.uv ? `|${vertex.uv.x.toFixed(4)},${vertex.uv.y.toFixed(4)}` : '';
    const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}|${vertex.normal.x.toFixed(3)},${vertex.normal.y.toFixed(3)},${vertex.normal.z.toFixed(3)}${uvKey}`;

    const found = seen.get(key);
    if (found !== undefined) return found;

    const next = positions.length / 3;
    seen.set(key, next);

    // Tanadan tashqariga surish — mato shu qadar qalin
    positions.push(x, y, z);
    normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
    uvs.push(vertex.uv ? vertex.uv.x : 0, vertex.uv ? vertex.uv.y : 0);

    return next;
  };

  /*
   * Avval HAMMA qism tayyorlanadi, keyin normallar ular bo'ylab BIRGALIKDA
   * payvandlanadi — chegaradagi verteks ikki qismda ham bir xil yo'nalish
   * oladi va qobiq butun qoladi (`weldNormals` izohiga qarang).
   */
  const prepared = sources.map((source) => prepare(source, smooth));
  weldNormals(prepared);
  // Butun tana bo'ylab yagona qiymat — alohida chaqiruvlar orasidagi chokni yopadi
  for (const geometry of prepared) applyAtlas(geometry);

  for (const geometry of prepared) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    const index = geometry.getIndex();

    for (let t = 0; t < index.count; t += 3) {
      let polygon = [index.getX(t), index.getX(t + 1), index.getX(t + 2)].map((i) => ({
        position: new THREE.Vector3().fromBufferAttribute(position, i),
        normal: new THREE.Vector3().fromBufferAttribute(normal, i),
        uv: uv ? new THREE.Vector2().fromBufferAttribute(uv, i) : null,
      }));

      for (const plane of planes) {
        polygon = clipPolygon(polygon, plane);
        if (polygon.length < 3) break;
      }

      if (polygon.length < 3) continue;

      /*
       * Qirqilgan ko'pburchak yelpig'ich bilan uchburchaklarga bo'linadi.
       * U qavariq (uchburchakni tekisliklar bilan kesish natijasi doim
       * qavariq), shuning uchun yelpig'ich xavfsiz.
       */
      const fan = polygon.map(addVertex);

      for (let i = 1; i + 1 < fan.length; i++) {
        indices.push(fan[0], fan[i], fan[i + 1]);
      }
    }
  }

  if (indices.length === 0) throw new Error("Kiyim qobig'i bo'sh chiqdi — kesish mezonini tekshiring");

  /*
   * ⚠️ MATO QALINLIGI — FAQAT CHETDA. Qobiq bitta yuza va chetidan qaralganda
   * kiyim qog'ozdek ingichka ko'rinadi: yoqa, yeng uchi va etak "kesilgan
   * varaq" bo'lib turadi.
   *
   * Butun ichki qavat qo'shish shart emas: material ikki tomonlama, ya'ni
   * ichki yuza allaqachon chiziladi. Faqat chet bo'ylab tor lenta ichkariga
   * tushiriladi — ko'rinishi bir xil, hajmi esa ikki baravar kichik
   * (o'lchandi: 743 KB va 385 KB).
   *
   * Chet — faqat BITTA uchburchakka tegishli qirra; ikki uchburchak baham
   * ko'rgan qirra ichkarida qoladi.
   */
  if (thickness > 0) {
    const edges = new Map();

    /*
     * ⚠️ QIRRA INDEKS EMAS, O'RIN BO'YICHA ANIQLANADI. UV choki bo'ylab
     * bitta nuqtada ikkita verteks turadi (tekstura koordinatasi har xil).
     * Indeks bilan solishtirilsa qo'shni uchburchaklar o'sha qirrani baham
     * ko'rmagandek chiqadi va chok "ochiq chet" deb belgilanadi — natijada
     * matoning ichida, sirt o'rtasida keraksiz qalinlik lentasi paydo
     * bo'ladi (o'lchandi: 2 973 → 3 899 uchburchak).
     */
    const place = (index) =>
      `${Math.round(positions[index * 3] * WELD)},${Math.round(
        positions[index * 3 + 1] * WELD,
      )},${Math.round(positions[index * 3 + 2] * WELD)}`;

    for (let t = 0; t < indices.length; t += 3) {
      const triangle = [indices[t], indices[t + 1], indices[t + 2]];

      for (let e = 0; e < 3; e++) {
        const a = triangle[e];
        const b = triangle[(e + 1) % 3];
        const pa = place(a);
        const pb = place(b);
        const key = pa < pb ? `${pa}|${pb}` : `${pb}|${pa}`;

        const found = edges.get(key);
        if (found) found.count += 1;
        else edges.set(key, { a, b, count: 1 });
      }
    }

    // Chet vertekslarining ichkariga surilgan nusxasi
    const inner = new Map();

    const innerOf = (index) => {
      const found = inner.get(index);
      if (found !== undefined) return found;

      const next = positions.length / 3;
      inner.set(index, next);

      const nx = normals[index * 3];
      const ny = normals[index * 3 + 1];
      const nz = normals[index * 3 + 2];

      positions.push(
        positions[index * 3] - nx * thickness,
        positions[index * 3 + 1] - ny * thickness,
        positions[index * 3 + 2] - nz * thickness,
      );
      normals.push(nx, ny, nz);
      uvs.push(uvs[index * 2], uvs[index * 2 + 1]);

      return next;
    };

    const rim = [];

    for (const edge of edges.values()) {
      if (edge.count !== 1) continue;

      const a = innerOf(edge.a);
      const b = innerOf(edge.b);

      rim.push(edge.a, edge.b, b, edge.a, b, a);
    }

    indices.push(...rim);
  }

  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shell.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  shell.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shell.setIndex(indices);

  /*
   * ⚠️ NORMAL SURILGAN SIRT BO'YICHA QAYTA HISOBLANADI.
   *
   * Yuqorida har verteksga TANANING normali yozildi — surish yo'nalishi
   * sifatida u to'g'ri, lekin natijaviy qobiq BOSHQA shakl va uning
   * yorug'ligi o'z sirtidan kelib chiqishi kerak.
   *
   * Nima uchun bu ko'zga tashlanadi: surish botiq joylarda (tizza orqasi,
   * ichki son, qo'ltiq) vertekslarni bir-biriga yaqinlashtiradi va ular
   * ba'zan bir o'ringa tushib qoladi — lekin normallari har xil bo'lgani
   * uchun `addVertex` ularni ALOHIDA verteks deb yozadi. Natijada bitta
   * nuqtada ikki xil yo'nalish qoladi va yorug'lik uchburchakdan
   * uchburchakka sakraydi: ekranda bu son bo'ylab zigzag, yelkada esa
   * arra tishli chok bo'lib ko'rinadi.
   *
   * O'lchandi (`diag_normals.py`): tuzatishdan oldin `pants_leg_L` da
   * 38.6% o'rinda uzilish, eng kattasi 85 daraja.
   *
   * `weldNormals` esa qayta hisoblangan normalni bir o'rinda birlashtiradi
   * — `computeVertexNormals` uni verteks INDEKSI bo'yicha hisoblaydi va
   * UV choki bo'ylab yana ikkiga bo'linib ketardi.
   */
  shell.computeVertexNormals();
  weldNormals(shell);

  return shell;
}

/** Bitta meshdan — eng ko'p uchraydigan holat. */
export function shellFromMesh(source, options) {
  return shellFromMeshes([source], options);
}
