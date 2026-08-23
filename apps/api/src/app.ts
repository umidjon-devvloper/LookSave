import cors from 'cors';
import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';

import { env } from './config/env';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { requestId } from './http/request-id';
import { logger } from './logger';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { cartRouter } from './routes/cart';
import { ordersRouter } from './routes/orders';
import { productsRouter } from './routes/products';
import { profileRouter } from './routes/profile';
import { storePanelRouter } from './routes/store';
import { storesRouter } from './routes/stores';
import { telegramRouter } from './routes/telegram';
import { tryonRouter } from './routes/tryon';
import { waitlistRouter } from './routes/waitlist';
import { v1Router } from './routes/v1';
import { globalLimiter } from './http/rate-limit';
import { optionalAuth } from './http/auth-middleware';

export function createApp(): Express {
  const app = express();

  // Caddy orqasida turadi — mijoz IP'si X-Forwarded-For dan olinadi.
  // 1 = faqat eng yaqin proksi (Caddy) ishoniladi. Rate limiting shunga tayanadi.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // Caddy allaqachon gzip/zstd qiladi (docs/08-deployment.md §5) — takrorlanmaydi.
  app.disable('etag');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => res.locals.requestId as string,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );

  const origins = env().CORS_ORIGINS;
  app.use(
    cors({
      origin: origins.length > 0 ? origins : false,
      credentials: true,
      // 03-api-spec §1 dagi sarlavhalar
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'Accept-Language',
        'X-Device-Id',
        'X-App-Version',
        'X-Request-Id',
        'Idempotency-Key',
      ],
      exposedHeaders: [
        'X-Request-Id',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Retry-After',
      ],
      maxAge: 86_400,
    }),
  );

  app.use(express.json({ limit: env().BODY_LIMIT }));

  // Health versiyalanmaydi — Docker va UptimeRobot to'g'ridan-to'g'ri uradi
  app.use(healthRouter);
  // Global cheklov faqat /v1 ga — /health cheklanmaydi (UptimeRobot bloklanmasin).
  // optionalAuth oldin turadi: auth qilingan foydalanuvchiga kengroq limit.
  app.use('/v1', optionalAuth, globalLimiter);
  app.use('/v1/auth', authRouter);
  // Ochiq forma — token talab qilinmaydi (tanishtiruv sayti)
  app.use('/v1', waitlistRouter);
  app.use('/v1', profileRouter);
  app.use('/v1', telegramRouter);
  app.use('/v1', adminRouter);
  app.use('/v1', storePanelRouter);
  app.use('/v1', cartRouter);
  app.use('/v1', ordersRouter);
  app.use('/v1', storesRouter);
  app.use('/v1', productsRouter);
  app.use('/v1', tryonRouter);
  app.use('/v1', v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
