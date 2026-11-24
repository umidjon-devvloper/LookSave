import crypto from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../db/pool';
import { env } from '../config/env';
import { ApiError } from '../http/api-error';
import { getAuth, getAuthOptional } from '../http/auth-middleware';
import { sendData } from '../http/respond';
import { route } from '../http/validate';

/**
 * «Do'stlar bilan birga sinash» — group try-on (Tier 1 №01).
 *
 * Oqim:
 *   1) Foydalanuvchi try-on natijasini ulashish uchun sessiya yaratadi
 *      (POST /v1/group-tryon). Snapshot sifatida render havolasi va kichik
 *      izoh saqlanadi (render keyinchalik o'chirilsa ham link ishlasin).
 *   2) `shareUrl` ni WhatsApp/Telegram'ga yuboradi. Do'st web yoki deep
 *      link orqali ochadi.
 *   3) Do'st ovoz beradi (POST /v1/group-tryon/:id/vote) — akkauntsiz;
 *      qurilma barmog'i bo'yicha UPSERT.
 *   4) Egasi va boshqa do'stlar natijalarni ko'radi (GET).
 *
 * ⚠️ OVOZ ANONIM — akkaunt talab qilinmaydi. Barmoq: `X-Device-Id`
 * sarlavhasi bo'lsa shu, bo'lmasa IP+UA sha256. Shuning uchun do'st
 * ilovani yuklab olmay turib link orqali ko'rsa ham ovoz berish mumkin.
 *
 * ⚠️ SESSIYA 30 KUNGA, keyin avtomatik tozalanadi (migratsiya 038).
 * Spamdan himoya hozircha yo'q — kerak bo'lsa yaratish uchun kunlik
 * chegara qo'shiladi.
 */

export const groupTryonRouter: Router = Router();

const EMOJI = ['like', 'love', 'fire', 'cool', 'no'] as const;
type Emoji = (typeof EMOJI)[number];

interface SessionRow {
  id: string;
  render_id: string;
  creator_user_id: string;
  image_url: string;
  caption: string | null;
  created_at: Date;
  expires_at: Date;
}

interface VoteRow {
  voter_fingerprint: string;
  emoji: Emoji;
  comment: string | null;
  created_at: Date;
}

/**
 * Qurilma barmog'i — avval sarlavha, bo'lmasa IP+UA sha256.
 *
 * ⚠️ IP KUYIKADI (NAT'da bir nechta qurilma bitta IP'da) — shuning uchun
 * ilova X-Device-Id sarlavhasini yuborishi tavsiya etiladi. IP+UA bitta
 * uy tarmog'idagi bitta brauzerda ishlaydi.
 */
function voterFingerprint(req: {
  get(name: string): string | undefined;
  ip?: string;
}): string {
  const header = req.get('X-Device-Id');
  if (header && header.length >= 8) return `d:${header.slice(0, 64)}`;

  const ip = req.ip ?? 'unknown';
  const ua = req.get('User-Agent') ?? 'unknown';
  return `w:${crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32)}`;
}

function shareUrlFor(id: string): string {
  // `WEB_BASE_URL` sozlangan bo'lsa shu ishlatiladi (deep link bilan
  // moslashuvchan), bo'lmasa web yo'q — faqat ilova sxemasi beriladi.
  const base = env().PUBLIC_WEB_URL;
  if (base) return `${base.replace(/\/$/, '')}/g/${id}`;
  return `looksave://group/${id}`;
}

/**
 * POST /v1/group-tryon — yangi ulashish sessiyasi.
 *
 * Kirish: `{ renderId: UUID, caption?: string }`. Render foydalanuvchiniki
 * bo'lishi shart.
 */
groupTryonRouter.post(
  '/group-tryon',
  route(
    {
      body: z.object({
        renderId: z.string().uuid(),
        caption: z.string().max(200).optional(),
      }),
    },
    async (input, _req, res) => {
      const auth = getAuth(res);

      const { rows: renders } = await pool.query<{ id: string; result_url: string | null }>(
        `SELECT id, result_url FROM tryon_renders
          WHERE id = $1 AND user_id = $2 AND status = 'ready'`,
        [input.body.renderId, auth.sub],
      );
      const render = renders[0];
      if (!render) throw ApiError.notFound('Render topilmadi yoki hali tayyor emas');
      if (!render.result_url) throw ApiError.notFound('Render rasmi yo`q');

      const { rows } = await pool.query<SessionRow>(
        `INSERT INTO group_tryon_sessions (render_id, creator_user_id, image_url, caption)
         VALUES ($1, $2, $3, $4)
         RETURNING id, render_id, creator_user_id, image_url, caption, created_at, expires_at`,
        [render.id, auth.sub, render.result_url, input.body.caption ?? null],
      );

      const session = rows[0]!;
      sendData(res, {
        id: session.id,
        imageUrl: session.image_url,
        caption: session.caption,
        shareUrl: shareUrlFor(session.id),
        expiresAt: session.expires_at.toISOString(),
      });
    },
  ),
);

/**
 * GET /v1/group-tryon/:id — sessiya + ovozlar.
 *
 * ⚠️ OCHIQ — akkaunt shart emas. Egasi uchun `isMine: true` qaytadi.
 */
groupTryonRouter.get(
  '/group-tryon/:id',
  route(
    { params: z.object({ id: z.string().uuid() }) },
    async (input, req, res) => {
      const { rows } = await pool.query<SessionRow>(
        `SELECT id, render_id, creator_user_id, image_url, caption, created_at, expires_at
           FROM group_tryon_sessions
          WHERE id = $1`,
        [input.params.id],
      );
      const session = rows[0];
      if (!session) throw ApiError.notFound('Sessiya topilmadi');

      const isExpired = session.expires_at.getTime() < Date.now();

      const { rows: votes } = await pool.query<VoteRow>(
        `SELECT voter_fingerprint, emoji, comment, created_at
           FROM group_tryon_votes
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 100`,
        [session.id],
      );

      const counts: Record<Emoji, number> = { like: 0, love: 0, fire: 0, cool: 0, no: 0 };
      for (const v of votes) counts[v.emoji] += 1;

      const me = voterFingerprint(req);
      const myVote = votes.find((v) => v.voter_fingerprint === me);

      const auth = getAuthOptional(res);

      sendData(res, {
        id: session.id,
        imageUrl: session.image_url,
        caption: session.caption,
        createdAt: session.created_at.toISOString(),
        expiresAt: session.expires_at.toISOString(),
        isExpired,
        isMine: auth?.sub === session.creator_user_id,
        counts,
        totalVotes: votes.length,
        myEmoji: myVote?.emoji ?? null,
        comments: votes
          .filter((v) => v.comment && v.comment.trim().length > 0)
          .slice(0, 20)
          .map((v) => ({ emoji: v.emoji, comment: v.comment, createdAt: v.created_at.toISOString() })),
      });
    },
  ),
);

/**
 * POST /v1/group-tryon/:id/vote — ovoz berish yoki o'zgartirish.
 *
 * ⚠️ UPSERT — bitta qurilma bitta sessiyaga bir marta ovoz beradi, keyingi
 * chaqiruv emoji'ni yangilaydi (ikkinchi fikr).
 */
groupTryonRouter.post(
  '/group-tryon/:id/vote',
  route(
    {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        emoji: z.enum(EMOJI),
        comment: z.string().max(200).optional(),
      }),
    },
    async (input, req, res) => {
      const { rows: sessions } = await pool.query<SessionRow>(
        `SELECT id, render_id, creator_user_id, image_url, caption, created_at, expires_at
           FROM group_tryon_sessions
          WHERE id = $1`,
        [input.params.id],
      );
      const session = sessions[0];
      if (!session) throw ApiError.notFound('Sessiya topilmadi');
      if (session.expires_at.getTime() < Date.now()) {
        throw ApiError.notFound('Sessiya muddati tugagan');
      }

      const voter = voterFingerprint(req);
      const auth = getAuthOptional(res);

      await pool.query(
        `INSERT INTO group_tryon_votes
           (session_id, voter_fingerprint, voter_user_id, emoji, comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (session_id, voter_fingerprint) DO UPDATE SET
           emoji = EXCLUDED.emoji,
           comment = COALESCE(EXCLUDED.comment, group_tryon_votes.comment),
           voter_user_id = COALESCE(EXCLUDED.voter_user_id, group_tryon_votes.voter_user_id),
           updated_at = now()`,
        [session.id, voter, auth?.sub ?? null, input.body.emoji, input.body.comment ?? null],
      );

      sendData(res, { ok: true, emoji: input.body.emoji });
    },
  ),
);
