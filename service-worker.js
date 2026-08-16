const CACHE_VERSION = "gestor-menu-v1.0.28-ux11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./side-menu.css",
  "./dashboard-compact.css",
  "./dashboard-today.css",
  "./week-accessibility.css",
  "./week-planner-assistant.css",
  "./week-planner-tray.css",
  "./ux-refresh.css",
  "./ux-week-density.css",
  "./manifest.webmanifest",
  "./packs/manifest.json",
  "./packs/desayunos/desayunos-sanos-espana.json",
  "./app/config.js",
  "./app/apiClient.js",
  "./app/cloudHouseholdEnhancements.js",
  "./app/cloudSync.js",
  "./app/cloudMembers.js",
  "./app/cloudMembersUi.js",
  "./app/cloudSessionGuard.js",
  "./app/legalContent.js",
  "./app/legalEnhancements.js",
  "./app/main.js",
  "./app/sideMenu.js",
  "./app/recipeIngredientBuilder.js",
  "./app/detailCards.js",
  "./app/dishPickerEnhancements.js",
  "./app/foodTranslationEnhancements.js",
  "./app/smartFoodTranslationEnhancements.js",
  "./app/weekPlannerAssistant.js",
  "./app/calendarNavigationEnhancements.js",
  "./app/weekDetailsStateEnhancements.js",
  "./app/purchaseScanPriceEnhancements.js",
  "./app/shoppingFilterStyles.js",
  "./app/compactUiEnhancements.js",
  "./app/packManifestEnhancements.js",
  "./app/services/foodTranslation.js",
  "./app/services/usdaFoodData.js",
  "./app/services/packLoader.js",
  "./app/nutritionBatchEnhancements.js",
  "./app/mainActionsBootstrap.js",
  "./app/render/settings.js",
  "./app/render/calendar.js",
  "./app/render/ingredientCard.js",
  "./app/uxRefresh.js",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg"
];

const STATIC_PATH_PREFIXES = [
  "/app/",
  "/assets/",
  "/packs/"
];

const STATIC_FILE_EXTENSIONS = [
  ".css",
  ".html",
  ".js",
  ".json",
  ".png",
  ".svg",
  ".webmanifest",
  ".woff2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isSensitiveRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(staleWhileRevalidate(request));
});

function isSensitiveRequest(url) {
  return url.pathname.startsWith("/api/") ||
    url.pathname.includes("/auth/") ||
    url.pathname.includes("/sync") ||
    url.pathname.includes("/households") ||
    url.pathname.includes("/invites");
}

function isStaticAsset(url) {
  return STATIC_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix)) ||
    STATIC_FILE_EXTENSIONS.some(extension => url.pathname.endsWith(extension));
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return await cache.match(request) || await cache.match(fallbackUrl);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
