import { getState, updateState } from "./store.js";
import { showAlert, openModal } from "./render/ui.js";
import { renderCookingReviewModal } from "./render/dashboard.js";
import { consumePlannedDish, skipPlannedDish, reopenPlannedDish } from "./state/stock.js";

function getDishPayload(button) {
  const slot = button.dataset.slot;
  const dishId = button.dataset.dishId;
  if (!slot || !dishId) throw new Error("No se pudo identificar el plato planificado.");
  return { slot, dishId };
}

function refreshCookingReviewIfOpen(button) {
  const modal = button.closest("[data-cooking-review-day]");
  if (!modal) return;
  openModal(renderCookingReviewModal(getState(), modal.dataset.cookingReviewDay));
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (!["mark-planned-dish-consumed", "mark-planned-dish-skipped", "reopen-planned-dish"].includes(action)) return;

  try {
    const payload = getDishPayload(button);

    if (action === "mark-planned-dish-consumed") {
      let warnings = [];
      updateState(draft => {
        const result = consumePlannedDish(draft, payload);
        warnings = result.warnings || [];
      }, "meal-consumed");
      if (warnings.length) {
        showAlert(`Plato marcado como consumido, pero hay avisos: ${warnings.join(" · ")}`, "error");
      } else {
        showAlert("Plato marcado como consumido y stock descontado.");
      }
    }

    if (action === "mark-planned-dish-skipped") {
      let restored = false;
      updateState(draft => {
        const result = skipPlannedDish(draft, payload);
        restored = result.restored;
      }, "meal-skipped");
      showAlert(restored ? "Plato marcado como no consumido y stock restaurado." : "Plato marcado como no consumido. No se ha tocado el stock.");
    }

    if (action === "reopen-planned-dish") {
      let restored = false;
      updateState(draft => {
        const result = reopenPlannedDish(draft, payload);
        restored = result.restored;
      }, "meal-reopened");
      showAlert(restored ? "Plato reabierto y stock restaurado." : "Plato reabierto para decidir más tarde.");
    }

    refreshCookingReviewIfOpen(button);
  } catch (error) {
    console.error(error);
    showAlert(error.message || "No se pudo actualizar el estado del plato.", "error");
  }
});
