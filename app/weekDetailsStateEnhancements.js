const STORAGE_KEY = "gestorMenuSemanal.weekDetailsOpen.v1";

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeState(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore private browsing or storage quota errors.
  }
}

function keyFor(details) {
  if (details.matches("[data-week-day-details]")) {
    return ["day", details.dataset.weekId, details.dataset.day].join("::");
  }
  if (details.matches("[data-week-meal-details]")) {
    return ["meal", details.dataset.weekId, details.dataset.day, details.dataset.mealId].join("::");
  }
  return "";
}

function remember(details) {
  const key = keyFor(details);
  if (!key) return;
  const state = readState();
  state[key] = details.open;
  writeState(state);
}

function restoreOpenDetails(root = document) {
  const state = readState();
  root.querySelectorAll("[data-week-day-details], [data-week-meal-details]").forEach(details => {
    const key = keyFor(details);
    if (!key || !(key in state)) return;
    details.open = Boolean(state[key]);
  });
}

function ensureStyles() {
  if (document.getElementById("weekDetailsStateStyles")) return;
  const style = document.createElement("style");
  style.id = "weekDetailsStateStyles";
  style.textContent = `
    .compact-member-slot .dish-stack,
    .member-slot .dish-stack {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: .45rem;
      width: 100%;
    }

    .compact-member-slot .dish-pill,
    .member-slot .dish-pill {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      width: 100%;
      max-width: 100%;
      gap: .4rem;
    }

    .compact-member-slot .dish-pill-name,
    .member-slot .dish-pill-name {
      min-width: 0;
      width: 100%;
      text-align: left;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  `;
  document.head.append(style);
}

document.addEventListener("toggle", event => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement)) return;
  if (!details.matches("[data-week-day-details], [data-week-meal-details]")) return;
  remember(details);
}, true);

ensureStyles();
restoreOpenDetails();
window.addEventListener("load", () => restoreOpenDetails());

document.addEventListener("click", () => {
  requestAnimationFrame(() => restoreOpenDetails());
}, true);

const observer = new MutationObserver(mutations => {
  if (mutations.some(mutation => Array.from(mutation.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE))) {
    restoreOpenDetails();
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.__gestorWeekDetailsState = { restoreOpenDetails };
