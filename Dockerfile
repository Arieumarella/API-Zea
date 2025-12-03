# Use a slim Debian-based Node image for Prisma compatibility
FROM node:20-slim

# Install minimal build tools required by some native deps
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first for docker layer caching
COPY package.json package-lock.json* ./

# Install all dependencies (including dev to run prisma cli), then prune later
RUN npm ci --unsafe-perm

# Copy rest of the app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Remove dev deps to reduce image size
RUN npm prune --production

# Make entrypoint executable
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "index.js"]
