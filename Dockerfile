# Hybrid build: deps install inside the container so node_modules is
# Linux-native, but .next is built on the host (in-container `next build` fails
# on locked-down networks - it can't reach Google Fonts via next/font).
# manage.ps1 builds .next on the host before `docker compose up`.

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN corepack enable && corepack prepare pnpm@9 --activate

# Linux node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Host-built .next + minimal source needed for `next start`. (No public/ in
# this project; Next handles its absence gracefully at runtime.)
COPY package.json pnpm-lock.yaml next.config.mjs ./
COPY .next ./.next

EXPOSE 3000
CMD ["pnpm","start"]
