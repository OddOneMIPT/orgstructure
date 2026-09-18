# syntax=docker/dockerfile:1

# --- сборка статики
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json tsconfig.json ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --workspace apps/client --include-workspace-root

COPY packages/contracts packages/contracts
COPY apps/client apps/client
COPY scripts scripts
RUN npm run build --workspace apps/client && npm run size

# --- раздача: Nginx отдаёт статику и проксирует API с WebSocket
FROM nginx:alpine AS runtime

COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/client/dist /usr/share/nginx/html

EXPOSE 80
