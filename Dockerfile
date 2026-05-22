# Self-contained multi-stage build. CI runners have full internet access, so
# the legacy "host-built .next" workaround (Google Fonts blocked on home
# networks) is no longer needed. `next build` runs inside the builder stage.
#
# NEXT_PUBLIC_* values are bundled into the client JS at build time — they
# CANNOT be changed by env vars at `docker run` (Next.js inlines them during
# `next build`). The deploy must rebuild the image to change them.

# ───────── deps: pnpm install with the full lockfile ─────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

# ───────── builder: `next build` produces .next/ ─────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

# Build args inlined into the client bundle by Next.js at build time.
# Defaults are localhost so `docker build` without args still produces a
# usable dev image. CI passes real values from repo vars.NEXT_PUBLIC_*.
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ARG NEXT_PUBLIC_RESEARCH_URL=http://localhost:8081
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_RESEARCH_URL=${NEXT_PUBLIC_RESEARCH_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Linux-native node_modules from deps stage.
COPY --from=deps /app/node_modules ./node_modules
# Full source — .dockerignore filters node_modules/.next/.git.
COPY . .

# `--no-lint` mirrors the old `pnpm exec next build --no-lint` in CI. The
# working tree has unrelated CRLF/prettier/a11y debt; build is the gate.
RUN pnpm exec next build --no-lint

# ───────── runner: minimal layer that runs `next start` ─────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9 --activate

# Bring over only what `next start` needs: built bundle, manifests, runtime
# deps, and next.config.mjs (for headers/CSP). No source, no devDeps trim
# applied — pnpm in the deps stage already installed both prod+dev, but
# `next start` only loads what it imports, so the cost is disk, not RAM.
# (A future optimisation is `next build` with `output: 'standalone'` —
# deferred until we're sure we're not breaking the CSP middleware.)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/next.config.mjs ./next.config.mjs
# NOTE: no public/ — this project doesn't have one. Next handles its absence
# gracefully at runtime. If a public/ dir is added later, add a COPY here.

EXPOSE 3000
CMD ["pnpm", "start"]
