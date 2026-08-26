import { escapeHtml, formatMoney } from "./utils.js";
import {
  getCanonicalIngredientProducts,
  getPricesPostalCode,
  isPricesApiConfigured,
  searchCanonicalIngredients,
  searchProducts
} from "./services/pricesApi.js";

function renderProduct(product, match = null) {
  const unitPrice = Number(product?.pricePerUnit) > 0 && product?.priceUnit
    ? `${Number(product.pricePerUnit).toLocaleString("es-ES", { maximumFractionDigits: 2 })} €/${escapeHtml(product.priceUnit)}`
    : "sin precio unitario";
  const packageText = Number(product?.packageAmount) > 0 && product?.packageUnit
    ? `${Number(product.packageAmount).toLocaleString("es-ES")} ${escapeHtml(product.packageUnit)}`
    : product?.variableWeight ? "venta por peso" : "formato no informado";
  const availability = product?.available === false ? "No disponible" : "Disponible";
  const matchText = match?.matchStatus ? ` · match ${escapeHtml(match.matchStatus)}` : "";
  return `
    <article class="item">
      <div class="item-title">
        <strong>${escapeHtml(product?.name || "Producto sin nombre")}</strong>
        <span class="badge ${product?.available === false ? "warning" : "success"}">${availability}</span>
      </div>
      <p class="qty-line">${escapeHtml(product?.supermarketId || "supermercado ?")}${product?.brand ? ` · ${escapeHtml(product.brand)}` : ""}${matchText}</p>
      <p class="small"><strong>${formatMoney(Number(product?.price) || 0)}</strong> · ${unitPrice} · ${packageText}${product?.variableWeight ? " · aproximado por peso" : ""}</p>
    </article>`;
}

function renderCanonical(ingredient) {
  const meta = [ingredient?.category, ingredient?.subtype, ingredient?.defaultUnit].filter(Boolean).map(escapeHtml).join(" · ");
  return `
    <article class="item">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(ingredient?.name || ingredient?.id || "Canonical")}</strong>
          <p class="qty-line"><code>${escapeHtml(ingredient?.id || "")}</code>${meta ? ` · ${meta}` : ""}</p>
        </div>
        <button type="button" class="secondary" data-action="debug-canonical-products" data-canonical-id="${escapeHtml(ingredient?.id || "")}">Ver productos enlazados</button>
      </div>
      <div class="list" data-canonical-products-result="${escapeHtml(ingredient?.id || "")}"></div>
    </article>`;
}

function panelMarkup() {
  const postalCode = escapeHtml(getPricesPostalCode());
  return `
    <article class="card packs-card" data-price-search-panel>
      <div class="section-title-row">
        <div>
          <p class="eyebrow">Diagnóstico Prices API</p>
          <h2>Buscar productos y canonicals</h2>
          <p class="muted">Busca una palabra para comprobar por separado si existe un canonical y qué productos comerciales devuelve la API. CP ${postalCode}.</p>
        </div>
        <span class="badge">Prices API</span>
      </div>
      <form data-form="price-debug-search" class="actions wrap">
        <label style="flex:1;min-width:14rem">Nombre de ingrediente o producto
          <input name="query" type="search" required minlength="2" placeholder="Ej. tomate, berenjena, leche desnatada...">
        </label>
        <button>Buscar</button>
      </form>
      <p class="small muted">Interpretación: si hay productos crudos pero no canonical, falta catálogo canonical. Si hay canonical pero 0 productos enlazados, falta matching/importación. Si ambos existen, la capa de datos está disponible.</p>
      <div data-price-debug-status class="muted"></div>
      <div class="grid cols-2" data-price-debug-results hidden>
        <section>
          <h3>Canonicals</h3>
          <div class="list" data-price-debug-canonicals></div>
        </section>
        <section>
          <h3>Productos encontrados por texto</h3>
          <div class="list" data-price-debug-products></div>
        </section>
      </div>
    </article>`;
}

function ensurePanel() {
  const grid = document.querySelector(".packs-page-grid");
  if (!grid || grid.querySelector("[data-price-search-panel]")) return;
  grid.insertAdjacentHTML("beforeend", panelMarkup());
}

async function runSearch(form) {
  const panel = form.closest("[data-price-search-panel]");
  if (!panel) return;
  const status = panel.querySelector("[data-price-debug-status]");
  const results = panel.querySelector("[data-price-debug-results]");
  const canonicalRoot = panel.querySelector("[data-price-debug-canonicals]");
  const productsRoot = panel.querySelector("[data-price-debug-products]");
  const query = String(new FormData(form).get("query") || "").trim();

  if (!isPricesApiConfigured()) {
    status.textContent = "Prices API no está configurada en esta instalación.";
    return;
  }

  status.textContent = `Buscando “${query}”...`;
  results.hidden = true;
  canonicalRoot.innerHTML = "";
  productsRoot.innerHTML = "";

  const [canonicalResult, productResult] = await Promise.allSettled([
    searchCanonicalIngredients({ query }),
    searchProducts({ query })
  ]);

  const canonicalItems = canonicalResult.status === "fulfilled" && Array.isArray(canonicalResult.value?.items)
    ? canonicalResult.value.items
    : [];
  const products = productResult.status === "fulfilled" && Array.isArray(productResult.value?.items)
    ? productResult.value.items
    : [];

  canonicalRoot.innerHTML = canonicalItems.length
    ? canonicalItems.map(renderCanonical).join("")
    : `<p class="muted">No existe ningún canonical que coincida con “${escapeHtml(query)}”.</p>`;
  productsRoot.innerHTML = products.length
    ? products.slice(0, 30).map(product => renderProduct(product)).join("")
    : `<p class="muted">No hay productos comerciales que coincidan con “${escapeHtml(query)}” para el CP ${escapeHtml(getPricesPostalCode())}.</p>`;

  const errors = [];
  if (canonicalResult.status === "rejected") errors.push(`canonicals: ${canonicalResult.reason?.message || "error"}`);
  if (productResult.status === "rejected") errors.push(`productos: ${productResult.reason?.message || "error"}`);
  status.textContent = `${canonicalItems.length} canonical(s) · ${products.length} producto(s)${errors.length ? ` · ${errors.join(" · ")}` : ""}`;
  results.hidden = false;
}

async function loadCanonicalProducts(button) {
  const canonicalId = String(button.dataset.canonicalId || "").trim();
  if (!canonicalId) return;
  const root = button.closest(".item")?.querySelector(`[data-canonical-products-result="${CSS.escape(canonicalId)}"]`);
  if (!root) return;
  button.disabled = true;
  root.innerHTML = `<p class="muted">Consultando productos enlazados...</p>`;
  try {
    const payload = await getCanonicalIngredientProducts({ ingredientId: canonicalId });
    const items = Array.isArray(payload?.items) ? payload.items : [];
    root.innerHTML = items.length
      ? items.map(item => renderProduct(item.product, item)).join("")
      : `<p class="muted">Este canonical existe, pero todavía no tiene productos enlazados para el CP ${escapeHtml(getPricesPostalCode())}.</p>`;
  } catch (error) {
    root.innerHTML = `<p class="alert error">${escapeHtml(error?.message || "No se pudieron consultar los productos enlazados.")}</p>`;
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("submit", event => {
  const form = event.target.closest('form[data-form="price-debug-search"]');
  if (!form) return;
  event.preventDefault();
  void runSearch(form);
});

document.addEventListener("click", event => {
  const button = event.target.closest('[data-action="debug-canonical-products"]');
  if (!button) return;
  event.preventDefault();
  void loadCanonicalProducts(button);
});

function schedule() {
  window.setTimeout(ensurePanel, 0);
}

if (typeof document !== "undefined") {
  schedule();
  const observer = new MutationObserver(schedule);
  const viewRoot = document.getElementById("viewRoot");
  if (viewRoot) observer.observe(viewRoot, { childList: true, subtree: true });
}
