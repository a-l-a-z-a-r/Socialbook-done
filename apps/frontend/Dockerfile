FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY vite.config.js ./
COPY index.html ./
COPY .env.production ./
COPY src ./src

RUN npm install
RUN npm run build

FROM nginx:1.27-alpine

ENV REVIEWS_UPSTREAM=reviews:5000 \
    USERS_UPSTREAM=users:5000 \
    SOCIAL_UPSTREAM=social:5000 \
    NOTIFICATIONS_UPSTREAM=notifications:5000 \
    BOOKLISTS_UPSTREAM=booklists:5000

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
