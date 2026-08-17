import { getState, updateState } from "./store.js";

const ALL_MEMBERS = "__all_members__";
let scheduled = false;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mealTerms(meal) {
  if (!meal) return [];
  const base = [meal.id, meal.name].map(normalize).filter(Boolean);
  const text = base.join(" ");
  const aliases = [];
  if (/desay|breakfast/.test(text)) aliases.push("desayuno", "breakfast");
  if (/meriend|snack/.test(text)) aliases.push("merienda", "snack");
  if (/cen|dinner/.test(text)) aliases.push("cena", "dinner");
  if (/comida|almuerzo|lunch/.test(text)) aliases.push("comida", "almuerzo", "lunch");
  return [...new Set([...base, ...aliases])].filter(term => term.length > 2);
}

function dishMatchesMeal(dish, meal) {
  if (!dish || !meal) return true;
  const terms = mealTerms(meal);
  if (!terms.length) return true;

  const explicit = Array.isArray(dish.mealTypes) ? dish.mealTypes.map(normalize).filter(Boolean) : [];
  if (explicit.length) {
    return explicit.some(value => terms.some(term => value === term || value.includes(term) || term.includes(value)));
  }

  const searchable = [dish.category, ...(dish.tags || []), dish.name].map(normalize).join(" ");
  return terms.some(term => searchable.includes(term));
}

function matchingMealsForDish(state, dish) {
  return (state.mealTypes || []).filter(meal => dishMatchesMeal(dish, meal));
}

function assignedPackIds(state, memberId, mealId) {
  const configured = state.settings?.memberMealPackPreferences?.[memberId]?.[mealId];
  if (Array.isArray(configured)) return configured.filter(Boolean);

  // Backwards compatibility with the first single-pack version: use it for every meal
  // until the user saves a meal-specific selection.
  const legacy = state.settings?.memberPackPreferences?.[memberId];
  return legacy ? [legacy] : [];
}

function packNameList(state, packIds) {
  return packIds
    .map(id => state.dishPacks.find(pack => pack.id === id)?.name)
    .filter(Boolean);
}

function renderPackChecks(state, member, meal) {
  const selected = new Set(assignedPackIds(state, member.id, meal.id));
  if (!state.dishPacks?.length) {
    return '<p class="small muted ux-no-packs">No hay colecciones instaladas todavía.</p>';
  }

  return `
    <div class="ux-pack-choice-grid" role="group" aria-label="Packs para ${escapeHtml(member.name)} en ${escapeHtml(meal.name)}">
      ${state.dishPacks.map(pack => `
        <label class="ux-pack-choice ${selected.has(pack.id) ? "selected" : ""}">
          <input
            type="checkbox"
            data-member-meal-pack
            data-member-id="${escapeHtml(member.id)}"
            data-meal-id="${escapeHtml(meal.id)}"
            value="${escapeHtml(pack.id)}"
            ${selected.has(pack.id) ? "checked" : ""}
          >
          <span>${escapeHtml(pack.name)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderMemberMealPreferences(state, member, index) {
  const assignedCount = (state.mealTypes || []).reduce((total, meal) => total + assignedPackIds(state, member.id, meal.id).length, 0);
  return `
    <details class="ux-member-meal-preferences" ${index === 0 ? "open" : ""}>
      <summary>
        <span>
          <strong>${escapeHtml(member.name)}</strong>
          <small>${assignedCount ? `${assignedCount} selección(es) de packs` : "Sin packs limitados: se usarán todos"}</small>
        </span>
        <span class="ux-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="ux-member-meal-body">
        ${(state.mealTypes || []).map(meal => {
          const names = packNameList(state, assignedPackIds(state, member.id, meal.id));
          return `
            <section class="ux-meal-pack-row">
              <div class="ux-meal-pack-title">
                <div>
                  <strong>${escapeHtml(meal.name)}</strong>
                  <small>${names.length ? names.join(" · ") : "Todos los packs instalados"}</small>
                </div>
                ${names.length ? `<span class="badge">${names.length}</span>` : ""}
              </div>
              ${renderPackChecks(state, member, meal)}
            </section>
          `;
        }).join("") || '<p class="muted">Añade primero comidas en Ajustes.</p>'}
      </div>
    </details>
  `;
}

function enhanceSettings() {
  const state = getState();
  const familyCard = [...document.querySelectorAll("#viewRoot article.card")].find(card => {
    const title = normalize(card.querySelector("h3")?.textContent);
    return title === "personas en casa" || title === "miembros de la familia";
  });
  if (!familyCard || familyCard.querySelector("[data-member-pack-preferences]")) return;

  const section = document.createElement("section");
  section.dataset.memberPackPreferences = "true";
  section.className = "ux-member-pack-preferences";
  section.innerHTML = `
    <div class="ux-member-pack-heading">
      <div>
        <h4>Packs para autocompletar</h4>
        <p class="muted">Elige, para cada persona y cada comida que has definido, qué colecciones de recetas puede usar el asistente. Puedes marcar varias.</p>
      </div>
    </div>
    <div class="ux-member-pack-grid">
      ${state.familyMembers.map((member, index) => renderMemberMealPreferences(state, member, index)).join("")}
    </div>
    ${state.dishPacks?.length ? "" : '<p class="small muted">Instala primero alguna colección de recetas para poder asignarla.</p>'}
  `;

  const list = familyCard.querySelector(".list");
  if (list) list.after(section);
  else familyCard.append(section);
}

function enhanceInstalledPacks() {
  const state = getState();
  document.querySelectorAll("#viewRoot .installed-pack-item").forEach(card => {
    const packName = card.querySelector(".pack-title-text > strong")?.textContent?.trim();
    const pack = (state.dishPacks || []).find(item => item.name === packName);
    if (!pack) return;
    const dishes = state.dishes.filter(dish => dish.packId === pack.id);
    card.querySelectorAll(".pack-installed-dish-list li").forEach(item => {
      if (item.querySelector(".ux-meal-tags")) return;
      const dishName = item.querySelector("strong")?.textContent?.trim();
      const dish = dishes.find(entry => entry.name === dishName);
      if (!dish) return;
      const meals = matchingMealsForDish(state, dish);
      const tags = document.createElement("span");
      tags.className = "ux-meal-tags";
      tags.innerHTML = meals.length
        ? meals.map(meal => `<span class="ux-meal-tag">${escapeHtml(meal.name)}</span>`).join("")
        : '<span class="ux-meal-tag ux-meal-unassigned">Sin comida asignada</span>';
      item.append(tags);
    });
  });
}

function enhancePackPreview() {
  const state = getState();
  document.querySelectorAll("#modalRoot .pack-dish-preview").forEach(card => {
    if (card.querySelector(".ux-meal-tags")) return;
    const dishName = card.querySelector(".check-row strong")?.textContent?.replace(/^\d+\.\s*/, "").trim();
    const dish = state.dishes.find(entry => entry.name === dishName);
    if (!dish) return;
    const meals = matchingMealsForDish(state, dish);
    const tags = document.createElement("span");
    tags.className = "ux-meal-tags";
    tags.innerHTML = meals.length
      ? meals.map(meal => `<span class="ux-meal-tag">${escapeHtml(meal.name)}</span>`).join("")
      : '<span class="ux-meal-tag ux-meal-unassigned">Sin comida asignada</span>';
    card.querySelector(".check-row span")?.append(tags);
  });
}

function textFilterMatches(choice, form) {
  const searchable = choice.dataset.plannerDishSearch || "";
  const includeText = normalize(form.elements.includeText?.value);
  const excludeText = normalize(form.elements.excludeText?.value);
  return (!includeText || searchable.includes(includeText)) && (!excludeText || !searchable.includes(excludeText));
}

function enhancePlanner() {
  const form = document.querySelector('#modalRoot form[data-form="week-planner-assistant"]');
  if (!form) return;

  const state = getState();
  const memberId = String(form.elements.memberId?.value || ALL_MEMBERS);
  const mealId = String(form.elements.mealId?.value || "");
  const meal = state.mealTypes.find(item => item.id === mealId);
  const member = state.familyMembers.find(item => item.id === memberId);
  const packIds = memberId === ALL_MEMBERS ? [] : assignedPackIds(state, memberId, mealId);
  const packSet = new Set(packIds);
  const packNames = packNameList(state, packIds);

  let visible = 0;
  form.querySelectorAll(".planner-dish-choice").forEach(choice => {
    const dishId = choice.querySelector('input[name="dishIds"]')?.value;
    const dish = state.dishes.find(item => item.id === dishId);
    if (!dish) return;
    const mealMatches = !meal || dishMatchesMeal(dish, meal);
    const packMatches = !packSet.size || packSet.has(dish.packId);
    const show = mealMatches && packMatches && textFilterMatches(choice, form);
    choice.dataset.memberPackFiltered = show ? "false" : "true";
    choice.hidden = !show;
    if (!show) {
      const checkbox = choice.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = false;
    }
    if (show) visible += 1;
  });

  const count = form.querySelector("[data-planner-filter-count]");
  if (count) count.textContent = `${visible} receta(s) compatibles.`;

  let note = form.querySelector("[data-pack-filter-note]");
  if (!note) {
    note = document.createElement("div");
    note.dataset.packFilterNote = "true";
    note.className = "ux-planner-pack-note";
    const searchSection = form.querySelector(".planner-dish-picker-section") || form.querySelector(".planner-section:nth-of-type(3)");
    searchSection?.prepend(note);
  }

  if (note) {
    if (member && meal && packNames.length) {
      note.innerHTML = `<strong>${escapeHtml(member.name)} · ${escapeHtml(meal.name)}</strong><span>Packs permitidos: ${escapeHtml(packNames.join(" · "))}. Solo se muestran recetas compatibles con esta comida.</span>`;
      note.hidden = false;
    } else if (member && meal) {
      note.innerHTML = `<strong>${escapeHtml(member.name)} · ${escapeHtml(meal.name)}</strong><span>No has limitado packs para esta comida: se usan todas las colecciones con recetas compatibles.</span>`;
      note.hidden = false;
    } else if (meal) {
      note.innerHTML = `<strong>${escapeHtml(meal.name)}</strong><span>Al planificar para todos se muestran recetas compatibles de todas las colecciones.</span>`;
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }
}

function runEnhancements() {
  enhanceSettings();
  enhanceInstalledPacks();
  enhancePackPreview();
  enhancePlanner();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    runEnhancements();
  });
}

document.addEventListener("change", event => {
  const checkbox = event.target.closest("[data-member-meal-pack]");
  if (checkbox) {
    const memberId = checkbox.dataset.memberId;
    const mealId = checkbox.dataset.mealId;
    const scope = checkbox.closest(".ux-pack-choice-grid");
    const packIds = [...scope.querySelectorAll("[data-member-meal-pack]:checked")].map(input => input.value);

    updateState(draft => {
      draft.settings ||= {};
      draft.settings.memberMealPackPreferences ||= {};
      draft.settings.memberMealPackPreferences[memberId] ||= {};
      if (packIds.length) draft.settings.memberMealPackPreferences[memberId][mealId] = packIds;
      else delete draft.settings.memberMealPackPreferences[memberId][mealId];
      if (!Object.keys(draft.settings.memberMealPackPreferences[memberId]).length) delete draft.settings.memberMealPackPreferences[memberId];
      if (draft.settings.memberPackPreferences?.[memberId]) delete draft.settings.memberPackPreferences[memberId];
    }, "member-meal-pack-preference");
    return;
  }

  if (event.target.closest('form[data-form="week-planner-assistant"]')) setTimeout(schedule, 0);
});

document.addEventListener("input", event => {
  if (event.target.matches("[data-planner-filter]")) setTimeout(schedule, 0);
});

const observer = new MutationObserver(schedule);
const viewRoot = document.getElementById("viewRoot");
const modalRoot = document.getElementById("modalRoot");
if (viewRoot) observer.observe(viewRoot, { childList: true, subtree: true });
if (modalRoot) observer.observe(modalRoot, { childList: true, subtree: true });

window.addEventListener("load", schedule);
schedule();
