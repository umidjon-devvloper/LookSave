import { env } from '../config/env';
import { logger } from '../logger';

/**
 * Telegram Bot API mijozi (09-integrations §2).
 *
 * Bot ulanmagan bo'lsa (token yo'q yoki do'kon botni bog'lamagan) —
 * hamma narsa JIM o'tkaziladi. Telegram ishlamayotgani buyurtma
 * yaratilishiga to'sqinlik qilmasligi kerak (§2.6).
 */

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface SendMessageResult {
  message_id: number;
  chat: { id: number };
}

export function isTelegramEnabled(): boolean {
  return env().TELEGRAM_BOT_TOKEN.length > 0;
}

/**
 * Natija uch xil bo'ladi va ular ARALASHTIRILMASLIGI kerak:
 *  - `ok`       — yuborildi
 *  - `skipped`  — bot sozlanmagan (dev muhiti)
 *  - `failed`   — xato. `fatal: true` bo'lsa do'kon botni bloklagan
 *                 yoki chat o'chirilgan → ulanishni uzish kerak.
 *
 * Bu farq muhim: tarmoq uzilgani uchun ulanishni uzib yuborsak,
 * do'kon buyurtmalarni Telegramda umuman ko'rmay qoladi.
 */
export type TgResult<T> =
  { status: 'ok'; result: T | null } | { status: 'skipped' } | { status: 'failed'; fatal: boolean };

async function tg<T>(method: string, payload: Record<string, unknown>): Promise<TgResult<T>> {
  if (!isTelegramEnabled()) {
    logger.debug({ method }, 'telegram o`chirilgan — o`tkazib yuborildi');
    return { status: 'skipped' };
  }

  const url = `https://api.telegram.org/bot${env().TELEGRAM_BOT_TOKEN}/${method}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    const body = (await response.json()) as TelegramResponse<T>;

    if (!body.ok) {
      // 403 — do'kon botni bloklagan, 400 — chat topilmadi (§2.6)
      const fatal = body.error_code === 403 || body.error_code === 400;
      logger.warn(
        { method, code: body.error_code, description: body.description },
        'telegram xatosi',
      );
      return { status: 'failed', fatal };
    }

    return { status: 'ok', result: body.result ?? null };
  } catch (err) {
    // Tarmoq xatosi — vaqtinchalik, ulanish uzilmaydi
    logger.warn({ err, method }, 'telegram so`rovi bajarilmadi');
    return { status: 'failed', fatal: false };
  }
}

/** Bot blokdami — shunda `telegram_chat_id` tozalanadi (§2.6). */
export async function sendMessage(
  chatId: number | string,
  text: string,
  buttons?: InlineButton[][],
): Promise<TgResult<SendMessageResult>> {
  return tg<SendMessageResult>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<void> {
  await tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons ?? [] },
  });
}

export async function editMessageReplyMarkup(
  chatId: number | string,
  messageId: number,
  buttons: InlineButton[][],
): Promise<void> {
  await tg('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
  showAlert = false,
): Promise<void> {
  await tg('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

/** HTML rejimida yuborilgani uchun mijoz matni ekranlanadi. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatMoney(amount: string, currency: string): string {
  const parts = amount.split('.');
  const whole = (parts[0] ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${whole} ${currency}`;
}
