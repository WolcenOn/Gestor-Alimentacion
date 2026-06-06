# Especificación implementada en el ZIP

Este ZIP implementa una base funcional del MVP descrito en el prompt maestro:

- Frontend modular sin backend obligatorio.
- Persistencia en `localStorage` con migración inicial.
- Estado centralizado y funciones controladas.
- Ingredientes con stock, unidades, familia, conservación y caducidad.
- Platos con recetas.
- Semana editable en cuadrante.
- Lista de compra automática con cálculo de faltantes.
- Compra parcial/completa desde cada ingrediente.
- Stock, lotes, movimientos y progreso semanal.
- Impresión separada para compra y semana.
- Packs bloqueados a `WolcenOn/GestorMenuSemanal/packs`.
- Importación/exportación JSON validada.
- Open Food Facts para código de barras.
- USDA preparado en servicio separado, sin clave hardcodeada.

## Límites conscientes del MVP

- La persistencia está en `localStorage`; para producción conviene migrar a IndexedDB o backend.
- El escáner depende de soporte del navegador y HTTPS/localhost.
- La nutrición está preparada en el modelo, pero no desarrolla aún un dashboard nutricional completo.
- La sincronización cloud, usuarios e IA quedan como evolución posterior.

## Actualización: planificación familiar avanzada

- Añadida pestaña **Ajustes** para configurar miembros/personas/grupos de la familia.
- Añadida configuración dinámica de **tipos de comida**.
- La pestaña **Semana** ahora planifica por día → comida → miembro.
- Cada miembro puede tener varios platos asignados en una misma comida.
- Al eliminar un miembro o tipo de comida, se limpia su planificación asociada para evitar referencias huérfanas.
- La impresión semanal agrupa los platos por miembro dentro de cada comida.
- CSS renovado con diseño mobile-first, tarjetas compactas, controles táctiles grandes y navegación sticky en móvil.
