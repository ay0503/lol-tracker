FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --no-frozen-lockfile

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

# Create data directory for SQLite (Railway volume mounts here at /app/data)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/lol-tracker.db
EXPOSE 3000

# Migrations run programmatically inside the Node.js app at startup
# This ensures they run AFTER the Railway volume is mounted
CMD ["node", "dist/index.js"]
