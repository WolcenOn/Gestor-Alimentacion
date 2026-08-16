const sideMenu = document.getElementById("sideMenu");

function menuButtons() {
  return [...document.querySelectorAll('[data-action="open-side-menu"]')];
}

export function openSideMenu() {
  if (!sideMenu) return;
  sideMenu.classList.add("open");
  sideMenu.setAttribute("aria-hidden", "false");
  menuButtons().forEach(button => button.setAttribute("aria-expanded", "true"));
  document.body.dataset.sideMenuOpen = "true";
  window.requestAnimationFrame(() => sideMenu.querySelector("[data-side-menu-item]")?.focus({ preventScroll: true }));
}

export function closeSideMenu({ restoreFocus = false } = {}) {
  if (!sideMenu) return;
  sideMenu.classList.remove("open");
  sideMenu.setAttribute("aria-hidden", "true");
  menuButtons().forEach(button => button.setAttribute("aria-expanded", "false"));
  delete document.body.dataset.sideMenuOpen;
  if (restoreFocus) document.querySelector('.menu-trigger[data-action="open-side-menu"]')?.focus({ preventScroll: true });
}

function bindMenuControls() {
  menuButtons().forEach(button => {
    if (button.dataset.sideMenuBound === "true") return;
    button.dataset.sideMenuBound = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openSideMenu();
    });
  });

  sideMenu?.querySelectorAll('[data-action="close-side-menu"]').forEach(button => {
    if (button.dataset.sideMenuBound === "true") return;
    button.dataset.sideMenuBound = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      closeSideMenu({ restoreFocus: true });
    });
  });
}

bindMenuControls();

document.addEventListener("click", event => {
  const item = event.target.closest("[data-side-menu-item]");
  if (item && sideMenu?.classList.contains("open")) {
    window.setTimeout(() => closeSideMenu(), 0);
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && sideMenu?.classList.contains("open")) {
    closeSideMenu({ restoreFocus: true });
  }
});

window.GestorSideMenu = { open: openSideMenu, close: closeSideMenu };
