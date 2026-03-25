FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

# Build server
FROM deps AS build
COPY . .
RUN pnpm build:server

# Production image
FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/patches ./patches
COPY --from=build /app/drizzle.config.ts ./

# Create data directory for SQLite (Railway volume mounts here)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
# Default DATABASE_PATH to the persistent volume mount
ENV DATABASE_PATH=/app/data/lol-tracker.db
EXPOSE 3000

# Run migrations against the volume-mounted DB, then start the server
CMD ["sh", "-c", "DATABASE_PATH=/app/data/lol-tracker.db pnpm db:push && node dist/index.js"]
