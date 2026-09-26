# For Fly.io (`fly launch`), Render, Railway or any container host.
# Build stage: install deps and bundle the game.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run stage: just the built game + the zero-dependency Node server.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/server.js /app/package.json ./
EXPOSE 8080
CMD ["node", "server.js"]
