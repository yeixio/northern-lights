# The Northern Lights app (app.yeix.io) as a small static web server.
# Build from the repository root: docker build -f hub/Dockerfile .
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build:hub

FROM ghcr.io/nginxinc/nginx-unprivileged:1.27-alpine
LABEL org.opencontainers.image.source="https://github.com/yeixio/northern-lights" \
      org.opencontainers.image.description="The Northern Lights app: every Northern Lights site in one place" \
      org.opencontainers.image.licenses="MIT"
COPY hub/nginx.conf /etc/nginx/conf.d/default.conf
COPY hub/headers.conf /etc/nginx/headers.conf
COPY --from=build /app/dist/hub /usr/share/nginx/html
EXPOSE 8080
