import { renderLegalModal, renderLegalStatusCard, recordLegalAcceptance } from "./legalContent.js";

function openLegalDoc(type = "privacy") {
  const root = document.getElementById("modalRoot");
  if (!root) return;
  root.innerHTML = `<section class="modal" role="dialog" aria-modal="true">${renderLegalModal(type)}</section>`;
  root.querySelector(".modal input, .modal button")?.focus();
}

function injectHeaderLegalActions() {
  const actions = document.querySelector(".header-actions");
  if (!actions || actions.querySelector("[data-legal-header]")) return;

  const privacy = document.createElement("button");
  privacy.type = "button";
  privacy.className = "secondary";
  privacy.dataset.action = "open-legal-doc";
  privacy.dataset.legalDoc = "privacy";
  privacy.dataset.legalHeader = "true";
  privacy.textContent = "Privacidad";

  const terms = document.createElement("button");
  terms.type = "button";
  terms.className = "secondary";
  terms.dataset.action = "open-legal-doc";
  terms.dataset.legalDoc = "terms";
  terms.dataset.legalHeader = "true";
  terms.textContent = "Términos";

  actions.append(privacy, terms);
}

function injectSettingsLegalCard() {
  const settingsHeader = document.querySelector(".settings-header");
  const viewRoot = document.getElementById("viewRoot");
  if (!settingsHeader || !viewRoot || viewRoot.querySelector(".legal-card")) return;

  const privacyCard = viewRoot.querySelector(".privacy-card");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderLegalStatusCard();
  const card = wrapper.firstElementChild;
  if (privacyCard) privacyCard.after(card);
  else settingsHeader.after(card);
}

function refreshLegalCard() {
  const existing = document.querySelector(".legal-card");
  if (!existing) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderLegalStatusCard();
  existing.replaceWith(wrapper.firstElementChild);
}

document.addEventListener("click", event => {
  const openButton = event.target.closest('[data-action="open-legal-doc"]');
  if (openButton) {
    event.preventDefault();
    event.stopPropagation();
    openLegalDoc(openButton.dataset.legalDoc || "privacy");
    return;
  }

  const acceptButton = event.target.closest('[data-action="accept-legal-docs"]');
  if (acceptButton) {
    event.preventDefault();
    event.stopPropagation();
    const checkbox = document.getElementById("legalAcceptanceCheckbox");
    if (!checkbox?.checked) {
      alert("Marca la casilla para registrar la aceptación local.");
      return;
    }
    recordLegalAcceptance();
    alert("Aceptación legal guardada en este navegador.");
    openLegalDoc("privacy");
  }
});

window.addEventListener("gestor:legal-acceptance", refreshLegalCard);

window.addEventListener("load", () => {
  injectHeaderLegalActions();
  injectSettingsLegalCard();

  const viewRoot = document.getElementById("viewRoot");
  if (viewRoot) {
    new MutationObserver(() => injectSettingsLegalCard()).observe(viewRoot, { childList: true, subtree: true });
  }
});

window.GestorLegal = {
  open: openLegalDoc,
  recordAcceptance: recordLegalAcceptance,
  refreshCard: refreshLegalCard
};
