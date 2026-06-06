FROM node:20-alpine

# Mirror the repo layout: server.js resolves ../public relative to itself,
# so server/ and public/ must be siblings inside the image too.
WORKDIR /app

# Install dependencies first (cached layer; .dockerignore keeps host
# node_modules out of the build context)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy application code
COPY server/ ./server/
COPY public/ ./public/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "server/server.js"]
