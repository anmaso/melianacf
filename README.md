# Meliana CF - Aplicación Web

Aplicación web para visualizar datos del Meliana Club de Fútbol (Segona FFCV Aleví 2n. any València - Lliga Regular Grup 2).

## Características

- Visualización de clasificación en tiempo real
- Partidos de la jornada actual
- Calendario completo de la temporada
- Destacado visual de los partidos del Meliana
- Diseño responsive optimizado para móviles
- Actualización dinámica de datos mediante web scraping

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Iniciar el servidor:
```bash
npm start
```

3. Abrir en el navegador:
```
http://localhost:3000
```

## Tecnologías

- **Backend**: Node.js con Express
- **Web Scraping**: Axios y Cheerio
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Diseño**: Responsive, mobile-first

## Estructura del Proyecto

```
FFCV/
├── server.js           # Servidor Node.js con endpoints API
├── package.json        # Configuración y dependencias
├── public/
│   ├── index.html     # Página principal
│   ├── styles.css     # Estilos responsive
│   └── app.js         # Lógica del frontend
└── README.md          # Este archivo
```

## API Endpoints

- `GET /api/clasificacion` - Obtiene la clasificación actualizada
- `GET /api/jornada` - Obtiene los partidos de la jornada actual
- `GET /api/calendario` - Obtiene el calendario completo

## Uso

La aplicación tiene tres pestañas principales:

1. **Clasificación**: Muestra la tabla de posiciones con todos los equipos
2. **Jornada Actual**: Muestra los partidos de la jornada en curso
3. **Calendario**: Muestra todas las jornadas de la temporada

Los partidos y la posición del Meliana se destacan visualmente en color amarillo.
