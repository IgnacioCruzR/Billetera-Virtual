FROM node:22.23.5-alpine AS build
WORKDIR /app
ARG VITE_DATA_MODE=demo
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY index.html tsconfig.json vite.config.ts playwright.config.ts ./
COPY src/ ./src/
COPY tests/ ./tests/
RUN VITE_DATA_MODE=$VITE_DATA_MODE npm run build

FROM nginx:1.30.8-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 8080
