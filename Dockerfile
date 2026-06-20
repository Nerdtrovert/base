# Stage 1: Build the frontend SPA
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend server
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Stage 3: Production Runner
FROM node:18-alpine AS runner
WORKDIR /app

# Copy root package configs
COPY package*.json ./

# Copy backend config and install only production dependencies
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --only=production

# Copy compiled backend code and assets
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY backend/database ./backend/database

# Copy compiled frontend assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port (defaults to 5001 or process.env.PORT)
EXPOSE 5001
ENV NODE_ENV=production

# Start the combined web service
CMD ["npm", "start"]
