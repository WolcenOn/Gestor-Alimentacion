import assert from "node:assert/strict";

const data = new Map();
globalThis.localStorage = {
  getItem: key => data.has(key) ? data.get(key) : null,
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: key => data.delete(key),
  clear: () => data.clear()
};

globalThis.window = globalThis;
globalThis.CustomEvent ||= class CustomEvent extends Event {
  constructor(type, params = {}) {
    super(type);
    this.detail = params.detail;
  }
};

globalThis.dispatchEvent = () => true;

const {
  getLegalAcceptance,
  hasAcceptedCurrentLegalVersion,
  recordLegalAcceptance,
  renderLegalModal,
  renderLegalStatusCard
} = await import("../legalContent.js");

assert.equal(getLegalAcceptance(), null);
assert.equal(hasAcceptedCurrentLegalVersion(), false);

const privacy = renderLegalModal("privacy");
assert.match(privacy, /Privacidad/);
assert.match(privacy, /Datos que puede tratar la app/);
assert.match(privacy, /Guardar aceptación local/);

const terms = renderLegalModal("terms");
assert.match(terms, /Términos de uso/);
assert.match(terms, /No es consejo médico/);

const acceptance = recordLegalAcceptance();
assert.equal(acceptance.accepted, true);
assert.ok(acceptance.acceptedAt);
assert.equal(hasAcceptedCurrentLegalVersion(), true);

const card = renderLegalStatusCard();
assert.match(card, /Aceptado localmente/);
assert.match(card, /Ver privacidad/);

console.log("legal-content.test.js OK");
