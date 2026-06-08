import { updateState } from "./store.js";
import { showAlert } from "./render/ui.js";
import { consumePlannedDish, undoPlannedDishConsumption } from "./state/stock.js";

document.addEventListener("change", event => {
  const input = event.target.closest('input[data-action="toggle-planned-dish-consumed"]');
  if (!input) return;
  const slot = input.dataset.slot;
  const dishId = input.dataset.dishId;
  if (!slot || !dishId) return;

  try {
    if (input.checked) {
      let warnings = [];
      updateState(draft => {
        const result = consumePlannedDish(draft, { slot, dishId });
        warnings = result.warnings || [];
      }, "meal-consumed");
      if (warnings.length) {
        showAlert(`Plato marcado como realizado, pero hay avisos: ${warnings.join(" · ")}`, "error");
      } else {
        showAlert("Plato marcado como realizado y stock descontado.");
      }
    } else {
      let restored = false;
      updateState(draft => {
        restored = undoPlannedDishConsumption(draft, { slot, dishId }).restored;
      }, "meal-consumed-undo");
      showAlert(restored ? "Plato desmarcado y stock restaurado." : "Plato desmarcado. No había consumo previo que restaurar.");
    }
  } catch (error) {
    console.error(error);
    input.checked = !input.checked;
    showAlert(error.message || "No se pudo actualizar el cumplimiento del plato.", "error");
  }
});
