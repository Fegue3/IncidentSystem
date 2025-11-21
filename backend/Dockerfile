# ---- Base de build (precisa de devDependencies para compilar Nest) ----
FROM node:20-alpine AS build
WORKDIR /app

# OpenSSL para o Prisma detectar a versão e usar o binary certo (openssl 3)
RUN apk add --no-cache openssl

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

# Também aqui precisamos de OpenSSL para o schema engine/migrate
RUN apk add --no-cache openssl

# Copia apenas o necessário
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Garante que o Prisma CLI existe no runtime
RUN npm i -g prisma

EXPOSE 3000

CMD [ "sh", "-lc", "if [ -n \"$DATABASE_URL\" ]; then echo \"🗄️  Running Prisma migrate deploy...\"; npx prisma migrate deploy; else echo \"⚠️  DATABASE_URL not set; skipping prisma migrate deploy.\"; fi && node dist/main.js" ]
