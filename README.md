# ZenBet

Plataforma de apuestas deportivas de momento solo tiene 
UFC con backend .NET 10 (Clean Architecture)
y frontend React + Vite.

## Estructura

- `backend/`: solución .NET 10, API, dominio, aplicación, infraestructura y tests.
- `frontend/`: SPA React + TypeScript + Vite.
- `docker-compose.yml`: PostgreSQL, API y frontend para ejecución local.
- `.github/workflows/ci.yml`: build de .NET y del frontend en cada push/PR a `main`.

## Docker

1. Copia el archivo de ejemplo y completa los secretos:

   ```bash
   cp .env.example .env
   ```

2. Levanta el stack:

   ```bash
   docker compose up --build
   ```

Servicios:

- Frontend: http://localhost
- API: http://localhost:5000
- PostgreSQL: `localhost:5432`

El frontend se sirve con Nginx y proxea `/api/` y `/odds-hub` al backend, por lo
que las URLs de producción son relativas y no requieren CORS.

## Desarrollo local

Backend:

```bash
dotnet run --project backend/src/Zenbet.EventsMarkets.Api
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

La API lee los secretos desde variables de entorno:
`ConnectionStrings__EventsMarkets`, `Auth__SigningKey` y `Settlement__ApiKey`.
