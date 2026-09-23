# ── Build Stage ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package files for workspaces
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=@recall/web

COPY apps/web ./apps/web

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build --workspace=@recall/web

# ── Production Runner Stage ──
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
