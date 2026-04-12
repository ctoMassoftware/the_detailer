# Usar una imagen de Node.js ligera
FROM node:18-slim

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto que usa tu app (definido en src/index.js)
EXPOSE 3000

# Comando para arrancar la app
CMD ["npm", "start"]