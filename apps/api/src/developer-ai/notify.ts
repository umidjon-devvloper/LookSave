import { env } from '../config/env';
import { pool } from '../db/pool';
import { sendPush } from '../integrations/push';
import {
  editMessageText,
  escapeHtml,
  sendMessage,
  type InlineButton,
} from '../integrations/telegram';
import { logger } from '../logger';

/**
 * Operator navbati xabarlari.
 *
 * Ikki tomon bor:
 *  • OPERATORLAR — Telegram guruhiga yangi ish haqida xabar. Keyin o'sha
 *    xabarning O'ZI yangilanadi («kutmoqda» → «Ali oldi» → «tayyor»),
 *    shunda guruhda qaysi ish ochiqligi bir qarashda ko'rinadi.
 *  • MIJOZ — ish tugaganda push.
 *
 * ⚠️ HAMMASI «ENG YAXSHI URINISH». Xabar yuborilmasa ish to'xtamaydi:
 * navbat bazada, panel uni baribir ko'rsatadi. Shuning uchun bu yerdagi
 * xatolar yutiladi va faqat logga yoziladi — `enqueueTask` ni
 * Telegramning holatiga bog'lash mijoz so'rovini yiqitardi.
 */

export type TaskKind = 'avatar' | 'render';

const KIND_LABEL: Record<TaskKind, string> = {
  avatar: 'Avatar yasash',
  render: 'Kiyintirish',
};

interface TaskRef {
  id: string;
  kind: TaskKind;
  userId: string;
  createdAt: Date;
}

function panelLink(taskId: string): string {
  return `${env().DEVELOPER_AI_PANEL_URL}/?task=${taskId}`;
}

function openButton(taskId: string): InlineButton[][] {
  return [[{ text: 'Panelda ochish', url: panelLink(taskId) }]];
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

/** Yangi ish — guruhga xabar va uning raqamini saqlash. */
export async function announceTask(task: TaskRef): Promise<void> {
  const chatId = env().DEVELOPER_AI_TELEGRAM_CHAT_ID;
  if (!chatId) return;

  try {
    const text = [
      `🟡 <b>${KIND_LABEL[task.kind]}</b> · #${shortId(task.id)}`,
      'Kutmoqda — hali hech kim olmagan',
      '',
      'Mijozga «5 daqiqada tayyor» deyilgan.',
    ].join('\n');

    const sent = await sendMessage(chatId, text, openButton(task.id));
    if (sent.status !== 'ok' || !sent.result) return;

    await pool.query(
      `UPDATE developer_ai_tasks SET tg_chat_id = $2, tg_message_id = $3 WHERE id = $1`,
      [task.id, String(sent.result.chat.id), sent.result.message_id],
    );
  } catch (err) {
    logger.warn({ err, taskId: task.id }, 'developer_ai: telegram xabari yuborilmadi');
  }
}

type Stage =
  | { kind: 'claimed'; operatorName: string }
  | { kind: 'done'; operatorName: string; seconds: number }
  | { kind: 'failed'; operatorName: string; reason: string };

function minutes(seconds: number): string {
  if (seconds < 60) return `${seconds} soniya`;
  return `${Math.round(seconds / 60)} daqiqa`;
}

/** Guruhdagi xabarni ishning yangi holatiga moslaydi. */
export async function updateAnnouncement(taskId: string, stage: Stage): Promise<void> {
  try {
    const { rows } = await pool.query<{
      kind: TaskKind;
      tg_chat_id: string | null;
      tg_message_id: string | null;
    }>(
      `SELECT kind, tg_chat_id, tg_message_id FROM developer_ai_tasks WHERE id = $1`,
      [taskId],
    );

    const row = rows[0];
    if (!row?.tg_chat_id || !row.tg_message_id) return;

    const head = `<b>${KIND_LABEL[row.kind]}</b> · #${shortId(taskId)}`;
    const who = escapeHtml(stage.operatorName);

    let text: string;
    let buttons: InlineButton[][] | undefined;

    switch (stage.kind) {
      case 'claimed':
        text = `🔵 ${head}\n${who} bajaryapti`;
        buttons = openButton(taskId);
        break;
      case 'done':
        text = `🟢 ${head}\nTayyor — ${who}, ${minutes(stage.seconds)} ichida`;
        break;
      case 'failed':
        text = `🔴 ${head}\n${who} bajara olmadi: ${escapeHtml(stage.reason)}`;
        break;
    }

    await editMessageText(row.tg_chat_id, Number(row.tg_message_id), text, buttons);
  } catch (err) {
    logger.warn({ err, taskId }, 'developer_ai: telegram xabari yangilanmadi');
  }
}

/**
 * Natijaga mijozning yuzi QO'YILMADI — operatorlar guruhiga ogohlantirish.
 *
 * ⚠️ NEGA ALOHIDA XABAR (2026-11-12). Yuz almashtirish yiqilsa ham natija
 * mijozga ketadi (rasmsiz qoldirgandan ko'ra). Ilgari bu faqat server
 * logida `warn` bo'lib qolardi va hech kim bilmasdi: mijoz «bu men emasku»
 * deb yozguncha. Endi guruh darhol ko'radi va rasmni qayta yasashi mumkin.
 */
export async function warnFaceNotApplied(ref: {
  kind: TaskKind;
  /** Ish yoki mijoz identifikatori — xabarda qisqartirib ko'rsatiladi */
  id: string;
  reason: string;
}): Promise<void> {
  const chatId = env().DEVELOPER_AI_TELEGRAM_CHAT_ID;
  if (!chatId) return;

  try {
    const text = [
      `⚠️ <b>Yuz qo'yilmadi</b> · ${KIND_LABEL[ref.kind]} #${shortId(ref.id)}`,
      'Natija mijozga AI chizgan yuz bilan ketdi.',
      `Sabab: ${escapeHtml(ref.reason)}`,
    ].join('\n');

    await sendMessage(chatId, text);
  } catch (err) {
    logger.warn({ err, id: ref.id }, 'developer_ai: yuz haqidagi ogohlantirish yuborilmadi');
  }
}

/** Ish tugadi — mijozga xabar. */
export async function notifyCustomer(
  userId: string,
  kind: TaskKind,
  outcome: 'done' | 'failed',
): Promise<void> {
  try {
    if (kind === 'avatar') {
      await (outcome === 'done'
        ? sendPush(userId, 'Avataringiz tayyor', 'Endi kiyimlarni kiyib ko`rishingiz mumkin', {
            type: 'avatar_ready',
          })
        : sendPush(userId, 'Avatar yasalmadi', 'Sababini ilovada ko`ring', {
            type: 'avatar_failed',
          }));
      return;
    }

    if (outcome === 'done') {
      await sendPush(userId, 'Kiyim tayyor', 'Kiyintirish natijasini ko`ring', {
        type: 'render_ready',
      });
    }
  } catch (err) {
    logger.warn({ err, userId }, 'developer_ai: push yuborilmadi');
  }
}
