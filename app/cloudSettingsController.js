document.addEventListener("click", event => {
  const button = event.target.closest("[data-cloud-action]");
  if (!button) return;
  window.alert("Acción cloud no disponible todavía.");
});
