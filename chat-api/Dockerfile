FROM node:24-slim AS build
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:24-slim
WORKDIR /srv
ENV NODE_ENV=production
COPY --from=build /srv/node_modules ./node_modules
COPY --from=build /srv/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
RUN mkdir -p data

EXPOSE 8080
# Aplica migraciones pendientes antes de arrancar.
CMD ["sh", "-c", "npx prisma migrate deploy && PORT=${PORT:-8080} node dist/main.js"]
