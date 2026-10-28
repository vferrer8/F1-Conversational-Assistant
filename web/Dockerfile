FROM node:24-slim AS build
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vacío = usa /api del mismo origen (proxy de nginx). En Cloud Run se pasa la URL de la Chat API.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
# La imagen oficial procesa /etc/nginx/templates/*.template con envsubst al arrancar.
ENV CHAT_API_URL=http://chat-api:8080 \
    PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /srv/dist /usr/share/nginx/html
EXPOSE 8080
