// Configuración pública del frontend.
// No pongas secretos aquí: este archivo se sirve desde GitHub Pages.

const RAILWAY_BACKEND_ORIGIN = "https://" + "reasonable-charisma-production-c66f.up.railway.app";

window.APP_CONFIG = window.APP_CONFIG || {
  API_BASE_URL: `${RAILWAY_BACKEND_ORIGIN}/api/v1`
};
