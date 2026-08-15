import type { Response } from 'express';
import { Redis } from 'ioredis';

import { env } from '../config/env';
import { redis } from '../db/redis';
import { logger } from '../logger';

/**
 * Do'kon paneli uchun real vaqt hodisalari (03-api-spec §14).
 *
 * SSE tanlandi, WebSocket emas: ma'lumot faqat serverdan mijozga ketadi,
 * Caddy orqali muammosiz o'tadi va qayta ulanishni brauzer o'zi qiladi.
 *
 * Redis pub/sub kerak, chunki API bir nechta nusxada ishlashi mumkin —
 * buyurtma bitta nusxada yaratilib, panel boshqasiga ulangan bo'lishi mumkin.
 *
 * ⚠️ Caddy'da `flush_interval -1` bo'lishi SHART (infra/Caddyfile),
 * aks holda javob buferlanadi va hodisalar kechikadi.
 */

const CHANNEL_PREFIX = 'store-events:';

export type StoreEventName = 'order.new' | 'order.updated' | 'ping';

interface StoreEvent {
  event: StoreEventName;
  data: Record<string, unknown>;
}

/** Hodisani e'lon qilish. Xato bo'lsa faqat log — asosiy amal to'xtamaydi. */
export function publishStoreEvent(
  storeId: string,
  event: StoreEventName,
  data: Record<string, unknown>,
): void {
  const payload: StoreEvent = { event, data };
  void redis
    .publish(`${CHANNEL_PREFIX}${storeId}`, JSON.stringify(payload))
    .catch((err: unknown) => {
      logger.warn({ err, storeId, event }, 'hodisa e`lon qilinmadi');
    });
}

function writeEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * SSE ulanishini ochish. Har ulanish uchun ALOHIDA Redis mijozi kerak:
 * `subscribe` rejimidagi ulanish boshqa buyruqlarni bajara olmaydi.
 */
export function openStoreStream(res: Response, storeId: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // nginx uchun (Caddy'da flush_interval -1 ishlaydi)
    'X-Accel-Buffering': 'no',
  });

  // Brauzerga qayta ulanish oralig'i
  res.write('retry: 5000\n\n');
  writeEvent(res, 'connected', { storeId });

  const subscriber = new Redis(env().REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });

  void subscriber.subscribe(`${CHANNEL_PREFIX}${storeId}`).catch((err: unknown) => {
    logger.warn({ err, storeId }, 'SSE obuna bo`lmadi');
  });

  subscriber.on('message', (_channel, message) => {
    try {
      const parsed = JSON.parse(message) as StoreEvent;
      writeEvent(res, parsed.event, parsed.data);
    } catch (err) {
      logger.warn({ err }, 'SSE xabari o`qilmadi');
    }
  });

  // Proxy bo'sh ulanishni uzmasligi uchun (§14)
  const heartbeat = setInterval(() => {
    writeEvent(res, 'ping', {});
  }, 30_000);

  const cleanup = (): void => {
    clearInterval(heartbeat);
    void subscriber.quit().catch(() => subscriber.disconnect());
  };

  res.on('close', cleanup);
  res.on('error', cleanup);
}
