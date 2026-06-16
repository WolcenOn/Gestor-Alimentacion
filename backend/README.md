# Gestor Alimentacion API

Backend Go para login, hogares y sincronización de datos en la nube.

## Estado actual

Fase 4 inicial:

- `GET /health`
- `GET /api/v1/version`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/me`
- `GET /api/v1/households`
- `POST /api/v1/households`
- `GET /api/v1/households/{householdId}`
- `PATCH /api/v1/households/{householdId}`
- `POST /api/v1/households/{householdId}/invites`
- `POST /api/v1/invites/{inviteToken}/accept`
- conexión a PostgreSQL usando `DATABASE_URL`
- migraciones iniciales en `migrations/001_init.sql` y `migrations/002_household_invites.sql`

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

Migraciones actuales:

```text
migrations/001_init.sql
migrations/002_household_invites.sql
```

Por ahora se pueden ejecutar manualmente desde el panel o consola PostgreSQL. Más adelante añadiremos un runner de migraciones automático o un comando separado.

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

## Hogares

Todos los endpoints de hogares requieren:

```http
Authorization: Bearer <accessToken>
```

### Listar hogares

```http
GET /api/v1/households
```

### Crear hogar

```http
POST /api/v1/households
Content-Type: application/json
```

Body:

```json
{
  "name": "Casa familiar"
}
```

### Ver hogar

```http
GET /api/v1/households/{householdId}
```

### Renombrar hogar

Requiere rol `owner` o `admin`.

```http
PATCH /api/v1/households/{householdId}
Content-Type: application/json
```

Body:

```json
{
  "name": "Nuevo nombre"
}
```

### Crear invitación

Requiere rol `owner` o `admin`.

```http
POST /api/v1/households/{householdId}/invites
Content-Type: application/json
```

Body:

```json
{
  "email": "otra-persona@example.com",
  "role": "member"
}
```

Roles válidos para invitación:

```text
admin
member
viewer
```

La respuesta incluye un `token` que el frontend podrá convertir en enlace de invitación.

### Aceptar invitación

El usuario debe estar autenticado.

```http
POST /api/v1/invites/{inviteToken}/accept
```

Si la invitación es válida, añade el usuario al hogar.

## Próxima fase

Fase 5:

- endpoint de sincronización global por hogar,
- guardar estado completo inicial del frontend,
- recuperar estado desde otro dispositivo,
- preparar `app/apiClient.js` sin romper localStorage.
