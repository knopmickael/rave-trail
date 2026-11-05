# syntax=docker/dockerfile:1

# Imagem de produção da Rave Trail.
# Monolito: um processo Node (Fastify) serve a API e a SPA React já buildada.
# O build usa esbuild com packages:'external', entao o runtime precisa das
# dependencias de producao instaladas em node_modules.

# ---- Estagio 1: build (frontend/dist + backend/dist) ----
FROM node:22.12.0-alpine AS build
WORKDIR /app

# Instala todas as dependencias (inclui devDependencies: vite, esbuild, tsx).
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do codigo e gera os dois builds.
COPY . .
RUN npm run build

# Remove devDependencies, deixando apenas o node_modules de producao
# que o backend/dist/index.js consome em runtime.
RUN npm prune --omit=dev

# ---- Estagio 2: runtime enxuto ----
FROM node:22.12.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Estrutura esperada por backend/src/paths.ts (resolve a partir de backend/dist/):
#   ../../.env                -> /app/.env            (nao usado: config vem de env vars)
#   ../../frontend/dist/      -> /app/frontend/dist/  (SPA servida pelo Fastify)
#   ../migrations/            -> /app/backend/migrations/ (migrations SQL)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/migrations ./backend/migrations
COPY --from=build /app/frontend/dist ./frontend/dist

# Dentro do container o Fastify escuta em 0.0.0.0; o Caddy publica o HTTPS.
EXPOSE 3001

# Nao roda como root.
USER node

CMD ["node", "backend/dist/index.js"]
