/**
 * Kiyintirish prompti — brauzerdagi AI uchun.
 *
 * ⚠️ IKKI NUSXA BOR VA BU ATAYLAB. Server `apps/api/src/integrations/openai.ts`
 * da OpenAI API uchun promptni tuzadi; bu yerdagi nusxa esa brauzerdagi AI
 * uchun. Ularni bitta paketga chiqarib bo'lmaydi: kengaytma omborning npm
 * bog'liqliklarini ko'rmaydi (u alohida `dist` bo'lib yuklanadi).
 *
 * ⚠️ SERVERNIKIDAN ATAYLAB FARQ QILADI. `openai.ts` dagi prompt API
 * uchun: u «bu odamni shu kiyimga kiydir» deb buyuradi va kadrni asl
 * suratdan oladi. Bu yerdagisi esa TO'LIQ BO'YLI MODA SURATINI
 * so'raydi — poza, fon va yorug'lik bilan. Sabab: brauzerdagi model
 * kadrni baribir qaytadan chizadi, ya'ni uni aniq boshqarmasak natija
 * tasodifiy chiqadi (goh kesilgan, goh qorong'i fonda).
 *
 * ⚠️ IDENTIKLIK JUMLALARI IKKALASIDA HAM BIR XIL QOLADI — ular sifat
 * emas, TANIB OLISH masalasi.
 */

export type GarmentKind = 'tops' | 'bottoms' | 'one-pieces' | 'footwear' | 'auto';

export function garmentKindForSlot(slot: string): GarmentKind {
  switch (slot) {
    case 'top':
    case 'outer':
      return 'tops';
    case 'bottom':
      return 'bottoms';
    case 'dress':
      return 'one-pieces';
    case 'feet':
      return 'footwear';
    default:
      return 'auto';
  }
}

/** Kiyim qayerga kiyiladi — model buni aniq bilishi kerak. */
const PLACEMENT: Record<GarmentKind, string> = {
  tops: 'as the upper-body garment',
  bottoms: 'as the lower-body garment',
  'one-pieces': 'as the full-body garment (dress/jumpsuit)',
  footwear: 'on the feet, as footwear',
  auto: 'in its natural position on the body',
};

/**
 * Komplektning QOLGAN qismi.
 *
 * ⚠️ AYTILMASA NATIJA MODA SURATIGA O'XSHAMAYDI. Faqat bitta kiyim
 * berilsa model qolganini o'zi to'qiydi: ko'ylak ustidan pijama shim
 * yoki yalangoyoq chiqadi va mijoz bunday suratdan kiyimni tasavvur
 * qila olmaydi. Qolgani ATAYLAB bir rangli va sodda — e'tibor
 * sotilayotgan kiyimda qolishi kerak.
 */
const REST_OF_OUTFIT: Record<GarmentKind, string> = {
  tops: 'Complete the look with plain black trousers and clean white sneakers.',
  bottoms: 'Complete the look with a plain black T-shirt and clean white sneakers.',
  'one-pieces': 'Complete the look with clean white sneakers.',
  footwear: 'Complete the look with a plain black T-shirt and plain black trousers.',
  auto: 'Complete the look with plain, simple neutral clothing.',
};

/**
 * Poza va kadr — moda surati uslubi.
 *
 * ⚠️ «mirrored from the previous pose» KABI JUMLALAR BO'LMASLIGI KERAK.
 * Har so'rov YANGI suhbatda ketadi (`freshChat`), ya'ni modelda
 * «oldingi poza» degan narsa yo'q va bunday ko'rsatma uni chalg'itadi.
 */
/*
 * ⚠️ POZA AVATARNING OLD KO'RINISHI BILAN BIR XIL (2026-09-25).
 * Avatar old ko'rinishda tanasi ~40° CHAPGA burilgan holda yasaladi
 * (`apps/api/src/tryon/avatar-prompt.ts` → ANGLE_TEXT.front). Ilgari bu
 * yerda «10–15 daraja» turardi — model kiyim kiydirayotib pozani
 * o'zgartirib yuborardi va mijoz avatar bilan kiyim natijasida ikki xil
 * odamni ko'rardi.
 */
const POSE =
  'Keep EXACTLY the same pose, body angle and framing as the person in the first image: the ' +
  'torso turned about 40 degrees to the LEFT in a three-quarter pose (left shoulder closer to ' +
  'the camera), the FACE turned directly toward the camera with a calm, confident expression, ' +
  'BOTH hands resting casually inside the trouser pockets, elbows relaxed and slightly away ' +
  'from the body, feet shoulder-width apart and planted flat. Body axis upright, realistic ' +
  'anatomy, no exaggerated curve or lean.';

/*
 * ⚠️ FON — SHAFFOF PNG, HAR DOIM. Natija ilovada sahna ustiga qo'yiladi;
 * kulrang studiya foni qolsa odam qutida turgandek ko'rinardi. Server
 * avatari ham shaffof (`background: transparent`) — ikkalasi bir xil
 * bo'lishi shart.
 */
const SCENE =
  'Vertical full-body shot: the entire body is visible from head to feet with a little space ' +
  'above the head and below the feet, nothing is cropped. Camera slightly below chest height, ' +
  'straight on, no tilt. FULLY TRANSPARENT background — PNG with an alpha channel: no ' +
  'background colour, no floor, no wall, no ground shadow, only the cut-out figure. Soft ' +
  'cinematic lighting on the subject, high-end fashion photography.';

/**
 * YUZ QULFI — serverdagi `faceLock` ning nusxasi
 * (`apps/api/src/tryon/avatar-prompt.ts`). Biri o'zgarsa ikkinchisi ham.
 *
 * ⚠️ «same person» YETMAYDI: model yuzni «o'xshash», chiroyliroq va
 * yoshroq qilib qayta chizadi. Shuning uchun har qism nomma-nom sanaladi.
 */
function faceLock(panels: boolean): string {
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

export interface Measurements {
  height?: number;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  /** Mijoz tanlagan razmerlar (XS … 3XL) */
  topSize?: string;
  bottomSize?: string;
}

/**
 * O'lchov jumlasi — mijozning HAQIQIY razmeri.
 *
 * ⚠️ NEGA KERAK, AVATARDA GAVDA KO'RINIB TURGANIDA HAM. Model kiyimni
 * ko'pincha «katalog o'lchamida» chizadi: tor gavdaga keng kurtkani
 * yopishtiradi yoki teskarisi. Raqamlar berilganda o'tirish (fit) aniq
 * bo'ladi — mijoz o'ziga to'g'ri kelmaydigan o'lchamni sotib olmaydi.
 *
 * ⚠️ BO'SH BO'LSA UMUMAN YOZILMAYDI. «unknown size» kabi jumla modelga
 * hech narsa bermaydi, lekin promptni suyultiradi.
 */
function fitLine(measurements: Measurements): string | null {
  const parts: string[] = [];
  if (measurements.height) parts.push(`${Math.round(measurements.height)} cm tall`);
  if (measurements.weight) parts.push(`${Math.round(measurements.weight)} kg`);
  if (measurements.chest) parts.push(`chest ${Math.round(measurements.chest)} cm`);
  if (measurements.waist) parts.push(`waist ${Math.round(measurements.waist)} cm`);
  if (measurements.hips) parts.push(`hips ${Math.round(measurements.hips)} cm`);
  // Razmer — mijoz o'zi tanlagan; kiyim shu razmerda o'tirgandek chizilsin
  if (measurements.topSize) parts.push(`wears size ${measurements.topSize} tops`);
  if (measurements.bottomSize) parts.push(`wears size ${measurements.bottomSize} trousers`);

  if (parts.length === 0) return null;

  return (
    `This person is ${parts.join(', ')} — fit the garment to those real measurements: ` +
    'it must drape as their true size would, neither tighter nor looser, ' +
    'and their body proportions must not change to suit the garment.'
  );
}

export interface PromptInput {
  kind: GarmentKind;
  /** Yuz surati alohida manba sifatida berildimi */
  face: boolean;
  measurements: Measurements;
  /** `man` / `woman` — poza va kiyim tavsifi shunga qarab yoziladi */
  gender?: string | null;
}

/**
 * Ko'p kiyimni BIR CHAQIRUVDA kiyintirish (2026-11-06, Look rejimi).
 *
 * Mijoz 3-4 kiyim tanlab «Birdaniga kiyintir» bossa, serverda bitta GPT
 * chaqiruvi bilan hammasi birga kiyintiriladi — ketma-ket zanjir o'rniga.
 * Natija: ~15 soniya, barcha kiyimlar bitta kadrda, bir xil nur va poza.
 *
 * Fayl tartibi: [gavda, kiyim1, kiyim2, …, kiyimN, (yuz)]. Promptda har
 * qaysi kiyim qaysi slotga qo'yilishi aniq aytilganidan tartib raqamlari
 * modelga MUHIM — fayllarni shu tartibda biriktiring.
 */
export interface OutfitPromptInput {
  garments: Array<{ kind: GarmentKind }>;
  face: boolean;
  measurements: Measurements;
  gender?: string | null;
}

export function buildOutfitTryonPrompt(input: OutfitPromptInput): string {
  const person = input.gender === 'female' ? 'woman' : input.gender === 'male' ? 'man' : 'person';

  const lines = [
    `Full-body fashion portrait of the same ${person} as in the reference image, photorealistic.`,
    POSE,
    faceLock(false),
    'Do NOT redraw or re-generate the face in any way — only the clothing changes.',
  ];

  const fit = fitLine(input.measurements);
  if (fit) lines.push(fit);

  /*
   * Har kiyim o'z joyida: second image -> upper body, third -> lower body, ...
   * Model `PLACEMENT` tavsifi bilan aniq joyini biladi.
   */
  const ORDINAL = ['second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
  input.garments.forEach((g, i) => {
    const n = ORDINAL[i] ?? `${i + 2}nd`;
    lines.push(
      `The ${n} image is a garment to wear ${PLACEMENT[g.kind]}.`,
      `Reproduce it EXACTLY: same colour, pattern, cut, details and any printed artwork — it is a real product being sold.`,
    );
  });

  lines.push(
    'Put ALL of these garments on the person at the SAME TIME, as a complete outfit.',
    'Each garment goes to its own body region — do not substitute, merge or drop any of them.',
    'Respect natural layering: lower garments are visible where the upper ones do not cover; footwear sits on the feet; outerwear sits on top of tops.',
  );

  if (input.face) {
    const n = ORDINAL[input.garments.length] ?? `${input.garments.length + 2}nd`;
    lines.push(
      `The ${n} image is a close-up reference of the same person's face.`,
      'Match the facial features, bone structure and skin tone to that reference exactly.',
      `Use the ${n} image ONLY for the face — take the body and build from the first image.`,
      'If the face in the first image looks AI-generated or slightly off, restore the true identity from that reference.',
    );
  }

  lines.push(
    SCENE,
    'Natural fabric folds and realistic fit. No text or watermarks added.',
    'Output exactly one image. Do not ask questions, do not explain, do not offer alternatives.',
  );

  return lines.join(' ');
}

export function buildTryonPrompt(input: PromptInput): string {
  const person = input.gender === 'female' ? 'woman' : input.gender === 'male' ? 'man' : 'person';

  const lines = [
    `Full-body fashion portrait of the same ${person} as in the reference image, photorealistic.`,
    POSE,

    /*
     * ⚠️ YUZ ENG OG'RIQLI JOY VA BU JUMLALAR QISQARTIRILMAYDI. Bitta
     * «unchanged» yetmagan: model yuzni qayta chizib, «chiroyliroq»
     * qilib qo'yardi va foydalanuvchi o'zini tanimasdi. Buyruq uch
     * qatlamda: NIMA qilma, QAYERGACHA, va KIMGA o'xshasin.
     */
    faceLock(false),
    'Do NOT redraw or re-generate the face in any way — only the clothing changes.',
  ];

  const fit = fitLine(input.measurements);
  if (fit) lines.push(fit);

  /*
   * ⚠️ RAQAM TARTIBI BIRIKTIRISH TARTIBI BILAN BOG'LIQ. Fayllar
   * `[gavda, kiyim, yuz]` tartibida tashlanadi.
   */
  lines.push(
    `Dress the person in the garment from the second image, ${PLACEMENT[input.kind]}.`,
    'Reproduce that garment EXACTLY: same colour, same pattern, same cut, same details and any printed artwork — it is a real product being sold.',
    REST_OF_OUTFIT[input.kind],
  );

  if (input.face) {
    lines.push(
      "The third image is a close-up reference of the same person's face.",
      'Match the facial features, bone structure and skin tone to that reference exactly.',
      'Use the third image ONLY for the face — take the body and build from the first image.',
      'If the face in the first image looks AI-generated or slightly off, restore the true identity from that reference.',
    );
  }

  lines.push(
    SCENE,
    'Natural fabric folds and realistic fit. No text or watermarks added.',
    /* ⚠️ FAQAT BRAUZER VERSIYASIDA — chat interfeysi matn bilan javob bermasin. */
    'Output exactly one image. Do not ask questions, do not explain, do not offer alternatives.',
  );

  return lines.join(' ');
}

/*
 * ── Kiyintirish — UCH PANELLI VARAQ, faqat YUZ + KIYIM (2026-09-25) ──
 *
 * ⚠️ GAVDA SURATI BERILMAYDI (so'rovga ko'ra). Ilgari AI'ga avatar
 * (gavda) + kiyim + yuz berilardi va model avatardagi eski kiyimni,
 * yuzni «aralashtirib» yuborardi. Endi faqat ikki surat: 1 — YUZ (yagona
 * shaxs manbai), 2 — KIYIM. Gavda o'lchamlardan (bo'y, vazn, razmer)
 * matnda quriladi.
 *
 * ⚠️ POZA VA PANEL QOIDALARI SERVER VARAG'I BILAN BIR XIL
 * (`apps/api/src/tryon/avatar-prompt.ts` → ANGLE_TEXT, FRAMING). Server
 * natijani teng uchga bo'lib old/yon/orqa render qilib yozadi — kadr
 * farq qilsa bo'laklarda qo'l-oyoq kesilib qolardi.
 */
const SHEET_FRONT =
  // ⚠️ AYNAN avatar old pozasi bilan bir xil (avatar-prompt.ts ANGLE_TEXT.front) —
  // kiyim natijasi avatarning o'sha pozasida chiqsin.
  //
  // ⚠️ YUZ QAT'IY QULFLANGAN (2026-09-26). Server nusxasi bilan aynan bir xil.
  'Standing upright with the torso turned about 40 degrees to the LEFT into a dynamic ' +
  'three-quarter pose — the left shoulder is closer to the camera and the right shoulder ' +
  'further back — while the FACE turns directly toward the camera with a calm, confident ' +
  'expression and clear eye contact. Both hands rest casually inside the trouser pockets, ' +
  'elbows relaxed and slightly away from the body. The feet are shoulder-width apart, ' +
  'planted flat. Keep the body axis upright, with relaxed shoulders, an elegant confident ' +
  'stance, realistic anatomy and no exaggerated curve or lean. ' +
  'MANDATORY FACE RULE for this panel: the face MUST be the EXACT SAME face as in the ' +
  'reference photo — pixel-level identity. Do NOT redraw, re-generate, beautify, smooth, ' +
  'de-age, slim, retouch or re-imagine any facial feature. Every feature (eyes, nose, ' +
  'lips, jawline, skin texture, moles, freckles, facial hair) stays EXACTLY as in the ' +
  'reference. If the model is tempted to "improve" the face, DO NOT — reproduce it as-is.';
// ⚠️ O'NG TOMONGA QAYRILGAN (2026-09-26). Server nusxasi bilan aynan bir xil.
const SHEET_SIDE =
  'The whole body turned 90 degrees to the RIGHT so we see a clean full side profile, ' +
  'facing the RIGHT edge of the image (the person\'s LEFT shoulder is closer to the camera, ' +
  'their RIGHT shoulder is further away). MANDATORY: the person MUST be turned to face the ' +
  'RIGHT edge of the panel — never the left, never a three-quarter view, never the camera. ' +
  'Standing straight, arms relaxed at the sides and slightly away from the body, feet ' +
  'slightly apart. The face is seen in true profile (nose points to the RIGHT edge).';
const SHEET_BACK =
  'Seen directly from behind — the back of the head and the back of the clothing face the ' +
  'camera, the face is NOT visible. Standing straight, arms relaxed at the sides and slightly ' +
  'away from the body, feet shoulder-width apart.';

/*
 * ⚠️ BOSH O'LCHAMI (so'rovga ko'ra, 2026-11-16). Yuz surati ko'pincha
 * kameraga yaqin olingan selfi — model shu yaqin kadrni gavdaga ko'chirib
 * boshni haddan tashqari katta chizadi (karikaturaga o'xshaydi). Yuz FAQAT
 * shaxsni aniqlash uchun; yaqin kadr bosh o'lchamiga ta'sir qilmasligi kerak.
 *
 * ⚠️ API nusxasi (`apps/api/src/tryon/tryon-prompt.ts` → `bodyLine`,
 * `HEAD_PROPORTION`) bilan AYNAN bir xil — biri o'zgarsa ikkinchisi ham.
 * Bu matn `bodyLine` orqali barcha auto-GPT funksiyalariga tushadi.
 */
const HEAD_PROPORTION =
  ' HEAD-TO-BODY PROPORTION: render the head at a natural, realistic size for an adult ' +
  'standing body — a normal adult head is only about one seventh to one eighth of the full ' +
  'standing height. The reference face photo is often a tight close-up (a selfie) and is used ' +
  'ONLY to copy the identity — its close framing must NOT enlarge the head. Never render an ' +
  'oversized, zoomed-in, bobble-head or caricature-like head; keep average, anatomically ' +
  'correct, well-balanced head-to-body proportions.';

function bodyLine(person: string, measurements: Measurements): string {
  const parts: string[] = [];
  if (measurements.height) parts.push(`${Math.round(measurements.height)} cm tall`);
  if (measurements.weight) parts.push(`${Math.round(measurements.weight)} kg`);
  if (measurements.topSize) parts.push(`wears size ${measurements.topSize} tops`);
  if (measurements.bottomSize) parts.push(`wears size ${measurements.bottomSize} trousers`);
  const base =
    parts.length > 0
      ? `BODY: a ${person}, ${parts.join(', ')} — build a natural, realistic body with exactly ` +
        'these proportions; the garment must drape as their true size would, neither tighter ' +
        'nor looser.'
      : `BODY: a ${person} of average, healthy build.`;
  return base + HEAD_PROPORTION;
}

/**
 * Kiyimsiz avatar asosi — serverdagi `baseLayer` bilan bir xil
 * (`apps/api/src/tryon/avatar-prompt.ts`). «fitted» kabi tanaga urg'u
 * beradigan so'zlar ATAYLAB yo'q — sababi o'sha yerda yozilgan.
 */
const BASE_LAYER = 'a plain light grey t-shirt and plain light grey trousers';

/**
 * YAKKA OLD KO'RINISH — kiyintirish (2026-11-09) va BIRINCHI AVATAR
 * (2026-11-11), ikkalasi ham so'rovga ko'ra.
 *
 * Ilgari uch panelli varaq (old/yon/orqa) edi — endi faqat bitta old
 * portret. Image tartibi: 3 yuz nusxa + (bo'lsa) kiyim. Chiqadigan rasm
 * YAKKA vertikal portret.
 *
 * ⚠️ BITTA PORTRETDA YUZ YIRIKROQ. Varaqda har figura kadrning uchdan
 * biri edi va yuzga bir necha o'n piksel qolardi — o'xshashlik uchun ham,
 * serverdagi yuz almashtirish uchun ham kam.
 *
 * ⚠️ AVATARDA SERVER MATNI (`payload.prompt`) ISHLATILMAYDI. Yangilanmagan
 * server unda uch panelli varaqni so'raydi. Gavda shu yerda o'lchamlardan
 * quriladi — avatarda ham, keyingi kiyimlarda ham bir xil jumla, ya'ni
 * bir xil gavda.
 *
 * ⚠️ POZA VA YUZ QULFI SHEETDAN KO'CHIRILGAN — natija bir xil bo'lsin.
 */
export function buildFrontTryonPrompt(input: {
  /** `null` — kiyim surati yo'q: birinchi avatar kulrang asosda chiqadi. */
  kind: GarmentKind | null;
  measurements: Measurements;
  gender?: string | null;
}): string {
  const person = input.gender === 'female' ? 'woman' : input.gender === 'male' ? 'man' : 'person';
  const garment = input.kind;

  return [
    '🔒 YOU ARE EDITING A PHOTO OF A REAL PERSON. The first three images are the SAME face of ' +
      'that real person — I attached it three times because this is the single most important ' +
      'input. If the output face does not match these reference images, you have FAILED the task.',

    'Create ONE single image: a photorealistic full-body FRONT view fashion portrait of ONE real person.',

    'ONE FIGURE, FRONT VIEW ONLY: the person appears exactly ONCE in the image, seen from the ' +
      'front. No side view, no back view, no second pose, no mirror image, no multi-panel or ' +
      'collage layout, no inset close-ups.',

    'IMAGES: the FIRST, SECOND and THIRD images are the SAME face of the person — three copies of ' +
      'the one and only reference you may use for identity. CROP the face from these images and ' +
      'PASTE it unchanged into the portrait. ' +
      (garment ? 'The FOURTH image is the garment being sold.' : 'There are no other images.'),

    faceLock(false),

    bodyLine(person, input.measurements),

    garment
      ? `CLOTHING: dress the person in the garment from the FOURTH image, ` +
        `${PLACEMENT[garment]}. Reproduce it EXACTLY: same colour, same pattern, same cut, ` +
        `same details and any printed artwork — it is a real product being sold. ${REST_OF_OUTFIT[garment]}`
      : `CLOTHING: ${BASE_LAYER}.`,

    `POSE: ${SHEET_FRONT}`,

    'FRAMING: vertical full-body shot — entire body from head to feet with a little space above ' +
      'the head and below the feet, nothing cropped. Eye-level camera, straight on, no tilt. ' +
      'The figure fills about 85-90% of the image height, centered horizontally.',

    'BACKGROUND: fully TRANSPARENT PNG with an alpha channel — no background colour, no floor, ' +
      'no wall, no ground shadow, no text or watermarks. Soft even studio lighting, natural ' +
      'fabric folds, photorealistic.',

    /* ⚠️ FAQAT BRAUZER VERSIYASIDA — chat interfeysi matn bilan javob bermasin. */
    'Output exactly ONE image — the single front portrait — vertical portrait PNG with transparency. ' +
      'Do not ask questions, do not explain, do not offer alternatives.',

    '🔒 REMEMBER: the face MUST be the exact face from image 1. If the final face differs in ANY ' +
      'feature, the output is wrong. Do not idealise, do not beautify, do not "improve" — copy ' +
      'image 1 as-is.',
  ].join('\n\n');
}

/**
 * KOMPLEKT — FRONT ONLY. Extension bu promptni payload.bundle bor bo'lsa
 * ishlatadi: bitta odam, hamma kiyim ustma-ust, oldindan.
 */
export function buildFrontTryonBundlePrompt(input: {
  kinds: readonly GarmentKind[];
  measurements: Measurements;
  gender?: string | null;
}): string {
  const person = input.gender === 'female' ? 'woman' : input.gender === 'male' ? 'man' : 'person';
  const garmentList = input.kinds
    .map((k, i) => `IMAGE ${i + 4} (${k}) ${PLACEMENT[k] ?? 'in its natural position'}`)
    .join('; ');

  // Extension'da slot = 'tops' (ikki tops bo'lsa — hoodie + jacket bo'lishi mumkin). Shuning
  // uchun layer instruksiyasi slot'ga qarab emas, umumiy qoida sifatida beriladi.
  const topsCount = input.kinds.filter((k) => k === 'tops').length;
  const layeringNote = topsCount >= 2
    ? 'LAYERING ORDER (very important): if two upper-body garments are given, DECIDE which is ' +
      'the BASE layer (t-shirt / hoodie / sweater / shirt — the lighter / shorter inner piece) ' +
      'and which is the OUTER layer (jacket / coat / windbreaker / overshirt — the heavier ' +
      'outerwear piece). The base layer is worn first and covers the torso AND the full length ' +
      'of both arms — its sleeves fill the arms completely. The outer layer goes OVER the base, ' +
      'its sleeves fitting OVER the base-layer sleeves so the arms are inside both. The base ' +
      'layer\'s hood / collar / cuffs / hem may peek out from under the outer layer where ' +
      'natural. Never show an empty / hollow jacket sleeve — the arm with the base-layer sleeve ' +
      'is always inside it.'
    : '';

  return [
    '🔒 YOU ARE EDITING A PHOTO OF A REAL PERSON. The first three images are the SAME face of ' +
      'that real person. If the output face does not match, you have FAILED the task.',

    'Create ONE single image: a photorealistic full-body FRONT view of ONE real person wearing ' +
      'ALL the garments together.',

    `IMAGES: the FIRST, SECOND and THIRD images are the SAME face — the ONLY source for identity. ` +
      `Images 4..${3 + input.kinds.length} are DIFFERENT garments the SAME person wears at once.`,

    faceLock(false),

    bodyLine(person, input.measurements),

    'STEP 1 — RECOGNISE EACH GARMENT BEFORE DRESSING: look at every garment image carefully and ' +
      'identify its type (t-shirt / hoodie / shirt / sweater / jacket / coat / trousers / shorts ' +
      '/ shoes), sleeve length, hood / collar type, cut and length. Only then layer them.',

    `CLOTHING — WEAR ALL AT ONCE: ${garmentList}. Each garment reproduced EXACTLY from its ` +
      'source (colour, pattern, cut, details, artwork). Combine into one complete outfit on one ' +
      'single person.',

    ...(layeringNote ? [layeringNote] : []),

    'ARMS AND HANDS: both arms MUST be visibly filled with the sleeves of EVERY worn layer — ' +
      'never leave a garment sleeve empty or deflated. Hands naturally in trouser pockets, ' +
      'fingers clearly resolved, correct count, natural wrist thickness. Wrists pass cleanly ' +
      'through the outer-layer sleeve.',

    `POSE: ${SHEET_FRONT}`,

    'FRAMING: vertical full-body shot — entire body from head to feet, little space above and ' +
      'below. Figure fills about 85-90% of height, centered horizontally.',

    'BACKGROUND: fully TRANSPARENT PNG with an alpha channel — no colour, no floor, no wall, ' +
      'no shadow, no text. Soft even studio lighting, natural fabric folds, photorealistic.',

    'Output exactly ONE image — the single front portrait — vertical portrait PNG with transparency. ' +
      'Do not ask questions, do not explain.',

    '🔒 REMEMBER: the face MUST be the exact face from image 1. Copy as-is.',
  ].join('\n\n');
}

/**
 * BUNDLE — bir nechta kiyim birgalikda. Mobil ilovada checkbox bilan
 * tanlansa, ekstension bu promptni ishlatadi (yoki backend orqali).
 */
export function buildTryonBundleSheetPrompt(input: {
  kinds: readonly GarmentKind[];
  measurements: Measurements;
  gender?: string | null;
}): string {
  const person = input.gender === 'female' ? 'woman' : input.gender === 'male' ? 'man' : 'person';
  // FIRST=face, SECOND..N=har bir kiyim
  const garmentList = input.kinds
    .map((k, i) => `IMAGE ${i + 2} (${k}) ${PLACEMENT[k] ?? 'in its natural position'}`)
    .join('; ');

  return [
    '🔒 YOU ARE EDITING A PHOTO OF A REAL PERSON. The first image is the face of that real ' +
      'person — the single most important input. If the output face does not match, you have ' +
      'FAILED the task.',

    'Create ONE single image: a photorealistic fashion turnaround sheet of ONE real person, ' +
      'shown three times side by side, wearing ALL the garments at once.',

    `IMAGES: the FIRST image is the face of the person — the ONLY source for identity. The next ` +
      `${input.kinds.length} images are DIFFERENT garments the SAME person must wear together in ` +
      'ALL THREE panels.',

    faceLock(true),

    bodyLine(person, input.measurements),

    'STEP 1 — RECOGNISE EACH GARMENT BEFORE DRESSING: look at every garment image carefully and ' +
      'identify its type (t-shirt / hoodie / shirt / sweater / jacket / coat / trousers / shorts ' +
      '/ shoes), sleeve length, hood / collar type, cut and length. Only then layer them.',

    `CLOTHING — WEAR ALL OF THEM TOGETHER AT ONCE: ${garmentList}. Each garment must be ` +
      'reproduced EXACTLY from its source image (same colour, same pattern, same cut, same ' +
      'details, printed artwork). Combine them into one complete outfit on one single person ' +
      'in every panel — never show the garments separately, never create extra figures, never ' +
      'swap garments between panels.',

    ...(input.kinds.filter((k) => k === 'tops').length >= 2
      ? [
          'LAYERING ORDER (very important): if two upper-body garments are given, DECIDE which ' +
          'is the BASE layer (t-shirt / hoodie / sweater / shirt — the lighter / shorter inner ' +
          'piece) and which is the OUTER layer (jacket / coat / windbreaker / overshirt — the ' +
          'heavier outerwear piece). The base layer is worn first and covers the torso AND the ' +
          'full length of both arms — its sleeves fill the arms completely. The outer layer ' +
          'goes OVER the base, its sleeves fitting OVER the base-layer sleeves so the arms are ' +
          'inside both. The base layer\'s hood / collar / cuffs / hem may peek out from under ' +
          'the outer layer where natural. Never show an empty / hollow jacket sleeve — the arm ' +
          'with the base-layer sleeve is always inside it.',
        ]
      : []),

    'ARMS AND HANDS: both arms MUST be visibly filled with the sleeves of EVERY worn layer — ' +
      'never leave a garment sleeve empty. Hands naturally placed, fingers clearly resolved, ' +
      'correct count, natural wrist thickness.',

    'LAYOUT: three equal-width vertical panels in one horizontal row — each panel is exactly one ' +
      'third of the image width. From left to right:',
    `PANEL 1 (left third) — FRONT VIEW: ${SHEET_FRONT}`,
    `PANEL 2 (middle third) — SIDE VIEW: ${SHEET_SIDE}`,
    `PANEL 3 (right third) — BACK VIEW: ${SHEET_BACK}`,

    'EXACTLY THREE FIGURES of the same single person wearing the SAME combined outfit — never ' +
      'four, never two people in one panel, no mirror images, no close-ups.',

    'FRAMING FOR CUTTING: same camera distance, eye-level camera, same scale in every panel — ' +
      'top of head and soles of feet at the same height. Each figure centered in its third, ' +
      'fills ~85–90% of image height. Empty space ≥ 8% of image width between figures.',

    'BACKGROUND: fully TRANSPARENT PNG with an alpha channel — no background colour, no floor, ' +
      'no wall, no ground shadow, no text or watermarks. Soft even studio lighting, natural ' +
      'fabric folds, photorealistic.',

    'Output exactly ONE image — the three-panel sheet — landscape 3:2 PNG with transparency. ' +
      'Do not ask questions, do not explain, do not offer alternatives.',

    '🔒 REMEMBER: the face in all three panels MUST be the exact face from image 1. Do not ' +
      'idealise, do not beautify — copy image 1 as-is.',
  ].join('\n\n');
}

export function buildTryonSheetPrompt(input: {
  kind: GarmentKind;
  measurements: Measurements;
  gender?: string | null;
}): string {
  const person = input.gender === 'female' ? 'woman' : input.gender === 'male' ? 'man' : 'person';

  return [
    '🔒 YOU ARE EDITING A PHOTO OF A REAL PERSON. The first three images are the SAME face of ' +
      'that real person — I attached it three times because this is the single most important ' +
      'input. If the output face does not match these reference images, you have FAILED the task.',

    'Create ONE single image: a photorealistic fashion turnaround sheet of ONE real person, ' +
      'shown three times side by side.',

    'IMAGES: the FIRST, SECOND and THIRD images are the SAME face of the person — three copies of ' +
      'the one and only reference you may use for identity. CROP the face from these images and ' +
      'PASTE it unchanged into every panel. The FOURTH image is the garment being sold.',

    faceLock(true),

    bodyLine(person, input.measurements),

    `CLOTHING: dress the person in ALL THREE panels in the garment from the FOURTH image, ` +
      `${PLACEMENT[input.kind]}. Reproduce it EXACTLY: same colour, same pattern, same cut, ` +
      'same details and any printed artwork — it is a real product being sold; on the back view ' +
      `show the back of that same garment. ${REST_OF_OUTFIT[input.kind]}`,

    'LAYOUT: three equal-width vertical panels in one horizontal row — each panel is exactly one ' +
      'third of the image width. From left to right:',
    `PANEL 1 (left third) — FRONT VIEW: ${SHEET_FRONT}`,
    `PANEL 2 (middle third) — SIDE VIEW: ${SHEET_SIDE}`,
    `PANEL 3 (right third) — BACK VIEW: ${SHEET_BACK}`,

    'EXACTLY THREE FIGURES of the same single person — never four, never two people in one ' +
      'panel, no mirror images, no extra poses, no close-ups or inset portraits.',

    'FRAMING FOR CUTTING (the image will be cut into three equal vertical strips): same camera ' +
      'distance, eye-level camera and the same scale in every panel — the top of the head and ' +
      'the soles of the feet at the same height. Each figure is centered in its own third and ' +
      'fills about 85–90% of the image height. Leave at least 8% of the image width of empty ' +
      'space between neighbouring figures, so no hand, elbow, foot or hair touches the line ' +
      'between panels. The entire body is visible head to feet in every panel.',

    'BACKGROUND: fully TRANSPARENT PNG with an alpha channel — no background colour, no floor, ' +
      'no wall, no ground shadow, no divider lines or panel borders, no text or watermarks. ' +
      'Soft even studio lighting, natural fabric folds, photorealistic.',

    /* ⚠️ FAQAT BRAUZER VERSIYASIDA — chat interfeysi matn bilan javob bermasin. */
    'Output exactly ONE image — the three-panel sheet — landscape 3:2 PNG with transparency. ' +
      'Do not ask questions, do not explain, do not offer alternatives.',

    /*
     * ⚠️ RECENCY — eng oxirgi gap modelga eng kuchli ta'sir qiladi.
     * Yuz qulfini oxirida qisqa va keskin takrorlaymiz.
     */
    '🔒 REMEMBER: the face in all three panels MUST be the exact face from image 1. If the final ' +
      'face differs in ANY feature, the output is wrong. Do not idealise, do not beautify, do not ' +
      '"improve" — copy image 1 as-is.',
  ].join('\n\n');
}
