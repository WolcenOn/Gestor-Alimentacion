const isSecureContextForPWA = window.isSecureContext || location.hostname === "localhost";

if ("serviceWorker" in navigator && isSecureContextForPWA) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" })
      .then(registration => {
        window.GestorPWA = window.GestorPWA || {};
        window.GestorPWA.registration = registration;
        void registration.update();
        console.info("PWA lista para uso offline", registration.scope);
      })
      .catch(error => {
        console.warn("No se pudo registrar la PWA", error);
      });
  });
}
