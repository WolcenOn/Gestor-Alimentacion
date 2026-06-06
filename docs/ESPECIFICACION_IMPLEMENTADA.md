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

## Extensión: escáner, datos externos, desperdicio y reciclaje

Se incorporan estas funciones adicionales:

1. Escáner con vista previa de cámara para compras e ingredientes.
2. Asociación de productos por código de barras a ingredientes existentes.
3. Búsqueda manual en Open Food Facts y creación/importación de ingredientes.
4. Importación de perfil nutricional desde Open Food Facts cuando existe información de nutrimentos.
5. Búsqueda en USDA FoodData Central con API key manual no persistida.
6. Registro de alimentos tirados con descuento de stock y valor estimado.
7. Puntuación anti-desperdicio basada en valor comprado frente a valor tirado.
8. Registro de envases por tipo: plástico, cartón/papel, vidrio, metal, brik, orgánico u otro.
9. Contador de reciclaje en dashboard y registro automático de envases desde compras.
