function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function applyQuickSearch(input) {
  const selector = input.dataset.searchTarget;
  if (!selector) return;
  const query = normalizeText(input.value);
  const items = Array.from(document.querySelectorAll(selector));
  let visible = 0;

  for (const item of items) {
    const haystack = normalizeText(item.dataset.search || item.textContent || "");
    const match = !query || haystack.includes(query);
    item.hidden = !match;
    if (match) visible += 1;
  }

  const emptyId = input.dataset.emptyTarget;
  if (emptyId) {
    const empty = document.getElementById(emptyId);
    if (empty) empty.hidden = !query || visible > 0;
  }
}

document.addEventListener("input", event => {
  const input = event.target.closest(".quick-search");
  if (!input) return;
  applyQuickSearch(input);
});

document.addEventListener("click", event => {
  const clear = event.target.closest("[data-action='clear-quick-search']");
  if (!clear) return;
  const input = document.querySelector(clear.dataset.target || "");
  if (!input) return;
  input.value = "";
  applyQuickSearch(input);
  input.focus();
});

window.__gestorSearch = { applyQuickSearch };
