# Plan de migración: backend Go en Railway y frontend en GitHub Pages

Este documento define el camino para convertir el Gestor de Alimentación + GlucosaTrack en una aplicación con frontend estático en GitHub Pages y backend en Go desplegado en Railway.

## Objetivo

Mantener el frontend actual en GitHub Pages y añadir un backend Go para:

- login y sesiones,
- persistencia de datos en PostgreSQL,
- sincronización entre dispositivos,
- hogares compartidos,
- miembros de un mismo hogar con permisos,
- API estable para el módulo metabólico y el planificador.

## Principio de arquitectura

```text
GitHub Pages
  └─ frontend estático HTML/CSS/JS
       └─ apiClient.js
            ↓ HTTPS + JWT/cookie
Railway
  └─ backend Go
       ├─ auth
       ├─ hogares
       ├─ miembros
       ├─ ingredientes
       ├─ platos
       ├─ menús
       ├─ compras
       ├─ perfiles metabólicos
       └─ simulaciones glucémicas
            ↓
PostgreSQL Railway
```

El frontend debe poder seguir funcionando en modo local/offline durante la transición. La nube se añade como capa de sincronización, no como ruptura inmediata.

## Decisión técnica inicial

### Backend

- Lenguaje: Go.
- API: REST JSON inicialmente.
- Base de datos: PostgreSQL.
- Despliegue: Railway.
- Migraciones: SQL versionadas.
- Auth: email + contraseña al principio; más adelante se puede añadir OAuth.
- Sesión: JWT de corta duración + refresh token, o cookie segura si el dominio final lo permite.

### Frontend

- Se mantiene en GitHub Pages.
- No se transforma todavía a framework.
- Se añade una capa `app/apiClient.js`.
- El estado local actual sigue existiendo como caché y modo offline.
- La sincronización se hará por endpoints, no accediendo directamente a PostgreSQL.

## Railway: servicios previstos

En Railway se crearán dos servicios dentro del mismo proyecto:

1. Servicio backend Go.
2. Servicio PostgreSQL.

Railway proporciona variables de conexión para PostgreSQL como `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` y `DATABASE_URL`. El backend Go usará preferentemente `DATABASE_URL`.

Variables esperadas para el backend:

```env
PORT=8080
DATABASE_URL=postgres://...
JWT_SECRET=...
APP_ENV=production
CORS_ALLOWED_ORIGINS=https://<usuario>.github.io,https://<dominio-personal>
```

## Modelo de datos objetivo

### Usuarios

```text
users
- id uuid pk
- email text unique not null
- password_hash text not null
- display_name text
- created_at timestamptz
- updated_at timestamptz
```

### Hogares

```text
households
- id uuid pk
- name text not null
- owner_user_id uuid fk users(id)
- created_at timestamptz
- updated_at timestamptz
```

### Usuarios dentro del hogar

```text
household_users
- household_id uuid fk households(id)
- user_id uuid fk users(id)
- role text -- owner, admin, member, viewer
- created_at timestamptz
primary key (household_id, user_id)
```

### Miembros del hogar

Un miembro puede ser una persona planificada dentro del hogar, aunque no tenga cuenta propia.

```text
members
- id uuid pk
- household_id uuid fk households(id)
- name text not null
- color text
- metabolic_settings jsonb
- created_at timestamptz
- updated_at timestamptz
```

### Ingredientes

```text
ingredients
- id uuid pk
- household_id uuid fk households(id)
- name text not null
- category text
- unit text
- nutrition jsonb
- glycemic_data jsonb
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz null
```

### Platos

```text
dishes
- id uuid pk
- household_id uuid fk households(id)
- name text not null
- description text
- servings numeric
- items jsonb -- ingrediente + cantidad
- tags jsonb
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz null
```

### Menús y compras

```text
weekly_menus
- id uuid pk
- household_id uuid fk households(id)
- week_start date
- plan jsonb
- created_at timestamptz
- updated_at timestamptz

shopping_lists
- id uuid pk
- household_id uuid fk households(id)
- week_start date
- items jsonb
- checked_items jsonb
- created_at timestamptz
- updated_at timestamptz
```

### Simulaciones metabólicas

```text
glucose_simulations
- id uuid pk
- household_id uuid fk households(id)
- member_id uuid fk members(id)
- dish_id uuid fk dishes(id)
- input jsonb
- result jsonb
- created_by uuid fk users(id)
- created_at timestamptz
```

## API mínima v1

### Sistema

```http
GET /health
GET /api/v1/version
```

### Auth

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/me
```

### Hogares

```http
GET    /api/v1/households
POST   /api/v1/households
GET    /api/v1/households/{householdId}
PATCH  /api/v1/households/{householdId}
POST   /api/v1/households/{householdId}/invites
POST   /api/v1/invites/{inviteToken}/accept
```

### Datos sincronizados

```http
GET /api/v1/households/{householdId}/sync
PUT /api/v1/households/{householdId}/sync
```

Estos endpoints permitirán una primera sincronización grande del estado actual sin tener que reescribir toda la aplicación de golpe.

Más adelante se dividirá en recursos específicos:

```http
GET    /api/v1/households/{householdId}/ingredients
POST   /api/v1/households/{householdId}/ingredients
PATCH  /api/v1/households/{householdId}/ingredients/{id}
DELETE /api/v1/households/{householdId}/ingredients/{id}

GET    /api/v1/households/{householdId}/dishes
POST   /api/v1/households/{householdId}/dishes
PATCH  /api/v1/households/{householdId}/dishes/{id}
DELETE /api/v1/households/{householdId}/dishes/{id}
```

### Metabólico

El cálculo GlucosaTrack puede quedarse inicialmente en frontend. El backend guardará perfiles y simulaciones. Después se podrá portar el motor también a Go para tener resultados idénticos en todos los dispositivos.

```http
POST /api/v1/households/{householdId}/glucose/simulations
GET  /api/v1/households/{householdId}/members/{memberId}/glucose/simulations
```

## Fases de implementación

### Fase 0 — Documentación y preparación

- Crear esta guía.
- Mantener rama de trabajo: `fusion-glucosatrack-planificador`.
- No tocar `main`.
- Decidir nombre del servicio backend: `gestor-alimentacion-api`.
- Decidir si el backend vive dentro de este mismo repo en `/backend` o en un repo separado.

Decisión recomendada: monorepo en este repo:

```text
/backend
  /cmd/api
  /internal/auth
  /internal/db
  /internal/http
  /internal/households
  /internal/sync
  /migrations
/app
index.html
```

Ventaja: Railway puede desplegar solo `/backend` y GitHub Pages sigue sirviendo la raíz.

### Fase 1 — Backend mínimo Go

Crear:

```text
backend/go.mod
backend/cmd/api/main.go
backend/internal/config/config.go
backend/internal/http/router.go
backend/internal/db/db.go
backend/migrations/001_init.sql
backend/railway.toml
```

Endpoints iniciales:

```http
GET /health
GET /api/v1/version
```

Criterio de éxito:

- Railway despliega el backend.
- `/health` responde `ok`.
- No se toca el frontend salvo una variable `API_BASE_URL`.

### Fase 2 — PostgreSQL y migraciones

- Añadir PostgreSQL en Railway.
- Leer `DATABASE_URL` desde Go.
- Ejecutar migraciones al arrancar o mediante comando separado.
- Crear tablas base: `users`, `households`, `household_users`.

Criterio de éxito:

- El backend conecta con PostgreSQL.
- `/health` comprueba también base de datos.

### Fase 3 — Registro y login

- Implementar registro.
- Hashear contraseñas con bcrypt o argon2id.
- Implementar login.
- Emitir JWT.
- Middleware de autenticación.
- Añadir CORS restringido a GitHub Pages.

Criterio de éxito:

- Usuario puede registrarse y entrar.
- `GET /api/v1/me` devuelve el usuario autenticado.

### Fase 4 — Hogares

- Crear hogar automáticamente al registrarse.
- Permitir crear hogares adicionales.
- Invitar usuarios por token.
- Roles: owner, admin, member, viewer.

Criterio de éxito:

- Dos usuarios pueden pertenecer al mismo hogar.
- Ambos ven el mismo `householdId`.

### Fase 5 — Sincronización inicial del estado actual

Sin reescribir toda la app, crear endpoints de sincronización de estado completo:

```http
GET /api/v1/households/{householdId}/sync
PUT /api/v1/households/{householdId}/sync
```

El JSON puede guardar inicialmente:

```json
{
  "version": 1,
  "ingredients": [],
  "dishes": [],
  "familyMembers": [],
  "weeklyPlans": [],
  "shoppingLists": [],
  "settings": {}
}
```

Criterio de éxito:

- Un dispositivo guarda en la nube.
- Otro dispositivo entra con el mismo usuario/hogar y recupera los datos.

### Fase 6 — Adaptación progresiva del frontend

Crear:

```text
app/apiClient.js
app/cloudSync.js
app/authView.js
```

Reglas:

- Si no hay login, sigue usando localStorage.
- Si hay login, usa nube + caché local.
- Los errores de red no deben romper el uso local.
- Mostrar estado: `Guardado local`, `Sincronizado`, `Error de sincronización`.

### Fase 7 — Recurso por recurso

Cuando la sincronización global funcione, migrar recursos a endpoints propios:

1. miembros,
2. ingredientes,
3. platos,
4. menús,
5. compras,
6. perfiles metabólicos,
7. simulaciones.

No hacerlo todo a la vez.

### Fase 8 — Motor glucémico en backend Go

Cuando los datos estén sincronizados:

- Portar `glucosaTrackEngine.js` a Go.
- Mantener el motor JS como fallback visual/offline.
- Comparar resultados JS vs Go con casos de prueba.
- El backend guardará simulaciones y podrá recalcularlas.

Criterio de éxito:

- Para un mismo plato y perfil, Go y JS devuelven curvas equivalentes.

## Estrategia de ramas

```text
main
  versión estable actual

fusion-glucosatrack-planificador
  integración actual + guía + backend progresivo

backend-go-railway
  opcional: rama separada si se quiere aislar backend
```

De momento se recomienda seguir en `fusion-glucosatrack-planificador` hasta estabilizar la arquitectura.

## Seguridad mínima

- Nunca guardar contraseñas en texto plano.
- No exponer `DATABASE_URL` en frontend.
- El frontend solo habla con la API HTTPS.
- CORS limitado a GitHub Pages y dominio propio.
- Tokens con expiración.
- Validar que cada petición pertenece al hogar autorizado.
- Soft delete para datos del hogar.
- Backups de PostgreSQL antes de usar en producción.

## Configuración de GitHub Pages

GitHub Pages debe seguir sirviendo:

```text
index.html
app/*
assets/*
```

El backend Go no debe interferir con Pages. Railway debe apuntar a `/backend`.

En el frontend se añadirá una configuración:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://gestor-alimentacion-api.up.railway.app/api/v1"
};
```

Más adelante puede reemplazarse por un archivo `app/config.js` no sensible.

## Primeros cambios de código recomendados

1. Crear `/backend` con `/health`.
2. Crear `railway.toml` para indicar root y comando.
3. Crear `app/apiClient.js` sin cambiar aún el flujo actual.
4. Añadir pantalla de login oculta o experimental.
5. Añadir endpoints de auth.
6. Añadir hogares.
7. Añadir sincronización global.

## No hacer todavía

- No mover todo el estado a PostgreSQL de golpe.
- No romper localStorage.
- No obligar al usuario a iniciar sesión para usar la app.
- No portar el motor glucémico a Go antes de tener datos sincronizados.
- No mezclar credenciales Railway en archivos del repo.

## Estado de despliegue esperado

```text
Frontend:
GitHub Pages
https://<usuario>.github.io/Gestor-Almentacion/

Backend:
Railway
https://gestor-alimentacion-api.up.railway.app

Base de datos:
Railway PostgreSQL
solo accesible por backend
```

## Checklist de avance

- [ ] Crear backend Go mínimo.
- [ ] Desplegar `/health` en Railway.
- [ ] Añadir PostgreSQL.
- [ ] Crear migraciones.
- [ ] Implementar auth.
- [ ] Crear hogares.
- [ ] Añadir invitaciones.
- [ ] Crear `apiClient.js`.
- [ ] Crear sincronización global.
- [ ] Migrar recursos gradualmente.
- [ ] Portar motor glucémico a Go.
- [ ] Añadir pruebas de equivalencia JS/Go.
