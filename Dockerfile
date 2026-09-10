# ======================================================================
#  MineHunt - imagen del servidor
#
#  Lleva dentro las dos cosas: el servidor NestJS y el cliente web, que
#  sirve el propio Nest. Un despliegue, un dominio y un certificado, y la
#  version de navegador queda en el mismo origen que el WebSocket.
#
#  Se construye desde la raiz del repositorio, que es donde estan los
#  workspaces:
#
#      docker build -t minehunt .
#      docker compose up -d
#
#  Documentacion completa en documentos/MineHunt-despliegue.md.
# ======================================================================

# ----------------------------------------------------------------------
#  1. Dependencias
#
#  Se copian solo los manifiestos antes que el codigo: mientras no cambie
#  un package.json, Docker reutiliza esta capa y no vuelve a bajar nada.
# ----------------------------------------------------------------------
FROM node:24-alpine AS dependencias
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/game-engine/package.json packages/game-engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

RUN npm ci

# ----------------------------------------------------------------------
#  2. Compilacion
#
#  El motor va primero y no por gusto: la web y el servidor consumen su
#  dist/, no su codigo fuente. Compilar en otro orden deja al resto
#  mirando una version vieja del motor, o ninguna.
# ----------------------------------------------------------------------
FROM dependencias AS compilacion
WORKDIR /repo

# tsconfig.base.json es la raiz de la que cuelgan los tres tsconfig: sin el,
# `tsc --build` no encuentra ni las opciones del compilador.
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/

RUN npm run compilar --workspace @minehunt/game-engine \
 && npm run compilar --workspace @minehunt/server \
 && npm run compilar --workspace @minehunt/web

# ----------------------------------------------------------------------
#  3. Dependencias de ejecucion
#
#  Las de produccion y nada mas: Angular, Nest CLI, Vitest y compania se
#  quedan fuera de la imagen final, que es la mitad de su tamano.
# ----------------------------------------------------------------------
FROM dependencias AS produccion
WORKDIR /repo

# El enlace del workspace apunta a packages/game-engine, asi que su dist
# compilado tiene que estar ahi antes de podar.
COPY --from=compilacion /repo/packages/game-engine/dist packages/game-engine/dist

RUN npm ci --omit=dev

# ----------------------------------------------------------------------
#  4. La imagen que se despliega
#
#  Solo lo necesario para ejecutar, y con un usuario sin privilegios: si
#  alguien se cuela por una vulnerabilidad de una dependencia, que no se
#  encuentre siendo root dentro del contenedor.
# ----------------------------------------------------------------------
FROM node:24-alpine AS final
WORKDIR /aplicacion

ENV NODE_ENV=production

# curl para la comprobacion de salud: la imagen de node:alpine no lo trae.
RUN apk add --no-cache curl

COPY --from=produccion /repo/node_modules ./node_modules
COPY --from=produccion /repo/packages ./packages
COPY --from=compilacion /repo/apps/server/dist ./dist
COPY --from=compilacion /repo/apps/web/dist/web/browser ./web

# node:alpine ya trae el usuario «node», sin privilegios y con su grupo.
RUN chown -R node:node /aplicacion
USER node

EXPOSE 3000

# La ruta que ya responde, sin inventarse una nueva solo para esto.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/motor" || exit 1

CMD ["node", "dist/main"]
