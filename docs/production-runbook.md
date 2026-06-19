# Runbook de producción

Este runbook resume las comprobaciones mínimas para pasar de Railway staging/producción a una operación más segura.

## Antes de desplegar

1. Revisa que GitHub Actions esté en verde en la rama/PR que vas a desplegar.
2. En Railway, confirma variables obligatorias:
   - `APP_ENV=production`
   - `DATABASE_URL`
   - `JWT_SECRET` con al menos 32 caracteres aleatorios
   - `CORS_ALLOWED_ORIGINS` con el dominio real de la app, sin `*`
   - `USDA_API_KEY` si se usará búsqueda nutricional USDA desde servidor
3. Verifica que el servicio usa el `Dockerfile` del backend Go.
4. Confirma que el frontend apunta al backend correcto en `app/config.js`.

## Endpoints operativos

### `GET /health`

Liveness del proceso. Sirve para saber si la API responde y qué release está ejecutándose.

Campos útiles:

- `status`: `ok` o `error`
- `service`: `gestor-alimentacion-api`
- `environment`
- `database`: estado reportado por el chequeo de base de datos
- `release_commit`: commit desplegado, usando `RAILWAY_GIT_COMMIT_SHA`, `RELEASE_COMMIT` o `local`
- `started_at` y `checked_at`

### `GET /ready`

Readiness para tráfico real. Devuelve `200` solo si los servicios críticos están listos.

Por ahora exige:

- `checks.database = ok`

Si devuelve `503`, Railway o un monitor externo deben considerar que la API no está lista para recibir tráfico.

### `GET /api/v1/version`

Metadatos públicos de versión del backend:

- `version`
- `environment`
- `release_commit`
- `build_time`

No incluye secretos ni URLs privadas.

## Después de desplegar

1. Abre `/health` y confirma `status=ok`.
2. Abre `/ready` y confirma `status=ok` y `checks.database=ok`.
3. Abre `/api/v1/version` y confirma que `release_commit` coincide con el commit esperado.
4. Prueba login/register con una cuenta no sensible.
5. Prueba sincronización cloud desde Ajustes:
   - subir datos locales
   - descargar datos cloud
   - comprobar que no quedan cambios pendientes
6. Revisa logs de Railway durante los primeros minutos.

## Señales de alerta

- `/ready` responde `503`: la base de datos no está lista o no es accesible.
- `/health` responde `503`: el proceso detecta base de datos inalcanzable.
- Errores `database_required`: falta `DATABASE_URL` o el store no está disponible.
- Errores de CORS en navegador: `CORS_ALLOWED_ORIGINS` no incluye el dominio exacto del frontend.
- Errores `JWT_SECRET is not configured`: falta secreto o no se cargó la variable en Railway.

## Rollback

1. En Railway, redeploy del commit anterior estable.
2. Verifica `/health`, `/ready` y `/api/v1/version`.
3. No ejecutes migraciones destructivas sin backup previo.
4. Si el problema afecta a datos cloud, pausa cambios de usuarios y conserva logs antes de tocar base de datos.

## Pendientes antes de monetizar

- Política de privacidad publicada.
- Términos de uso publicados.
- Consentimiento explícito para datos de salud/metabolismo en cloud.
- Flujo de exportación y eliminación de datos cloud.
- Revisión legal si se quieren usar datos agregados o anonimizados.
