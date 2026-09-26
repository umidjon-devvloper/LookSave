import { faceLock, type AvatarGender, type AvatarMeasurements } from './avatar-prompt';

/**
 * Kiyintirish uchun uch panelli varaq prompti (operator ko'radigan matn).
 *
 * ⚠️ NUSXA KENGAYTMADA HAM BOR: `apps/browser-extension/src/shared/prompt.ts`
 * → `buildTryonSheetPrompt`. Avtomatik rejimda kengaytma o'z nusxasini
 * ishlatadi; bu yerdagisi esa QO'LDA ishlaydigan operator uchun — u ishni
 * panelda ochib promptni nusxalaydi. Ikkisi ajralib ketsa, qo'lda va
 * avtomatik natijalar boshqacha chiqadi, shuning uchun birga yangilanadi.
 *
 * ⚠️ FAQAT YUZ + KIYIM. Gavda surati berilmaydi (so'rovga ko'ra) — gavda
 * o'lchamlardan (bo'y, vazn, razmer) matnda quriladi. Natija shaffof PNG
 * varaq: old · yon · orqa; server uni teng uchga bo'lib har burchakni
 * alohida renderga yozadi.
 */

const PLACEMENT: Record<string, string> = {
  top: 'as the upper-body garment',
  outer: 'as the outer layer over the top',
  bottom: 'as the lower-body garment',
  feet: 'on the feet, as footwear',
};

const REST_OF_OUTFIT: Record<string, string> = {
  top: 'Complete the look with plain black trousers and clean white sneakers.',
  outer: 'Complete the look with a plain black T-shirt, plain black trousers and white sneakers.',
  bottom: 'Complete the look with a plain black T-shirt and clean white sneakers.',
  feet: 'Complete the look with a plain black T-shirt and plain black trousers.',
};

const SHEET_FRONT =
  // ⚠️ AYNAN avatar old pozasi bilan bir xil (avatar-prompt.ts ANGLE_TEXT.front) —
  // kiyim natijasi avatarning o'sha pozasida chiqsin.
  //
  // ⚠️ YUZ QAT'IY QULFLANGAN (2026-09-26). Model old panelda yuzni «chiroyliroq»
  // qilib qayta chizishga moyil — bir necha buyruq ustma-ust yozildi.
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
// ⚠️ O'NG TOMONGA QAYRILGAN (2026-09-26). Ilgari «facing the LEFT edge» edi —
// mijoz o'ng burilishni so'radi (avatar bilan yaxshiroq mos tushadi).
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

function bodyLine(person: string, measurements: AvatarMeasurements): string {
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

export function buildTryonSheetPrompt(
  slot: string,
  measurements: AvatarMeasurements,
  gender: AvatarGender,
): string {
  const person = gender === 'female' ? 'woman' : gender === 'male' ? 'man' : 'person';
  const placement = PLACEMENT[slot] ?? 'in its natural position on the body';
  const rest = REST_OF_OUTFIT[slot] ?? 'Complete the look with plain, simple neutral clothing.';

  return [
    'Create ONE single image: a photorealistic fashion turnaround sheet of ONE real person, ' +
      'shown three times side by side.',

    'IMAGES: the FIRST image is the face of the person — it is the ONLY source for the face and ' +
      'identity. The SECOND image is the garment being sold.',

    faceLock(true),

    bodyLine(person, measurements),

    `CLOTHING: dress the person in ALL THREE panels in the garment from the SECOND image, ` +
      `${placement}. Reproduce it EXACTLY: same colour, same pattern, same cut, same details ` +
      'and any printed artwork — it is a real product being sold; on the back view show the ' +
      `back of that same garment. ${rest}`,

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

    'Output exactly ONE image — the three-panel sheet — landscape 3:2 PNG with transparency. ' +
      'Do not ask questions, do not explain, do not offer alternatives.',
  ].join('\n\n');
}
