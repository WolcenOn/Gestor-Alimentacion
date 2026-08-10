import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

assert.doesNotMatch(html, /<nav class="tabs app-screen"/);
assert.match(html, /class="secondary menu-trigger"/);
assert.match(html, /aria-label="Abrir menú lateral"/);

assert.match(html, /id="sideMenu"/);
assert.match(html, /id="backendHealthBadge"/);
assert.match(html, /data-action="open-side-menu"/);
assert.match(html, /href="side-menu.css"/);
assert.match(html, /href="dashboard-compact.css"/);
assert.match(html, /src="app\/sideMenu.js"/);

for (const tab of ["dashboard", "ingredients", "dishes", "calendar", "shopping", "nutrition", "settings", "packs", "metabolic", "help"]) {
  assert.match(html, new RegExp(`data-tab="${tab}" data-side-menu-item`));
}

assert.match(html, /data-action="create-snapshot" data-side-menu-item/);
assert.match(html, /data-action="export-data" data-side-menu-item/);
assert.match(html, /data-legal-doc="privacy" data-side-menu-item/);
assert.match(html, /data-legal-doc="terms" data-side-menu-item/);

const headerMatch = html.match(/<header class="app-header app-screen simplified-header"[\s\S]*?<\/header>/);
assert.ok(headerMatch, "simplified header should exist");
const headerHtml = headerMatch[0];
assert.doesNotMatch(headerHtml, /Backend OK|Comprobar backend|Privacidad|Términos|Exportar JSON|Guardar snapshot/);

console.log("side-menu-navigation.test.js OK");
