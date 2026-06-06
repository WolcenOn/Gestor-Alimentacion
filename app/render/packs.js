import { escapeHtml } from "../utils.js";
import { PACK_SOURCE } from "../services/packLoader.js";

export function renderPacks(state) {
  return `
    <div class="grid cols-2">
      <article class="card">
        <h2>Packs seguros</h2>
        <p class="muted">Origen bloqueado por seguridad. No se puede cambiar owner, repo, branch ni ruta base.</p>
        <div class="item">
          <strong>${PACK_SOURCE.owner}/${PACK_SOURCE.repo}</strong>
          <p class="qty-line">Branch: ${PACK_SOURCE.branch} · Ruta: ${PACK_SOURCE.basePath}/</p>
        </div>
        <div class="actions" style="margin-top:1rem">
          <button data-action="list-remote-packs">Buscar packs remotos</button>
          <label class="button secondary file-button">Importar pack local<input id="packFile" type="file" accept="application/json,.json" hidden></label>
        </div>
        <div id="remotePackList" class="list" style="margin-top:1rem"></div>
      </article>
      <article class="card">
        <h2>Packs instalados</h2>
        <div class="list">
          ${state.dishPacks.length ? state.dishPacks.map(p => `<div class="item"><strong>${escapeHtml(p.name)}</strong><p class="qty-line">${escapeHtml(p.description || "")}</p></div>`).join("") : `<p class="muted">No hay packs instalados.</p>`}
        </div>
      </article>
    </div>
  `;
}
