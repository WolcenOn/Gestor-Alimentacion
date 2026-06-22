# Registro de actividades de tratamiento — borrador operativo

> Documento interno de preparación RGPD. Debe revisarse y completarse antes de producción pública.

## 1. Gestión de cuentas

| Campo | Detalle |
|---|---|
| Finalidad | Crear cuenta, iniciar sesión, mantener sesión y asociar usuario a hogares. |
| Categorías de datos | Email, contraseña hasheada, nombre visible, identificador de usuario, timestamps. |
| Base jurídica | Ejecución del servicio solicitado. |
| Conservación | Mientras la cuenta esté activa; borrado o anonimización tras baja según política definida. |
| Destinatarios | Hosting backend, base de datos gestionada, proveedores técnicos necesarios. |
| Riesgo | Medio. |
| Medidas | Hash de contraseña, JWT, rate limiting, CORS, HTTPS en hosting. |

## 2. Hogares compartidos e invitaciones

| Campo | Detalle |
|---|---|
| Finalidad | Gestionar hogares, miembros, roles e invitaciones. |
| Categorías de datos | Nombre de hogar, emails invitados, roles, tokens de invitación hasheados, miembros. |
| Base jurídica | Ejecución del servicio; consentimiento/legitimación de quien comparte datos del hogar. |
| Conservación | Mientras el hogar esté activo; invitaciones hasta expiración o aceptación. |
| Destinatarios | Miembros del hogar, backend y base de datos. |
| Riesgo | Medio, puede incluir información familiar sensible. |
| Medidas | RBAC por roles, tokens hasheados, caducidad de invitaciones. |

## 3. Sincronización cloud de datos de planificación

| Campo | Detalle |
|---|---|
| Finalidad | Sincronizar estado de la app entre dispositivos y cuentas del hogar. |
| Categorías de datos | Ingredientes, platos, menús, stock, compras, preferencias, snapshots JSON. |
| Base jurídica | Ejecución del servicio cloud; consentimiento si incluye datos de salud o metabolismo. |
| Conservación | Mientras la cuenta/hogar use cloud; borrado bajo solicitud o baja. |
| Destinatarios | Proveedor backend, PostgreSQL, miembros autorizados del hogar. |
| Riesgo | Medio-alto si el estado contiene datos de salud, niños o hábitos familiares. |
| Medidas | Autenticación, RBAC, no-cache API, service worker excluye rutas sensibles. |

## 4. Datos nutricionales, glucosa o metabolismo

| Campo | Detalle |
|---|---|
| Finalidad | Organización y seguimiento personal orientativo. |
| Categorías de datos | Nutrición, glucosa, metabolismo, notas o perfiles si la persona usuaria los introduce. |
| Base jurídica | Consentimiento explícito para cloud; uso local bajo control del usuario. |
| Conservación | Según política de cuenta; debe habilitarse borrado específico. |
| Destinatarios | Backend solo si se activa cloud; miembros del hogar con acceso si se comparte. |
| Riesgo | Alto por posible categoría especial de datos. |
| Medidas | Aviso sanitario, consentimiento separado, minimización, exportación/borrado. |

## 5. Logs técnicos y seguridad

| Campo | Detalle |
|---|---|
| Finalidad | Diagnóstico, seguridad, prevención de abuso y disponibilidad. |
| Categorías de datos | IP aproximada, timestamps, endpoint, errores, eventos de seguridad. |
| Base jurídica | Interés legítimo en seguridad y operación del servicio. |
| Conservación | Pendiente definir: recomendado 30-90 días salvo incidentes. |
| Destinatarios | Proveedor de hosting/logs. |
| Riesgo | Bajo-medio. |
| Medidas | Minimizar logs, no registrar payloads sensibles, control de acceso. |

## Pendientes antes de producción pública

- Definir responsable legal definitivo.
- Definir email de privacidad/soporte.
- Documentar proveedor exacto de hosting y región.
- Revisar transferencias internacionales.
- Definir retención de logs/backups.
- Implementar borrado cloud/cuenta.
- Registrar y versionar consentimiento cloud si hay datos sensibles.
- Revisar si procede evaluación de impacto de protección de datos.
