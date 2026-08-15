# LookSave API — build konteksti repo ILDIZI (monorepo).
#   docker build -f apps/api/Dockerfile -t looksave-api .
# CI shu tarzda quradi (docs/08-deployment.md §9).

# ── 1) Build ──
FROM node:20-alpine AS builder
WORKDIR /repo

# Avval manifestlar — kod o'zgarganda npm ci qayta ishlamasin (layer cache)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/

RUN npm ci --workspace=apps/api --include-workspace-root

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# tsup workspace paketlarini bundle ichiga qo'shadi (tsup.config.ts: noExternal)
RUN npm run build --workspace=apps/api

# ── 2) Runtime bog'liqliklari (faqat production) ──
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev --ignore-scripts \
 && npm cache clean --force

# ── 3) Yakuniy tasvir ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    TZ=UTC

# root'dan ishlamaydi
RUN addgroup -g 10001 -S app && adduser -u 10001 -S app -G app

COPY --from=deps    --chown=app:app /repo/node_modules ./node_modules
COPY --from=builder --chown=app:app /repo/apps/api/dist ./dist
COPY --from=builder --chown=app:app /repo/apps/api/package.json ./package.json

USER app
EXPOSE 3000

# Healthcheck compose faylida ham bor — bu tasvirni alohida ishlatganda kerak
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `node` to'g'ridan-to'g'ri PID 1 — SIGTERM ilovaga yetib boradi,
# graceful shutdown ishlaydi (npm start orqali ishlatilsa yetmaydi).
CMD ["node", "dist/index.js"]
