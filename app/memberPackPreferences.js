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

function mealKey(value) {
  const text = normalize(value);
  if (/desay|breakfast/.test(text)) return "desayuno";
  if (/meriend|snack/.test(text)) return "merienda";
  if (/cen|dinner/.test(text)) return "cena";
  if (/comida|almuerzo|lunch/.test(text)) return "comida";
  return "";
}

function inferDishMealKeys(dish) {
  const explicit = Array.isArray(dish.mealTypes) ? dish.mealTypes.map(mealKey).filter(Boolean) : [];
  if (explicit.length) return [...new Set(explicit)];

  const searchable = [dish.category, ...(dish.tags || []), dish.name].map(normalize).join(" ");
  const keys = [];
  if (/desay|breakfast/.test(searchable)) keys.push("desayuno");
  if (/meriend|snack/.test(searchable)) keys.push("merienda");
  if (/cen|dinner/.test(searchable)) keys.push("cena");
  if (/comida|almuerzo|lunch/.test(searchable)) keys.push("comida");
  return [...new Set(keys)];
}

function mealLabel(key) {
  return ({ desayuno: "Desayuno", comida: "Comida", merienda: "Merienda", cena: "Cena" })[key] || key;
}

function preferredPackId(state, memberId) {
  return state.settings?.memberPackPreferences?.[memberId] || "";
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
        <h4>Recetas preferidas por persona</h4>
        <p class="muted">Asigna un pack para que el asistente priorice sus recetas al planificar para esa persona.</p>
      </div>
    </div>
    <div class="ux-member-pack-grid">
      ${state.familyMembers.map(member => {
        const selected = preferredPackId(state, member.id);
        return `
          <label class="ux-member-pack-row">
            <span><strong>${escapeHtml(member.name)}</strong><small>Pack para autocompletar</small></span>
            <select data-member-pack-select data-member-id="${escapeHtml(member.id)}">
              <option value="">Todos los packs</option>
              ${(state.dishPacks || []).map(pack => `<option value="${escapeHtml(pack.id)}" ${selected === pack.id ? "selected" : ""}>${escapeHtml(pack.name)}</option>`).join("")}
            </select>
          </label>`;
      }).join("")}
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
      const keys = inferDishMealKeys(dish);
      if (!keys.length) return;
      const tags = document.createElement("span");
      tags.className = "ux-meal-tags";
      tags.innerHTML = keys.map(key => `<span class="ux-meal-tag ux-meal-${key}">${mealLabel(key)}</span>`).join("");
      item.append(tags);
    });
  });
}

function enhancePackPreview() {
  document.querySelectorAll("#modalRoot .pack-dish-preview").forEach(card => {
    if (card.querySelector(".ux-meal-tags")) return;
    const meta = card.querySelector(".check-row small")?.textContent || "";
    const key = mealKey(meta);
    if (!key) return;
    const tags = document.createElement("span");
    tags.className = "ux-meal-tags";
    tags.innerHTML = `<span class="ux-meal-tag ux-meal-${key}">${mealLabel(key)}</span>`;
    card.querySelector(".check-row span")?.append(tags);
  });
}

function enhancePlanner() {
  const form = document.querySelector('#modalRoot form[data-form="week-planner-assistant"]');
  if (!form) return;

  const state = getState();
  const memberId = String(form.elements.memberId?.value || ALL_MEMBERS);
  const mealId = String(form.elements.mealId?.value || "");
  const meal = state.mealTypes.find(item => item.id === mealId);
  const targetMealKey = mealKey(`${meal?.id || ""} ${meal?.name || ""}`);
  const packId = memberId === ALL_MEMBERS ? "" : preferredPackId(state, memberId);
  const pack = state.dishPacks.find(item => item.id === packId);
  const member = state.familyMembers.find(item => item.id === memberId);

  let visible = 0;
  form.querySelectorAll(".planner-dish-choice").forEach(choice => {
    const dishId = choice.querySelector('input[name="dishIds"]')?.value;
    const dish = state.dishes.find(item => item.id === dishId);
    if (!dish) return;
    const keys = inferDishMealKeys(dish);
    const mealMatches = !targetMealKey || !keys.length || keys.includes(targetMealKey);
    const packMatches = !packId || dish.packId === packId;
    const textFilterAllows = choice.dataset.memberPackHidden !== "text" && !choice.hidden;
    const show = mealMatches && packMatches && textFilterAllows;
    choice.dataset.memberPackFiltered = show ? "false" : "true";
    choice.hidden = !show;
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
    if (pack) {
      note.innerHTML = `<strong>${escapeHtml(member?.name || "Esta persona")}</strong> · ${escapeHtml(pack.name)}${targetMealKey ? ` · ${mealLabel(targetMealKey)}` : ""}<span>Mostrando recetas del pack asignado que encajan con esta comida.</span>`;
      note.hidden = false;
    } else if (targetMealKey) {
      note.innerHTML = `<strong>${mealLabel(targetMealKey)}</strong><span>Mostrando recetas compatibles. Asigna un pack en Ajustes para personalizar por persona.</span>`;
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
  const select = event.target.closest("[data-member-pack-select]");
  if (select) {
    const memberId = select.dataset.memberId;
    const packId = select.value;
    updateState(draft => {
      draft.settings ||= {};
      draft.settings.memberPackPreferences ||= {};
      if (packId) draft.settings.memberPackPreferences[memberId] = packId;
      else delete draft.settings.memberPackPreferences[memberId];
    }, "member-pack-preference");
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
