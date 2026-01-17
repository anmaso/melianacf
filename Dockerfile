# Usar una imagen base de Node.js ligera
FROM node:20-slim

# Crear el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar los archivos de definición de dependencias
COPY package*.json ./

# Instalar las dependencias de la aplicación
RUN npm install --production

# Copiar el resto de los archivos de la aplicación
COPY . .

# Exponer el puerto en el que corre la aplicación (configurado en server.js)
EXPOSE 3000

# Comando para arrancar la aplicación
CMD ["npm", "start"]
