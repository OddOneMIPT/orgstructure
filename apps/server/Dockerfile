# syntax=docker/dockerfile:1

# --- сборка: бандлим сервер вместе с контрактами в один файл
FROM node:22-alpine AS build
WORKDIR /app

# Сначала манифесты — слой с зависимостями переиспользуется, пока они не менялись.
COPY package.json package-lock.json ./
COPY tsconfig.base.json tsconfig.json ./
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --workspace apps/server --include-workspace-root

COPY packages/contracts packages/contracts
COPY apps/server apps/server
RUN npm run build --workspace apps/server

# --- рантайм: только бандл и прод-зависимости
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --omit=dev --workspace apps/server --include-workspace-root && npm cache clean --force

COPY --from=build /app/apps/server/dist apps/server/dist

# Непривилегированный пользователь — образ не должен ходить под root.
USER node

EXPOSE 3000
# Exec-форма, а не через shell: тогда PID 1 — сам node и он получает SIGTERM от Docker.
# Shell-форма поставила бы первым процессом /bin/sh, и сигналы до node не дошли бы.
CMD ["node", "apps/server/dist/index.js"]
