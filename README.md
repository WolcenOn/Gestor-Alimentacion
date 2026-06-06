# Gestor de Menú Semanal

MVP frontend modular para planificar comidas, gestionar ingredientes, stock, caducidades, recetas, packs, lista de la compra, compras parciales/completas e impresión separada.

## Cómo abrirlo

Opción rápida:

```bash
cd gestor-menu-semanal
python3 -m http.server 5173
```

Abre `http://localhost:5173`.

> La cámara para escanear códigos suele requerir HTTPS o localhost. Si no está disponible, la app muestra entrada manual de código.

## Qué incluye este MVP

- Estado centralizado en `localStorage` con migraciones.
- Ingredientes, familias, platos, semanas, miembros y tipos de comida.
- Lista de compra calculada desde recetas planificadas menos stock.
- Compra parcial/completa integrada en cada fila de la lista.
- Actualización de stock, lotes y movimientos de compra.
- Productos/códigos de barras asociados a ingredientes.
- Búsqueda en Open Food Facts por código, sin claves privadas.
- Packs seguros bloqueados a `WolcenOn/GestorMenuSemanal/packs`.
- Importación/exportación JSON con validación básica.
- Impresión separada: lista compacta y cuadrante semanal.
- Dashboard accionable básico.
- Nutrición e histórico preparados en el modelo de datos.

## Estructura

```text
/
├── index.html
├── styles.css
├── app/
│   ├── main.js
│   ├── store.js
│   ├── models.js
│   ├── validation.js
│   ├── utils.js
│   ├── render/
│   ├── services/
│   ├── print/
│   └── state/
├── packs/
└── docs/
```

## Seguridad aplicada

- No usa `eval` ni `new Function`.
- Escapa texto antes de renderizar datos de usuario.
- Valida importaciones y packs.
- Bloquea owner/repo/branch/basePath de packs.
- Rechaza rutas con `..` y archivos no `.json`.
- No guarda secretos ni API keys privadas.

## Siguiente evolución recomendada

1. Pasar persistencia a IndexedDB.
2. Añadir tests de interfaz.
3. Crear backend/proxy para USDA FoodData Central.
4. Añadir autenticación y sincronización cloud.
5. Incorporar recomendador por reglas y luego IA.


## Novedades de esta versión

- Pestaña **Ajustes** para crear o quitar miembros de la familia y tipos de comida.
- Planificación semanal por día, comida y persona/grupo.
- Cada persona puede tener tantos platos como necesite en cada comida.
- Impresión semanal con el desglose por miembros.
- Interfaz renovada, más moderna y adaptada a móvil.
