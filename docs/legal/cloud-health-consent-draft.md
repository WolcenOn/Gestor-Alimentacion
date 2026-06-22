# Consentimiento cloud para datos nutricionales, glucosa o metabolismo — borrador

> Documento de producto para revisión legal. No sustituye asesoramiento jurídico.

## Objetivo

Antes de sincronizar en la nube datos que puedan revelar información de salud, metabolismo, glucosa, hábitos alimentarios o nutrición personal, la app debe mostrar una aceptación separada y comprensible.

## Texto corto recomendado para la interfaz

Al activar la sincronización cloud aceptas que los datos del hogar se guarden en el backend configurado. Estos datos pueden incluir alimentos, menús, compras, nutrición y, si los introduces, datos de glucosa, metabolismo u otra información de salud.

La app no es un producto sanitario, no diagnostica y no sustituye a profesionales sanitarios. No debe usarse para ajustar medicación, insulina o tratamientos.

Puedes usar la app en modo local si no quieres sincronizar estos datos. Puedes retirar tu consentimiento solicitando el borrado de tus datos cloud por el canal de privacidad indicado.

[ ] Acepto sincronizar en la nube los datos del hogar, incluidos datos nutricionales o de salud si los introduzco.

## Requisitos de implementación recomendados

- El consentimiento debe ser específico para cloud y separado de los términos generales.
- No debe estar premarcado.
- Debe registrarse fecha, versión del texto aceptado, usuario y hogar.
- Debe poder retirarse.
- La app debe permitir seguir en modo local sin aceptar cloud.
- Si se habilitan datos de salud/metabolismo, debe distinguirse claramente entre datos alimentarios generales y datos de salud especialmente sensibles.

## Eventos a registrar

| Evento | Datos mínimos |
|---|---|
| Aceptación | user_id, household_id, timestamp, consent_version, text_hash |
| Retirada | user_id, household_id, timestamp, reason opcional |
| Cambio de versión | consent_version, fecha, resumen del cambio |

## Pendiente técnico

- Añadir tabla `user_consents` o `household_consents` en PostgreSQL.
- Añadir endpoint para registrar consentimiento.
- Bloquear sincronización cloud si el hogar contiene datos sensibles y no hay consentimiento registrado.
- Añadir panel de retirada de consentimiento y borrado cloud.
