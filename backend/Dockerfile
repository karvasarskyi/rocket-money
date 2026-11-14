# Build context: repository root (see docker-compose.yml)
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --include=dev --ignore-scripts
COPY backend backend
RUN cd backend && npx prisma generate && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/backend backend
WORKDIR /app/backend
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed.js && node dist/main.js"]
