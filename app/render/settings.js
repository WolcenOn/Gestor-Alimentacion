import { escapeHtml } from "../utils.js";

export function renderSettings(state) {
  const ingredientsWithNutrition = new Set(state.nutritionProfiles.map(profile => profile.ingredientId));
  const pendingNutrition = state.ingredients.filter(ingredient => !ingredientsWithNutrition.has(ingredient.id)).length;
  const offLinked = state.ingredients.filter(ingredient => (ingredient.products || []).some(product => product.source === "openfoodfacts" || product.barcode)).length;

  return `
    <div class="card-header settings-header">
      <div>
        <p class="eyebrow">Configuración</p>
        <h2>Familia, comidas y datos externos</h2>
        <p class="muted">Personaliza quién come en casa, qué comidas se planifican y cómo se consultan bases de datos nutricionales.</p>
      </div>
    </div>

    <div class="grid cols-2 settings-grid">
      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>Miembros de la familia</h3>
            <p class="muted">Añade personas o grupos: Virginia, Niños, Adultos, Todos...</p>
          </div>
          <span class="badge">${state.familyMembers.length}</span>
        </div>
        <form data-form="family-member" class="inline-form">
          <label>Nombre del miembro o grupo
            <input name="name" autocomplete="off" placeholder="Ej. Niños" required maxlength="40">
          </label>
          <button>Añadir</button>
        </form>
        <div class="list compact-list">
          ${state.familyMembers.map(member => `
            <div class="item member-row">
              <div>
                <strong>${escapeHtml(member.name)}</strong>
                <p class="qty-line">Se podrá planificar de forma independiente.</p>
              </div>
              <button class="secondary ${state.familyMembers.length <= 1 ? "disabled" : ""}" data-action="delete-family-member" data-member-id="${escapeHtml(member.id)}" ${state.familyMembers.length <= 1 ? "disabled" : ""}>Quitar</button>
            </div>
          `).join("")}
        </div>
      </article>

      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>Comidas registrables</h3>
            <p class="muted">Crea las comidas reales de vuestra rutina: desayuno, almuerzo, cena, batch cooking...</p>
          </div>
          <span class="badge">${state.mealTypes.length}</span>
        </div>
        <form data-form="meal-type" class="inline-form">
          <label>Nombre de la comida
            <input name="name" autocomplete="off" placeholder="Ej. Almuerzo colegio" required maxlength="40">
          </label>
          <button>Añadir</button>
        </form>
        <div class="list compact-list">
          ${state.mealTypes.map(meal => `
            <div class="item member-row">
              <div>
                <strong>${escapeHtml(meal.name)}</strong>
                <p class="qty-line">Aparecerá como bloque planificable en la semana.</p>
              </div>
              <button class="secondary ${state.mealTypes.length <= 1 ? "disabled" : ""}" data-action="delete-meal-type" data-meal-id="${escapeHtml(meal.id)}" ${state.mealTypes.length <= 1 ? "disabled" : ""}>Quitar</button>
            </div>
          `).join("")}
        </div>
      </article>
    </div>

    <div class="grid cols-2 settings-grid">
      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>USDA FoodData Central</h3>
            <p class="muted">Para búsquedas nutricionales. La clave se guarda solo en esta sesión del navegador, no en localStorage ni en el repositorio.</p>
          </div>
          <span class="badge">API</span>
        </div>
        <form data-form="usda-settings" class="inline-form">
          <label>API key USDA
            <input name="usdaApiKey" type="password" autocomplete="off" placeholder="Vacío = usar DEMO_KEY con límites bajos">
          </label>
          <button>Guardar sesión</button>
        </form>
        <div class="help-note">
          <p><strong>Cómo conseguirla:</strong> entra en FoodData Central → Data → Get an API Key. Te enviarán una key de data.gov.</p>
          <p class="muted">La app puede usar <code>DEMO_KEY</code> si no configuras nada, pero USDA indica que tiene límites mucho más bajos que una clave propia.</p>
        </div>
      </article>

      <article class="card">
        <div class="section-title-row">
          <div>
            <h3>Enriquecimiento nutricional por lotes</h3>
            <p class="muted">Completa ingredientes pendientes usando primero productos asociados de Open Food Facts y después USDA para alimentos a granel.</p>
          </div>
          <span class="badge warning">${pendingNutrition} pendientes</span>
        </div>
        <div class="mini-facts">
          <span>Ingredientes: ${state.ingredients.length}</span>
          <span>Con nutrición: ${ingredientsWithNutrition.size}</span>
          <span>Con producto/código: ${offLinked}</span>
        </div>
        <div class="help-note">
          <p><strong>Flujo recomendado:</strong> primero personaliza nombres e ingredientes. Después lanza la búsqueda por lotes. La app guarda candidaturas y solo aplica las marcadas como suficientemente fiables.</p>
          <p class="muted">Para resolver traducciones, se usa una tabla interna español→inglés y varios sinónimos antes de consultar USDA. Si la coincidencia no es clara, queda en revisión y no se aplica automáticamente.</p>
        </div>
        <div class="actions wrap">
          <button type="button" data-action="scan-bulk-nutrition">Buscar nutrición pendiente</button>
          <button type="button" class="secondary" data-action="apply-bulk-nutrition">Aplicar candidaturas fiables</button>
          <button type="button" class="secondary" data-action="clear-bulk-nutrition-cache">Borrar candidaturas</button>
        </div>
        <div id="nutritionBatchResults" class="list nutrition-batch-results">
          <p class="muted">Todavía no hay candidaturas. Lanza una búsqueda por lotes para generarlas.</p>
        </div>
      </article>
    </div>

    <article class="card tips-card">
      <h3>Cómo funciona ahora la semana</h3>
      <p>En la pestaña <strong>Semana</strong>, cada día muestra todas las comidas configuradas y, dentro de cada comida, todos los miembros. Puedes añadir tantos platos como quieras a cada persona.</p>
      <p class="muted">Al quitar un miembro o una comida, se limpia automáticamente su planificación asociada para mantener el estado consistente.</p>
    </article>
  `;
}
