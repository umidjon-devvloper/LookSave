import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { env } from '../config/env';
import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { isFacefusionEnabled, swapAndCutout } from '../integrations/facefusion';
import { isOwnCdnUrl, presignRead, uploadObject } from '../integrations/r2';
import { logger } from '../logger';
import { makeCutout } from '../store/cutout';
import { storeAvatarSheet } from '../tryon/avatar-sheet';
import { announceTask, notifyCustomer, updateAnnouncement } from './notify';

/**
 * Operator navbati — `developer_ai` paneli uchun.
 *
 * AI ishini odam bajaradigan yo'l. So'rov bu yerga tushadi, operator uni
 * band qiladi, bajaradi va natijani qaytaradi.
 *
 * ⚠️ PANEL FAQAT NAVBATNI BILADI. Natija qayerga yozilishi (`profiles`
 * yoki `tryon_renders`) shu modul ichida hal qilinadi — panel avatar va
 * kiyintirishning ichki tuzilishini bilishi shart emas. Yangi ish turi
 * qo'shilsa faqat `applyResult` o'zgaradi.
 */

export type TaskKind = 'avatar' | 'render';
export type TaskStatus = 'pending' | 'claimed' | 'done' | 'failed' | 'expired';

/**
 * Bu ish turi operatorga ketadimi.
 *
 * ⚠️ SOZLAMA HAR CHAQIRUVDA O'QILADI, modul yuklanganda emas — sinovlarda
 * va qayta sozlashda eski qiymat qotib qolmasin.
 */
export function isManual(kind: TaskKind): boolean {
  return env()
    .DEVELOPER_AI_KINDS.split(',')
    .map((item) => item.trim())
    .includes(kind);
}

/**
 * Bu foydalanuvchi uchun AI MAJBURAN avtomatik (OpenAI) ishlaydimi.
 *
 * ⚠️ FAQAT SANAB O'TILGAN AKKAUNTLAR. Operator rejimi yoniq bo'lsa ham
 * (`DEVELOPER_AI_KINDS`), bu ro'yxatdagi userlar OpenAI orqali DARHOL natija
 * oladi. Sabab: App Store tekshiruvida demo akkaunt jonli natija ko'rishi
 * kerak, qolgan mijozlar esa operatorda qolsin (xarajat nazorati).
 *
 * `DEVELOPER_AI_AUTO_USERS` — vergul bilan ajratilgan user ID (UUID) ro'yxati.
 */
export function isAutoAiUser(userId: string): boolean {
  return env()
    .DEVELOPER_AI_AUTO_USERS.split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(userId);
}

export interface TaskDto {
  id: string;
  kind: TaskKind;
  userId: string;
  refId: string;
  status: TaskStatus;
  payload: Record<string, unknown>;
  /**
   * Payload'dagi suratlarning KO'RISH havolalari (`faceUrl` → imzolangan).
   *
   * ⚠️ PAYLOAD'NING O'ZIDA KANONIK MANZIL. Yuz surati shaxsiy bucketda —
   * panel uni to'g'ridan-to'g'ri ocha olmaydi. Imzo har o'qishda yangi
   * beriladi va bazaga yozilmaydi (u muddatli).
   */
  previews: Record<string, string>;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  /** Navbatda necha soniya turgani — panel «qancha kutdi» ni ko'rsatadi */
  waitingSeconds: number;
}

interface TaskRow {
  id: string;
  kind: TaskKind;
  user_id: string;
  ref_id: string;
  status: TaskStatus;
  payload: Record<string, unknown>;
  claimed_by: string | null;
  claimed_by_name?: string | null;
  claimed_at: Date | null;
  result_url: string | null;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

const COLUMNS = `
  t.id, t.kind, t.user_id, t.ref_id, t.status, t.payload,
  t.claimed_by, t.claimed_at, t.result_url, t.error, t.created_at, t.completed_at
`;

const SELECT_WITH_NAME = `
  SELECT ${COLUMNS}, u.full_name AS claimed_by_name
    FROM developer_ai_tasks t
    LEFT JOIN users u ON u.id = t.claimed_by
`;

async function signPreviews(payload: Record<string, unknown>): Promise<Record<string, string>> {
  const entries = Object.entries(payload).filter(
    (entry): entry is [string, string] =>
      entry[0].endsWith('Url') && typeof entry[1] === 'string' && entry[1].length > 0,
  );

  const signed = await Promise.all(
    entries.map(async ([key, url]) => [key, (await presignRead(url)) ?? url] as const),
  );

  return Object.fromEntries(signed);
}

async function toDto(row: TaskRow): Promise<TaskDto> {
  const started = row.claimed_at ?? row.completed_at ?? new Date();
  const payload = row.payload ?? {};

  return {
    id: row.id,
    kind: row.kind,
    userId: row.user_id,
    refId: row.ref_id,
    status: row.status,
    payload,
    previews: await signPreviews(payload),
    claimedBy: row.claimed_by,
    claimedByName: row.claimed_by_name ?? null,
    claimedAt: row.claimed_at?.toISOString() ?? null,
    resultUrl: row.result_url,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    waitingSeconds: Math.max(0, Math.round((started.getTime() - row.created_at.getTime()) / 1000)),
  };
}

async function findTask(taskId: string): Promise<TaskRow | null> {
  const { rows } = await pool.query<TaskRow>(`${SELECT_WITH_NAME} WHERE t.id = $1`, [taskId]);
  return rows[0] ?? null;
}

async function operatorName(operatorId: string): Promise<string> {
  const { rows } = await pool.query<{ full_name: string | null }>(
    `SELECT full_name FROM users WHERE id = $1`,
    [operatorId],
  );
  return rows[0]?.full_name ?? 'Operator';
}

/**
 * Ishni navbatga qo'yadi.
 *
 * ⚠️ TAKRORIY SO'ROV YANGI ISH YARATMAYDI. Bitta yozuvga bitta ochiq ish
 * bo'lishi jadval indeksida ta'minlangan; bu yerda konflikt jimgina
 * yutiladi va MAVJUD ish qaytariladi. Aks holda foydalanuvchi ekranni
 * qayta ochganda navbatga ikkinchi nusxa tushardi va operator bir ishni
 * ikki marta bajarardi.
 */
export async function enqueueTask(
  kind: TaskKind,
  userId: string,
  refId: string,
  payload: Record<string, unknown> = {},
): Promise<TaskDto> {
  const inserted = await pool.query<TaskRow>(
    `INSERT INTO developer_ai_tasks AS t (kind, user_id, ref_id, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING ${COLUMNS}`,
    [kind, userId, refId, JSON.stringify(payload)],
  );

  const fresh = inserted.rows[0];
  if (fresh) {
    logger.info({ taskId: fresh.id, kind, userId }, 'developer_ai: yangi ish');
    // Xabar yuborilmasa ham ish navbatda turadi — shuning uchun `void`
    void announceTask({ id: fresh.id, kind, userId, createdAt: fresh.created_at });
    return toDto(fresh);
  }

  const { rows } = await pool.query<TaskRow>(
    `${SELECT_WITH_NAME}
      WHERE t.kind = $1 AND t.ref_id = $2 AND t.status IN ('pending', 'claimed')`,
    [kind, refId],
  );

  const existing = rows[0];
  if (!existing) throw ApiError.internal('Navbat yozuvi topilmadi');
  return toDto(existing);
}

/** Mijoz ilovasi uchun: ish navbatdami va qachondan beri. */
export interface OpenTaskInfo {
  /** Navbatga tushgan payt — ilova sanoqni SHUNDAN yuritadi */
  queuedAt: string;
  /** Operator olganmi (ilova «ishlanmoqda» deb ko'rsatadi) */
  claimed: boolean;
}

/**
 * Bu yozuv uchun ochiq ish.
 *
 * ⚠️ VAQT SERVERDAN OLINADI, ilovada emas. Foydalanuvchi ilovani yopib
 * qaytsa, ilovadagi sanoq noldan boshlanardi va «5 daqiqa» va'dasi har
 * ochilishda qaytadan hisoblanardi.
 */
export async function openTaskFor(kind: TaskKind, refId: string): Promise<OpenTaskInfo | null> {
  const { rows } = await pool.query<{ created_at: Date; status: TaskStatus }>(
    `SELECT created_at, status FROM developer_ai_tasks
      WHERE kind = $1 AND ref_id = $2 AND status IN ('pending', 'claimed')
      ORDER BY created_at DESC
      LIMIT 1`,
    [kind, refId],
  );

  const row = rows[0];
  if (!row) return null;
  return { queuedAt: row.created_at.toISOString(), claimed: row.status === 'claimed' };
}

/**
 * Ishning egasi (mijoz) — operator kiyintirishida kerak.
 *
 * ⚠️ FAQAT `avatar` ISHIDA. Kiyintirish avatar ustiga bo'ladi; render
 * ishining `ref_id` esa render yozuvi, mijoz emas.
 */
export async function taskCustomer(
  taskId: string,
): Promise<{ userId: string; kind: TaskKind; storeId: string | null }> {
  const { rows } = await pool.query<{ user_id: string; kind: TaskKind; store_id: string | null }>(
    `SELECT user_id, kind, payload->>'storeId' AS store_id
       FROM developer_ai_tasks WHERE id = $1`,
    [taskId],
  );
  const row = rows[0];
  if (!row) throw ApiError.notFound('Bunday ish yo`q');
  if (row.kind !== 'avatar') {
    throw new ApiError('VALIDATION_ERROR', 'Kiyintirish faqat avatar ishida bo`ladi');
  }
  return { userId: row.user_id, kind: row.kind, storeId: row.store_id };
}

/** Panel uchun navbat. Sukut bo'yicha — hali bajarilmaganlari. */
export async function listTasks(
  status: TaskStatus | 'open' = 'open',
  limit = 50,
): Promise<TaskDto[]> {
  /*
   * ⚠️ TARTIB HOLATGA QARAB. Ochiq ishlar ENG ESKISI birinchi — navbat
   * shunday ishlaydi. Tugaganlar esa ENG YANGISI birinchi: operator
   * «hozirgina nima qildim» ni qidiradi, bir oy oldingini emas.
   */
  const open = status === 'open';
  const filter = open ? `t.status IN ('pending', 'claimed')` : `t.status = $1`;
  const order = open ? 't.created_at ASC' : 't.completed_at DESC NULLS LAST';
  const params = open ? [limit] : [status, limit];

  const { rows } = await pool.query<TaskRow>(
    `${SELECT_WITH_NAME}
      WHERE ${filter}
      ORDER BY ${order}
      LIMIT $${params.length}`,
    params,
  );

  return Promise.all(rows.map(toDto));
}

/**
 * «Men hali ishlayapman» — tirik belgisini yangilaydi.
 *
 * ⚠️ EGALIK TEKSHIRILADI. Aks holda istalgan operator begona ishning
 * belgisini yangilab, uni navbatga qaytmaydigan qilib qo'yardi.
 *
 * Topilmasa xato tashlamaydi: ish allaqachon yopilgan yoki boshqaga
 * o'tgan bo'lishi mumkin va bu ishlayotgan tomonni to'xtatishi shart
 * emas — u keyingi qadamda haqiqiy xatoni ko'radi.
 */
export async function heartbeatTask(
  taskId: string,
  operatorId: string,
): Promise<{ alive: boolean }> {
  const { rowCount } = await pool.query(
    `UPDATE developer_ai_tasks
        SET heartbeat_at = now()
      WHERE id = $1 AND claimed_by = $2 AND status = 'claimed'`,
    [taskId, operatorId],
  );

  return { alive: Boolean(rowCount) };
}

/**
 * Tashlab ketilgan ishlarni navbatga qaytaradi.
 *
 * ⚠️ TIRIK BELGISIGA QARAB, VAQTGA EMAS. Avatar ishi soatlab davom
 * etishi mumkin (bitta gavda va o'nlab kiyim) — «ancha bo'ldi, bo'shat»
 * degan qoida tirik ishni tortib olardi va ikki operator bir kiyimni
 * bir vaqtda yasab, biri ikkinchisining natijasini ustiga yozardi.
 *
 * ⚠️ ESKI QATORLARDA BELGI YO'Q (`NULL`) — ular migratsiyadan oldin
 * band qilingan. Ular uchun `claimed_at` ga qaraladi, aks holda
 * migratsiyadan keyingi birinchi supurishda HAMMASI navbatga
 * qaytardi.
 */
export async function sweepStaleTasks(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE developer_ai_tasks
        SET status = 'pending', claimed_by = NULL, claimed_at = NULL, heartbeat_at = NULL
      WHERE status = 'claimed'
        AND COALESCE(heartbeat_at, claimed_at) < now() - interval '15 minutes'`,
  );

  if (rowCount)
    logger.info({ count: rowCount }, 'developer_ai: tashlab ketilgan ishlar navbatga qaytdi');

  return rowCount ?? 0;
}

/**
 * Ishni band qiladi.
 *
 * ⚠️ SHART `UPDATE` NING O'ZIDA, oldindan `SELECT` bilan emas. Ikki
 * operator bir vaqtda bossa, tekshirish alohida bo'lsa ikkalasi ham
 * «bo'sh» deb ko'rardi va bir ishni ikki marta bajarardi. Bu yerda
 * `status = 'pending'` sharti yangilanish ichida — ya'ni faqat bittasi
 * qator oladi, ikkinchisiga `rowCount = 0` qaytadi.
 */
export async function claimTask(taskId: string, operatorId: string): Promise<TaskDto> {
  const { rowCount } = await pool.query(
    `UPDATE developer_ai_tasks
        SET status = 'claimed', claimed_by = $2, claimed_at = now(), heartbeat_at = now()
      WHERE id = $1 AND status = 'pending'`,
    [taskId, operatorId],
  );

  const task = await findTask(taskId);
  if (!task) throw ApiError.notFound('Bunday ish yo`q');

  if (!rowCount) {
    if (task.claimed_by === operatorId && task.status === 'claimed') return toDto(task);
    throw new ApiError('ALREADY_EXISTS', 'Bu ishni boshqa operator band qilgan');
  }

  void updateAnnouncement(taskId, {
    kind: 'claimed',
    operatorName: task.claimed_by_name ?? 'Operator',
  });
  return toDto(task);
}

/**
 * Band qilingan ishni navbatga qaytaradi — operator ketib qolsa yoki
 * xato bosgan bo'lsa. Aks holda ish uning nomida abadiy qolardi.
 */
export async function releaseTask(taskId: string, operatorId: string): Promise<TaskDto> {
  const { rowCount } = await pool.query(
    `UPDATE developer_ai_tasks
        SET status = 'pending', claimed_by = NULL, claimed_at = NULL, heartbeat_at = NULL
      WHERE id = $1 AND status = 'claimed' AND claimed_by = $2`,
    [taskId, operatorId],
  );

  const task = await findTask(taskId);
  if (!task) throw ApiError.notFound('Bunday ish yo`q');
  if (!rowCount) throw ApiError.forbidden('Bu ish sizda emas');

  return toDto(task);
}

/**
 * Ishni operatordan «tugadi» holatiga o'tkazadi.
 *
 * ⚠️ HOLAT VA EGA BITTA `UPDATE` SHARTIDA. Ilgari avval `SELECT`, keyin
 * `UPDATE` edi — tugmani ikki marta tez bosish ikkalasini ham o'tkazardi.
 * Endi faqat bittasi qator oladi.
 */
async function finish(
  client: PoolClient,
  taskId: string,
  operatorId: string,
  outcome: { status: 'done'; resultUrl: string } | { status: 'failed'; reason: string },
): Promise<TaskRow> {
  const { rows } = await client.query<TaskRow>(
    `UPDATE developer_ai_tasks AS t
        SET status = $3,
            result_url = $4,
            error = $5,
            completed_at = now()
      WHERE t.id = $1 AND t.status = 'claimed' AND t.claimed_by = $2
      RETURNING ${COLUMNS}`,
    [
      taskId,
      operatorId,
      outcome.status,
      outcome.status === 'done' ? outcome.resultUrl : null,
      outcome.status === 'failed' ? outcome.reason : null,
    ],
  );

  const row = rows[0];
  if (row) return row;

  const current = await findTask(taskId);
  if (!current) throw ApiError.notFound('Bunday ish yo`q');
  if (current.status !== 'claimed') {
    throw new ApiError('VALIDATION_ERROR', 'Ish band qilinmagan yoki allaqachon yopilgan');
  }
  throw ApiError.forbidden('Bu ishni boshqa operator band qilgan');
}

/**
 * Natijani ASL joyiga yozadi.
 *
 * ⚠️ NAVBAT YOZUVI O'ZI YETARLI EMAS. Mijoz ilovasi `profiles` va
 * `tryon_renders` ni o'qiydi — natija o'sha yerga ko'chirilmasa ilova
 * uni ko'rmasdi.
 *
 * ⚠️ AVATARDA ESKI BURCHAKLAR VA KESIM TOZALANADI. Ular OLDINGI avatardan
 * qolgan: yangi yuz bilan eski «yon» ko'rinish aralashib ketardi.
 */
async function applyResult(
  client: PoolClient,
  row: TaskRow,
  resultUrl: string,
  angles: Record<string, string> | null,
): Promise<void> {
  if (row.kind === 'avatar') {
    /*
     * Uch panelli varaq bo'lsa (`angles`) — asosiy avatar OLD bo'lak,
     * burchaklar esa uchalasi. Oddiy rasmda burchaklar bo'shatiladi.
     */
    await client.query(
      `UPDATE profiles
          SET avatar_image_url = $2,
              avatar_status = 'ready',
              avatar_error = NULL,
              avatar_angles = $3::jsonb,
              avatar_cutout_url = NULL,
              avatar_updated_at = now()
        WHERE user_id = $1`,
      [row.ref_id, angles?.['front'] ?? resultUrl, JSON.stringify(angles ?? {})],
    );
    return;
  }

  /*
   * ⚠️ VARAQ BO'LSA: asosiy yozuvga O'Z burchagidagi bo'lak, qolgan
   * burchaklar esa o'sha kiyim/asos/xesh bilan alohida yozuv bo'lib
   * qo'shiladi — mijoz Old/Yon/Orqa ni qayta so'ramasdan ko'radi.
   */
  const { rows } = await client.query<{
    user_id: string;
    variant_id: string;
    angle: string;
    source_hash: string;
    base_render_id: string | null;
  }>(
    `UPDATE tryon_renders
        SET result_url = COALESCE(($3::jsonb ->> angle), $2),
            status = 'ready', error = NULL, completed_at = now()
      WHERE id = $1
      RETURNING user_id, variant_id, angle, source_hash, base_render_id`,
    [row.ref_id, resultUrl, JSON.stringify(angles ?? {})],
  );
  const main = rows[0];
  if (!main || !angles) return;

  for (const [angle, url] of Object.entries(angles)) {
    if (angle === main.angle) continue;
    await client.query(
      `INSERT INTO tryon_renders (user_id, variant_id, angle, source_hash, base_render_id,
                                  status, provider, result_url, completed_at)
       VALUES ($1, $2, $3, $4, $5, 'ready', 'manual', $6, now())
       ON CONFLICT (user_id, variant_id, angle, source_hash)
         DO UPDATE SET result_url = EXCLUDED.result_url, cutout_url = NULL,
                       status = 'ready', error = NULL, completed_at = now()`,
      [main.user_id, main.variant_id, angle, main.source_hash, main.base_render_id, url],
    );
  }
}

async function applyFailure(client: PoolClient, row: TaskRow, reason: string): Promise<void> {
  if (row.kind === 'avatar') {
    await client.query(
      `UPDATE profiles
          SET avatar_status = 'failed', avatar_error = $2, avatar_updated_at = now()
        WHERE user_id = $1`,
      [row.ref_id, reason],
    );
    return;
  }

  await client.query(
    `UPDATE tryon_renders SET status = 'failed', error = $2, completed_at = now()
      WHERE id = $1`,
    [row.ref_id, reason],
  );
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Operator natijani topshirdi.
 *
 * ⚠️ MANZIL BIZNING OMBORDAN BO'LISHI SHART. Ixtiyoriy havola qabul
 * qilinsa mijoz ilovasida begona saytdagi surat ko'rsatilardi — u
 * istalgan paytda o'zgarishi yoki o'chishi mumkin.
 *
 * ⚠️ NAVBAT VA ASL YOZUV BITTA TRANZAKSIYADA. Aks holda natija mijozga
 * yetib, navbatdagi ish «band» holatida osilib qolishi (yoki aksincha)
 * mumkin edi.
 */
/**
 * Varaqni ajratib bo'lmadi — operatorga aniq sabab qaytadi va ish yopilmaydi.
 * Aks holda mijozga butun varaq (uch odam yonma-yon) avatar bo'lib borardi.
 */
function sheetError(err: unknown): never {
  logger.error({ err }, 'avatar varag`i ajratilmadi');
  throw new ApiError('VALIDATION_ERROR', 'Rasmni 3 ga bo`lib bo`lmadi — qayta yuklab ko`ring');
}

/*
 * Operator yuklagan rasmga foydalanuvchining asl yuzini joylaydi.
 *
 * ⚠️ ASL RASM O'ZGARTIRILMAYDI. Yangi R2 kaliti bilan yoziladi — kesh va
 * audit zanjiri buzilmasligi uchun. Facefusion yoqilmagan, foydalanuvchida
 * yuz referensi yo'q, yoki yuklab bo'lmasa — asl manzil o'zgarmasdan
 * qaytadi va mijoz hech narsadan mahrum bo'lmaydi.
 *
 * Varaq rejimida (`angles` 3 ta burchak) — har burchak uchun alohida
 * chaqiriladi; `facefusion.ts` ichida `FACEFUSION_FRONT_ONLY` yon/orqani
 * o'tkazib yuboradi, lekin biz baribir hammasiga chaqiramiz, modul o'zi
 * hal qiladi.
 */
async function applyFaceSwapForOperatorResult(
  kind: 'render' | 'avatar',
  refId: string,
  resultUrl: string,
  angles: Record<string, string> | null,
): Promise<{ url: string; angles: Record<string, string> | null }> {
  if (!isFacefusionEnabled()) {
    logger.info({ refId, kind }, 'facefusion o\'chiq — face swap o\'tkazilmadi');
    return { url: resultUrl, angles };
  }

  /*
   * ⚠️ FACE REFERENCE QAYERDAN:
   * - `render` ishi: refId = tryon_renders.id → shu userning face_texture_url/avatar
   * - `avatar` ishi: refId = profiles.user_id → to'g'ridan-to'g'ri face_texture_url
   *
   * ⚠️ `avatar_image_url` FALLBACK EMAS AVATAR ISHIDA — avatar aynan
   * o'sha payt yasalayapti, eskisini ishlatish mantiqsiz. Faqat
   * `face_texture_url` (foydalanuvchi selfie yuklagan) kerak.
   */
  const faceQuery = kind === 'render'
    ? {
        sql: `SELECT COALESCE(p.face_texture_url, p.avatar_image_url) AS face_reference_url,
                     r.angle
                FROM tryon_renders r
                JOIN profiles p ON p.user_id = r.user_id
               WHERE r.id = $1`,
        param: refId,
      }
    : {
        sql: `SELECT face_texture_url AS face_reference_url, 'front'::text AS angle
                FROM profiles WHERE user_id = $1`,
        param: refId,
      };

  const { rows } = await pool.query<{
    face_reference_url: string | null;
    angle: string;
  }>(faceQuery.sql, [faceQuery.param]);
  const faceReferenceRaw = rows[0]?.face_reference_url;
  const mainAngle = (rows[0]?.angle ?? 'front') as 'front' | 'side' | 'back';
  if (!faceReferenceRaw) {
    logger.info({ refId, kind }, 'face referens topilmadi — face swap o\'tkazilmadi');
    return { url: resultUrl, angles };
  }

  const faceReferenceUrl = (await presignRead(faceReferenceRaw)) ?? faceReferenceRaw;

  async function swapOne(url: string, angle: 'front' | 'side' | 'back'): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) return url;
    const target = Buffer.from(await res.arrayBuffer());
    /*
     * ⚠️ `swapAndCutout` (2026-11-09): fly.io'da bitta chaqiruv —
     * face swap + background removal birgalikda. Natija SHAFFOF PNG
     * bo'ladi, VPS'da qo'shimcha cutout kerak emas.
     */
    const swapped = await swapAndCutout({ target, sourceFaceUrl: faceReferenceUrl, angle });
    if (swapped === target) return url;
    return uploadObject({
      key: `tryon/manual/${randomUUID()}.png`,
      body: swapped,
      contentType: 'image/png',
    });
  }

  if (angles) {
    const entries = await Promise.all(
      (Object.entries(angles) as Array<[string, string]>).map(async ([angle, url]) => {
        const a = (angle as 'front' | 'side' | 'back') ?? 'front';
        return [angle, await swapOne(url, a).catch(() => url)] as const;
      }),
    );
    const nextAngles = Object.fromEntries(entries) as Record<string, string>;
    return { url: nextAngles[mainAngle] ?? resultUrl, angles: nextAngles };
  }

  const nextUrl = await swapOne(resultUrl, mainAngle).catch(() => resultUrl);
  return { url: nextUrl, angles: null };
}

export async function completeTask(
  taskId: string,
  operatorId: string,
  resultUrl: string,
): Promise<TaskDto> {
  if (!isOwnCdnUrl(resultUrl)) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Natija avval panel orqali yuklanishi kerak — tashqi havola qabul qilinmaydi',
    );
  }

  /*
   * Uch panelli varaq (old · yon · orqa) — bo'laklarga ajratiladi.
   *
   * ⚠️ TRANZAKSIYADAN OLDIN. Yuklab olish, kesish va R2 ga yozish bir
   * necha soniya oladi; tranzaksiya ichida bo'lsa navbat qatori shuncha
   * vaqt qulflanib turardi. Ish esa hali «band» — boshqa operator uni
   * ololmaydi, ya'ni oldindan qilish xavfsiz.
   *
   * Faqat avatar ishida: kiyintirish natijasi har doim bitta surat.
   */
  const pending = await findTask(taskId);
  // Kiyintirish ham endi uch panelli varaq bo'lib kelishi mumkin (2026-09-25)
  let angles = pending ? await storeAvatarSheet(resultUrl).catch(sheetError) : null;
  let finalResultUrl = resultUrl;

  /*
   * ⚠️ OPERATOR REJIMIDA HAM YUZ ALMASHTIRILADI (2026-11-09).
   *
   * Avval faqat auto-render (`tryon/render.ts`) Facefusion'ni chaqirardi;
   * operator yuklagan rasm "o'zidek" borar edi — ya'ni rasmda GPT chizgan
   * umumiy chehra ko'rinardi va foydalanuvchi "bu men emasku" deb
   * hayron qolardi. Endi faqat kiyintirish ishlarida (`render`), yuz
   * referensi va Facefusion yoqilgan bo'lsa, panel'dan kelgan rasmga
   * foydalanuvchining asl yuzi joylashtiriladi — xuddi auto rejim kabi.
   *
   * Tranzaksiyadan OLDIN qilinadi — ish qulflanib turmasin. Avatar
   * ishida yuz almashtirish o'rinsiz: aynan yuz skanining o'zi.
   */
  if (pending) {
    try {
      const swapped = await applyFaceSwapForOperatorResult(
        pending.kind,
        pending.ref_id,
        resultUrl,
        angles,
      );
      finalResultUrl = swapped.url;
      angles = swapped.angles;
    } catch (err) {
      logger.warn({ err, taskId, kind: pending.kind }, 'operator face swap yiqildi — asl rasm qoladi');
    }
  }

  const row = await inTransaction(async (client) => {
    const finished = await finish(client, taskId, operatorId, {
      status: 'done',
      resultUrl: finalResultUrl,
    });
    await applyResult(client, finished, finalResultUrl, angles);
    return finished;
  });

  const task = await findTask(taskId);
  if (!task) throw ApiError.internal('Ish yangilanmadi');

  /*
   * Tranzaksiyadan KEYIN: kesim sekin (fon olib tashlash modeli) va
   * uning nosozligi avatarni buzmasligi kerak — ilova kesimsiz ham
   * oddiy suratni ko'rsatadi.
   */
  /*
   * ⚠️ KIYINTIRISH UCHUN HAM SHART — ILGARI FAQAT AVATAR UCHUN EDI.
   *
   * Server o'zi yasagan kiyintirishda kesim bor (`render.ts` —
   * `storeResult`), operator yuborganida esa yo'q edi. Natijada bitta
   * mijozning gallereyasida ikki xil surat turardi: bittasi qorong'i
   * sahnaga toza tushardi, ikkinchisi och kulrang to'rtburchak bo'lib
   * ko'rinardi — va farq operatordan kelgan-kelmaganiga bog'liq edi.
   */
  if (row.kind === 'avatar') {
    void attachCutout(row.ref_id, angles?.['front'] ?? finalResultUrl);
  } else {
    /*
     * ⚠️ HAR BURCHAKKA KESIM. Avval faqat asosiy burchak uchun chaqirardi
     * (`attachRenderCutout(row.ref_id, ...)`). Natijada yon/orqa rasmlar
     * qora/kulrang fon bilan ekranda chiqar edi — AvatarStage `cutout_url`
     * yo'qligida fon'siz asl rasmni to'g'ridan-to'g'ri joylaydi, ortida
     * manikenning qora chegarasi ko'rinadi. Endi har bir angle rowi'ga
     * `cutout_url` joylanadi — ularni ref_id emas, (user_id, variant_id,
     * angle, source_hash) bo'yicha topamiz, chunki applyResult yon/orqa
     * uchun yangi id bilan INSERT qilgan.
     */
    if (angles) {
      void attachRenderCutoutsForAllAngles(row.ref_id);
    } else {
      void attachRenderCutout(row.ref_id, finalResultUrl);
    }
  }

  void updateAnnouncement(taskId, {
    kind: 'done',
    operatorName: task.claimed_by_name ?? 'Operator',
    seconds: secondsSince(row.created_at),
  });
  void notifyCustomer(row.user_id, row.kind, 'done');

  return toDto(task);
}

/**
 * Operator bajara olmadi.
 *
 * ⚠️ ASL YOZUV HAM BELGILANADI. Aks holda mijoz ilovasida «tayyorlanmoqda»
 * abadiy aylanib turardi.
 */
export async function failTask(
  taskId: string,
  operatorId: string,
  reason: string,
): Promise<TaskDto> {
  const row = await inTransaction(async (client) => {
    const finished = await finish(client, taskId, operatorId, { status: 'failed', reason });
    await applyFailure(client, finished, reason);
    return finished;
  });

  const task = await findTask(taskId);
  if (!task) throw ApiError.internal('Ish yangilanmadi');

  void updateAnnouncement(taskId, {
    kind: 'failed',
    operatorName: task.claimed_by_name ?? (await operatorName(operatorId)),
    reason,
  });
  void notifyCustomer(row.user_id, row.kind, 'failed');

  return toDto(task);
}

function secondsSince(date: Date): number {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
}

/**
 * Kiyintirish natijasining kesimi.
 *
 * ⚠️ SHART `result_url` BO'YICHA HAM TEKSHIRILADI. Kesim yasalguncha
 * (bir necha soniya) mijoz o'sha kiyimni qayta so'ragan va natija
 * almashgan bo'lishi mumkin — eski kesim yangi suratga yozilmasligi
 * kerak, aks holda odam bir kiyimda, kesimda boshqasida bo'lardi.
 */
async function attachRenderCutout(renderId: string, url: string): Promise<void> {
  try {
    logger.info({ renderId, url: url.slice(0, 80) }, 'cutout: attach boshlanmoqda');
    const cutout = await makeCutout(url, 'tryon');
    if (!cutout) {
      logger.warn({ renderId }, 'cutout: makeCutout null qaytardi');
      return;
    }
    logger.info({ renderId, cutout: cutout.slice(0, 80) }, 'cutout: PNG tayyor, UPDATE');

    const res = await pool.query(
      `UPDATE tryon_renders SET cutout_url = $2 WHERE id = $1 AND result_url = $3`,
      [renderId, cutout, url],
    );
    logger.info({ renderId, rowCount: res.rowCount }, 'cutout: UPDATE tugadi');
  } catch (err) {
    logger.warn({ err, renderId }, 'developer_ai: kiyintirish kesimi yasalmadi');
  }
}

/*
 * Varaq bo'lgan ishda hamma burchak rowi'ga kesim ulaydi.
 * applyResult `source_hash` orqali bog'liq rowlarni yaratgan — asosiy ref_id
 * orqali topib, (user_id, variant_id, source_hash) ga mos barcha ready
 * rowlarga shu burchakning kesimini joylaymiz.
 */
async function attachRenderCutoutsForAllAngles(mainRenderId: string): Promise<void> {
  try {
    const { rows } = await pool.query<{ id: string; result_url: string }>(
      `SELECT r2.id, r2.result_url
         FROM tryon_renders r1
         JOIN tryon_renders r2
           ON r2.user_id = r1.user_id
          AND r2.variant_id = r1.variant_id
          AND r2.source_hash = r1.source_hash
        WHERE r1.id = $1
          AND r2.status = 'ready'
          AND r2.result_url IS NOT NULL
          AND r2.cutout_url IS NULL`,
      [mainRenderId],
    );
    for (const row of rows) {
      await attachRenderCutout(row.id, row.result_url);
    }
  } catch (err) {
    logger.warn({ err, mainRenderId }, 'developer_ai: varaq kesimlari yasalmadi');
  }
}

async function attachCutout(userId: string, url: string): Promise<void> {
  try {
    const cutout = await makeCutout(url, 'avatar');
    if (!cutout) return;

    // Shu orada avatar yana almashgan bo'lsa eski kesim yozilmaydi
    await pool.query(
      `UPDATE profiles SET avatar_cutout_url = $2
        WHERE user_id = $1 AND avatar_image_url = $3`,
      [userId, cutout, url],
    );
  } catch (err) {
    logger.warn({ err, userId }, 'developer_ai: avatar kesimi yasalmadi');
  }
}
