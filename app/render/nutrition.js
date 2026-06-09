import { escapeHtml } from "../utils.js";
import { computeDishNutrition, computeWeekNutrition, formatNutritionValue, missingIngredientNames, NUTRIENTS } from "../state/nutritionCalculator.js";
import { computeWeekGlycemicSummary, estimateGlycemicImpactFromNutrition, splitCarbs } from "../state/glycemicCalculator.js";

export function renderNutrition(state) {
  const weekNutrition = computeWeekNutrition(state);
  const glycemicSummary = computeWeekGlycemicSummary(state);
  const profilesByIngredient = new Map(state.nutritionProfiles.map(profile => [profile.ingredientId, profile]));
  const missingNames = missingIngredientNames(state, weekNutrition.missingIngredientIds);

  return `
    <div class="card-header">
      <div>
        <p class="eyebrow">Nutrición</p>
        <h2>Valores nutricionales, diabetes e impacto glucémico</h2>
        <p class="muted">Calcula a partir de las recetas planificadas. El impacto glucémico es una estimación educativa basada en azúcares, hidratos complejos, proteína y grasa; no recomienda insulina.</p>
      </div>
    </div>

    <div class="grid cols-3">
      <article class="card">
        <h3>Ingredientes con nutrición</h3>
        <p class="metric">${profilesByIngredient.size}/${state.ingredients.length}</p>
        <p class="muted">Completa los pendientes desde Ajustes → Enriquecimiento nutricional.</p>
      </article>
      <article class="card">
        <h3>Kcal semana planificada</h3>
        <p class="metric">${Math.round(weekNutrition.totals.kcal).toLocaleString("es-ES")}</p>
        <p class="muted">Suma de todos los miembros y platos asignados.</p>
      </article>
      <article class="card glycemic-level-${glycemicSummary.impact?.level || "bajo"}">
        <h3>Impacto glucémico semanal</h3>
        <p class="metric">${escapeHtml(glycemicSummary.impact?.level || "bajo")}</p>
        <p class="muted">Equiv. HC: ${glycemicSummary.impact?.carbEquivalent || 0} g · subida teórica ${glycemicSummary.impact?.estimatedRise || 0} mg/dL.</p>
      </article>
    </div>

    ${missingNames.length ? `<article class="card"><h3>Faltan datos nutricionales</h3><p class="muted">Estos ingredientes aparecen en la semana pero no tienen nutrición: ${escapeHtml(missingNames.join(", "))}</p></article>` : ""}

    <article class="card">
      <div class="section-title-row">
        <div>
          <h3>Resumen por persona</h3>
          <p class="muted">Total semanal, media diaria, estimación mensual y desglose de hidratos para diabetes.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="week-grid nutrition-table">
          <thead>
            <tr><th>Persona</th><th>Periodo</th>${NUTRIENTS.slice(0, 6).map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}<th>Azúcares</th><th>HC complejos</th><th>Impacto</th></tr>
          </thead>
          <tbody>
            ${Object.values(weekNutrition.byMember).map(bucket => renderMemberRows(bucket, glycemicSummary.byMember[bucket.member.id])).join("")}
          </tbody>
        </table>
      </div>
    </article>

    <article class="card">
      <h3>Resumen diario por persona</h3>
      <div class="grid cols-2">
        ${Object.values(weekNutrition.byMember).map(bucket => renderMemberDailyCard(bucket)).join("")}
      </div>
    </article>

    <article class="card">
      <div class="section-title-row">
        <div>
          <h3>Nutrición e impacto por plato</h3>
          <p class="muted">Busca por plato para ver valores calculados por 1 ración, azúcares simples, HC complejos e impacto estimado. La curva se calcula solo al desplegar el plato para evitar bloqueos.</p>
        </div>
        <span class="badge">${state.dishes.length} platos</span>
      </div>
      <label class="quick-search-label">Buscar platos nutricionales
        <input type="search" class="quick-search" placeholder="Ej. salmorejo, pollo, garbanzos..." data-search-target=".nutrition-dish-list .nutrition-dish-item" data-empty-target="nutritionDishSearchEmpty">
      </label>
      <div id="nutritionDishSearchEmpty" class="search-empty muted" hidden>No hay platos que coincidan.</div>
      <div class="list nutrition-dish-list">
        ${state.dishes.map(dish => renderDishNutritionItem(state, dish)).join("")}
      </div>
    </article>

    <article class="card">
      <div class="section-title-row">
        <div>
          <h3>Nutrición por ingrediente</h3>
          <p class="muted">Valores por 100 g/ml o por unidad según el perfil importado.</p>
        </div>
      </div>
      <label class="quick-search-label">Buscar ingredientes nutricionales
        <input type="search" class="quick-search" placeholder="Ej. tomate, USDA, Open Food Facts..." data-search-target=".nutrition-ingredient-list .nutrition-ingredient-item" data-empty-target="nutritionIngredientSearchEmpty">
      </label>
      <div id="nutritionIngredientSearchEmpty" class="search-empty muted" hidden>No hay ingredientes que coincidan.</div>
      <div class="list nutrition-ingredient-list">
        ${state.ingredients.map(ingredient => renderIngredientNutritionItem(ingredient, profilesByIngredient.get(ingredient.id))).join("")}
      </div>
    </article>
  `;
}

function renderMemberRows(bucket, glycemicBucket) {
  const daily = Object.fromEntries(Object.entries(bucket.total).map(([key, value]) => [key, value / 7]));
  const month = bucket.monthEstimate;
  return [
    renderNutritionRow(bucket.member.name, "Semana", bucket.total, glycemicBucket?.impact),
    renderNutritionRow(bucket.member.name, "Media diaria", daily, glycemicBucket ? { ...glycemicBucket.impact, sugar: glycemicBucket.impact.sugar / 7, complexCarbs: glycemicBucket.impact.complexCarbs / 7 } : null),
    renderNutritionRow(bucket.member.name, "Mes estimado", month, glycemicBucket ? { ...glycemicBucket.impact, sugar: glycemicBucket.impact.sugar * 30 / 7, complexCarbs: glycemicBucket.impact.complexCarbs * 30 / 7 } : null)
  ].join("");
}

function renderNutritionRow(name, period, total, impact) {
  const split = splitCarbs(total);
  return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(period)}</td>${NUTRIENTS.slice(0, 6).map(([key]) => `<td>${formatNutritionValue(key, total[key])}</td>`).join("")}<td>${formatNutritionValue("sugar", impact?.sugar ?? split.sugar)}</td><td>${formatNutritionValue("carbs", impact?.complexCarbs ?? split.complexCarbs)}</td><td><span class="badge ${impact?.level === "alto" ? "danger" : impact?.level === "medio" ? "warning" : ""}">${escapeHtml(impact?.level || "bajo")}</span></td></tr>`;
}

function renderMemberDailyCard(bucket) {
  const days = Object.entries(bucket.days || {});
  return `
    <div class="item">
      <strong>${escapeHtml(bucket.member.name)}</strong>
      ${days.length ? days.map(([day, total]) => {
        const split = splitCarbs(total);
        return `<p class="qty-line"><strong>${escapeHtml(day)}:</strong> ${formatNutritionValue("kcal", total.kcal)} · HC ${formatNutritionValue("carbs", total.carbs)} · azúcares ${formatNutritionValue("sugar", split.sugar)} · fibra ${formatNutritionValue("fiber", total.fiber)}</p>`;
      }).join("") : `<p class="muted">Sin platos planificados.</p>`}
    </div>
  `;
}

function renderDishNutritionItem(state, dish) {
  const data = computeDishNutrition(state, dish.id);
  const impact = estimateGlycemicImpactFromNutrition(data.total);
  const missingNames = missingIngredientNames(state, new Set(data.missing));
  const searchText = [dish.name, dish.category, dish.tags?.join(" "), dish.recipe?.map(line => state.ingredients.find(i => i.id === line.ingredientId)?.name).join(" ")].join(" ");
  return `
    <div class="item nutrition-dish-item glycemic-level-${impact.level}" data-search="${escapeHtml(searchText)}">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(dish.name)}</strong>
          <p class="qty-line">${formatNutritionValue("kcal", data.total.kcal)} · proteína ${formatNutritionValue("protein", data.total.protein)} · hidratos ${formatNutritionValue("carbs", data.total.carbs)} · grasa ${formatNutritionValue("fat", data.total.fat)}</p>
        </div>
        <span class="badge ${missingNames.length ? "warning" : impact.level === "alto" ? "danger" : impact.level === "medio" ? "warning" : ""}">${missingNames.length ? "incompleto" : `impacto ${impact.level}`}</span>
      </div>
      <div class="mini-facts">
        <span>Azúcares ${formatNutritionValue("sugar", impact.sugar)}</span>
        <span>HC complejos ${formatNutritionValue("carbs", impact.complexCarbs)}</span>
        <span>Equiv. HC ${impact.carbEquivalent} g</span>
        <span>Subida teórica ${impact.estimatedRise} mg/dL</span>
      </div>
      <details class="recipe-steps absorption-details" data-dish-id="${escapeHtml(dish.id)}">
        <summary>Ver curva de absorción estimada</summary>
        <div class="absorption-bars" data-absorption-target><p class="small muted">Abre el desplegable para calcular la curva de este plato.</p></div>
        <p class="small muted">Estimación educativa inspirada en el modelo de GlucosaTrack: azúcares rápidos, HC complejos más lentos y retraso por grasa/proteína. No sustituye criterios sanitarios ni calcula dosis.</p>
      </details>
      ${missingNames.length ? `<p class="small muted">Faltan perfiles: ${escapeHtml(missingNames.join(", "))}</p>` : ""}
    </div>
  `;
}

function renderIngredientNutritionItem(ingredient, profile) {
  const searchText = [ingredient.name, profile?.source, profile?.sourceName, profile?.fdcId].join(" ");
  if (!profile) {
    return `<div class="item nutrition-ingredient-item" data-search="${escapeHtml(searchText)}"><strong>${escapeHtml(ingredient.name)}</strong><p class="muted">Sin perfil nutricional.</p></div>`;
  }
  const split = splitCarbs(profile);
  return `
    <div class="item nutrition-ingredient-item" data-search="${escapeHtml(searchText)}">
      <div class="item-title">
        <div>
          <strong>${escapeHtml(ingredient.name)}</strong>
          <p class="qty-line">${escapeHtml(profile.sourceName || profile.source || "perfil nutricional")} · por ${profile.per || 100} ${escapeHtml(profile.unit || "g")}</p>
        </div>
        <span class="badge">${escapeHtml(profile.source || "manual")}</span>
      </div>
      <div class="mini-facts">
        <span>${formatNutritionValue("kcal", profile.kcal)}</span>
        <span>Proteína ${formatNutritionValue("protein", profile.protein)}</span>
        <span>HC ${formatNutritionValue("carbs", profile.carbs)}</span>
        <span>Azúcares ${formatNutritionValue("sugar", split.sugar)}</span>
        <span>HC complejos ${formatNutritionValue("carbs", split.complexCarbs)}</span>
        <span>Grasa ${formatNutritionValue("fat", profile.fat)}</span>
        <span>Fibra ${formatNutritionValue("fiber", profile.fiber)}</span>
      </div>
    </div>
  `;
}