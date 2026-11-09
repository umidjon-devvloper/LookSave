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
      : 'Hairstyle, hair colour, hair parting and hair volume stay exactly as in image 1.',
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

/**
 * Avatar yasash prompti.
 *
 * ⚠️ GAVDA TAVSIFI BU YERDA TUZILMAYDI. U ishning payload'ida tayyor
 * keladi (`payload.prompt`) — serverda `buildAvatarPrompt` o'lchovlardan
 * yasagan. Ya'ni bo'y, gavda tuzilishi va poza AYNAN server aytgandek
 * bo'ladi; kengaytma faqat o'ramni qo'shadi.
 *
 * ⚠️ IKKI REJIM. Kiyimsiz — yalang'och asos (keyin ustiga kiyintiriladi).
 * Kiyim bilan — odam DARHOL do'konning mahsulotida chiqadi va mijoz
 * birinchi suratdayoq real kiyimni ko'radi, kulrang mayka emas.
 */
export function buildAvatarRequestPrompt(
  bodyPrompt: string,
  /** Avatarga darhol kiydiriladigan do'kon kiyimi — ikkinchi surat. */
  garment?: GarmentKind | null,
): string {
  if (isSheetPrompt(bodyPrompt)) return buildSheetRequestPrompt(bodyPrompt, garment);

  const lines = [
    '🔒 YOU ARE EDITING A PHOTO OF A REAL PERSON. The first three images are the SAME face of ' +
      'that real person — attached three times because this is the single most important input. ' +
      'If the output face does not match these references, you have FAILED the task.',
    'Full-body photorealistic portrait of the person in the first three reference images (same face).',
    faceLock(false),
    'The references show the head and shoulders — carry the neck, shoulder line and build over to the full body.',
    garment ? stripBaseLayer(bodyPrompt) : bodyPrompt,
  ];

  if (garment) {
    lines.push(
      `Dress the person in the garment from the FOURTH image, ${PLACEMENT[garment]}.`,
      'Reproduce that garment EXACTLY: same colour, same pattern, same cut, same details and any printed artwork — it is a real product being sold.',
      REST_OF_OUTFIT[garment],
    );
  }

  lines.push(
    'No text, no watermarks, no props.',
    /* ⚠️ FAQAT BRAUZER VERSIYASIDA — chat interfeysi matn bilan javob bermasin. */
    'Output exactly one image. Do not ask questions, do not explain, do not offer alternatives.',
  );

  return lines.join(' ');
}

/**
 * Serverdagi «bir rangli kulrang kiyim» jumlasini olib tashlaydi.
 *
 * ⚠️ USIZ IKKI KO'RSATMA URISHADI. `buildAvatarPrompt` (serverda) har
 * doim «Wearing a plain light grey t-shirt and plain light grey
 * trousers» deb yozadi — u YALANG'OCH asos uchun to'g'ri, chunki keyin
 * ustiga kiyim kiydiriladi. Lekin do'kon kiyimini o'sha so'rovning
 * o'zida bersak, model ikki jumladan birini tanlaydi va natija
 * tasodifiy bo'ladi: goh futbolka, goh kulrang mayka.
 *
 * ⚠️ QARAMA-QARSHI JUMLANI QOLDIRIB, USTIGA «buni e'tiborsiz qoldir»
 * DEB YOZISH ISHLAMAYDI — shu omborda bir marta sinalgan va model
 * oldinroq turgan ko'rsatmani tanlagan (`avatar-prompt.ts` dagi burchak
 * ziddiyati). Shuning uchun jumla butunlay olib tashlanadi.
 */
function stripBaseLayer(bodyPrompt: string): string {
  return (
    bodyPrompt
      .replace(/\s*Wearing a plain[^.]*\.\s*/i, ' ')
      // Varaq promptida kiyim alohida band: «CLOTHING: a plain light grey …»
      .replace(/\n*CLOTHING:[^\n]*/i, '')
      .trim()
  );
}

/**
 * Server uch burchakli varaq promptini yubordimi (`buildAvatarSheetPrompt`).
 *
 * ⚠️ ESKI SERVER BILAN HAM ISHLAYDI: yangilanmagan server oddiy (bitta
 * pozali) tavsif yuboradi va kengaytma eski o'ram bilan davom etadi.
 */
export function isSheetPrompt(bodyPrompt: string): boolean {
  return /turnaround sheet/i.test(bodyPrompt) && /PANEL 1/.test(bodyPrompt);
}

/**
 * Varaq uchun o'ram.
 *
 * ⚠️ «Full-body portrait of the person» BU YERDA YO'Q. U BITTA odamni
 * so'raydi va server matnidagi «uch panel» bilan urishardi — model
 * oldinroq turgan ko'rsatmani tanlaydi (omborda bir necha bor sinalgan).
 * Server matnining o'zi to'liq: joylashuv, poza, fon va kadr. Bu yerda
 * faqat suratlar tartibi va kiyim qo'shiladi.
 */
function buildSheetRequestPrompt(bodyPrompt: string, garment?: GarmentKind | null): string {
  const lines = [
    '🔒 YOU ARE EDITING A PHOTO OF A REAL PERSON. The FIRST, SECOND and THIRD images are the ' +
      'SAME face — three copies of the one and only identity reference. CROP the face from these ' +
      'images and PASTE it unchanged into every panel. The reference shows the head and ' +
      'shoulders — carry the neck, shoulder line and build the full body around it.',
    /*
     * Yangi server matnida yuz qulfi bor; eski server uni yubormasa bu
     * yerda qo'shiladi — ikki marta takrorlanmasin.
     */
    ...(/FACE IDENTITY|FACE LOCK/.test(bodyPrompt) ? [] : [faceLock(true)]),
    garment ? stripBaseLayer(bodyPrompt) : bodyPrompt,
  ];

  if (garment) {
    lines.push(
      `CLOTHING: dress the person in ALL THREE panels in the garment from the FOURTH image, ` +
        `${PLACEMENT[garment]} — the same real product seen from the front, the side and the ` +
        'back. Reproduce it EXACTLY: same colour, same pattern, same cut, same details and any ' +
        'printed artwork; on the back view show the back of that garment. ' +
        REST_OF_OUTFIT[garment],
    );
  }

  lines.push(
    /* ⚠️ FAQAT BRAUZER VERSIYASIDA — chat interfeysi matn bilan javob bermasin. */
    'Output exactly ONE image — the three-panel sheet — as a PNG with a transparent background. ' +
      'Do not ask questions, do not explain, do not offer alternatives.',
  );

  return lines.join('\n\n');
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

function bodyLine(person: string, measurements: Measurements): string {
  const parts: string[] = [];
  if (measurements.height) parts.push(`${Math.round(measurements.height)} cm tall`);
  if (measurements.weight) parts.push(`${Math.round(measurements.weight)} kg`);
  if (measurements.topSize) parts.push(`wears size ${measurements.topSize} tops`);
  if (measurements.bottomSize) parts.push(`wears size ${measurements.bottomSize} trousers`);
  return parts.length > 0
    ? `BODY: a ${person}, ${parts.join(', ')} — build a natural, realistic body with exactly ` +
        'these proportions; the garment must drape as their true size would, neither tighter ' +
        'nor looser.'
    : `BODY: a ${person} of average, healthy build.`;
}

/**
 * Kiyintirish — YAKKA OLD KO'RINISH (2026-11-09, so'rovga ko'ra).
 *
 * Ilgari uch panelli varaq (old/yon/orqa) edi — endi faqat bitta old
 * portret. Image tartibi varaq bilan bir xil: 3 yuz nusxa + kiyim.
 * Chiqadigan rasm esa YAKKA vertikal portret.
 *
 * ⚠️ POZA VA YUZ QULFI SHEETDAN KO'CHIRILGAN — natija bir xil bo'lsin.
 */
export function buildFrontTryonPrompt(input: {
  kind: GarmentKind;
  measurements: Measurements;
  gender?: string | null;
}): string {
  const person = input.gender === 'female' ? 'woman' : input.gender === 'male' ? 'man' : 'person';

  return [
    '🔒 YOU ARE EDITING A PHOTO OF A REAL PERSON. The first three images are the SAME face of ' +
      'that real person — I attached it three times because this is the single most important ' +
      'input. If the output face does not match these reference images, you have FAILED the task.',

    'Create ONE single image: a photorealistic full-body FRONT view fashion portrait of ONE real person.',

    'IMAGES: the FIRST, SECOND and THIRD images are the SAME face of the person — three copies of ' +
      'the one and only reference you may use for identity. CROP the face from these images and ' +
      'PASTE it unchanged into the portrait. The FOURTH image is the garment being sold.',

    faceLock(false),

    bodyLine(person, input.measurements),

    `CLOTHING: dress the person in the garment from the FOURTH image, ` +
      `${PLACEMENT[input.kind]}. Reproduce it EXACTLY: same colour, same pattern, same cut, ` +
      `same details and any printed artwork — it is a real product being sold. ${REST_OF_OUTFIT[input.kind]}`,

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
