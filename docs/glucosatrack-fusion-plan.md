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
  glucosaTrackEngine.js
          ↓
  glucosaTrackFusionBootstrap.js
          ↓
  Vista Metabólico / GlucosaTrack
```

## Fuente de verdad

El estado principal sigue siendo el estado del Gestor:

- `state.ingredients`
- `state.dishes`
- `state.familyMembers`
- `state.weeks`
- `member.metabolicSettings`

GlucosaTrack no guarda copias permanentes de alimentos, platos ni miembros. Solo recibe inputs calculados desde el planificador.

## Adaptador

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

### `buildGlucosaTrackInputsForWeek(options)`

Convierte la semana planificada en una lista de inputs compatibles con GlucosaTrack.

## Motor GlucosaTrack

Se añade:

```text
app/state/glucosaTrackEngine.js
```

Este módulo porta la parte relevante del algoritmo de GlucosaTrack y la separa de la UI.

Incluye:

- curva basal con `basalDecayPerHour`
- azúcares simples
- hidratos complejos
- proteína
- grasa
- retraso de carbohidratos por grasa
- cálculo tipo Varsovia para unidades grasa/proteína (`UGP`)
- curva sin insulina
- curva con insulina simulada
- actividad/efecto de insulina
- estrategias de dosis: única, dividida y múltiple extendida

Funciones principales:

```js
buildGlucosaTrackMetabolicModel(input)
getWarsawMealData(input)
buildGlucoseWithInsulin(model, doses)
recommendInsulin(input)
optimizeInsulinPlan(input, strategy)
buildGlucosaTrackSimulation(input, options)
```

## Vista integrada

Se añade:

```text
app/glucosaTrackFusionBootstrap.js
```

La vista integrada de la pestaña **Metabólico** muestra:

- selección de miembro del planificador
- selección de plato del planificador
- glucosa actual
- tiempo hasta comer
- estrategia de dosis
- condiciones temporales
- curva basal
- curva sin insulina
- curva con insulina
- efecto de insulina
- curvas por macro
- plan educativo de dosis

## Editor de perfil

Se añade:

```text
app/glucosaTrackFusionProfile.js
```

Permite editar parámetros del motor directamente en `member.metabolicSettings`:

- glucosa base
- objetivos
- ratio HC/insulina
- sensibilidad
- compensación basal
- tiempos de absorción
- factores grasa/proteína
- retraso por grasa
- tiempos de insulina
- límites de dosis automática
- factores por enfermedad/menstruación

## Qué no se debe duplicar

No duplicar:

- alimentos
- platos
- miembros
- perfiles metabólicos
- planificación semanal

Las curvas se calculan desde el estado actual salvo que más adelante se cree un histórico explícito de consumos reales.

## Seguridad médica

Cualquier salida relacionada con insulina debe mostrarse como simulación educativa, no como prescripción.

Texto recomendado:

> Simulación educativa no validada clínicamente. No sirve para decidir dosis, tratamientos ni cambios médicos sin supervisión profesional.

## Pendientes recomendados

1. Añadir histórico real de simulaciones/consumos dentro del Gestor.
2. Permitir introducir dosis manuales además del plan automático.
3. Añadir selector de dispositivo: pluma, bomba, Accu-Chek, etc.
4. Añadir tests de motor para comparar salidas con GlucosaTrack original.
5. Separar CSS de la vista en un archivo propio cuando la UI se estabilice.
