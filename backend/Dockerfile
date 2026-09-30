FROM node:22-bookworm-slim AS construcao
# Prisma precisa do openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=construcao /app/node_modules ./node_modules
COPY --from=construcao /app/dist ./dist
COPY --from=construcao /app/prisma ./prisma
COPY package.json ./

# Pasta das imagens enviadas (montada como volume no compose)
RUN mkdir -p /app/uploads && chown node:node /app/uploads
ENV UPLOADS_DIR=/app/uploads

# Roda sem privilegios de root
USER node
EXPOSE 3000
# Aplica as migrations pendentes e sobe a API
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
