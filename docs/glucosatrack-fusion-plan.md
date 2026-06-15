# Fusión GlucosaTrack + Gestor de Alimentación

## Objetivo

Usar el Gestor de Alimentación como fuente única de datos y convertir GlucosaTrack en un módulo visual/analítico que consume datos del planificador.

La prioridad es evitar dos bases de datos separadas para alimentos, platos, miembros, perfiles metabólicos y planificación semanal.

## Principio de arquitectura

```text
Gestor de Alimentación
  ├─ ingredientes
  ├─ platos
  ├─ miembros
  ├─ semanas / planificación
  ├─ nutrición calculada
  └─ perfiles metabólicos
          ↓
  glucosaTrackAdapter.js
          ↓
  Módulo visual GlucosaTrack
      ├─ curva glucémica
      ├─ curvas por macros
      ├─ simulación educativa de insulina
      └─ avisos / interpretación visual
```

## Fuente de verdad

El estado principal sigue siendo el estado del Gestor:

- `state.ingredients`
- `state.dishes`
- `state.familyMembers`
- `state.weeks`
- `member.metabolicSettings`

GlucosaTrack no debe guardar copias permanentes de estos datos. Solo debe recibir snapshots o inputs calculados.

## Nuevo adaptador

Se añade:

```text
app/state/glucosaTrackAdapter.js
```

Funciones principales:

### `getGlucosaTrackPlannerSnapshot(state)`

Devuelve una vista normalizada del planificador:

- miembros
- platos
- semanas
- perfiles metabólicos normalizados

Sirve para poblar selectores, vistas o futuras pantallas del módulo GlucosaTrack.

### `buildGlucosaTrackMealInput(options)`

Construye el input de un plato concreto:

- plato seleccionado
- miembro seleccionado
- perfil metabólico
- glucosa actual
- tiempo hasta comer
- condiciones temporales
- nutrición calculada
- impacto glucémico
- curva de absorción

Este será el contrato principal para pintar la gráfica y simular curvas.

### `buildGlucosaTrackInputsForWeek(options)`

Convierte la semana planificada en una lista de inputs compatibles con GlucosaTrack.

Esto permitirá más adelante mostrar impacto glucémico por día, comida o miembro.

## Qué se debe migrar desde GlucosaTrack

1. La gráfica grande con Chart.js.
2. Los toggles de curvas visibles.
3. El panel de estado actual: glucosa, tiempo hasta comida y condiciones.
4. La simulación educativa de insulina.
5. Las tarjetas visuales de resumen.
6. La navegación móvil o una versión integrada dentro de la pestaña `Metabólico`.

## Qué no se debe duplicar

No duplicar:

- alimentos
- platos
- miembros
- perfiles metabólicos
- curvas calculadas persistidas
- historial de planificación

Las curvas deben calcularse desde el estado actual salvo que más adelante se cree un histórico explícito de consumos reales.

## Seguridad médica

Cualquier salida relacionada con insulina debe mostrarse como simulación educativa, no como prescripción.

Texto recomendado:

> Simulación educativa no validada clínicamente. No sirve para decidir dosis, tratamientos ni cambios médicos sin supervisión profesional.

## Siguiente paso técnico recomendado

Crear `app/render/glucosaTrackPanel.js` o separar `metabolicPremiumModule.js` para que use:

```js
import { buildGlucosaTrackMealInput } from "../state/glucosaTrackAdapter.js";
```

Después, portar la visualización de GlucosaTrack para que pinte exclusivamente con ese input.
