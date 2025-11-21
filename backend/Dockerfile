# ---- Base de build (precisa de devDependencies para compilar Nest) ----
FROM node:20-alpine AS build
WORKDIR /app

# (JÁ NÃO PRECISAS DISTO)
# RUN apk add --no-cache openssl1.1-compat

# Instala só a partir dos manifests para melhor cache
COPY package*.json ./
RUN npm ci

# Prisma Client precisa do schema em build
COPY prisma ./prisma
RUN npx prisma generate

# Copia o restante código e compila
COPY . .
RUN npm run build

# Remove devDependencies para o runtime ficar leve
RUN npm prune --omit=dev


# ---- Runtime (produção) ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# (JÁ NÃO PRECISAS DISTO)
# RUN apk add --no-cache openssl1.1-compat

# Copia apenas o necessário
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# (opcional: manter prisma/ para migrate deploy no arranque)
COPY --from=build /app/prisma ./prisma

# Garante que o Prisma CLI existe no runtime (remove se o "prisma" já for dep de produção)
RUN npm i -g prisma

# Porta da API
EXPOSE 3000

# Arranque padrão: se houver DATABASE_URL, aplica migrations; depois arranca a API
CMD [ "sh", "-lc", "if [ -n \"$DATABASE_URL\" ]; then echo \"🗄️  Running Prisma migrate deploy...\"; npx prisma migrate deploy; else echo \"⚠️  DATABASE_URL not set; skipping prisma migrate deploy.\"; fi && node dist/main.js" ]
