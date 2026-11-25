# Billetera Virtual

La demostración de Billetera Virtual funciona en React y Nginx. El workspace local reúne el frontend, los esqueletos de los cinco servicios y la configuración de PostgreSQL y Kafka para desarrollo.

## Arranque local en Windows

Desde PowerShell, con Docker Desktop en contenedores Linux, comprueba `docker version` y `docker compose version`. Si `.env` todavía no existe, copia `.env.example` y sustituye las tres contraseñas de ejemplo por valores distintos antes de inicializar los volúmenes.

```powershell
docker compose config --quiet
docker compose up -d --wait
docker compose --profile frontend up -d --build --wait frontend
```

La demo abre en `http://127.0.0.1:8080`. También puedes iniciar únicamente el servicio `frontend` con el último comando. Para detener el proyecto conservando sus datos, usa `docker compose --profile frontend stop`.

- [Guía local, variables, redes y verificación](docs/LOCAL_DEVELOPMENT.md)
- [Organización y separación de repositorios](docs/REPOSITORY_STRUCTURE.md)
- [Topología oficial y Kubernetes](docs/TOPOLOGY.md)
- [Desarrollo y pruebas del frontend](frontend/README.md)
