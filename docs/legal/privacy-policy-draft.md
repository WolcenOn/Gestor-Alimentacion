# Política de privacidad — borrador para revisión legal

> Documento de trabajo. Debe revisarse por asesoría legal antes de publicar la app a usuarios reales o aceptar pagos.

## 1. Responsable del tratamiento

Responsable: **[PENDIENTE: nombre legal / autónomo / sociedad]**  
Email de contacto privacidad: **[PENDIENTE: email de privacidad]**  
Domicilio o datos identificativos exigibles: **[PENDIENTE]**

## 2. Qué datos tratamos

La app puede tratar las siguientes categorías de datos:

- Datos de cuenta: email, nombre visible, identificador de usuario.
- Datos de hogar: nombre del hogar, miembros, roles e invitaciones.
- Datos de uso de la app: ingredientes, platos, menús, stock, lista de compra, recetas, preferencias y exportaciones.
- Datos nutricionales introducidos por la persona usuaria o generados desde fuentes externas.
- Datos de metabolismo, glucosa u otros datos de salud solo si la persona usuaria decide registrarlos.
- Datos técnicos mínimos: logs de servidor, fecha/hora de acceso, errores y datos necesarios para seguridad.

## 3. Finalidades

Tratamos los datos para:

- Crear y mantener la cuenta de usuario.
- Permitir la planificación de menús, compras, stock e ingredientes.
- Sincronizar datos entre dispositivos cuando se active el modo cloud.
- Gestionar hogares compartidos, invitaciones y roles.
- Mantener la seguridad del servicio, prevenir abuso y resolver incidencias.
- Cumplir obligaciones legales, si resultan aplicables.

No usamos la app para diagnóstico médico ni para tomar decisiones sanitarias automatizadas.

## 4. Base jurídica

La base jurídica dependerá del uso concreto:

- Ejecución del servicio solicitado: creación de cuenta, sincronización cloud, gestión de hogares y funcionamiento esencial de la app.
- Consentimiento explícito: sincronización cloud de datos que puedan incluir información de salud, glucosa o metabolismo.
- Interés legítimo: seguridad, prevención de abuso, diagnóstico técnico y mejora básica del servicio, siempre con medidas de minimización.
- Obligación legal: conservación o comunicación de datos cuando una norma lo exija.

## 5. Datos de salud o especialmente sensibles

La app puede contener información que la persona usuaria introduzca sobre glucosa, metabolismo, nutrición o salud. Estos datos pueden ser especialmente sensibles.

Antes de activar sincronización cloud con este tipo de información, la app debe solicitar una aceptación clara y separada. La persona usuaria puede evitar introducir estos datos o usar solo el modo local si no quiere sincronizarlos.

La app no sustituye a profesionales sanitarios, no diagnostica, no prescribe tratamientos y no debe usarse para ajustar medicación, insulina o decisiones clínicas.

## 6. Destinatarios y encargados

Podrán acceder a los datos, cuando sea necesario:

- Proveedor de hosting/backend: Railway o proveedor equivalente.
- Proveedor de base de datos PostgreSQL gestionada.
- GitHub Pages u otro hosting del frontend, si aplica.
- Proveedores técnicos estrictamente necesarios para operar el servicio.

No venderemos datos personales ni datos de salud identificables.

Cualquier uso estadístico, analítico o de mejora del producto con datos agregados o anonimizados deberá documentarse y, cuando sea necesario, solicitar consentimiento específico.

## 7. Transferencias internacionales

Algunos proveedores técnicos pueden estar ubicados fuera del Espacio Económico Europeo o prestar servicios desde terceros países. Antes de producción pública, deberá revisarse si existen transferencias internacionales y las garantías aplicables, como cláusulas contractuales tipo u otros mecanismos válidos.

## 8. Plazo de conservación

Conservaremos los datos mientras la cuenta esté activa o mientras sean necesarios para prestar el servicio.

Cuando la persona solicite la eliminación de su cuenta o datos cloud, se borrarán o anonimizarán salvo que exista obligación legal de conservación o necesidad técnica temporal para copias de seguridad.

Criterios concretos pendientes de definir antes de producción:

- Retención de logs técnicos.
- Retención de backups.
- Plazo de expiración de invitaciones.
- Plazo tras baja de cuenta.

## 9. Derechos de las personas usuarias

Las personas usuarias podrán ejercer, cuando proceda:

- acceso,
- rectificación,
- supresión,
- oposición,
- limitación del tratamiento,
- portabilidad,
- retirada del consentimiento.

Canal de ejercicio de derechos: **[PENDIENTE: email privacidad]**.

También pueden presentar reclamación ante la autoridad de protección de datos competente.

## 10. Seguridad

Aplicamos medidas técnicas como:

- contraseñas hasheadas en backend,
- tokens de sesión,
- CORS explícito,
- cabeceras de seguridad en API,
- rate limiting de login/registro,
- no almacenar secretos en frontend,
- exclusión de rutas sensibles del service worker.

Ningún sistema es completamente infalible. Si detectamos una brecha de seguridad que pueda afectar a datos personales, actuaremos conforme a la normativa aplicable.

## 11. Menores

La app puede utilizarse para organizar menús familiares, pero las cuentas deben ser gestionadas por personas adultas. Antes de producción pública se debe definir edad mínima, consentimiento parental y condiciones de uso por menores.

## 12. Cambios en esta política

Podremos actualizar esta política para reflejar cambios legales, técnicos o funcionales. Indicaremos la fecha de la última actualización y, si el cambio es relevante, avisaremos dentro de la app o por email.

Última actualización: **[PENDIENTE]**
