# Base Stage
FROM node:20-alpine AS base
WORKDIR /usr/src/app
# Add curl for healthchecks
RUN apk add --no-cache curl

# Dependencies Stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci

# Development Stage
FROM dependencies AS development
COPY . .
ENV NODE_ENV=development
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Builder Stage
FROM dependencies AS builder
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production Stage
FROM base AS production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /usr/src/app/dist ./dist
ENV NODE_ENV=production
# Run as non-root user
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
