# One-shot PW→Loom cutover importer image.
# Contains scripts/cutover + Node 22 + better-sqlite3, pg, uuid.
# Does NOT use the API production image (better-sqlite3 is a root/dev dependency).
#
# SQLite is bind-mounted read-only at runtime (see compose cutover service).
# Usage (via site-cutover.sh / compose --profile cutover):
#   docker compose … --profile cutover run --rm --no-deps cutover

FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY docker/cutover.package.json ./package.json
RUN npm install --omit=dev

COPY scripts/cutover ./scripts/cutover

ENV NODE_ENV=production

# No ENTRYPOINT — compose `command` / `run … args` must be the full node invocation.
CMD ["node", "scripts/cutover/import-from-projectweekend.mjs", "--reset", "--sqlite", "/pw/app.sqlite"]
