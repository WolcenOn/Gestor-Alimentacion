const DISCLAIMER_ID = "healthDisclaimer";
const STORAGE_KEY = "gestor.healthDisclaimer.accepted.v1";

const DISCLAIMER_TITLE = "Aviso sobre salud y glucosa";
const DISCLAIMER_TEXT = "Esta app ayuda a organizar menús, compras y datos orientativos de nutrición/metabolismo. No sustituye el criterio de personal sanitario, no diagnostica y no debe usarse para ajustar medicación, insulina o tratamientos.";
const DISCLAIMER_ACTION = "Entendido";

function hasAcceptedDisclaimer() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function acceptDisclaimer() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Private browsing or restricted storage: dismiss for this page load only.
  }
  document.getElementById(DISCLAIMER_ID)?.remove();
}

function buildDisclaimer() {
  const alert = document.createElement("section");
  alert.id = DISCLAIMER_ID;
  alert.className = "alert";
  alert.setAttribute("role", "note");
  alert.setAttribute("aria-labelledby", `${DISCLAIMER_ID}Title`);

  const title = document.createElement("strong");
  title.id = `${DISCLAIMER_ID}Title`;
  title.textContent = DISCLAIMER_TITLE;

  const text = document.createElement("p");
  text.className = "muted";
  text.textContent = DISCLAIMER_TEXT;

  const action = document.createElement("button");
  action.type = "button";
  action.className = "secondary";
  action.textContent = DISCLAIMER_ACTION;
  action.addEventListener("click", acceptDisclaimer);

  alert.append(title, text, action);
  return alert;
}

function mountDisclaimer() {
  if (hasAcceptedDisclaimer() || document.getElementById(DISCLAIMER_ID)) return;

  const alerts = document.getElementById("alerts");
  if (!alerts) return;

  alerts.prepend(buildDisclaimer());
}

window.addEventListener("DOMContentLoaded", mountDisclaimer);
