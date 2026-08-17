import { escapeHtml } from "../utils.js";
import { PACK_SOURCE } from "../services/packLoader.js";

export function renderPacks(state) {
  return `
    <div class="grid cols-2 packs-page-grid">
      <article class="card packs-card">
        <h2>Packs seguros</h2>
        <p class="muted">Origen bloqueado por seguridad. Los packs se normalizan a recetas de 1 ración y se previsualizan antes de instalar.</p>
        <div class="item pack-source-card">
          <strong>${PACK_SOURCE.owner}/${PACK_SOURCE.repo}</strong>
          <p class="qty-line">Branch: ${PACK_SOURCE.branch} · Ruta: ${PACK_SOURCE.basePath}/</p>
        </div>
        <label class="quick-search-label">Búsqueda rápida de packs remotos
          <input type="search" class="quick-search" placeholder="Ej. desayuno, verano, Huelva, vegano..." data-search-target="#remotePackList .pack-file-item" data-empty-target="remotePackSearchEmpty">
        </label>
        <div class="actions wrap" style="margin-top:1rem">
          <button data-action="list-remote-packs">Buscar packs remotos</button>
          <label class="button secondary file-button">Importar pack local<input id="packFile" type="file" accept="application/json,.json" hidden></label>
        </div>
        <div id="remotePackSearchEmpty" class="search-empty muted" hidden>No hay packs remotos que coincidan con la búsqueda.</div>
        <div id="remotePackList" class="list pack-list" style="margin-top:1rem"></div>
      </article>

      <article class="card packs-card">
        <div class="section-title-row">
          <div>
            <h2>Packs instalados</h2>
            <p class="muted">Cada receta conserva sus comidas compatibles y solo se guardan las recetas que seleccionaste al instalar.</p>
          </div>
          <span class="badge">${state.dishPacks.length} packs</span>
        </div>
        <label class="quick-search-label">Búsqueda rápida de packs instalados
          <input type="search" class="quick-search" placeholder="Ej. desayuno, temporada, vegano..." data-search-target=".installed-pack-list .installed-pack-item" data-empty-target="installedPackSearchEmpty">
        </label>
        <div id="installedPackSearchEmpty" class="search-empty muted" hidden>No hay packs instalados que coincidan con la búsqueda.</div>
        <div class="list installed-pack-list pack-list">
          ${state.dishPacks.length ? state.dishPacks.map(pack => renderInstalledPack(state, pack)).join("") : `<p class="muted">No hay packs instalados.</p>`}
        </div>
      </article>
    </div>

    <details class="card collapsible-card pack-prompt-card">
      <summary class="collapsible-summary">
        <span>
          <strong>Generador de prompt para packs con IA</strong>
          <small>Desplegar solo cuando quieras crear un pack nuevo</small>
        </span>
        <span class="summary-hint">Desplegar</span>
      </summary>
      <div class="collapsible-body">
        <p class="muted">El prompt pide que cada receta indique sus comidas compatibles. Un mismo pack puede mezclar desayunos, comidas, meriendas y cenas.</p>
        <form data-form="pack-prompt" class="pack-prompt-form">
          <div class="form-grid">
            <label>Tipo de cocina<input name="cuisine" placeholder="Mediterránea, vegetariana, infantil..."></label>
            <label>Número de recetas<input name="count" type="number" min="1" max="30" value="6"></label>
            <label>Uso del pack<input name="meals" placeholder="Desayunos, comidas, cenas, mixto..."></label>
            <label>Raciones<input name="servings" value="1 ración por plato"></label>
          </div>
          <label>Restricciones, alergias o alimentos excluidos<textarea name="restrictions" placeholder="Sin frutos secos, sin lactosa, bajo en sal..."></textarea></label>
          <label>Preferencias e instrucciones<textarea name="preferences" placeholder="Barato, batch cooking, ingredientes de temporada, preparación sencilla..."></textarea></label>
          <button>Generar prompt</button>
        </form>
        <label>Prompt generado<textarea id="packPromptOutput" class="code-output" rows="12" readonly placeholder="Aquí aparecerá el prompt para copiarlo en una IA."></textarea></label>
        <div class="actions"><button class="secondary" type="button" data-action="copy-pack-prompt">Copiar prompt</button></div>
      </div>
    </details>
  `;
}

function mealTypeTags(dish) {
  const values = Array.isArray(dish.mealTypes) ? dish.mealTypes.filter(Boolean) : [];
  if (!values.length) return '<span class="ux-meal-tag ux-meal-unassigned">Sin tipo de comida</span>';
  return values.map(value => `<span class="ux-meal-tag">${escapeHtml(value)}</span>`).join("");
}

function renderInstalledPack(state, pack) {
  const dishes = state.dishes.filter(dish => dish.packId === pack.id);
  const plannedCount = countPackPlanningReferences(state, dishes.map(dish => dish.id));
  const searchText = [pack.name, pack.description, pack.tags?.join(" "), dishes.map(d => `${d.name} ${(d.mealTypes || []).join(" ")}`).join(" ")].join(" ");
  return `
    <article class="item installed-pack-item pack-installed-card" data-search="${escapeHtml(searchText)}">
      <div class="item-title pack-card-title">
        <div class="pack-title-text">
          <strong>${escapeHtml(pack.name)}</strong>
          <p class="qty-line">${escapeHtml(pack.description || "")}</p>
          <p class="small muted">${dishes.length} receta(s) instaladas${plannedCount ? ` · ${plannedCount} uso(s) en planificación` : ""}</p>
        </div>
        <button type="button" class="danger" data-action="confirm-delete-pack" data-pack-id="${escapeHtml(pack.id)}">Eliminar pack</button>
      </div>
      <details>
        <summary>Ver recetas instaladas del pack</summary>
        ${dishes.length ? `<ul class="pack-installed-dish-list">${dishes.map(dish => `<li><strong>${escapeHtml(dish.name)}</strong><span>${escapeHtml(dish.category || "Sin categoría")} · ${escapeHtml(dish.prepTime || "")}</span><span class="ux-meal-tags">${mealTypeTags(dish)}</span></li>`).join("")}</ul>` : `<p class="muted">Este pack no tiene recetas instaladas o ya fueron eliminadas.</p>`}
      </details>
    </article>
  `;
}

function countPackPlanningReferences(state, dishIds) {
  const ids = new Set(dishIds);
  let count = 0;
  for (const week of state.weeks || []) {
    for (const planned of Object.values(week.plan || {})) {
      for (const dishId of planned || []) if (ids.has(dishId)) count += 1;
    }
  }
  return count;
}

export function renderPackDeleteConfirmation(state, packId) {
  const pack = state.dishPacks.find(item => item.id === packId);
  if (!pack) return `<header><h2>Pack no encontrado</h2><button class="secondary" data-action="close-modal">×</button></header>`;
  const dishes = state.dishes.filter(dish => dish.packId === pack.id);
  const dishIds = new Set(dishes.map(dish => dish.id));
  const plannedCount = countPackPlanningReferences(state, dishes.map(dish => dish.id));
  const weeksWithPack = (state.weeks || []).filter(week => Object.values(week.plan || {}).some(planned => (planned || []).some(dishId => dishIds.has(dishId))));
  return `
    <header>
      <div>
        <p class="eyebrow">Eliminar pack instalado</p>
        <h2>${escapeHtml(pack.name)}</h2>
        <p class="muted">Esta acción elimina el pack de tu recetario local.</p>
      </div>
      <button class="secondary" data-action="close-modal">×</button>
    </header>
    <div class="item danger-soft">
      <strong>Advertencia</strong>
      <p class="qty-line">Se eliminarán ${dishes.length} receta(s) asociadas al pack. ${plannedCount ? `También hay ${plannedCount} referencia(s) en planificación semanal.` : "No hay recetas de este pack usadas en planificación."}</p>
    </div>
    ${weeksWithPack.length ? `<div class="item"><strong>Semanas afectadas</strong><ul>${weeksWithPack.map(week => `<li>${escapeHtml(week.name || week.id)}</li>`).join("")}</ul></div>` : ""}
    <div class="item">
      <strong>Recetas que se eliminarán</strong>
      ${dishes.length ? `<ul>${dishes.map(dish => `<li>${escapeHtml(dish.name)}</li>`).join("")}</ul>` : `<p class="muted">No quedan recetas asociadas.</p>`}
    </div>
    <form data-form="delete-installed-pack" data-pack-id="${escapeHtml(pack.id)}">
      <label class="check-row">
        <input type="checkbox" name="removePlanning" value="true" ${plannedCount ? "checked" : ""}>
        <span><strong>Eliminar también estas recetas de la planificación</strong><small>Quita las referencias de Semana para evitar platos eliminados en huecos planificados.</small></span>
      </label>
      <div class="actions">
        <button class="danger" name="confirmDelete" value="yes">Sí, eliminar pack</button>
        <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
      </div>
    </form>
  `;
}

export function renderPackPreview(pack, sourceIndex = "local") {
  const ingredientsById = new Map((pack.ingredients || []).map(i => [i.id, i]));
  const dishCount = pack.dishes?.length || 0;
  return `
    <header>
      <div>
        <h2>Previsualizar pack</h2>
        <p class="muted">${escapeHtml(pack.name)} · <strong>${dishCount} recetas</strong> · ${pack.ingredients.length} ingredientes</p>
      </div>
      <button class="secondary" data-action="close-modal">×</button>
    </header>
    <form data-form="pack-install" data-pack-index="${escapeHtml(String(sourceIndex))}">
      <div class="item success">
        <strong>Pack cargado correctamente</strong>
        <p class="qty-line">Revisa el tipo de comida de cada receta y desmarca las que no quieras conservar. Solo se instalarán las seleccionadas.</p>
      </div>
      <label class="quick-search-label">Buscar recetas dentro del pack
        <input type="search" class="quick-search" placeholder="Ej. desayuno, gazpacho, pollo, cena..." data-search-target=".pack-preview-list .pack-dish-preview" data-empty-target="packPreviewSearchEmpty">
      </label>
      <div id="packPreviewSearchEmpty" class="search-empty muted" hidden>No hay recetas del pack que coincidan con la búsqueda.</div>
      <div class="actions wrap">
        <button type="button" class="secondary" data-action="select-all-pack-dishes">Seleccionar todas</button>
        <button type="button" class="secondary" data-action="clear-pack-dishes">Desmarcar todas</button>
      </div>
      <p class="muted">Todas las cantidades están normalizadas a <strong>1 ración</strong>. El campo de comida pertenece a cada receta, no al pack completo.</p>
      <div class="list pack-preview-list">
        ${pack.dishes.map((dish, index) => renderPackDishPreview(dish, ingredientsById, index)).join("")}
      </div>
      <div class="actions sticky-actions">
        <button name="installMode" value="all">Instalar todo el pack (${dishCount})</button>
        <button class="secondary" name="installMode" value="selected">Instalar solo seleccionadas</button>
        <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
      </div>
    </form>
  `;
}

function renderPackDishPreview(dish, ingredientsById, index) {
  const recipe = (dish.recipe || []).map(line => {
    const ingredient = ingredientsById.get(line.ingredientId);
    return `<li>${escapeHtml(ingredient?.name || line.ingredientId)}: ${Number(line.qty).toLocaleString("es-ES")} ${escapeHtml(line.unit)}</li>`;
  }).join("");
  const ingredientNames = (dish.recipe || []).map(line => ingredientsById.get(line.ingredientId)?.name || line.ingredientId).join(" ");
  const steps = (dish.instructions || []).map((step, i) => `<li><strong>${i + 1}.</strong> ${escapeHtml(step)}</li>`).join("");
  const mealTypes = Array.isArray(dish.mealTypes) ? dish.mealTypes : [];
  const searchText = [dish.name, dish.category, mealTypes.join(" "), dish.tags?.join(" "), dish.prepTime, dish.notes, ingredientNames, (dish.instructions || []).join(" ")].join(" ");
  return `
    <article class="item pack-dish-preview" data-search="${escapeHtml(searchText)}">
      <label class="check-row">
        <input type="checkbox" name="dishIds" value="${escapeHtml(dish.id)}" checked>
        <span>
          <strong>${index + 1}. ${escapeHtml(dish.name)}</strong>
          <small>${escapeHtml(dish.category || "Sin categoría")} · ${escapeHtml(dish.prepTime || "")}</small>
          <span class="ux-meal-tags">${mealTypeTags(dish)}</span>
        </span>
      </label>
      <details>
        <summary>Ver ingredientes y elaboración</summary>
        <div class="preview-columns">
          <div><p class="small muted">Ingredientes por 1 ración</p><ul>${recipe}</ul></div>
          <div><p class="small muted">Pautas de elaboración</p><ol>${steps || "<li>Sin pautas.</li>"}</ol></div>
        </div>
      </details>
    </article>
  `;
}
