# build context = repo 根目錄：docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.13.1
WORKDIR /app

# dev：docker compose 用，原始碼由 bind mount 掛進來
FROM base AS dev
ENV NODE_ENV=development
CMD ["sh", "-c", "pnpm install --frozen-lockfile --store-dir /pnpm-store && pnpm --filter @app/api dev"]

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @app/api...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @app/api build

# production：@app/shared 已被 tsup 打包進 dist，執行期只需要 node_modules + dist
FROM node:24-alpine AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
EXPOSE 8787
USER node
CMD ["node", "dist/index.js"]
