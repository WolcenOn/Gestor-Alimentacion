import { escapeHtml } from "../utils.js";
import { PACK_SOURCE } from "../services/packLoader.js";

export function renderPacks(state) {
  return `
    <div class="grid cols-2">
      <article class="card">
        <h2>Packs seguros</h2>
        <p class="muted">Origen bloqueado por seguridad. Los packs se normalizan a recetas de 1 ración y se previsualizan antes de instalar.</p>
        <div class="item">
          <strong>${PACK_SOURCE.owner}/${PACK_SOURCE.repo}</strong>
          <p class="qty-line">Branch: ${PACK_SOURCE.branch} · Ruta: ${PACK_SOURCE.basePath}/</p>
        </div>
        <div class="actions" style="margin-top:1rem">
          <button data-action="list-remote-packs">Buscar packs remotos</button>
          <label class="button secondary file-button">Importar pack local<input id="packFile" type="file" accept="application/json,.json" hidden></label>
        </div>
        <div id="remotePackList" class="list" style="margin-top:1rem"></div>
      </article>

      <article class="card">
        <h2>Packs instalados</h2>
        <div class="list">
          ${state.dishPacks.length ? state.dishPacks.map(p => `<div class="item"><strong>${escapeHtml(p.name)}</strong><p class="qty-line">${escapeHtml(p.description || "")}</p></div>`).join("") : `<p class="muted">No hay packs instalados.</p>`}
        </div>
      </article>
    </div>

    <article class="card pack-prompt-card">
      <div class="section-title-row">
        <div>
          <h2>Generador de prompt para packs con IA</h2>
          <p class="muted">Rellena el formulario y genera un prompt que obliga a la IA a devolver JSON válido, con recetas a 1 ración y pautas de elaboración.</p>
        </div>
      </div>
      <form data-form="pack-prompt" class="pack-prompt-form">
        <div class="form-grid">
          <label>Tipo de cocina<input name="cuisine" placeholder="Mediterránea, vegetariana, infantil..."></label>
          <label>Número de recetas<input name="count" type="number" min="1" max="30" value="6"></label>
          <label>Uso del pack<input name="meals" placeholder="Cenas rápidas, comidas de tupper..."></label>
          <label>Raciones<input name="servings" value="1 ración por plato"></label>
        </div>
        <label>Restricciones, alergias o alimentos excluidos<textarea name="restrictions" placeholder="Sin frutos secos, sin lactosa, bajo en sal..."></textarea></label>
        <label>Preferencias e instrucciones<textarea name="preferences" placeholder="Barato, batch cooking, ingredientes de temporada, preparación sencilla..."></textarea></label>
        <button>Generar prompt</button>
      </form>
      <label>Prompt generado<textarea id="packPromptOutput" class="code-output" rows="12" readonly placeholder="Aquí aparecerá el prompt para copiarlo en una IA."></textarea></label>
      <div class="actions"><button class="secondary" type="button" data-action="copy-pack-prompt">Copiar prompt</button></div>
    </article>
  `;
}

export function renderPackPreview(pack, sourceIndex = "local") {
  const ingredientsById = new Map((pack.ingredients || []).map(i => [i.id, i]));
  return `
    <header>
      <div>
        <h2>Previsualizar pack</h2>
        <p class="muted">${escapeHtml(pack.name)} · ${pack.dishes.length} recetas · ${pack.ingredients.length} ingredientes</p>
      </div>
      <button class="secondary" data-action="close-modal">×</button>
    </header>
    <form data-form="install-pack" data-pack-index="${escapeHtml(String(sourceIndex))}">
      <p class="muted">Elige qué recetas quieres añadir. Solo se importarán los ingredientes necesarios para esas recetas. Todas las cantidades están normalizadas a <strong>1 ración</strong>.</p>
      <div class="list pack-preview-list">
        ${pack.dishes.map(dish => renderPackDishPreview(dish, ingredientsById)).join("")}
      </div>
      <div class="actions sticky-actions">
        <button name="installMode" value="selected">Instalar recetas seleccionadas</button>
        <button class="secondary" name="installMode" value="all">Instalar todo</button>
        <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
      </div>
    </form>
  `;
}

function renderPackDishPreview(dish, ingredientsById) {
  const recipe = (dish.recipe || []).map(line => {
    const ingredient = ingredientsById.get(line.ingredientId);
    return `<li>${escapeHtml(ingredient?.name || line.ingredientId)}: ${Number(line.qty).toLocaleString("es-ES")} ${escapeHtml(line.unit)}</li>`;
  }).join("");
  const steps = (dish.instructions || []).map((step, i) => `<li><strong>${i + 1}.</strong> ${escapeHtml(step)}</li>`).join("");
  return `
    <article class="item pack-dish-preview">
      <label class="check-row">
        <input type="checkbox" name="dishIds" value="${escapeHtml(dish.id)}" checked>
        <span><strong>${escapeHtml(dish.name)}</strong><small>${escapeHtml(dish.category || "Sin categoría")} · ${escapeHtml(dish.prepTime || "")}</small></span>
      </label>
      <div class="preview-columns">
        <div><p class="small muted">Ingredientes por 1 ración</p><ul>${recipe}</ul></div>
        <div><p class="small muted">Pautas de elaboración</p><ol>${steps || "<li>Sin pautas.</li>"}</ol></div>
      </div>
    </article>
  `;
}
