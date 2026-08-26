import * as THREE from 'three';

import { loft, verticalRings } from './loft.mjs';
import { LIMB_RADIUS, measuredTorsoKeys, shellKeys, SHAPE, torsoKeys } from './profiles.mjs';
import { weldNormals } from './bodyShell.mjs';
import { addMorphTargets, attachMorphNames, boxAt, capsuleBetween, ellipsoidAt } from './shape.mjs';

/**
 * Kiyim modellari.
 *
 * ⚠️ KIYIM SKINNED EMAS — oddiy mesh. Sabab ilova kodida: `AnimationRig`
 * faqat TANADAN quriladi (`AvatarScene.tsx`), kiyim esa sahnaga alohida
 * `primitive` bo'lib qo'shiladi va hech qayerda tana skeletiga qayta
 * bog'lanmaydi. Ya'ni kiyimga teri og'irliklari yozilsa ham ular hech
 * qachon ishlatilmaydi — faqat fayl hajmini oshiradi.
 *
 * ⚠️ BUNING NARXI: animatsiya qo'shilganda tana harakatlanadi, kiyim esa
 * joyida qotib qoladi. Buni tuzatish uchun ilovada kiyimni tana skeletiga
 * bog'lash kerak bo'ladi (`SkeletonUtils` yoki qo'lda). Hozircha klip yo'q,
 * shuning uchun bu ko'rinmaydi — lekin klip qo'shishdan oldin hal qilinsin.
 *
 * Shape key'lar esa SHART: `applyMorphs` kiyimga ham qo'llanadi va
 * o'lchamga moslanmagan kiyim tanadan chiqib turadi (04-3d-pipeline §3).
 */

/**
 * Kiyim tanadan shuncha qalinroq — ichkariga botib ketmasligi uchun.
 *
 * ⚠️ 0.014 KAM EDI. Tana yuqori aniqlikda (53 000 uchburchak), kiyim esa
 * silliq naycha — ular bir-biriga juda yaqin kelganda z-fighting boshlanadi
 * va yuzada teri bilan mato almashib turgan chipor dog'lar paydo bo'ladi.
 *
 * ⚠️ 0.022 HAM YETMADI. Bu qiymat RADIAL siljish va u qobiq profiliga
 * qo'llanadi — ya'ni NOMINAL. Lokal joylarda (deltasimon mushak bo'rtigi,
 * A-pozadagi qiya qo'l, chov) haqiqiy oraliq 0.1 mm gacha siqiladi.
 * `poke.mjs` 2026-08-24 da o'lchagan: son 0.1 mm, yeng 1.1 mm, yoqa
 * 0.6 mm — hammasi z-fighting chegarasida.
 *
 * ⚠️ NOMINAL QIYMATNI KO'TARISH — YAGONA VOSITA EMAS, lekin eng arzoni:
 * kiyim 4 mm kengroq bo'ladi va bu ko'zga tashlanmaydi. Yashirish
 * (`hideBodyParts`) faqat TO'LIQ qoplangan qism uchun ishlaydi, aks holda
 * teshik qoladi — katalog izohiga qarang.
 */
const CLEARANCE = 0.026;

/**
 * Yoqa o'lchami.
 *
 * ⚠️ TORAYISH YELKADAN KEYIN BOSHLANISHI KERAK. Gavda eng keng joyi —
 * yelka, Y 1.40…1.44 orasida (rx ≈ 0.23). Toraytirish bundan pastda
 * boshlansa, kiyim o'sha balandlikda tanadan TOR bo'lib qoladi va yelkada
 * teri chiqib turadi.
 */
const COLLAR = { y: 1.45, rx: 0.1, rz: 0.09, cz: -0.095 };

/**
 * Yoqa, manjet va bel bandi uchun to'qroq tus.
 *
 * Haqiqiy kiyimda ular alohida, zichroq to'qilgan bo'lakdan tikiladi va
 * yorug'likni boshqacha qaytaradi. Bir xil rangda qoldirilsa, ular ko'zga
 * umuman tashlanmaydi va kiyim "tananing rangli nusxasi" bo'lib qolaveradi.
 */
function trimColor(color) {
  return new THREE.Color(color).multiplyScalar(0.72).getHex();
}

function fabric(color, roughness = 0.86) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
    // Uchlari ochiq — yoqa va etak chetidan ichki yuza ko'rinadi
    side: THREE.DoubleSide,
  });
}

function part(name, geometry, material) {
  addMorphTargets(geometry);

  /*
   * ⚠️ MORFDAN KEYIN QAYTA PAYVANDLANADI — va aynan shu tartib muhim.
   *
   * `addMorphTargets` morf nishonlarini yasash uchun ASOS pozitsiyani
   * suradi (og'ishlar yig'indisining yarmicha orqaga). Bu surish ba'zi
   * vertekslarni bir-biriga yaqinlashtiradi va ular BIR o'ringa tushadi —
   * lekin normallari har xil bo'lib qolaveradi.
   *
   * Natijada bitta nuqtada ikki yo'nalish qoladi va yorug'lik
   * uchburchakdan uchburchakka sakraydi: ekranda bu son bo'ylab zigzag,
   * yelkada arra tishli chok bo'lib ko'rinadi.
   *
   * Buni topish qiyin bo'ldi: `shellFromMeshes` ichida o'lchov 0 uzilish
   * berardi (u yerda payvandlash to'g'ri ishlaydi), tayyor GLB da esa
   * `pants_leg_L` da 122 uzilish — 38.6%, eng kattasi 85 daraja. Sabab
   * qobiqda emas, undan KEYINGI bosqichda edi.
   */
  weldNormals(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return attachMorphNames(mesh);
}

/**
 * Ustki kiyim gavdasi — TANA PROFILIDAN quriladi (`profiles.mjs`).
 *
 * Ilgari bu yerda o'z raqamlari bor edi va tana kengaygач kiyim unga
 * botib qolgan edi. Endi bitta manba: tana o'zgarsa kiyim ham o'zgaradi.
 */
function torsoShell({ from, to, extra, collar = false }) {
  // Haqiqiy tana o'lchovi bo'lsa o'shandan, bo'lmasa protsedural jadvaldan
  const base = measuredTorsoKeys() ?? torsoKeys(SHAPE.male);
  const keys = shellKeys(base, { from, to, extra: CLEARANCE + extra });

  if (collar) {
    /*
     * ⚠️ YELKA CHIZIG'I. Loft — naycha, va uning yuqori halqasi tana
     * profilidan olinadi: ko'krak balandligida u rx ≈ 0.22 bo'ladi. Yopqichsiz
     * qoldirilsa, kiyimda ko'krak kengligidagi ulkan teshik ochiladi va
     * futbolka yelkadan tushib turgandek ko'rinadi.
     *
     * Shuning uchun yuqorida ikkita qo'shimcha halqa: biri oraliq, ikkinchisi
     * bo'yin o'lchamida. Ular birgalikda yelka chizig'ini yasaydi.
     */
    const [topY, topRx, topRz, topCz] = keys[keys.length - 1];

    keys.push([
      (topY + COLLAR.y) / 2,
      (topRx + COLLAR.rx) / 2,
      (topRz + COLLAR.rz) / 2,
      (topCz + COLLAR.cz) / 2,
    ]);
    keys.push([COLLAR.y, COLLAR.rx, COLLAR.rz, COLLAR.cz]);
  }

  /*
   * ⚠️ UCHLARI YOPILMAYDI. Yopqich — halqa markazidan tarqaladigan yassi
   * disk. Bo'yin chizig'ida u yelka ustida ochiq osmonda qoladi va gorizontal
   * plastinka bo'lib ko'rinadi; etakda ham xuddi shunday.
   *
   * Kiyim tanaga kiydiriladi, ya'ni ichi hech qachon ko'rinmaydi — yopqich
   * kerak emas. Material esa ikki tomonlama: yoqa va etak chetida ichki
   * yuza ko'rinib qoladi.
   */
  return loft(verticalRings(keys, 3), {
    radialSegments: 22,
    capStart: false,
    capEnd: false,
  });
}

/** Yeng — yelkadan berilgan nuqtagacha */
function sleeve(at, side, { toBone, radius }) {
  const arm = side > 0 ? 'LeftArm' : 'RightArm';
  const end = side > 0 ? `Left${toBone}` : `Right${toBone}`;
  return capsuleBetween(at(arm).toArray(), at(end).toArray(), radius, 12);
}

const BUILDERS = {
  /** Futbolka — qisqa yeng */
  tshirt(at, color, shell) {
    const material = fabric(color);
    const trim = fabric(trimColor(color), 0.9);
    const group = new THREE.Group();

    group.add(
      part('tshirt_body', shell(['body_torso'], { from: 0.99, to: 1.46, offset: CLEARANCE, thickness: 0.004 }), material),
    );

    for (const side of [1, -1]) {
      const suffix = side > 0 ? 'L' : 'R';
      const arm = at(side > 0 ? 'LeftArm' : 'RightArm');
      const fore = at(side > 0 ? 'LeftForeArm' : 'RightForeArm');

      /*
       * ⚠️ KESISH SUYAK BO'YLAB, BALANDLIK BO'YICHA EMAS. Qo'l A-pozada
       * ~45° qiya turadi: balandlik bo'yicha kesilsa yeng qiyshiq qirqiladi.
       * Suyak kesmasidagi ulush esa pozaga bog'liq emas.
       *
       * ⚠️ `fromT` YELKA QALPOG'INI TO'LIQ QAMRASHI KERAK. Deltasimon mushak
       * gavdadan tashqariga bo'rtib chiqadi, ya'ni u futbolka gavdasining
       * qobig'idan (gavdadan 22 mm) TASHQARIDA qoladi. Yeng u yergacha
       * yetmasa, yelka bilan yeng orasida teri chiziq bo'lib ko'rinadi —
       * aynan shu nuqson uzoq vaqt "kiyim yirtilgan" bo'lib tuyulgan.
       * -0.9 da qirqish yelka bo'g'imidan yuqorida qoladi va butun qalpoq
       * yopiladi. Qo'ltiq ostidagi ortiqcha qism gavda ichida qoladi,
       * shuning uchun ko'rinmaydi.
       *
       * ⚠️ OFFSET GAVDANIKIDAN KICHIK — yeng gavda ICHIDAN chiqadi.
       *
       * Ilgari u kattaroq edi (`+0.005`), ya'ni yeng gavda USTIDA turardi.
       * Yelka egri sirt: yeng u bilan goh ustma-ust tushib, goh ichiga
       * kirib ketardi va qirqilgan cheti gavda sirtini kesib o'tardi —
       * ekranda bu yelka bo'ylab arra tishli chok bo'lib ko'rinardi.
       *
       * Endi yeng butunlay gavda ostida boshlanadi va faqat qo'l qismida
       * chiqadi. Ko'rinadigan chegara — gavdaning O'Z cheti, u tekis.
       * Haqiqiy futbolkada ham chok ichkarida (yeng gavdaga tikiladi).
       *
       * ⚠️ `-0.005` gacha chuqurlashtirish qo'shimcha foyda bermadi
       * (sinab ko'rildi, natija bir xil) — 2 mm yetarli.
       */
      const geometry = shell([`body_upperArm_${suffix}`], {
        axis: { start: arm.toArray(), end: fore.toArray(), fromT: -0.9, toT: 0.55 },
        offset: CLEARANCE - 0.002,
        thickness: 0.004,
      });

      group.add(part(`tshirt_sleeve_${suffix}`, geometry, material));

      // Manjet — yeng uchida, biroz tashqariroqda va to'qroq
      group.add(
        part(
          `tshirt_cuff_${suffix}`,
          shell([`body_upperArm_${suffix}`], {
            axis: { start: arm.toArray(), end: fore.toArray(), fromT: 0.46, toT: 0.55 },
            offset: CLEARANCE + 0.009,
            thickness: 0.005,
          }),
          trim,
        ),
      );
    }

    /*
     * Yoqa — bo'yin ATROFIDAGI halqa.
     *
     * ⚠️ BALANDLIK BILAN AJRATIB BO'LMAYDI. Y 1.43…1.46 da `body_torso`
     * bo'yin emas, YELKA: eni ±0.22. Balandlik bo'yicha olingan "yoqa"
     * yelkadan yelkagacha cho'zilgan plastinka bo'lib chiqadi.
     *
     * `body_neck` ham yaramaydi — u bo'yinning faqat ORQA qismi
     * (Z −0.13…−0.02), oldi gavdaga tegishli.
     *
     * Shuning uchun gavda va bo'yin birga olinadi, lekin bo'yin o'qidan
     * 9 sm ichidagi qismi — bu haqiqiy yoqa chizig'i.
     */
    group.add(
      part(
        'tshirt_collar',
        shell(['body_torso', 'body_neck'], {
          from: 1.4,
          to: 1.47,
          around: { x: 0, z: -0.075, radius: 0.09 },
          /*
           * ⚠️ GAVDA QOBIG'IDAN TASHQARIDA. Ilgari 0.016 edi, ya'ni
           * `CLEARANCE` (0.022) dan KICHIK — yoqa futbolka gavdasining
           * ICHIDA qolardi va gavda uning ustidan chiqib, bo'yin atrofida
           * shtrixli naqsh berardi.
           */
          offset: CLEARANCE + 0.004,
          thickness: 0.006,
        }),
        trim,
      ),
    );

    return group;
  },

  /** Kurtka — uzun yeng, gavdasi kengroq */
  jacket(at, color, shell) {
    const material = fabric(color, 0.72);
    const trim = fabric(trimColor(color), 0.8);
    const group = new THREE.Group();

    group.add(
      part('jacket_body', shell(['body_torso'], { from: 0.90, to: 1.46, offset: CLEARANCE + 0.014, thickness: 0.007 }), material),
    );

    for (const side of [1, -1]) {
      const suffix = side > 0 ? 'L' : 'R';
      const arm = at(side > 0 ? 'LeftArm' : 'RightArm');
      const hand = at(side > 0 ? 'LeftHand' : 'RightHand');

      const geometry = shell([`body_upperArm_${suffix}`, `body_forearm_${suffix}`], {
        axis: { start: arm.toArray(), end: hand.toArray(), fromT: -0.45, toT: 0.97 },
        offset: CLEARANCE + 0.021,
        thickness: 0.007,
      });

      group.add(part(`jacket_sleeve_${suffix}`, geometry, material));

      // Manjet — kaft oldida
      group.add(
        part(
          `jacket_cuff_${suffix}`,
          shell([`body_forearm_${suffix}`], {
            axis: { start: arm.toArray(), end: hand.toArray(), fromT: 0.86, toT: 0.97 },
            offset: CLEARANCE + 0.026,
            thickness: 0.007,
          }),
          trim,
        ),
      );
    }

    // Yoqa — kurtkada balandroq va qalinroq
    group.add(
      part(
        'jacket_collar',
        shell(['body_torso', 'body_neck'], {
          from: 1.4,
          to: 1.485,
          around: { x: 0, z: -0.075, radius: 0.098 },
          offset: 0.023,
          thickness: 0.009,
        }),
        trim,
      ),
    );

    return group;
  },

  /** Shim — beldan to'piqqacha */
  pants(at, color, shell) {
    const material = fabric(color, 0.9);
    const trim = fabric(trimColor(color), 0.85);
    const group = new THREE.Group();

    /*
     * Bel — gavdaning pastki bo'lagidan. Ichki kiyim Y 0.72 dan boshlanadi,
     * shuning uchun shim undan pastroqda tugashi kerak, aks holda ichki kiyim
     * shim ostidan chiqib turadi.
     */
    group.add(
      /*
       * ⚠️ OFFSET FUTBOLKANIKIDAN KATTA. Ikkalasi ham `body_torso` dan
       * yasaladi va Y 0.99…1.04 da UST-USTIGA tushadi. Bir xil masofada
       * bo'lsa ikki yuza aynan bir joyda yotadi va bel atrofida shtrixli
       * naqsh (z-fighting) paydo bo'ladi — ekranda mato yirtilganday.
       * Shim ko'ylak ustidan kiyiladi, shuning uchun u tashqarida.
       */
      /*
       * ⚠️ SON MESH'I HAM QO'SHILADI. O'lchandi: `body_thigh_L` eni x=0.192,
       * `body_torso` esa atigi x=0.154 — ya'ni son gavdadan KENGROQ. Faqat
       * gavdadan yasalgan qobiq songa yetmaydi va teri chanoq atrofida
       * shimdan chiqib turadi.
       */
      part(
        'pants_waist',
        shell(['body_torso', 'body_thigh_L', 'body_thigh_R'], {
          from: 0.83,
          to: 1.04,
          /*
           * ⚠️ SHTANINADAN JUDA UZOQ HAM BO'LMASIN. 14 mm sinab ko'rildi:
           * bel qobig'i shimdan ajralib, ustidan kiyilgan alohida shortik
           * bo'lib ko'rina boshladi. 5 mm — chok ko'rinmaydigan, ayni paytda
           * qatlamlar bir-biriga yopishmaydigan oraliq.
           */
          offset: CLEARANCE + 0.005,
          thickness: 0.005,
        }),
        material,
      ),
    );

    // Bel bandi — shimning eng yuqorisida, biroz qalinroq
    group.add(
      part(
        'pants_waistband',
        shell(['body_torso'], {
          from: 1.005,
          to: 1.045,
          offset: CLEARANCE + 0.011,
          thickness: 0.007,
        }),
        trim,
      ),
    );

    for (const side of [1, -1]) {
      const suffix = side > 0 ? 'L' : 'R';

      /*
       * Oyoq tik turadi, shuning uchun balandlik bo'yicha kesish yetarli —
       * yengdagi kabi suyak o'qi kerak emas.
       *
       * Pastki chegara 0.13: to'piq ochiq qoladi, krossovka o'sha yerdan
       * boshlanadi. Shimni oyoq panjasigacha tushirsak, u krossovka ichida
       * ko'rinib qolardi.
       */
      group.add(
        part(
          `pants_leg_${suffix}`,
          /*
           * Tizzada son va boldir mesh'lari ustma-ust tushadi va ularning
           * yopiq uchlari (cap) qobiqda kichik burma hosil qiladi. Qo'shimcha
           * 3 mm o'sha burmani teridan uzoqroqqa olib chiqadi.
           */
          shell([`body_thigh_${suffix}`, `body_calf_${suffix}`], {
            from: 0.13,
            to: 1.0,
            offset: CLEARANCE + 0.003,
            thickness: 0.005,
            /*
             * ⚠️ BU YERDA `smooth` ISHLATILMAYDI. Sinab ko'rildi: silliqlash
             * son va boldir qobig'ini kichraytiradi va ular tizzada bir-biridan
             * uzilib, aylana teshik bo'lib ochiladi. Silliqlash faqat poyabzalda
             * o'rinli — u yerda maqsad barmoqlar orasini to'ldirish.
             */
          }),
          material,
        ),
      );
    }

    return group;
  },

  /** Krossovka — oyoq sirtidan ustki qism va taglik */
  sneakers(at, color, shell) {
    const upper = fabric(color, 0.6);
    const sole = fabric(0x1b1724, 0.95);
    const group = new THREE.Group();

    for (const side of [1, -1]) {
      const suffix = side > 0 ? 'L' : 'R';
      const foot = at(side > 0 ? 'LeftFoot' : 'RightFoot');

      /*
       * Ustki qism oyoq panjasining o'z sirtidan. Ilgari u ellipsoid edi va
       * panja undan chiqib turardi — shuning uchun panjani yashirishga to'g'ri
       * kelardi, bu esa to'piqda yirtiq chet qoldirardi.
       *
       * Pastdan 0.022 dan boshlanadi: undan pastini taglik qoplaydi.
       */
      group.add(
        part(
          `sneaker_upper_${suffix}`,
          /*
           * ⚠️ `smooth` OLIB TASHLANMASIN. Barmoqlar orasidagi ariq surish
           * masofasidan tor — silliqlashsiz siljigan sirt o'zi bilan
           * kesishadi va krossovka uchli parchalarga bo'linib ketadi.
           */
          shell([`body_foot_${suffix}`], {
            from: 0.022,
            /*
             * Silliqlash sirtni ozgina kichraytiradi (Laplas qisqarishi),
             * shuning uchun surish masofasi shunga yarasha kattaroq —
             * aks holda barmoq uchi krossovka oldidan chiqib turadi.
             */
            offset: 0.026,
            thickness: 0.006,
            smooth: 6,
          }),
          upper,
        ),
      );

      group.add(
        part(
          `sneaker_sole_${suffix}`,
          boxAt([foot.x, 0.019, foot.z + 0.05], [0.108, 0.038, 0.257]),
          sole,
        ),
      );
    }

    return group;
  },

  /**
   * Soat — bilakka, `socket_wrist` atrofida.
   *
   * Chap bilakka qo'yiladi: o'ng qo'lda soat kamdan-kam taqiladi va ikkala
   * qo'lga qo'yish g'alati ko'rinadi.
   */
  watch(at, color) {
    const band = fabric(0x1c1a22, 0.7);
    const face = fabric(color, 0.25);
    const group = new THREE.Group();

    const wrist = at('LeftHand');
    // Bilakning bir oz yuqorisida — kaft ustida emas
    const y = wrist.y + 0.035;

    const strap = capsuleBetween(
      [wrist.x - 0.005, y + 0.02, wrist.z],
      [wrist.x - 0.005, y - 0.02, wrist.z],
      0.032,
      14,
    );
    strap.scale(0.62, 1, 1);
    group.add(part('watch_strap', strap, band));

    const dial = ellipsoidAt([wrist.x - 0.026, y, wrist.z], [0.008, 0.021, 0.021], 14);
    group.add(part('watch_face', dial, face));

    return group;
  },

  /** Kepka — gumbaz va kozirek */
  cap(at, color, shell) {
    const material = fabric(color, 0.7);
    const group = new THREE.Group();
    const head = at('Head');

    /*
     * Gumbaz KALLANING O'Z SIRTIDAN. Ilgari u ellipsoid edi va bosh unga
     * sig'masdi: kepka yuzni yopib qo'yardi. Bosh sirtidan olingan gumbaz
     * esa kallaning shaklini aynan takrorlaydi.
     *
     * 1.56 — chakka chizig'i: bundan pastda quloq va yuz boshlanadi.
     */
    group.add(
      part('cap_dome', shell(['body_head'], { from: 1.56, offset: 0.012, thickness: 0.005 }), material),
    );

    // Kozirek — old tomonga, chakka balandligida
    const visor = boxAt([0, 1.565, 0.11], [0.15, 0.014, 0.11]);
    group.add(part('cap_visor', visor, material));

    return group;
  },
};

/**
 * Katalog — nima yasaladi. `hideBodyParts` `assets_3d` jadvaliga tushadi
 * va ilova shu nomlarni yashiradi (04-3d-pipeline §2).
 *
 * ⚠️ TANA QISMI FAQAT TO'LIQ QOPLANSA YASHIRILADI. Ilgari futbolka butun
 * `body_torso` ni yashirardi, lekin gavda Y 0.83…1.46, futbolka esa
 * Y 0.97…1.39 — ya'ni bo'yin ostida va son ustida ochiq teshik qolardi va
 * qo'shni qismlarning chetlari tishli yirtiq bo'lib ko'rinardi.
 *
 * Kiyim tanadan `CLEARANCE` qadar kengroq yasaladi, shuning uchun tanani
 * yashirmasa ham u kiyim ichida qoladi. Yagona istisno — oyoq kiyim:
 * krossovka juda past poligonli va panja undan chiqib turadi.
 *
 * ⚠️ TAXMIN QILMANG, O'LCHANG: `node assets-3d/generator/poke.mjs`.
 * U har tana verteksidan ikki tomonga nur otadi va aytadi: qism kiyim
 * ichidami, tashqarisidami, yoki kiyim u yerda umuman yo'qmi. Shu
 * o'lchov 2026-08-24 da uchta xulosani berdi:
 *
 *   • `body_torso` — 0% tashqarida, eng tor oraliq 14 mm → yashirish
 *     KERAK EMAS (va yuqorida aytilgan teshikni beradi)
 *   • `body_foot_L/R` — 5% tashqarida, oraliq 0.0 mm → YASHIRILADI
 *   • son, yeng, yoqa — 0.1…1.1 mm → yashirilmaydi, lekin oraliq kichik.
 *     `CLEARANCE` shuning uchun ko'tarildi
 */
export const CATALOG = [
  {
    key: 'tshirt-white',
    builder: 'tshirt',
    slot: 'top',
    title: 'Oddiy futbolka',
    colorName: 'Oq',
    colorHex: '#F2F2F5',
    color: 0xf2f2f5,
    hideBodyParts: [],
  },
  {
    key: 'tshirt-black',
    builder: 'tshirt',
    slot: 'top',
    title: 'Oddiy futbolka',
    colorName: 'Qora',
    colorHex: '#1C1A22',
    color: 0x1c1a22,
    hideBodyParts: [],
  },
  {
    key: 'tshirt-violet',
    builder: 'tshirt',
    slot: 'top',
    title: 'Oddiy futbolka',
    colorName: 'Binafsha',
    colorHex: '#8B5CF6',
    color: 0x8b5cf6,
    hideBodyParts: [],
  },
  {
    key: 'jacket-denim',
    builder: 'jacket',
    slot: 'outer',
    title: 'Jinsi kurtka',
    colorName: "Ko'k",
    colorHex: '#3B5A8C',
    color: 0x3b5a8c,
    /*
     * ⚠️ QO'L YASHIRILADI, GAVDA YASHIRILMAYDI — sabab o'lchovda.
     *
     * Kurtka yengi `fromT: -0.45 … toT: 0.97` bilan yelkadan kaftgacha
     * boradi, ya'ni qo'lni TO'LIQ qoplaydi — yashirilsa teshik qolmaydi.
     * Gavda esa boshqa: kurtka Y 0.90…1.46, `body_torso` 0.83…1.46 —
     * yashirilsa son ustida ochiq teshik qolardi (katalog izohi).
     *
     * ⚠️ NEGA OFFSET YETMAYDI: yeng TO'G'RI o'q bilan yasaladi
     * (`start: arm, end: hand`), qo'l esa tirsakda buriladi. Shuning
     * uchun 47 mm nominal offset ham tirsakda 0.2 mm gacha siqiladi va
     * radial offsetni oshirish bunga yordam bermaydi. To'g'ri yechim —
     * yengni ikki bo'g'imga bo'lib qurish, lekin bu generator ishi;
     * hozircha yashirish z-fightingni butunlay yo'q qiladi.
     */
    hideBodyParts: [
      'body_upperArm_L',
      'body_upperArm_R',
      'body_forearm_L',
      'body_forearm_R',
    ],
  },
  {
    key: 'pants-graphite',
    builder: 'pants',
    slot: 'bottom',
    title: 'Klassik shim',
    colorName: 'Grafit',
    colorHex: '#3A3746',
    color: 0x3a3746,
    hideBodyParts: ['underwear_briefs'],
  },
  {
    key: 'pants-beige',
    builder: 'pants',
    slot: 'bottom',
    title: 'Chino shim',
    colorName: 'Bej',
    colorHex: '#C8B79A',
    color: 0xc8b79a,
    hideBodyParts: ['underwear_briefs'],
  },
  {
    key: 'sneakers-white',
    builder: 'sneakers',
    slot: 'feet',
    title: 'Krossovka',
    colorName: 'Oq',
    colorHex: '#EDEDF2',
    color: 0xededf2,
    /*
     * ⚠️ PANJA YASHIRILADI. Yuqoridagi izoh buni "yagona istisno" deb
     * yozgan, lekin ro'yxat bo'sh qolgan edi. `poke.mjs` o'lchovi:
     * panjaning 5% i krossovkadan tashqarida va eng tor oraliq 0.0 mm —
     * ya'ni yuzalar ustma-ust tushadi va z-fighting beradi.
     *
     * Bu yerda teshik xavfi yo'q (gavdadan farqli): krossovka butun
     * panjani qoplaydi, ochiq qoladigan qismi yo'q.
     */
    hideBodyParts: ['body_foot_L', 'body_foot_R'],
  },
  {
    key: 'sneakers-black',
    builder: 'sneakers',
    slot: 'feet',
    title: 'Krossovka',
    colorName: 'Qora',
    colorHex: '#201D28',
    color: 0x201d28,
    hideBodyParts: ['body_foot_L', 'body_foot_R'],
  },
  {
    key: 'watch-steel',
    builder: 'watch',
    slot: 'wrist',
    title: 'Qo‘l soati',
    colorName: 'Kumush',
    colorHex: '#C9CCD4',
    color: 0xc9ccd4,
    // Soat tana qismini yashirmaydi — u kaft ustida turadi
    hideBodyParts: [],
  },
  {
    key: 'watch-gold',
    builder: 'watch',
    slot: 'wrist',
    title: 'Qo‘l soati',
    colorName: 'Oltin',
    colorHex: '#C9A227',
    color: 0xc9a227,
    hideBodyParts: [],
  },
  {
    key: 'cap-black',
    builder: 'cap',
    slot: 'head',
    title: 'Kepka',
    colorName: 'Qora',
    colorHex: '#1C1A22',
    color: 0x1c1a22,
    // Kepka tana qismini yashirmaydi — soch alohida hal qilinadi
    hideBodyParts: [],
  },
  {
    key: 'cap-violet',
    builder: 'cap',
    slot: 'head',
    title: 'Kepka',
    colorName: 'Binafsha',
    colorHex: '#8B5CF6',
    color: 0x8b5cf6,
    hideBodyParts: [],
  },
];

/**
 * `shell({ from, to, offset })` — gavda qobig'ini tananing o'z sirtidan
 * qaytaradi (`bodyShell.mjs`). Faqat ustki kiyimlarga kerak; qo'l va oyoq
 * kapsulalari suyak o'rinlaridan yasaladi.
 */
export function buildGarment(spec, at, shell) {
  const build = BUILDERS[spec.builder];
  if (!build) throw new Error(`Noma'lum kiyim turi: ${spec.builder}`);

  const group = build(at, spec.color, shell);
  group.name = spec.key;
  return group;
}
