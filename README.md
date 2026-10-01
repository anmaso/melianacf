# Equipos del Meliana C.F. (datos FFCV)

App móvil (HTML + backend Node sin dependencias) con clasificación, resultados por jornada y próximos partidos.
El equipo elegido se guarda en `localStorage` (`melianacf.equipo`); "Cambiar equipo" vuelve al selector.

## Ejecutar
    node server.js            # http://localhost:8080 (PORT para cambiarlo)

## Cloud Run
    gcloud run deploy melianacf --source . --region europe-west1 --allow-unauthenticated

## Backend (`/api/*`, proxy con caché en memoria sobre ffcv.es)
- `equipos` – equipos del club (`COD_CLUB`, por defecto 2621) en competición
- `competiciones?equipo=` – grupos de la temporada actual del equipo
- `jornadas?grupo=` · `jornada?competicion=&grupo=&jornada=` · `clasificacion?grupo=` · `calendario?equipo=&grupo=`

Los escudos se sirven desde `appwebffcv.novanet.es`.
