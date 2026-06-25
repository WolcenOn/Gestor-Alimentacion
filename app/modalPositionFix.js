function ensureModalPositionStyles() {
  if (document.getElementById("modalPositionFixStyles")) return;
  const style = document.createElement("style");
  style.id = "modalPositionFixStyles";
  style.textContent = `
    #modalRoot.modal-root:empty {
      display: none !important;
    }

    #modalRoot.modal-root:not(:empty) {
      position: fixed !important;
      inset: 0 !important;
      z-index: 10000 !important;
      display: grid !important;
      place-items: center !important;
      padding: 1rem !important;
      background: rgba(15, 23, 42, .38) !important;
      backdrop-filter: blur(6px);
      overflow-y: auto !important;
    }

    #modalRoot.modal-root .modal {
      position: relative !important;
      width: min(760px, 100%) !important;
      max-height: min(92dvh, 920px) !important;
      overflow: auto !important;
      background: var(--surface-strong) !important;
      border: 1px solid rgba(217, 226, 236, .95) !important;
      border-radius: var(--radius) !important;
      box-shadow: 0 24px 80px rgba(15, 23, 42, .24) !important;
      padding: 1rem !important;
    }

    #modalRoot.modal-root .modal > header {
      position: sticky;
      top: -1rem;
      z-index: 3;
      display: flex;
      justify-content: space-between;
      gap: .9rem;
      align-items: flex-start;
      margin: -1rem -1rem 1rem;
      padding: 1rem;
      background: var(--surface-strong);
      border-bottom: 1px solid var(--border);
    }

    #modalRoot.modal-root .quick-search-label {
      position: static !important;
      top: auto !important;
      z-index: auto !important;
      background: transparent !important;
      padding: 0 !important;
      backdrop-filter: none !important;
    }

    body:has(#modalRoot.modal-root:not(:empty)) {
      overflow: hidden;
    }

    @media (max-width: 780px) {
      #modalRoot.modal-root:not(:empty) {
        place-items: start center !important;
        padding: .5rem !important;
      }

      #modalRoot.modal-root .modal {
        width: 100% !important;
        max-height: calc(100dvh - 1rem) !important;
        border-radius: 20px !important;
      }
    }
  `;
  document.head.append(style);
}

ensureModalPositionStyles();
