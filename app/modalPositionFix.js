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

    .quick-search-label {
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

    #modalRoot.modal-root .modal:has(.compact-scanner),
    #modalRoot.modal-root .modal:has(#barcodeVideo),
    #modalRoot.modal-root .modal:has(#ingredientScanVideo) {
      width: min(480px, 100%) !important;
    }

    .compact-scanner,
    .scanner-box {
      display: grid;
      gap: .85rem;
    }

    .compact-scanner-frame,
    .scanner-frame {
      position: relative !important;
      overflow: hidden !important;
      border-radius: 24px !important;
      border: 3px solid rgba(15, 118, 110, .35) !important;
      background: #020617 !important;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.12), 0 18px 42px rgba(15,23,42,.22) !important;
      aspect-ratio: 4 / 3;
      min-height: 260px;
    }

    .compact-scanner-frame video,
    .scanner-frame video,
    #barcodeVideo,
    #ingredientScanVideo.scanner-video {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      border-radius: 20px !important;
      background: #020617 !important;
    }

    .scanner-reticle {
      position: absolute !important;
      inset: 28% 10% !important;
      border: 2px solid rgba(255, 255, 255, .88) !important;
      border-radius: 18px !important;
      pointer-events: none !important;
      box-shadow: 0 0 0 999px rgba(2, 6, 23, .28) !important;
    }

    .scanner-reticle::before {
      content: "";
      position: absolute;
      left: 8%;
      right: 8%;
      top: 50%;
      height: 3px;
      transform: translateY(-50%);
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, rgba(245, 158, 11, .95), transparent);
      box-shadow: 0 0 18px rgba(245, 158, 11, .85);
    }

    .scanner-reticle::after {
      content: "Alinea el código con la línea";
      position: absolute;
      left: 50%;
      bottom: -2.1rem;
      transform: translateX(-50%);
      white-space: nowrap;
      color: #fff;
      font-weight: 850;
      font-size: .82rem;
      text-shadow: 0 1px 6px rgba(0,0,0,.65);
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

      .compact-scanner-frame,
      .scanner-frame {
        aspect-ratio: 3 / 4;
        min-height: min(56dvh, 390px);
      }
    }
  `;
  document.head.append(style);
}

ensureModalPositionStyles();
