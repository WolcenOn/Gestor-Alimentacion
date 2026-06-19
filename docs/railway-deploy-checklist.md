# Checklist de despliegue en Railway

Esta guía asume que la cuenta de Railway ya está enlazada con GitHub.

## 1. Crear proyecto

1. En Railway, crear un nuevo proyecto.
2. Elegir despliegue desde GitHub.
3. Seleccionar el repositorio `WolcenOn/Gestor-Almentacion`.
4. Seleccionar la rama que quieras desplegar. Para estabilización usa `stabilization-week-1-production-readiness`; para producción estable usa la rama que se decida tras revisar el PR.
5. Configurar el servicio para usar la carpeta raíz del backend:

```text
/backend
```

Si Railway detecta el proyecto desde la raíz del repo, ajusta el `Root Directory` del servicio a `backend`.

## 2. Añadir PostgreSQL

1. En el mismo proyecto Railway, añadir un servicio PostgreSQL.
2. Conectar el servicio backend Go con PostgreSQL.
3. Confirmar que el backend recibe `DATABASE_URL`.

## 3. Variables del backend

En el servicio backend Go, configurar:

```env
APP_ENV=production
JWT_SECRET=<valor-largo-aleatorio>
CORS_ALLOWED_ORIGINS=https://<usuario>.github.io,https://<dominio-personal>
```

Railway debe aportar automáticamente:

```env
PORT=<inyectado-por-railway>
DATABASE_URL=<inyectado-por-postgresql>
```

No poner ninguna de estas variables en el frontend. Para desarrollo local, copiar `backend/.env.example` a un archivo local no versionado y rellenar valores reales solo en el entorno.

## 4. Build y start

Si Railway despliega desde la carpeta `backend`, el archivo `backend/railway.toml` define:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "go build -o bin/api ./cmd/api"

[deploy]
startCommand = "./bin/api"
healthcheckPath = "/health"
```

Si Railway despliega desde la raíz con Docker, el `Dockerfile` copia `backend/go.mod` y `backend/go.sum`, ejecuta `go mod download` y compila sin hacer `go mod tidy` en producción.

## 5. Migraciones

Migraciones actuales:

```text
backend/migrations/001_init.sql
backend/migrations/002_household_invites.sql
backend/migrations/003_household_sync.sql
```

La API Go ejecuta las migraciones automáticamente al arrancar mediante `db.RunMigrations`. Solo ejecútalas manualmente si necesitas recuperar o diagnosticar una base concreta.

## 6. Probar backend

Cuando Railway entregue la URL pública del backend, probar:

```text
GET https://<backend-railway-url>/health
GET https://<backend-railway-url>/api/v1/version
```

`/health` debe devolver `database: ok` si PostgreSQL está conectado. También puedes verlo desde la app con el botón visible “Comprobar backend” de la cabecera.

## 7. Conectar GitHub Pages

Editar `app/config.js` en la rama de pruebas:

```js
window.APP_CONFIG = window.APP_CONFIG || {
  API_BASE_URL: "https://<backend-railway-url>/api/v1"
};
```

No poner secretos en `app/config.js`.

## 8. Prueba funcional mínima

1. Registrar usuario con `POST /api/v1/auth/register`.
2. Confirmar que se crea hogar inicial.
3. Guardar estado con `PUT /api/v1/households/{householdId}/sync`.
4. Leer estado con `GET /api/v1/households/{householdId}/sync`.
5. Confirmar que GitHub Pages sigue funcionando aunque el backend falle.

## 9. CI antes de mergear

La rama debe pasar GitHub Actions:

```bash
npm test
cd backend
go mod download
go test ./...
```

Si `go.sum` cambia tras `go mod tidy`, commitear el resultado antes de desplegar.
