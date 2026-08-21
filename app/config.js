// Configuración pública del frontend.
// No pongas secretos aquí: este archivo se sirve desde GitHub Pages.

const RAILWAY_BACKEND_ORIGIN = "https://" + "reasonable-charisma-production-c66f.up.railway.app";

window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.API_BASE_URL ||= `${RAILWAY_BACKEND_ORIGIN}/api/v1`;
window.APP_CONFIG.PRICES_API_BASE_URL ||= "";
window.APP_CONFIG.PRICES_POSTAL_CODE ||= "28001";
