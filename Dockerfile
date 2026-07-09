# Build stage for React frontend
FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim
WORKDIR /app

# Install MariaDB server
RUN apt-get update && \
    apt-get install -y mariadb-server && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Install production dependencies only
RUN npm install --omit=dev
# Copy built assets from build-stage
COPY --from=build-stage /app/dist ./dist
# Copy server files
COPY server/ ./server/
# Copy .env
COPY .env ./
# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3001
# Use entrypoint script to start both services
CMD ["./entrypoint.sh"]

