import { Router } from 'express';

import { env } from '../config/env';
import { redis } from '../db/redis';
import { notifyStatusChange } from '../integrations/notify';
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  escapeHtml,
  sendMessage,
} from '../integrations/telegram';
import { logger } from '../logger';
import {
  findStoreByChatId,
  linkTelegramChat,
  transitionOrder,
  type StoreAction,
} from '../store/store';

export const telegramRouter: Router = Router();

interface TgChat {
  id: number;
}

interface TgMessage {
  message_id: number;
  chat: TgChat;
  text?: string;
}

interface TgCallbackQuery {
  id: string;
  from: { id: number };
  message?: TgMessage;
  data?: string;
}

interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'yangi',
  seen: 'ko`rilgan',
  confirmed: 'tasdiqlangan',
  rejected: 'rad etilgan',
  ready: 'tayyor',
  completed: 'yakunlangan',
  cancelled: 'bekor qilingan',
  expired: 'muddati o`tgan',
};

/**
 * `/start LS-A3F8K2` — do'konni ulash (09-integrations §2.3).
 * Guruh chatlari ham ishlaydi: `chat.id` manfiy bo'ladi, qolgani bir xil.
 */
async function handleStart(message: TgMessage, payload: string | undefined): Promise<void> {
  if (!payload) {
    await sendMessage(
      message.chat.id,
      'Salom! Do`konni ulash uchun panelda "Telegram" bo`limiga kiring.',
    );
    return;
  }

  const store = await linkTelegramChat(payload, message.chat.id);

  if (!store) {
    await sendMessage(message.chat.id, '❌ Kod eskirgan yoki noto`g`ri. Paneldan yangisini oling.');
    return;
  }

  await sendMessage(
    message.chat.id,
    `✅ <b>${escapeHtml(store.name)}</b> ulandi.\n\nEndi yangi buyurtmalar shu yerga keladi.`,
  );
}

/** `o:c:<uuid>` → confirm. 64 baytlik `callback_data` chegarasi uchun qisqa. */
const ACTIONS: Record<string, StoreAction> = {
  c: 'confirm',
  d: 'ready',
  k: 'complete',
};

const REJECT_REASONS: Record<string, string> = {
  oos: 'out_of_stock',
  siz: 'size_unavailable',
  fak: 'fake_order',
  oth: 'other',
};

async function handleCallback(callback: TgCallbackQuery): Promise<void> {
  const data = callback.data ?? '';
  const [prefix, action, orderId] = data.split(':');

  if (!orderId || !action) {
    await answerCallbackQuery(callback.id, 'Noma`lum amal', true);
    return;
  }

  const storeId = await findStoreByChatId(callback.from.id);
  if (!storeId) {
    await answerCallbackQuery(callback.id, 'Ruxsat yo`q', true);
    return;
  }

  // Rad etish sababini so'rash — sabab MAJBURIY (§2.5)
  if (prefix === 'o' && action === 'r') {
    if (callback.message) {
      await editMessageReplyMarkup(callback.message.chat.id, callback.message.message_id, [
        [{ text: 'Mahsulot tugagan', callback_data: `r:oos:${orderId}` }],
        [{ text: 'Bu o`lcham yo`q', callback_data: `r:siz:${orderId}` }],
        [{ text: 'Soxta buyurtma', callback_data: `r:fak:${orderId}` }],
        [{ text: 'Boshqa sabab', callback_data: `r:oth:${orderId}` }],
      ]);
    }
    await answerCallbackQuery(callback.id, 'Sababni tanlang');
    return;
  }

  try {
    if (prefix === 'r') {
      const reason = REJECT_REASONS[action];
      if (!reason) {
        await answerCallbackQuery(callback.id, 'Noma`lum sabab', true);
        return;
      }

      const result = await transitionOrder({
        storeId,
        orderId,
        action: 'reject',
        actorId: null,
        channel: 'telegram',
        reason,
        // Soxta buyurtma → raqam avtomatik bloklanadi
        blockPhone: reason === 'fake_order',
      });

      await notifyStatusChange(result.id, result.status);
      await answerCallbackQuery(callback.id, '❌ Rad etildi');
      return;
    }

    const storeAction = ACTIONS[action];
    if (!storeAction) {
      await answerCallbackQuery(callback.id, 'Noma`lum amal', true);
      return;
    }

    const result = await transitionOrder({
      storeId,
      orderId,
      action: storeAction,
      actorId: null,
      channel: 'telegram',
      ...(storeAction === 'complete' ? { paymentMethod: 'cash' as const } : {}),
    });

    await notifyStatusChange(result.id, result.status);
    await answerCallbackQuery(callback.id, `✅ ${STATUS_LABELS[result.status] ?? result.status}`);
  } catch (err) {
    // Ikki xodim bir vaqtda bosgan bo'lishi mumkin (§2.6)
    const message =
      typeof err === 'object' && err !== null && 'code' in err && err.code === 'INVALID_STATE'
        ? 'Buyurtma allaqachon boshqa holatda'
        : 'Amal bajarilmadi';
    await answerCallbackQuery(callback.id, message, true);
    logger.warn({ err, orderId }, 'telegram callback bajarilmadi');
  }
}

async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    // Bir xil xabar ikki marta kelishi mumkin (§2.6) — 60 s ichida bir marta
    const key = `tg:cb:${update.callback_query.id}`;
    const first = await redis.set(key, '1', 'EX', 60, 'NX');
    if (first === null) return;

    await handleCallback(update.callback_query);
    return;
  }

  const message = update.message;
  if (message?.text?.startsWith('/start')) {
    await handleStart(message, message.text.split(' ')[1]);
  }
}

/**
 * POST /v1/telegram/webhook
 *
 * Darhol `200` qaytariladi, ishlov keyin bajariladi: Telegram javobni
 * 5 soniya kutadi, kechiksa xabarni qayta yuboradi (09-integrations §2.2).
 */
telegramRouter.post('/telegram/webhook', (req, res) => {
  const secret = env().TELEGRAM_WEBHOOK_SECRET;

  // Sir sozlanmagan bo'lsa webhook umuman qabul qilinmaydi —
  // aks holda har kim buyurtma statusini o'zgartira oladi
  if (secret.length === 0 || req.get('X-Telegram-Bot-Api-Secret-Token') !== secret) {
    res.sendStatus(403);
    return;
  }

  res.sendStatus(200);

  const update = req.body as TgUpdate;
  void handleUpdate(update).catch((err: unknown) => {
    logger.error({ err }, 'telegram update ishlanmadi');
  });
});
