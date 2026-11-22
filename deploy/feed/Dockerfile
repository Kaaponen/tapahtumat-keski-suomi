# Rakennus: docker compose -f deploy/feed/docker-compose.yml build (repon juuresta)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json tsconfig.json ./
# tsx on devDependency, joten kehitysriippuvuudet asennetaan tarkoituksella
RUN npm ci --include=dev && npm cache clean --force
COPY src/feed ./src/feed
COPY src/shared ./src/shared
COPY src/web/calendar ./src/web/calendar
USER node
EXPOSE 8787
CMD ["npx", "tsx", "src/feed/server.ts"]
