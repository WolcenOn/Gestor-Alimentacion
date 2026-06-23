const sideMenu = document.getElementById("sideMenu");

function menuButton() {
  return document.querySelector('[data-action="open-side-menu"]');
}

export function openSideMenu() {
  if (!sideMenu) return;
  sideMenu.classList.add("open");
  sideMenu.setAttribute("aria-hidden", "false");
  menuButton()?.setAttribute("aria-expanded", "true");
  sideMenu.querySelector("[data-side-menu-item]")?.focus();
  document.body.dataset.sideMenuOpen = "true";
}

export function closeSideMenu() {
  if (!sideMenu) return;
  sideMenu.classList.remove("open");
  sideMenu.setAttribute("aria-hidden", "true");
  menuButton()?.setAttribute("aria-expanded", "false");
  delete document.body.dataset.sideMenuOpen;
}

document.addEventListener("click", event => {
  const openButton = event.target.closest('[data-action="open-side-menu"]');
  if (openButton) {
    event.preventDefault();
    event.stopPropagation();
    openSideMenu();
    return;
  }

  const closeButton = event.target.closest('[data-action="close-side-menu"]');
  if (closeButton) {
    event.preventDefault();
    event.stopPropagation();
    closeSideMenu();
    menuButton()?.focus();
    return;
  }

  const item = event.target.closest("[data-side-menu-item]");
  if (item) {
    window.setTimeout(closeSideMenu, 0);
  }
}, true);

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && sideMenu?.classList.contains("open")) {
    closeSideMenu();
    menuButton()?.focus();
  }
});

window.GestorSideMenu = { open: openSideMenu, close: closeSideMenu };
