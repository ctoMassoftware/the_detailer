# Etapa 1: Construcción
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Etapa 2: Servidor Nginx
FROM nginx:alpine
# Copiamos el build de Angular a la carpeta de Nginx
# NOTA: Revisa en tu angular.json si el output es dist/app-the-detailer o similar
COPY --from=build /app/dist/app-theDetailer/browser /usr/share/nginx/html
# Copiamos configuración personalizada de nginx (opcional pero recomendada para SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]