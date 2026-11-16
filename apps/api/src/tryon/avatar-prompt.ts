/**
 * O'lchovlardan AI uchun tavsif tuzish.
 *
 * ⚠️ BU FAYL NATIJA SIFATINI BELGILAYDI. `model-create` da o'lcham
 * boshqaruvi yo'q — faqat matnli tavsif bor. Ya'ni bo'y, gavda tuzilishi
 * va poza shu yerdagi so'zlar orqali beriladi va boshqa yo'l yo'q.
 *
 * Uchta narsa majburiy va ularning har biri sababi bilan:
 *
 *   1. TO'LIQ GAVDA, boshdan oyoqgacha — kiyintirish modeli kesilgan
 *      suratda ishlamaydi (`PoseError` qaytaradi).
 *   2. TIK POZA, qo'llar yon tomonda — qo'l tanaga yopishsa yeng
 *      noto'g'ri joylashadi.
 *   3. TOR, BIR RANGLI ASOSIY KIYIM — kiyintirish modeli mavjud kiyim
 *      ustiga yangisini qo'yadi. Keng yoki naqshli kiyim yangisining
 *      chegarasini buzadi.
 *
 * Sof funksiya: tarmoqqa chiqmaydi, shuning uchun sinovdan o'tkazsa bo'ladi.
 */

export interface AvatarMeasurements {
  height?: number;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  /** Mijoz tanlagan razmerlar — gavda hajmiga qo'shimcha ishora */
  topSize?: string;
  bottomSize?: string;
}

/**
 * «wears size L tops and M trousers» — razmer gavda hajmini modelga
 * odamcha tilda aytadi. Ko'krak/bel (sm) o'rniga keldi: mijoz ularni
 * endi kiritmaydi, razmerni esa tanlaydi.
 */
function sizeHint(measurements: AvatarMeasurements): string | null {
  const parts = [
    measurements.topSize ? `size ${measurements.topSize} tops` : null,
    measurements.bottomSize ? `size ${measurements.bottomSize} trousers` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `wears ${parts.join(' and ')}` : null;
}

export type AvatarGender = 'male' | 'female' | null;

/**
 * Ko'rish burchagi.
 *
 * ⚠️ NEGA ATIGI UCHTA: har burchak alohida generatsiya, ya'ni alohida
 * kredit. Beshta yoki sakkizta burchak silliqroq aylanish berardi, lekin
 * xarajat shuncha barobar oshardi. Uchtasi "aylantirish" hissini beradi
 * va odam o'zini yon tomondan ko'ra oladi — asosiy ehtiyoj shu.
 */
export type AvatarAngle = 'front' | 'side' | 'back';

/**
 * Burchak tavsifi.
 *
 * ⚠️ KIYINTIRISH MODELI FAQAT OLDINDAN ISHLAYDI. Yon va orqa burchaklar
 * avatarni ko'rish uchun; ularga kiyim kiydirib bo'lmaydi va ilova ham
 * urinmaydi.
 */
const ANGLE_TEXT: Record<AvatarAngle, string> = {
  /*
   * ⚠️ BURCHAK 45 DAN 10–15 GA TUSHIRILDI (2026-09-23).
   *
   * Ilgari bu yerda «45 daraja» va «do not make the body face straight
   * forward» turardi. Natijada avatar yonboshlab turardi va kiyim
   * kiydirilganda uning old tomoni — naqsh, yoqa, tugmalar — qiyshiq
   * ko'rinardi. Mijoz esa kiyimni aynan oldindan ko'rishi kerak.
   *
   * ⚠️ IKKALA QO'L HAM CHO'NTAKDA QOLADI: yeng va yon chok toza
   * ko'rinadi, qo'l tanaga yopishmaydi.
   */
  front:
    'Standing upright with the torso turned about 40 degrees to the LEFT into a dynamic ' +
    'three-quarter pose — the left shoulder is closer to the camera and the right shoulder ' +
    'further back — while the FACE turns directly toward the camera with a calm, confident ' +
    'expression and clear eye contact. Both hands rest casually inside the trouser pockets, ' +
    'elbows relaxed and slightly away from the body. The feet are shoulder-width apart, ' +
    'planted flat. Keep the body axis upright, with relaxed shoulders, an elegant confident ' +
    'stance, realistic anatomy and no exaggerated curve or lean.',
  side:
    'The whole body turned 90 degrees so we see a clean full side profile, facing the LEFT ' +
    'edge of the image. Standing straight, arms relaxed at the sides and slightly away from ' +
    'the body, feet slightly apart. The face is seen in profile.',
  back:
    'Seen directly from behind — the back of the head and the back of the clothing face the ' +
    'camera, the face is NOT visible. Standing straight, arms relaxed at the sides and ' +
    'slightly away from the body, feet shoulder-width apart.',
};

/**
 * Gavda tuzilishi — bo'y va vazndan.
 *
 * Tana massasi indeksi ishlatiladi, chunki u ikkala o'lchovni birlashtiradi:
 * 180 sm/60 kg va 160 sm/60 kg butunlay boshqa gavda, lekin vazn bir xil.
 *
 * Chegaralar tibbiy tasnifdan emas, VIZUAL farqdan olingan — maqsad
 * tashxis emas, suratda tanib olinadigan tuzilish.
 */
function buildFromBmi(height?: number, weight?: number): string {
  if (!height || !weight || height < 100) return 'average build';

  const bmi = weight / (height / 100) ** 2;

  if (bmi < 18.5) return 'slim, slender build';
  if (bmi < 24) return 'average, healthy build';
  if (bmi < 29) return 'solid, slightly heavier build';
  return 'full, heavy-set build';
}

/**
 * Gavda shakli — ko'krak, bel va son nisbatidan.
 *
 * Bu BMI ustiga qo'shimcha: bir xil vazndagi ikki odam butunlay boshqa
 * shaklda bo'lishi mumkin. O'lchovlar to'liq bo'lmasa umuman aytilmaydi —
 * noto'g'ri tavsif bermaslik uchun.
 */
function shapeFrom(measurements: AvatarMeasurements): string | null {
  const { chest, waist, hips } = measurements;
  if (!chest || !waist || !hips) return null;

  // Sezilarli farq deb 5% dan ortig'i olinadi — undan kichigi suratda ko'rinmaydi
  const broadShoulders = chest > hips * 1.05;
  const wideHips = hips > chest * 1.05;
  const definedWaist = waist < Math.min(chest, hips) * 0.85;

  if (broadShoulders && definedWaist) return 'broad shoulders and a defined waist';
  if (wideHips && definedWaist) return 'narrow waist and fuller hips';
  if (broadShoulders) return 'broad shoulders';
  if (wideHips) return 'fuller hips';
  if (!definedWaist) return 'a straight, even torso';

  return null;
}

/**
 * Asosiy kiyim — bir rangli va TANANI YOPADIGAN.
 *
 * ⚠️ «fitted», «leggings» va «shorts» ATAYIN OLIB TASHLANDI.
 *
 * OpenAI so'rovni `safety_violations=[sexual]` bilan rad etgan edi.
 * Tavsifning o'zi zararsiz, lekin so'rov ichida tirik odamning yuz
 * surati bor va undan fotorealistik gavda so'raladi — bu klassifikator
 * uchun sezgir birikma. Tanaga urg'u beradigan so'zlar shu ehtimolni
 * oshiradi, uzun va bo'sh kiyim esa kamaytiradi.
 *
 * Kiyim baribir bir rangli va sodda bo'lib qoladi, ya'ni ustiga
 * kiyintirilgan mahsulot aniq ko'rinadi — maqsad buzilmaydi.
 */
function baseLayer(gender: AvatarGender): string {
  void gender;
  return 'a plain light grey t-shirt and plain light grey trousers';
}

function personWord(gender: AvatarGender): string {
  if (gender === 'male') return 'man';
  if (gender === 'female') return 'woman';
  return 'person';
}

/**
 * Yakuniy tavsifni tuzadi.
 *
 * ⚠️ TAVSIF INGLIZ TILIDA. Model ingliz tilida o'qitilgan va o'zbekcha
 * tavsif sezilarli yomon natija beradi. Bu foydalanuvchiga ko'rinmaydi.
 */
export function buildAvatarPrompt(
  gender: AvatarGender,
  measurements: AvatarMeasurements,
  angle: AvatarAngle = 'front',
): string {
  const parts: string[] = [];

  const person = personWord(gender);
  const height = measurements.height ? `${Math.round(measurements.height)} cm tall` : null;
  const build = buildFromBmi(measurements.height, measurements.weight);
  const shape = shapeFrom(measurements);

  // 1-jumla: kim
  const sizes = sizeHint(measurements);
  parts.push(
    `Full-body studio photograph of a ${person}, ${[height, build].filter(Boolean).join(', ')}` +
      (shape ? `, with ${shape}` : '') +
      (sizes ? `, who ${sizes}` : '') +
      '.',
  );

  /*
   * 2-jumla: poza va kadr.
   *
   * ⚠️ KADR TALABI HAR BURCHAKDA BIR XIL. To'liq gavda va kesilmagan kadr
   * — kiyintirish modeli buni talab qiladi, lekin bu yerda yana bir sabab
   * bor: burchaklar orasida almashtirilganda odam bir xil o'lchamda
   * turishi kerak, aks holda "aylanish" emas, sakrash bo'lib ko'rinadi.
   */
  parts.push(
    `${ANGLE_TEXT[angle]} The entire body is visible from head to feet, nothing is cropped. ` +
      'Same distance and framing in every view. ' +
      // ⚠️ BOSH O'LCHAMI (so'rovga ko'ra, 2026-11-16). Yuz surati ko'pincha
      // yaqin olingan selfi — model boshni gavdaga nisbatan katta qilib
      // qo'yadi. Yuz faqat shaxsni aniqlash uchun; yaqin kadr bosh o'lchamiga
      // ta'sir qilmasin.
      'HEAD-TO-BODY PROPORTION: keep the head at a natural, realistic size for an adult body ' +
      '(about one seventh to one eighth of the standing height). The reference face photo may ' +
      'be a tight close-up used ONLY for identity — its framing must NOT enlarge the head. No ' +
      'oversized, zoomed-in, bobble-head or caricature head; keep well-balanced proportions.',
  );

  // 3-jumla: kiyim — yangisi ustiga qo'yiladi
  parts.push(`Wearing ${baseLayer(gender)}.`);

  // 4-jumla: SHAFFOF fon — orqa fon umuman bo'lmaydi (grey/oq quti yo'q),
  // avatar sahnaga singadi. `background: transparent` param bilan birga ishlaydi.
  parts.push(
    'The subject is fully isolated on a transparent background — absolutely no background, ' +
      'no floor, no wall and no shadow behind the person, only the cut-out figure. Soft even ' +
      'lighting on the subject, sharp focus, photorealistic.',
  );

  return parts.join(' ');
}

/**
 * YUZ QULFI — foydalanuvchi o'zini tanishi kerak (2026-09-25, so'rovga ko'ra).
 *
 * ⚠️ «same person» YETMAYDI. Model yuzni «o'xshash» qilib qayta chizadi:
 * chiroyliroq, yoshroq, silliqroq — va foydalanuvchi o'zini tanimaydi.
 * Shuning uchun yuzning HAR BIR qismi nomma-nom sanaladi va nima
 * qilinmasligi ochiq aytiladi. Bu band qisqartirilmaydi.
 *
 * Kengaytmada nusxasi bor: `apps/browser-extension/src/shared/prompt.ts`
 * → FACE_LOCK. Biri o'zgarsa ikkinchisi ham o'zgarsin.
 */
export function faceLock(panels: boolean): string {
  return [
    '🔒 FACE LOCK — HIGHEST PRIORITY RULE, OVERRIDES EVERYTHING ELSE.',
    'This is a COMPOSITING task: CROP the face from image 1 and PASTE it onto the generated body ' +
      'with ZERO modification. The face is a protected region. Treat image 1 as a locked, ' +
      'read-only input.',
    'If you cannot preserve the exact face from image 1, OUTPUT NOTHING rather than output a ' +
      'different-looking person. A "similar" face is a FAILED output.',
    'KEEP IDENTICAL to image 1, pixel-for-pixel: face shape, jawline, chin, cheekbones, forehead, ' +
      'hairline, hair colour and style, eyes (shape, colour, spacing, lid shape), eyebrows (shape, ' +
      'thickness, arch), nose (bridge, tip, nostrils, width), lips (shape, thickness, mouth width), ' +
      'teeth, ears, skin tone, skin texture, pores, facial hair (every hair), moles, freckles, ' +
      'scars, wrinkles, apparent age, ethnicity, and facial expression.',
    'ABSOLUTELY FORBIDDEN: beautifying, slimming, smoothing, blurring, de-aging, retouching, ' +
      'symmetrising, enlarging eyes, sharpening jaw, straightening nose, whitening teeth, ' +
      'lightening skin, removing moles / freckles / wrinkles, changing hairstyle, changing hair ' +
      'colour, changing expression, aligning with any beauty standard, or blending with any other ' +
      'face. ZERO "improvements". The reference face is the ground truth — reproduce it as-is.',
    'The face you render must be instantly recognisable to the person themselves and to their ' +
      'family as THIS SPECIFIC PERSON, not a prettier or younger version.',
    panels
      ? 'ALL THREE PANELS show the IDENTICAL face from image 1. Front view: the face from image 1 ' +
        'facing camera. Side view: the TRUE profile of that same face (same nose silhouette, same ' +
        'lip shape, same chin, same brow line, same ear). Back view: hairstyle, hair colour, head ' +
        'shape, ears and neckline match image 1 exactly.'
      : /*
         * ⚠️ TO'LIQ BO'YLI KADRDA YUZ KICHIK (2026-11-11, so'rovga ko'ra).
         * Kichik yuzni model soddalashtirishga moyil — shuning uchun ochiq
         * aytiladi. «do not zoom in» SHART: usiz «yuzni aniq chiz» buyrug'i
         * kadrni yaqinlashtirib, oyoqlarni kesib yuborishi mumkin.
         */
        'Hairstyle, hair colour, hair parting and hair volume stay exactly as in image 1. ' +
        'This is a full-body shot, so the face is small in the frame — that is NOT a licence to ' +
        'simplify it: render the face in sharp focus with every feature of image 1 intact, never ' +
        'soft, blurred, generic or averaged. Keep the full-body framing — do not zoom in or crop.',
    '🔒 FINAL CHECK before output: compare your rendered face side-by-side with image 1. If any ' +
      'feature differs, REDRAW using image 1 as the exact template. Only output when the two faces ' +
      'are the same person.',
  ].join(' ');
}

/**
 * Operator uchun avatar prompti — YAKKA OLD KO'RINISH (2026-11-11, so'rovga
 * ko'ra). Operator bu matnni panelda nusxalab, yuz surati bilan birga
 * brauzerdagi AI ga beradi va bitta tik portret oladi.
 *
 * Ilgari bu yerda uch burchakli varaq (old · yon · orqa) so'ralardi. Ilova
 * endi faqat old ko'rinishni ko'rsatadi; varaqda esa har figura kadrning
 * uchdan biri edi va yuzga bir necha o'n piksel qolardi — o'xshashlik uchun
 * ham, yuz almashtirish (`facefusion`) uchun ham kam.
 *
 * ⚠️ «turnaround sheet» VA «PANEL 1» SO'ZLARI BU MATNDA BO'LMASLIGI KERAK.
 * Yangilanmagan kengaytma varaqni aynan shu ikki so'zdan taniydi va topsa
 * landshaft natija kutadi — tik portretni rad etardi.
 *
 * ⚠️ KIYIM ALOHIDA «CLOTHING:» SATRIDA. Yangilanmagan kengaytma do'kon
 * kiyimini qo'shsa shu satrni butunlay olib tashlaydi; kiyim boshqa
 * jumlaga qo'shilib ketsa ikki ko'rsatma urishardi.
 *
 * ⚠️ FON — SHAFFOF PNG, HAR DOIM. Surat to'g'ridan-to'g'ri sahnaga
 * qo'yiladi; oq yoki kulrang fon qolsa avatar qutida turgandek ko'rinadi.
 */
export function buildAvatarFrontPrompt(
  gender: AvatarGender,
  measurements: AvatarMeasurements,
): string {
  const person = personWord(gender);
  const height = measurements.height ? `${Math.round(measurements.height)} cm tall` : null;
  const build = buildFromBmi(measurements.height, measurements.weight);
  const shape = shapeFrom(measurements);
  const sizes = sizeHint(measurements);
  const who =
    `a ${person}, ${[height, build].filter(Boolean).join(', ')}` +
    (shape ? `, with ${shape}` : '') +
    (sizes ? `, who ${sizes}` : '');

  return [
    '🔒 YOU ARE EDITING A PHOTO OF A REAL PERSON. The reference photo is the face of that real ' +
      'person — the single most important input. If the output face does not match the ' +
      'reference photo, you have FAILED the task.',

    'Create ONE single image: a photorealistic full-body FRONT view portrait of the person in ' +
      `the reference photo — ${who}.`,

    'ONE FIGURE, FRONT VIEW ONLY: the person appears exactly ONCE in the image, seen from the ' +
      'front. No side view, no back view, no second pose, no mirror image, no multi-panel or ' +
      'collage layout, no inset close-ups.',

    faceLock(false),

    `POSE: ${ANGLE_TEXT.front}`,

    'FRAMING: vertical full-body shot — the entire body is visible from head to feet with a ' +
      'small empty margin above the head and below the feet, nothing is cropped. Eye-level ' +
      'camera, straight on, no tilt. The figure is centered horizontally and fills about ' +
      '85–90% of the image height.',

    // ⚠️ BOSH O'LCHAMI (so'rovga ko'ra, 2026-11-16) — yaqin selfi'dan bosh katta chiqmasin.
    'HEAD-TO-BODY PROPORTION: render the head at a natural, realistic size for an adult body ' +
      '(about one seventh to one eighth of the standing height). The reference face photo may ' +
      'be a tight close-up used ONLY for identity — its close framing must NOT enlarge the ' +
      'head. Never render an oversized, zoomed-in, bobble-head or caricature-like head.',

    `CLOTHING: ${baseLayer(gender)}.`,

    'BACKGROUND: fully TRANSPARENT PNG with an alpha channel — no background colour at all, no ' +
      'floor, no wall, no ground shadow, no reflection, no text, labels, numbers or watermarks. ' +
      'Only the cut-out figure.',

    'OUTPUT: exactly ONE image — vertical portrait 2:3 (for example 1024x1536), PNG with ' +
      'transparency. Soft even studio lighting on the subject, sharp focus, photorealistic.',

    /* ⚠️ RECENCY — oxirgi gap modelga eng kuchli ta'sir qiladi, yuz qulfi qisqa takrorlanadi. */
    '🔒 REMEMBER: the face MUST be the exact face from the reference photo. If the final face ' +
      'differs in ANY feature, the output is wrong. Do not idealise, do not beautify, do not ' +
      '"improve" — copy the reference face as-is.',
  ].join('\n\n');
}

/**
 * Tavsifni tuzish uchun yetarli ma'lumot bormi.
 *
 * ⚠️ BO'Y MAJBURIY. U bo'lmasa model o'rtacha bo'yli odam yasaydi va
 * foydalanuvchi o'zini tanimaydi — bu esa butun g'oyani buzadi. Qolgan
 * o'lchovlar tavsifni aniqlashtiradi, lekin ularsiz ham ishlaydi.
 */
export function missingForAvatar(measurements: AvatarMeasurements): string | null {
  if (!measurements.height) return "bo'y";
  if (!measurements.weight) return 'vazn';
  return null;
}
