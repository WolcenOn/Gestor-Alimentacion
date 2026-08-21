# Checklist de salida a producción

## Antes de desplegar

- CI verde en el PR que se quiere desplegar.
- Railway desplegando desde un commit conocido.
- PostgreSQL accesible desde el backend.
- Variables de producción revisadas (`APP_ENV`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`).
- Frontend apuntando al backend correcto.
- Exportación JSON local disponible antes de cambios de esquema o sincronización.

## Comprobaciones después del despliegue

1. Abrir `/health` y comprobar que la base de datos no aparece como `unreachable`.
2. Abrir `/api/v1/version`.
3. Probar login con una cuenta de prueba.
4. Probar una subida cloud.
5. Probar una descarga cloud desde otra sesión.
6. Verificar que un cliente con un `updatedAt` antiguo recibe `409 sync_conflict` y no sobrescribe el estado remoto.
7. Revisar logs de Railway y consola del navegador.

## Rollback básico

1. No realizar cambios manuales en PostgreSQL mientras se investiga el fallo.
2. Redeployar en Railway el commit estable anterior.
3. Confirmar `/health` y login.
4. Confirmar lectura del snapshot cloud antes de volver a habilitar escrituras normales.
5. Si el problema afecta a sincronización, conservar los cambios locales pendientes y evitar forzar una descarga cloud hasta resolver el conflicto.

## Regla de seguridad para sincronización

Los clientes que conocen la versión remota deben enviar `expectedUpdatedAt` al guardar. Si el snapshot ha cambiado desde esa lectura, el backend debe responder `409 sync_conflict`. Los clientes antiguos que no envían la precondición mantienen temporalmente el comportamiento legacy de última escritura gana.
