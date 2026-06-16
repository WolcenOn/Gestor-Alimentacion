# Gestor Alimentacion API

Backend Go para login, hogares y sincronización de datos en la nube.

## Estado actual

Fase 2 inicial:

- `GET /health`
- `GET /api/v1/version`
- conexión opcional a PostgreSQL usando `DATABASE_URL`
- migración inicial en `migrations/001_init.sql`

## Ejecutar localmente

Desde la carpeta `backend`:

```bash
go mod tidy
go run ./cmd/api
```

Probar:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/version
```

Sin `DATABASE_URL`, `/health` devuelve `database: not_configured`.

Con PostgreSQL local o Railway, define `DATABASE_URL` en tu entorno antes de arrancar la API.

## Railway

Variables necesarias:

```env
APP_ENV=production
DATABASE_URL=<railway-postgres-url>
JWT_SECRET=<valor-largo-y-secreto>
CORS_ALLOWED_ORIGINS=https://<tu-github-pages>,https://<tu-dominio>
```

Railway también inyecta `PORT` automáticamente en el entorno del servicio.

## Migraciones

La primera migración está en:

```text
migrations/001_init.sql
```

Por ahora se puede ejecutar manualmente desde el panel o consola PostgreSQL. Más adelante añadiremos un runner de migraciones automático o un comando separado.

## Próxima fase

Fase 3:

- registro de usuario,
- hash de contraseña,
- login,
- JWT,
- endpoint `GET /api/v1/me`,
- hogar por defecto al registrarse.
