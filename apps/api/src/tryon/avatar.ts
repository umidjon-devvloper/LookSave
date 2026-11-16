import { createHash, randomUUID } from 'node:crypto';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { env } from '../config/env';
import {
  enqueueTask,
  isAutoAiUser,
  isManual,
  openTaskFor,
  type OpenTaskInfo,
} from '../developer-ai/tasks';
import { generateAvatar, generationFingerprint, isOpenAiEnabled } from '../integrations/openai';
import { presignRead, uploadObject } from '../integrations/r2';
import { makeCutout } from '../store/cutout';
import { logger } from '../logger';
import {
  buildAvatarFrontPrompt,
  buildAvatarPrompt,
  missingForAvatar,
  type AvatarAngle,
  type AvatarGender,
  type AvatarMeasurements,
} from './avatar-prompt';

/**
 * AI yasagan to'liq bo'yli avatar.
 *
 * OQIM: yuz skaneri -> o'lchovlardan tavsif -> `model-create` -> surat.
 * Natija profilda saqlanadi va BARCHA kiyintirishlarda asos bo'ladi.
 *
 * ⚠️ BIR MARTA YASALADI. `face_reference` har natijaga +3 kredit qo'shadi,
 * ya'ni avatar oddiy kiyintirishdan bir necha barobar qimmat. Uni har kiyim
 * uchun qayta yasash xarajatni bir necha barobar oshirardi va hech qanday
 * foyda bermasdi — avatar o'zgarmaydi.
 */

export type AvatarStatus = 'none' | 'processing' | 'ready' | 'failed';

export interface AvatarDto {
  status: AvatarStatus;
  imageUrl: string | null;
  /** Fondan ajratilgan variant — qorong'i sahnaga qo'yish uchun */
  cutoutUrl: string | null;
  error: string | null;
  /** Burchak -> surat. Yasalganlari shu yerda; qolganlari talab bo'yicha. */
  angles: Record<string, string>;
  /** Hozir yasalayotgan burchak (bo'lsa) — ilova kutish holatini ko'rsatadi. */
  anglePending: string | null;
  /**
   * Operator navbatidagi ish (bo'lsa).
   *
   * ⚠️ ILOVA KUTISH EKRANINI SHUNGA QARAB TANLAYDI. AI o'zi yasasa
   * ~40 soniya, operator bajarsa ~5 daqiqa — bitta ekran ikkalasiga
   * to'g'ri kelmaydi: 40 soniyalik bosqichlar navbatda yolg'on bo'lib
   * qoladi va «deyarli tayyor» da qotib turadi.
   */
  queue: OpenTaskInfo | null;
}

interface AvatarRow {
  face_texture_url: string | null;
  avatar_image_url: string | null;
  avatar_status: AvatarStatus;
  avatar_job_id: string | null;
  avatar_error: string | null;
  avatar_source_hash: string | null;
  measurements: AvatarMeasurements | null;
  gender: AvatarGender;
  avatar_angles: Record<string, string> | null;
  angle_job_id: string | null;
  angle_pending: AvatarAngle | null;
  avatar_cutout_url: string | null;
}

async function load(userId: string): Promise<AvatarRow> {
  const { rows } = await pool.query<AvatarRow>(
    `SELECT p.face_texture_url, p.avatar_image_url, p.avatar_status, p.avatar_job_id,
            p.avatar_error, p.avatar_source_hash,
            COALESCE(p.avatar_angles, '{}')::jsonb AS avatar_angles,
            p.angle_job_id, p.angle_pending, p.avatar_cutout_url,
            COALESCE(p.measurements, '{}')::jsonb AS measurements,
            u.gender
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );

  const row = rows[0];
  if (!row) throw ApiError.notFound('Foydalanuvchi topilmadi');
  return row;
}

function toDto(
  row: Pick<
    AvatarRow,
    | 'avatar_status'
    | 'avatar_image_url'
    | 'avatar_error'
    | 'avatar_angles'
    | 'angle_pending'
    | 'avatar_cutout_url'
  >,
): AvatarDto {
  const angles = row.avatar_angles ?? {};

  /*
   * Old ko'rinish har doim mavjud: u asosiy avatar bilan bir xil surat.
   * Alohida yasalmaydi, shunchaki ro'yxatga qo'shiladi — shunda ilova
   * "front" ni ham boshqa burchaklar kabi ishlatadi.
   */
  if (row.avatar_image_url && !angles['front']) angles['front'] = row.avatar_image_url;

  return {
    status: row.avatar_status ?? 'none',
    imageUrl: row.avatar_image_url,
    cutoutUrl: row.avatar_cutout_url,
    error: row.avatar_error,
    angles,
    anglePending: row.angle_pending,
    queue: null,
  };
}

/** Baza qatorisiz javob — burchaklar hali noma'lum bo'lgan holatlar uchun. */
function bare(
  status: AvatarStatus,
  imageUrl: string | null,
  error: string | null,
  queue: OpenTaskInfo | null = null,
): AvatarDto {
  return { status, imageUrl, cutoutUrl: null, error, angles: {}, anglePending: null, queue };
}

/**
 * Kesh kaliti — yuz surati, gavda tavsifi va generatsiya retsepti.
 *
 * ⚠️ RETSEPT SHART. Yuz surati va tavsif model almashganda o'zgarmaydi:
 * `gpt-image-1` dan `2.5` ga o'tilganda xesh o'sha bo'lib qolardi va
 * `requestAvatar` «manba o'zgarmagan» deb hisoblab, eski avatarni
 * qaytaraverardi — yuzi yaxshilanmagan holida.
 *
 * ⚠️ BU BIR MARTALIK QAYTA TO'LOV. Retsept o'zgarganda har bir
 * foydalanuvchining avatari keyingi so'rovda qaytadan yasaladi.
 */
function sourceHash(faceUrl: string, prompt: string): string {
  const recipe = generationFingerprint(env().OPENAI_IMAGE_MODEL);
  return createHash('sha256').update(`${recipe}|${faceUrl}|${prompt}`).digest('hex');
}

/** Hozirgi holat — ilova shu manzilni takrorlab natijani kutadi. */
export async function getAvatar(userId: string): Promise<AvatarDto> {
  /*
   * ⚠️ BU YERDA PROVAYDERDAN SO'RALMAYDI. Ilgari FASHN'da ish `id` bilan
   * yurardi va holat har so'rovda provayderdan olinardi. OpenAI sinxron:
   * natijani fon ishi o'zi bazaga yozadi, shuning uchun bu yerda faqat
   * qator o'qiladi — tashqi chaqiruv ham, kutish ham yo'q.
   */
  const dto = toDto(await load(userId));

  /*
   * ⚠️ FAQAT `processing` DA SO'RALADI. Tayyor avatarda navbat yozuvi
   * baribir yopilgan bo'ladi — har so'rovda ortiqcha so'rov yubormaymiz
   * (bu manzil ilova tomonidan har 3-10 soniyada takrorlanadi).
   */
  if (dto.status !== 'processing') return dto;
  return { ...dto, queue: await openTaskFor('avatar', userId) };
}

/**
 * Avatarni yasashni boshlaydi.
 *
 * Tayyor avatar bor va manba o'zgarmagan bo'lsa — qayta yasalmaydi.
 */
export async function requestAvatar(
  userId: string,
  storeId: string | null = null,
): Promise<AvatarDto> {
  /*
   * ⚠️ OPERATOR REJIMIDA OPENAI SHART EMAS. Ish navbatga tushadi va uni
   * odam bajaradi — kalit bo'lmasa ham so'rov qabul qilinishi kerak.
   */
  // Istisno akkauntlar (masalan App Store demo) operator rejimida ham OpenAI'dan
  const manual = isManual('avatar') && !isAutoAiUser(userId);
  if (!manual && !isOpenAiEnabled()) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'AI hozircha sozlanmagan');
  }

  const row = await load(userId);

  if (!row.face_texture_url) {
    throw new ApiError('VALIDATION_ERROR', 'Avval yuzingizni skaner qiling');
  }

  const missing = missingForAvatar(row.measurements ?? {});
  if (missing) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Avatar yasash uchun ${missing} kerak — uni profilda kiriting`,
    );
  }

  const prompt = buildAvatarPrompt(row.gender, row.measurements ?? {});
  const hash = sourceHash(row.face_texture_url, prompt);

  /*
   * Manba o'zgarmagan bo'lsa qayta yasamaymiz.
   *
   * ⚠️ HOLAT HAM TEKSHIRILADI: `processing` bo'lsa ish allaqachon ketyapti
   * va ikkinchi marta yuborish ikki marta to'lash degani.
   */
  if (row.avatar_source_hash === hash) {
    if (row.avatar_status === 'ready' || row.avatar_status === 'processing') return toDto(row);
  }

  /*
   * ⚠️ IMZO FAQAT SHU YERDA, XESHDAN KEYIN. Shaxsiy bucketdagi surat
   * kalitsiz o'qilmaydi, provayder esa uni yuklab olishi kerak.
   *
   * ⚠️ XESHGA IMZOLANGAN HAVOLA BERILMAYDI: imzoda vaqt belgisi bor,
   * ya'ni xesh har chaqiruvda o'zgarardi va kesh HECH QACHON ishlamasdi —
   * har so'rov qaytadan to'lanardi.
   */
  const facePhotoUrl = (await presignRead(row.face_texture_url)) ?? row.face_texture_url;

  /*
   * ⚠️ HOLAT AVVAL BAZAGA, KEYIN FON ISHI. Tartib muhim: `await` fon
   * ishidan oldin, shunda tez tugagan generatsiya `ready` ni yozib
   * ulgursa ham bu yozuv uni bosib ketmaydi.
   */
  await save(userId, { status: 'processing', jobId: null, hash, error: null });

  if (manual) {
    /*
     * Operator navbati. Payload'ga KANONIK manzil yoziladi, imzolangani
     * emas — panel uni o'qiyotgan paytda yangi imzo oladi. Ish bir necha
     * daqiqa (kechasi — soatlab) kutishi mumkin, imzo esa bir soatda
     * eskiradi.
     */
    const task = await enqueueTask('avatar', userId, userId, {
      faceUrl: row.face_texture_url,
      /*
       * ⚠️ OPERATORGA HAM FAQAT OLD KO'RINISH (2026-11-11, so'rovga ko'ra).
       * Ilgari uch burchakli varaq (old · yon · orqa) so'ralardi. Bu matn
       * panelda ko'rsatiladi va qo'lda nusxalanadi; kengaytma uni
       * ishlatmaydi — o'z promptini o'lchovlardan tuzadi. Eski varaq
       * natijasi kelsa server uni baribir uchga bo'la oladi
       * (`developer-ai/tasks.ts` → `storeAvatarSheet`).
       */
      prompt: buildAvatarFrontPrompt(row.gender, row.measurements ?? {}),
      gender: row.gender,
      measurements: row.measurements ?? {},
      storeId,
    });
    /*
     * ⚠️ TAKRORIY SO'ROVDA DO'KON YANGILANADI. Avatar bir marta yasaladi va
     * qayta so'rovda mavjud ish qaytariladi — lekin mijoz boshqa do'kon
     * tanlab qayta so'rasa, operator O'SHA do'kon kiyimlarini ko'rishi
     * kerak. Shuning uchun ochiq ishning payload'idagi storeId yangilanadi.
     */
    if (storeId) {
      await pool.query(
        `UPDATE developer_ai_tasks
            SET payload = jsonb_set(payload, '{storeId}', to_jsonb($2::text))
          WHERE id = $1 AND status IN ('pending', 'claimed')`,
        [task.id, storeId],
      );
    }
    logger.info({ userId, taskId: task.id, storeId }, 'avatar operator navbatiga qo`yildi');
    return bare('processing', null, null, {
      queuedAt: task.createdAt,
      claimed: task.status === 'claimed',
    });
  }

  void runAvatar(userId, facePhotoUrl, prompt);

  logger.info({ userId }, 'avatar yasash boshlandi');
  return bare('processing', null, null);
}

/**
 * Avatar yasash — fonda bajariladi.
 *
 * ⚠️ NEGA FONDA. Model javobda darhol rasm beradi, lekin 30–60
 * soniya oladi. HTTP so'rov ichida kutish taymautga olib keladi, shuning
 * uchun ish fonda ketadi va ilova holatni so'rab turadi.
 *
 * ⚠️ XATO YUTILMAYDI, PROFILGA YOZILADI. Fon vazifasida `throw` hech
 * kimga yetib bormaydi — javob allaqachon berilgan. Sabab `failed`
 * holati bilan bazaga tushadi va ilova uni ko'rsatadi.
 *
 * ⚠️ ZAIFLIK: ish XOTIRADA, provayderda emas. Server generatsiya paytida
 * qayta ishga tushsa ish yo'qoladi va profil `processing` da qotib
 * qolardi — buni `sweepStaleAvatars` yopadi.
 */
async function runAvatar(userId: string, facePhotoUrl: string, prompt: string): Promise<void> {
  try {
    const buffer = await generateAvatar(facePhotoUrl, prompt);
    await storeAvatar(userId, buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'noma`lum xato';
    logger.error({ err, userId }, 'avatar yasalmadi');
    await save(userId, { status: 'failed', error: message }).catch(() => {
      // Baza ham yiqilsa qiladigan ish qolmaydi — log yuqorida
    });
  }
}

/**
 * Tayyor avatarni saqlaydi va kesimini yasaydi.
 *
 * ⚠️ KESIM ALOHIDA QADAM. Uning nosozligi avatarni buzmaydi: `makeCutout`
 * `null` qaytarsa ilova oddiy suratni ko'rsatadi. Shuning uchun u avatar
 * `ready` bo'lgandan KEYIN yasaladi.
 */
async function storeAvatar(userId: string, buffer: Buffer): Promise<string> {
  const url = await uploadObject({
    key: `avatar/${randomUUID()}.png`,
    body: buffer,
    contentType: 'image/png',
  });

  await save(userId, { status: 'ready', url, error: null });

  const cutout = await makeCutout(url, 'avatar');
  if (cutout) {
    await pool.query(`UPDATE profiles SET avatar_cutout_url = $2 WHERE user_id = $1`, [
      userId,
      cutout,
    ]);
  }

  logger.info({ userId, cutout: Boolean(cutout) }, 'avatar tayyor');
  return url;
}

/**
 * Eski avatarda kesim yo'q bo'lsa mavjud suratdan qayta tayyorlaydi.
 * Avatar qayta generatsiya qilinmaydi va AI krediti sarflanmaydi.
 */
export async function ensureAvatarCutout(userId: string): Promise<AvatarDto> {
  const row = await load(userId);
  if (row.avatar_status !== 'ready' || !row.avatar_image_url) {
    throw new ApiError('VALIDATION_ERROR', 'Avval avatar tayyor bo`lishi kerak');
  }
  if (row.avatar_cutout_url) return toDto(row);

  const cutout = await makeCutout(row.avatar_image_url, 'avatar');
  if (!cutout) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'Avatar fonini ajratib bo`lmadi');
  }

  await pool.query(
    `UPDATE profiles SET avatar_cutout_url = $2
      WHERE user_id = $1 AND avatar_image_url = $3`,
    [userId, cutout, row.avatar_image_url],
  );
  return getAvatar(userId);
}

/** Profil qatori bo'lmasligi mumkin — shuning uchun `INSERT ... ON CONFLICT`. */
async function save(
  userId: string,
  input: {
    status: AvatarStatus;
    jobId?: string | null;
    hash?: string;
    error?: string | null;
    url?: string;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO profiles (user_id, avatar_status, avatar_job_id, avatar_source_hash,
                           avatar_error, avatar_image_url, avatar_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id) DO UPDATE
       SET avatar_status     = EXCLUDED.avatar_status,
           avatar_job_id     = COALESCE(EXCLUDED.avatar_job_id, profiles.avatar_job_id),
           avatar_source_hash = COALESCE(EXCLUDED.avatar_source_hash, profiles.avatar_source_hash),
           avatar_error      = EXCLUDED.avatar_error,
           avatar_image_url  = COALESCE(EXCLUDED.avatar_image_url, profiles.avatar_image_url),
           avatar_updated_at = now()`,
    [
      userId,
      input.status,
      input.jobId ?? null,
      input.hash ?? null,
      input.error ?? null,
      input.url ?? null,
    ],
  );
}

/**
 * Burchakni yasashni so'raydi (aylantirish).
 *
 * ⚠️ HAR BURCHAK ALOHIDA KREDIT. Shuning uchun ular oldindan yasalmaydi —
 * foydalanuvchi "aylantirish" bosganda kerakligi so'raladi. Yasalgani
 * saqlanadi va keyingi safar bepul keladi.
 *
 * ⚠️ BIR VAQTDA BITTA: `angle_job_id` band bo'lsa yangi so'rov qabul
 * qilinmaydi. Aks holda tugmani tez-tez bosgan odam bir necha ishni
 * parallel boshlab, har biriga alohida to'lardi.
 */
export async function requestAngle(userId: string, angle: AvatarAngle): Promise<AvatarDto> {
  if (!isOpenAiEnabled()) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'AI hozircha sozlanmagan');
  }

  const row = await load(userId);

  if (row.avatar_status !== 'ready' || !row.face_texture_url) {
    throw new ApiError('VALIDATION_ERROR', 'Avval avatar tayyor bo`lishi kerak');
  }

  // Allaqachon bor — qayta yasamaymiz
  const existing = row.avatar_angles ?? {};
  if (existing[angle]) return toDto(row);

  // Boshqa burchak ketayotgan bo'lsa kutamiz
  if (row.angle_job_id) return toDto(row);

  const prompt = buildAvatarPrompt(row.gender, row.measurements ?? {}, angle);

  const facePhotoUrl = (await presignRead(row.face_texture_url)) ?? row.face_texture_url;

  /*
   * ⚠️ BAND BELGISI AVVAL QO'YILADI. `angle_pending` — bu yerda ham
   * qulf: tugmani tez-tez bosgan odam bir necha ishni parallel
   * boshlamasin va har biriga alohida to'lamasin.
   *
   * `angle_job_id` endi provayder ishi emas — u shunchaki «band» belgisi,
   * chunki OpenAI'da ish raqami yo'q.
   */
  await pool.query(
    `UPDATE profiles
        SET angle_job_id = 'local', angle_pending = $2, angle_updated_at = now()
      WHERE user_id = $1`,
    [userId, angle],
  );

  void runAngle(userId, facePhotoUrl, prompt, angle);

  logger.info({ userId, angle }, 'burchak yasash boshlandi');
  return { ...toDto(row), anglePending: angle };
}

/**
 * Burchakni fonda yasaydi va profilga yozadi.
 *
 * ⚠️ QULF HAR HOLDA OCHILADI. Xato bo'lsa ham `angle_job_id` va
 * `angle_pending` tozalanadi — aks holda foydalanuvchi boshqa burchak
 * so'ray olmay qolardi va sababini bilmasdi.
 */
async function runAngle(
  userId: string,
  facePhotoUrl: string,
  prompt: string,
  angle: AvatarAngle,
): Promise<void> {
  try {
    /*
     * ⚠️ BURCHAK UZATILISHI SHART. Ilgari u FAQAT `prompt` ichida
     * turardi, `generateAvatar` esa o'z matnida «facing the camera»
     * deb qotirib qo'ygan edi — ikkalasi ziddiyatga kirib, model har
     * doim OLD ko'rinish qaytarardi. Foydalanuvchi uch burchak uchun
     * uch marta to'lab, bir xil suratni olardi.
     */
    const buffer = await generateAvatar(facePhotoUrl, prompt, angle);

    const url = await uploadObject({
      key: `avatar/${randomUUID()}.png`,
      body: buffer,
      contentType: 'image/png',
    });

    await pool.query(
      `UPDATE profiles
          SET avatar_angles = COALESCE(avatar_angles, '{}'::jsonb) || jsonb_build_object($2::text, $3::text),
              angle_job_id = NULL, angle_pending = NULL, angle_updated_at = now()
        WHERE user_id = $1`,
      [userId, angle, url],
    );

    logger.info({ userId, angle }, 'burchak tayyor');
  } catch (err) {
    logger.error({ err, userId, angle }, 'burchak yasalmadi');

    await pool
      .query(`UPDATE profiles SET angle_job_id = NULL, angle_pending = NULL WHERE user_id = $1`, [
        userId,
      ])
      .catch(() => {
        // Baza ham yiqilsa qiladigan ish qolmaydi
      });
  }
}

export async function sweepStaleAvatars(): Promise<number> {
  /*
   * ⚠️ VAZIFASI O'ZGARDI. Ilgari bu provayderdan holat so'rab, tayyor
   * ishlarni yakunlardi. OpenAI sinxron bo'lgani uchun yakunlash fon
   * ishining o'zida bo'ladi — bu yerda faqat EGASIZ QOLGANLAR yopiladi.
   *
   * Egasiz qolish sababi: ish XOTIRADA edi, provayderda emas. Server
   * generatsiya paytida qayta ishga tushsa ish yo'qoladi va profil
   * `processing` da abadiy qolardi — foydalanuvchi aylanayotgan
   * indikatorga qarab o'tirardi.
   *
   * 10 daqiqa — modelning eng sekin holatidan (30–60 s) ancha ko'p,
   * ya'ni tirik ish xato bilan yopilmaydi.
   */
  const { rowCount } = await pool.query(
    `UPDATE profiles
        SET avatar_status = 'failed',
            avatar_error = $1,
            avatar_updated_at = now()
      WHERE avatar_status = 'processing'
        AND avatar_updated_at < now() - interval '10 minutes'
        /*
         * ⚠️ OPERATOR NAVBATIDAGILAR TEGILMAYDI. Ular egasiz emas —
         * shunchaki odamni kutyapti, kechasi esa soatlab. Bu shartsiz
         * har bir tungi so'rov 10 daqiqadan keyin «uzilib qoldi» bo'lib,
         * operator uni ko'rmasdan o'lardi.
         */
        AND NOT EXISTS (
          SELECT 1 FROM developer_ai_tasks t
           WHERE t.kind = 'avatar'
             AND t.ref_id = profiles.user_id
             AND t.status IN ('pending', 'claimed')
        )`,
    ['Avatar yasash uzilib qoldi — qaytadan urinib ko`ring'],
  );

  // Egasiz qolgan burchak qulflari ham ochiladi
  await pool.query(
    `UPDATE profiles SET angle_job_id = NULL, angle_pending = NULL
      WHERE angle_job_id IS NOT NULL
        AND angle_updated_at < now() - interval '10 minutes'`,
  );

  return rowCount ?? 0;
}
