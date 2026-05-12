FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src
COPY schemas ./schemas

RUN npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /app

ARG APP_ENTRY=dist/apps/reviews/main.js
ENV APP_ENTRY=${APP_ENTRY}

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY schemas ./schemas

EXPOSE 5000

CMD ["sh", "-c", "node \"$APP_ENTRY\""]
