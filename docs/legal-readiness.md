# Preparación legal y de confianza antes de monetizar

Este documento no sustituye asesoramiento legal. Sirve como checklist de producto para reducir riesgos antes de abrir la app a usuarios reales.

## Alcance sanitario

La app puede mostrar información nutricional, curvas orientativas y módulos metabólicos, pero no debe presentarse como producto sanitario ni como herramienta de diagnóstico.

Texto recomendado para la interfaz:

> Esta app ayuda a organizar menús, compras y datos orientativos de nutrición/metabolismo. No sustituye el criterio de personal sanitario, no diagnostica y no debe usarse para ajustar medicación, insulina o tratamientos.

## Antes de publicar landing o pagos

- Añadir aviso visible dentro de la app para nutrición/glucosa/metabolismo.
- Añadir política de privacidad pública.
- Añadir términos de uso públicos.
- Explicar qué datos se guardan localmente y cuáles se sincronizan en la nube.
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

## Seguridad mínima ya cubierta por la rama de Semana 2

- CORS por lista explícita de orígenes permitidos.
- Cabeceras de seguridad en API.
- Rate limiting básico para login y registro.
- No exponer secretos backend en frontend.
- Aviso sanitario visible en la app.

## Pendiente para una fase posterior

- Política de privacidad final revisada.
- Términos de uso finales revisados.
- Flujo de consentimiento explícito si se guardan datos de salud/metabólicos en cloud.
- Panel de eliminación de cuenta/datos.
- Auditoría de accesibilidad y seguridad frontend.
- Revisión de cookies/analítica si se añade tracking.
