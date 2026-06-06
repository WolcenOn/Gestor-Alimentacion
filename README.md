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

## Cambios de la versión con escáner, datos externos y sostenibilidad

- El escáner de código de barras ahora muestra una vista previa real de la cámara en móvil mediante `BarcodeDetector` cuando el navegador lo soporta.
- En **Ingredientes** se puede escanear un producto, buscar manualmente en Open Food Facts y asociar el resultado al ingrediente existente o crear uno nuevo.
- Se añadió búsqueda nutricional con USDA FoodData Central. La API key se introduce manualmente y no se guarda en `localStorage`; para producción se recomienda backend/proxy.
- Las compras permiten registrar tipo y número de envases para llevar contador de reciclaje.
- Cada ingrediente permite registrar desperdicio: se descuenta del stock, se guarda el motivo y se estima el valor tirado.
- El dashboard incluye puntuación anti-desperdicio y resumen de envases por tipo.

Nota móvil: para usar cámara, la página debe estar servida por HTTPS o `localhost`, y el navegador debe soportar `BarcodeDetector`. Si no lo soporta, se mantiene la entrada manual de código.
