# Concurrencia segura de sincronización entre dispositivos

Esta entrega completa la compare-and-swap de `expectedUpdatedAt` que ya existía
parcialmente en `main`. Evita que un dispositivo sin una versión conocida
sobrescriba silenciosamente un snapshot PostgreSQL existente.

## Contrato PUT /api/v1/households/{household_id}/sync

Petición (la propiedad `expectedUpdatedAt` es obligatoria):

- `"expectedUpdatedAt": null`: crear el primer snapshot **solo si no existe**
  ninguno. Si otro dispositivo lo creó primero, devolver `409 sync_conflict`.
- `"expectedUpdatedAt": "2026-10-12T09:00:00.123456Z"`: actualizar solamente
  si PostgreSQL todavía contiene exactamente esa versión temporal.
- Si falta la propiedad: `428 sync_precondition_required`.
- Si la fecha es inválida: `400 invalid_expected_updated_at`.
- Si la versión no coincide: `409 sync_conflict`, sin modificar el snapshot
  de la base de datos y manteniendo la edición local pendiente.
- En éxito, el servidor devuelve `sync.updatedAt` nuevo. El siguiente PUT
  debe utilizar ese valor completo, sin redondearlo a milisegundos.

PostgreSQL realiza la comparación en el propio `UPDATE ... WHERE updated_at`;
no se realiza una comprobación previa independiente vulnerable a carreras.
Los nuevos tokens se generan con `GREATEST(clock_timestamp(), updated_at + 1 microsecond)`
para que dos actualizaciones muy cercanas no reutilicen el mismo token.

`version` sigue representando la versión del formato, **no** es el token de
concurrencia de la fila.

## Comportamiento en el frontend

- Envía `expectedUpdatedAt` de la última lectura o subida del hogar activo.
- Ante un `409`, conserva `pendingLocalChanges` y el error; **no descarga
  automáticamente ni sustituye la edición local**.
- Los cambios locales que se produzcan durante una subida en curso permanecen
  pendientes aunque aquella subida finalice correctamente.
- La sincronización automatizada no resuelve sola los conflictos semánticos:
  el usuario debe revisar o exportar su trabajo local antes de cargar una
  versión remota o combinar manualmente los datos.
- La respuesta GET de un hogar todavía sin snapshot devuelve `updatedAt: null`.
  En ese caso, el primer PUT se hace con `expectedUpdatedAt: null`.
- Un cliente antiguo que no incluya este atributo recibirá `428` en vez de
  poder sobrescribir silenciosamente el estado remoto. Actualizar frontend
  y backend de forma coordinada.

## Pruebas y despliegue

- Las pruebas de `backend/internal/store/sync_integration_test.go` emplean
  PostgreSQL real cuando `TEST_DATABASE_URL` está definido. CI inicia una
  base efímera para ejecutar creación exclusiva, rechazo de escrituras obsoletas,
  avance del token y dos subidas concurrentes.
- Las pruebas del frontend verifican que HTTP 409 mantiene cambios pendientes,
  que una subida manual no los borra y que nuevas ediciones durante una petición
  siguen pendientes al terminar.
- No se realizan migraciones destructivas ni se modifica `main` sin revisión.
- No habilitar un acceso que omita la precondición para recuperar compatibilidad:
  sería restaurar las sobrescrituras silenciosas.

Pendiente para una fase posterior: UI guiada de comparación/fusión de cambios,
resolución de diferencias por entidad y aislamiento más estricto de caché local
por cuenta/hogar. Este mecanismo impide sobrescrituras, pero no fusiona datos.
