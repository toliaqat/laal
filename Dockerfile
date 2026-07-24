# syntax=docker/dockerfile:1
# Multi-stage build for the Laal web app (Next.js, pnpm monorepo) -> Fly.io.
# Final image runs Next's standalone server (small, no pnpm/build tooling).

ARG NODE_VERSION=20.18.0
ARG PNPM_VERSION=9.7.1
FROM node:${NODE_VERSION}-slim AS base
# Install pnpm directly (avoids corepack's signature-key verification issues).
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------------------------------------------------------------------------
# Build stage: install workspace deps for the web app and build it.
# NEXT_PUBLIC_* must be present at build time (Next inlines them into the
# client bundle). They are public values, not secrets. Server-only secrets are
# injected at runtime via `fly secrets`, never baked into the image.
# ---------------------------------------------------------------------------
FROM base AS build

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_TELEMETRY_DISABLED=1

COPY . .
# Install only the web app's workspace subtree (skips the Expo mobile deps).
RUN pnpm install --frozen-lockfile --filter @laal/web...
RUN pnpm --filter @laal/web build

# ---------------------------------------------------------------------------
# Runtime stage: copy only the standalone server output.
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Bind dual-stack (IPv6 + mapped IPv4). Fly's proxy reaches the machine over
    # its private IPv6 (6PN) address, so an IPv4-only 0.0.0.0 bind is unreachable.
    HOSTNAME="::"

# Run as the unprivileged 'node' user shipped in the base image.
USER node

# standalone bundle is rooted at the monorepo root (outputFileTracingRoot):
# it contains apps/web/server.js, node_modules, packages, package.json.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
