# app.yeix.io: the page QR codes from "Get the app" open. It sends people to
# the iPhone or Android app, or to the stores to get it (docs/mobile.md).
# Build from the repository root: docker build -f mobile/landing/Dockerfile .
FROM ghcr.io/nginxinc/nginx-unprivileged:1.27-alpine
LABEL org.opencontainers.image.source="https://github.com/yeixio/northern-lights" \
      org.opencontainers.image.description="app.yeix.io: links into the Northern Lights app" \
      org.opencontainers.image.licenses="MIT"
COPY mobile/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY mobile/landing/headers.conf /etc/nginx/headers.conf
COPY mobile/landing/site /usr/share/nginx/html
EXPOSE 8080
