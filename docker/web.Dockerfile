FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY libs/contracts/common/package.json libs/contracts/common/
COPY libs/contracts/auth/package.json libs/contracts/auth/
COPY libs/contracts/access-control/package.json libs/contracts/access-control/
COPY libs/contracts/employees/package.json libs/contracts/employees/
COPY libs/contracts/absences/package.json libs/contracts/absences/
COPY libs/contracts/documents/package.json libs/contracts/documents/
COPY libs/contracts/questionnaires/package.json libs/contracts/questionnaires/
COPY libs/questionnaire-schema/package.json libs/questionnaire-schema/
COPY libs/employee-contacts/package.json libs/employee-contacts/
COPY libs/employee-about-catalog/package.json libs/employee-about-catalog/
COPY libs/position-skill-catalog/package.json libs/position-skill-catalog/
COPY libs/frontend/ui/package.json libs/frontend/ui/
RUN pnpm install --frozen-lockfile --filter @loom/web...
COPY apps/web apps/web
COPY libs libs
RUN pnpm --filter @loom/web build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 80
