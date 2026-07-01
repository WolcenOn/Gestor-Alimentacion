import { openModal } from "./render/ui.js";

function ensureCompactUiStyles() {
  if (document.getElementById("compactUiStyles")) return;
  const style = document.createElement("style");
  style.id = "compactUiStyles";
  style.textContent = `
    .app-header.simplified-header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      padding: .72rem 1.25rem .55rem;
      gap: .75rem;
    }

    .app-header.simplified-header .eyebrow,
    .app-header.simplified-header .muted {
      display: none;
    }

    .app-header.simplified-header h1 {
      font-size: clamp(1.18rem, 4vw, 1.6rem);
      margin: 0;
    }

    .info-button {
      min-width: 42px;
      width: 42px;
      padding-inline: 0;
      border-radius: 999px;
      font-weight: 950;
    }

    .compact-section-header {
      margin-bottom: .65rem;
    }

    .compact-section-header h2 {
      font-size: clamp(1.28rem, 4vw, 1.7rem);
    }

    .compact-supermarket-card {
      padding: .82rem;
    }

    .compact-section-title-row {
      margin-bottom: .25rem;
    }

    .compact-section-title-row h3 {
      font-size: 1rem;
    }

    .compact-search-label {
      margin: .55rem 0 .7rem;
    }

    .compact-shopping-zone {
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255, 255, 255, .72);
      overflow: hidden;
      margin-top: .55rem;
    }

    .compact-shopping-zone > summary {
      padding: .6rem .75rem;
      cursor: pointer;
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: .65rem;
    }

    .compact-shopping-zone > summary::-webkit-details-marker {
      display: none;
    }

    .compact-supermarket-list {
      gap: .5rem;
      padding: .55rem;
    }

    .compact-shopping-item {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: .62rem .7rem;
      gap: .6rem;
      border-radius: 14px;
    }

    .compact-shopping-title {
      align-items: center;
      gap: .5rem;
    }

    .compact-shopping-title strong {
      min-width: 0;
    }

    .compact-shopping-main .qty-line {
      font-size: .92rem;
    }

    .compact-shopping-actions {
      gap: .4rem;
      justify-content: flex-end;
    }

    .compact-shopping-actions button {
      min-height: 38px;
      padding: .48rem .7rem;
      font-size: .9rem;
    }

    .help-list {
      margin: .75rem 0 0;
      padding-left: 1.15rem;
      display: grid;
      gap: .45rem;
    }

    @media (max-width: 780px) {
      .app-header.simplified-header {
        grid-template-columns: 1fr auto;
        padding: .65rem .82rem .45rem;
      }

      .app-header.simplified-header .header-actions {
        width: auto;
      }

      .app-header.simplified-header .header-actions button {
        flex: 0 0 auto;
      }

      .compact-shopping-item {
        grid-template-columns: 1fr;
      }

      .compact-shopping-actions {
        justify-content: stretch;
      }

      .compact-shopping-actions button {
        flex: 1 1 auto;
      }
    }
  `;
  document.head.append(style);
}

function compactHeader() {
  const header = document.querySelector(".app-header.simplified-header");
  if (!header || header.dataset.compactReady === "true") return;
  header.dataset.compactReady = "true";
  const title = header.querySelector("h1");
  if (title) title.textContent = "Menú semanal";
  const actions = header.querySelector(".header-actions");
  if (actions && !actions.querySelector('[data-action="open-app-help"]')) {
    const helpButton = document.createElement("button");
    helpButton.type = "button";
    helpButton.className = "secondary info-button";
    helpButton.dataset.action = "open-app-help";
    helpButton.setAttribute("aria-label", "Ayuda sobre la app");
    helpButton.textContent = "?";
    actions.prepend(helpButton);
  }
}

function openAppHelp() {
  openModal(`
    <header>
      <div><h2>Gestor de Menú Semanal</h2><p class="muted">Resumen rápido</p></div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <p>Planifica comidas, genera la lista de compra, registra compras y actualiza el stock. Las explicaciones largas se muestran aquí para no ocupar espacio en la pantalla principal.</p>
    <ul class="help-list">
      <li><strong>Semana:</strong> planificación por días y comidas.</li>
      <li><strong>Compra:</strong> lista filtrable por pendiente, parcial, comprado y no comprar.</li>
      <li><strong>Ingredientes:</strong> stock, precios, envases y compra rápida.</li>
    </ul>
  `);
}

function openShoppingHelp() {
  openModal(`
    <header>
      <div><h2>Lista de la compra</h2><p class="muted">Cómo se calcula y cómo usar los filtros</p></div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <p>La lista se calcula con las recetas planificadas, el stock disponible y las compras ya registradas.</p>
    <ul class="help-list">
      <li><strong>Por comprar:</strong> pendientes y parciales.</li>
      <li><strong>Pendientes:</strong> todavía no se ha comprado nada de ese producto.</li>
      <li><strong>Parciales:</strong> se compró una parte, pero falta cantidad.</li>
      <li><strong>Comprados:</strong> ya está cubierto para la semana.</li>
      <li><strong>No comprar:</strong> artículos omitidos en esta compra.</li>
    </ul>
  `);
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "open-app-help") {
    event.preventDefault();
    event.stopImmediatePropagation();
    openAppHelp();
  }
  if (button.dataset.action === "open-shopping-help") {
    event.preventDefault();
    event.stopImmediatePropagation();
    openShoppingHelp();
  }
}, true);

ensureCompactUiStyles();
compactHeader();
window.addEventListener("load", compactHeader);
