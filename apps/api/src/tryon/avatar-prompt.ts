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
  front: 'Facing the camera directly, front view.',
  side: 'Turned 90 degrees to the left, full side profile view.',
  back: 'Turned away from the camera, back view, face not visible.',
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

/** Asosiy kiyim — jinsga qarab, lekin har doim tor va bir rangli. */
function baseLayer(gender: AvatarGender): string {
  return gender === 'female'
    ? 'a plain fitted light grey t-shirt and plain fitted light grey leggings'
    : 'a plain fitted light grey t-shirt and plain fitted light grey shorts';
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
  parts.push(
    `Full-body studio photograph of a ${person}, ${[height, build].filter(Boolean).join(', ')}` +
      (shape ? `, with ${shape}` : '') +
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
    `${ANGLE_TEXT[angle]} Standing straight, arms relaxed at the sides and slightly away ` +
      'from the body, feet shoulder-width apart. The entire body is visible from head to feet, ' +
      'nothing is cropped. Same distance and framing in every view.',
  );

  // 3-jumla: kiyim — yangisi ustiga qo'yiladi
  parts.push(`Wearing ${baseLayer(gender)}.`);

  // 4-jumla: fon va yorug'lik — sodda fon chegarani aniq qiladi
  parts.push(
    'Plain light grey seamless studio background, soft even lighting, no shadows on the ' +
      'background, sharp focus, photorealistic, natural skin texture.',
  );

  return parts.join(' ');
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
