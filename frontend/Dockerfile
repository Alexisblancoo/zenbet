# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: Node 20 + Vite. Production URLs are injected at build time.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_API_URL=/api/v1
ARG VITE_AUTH_URL=/api
ARG VITE_HUB_URL=/odds-hub

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_AUTH_URL=${VITE_AUTH_URL} \
    VITE_HUB_URL=${VITE_HUB_URL}

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: Nginx Alpine serving the SPA and proxying the API/SignalR.
# ---------------------------------------------------------------------------
FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
