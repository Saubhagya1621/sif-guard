FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY . .
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:5000/api/health || exit 1
# Seed is idempotent: only fills empty collections.
CMD ["sh", "-c", "node seed.js && node src/index.js"]
