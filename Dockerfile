FROM node:24-alpine AS base

# 1. Instalar dependencias
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar archivos de definición de dependencias
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Construir el proyecto Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Imagen de producción (Server.mjs customizado)
FROM base AS runner
WORKDIR /app

# Configuración de entorno para producción
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Es buena práctica no correr aplicaciones como root en contenedores
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar artefactos y dependencias necesarios para el custom server (Socket.io)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/server.mjs ./server.mjs

# Cambiar a usuario sin privilegios
USER nextjs

# Exponer el puerto 3002 especificado
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

# Arrancar el servidor custom generado en server.mjs usando npm start
CMD ["npm", "start"]