# Stage 1: build the Svelte frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: production backend
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY backend/.pgmrc ./.pgmrc
# Copy built frontend so Express can serve it
COPY --from=frontend-build /app/frontend/dist ./public
# Uploads are persisted via a Fly volume mounted at /app/uploads
RUN mkdir -p /app/uploads
EXPOSE 4000
CMD ["node", "src/index.js"]
