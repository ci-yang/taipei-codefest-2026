# build context = repo 根目錄：docker build -f apps/web/Dockerfile .
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.13.1
WORKDIR /app

# dev：docker compose 用，原始碼由 bind mount 掛進來（HMR）
FROM base AS dev
ENV NODE_ENV=development
# node_modules 由 compose 的 api 容器裝好（共用 volume），這裡只啟動 dev server
CMD ["pnpm", "--filter", "@app/web", "dev"]

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @app/web...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# 同源部署：API 由 nginx 反代，所以 VITE_API_BASE 留空
ARG VITE_API_BASE=
ENV VITE_API_BASE=$VITE_API_BASE
RUN pnpm --filter @app/web build

# production：nginx 靜態檔 + SPA fallback + /api 反代
FROM nginx:1.29-alpine AS prod
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
