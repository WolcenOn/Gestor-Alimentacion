# Checklist de salida a producción

Este documento recoge el siguiente paso operativo antes de hacer merge/despliegue real.

## Cadena de ramas

La cadena segura de trabajo debe mantenerse así hasta decidir el merge final:

1. `fusion-glucosatrack-planificador`
2. `stabilization-week-1-production-readiness`
3. `security-week-2-production-hardening`
4. `week-3-sync-reliability`
5. siguiente rama de producción

No se debe desplegar directamente desde una rama intermedia que no tenga CI verde.

## Antes del primer deploy real

- GitHub Actions verde en el PR que se quiere desplegar.
- Railway usando el `Dockerfile` del backend Go.
- PostgreSQL conectado y accesible desde Railway.
- Variables configuradas:
  - `APP_ENV=production`
  - `DATABASE_URL`
  - `JWT_SECRET` largo, aleatorio y privado
  - `CORS_ALLOWED_ORIGINS` con el dominio exacto del frontend, sin comodines
  - `USDA_API_KEY` si se usará USDA desde servidor
- Frontend apuntando al backend correcto en `app/config.js`.
- Política de privacidad y términos preparados antes de monetizar.

## Comprobaciones después del deploy

1. Abrir `/health` del backend.
2. Confirmar que responde JSON y que `database` no aparece como `unreachable`.
3. Abrir `/api/v1/version`.
4. Crear una cuenta de prueba no sensible.
5. Probar login/logout.
6. Probar subida cloud desde Ajustes.
7. Probar descarga cloud desde otro navegador o sesión limpia.
8. Revisar logs de Railway.
9. Revisar consola del navegador: no debe haber errores CORS ni errores de service worker relacionados con `/api/`.

## Criterios mínimos para considerar producción lista

- Backend arranca sin configuración insegura en `APP_ENV=production`.
- CORS solo permite orígenes explícitos.
- API no guarda respuestas privadas en caché.
- Service worker no cachea rutas sensibles.
- Login/register tienen rate limit.
- Hay aviso visible de que la app no sustituye consejo sanitario.
- Hay exportación JSON local.
- Hay borrado local de datos del navegador.
- Hay runbook de rollback.

## Rollback básico

1. Redeploy del commit anterior estable en Railway.
2. Confirmar `/health`.
3. Confirmar login con cuenta de prueba.
4. Evitar cambios manuales en PostgreSQL sin backup.
5. Si el fallo afecta a sincronización, pedir a usuarios que no hagan cambios hasta estabilizar.

## Pendientes importantes

Antes de monetizar o abrir a usuarios externos:

- Política de privacidad pública.
- Términos de uso públicos.
- Consentimiento explícito si se guardan datos de salud/metabolismo en cloud.
- Borrado cloud de cuenta/hogar/datos.
- Exportación cloud completa.
- Revisión legal si se plantea usar datos agregados o anonimizados.
- Monitorización externa de disponibilidad.
