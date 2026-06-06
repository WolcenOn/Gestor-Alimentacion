export function canUseBarcodeDetector() {
  return "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function scanBarcodeOnce() {
  if (!canUseBarcodeDetector()) {
    throw new Error("BarcodeDetector no está disponible. Usa entrada manual.");
  }
  const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    await new Promise(resolve => setTimeout(resolve, 700));
    const codes = await detector.detect(video);
    if (!codes.length) throw new Error("No se detectó ningún código. Prueba de nuevo o introdúcelo manualmente.");
    return codes[0].rawValue;
  } finally {
    stream.getTracks().forEach(track => track.stop());
  }
}

export async function scanBarcodeWithPreview(videoElement, statusElement, { timeoutMs = 25000 } = {}) {
  if (!canUseBarcodeDetector()) {
    throw new Error("Tu navegador no permite escaneo automático. Usa el campo manual de código de barras.");
  }
  const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach(track => track.stop());
    if (videoElement) videoElement.srcObject = null;
  };

  try {
    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.playsInline = true;
    await videoElement.play();
    const startedAt = Date.now();
    if (statusElement) statusElement.textContent = "Cámara activa. Apunta al código de barras dentro del recuadro.";

    return await new Promise((resolve, reject) => {
      async function tick() {
        if (stopped) return reject(new Error("Escáner cerrado."));
        if (Date.now() - startedAt > timeoutMs) {
          stop();
          return reject(new Error("No se detectó ningún código. Puedes introducirlo manualmente."));
        }
        try {
          const codes = await detector.detect(videoElement);
          if (codes.length) {
            const rawValue = codes[0].rawValue;
            stop();
            return resolve(rawValue);
          }
        } catch {
          // Algunos navegadores lanzan errores mientras el vídeo arranca; reintentamos.
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  } catch (error) {
    stop();
    throw error;
  }
}
