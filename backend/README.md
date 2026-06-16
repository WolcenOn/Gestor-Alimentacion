# Gestor Alimentacion API

Backend Go para login, hogares y sincronización de datos en la nube.

## Estado actual

Fase 3 inicial:

- `GET /health`
- `GET /api/v1/version`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/me`
- conexión a PostgreSQL usando `DATABASE_URL`
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

Sin `DATABASE_URL`, `/health` devuelve `database: not_configured` y los endpoints de auth responden `database_required`.

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

## Auth

### Registro

```http
POST /api/v1/auth/register
Content-Type: application/json
```

Body:

```json
{
  "email": "persona@example.com",
  "password": "contraseña-larga",
  "displayName": "Persona",
  "householdName": "Mi hogar"
}
```

Respuesta:

```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 43200,
  "user": {
    "id": "...",
    "email": "persona@example.com",
    "displayName": "Persona"
  },
  "households": [
    {
      "id": "...",
      "name": "Mi hogar",
      "role": "owner"
    }
  ]
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

Body:

```json
{
  "email": "persona@example.com",
  "password": "contraseña-larga"
}
```

### Usuario actual

```http
GET /api/v1/me
Authorization: Bearer <accessToken>
```

Devuelve usuario y hogares asociados.

## Próxima fase

Fase 4:

- endpoints de hogares,
- invitaciones,
- roles,
- preparación de sincronización inicial por hogar.
