FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:22-alpine
WORKDIR /app
RUN addgroup -g 1001 -S svs && adduser -S svs -u 1001
COPY --from=builder --chown=svs:svs /app/dist ./dist
COPY --from=builder --chown=svs:svs /app/node_modules ./node_modules
COPY --from=builder --chown=svs:svs /app/package.json ./
COPY --from=builder --chown=svs:svs /app/src/db/migrations ./dist/db/migrations

RUN mkdir -p /data && chown svs:svs /data
VOLUME /data

USER svs
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/soulvssoul.db
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "dist/index.js"]
