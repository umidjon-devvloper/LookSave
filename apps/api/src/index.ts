import type { Server } from 'node:http';

import { createApp } from './app';
import { env } from './config/env';
import { closeDb } from './db/pool';
import { closeRedis } from './db/redis';
import { startScheduler, stopScheduler } from './jobs/scheduler';
import { logger } from './logger';

const app = createApp();
const port = env().PORT;

const server: Server = app.listen(port, () => {
  // `version` logger base'ida bor — bu yerda takrorlanmaydi (JSON'da ikki xil kalit chiqmasin)
  logger.info({ port, env: env().NODE_ENV }, 'API ishga tushdi');
  startScheduler();
});

// Caddy SSE ulanishlarini uzoq ushlaydi — standart 5 s keepAlive kam.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;

let shuttingDown = false;

/**
 * `docker compose up -d --no-deps api` SIGTERM yuboradi.
 * Ochiq so'rovlar tugatiladi, keyin baza va Redis yopiladi — uzilish ~3 soniya.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'to`xtatilmoqda');

  const forceExit = setTimeout(() => {
    logger.error('10 soniyada yopilmadi — majburiy chiqish');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  stopScheduler();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await Promise.allSettled([closeDb(), closeRedis()]);
  logger.info('to`xtadi');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'ushlanmagan rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'ushlanmagan istisno — chiqilmoqda');
  process.exit(1);
});
