# ── deps ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── build server ──────────────────────────────────────────────────────────────
FROM deps AS server-build
COPY . .
RUN npm run build:server

# ── server runtime ────────────────────────────────────────────────────────────
FROM node:20-alpine AS server
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=server-build /app/dist-server ./dist-server
COPY --from=server-build /app/shared ./shared
EXPOSE 3001
CMD ["node", "dist-server/index.js"]

# ── build frontend ────────────────────────────────────────────────────────────
FROM deps AS frontend-build
COPY . .
RUN npm run build

# ── frontend (nginx) ──────────────────────────────────────────────────────────
FROM nginx:alpine AS frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
