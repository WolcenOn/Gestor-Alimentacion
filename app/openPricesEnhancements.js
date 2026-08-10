// Open Prices queda desactivado de forma intencionada.
// La integración resultó poco fiable para el flujo diario: no siempre aporta precios útiles,
// añade fricción visual y puede interferir con compra/escaneo.
// Mantener este módulo como no-op evita tocar los imports existentes y permite reactivar
// una versión futura más controlada si se decide volver a probarla.

window.GestorOpenPrices = {
  enabled: false,
  lookup: async () => null,
  contributeUrl: () => ""
};
