import assert from "node:assert/strict";
import { createDefaultState } from "../models.js";
import { renderDashboard } from "../render/dashboard.js";

const state = createDefaultState();
const html = renderDashboard(state);

assert.match(html, /dashboard-card-grid/);
assert.match(html, /compact-dashboard-card/);
assert.match(html, /Registrar reciclaje/);
assert.match(html, /data-action="open-recycling-modal"/);
assert.doesNotMatch(html, /data-action="create-snapshot"/);
assert.doesNotMatch(html, /Guardar snapshot/);
assert.match(html, /dashboard-metric-grid/);

console.log("dashboard-compact.test.js OK");
