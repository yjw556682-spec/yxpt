# packages/server/Dockerfile — yxpt API container
#
# Multi-stage build:
#   1. deps    — pnpm install with frozen lockfile
#   2. builder — build the engine + shared-types (workspace deps), then the server
#   3. runner  — minimal runtime image with only the built dist + node_modules
#
# Build context must be the repository ROOT (so workspaces and lockfile are
# visible). docker-compose.yml already passes `context: ..`.
#
# isolated-vm requires native compilation. Alpine ships musl + a small g++
# toolchain; we install build deps in the deps stage only.

FROM node:24-alpine AS deps
WORKDIR /repo

# Build deps for isolated-vm (native node-gyp compile). Keep them here so
# they never reach the runner image.
RUN apk add --no-cache python3 make g++ libc6-compat

# Enable pnpm via corepack (ships with the official node image)
ENV COREPACK_ENABLE_STRICT=0
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate

# Copy the full workspace metadata first to maximize Docker layer caching.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN pnpm install --frozen-lockfile

# ---- build stage ----
FROM deps AS builder
WORKDIR /repo

# Copy sources
COPY packages/shared-types packages/shared-types
COPY packages/engine packages/engine
COPY packages/server packages/server
COPY packages/web packages/web
COPY tsconfig.base.json ./

RUN pnpm -r --filter @yxpt/shared-types --filter @yxpt/engine --filter @yxpt/server build

# ---- runner stage ----
FROM node:24-alpine AS runner
WORKDIR /app

# Tini-style init + a non-root user. alpine's adduser is BusyBox, fine for our needs.
RUN apk add --no-cache tini && \
    addgroup -S yxpt && adduser -S -G yxpt yxpt

ENV NODE_ENV=production
ENV PORT=3000

# Copy only what we need to run.
COPY --from=builder /repo/packages/server/package.json    ./package.json
COPY --from=builder /repo/packages/server/dist            ./dist
COPY --from=builder /repo/node_modules                    ./node_modules
COPY --from=builder /repo/packages/server/node_modules    ./node_modules-pkg
# pnpm hoists most deps to /repo/node_modules; only symlinks live under
# packages/server/node_modules. Copy that too.
RUN cp -r ./node_modules-pkg/* ./node_modules/ && rm -rf ./node_modules-pkg

USER yxpt
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]