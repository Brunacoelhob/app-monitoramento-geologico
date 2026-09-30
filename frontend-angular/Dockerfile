FROM node:22-bookworm-slim AS construcao
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=construcao /app/dist/frontend-angular/browser /usr/share/nginx/html
# nginx-unprivileged roda sem root e escuta na 8080
EXPOSE 8080
