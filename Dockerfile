FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build server
FROM deps AS build
COPY . .
RUN pnpm build:server
RUN pnpm db:push

# Production image
FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./
COPY --from=build /app/drizzle.config.ts ./

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]
