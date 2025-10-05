# Production minimal image
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install deps (only backend for now)
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev || npm install --omit=dev

# Copy source
COPY backend ./
COPY frontend ./../frontend

# Build frontend assets (optional step if using build script)
RUN npm run build:frontend || echo "Frontend build skipped"

# Expose port
EXPOSE 4000
CMD ["npm","start"]
