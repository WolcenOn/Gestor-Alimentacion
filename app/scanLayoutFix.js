function ensureScanLayoutStyles() {
  if (document.getElementById("scanLayoutFixStyles")) return;
  const style = document.createElement("style");
  style.id = "scanLayoutFixStyles";
  style.textContent = `
    form[data-scanned-ingredient="true"] {
      gap: 1rem;
    }

    form[data-scanned-ingredient="true"] .package-purchase-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }

    form[data-scanned-ingredient="true"] .package-total-hint {
      grid-column: 1 / -1;
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
      background: rgba(230, 255, 251, .55);
      padding: .75rem .85rem;
      margin: 0;
    }

    form[data-scanned-ingredient="true"] > button {
      justify-self: start;
      margin-top: .2rem;
    }

    form[data-scanned-ingredient="true"] [data-open-prices-hint],
    form[data-scanned-ingredient="true"] [data-action="open-open-prices"] {
      display: none !important;
    }

    @media (max-width: 780px) {
      form[data-scanned-ingredient="true"] .package-purchase-grid {
        grid-template-columns: 1fr;
      }
      form[data-scanned-ingredient="true"] > button {
        width: 100%;
      }
    }
  `;
  document.head.append(style);
}

ensureScanLayoutStyles();
