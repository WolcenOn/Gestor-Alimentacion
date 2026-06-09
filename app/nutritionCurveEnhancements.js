import { getState } from "./store.js";
import { computeDishGlycemicProfile } from "./state/glycemicCalculator.js";

function renderAbsorptionBars(curve = []) {
  const points = curve.filter((_, index) => index % 4 === 0 || index === curve.length - 1);
  const max = Math.max(...points.map(point => Number(point.total) || 0), 1);
  return points.map(point => {
    const width = Math.max(3, (Number(point.total) || 0) / max * 100);
    return `<div class="absorption-point"><span>${Math.round(point.time / 60)}h</span><div><i style="width:${width}%"></i></div><strong>${point.total}g</strong></div>`;
  }).join("");
}

function hydrateAbsorptionDetails(details) {
  if (!details?.open || details.dataset.loaded === "true") return;
  const target = details.querySelector("[data-absorption-target]");
  const dishId = details.dataset.dishId;
  if (!target || !dishId) return;

  target.innerHTML = `<p class="small muted">Calculando curva...</p>`;
  requestAnimationFrame(() => {
    try {
      const glycemic = computeDishGlycemicProfile(getState(), dishId);
      target.innerHTML = renderAbsorptionBars(glycemic.curve) || `<p class="small muted">No hay datos suficientes para dibujar la curva.</p>`;
      details.dataset.loaded = "true";
    } catch (error) {
      console.error(error);
      target.innerHTML = `<p class="small muted">No se pudo calcular la curva de este plato.</p>`;
    }
  });
}

document.addEventListener("toggle", event => {
  const details = event.target.closest?.(".absorption-details");
  if (!details) return;
  hydrateAbsorptionDetails(details);
}, true);
