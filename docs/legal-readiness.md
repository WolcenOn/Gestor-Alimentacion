# Preparación legal y de confianza antes de monetizar

Este documento no sustituye asesoramiento legal. Sirve como checklist de producto para reducir riesgos antes de abrir la app a usuarios reales.

## Documentos creados en esta fase

- `docs/legal/privacy-policy-draft.md`: borrador de política de privacidad.
- `docs/legal/terms-of-use-draft.md`: borrador de términos de uso.
- `docs/legal/cloud-health-consent-draft.md`: texto y requisitos de consentimiento para sincronización cloud de datos nutricionales, glucosa o metabolismo.
- `docs/legal/processing-register-draft.md`: registro operativo de actividades de tratamiento.

Estos textos son base de trabajo y deben completarse con datos reales del responsable, proveedor, país, contacto de privacidad, plazos de conservación y revisión legal.

## Alcance sanitario

La app puede mostrar información nutricional, curvas orientativas y módulos metabólicos, pero no debe presentarse como producto sanitario ni como herramienta de diagnóstico.

Texto recomendado para la interfaz:

> Esta app ayuda a organizar menús, compras y datos orientativos de nutrición/metabolismo. No sustituye el criterio de personal sanitario, no diagnostica y no debe usarse para ajustar medicación, insulina o tratamientos.

## Antes de publicar landing o pagos

- Añadir aviso visible dentro de la app para nutrición/glucosa/metabolismo.
- Publicar política de privacidad revisada.
- Publicar términos de uso revisados.
- Explicar qué datos se guardan localmente y cuáles se sincronizan en la nube.
- Definir responsable legal, email de privacidad y contacto de soporte.
- Evitar promesas como “controla tu diabetes”, “reduce glucosa” o “recomendación médica”.
- Usar lenguaje de apoyo: “orientativo”, “organización familiar”, “seguimiento personal”, “consulta con tu profesional sanitario”.

## Datos personales

Datos probables tratados por la app:

- email de usuario;
- nombre visible/perfil;
- miembros del hogar;
- alimentos, menús, compras y stock;
- datos nutricionales introducidos manualmente;
- datos metabólicos o glucosa si el usuario los registra.

Los datos metabólicos y de salud pueden ser especialmente sensibles. Antes de producción real, revisar base legal, consentimiento, borrado de cuenta, exportación de datos y retención.

## Requisitos funcionales recomendados

- Exportar datos personales en JSON.
- Borrar cuenta y hogares asociados.
- Borrar todos los datos metabólicos de un usuario.
- Mostrar fecha de última sincronización.
- Mostrar si el modo actual es local o cloud.
- Añadir contacto de soporte/privacidad.
- Registrar consentimiento cloud si hay datos sensibles.
- Permitir retirada de consentimiento y borrado cloud.

## Seguridad mínima ya cubierta por la rama de Semana 2

- CORS por lista explícita de orígenes permitidos.
- Cabeceras de seguridad en API.
- Rate limiting básico para login y registro.
- No exponer secretos backend en frontend.
- Aviso sanitario visible en la app.
- Service worker sin cachear rutas sensibles de API/auth/sync/households/invites.

## Bloqueantes legales antes de producción pública

1. Completar identidad del responsable y contacto de privacidad.
2. Revisar política de privacidad y términos con asesoría legal.
3. Publicar enlaces visibles desde la app.
4. Implementar borrado cloud/cuenta o, como mínimo, un proceso operativo documentado de solicitud por email.
5. Definir consentimiento explícito para sincronizar datos de salud/metabolismo en cloud.
6. Definir plazos de retención de logs, backups y cuentas inactivas.
7. Revisar transferencias internacionales del proveedor cloud.
8. Revisar si procede evaluación de impacto de protección de datos por datos especialmente sensibles.

## Fase posterior

- Panel de privacidad dentro de la app con exportación, borrado cloud y retirada de consentimiento.
- Auditoría de accesibilidad y seguridad frontend.
- Revisión de cookies/analítica si se añade tracking.
- Revisión de términos de pago si se activa monetización.
