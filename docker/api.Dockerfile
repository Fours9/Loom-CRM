FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY libs/contracts/common/package.json libs/contracts/common/
COPY libs/contracts/auth/package.json libs/contracts/auth/
COPY libs/contracts/employees/package.json libs/contracts/employees/
COPY libs/contracts/absences/package.json libs/contracts/absences/
COPY libs/frontend/ui/package.json libs/frontend/ui/
RUN pnpm install --frozen-lockfile --filter @loom/api...

FROM deps AS build
COPY apps/api apps/api
COPY libs/contracts libs/contracts
RUN pnpm --filter @loom/api build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
ENV NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api /app/apps/api
COPY --from=build /app/libs /app/libs
COPY package.json pnpm-workspace.yaml ./
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
