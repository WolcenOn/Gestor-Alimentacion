import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

const navMatch = html.match(/<nav class="tabs app-screen"[\s\S]*?<\/nav>/);
assert.ok(navMatch, "main navigation should exist");
const navHtml = navMatch[0];

for (const mainTab of ["dashboard", "ingredients", "dishes", "calendar", "shopping", "nutrition"]) {
  assert.match(navHtml, new RegExp(`data-tab="${mainTab}"`));
}

for (const secondaryTab of ["settings", "packs", "metabolic", "help"]) {
  assert.doesNotMatch(navHtml, new RegExp(`data-tab="${secondaryTab}"`));
}

assert.match(html, /id="sideMenu"/);
assert.match(html, /data-action="open-side-menu"/);
assert.match(html, /data-action="export-data" data-side-menu-item/);
assert.match(html, /data-legal-doc="terms" data-side-menu-item/);
assert.match(html, /data-tab="settings" data-side-menu-item/);
assert.match(html, /data-tab="packs" data-side-menu-item/);
assert.match(html, /data-tab="metabolic" data-side-menu-item/);
assert.match(html, /data-tab="help" data-side-menu-item/);
assert.match(html, /src="app\/sideMenu.js"/);
assert.match(html, /href="side-menu.css"/);

console.log("side-menu-navigation.test.js OK");
