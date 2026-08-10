function ensureShoppingFilterStyles() {
  if (document.getElementById("shoppingFilterStyles")) return;
  const style = document.createElement("style");
  style.id = "shoppingFilterStyles";
  style.textContent = `
    .shopping-filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: .55rem;
      align-items: center;
      margin: .85rem 0 1rem;
      padding: .72rem;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(248, 250, 252, .82);
    }

    .shopping-filter-bar button {
      min-height: 42px;
      padding: .58rem .85rem;
      white-space: nowrap;
    }

    .shopping-filter-bar .mini-badge {
      background: rgba(255, 255, 255, .92);
      color: inherit;
      border: 1px solid rgba(217, 226, 236, .9);
      min-width: 1.45rem;
      height: 1.45rem;
      font-size: .72rem;
    }

    .supermarket-card[data-active-shopping-filter="partial"] {
      border-left: 7px solid var(--warning);
    }

    .supermarket-card[data-active-shopping-filter="done"] {
      border-left: 7px solid var(--ok);
    }

    .supermarket-card[data-active-shopping-filter="skipped"] {
      border-left: 7px solid var(--accent);
    }

    .supermarket-card[data-active-shopping-filter="pending"],
    .supermarket-card[data-active-shopping-filter="open"] {
      border-left: 7px solid var(--primary);
    }

    @media (max-width: 780px) {
      .shopping-filter-bar {
        position: sticky;
        top: 3.85rem;
        z-index: 7;
        background: rgba(245, 247, 251, .94);
        backdrop-filter: blur(12px);
      }

      .shopping-filter-bar button {
        flex: 1 1 140px;
      }
    }
  `;
  document.head.append(style);
}

ensureShoppingFilterStyles();
